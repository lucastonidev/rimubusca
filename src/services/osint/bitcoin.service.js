/**
 * ==============================================================================
 * RIMUBUSCA - INVESTIGAÇÃO DE CARTEIRAS BITCOIN (BTC OSINT & ON-CHAIN)
 * Integrado para execução de alta performance em ambientes serverless (Vercel):
 *  1. Blockchain API (Blockchain.info + Mempool.space fallback): dados on-chain,
 *     saldo atual, total recebido/enviado, cotação USD/BRL e últimas transações.
 *  2. SERP API / Google Search: busca exata na surface web (GitHub, Reddit,
 *     BitcoinTalk, denúncias de ransomware/abuso).
 *  3. Ahmia.fi (Clearnet Tor Proxy): busca por ocorrências em sites .onion da Dark Web.
 * ==============================================================================
 */

import { cacheService } from "../core/cache.service.js";

// Cache em memória para cotação BTC (evita chamadas redundantes)
let cotacaoBtcCache = {
  timestamp: 0,
  dados: { usd: 65000, brl: 370000 },
};

/**
 * Valida o formato e tipo de um endereço Bitcoin (P2PKH, P2SH, SegWit, Taproot).
 */
export function validarEnderecoBitcoin(address) {
  if (!address || typeof address !== "string") {
    return { valido: false, erro: "Endereço Bitcoin não informado." };
  }
  const clean = address.trim();

  // Legacy P2PKH (começa com 1)
  if (/^1[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(clean)) {
    return { valido: true, formato: "Legacy (P2PKH)", tipo: "P2PKH", address: clean };
  }

  // Script P2SH (começa com 3)
  if (/^3[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(clean)) {
    return { valido: true, formato: "Pay-to-Script-Hash (P2SH)", tipo: "P2SH", address: clean };
  }

  // Native SegWit / Bech32 (começa com bc1q)
  if (/^bc1q[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{38,59}$/i.test(clean)) {
    return { valido: true, formato: "Native SegWit (Bech32)", tipo: "Bech32", address: clean.toLowerCase() };
  }

  // Taproot / Bech32m (começa com bc1p)
  if (/^bc1p[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{58,62}$/i.test(clean)) {
    return { valido: true, formato: "Taproot (Bech32m)", tipo: "Taproot", address: clean.toLowerCase() };
  }

  // Fallback permissivo para variações válidas da rede Bitcoin
  if (/^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,65}$/i.test(clean)) {
    return { valido: true, formato: "Bitcoin Geral", tipo: "BTC", address: clean };
  }

  return {
    valido: false,
    erro: "Formato de endereço Bitcoin inválido. Deve iniciar com '1' (Legacy), '3' (P2SH) ou 'bc1' (SegWit/Taproot).",
  };
}

/**
 * Obtém cotação ao vivo do Bitcoin em USD e BRL com cache em memória de 10 minutos.
 */
export async function obterCotacaoBtc() {
  const agora = Date.now();
  if (cotacaoBtcCache.timestamp && agora - cotacaoBtcCache.timestamp < 10 * 60 * 1000) {
    return cotacaoBtcCache.dados;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch("https://blockchain.info/ticker", {
      headers: { "User-Agent": "RimuBusca-OSINT/1.0" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const usd = Number(data.USD?.last) || 65000;
      const brl = Number(data.BRL?.last) || usd * 5.6;
      cotacaoBtcCache = {
        timestamp: agora,
        dados: { usd, brl },
      };
      return cotacaoBtcCache.dados;
    }
  } catch {
    // Retorna cache existente ou fallback seguro
  }

  return cotacaoBtcCache.dados;
}

/**
 * Classifica um domínio da Surface Web em categorias de inteligência OSINT.
 */
function classificarDominio(url = "") {
  const u = String(url || "").toLowerCase();
  if (u.includes("github.com") || u.includes("gist.github.com")) return "GitHub / Código";
  if (u.includes("reddit.com")) return "Reddit / Fórum";
  if (u.includes("bitcointalk.org")) return "BitcoinTalk / Fórum";
  if (u.includes("twitter.com") || u.includes("x.com")) return "X / Twitter";
  if (u.includes("bitcoinabuse.com") || u.includes("cryptoscamdb.org") || u.includes("chainabuse.com")) {
    return "Denúncia / Blacklist";
  }
  if (
    u.includes("blockchain.com") ||
    u.includes("mempool.space") ||
    u.includes("blockstream.info") ||
    u.includes("blockchair.com") ||
    u.includes("btc.com")
  ) {
    return "Block Explorer";
  }
  if (u.includes("pastebin.com") || u.includes("ghostbin.") || u.includes("rentry.co")) {
    return "Paste / Dump de Texto";
  }
  return "Surface Web";
}

/**
 * 1. Blockchain API: Consulta dados on-chain da carteira.
 * Provedor primário: Blockchain.com /rawaddr
 * Fallback automático: Mempool.space /api/address
 */
export async function consultarOnChain(address) {
  const cotacao = await obterCotacaoBtc();

  // Tentativa primária: Blockchain.com
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(`https://blockchain.info/rawaddr/${encodeURIComponent(address)}?limit=15`, {
      headers: { "User-Agent": "RimuBusca-OSINT/1.0" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const satoshisSaldo = Number(data.final_balance || 0);
      const satoshisRecebido = Number(data.total_received || 0);
      const satoshisEnviado = Number(data.total_sent || 0);

      const saldoBtc = satoshisSaldo / 1e8;
      const totalRecebidoBtc = satoshisRecebido / 1e8;
      const totalEnviadoBtc = satoshisEnviado / 1e8;

      const txs = (Array.isArray(data.txs) ? data.txs : []).map((tx) => {
        const netSat = Number(tx.result || 0);
        const isIncoming = netSat >= 0;
        const satValue = Math.abs(netSat);
        return {
          hash: tx.hash,
          data: tx.time ? new Date(tx.time * 1000).toISOString() : null,
          timestamp: tx.time || null,
          tipo: isIncoming ? "RECEBIDO" : "ENVIADO",
          valorBtc: satValue / 1e8,
          valorSatoshis: satValue,
          taxaBtc: Number(tx.fee || 0) / 1e8,
          taxaSatoshis: Number(tx.fee || 0),
          confirmacoes: tx.block_height ? "Confirmada" : "Pendente no Mempool",
          mempoolUrl: `https://mempool.space/tx/${tx.hash}`,
          blockchainUrl: `https://www.blockchain.com/explorer/transactions/btc/${tx.hash}`,
        };
      });

      let statusCarteira = "Ativa";
      if (address === "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa") {
        statusCarteira = "Bloco Gênese (Satoshi Nakamoto)";
      } else if (Number(data.n_tx || 0) === 0) {
        statusCarteira = "Virgem (Sem Movimentações)";
      } else if (satoshisSaldo === 0) {
        statusCarteira = "Esvaziada / Saldo Zero";
      } else if (txs[0]?.timestamp && Date.now() - txs[0].timestamp * 1000 > 365 * 24 * 60 * 60 * 1000) {
        statusCarteira = "Dormindo (HODL > 1 ano)";
      }

      return {
        status: "ok",
        provedor: "Blockchain.com Public Raw API",
        address,
        saldo: {
          btc: saldoBtc,
          satoshis: satoshisSaldo,
          usdEstimado: saldoBtc * cotacao.usd,
          brlEstimado: saldoBtc * cotacao.brl,
        },
        recebido: {
          btc: totalRecebidoBtc,
          satoshis: satoshisRecebido,
          usdEstimado: totalRecebidoBtc * cotacao.usd,
          brlEstimado: totalRecebidoBtc * cotacao.brl,
        },
        enviado: {
          btc: totalEnviadoBtc,
          satoshis: satoshisEnviado,
        },
        cotacaoBtc: cotacao,
        totalTransacoes: Number(data.n_tx || 0),
        statusCarteira,
        ultimasTransacoes: txs,
        explorers: [
          { nome: "Mempool.space", url: `https://mempool.space/address/${address}` },
          { nome: "Blockchain.com", url: `https://www.blockchain.com/explorer/addresses/btc/${address}` },
          { nome: "Blockstream", url: `https://blockstream.info/address/${address}` },
        ],
      };
    }
  } catch (err) {
    console.warn(`[BTC ON-CHAIN PRIMARY ERROR]: ${err.message}. Ativando fallback Mempool.space...`);
  }

  // Fallback secundário: Mempool.space
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const [addrRes, txsRes] = await Promise.all([
      fetch(`https://mempool.space/api/address/${encodeURIComponent(address)}`, {
        headers: { "User-Agent": "RimuBusca-OSINT/1.0" },
        signal: controller.signal,
      }),
      fetch(`https://mempool.space/api/address/${encodeURIComponent(address)}/txs`, {
        headers: { "User-Agent": "RimuBusca-OSINT/1.0" },
        signal: controller.signal,
      }).catch(() => null),
    ]);
    clearTimeout(timeout);

    if (addrRes.ok) {
      const data = await addrRes.json();
      const rawTxs = txsRes && txsRes.ok ? await txsRes.json().catch(() => []) : [];

      const chainStats = data.chain_stats || {};
      const fundedSat = Number(chainStats.funded_txo_sum || 0);
      const spentSat = Number(chainStats.spent_txo_sum || 0);
      const satoshisSaldo = Math.max(0, fundedSat - spentSat);
      const saldoBtc = satoshisSaldo / 1e8;
      const totalRecebidoBtc = fundedSat / 1e8;
      const totalEnviadoBtc = spentSat / 1e8;

      const txs = (Array.isArray(rawTxs) ? rawTxs.slice(0, 15) : []).map((tx) => {
        const isSender = (tx.vin || []).some((v) => v.prevout?.scriptpubkey_address === address);
        return {
          hash: tx.txid,
          data: tx.status?.block_time ? new Date(tx.status.block_time * 1000).toISOString() : null,
          timestamp: tx.status?.block_time || null,
          tipo: isSender ? "ENVIADO" : "RECEBIDO",
          valorBtc: isSender ? totalEnviadoBtc : totalRecebidoBtc,
          valorSatoshis: isSender ? spentSat : fundedSat,
          taxaBtc: Number(tx.fee || 0) / 1e8,
          taxaSatoshis: Number(tx.fee || 0),
          confirmacoes: tx.status?.confirmed ? "Confirmada" : "Pendente no Mempool",
          mempoolUrl: `https://mempool.space/tx/${tx.txid}`,
          blockchainUrl: `https://www.blockchain.com/explorer/transactions/btc/${tx.txid}`,
        };
      });

      return {
        status: "ok",
        provedor: "Mempool.space API (Fallback)",
        address,
        saldo: {
          btc: saldoBtc,
          satoshis: satoshisSaldo,
          usdEstimado: saldoBtc * cotacao.usd,
          brlEstimado: saldoBtc * cotacao.brl,
        },
        recebido: {
          btc: totalRecebidoBtc,
          satoshis: fundedSat,
          usdEstimado: totalRecebidoBtc * cotacao.usd,
          brlEstimado: totalRecebidoBtc * cotacao.brl,
        },
        enviado: {
          btc: totalEnviadoBtc,
          satoshis: spentSat,
        },
        cotacaoBtc: cotacao,
        totalTransacoes: Number(chainStats.tx_count || 0),
        statusCarteira: satoshisSaldo > 0 ? "Ativa" : "Esvaziada / Sem Saldo",
        ultimasTransacoes: txs,
        explorers: [
          { nome: "Mempool.space", url: `https://mempool.space/address/${address}` },
          { nome: "Blockchain.com", url: `https://www.blockchain.com/explorer/addresses/btc/${address}` },
          { nome: "Blockstream", url: `https://blockstream.info/address/${address}` },
        ],
      };
    }
  } catch (err) {
    console.error(`[BTC ON-CHAIN FALLBACK ERROR]: ${err.message}`);
  }

  // Se ambas falharem, retorna objeto estruturado para não derrubar a requisição
  return {
    status: "indisponivel",
    provedor: "Nenhum provedor on-chain respondeu no tempo limite",
    address,
    saldo: { btc: 0, satoshis: 0, usdEstimado: 0, brlEstimado: 0 },
    recebido: { btc: 0, satoshis: 0, usdEstimado: 0, brlEstimado: 0 },
    enviado: { btc: 0, satoshis: 0 },
    cotacaoBtc: cotacao,
    totalTransacoes: 0,
    statusCarteira: "Indisponível Temporariamente",
    ultimasTransacoes: [],
    explorers: [
      { nome: "Mempool.space", url: `https://mempool.space/address/${address}` },
      { nome: "Blockchain.com", url: `https://www.blockchain.com/explorer/addresses/btc/${address}` },
    ],
  };
}

/**
 * 2. SERP API / Google Search: Busca exata pelo endereço na Surface Web.
 * Usa SERPAPI_KEY se configurada, com fallback automático para busca HTML de alta velocidade.
 */
export async function consultarSurfaceWeb(address) {
  const serpKey = process.env.SERPAPI_KEY || process.env.SERP_API_KEY || process.env.GOOGLE_SERP_API_KEY;

  const pivots = [
    { nome: "Google Search", url: `https://www.google.com/search?q=${encodeURIComponent(`"${address}"`)}` },
    { nome: "Reddit", url: `https://www.reddit.com/search/?q=${encodeURIComponent(`"${address}"`)}` },
    { nome: "GitHub", url: `https://github.com/search?q=${encodeURIComponent(`"${address}"`)}&type=code` },
    { nome: "BitcoinTalk", url: `https://bitcointalk.org/index.php?action=search2&search=${encodeURIComponent(`"${address}"`)}` },
    { nome: "BitcoinAbuse Reports", url: `https://www.bitcoinabuse.com/reports/${encodeURIComponent(address)}` },
    { nome: "WalletExplorer", url: `https://www.walletexplorer.com/address/${encodeURIComponent(address)}` },
  ];

  // Caso 1: Chave SERP API configurada
  if (serpKey) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(`"${address}"`)}&api_key=${serpKey}&num=15`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const organic = Array.isArray(data.organic_results) ? data.organic_results : [];
        const resultados = organic.map((r) => ({
          titulo: r.title || "Resultado Surface Web",
          url: r.link || "",
          snippet: r.snippet || "",
          displayedLink: r.displayed_link || "",
          data: r.date || null,
          categoria: classificarDominio(r.link),
        }));

        return {
          status: "ok",
          provedor: "SERP API Google Search",
          total: resultados.length,
          resultados,
          pivots,
        };
      }
    } catch (err) {
      console.warn(`[BTC SERP API WARN]: ${err.message}. Utilizando fallback surface...`);
    }
  }

  // Caso 2: Fallback Surface Web (sem dependência de chave para evitar bloqueio)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`"${address}"`)}`;
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const html = await res.text();
      const resultados = [];
      const regex = /<a class="result__url" href="([^"]+)"[\s\S]*?<a class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
      let match;
      while ((match = regex.exec(html)) !== null && resultados.length < 15) {
        let rawLink = match[1].trim();
        if (rawLink.includes("uddg=")) {
          try {
            const parsed = new URL("https://html.duckduckgo.com" + rawLink);
            const decoded = parsed.searchParams.get("uddg");
            if (decoded) rawLink = decoded;
          } catch {
            // Mantém link original
          }
        }

        const snippet = match[2].replace(/<[^>]+>/g, "").trim();
        const tituloMatch = html.slice(Math.max(0, match.index - 350), match.index).match(/<a class="result__title"[^>]*>([\s\S]*?)<\/a>/i);
        const titulo = tituloMatch ? tituloMatch[1].replace(/<[^>]+>/g, "").trim() : "Menção em Surface Web";

        resultados.push({
          titulo,
          url: rawLink,
          snippet,
          categoria: classificarDominio(rawLink),
          data: null,
        });
      }

      return {
        status: "ok",
        provedor: "Surface Web OSINT Engine (Direct Clearnet)",
        nota: serpKey ? null : "Chave SERPAPI_KEY não configurada no .env. Executado via mecanismo alternativo.",
        total: resultados.length,
        resultados,
        pivots,
      };
    }
  } catch (err) {
    console.warn(`[BTC SURFACE FALLBACK WARN]: ${err.message}`);
  }

  // Fallback seguro em caso de indisponibilidade
  return {
    status: "sem_resultados_ou_timeout",
    provedor: "Surface Web",
    total: 0,
    resultados: [],
    pivots,
  };
}

/**
 * 3. Ahmia (Dark Web): Consulta ao motor de busca Ahmia (clearnet proxy)
 * por menções do endereço Bitcoin em sites .onion da rede Tor.
 */
export async function consultarAhmiaDarkWeb(address) {
  const ahmiaSearchUrl = `https://ahmia.fi/search/?q=${encodeURIComponent(address)}`;
  const torAhmiaUrl = `http://juhanurmihxlp77nkq76byazcldy2hlmovfu2epvl5ankdibsot4csyd.onion/search/?q=${encodeURIComponent(address)}`;

  try {
    // Passo 1: Obter token dinâmico da página inicial do Ahmia com timeout curto (3s)
    let tokenParam = "";
    try {
      const c1 = new AbortController();
      const t1 = setTimeout(() => c1.abort(), 3000);
      const homeRes = await fetch("https://ahmia.fi/", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
        signal: c1.signal,
      });
      clearTimeout(t1);
      const homeHtml = await homeRes.text();
      const hiddenMatch = homeHtml.match(/<input type="hidden" name="([^"]+)" value="([^"]+)">/i);
      if (hiddenMatch) {
        tokenParam = `&${hiddenMatch[1]}=${hiddenMatch[2]}`;
      }
    } catch {
      // Segue sem token se a home falhar
    }

    // Passo 2: Executar busca por endereço BTC com timeout seguro (4.5s)
    const c2 = new AbortController();
    const t2 = setTimeout(() => c2.abort(), 4500);
    const searchRes = await fetch(`https://ahmia.fi/search/?q=${encodeURIComponent(address)}${tokenParam}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Referer": "https://ahmia.fi/",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: c2.signal,
    });
    clearTimeout(t2);

    if (searchRes.ok) {
      const searchHtml = await searchRes.text();
      const resultados = [];
      const liRegex = /<li class="result">([\s\S]*?)<\/li>/gi;
      let match;

      while ((match = liRegex.exec(searchHtml)) !== null && resultados.length < 15) {
        const block = match[1];
        const titleMatch = block.match(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
        const citeMatch = block.match(/<cite>([\s\S]*?)<\/cite>/i);
        const descMatch = block.match(/<p>([\s\S]*?)<\/p>/i);
        const timeMatch = block.match(/<span class="lastSeen">([\s\S]*?)<\/span>/i);

        let urlOnion = "";
        if (titleMatch) {
          const rawUrl = titleMatch[1];
          if (rawUrl.includes("redirect_url=")) {
            try {
              const uParam = new URL("https://ahmia.fi" + rawUrl).searchParams.get("redirect_url");
              urlOnion = uParam || rawUrl;
            } catch {
              urlOnion = rawUrl;
            }
          } else {
            urlOnion = rawUrl;
          }
        }
        if (!urlOnion && citeMatch) {
          urlOnion = citeMatch[1].replace(/<[^>]+>/g, "").trim();
        }

        // Gera espelho clearnet para navegação rápida fora do navegador Tor
        let urlClearnet = urlOnion;
        if (urlOnion && urlOnion.includes(".onion")) {
          urlClearnet = urlOnion.replace(/\.onion/g, ".onion.pet");
        }

        resultados.push({
          titulo: titleMatch ? titleMatch[2].replace(/<[^>]+>/g, "").trim() : "Serviço Oculto Tor (.onion)",
          urlOnion,
          urlClearnet,
          snippet: descMatch ? descMatch[1].replace(/<[^>]+>/g, "").trim() : "Menção à carteira em serviço oculto da Dark Web.",
          lastSeen: timeMatch ? timeMatch[1].replace(/<[^>]+>/g, "").trim() : null,
        });
      }

      return {
        status: "ok",
        provedor: "Ahmia.fi Clearnet Gateway",
        total: resultados.length,
        resultados,
        ahmiaSearchUrl,
        torAhmiaUrl,
      };
    }
  } catch (err) {
    console.warn(`[BTC AHMIA WARN]: ${err.message}`);
  }

  return {
    status: "indisponivel",
    provedor: "Ahmia.fi (Proxy)",
    mensagem: "Mecanismo Ahmia indisponível ou tempo limite esgotado.",
    total: 0,
    resultados: [],
    ahmiaSearchUrl,
    torAhmiaUrl,
  };
}

/**
 * Orquestrador Principal: Executa as 3 fontes em paralelo com Promise.allSettled
 * e consolida a investigação em um único relatório para Vercel.
 */
export async function investigarCarteiraBitcoin(rawAddress, { userId = null, ip = "0.0.0.0" } = {}) {
  const validacao = validarEnderecoBitcoin(rawAddress);
  if (!validacao.valido) {
    return {
      sucesso: false,
      erro: validacao.erro || "Endereço Bitcoin inválido.",
    };
  }

  const address = validacao.address;
  const cacheKey = `btc:${address}`;

  // Tenta responder do cache se consultado nos últimos 15 minutos
  try {
    const cached = await cacheService.get("bitcoin_forense", cacheKey);
    if (cached?.hit && cached.dados) {
      return { ...cached.dados, cacheHit: true };
    }
  } catch {
    // Segue sem interromper
  }

  const t0 = Date.now();

  // EXECUÇÃO EM PARALELO (Respeita o teto de 10-15s da Vercel)
  const [onChainRes, surfaceRes, darkWebRes] = await Promise.allSettled([
    consultarOnChain(address),
    consultarSurfaceWeb(address),
    consultarAhmiaDarkWeb(address),
  ]);

  const onChainData =
    onChainRes.status === "fulfilled"
      ? onChainRes.value
      : {
          status: "erro",
          saldo: { btc: 0, satoshis: 0, usdEstimado: 0, brlEstimado: 0 },
          recebido: { btc: 0, satoshis: 0 },
          enviado: { btc: 0, satoshis: 0 },
          totalTransacoes: 0,
          statusCarteira: "Erro On-Chain",
          ultimasTransacoes: [],
          explorers: [],
        };

  const surfaceData =
    surfaceRes.status === "fulfilled"
      ? surfaceRes.value
      : { status: "erro", total: 0, resultados: [], pivots: [] };

  const darkWebData =
    darkWebRes.status === "fulfilled"
      ? darkWebRes.value
      : { status: "erro", total: 0, resultados: [], ahmiaSearchUrl: "", torAhmiaUrl: "" };

  const tempoExecucaoMs = Date.now() - t0;

  // Verificação de alertas de abuso (se menções incluem ransomware, scam, blackmail)
  const textoMencoes = [
    ...(surfaceData.resultados || []).map((r) => `${r.titulo} ${r.snippet}`),
    ...(darkWebData.resultados || []).map((r) => `${r.titulo} ${r.snippet}`),
  ]
    .join(" ")
    .toLowerCase();

  const alertaAbuso =
    textoMencoes.includes("ransomware") ||
    textoMencoes.includes("sextortion") ||
    textoMencoes.includes("scam") ||
    textoMencoes.includes("phishing") ||
    textoMencoes.includes("hack") ||
    textoMencoes.includes("blackmail");

  const resultado = {
    sucesso: true,
    consulta: {
      address,
      formato: validacao.formato,
      tipo: validacao.tipo,
      timestamp: new Date().toISOString(),
    },
    resumo: {
      saldoBtc: onChainData.saldo?.btc || 0,
      saldoSatoshis: onChainData.saldo?.satoshis || 0,
      saldoUsd: onChainData.saldo?.usdEstimado || 0,
      saldoBrl: onChainData.saldo?.brlEstimado || 0,
      totalRecebidoBtc: onChainData.recebido?.btc || 0,
      totalEnviadoBtc: onChainData.enviado?.btc || 0,
      totalTransacoes: onChainData.totalTransacoes || 0,
      statusCarteira: onChainData.statusCarteira || "Identificada",
      mencoesSurfaceWeb: surfaceData.total || 0,
      mencoesDarkWeb: darkWebData.total || 0,
      alertaAbuso,
    },
    onChain: onChainData,
    surfaceWeb: surfaceData,
    darkWeb: darkWebData,
    tempoExecucaoMs,
  };

  // Salva no cache por 15 minutos
  try {
    await cacheService.set("bitcoin_forense", cacheKey, resultado, { ttlMs: 15 * 60 * 1000 });
  } catch {
    // Opcional
  }

  return resultado;
}
