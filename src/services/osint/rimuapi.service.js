/**
 * ==============================================================================
 * RIMUBUSCA - CLIENTE OFICIAL RIMUAPI (SANT BUSCAS API ENGINE)
 * src/services/osint/rimuapi.service.js
 * 
 * Engine de consultas criptografadas & padronizadas com suporte oficial aos
 * 43 módulos da RimuAPI (Pessoa, Contato, Endereço, Veículos, Financeiro,
 * Empresa & Jurídico, Família, Vazados & Segurança, Geradores & Lotes).
 * ==============================================================================
 */

/**
 * Recupera e valida as configurações oficiais da RimuAPI a partir do .env
 */
export function getRimuApiConfig() {
  const rawUrl = process.env.RIMUAPI_URL || "https://rimuapi.vercel.app";
  const baseUrl = String(rawUrl).trim().replace(/\/+$/, "");
  const apiKey = (process.env.RIMUAPI_KEY || "").trim();
  const isConfigured = Boolean(baseUrl && apiKey);

  // Autenticação básica obrigatória em instâncias remotas (Vercel)
  const basicUser = process.env.RIMUAPI_BASIC_USER !== undefined ? process.env.RIMUAPI_BASIC_USER : "admin";
  const basicPass = process.env.RIMUAPI_BASIC_PASS !== undefined ? process.env.RIMUAPI_BASIC_PASS : "";
  const basicAuthHeader = "Basic " + Buffer.from(`${basicUser}:${basicPass}`).toString("base64");

  return { baseUrl, apiKey, isConfigured, basicAuthHeader };
}

/**
 * Cliente HTTP universal para a RimuAPI (Sant Buscas Engine)
 * Rota única: POST /api/consultar
 *
 * @param {Object} options
 * @param {string} options.tipo - Identificador de um dos 43 módulos oficiais
 * @param {string|number} options.chave - Termo principal de busca (CPF, CNPJ, Placa, Nome, etc.)
 * @param {string|number} [options.param2] - Parâmetro secundário opcional (ex: UF no RG, Número no CEP)
 * @param {Object} [options.params] - Objeto para consultas avançadas (ex: cep_avancado)
 * @param {number} [options.timeout=90000] - Tempo limite em ms (padrão 90s)
 * @returns {Promise<any[]>} Retorna sempre o array em dados.response
 */
export async function consultarRimuApi({
  tipo,
  chave,
  param2 = null,
  params = null,
  timeout = 90000,
}) {
  const { baseUrl, apiKey, isConfigured, basicAuthHeader } = getRimuApiConfig();

  if (!isConfigured) {
    const err = new Error(
      "Chave da RimuAPI (RIMUAPI_KEY) não configurada no arquivo .env."
    );
    err.code = "UNAUTHORIZED";
    err.status = 401;
    throw err;
  }

  const endpointUrl = `${baseUrl}/api/consultar`;
  const cleanTipo = String(tipo || "").trim().toLowerCase();
  const cleanChave = String(chave !== undefined && chave !== null ? chave : "").trim();

  const payload = {
    tipo: cleanTipo,
    chave: cleanChave,
  };

  if (param2 !== undefined && param2 !== null && String(param2).trim() !== "") {
    payload.param2 = String(param2).trim();
  }

  if (params && typeof params === "object" && Object.keys(params).length > 0) {
    payload.params = params;
  }

  console.log(`[RIMUAPI] POST ${endpointUrl} -> tipo: "${cleanTipo}" | chave: "${cleanChave}"`);

  const requestHeaders = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "x-api-key": apiKey,
  };

  if (basicAuthHeader) {
    requestHeaders["Authorization"] = basicAuthHeader;
  }

  let response;
  try {
    response = await fetch(endpointUrl, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeout),
    });
  } catch (netErr) {
    if (netErr.name === "TimeoutError" || netErr.message?.includes("timeout")) {
      const timeoutErr = new Error(
        `Tempo limite excedido na RimuAPI (${Math.round(timeout / 1000)}s) ao consultar '${cleanTipo}'. A base externa demorou a responder.`
      );
      timeoutErr.code = "TIMEOUT";
      timeoutErr.status = 504;
      throw timeoutErr;
    }
    const connErr = new Error(
      `Falha na conexão com o servidor da RimuAPI (${baseUrl}): ${netErr.message}`
    );
    connErr.code = "CONNECTION_ERROR";
    connErr.status = 502;
    throw connErr;
  }

  const contentType = response.headers.get("content-type") || "";

  // Tratamento de erros HTTP
  if (!response.ok) {
    let msg = `Falha na consulta RimuAPI (HTTP ${response.status})`;
    let code = "API_ERROR";

    if (contentType.includes("application/json")) {
      try {
        const errorBody = await response.json();
        msg = errorBody.message || errorBody.error || msg;
        code = errorBody.error || code;
      } catch (_) {}
    } else if (response.status === 401) {
      msg = "Acesso não autorizado na RimuAPI. Verifique sua RIMUAPI_KEY no arquivo .env.";
      code = "UNAUTHORIZED";
    } else if (response.status === 504) {
      msg = "Servidor da RimuAPI demorou para responder (HTTP 504 Gateway Timeout).";
      code = "TIMEOUT";
    } else if (response.status === 502 || response.status === 503) {
      msg = `Servidor da RimuAPI temporariamente sobrecarregado ou indisponível (HTTP ${response.status}).`;
      code = "UNAVAILABLE";
    }

    const erro = new Error(msg);
    erro.status = response.status;
    erro.code = code;
    throw erro;
  }

  if (!contentType.includes("application/json")) {
    throw new Error(
      `Resposta inesperada da RimuAPI (Content-Type não é JSON). HTTP ${response.status}`
    );
  }

  const envelope = await response.json();

  // Validação do padrão oficial da RimuAPI:
  // { ok: true, tipo: "...", chave: "...", cache: boolean, data/dados: { status: true, response: [ ... ] } }
  if (envelope.ok === false) {
    const errMsg = envelope.message || envelope.error || "Erro retornado pela RimuAPI.";
    const err = new Error(errMsg);
    err.status = 400;
    err.code = envelope.error || "API_ERROR";
    throw err;
  }

  const inner = envelope.data || envelope.dados || envelope;
  if (inner && inner.status === false) {
    const errMsg =
      inner.message ||
      inner.erro ||
      envelope.message ||
      "Nenhum registro localizado na base oficial.";
    const err = new Error(errMsg);
    err.status = 404;
    err.code = "NOT_FOUND";
    throw err;
  }

  // O payload útil pode estar em:
  // 1. envelope.data?.response
  // 2. envelope.dados?.response
  // 3. envelope.response
  // 4. envelope.data
  // 5. envelope.dados
  // 6. envelope
  let registros =
    envelope.data?.response !== undefined
      ? envelope.data.response
      : envelope.dados?.response !== undefined
      ? envelope.dados.response
      : envelope.response !== undefined
      ? envelope.response
      : envelope.data !== undefined
      ? envelope.data
      : envelope.dados !== undefined
      ? envelope.dados
      : envelope;

  // Anexa metadados úteis se for um objeto ou array
  if (typeof registros === "object" && registros !== null) {
    try {
      Object.defineProperty(registros, "__rimuMeta", {
        enumerable: false,
        configurable: true,
        value: {
          ok: envelope.ok,
          tipo: envelope.tipo || cleanTipo,
          chave: envelope.chave || cleanChave,
          cache: Boolean(envelope.cache),
          rawEnvelope: envelope,
        },
      });
    } catch (_) {}
  }

  return registros;
}

/**
 * Objeto de conveniência com mapeamento explícito dos 43 módulos da RimuAPI
 */
export const rimuApi = {
  isConfigured: () => getRimuApiConfig().isConfigured,
  getConfig: () => getRimuApiConfig(),
  consultar: consultarRimuApi,

  // ============================================================================
  // 1. CATEGORIA: PESSOA (10 Módulos)
  // ============================================================================
  cpf: (cpf) =>
    consultarRimuApi({ tipo: "cpf", chave: String(cpf).replace(/\D/g, "") }),

  cpfCompleto: (cpf) =>
    consultarRimuApi({ tipo: "cpf_completo", chave: String(cpf).replace(/\D/g, "") }),

  nome: (nome) =>
    consultarRimuApi({ tipo: "nome", chave: String(nome).trim() }),

  nomeSimilar: (nome) =>
    consultarRimuApi({ tipo: "nome_similar", chave: String(nome).trim() }),

  rg: (rg) =>
    consultarRimuApi({ tipo: "rg", chave: String(rg).replace(/\D/g, "") || String(rg).trim() }),

  titulo: (titulo) =>
    consultarRimuApi({ tipo: "titulo", chave: String(titulo).replace(/\D/g, "") }),

  cns: (cns) =>
    consultarRimuApi({ tipo: "cns", chave: String(cns).replace(/\D/g, "") }),

  nis: (nis) =>
    consultarRimuApi({ tipo: "nis", chave: String(nis).replace(/\D/g, "") }),

  covid: (cpf) =>
    consultarRimuApi({ tipo: "covid", chave: String(cpf).replace(/\D/g, "") }),

  fotos: (cpf) =>
    consultarRimuApi({ tipo: "fotos", chave: String(cpf).replace(/\D/g, "") }),

  // ============================================================================
  // 2. CATEGORIA: CONTATO (2 Módulos)
  // ============================================================================
  telefone: (telefone) =>
    consultarRimuApi({ tipo: "telefone", chave: String(telefone).replace(/\D/g, "") }),

  email: (email) =>
    consultarRimuApi({ tipo: "email", chave: String(email).trim().toLowerCase() }),

  // ============================================================================
  // 3. CATEGORIA: ENDEREÇO (2 Módulos)
  // ============================================================================
  cep: (cep, numero) =>
    consultarRimuApi({
      tipo: "cep",
      chave: String(cep).replace(/\D/g, ""),
      param2: numero ? String(numero).trim() : null,
    }),

  cepAvancado: ({ uf, endereco, cidade, bairro, numero, complemento, cep }) =>
    consultarRimuApi({
      tipo: "cep_avancado",
      chave: endereco || cep || "Busca Endereço",
      params: {
        uf: String(uf || "").trim().toUpperCase(),
        ...(cidade ? { cidade: String(cidade).trim() } : {}),
        ...(endereco ? { endereco: String(endereco).trim() } : {}),
        ...(bairro ? { bairro: String(bairro).trim() } : {}),
        ...(numero ? { numero: String(numero).trim() } : {}),
        ...(complemento ? { complemento: String(complemento).trim() } : {}),
        ...(cep ? { cep: String(cep).replace(/\D/g, "") } : {}),
      },
    }),

  // ============================================================================
  // 4. CATEGORIA: VEÍCULOS (5 Módulos)
  // ============================================================================
  placa: (placa) =>
    consultarRimuApi({
      tipo: "placa",
      chave: String(placa).toUpperCase().replace(/[^A-Z0-9]/g, ""),
    }),

  placaGhost: (placa) =>
    consultarRimuApi({
      tipo: "placa_ghost",
      chave: String(placa).toUpperCase().replace(/[^A-Z0-9]/g, ""),
    }),

  cnh: (cnhOuCpf) =>
    consultarRimuApi({ tipo: "cnh", chave: String(cnhOuCpf).replace(/\D/g, "") }),

  chassi: (chassi) =>
    consultarRimuApi({
      tipo: "chassi",
      chave: String(chassi).toUpperCase().replace(/[^A-Z0-9]/g, ""),
    }),

  renavam: (renavam) =>
    consultarRimuApi({ tipo: "renavam", chave: String(renavam).replace(/\D/g, "") }),

  // ============================================================================
  // 5. CATEGORIA: FINANCEIRO (3 Módulos)
  // ============================================================================
  score: (cpf) =>
    consultarRimuApi({ tipo: "score", chave: String(cpf).replace(/\D/g, "") }),

  aposentado: (cpf) =>
    consultarRimuApi({ tipo: "aposentado", chave: String(cpf).replace(/\D/g, "") }),

  pis: (pisOuCpf) =>
    consultarRimuApi({ tipo: "pis", chave: String(pisOuCpf).replace(/\D/g, "") }),

  // ============================================================================
  // 6. CATEGORIA: EMPRESA & JURÍDICO (8 Módulos)
  // ============================================================================
  cnpj: (cnpj) =>
    consultarRimuApi({ tipo: "cnpj", chave: String(cnpj).replace(/\D/g, "") }),

  cnpj2: (cnpj) =>
    consultarRimuApi({ tipo: "cnpj2", chave: String(cnpj).replace(/\D/g, "") }),

  razaoSocial: (termo) =>
    consultarRimuApi({ tipo: "razao_social", chave: String(termo).trim() }),

  socios: (cpfOuCnpj) =>
    consultarRimuApi({ tipo: "socios", chave: String(cpfOuCnpj).replace(/\D/g, "") }),

  socios2: (cpfOuCnpj) =>
    consultarRimuApi({ tipo: "socios2", chave: String(cpfOuCnpj).replace(/\D/g, "") }),

  funcionarios: (cnpj) =>
    consultarRimuApi({ tipo: "funcionarios", chave: String(cnpj).replace(/\D/g, "") }),

  empregos: (cpf) =>
    consultarRimuApi({ tipo: "empregos", chave: String(cpf).replace(/\D/g, "") }),

  oab: (oab) =>
    consultarRimuApi({ tipo: "oab", chave: String(oab).trim() }),

  // ============================================================================
  // 7. CATEGORIA: FAMÍLIA (4 Módulos)
  // ============================================================================
  mae: (nomeMae) =>
    consultarRimuApi({ tipo: "mae", chave: String(nomeMae).trim() }),

  pai: (nomePai) =>
    consultarRimuApi({ tipo: "pai", chave: String(nomePai).trim() }),

  parentes: (cpf) =>
    consultarRimuApi({ tipo: "parentes", chave: String(cpf).replace(/\D/g, "") }),

  arvoreFamiliar: (cpf) =>
    consultarRimuApi({ tipo: "arvore_familiar", chave: String(cpf).replace(/\D/g, "") }),

  // ============================================================================
  // 8. CATEGORIA: VAZADOS & SEGURANÇA (5 Módulos)
  // ============================================================================
  desmascarador: (termo, nome) =>
    consultarRimuApi({
      tipo: "desmascarador",
      chave: String(termo).replace(/\D/g, ""),
      param2: nome ? String(nome).trim().toUpperCase() : null,
    }),

  cloudUrl: (urlOuDominio) =>
    consultarRimuApi({ tipo: "cloud_url", chave: String(urlOuDominio).trim() }),

  cloudUsuario: (usuario) =>
    consultarRimuApi({ tipo: "cloud_usuario", chave: String(usuario).trim() }),

  senha: (senhaOuHash) =>
    consultarRimuApi({ tipo: "senha", chave: String(senhaOuHash).trim() }),

  dumpCpf: (termo) =>
    consultarRimuApi({ tipo: "dump_cpf", chave: String(termo).trim() }),

  // ============================================================================
  // 9. CATEGORIA: GERADORES & LOTES (4 Módulos)
  // ============================================================================
  dumpEmail: (dominio) =>
    consultarRimuApi({ tipo: "dump_email", chave: String(dominio).trim() }),

  dumpTelefone: (dddOuPrefixo) =>
    consultarRimuApi({ tipo: "dump_telefone", chave: String(dddOuPrefixo).trim() }),

  geradorEstado: (uf) =>
    consultarRimuApi({ tipo: "gerador_estado", chave: String(uf).trim().toUpperCase() }),

  geradorCbo: (cboOuNome) =>
    consultarRimuApi({ tipo: "gerador_cbo", chave: String(cboOuNome).trim() }),
};

export default rimuApi;
