/**
 * ==============================================================================
 * RIMUBUSCA - SERVIÇO OFICIAL DE CONSULTA DE ENDEREÇO & CEP (CEP.SERVICE.JS)
 * Consulta cadastral de CEP, logradouros, geolocalização e dados geográficos
 * com Tolerância a Falhas Multi-Provider e Contingência Transparente:
 *
 * 1. Hexys API (Quando disponível e com endpoint liberado no plano)
 * 2. BrasilAPI v2 (DNE oficial, coordenadas geográficas, IBGE e bairros)
 * 3. ViaCEP Oficial (Espelho Correios de alta fidelidade e busca por logradouro)
 * 4. OpenCEP (API aberta descentralizada de CEPs)
 * 5. AwesomeAPI CEP (API pública de contingência com lat/lng e DDD)
 * 6. Zeroy API (Módulo cadastral de CEP quando configurada)
 * 7. Nominatim / OpenStreetMap (Geocodificação reversa para busca textual de ruas)
 * ==============================================================================
 */

import { rimuApi } from "./rimuapi.service.js";
import { hexysApi } from "./hexys.service.js";

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 RimuBuscas/1.0";

const HTTP_HEADERS = {
  "User-Agent": BROWSER_USER_AGENT,
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "Cache-Control": "no-cache",
};

/**
 * Tabela de prefixos telefônicos DDD padrão por Estado (UF)
 */
const DDD_POR_UF = {
  AC: "68", AL: "82", AP: "96", AM: "92", BA: "71", CE: "85", DF: "61",
  ES: "27", GO: "62", MA: "98", MT: "65", MS: "67", MG: "31", PA: "91",
  PB: "83", PR: "41", PE: "81", PI: "86", RJ: "21", RN: "84", RS: "51",
  RO: "69", RR: "95", SC: "48", SP: "11", SE: "79", TO: "63",
};

/**
 * Formata CEP de 8 dígitos para 00000-000
 */
export function formatarCep(cep) {
  if (!cep) return "N/I";
  const digits = String(cep).replace(/\D/g, "");
  if (digits.length === 8) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return String(cep).trim() || "N/I";
}

/**
 * Extrai código IBGE com segurança contra [object Object] e nulos
 */
export function extrairCodigoIbge(val) {
  if (val === null || val === undefined || val === "") return "N/I";
  if (typeof val === "number") return String(val);
  if (typeof val === "string") {
    const trimmed = val.trim();
    return trimmed && trimmed !== "[object Object]" && trimmed !== "null" ? trimmed : "N/I";
  }
  if (typeof val === "object") {
    const inner =
      val.codigo ||
      val.codigo_ibge ||
      val.codigoIbge ||
      val.id ||
      val.geocodigo ||
      val.ibge ||
      val.valor;
    if (inner && typeof inner !== "object") return String(inner);
    return "N/I";
  }
  return "N/I";
}

/**
 * Resolve DDD com segurança e fallback por Estado
 */
export function resolverDdd(val, uf) {
  if (val && typeof val === "string") {
    const clean = val.replace(/\D/g, "");
    if (clean && clean !== "0" && clean.length <= 3) return clean;
  }
  if (typeof val === "number" && val > 0) return String(val);
  const ufUpper = String(uf || "").toUpperCase().trim();
  return DDD_POR_UF[ufUpper] || "N/I";
}

/**
 * Normaliza resposta da BrasilAPI (v2 ou v1)
 */
export function normalizarBrasilApiCep(d, rawCep) {
  const digits = String(rawCep || d.cep || "").replace(/\D/g, "");
  const cepFmt = formatarCep(digits);

  const coords = d.location?.coordinates;
  const latitude = coords?.latitude ? parseFloat(coords.latitude) : null;
  const longitude = coords?.longitude ? parseFloat(coords.longitude) : null;

  const ufFinal = (d.state || d.uf || "N/I").toUpperCase().slice(0, 2);
  const ibgeFinal = extrairCodigoIbge(d.ibge || d.city_ibge || d.codigoIbge);
  const dddFinal = resolverDdd(d.ddd, ufFinal);

  return {
    cep: cepFmt,
    cepLimpo: digits,
    logradouro: d.street || d.logradouro || "Não informado",
    complemento: d.complemento || "",
    bairro: d.neighborhood || d.bairro || "Não informado",
    cidade: d.city || d.localidade || d.municipio || "Não informada",
    uf: ufFinal,
    estado: d.state || d.uf || "Não informado",
    ddd: dddFinal,
    codigoIbge: ibgeFinal,
    coordenadas: !isNaN(latitude) && !isNaN(longitude) ? { latitude, longitude } : null,
    totalResidentesEstimados: null,
    moradores: [],
    provedor: "brasilapi",
    fonte: "BrasilAPI v2 / DNE Correios & IBGE",
  };
}

/**
 * Normaliza resposta do ViaCEP
 */
export function normalizarViaCep(d, rawCep) {
  const digits = String(rawCep || d.cep || "").replace(/\D/g, "");
  const cepFmt = formatarCep(digits);
  const ufFinal = (d.uf || "N/I").toUpperCase().slice(0, 2);
  const ibgeFinal = extrairCodigoIbge(d.ibge);
  const dddFinal = resolverDdd(d.ddd, ufFinal);

  return {
    cep: cepFmt,
    cepLimpo: digits,
    logradouro: d.logradouro || "Não informado",
    complemento: d.complemento || "",
    bairro: d.bairro || "Não informado",
    cidade: d.localidade || d.municipio || "Não informada",
    uf: ufFinal,
    estado: d.estado || d.uf || "Não informado",
    regiao: d.regiao || null,
    ddd: dddFinal,
    codigoIbge: ibgeFinal,
    siafi: d.siafi ? String(d.siafi) : null,
    gia: d.gia ? String(d.gia) : null,
    coordenadas: null,
    totalResidentesEstimados: null,
    moradores: [],
    provedor: "viacep",
    fonte: "ViaCEP Oficial / DNE Correios",
  };
}

/**
 * Normaliza resposta do OpenCEP
 */
export function normalizarOpenCep(d, rawCep) {
  const digits = String(rawCep || d.cep || "").replace(/\D/g, "");
  const cepFmt = formatarCep(digits);
  const ufFinal = (d.uf || "N/I").toUpperCase().slice(0, 2);
  const ibgeFinal = extrairCodigoIbge(d.ibge);
  const dddFinal = resolverDdd(d.ddd, ufFinal);

  return {
    cep: cepFmt,
    cepLimpo: digits,
    logradouro: d.logradouro || "Não informado",
    complemento: d.complemento || "",
    bairro: d.bairro || "Não informado",
    cidade: d.localidade || d.cidade || "Não informada",
    uf: ufFinal,
    estado: d.uf || "Não informado",
    ddd: dddFinal,
    codigoIbge: ibgeFinal,
    coordenadas: null,
    totalResidentesEstimados: null,
    moradores: [],
    provedor: "opencep",
    fonte: "OpenCEP / Correios Mirror",
  };
}

/**
 * Normaliza resposta da AwesomeAPI CEP
 */
export function normalizarAwesomeApiCep(d, rawCep) {
  const digits = String(rawCep || d.cep || "").replace(/\D/g, "");
  const cepFmt = formatarCep(digits);

  const latitude = d.lat ? parseFloat(d.lat) : null;
  const longitude = d.lng ? parseFloat(d.lng) : null;
  const ufFinal = (d.state || "N/I").toUpperCase().slice(0, 2);
  const ibgeFinal = extrairCodigoIbge(d.city_ibge);
  const dddFinal = resolverDdd(d.ddd, ufFinal);

  return {
    cep: cepFmt,
    cepLimpo: digits,
    logradouro: d.address || d.address_name || "Não informado",
    complemento: "",
    bairro: d.district || d.bairro || "Não informado",
    cidade: d.city || "Não informada",
    uf: ufFinal,
    estado: d.state || "Não informado",
    ddd: dddFinal,
    codigoIbge: ibgeFinal,
    coordenadas: !isNaN(latitude) && !isNaN(longitude) ? { latitude, longitude } : null,
    totalResidentesEstimados: null,
    moradores: [],
    provedor: "awesomeapi",
    fonte: "AwesomeAPI Geocode & CEP",
  };
}

/**
 * Normaliza resposta da RimuAPI / Hexys caso retorne dados com sucesso
 */
export function normalizarRimuApiCep(d, rawCep) {
  const payload = Array.isArray(d) ? d[0] : d;
  const digits = String(rawCep || payload.cep || payload.CEP || payload.ENDERECO?.CEP || "").replace(/\D/g, "");
  const cepFmt = formatarCep(digits);

  const end = payload.ENDERECO || payload.endereco || payload;
  const logrNome = [end.LOGR_TIPO || end.tipoLogradouro, end.LOGR_NOME || end.logradouro || end.street || end.rua].filter(Boolean).join(" ").trim();

  let moradores = [];
  if (Array.isArray(d)) {
    moradores = d
      .filter((r) => r.DADOS?.CPF || r.DADOS?.NOME || r.CPF || r.NOME)
      .map((r) => {
        const item = r.DADOS || r;
        return {
          cpf: item.CPF || item.cpf,
          nome: item.NOME || item.nome,
          nascimento: item.NASC || item.NASCIMENTO || item.nascimento,
        };
      });
  } else if (Array.isArray(payload.moradores)) {
    moradores = payload.moradores;
  }

  const ufFinal = (end.UF || end.uf || end.estado || "N/I").toUpperCase().slice(0, 2);
  const ibgeFinal = extrairCodigoIbge(end.codigoIbge || end.ibge);
  const dddFinal = resolverDdd(end.ddd, ufFinal);

  return {
    cep: cepFmt,
    cepLimpo: digits,
    logradouro: logrNome || end.logradouro || end.endereco || "Não informado",
    numero: end.LOGR_NUMERO || end.numero || "",
    complemento: end.LOGR_COMPLEMENTO || end.complemento || "",
    bairro: end.BAIRRO || end.bairro || end.neighborhood || "Não informado",
    cidade: end.CIDADE || end.cidade || end.municipio || end.localidade || "Não informada",
    uf: ufFinal,
    estado: end.estado || end.uf || "Não informado",
    ddd: dddFinal,
    codigoIbge: ibgeFinal,
    totalResidentesEstimados: moradores.length || null,
    moradores,
    provedor: "rimuapi",
    fonte: "RimuAPI Intelligence Engine (Live)",
  };
}

export const normalizarHexysCep = normalizarRimuApiCep;

/**
 * Normaliza resposta da Zeroy API
 */
export function normalizarZeroyCep(d, rawCep) {
  const raw = d.resultado || d.dados || d;
  const digits = String(rawCep || raw.cep || "").replace(/\D/g, "");
  const cepFmt = formatarCep(digits);

  const moradores = Array.isArray(raw.moradores)
    ? raw.moradores
    : Array.isArray(raw.residentes)
      ? raw.residentes
      : [];

  const ufFinal = (raw.uf || "N/I").toUpperCase().slice(0, 2);
  const ibgeFinal = extrairCodigoIbge(raw.codigoIbge || raw.ibge);
  const dddFinal = resolverDdd(raw.ddd, ufFinal);

  return {
    cep: cepFmt,
    cepLimpo: digits,
    logradouro: raw.logradouro || raw.endereco || "Não informado",
    complemento: raw.complemento || "",
    bairro: raw.bairro || "Não informado",
    cidade: raw.cidade || raw.municipio || "Não informada",
    uf: ufFinal,
    estado: raw.uf || "Não informado",
    ddd: dddFinal,
    codigoIbge: ibgeFinal,
    totalResidentesEstimados: raw.totalResidentesEstimados || moradores.length || null,
    moradores,
    provedor: "zeroy",
    fonte: "Zeroy OSINT Engine",
  };
}

/**
 * Consulta de Endereço e CEP com tolerância a falhas e cascata multi-provider
 * @param {string} termo - CEP (8 dígitos) ou texto de logradouro/endereço
 * @param {string} [uf] - UF opcional para refino de busca por rua
 * @returns {Promise<Object>} Dados normalizados do endereço/CEP
 */
export async function consultarEnderecoCep(termo, uf = "") {
  const termoLimpo = String(termo || "").trim();
  if (!termoLimpo) {
    throw new Error("Informe um CEP de 8 dígitos ou endereço para consulta.");
  }

  // 1. Tenta extrair CEP de 8 dígitos caso esteja embutido (ex: "01310-200" ou "CEP 01310-200")
  let cleanCep = termoLimpo.replace(/\D/g, "");
  if (cleanCep.length > 8) {
    const cepMatch = termoLimpo.match(/\b(\d{5})[- ]?(\d{3})\b/);
    if (cepMatch) {
      cleanCep = `${cepMatch[1]}${cepMatch[2]}`;
    }
  }

  // ============================================================================
  // CASO A: CONSULTA POR CEP (8 DÍGITOS EXATOS)
  // ============================================================================
  if (cleanCep.length === 8) {
    // Provedor 1: Tenta RimuAPI (Sant Buscas Engine) primeiro (se configurada)
    if (rimuApi.isConfigured() || hexysApi.isConfigured()) {
      try {
        console.log(`[CEP MULTI-PROVIDER] Tentando RimuAPI para CEP ${cleanCep}...`);
        const rimuRes = await (rimuApi.isConfigured() ? rimuApi.cep(cleanCep) : hexysApi.cep(cleanCep));
        if (rimuRes) {
          const payload = Array.isArray(rimuRes) ? rimuRes : (rimuRes.resultado !== undefined ? rimuRes.resultado : rimuRes);
          if (payload) {
            console.log(`[CEP MULTI-PROVIDER] Sucesso via RimuAPI para CEP ${cleanCep}.`);
            return normalizarRimuApiCep(payload, cleanCep);
          }
        }
      } catch (rimuErr) {
        console.warn(
          `[CEP MULTI-PROVIDER] RimuAPI indisponível (HTTP ${rimuErr.status || rimuErr.message}). Alternando automaticamente para contingência multi-provider pública...`
        );
      }
    }

    // Provedor 2: Tenta Zeroy API se configurada (para recuperar moradores quando disponível)
    if (process.env.ZEROY_API_KEY) {
      try {
        const { zeroyService } = await import("./zeroy.service.js");
        if (zeroyService) {
          console.log(`[CEP MULTI-PROVIDER] Tentando Zeroy API para CEP ${cleanCep}...`);
          const zeroyRes = await zeroyService.consultar("cep", cleanCep);
          if (zeroyRes && (zeroyRes.cep || zeroyRes.logradouro || zeroyRes.dados?.logradouro)) {
            console.log(`[CEP MULTI-PROVIDER] Sucesso via Zeroy API para CEP ${cleanCep}.`);
            return normalizarZeroyCep(zeroyRes, cleanCep);
          }
        }
      } catch (zeroyErr) {
        console.warn(`[CEP MULTI-PROVIDER] Zeroy API indisponível (${zeroyErr.message}). Prosseguindo contingência...`);
      }
    }

    // Cascata de Provedores Oficiais Públicos (BrasilAPI, ViaCEP, OpenCEP, AwesomeAPI)
    const publicProviders = [
      {
        name: "BrasilAPI v2",
        url: `https://brasilapi.com.br/api/cep/v2/${cleanCep}`,
        timeoutMs: 6000,
        parser: async (res) => {
          if (res.status === 404) return { notFound: true };
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (data.type === "service_error" || data.name === "CepPromiseError") {
            return { notFound: true };
          }
          return normalizarBrasilApiCep(data, cleanCep);
        },
      },
      {
        name: "ViaCEP Oficial",
        url: `https://viacep.com.br/ws/${cleanCep}/json/`,
        timeoutMs: 6000,
        parser: async (res) => {
          if (res.status === 404) return { notFound: true };
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (data.erro === true || data.erro === "true") {
            return { notFound: true };
          }
          return normalizarViaCep(data, cleanCep);
        },
      },
      {
        name: "BrasilAPI v1 (Fallback)",
        url: `https://brasilapi.com.br/api/cep/v1/${cleanCep}`,
        timeoutMs: 6000,
        parser: async (res) => {
          if (res.status === 404) return { notFound: true };
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          return normalizarBrasilApiCep(data, cleanCep);
        },
      },
      {
        name: "OpenCEP",
        url: `https://opencep.com/v1/${cleanCep}`,
        timeoutMs: 6000,
        parser: async (res) => {
          if (res.status === 404) return { notFound: true };
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (data.error) return { notFound: true };
          return normalizarOpenCep(data, cleanCep);
        },
      },
      {
        name: "AwesomeAPI CEP",
        url: `https://cep.awesomeapi.com.br/json/${cleanCep}`,
        timeoutMs: 6000,
        parser: async (res) => {
          if (res.status === 404) return { notFound: true };
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (data.status === 404) return { notFound: true };
          return normalizarAwesomeApiCep(data, cleanCep);
        },
      },
    ];

    let notFoundCount = 0;
    let lastError = null;

    for (const provider of publicProviders) {
      try {
        console.log(`[CEP MULTI-PROVIDER] Consultando CEP ${cleanCep} via '${provider.name}'...`);
        const ctrl = new AbortController();
        const tm = setTimeout(() => ctrl.abort(), provider.timeoutMs);

        const resp = await fetch(provider.url, {
          headers: HTTP_HEADERS,
          signal: ctrl.signal,
        });
        clearTimeout(tm);

        const parsed = await provider.parser(resp);

        if (parsed?.notFound) {
          console.warn(`[CEP MULTI-PROVIDER] '${provider.name}' informou que o CEP não foi localizado.`);
          notFoundCount++;
          continue;
        }

        if (parsed && (parsed.cep || parsed.logradouro || parsed.cidade)) {
          // Enriquecimento com ViaCEP caso o provedor retorne IBGE nulo ou precise de DDD/SIAFI
          if (parsed.codigoIbge === "N/I" || parsed.ddd === "N/I") {
            try {
              const enrichCtrl = new AbortController();
              const enrichTm = setTimeout(() => enrichCtrl.abort(), 2500);
              const enrichResp = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`, {
                headers: HTTP_HEADERS,
                signal: enrichCtrl.signal,
              });
              clearTimeout(enrichTm);

              if (enrichResp.ok) {
                const viaData = await enrichResp.json();
                if (!viaData.erro) {
                  if (viaData.ibge && parsed.codigoIbge === "N/I") {
                    parsed.codigoIbge = extrairCodigoIbge(viaData.ibge);
                  }
                  if (viaData.ddd && parsed.ddd === "N/I") {
                    parsed.ddd = resolverDdd(viaData.ddd, parsed.uf);
                  }
                  if (viaData.siafi && !parsed.siafi) parsed.siafi = viaData.siafi;
                  if (viaData.gia && !parsed.gia) parsed.gia = viaData.gia;
                  if (viaData.complemento && !parsed.complemento) parsed.complemento = viaData.complemento;
                  if (viaData.regiao && !parsed.regiao) parsed.regiao = viaData.regiao;
                  parsed.fonte = `${parsed.fonte} + ViaCEP`;
                }
              }
            } catch (_) {
              // Enriquecimento opcional
            }
          }

          console.log(`[CEP MULTI-PROVIDER SUCESSO] CEP ${cleanCep} consultado com êxito via '${provider.name}'.`);
          return parsed;
        }
      } catch (err) {
        console.warn(`[CEP MULTI-PROVIDER AVISO] Falha no provedor '${provider.name}': ${err.message}`);
        lastError = err;
      }
    }

    if (notFoundCount > 0) {
      throw new Error(
        `O CEP '${formatarCep(cleanCep)}' não foi encontrado nas bases oficiais dos Correios e IBGE. Verifique o número digitado.`
      );
    }

    throw new Error(
      lastError?.message
        ? `Falha ao consultar o CEP nas bases de endereçamento (${lastError.message}). Tente novamente em instantes.`
        : "Serviço de consulta de CEP temporariamente instável."
    );
  }

  // ============================================================================
  // CASO B: BUSCA TEXTUAL POR LOGRADOURO / ENDEREÇO
  // ============================================================================
  console.log(`[CEP MULTI-PROVIDER] Termo '${termoLimpo}' não possui 8 dígitos. Iniciando busca geográfica textual...`);

  const ufLimpa = String(uf || "").trim().toUpperCase();
  if (ufLimpa.length === 2) {
    const partes = termoLimpo.split(/[,-]/).map((p) => p.trim()).filter(Boolean);
    let cidadeAlvo = "";
    let ruaAlvo = termoLimpo;

    if (partes.length >= 2) {
      ruaAlvo = partes[0];
      cidadeAlvo = partes[1];
    }

    if (cidadeAlvo && ruaAlvo.length >= 3) {
      try {
        const urlViaCep = `https://viacep.com.br/ws/${encodeURIComponent(ufLimpa)}/${encodeURIComponent(cidadeAlvo)}/${encodeURIComponent(ruaAlvo)}/json/`;
        const ctrl = new AbortController();
        const tm = setTimeout(() => ctrl.abort(), 7000);
        const resp = await fetch(urlViaCep, { headers: HTTP_HEADERS, signal: ctrl.signal });
        clearTimeout(tm);

        if (resp.ok) {
          const lista = await resp.json();
          if (Array.isArray(lista) && lista.length > 0) {
            const primary = normalizarViaCep(lista[0], lista[0].cep);
            primary.totalMatches = lista.length;
            primary.matches = lista.map((item) => normalizarViaCep(item, item.cep));
            primary.fonte = "ViaCEP Oficial (Pesquisa de Logradouro)";
            return primary;
          }
        }
      } catch (viaCepErr) {
        console.warn(`[CEP MULTI-PROVIDER] Busca por logradouro ViaCEP falhou: ${viaCepErr.message}`);
      }
    }
  }

  // Geocodificação Nominatim / OpenStreetMap
  try {
    const urlOsm = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(termoLimpo)}&countrycodes=br&format=json&addressdetails=1&limit=5`;
    const ctrl = new AbortController();
    const tm = setTimeout(() => ctrl.abort(), 8000);
    const resp = await fetch(urlOsm, {
      headers: {
        "User-Agent": "RimuBusca-OSINT/1.0 (https://rimubusca.vercel.app)",
        Accept: "application/json",
      },
      signal: ctrl.signal,
    });
    clearTimeout(tm);

    if (resp.ok) {
      const results = await resp.json();
      if (Array.isArray(results) && results.length > 0) {
        const item = results[0];
        const addr = item.address || {};
        const cepEncontrado = addr.postcode ? addr.postcode.replace(/\D/g, "") : null;

        if (cepEncontrado && cepEncontrado.length === 8) {
          console.log(`[CEP MULTI-PROVIDER] CEP ${cepEncontrado} identificado via OpenStreetMap para '${termoLimpo}'.`);
          const fullDossier = await consultarEnderecoCep(cepEncontrado, uf);
          if (fullDossier) {
            fullDossier.coordenadas = {
              latitude: parseFloat(item.lat),
              longitude: parseFloat(item.lon),
            };
            fullDossier.fonte = `OpenStreetMap + ${fullDossier.fonte}`;
            return fullDossier;
          }
        }

        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        const ufFinal = (addr.state_code || addr.state || "N/I").toUpperCase().slice(0, 2);

        return {
          cep: addr.postcode ? formatarCep(addr.postcode) : "N/I",
          cepLimpo: addr.postcode ? addr.postcode.replace(/\D/g, "") : "",
          logradouro: addr.road || addr.street || item.display_name.split(",")[0] || termoLimpo,
          complemento: "",
          bairro: addr.suburb || addr.neighbourhood || addr.city_district || "Não informado",
          cidade: addr.city || addr.town || addr.municipality || "Não informada",
          uf: ufFinal,
          estado: addr.state || "Não informado",
          ddd: resolverDdd(null, ufFinal),
          codigoIbge: "N/I",
          coordenadas: !isNaN(lat) && !isNaN(lon) ? { latitude: lat, longitude: lon } : null,
          totalResidentesEstimados: null,
          moradores: [],
          provedor: "openstreetmap",
          fonte: "OpenStreetMap Nominatim Geocoding",
        };
      }
    }
  } catch (osmErr) {
    console.warn(`[CEP MULTI-PROVIDER] Busca por OpenStreetMap falhou: ${osmErr.message}`);
  }

  throw new Error(
    `Endereço não localizado. Para maior precisão, informe o CEP de 8 dígitos (ex: 01310-200) ou inclua Rua, Cidade e Estado.`
  );
}

export default {
  consultarEnderecoCep,
  normalizarRimuApiCep,
  normalizarBrasilApiCep,
  normalizarViaCep,
  normalizarOpenCep,
  normalizarAwesomeApiCep,
  normalizarHexysCep,
  normalizarZeroyCep,
  formatarCep,
  extrairCodigoIbge,
  resolverDdd,
};
