"""
Testes de validação dos algoritmos do bot e Shopee usando apenas a biblioteca padrão do Python.
"""

import hashlib
import json
import re
import unittest
from urllib.parse import urlparse, quote


class ShopeeStandaloneLogic:
    """Implementação pura da lógica matemática e de extração para validação sem dependências externas."""

    VALID_DOMAINS = {"shopee.com.br", "shp.ee", "s.shopee.com.br", "br.shopee.com"}

    @classmethod
    def extract_urls(cls, text: str) -> list[str]:
        if not text:
            return []
        url_pattern = r"https?://(?:[a-zA-Z0-9\-._~:/?#\[\]@!$&'()*+,;=]|%[0-9a-fA-F]{2})+"
        matches = re.findall(url_pattern, text)
        cleaned = []
        for m in matches:
            m = re.sub(r"[.,;:!?)\]]+$", "", m)
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

    @classmethod
    def extract_product_ids(cls, url: str):
        match = re.search(r"-i\.(\d+)\.(\d+)", url)
        if match:
            return int(match.group(1)), int(match.group(2))
        match_prod = re.search(r"/product/(\d+)/(\d+)", url)
        if match_prod:
            return int(match_prod.group(1)), int(match_prod.group(2))
        match_slug = re.search(r"\.(\d+)\.(\d+)(?:\?|$|#)", url)
        if match_slug:
            return int(match_slug.group(1)), int(match_slug.group(2))
        return None, None

    @classmethod
    def calculate_signature(cls, app_id: str, app_secret: str, payload_str: str, timestamp: int):
        base_str = f"{app_id}{timestamp}{payload_str}{app_secret}"
        signature = hashlib.sha256(base_str.encode("utf-8")).hexdigest()
        header = f"SHA256 Credential={app_id}, Signature={signature}, Timestamp={timestamp}"
        return header, signature

    @classmethod
    def format_currency(cls, value: float) -> str:
        return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

    @classmethod
    def build_caption(cls, product_data: dict, canal_username: str = "") -> str:
        lines = ["🚨 <b>OFERTA IMPERDÍVEL</b> 🚨\n"]
        name = product_data.get("productName", "Produto em Destaque na Shopee!")
        lines.append(f"📦 <b>{name}</b>\n")

        p_min = float(product_data.get("priceMin", 0))
        p_max = float(product_data.get("priceMax", 0))
        discount = float(product_data.get("priceDiscountRate", 0))

        if p_min > 0 and p_max > 0 and abs(p_min - p_max) > 0.01:
            lines.append(f"💥 Por: <b>{cls.format_currency(p_min)}</b> até <b>{cls.format_currency(p_max)}</b>")
        elif p_min > 0:
            if discount > 0 and discount < 100:
                price_original = p_min / (1 - (discount / 100))
                lines.append(f"🔥 De: <s>{cls.format_currency(price_original)}</s>")
                lines.append(f"💥 Por apenas: <b>{cls.format_currency(p_min)}</b> <i>(-{int(discount)}% OFF)</i>")
            else:
                lines.append(f"💥 Por apenas: <b>{cls.format_currency(p_min)}</b>")

        if canal_username:
            user = canal_username if canal_username.startswith("@") else f"@{canal_username}"
            lines.append(f"\n👉 Siga o canal para mais ofertas: {user}")

        return "\n".join(lines)


class TestStandaloneAlgorithms(unittest.TestCase):

    def test_extract_urls_from_shared_message(self):
        msg = "Olha esse produto que vi na Shopee!\nFone Bluetooth Sem Fio\nhttps://s.shopee.com.br/12345XYZ\nSuper recomendo!"
        urls = ShopeeStandaloneLogic.extract_urls(msg)
        self.assertEqual(urls, ["https://s.shopee.com.br/12345XYZ"])

    def test_domains(self):
        self.assertTrue(ShopeeStandaloneLogic.is_shopee_url("https://shp.ee/abc"))
        self.assertTrue(ShopeeStandaloneLogic.is_shopee_url("https://s.shopee.com.br/def"))
        self.assertTrue(ShopeeStandaloneLogic.is_shopee_url("https://shopee.com.br/item-i.111.222"))
        self.assertFalse(ShopeeStandaloneLogic.is_shopee_url("https://mercadolivre.com.br/item"))

    def test_product_id_extraction(self):
        url = "https://shopee.com.br/Camisa-Polo-Dry-Fit-Masculina-i.456789.987654321?sp_atk=123"
        shop_id, item_id = ShopeeStandaloneLogic.extract_product_ids(url)
        self.assertEqual(shop_id, 456789)
        self.assertEqual(item_id, 987654321)

    def test_signature(self):
        app_id = "100200"
        secret = "secret_xyz"
        payload = '{"query":"query { productOfferV2(itemId: 1, shopId: 2) { itemId } }"}'
        ts = 1720000000
        header, sig = ShopeeStandaloneLogic.calculate_signature(app_id, secret, payload, ts)
        expected = hashlib.sha256(f"1002001720000000{payload}secret_xyz".encode()).hexdigest()
        self.assertEqual(sig, expected)
        self.assertTrue(header.startswith("SHA256 Credential=100200"))

    def test_caption_formatting(self):
        prod = {
            "productName": "Garrafa Térmica 1L Inox",
            "priceMin": 49.90,
            "priceMax": 49.90,
            "priceDiscountRate": 50.0,
        }
        cap = ShopeeStandaloneLogic.build_caption(prod, canal_username="@ofertasbr")
        self.assertIn("🚨 <b>OFERTA IMPERDÍVEL</b> 🚨", cap)
        self.assertIn("Garrafa Térmica 1L Inox", cap)
        self.assertIn("<s>R$ 99,80</s>", cap)
        self.assertIn("R$ 49,90", cap)
        self.assertIn("-50% OFF", cap)
        self.assertIn("@ofertasbr", cap)


if __name__ == "__main__":
    unittest.main()
