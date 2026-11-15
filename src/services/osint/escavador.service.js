/**
 * ==============================================================================
 * RIMUBUSCA - MÓDULO DE INTELIGÊNCIA PROCESSUAL & ESCAVADOR (ESCAVADOR.SERVICE.JS)
 * Extração pura em JavaScript (Node.js 18+ nativo) sem dependência de Python,
 * permitindo execução instantânea e 100% compatível com a Vercel e Serverless.
 * ==============================================================================
 */

const HEADERS_PADRAO = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
};

/**
 * Cria slug compatível para URL direta do Escavador
 * @param {string} termo
 * @returns {string}
 */
function slugificar(termo) {
  return String(termo || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Decodifica Base64 URL-safe do Bing Search
 */
function decodificarBingBase64(uParam) {
  try {
    let raw = uParam.startsWith("a1") ? uParam.slice(2) : uParam;
    while (raw.length % 4 !== 0) {
      raw += "=";
    }
    const buf = Buffer.from(raw, "base64");
    return buf.toString("utf-8");
  } catch {
    return null;
  }
}

/**
 * Desescapa entidades HTML básicas
 */
function unescapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .trim();
}

/**
 * Remove tags HTML e formata espaços
 */
function stripTags(htmlStr) {
  if (!htmlStr) return "";
  return unescapeHtml(htmlStr.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

export class EscavadorService {
  /**
   * Resolve a URL do perfil público do Escavador (via busca ou padrão de slug)
   * @param {string} termo
   * @returns {Promise<string|null>}
   */
  async resolverUrlEscavador(termo) {
    const termoStr = String(termo || "").trim();
    if (!termoStr) return null;

    // 1. Se já for a URL completa do Escavador
    if (termoStr.includes("escavador.com/nomes/")) {
      const m = termoStr.match(/https?:\/\/(?:www\.)?escavador\.com\/nomes\/([a-zA-Z0-9_\-]+)/);
      if (m) return `https://www.escavador.com/nomes/${m[1]}`;
    }

    if (termoStr.includes("escavador.com/processos/")) {
      return termoStr.startsWith("http") ? termoStr : `https://${termoStr}`;
    }

    // 2. Tenta resolução dinâmica via Bing Search
    const queries = [
      `site:escavador.com/nomes "${termoStr}"`,
      `escavador "${termoStr}"`,
    ];

    for (const q of queries) {
      try {
        const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(q)}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 7000);

        const resp = await fetch(bingUrl, {
          headers: HEADERS_PADRAO,
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (resp.ok) {
          const htmlText = await resp.text();
          const matches = [...htmlText.matchAll(/\/ck\/a\?[^"]*u=([a-zA-Z0-9_\-]+)/g)];

          for (const m of matches) {
            const decoded = decodificarBingBase64(m[1]);
            if (decoded && decoded.includes("escavador.com/nomes/")) {
              return decoded;
            }
          }

          // Busca por hrefs diretos no html
          const hrefDirect = htmlText.match(/https?:\/\/(?:www\.)?escavador\.com\/nomes\/[a-zA-Z0-9_\-]+/i);
          if (hrefDirect) {
            return hrefDirect[0];
          }
        }
      } catch {
        // Continua
      }
    }

    // 3. Fallback determinístico baseado no slug do nome
    const slug = slugificar(termoStr);
    if (slug) {
      return `https://www.escavador.com/nomes/${slug}`;
    }

    return null;
  }

  /**
   * Extrai dados de perfil público do Escavador
   * @param {string} urlOuTermo
   * @returns {Promise<Object>}
   */
  async coletarPerfilEscavador(urlOuTermo) {
    const url = await this.resolverUrlEscavador(urlOuTermo);
    if (!url) {
      return {
        sucesso: false,
        encontrado: false,
        mensagem: `Nenhum perfil público localizado no Escavador para '${urlOuTermo}'.`,
        alvo: urlOuTermo,
      };
    }

    let pageHtml = "";
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const resp = await fetch(url, {
        headers: HEADERS_PADRAO,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        return {
          sucesso: false,
          encontrado: false,
          mensagem: `Servidor do Escavador retornou status HTTP ${resp.status}.`,
          url,
          alvo: urlOuTermo,
        };
      }

      pageHtml = await resp.text();
    } catch (err) {
      return {
        sucesso: false,
        encontrado: false,
        mensagem: `Falha ao conectar aos servidores do Escavador: ${err.message}`,
        url,
        alvo: urlOuTermo,
      };
    }

    // 1. Parsing do JSON-LD Estruturado
    let personData = {};
    let itemList = {};
    const ldMatches = [...pageHtml.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];

    for (const match of ldMatches) {
      try {
        const parsed = JSON.parse(match[1]);
        const graph = parsed["@graph"] || (Array.isArray(parsed) ? parsed : [parsed]);

        for (const g of graph) {
          const type = g["@type"];
          if (type === "Person") personData = g;
          if (type === "ItemList") itemList = g;
        }
      } catch {
        // Ignora JSON malformado
      }
    }

    // 2. Resumo descritivo
    let resumoLimpo = "";
    const mResumo = pageHtml.match(/O nome [^<"]+ aparece em \d+ processos[^<"]+/i);
    if (mResumo) {
      resumoLimpo = unescapeHtml(mResumo[0]);
    } else if (personData.description) {
      resumoLimpo = personData.description;
    }

    // 3. Polos e Atuação
    const polos = [];
    const mAdv = pageHtml.match(/Advogado[\s\S]{1,300}?(\d{1,3})%/i);
    if (mAdv && parseInt(mAdv[1], 10) <= 100) {
      polos.push({ papel: "Advogado", percentual: parseInt(mAdv[1], 10) });
    }

    const mAtivo = pageHtml.match(/Polo\s+ativo[\s\S]{1,300}?(\d{1,3})%/i);
    if (mAtivo && parseInt(mAtivo[1], 10) <= 100) {
      polos.push({ papel: "Polo Ativo", percentual: parseInt(mAtivo[1], 10) });
    }

    const mPassivo = pageHtml.match(/Polo\s+passivo[\s\S]{1,300}?(\d{1,3})%/i);
    if (mPassivo && parseInt(mPassivo[1], 10) <= 100) {
      polos.push({ papel: "Polo Passivo", percentual: parseInt(mPassivo[1], 10) });
    }

    // 4. Processos do perfil
    const processos = [];
    if (itemList.itemListElement && Array.isArray(itemList.itemListElement)) {
      for (const el of itemList.itemListElement) {
        const item = el.item || {};
        const valCnj = item.identifier?.value || item.identifier || null;
        processos.push({
          titulo: item.name || "Processo Judicial",
          cnj: valCnj,
          url: item.url || null,
          status: "Ativo",
          origem: "Diário de Justiça",
          instancia: "1º Grau",
          papel: "Parte Envolvida",
          envolvidos: [],
          detalhesCarregados: false,
        });
      }
    }

    // Regex fallback para cards de processo no HTML caso itemList não possua itens
    if (processos.length === 0) {
      const procMatches = [...pageHtml.matchAll(/href=["'](\/processos-judiciais\/[^"']+)["']/gi)];
      const urlsVistas = new Set();

      for (const m of procMatches) {
        const relUrl = m[1];
        if (urlsVistas.has(relUrl)) continue;
        urlsVistas.add(relUrl);

        const fullUrl = `https://www.escavador.com${relUrl}`;
        processos.push({
          titulo: "Processo Judicial Indexado",
          cnj: null,
          url: fullUrl,
          status: "Ativo",
          origem: "Diário Oficial",
          instancia: "1º Grau",
          papel: "Parte / Advogado",
          envolvidos: [],
          detalhesCarregados: false,
        });

        if (processos.length >= 10) break;
      }
    }

    // 5. Distribuição Geográfica (Estados)
    const estados = [];
    const descStr = personData.description || "";
    const mEstados = [...descStr.matchAll(/([A-Za-zÀ-ÿ\s]+)\((\d+)\)/g)];
    for (const m of mEstados) {
      const cleanEst = m[1]
        .replace(/^(?:Com\s+os\s+seus\s+processos\s+concetrados\s+em|e)\s+/i, "")
        .trim();
      if (cleanEst) {
        estados.push({ estado: cleanEst, total: parseInt(m[2], 10) });
      }
    }

    // Total de Processos
    let totalProcessos = itemList.numberOfItems;
    if (!totalProcessos) {
      const mProcCount = pageHtml.match(/Processos[\s\n\r]*(\d[\d\.]*)/i);
      if (mProcCount) {
        totalProcessos = parseInt(mProcCount[1].replace(/\./g, ""), 10);
      } else {
        totalProcessos = processos.length;
      }
    }

    // 6. Principais Assuntos
    const assuntos = [];
    const mAssuntos = [...pageHtml.matchAll(/class=["'][^"']*tag[^"']*["'][^>]*>([^<]+)<\//gi)];
    for (const a of mAssuntos) {
      const txt = stripTags(a[1]);
      if (txt && txt.length < 50) assuntos.push(txt);
    }

    return {
      sucesso: true,
      encontrado: true,
      nome: personData.name || unescapeHtml(urlOuTermo),
      url,
      totalProcessos: totalProcessos || 0,
      descricaoGeral: personData.description || null,
      resumo: resumoLimpo,
      pessoaMaisRepresentada: null,
      polosAtuacao: polos,
      assuntos: [...new Set(assuntos)].slice(0, 8),
      estados,
      processosRecentes: processos.slice(0, 15),
      fonte: "Escavador (Perfil Público Oficial & Diários Oficiais)",
    };
  }

  /**
   * Extrai detalhes de um processo judicial específico
   * @param {string} urlProcesso
   * @returns {Promise<Object>}
   */
  async coletarDetalhesProcesso(urlProcesso) {
    let urlLimpa = String(urlProcesso || "").trim();
    if (!urlLimpa.startsWith("http")) {
      urlLimpa = `https://www.escavador.com${urlLimpa}`;
    }

    let pageHtml = "";
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const resp = await fetch(urlLimpa, {
        headers: HEADERS_PADRAO,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        return {
          sucesso: false,
          url: urlLimpa,
          error: `HTTP ${resp.status} ao carregar processo.`,
        };
      }

      pageHtml = await resp.text();
    } catch (err) {
      return {
        sucesso: false,
        url: urlLimpa,
        error: `Falha ao carregar processo: ${err.message}`,
      };
    }

    // Parsing do JSON-LD
    let creativeWork = {};
    let itemMovs = [];
    const ldMatches = [...pageHtml.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];

    for (const match of ldMatches) {
      try {
        const parsed = JSON.parse(match[1]);
        const graph = parsed["@graph"] || (Array.isArray(parsed) ? parsed : [parsed]);
        for (const g of graph) {
          if (g["@type"] === "CreativeWork") creativeWork = g;
          if (g["@type"] === "ItemList") itemMovs = g.itemListElement || [];
        }
      } catch {
        // Ignora
      }
    }

    // Texto da publicação integral
    let textoPub = "";
    let nomeMov = "Andamento Processual";
    let dataMov = null;

    if (itemMovs.length > 0) {
      const primeiroItem = itemMovs[0].item || {};
      textoPub = primeiroItem.description || "";
      nomeMov = primeiroItem.name || "Publicação em Diário Oficial";
      dataMov = primeiroItem.startTime || null;
    }

    // 1. Identificação do CNJ Real (Desmascarado na Publicação)
    const mCnjReal = textoPub.match(/PROCESSO Nº\s*(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/i);
    const cnjDesmascarado = mCnjReal ? mCnjReal[1] : null;
    const cnjOriginal = creativeWork.identifier?.value || null;

    // 2. Classe
    const mClasse = textoPub.match(
      /((?:MEDIDAS PROTETIVAS|PROCEDIMENTO|AÇÃO|CUMPRIMENTO DE SENTENÇA|EXECUÇÃO|EMBARGOS|MANDADO DE SEGURANÇA|NOTIFICAÇÃO|INQUÉRITO|ALIMENTOS)[^:\n\r]+?)(?=\s*(?:INTERESSAD[OA]|REQUERENTE|AUTOR|EXEQUENTE|REQUERIDO|RÉU|EXECUTADO|DECISÃO|DESPACHO|$))/i
    );
    const classeStr = mClasse ? mClasse[1].trim() : "Procedimento Judicial";

    // 3. Partes Envolvidas
    const mAutor = textoPub.match(/(?:REQUERENTE|AUTOR|EXEQUENTE|INTERESSAD[OA]):\s*([^:\n\r]+?)(?=\s*(?:REQUERIDO|RÉU|EXECUTADO|ADVOGAD|DECISÃO|DESPACHO|JUIZ|$))/i);
    const mReu = textoPub.match(/(?:REQUERIDO|RÉU|EXECUTADO):\s*([^:\n\r]+?)(?=\s*(?:REQUERENTE|AUTOR|ADVOGAD|DECISÃO|DESPACHO|JUIZ|$))/i);
    const mAdv = textoPub.match(/Advogad[oa][^:\n\r]*:\s*([^:\n\r]+?)(?=\s*(?:REQUERIDO|REQUERENTE|DECISÃO|DESPACHO|JUIZ|$))/i);
    const mJuiz = textoPub.match(/([A-ZÀ-ÿ\s]+)\s+JUIZ[A]? DE DIREITO/i);

    // 4. Localização
    const loc = creativeWork.locationCreated || {};
    const forumNome = loc.name || null;
    const cidade = loc.address?.addressLocality || null;
    const uf = loc.address?.addressRegion || null;
    const tribunalSigla = creativeWork.sourceOrganization?.alternateName || "TJ";

    return {
      sucesso: true,
      numeroCnj: cnjDesmascarado || cnjOriginal,
      numeroOriginal: cnjOriginal,
      desmascarado: Boolean(cnjDesmascarado),
      tribunal: tribunalSigla,
      forum: forumNome,
      vara: null,
      comarca: cidade ? `${cidade}/${uf || ""}` : uf,
      cidade,
      uf,
      classe: classeStr,
      dataCriacao: creativeWork.dateCreated || null,
      dataModificacao: creativeWork.dateModified || null,
      partes: {
        poloAtivo: mAutor ? mAutor[1].trim() : null,
        poloPassivo: mReu ? mReu[1].trim() : null,
        advogados: mAdv ? [mAdv[1].trim()] : [],
        magistrado: mJuiz ? mJuiz[1].trim() : null,
      },
      ultimaMovimentacao: {
        tipo: nomeMov,
        data: dataMov,
        textoIntegral: textoPub.trim() || null,
      },
      url: urlLimpa,
    };
  }
}

export const escavadorService = new EscavadorService();
