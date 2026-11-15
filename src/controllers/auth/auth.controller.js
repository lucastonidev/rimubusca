import { z } from "zod";
import { authService } from "../../services/auth/auth.service.js";
import {
  COOKIE_OPTIONS,
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
} from "../../middlewares/requireAuth.js";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Por favor, informe um endereço de e-mail válido."),
  password: z.string().min(6, "A senha deve conter no mínimo 6 caracteres."),
  redirect: z.string().optional(),
});

const ERROR_MESSAGES = {
  sessao_expirada: "Sua sessão expirou por inatividade. Faça login novamente.",
  sessao_invalida: "Sessão inválida. Por favor, autentique-se novamente.",
  nao_autenticado: "Acesso restrito. Faça login para continuar.",
  conta_desativada:
    "Sua conta está desativada ou aguarda aprovação de um administrador.",
  perfil_inexistente: "Perfil de usuário não localizado no sistema interno.",
  credenciais_invalidas: "E-mail ou senha incorretos.",
  erro_autenticacao:
    "Falha durante o processo de autenticação. Tente novamente.",
};

const INFO_MESSAGES = {
  desconectado: "Você encerrou sua sessão com segurança.",
};

/**
 * Controller de Autenticação
 */
export const authController = {
  /**
   * Renderiza a página de login ou redireciona caso já autenticado
   */
  async renderLogin(req, res) {
    const accessToken = req.cookies?.sb_access_token;

    if (accessToken) {
      const user = await authService.verifyToken(accessToken);
      if (user) {
        return res.redirect("/dashboard");
      }
    }

    const errorCode = req.query.error;
    const infoCode = req.query.info;
    const redirectUrl = req.query.redirect || "/dashboard";

    res.render("auth/login", {
      title: "Autenticação Restrita - RimuBusca",
      error: errorCode
        ? ERROR_MESSAGES[errorCode] || "Ocorreu um erro ao autenticar."
        : null,
      info: infoCode
        ? INFO_MESSAGES[infoCode] || "Operação realizada com sucesso."
        : null,
      email: "",
      redirect: redirectUrl,
    });
  },

  /**
   * Processa a submissão de login
   */
  async handleLogin(req, res) {
    const ip =
      req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0";
    const userAgent = req.headers["user-agent"] || "";

    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      const errorMsg =
        validation.error.errors[0]?.message || "Credenciais inválidas.";
      return res.status(400).render("auth/login", {
        title: "Autenticação Restrita - RimuBusca",
        error: errorMsg,
        info: null,
        email: req.body.email || "",
        redirect: req.body.redirect || "/dashboard",
      });
    }

    const { email, password, redirect: targetRedirect } = validation.data;

    try {
      const { session } = await authService.loginWithPassword({
        email,
        password,
        ip,
        userAgent,
      });

      // Grava cookies httpOnly
      res.cookie("sb_access_token", session.access_token, {
        ...COOKIE_OPTIONS,
        maxAge: ACCESS_TOKEN_MAX_AGE,
      });

      res.cookie("sb_refresh_token", session.refresh_token, {
        ...COOKIE_OPTIONS,
        maxAge: REFRESH_TOKEN_MAX_AGE,
      });

      // Prevenção contra Open Redirect
      let safeRedirect = "/dashboard";
      if (
        targetRedirect &&
        targetRedirect.startsWith("/") &&
        !targetRedirect.startsWith("//")
      ) {
        safeRedirect = targetRedirect;
      }

      return res.redirect(safeRedirect);
    } catch (err) {
      const status = err.statusCode || 500;
      return res.status(status).render("auth/login", {
        title: "Autenticação Restrita - RimuBusca",
        error: err.message || "Falha temporária ao comunicar com o serviço de autenticação.",
        info: null,
        email,
        redirect: targetRedirect || "/dashboard",
      });
    }
  },

  /**
   * Processa o encerramento da sessão
   */
  async handleLogout(req, res) {
    const accessToken = req.cookies?.sb_access_token;
    const ip =
      req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0";
    const userAgent = req.headers["user-agent"] || "";

    await authService.logout({ accessToken, ip, userAgent });

    res.clearCookie("sb_access_token", COOKIE_OPTIONS);
    res.clearCookie("sb_refresh_token", COOKIE_OPTIONS);

    return res.redirect("/login?info=desconectado");
  },
};

