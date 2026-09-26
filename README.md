# 🤖 Shopee Telegram Affiliate Bot

Bot do Telegram em Python para postagem automática de ofertas da Shopee em canais de transmissão, com conversão transparente de links em links de afiliado rastreados, extração automática de fotos e preços via API GraphQL da Shopee, e servidor web Flask embutido para manter o bot sempre ativo (ideal para Render, Railway, Fly.io ou VPS).

---

## 🚀 Funcionalidades

1. **Recepção Amigável**: Recebe qualquer mensagem com link da Shopee (mesmo com texto antes ou depois, como links compartilhados direto do aplicativo).
2. **Extração e Desencurtamento de Links**:
   - Detecta domínios oficiais (`shopee.com.br`, `shp.ee`, `s.shopee.com.br`).
   - Resolve automaticamente redirecionamentos de links curtos (`shp.ee` / `s.shopee.com.br`) até obter a URL canônica completa.
   - Extrai `shop_id` e `item_id` (padrão `-i.<shop_id>.<item_id>`).
3. **Consulta à API GraphQL de Afiliados da Shopee**:
   - Autenticação com cabeçalho `SHA256 Credential=<AppId>, Signature=<sig>, Timestamp=<ts>`.
   - Consulta `productOfferV2` para obter título, preço mínimo/máximo, percentual de desconto e imagem em alta resolução.
   - Mutation `generateShortLink` para gerar o link de afiliado rastreado pela sua conta.
4. **Legenda Rica em HTML (Telegram)**:
   - Título chamativo: `🚨 OFERTA IMPERDÍVEL 🚨`
   - Nome do produto
   - Preço riscado (`<s>R$ ...</s>`) com percentual de desconto ou faixa de preço para produtos com variações.
5. **Botões Inline Interativos**:
   - `🛒 COMPRAR`: Leva direto para o link de afiliado gerado.
   - `📢 COMPARTILHAR`: Abre `https://t.me/share/url` pré-formatado para os membros do canal divulgarem com 1 toque.
6. **Resiliência a Falhas**: Se a API da Shopee estiver instável ou o produto não estiver no catálogo aberto de afiliados, o bot **não trava**: ele posta no canal usando o link original e avisa o remetente no privado.
7. **Servidor HTTP Embutido (Flask)**:
   - Expõe rotas `/` e `/health` na porta definida (`PORT=8080`), permitindo que plataformas gratuitas como Render não suspendam o serviço por inatividade.

---

## 📁 Estrutura de Arquivos

```
├── bot.py                 # Lógica principal do bot do Telegram e servidor Flask
├── shopee_affiliate.py    # Cliente GraphQL da API da Shopee e resolução de URLs
├── requirements.txt       # Dependências Python
├── .env                   # Variáveis de ambiente (ignorado no Git)
├── .env.example           # Exemplo de configuração
├── Procfile               # Arquivo de execução para Render / Railway / Heroku
└── README.md              # Documentação completa
```

---

## 🛠️ Como Configurar

### 1. Criar o Bot no Telegram
1. Abra o Telegram e pesquise por [@BotFather](https://t.me/BotFather).
2. Envie o comando `/newbot` e siga as instruções para escolher nome e username.
3. Copie o **HTTP API Token** gerado. Esse será o seu `TELEGRAM_TOKEN`.

### 2. Configurar o Canal do Telegram
1. Crie um canal público ou privado no Telegram.
2. Adicione o seu bot recém-criado como **Administrador** do canal.
3. Certifique-se de dar a permissão de **Postar Mensagens** (Post Messages).
4. Se o canal for público (ex: `@meucanaldeofertas`), você pode usar `@meucanaldeofertas` como `CANAL_ID`.
5. Se for privado, encaminhe uma mensagem do canal para [@userinfobot](https://t.me/userinfobot) para obter o ID numérico (ex: `-1001234567890`).

### 3. Obter Credenciais da Shopee Afiliados
1. Acesse a plataforma [Shopee Affiliate Open API](https://affiliate.shopee.com.br/open_api).
2. Crie uma aplicação para obter o **App ID** e **App Secret**.
3. Preencha no seu `.env`:
   - `SHOPEE_APP_ID=...`
   - `SHOPEE_APP_SECRET=...`

### 4. Configurar o arquivo `.env`
Renomeie ou copie o `.env.example` para `.env`:
```env
TELEGRAM_TOKEN=seu_token_aqui
CANAL_ID=@seu_canal_de_ofertas
CANAL_USERNAME=@seu_canal_de_ofertas
SHOPEE_APP_ID=seu_app_id
SHOPEE_APP_SECRET=seu_app_secret
PORT=8080
```

---

## 💻 Como Rodar Localmente

```bash
# 1. Crie e ative um ambiente virtual
python3 -m venv venv
source venv/bin/activate  # No Windows: venv\Scripts\activate

# 2. Instale as dependências
pip install -r requirements.txt

# 3. Inicie o bot
python bot.py
```

Você verá a saída:
```
[INFO] Iniciando servidor HTTP Flask na porta 8080...
[INFO] Iniciando polling do Telegram bot...
```

---

## ☁️ Como Fazer Deploy no Render (Gratuito / Nuvem)

1. Crie uma conta no [Render.com](https://render.com).
2. Clique em **New +** -> **Web Service**.
3. Conecte seu repositório Git.
4. Preencha as configurações:
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python bot.py`
5. Na aba **Environment Variables**, adicione as mesmas variáveis do seu `.env`:
   - `TELEGRAM_TOKEN`
   - `CANAL_ID`
   - `SHOPEE_APP_ID`
   - `SHOPEE_APP_SECRET`
   - `PORT` = `10000` (ou deixe o Render atribuir automaticamente)
6. Clique em **Create Web Service**. O Render manterá a aplicação respondendo na porta HTTP e o bot receberá mensagens 24/7!
