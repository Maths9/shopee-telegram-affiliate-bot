import express from "express";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// API: Resolver link da Shopee (desencurtar e extrair IDs)
app.post("/api/resolve-link", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "URL inválida ou ausente" });
    }

    // Domínios válidos
    const validDomains = ["shopee.com.br", "shp.ee", "s.shopee.com.br", "br.shopee.com"];
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ error: "Formato de URL inválido" });
    }

    const host = parsedUrl.hostname.toLowerCase();
    const isValidShopee = validDomains.some(
      (d) => host === d || host.endsWith(`.${d}`)
    );

    if (!isValidShopee) {
      return res.status(400).json({
        error: "O link não pertence aos domínios suportados da Shopee (shopee.com.br, shp.ee)",
      });
    }

    let canonicalUrl = url;
    let redirected = false;

    // Se for encurtador shp.ee ou s.shopee.com.br, tenta resolver redirecionamento
    if (host === "shp.ee" || host === "s.shopee.com.br" || !url.includes("-i.")) {
      try {
        const response = await fetch(url, {
          method: "GET",
          redirect: "follow",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
        });
        canonicalUrl = response.url || url;
        redirected = canonicalUrl !== url;
      } catch (err: any) {
        console.warn("Falha ao resolver redirecionamento via fetch:", err.message);
      }
    }

    // Extração de shop_id e item_id
    let shopId: number | null = null;
    let itemId: number | null = null;

    // Padrão -i.<shop_id>.<item_id>
    const matchI = canonicalUrl.match(/-i\.(\d+)\.(\d+)/);
    if (matchI) {
      shopId = parseInt(matchI[1], 10);
      itemId = parseInt(matchI[2], 10);
    } else {
      // Padrão /product/<shop_id>/<item_id>
      const matchProd = canonicalUrl.match(/\/product\/(\d+)\/(\d+)/);
      if (matchProd) {
        shopId = parseInt(matchProd[1], 10);
        itemId = parseInt(matchProd[2], 10);
      } else {
        const matchSlug = canonicalUrl.match(/\.(\d+)\.(\d+)(?:\?|$|#)/);
        if (matchSlug) {
          shopId = parseInt(matchSlug[1], 10);
          itemId = parseInt(matchSlug[2], 10);
        }
      }
    }

    return res.json({
      originalUrl: url,
      canonicalUrl,
      redirected,
      shopId,
      itemId,
      detectedHost: host,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Erro interno ao processar link" });
  }
});

// API: Gerador e validador de assinatura GraphQL Shopee
app.post("/api/signature", (req, res) => {
  try {
    const { appId, appSecret, payload, timestamp } = req.body;
    if (!appId || !appSecret || !payload) {
      return res.status(400).json({ error: "appId, appSecret e payload são obrigatórios" });
    }

    const ts = timestamp ? String(timestamp) : String(Math.floor(Date.now() / 1000));
    // Compacta JSON se for objeto
    const payloadStr = typeof payload === "string" ? payload : JSON.stringify(payload);

    const baseString = `${appId}${ts}${payloadStr}${appSecret}`;
    const signature = crypto.createHash("sha256").update(baseString, "utf8").digest("hex");
    const authorizationHeader = `SHA256 Credential=${appId}, Signature=${signature}, Timestamp=${ts}`;

    return res.json({
      timestamp: ts,
      baseStringPreview: `${appId}${ts}[JSON_PAYLOAD]${appSecret}`,
      signature,
      authorizationHeader,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});


// API: Status das variáveis de ambiente e arquivos python
app.get("/api/status", (_req, res) => {
  const telegramConfigured = Boolean(process.env.TELEGRAM_TOKEN);
  const canalConfigured = Boolean(process.env.CANAL_ID);
  const shopeeConfigured = Boolean(process.env.SHOPEE_APP_ID && process.env.SHOPEE_APP_SECRET);

  res.json({
    telegramConfigured,
    canalConfigured,
    canalId: process.env.CANAL_ID || "@seu_canal_de_ofertas",
    shopeeConfigured,
    shopeeAppId: process.env.SHOPEE_APP_ID ? `${process.env.SHOPEE_APP_ID.slice(0, 3)}***` : "não definido",
    port: process.env.PORT || 8080,
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (_req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

startServer();
