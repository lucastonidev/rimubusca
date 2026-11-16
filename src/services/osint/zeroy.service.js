import { httpRequest } from "../core/httpClient.js";
import { hubApiService } from "./hubapi.service.js";
import { cacheService } from "../core/cache.service.js";
import { interpretZeroy } from "./interpreter/index.js";

/**
 * ==============================================================================
 * RIMUBUSCA - CLASSE DE SERVIÇO DA ZEROY API (ZEROY.SERVICE.JS)
 * ==============================================================================
 */
export class ZeroyService {
  constructor() {
    this.baseUrl = (process.env.ZEROY_API_URL || "https://zeroyapi.online").replace(/\/+$/, "");
    this.apiKey = process.env.ZEROY_API_KEY || "";
    this.timeout = Number(process.env.ZEROY_TIMEOUT_MS) || 25000; // 25s padrão configurável
  }

  /**
   * Gerador de dados simulados realistas para testes em ambiente de desenvolvimento (MOCK_MODE=true)
   */
  gerarMockZeroy(meta, termo, paramsObjeto, tipoPix) {
    const termoStr = String(termo || "").trim();
    const agora = new Date().toISOString();
    const idLower = String(meta.id || "").toLowerCase();

    // Mock para Veículos e Frota
    if (meta.categoria === "veiculos" || idLower.includes("placa") || idLower.includes("chassi") || idLower.includes("motor")) {
      return {
        status: "sucesso",
        modulo: meta.nome,
        consulta: termoStr,
        dados_veiculo: {
          placa: idLower.includes("placa") ? termoStr.toUpperCase() : "BRA2E19",
          marca_modelo: "VOLKSWAGEN / POLO TRACK 1.0",
          ano_fabricacao: 2023,
          ano_modelo: 2024,
          cor: "PRATA",
          chassi: "9BWZZZ377VT004251",
          motor: "EA211-987654",
          renavam: "01234567890",
          combustivel: "FLEX",
          municipio_emplacamento: "SÃO PAULO / SP",
          situacao_veiculo: "CIRCULAÇÃO REGULAR (SEM RESTRICOES)",
          valor_fipe: "R$ 78.490,00",
          restricoes: {
            furto_roubo: "NADA CONSTA",
            alienacao_fiduciaria: "NENHUMA",
            multas_ativas: 0,
          },
          proprietario_atual: {
            nome: "CARLOS EDUARDO DA SILVA PEREIRA",
            documento: "***.452.190-**",
          },
        },
        aviso: "Dados simulados em ambiente de desenvolvimento (MOCK_MODE=true). Para conexão real de produção, configure MOCK_MODE=false.",
        timestamp: agora,
      };
    }

    // Mock para Financeiro, Score e PIX
    if (meta.categoria === "financeiro" || idLower.includes("score") || idLower.includes("pix") || idLower.includes("banco")) {
      return {
        status: "sucesso",
        modulo: meta.nome,
        consulta: termoStr,
        dados_financeiros: {
          score_credito: 840,
          faixa_classificacao: "Excelente / Baixo Risco de Inadimplência",
          probabilidade_pagamento: "94.2%",
          chave_pix: tipoPix || termoStr,
          titular_conta: "CARLOS EDUARDO DA SILVA PEREIRA",
          instituicao_financeira: "Nu Pagamentos S.A. (Nubank - 260)",
          agencia: "0001",
          tipo_chave: idLower.includes("telefone") ? "TELEFONE" : (idLower.includes("email") ? "EMAIL" : "CPF"),
          restricoes_financeiras: {
            protestos_nacionais: 0,
            cheques_sem_fundo: 0,
            pendencias_ativas: 0,
          },
        },
        aviso: "Dados simulados em ambiente de desenvolvimento (MOCK_MODE=true).",
        timestamp: agora,
      };
    }

    // Mock para Telefonia e Telecom
    if (idLower.includes("telefone") || meta.param === "telefone") {
      return {
        status: "sucesso",
        modulo: meta.nome,
        consulta: termoStr,
        dados_linha: {
          numero_completo: termoStr,
          ddd: termoStr.slice(0, 2),
          operadora_atual: "Vivo (Telefônica Brasil)",
          operadora_original: "Vivo",
          tipo_linha: "Móvel Celular (Pós-Pago)",
          portabilidade: "Não",
          titular: {
            nome: "CARLOS EDUARDO DA SILVA PEREIRA",
            cpf: "***.452.190-**",
            data_nascimento: "14/08/1986",
            mae: "MARIA APARECIDA DA SILVA PEREIRA",
          },
          endereco_instalacao: {
            logradouro: "Rua das Palmeiras",
            numero: "450",
            bairro: "Centro",
            cidade: "Florianópolis",
            uf: "SC",
            cep: "88015-100",
          },
        },
        aviso: "Dados simulados em ambiente de desenvolvimento (MOCK_MODE=true).",
        timestamp: agora,
      };
    }

    // Mock Cadastral Geral (CPF, CNPJ, Nome, CNH, etc.)
    return {
      status: "sucesso",
      modulo: meta.nome,
      consulta: termoStr,
      dados_cadastrais: {
        documento_pesquisado: termoStr,
        nome_completo: idLower.includes("nome") ? termoStr.toUpperCase() : "CARLOS EDUARDO DA SILVA PEREIRA",
        cpf: idLower.includes("cpf") ? termoStr : "123.456.789-00",
        cnpj: idLower.includes("cnpj") ? termoStr : null,
        situacao_receita: "REGULAR",
        data_nascimento: "14/08/1986",
        sexo: "MASCULINO",
        filiacao: {
          mae: "MARIA APARECIDA DA SILVA PEREIRA",
          pai: "JOSE CARLOS PEREIRA",
        },
        rg: "38.452.190-X SSP/SP",
        titulo_eleitor: "312456780141",
        endereco: {
          logradouro: "Avenida Paulista",
          numero: "1578",
          complemento: "Apto 102",
          bairro: "Bela Vista",
          cidade: "São Paulo",
          uf: "SP",
          cep: "01310-200",
        },
        telefones_vinculados: [
          { numero: "(11) 98765-4321", operadora: "Vivo" },
          { numero: "(48) 98477-7823", operadora: "Claro" },
        ],
      },
      aviso: "Dados simulados em ambiente de desenvolvimento (MOCK_MODE=true).",
      timestamp: agora,
    };
  }

  /**
   * Obtém a configuração do endpoint e parâmetros a partir do ID do módulo do JSON
   */
  obterMetadados(idOuTipo) {
    const termoBusca = String(idOuTipo || "placa").toLowerCase().trim();

    // 1. Tenta buscar diretamente pelo ID no catálogo central JSON
    const modulo =
      hubApiService.getModuleById(termoBusca) ||
      hubApiService.modules.find(
        (m) =>
          m.id === termoBusca ||
          m.id.toLowerCase() === termoBusca ||
          (m.path && m.path.toLowerCase().endsWith(`/${termoBusca}`))
      );

    if (modulo) {
      let apiPath = modulo.path || `/api/v1/${modulo.id}`;
      if (!apiPath.startsWith("/")) apiPath = `/${apiPath}`;
      // Corrige eventuais ausências de barra
      apiPath = apiPath.replace(/^\/api\/v1([^\/])/, "/api/v1/$1");
      if (!apiPath.startsWith("/api/v1") && !apiPath.startsWith("/api/")) {
        apiPath = `/api/v1${apiPath}`;
      }

      return {
        id: modulo.id,
        nome: modulo.nome,
        path: apiPath,
        param: modulo.parametro || "cpf",
        label: modulo.parametroLabel || modulo.nome,
        placeholder: modulo.placeholder || "Informe o valor...",
        custo: modulo.custo || 0.1,
      };
    }

    // 2. Fallback de segurança caso seja passado um tipo que não esteja no JSON
    return {
      id: termoBusca,
      nome: `Módulo ${termoBusca.toUpperCase()}`,
      path: `/api/v1/${termoBusca}`,
      param: termoBusca,
      label: termoBusca.toUpperCase(),
      placeholder: "Informe o valor...",
      custo: 0.1,
    };
  }

  /**
   * Resolução inteligente de parâmetros para a Zeroy API
   * Trata busca simples ou avançada (CPF, CNPJ, Chave PIX, Banco, UUID, etc.)
   */
  resolverParametros(meta, input) {
    let termo = "";
    let extraBanco = "";
    let extraCpf = "";
    let extraCnpj = "";
    let extraChave = "";
    let extraTelefone = "";

    if (typeof input === "object" && input !== null) {
      termo = String(
        input.termo ||
        input.valor ||
        input.nome ||
        input.parametroValor ||
        input.busca ||
        input.query ||
        ""
      ).trim();
      if (input.banco) extraBanco = String(input.banco).trim();
      if (input.cpf) extraCpf = String(input.cpf).trim();
      if (input.cnpj) extraCnpj = String(input.cnpj).trim();
      if (input.chave) extraChave = String(input.chave).trim();
      if (input.telefone) extraTelefone = String(input.telefone).trim();
    } else {
      termo = String(input || "").trim();
    }

    const raw = termo || extraTelefone || extraCpf || extraCnpj || extraChave;
    const digits = raw.replace(/\D/g, "");
    const isEmail = raw.includes("@") && raw.includes(".");
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);
    const isCpf = digits.length === 11;
    const isCnpj = digits.length === 14;
    const isTelefone = (raw.startsWith("+55") || raw.startsWith("(")) && digits.length >= 10 && digits.length <= 13;

    const q = new URLSearchParams();

    // 1. Módulo Chave PIX (id: chave-pix): aceita ESTRITAMENTE 'cpf' ou 'cnpj'
    if (meta.id === "chave-pix") {
      if (extraCnpj || isCnpj) {
        q.set("cnpj", (extraCnpj || digits).replace(/\D/g, ""));
      } else {
        q.set("cpf", (extraCpf || digits || raw).replace(/\D/g, ""));
      }
    }
    // 2. Módulo PIX Bacen (id: pix-bacen): aceita 'chave' (CPF, CNPJ, Telefone, E-mail ou EVP) ou 'cpf' (titular)
    else if (meta.id === "pix-bacen") {
      const tipoPix = (typeof input === "object" && input !== null) ? (input.tipoPix || input.tipo_pix) : "";
      if (tipoPix === "cpf_titular") {
        q.set("cpf", digits);
      } else if (tipoPix === "chave_cpf") {
        q.set("chave", digits);
      } else if (tipoPix === "chave_cnpj") {
        q.set("chave", digits);
      } else if (tipoPix === "chave_telefone") {
        q.set("chave", raw);
      } else if (tipoPix === "chave_email") {
        q.set("chave", raw.toLowerCase());
      } else if (tipoPix === "chave_evp") {
        q.set("chave", raw.toLowerCase());
      } else {
        if (extraCpf) {
          q.set("cpf", extraCpf.replace(/\D/g, ""));
        } else if (extraChave) {
          q.set("chave", extraChave);
        } else if (isEmail || isUUID || isTelefone) {
          q.set("chave", raw);
        } else if (isCpf) {
          q.set("cpf", digits);
        } else if (isCnpj) {
          q.set("chave", digits);
        } else {
          q.set("chave", raw);
        }
      }
    }
    // 3. Módulo PIX SISBAJUD (id: pix-sisbajud): aceita 'cpf' (CPF ou CNPJ), 'banco' (opcional) e 'chave' (Chave PIX ou UUID judicial)
    else if (meta.id === "pix-sisbajud") {
      if (extraCpf) {
        q.set("cpf", extraCpf.replace(/\D/g, ""));
      } else if (extraChave) {
        q.set("chave", extraChave);
      } else if (isEmail || isUUID || isTelefone) {
        q.set("chave", raw);
      } else if (isCpf || isCnpj) {
        q.set("cpf", digits);
      } else {
        q.set("cpf", raw);
      }

      if (extraBanco) {
        q.set("banco", extraBanco.toUpperCase());
      }
    }
    // 4. Módulo Frota: aceita CPF ou CNPJ
    else if (meta.id === "frota") {
      if (isCnpj) {
        q.set("cnpj", digits);
      } else {
        q.set("cpf", digits || raw);
      }
    }
    // 5. Demais módulos do catálogo
    else {
      const paramName = meta.param || "cpf";
      if (paramName === "cpf") {
        q.set("cpf", digits);
      } else if (paramName === "cnpj") {
        q.set("cnpj", digits);
      } else if (paramName === "telefone" || meta.id === "telefone") {
        let cleanPhone = digits;
        if (cleanPhone.length > 11 && cleanPhone.startsWith("55")) {
          cleanPhone = cleanPhone.slice(2);
        }
        q.set("telefone", cleanPhone);
      } else if (paramName === "cep") {
        q.set("cep", digits);
      } else if (paramName === "cns") {
        q.set("cns", digits);
      } else if (paramName === "renavam") {
        q.set("renavam", digits);
      } else if (paramName === "placa") {
        q.set("placa", raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase());
      } else if (paramName === "chassi") {
        q.set("chassi", raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase());
      } else if (paramName === "motor") {
        q.set("motor", raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase());
      } else {
        q.set(paramName, raw);
      }
    }

    let termoPrincipal = raw;
    if (meta.id === "telefone" || meta.param === "telefone") {
      let cleanPhone = digits;
      if (cleanPhone.length > 11 && cleanPhone.startsWith("55")) {
        cleanPhone = cleanPhone.slice(2);
      }
      termoPrincipal = cleanPhone;
    }

    return {
      queryString: q.toString(),
      paramsObjeto: Object.fromEntries(q.entries()),
      termoPrincipal,
      tipoPix: (typeof input === "object" && input !== null) ? (input.tipoPix || input.tipo_pix || null) : null,
    };
  }

  /**
   * Conecta diretamente à Zeroy API oficial de produção
   * Realiza a requisição HTTP real montando a URL a partir do path do JSON.
   * Suporta cache inteligente multi-tier e forceRefresh opcional.
   */
  async consultar(idOuTipo, input, options = {}) {
    const cleanId = String(idOuTipo || "placa").toLowerCase().trim();
    const forceRefresh = Boolean(
      options.forceRefresh ||
      (typeof input === "object" && input !== null && (input.forceRefresh || input.noCache))
    );

    const meta = this.obterMetadados(cleanId);
    const { queryString, paramsObjeto, termoPrincipal, tipoPix } = this.resolverParametros(meta, input);

    if (!queryString || !termoPrincipal) {
      throw new Error("O valor de busca não foi informado.");
    }

    // 1. Verificação no Sistema de Cache Multi-Tier (Vercel-proof)
    if (!forceRefresh) {
      try {
        const cached = await cacheService.get(meta.id, termoPrincipal);
        if (cached && cached.data) {
          console.log(`[ZEROY API CACHE HIT] Módulo: ${meta.id} (${termoPrincipal}) via ${cached.source}`);
          return {
            id: meta.id,
            tipo: meta.id,
            path: meta.path,
            parametro: meta.param,
            parametrosUsados: paramsObjeto,
            tipoPix: tipoPix || (paramsObjeto.cpf ? "cpf_titular" : (paramsObjeto.chave ? "chave" : null)),
            termo: termoPrincipal,
            fonte: `Zeroy API (${cached.source === "memory" ? "Cache Memória" : "Cache Persistente"})`,
            urlConsultada: `${this.baseUrl}${meta.path}?${queryString}`,
            cached: true,
            cacheSource: cached.source,
            timestamp: cached.cachedAt,
            dados: cached.data,
          };
        }
      } catch (cacheErr) {
        console.warn("[ZEROY CACHE READ ERROR]:", cacheErr.message);
      }
    }

    // 2. Modo Simulação / Desenvolvimento (MOCK_MODE=true)
    if (process.env.MOCK_MODE === "true") {
      console.log(`[ZEROY MOCK ENGINE] Módulo: ${meta.id} (${termoPrincipal}) simulado localmente via MOCK_MODE=true`);
      const mockData = this.gerarMockZeroy(meta, termoPrincipal, paramsObjeto, tipoPix);

      // Grava no cache para simulação completa do ciclo de vida da aplicação
      try {
        await cacheService.set(meta.id, termoPrincipal, mockData);
      } catch (cacheSaveErr) {
        console.warn("[ZEROY CACHE SAVE ERROR]:", cacheSaveErr.message);
      }

      return {
        id: meta.id,
        tipo: meta.id,
        path: meta.path,
        parametro: meta.param,
        parametrosUsados: paramsObjeto,
        tipoPix: tipoPix || (paramsObjeto.cpf ? "cpf_titular" : (paramsObjeto.chave ? "chave" : null)),
        termo: termoPrincipal,
        fonte: "Zeroy API (Simulação Local - MOCK_MODE=true)",
        urlConsultada: `https://zeroyapi.online${meta.path}?${queryString}`,
        cached: false,
        timestamp: new Date().toISOString(),
        dados: mockData,
      };
    }

    // 2.1 Tratamento resiliente para Módulo CEP & Endereçamento
    // A Zeroy API não dispõe de endpoint ativo para CEP (/api/v1/cep retorna 404).
    // Delegamos transparentemente para o motor oficial multi-provider de CEP/Endereço:
    if (cleanId === "cep" || meta.id === "cep" || meta.param === "cep") {
      try {
        console.log(`[ZEROY CEP DELEGADO] Consultando CEP '${termoPrincipal}' via motor multi-provider oficial...`);
        const { consultarEnderecoCep } = await import("./cep.service.js");
        const cepResultado = await consultarEnderecoCep(termoPrincipal);

        if (cepResultado) {
          const resultadoNormalizado = {
            status: "sucesso",
            modulo: meta.nome || "Módulo CEP",
            consulta: termoPrincipal,
            dados: cepResultado,
            timestamp: new Date().toISOString(),
          };

          cacheService.set(meta.id, termoPrincipal, resultadoNormalizado).catch(() => {});

          return {
            id: meta.id,
            tipo: meta.id,
            path: meta.path,
            parametro: meta.param,
            parametrosUsados: paramsObjeto,
            termo: termoPrincipal,
            fonte: cepResultado.fonte || "DNE / Correios / IBGE Oficial",
            urlConsultada: `https://zeroyapi.online${meta.path}?${queryString}`,
            cached: false,
            timestamp: new Date().toISOString(),
            dados: resultadoNormalizado,
          };
        }
      } catch (cepErr) {
        console.warn(`[ZEROY CEP DELEGADO ERRO]: ${cepErr.message}`);
        throw cepErr;
      }
    }

    const apiKey = process.env.ZEROY_API_KEY || this.apiKey;
    const baseUrl = (process.env.ZEROY_API_URL || this.baseUrl).replace(/\/+$/, "");

    if (!apiKey || apiKey.trim() === "") {
      throw new Error(
        "A chave da Zeroy API não foi configurada no arquivo .env (ZEROY_API_KEY). Insira sua chave para realizar a conexão real ou ative MOCK_MODE=true."
      );
    }

    const url = `${baseUrl}${meta.path}?${queryString}`;

    console.log(`[ZEROY API CONEXÃO ATIVA] Módulo: ${meta.id} | GET ${url}`);

    try {
      const response = await httpRequest(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
        timeout: this.timeout,
      });
      
      // Sucesso HTTP (200 - 299)
      if (response.ok && response.data) {
        let responseData = response.data;
        if (typeof responseData === "string") {
          try {
            responseData = JSON.parse(responseData);
          } catch {
            // Mantém string caso não seja JSON
          }
        }

        // Normalização via Backend Interpreter
        responseData = interpretZeroy(meta.id, responseData);

        // Grava no cache de forma assíncrona não bloqueante
        cacheService.set(meta.id, termoPrincipal, responseData).catch((cacheSaveErr) => {
          console.warn("[ZEROY CACHE SAVE ERROR]:", cacheSaveErr.message);
        });

        return {
          id: meta.id,
          tipo: meta.id,
          path: meta.path,
          parametro: meta.param,
          parametrosUsados: paramsObjeto,
          tipoPix: tipoPix || (paramsObjeto.cpf ? "cpf_titular" : (paramsObjeto.chave ? "chave" : null)),
          termo: termoPrincipal,
          fonte: "Zeroy API (Conexão Oficial)",
          urlConsultada: url,
          cached: false,
          timestamp: new Date().toISOString(),
          dados: responseData,
        };
      }

      // Tratamento detalhado de respostas de erro retornadas diretamente pela Zeroy API
      let errorMsg = null;
      if (response.data && typeof response.data === "object") {
        errorMsg = response.data.error || response.data.message || response.data.msg || response.data.detalhes;
      } else if (typeof response.data === "string" && response.data.length > 0) {
        // Se a resposta for HTML (ex: 404 do Next.js da Zeroy, Cloudflare, etc.), NÃO vaza HTML bruto
        if (
          response.data.trim().startsWith("<") ||
          response.data.includes("<html") ||
          response.data.includes("<!DOCTYPE") ||
          response.data.includes("<body")
        ) {
          errorMsg = null;
        } else {
          errorMsg = response.data;
        }
      }

      if (!errorMsg) {
        if (response.status === 401) {
          errorMsg = "Token da Zeroy API inválido ou não autorizado (401 Unauthorized). Verifique sua ZEROY_API_KEY no .env.";
        } else if (response.status === 402 || response.status === 403) {
          errorMsg = "Saldo insuficiente ou sem permissão na sua conta Zeroy API (402/403).";
        } else if (response.status === 404) {
          errorMsg = `Nenhum registro localizado na Zeroy API para ${meta.label || meta.nome || meta.id}: "${termoPrincipal}".`;
        } else if (response.status === 429) {
          errorMsg = "Limite de requisições excedido na Zeroy API (Rate Limit 429). Aguarde alguns instantes.";
        } else {
          errorMsg = `A Zeroy API retornou erro HTTP ${response.status}.`;
        }
      }

      throw new Error(errorMsg);
    } catch (err) {
      console.error(`[ZEROY API ERRO DE CONEXÃO]:`, err.message);

      if (err.message && err.message.includes("Timeout")) {
        throw new Error(
          `A Zeroy API (${baseUrl}) não respondeu dentro do tempo limite para o módulo '${meta.id}'. Os servidores da Zeroy API estão temporariamente instáveis ou o saldo de consultas da sua chave pode ter esgotado no painel da Zeroy. Para testar sem depender da rede externa, ative MOCK_MODE=true no seu arquivo .env.`
        );
      }

      throw new Error(err.message);
    }
  }
}

// Instância Singleton exportada
export const zeroyService = new ZeroyService();

// Funções helper para compatibilidade direta
export const consultarZeroyApi = (params) => zeroyService.consultar(params.id || params.tipo, params.termo);
export const obterMetadadosTipo = (tipo) => zeroyService.obterMetadados(tipo);
