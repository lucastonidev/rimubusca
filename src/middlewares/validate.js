/**
 * Middleware genérico para validação de esquemas Zod em Express.
 * 
 * @param {import('zod').ZodSchema} schema - Esquema Zod a ser validado
 * @param {'body' | 'query' | 'params'} [property='body'] - Propriedade da requisição a validar
 */
export function validate(schema, property = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[property]);

    if (!result.success) {
      const formattedErrors = result.error.errors.map((err) => ({
        campo: err.path.join('.'),
        mensagem: err.message,
      }));

      // Se requisição esperar JSON
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(400).json({
          success: false,
          error: 'Dados de entrada inválidos',
          detalhes: formattedErrors,
        });
      }

      // Se for formulário tradicional, repassa primeiro erro para a view
      req.validationError = formattedErrors[0]?.mensagem || 'Dados de entrada inválidos';
      return next();
    }

    // Atribui os dados validados e sanitizados de volta ao request
    req[property] = result.data;
    next();
  };
}

