import { httpRequest } from "../core/httpClient.js";
import { cacheService } from "../core/cache.service.js";

/**
 * ==============================================================================
 * RIMUBUSCA - SERVICE BRIGHT DATA WEB SCRAPER API v3 (SOCIAL OSINT)
 * Coleta assíncrona profunda para Instagram e X (Twitter) com:
 *  - Travas de segurança de cota (padrão: 20 posts + 15 comentários por post)
 *  - Cache persistente de 24h (evita cobrança duplicada de créditos)
 *  - Busca & filtragem por palavras-chave específicas em posts e comentários
 *  - Pipeline assíncrono em fases (trigger -> progress polling -> snapshot JSON)
 *    totalmente compatível com limite serverless da Vercel (maxDuration: 60s)
 * ==============================================================================
 */

export const BRIGHTDATA_API_BASE = "https://api.brightdata.com/datasets/v3";
export const BRIGHTDATA_REQUEST_API = "https://api.brightdata.com/request";

export const DEFAULT_MAX_POSTS = 20;
export const MAX_POSTS_LIMIT = 50;
export const DEFAULT_MAX_COMMENTS_PER_POST = 15;
export const MAX_COMMENTS_PER_POST_LIMIT = 25;

const CACHE_NAMESPACE = "brightdata_social_v1";
const JOB_STATE_NAMESPACE = "brightdata_job_v1";
const REPORT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const JOB_STATE_TTL_MS = 30 * 60 * 1000;

export const BRIGHTDATA_DATASETS = Object.freeze({
  instagram_profiles: "gd_l1vikfch901nx3by4",
  instagram_posts: "gd_lk5ns7kz21pck8jpis",
  instagram_comments: "gd_ltppn085pokosxh13",
  x_profiles: "gd_lwxmeb2u1cniijd7t4",
  x_posts: "gd_lwxkxvnf1cynvib9co",
});

const PLACEHOLDER_KEYS = new Set([
  "",
  "sua_chave_brightdata_aqui",
  "COLE_SUA_CHAVE_AQUI",
  "your_brightdata_api_key",
]);

export function getBrightDataApiKey() {
  const raw = (
    process.env.BRIGHTDATA_API_KEY ||
    process.env.BRIGHTDATA_API_TOKEN ||
    ""
  ).trim();
  if (!raw || PLACEHOLDER_KEYS.has(raw)) return "";
  return raw;
}

export function isBrightDataConfigured() {
  const key = getBrightDataApiKey();
  const serpZone = (process.env.BRIGHTDATA_SERP_ZONE || "").trim();
  return {
    configured: Boolean(key),
    keyMasked: key ? `••••••••${key.slice(-4)}` : null,
    serpZoneConfigured: Boolean(serpZone && !PLACEHOLDER_KEYS.has(serpZone)),
    defaults: {
      maxPosts: DEFAULT_MAX_POSTS,
      maxPostsLimit: MAX_POSTS_LIMIT,
      maxCommentsPerPost: DEFAULT_MAX_COMMENTS_PER_POST,
      maxCommentsPerPostLimit: MAX_COMMENTS_PER_POST_LIMIT,
    },
  };
}

export function clampLimits({ maxPosts, maxCommentsPerPost } = {}) {
  const parsedPosts = Number(maxPosts);
  const parsedComments =
    maxCommentsPerPost === undefined || maxCommentsPerPost === null || maxCommentsPerPost === ""
      ? DEFAULT_MAX_COMMENTS_PER_POST
      : Number(maxCommentsPerPost);

  const postsLimit = Number.isFinite(parsedPosts) && parsedPosts > 0
    ? Math.min(Math.floor(parsedPosts), MAX_POSTS_LIMIT)
    : DEFAULT_MAX_POSTS;

  const commentsLimit = Number.isFinite(parsedComments) && parsedComments >= 0
    ? Math.min(Math.floor(parsedComments), MAX_COMMENTS_PER_POST_LIMIT)
    : DEFAULT_MAX_COMMENTS_PER_POST;

  return { postsLimit, commentsLimit };
}

function normalizeFold(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Converte string de palavras-chave (separadas por vírgula, quebra de linha ou ponto-e-vírgula;
 * ou termos entre aspas) em lista deduplicada para busca exata/insensível a acentos.
 */
export function parsearPalavrasChave(rawKeywords) {
  if (!rawKeywords) return [];
  const rawList = Array.isArray(rawKeywords)
    ? rawKeywords
    : String(rawKeywords).split(/[,;\n]+/);

  const seen = new Set();
  const result = [];
  for (const item of rawList) {
    const cleaned = String(item || "")
      .replace(/^["'\s]+|["'\s]+$/g, "")
      .trim();
    if (!cleaned || cleaned.length < 2) continue;
    const norm = normalizeFold(cleaned);
    if (seen.has(norm)) continue;
    seen.add(norm);
    result.push({ original: cleaned, normalized: norm });
  }
  return result.slice(0, 12);
}

/**
 * Normaliza handle ou URL do Instagram / X (Twitter) de acordo com o modo solicitado.
 */
export function normalizarAlvoSocial({ plataforma, modo, alvo }) {
  const plat = String(plataforma || "").toLowerCase() === "x" || String(plataforma || "").toLowerCase() === "twitter"
    ? "x"
    : "instagram";

  const raw = String(alvo || "").trim();
  const mode = ["perfil", "post_url", "palavra_chave"].includes(modo) ? modo : "perfil";

  if (mode === "palavra_chave") {
    return {
      plataforma: plat,
      modo: mode,
      handle: "",
      url: "",
      label: raw.replace(/^["'\s]+|["'\s]+$/g, ""),
      isPostUrl: false,
    };
  }

  // Detecta se usuário colou diretamente uma URL de post no modo perfil
  const isUrl = /^https?:\/\//i.test(raw);
  if (plat === "instagram") {
    if (isUrl) {
      try {
        const u = new URL(raw);
        const cleanPath = u.pathname.replace(/\/+$/, "");
        if (/^\/(p|reel|reels|tv)\/[A-Za-z0-9_-]+/i.test(cleanPath)) {
          return {
            plataforma: "instagram",
            modo: "post_url",
            handle: "",
            url: `https://www.instagram.com${cleanPath}/`,
            label: cleanPath,
            isPostUrl: true,
          };
        }
        const handlePart = cleanPath.replace(/^\/+/, "").split("/")[0]?.replace(/^@/, "") || "";
        return {
          plataforma: "instagram",
          modo: "perfil",
          handle: handlePart,
          url: handlePart ? `https://www.instagram.com/${handlePart}/` : raw,
          label: handlePart ? `@${handlePart}` : raw,
          isPostUrl: false,
        };
      } catch {
        // Segue tratamento como handle
      }
    }

    const handle = raw.replace(/^@+/, "").replace(/[/?#].*$/, "").trim();
    if (!handle) {
      const err = new Error("Informe um @usuário ou URL válida do Instagram.");
      err.statusCode = 400;
      throw err;
    }
    if (mode === "post_url") {
      const err = new Error("Informe uma URL completa de post/reel do Instagram (ex: https://www.instagram.com/p/...).");
      err.statusCode = 400;
      throw err;
    }
    return {
      plataforma: "instagram",
      modo: "perfil",
      handle,
      url: `https://www.instagram.com/${handle}/`,
      label: `@${handle}`,
      isPostUrl: false,
    };
  }

  // Plataforma X / Twitter
  if (isUrl) {
    try {
      const u = new URL(raw);
      const cleanPath = u.pathname.replace(/\/+$/, "");
      if (/\/status\/\d+/i.test(cleanPath)) {
        const normalizedHost = "x.com";
        return {
          plataforma: "x",
          modo: "post_url",
          handle: cleanPath.split("/").filter(Boolean)[0] || "",
          url: `https://${normalizedHost}${cleanPath}`,
          label: cleanPath,
          isPostUrl: true,
        };
      }
      const handlePart = cleanPath.replace(/^\/+/, "").split("/")[0]?.replace(/^@/, "") || "";
      return {
        plataforma: "x",
        modo: "perfil",
        handle: handlePart,
        url: handlePart ? `https://x.com/${handlePart}` : raw,
        label: handlePart ? `@${handlePart}` : raw,
        isPostUrl: false,
      };
    } catch {
      // Segue como handle
    }
  }

  const handle = raw.replace(/^@+/, "").replace(/[/?#].*$/, "").trim();
  if (!handle) {
    const err = new Error("Informe um @usuário ou URL válida do X (Twitter).");
    err.statusCode = 400;
    throw err;
  }
  if (mode === "post_url") {
    const err = new Error("Informe uma URL completa de tweet/post do X (ex: https://x.com/usuario/status/...).");
    err.statusCode = 400;
    throw err;
  }
  return {
    plataforma: "x",
    modo: "perfil",
    handle,
    url: `https://x.com/${handle}`,
    label: `@${handle}`,
    isPostUrl: false,
  };
}

function buildCacheKey({
  plataforma,
  modo,
  alvoUrl,
  palavrasChave,
  incluirComentarios,
  postsLimit,
  commentsLimit,
  startDate,
  endDate,
}) {
  const kwSig = palavrasChave.map((k) => k.normalized).sort().join("|");
  return JSON.stringify({
    p: plataforma,
    m: modo,
    u: normalizeFold(alvoUrl),
    kw: kwSig,
    ic: Boolean(incluirComentarios),
    mp: postsLimit,
    mc: commentsLimit,
    sd: startDate || "",
    ed: endDate || "",
  });
}

function decodeHtmlLinksFromSerp(html, plataforma) {
  const rawHtml = String(html || "");
  const matches = new Set();

  // Decodifica URLs diretas ou parâmetros uddg= (DuckDuckGo HTML)
  const rawUrls = [];
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let m;
  while ((m = hrefRegex.exec(rawHtml)) !== null) {
    rawUrls.push(m[1]);
  }
  const plainUrlRegex = /https?:\/\/(?:www\.)?(?:instagram\.com|x\.com|twitter\.com)\/[^\s"'<>\\)]+/gi;
  while ((m = plainUrlRegex.exec(rawHtml)) !== null) {
    rawUrls.push(m[0]);
  }

  for (const candidate of rawUrls) {
    let resolved = candidate;
    try {
      if (candidate.includes("uddg=")) {
        const parsed = new URL(candidate.startsWith("//") ? `https:${candidate}` : candidate, "https://duckduckgo.com");
        const uddg = parsed.searchParams.get("uddg");
        if (uddg) resolved = uddg;
      }
      const parsedFinal = new URL(resolved);
      const host = parsedFinal.hostname.replace(/^www\./, "").toLowerCase();
      if (plataforma === "x" && (host === "x.com" || host === "twitter.com")) {
        const stMatch = parsedFinal.pathname.match(/^\/([A-Za-z0-9_]+)\/status\/(\d+)/);
        if (stMatch) {
          matches.add(`https://x.com/${stMatch[1]}/status/${stMatch[2]}`);
        }
      } else if (plataforma === "instagram" && host === "instagram.com") {
        const igMatch = parsedFinal.pathname.match(/^\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
        if (igMatch) {
          matches.add(`https://www.instagram.com/${igMatch[1]}/${igMatch[2]}/`);
        }
      }
    } catch {
      // URL inválida ignorada
    }
  }
  return Array.from(matches);
}

/**
 * Descoberta de URLs públicas de posts por palavra-chave para alimentar os scrapers
 * (usa Bright Data SERP API se BRIGHTDATA_SERP_ZONE estiver configurada, ou busca web pública gratuita,
 * com fallback para tag URL no Instagram).
 */
export async function descobrirUrlsPorPalavraChave({
  plataforma,
  palavrasChave,
  textoLivre,
  postsLimit,
  apiKey,
}) {
  const termos = palavrasChave.length > 0
    ? palavrasChave.map((k) => `"${k.original}"`).join(" ")
    : `"${String(textoLivre || "").trim()}"`;

  const searchQuery = plataforma === "x"
    ? `site:x.com "/status/" ${termos}`
    : `site:instagram.com ("/p/" OR "/reel/") ${termos}`;

  const serpZone = (process.env.BRIGHTDATA_SERP_ZONE || "").trim();
  const discovered = [];
  let source = "web_search";

  // 1) Bright Data SERP API (opcional, se configurada no .env)
  if (serpZone && !PLACEHOLDER_KEYS.has(serpZone) && apiKey) {
    try {
      const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&num=${Math.min(postsLimit, 30)}`;
      const resSerp = await httpRequest(BRIGHTDATA_REQUEST_API, {
        method: "POST",
        timeout: 25000,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          zone: serpZone,
          url: googleSearchUrl,
          format: "raw",
        }),
      });
      if (resSerp.ok && resSerp.data) {
        const urls = decodeHtmlLinksFromSerp(
          typeof resSerp.data === "string" ? resSerp.data : JSON.stringify(resSerp.data),
          plataforma
        );
        discovered.push(...urls);
        source = "brightdata_serp";
      }
    } catch (err) {
      console.warn("[BRIGHTDATA SERP KEYWORD WARNING]:", err.message);
    }
  }

  // 2) Fallback DuckDuckGo HTML (zero custo extra)
  if (discovered.length === 0) {
    try {
      const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;
      const resDdg = await httpRequest(ddgUrl, {
        method: "GET",
        timeout: 15000,
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        },
      });
      if (resDdg.ok && typeof resDdg.data === "string") {
        const urls = decodeHtmlLinksFromSerp(resDdg.data, plataforma);
        discovered.push(...urls);
        source = "duckduckgo_html";
      }
    } catch (err) {
      console.warn("[DDG KEYWORD DISCOVERY WARNING]:", err.message);
    }
  }

  const deduped = Array.from(new Set(discovered)).slice(0, postsLimit);
  if (deduped.length > 0) {
    return { mode: "post_urls", urls: deduped, source };
  }

  // 3) Fallback nativo de Hashtag para Instagram se for palavra única/hashtag
  if (plataforma === "instagram") {
    const rawFirst = (palavrasChave[0]?.original || textoLivre || "").replace(/^#/, "").trim();
    const tagSlug = normalizeFold(rawFirst).replace(/[^a-z0-9_]/g, "");
    if (tagSlug && !rawFirst.includes(" ")) {
      return {
        mode: "discover_tag",
        urls: [`https://www.instagram.com/explore/tags/${tagSlug}/`],
        source: "instagram_hashtag_fallback",
      };
    }
  }

  return { mode: "empty", urls: [], source };
}

async function triggerBrightDataDataset({ apiKey, datasetId, queryParams = {}, body }) {
  const qs = new URLSearchParams({
    dataset_id: datasetId,
    notify: "false",
    include_errors: "true",
    ...queryParams,
  });
  const url = `${BRIGHTDATA_API_BASE}/trigger?${qs.toString()}`;
  const res = await httpRequest(url, {
    method: "POST",
    timeout: 30000,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const msg = typeof res.data === "object"
      ? (res.data?.error || res.data?.message || JSON.stringify(res.data))
      : String(res.data || `HTTP ${res.status}`);
    const lowerMsg = msg.toLowerCase();

    if (lowerMsg.includes("customer is not active")) {
      const err = new Error(
        "Conta Bright Data inativa ou pendente de ativação (Customer is not active). Verifique no painel da Bright Data: Billing/método de pagamento ou saldo, confirmação de KYC/e-mail e status da assinatura Web Scraper."
      );
      err.statusCode = 402;
      err.code = "BRIGHTDATA_CUSTOMER_INACTIVE";
      throw err;
    }

    if (res.status === 401 || res.status === 403) {
      const err = new Error(
        `Token Bright Data rejeitado (${res.status}): verifique se BRIGHTDATA_API_KEY está correto e não expirado.`
      );
      err.statusCode = 502;
      err.code = "BRIGHTDATA_AUTH_ERROR";
      throw err;
    }

    const err = new Error(`Bright Data API erro (${res.status}): ${msg}`);
    err.statusCode = res.status >= 400 ? res.status : 502;
    throw err;
  }

  const snapshotId = res.data?.snapshot_id;
  if (!snapshotId) {
    const err = new Error("Bright Data não retornou snapshot_id ao iniciar a coleta.");
    err.statusCode = 502;
    throw err;
  }

  return snapshotId;
}

/**
 * Inicia coleta assíncrona na Bright Data Web Scraper API v3 (ou retorna cache instantâneo).
 */
export async function iniciarColetaSocialBrightData({
  plataforma = "instagram",
  modo = "perfil",
  alvo = "",
  palavrasChave = "",
  incluirComentarios = true,
  maxPosts = DEFAULT_MAX_POSTS,
  maxCommentsPerPost = DEFAULT_MAX_COMMENTS_PER_POST,
  startDate = "",
  endDate = "",
  forceRefresh = false,
} = {}) {
  const apiKey = getBrightDataApiKey();
  const { postsLimit, commentsLimit } = clampLimits({ maxPosts, maxCommentsPerPost });
  const target = normalizarAlvoSocial({ plataforma, modo, alvo });
  const keywordsList = parsearPalavrasChave(palavrasChave || (target.modo === "palavra_chave" ? alvo : ""));

  if (target.modo === "palavra_chave" && keywordsList.length === 0) {
    const err = new Error("Informe ao menos uma palavra-chave ou hashtag válida para pesquisa.");
    err.statusCode = 400;
    throw err;
  }

  const cacheKey = buildCacheKey({
    plataforma: target.plataforma,
    modo: target.modo,
    alvoUrl: target.modo === "palavra_chave" ? keywordsList.map((k) => k.original).join(",") : target.url,
    palavrasChave: keywordsList,
    incluirComentarios: Boolean(incluirComentarios && commentsLimit > 0),
    postsLimit,
    commentsLimit,
    startDate,
    endDate,
  });

  if (!forceRefresh) {
    const cached = await cacheService.get(CACHE_NAMESPACE, cacheKey);
    if (cached?.data) {
      return {
        status: "ready",
        cached: true,
        cachedAt: cached.cachedAt,
        snapshotId: null,
        relatorio: cached.data,
      };
    }
  }

  if (!apiKey) {
    const err = new Error(
      "Chave da API Bright Data (BRIGHTDATA_API_KEY) não configurada no servidor. Adicione a variável no .env ou painel Admin."
    );
    err.statusCode = 503;
    err.code = "BRIGHTDATA_NOT_CONFIGURED";
    throw err;
  }

  let snapshotId;
  let discoveryMeta = null;

  if (target.plataforma === "instagram") {
    if (target.modo === "perfil") {
      const inputObj = {
        url: target.url,
        num_of_posts: postsLimit,
      };
      if (startDate) inputObj.start_date = startDate;
      if (endDate) inputObj.end_date = endDate;

      snapshotId = await triggerBrightDataDataset({
        apiKey,
        datasetId: BRIGHTDATA_DATASETS.instagram_posts,
        queryParams: { type: "discover_new", discover_by: "url" },
        body: { input: [inputObj], limit_per_input: postsLimit },
      });
    } else if (target.modo === "post_url") {
      snapshotId = await triggerBrightDataDataset({
        apiKey,
        datasetId: BRIGHTDATA_DATASETS.instagram_posts,
        body: { input: [{ url: target.url }] },
      });
    } else {
      // palavra_chave
      const disc = await descobrirUrlsPorPalavraChave({
        plataforma: "instagram",
        palavrasChave: keywordsList,
        textoLivre: alvo,
        postsLimit,
        apiKey,
      });
      discoveryMeta = disc;

      if (disc.mode === "post_urls" && disc.urls.length > 0) {
        snapshotId = await triggerBrightDataDataset({
          apiKey,
          datasetId: BRIGHTDATA_DATASETS.instagram_posts,
          body: { input: disc.urls.map((u) => ({ url: u })) },
        });
      } else if (disc.mode === "discover_tag" && disc.urls.length > 0) {
        snapshotId = await triggerBrightDataDataset({
          apiKey,
          datasetId: BRIGHTDATA_DATASETS.instagram_posts,
          queryParams: { type: "discover_new", discover_by: "url" },
          body: {
            input: [{ url: disc.urls[0], num_of_posts: postsLimit }],
            limit_per_input: postsLimit,
          },
        });
      } else {
        const err = new Error(
          "Nenhum post público indexado foi localizado para essas palavras-chave no Instagram. Tente informar um @perfil específico + filtro por palavras-chave, uma #hashtag única ou configurar BRIGHTDATA_SERP_ZONE."
        );
        err.statusCode = 404;
        err.code = "NO_KEYWORD_POSTS_FOUND";
        throw err;
      }
    }
  } else {
    // Plataforma X (Twitter)
    if (target.modo === "perfil") {
      const inputObj = {
        url: target.url,
        max_number_of_posts: postsLimit,
      };
      if (startDate) inputObj.start_date = startDate;
      if (endDate) inputObj.end_date = endDate;

      snapshotId = await triggerBrightDataDataset({
        apiKey,
        datasetId: BRIGHTDATA_DATASETS.x_posts,
        queryParams: { type: "discover_new", discover_by: "profile_url" },
        body: { input: [inputObj], limit_per_input: postsLimit },
      });
    } else if (target.modo === "post_url") {
      snapshotId = await triggerBrightDataDataset({
        apiKey,
        datasetId: BRIGHTDATA_DATASETS.x_posts,
        body: { input: [{ url: target.url }] },
      });
    } else {
      const disc = await descobrirUrlsPorPalavraChave({
        plataforma: "x",
        palavrasChave: keywordsList,
        textoLivre: alvo,
        postsLimit,
        apiKey,
      });
      discoveryMeta = disc;

      if (disc.urls.length === 0) {
        const err = new Error(
          "Nenhum tweet/post público indexado foi encontrado para essa palavra-chave no X. Experimente informar um @perfil do X + filtro de palavras ou configure BRIGHTDATA_SERP_ZONE para descoberta via SERP."
        );
        err.statusCode = 404;
        err.code = "NO_KEYWORD_POSTS_FOUND";
        throw err;
      }

      snapshotId = await triggerBrightDataDataset({
        apiKey,
        datasetId: BRIGHTDATA_DATASETS.x_posts,
        body: { input: disc.urls.map((u) => ({ url: u })) },
      });
    }
  }

  const jobState = {
    snapshotId,
    phase: "posts",
    plataforma: target.plataforma,
    modo: target.modo,
    alvoLabel: target.label || keywordsList.map((k) => k.original).join(", "),
    alvoUrl: target.url,
    handle: target.handle,
    palavrasChave: keywordsList,
    incluirComentarios: Boolean(incluirComentarios && commentsLimit > 0),
    postsLimit,
    commentsLimit,
    startDate,
    endDate,
    cacheKey,
    discoveryMeta,
    createdAt: new Date().toISOString(),
  };

  await cacheService.set(JOB_STATE_NAMESPACE, snapshotId, jobState, {
    ttlMs: JOB_STATE_TTL_MS,
  });

  return {
    status: "running",
    cached: false,
    phase: "posts",
    snapshotId,
    plataforma: target.plataforma,
    modo: target.modo,
    alvo: jobState.alvoLabel,
    travas: {
      maxPosts: postsLimit,
      maxCommentsPerPost: jobState.incluirComentarios ? commentsLimit : 0,
      estimativaMaximaRegistros:
        target.plataforma === "instagram" && jobState.incluirComentarios
          ? postsLimit + postsLimit * commentsLimit
          : postsLimit,
    },
    discoveryMeta,
  };
}

function parseSnapshotPayload(rawData) {
  if (Array.isArray(rawData)) return rawData;
  if (typeof rawData === "string") {
    const trimmed = rawData.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      // NDJSON fallback (linhas separadas)
      const items = [];
      for (const line of trimmed.split(/\r?\n/)) {
        const clean = line.trim();
        if (!clean) continue;
        try {
          items.push(JSON.parse(clean));
        } catch {
          // Linha malformada ignorada
        }
      }
      return items;
    }
  }
  if (rawData && typeof rawData === "object") {
    return Array.isArray(rawData.data) ? rawData.data : [rawData];
  }
  return [];
}

/**
 * Consulta progresso do snapshot na Bright Data, encadeia coleta de comentários no Instagram
 * (quando necessário e habilitado) e retorna o relatório OSINT normalizado quando pronto.
 */
export async function consultarProgressoSnapshotBrightData(snapshotId, fallbackOptions = {}) {
  const apiKey = getBrightDataApiKey();
  if (!apiKey) {
    const err = new Error("Chave BRIGHTDATA_API_KEY não configurada.");
    err.statusCode = 503;
    throw err;
  }

  const cachedState = await cacheService.get(JOB_STATE_NAMESPACE, snapshotId);
  const jobState = cachedState?.data || {
    snapshotId,
    phase: fallbackOptions.phase || "posts",
    plataforma: fallbackOptions.plataforma || "instagram",
    modo: fallbackOptions.modo || "perfil",
    alvoLabel: fallbackOptions.alvo || "Alvo Social",
    alvoUrl: fallbackOptions.alvoUrl || "",
    handle: fallbackOptions.handle || "",
    palavrasChave: parsearPalavrasChave(fallbackOptions.palavrasChave || ""),
    incluirComentarios: fallbackOptions.incluirComentarios !== false,
    ...clampLimits(fallbackOptions),
    cacheKey: null,
    phase1PostsRaw: [],
  };

  const progressUrl = `${BRIGHTDATA_API_BASE}/progress/${encodeURIComponent(snapshotId)}`;
  const progRes = await httpRequest(progressUrl, {
    method: "GET",
    timeout: 20000,
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!progRes.ok) {
    const err = new Error(`Falha ao consultar progresso do snapshot (${progRes.status}).`);
    err.statusCode = progRes.status >= 400 ? progRes.status : 502;
    throw err;
  }

  const progressData = progRes.data || {};
  const status = String(progressData.status || "").toLowerCase();

  if (status === "starting" || status === "running" || status === "building") {
    return {
      status: "running",
      phase: jobState.phase,
      snapshotId,
      progress: {
        status,
        records: progressData.records ?? null,
        errors: progressData.errors ?? null,
      },
    };
  }

  if (status === "failed" || status === "canceled") {
    return {
      status,
      phase: jobState.phase,
      snapshotId,
      error: progressData.error_message || `Coleta Bright Data encerrada com status "${status}".`,
      errorCodes: progressData.error_codes || [],
    };
  }

  // status === "ready" (ou equivalente concluído)
  const snapshotUrl = `${BRIGHTDATA_API_BASE}/snapshot/${encodeURIComponent(snapshotId)}?format=json`;
  const snapRes = await httpRequest(snapshotUrl, {
    method: "GET",
    timeout: 40000,
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!snapRes.ok) {
    // 202 ocasional indica arquivo ainda sendo empacotado logo após status=ready
    if (snapRes.status === 202) {
      return {
        status: "running",
        phase: jobState.phase,
        snapshotId,
        progress: { status: "finalizing", records: progressData.records ?? null },
      };
    }
    const err = new Error(`Falha ao baixar snapshot (${snapRes.status}).`);
    err.statusCode = 502;
    throw err;
  }

  const downloadedItems = parseSnapshotPayload(snapRes.data);

  // Se acabamos de concluir Fase 1 (posts do Instagram) e o usuário pediu até N comentários por post:
  if (
    jobState.phase === "posts" &&
    jobState.plataforma === "instagram" &&
    jobState.incluirComentarios &&
    jobState.commentsLimit > 0
  ) {
    const validPosts = downloadedItems
      .filter((item) => item && !item.error && item.url)
      .slice(0, jobState.postsLimit);

    // Só aciona o dataset separado gd_ltppn085pokosxh13 para posts que possuem comentários faltantes além de latest_comments
    const postsNeedingComments = validPosts.filter((p) => {
      const embeddedCount = Array.isArray(p.latest_comments) ? p.latest_comments.length : 0;
      const declaredTotal = Number(p.num_comments);
      if (Number.isFinite(declaredTotal) && declaredTotal === 0) return false;
      if (Number.isFinite(declaredTotal) && embeddedCount >= Math.min(declaredTotal, jobState.commentsLimit)) {
        return false;
      }
      return true;
    });

    if (postsNeedingComments.length > 0) {
      const commentsSnapshotId = await triggerBrightDataDataset({
        apiKey,
        datasetId: BRIGHTDATA_DATASETS.instagram_comments,
        body: {
          input: postsNeedingComments.map((p) => ({ url: p.url })),
          limit_per_input: jobState.commentsLimit,
        },
      });

      const nextState = {
        ...jobState,
        snapshotId: commentsSnapshotId,
        phase: "comments",
        phase1PostsRaw: downloadedItems.slice(0, jobState.postsLimit + 10),
      };

      await cacheService.set(JOB_STATE_NAMESPACE, commentsSnapshotId, nextState, {
        ttlMs: JOB_STATE_TTL_MS,
      });

      return {
        status: "running",
        phase: "comments",
        snapshotId: commentsSnapshotId,
        nextSnapshotId: commentsSnapshotId,
        postsColetados: validPosts.length,
        progress: {
          status: "collecting_comments",
          records: validPosts.length,
        },
      };
    }
  }

  // Concluído (Fase única ou Fase 2 comentários finalizada)
  const postsRaw = jobState.phase === "comments" ? (jobState.phase1PostsRaw || []) : downloadedItems;
  const commentsRaw = jobState.phase === "comments" ? downloadedItems : [];

  const relatorio = normalizarEAuditarRelatorioSocial(postsRaw, commentsRaw, {
    plataforma: jobState.plataforma,
    modo: jobState.modo,
    alvo: jobState.alvoLabel,
    alvoUrl: jobState.alvoUrl,
    handle: jobState.handle,
    palavrasChave: jobState.palavrasChave,
    postsLimit: jobState.postsLimit,
    commentsLimit: jobState.incluirComentarios ? jobState.commentsLimit : 0,
    discoveryMeta: jobState.discoveryMeta,
  });

  if (jobState.cacheKey) {
    await cacheService.set(CACHE_NAMESPACE, jobState.cacheKey, relatorio, {
      ttlMs: REPORT_CACHE_TTL_MS,
    });
  }

  return {
    status: "ready",
    cached: false,
    phase: "done",
    snapshotId,
    relatorio,
  };
}

function extrairEntidadesDeTexto(texto, bucket) {
  const str = String(texto || "");
  if (!str) return;

  // E-mails
  const emails = str.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
  for (const e of emails) bucket.emails.add(e.toLowerCase());

  // Telefones BR / WhatsApp
  const phones = str.match(/(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)(?:9?\d{4}[-.\s]?\d{4})/g) || [];
  for (const p of phones) {
    const clean = p.replace(/\s+/g, " ").trim();
    const digits = clean.replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 13) {
      bucket.telefones.add(clean);
    }
  }

  // URLs externos
  const urls = str.match(/https?:\/\/[^\s"'<>)\]]+/gi) || [];
  for (const u of urls) {
    if (!/instagram\.com|x\.com|twitter\.com|pbs\.twimg|cdninstagram|fbcdn/i.test(u)) {
      bucket.urlsExternas.add(u.replace(/[.,;!?]+$/, ""));
    }
  }

  // CPF / CNPJ explícito
  const docs = str.match(/(?:\d{3}\.\d{3}\.\d{3}-\d{2}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/g) || [];
  for (const d of docs) bucket.documentos.add(d);
}

function normalizeUrlKey(url) {
  return String(url || "")
    .trim()
    .replace(/^https?:\/\/(www\.)?(twitter\.com|x\.com|instagram\.com)/i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

function matchKeywordsInText(text, keywords) {
  if (!keywords || keywords.length === 0 || !text) return [];
  const folded = normalizeFold(text);
  const hits = [];
  for (const kw of keywords) {
    if (folded.includes(kw.normalized)) {
      hits.push(kw.original);
    }
  }
  return hits;
}

function extractHandleFromProfileUrl(url) {
  if (!url || typeof url !== "string") return "";
  try {
    const parsed = new URL(url.trim());
    const seg = parsed.pathname.replace(/^\/+|\/+$/g, "").split("/")[0] || "";
    if (!seg || ["p", "reel", "reels", "tv", "explore", "stories"].includes(seg.toLowerCase())) {
      return "";
    }
    return seg.replace(/^@/, "").trim();
  } catch {
    return "";
  }
}

function normalizeCommentEntry(raw, postUrlKey, keywords) {
  const rawUser =
    raw.comment_user ||
    raw.user_commenting ||
    raw.commenter_user ||
    raw.commenter_username ||
    raw.owner_username ||
    raw.author_username ||
    raw.username ||
    raw.author ||
    (typeof raw.user === "string" ? raw.user : raw.user?.username || raw.user?.handle) ||
    raw.commenter?.username ||
    raw.owner?.username ||
    extractHandleFromProfileUrl(raw.comment_user_url || raw.user_url || "");

  const usuario = String(rawUser || "").replace(/^@/, "").trim();
  const texto = String(raw.comment_text ?? raw.comment ?? raw.comments ?? raw.text ?? "").trim();
  if (!texto && !usuario) return null;

  const hits = matchKeywordsInText(`${usuario} ${texto}`, keywords);
  return {
    id: raw.comment_id || raw.id || null,
    postUrlKey,
    usuario: usuario || "usuario_oculto_ig",
    usuarioOculto: !usuario,
    usuarioUrl: raw.comment_user_url || raw.user_url || (usuario ? `https://www.instagram.com/${usuario}/` : ""),
    texto,
    likes: Number(raw.likes_number ?? raw.likes ?? 0) || 0,
    respostas: Number(raw.replies_number ?? raw.replies_count ?? 0) || 0,
    data: raw.date_created || raw.comment_date || raw.date_of_comment || raw.timestamp || "",
    matchPalavrasChave: hits,
  };
}

/**
 * Normaliza e consolida payload bruto da Bright Data (Instagram / X) em Dossiê OSINT estruturado.
 */
export function normalizarEAuditarRelatorioSocial(postsRaw = [], commentsRaw = [], meta = {}) {
  const plataforma = meta.plataforma === "x" ? "x" : "instagram";
  const postsLimit = meta.postsLimit || DEFAULT_MAX_POSTS;
  const commentsLimit = meta.commentsLimit ?? DEFAULT_MAX_COMMENTS_PER_POST;
  const keywords = Array.isArray(meta.palavrasChave)
    ? meta.palavrasChave
    : parsearPalavrasChave(meta.palavrasChave || "");

  const errosColeta = [];
  const validPostRows = [];

  for (const row of postsRaw) {
    if (!row || typeof row !== "object") continue;
    if (row.error) {
      errosColeta.push({
        url: row.input?.url || row.url || meta.alvoUrl || "",
        codigo: row.error_code || "SCRAPE_ERROR",
        mensagem: String(row.error),
      });
      continue;
    }
    // Caso tenha vindo do dataset de perfis (nested posts array)
    if (Array.isArray(row.posts) && !row.description && !row.text && !row.post_text) {
      for (const nested of row.posts) {
        validPostRows.push({
          ...nested,
          user_posted: nested.user_posted || row.account || row.id || row.profile_name,
          profile_image_link: nested.profile_image_link || row.profile_image_link,
          followers: nested.followers ?? row.followers,
          following: nested.following ?? row.following,
          biography: nested.biography || row.biography,
          is_verified: nested.is_verified ?? row.is_verified,
        });
      }
    } else {
      validPostRows.push(row);
    }
  }

  // Agrupa comentários externos (gd_ltppn085pokosxh13) por postUrlKey
  const commentsByPostKey = new Map();
  for (const cRow of commentsRaw) {
    if (!cRow || typeof cRow !== "object" || cRow.error) continue;
    const pUrl = cRow.url || cRow.post_url || "";
    const pKey = normalizeUrlKey(pUrl);
    if (!pKey) continue;
    const normComment = normalizeCommentEntry(cRow, pKey, keywords);
    if (!normComment) continue;
    if (!commentsByPostKey.has(pKey)) commentsByPostKey.set(pKey, []);
    commentsByPostKey.get(pKey).push(normComment);
  }

  const entidades = {
    emails: new Set(),
    telefones: new Set(),
    urlsExternas: new Set(),
    documentos: new Set(),
  };

  const hashtagsCount = new Map();
  const mencoesCount = new Map();
  const commenterStats = new Map();
  const horasDistribuicao = {};
  const keywordMatches = [];

  let perfilHeader = {
    handle: meta.handle || "",
    nome: "",
    url: meta.alvoUrl || "",
    bio: "",
    fotoUrl: "",
    verificado: false,
    tipoVerificacao: "",
    seguidores: null,
    seguindo: null,
    totalPostsPerfil: null,
    userId: "",
  };

  const normalizedPosts = validPostRows.slice(0, postsLimit).map((p, idx) => {
    const postUrl = p.url || "";
    const postUrlKey = normalizeUrlKey(postUrl);
    const authorHandle = String(p.user_posted || p.username || meta.handle || "").replace(/^@/, "").trim();
    const caption = String(p.description ?? p.text ?? p.post_text ?? p.caption ?? "").trim();

    if (idx === 0 || (!perfilHeader.seguidores && p.followers)) {
      perfilHeader = {
        handle: perfilHeader.handle || authorHandle,
        nome: perfilHeader.nome || p.name || p.profile_name || authorHandle,
        url: perfilHeader.url || p.profile_url || (authorHandle
          ? (plataforma === "x" ? `https://x.com/${authorHandle}` : `https://www.instagram.com/${authorHandle}/`)
          : ""),
        bio: perfilHeader.bio || p.biography || "",
        fotoUrl: perfilHeader.fotoUrl || p.profile_image_link || "",
        verificado: Boolean(perfilHeader.verificado || p.is_verified || p.verification_type),
        tipoVerificacao: perfilHeader.tipoVerificacao || p.verification_type || "",
        seguidores: p.followers ?? perfilHeader.seguidores,
        seguindo: p.following ?? perfilHeader.seguindo,
        totalPostsPerfil: p.posts_count ?? perfilHeader.totalPostsPerfil,
        userId: p.user_posted_id || p.user_id || perfilHeader.userId || "",
      };
      extrairEntidadesDeTexto(perfilHeader.bio, entidades);
    }

    extrairEntidadesDeTexto(caption, entidades);

    // Hashtags do post
    const postHashtags = new Set();
    if (Array.isArray(p.hashtags)) {
      for (const h of p.hashtags) {
        const clean = String(h || "").replace(/^#/, "").trim().toLowerCase();
        if (clean) postHashtags.add(clean);
      }
    }
    const inlineTags = caption.match(/#([A-Za-z0-9_À-ÿ]+)/g) || [];
    for (const t of inlineTags) {
      postHashtags.add(t.slice(1).toLowerCase());
    }
    for (const ht of postHashtags) {
      hashtagsCount.set(ht, (hashtagsCount.get(ht) || 0) + 1);
    }

    // Menções do post
    const postMencoes = new Set();
    if (Array.isArray(p.tagged_users)) {
      for (const u of p.tagged_users) {
        const handle = typeof u === "string" ? u : (u?.username || u?.handle || "");
        const clean = String(handle).replace(/^@/, "").trim().toLowerCase();
        if (clean) postMencoes.add(clean);
      }
    }
    const inlineMentions = caption.match(/@([A-Za-z0-9_.]+)/g) || [];
    for (const m of inlineMentions) {
      postMencoes.add(m.slice(1).toLowerCase());
    }
    for (const mc of postMencoes) {
      mencoesCount.set(mc, (mencoesCount.get(mc) || 0) + 1);
    }

    // Distribuição horária
    const dataPost = p.date_posted || p.timestamp || p.created_at || "";
    if (dataPost) {
      const dt = new Date(dataPost);
      if (!Number.isNaN(dt.getTime())) {
        const hora = String(dt.getUTCHours()).padStart(2, "0") + ":00 UTC";
        horasDistribuicao[hora] = (horasDistribuicao[hora] || 0) + 1;
      }
    }

    // Combina comentários da fase 2 + latest_comments / replies_data embutidos (sem duplicar e respeitando trava)
    const rawCombinedComments = [];
    const seenComments = new Set();

    const addCommentSafe = (cObj) => {
      if (!cObj || rawCombinedComments.length >= commentsLimit) return;
      const key = cObj.id
        ? `id:${cObj.id}`
        : `${cObj.usuario.toLowerCase()}::${cObj.texto.slice(0, 80).toLowerCase()}`;
      if (seenComments.has(key)) return;
      seenComments.add(key);
      rawCombinedComments.push(cObj);
    };

    const externalComments = commentsByPostKey.get(postUrlKey) || [];
    for (const c of externalComments) addCommentSafe(c);

    const embeddedComments = Array.isArray(p.latest_comments)
      ? p.latest_comments
      : (Array.isArray(p.replies_data) ? p.replies_data : []);
    for (const ec of embeddedComments) {
      const norm = normalizeCommentEntry(ec, postUrlKey, keywords);
      if (norm) addCommentSafe(norm);
    }

    // Analisa entidades, ranking de comentaristas e palavras-chave nos comentários coletados
    for (const cm of rawCombinedComments) {
      extrairEntidadesDeTexto(cm.texto, entidades);
      const userKey = cm.usuario.toLowerCase();
      if (!cm.usuarioOculto && userKey && userKey !== "usuario_oculto_ig" && userKey !== "usuario_anonimo") {
        const prev = commenterStats.get(userKey) || {
          usuario: cm.usuario,
          url: cm.usuarioUrl,
          totalComentarios: 0,
          totalLikes: 0,
          postsComInteracao: new Set(),
          matchPalavraChave: false,
        };
        prev.totalComentarios += 1;
        prev.totalLikes += cm.likes || 0;
        prev.postsComInteracao.add(postUrl || String(idx));
        if (cm.matchPalavrasChave.length > 0) prev.matchPalavraChave = true;
        commenterStats.set(userKey, prev);
      }

      if (cm.matchPalavrasChave.length > 0) {
        keywordMatches.push({
          origem: "comentario",
          autor: `@${cm.usuario}`,
          postUrl,
          postResumo: caption.slice(0, 90),
          texto: cm.texto,
          data: cm.data,
          palavrasEncontradas: cm.matchPalavrasChave,
        });
      }
    }

    const postHits = matchKeywordsInText(
      `${caption} ${Array.from(postHashtags).map((h) => "#" + h).join(" ")}`,
      keywords
    );
    if (postHits.length > 0) {
      keywordMatches.push({
        origem: "post",
        autor: authorHandle ? `@${authorHandle}` : "@perfil",
        postUrl,
        postResumo: caption.slice(0, 140),
        texto: caption,
        data: dataPost,
        palavrasEncontradas: postHits,
      });
    }

    const midias = [];
    const pushMidia = (url, tipo = "image") => {
      if (typeof url === "string" && url.startsWith("http") && !midias.some((x) => x.url === url)) {
        midias.push({ url, tipo });
      }
    };
    pushMidia(p.thumbnail, "image");
    pushMidia(p.display_url, "image");
    pushMidia(p.image_url, "image");
    for (const img of Array.isArray(p.photos) ? p.photos : []) pushMidia(img?.url || img?.image_url || img, "image");
    for (const img of Array.isArray(p.images) ? p.images : []) pushMidia(img?.url || img?.image_url || img, "image");
    for (const att of Array.isArray(p.attachments) ? p.attachments : []) {
      const attTipo = String(att?.type || "").toLowerCase().includes("video") ? "video" : "image";
      pushMidia(att?.url || att?.image_url || att, attTipo);
    }
    for (const car of Array.isArray(p.carousel_media) ? p.carousel_media : []) {
      pushMidia(car?.image_url || car?.display_url || car?.url || car, "image");
    }
    for (const med of Array.isArray(p.media) ? p.media : []) {
      const mTipo = String(med?.type || "").toLowerCase().includes("video") ? "video" : "image";
      pushMidia(med?.url || med?.image_url || med, mTipo);
    }
    for (const item of Array.isArray(p.post_content) ? p.post_content : []) {
      const cTipo = String(item?.type || "").toLowerCase().includes("video") ? "video" : "image";
      pushMidia(item?.url || item?.thumbnail_url, cTipo);
    }
    for (const img of Array.isArray(p.external_image_urls) ? p.external_image_urls : []) pushMidia(img, "image");
    for (const vid of Array.isArray(p.videos) ? p.videos : []) pushMidia(vid?.url || vid, "video");
    for (const vid of Array.isArray(p.external_video_urls) ? p.external_video_urls : []) pushMidia(vid, "video");

    return {
      indice: idx + 1,
      id: p.post_id || p.id || p.shortcode || `post_${idx + 1}`,
      shortcode: p.shortcode || "",
      url: postUrl,
      autor: authorHandle,
      tipo: p.content_type || (p.is_repost ? "Repost" : (midias.some((m) => m.tipo === "video") ? "Vídeo/Reel" : "Post")),
      isRepost: Boolean(p.is_repost),
      texto: caption,
      dataPublicacao: dataPost,
      localizacao: p.location || "",
      likes: Number(p.likes ?? 0) || 0,
      numComentariosDeclarado: Number(p.num_comments ?? p.replies ?? rawCombinedComments.length) || 0,
      compartilhamentos: Number(p.reposts ?? p.retweets ?? p.quotes ?? p.shares ?? 0) || 0,
      visualizacoes: p.views !== undefined && p.views !== null ? Number(p.views) : null,
      hashtags: Array.from(postHashtags),
      mencoes: Array.from(postMencoes),
      midias: midias.slice(0, 6),
      matchPalavrasChave: postHits,
      comentariosColetados: rawCombinedComments,
    };
  });

  const totalPosts = normalizedPosts.length;
  const totalComentariosColetados = normalizedPosts.reduce((acc, p) => acc + p.comentariosColetados.length, 0);
  const totalLikes = normalizedPosts.reduce((acc, p) => acc + (p.likes || 0), 0);
  const totalCompartilhamentos = normalizedPosts.reduce((acc, p) => acc + (p.compartilhamentos || 0), 0);
  const engajamentoMedio = totalPosts > 0
    ? Math.round((totalLikes + totalComentariosColetados + totalCompartilhamentos) / totalPosts)
    : 0;

  const topComentaristas = Array.from(commenterStats.values())
    .map((c) => ({
      usuario: c.usuario,
      url: c.url,
      totalComentarios: c.totalComentarios,
      postsDistintos: c.postsComInteracao.size,
      totalLikes: c.totalLikes,
      matchPalavraChave: c.matchPalavraChave,
    }))
    .sort((a, b) => b.totalComentarios - a.totalComentarios || b.totalLikes - a.totalLikes)
    .slice(0, 15);

  const hashtagsFrequentes = Array.from(hashtagsCount.entries())
    .map(([tag, count]) => ({ tag: `#${tag}`, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const mencoesFrequentes = Array.from(mencoesCount.entries())
    .map(([handle, count]) => ({ handle: `@${handle}`, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const horariosAtividade = Object.entries(horasDistribuicao)
    .map(([faixa, count]) => ({ faixa, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    provedor: "Bright Data Web Scraper API v3",
    coletadoEm: new Date().toISOString(),
    expiracaoMidiaAviso:
      plataforma === "instagram"
        ? "URLs diretas de imagem/vídeo do Instagram expiram aproximadamente 24 horas após a coleta; utilize o PDF/HTML se precisar arquivar evidências."
        : null,
    parametros: {
      plataforma,
      modo: meta.modo || "perfil",
      alvo: meta.alvo || perfilHeader.handle || "",
      palavrasChave: keywords.map((k) => k.original),
      maxPosts: postsLimit,
      maxCommentsPerPost: commentsLimit,
      discoveryMeta: meta.discoveryMeta || null,
    },
    perfil: perfilHeader,
    metricas: {
      totalPosts,
      totalComentariosColetados,
      totalLikes,
      totalCompartilhamentos,
      engajamentoMedioPorPost: engajamentoMedio,
      totalOcorrenciasPalavraChave: keywordMatches.length,
    },
    inteligenciaOsint: {
      palavrasChaveResultados: keywordMatches,
      topComentaristas,
      hashtagsFrequentes,
      mencoesFrequentes,
      horariosAtividade,
      entidadesExtraidas: {
        emails: Array.from(entidades.emails),
        telefones: Array.from(entidades.telefones),
        urlsExternas: Array.from(entidades.urlsExternas).slice(0, 25),
        documentos: Array.from(entidades.documentos),
      },
    },
    posts: normalizedPosts,
    errosColeta,
  };
}

const ALLOWED_MEDIA_HOST_RE = /(?:^|\.)(cdninstagram\.com|fbcdn\.net|instagram\.com|twimg\.com)$/i;
const MAX_PROXY_IMAGE_BYTES = 8 * 1024 * 1024;

export function isAllowedSocialMediaUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return false;
  try {
    const u = new URL(rawUrl.trim());
    if (u.protocol !== "https:") return false;
    return ALLOWED_MEDIA_HOST_RE.test(u.hostname);
  } catch {
    return false;
  }
}

/**
 * Proxy seguro (allowlist Instagram & X CDNs) para servir imagens sem bloqueio CORP/CORS na UI e PDF.
 */
export async function baixarMidiaSocialPermitida(rawUrl) {
  if (!isAllowedSocialMediaUrl(rawUrl)) {
    const err = new Error("Host de mídia não permitido.");
    err.statusCode = 400;
    throw err;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const resp = await fetch(rawUrl.trim(), {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36",
        Accept: "image/*,*/*;q=0.8",
      },
    });
    clearTimeout(timer);

    if (!resp.ok || !isAllowedSocialMediaUrl(resp.url || rawUrl)) {
      const err = new Error(`Falha ao obter mídia (${resp.status}).`);
      err.statusCode = resp.status === 404 || resp.status === 403 || resp.status === 410 ? resp.status : 502;
      throw err;
    }

    const contentType = String(resp.headers.get("content-type") || "image/jpeg").split(";")[0].trim().toLowerCase();
    if (!contentType.startsWith("image/")) {
      const err = new Error("Recurso remoto não é uma imagem válida.");
      err.statusCode = 415;
      throw err;
    }

    const len = Number(resp.headers.get("content-length") || 0);
    if (len > MAX_PROXY_IMAGE_BYTES) {
      const err = new Error("Imagem excede o limite máximo de 8MB.");
      err.statusCode = 413;
      throw err;
    }

    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length > MAX_PROXY_IMAGE_BYTES) {
      const err = new Error("Imagem excede o limite máximo de 8MB.");
      err.statusCode = 413;
      throw err;
    }

    return { contentType, buffer: buf };
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}
