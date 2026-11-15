import { supabaseAnon, supabaseAdmin } from "../../config/supabase.js";
import { registrarAuditoria } from "../core/auditoria.service.js";
import { AppError } from "../../utils/AppError.js";

/**
 * Serviço de Autenticação e Sessão
 */
export const authService = {
  /**
   * Verifica se um access_token ainda é válido
   * @param {string} accessToken
   * @returns {Promise<Object|null>}
   */
  async verifyToken(accessToken) {
    if (!accessToken) return null;
    try {
      const { data, error } = await supabaseAnon.auth.getUser(accessToken);
      if (error || !data?.user) return null;
      return data.user;
    } catch {
      return null;
    }
  },

  /**
   * Autentica o usuário com email e senha, valida se o perfil está ativo e registra auditoria
   * @param {Object} params
   * @param {string} params.email
   * @param {string} params.password
   * @param {string} params.ip
   * @param {string} params.userAgent
   * @returns {Promise<{ user: Object, session: Object, profile: Object }>}
   */
  async loginWithPassword({ email, password, ip = "0.0.0.0", userAgent = "" }) {
    // 1. Autenticação no Supabase Auth
    const { data: authData, error: authError } =
      await supabaseAnon.auth.signInWithPassword({
        email,
        password,
      });

    if (authError || !authData?.user || !authData?.session) {
      await registrarAuditoria({
        userId: null,
        acao: "auth_login_falha",
        detalhes: {
          email,
          motivo: authError?.message || "Credenciais incorretas",
        },
        ip,
        userAgent,
      });

      throw new AppError("E-mail ou senha incorretos.", 401);
    }

    const user = authData.user;

    // 2. Verifica perfil na tabela profiles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("ativo, role, nome")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || !profile.ativo) {
      await supabaseAnon.auth.signOut();

      await registrarAuditoria({
        userId: user.id,
        acao: "auth_login_bloqueado",
        detalhes: { email, motivo: "Conta inativa ou não aprovada" },
        ip,
        userAgent,
      });

      throw new AppError(
        "Sua conta está desativada ou aguardando aprovação administrativa.",
        403,
      );
    }

    // 3. Auditoria de sucesso
    await registrarAuditoria({
      userId: user.id,
      acao: "auth_login_sucesso",
      detalhes: { email, role: profile.role },
      ip,
      userAgent,
    });

    return {
      user,
      session: authData.session,
      profile,
    };
  },

  /**
   * Desconecta o usuário do Supabase e registra evento de auditoria
   * @param {Object} params
   * @param {string} params.accessToken
   * @param {string} params.ip
   * @param {string} params.userAgent
   */
  async logout({ accessToken, ip = "0.0.0.0", userAgent = "" }) {
    if (accessToken) {
      try {
        const { data } = await supabaseAnon.auth.getUser(accessToken);
        if (data?.user) {
          await registrarAuditoria({
            userId: data.user.id,
            acao: "auth_logout",
            detalhes: { email: data.user.email },
            ip,
            userAgent,
          });
        }
        await supabaseAnon.auth.signOut();
      } catch (err) {
        console.error("[AUTH SERVICE] Falha silenciosa no signOut do Supabase:", err.message);
      }
    }
  },
};

