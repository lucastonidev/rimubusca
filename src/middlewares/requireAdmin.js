/**
 * Middleware para restringir acesso estritamente a usuários com perfil de 'admin'.
 * DEVE ser executado após o middleware `requireAuth`.
 */
export function requireAdmin(req, res, next) {
  if (!req.user || !req.user.profile) {
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({
        success: false,
        error: 'Autenticação necessária',
      });
    }
    return res.redirect('/login');
  }

  // Valida a role do usuário no perfil
  if (req.user.profile.role !== 'admin') {
    // Se for chamada de API
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado: privilégios de administrador necessários',
      });
    }

    // Se for navegação de página
    return res.status(403).render('errors/403', {
      title: 'Acesso Negado - 403',
      mensagem: 'Esta seção é estritamente restrita a administradores do RimuBusca.',
      user: req.user,
    });
  }

  next();
}

