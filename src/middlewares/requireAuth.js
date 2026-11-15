import { supabaseAnon, supabaseAdmin } from "../config/supabase.js";

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};

export const ACCESS_TOKEN_MAX_AGE = 60 * 60 * 1000; // 1 hora
export const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 dias

/**
 * Middleware que garante que o usuário esteja autenticado.
 * Lê os cookies httpOnly com os tokens do Supabase, renova a sessão automaticamente
 * via refresh_token se necessário e valida se o perfil está ativo no banco.
 */
export async function requireAuth(req, res, next) {
  const accessToken = req.cookies?.sb_access_token;
  const refreshToken = req.cookies?.sb_refresh_token;

  // Função auxiliar para lidar com falha de autenticação
  const handleUnauthorized = (errorCode = "sessao_invalida") => {
    res.clearCookie("sb_access_token", COOKIE_OPTIONS);
    res.clearCookie("sb_refresh_token", COOKIE_OPTIONS);

    if (req.xhr || req.headers.accept?.includes("application/json")) {
      return res.status(401).json({
        success: false,
        error: "Sessão não autenticada ou expirada",
        code: errorCode,
      });
    }

    const redirectUrl = encodeURIComponent(req.originalUrl || "/");
    return res.redirect(`/login?error=${errorCode}&redirect=${redirectUrl}`);
  };

  // Se não houver nenhum token
  if (!accessToken && !refreshToken) {
    return handleUnauthorized("nao_autenticado");
  }

  try {
    let user = null;
    let currentAccessToken = accessToken;

    // 1. Tenta validar o access_token atual
    if (accessToken) {
      const { data, error } = await supabaseAnon.auth.getUser(accessToken);
      if (!error && data?.user) {
        user = data.user;
      }
    }

    // 2. Se o access_token expirou mas temos refresh_token, tenta renovar
    if (!user && refreshToken) {
      const { data: refreshData, error: refreshError } =
        await supabaseAnon.auth.refreshSession({
          refresh_token: refreshToken,
        });

      if (!refreshError && refreshData?.session && refreshData?.user) {
        user = refreshData.user;
        currentAccessToken = refreshData.session.access_token;

        // Atualiza cookies no navegador com novos tokens
        res.cookie("sb_access_token", refreshData.session.access_token, {
          ...COOKIE_OPTIONS,
          maxAge: ACCESS_TOKEN_MAX_AGE,
        });

        res.cookie("sb_refresh_token", refreshData.session.refresh_token, {
          ...COOKIE_OPTIONS,
          maxAge: REFRESH_TOKEN_MAX_AGE,
        });
      }
    }

    // Se não conseguimos validar nem renovar
    if (!user) {
      return handleUnauthorized("sessao_expirada");
    }

    // 3. Busca o perfil estendido do usuário na tabela profiles
    let profile = null;
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError || !profileData) {
      // Perfil não encontrado no banco
      console.warn(`[AUTH] Perfil não encontrado para o usuário: ${user.id}`);
      return handleUnauthorized("perfil_inexistente");
    }

    profile = profileData;

    // 4. Verifica se a conta está ativa
    if (!profile.ativo) {
      return handleUnauthorized("conta_desativada");
    }

    // 5. Injeta os dados do usuário autenticado nas requisições e nas views locais
    req.user = {
      id: user.id,
      email: user.email,
      accessToken: currentAccessToken,
      profile: {
        id: profile.id,
        nome: profile.nome || user.email.split("@")[0],
        email: profile.email,
        role: profile.role, // 'admin' | 'user' | 'pendente'
        ativo: profile.ativo,
        criado_em: profile.criado_em,
        ultimo_acesso: profile.ultimo_acesso,
      },
    };

    res.locals.user = req.user;
    res.locals.profile = req.user.profile;
    res.locals.isAdmin = profile.role === "admin";

    // Atualiza assincronamente a data do último acesso sem travar a requisição
    supabaseAdmin
      .from("profiles")
      .update({ ultimo_acesso: new Date().toISOString() })
      .eq("id", user.id)
      .then(() => {})
      .catch((err) =>
        console.error("[AUTH] Erro ao atualizar último acesso:", err.message),
      );

    return next();
  } catch (err) {
    console.error("[AUTH MIDDLEWARE ERRO]:", err);
    return handleUnauthorized("erro_autenticacao");
  }
}
