import React, { useState, useEffect } from "react";
import {
  Send,
  ExternalLink,
  Copy,
  Check,
  Code2,
  Terminal,
  ShieldCheck,
  Radio,
  Sparkles,
  ShoppingBag,
  Share2,
  HelpCircle,
  FileCode,
  Download,
  AlertTriangle,
  Play,
  Layers,
  Server,
  RefreshCw,
} from "lucide-react";
import { CODE_SNIPPETS } from "./data/codeSnippets.ts";

interface ProductPreset {
  id: string;
  name: string;
  url: string;
  rawText: string;
  productName: string;
  priceMin: number;
  priceMax: number;
  priceDiscountRate: number;
  imageUrl: string;
  shopId: number;
  itemId: number;
}

const PRESETS: ProductPreset[] = [
  {
    id: "fone-bluetooth",
    name: "🎧 Fone Bluetooth TWS (Com Desconto)",
    url: "https://shopee.com.br/product-i.298716543.1982736451",
    rawText: "Olha que fone incrível que achei na Shopee!\nFone de Ouvido Bluetooth Sem Fio TWS com Cancelamento de Ruído\nhttps://shopee.com.br/product-i.298716543.1982736451",
    productName: "Fone de Ouvido Bluetooth Sem Fio TWS 5.3 com Case de Carregamento",
    priceMin: 49.9,
    priceMax: 49.9,
    priceDiscountRate: 40,
    imageUrl: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80",
    shopId: 298716543,
    itemId: 1982736451,
  },
  {
    id: "teclado-rgb",
    name: "⌨️ Teclado Mecânico RGB (Faixa de Preço)",
    url: "https://s.shopee.com.br/7UwtYpB29",
    rawText: "https://s.shopee.com.br/7UwtYpB29",
    productName: "Teclado Mecânico Gamer RGB Switch Red / Blue / Brown ABNT2",
    priceMin: 129.9,
    priceMax: 179.9,
    priceDiscountRate: 0,
    imageUrl: "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=800&auto=format&fit=crop&q=80",
    shopId: 54129871,
    itemId: 88129374,
  },
  {
    id: "smartwatch",
    name: "⌚ Smartwatch Ultra (Super Oferta)",
    url: "https://shp.ee/mk89q2a",
    rawText: "🔥 CORRE! Olha o preço desse relógio:\nhttps://shp.ee/mk89q2a\nAproveitem antes que acabe!",
    productName: "Smartwatch Ultra Série 9 Tela AMOLED 2.02\" Faz Chamadas e Monitora Saúde",
    priceMin: 89.9,
    priceMax: 89.9,
    priceDiscountRate: 55,
    imageUrl: "https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=800&auto=format&fit=crop&q=80",
    shopId: 78912345,
    itemId: 65432198,
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<"tester" | "simulator" | "signature" | "code" | "deploy">("tester");

  // Link Tester State
  const [inputText, setInputText] = useState(PRESETS[0].rawText);
  const [channelUsername, setChannelUsername] = useState("@canal_promocoes_vip");
  const [appId, setAppId] = useState("10827364");
  const [appSecret, setAppSecret] = useState("9a8b7c6d5e4f3a2b1c0d");
  const [simulateFallback, setSimulateFallback] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Computed / Extracted Data
  const [extractedUrl, setExtractedUrl] = useState("");
  const [canonicalUrl, setCanonicalUrl] = useState("");
  const [isShopeeDomain, setIsShopeeDomain] = useState(true);
  const [shopId, setShopId] = useState<number | null>(PRESETS[0].shopId);
  const [itemId, setItemId] = useState<number | null>(PRESETS[0].itemId);
  const [productData, setProductData] = useState({
    productName: PRESETS[0].productName,
    priceMin: PRESETS[0].priceMin,
    priceMax: PRESETS[0].priceMax,
    priceDiscountRate: PRESETS[0].priceDiscountRate,
    imageUrl: PRESETS[0].imageUrl,
  });

  // Simulator Chat State
  const [chatMessages, setChatMessages] = useState<
    Array<{ id: string; sender: "user" | "bot"; text: string; time: string; status?: string }>
  >([
    {
      id: "1",
      sender: "bot",
      text: "👋 <b>Olá! Eu sou o Bot Poster de Ofertas da Shopee.</b>\n\nBasta me enviar qualquer mensagem contendo um link de produto da Shopee!\n\n💡 <i>Tudo é automático: extração de dados, foto, preço e geração do link de afiliado!</i>",
      time: "10:00",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isBotProcessing, setIsBotProcessing] = useState(false);
  const [channelPosts, setChannelPosts] = useState<
    Array<{
      id: string;
      caption: string;
      imageUrl: string;
      affiliateUrl: string;
      time: string;
      productName: string;
    }>
  >([]);

  // Signature Playground State
  const [sigTimestamp, setSigTimestamp] = useState(String(Math.floor(Date.now() / 1000)));
  const [sigPayload, setSigPayload] = useState(
    JSON.stringify({
      query: `query { productOfferV2(itemId: ${PRESETS[0].itemId}, shopId: ${PRESETS[0].shopId}) { itemId productName priceMin priceMax imageUrl } }`,
    })
  );

  // Selected Code File Tab
  const [selectedFile, setSelectedFile] = useState<keyof typeof CODE_SNIPPETS>("botPy");

  // Process text whenever inputText changes
  useEffect(() => {
    parseInputText(inputText);
  }, [inputText]);

  const parseInputText = (text: string) => {
    // 1. Extração de URL
    const urlPattern = /https?:\/\/(?:[a-zA-Z0-9\-._~:/?#\[\]@!$&'()*+,;=]|%[0-9a-fA-F]{2})+/g;
    const matches = text.match(urlPattern);
    const firstUrl = matches ? matches[0].replace(/[.,;:!?)\]]+$/, "") : "";

    setExtractedUrl(firstUrl);

    if (!firstUrl) {
      setIsShopeeDomain(false);
      setCanonicalUrl("");
      return;
    }

    try {
      const parsed = new URL(firstUrl);
      const host = parsed.hostname.toLowerCase();
      const valid = ["shopee.com.br", "shp.ee", "s.shopee.com.br", "br.shopee.com"].some(
        (d) => host === d || host.endsWith(`.${d}`)
      );
      setIsShopeeDomain(valid);

      // Extract shop_id & item_id
      const matchI = firstUrl.match(/-i\.(\d+)\.(\d+)/);
      if (matchI) {
        setShopId(parseInt(matchI[1], 10));
        setItemId(parseInt(matchI[2], 10));
        setCanonicalUrl(firstUrl);
      } else {
        const matchProd = firstUrl.match(/\/product\/(\d+)\/(\d+)/);
        if (matchProd) {
          setShopId(parseInt(matchProd[1], 10));
          setItemId(parseInt(matchProd[2], 10));
          setCanonicalUrl(firstUrl);
        } else {
          // Links como s.shopee.com.br ou shp.ee
          setCanonicalUrl(firstUrl);
        }
      }
    } catch {
      setIsShopeeDomain(false);
    }
  };

  const handleResolveLink = async () => {
    if (!extractedUrl) return;
    setIsResolving(true);
    try {
      const res = await fetch("/api/resolve-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: extractedUrl }),
      });
      if (res.ok) {
        const data = await res.json();
        setCanonicalUrl(data.canonicalUrl);
        if (data.shopId && data.itemId) {
          setShopId(data.shopId);
          setItemId(data.itemId);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsResolving(false);
    }
  };

  const loadPreset = (preset: ProductPreset) => {
    setInputText(preset.rawText);
    setProductData({
      productName: preset.productName,
      priceMin: preset.priceMin,
      priceMax: preset.priceMax,
      priceDiscountRate: preset.priceDiscountRate,
      imageUrl: preset.imageUrl,
    });
    setShopId(preset.shopId);
    setItemId(preset.itemId);
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Format currency in BRL (R$ 12,34)
  const formatBRL = (val: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  };

  // Generate Affiliate Short Link (simulated or real)
  const affiliateShortLink = simulateFallback
    ? extractedUrl || "https://shopee.com.br"
    : `https://shope.ee/aff-${itemId || "982736"}?utm_source=telegram_bot&utm_campaign=canal`;

  // Build Telegram Caption HTML
  const buildCaption = () => {
    const lines = ["🚨 <b>OFERTA IMPERDÍVEL</b> 🚨\n"];
    lines.push(`📦 <b>${productData.productName}</b>\n`);

    const pMin = productData.priceMin;
    const pMax = productData.priceMax;
    const disc = productData.priceDiscountRate;

    if (pMin > 0 && pMax > 0 && Math.abs(pMin - pMax) > 0.01) {
      lines.push(`💥 Por: <b>${formatBRL(pMin)}</b> até <b>${formatBRL(pMax)}</b>`);
    } else if (pMin > 0) {
      if (disc > 0 && disc < 100) {
        const origPrice = pMin / (1 - disc / 100);
        lines.push(`🔥 De: <s>${formatBRL(origPrice)}</s>`);
        lines.push(`💥 Por apenas: <b>${formatBRL(pMin)}</b> <i>(-${Math.round(disc)}% OFF)</i>`);
      } else {
        lines.push(`💥 Por apenas: <b>${formatBRL(pMin)}</b>`);
      }
    }

    if (channelUsername) {
      const u = channelUsername.startsWith("@") ? channelUsername : `@${channelUsername}`;
      lines.push(`\n👉 Siga o canal para mais ofertas: ${u}`);
    }

    return lines.join("\n");
  };

  const shareText = `🔥 Olha essa oferta que encontrei no ${channelUsername}: ${productData.productName.slice(0, 50)}!\n\nAproveite:`;
  const shareTelegramUrl = `https://t.me/share/url?url=${encodeURIComponent(affiliateShortLink)}&text=${encodeURIComponent(shareText)}`;

  // Handle Simulator Send
  const handleSendSimulator = (textToSend?: string) => {
    const msg = textToSend || chatInput;
    if (!msg.trim()) return;

    const userMsgId = Date.now().toString();
    const timeStr = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    setChatMessages((prev) => [
      ...prev,
      { id: userMsgId, sender: "user", text: msg, time: timeStr },
    ]);
    setChatInput("");
    setIsBotProcessing(true);

    setTimeout(() => {
      // Analyze text
      const urlPattern = /https?:\/\/(?:[a-zA-Z0-9\-._~:/?#\[\]@!$&'()*+,;=]|%[0-9a-fA-F]{2})+/g;
      const matches = msg.match(urlPattern);

      if (msg.startsWith("/start") || msg.startsWith("/help")) {
        setChatMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: "bot",
            text: "👋 <b>Olá! Eu sou o Bot Poster de Ofertas da Shopee.</b>\n\nBasta me enviar qualquer link de produto da Shopee (ou compartilhar direto do app)!\n\nComandos:\n/start - Instruções\n/status - Status das credenciais e canal",
            time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
        setIsBotProcessing(false);
        return;
      }

      if (msg.startsWith("/status")) {
        setChatMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: "bot",
            text: `⚙️ <b>Status do Sistema:</b>\n\n• <b>Canal Alvo:</b> ${channelUsername || "@meu_canal"}\n• <b>Credenciais Shopee:</b> ✅ Configurado (AppId: ${appId})\n• <b>Servidor HTTP (Keep-Alive):</b> Ativo na porta 8080`,
            time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
        setIsBotProcessing(false);
        return;
      }

      if (!matches) {
        setChatMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: "bot",
            text: "ℹ️ <b>Nenhum link detectado!</b>\nPor favor, envie uma mensagem contendo um link de produto da Shopee.",
            time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
        setIsBotProcessing(false);
        return;
      }

      const foundUrl = matches[0];
      const isShopee = ["shopee.com.br", "shp.ee", "s.shopee.com.br"].some((d) => foundUrl.includes(d));

      if (!isShopee) {
        setChatMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: "bot",
            text: "⚠️ <b>Link não reconhecido como Shopee!</b>\nO link deve pertencer aos domínios <code>shopee.com.br</code> ou <code>shp.ee</code>.",
            time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
        setIsBotProcessing(false);
        return;
      }

      // Successful process simulation
      const caption = buildCaption();
      const generatedLink = simulateFallback ? foundUrl : `https://shope.ee/aff-${Math.floor(Math.random() * 900000 + 100000)}`;

      if (simulateFallback) {
        setChatMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: "bot",
            text: "⚠️ <b>Aviso de Resiliência:</b>\nHouve uma falha ao obter todos os dados da API da Shopee (Simulação de fallback ativada).\n\n👉 <i>A oferta será postada no canal utilizando o link original!</i>",
            time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      }

      setTimeout(() => {
        setChatMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 2).toString(),
            sender: "bot",
            text: `✅ <b>Oferta postada no canal com sucesso!</b>\n\n🔗 <b>Link gerado:</b> <code>${generatedLink}</code>\n📢 <b>Canal:</b> <code>${channelUsername}</code>`,
            time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          },
        ]);

        // Add to channel feed
        setChannelPosts((prev) => [
          {
            id: Date.now().toString(),
            caption,
            imageUrl: productData.imageUrl,
            affiliateUrl: generatedLink,
            productName: productData.productName,
            time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          },
          ...prev,
        ]);

        setIsBotProcessing(false);
      }, 700);
    }, 600);
  };

  // Signature calculation
  const calculateSampleSignature = () => {
    try {
      const baseStr = `${appId}${sigTimestamp}${sigPayload}${appSecret}`;
      // In browser preview, show explanation or calculate via sha256
      return {
        baseStrPreview: `${appId}${sigTimestamp}[PAYLOAD_JSON]${appSecret}`,
        header: `SHA256 Credential=${appId}, Signature=..., Timestamp=${sigTimestamp}`,
      };
    } catch {
      return { baseStrPreview: "", header: "" };
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-orange-500 selection:text-white">
      {/* Header Bar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50 px-4 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-600 via-amber-500 to-orange-400 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <ShoppingBag className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base lg:text-lg text-white tracking-tight">
                Shopee Telegram Affiliate Bot
              </h1>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Python 3.10 + Flask
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Poster automático de ofertas com conversão para link de afiliado GraphQL
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-lg border border-slate-700/60 overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab("tester")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "tester"
                ? "bg-orange-500 text-white shadow-sm"
                : "text-slate-300 hover:text-white hover:bg-slate-700/50"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Testador & Preview Canal
          </button>
          <button
            onClick={() => setActiveTab("simulator")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "simulator"
                ? "bg-orange-500 text-white shadow-sm"
                : "text-slate-300 hover:text-white hover:bg-slate-700/50"
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            Simulador do Bot
          </button>
          <button
            onClick={() => setActiveTab("signature")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "signature"
                ? "bg-orange-500 text-white shadow-sm"
                : "text-slate-300 hover:text-white hover:bg-slate-700/50"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            API & Assinatura SHA256
          </button>
          <button
            onClick={() => setActiveTab("code")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "code"
                ? "bg-orange-500 text-white shadow-sm"
                : "text-slate-300 hover:text-white hover:bg-slate-700/50"
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            Arquivos Python (.py)
          </button>
          <button
            onClick={() => setActiveTab("deploy")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "deploy"
                ? "bg-orange-500 text-white shadow-sm"
                : "text-slate-300 hover:text-white hover:bg-slate-700/50"
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            Deploy no Render
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 space-y-6">
        {/* TAB 1: TESTER & CANAL PREVIEW */}
        {activeTab === "tester" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Link Inputs & Presets */}
            <div className="lg:col-span-6 space-y-5">
              {/* Presets */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-orange-400" /> Exemplos Prontos de Teste
                  </span>
                  <span className="text-[11px] text-slate-500">Clique para carregar</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => loadPreset(p)}
                      className={`text-left text-xs p-2.5 rounded-lg border transition ${
                        productData.productName === p.productName
                          ? "bg-orange-500/10 border-orange-500/40 text-orange-200"
                          : "bg-slate-800/60 border-slate-700/50 text-slate-300 hover:bg-slate-800 hover:border-slate-600"
                      }`}
                    >
                      <div className="font-medium truncate">{p.name}</div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        {p.priceDiscountRate > 0 ? `-${p.priceDiscountRate}% OFF` : "Sem desconto"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Input Box: Paste link or raw text */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>Mensagem de Entrada (com Link da Shopee)</span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      Pode ser texto compartilhado do app com links
                    </span>
                  </label>
                  <textarea
                    rows={3}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Cole aqui qualquer texto com um link da Shopee (ex: https://shp.ee/..., https://shopee.com.br/...)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                  />
                </div>

                {/* Extracted Details Pill */}
                <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">1. URL Extraída:</span>
                    <span className="font-mono text-slate-200 truncate max-w-[260px]">
                      {extractedUrl || "Nenhuma URL detectada"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">2. Domínio Shopee:</span>
                    {isShopeeDomain ? (
                      <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Válido (shopee.com.br / shp.ee)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        Não é um domínio Shopee
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">3. IDs Extraídos:</span>
                    <span className="font-mono text-amber-400">
                      Shop: {shopId ?? "n/a"} | Item: {itemId ?? "n/a"}
                    </span>
                  </div>

                  {extractedUrl && (extractedUrl.includes("shp.ee") || extractedUrl.includes("s.shopee.com.br")) && (
                    <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
                      <span className="text-slate-400 text-[11px]">Link Encurtador detectado</span>
                      <button
                        onClick={handleResolveLink}
                        disabled={isResolving}
                        className="px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 flex items-center gap-1 transition"
                      >
                        <RefreshCw className={`w-3 h-3 ${isResolving ? "animate-spin" : ""}`} />
                        {isResolving ? "Resolvendo..." : "Resolver Redirecionamento"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Product Metadata Tuning */}
                <div className="pt-3 border-t border-slate-800 space-y-3">
                  <div className="text-xs font-semibold text-slate-300">
                    Dados do Produto (Retornados via GraphQL productOfferV2)
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Título do Produto</label>
                    <input
                      type="text"
                      value={productData.productName}
                      onChange={(e) => setProductData({ ...productData, productName: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Preço Mín (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={productData.priceMin}
                        onChange={(e) =>
                          setProductData({ ...productData, priceMin: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Preço Máx (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={productData.priceMax}
                        onChange={(e) =>
                          setProductData({ ...productData, priceMax: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Desconto (%)</label>
                      <input
                        type="number"
                        value={productData.priceDiscountRate}
                        onChange={(e) =>
                          setProductData({ ...productData, priceDiscountRate: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Canal do Telegram (@username)</label>
                    <input
                      type="text"
                      value={channelUsername}
                      onChange={(e) => setChannelUsername(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  {/* Resilient fallback toggle */}
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="fallbackCheck"
                        checked={simulateFallback}
                        onChange={(e) => setSimulateFallback(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-950 text-orange-500 focus:ring-orange-500"
                      />
                      <label htmlFor="fallbackCheck" className="text-xs text-slate-300 cursor-pointer">
                        Simular falha na API da Shopee (Fallback)
                      </label>
                    </div>
                    {simulateFallback && (
                      <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        Postará link original sem travar
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Telegram Channel Post Preview (Pixel-perfect mockup) */}
            <div className="lg:col-span-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-sky-400" /> Preview Real do Post no Telegram (Canal)
                </span>
                <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  parse_mode="HTML"
                </span>
              </div>

              {/* Telegram Channel Mockup Container */}
              <div className="bg-[#182533] border border-[#243447] rounded-2xl overflow-hidden shadow-2xl max-w-md mx-auto w-full">
                {/* Channel Header */}
                <div className="bg-[#17212b] border-b border-[#243447] px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center font-bold text-white text-xs shadow-md">
                      🛍️
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white flex items-center gap-1">
                        {channelUsername || "@canal_ofertas"}
                        <svg className="w-3.5 h-3.5 text-sky-400" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                        </svg>
                      </div>
                      <div className="text-[10px] text-slate-400">14.820 inscritos</div>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-400">Hoje</div>
                </div>

                {/* Message Body */}
                <div className="p-4 space-y-3">
                  {/* Product Photo */}
                  <div className="rounded-xl overflow-hidden bg-slate-900 border border-slate-700/40 relative aspect-video group">
                    <img
                      src={productData.imageUrl}
                      alt={productData.productName}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80";
                      }}
                    />
                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] text-white font-mono">
                      Shopee Oficial
                    </div>
                  </div>

                  {/* HTML Caption rendered */}
                  <div className="bg-[#202b36] p-3.5 rounded-xl text-slate-100 text-xs leading-relaxed space-y-2 border border-slate-700/30">
                    <div className="font-bold text-amber-300 flex items-center gap-1.5">
                      <span>🚨</span>
                      <span>OFERTA IMPERDÍVEL</span>
                      <span>🚨</span>
                    </div>

                    <div className="font-semibold text-white">{productData.productName}</div>

                    {/* Price with strikethrough logic */}
                    {productData.priceMin > 0 &&
                    productData.priceMax > 0 &&
                    Math.abs(productData.priceMin - productData.priceMax) > 0.01 ? (
                      <div className="text-emerald-400 font-bold text-sm">
                        💥 Por: {formatBRL(productData.priceMin)} até {formatBRL(productData.priceMax)}
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        {productData.priceDiscountRate > 0 && (
                          <div className="text-slate-400 line-through text-[11px]">
                            De: {formatBRL(productData.priceMin / (1 - productData.priceDiscountRate / 100))}
                          </div>
                        )}
                        <div className="text-emerald-400 font-bold text-sm flex items-center gap-1.5">
                          <span>Por apenas: {formatBRL(productData.priceMin)}</span>
                          {productData.priceDiscountRate > 0 && (
                            <span className="text-[10px] font-semibold bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded border border-rose-500/30">
                              -{Math.round(productData.priceDiscountRate)}% OFF
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {channelUsername && (
                      <div className="text-[11px] text-sky-400 pt-1 border-t border-slate-700/50">
                        👉 Siga o canal para mais ofertas: {channelUsername}
                      </div>
                    )}

                    <div className="text-right text-[10px] text-slate-400 pt-1 flex items-center justify-end gap-1">
                      <span>12:45</span>
                      <span>✓✓</span>
                    </div>
                  </div>

                  {/* Inline Buttons (Keyboard Markup) */}
                  <div className="space-y-1.5 pt-1">
                    <div className="grid grid-cols-2 gap-1.5">
                      <a
                        href={affiliateShortLink}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-[#2b5278] hover:bg-[#34608c] text-white text-xs font-semibold py-2 px-3 rounded-lg text-center transition flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        🛒 COMPRAR
                      </a>

                      <a
                        href={shareTelegramUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-[#2b5278] hover:bg-[#34608c] text-white text-xs font-semibold py-2 px-3 rounded-lg text-center transition flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        📢 COMPARTILHAR
                      </a>
                    </div>

                    <div className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-1">
                      <span>🔗 Destino do botão Comprar:</span>
                      <code className="text-amber-300 font-mono text-[10px] truncate max-w-[200px]">
                        {affiliateShortLink}
                      </code>
                    </div>
                  </div>
                </div>
              </div>

              {/* Raw HTML Code Output */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono text-slate-400">Código HTML da Legenda (Telegram):</span>
                  <button
                    onClick={() => copyToClipboard(buildCaption(), "html_caption")}
                    className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    {copiedKey === "html_caption" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedKey === "html_caption" ? "Copiado!" : "Copiar"}
                  </button>
                </div>
                <pre className="text-[11px] font-mono bg-slate-950 p-2.5 rounded-lg text-slate-300 overflow-x-auto whitespace-pre-wrap">
                  {buildCaption()}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: BOT SIMULATOR */}
        {activeTab === "simulator" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Private Bot Chat Mockup */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-[#17212b] border border-[#243447] rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[580px]">
                {/* Chat Header */}
                <div className="bg-[#202b36] px-4 py-3 border-b border-[#243447] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center font-bold text-white shadow">
                      🤖
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">Shopee Deals Poster Bot</div>
                      <div className="text-[11px] text-emerald-400">bot • online</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSendSimulator("/start")}
                      className="px-2 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
                    >
                      /start
                    </button>
                    <button
                      onClick={() => handleSendSimulator("/status")}
                      className="px-2 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
                    >
                      /status
                    </button>
                  </div>
                </div>

                {/* Messages List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0e1621]">
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                          msg.sender === "user"
                            ? "bg-[#2b5278] text-white rounded-tr-none"
                            : "bg-[#182533] text-slate-100 rounded-tl-none border border-slate-700/40"
                        }`}
                      >
                        <div
                          dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g, "<br/>") }}
                        />
                        <div className="text-[10px] text-slate-400 text-right mt-1">{msg.time}</div>
                      </div>
                    </div>
                  ))}

                  {isBotProcessing && (
                    <div className="flex justify-start">
                      <div className="bg-[#182533] text-slate-400 rounded-2xl rounded-tl-none p-3 text-xs border border-slate-700/40 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-orange-400 animate-ping"></span>
                        Bot está digitando e processando link...
                      </div>
                    </div>
                  )}
                </div>

                {/* Input Bar */}
                <div className="p-3 bg-[#17212b] border-t border-[#243447] flex items-center gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendSimulator()}
                    placeholder="Cole um link da Shopee ou envie /start..."
                    className="flex-1 bg-[#242f3d] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-orange-500"
                  />
                  <button
                    onClick={() => handleSendSimulator()}
                    disabled={isBotProcessing}
                    className="p-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition shadow disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Live Channel Feed */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col h-[580px]">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                    <span className="text-xs font-semibold text-white">
                      Feed do Canal: {channelUsername || "@meu_canal"}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {channelPosts.length} posts realizados
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {channelPosts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                      <ShoppingBag className="w-10 h-10 mb-2 opacity-30" />
                      <p className="text-xs">Nenhum post publicado ainda.</p>
                      <p className="text-[11px] text-slate-600 mt-1">
                        Envie um link no chat do bot ao lado para vê-lo aparecer aqui no canal!
                      </p>
                      <button
                        onClick={() => handleSendSimulator(PRESETS[0].rawText)}
                        className="mt-3 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-orange-400 rounded-lg border border-slate-700 transition"
                      >
                        Enviar link de teste agora
                      </button>
                    </div>
                  ) : (
                    channelPosts.map((post) => (
                      <div
                        key={post.id}
                        className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <img
                            src={post.imageUrl}
                            alt=""
                            className="w-12 h-12 rounded-lg object-cover bg-slate-800 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-white truncate">{post.productName}</div>
                            <div className="text-[10px] text-emerald-400 mt-0.5">Postado às {post.time}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1 border-t border-slate-900">
                          <a
                            href={post.affiliateUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 py-1 text-center bg-orange-500/10 hover:bg-orange-500/20 text-orange-300 rounded text-[11px] font-medium border border-orange-500/20"
                          >
                            🛒 Testar Link Comprar
                          </a>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SIGNATURE & GRAPHQL API */}
        {activeTab === "signature" && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    Especificação de Autenticação da Shopee Open API
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Endpoint: <code className="text-orange-400">https://open-api.affiliate.shopee.com.br/graphql</code>
                  </p>
                </div>
                <div className="px-3 py-1 bg-slate-800 rounded-lg text-xs font-mono text-slate-300 border border-slate-700">
                  Algoritmo: SHA-256 Hex
                </div>
              </div>

              {/* Mathematical formula breakdown */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="text-xs font-semibold text-slate-300">Fórmula da Assinatura:</div>
                <code className="block p-3 bg-slate-900 rounded-lg text-xs font-mono text-amber-300 border border-slate-800">
                  Signature = sha256(AppId + Timestamp + Payload + Secret)
                </code>
                <div className="text-xs font-semibold text-slate-300 mt-3">Formato do Cabeçalho HTTP:</div>
                <code className="block p-3 bg-slate-900 rounded-lg text-xs font-mono text-emerald-300 border border-slate-800">
                  Authorization: SHA256 Credential=&lt;AppId&gt;, Signature=&lt;sig&gt;, Timestamp=&lt;ts&gt;
                </code>
              </div>

              {/* Interactive signature generator test */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">SHOPEE_APP_ID</label>
                  <input
                    type="text"
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs font-mono text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">SHOPEE_APP_SECRET</label>
                  <input
                    type="text"
                    value={appSecret}
                    onChange={(e) => setAppSecret(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs font-mono text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">Payload Compacto (JSON)</label>
                  <span className="text-[11px] text-slate-500">Separators=(',', ':') sem espaços extras</span>
                </div>
                <textarea
                  rows={4}
                  value={sigPayload}
                  onChange={(e) => setSigPayload(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-300 focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* Generated Headers preview */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-400">Cabeçalho Authorization Calculado:</span>
                  <button
                    onClick={() =>
                      copyToClipboard(calculateSampleSignature().header, "auth_header")
                    }
                    className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    {copiedKey === "auth_header" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    Copiar
                  </button>
                </div>
                <pre className="text-xs font-mono text-emerald-400 bg-slate-900 p-2.5 rounded-lg overflow-x-auto">
                  {calculateSampleSignature().header}
                </pre>
              </div>
            </div>

            {/* GraphQL Queries Explorer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <Code2 className="w-4 h-4 text-orange-400" /> 1. Query: productOfferV2
                  </h3>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `query { productOfferV2(itemId: 12345, shopId: 67890) { itemId productName priceMin priceMax priceDiscountRate imageUrl offerLink status } }`,
                        "gql_query"
                      )
                    }
                    className="text-[11px] text-slate-400 hover:text-white"
                  >
                    Copiar
                  </button>
                </div>
                <pre className="bg-slate-950 p-3 rounded-lg text-[11px] font-mono text-slate-300 overflow-x-auto">
{`query {
  productOfferV2(itemId: $itemId, shopId: $shopId) {
    itemId
    shopId
    productName
    priceMin
    priceMax
    priceDiscountRate
    imageUrl
    offerLink
    status
  }
}`}
                </pre>
                <p className="text-[11px] text-slate-400">
                  Retorna dados completos do anúncio: nome, imagens oficiais, preços e porcentagem de desconto.
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <Code2 className="w-4 h-4 text-sky-400" /> 2. Mutation: generateShortLink
                  </h3>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `mutation { generateShortLink(input: { originUrl: "https://shopee.com.br/product-i.1.2" }) { shortLink } }`,
                        "gql_mutation"
                      )
                    }
                    className="text-[11px] text-slate-400 hover:text-white"
                  >
                    Copiar
                  </button>
                </div>
                <pre className="bg-slate-950 p-3 rounded-lg text-[11px] font-mono text-slate-300 overflow-x-auto">
{`mutation {
  generateShortLink(input: {
    originUrl: "https://shopee.com.br/item-i.123.456"
  }) {
    shortLink
  }
}`}
                </pre>
                <p className="text-[11px] text-slate-400">
                  Converte o link original num shortLink rastreado com seu ID de afiliado da Shopee.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SOURCE CODE EXPLORER */}
        {activeTab === "code" && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {/* File Selector Tabs */}
            <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <button
                  onClick={() => setSelectedFile("botPy")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition flex items-center gap-1.5 ${
                    selectedFile === "botPy"
                      ? "bg-orange-500 text-white shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  bot.py
                </button>
                <button
                  onClick={() => setSelectedFile("shopeeAffiliatePy")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition flex items-center gap-1.5 ${
                    selectedFile === "shopeeAffiliatePy"
                      ? "bg-orange-500 text-white shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  shopee_affiliate.py
                </button>
                <button
                  onClick={() => setSelectedFile("requirementsTxt")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition flex items-center gap-1.5 ${
                    selectedFile === "requirementsTxt"
                      ? "bg-orange-500 text-white shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  requirements.txt
                </button>
                <button
                  onClick={() => setSelectedFile("envExample")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition flex items-center gap-1.5 ${
                    selectedFile === "envExample"
                      ? "bg-orange-500 text-white shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  .env
                </button>
                <button
                  onClick={() => setSelectedFile("procfile")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition flex items-center gap-1.5 ${
                    selectedFile === "procfile"
                      ? "bg-orange-500 text-white shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  Procfile
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const filenameMap: Record<string, string> = {
                      botPy: "bot.py",
                      shopeeAffiliatePy: "shopee_affiliate.py",
                      requirementsTxt: "requirements.txt",
                      envExample: ".env",
                      procfile: "Procfile",
                    };
                    downloadFile(filenameMap[selectedFile] || "file.txt", CODE_SNIPPETS[selectedFile]);
                  }}
                  className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 flex items-center gap-1.5 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  Baixar Arquivo
                </button>
                <button
                  onClick={() => copyToClipboard(CODE_SNIPPETS[selectedFile], selectedFile)}
                  className="px-3 py-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white rounded-lg flex items-center gap-1.5 transition shadow"
                >
                  {copiedKey === selectedFile ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey === selectedFile ? "Copiado!" : "Copiar Código"}
                </button>
              </div>
            </div>

            {/* Code Display */}
            <div className="p-4 bg-slate-950 overflow-x-auto max-h-[600px]">
              <pre className="text-xs font-mono text-slate-200 leading-relaxed">
                {CODE_SNIPPETS[selectedFile]}
              </pre>
            </div>
          </div>
        )}

        {/* TAB 5: DEPLOY GUIDE */}
        {activeTab === "deploy" && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Server className="w-5 h-5 text-orange-400" />
                  Como Rodar e Publicar na Nuvem (Render / Railway / VPS)
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  O bot possui um servidor Flask embutido que responde a requisições HTTP na porta configurada,
                  garantindo que o Render mantenha o serviço ativo 24/7 sem suspender por inatividade.
                </p>
              </div>

              {/* Step by step cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-400 font-bold flex items-center justify-center text-xs">
                    1
                  </div>
                  <h3 className="text-sm font-semibold text-white">Criar Bot no Telegram</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Abra o <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-sky-400 underline">@BotFather</a> no Telegram, envie <code>/newbot</code> e guarde o seu <code>TELEGRAM_TOKEN</code>.
                  </p>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-400 font-bold flex items-center justify-center text-xs">
                    2
                  </div>
                  <h3 className="text-sm font-semibold text-white">Adicionar Bot ao Canal</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Crie um canal no Telegram, adicione seu bot como <b>Administrador</b> com permissão de "Postar Mensagens". Configure <code>CANAL_ID</code> com o @nomedocanal ou ID numérico.
                  </p>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-400 font-bold flex items-center justify-center text-xs">
                    3
                  </div>
                  <h3 className="text-sm font-semibold text-white">Credenciais da Shopee</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Obtenha seu <b>App ID</b> e <b>App Secret</b> no painel <a href="https://affiliate.shopee.com.br/open_api" target="_blank" rel="noreferrer" className="text-sky-400 underline">Shopee Affiliate Open API</a>.
                  </p>
                </div>
              </div>

              {/* Render Instructions */}
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <ExternalLink className="w-4 h-4 text-emerald-400" />
                    Deploy Gratuito no Render.com (Web Service)
                  </h3>
                  <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Keep-Alive Automático via Flask
                  </span>
                </div>

                <div className="space-y-3 text-xs text-slate-300">
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded bg-slate-800 text-slate-300 flex items-center justify-center flex-shrink-0 text-[10px]">
                      A
                    </span>
                    <span>Acesse <b>Render.com</b> e clique em <b>New + &rarr; Web Service</b>.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded bg-slate-800 text-slate-300 flex items-center justify-center flex-shrink-0 text-[10px]">
                      B
                    </span>
                    <span>Conecte o seu repositório Git com os arquivos do projeto.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded bg-slate-800 text-slate-300 flex items-center justify-center flex-shrink-0 text-[10px]">
                      C
                    </span>
                    <span>
                      Configure os comandos de build e start:
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
                          <span className="text-[10px] text-slate-500 block uppercase">Build Command:</span>
                          <code className="text-amber-400 font-mono text-[11px]">pip install -r requirements.txt</code>
                        </div>
                        <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
                          <span className="text-[10px] text-slate-500 block uppercase">Start Command:</span>
                          <code className="text-emerald-400 font-mono text-[11px]">python bot.py</code>
                        </div>
                      </div>
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded bg-slate-800 text-slate-300 flex items-center justify-center flex-shrink-0 text-[10px]">
                      D
                    </span>
                    <span>
                      Em <b>Environment Variables</b>, adicione as chaves:
                      <code className="block mt-1 text-slate-400 font-mono">
                        TELEGRAM_TOKEN, CANAL_ID, SHOPEE_APP_ID, SHOPEE_APP_SECRET
                      </code>
                    </span>
                  </div>
                </div>
              </div>

              {/* Local run instructions */}
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-sky-400" />
                  Como Rodar Localmente no seu Computador
                </h3>
                <div className="bg-slate-900 p-3 rounded-lg text-xs font-mono text-slate-300 space-y-1 overflow-x-auto">
                  <div className="text-slate-500"># 1. Criar e ativar ambiente virtual</div>
                  <div>python3 -m venv venv</div>
                  <div>source venv/bin/activate  <span className="text-slate-500"># Windows: venv\Scripts\activate</span></div>
                  <div className="text-slate-500 pt-1"># 2. Instalar dependências</div>
                  <div>pip install -r requirements.txt</div>
                  <div className="text-slate-500 pt-1"># 3. Rodar bot</div>
                  <div className="text-emerald-400 font-bold">python bot.py</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
