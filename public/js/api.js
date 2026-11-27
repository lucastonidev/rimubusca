/**
 * ==============================================================================
 * RIMUBUSCA - API CLIENT WRAPPER (API.JS)
 * Fetch padronizado com timeout AbortController (10s), headers e tratamento de erros
 * ==============================================================================
 */

class ApiClient {
  constructor(timeoutMs = 45000) {
    this.timeoutMs = timeoutMs;
  }

  async request(endpoint, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || this.timeoutMs);

    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const defaultHeaders = {
      'Accept': 'application/json',
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    };

    const config = {
      ...options,
      signal: controller.signal,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    if (config.body && typeof config.body === 'object' && !isFormData) {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(endpoint, config);
      clearTimeout(timeoutId);

      // Tratamento de Sessão Expirada / Não Autorizada (401)
      if (response.status === 401) {
        if (window.toast) {
          window.toast.error('Sua sessão expirou. Redirecionando para autenticação...');
        }
        setTimeout(() => {
          window.location.href = `/login?error=sessao_expirada&redirect=${encodeURIComponent(window.location.pathname)}`;
        }, 1200);
        throw new Error('Sessão expirada (401)');
      }

      // Tratamento de Permissão Insuficiente (403)
      if (response.status === 403) {
        const errorData = await response.json().catch(() => ({}));
        const msg = errorData.error || 'Acesso negado: permissões insuficientes.';
        if (window.toast) window.toast.error(msg, 'Acesso Negado (403)');
        throw new Error(msg);
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg = data.error || `Erro de comunicação com o servidor (${response.status})`;
        const err = new Error(errorMsg);
        err.data = data;
        err.status = response.status;
        throw err;
      }

      return data;
    } catch (err) {
      clearTimeout(timeoutId);

      if (err.name === 'AbortError') {
        const seg = Math.round((options.timeout || this.timeoutMs) / 1000);
        const timeoutMsg = `Tempo limite de resposta excedido (${seg}s). O serviço externo pode estar sobrecarregado ou em processamento extenso.`;
        if (window.toast) window.toast.error(timeoutMsg, 'Timeout');
        throw new Error(timeoutMsg);
      }

      throw err;
    }
  }

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, body = {}, options = {}) {
    return this.request(endpoint, { ...options, method: 'POST', body });
  }

  put(endpoint, body = {}, options = {}) {
    return this.request(endpoint, { ...options, method: 'PUT', body });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }
}

window.api = new ApiClient();

