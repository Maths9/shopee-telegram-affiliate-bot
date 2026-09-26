export const CODE_SNIPPETS = {
  botPy: `"""
Bot do Telegram - Poster Automático de Ofertas da Shopee
Converte links de produtos da Shopee em links de afiliado e posta no canal com botões interativos.
"""

import html
import logging
import os
import sys
import threading
from urllib.parse import quote

import telebot
from telebot import types
from dotenv import load_dotenv
from flask import Flask, jsonify

from shopee_affiliate import ShopeeAffiliateClient

# Configuração de logs
logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    level=logging.INFO,
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("ShopeeTelegramBot")

# Carrega variáveis de ambiente do .env
load_dotenv()

TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN", "").strip()
CANAL_ID = os.getenv("CANAL_ID", "").strip()
SHOPEE_APP_ID = os.getenv("SHOPEE_APP_ID", "").strip()
SHOPEE_APP_SECRET = os.getenv("SHOPEE_APP_SECRET", "").strip()
PORT = int(os.getenv("PORT", "8080"))
CANAL_USERNAME = os.getenv("CANAL_USERNAME", "").strip()

if not CANAL_USERNAME and CANAL_ID.startswith("@"):
    CANAL_USERNAME = CANAL_ID

# Inicializa o bot do Telegram
bot = telebot.TeleBot(TELEGRAM_TOKEN, parse_mode=None)

# Inicializa o cliente da Shopee
shopee_client = ShopeeAffiliateClient(app_id=SHOPEE_APP_ID, app_secret=SHOPEE_APP_SECRET)

# Inicializa o servidor Flask (mantém o processo ativo em hosts como Render/Railway)
app = Flask(__name__)


@app.route("/")
def index():
    return jsonify({
        "status": "online",
        "service": "Shopee Telegram Affiliate Bot",
        "bot_configured": bool(TELEGRAM_TOKEN),
        "channel_configured": bool(CANAL_ID),
        "shopee_configured": shopee_client.has_credentials(),
    }), 200


@app.route("/health")
def health():
    return "OK", 200


def run_flask():
    """Inicia o servidor Flask em thread separada."""
    logger.info(f"Iniciando servidor HTTP Flask na porta {PORT}...")
    app.run(host="0.0.0.0", port=PORT, debug=False, use_reloader=False)


def format_currency(value: float) -> str:
    """Formata valor em Real brasileiro (R$ 12,34)."""
    return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def build_caption(product_data: dict, fallback_url: str = "") -> str:
    """
    Monta a legenda do post em HTML (parse_mode='HTML' do Telegram).
    - Título fixo '🚨 OFERTA IMPERDÍVEL 🚨'
    - Nome do produto
    - Preço atual e preço riscado se houver desconto
    - Se houver variação (priceMin != priceMax), mostra faixa de preço
    """
    lines = ["🚨 <b>OFERTA IMPERDÍVEL</b> 🚨\\n"]

    if product_data and product_data.get("productName"):
        name_escaped = html.escape(product_data["productName"])
        lines.append(f"📦 <b>{name_escaped}</b>\\n")
    else:
        lines.append("📦 <b>Produto em Destaque na Shopee!</b>\\n")

    if product_data:
        p_min = product_data.get("priceMin")
        p_max = product_data.get("priceMax")
        discount = product_data.get("priceDiscountRate")

        try:
            p_min = float(p_min) if p_min is not None else 0.0
            p_max = float(p_max) if p_max is not None else 0.0
            discount = float(discount) if discount is not None else 0.0
        except (ValueError, TypeError):
            p_min, p_max, discount = 0.0, 0.0, 0.0

        if p_min > 0 and p_max > 0 and abs(p_min - p_max) > 0.01:
            lines.append(f"💥 Por: <b>{format_currency(p_min)}</b> até <b>{format_currency(p_max)}</b>")
        elif p_min > 0:
            if discount > 0 and discount < 100:
                price_original = p_min / (1 - (discount / 100))
                lines.append(f"🔥 De: <s>{format_currency(price_original)}</s>")
                lines.append(f"💥 Por apenas: <b>{format_currency(p_min)}</b> <i>(-{int(discount)}% OFF)</i>")
            else:
                lines.append(f"💥 Por apenas: <b>{format_currency(p_min)}</b>")
    else:
        lines.append("⚡ Aproveite as melhores condições e cupom de frete grátis!")

    if CANAL_USERNAME:
        clean_user = CANAL_USERNAME if CANAL_USERNAME.startswith("@") else f"@{CANAL_USERNAME}"
        lines.append(f"\\n👉 Siga o canal para mais ofertas: {clean_user}")

    return "\\n".join(lines)


def build_inline_keyboard(affiliate_url: str, product_name: str = "") -> types.InlineKeyboardMarkup:
    """
    Cria os botões inline do post:
    1. '🛒 COMPRAR' (abre o link de afiliado)
    2. '📢 COMPARTILHAR' (link especial t.me/share/url com texto de divulgação)
    """
    markup = types.InlineKeyboardMarkup(row_width=2)
    btn_buy = types.InlineKeyboardButton(text="🛒 COMPRAR", url=affiliate_url)

    share_title = product_name[:60] if product_name else "Super Oferta na Shopee"
    share_channel_text = f" no {CANAL_USERNAME}" if CANAL_USERNAME else ""
    share_text = f"🔥 Olha essa oferta que encontrei{share_channel_text}: {share_title}!\\n\\nAproveite:"

    share_url = f"https://t.me/share/url?url={quote(affiliate_url)}&text={quote(share_text)}"
    btn_share = types.InlineKeyboardButton(text="📢 COMPARTILHAR", url=share_url)

    markup.add(btn_buy, btn_share)
    return markup


@bot.message_handler(commands=["start", "help"])
def send_welcome(message: types.Message):
    welcome_text = (
        "👋 <b>Olá! Eu sou o Bot Poster de Ofertas da Shopee.</b>\\n\\n"
        "Basta me enviar <b>qualquer mensagem contendo um link de produto da Shopee</b> "
        "(pode ser link direto ou compartilhado do app)!\\n\\n"
        "✨ <b>O que eu faço automaticamente:</b>\\n"
        "1. Extraio a URL e resolvo links curtos (<code>shp.ee</code>, <code>s.shopee.com.br</code>)\\n"
        "2. Consulto as informações do produto e valores na Shopee\\n"
        "3. Converto o link num link de afiliado rastreado pela sua conta\\n"
        "4. Publico o post formatado com foto, preço e botões no seu canal!\\n\\n"
        "💡 <i>Você não precisa digitar nome, preço ou foto, tudo é automático!</i>"
    )
    bot.reply_to(message, welcome_text, parse_mode="HTML")


@bot.message_handler(commands=["status"])
def check_status(message: types.Message):
    shopee_ok = "✅ Configurado" if shopee_client.has_credentials() else "❌ Não configurado (.env)"
    canal_ok = f"✅ {CANAL_ID}" if CANAL_ID else "❌ Não configurado (.env)"

    status_msg = (
        "⚙️ <b>Status do Sistema:</b>\\n\\n"
        f"• <b>Canal Alvo:</b> {canal_ok}\\n"
        f"• <b>Credenciais Shopee:</b> {shopee_ok}\\n"
        f"• <b>Servidor HTTP (Keep-Alive):</b> Ativo na porta {PORT}\\n"
    )
    bot.reply_to(message, status_msg, parse_mode="HTML")


@bot.message_handler(func=lambda msg: True, content_types=["text"])
def handle_incoming_message(message: types.Message):
    user_text = message.text or ""
    chat_id = message.chat.id

    urls = ShopeeAffiliateClient.extract_urls_from_text(user_text)
    if not urls:
        bot.reply_to(
            message,
            "ℹ️ <b>Nenhum link detectado!</b>\\n"
            "Por favor, envie uma mensagem contendo um link de produto da Shopee.",
            parse_mode="HTML",
        )
        return

    shopee_url = None
    for u in urls:
        if ShopeeAffiliateClient.is_shopee_url(u):
            shopee_url = u
            break

    if not shopee_url:
        bot.reply_to(
            message,
            "⚠️ <b>Link não reconhecido como Shopee!</b>\\n"
            "O link deve pertencer aos domínios <code>shopee.com.br</code> ou <code>shp.ee</code>.",
            parse_mode="HTML",
        )
        return

    status_msg = bot.reply_to(message, "⏳ <i>Processando link da Shopee, aguarde...</i>", parse_mode="HTML")

    try:
        result = shopee_client.process_shopee_link(shopee_url)

        product = result.get("product")
        affiliate_url = result.get("affiliate_link") or shopee_url
        is_fallback = result.get("is_fallback", False)
        error_detail = result.get("error")

        if is_fallback:
            warning_text = (
                "⚠️ <b>Aviso de Resiliência:</b>\\n"
                "Houve uma falha ao obter todos os dados da API da Shopee:\\n"
                f"<code>{html.escape(error_detail or 'Erro desconhecido')}</code>\\n\\n"
                "👉 <i>A oferta será postada no canal utilizando o link disponível!</i>"
            )
            bot.send_message(chat_id, warning_text, parse_mode="HTML")

        caption = build_caption(product, fallback_url=shopee_url)
        product_name = product.get("productName", "") if product else ""
        keyboard = build_inline_keyboard(affiliate_url, product_name=product_name)

        if not CANAL_ID:
            bot.edit_message_text(
                "❌ <b>Erro de configuração:</b> CANAL_ID não está definido no arquivo .env!\\n"
                "Configure a variável CANAL_ID com o @nomedocanal ou ID numérico.",
                chat_id=chat_id,
                message_id=status_msg.message_id,
                parse_mode="HTML",
            )
            return

        image_url = product.get("imageUrl") if product else None
        if image_url:
            try:
                bot.send_photo(
                    chat_id=CANAL_ID,
                    photo=image_url,
                    caption=caption,
                    parse_mode="HTML",
                    reply_markup=keyboard,
                )
            except Exception as e_photo:
                logger.warning(f"Falha ao enviar foto: {e_photo}. Tentando texto...")
                bot.send_message(
                    chat_id=CANAL_ID,
                    text=caption,
                    parse_mode="HTML",
                    reply_markup=keyboard,
                )
        else:
            bot.send_message(
                chat_id=CANAL_ID,
                text=caption,
                parse_mode="HTML",
                reply_markup=keyboard,
            )

        confirm_text = (
            "✅ <b>Oferta postada no canal com sucesso!</b>\\n\\n"
            f"🔗 <b>Link gerado:</b> <code>{html.escape(affiliate_url)}</code>\\n"
            f"📢 <b>Canal:</b> <code>{CANAL_ID}</code>"
        )
        bot.edit_message_text(
            confirm_text,
            chat_id=chat_id,
            message_id=status_msg.message_id,
            parse_mode="HTML",
        )

    except Exception as e:
        logger.exception(f"Erro ao processar mensagem: {e}")
        bot.edit_message_text(
            f"❌ <b>Erro ao processar:</b> {html.escape(str(e))}",
            chat_id=chat_id,
            message_id=status_msg.message_id,
            parse_mode="HTML",
        )


def main():
    flask_thread = threading.Thread(target=run_flask, daemon=True)
    flask_thread.start()

    if not TELEGRAM_TOKEN:
        logger.error("TELEGRAM_TOKEN não configurado! Preencha o .env.")
        flask_thread.join()
        return

    logger.info("Iniciando polling do Telegram bot...")
    bot.infinity_polling(timeout=30, long_polling_timeout=20)


if __name__ == "__main__":
    main()
`,
  shopeeAffiliatePy: `"""
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
        body = {"query": query}
        if variables:
            body["variables"] = variables

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
        if not text:
            return []
        url_pattern = r"https?://(?:[a-zA-Z0-9\-._~:/?#\\[\\]@!$&'()*+,;=]|%[0-9a-fA-F]{2})+"
        matches = re.findall(url_pattern, text)
        cleaned = []
        for m in matches:
            m = re.sub(r"[.,;:!?)\\]]+$", "", m)
            if m:
                cleaned.append(m)
        return cleaned

    @classmethod
    def is_shopee_url(cls, url: str) -> bool:
        try:
            parsed = urlparse(url)
            host = parsed.netloc.lower().split(":")[0]
            if not host:
                return False
            for domain in cls.VALID_DOMAINS:
                if host == domain or host.endswith(f".{domain}"):
                    return True
            return False
        except Exception:
            return False

    def resolve_canonical_url(self, url: str) -> str:
        parsed = urlparse(url)
        host = parsed.netloc.lower().split(":")[0]
        is_shortener = host in {"shp.ee", "s.shopee.com.br"} or "-i." not in url

        if not is_shortener:
            return url

        try:
            resp = self.session.get(
                url,
                allow_redirects=True,
                timeout=12,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) "
                        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1"
                    ),
                },
            )
            return resp.url
        except Exception as e:
            logger.warning(f"Falha ao resolver redirecionamento: {e}")
            return url

    @classmethod
    def extract_product_ids(cls, url: str) -> Tuple[Optional[int], Optional[int]]:
        match = re.search(r"-i\\.(\\d+)\\.(\\d+)", url)
        if match:
            return int(match.group(1)), int(match.group(2))

        match_prod = re.search(r"/product/(\\d+)/(\\d+)", url)
        if match_prod:
            return int(match_prod.group(1)), int(match_prod.group(2))

        match_slug = re.search(r"\\.(\\d+)\\.(\\d+)(?:\\?|$|#)", url)
        if match_slug:
            return int(match_slug.group(1)), int(match_slug.group(2))

        return None, None

    def get_product_offer(self, item_id: int, shop_id: int) -> Dict[str, Any]:
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
            raise ValueError(f"Produto {item_id}/{shop_id} não encontrado na API.")
        return offer

    def generate_short_link(self, origin_url: str, sub_ids: Optional[list[str]] = None) -> str:
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
            raise ValueError("Não foi possível gerar shortLink.")
        return gen["shortLink"]

    def process_shopee_link(self, raw_url: str) -> Dict[str, Any]:
        if not self.is_shopee_url(raw_url):
            raise ValueError(f"A URL '{raw_url}' não pertence à Shopee.")

        canonical_url = self.resolve_canonical_url(raw_url)
        shop_id, item_id = self.extract_product_ids(canonical_url)

        product_data = None
        affiliate_link = None
        errors = []

        if not self.has_credentials():
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

        if shop_id and item_id:
            try:
                product_data = self.get_product_offer(item_id=item_id, shop_id=shop_id)
            except Exception as e:
                errors.append(f"productOfferV2: {e}")

        try:
            target_url = canonical_url if canonical_url else raw_url
            affiliate_link = self.generate_short_link(target_url)
        except Exception as e:
            errors.append(f"generateShortLink: {e}")

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
`,
  requirementsTxt: `pyTelegramBotAPI>=4.20.0
Flask>=3.0.0
python-dotenv>=1.0.0
requests>=2.31.0
urllib3>=2.0.0
`,
  envExample: `# Telegram Bot Configuration (@BotFather)
TELEGRAM_TOKEN=123456789:ABCDefGhIJKlmNoPQRsTUVwxyZ

# Canal Alvo (o bot DEVE ser administrador com permissão de postar)
CANAL_ID=@seu_canal_de_ofertas
CANAL_USERNAME=@seu_canal_de_ofertas

# Credenciais Shopee Afiliados Open API (https://affiliate.shopee.com.br/open_api)
SHOPEE_APP_ID=seu_app_id
SHOPEE_APP_SECRET=seu_app_secret

# Porta HTTP (para manter o bot ativo no Render/Railway)
PORT=8080
`,
  procfile: `web: python bot.py
`,
};
