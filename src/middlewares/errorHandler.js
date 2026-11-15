/**
 * Middleware para rotas não encontradas (404)
 */
export function notFoundHandler(req, res) {
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(404).json({
      success: false,
      error: 'Recurso não encontrado',
      path: req.originalUrl,
    });
  }

  return res.status(404).render('errors/404', {
    title: 'Página Não Encontrada - 404',
    path: req.originalUrl,
  });
}

/**
 * Middleware central de tratamento de erros não capturados (500)
 */
export function errorHandler(err, req, res, next) {
  console.error('[ERRO NÃO TRATADO]', {
    message: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method,
  });

  const statusCode = err.status || err.statusCode || 500;
  const mensagem = process.env.NODE_ENV === 'production'
    ? 'Ocorreu um erro interno no servidor. Nossa equipe de operações foi notificada.'
    : err.message || 'Erro interno no servidor';

  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(statusCode).json({
      success: false,
      error: mensagem,
    });
  }

  return res.status(statusCode).render('errors/500', {
    title: `Erro no Servidor - ${statusCode}`,
    statusCode,
    mensagem,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : null,
  });
}

