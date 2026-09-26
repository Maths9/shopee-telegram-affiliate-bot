"""
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

# Se CANAL_USERNAME não foi informado mas CANAL_ID começa com @, usa ele mesmo
if not CANAL_USERNAME and CANAL_ID.startswith("@"):
    CANAL_USERNAME = CANAL_ID

if not TELEGRAM_TOKEN:
    logger.warning("TELEGRAM_TOKEN não configurado no .env! O bot não iniciará até que seja fornecido.")

if not CANAL_ID:
    logger.warning("CANAL_ID não configurado no .env! Posts no canal falharão.")

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
    # Rodar sem reloader para não conflitar com a thread principal do bot
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
    lines = ["🚨 <b>OFERTA IMPERDÍVEL</b> 🚨\n"]

    if product_data and product_data.get("productName"):
        # Escapa caracteres HTML do nome do produto por segurança
        name_escaped = html.escape(product_data["productName"])
        lines.append(f"📦 <b>{name_escaped}</b>\n")
    else:
        lines.append("📦 <b>Produto em Destaque na Shopee!</b>\n")

    if product_data:
        p_min = product_data.get("priceMin")
        p_max = product_data.get("priceMax")
        discount = product_data.get("priceDiscountRate")

        # Conversão para float caso venham como string
        try:
            p_min = float(p_min) if p_min is not None else 0.0
            p_max = float(p_max) if p_max is not None else 0.0
            discount = float(discount) if discount is not None else 0.0
        except (ValueError, TypeError):
            p_min, p_max, discount = 0.0, 0.0, 0.0

        if p_min > 0 and p_max > 0 and abs(p_min - p_max) > 0.01:
            # Faixa de preço com variação
            lines.append(f"💥 Por: <b>{format_currency(p_min)}</b> até <b>{format_currency(p_max)}</b>")
        elif p_min > 0:
            if discount > 0 and discount < 100:
                # Calcula preço original estimado com base no desconto
                price_original = p_min / (1 - (discount / 100))
                lines.append(f"🔥 De: <s>{format_currency(price_original)}</s>")
                lines.append(f"💥 Por apenas: <b>{format_currency(p_min)}</b> <i>(-{int(discount)}% OFF)</i>")
            else:
                lines.append(f"💥 Por apenas: <b>{format_currency(p_min)}</b>")
    else:
        lines.append("⚡ Aproveite as melhores condições e cupom de frete grátis!")

    # Adiciona menção do canal se configurado
    if CANAL_USERNAME:
        clean_user = CANAL_USERNAME if CANAL_USERNAME.startswith("@") else f"@{CANAL_USERNAME}"
        lines.append(f"\n👉 Siga o canal para mais ofertas: {clean_user}")

    return "\n".join(lines)


def build_inline_keyboard(affiliate_url: str, product_name: str = "") -> types.InlineKeyboardMarkup:
    """
    Cria os botões inline do post:
    1. '🛒 COMPRAR' (abre o link de afiliado)
    2. '📢 COMPARTILHAR' (link especial t.me/share/url com texto de divulgação)
    """
    markup = types.InlineKeyboardMarkup(row_width=2)

    # Botão de compra direta com link de afiliado
    btn_buy = types.InlineKeyboardButton(text="🛒 COMPRAR", url=affiliate_url)

    # Texto para compartilhamento no Telegram
    share_title = product_name[:60] if product_name else "Super Oferta na Shopee"
    share_channel_text = f" no {CANAL_USERNAME}" if CANAL_USERNAME else ""
    share_text = f"🔥 Olha essa oferta que encontrei{share_channel_text}: {share_title}!\n\nAproveite:"

    share_url = f"https://t.me/share/url?url={quote(affiliate_url)}&text={quote(share_text)}"
    btn_share = types.InlineKeyboardButton(text="📢 COMPARTILHAR", url=share_url)

    markup.add(btn_buy, btn_share)
    return markup


@bot.message_handler(commands=["start", "help"])
def send_welcome(message: types.Message):
    """Responde aos comandos de boas-vindas com instruções de uso."""
    welcome_text = (
        "👋 <b>Olá! Eu sou o Bot Poster de Ofertas da Shopee.</b>\n\n"
        "Basta me enviar <b>qualquer mensagem contendo um link de produto da Shopee</b> "
        "(pode ser link direto ou compartilhado do app)!\n\n"
        "✨ <b>O que eu faço automaticamente:</b>\n"
        "1. Extraio a URL e resolvo links curtos (<code>shp.ee</code>, <code>s.shopee.com.br</code>)\n"
        "2. Consulto as informações do produto e valores na Shopee\n"
        "3. Converto o link num link de afiliado rastreado pela sua conta\n"
        "4. Publico o post formatado com foto, preço e botões no seu canal!\n\n"
        "💡 <i>Você não precisa digitar nome, preço ou foto, tudo é automático!</i>"
    )
    bot.reply_to(message, welcome_text, parse_mode="HTML")


@bot.message_handler(commands=["status"])
def check_status(message: types.Message):
    """Exibe o status atual de configuração do bot e das credenciais."""
    shopee_ok = "✅ Configurado" if shopee_client.has_credentials() else "❌ Não configurado (.env)"
    canal_ok = f"✅ {CANAL_ID}" if CANAL_ID else "❌ Não configurado (.env)"

    status_msg = (
        "⚙️ <b>Status do Sistema:</b>\n\n"
        f"• <b>Canal Alvo:</b> {canal_ok}\n"
        f"• <b>Credenciais Shopee:</b> {shopee_ok}\n"
        f"• <b>Servidor HTTP (Keep-Alive):</b> Ativo na porta {PORT}\n"
    )
    bot.reply_to(message, status_msg, parse_mode="HTML")


@bot.message_handler(func=lambda msg: True, content_types=["text"])
def handle_incoming_message(message: types.Message):
    """
    Processa qualquer mensagem de texto recebida.
    Extrai a URL da Shopee, obtém dados via API, converte link e posta no canal.
    """
    user_text = message.text or ""
    chat_id = message.chat.id

    # 1. Extração de URLs do texto usando regex
    urls = ShopeeAffiliateClient.extract_urls_from_text(user_text)

    if not urls:
        bot.reply_to(
            message,
            "ℹ️ <b>Nenhum link detectado!</b>\n"
            "Por favor, envie uma mensagem contendo um link de produto da Shopee.",
            parse_mode="HTML",
        )
        return

    # 2. Localiza a primeira URL pertencente a domínios da Shopee
    shopee_url = None
    for u in urls:
        if ShopeeAffiliateClient.is_shopee_url(u):
            shopee_url = u
            break

    if not shopee_url:
        bot.reply_to(
            message,
            "⚠️ <b>Link não reconhecido como Shopee!</b>\n"
            "O link deve pertencer aos domínios <code>shopee.com.br</code> ou <code>shp.ee</code>.",
            parse_mode="HTML",
        )
        return

    # Mensagem de feedback inicial ao remetente
    status_msg = bot.reply_to(
        message,
        "⏳ <i>Processando link da Shopee, aguarde...</i>",
        parse_mode="HTML",
    )

    try:
        # 3. Processa a URL com o cliente Shopee
        result = shopee_client.process_shopee_link(shopee_url)

        product = result.get("product")
        affiliate_url = result.get("affiliate_link") or shopee_url
        is_fallback = result.get("is_fallback", False)
        error_detail = result.get("error")

        # 4. Notifica o remetente em privado caso a API tenha falhado (resiliência)
        if is_fallback:
            warning_text = (
                "⚠️ <b>Aviso de Resiliência:</b>\n"
                "Houve uma falha ao obter todos os dados da API da Shopee:\n"
                f"<code>{html.escape(error_detail or 'Erro desconhecido')}</code>\n\n"
                "👉 <i>A oferta será postada no canal utilizando o link disponível!</i>"
            )
            bot.send_message(chat_id, warning_text, parse_mode="HTML")

        # 5. Monta a legenda do post em HTML
        caption = build_caption(product, fallback_url=shopee_url)
        product_name = product.get("productName", "") if product else ""
        keyboard = build_inline_keyboard(affiliate_url, product_name=product_name)

        if not CANAL_ID:
            bot.edit_message_text(
                "❌ <b>Erro de configuração:</b> CANAL_ID não está definido no arquivo .env!\n"
                "Configure a variável CANAL_ID com o @nomedocanal ou ID numérico.",
                chat_id=chat_id,
                message_id=status_msg.message_id,
                parse_mode="HTML",
            )
            return

        # 6. Posta no canal configurado (CANAL_ID)
        image_url = product.get("imageUrl") if product else None
        posted_msg = None

        if image_url:
            try:
                posted_msg = bot.send_photo(
                    chat_id=CANAL_ID,
                    photo=image_url,
                    caption=caption,
                    parse_mode="HTML",
                    reply_markup=keyboard,
                )
            except Exception as e_photo:
                logger.warning(f"Falha ao enviar foto para o canal: {e_photo}. Tentando como texto...")
                # Fallback se a imagem não puder ser baixada pelo Telegram
                posted_msg = bot.send_message(
                    chat_id=CANAL_ID,
                    text=caption,
                    parse_mode="HTML",
                    reply_markup=keyboard,
                    disable_web_page_preview=False,
                )
        else:
            posted_msg = bot.send_message(
                chat_id=CANAL_ID,
                text=caption,
                parse_mode="HTML",
                reply_markup=keyboard,
                disable_web_page_preview=False,
            )

        # 7. Confirmação ao remetente
        confirm_text = (
            "✅ <b>Oferta postada no canal com sucesso!</b>\n\n"
            f"🔗 <b>Link gerado:</b> <code>{html.escape(affiliate_url)}</code>\n"
            f"📢 <b>Canal:</b> <code>{CANAL_ID}</code>"
        )
        bot.edit_message_text(
            confirm_text,
            chat_id=chat_id,
            message_id=status_msg.message_id,
            parse_mode="HTML",
        )

    except Exception as e:
        logger.exception(f"Erro inesperado ao processar mensagem: {e}")
        bot.edit_message_text(
            f"❌ <b>Erro ao processar:</b> {html.escape(str(e))}",
            chat_id=chat_id,
            message_id=status_msg.message_id,
            parse_mode="HTML",
        )


def main():
    """Ponto de entrada do script."""
    logger.info("=========================================")
    logger.info("   Shopee Telegram Affiliate Bot")
    logger.info("=========================================")

    # Inicia o servidor Flask em segundo plano para manter o processo ativo
    flask_thread = threading.Thread(target=run_flask, daemon=True)
    flask_thread.start()

    if not TELEGRAM_TOKEN:
        logger.error("ERRO: TELEGRAM_TOKEN não configurado! Preencha o arquivo .env para iniciar.")
        # Mantém a thread do Flask viva para responder health checks
        flask_thread.join()
        return

    logger.info("Iniciando polling do Telegram bot...")
    try:
        bot.infinity_polling(timeout=30, long_polling_timeout=20)
    except Exception as e:
        logger.error(f"Erro fatal no polling do bot: {e}")


if __name__ == "__main__":
    main()
