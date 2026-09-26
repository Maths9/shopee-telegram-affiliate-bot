"""
Cliente da API de Afiliados da Shopee (GraphQL)
Documentação Open API: https://open-api.affiliate.shopee.com.br/graphql
"""

import hashlib
import json
import logging
import os
import re
import time
from urllib.parse import urlparse
from typing import Optional, Dict, Any, Tuple

import requests
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)


class ShopeeAffiliateClient:
    """Cliente para interagir com a API GraphQL de afiliados da Shopee Brasil."""

    GRAPHQL_URL = "https://open-api.affiliate.shopee.com.br/graphql"

    # Domínios válidos da Shopee
    VALID_DOMAINS = {
        "shopee.com.br",
        "shp.ee",
        "s.shopee.com.br",
        "br.shopee.com",
    }

    def __init__(self, app_id: Optional[str] = None, app_secret: Optional[str] = None):
        self.app_id = (app_id or os.getenv("SHOPEE_APP_ID", "")).strip()
        self.app_secret = (app_secret or os.getenv("SHOPEE_APP_SECRET", "")).strip()
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            )
        })

    def has_credentials(self) -> bool:
        """Verifica se as credenciais da Shopee estão configuradas."""
        return bool(self.app_id and self.app_secret)

    def generate_auth_header(self, payload: str, timestamp: Optional[int] = None) -> Tuple[str, str]:
        """
        Gera a assinatura e o cabeçalho Authorization conforme a especificação da Shopee.
        Fórmula: sha256(AppId + Timestamp + Payload + Secret) em hexadecimal minúsculo.
        Header: Authorization: SHA256 Credential=<AppId>, Signature=<sig>, Timestamp=<ts>
        """
        if not self.has_credentials():
            raise ValueError("SHOPEE_APP_ID e SHOPEE_APP_SECRET devem estar configurados.")

        ts = str(timestamp or int(time.time()))
        base_str = f"{self.app_id}{ts}{payload}{self.app_secret}"
        signature = hashlib.sha256(base_str.encode("utf-8")).hexdigest()

        header_value = f"SHA256 Credential={self.app_id}, Signature={signature}, Timestamp={ts}"
        return header_value, signature

    def _execute_graphql(self, query: str, variables: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Envia requisição POST autenticada para o endpoint GraphQL da Shopee."""
        body = {"query": query}
        if variables:
            body["variables"] = variables

        # Payload compacto para evitar discrepâncias de espaços na assinatura
        payload_str = json.dumps(body, separators=(",", ":"))
        auth_header, _ = self.generate_auth_header(payload_str)

        headers = {
            "Content-Type": "application/json",
            "Authorization": auth_header,
        }

        response = self.session.post(
            self.GRAPHQL_URL,
            data=payload_str,
            headers=headers,
            timeout=15,
        )

        response.raise_for_status()
        data = response.json()

        if "errors" in data and data["errors"]:
            error_msg = "; ".join([e.get("message", "Unknown GraphQL error") for e in data["errors"]])
            raise RuntimeError(f"Shopee GraphQL Error: {error_msg}")

        return data.get("data", {})

    @classmethod
    def extract_urls_from_text(cls, text: str) -> list[str]:
        """
        Extrai todas as URLs encontradas em qualquer parte do texto.
        Funciona mesmo quando o usuário compartilha do app ('Nome do Produto\nhttps://...').
        """
        if not text:
            return []
        url_pattern = r"https?://(?:[a-zA-Z0-9\-._~:/?#\[\]@!$&'()*+,;=]|%[0-9a-fA-F]{2})+"
        matches = re.findall(url_pattern, text)
        cleaned = []
        for m in matches:
            # Remove pontuações finais comuns como ., ), ], etc.
            m = re.sub(r"[.,;:!?)\]]+$", "", m)
            if m:
                cleaned.append(m)
        return cleaned

    @classmethod
    def is_shopee_url(cls, url: str) -> bool:
        """
        Verifica se a URL pertence a um domínio oficial da Shopee
        usando análise do host via urlparse (e não regex ingênua).
        """
        try:
            parsed = urlparse(url)
            host = parsed.netloc.lower()
            if not host:
                return False
            # Remove porta caso exista
            host = host.split(":")[0]

            # Comparação exata ou verificação de sufixo de subdomínio
            for domain in cls.VALID_DOMAINS:
                if host == domain or host.endswith(f".{domain}"):
                    return True
            return False
        except Exception as e:
            logger.warning(f"Erro ao analisar host da URL {url}: {e}")
            return False

    def resolve_canonical_url(self, url: str) -> str:
        """
        Resolve redirecionamentos para links encurtados (ex: shp.ee, s.shopee.com.br)
        para encontrar a URL completa e canônica com shop_id e item_id.
        """
        parsed = urlparse(url)
        host = parsed.netloc.lower().split(":")[0]

        # Se já tiver o padrão -i.<shop_id>.<item_id>, pode ser que não precise redirecionar,
        # mas domínios como shp.ee e s.shopee sempre precisam ser resolvidos.
        is_shortener = host in {"shp.ee", "s.shopee.com.br"} or "-i." not in url

        if not is_shortener:
            return url

        try:
            logger.info(f"Resolvendo redirecionamento para link curto: {url}")
            resp = self.session.get(
                url,
                allow_redirects=True,
                timeout=12,
                headers={
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "User-Agent": (
                        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) "
                        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1"
                    ),
                },
            )
            canonical = resp.url
            logger.info(f"URL canônica resolvida: {canonical}")
            return canonical
        except Exception as e:
            logger.warning(f"Falha ao resolver redirecionamento de {url}: {e}. Usando URL original.")
            return url

    @classmethod
    def extract_product_ids(cls, url: str) -> Tuple[Optional[int], Optional[int]]:
        """
        Extrai shop_id e item_id da URL da Shopee.
        Padrões suportados:
        - Padrão clássico: '-i.<shop_id>.<item_id>'
        - Padrão de produto: '/product/<shop_id>/<item_id>'
        - Padrão query param: '?shopId=...&itemId=...'
        """
        # 1. Padrão mais comum: -i.<shop_id>.<item_id>
        match = re.search(r"-i\.(\d+)\.(\d+)", url)
        if match:
            return int(match.group(1)), int(match.group(2))

        # 2. Padrão alternativo: /product/<shop_id>/<item_id>
        match_prod = re.search(r"/product/(\d+)/(\d+)", url)
        if match_prod:
            return int(match_prod.group(1)), int(match_prod.group(2))

        # 3. Padrão universal com ponto após slug
        match_slug = re.search(r"\.(\d+)\.(\d+)(?:\?|$|#)", url)
        if match_slug:
            return int(match_slug.group(1)), int(match_slug.group(2))

        return None, None

    def get_product_offer(self, item_id: int, shop_id: int) -> Dict[str, Any]:
        """
        Consulta a API de afiliados da Shopee via productOfferV2 para obter dados do produto:
        nome, priceMin, priceMax, priceDiscountRate, imageUrl, status, etc.
        """
        query = f"""
        query {{
          productOfferV2(itemId: {item_id}, shopId: {shop_id}) {{
            itemId
            shopId
            productName
            priceMin
            priceMax
            priceDiscountRate
            imageUrl
            offerLink
            status
          }}
        }}
        """
        result = self._execute_graphql(query)
        offer = result.get("productOfferV2")
        if not offer:
            raise ValueError(f"Produto item_id={item_id}, shop_id={shop_id} não encontrado na API de Afiliados.")
        return offer

    def generate_short_link(self, origin_url: str, sub_ids: Optional[list[str]] = None) -> str:
        """
        Chama a mutation generateShortLink para converter o link original
        num link de afiliado rastreado pela conta Shopee.
        """
        sub_ids_str = ""
        if sub_ids:
            clean_subs = [f'"{s}"' for s in sub_ids if s]
            if clean_subs:
                sub_ids_str = f', subIds: [{", ".join(clean_subs)}]'

        mutation = f"""
        mutation {{
          generateShortLink(input: {{ originUrl: "{origin_url}"{sub_ids_str} }}) {{
            shortLink
          }}
        }}
        """
        result = self._execute_graphql(mutation)
        gen = result.get("generateShortLink")
        if not gen or "shortLink" not in gen:
            raise ValueError("Não foi possível gerar o link curto de afiliado.")
        return gen["shortLink"]

    def process_shopee_link(self, raw_url: str) -> Dict[str, Any]:
        """
        Pipeline completo de processamento:
        1. Validação de domínio
        2. Desencurtamento da URL
        3. Extração de IDs (shop_id, item_id)
        4. Consulta GraphQL (productOfferV2)
        5. Geração de short link de afiliado (generateShortLink)
        """
        if not self.is_shopee_url(raw_url):
            raise ValueError(f"A URL '{raw_url}' não pertence a um domínio oficial da Shopee.")

        canonical_url = self.resolve_canonical_url(raw_url)
        shop_id, item_id = self.extract_product_ids(canonical_url)

        product_data: Optional[Dict[str, Any]] = None
        affiliate_link: Optional[str] = None
        errors: list[str] = []

        if not self.has_credentials():
            logger.warning("Credenciais da Shopee não configuradas. Usando URL original.")
            return {
                "canonical_url": canonical_url,
                "original_url": raw_url,
                "shop_id": shop_id,
                "item_id": item_id,
                "affiliate_link": canonical_url,
                "product": None,
                "is_fallback": True,
                "error": "Credenciais da Shopee não configuradas no .env",
            }

        # Tenta obter dados do produto se os IDs foram encontrados
        if shop_id and item_id:
            try:
                product_data = self.get_product_offer(item_id=item_id, shop_id=shop_id)
            except Exception as e:
                msg = f"Falha ao consultar productOfferV2: {e}"
                logger.warning(msg)
                errors.append(msg)

        # Tenta gerar o link de afiliado
        try:
            target_url = canonical_url if canonical_url else raw_url
            affiliate_link = self.generate_short_link(target_url)
        except Exception as e:
            msg = f"Falha ao gerar generateShortLink: {e}"
            logger.warning(msg)
            errors.append(msg)

        # Fallback de link se o gerador falhar
        final_link = affiliate_link or (product_data.get("offerLink") if product_data else None) or canonical_url or raw_url

        return {
            "canonical_url": canonical_url,
            "original_url": raw_url,
            "shop_id": shop_id,
            "item_id": item_id,
            "affiliate_link": final_link,
            "product": product_data,
            "is_fallback": bool(errors),
            "error": " | ".join(errors) if errors else None,
        }
