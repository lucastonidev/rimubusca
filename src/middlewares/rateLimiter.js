import rateLimit from 'express-rate-limit';

/**
 * Limitador estrito para a rota de login (/auth/login).
 * Bloqueia ataques de força bruta limitando a 5 requisições por minuto por IP.
 * 
 * NOTA EM PRODUÇÃO SERVERLESS (VERCEL):
 * O express-rate-limit armazena contadores em memória local por instância.
 * Para deploys globais multi-região em alta escala, recomendamos utilizar 
 * `@upstash/ratelimit` com Redis centralizado.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // Janela de 1 minuto
  max: 5, // Limite de 5 tentativas por IP
  standardHeaders: true, // Retorna RateLimit-* nos headers
  legacyHeaders: false,
  handler: (req, res) => {
    // Se for uma requisição de API (JSON), retorna 429 com JSON
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(429).json({
        success: false,
        error: 'Muitas tentativas de login consecutivas. Por favor, aguarde 1 minuto.',
      });
    }

    // Se for submissão via formulário web EJS, renderiza a página com aviso
    return res.status(429).render('auth/login', {
      error: 'Muitas tentativas consecutivas de autenticação. Por motivos de segurança, aguarde 60 segundos antes de tentar novamente.',
      info: null,
      email: req.body?.email || '',
    });
  },
});

/**
 * Limitador global para rotas gerais da aplicação
 */
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 300, // 300 requisições por janela
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Não aplica rate limit em assets estáticos públicos (CSS, JS, imagens)
    return req.path.startsWith('/css/') || req.path.startsWith('/js/') || req.path.startsWith('/icons/');
  },
});

