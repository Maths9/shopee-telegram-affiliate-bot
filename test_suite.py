"""
Testes unitários para validação de lógica do bot e cliente Shopee
"""

import hashlib
import unittest
try:
    import requests
    import telebot
    from shopee_affiliate import ShopeeAffiliateClient
    from bot import build_caption, format_currency
    HAS_LIBS = True
except ImportError:
    HAS_LIBS = False


class TestShopeeAffiliate(unittest.TestCase):

    def setUp(self):
        if not HAS_LIBS:
            self.skipTest("Bibliotecas 'requests' e 'telebot' não instaladas no ambiente local. Use pip install -r requirements.txt para rodar a suíte completa.")

    def test_extract_urls(self):
        text1 = "Confira esse produto: https://shopee.com.br/product-i.123456.7890123 vale a pena!"
        urls = ShopeeAffiliateClient.extract_urls_from_text(text1)
        self.assertEqual(len(urls), 1)
        self.assertEqual(urls[0], "https://shopee.com.br/product-i.123456.7890123")

        text_multiple = "Links: https://shp.ee/abc1234 e https://s.shopee.com.br/xyz5678."
        urls_multi = ShopeeAffiliateClient.extract_urls_from_text(text_multiple)
        self.assertEqual(len(urls_multi), 2)
        self.assertEqual(urls_multi[0], "https://shp.ee/abc1234")
        self.assertEqual(urls_multi[1], "https://s.shopee.com.br/xyz5678")

    def test_is_shopee_url(self):
        self.assertTrue(ShopeeAffiliateClient.is_shopee_url("https://shopee.com.br/item-i.123.456"))
        self.assertTrue(ShopeeAffiliateClient.is_shopee_url("https://s.shopee.com.br/abcdef"))
        self.assertTrue(ShopeeAffiliateClient.is_shopee_url("https://shp.ee/1234567"))
        self.assertTrue(ShopeeAffiliateClient.is_shopee_url("https://seller.shopee.com.br/portal"))
        self.assertFalse(ShopeeAffiliateClient.is_shopee_url("https://google.com"))
        self.assertFalse(ShopeeAffiliateClient.is_shopee_url("https://shopee.fake.com"))

    def test_extract_product_ids(self):
        url1 = "https://shopee.com.br/Fone-de-Ouvido-Bluetooth-Sem-Fio-i.314159.2653589"
        shop_id, item_id = ShopeeAffiliateClient.extract_product_ids(url1)
        self.assertEqual(shop_id, 314159)
        self.assertEqual(item_id, 2653589)

        url2 = "https://shopee.com.br/product/987654/12345678"
        shop_id2, item_id2 = ShopeeAffiliateClient.extract_product_ids(url2)
        self.assertEqual(shop_id2, 987654)
        self.assertEqual(item_id2, 12345678)

    def test_signature_generation(self):
        client = ShopeeAffiliateClient(app_id="test_app_id", app_secret="test_secret_key")
        payload = '{"query":"{}"}'
        timestamp = 1710000000

        header, signature = client.generate_auth_header(payload, timestamp=timestamp)

        expected_base = f"test_app_id1710000000{payload}test_secret_key"
        expected_sig = hashlib.sha256(expected_base.encode("utf-8")).hexdigest()

        self.assertEqual(signature, expected_sig)
        self.assertIn("SHA256 Credential=test_app_id", header)
        self.assertIn(f"Signature={expected_sig}", header)
        self.assertIn("Timestamp=1710000000", header)

    def test_build_caption_with_discount(self):
        product = {
            "productName": "Teclado Mecânico RGB Gamer",
            "priceMin": 150.0,
            "priceMax": 150.0,
            "priceDiscountRate": 25.0,
        }
        caption = build_caption(product)
        self.assertIn("🚨 <b>OFERTA IMPERDÍVEL</b> 🚨", caption)
        self.assertIn("Teclado Mecânico RGB Gamer", caption)
        self.assertIn("<s>R$ 200,00</s>", caption)  # 150 / 0.75 = 200
        self.assertIn("R$ 150,00", caption)
        self.assertIn("-25% OFF", caption)

    def test_build_caption_with_variation_range(self):
        product = {
            "productName": "Camiseta Básica 100% Algodão",
            "priceMin": 29.90,
            "priceMax": 49.90,
            "priceDiscountRate": 0.0,
        }
        caption = build_caption(product)
        self.assertIn("R$ 29,90", caption)
        self.assertIn("R$ 49,90", caption)
        self.assertIn("até", caption)


if __name__ == "__main__":
    unittest.main()
