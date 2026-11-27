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
 * Sanitiza um telefone brasileiro removendo DDI (+55 / 55) e zero à esquerda,
 * preservando estritamente DDD (2 dígitos) + número (8 ou 9 dígitos).
 * @param {string|number} val
 * @returns {string}
 */
export function limparTelefoneBr(val) {
  const rawStr = String(val || "").trim();
  let digits = rawStr.replace(/\D/g, "");
  if (
    (rawStr.startsWith("+55") && digits.length > 2 && digits.startsWith("55")) ||
    (digits.length >= 12 && digits.startsWith("55"))
  ) {
    digits = digits.slice(2);
  }
  if (digits.length >= 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 11);
}

/**
 * Recupera e valida as configurações oficiais da RimuAPI a partir do .env
 */
export function getRimuApiConfig() {
  const rawUrl =
    process.env.RIMUAPI_URL ||
    process.env.RIMU_API_URL ||
    process.env.PESSOA_API_URL ||
    "https://rimuapi.vercel.app";
  const baseUrl = String(rawUrl).trim().replace(/\/+$/, "");
  const apiKey = (
    process.env.RIMUAPI_KEY ||
    process.env.RIMU_API_KEY ||
    process.env.RIMUAPI_TOKEN ||
    process.env.RIMU_KEY ||
    process.env.RIMUAPIKEY ||
    process.env.PESSOA_API_KEY ||
    process.env.API_KEY ||
    ""
  ).trim();

  // Autenticação básica requerida pela RimuAPI remota (padrão admin: quando não houver senha no .env)
  const basicUser =
    process.env.RIMUAPI_BASIC_USER ||
    process.env.RIMU_BASIC_USER ||
    process.env.BASIC_AUTH_USER ||
    "admin";
  const basicPass =
    process.env.RIMUAPI_BASIC_PASS ||
    process.env.RIMU_BASIC_PASS ||
    process.env.BASIC_AUTH_PASS ||
    "";
  const basicAuthHeader = "Basic " + Buffer.from(`${basicUser}:${basicPass}`).toString("base64");

  // Está configurado se houver URL base e chave da RimuAPI
  const isConfigured = Boolean(baseUrl && (apiKey || baseUrl.includes("rimuapi")));

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
      "Endpoint da RimuAPI não configurado. Defina a variável RIMUAPI_URL ou RIMUAPI_KEY na Vercel."
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
  };

  if (apiKey) {
    requestHeaders["x-api-key"] = apiKey;
  }

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
      msg = "Acesso não autorizado na RimuAPI (HTTP 401). Verifique sua variável RIMUAPI_KEY no painel da Vercel e certifique-se de fazer um Redeploy da aplicação.";
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

  // O payload útil pode estar em response ou conteudo dentro de data/dados ou na raiz.
  // Evita selecionar response vazio quando conteudo trouxer dados úteis (ex: CNA_ADVOGADOS em OAB).
  const hasUsefulPayload = (val) => {
    if (val === undefined || val === null) return false;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === "object") return Object.keys(val).length > 0;
    return String(val).trim() !== "";
  };

  const candidates = [
    envelope.data?.response,
    envelope.data?.conteudo,
    envelope.dados?.response,
    envelope.dados?.conteudo,
    envelope.response,
    envelope.conteudo,
    envelope.data,
    envelope.dados,
  ];

  let registros = candidates.find(hasUsefulPayload);
  if (registros === undefined) {
    registros = candidates.find((c) => c !== undefined && c !== null) ?? envelope;
  }

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
    consultarRimuApi({ tipo: "telefone", chave: limparTelefoneBr(telefone) }),

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

  socios: (cnpj) =>
    consultarRimuApi({ tipo: "socios", chave: String(cnpj).replace(/\D/g, "") }),

  socios2: (cnpj) =>
    consultarRimuApi({ tipo: "socios2", chave: String(cnpj).replace(/\D/g, "") }),

  funcionarios: (cnpj) =>
    consultarRimuApi({ tipo: "funcionarios", chave: String(cnpj).replace(/\D/g, "") }),

  empregos: (cpf) =>
    consultarRimuApi({ tipo: "empregos", chave: String(cpf).replace(/\D/g, "") }),

  oab: (oab, uf = null) =>
    consultarRimuApi({ tipo: "oab", chave: String(oab).trim(), param2: uf ? String(uf).trim().toUpperCase() : null }),

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
