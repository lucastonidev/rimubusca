/**
 * ==============================================================================
 * RIMUBUSCA - CLIENTE OFICIAL HEXYS API (HEXYS.SERVICE.JS)
 * Integração de alta performance para a página principal (/advanced/person).
 * Suporta consultas de CPF, Telefone, Nome, CEP, Operadora, Foto Facial,
 * Placa veicular, E-mail, Vizinhos e Título de Eleitor.
 * ==============================================================================
 */

function getHexysConfig() {
  const rawUrl = process.env.PESSOA_API_URL || "https://api.hexys.dev";
  const baseUrl = rawUrl.replace(/\/+$/, "");
  const apiKey = (process.env.PESSOA_API_KEY || "").trim();

  const isConfigured =
    Boolean(apiKey) &&
    apiKey !== "sua_chave_api_pessoa_aqui" &&
    apiKey !== "COLE_SUA_CHAVE_AQUI";

  return { baseUrl, apiKey, isConfigured };
}

/**
 * Executa uma requisição direta aos endpoints da Hexys API
 * @param {string} rota - Endpoint sem barra inicial (ex: 'cpf', 'foto/all')
 * @param {Object} parametros - Query params a serem enviados
 * @returns {Promise<any>}
 */
export async function consultarHexys(rota, parametros = {}) {
  const { baseUrl, apiKey, isConfigured } = getHexysConfig();

  if (!isConfigured) {
    throw new Error("Chave da API Hexys (PESSOA_API_KEY) não configurada no .env.");
  }

  const url = new URL(`/api/v1/consultas/${rota}`, baseUrl);

  for (const [nome, valor] of Object.entries(parametros)) {
    if (valor !== undefined && valor !== null && valor !== "") {
      url.searchParams.set(nome, String(valor));
    }
  }

  console.log(`[HEXYS API] Consultando /api/v1/consultas/${rota} -> ${url.search}`);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json, image/jpeg, image/png, image/gif, image/webp",
      "x-api-key": apiKey,
    },
    signal: AbortSignal.timeout(90000),
  });

  const contentType = response.headers.get("content-type") || "";

  // 1. Resposta em formato binário de imagem (ex: foto/all)
  if (response.ok && contentType.startsWith("image/")) {
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const mime = contentType.split(";")[0];
    const base64 = Buffer.from(bytes).toString("base64");

    return {
      isImage: true,
      contentType: mime,
      base64: `data:${mime};base64,${base64}`,
      bytesLength: bytes.length,
      resultado: {
        fotoBase64: `data:${mime};base64,${base64}`,
        contentType: mime,
        tamanhoBytes: bytes.length,
      },
    };
  }

  // 2. Tratamento robusto de erros HTTP (incluindo timeouts 504 do Cloudflare/upstream)
  if (!response.ok) {
    let msg = `Falha na consulta Hexys (HTTP ${response.status})`;
    let code = "HEXYS_ERROR";

    if (contentType.includes("application/json")) {
      try {
        const payloadErr = await response.json();
        msg = payloadErr.error?.message || payloadErr.message || msg;
        code = payloadErr.error?.code || code;
      } catch (_) {}
    } else if (response.status === 504) {
      msg = "Servidor da Hexys indisponível ou tempo limite esgotado (HTTP 504 Gateway Timeout)";
      code = "HEXYS_TIMEOUT";
    } else if (response.status === 502 || response.status === 503) {
      msg = `Servidor da Hexys temporariamente sobrecarregado ou em manutenção (HTTP ${response.status})`;
      code = "HEXYS_UNAVAILABLE";
    }

    const erro = new Error(msg);
    erro.status = response.status;
    erro.code = code;
    erro.retryAfter = response.headers.get("retry-after");
    throw erro;
  }

  if (!contentType.includes("application/json")) {
    throw new Error(`Resposta inesperada da API Hexys. HTTP ${response.status}`);
  }

  const payload = await response.json();

  // 3. A origem pode retornar HTTP 200 com success: false (ex: NOT_FOUND)
  if (payload.success === false) {
    const erro = new Error(
      payload.error?.message || `Falha na consulta Hexys (HTTP ${response.status})`
    );
    erro.status = response.status;
    erro.code = payload.error?.code || "HEXYS_ERROR";
    erro.retryAfter = response.headers.get("retry-after");
    throw erro;
  }

  return payload.data;
}

export const hexysApi = {
  isConfigured: () => getHexysConfig().isConfigured,

  cpf: (cpf) =>
    consultarHexys("cpf", { cpf: String(cpf).replace(/\D/g, "") }),

  telefone: (telefone) =>
    consultarHexys("telefone", { telefone: String(telefone).replace(/\D/g, "") }),

  nome: (nome, uf) =>
    consultarHexys("nome", { nome: String(nome).trim(), uf }),

  cep: (cep) =>
    consultarHexys("cep", { cep: String(cep).replace(/\D/g, "") }),

  operadora: (telefone) =>
    consultarHexys("operadora", { telefone: String(telefone).replace(/\D/g, "") }),

  foto: (cpf) =>
    consultarHexys("foto/all", { cpf: String(cpf).replace(/\D/g, "") }),

  placa: (placa) =>
    consultarHexys("placa", {
      placa: String(placa).toUpperCase().replace(/[^A-Z0-9]/g, ""),
    }),

  email: (email) =>
    consultarHexys("email", { email: String(email).trim().toLowerCase() }),

  vizinhos: (cpf) =>
    consultarHexys("vizinhos", { cpf: String(cpf).replace(/\D/g, "") }),

  titulo: (titulo) =>
    consultarHexys("titulo", { titulo: String(titulo).replace(/\D/g, "") }),
};

export default hexysApi;

