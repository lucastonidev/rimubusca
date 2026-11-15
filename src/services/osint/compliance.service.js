/**
 * ==============================================================================
 * RIMUBUSCA - COMPLIANCE PÚBLICO, SANÇÕES (CGU), TSE & TRANSPARÊNCIA BR
 * Consultas integradas para Due Diligence & Dossiê OSINT:
 *  - CGU Portal da Transparência: CEIS, CNEP, CEPIM e PEP (chave gratuita env)
 *  - TSE DivulgaCandContas: Candidaturas e vínculos eleitorais (sem chave)
 *  - Querido Diário (OKBR): Menções em Diários Oficiais Municipais (sem chave)
 *  - PNCP: Contratos e publicações federais/municipais (sem chave)
 * ==============================================================================
 */

import { httpRequest } from "../core/httpClient.js";
import { cacheService } from "../core/cache.service.js";

export const PORTAL_TRANSPARENCIA_BASE = "https://api.portaldatransparencia.gov.br/api-de-dados";
const TSE_REST_BASE = "https://divulgacandcontas.tse.jus.br/divulga/rest/v1";
const QUERIDO_DIARIO_BASE = "https://api.queridodiario.ok.org.br/gazettes";
const PNCP_SEARCH_BASE = "https://pncp.gov.br/api/search/";

const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; RimuBusca-OSINT/1.0)",
  "Accept": "application/json",
};

function normalizarTexto(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function limparHtmlSnippet(str) {
  return String(str || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatarCnpj(digits) {
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export function obterChavePortalTransparencia() {
  const key = String(process.env.PORTAL_TRANSPARENCIA_API_KEY || "").trim();
  if (
    !key ||
    key === "sua_chave_portal_transparencia_aqui" ||
    key === "COLE_SUA_CHAVE_AQUI"
  ) {
    return null;
  }
  return key;
}

/**
 * Normaliza registro de sanção CGU (CEIS / CNEP / CEPIM).
 */
export function normalizarSancaoCgu(cadastro, item = {}) {
  const sanc = item.sancionado || item.pessoa || {};
  const orgao = item.orgaoSancionador || item.orgaoSuperior || {};
  const tipo = item.tipoSancao || {};
  const fund = Array.isArray(item.fundamentacoesLegais) ? item.fundamentacoesLegais[0] : null;

  return {
    cadastro,
    nomeSancionado: sanc.nome || item.nomeSancionado || "Não informado",
    documentoSancionado: sanc.codigoFormatado || sanc.codigoSancionado || item.cnpjSancionado || item.cpfSancionado || null,
    tipoPessoa: sanc.tipoPessoa || null,
    tipoSancao: tipo.descricaoResumida || tipo.descricao || item.motivo || "Sanção Administrativa",
    orgaoSancionador: orgao.nome || orgao.sigla || item.orgaoSancionadorNome || "Órgão Público",
    ufOrgao: orgao.uf?.sigla || item.ufOrgaoSancionador || null,
    dataInicio: item.dataInicioSancao || item.dataPublicacao || null,
    dataFim: item.dataFimSancao || "Indeterminado / Vigente",
    processo: item.numeroProcesso || item.processo || null,
    fundamentacao: fund ? [fund.artigo, fund.lei, fund.descricao].filter(Boolean).join(" — ") : null,
    valorMulta: item.valorMulta ?? null,
    observacoes: item.observacoes || item.detalhamentoPublicacao || null,
  };
}

/**
 * Consulta CGU Portal da Transparência (CEIS, CNEP, CEPIM, PEP).
 */
export async function consultarCguTransparencia(docLimpo, tipoDoc) {
  const apiKey = obterChavePortalTransparencia();
  const baseUrlPortal = "https://portaldatransparencia.gov.br/sancoes/consulta";
  const linksOficiais = [];

  if (docLimpo) {
    linksOficiais.push({
      titulo: "Consultar CEIS / CNEP / CEPIM no Portal da Transparência",
      url: `${baseUrlPortal}?ordenarPor=nome&direcao=asc&termo=${encodeURIComponent(docLimpo)}`,
    });
  }

  if (!apiKey) {
    return {
      fonte: "CGU / Portal da Transparência",
      configurado: false,
      status: "chave_nao_configurada",
      mensagem:
        "Chave gratuita PORTAL_TRANSPARENCIA_API_KEY não configurada no servidor (.env). Links diretos de auditoria manual estão disponíveis abaixo.",
      ceis: [],
      cnep: [],
      cepim: [],
      peps: [],
      totalSancoes: 0,
      totalPeps: 0,
      linksOficiais,
    };
  }

  if (!docLimpo || (docLimpo.length !== 11 && docLimpo.length !== 14)) {
    return {
      fonte: "CGU / Portal da Transparência",
      configurado: true,
      status: "documento_requerido",
      mensagem: "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido para consulta nos cadastros da CGU.",
      ceis: [],
      cnep: [],
      cepim: [],
      peps: [],
      totalSancoes: 0,
      totalPeps: 0,
      linksOficiais,
    };
  }

  const headers = {
    "chave-api-dados": apiKey,
    "Accept": "application/json",
    "User-Agent": "RimuBusca-OSINT/1.0",
  };

  const requests = [
    httpRequest(`${PORTAL_TRANSPARENCIA_BASE}/ceis?codigoSancionado=${encodeURIComponent(docLimpo)}&pagina=1`, {
      method: "GET",
      headers,
      timeout: 5500,
    }),
    httpRequest(`${PORTAL_TRANSPARENCIA_BASE}/cnep?codigoSancionado=${encodeURIComponent(docLimpo)}&pagina=1`, {
      method: "GET",
      headers,
      timeout: 5500,
    }),
  ];

  if (tipoDoc === "cnpj" || docLimpo.length === 14) {
    requests.push(
      httpRequest(`${PORTAL_TRANSPARENCIA_BASE}/cepim?cnpjSancionado=${encodeURIComponent(docLimpo)}&pagina=1`, {
        method: "GET",
        headers,
        timeout: 5500,
      })
    );
  } else {
    requests.push(Promise.resolve({ ok: true, status: 200, data: [] }));
  }

  if (tipoDoc === "cpf" || docLimpo.length === 11) {
    requests.push(
      httpRequest(`${PORTAL_TRANSPARENCIA_BASE}/peps?cpf=${encodeURIComponent(docLimpo)}&pagina=1`, {
        method: "GET",
        headers,
        timeout: 5500,
      })
    );
  } else {
    requests.push(Promise.resolve({ ok: true, status: 200, data: [] }));
  }

  const [ceisRes, cnepRes, cepimRes, pepRes] = await Promise.allSettled(requests);

  const authError = [ceisRes, cnepRes, cepimRes, pepRes].some(
    (r) => r.status === "fulfilled" && (r.value?.status === 401 || r.value?.status === 403)
  );

  if (authError) {
    return {
      fonte: "CGU / Portal da Transparência",
      configurado: true,
      status: "chave_invalida",
      mensagem: "PORTAL_TRANSPARENCIA_API_KEY rejeitada (HTTP 401/403). Verifique se a chave Gov.br está ativa.",
      ceis: [],
      cnep: [],
      cepim: [],
      peps: [],
      totalSancoes: 0,
      totalPeps: 0,
      linksOficiais,
    };
  }

  const parseList = (settled) =>
    settled.status === "fulfilled" && settled.value?.ok && Array.isArray(settled.value?.data)
      ? settled.value.data
      : [];

  const ceis = parseList(ceisRes).map((i) => normalizarSancaoCgu("CEIS", i));
  const cnep = parseList(cnepRes).map((i) => normalizarSancaoCgu("CNEP", i));
  const cepim = parseList(cepimRes).map((i) => normalizarSancaoCgu("CEPIM", i));
  const peps = parseList(pepRes).map((p) => ({
    cpf: p.cpf || docLimpo,
    nome: p.nome || "PEP",
    funcao: p.descricao_funcao || p.funcao || "Cargo Público / Mandato",
    orgao: p.nome_orgao || p.orgao || "Administração Pública",
    dataInicio: p.dt_inicio_exercicio || null,
    dataFim: p.dt_fim_exercicio || "Em exercício",
    dataCarencia: p.dt_fim_carencia || null,
  }));

  const anyNetworkFailure = [ceisRes, cnepRes].every((r) => r.status === "rejected");

  return {
    fonte: "CGU / Portal da Transparência",
    configurado: true,
    status: anyNetworkFailure ? "indisponivel" : "ok",
    mensagem: anyNetworkFailure ? "API do Portal da Transparência temporariamente indisponível." : null,
    ceis,
    cnep,
    cepim,
    peps,
    totalSancoes: ceis.length + cnep.length + cepim.length,
    totalPeps: peps.length,
    linksOficiais,
  };
}

function nomeCorrespondeCandidato(nomeAlvo, cand = {}) {
  const alvoNorm = normalizarTexto(nomeAlvo);
  const tokens = alvoNorm.split(" ").filter((t) => t.length >= 2);
  if (tokens.length < 2) return false;

  const candCompleto = normalizarTexto(cand.nomeCompleto || cand.nome || "");
  const candUrna = normalizarTexto(cand.nomeUrna || "");
  if (!candCompleto && !candUrna) return false;

  const fullMatch = tokens.every((tok) => candCompleto.includes(tok));
  const urnaMatch = candUrna ? tokens.every((tok) => candUrna.includes(tok)) : false;
  return fullMatch || urnaMatch;
}

async function fetchTseJsonCached(cacheSubKey, url, ttlMs = 24 * 60 * 60 * 1000) {
  try {
    const cached = await cacheService.get("tse_divulga", cacheSubKey);
    if (cached && cached.hit && cached.dados) {
      return cached.dados;
    }
  } catch {
    // Segue para consulta ao vivo
  }

  const res = await httpRequest(url, {
    method: "GET",
    headers: DEFAULT_HEADERS,
    timeout: 4500,
  });

  if (res.ok && res.data && typeof res.data === "object") {
    try {
      await cacheService.set("tse_divulga", cacheSubKey, res.data, { ttlMs });
    } catch {
      // Cache secundário opcional
    }
    return res.data;
  }
  return null;
}

/**
 * Consulta candidaturas públicas no DivulgaCandContas (TSE) por Nome + UF (+ Município opcional).
 */
export async function consultarTseCandidaturas({ nome, uf, municipio }) {
  const linksOficiais = [
    {
      titulo: "Portal DivulgaCandContas (TSE)",
      url: "https://divulgacandcontas.tse.jus.br/divulga/",
    },
  ];

  const nomeClean = String(nome || "").trim();
  const ufClean = String(uf || "").trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);

  if (!nomeClean || nomeClean.split(/\s+/).length < 2) {
    return {
      fonte: "TSE DivulgaCandContas",
      status: "nome_insuficiente",
      mensagem: "Informe o nome completo (mínimo 2 palavras) para cruzar candidaturas eleitorais.",
      candidaturas: [],
      linksOficiais,
    };
  }

  if (!ufClean || ufClean.length !== 2) {
    return {
      fonte: "TSE DivulgaCandContas",
      status: "uf_nao_informada",
      mensagem: "UF necessária para consulta direta no DivulgaCandContas (informada automaticamente quando o CPF/CNPJ traz endereço).",
      candidaturas: [],
      linksOficiais,
    };
  }

  const encontros = [];

  try {
    // 1. Eleições Gerais 2022 por UF (Governador=3, Senador=5, Dep. Federal=6, Dep. Estadual=7/Distrital=8)
    const cargos2022 = [3, 5, 6, ufClean === "DF" ? 8 : 7];
    const reqs2022 = cargos2022.map((cargoId) =>
      fetchTseJsonCached(
        `2022:${ufClean}:${cargoId}`,
        `${TSE_REST_BASE}/candidatura/listar/2022/${ufClean}/2040602022/${cargoId}/candidatos`
      )
    );

    // 2. Eleições Municipais 2024 caso o município esteja informado (Prefeito=11, Vereador=13)
    const munJobs = [];
    if (municipio && String(municipio).trim().length >= 2) {
      const munsData = await fetchTseJsonCached(
        `muns:2024:${ufClean}`,
        `${TSE_REST_BASE}/eleicao/buscar/${ufClean}/2045202024/municipios`,
        7 * 24 * 60 * 60 * 1000
      );
      const listaMuns = Array.isArray(munsData?.municipios) ? munsData.municipios : [];
      const munAlvoNorm = normalizarTexto(municipio);
      const munMatch = listaMuns.find((m) => normalizarTexto(m.nome) === munAlvoNorm);

      if (munMatch?.codigo) {
        for (const cargoId of [11, 13]) {
          munJobs.push(
            fetchTseJsonCached(
              `2024:${munMatch.codigo}:${cargoId}`,
              `${TSE_REST_BASE}/candidatura/listar/2024/${munMatch.codigo}/2045202024/${cargoId}/candidatos`
            ).then((d) => ({ ano: 2024, idEleicao: "2045202024", loc: `${ufClean} (${munMatch.nome})`, data: d }))
          );
        }
      }
    }

    const res2022 = await Promise.allSettled(reqs2022);
    const res2024 = await Promise.allSettled(munJobs);

    const processarLista = (lista, ano, idEleicao, abrangencia) => {
      if (!Array.isArray(lista)) return;
      for (const c of lista) {
        if (nomeCorrespondeCandidato(nomeClean, c)) {
          encontros.push({
            ano,
            idEleicao,
            idCandidato: c.id || null,
            nomeCompleto: c.nomeCompleto || c.nomeUrna || nomeClean,
            nomeUrna: c.nomeUrna || null,
            numeroUrna: c.numero ?? null,
            partido: c.partido?.sigla || c.partido?.nome || "N/I",
            cargo: c.cargo?.nome || "Cargo Eletivo",
            situacao: c.descricaoSituacao || c.situacaoTotalizacao || "Registrado",
            uf: ufClean,
            abrangencia,
            totalBens: c.totalDeBens ?? null,
            linkOficial: c.id
              ? `https://divulgacandcontas.tse.jus.br/divulga/#/candidato/${ufClean}/${idEleicao}/${c.id}`
              : "https://divulgacandcontas.tse.jus.br/divulga/",
          });
        }
      }
    };

    for (const s of res2022) {
      if (s.status === "fulfilled" && Array.isArray(s.value?.candidatos)) {
        processarLista(s.value.candidatos, 2022, "2040602022", `UF ${ufClean}`);
      }
    }
    for (const s of res2024) {
      if (s.status === "fulfilled" && Array.isArray(s.value?.data?.candidatos)) {
        processarLista(s.value.data.candidatos, 2024, "2045202024", s.value.loc);
      }
    }

    return {
      fonte: "TSE DivulgaCandContas",
      status: "ok",
      ufConsultada: ufClean,
      municipioConsultado: municipio || null,
      candidaturas: encontros.slice(0, 15),
      linksOficiais,
    };
  } catch (err) {
    return {
      fonte: "TSE DivulgaCandContas",
      status: "indisponivel",
      mensagem: `Falha ao consultar API pública do TSE (${err.message}).`,
      candidaturas: [],
      linksOficiais,
    };
  }
}

/**
 * Busca menções no Querido Diário (Diários Oficiais Municipais - sem chave).
 */
export async function consultarQueridoDiario({ cnpjLimpo, nomeBusca }) {
  let termoPesquisa = null;
  if (cnpjLimpo && cnpjLimpo.length === 14) {
    termoPesquisa = `"${formatarCnpj(cnpjLimpo)}"`;
  } else if (nomeBusca && String(nomeBusca).trim().split(/\s+/).length >= 2) {
    termoPesquisa = `"${String(nomeBusca).trim()}"`;
  }

  if (!termoPesquisa) {
    return {
      fonte: "Querido Diário (Open Knowledge Brasil)",
      status: "ignorado",
      ocorrencias: [],
      totalEncontrado: 0,
    };
  }

  try {
    const url = `${QUERIDO_DIARIO_BASE}?querystring=${encodeURIComponent(termoPesquisa)}&size=5`;
    const res = await httpRequest(url, {
      method: "GET",
      headers: { "Accept": "application/json", "User-Agent": "RimuBusca-OSINT/1.0" },
      timeout: 5000,
    });

    if (res.ok && res.data && Array.isArray(res.data.gazettes)) {
      const ocorrencias = res.data.gazettes.map((g) => ({
        municipio: g.territory_name || "Município",
        uf: g.state_code || "",
        dataPublicacao: g.date || null,
        edicao: g.edition || null,
        urlArquivo: g.url || null,
        trecho: Array.isArray(g.excerpts) && g.excerpts[0] ? limparHtmlSnippet(g.excerpts[0]).slice(0, 320) : "",
      }));

      return {
        fonte: "Querido Diário (Diários Oficiais Municipais)",
        status: "ok",
        termoPesquisa,
        totalEncontrado: Number(res.data.total_gazettes) || ocorrencias.length,
        ocorrencias,
      };
    }

    return {
      fonte: "Querido Diário",
      status: "indisponivel",
      ocorrencias: [],
      totalEncontrado: 0,
    };
  } catch {
    return {
      fonte: "Querido Diário",
      status: "indisponivel",
      ocorrencias: [],
      totalEncontrado: 0,
    };
  }
}

/**
 * Busca contratos e compras públicas no PNCP para um CNPJ (sem chave).
 */
export async function consultarPncpContratos(cnpjLimpo) {
  if (!cnpjLimpo || cnpjLimpo.length !== 14) {
    return { fonte: "PNCP", status: "ignorado", resultados: [], totalEncontrado: 0 };
  }

  try {
    const url = `${PNCP_SEARCH_BASE}?q=${encodeURIComponent(cnpjLimpo)}&tipos_documento=contrato&pagina=1&tam_pagina=5`;
    const res = await httpRequest(url, {
      method: "GET",
      headers: DEFAULT_HEADERS,
      timeout: 5000,
    });

    if (res.ok && res.data && Array.isArray(res.data.items)) {
      const resultados = res.data.items.map((item) => ({
        titulo: item.title || item.numero_controle_pncp || "Contrato Público",
        orgao: item.orgao_nome || "Órgão Contratante",
        uf: item.uf || null,
        dataAssinatura: item.data_assinatura || item.createdAt || null,
        valorGlobal: item.valor_global ?? null,
        objeto: limparHtmlSnippet(item.description || "").slice(0, 220),
        url: item.item_url ? `https://pncp.gov.br${item.item_url}` : "https://pncp.gov.br/",
      }));

      return {
        fonte: "PNCP (Portal Nacional de Contratações Públicas)",
        status: "ok",
        totalEncontrado: Number(res.data.total) || resultados.length,
        resultados,
      };
    }

    return { fonte: "PNCP", status: "indisponivel", resultados: [], totalEncontrado: 0 };
  } catch {
    return { fonte: "PNCP", status: "indisponivel", resultados: [], totalEncontrado: 0 };
  }
}

/**
 * Orquestrador principal de Compliance Público, CGU, TSE e Fontes Abertas BR.
 */
export async function consultarComplianceCompleto({ tipo = "", termo = "", nome = "", uf = "", municipio = "" } = {}) {
  const tipoNorm = String(tipo || "").toLowerCase().trim();
  const termoClean = String(termo || "").trim();
  const docDigits = termoClean.replace(/\D/g, "");

  let tipoDoc = tipoNorm;
  if (docDigits.length === 14) tipoDoc = "cnpj";
  else if (docDigits.length === 11) tipoDoc = "cpf";

  const docLimpo = docDigits.length === 11 || docDigits.length === 14 ? docDigits : null;
  const nomeBusca = String(nome || (tipoDoc === "nome" ? termoClean : "") || "").trim();
  const ufNorm = String(uf || "").trim().toUpperCase().slice(0, 2);
  const munNorm = String(municipio || "").trim();

  const cacheKey = `${tipoDoc}:${docLimpo || nomeBusca}:${ufNorm}:${munNorm}`;
  try {
    const cached = await cacheService.get("compliance_br", cacheKey);
    if (cached && cached.hit && cached.dados) {
      return { ...cached.dados, cacheHit: true };
    }
  } catch {
    // Segue sem interromper
  }

  const tsePromise =
    tipoDoc === "cnpj"
      ? Promise.resolve({
          fonte: "TSE DivulgaCandContas",
          status: "nao_aplicavel_pj",
          mensagem: "Registro eleitoral aplica-se a pessoas físicas (CPF/Nome). Consulte os sócios (QSA) para cruzar candidaturas.",
          candidaturas: [],
          linksOficiais: [{ titulo: "Portal DivulgaCandContas (TSE)", url: "https://divulgacandcontas.tse.jus.br/divulga/" }],
        })
      : consultarTseCandidaturas({ nome: nomeBusca, uf: ufNorm, municipio: munNorm });

  const [cguSettled, tseSettled, diariosSettled, pncpSettled] = await Promise.allSettled([
    consultarCguTransparencia(docLimpo, tipoDoc),
    tsePromise,
    consultarQueridoDiario({ cnpjLimpo: tipoDoc === "cnpj" ? docLimpo : null, nomeBusca }),
    consultarPncpContratos(tipoDoc === "cnpj" ? docLimpo : null),
  ]);

  const cgu =
    cguSettled.status === "fulfilled"
      ? cguSettled.value
      : { fonte: "CGU", configurado: false, status: "erro", ceis: [], cnep: [], cepim: [], peps: [], totalSancoes: 0, totalPeps: 0 };

  const tse =
    tseSettled.status === "fulfilled"
      ? tseSettled.value
      : { fonte: "TSE", status: "erro", candidaturas: [] };

  const diarios =
    diariosSettled.status === "fulfilled"
      ? diariosSettled.value
      : { fonte: "Querido Diário", status: "erro", ocorrencias: [], totalEncontrado: 0 };

  const pncp =
    pncpSettled.status === "fulfilled"
      ? pncpSettled.value
      : { fonte: "PNCP", status: "erro", resultados: [], totalEncontrado: 0 };

  const totalSancoesCgu = Number(cgu.totalSancoes || 0);
  const totalPeps = Number(cgu.totalPeps || 0);
  const totalCandidaturasTse = Array.isArray(tse.candidaturas) ? tse.candidaturas.length : 0;
  const totalDiarios = Array.isArray(diarios.ocorrencias) ? diarios.ocorrencias.length : 0;
  const totalPncp = Array.isArray(pncp.resultados) ? pncp.resultados.length : 0;

  let classificacaoRisco = "SEM_RESTRICOES";
  let resumoTexto = "Nenhum impedimento administrativo ou alerta eleitoral identificado nas fontes consultadas.";

  if (totalSancoesCgu > 0) {
    classificacaoRisco = "CRÍTICO";
    resumoTexto = `ATENÇÃO: Detectada(s) ${totalSancoesCgu} sanção(ões) ativa(s) ou histórica(s) em cadastros impeditivos da CGU (CEIS/CNEP/CEPIM).`;
  } else if (totalPeps > 0 || totalCandidaturasTse > 0) {
    classificacaoRisco = "ATENÇÃO_POLITICA";
    resumoTexto = `Alvo possui registro PEP ou histórico de candidatura eleitoral pública no TSE (${totalCandidaturasTse} registro(s)).`;
  } else if (totalPncp > 0 || totalDiarios > 0) {
    classificacaoRisco = "PUBLICACOES_OFICIAIS";
    resumoTexto = `Identificadas publicações oficiais (${totalPncp} no PNCP, ${totalDiarios} em Diários Oficiais Municipais).`;
  }

  const resultado = {
    alvo: {
      tipo: tipoDoc || "geral",
      documento: docLimpo,
      nome: nomeBusca || null,
      uf: ufNorm || null,
      municipio: munNorm || null,
    },
    resumo: {
      classificacaoRisco,
      resumoTexto,
      totalSancoesCgu,
      totalPeps,
      totalCandidaturasTse,
      totalDiarios,
      totalPncp,
    },
    cgu,
    tse,
    diarios,
    pncp,
    timestamp: new Date().toISOString(),
  };

  try {
    await cacheService.set("compliance_br", cacheKey, resultado, { ttlMs: 12 * 60 * 60 * 1000 });
  } catch {
    // Segue sem travar resposta
  }

  return resultado;
}
