/**
 * ==============================================================================
 * RIMUBUSCA - HTTP CLIENT WRAPPER (HTTPCLIENT.JS)
 * Fetch server-side seguro com AbortController (timeout de 8s padrão) e headers
 * ==============================================================================
 */

export async function httpRequest(url, options = {}) {
  // Timeout de 45s para garantir que APIs externas mais lentas (bases governamentais/operadoras) não sofram interrupção
  const timeoutMs = options.timeout || 45000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const config = {
    ...options,
    signal: controller.signal,
    headers: {
      'User-Agent': 'RimuBusca-OSINT-Core/1.0',
      'Accept': 'application/json',
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    clearTimeout(timeoutId);

    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await response.json() : await response.text();

    return {
      ok: response.ok,
      status: response.status,
      headers: response.headers,
      data,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Timeout na requisição para ${url} (excedeu ${timeoutMs}ms)`);
    }
    throw err;
  }
}

