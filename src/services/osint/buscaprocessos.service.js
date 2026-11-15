/**
 * ==============================================================================
 * RIMUBUSCA - CLIENTE OFICIAL DA API BUSCAPROCESSOS.APP.BR (BUSCAPROCESSOS.SERVICE.JS)
 * Documentação oficial: https://docs.buscaprocessos.app.br/docs/getting-started
 *
 * Integração completa para plano Free e Produção:
 * - Consulta por CPF / CNPJ: GET /v1/processos?cpf_cnpj={doc}
 * - Consulta por CNJ Único: GET /v1/processos/cnj/{cnj}
 * - Movimentações processuais: GET /v1/processos/cnj/{cnj}/movimentacoes
 * - Resumo IA da causa: GET /v1/processos/cnj/{cnj}/resumo-ia
 * - Consulta por Termo/Nome: GET /v1/busca/termo?q={termo}
 * - Consulta por OAB: GET /v1/processos/oab?oab_estado={uf}&oab_numero={num}
 * - Suporte a processamento assíncrono (HTTP 202 Accepted com Polling)
 * - Cache automático multi-tier para preservação de créditos do plano Free
 * ==============================================================================
 */

import { cacheService } from "../core/cache.service.js";
import { supabaseAdmin } from "../../config/supabase.js";
import {
  decodificarEValidarCNJ,
  gerarLinksEDorksProcessuais,
  gerarDorksPorNome,
} from "../../utils/processos.utils.js";

const DEFAULT_BASE_URL = "https://api.buscaprocessos.app.br/v1";
const REQUEST_TIMEOUT_MS = 25000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas de cache para poupar créditos Free

export class BuscaProcessosService {
  constructor() {
    this.baseUrl = (process.env.BUSCAPROCESSOS_API_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.apiKey = process.env.BUSCAPROCESSOS_API_KEY || "";
    this._cachedKeyFromDb = null;
    this._lastKeyCheck = 0;
  }

  /**
   * Obtém a chave de API (do .env ou dinamicamente do banco Supabase)
   */
  async getApiKey() {
    if (this.apiKey) {
      return this.apiKey.trim();
    }

    // Verifica a cada 60 segundos no banco para permitir configuração em runtime
    const now = Date.now();
    if (this._cachedKeyFromDb !== null && now - this._lastKeyCheck < 60000) {
      return this._cachedKeyFromDb;
    }

    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const { data } = await supabaseAdmin
          .from("api_keys")
          .select("chave_criptografada")
          .eq("servico", "buscaprocessos")
          .maybeSingle();

        if (data && data.chave_criptografada) {
          this._cachedKeyFromDb = data.chave_criptografada;
          this._lastKeyCheck = now;
          return this._cachedKeyFromDb;
        }
      } catch {
        // Ignora
      }
    }

    this._lastKeyCheck = now;
    return "";
  }

  /**
   * Verifica se a chave da API está configurada
   */
  async hasKey() {
    const key = await this.getApiKey();
    return Boolean(key && key.length > 5);
  }

  /**
   * Executa requisição autenticada com suporte a polling HTTP 202
   * @param {string} endpoint - Caminho relativo (ex: /processos?cpf_cnpj=...)
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async request(endpoint, options = {}) {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      throw new Error(
        "Chave da API BuscaProcessos não configurada. Defina BUSCAPROCESSOS_API_KEY no arquivo .env."
      );
    }

    const cleanEndpoint = endpoint.startsWith("http")
      ? endpoint
      : `${this.baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

    const headers = {
      "x-api-key": apiKey,
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      ...(options.headers || {}),
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      let resp = await fetch(cleanEndpoint, {
        method: options.method || "GET",
        headers,
        signal: controller.signal,
      });

      // Tratamento de processamento assíncrono (HTTP 202 Accepted)
      if (resp.status === 202) {
        const location = resp.headers.get("Location");
        let body202 = null;
        try {
          body202 = await resp.json();
        } catch {
          // Ignora
        }

        const pollingUrl = location || body202?.data?.statusUrl || body202?.data?.pollingUrl;
        if (pollingUrl) {
          // Aguarda e faz até 4 tentativas de polling respeitando a janela da Vercel
          const maxRetries = 4;
          for (let i = 0; i < maxRetries; i++) {
            await new Promise((r) => setTimeout(r, 2500));
            try {
              const pollResp = await fetch(pollingUrl, { headers });
              if (pollResp.status === 200) {
                resp = pollResp;
                break;
              }
            } catch {
              // Continua
            }
          }
        }
      }

      clearTimeout(timeout);

      if (!resp.ok) {
        const errorText = await resp.text();
        let errorJson = null;
        try {
          errorJson = JSON.parse(errorText);
        } catch {
          // Ignora
        }

        const msg =
          errorJson?.message ||
          errorJson?.error ||
          `BuscaProcessos API retornou HTTP ${resp.status}: ${errorText.slice(0, 160)}`;
        const err = new Error(msg);
        err.status = resp.status;
        err.details = errorJson;
        throw err;
      }

      return await resp.json();
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  /**
   * Consulta processos por CPF ou CNPJ
   * Endpoint: GET /v1/processos?cpf_cnpj={documento}
   * @param {string} documento - CPF (11 dígitos) ou CNPJ (14 dígitos)
   * @returns {Promise<Object>}
   */
  async consultarPorCpfCnpj(documento) {
    const docLimpo = String(documento || "").replace(/\D/g, "");
    if (docLimpo.length !== 11 && docLimpo.length !== 14) {
      throw new Error("Documento inválido. Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).");
    }

    const cacheKey = `buscaprocessos_doc_${docLimpo}`;
    const cached = await cacheService.get("processos_buscaprocessos", docLimpo);
    if (cached && cached.data) {
      const cachedPayload = cached.data.dados ? cached.data : { success: true, dados: cached.data };
      return { ...cachedPayload, _cached: true, _cacheSource: cached.source };
    }

    const endpoint = `/processos?cpf_cnpj=${docLimpo}`;
    const raw = await this.request(endpoint);

    const normalizado = this.normalizarResultadoDocumento(raw, docLimpo);

    // Grava no cache
    await cacheService.set("processos_buscaprocessos", docLimpo, normalizado, CACHE_TTL_MS);

    return normalizado;
  }

  /**
   * Consulta processo detalhado por Número CNJ
   * Endpoints:
   *   - GET /v1/processos/cnj/{cnj}
   *   - GET /v1/processos/cnj/{cnj}/movimentacoes
   *   - GET /v1/processos/cnj/{cnj}/resumo-ia
   * @param {string} cnj
   * @returns {Promise<Object>}
   */
  async consultarPorCnj(cnj) {
    const decodificado = decodificarEValidarCNJ(cnj);
    const cnjLimpo = decodificado.limpo || String(cnj).replace(/\D/g, "");

    const cached = await cacheService.get("processos_buscaprocessos", cnjLimpo);
    if (cached && cached.data) {
      const cachedPayload = cached.data.dados ? cached.data : { success: true, dados: cached.data };
      return { ...cachedPayload, _cached: true, _cacheSource: cached.source };
    }

    // 1. Busca dados de capa e partes
    const rawCapa = await this.request(`/processos/cnj/${encodeURIComponent(cnjLimpo)}`);

    // 2. Tenta buscar movimentações e resumo IA de forma concorrente sem quebrar se não houver
    let rawMovs = null;
    let rawResumoIa = null;

    try {
      const [resMovs, resIa] = await Promise.allSettled([
        this.request(`/processos/cnj/${encodeURIComponent(cnjLimpo)}/movimentacoes`),
        this.request(`/processos/cnj/${encodeURIComponent(cnjLimpo)}/resumo-ia`),
      ]);

      if (resMovs.status === "fulfilled" && resMovs.value) {
        rawMovs = resMovs.value;
      }
      if (resIa.status === "fulfilled" && resIa.value) {
        rawResumoIa = resIa.value;
      }
    } catch {
      // Ignora falhas nos endpoints complementares
    }

    const normalizado = this.normalizarResultadoCnj(rawCapa, rawMovs, rawResumoIa, decodificado);

    // Salva no cache
    await cacheService.set("processos_buscaprocessos", cnjLimpo, normalizado, CACHE_TTL_MS);

    return normalizado;
  }

  /**
   * Consulta processos por Termo / Nome de Parte ou Razão Social
   * Endpoint: GET /v1/busca/termo?q={termo}&incluir_partes=true
   * @param {string} termo
   * @returns {Promise<Object>}
   */
  async consultarPorTermo(termo) {
    const termoLimpo = String(termo || "").trim();
    if (!termoLimpo) {
      throw new Error("Informe um nome de parte ou empresa válido.");
    }

    const cached = await cacheService.get("processos_buscaprocessos", termoLimpo);
    if (cached && cached.data) {
      const cachedPayload = cached.data.dados ? cached.data : { success: true, dados: cached.data };
      return { ...cachedPayload, _cached: true, _cacheSource: cached.source };
    }

    const endpoint = `/busca/termo?q=${encodeURIComponent(termoLimpo)}&qo=t`;
    const raw = await this.request(endpoint);

    const normalizado = this.normalizarResultadoTermo(raw, termoLimpo);

    await cacheService.set("processos_buscaprocessos", termoLimpo, normalizado, CACHE_TTL_MS);

    return normalizado;
  }

  /**
   * Consulta processos de advogado por inscrição OAB
   * Endpoint: GET /v1/processos/oab?oab_estado={uf}&oab_numero={num}
   * @param {string} oabString - Ex: "12345/SP", "SP12345", "12345 SP"
   * @returns {Promise<Object>}
   */
  async consultarPorOab(oabString) {
    const s = String(oabString || "").trim();
    const mUf = s.match(/([a-zA-Z]{2})/);
    const mNum = s.match(/(\d+)/);

    if (!mUf || !mNum) {
      throw new Error("OAB inválida. Exemplo de formato: '123456/SP' ou 'SP123456'.");
    }

    const uf = mUf[1].toUpperCase();
    const numero = mNum[1];

    const cacheKey = `oab_${uf}_${numero}`;
    const cached = await cacheService.get("processos_buscaprocessos", cacheKey);
    if (cached && cached.data) {
      const cachedPayload = cached.data.dados ? cached.data : { success: true, dados: cached.data };
      return { ...cachedPayload, _cached: true, _cacheSource: cached.source };
    }

    const endpoint = `/processos/oab?oab_estado=${encodeURIComponent(uf)}&oab_numero=${encodeURIComponent(numero)}`;
    const raw = await this.request(endpoint);

    const normalizado = this.normalizarResultadoDocumento(raw, `OAB/${uf} ${numero}`);

    await cacheService.set("processos_buscaprocessos", cacheKey, normalizado, CACHE_TTL_MS);

    return normalizado;
  }

  /**
   * Normaliza a resposta de lista de processos (por CPF/CNPJ ou OAB)
   * para o formato visual compatível com o frontend de processos
   */
  normalizarResultadoDocumento(raw, documentoIdentificador) {
    const dataObj = raw.data || raw;
    const processosList = Array.isArray(dataObj.processos)
      ? dataObj.processos
      : Array.isArray(dataObj.items)
      ? dataObj.items
      : Array.isArray(dataObj.resultados)
      ? dataObj.resultados
      : Array.isArray(dataObj)
      ? dataObj
      : [];

    const processosMapeados = processosList.map((p) => {
      const cnj = p.numeroCnj || p.numero_cnj || p.numeroProcesso || p.numero_processo || p.cnj || null;
      const tribunal = p.tribunal || p.siglaTribunal || (p.fonte && p.fonte.sigla) || "TJ";
      const grau = p.grau || "1º Grau";
      const classe = p.classe || p.classeProcessual || p.nome || "Procedimento Judicial";
      const assunto = p.assunto || (Array.isArray(p.assuntos) ? p.assuntos.join(", ") : "Assunto Geral");
      const comarca = p.comarca || p.foro || p.orgao || "";
      const vara = p.vara || p.orgaoJulgador || p.orgao || "";
      const situacao = p.situacao || (p.ativo ? "Em Andamento" : "Ativo");
      const dataInicio = p.dataDistribuicao || p.data_distribuicao ? String(p.dataDistribuicao || p.data_distribuicao).slice(0, 10) : null;
      const dataUltima = p.dataUltimaMovimentacao || p.data_ultima_movimentacao || p.dataPublicacao || p.data_publicacao || dataInicio || null;
      const textoPub = p.resumo || p.texto || p.ultimaMovimentacao || null;

      // Partes
      const partesAtivo = p.partes?.ativo || p.poloAtivo || [];
      const partesPassivo = p.partes?.passivo || p.poloPassivo || [];
      const poloAtivoStr = Array.isArray(partesAtivo)
        ? partesAtivo.map((item) => (typeof item === "string" ? item : item.nome)).join(", ")
        : String(partesAtivo || "");
      const poloPassivoStr = Array.isArray(partesPassivo)
        ? partesPassivo.map((item) => (typeof item === "string" ? item : item.nome)).join(", ")
        : String(partesPassivo || "");

      const envolvidos = [];
      if (poloAtivoStr) envolvidos.push(poloAtivoStr);
      if (poloPassivoStr) envolvidos.push(poloPassivoStr);

      return {
        titulo: `${classe} • ${assunto}`,
        cnj: cnj,
        cnjReal: cnj,
        status: situacao,
        origem: tribunal,
        instancia: grau,
        comarca: comarca,
        vara: vara,
        papel: p.polo || "Parte Envolvida",
        dataInicio,
        ultimaMovimentacao: dataUltima,
        envolvidos,
        url: p.urlPublicacao || p.link || p.url || (cnj ? `https://www.escavador.com/busca?q=${encodeURIComponent(cnj)}` : null),
        detalhesCarregados: true,
        detalhes: {
          sucesso: true,
          numeroCnj: cnj,
          numeroOriginal: cnj,
          desmascarado: Boolean(cnj),
          tribunal,
          forum: p.foro || comarca,
          comarca,
          vara,
          classe,
          valorCausa: p.valorDaCausa ? `R$ ${Number(p.valorDaCausa).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : null,
          partes: {
            poloAtivo: poloAtivoStr || null,
            poloPassivo: poloPassivoStr || null,
            advogados: [],
          },
          ultimaMovimentacao: {
            tipo: "Movimentação Registrada",
            data: dataUltima,
            textoIntegral: textoPub,
          },
          movimentacoes: [
            {
              data: dataUltima,
              nome: "Movimentação Registrada",
              descricao: textoPub || "",
            },
          ],
        },
      };
    });

    const dorks = gerarDorksPorNome(documentoIdentificador);
    const totalGeral = dataObj.paginator?.total ?? dataObj.total ?? processosMapeados.length;

    return {
      success: true,
      tipoBusca: "parte",
      alvo: documentoIdentificador,
      dados: {
        termo: documentoIdentificador,
        tipo: "CPF / CNPJ",
        fonte: "BuscaProcessos API (Oficial)",
        escavador: {
          nome: documentoIdentificador,
          url: `https://buscaprocessos.app.br`,
          totalProcessos: totalGeral,
          descricaoGeral: `Processos judiciais localizados na base unificada da BuscaProcessos para ${documentoIdentificador}.`,
          resumo: `Localizados ${processosMapeados.length} processos judiciais ativos ou arquivados nos tribunais brasileiros.`,
          polosAtuacao: [],
          estados: Array.from(new Set(processosMapeados.map((p) => p.origem).filter(Boolean))).map((est) => ({ estado: est, total: 1 })),
          assuntos: Array.from(new Set(processosMapeados.map((p) => p.titulo).filter(Boolean))),
          processosRecentes: processosMapeados,
        },
        dorks,
        linksDiretos: {
          jusbrasil: `https://www.jusbrasil.com.br/busca?q=${encodeURIComponent(documentoIdentificador)}`,
          escavador: `https://www.escavador.com/busca?q=${encodeURIComponent(documentoIdentificador)}`,
          djen: "https://comunica.pje.jus.br/",
          datajud: "https://comunica.pje.jus.br/",
        },
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Normaliza a resposta de processo individual por CNJ
   */
  normalizarResultadoCnj(rawCapa, rawMovs, rawResumoIa, decodificado) {
    const data = rawCapa.data || rawCapa;
    const cnjFormatado = decodificado.formatado || data.numeroCnj || data.numero_cnj || data.numeroProcesso;
    const cnjLimpo = decodificado.limpo || String(cnjFormatado).replace(/\D/g, "");

    const primeiraFonte = Array.isArray(data.fontes) && data.fontes[0] ? data.fontes[0] : null;
    const capa = primeiraFonte?.capa || data.capa || {};

    const tribunal =
      primeiraFonte?.sigla ||
      data.unidade_origem?.tribunal_sigla ||
      data.tribunal ||
      decodificado.partes?.tribunalSigla ||
      "TRIBUNAL";
    const classe = capa.classe || data.classe || "Processo Judicial";
    const assunto = capa.assunto || data.assunto || (Array.isArray(data.assuntos) ? data.assuntos.join(", ") : "Assunto Geral");
    const situacao = capa.situacao || data.situacao || (data.fontes_tribunais_estao_arquivadas ? "Arquivado" : "Em Andamento");
    const dataAjuizamento = capa.data_distribuicao || data.data_inicio || data.dataDistribuicao || data.dataAjuizamento || null;
    const orgaoJulgador = capa.orgao_julgador || data.unidade_origem?.nome || data.vara || data.orgaoJulgador || data.foro || null;
    const comarca = data.estado_origem?.nome
      ? `${data.unidade_origem?.nome || ''} (${data.estado_origem.sigla || ''})`.trim()
      : (data.comarca || data.foro || null);
    const grau = primeiraFonte?.grau_formatado || (primeiraFonte?.grau ? `${primeiraFonte.grau}º Grau` : (data.grau || "1º Grau"));

    // Polos e Partes
    const partesAtivo = data.partes?.ativo || data.poloAtivo || data.titulo_polo_ativo || capa.polo_ativo || [];
    const partesPassivo = data.partes?.passivo || data.poloPassivo || data.titulo_polo_passivo || capa.polo_passivo || [];

    const poloAtivoMapped = (Array.isArray(partesAtivo) ? partesAtivo : [partesAtivo])
      .filter(Boolean)
      .map((p) => ({
        nome: typeof p === "string" ? p : p.nome,
        papel: (typeof p === "object" && p.tipo) || "Autor / Requerente",
        documento: (typeof p === "object" && p.documento) || null,
        advogados: (typeof p === "object" && p.advogados) || [],
      }));

    const poloPassivoMapped = (Array.isArray(partesPassivo) ? partesPassivo : [partesPassivo])
      .filter(Boolean)
      .map((p) => ({
        nome: typeof p === "string" ? p : p.nome,
        papel: (typeof p === "object" && p.tipo) || "Réu / Requerido",
        documento: (typeof p === "object" && p.documento) || null,
        advogados: (typeof p === "object" && p.advogados) || [],
      }));

    // Movimentações
    const movsList = Array.isArray(rawMovs?.data?.movimentacoes)
      ? rawMovs.data.movimentacoes
      : Array.isArray(rawMovs?.data)
      ? rawMovs.data
      : Array.isArray(data.movimentacoes)
      ? data.movimentacoes
      : Array.isArray(primeiraFonte?.movimentacoes)
      ? primeiraFonte.movimentacoes
      : [];

    const movimentacoesMapped = movsList.map((m) => ({
      data: m.data || m.dataHora || m.dataMovimentacao || null,
      dataHora: m.data || m.dataHora || m.dataMovimentacao || null,
      nome: m.classificacao_predita?.nome || m.titulo || m.nome || "Andamento Processual",
      descricao: m.conteudo || m.descricao || m.texto || "",
      complementos: m.complementos || [],
    }));

    const { linksDiretos, dorks } = gerarLinksEDorksProcessuais(cnjFormatado, cnjLimpo, decodificado);

    const valorCausaFormatado =
      capa.valor_causa?.valor_formatado ||
      (data.valorDaCausa ? `R$ ${Number(data.valorDaCausa).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : null) ||
      data.valorCausa ||
      "Não informado";

    return {
      success: true,
      tipoBusca: "cnj",
      alvo: cnjFormatado,
      dados: {
        termo: cnjFormatado,
        numeroProcesso: cnjFormatado,
        classe,
        assuntos: [assunto],
        situacao,
        dataAjuizamento,
        valorCausa: valorCausaFormatado,
        orgaoJulgador,
        comarca,
        grau,
        sistema: "Processo Eletrônico (BuscaProcessos Oficial)",
        fonte: "BuscaProcessos API (Oficial)",
        resumoIa: rawResumoIa?.data?.resumo || rawResumoIa?.resumo || null,
        metadadosCnj: {
          tribunalSigla: tribunal,
          tribunalNome: decodificado.partes?.tribunalNome || tribunal,
          ramoNome: decodificado.partes?.ramoNome || "Poder Judiciário",
          anoAjuizamento: decodificado.partes?.anoAjuizamento || null,
          unidadeOrigem: decodificado.partes?.origemNumero || null,
        },
        validacaoCnj: {
          valido: decodificado.valido,
          motivo: decodificado.motivo,
        },
        polos: {
          poloAtivo: poloAtivoMapped,
          poloPassivo: poloPassivoMapped,
        },
        movimentacoes: movimentacoesMapped,
        linksDiretos,
        dorks,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Normaliza a resposta de busca textual por termo / nome
   */
  normalizarResultadoTermo(raw, termo) {
    const dataObj = raw.data || raw;
    const items = Array.isArray(dataObj.items)
      ? dataObj.items
      : Array.isArray(dataObj.resultados)
      ? dataObj.resultados
      : Array.isArray(dataObj)
      ? dataObj
      : [];

    const processosMapeados = items.map((it) => {
      const cnj = it.numero_processo || it.numeroProcesso || it.numeroCnj || it.cnj || null;
      const tribunal = it.tribunal || it.siglaTribunal || (it.fonte && it.fonte.sigla) || "DJ";
      const grau = it.grau || (it.orgao && String(it.orgao).includes("Vara") ? "1º Grau" : "Tribunal");
      const classe = it.classe || it.nome || it.titulo || "Ação Judicial";
      const comarca = it.orgao || it.comarca || "";
      const papel = it.tipo_comunicacao || it.polo || "Citação / Intimação";
      const dataPub = it.data_publicacao || it.dataPublicacao || it.data || null;
      const dataDist = it.data_distribuicao || it.dataDistribuicao || null;
      const textoCompleto = it.texto || it.resumo || "";

      // Partes envolvidas
      let envolvidos = [];
      if (Array.isArray(it.partes)) {
        envolvidos = it.partes.map((p) => (typeof p === "string" ? p : p.nome)).filter(Boolean);
      } else if (it.partes && typeof it.partes === "object") {
        envolvidos = Object.values(it.partes).flat().map((p) => (typeof p === "string" ? p : p?.nome)).filter(Boolean);
      } else if (it.poloAtivo || it.poloPassivo) {
        if (it.poloAtivo) envolvidos.push(`Autor: ${it.poloAtivo}`);
        if (it.poloPassivo) envolvidos.push(`Réu: ${it.poloPassivo}`);
      }

      // Detalhes embutidos para exibição imediata no modal sem requisição extra
      const detalhes = {
        sucesso: true,
        numeroCnj: cnj,
        numeroOriginal: cnj,
        desmascarado: Boolean(cnj),
        tribunal,
        forum: comarca,
        comarca,
        vara: comarca,
        classe,
        dataCriacao: dataDist || dataPub,
        valorCausa: it.valor_causa?.valor_formatado || it.valorCausa || "Não informado",
        resumoIa: null,
        partes: {
          poloAtivo: it.poloAtivo || (envolvidos[0] || null),
          poloPassivo: it.poloPassivo || (envolvidos[1] || null),
          advogados: [],
        },
        ultimaMovimentacao: {
          tipo: papel,
          data: dataPub,
          textoIntegral: textoCompleto,
        },
        movimentacoes: [
          {
            data: dataPub,
            dataHora: dataPub,
            nome: papel,
            descricao: textoCompleto,
          },
        ],
        url: it.link || it.url || (cnj ? `https://www.escavador.com/busca?q=${encodeURIComponent(cnj)}` : null),
        fonte: "BuscaProcessos API (Oficial)",
      };

      return {
        titulo: `${classe} • ${tribunal}`,
        cnj,
        cnjReal: cnj,
        status: it.situacao || "Ativo",
        origem: tribunal,
        instancia: grau,
        comarca,
        papel,
        dataInicio: dataDist,
        ultimaMovimentacao: dataPub,
        envolvidos,
        url: it.link || it.url || (cnj ? `https://www.escavador.com/busca?q=${encodeURIComponent(cnj)}` : null),
        detalhesCarregados: true,
        detalhes,
      };
    });

    const dorks = gerarDorksPorNome(termo);
    const tribunaisUnicos = Array.from(new Set(processosMapeados.map((p) => p.origem).filter(Boolean)));
    const classesUnicas = Array.from(new Set(items.map((i) => i.classe || i.nome).filter(Boolean)));
    const totalGeral = dataObj.paginator?.total ?? dataObj.total ?? processosMapeados.length;

    return {
      success: true,
      tipoBusca: "parte",
      alvo: termo,
      dados: {
        termo,
        tipo: "Nome de Parte / Advogado",
        fonte: "BuscaProcessos API (Oficial)",
        escavador: {
          nome: termo,
          url: `https://buscaprocessos.app.br`,
          totalProcessos: totalGeral,
          descricaoGeral: `Publicações e litígios judiciais indexados na BuscaProcessos para ${termo}.`,
          resumo: `Localizados ${processosMapeados.length} processos judiciais para "${termo}".`,
          polosAtuacao: [],
          estados: tribunaisUnicos.map((t) => ({ estado: t, total: 1 })),
          assuntos: classesUnicas,
          processosRecentes: processosMapeados,
        },
        dorks,
        linksDiretos: {
          jusbrasil: `https://www.jusbrasil.com.br/busca?q=${encodeURIComponent(termo)}`,
          escavador: `https://www.escavador.com/busca?q=${encodeURIComponent(termo)}`,
          djen: "https://comunica.pje.jus.br/",
          datajud: "https://comunica.pje.jus.br/",
        },
      },
      timestamp: new Date().toISOString(),
    };
  }
}

export const buscaProcessosService = new BuscaProcessosService();
