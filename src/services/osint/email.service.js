import dns from "dns/promises";
import crypto from "crypto";
import { checkEmail } from "../../lib/diablinda/index.js";
import { investigateGoogle } from "rimuhunt";

/**
 * ==============================================================================
 * RIMUBUSCA - MÓDULO OSINT DE E-MAIL (EMAIL.SERVICE.JS)
 * Reconhecimento técnico e investigativo sem vazamento de senhas/credenciais.
 * Integração 100% nativa em Node.js ESM puro (zero Python, zero subprocessos):
 * 1. DNS Engine Nativo: Validação técnica, DNS, MX, SPF, DMARC e infraestrutura.
 * 2. Diablinda: Descoberta de contas registradas em 55+ serviços com metadados e SVG.
 * 3. rimuhunt: Inteligência e metadados para contas do ecossistema Google (Gaia ID, Avatar HD).
 * ==============================================================================
 */

// Provedores descartáveis conhecidos
const DISPOSABLE_DOMAINS = new Set([
  "10minutemail.com", "10minutemail.net", "mailinator.com", "guerrillamail.com",
  "guerrillamail.net", "tempmail.com", "temp-mail.org", "trashmail.com",
  "yopmail.com", "getnada.com", "mohmal.com", "sharklasers.com",
  "dispostable.com", "throwawaymail.com", "fakeinbox.com", "burnermail.io",
  "generator.email", "tempail.com", "inboxkitten.com", "crazymailing.com",
]);

// Provedores gratuitos públicos
const FREE_EMAIL_PROVIDERS = new Set([
  "gmail.com", "googlemail.com", "hotmail.com", "outlook.com", "live.com",
  "yahoo.com", "yahoo.com.br", "icloud.com", "me.com", "proton.me",
  "protonmail.com", "zoho.com", "bol.com.br", "uol.com.br", "terra.com.br",
  "globo.com", "ig.com.br", "mail.com", "gmx.com", "aol.com",
]);

/**
 * Motor Principal de Investigação OSINT de E-mail
 * @param {string} email
 * @returns {Promise<Object>}
 */
export async function investigarEmail(email) {
  const emailLimpo = email.trim().toLowerCase();
  const [usuario, dominio] = emailLimpo.split("@");

  if (!usuario || !dominio || !dominio.includes(".")) {
    throw new Error("Formato de e-mail inválido.");
  }

  // Hashes criptográficos
  const emailHashMd5 = crypto.createHash("md5").update(emailLimpo).digest("hex");
  const emailHashSha256 = crypto.createHash("sha256").update(emailLimpo).digest("hex");

  // Executa os 3 motores OSINT em paralelo de forma 100% assíncrona
  const [dnsData, diablindaData, rimuhuntData] = await Promise.all([
    executarDnsEngine(dominio),
    executarDiablindaEngine(emailLimpo),
    executarRimuhuntEngine(emailLimpo, usuario, dominio),
  ]);

  // Foto de perfil unificada: prioriza Rimuhunt (Avatar HD original =s0) -> Gravatar
  const gravatarHit = diablindaData?.plataformas?.find(
    (p) => (p.id === "gravatar" || p.nome?.toLowerCase().includes("gravatar")) && p.registrado
  );

  const avatarUrl =
    rimuhuntData?.avatarUrl ||
    (gravatarHit && gravatarHit.metadata?.avatarUrl ? gravatarHit.metadata.avatarUrl : null) ||
    (gravatarHit ? `https://www.gravatar.com/avatar/${emailHashMd5}?s=200` : null);

  // Google Dorks de Reconhecimento
  const dorks = [
    {
      titulo: "Menções em Páginas Web",
      query: `"${emailLimpo}"`,
      url: `https://www.google.com/search?q=${encodeURIComponent(`"${emailLimpo}"`)}`,
    },
    {
      titulo: "Repositórios & Commits GitHub",
      query: `site:github.com "${emailLimpo}"`,
      url: `https://www.google.com/search?q=${encodeURIComponent(`site:github.com "${emailLimpo}"`)}`,
    },
    {
      titulo: "Perfis Profissionais (LinkedIn)",
      query: `site:linkedin.com/in/ "${emailLimpo}"`,
      url: `https://www.google.com/search?q=${encodeURIComponent(`site:linkedin.com/in/ "${emailLimpo}"`)}`,
    },
    {
      titulo: "Documentos Públicos (PDF, DOC, XLS)",
      query: `filetype:pdf OR filetype:doc OR filetype:xlsx "${emailLimpo}"`,
      url: `https://www.google.com/search?q=${encodeURIComponent(`filetype:pdf OR filetype:doc OR filetype:xlsx "${emailLimpo}"`)}`,
    },
    {
      titulo: "Grupos e Comunidades Telegram",
      query: `site:t.me "${usuario}"`,
      url: `https://www.google.com/search?q=${encodeURIComponent(`site:t.me "${usuario}"`)}`,
    },
  ];

  return {
    email: emailLimpo,
    usuario,
    dominio,
    avatarUrl,
    hashes: {
      md5: emailHashMd5,
      sha256: emailHashSha256,
    },
    mosint: dnsData,
    diablinda: diablindaData,
    holehe: diablindaData, // compatibilidade com views existentes
    rimuhunt: rimuhuntData,
    ghunt: rimuhuntData,   // compatibilidade com views existentes
    dorks,
    timestamp: new Date().toISOString(),
  };
}

/**
 * ==============================================================================
 * MOTOR 1: DNS & INFRAESTRUTURA TÉCNICA (Nativo Node.js)
 * ==============================================================================
 */
async function executarDnsEngine(dominio) {
  const isDescartavel = DISPOSABLE_DOMAINS.has(dominio);
  const isGratuito = FREE_EMAIL_PROVIDERS.has(dominio);
  const isCorporativo = !isGratuito && !isDescartavel;

  let mxRecords = [];
  let mxAtivo = false;
  let spfConfigurado = false;
  let dmarcConfigurado = false;
  let dnsStatus = "sucesso";
  let provedorDetectado = "Desconhecido";

  try {
    const mxList = await dns.resolveMx(dominio);
    mxRecords = mxList.sort((a, b) => a.priority - b.priority);
    mxAtivo = mxRecords.length > 0;

    const exchanges = mxRecords.map((m) => m.exchange.toLowerCase()).join(" ");
    if (exchanges.includes("google") || exchanges.includes("aspmx")) {
      provedorDetectado = "Google Workspace / Gmail";
    } else if (exchanges.includes("outlook") || exchanges.includes("microsoft")) {
      provedorDetectado = "Microsoft 365 / Outlook";
    } else if (exchanges.includes("protonmail") || exchanges.includes("proton")) {
      provedorDetectado = "Proton Mail";
    } else if (exchanges.includes("zoho")) {
      provedorDetectado = "Zoho Mail";
    } else if (mxAtivo) {
      provedorDetectado = `Servidor Próprio (${mxRecords[0].exchange})`;
    }
  } catch (err) {
    dnsStatus = err.code === "ENODATA" || err.code === "ENOTFOUND" ? "dominio_sem_mx" : "falha_dns";
  }

  try {
    const txtRecords = await dns.resolveTxt(dominio);
    const flattenedTxt = txtRecords.flat().join(" ");
    spfConfigurado = flattenedTxt.includes("v=spf1");
  } catch {
    spfConfigurado = false;
  }

  try {
    const dmarcTxt = await dns.resolveTxt(`_dmarc.${dominio}`);
    const flattenedDmarc = dmarcTxt.flat().join(" ");
    dmarcConfigurado = flattenedDmarc.includes("v=DMARC1");
  } catch {
    dmarcConfigurado = false;
  }

  return {
    metodo: "dns_nativo_node",
    valido: mxAtivo,
    tipo: isDescartavel
      ? "Descartável / Temporário"
      : isGratuito
      ? "Público Gratuito"
      : "Corporativo / Privado",
    isDescartavel,
    isGratuito,
    isCorporativo,
    provedorDetectado,
    dns: {
      mxAtivo,
      mxRecords,
      spfConfigurado,
      dmarcConfigurado,
      dnsStatus,
    },
  };
}

/**
 * ==============================================================================
 * MOTOR 2: DIABLINDA (Substituto Turbinado do Holehe em Node.js ESM)
 * ==============================================================================
 */
async function executarDiablindaEngine(email) {
  try {
    const summary = await checkEmail(email, {
      concurrency: 20,
      timeout: 8000,
    });

    const plataformasFormatadas = (summary.results || []).map((p) => {
      let urlPerfil = p.url || null;
      if (p.exists && p.metadata?.username) {
        if (p.id === "github") urlPerfil = `https://github.com/${p.metadata.username}`;
        else if (p.id === "twitter") urlPerfil = `https://twitter.com/${p.metadata.username}`;
        else if (p.id === "instagram") urlPerfil = `https://instagram.com/${p.metadata.username}`;
        else if (p.id === "tiktok") urlPerfil = `https://tiktok.com/@${p.metadata.username}`;
        else if (p.id === "duolingo") urlPerfil = `https://duolingo.com/profile/${p.metadata.username}`;
      }

      return {
        id: p.id,
        nome: p.service,
        categoria: p.category || "tech",
        registrado: Boolean(p.exists),
        rateLimited: Boolean(p.rateLimited),
        icone: p.id || "globe",
        iconSvg: p.iconSvg || null,
        cor: p.color || null,
        urlPerfil,
        metadata: p.metadata || {},
        durationMs: p.durationMs,
      };
    });

    return {
      metodo: "diablinda_native_esm",
      totalVerificados: summary.totalModules || plataformasFormatadas.length,
      totalEncontrados: summary.hits || plataformasFormatadas.filter((x) => x.registrado).length,
      plataformas: plataformasFormatadas,
      dossie: summary.dossier || null,
      duracaoMs: summary.totalDurationMs,
    };
  } catch (err) {
    console.warn("[DIABLINDA ENGINE WARN]:", err.message);
    return {
      metodo: "diablinda_indisponivel",
      totalVerificados: 0,
      totalEncontrados: 0,
      plataformas: [],
      aviso: "Não foi possível executar a checagem Diablinda: " + err.message,
    };
  }
}

/**
 * ==============================================================================
 * MOTOR 3: RIMUHUNT (Substituto Turbinado do GHunt em Node.js ESM)
 * ==============================================================================
 */
async function executarRimuhuntEngine(email, usuario, dominio) {
  const isGoogleDomain =
    dominio === "gmail.com" ||
    dominio === "googlemail.com" ||
    dominio.includes("google");

  try {
    const res = await investigateGoogle(email, {
      timeoutMs: 8000,
    });

    const isGoogleAccount = Boolean(res.gaia?.exists || res.target?.isGmail || res.avatar?.exists);
    const avatarUrl = res.avatar?.originalHdUrl || (res.avatar?.exists && !res.avatar?.isDefault ? res.avatar.originalHdUrl : null);

    const servicosAtivos = (res.gaia?.servicesDetected || []).map((s) => ({
      nome: s,
      descricao: "Identificado na infraestrutura oficial da Conta Google",
      icone: s.toLowerCase().includes("workspace") ? "briefcase" : "mail",
    }));

    if (res.maps?.exists && res.maps.totalReviews > 0) {
      servicosAtivos.push({
        nome: `Google Maps (${res.maps.totalReviews} avaliações)`,
        descricao: res.maps.isRestricted ? "Perfil com avaliações restritas" : "Contribuições públicas no Maps",
        icone: "map-pin",
      });
    }

    if (res.youtube?.exists) {
      servicosAtivos.push({
        nome: `YouTube (${res.youtube.handle || "Canal Ativo"})`,
        descricao: "Canal público identificado",
        icone: "video",
      });
    }

    if (res.calendar?.exists && res.calendar.isPublic) {
      servicosAtivos.push({
        nome: "Google Agenda Pública",
        descricao: "Eventos e disponibilidade expostos publicamente",
        icone: "calendar",
      });
    }

    return {
      metodo: "rimuhunt_native_esm",
      isGoogleAccount,
      ghuntAutenticado: true,
      tipoConta: isGoogleDomain ? "Google Pessoal (Gmail)" : "Google Workspace / Corporativo",
      gaiaId: res.gaia?.gaiaId || null,
      nomeCompleto: res.gaia?.name || null,
      avatarUrl,
      avatarDetails: res.avatar || null,
      calendarPublico: Boolean(res.calendar?.isPublic),
      calendar: res.calendar || null,
      youtube: res.youtube || null,
      maps: res.maps || null,
      servicosAtivos,
      linksDiretos: {
        googleContacts: `https://contacts.google.com/search/${encodeURIComponent(email)}`,
        googleMapsContributions: res.maps?.contributorProfileUrl || `https://www.google.com/maps/search/${encodeURIComponent(email)}`,
        youtubeSearch: res.youtube?.handle ? `https://www.youtube.com/${res.youtube.handle}` : `https://www.youtube.com/results?search_query=${encodeURIComponent(usuario)}`,
        googleCalendar: `https://calendar.google.com/calendar/u/0/embed?src=${encodeURIComponent(email)}`,
      },
      duracaoMs: res.durationMs,
    };
  } catch (err) {
    console.warn("[RIMUHUNT ENGINE WARN]:", err.message);

    if (dominio.includes("outlook") || dominio.includes("yahoo") || dominio.includes("hotmail")) {
      return {
        isGoogleAccount: false,
        mensagem: "O domínio do e-mail não utiliza serviços do ecossistema Google.",
      };
    }

    return {
      isGoogleAccount: isGoogleDomain,
      ghuntAutenticado: false,
      tipoConta: isGoogleDomain ? "Google Pessoal (Gmail)" : "Desconhecido",
      gaiaId: null,
      linksDiretos: {
        googleContacts: `https://contacts.google.com/search/${encodeURIComponent(email)}`,
        googleMapsContributions: `https://www.google.com/maps/search/${encodeURIComponent(email)}`,
        youtubeSearch: `https://www.youtube.com/results?search_query=${encodeURIComponent(usuario)}`,
        googleCalendar: `https://calendar.google.com/calendar/u/0/embed?src=${encodeURIComponent(email)}`,
      },
    };
  }
}
