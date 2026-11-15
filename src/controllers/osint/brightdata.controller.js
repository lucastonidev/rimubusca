import { z } from "zod";
import {
  isBrightDataConfigured,
  iniciarColetaSocialBrightData,
  consultarProgressoSnapshotBrightData,
  baixarMidiaSocialPermitida,
  DEFAULT_MAX_POSTS,
  MAX_POSTS_LIMIT,
  DEFAULT_MAX_COMMENTS_PER_POST,
  MAX_COMMENTS_PER_POST_LIMIT,
} from "../../services/osint/brightdata.service.js";
import { registrarAuditoria } from "../../services/core/auditoria.service.js";

const iniciarColetaSchema = z.object({
  plataforma: z.enum(["instagram", "x", "twitter"]).optional().default("instagram"),
  modo: z.enum(["perfil", "post_url", "palavra_chave"]).optional().default("perfil"),
  alvo: z.string().max(400).optional().default(""),
  palavrasChave: z.string().max(400).optional().default(""),
  incluirComentarios: z.boolean().optional().default(true),
  maxPosts: z.coerce.number().int().min(1).max(MAX_POSTS_LIMIT).optional().default(DEFAULT_MAX_POSTS),
  maxCommentsPerPost: z.coerce
    .number()
    .int()
    .min(0)
    .max(MAX_COMMENTS_PER_POST_LIMIT)
    .optional()
    .default(DEFAULT_MAX_COMMENTS_PER_POST),
  startDate: z.string().max(32).optional().default(""),
  endDate: z.string().max(32).optional().default(""),
  forceRefresh: z.boolean().optional().default(false),
});

const progressoQuerySchema = z.object({
  phase: z.enum(["posts", "comments"]).optional().default("posts"),
  plataforma: z.enum(["instagram", "x", "twitter"]).optional().default("instagram"),
  modo: z.enum(["perfil", "post_url", "palavra_chave"]).optional().default("perfil"),
  alvo: z.string().max(300).optional().default(""),
  palavrasChave: z.string().max(400).optional().default(""),
  incluirComentarios: z.enum(["true", "false", "1", "0"]).optional().default("true"),
  maxPosts: z.coerce.number().int().min(1).max(MAX_POSTS_LIMIT).optional().default(DEFAULT_MAX_POSTS),
  maxCommentsPerPost: z.coerce
    .number()
    .int()
    .min(0)
    .max(MAX_COMMENTS_PER_POST_LIMIT)
    .optional()
    .default(DEFAULT_MAX_COMMENTS_PER_POST),
});

/**
 * Retorna status da configuração Bright Data e travas de cota padrão para a UI.
 */
export const obterStatusBrightDataController = async (_req, res) => {
  return res.json({
    success: true,
    ...isBrightDataConfigured(),
  });
};

/**
 * Inicia job assíncrono na Bright Data Web Scraper API v3 ou retorna cache de 24h.
 */
export const iniciarColetaBrightDataController = async (req, res) => {
  const userId = req.user?.id;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0";
  const userAgent = req.headers["user-agent"] || "";

  const parsed = iniciarColetaSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: "Parâmetros inválidos para coleta social Bright Data.",
      detalhes: parsed.error.issues.map((i) => i.message),
    });
  }

  const payload = parsed.data;
  if (!payload.alvo && !payload.palavrasChave) {
    return res.status(400).json({
      success: false,
      error: "Informe um @usuário, URL de post ou palavra-chave para iniciar a coleta.",
    });
  }

  try {
    const resultado = await iniciarColetaSocialBrightData(payload);

    await registrarAuditoria({
      userId,
      acao: "coleta_social_brightdata_inicio",
      detalhes: {
        plataforma: payload.plataforma,
        modo: payload.modo,
        alvo: payload.alvo || payload.palavrasChave,
        cached: Boolean(resultado.cached),
        snapshotId: resultado.snapshotId,
        maxPosts: payload.maxPosts,
        maxCommentsPerPost: payload.incluirComentarios ? payload.maxCommentsPerPost : 0,
      },
      ip,
      userAgent,
    });

    const httpCode = resultado.status === "ready" ? 200 : 202;
    return res.status(httpCode).json({
      success: true,
      ...resultado,
    });
  } catch (err) {
    const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;
    console.error("[ERRO CONTROLLER BRIGHTDATA INICIAR]:", err.message);
    return res.status(status).json({
      success: false,
      code: err.code || "BRIGHTDATA_ERROR",
      error: err.message || "Falha ao iniciar coleta na Bright Data.",
    });
  }
};

/**
 * Consulta progresso de um snapshot Bright Data (e dispara fase 2 de comentários no Instagram se aplicável).
 */
export const consultarProgressoBrightDataController = async (req, res) => {
  const snapshotId = String(req.params.snapshotId || "").trim();
  if (!snapshotId || !/^[A-Za-z0-9_-]{4,120}$/.test(snapshotId)) {
    return res.status(400).json({
      success: false,
      error: "snapshotId inválido.",
    });
  }

  const parsedQuery = progressoQuerySchema.safeParse(req.query || {});
  const q = parsedQuery.success ? parsedQuery.data : {};

  try {
    const resultado = await consultarProgressoSnapshotBrightData(snapshotId, {
      phase: q.phase,
      plataforma: q.plataforma,
      modo: q.modo,
      alvo: q.alvo,
      palavrasChave: q.palavrasChave,
      incluirComentarios: q.incluirComentarios === "true" || q.incluirComentarios === "1",
      maxPosts: q.maxPosts,
      maxCommentsPerPost: q.maxCommentsPerPost,
    });

    if (resultado.status === "ready" && resultado.relatorio) {
      await registrarAuditoria({
        userId: req.user?.id,
        acao: "coleta_social_brightdata_concluida",
        detalhes: {
          snapshotId,
          plataforma: resultado.relatorio.parametros?.plataforma,
          totalPosts: resultado.relatorio.metricas?.totalPosts || 0,
          totalComentarios: resultado.relatorio.metricas?.totalComentariosColetados || 0,
          ocorrenciasPalavraChave: resultado.relatorio.metricas?.totalOcorrenciasPalavraChave || 0,
        },
        ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0",
        userAgent: req.headers["user-agent"] || "",
      });
    }

    return res.json({
      success: resultado.status !== "failed" && resultado.status !== "canceled",
      ...resultado,
    });
  } catch (err) {
    const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;
    console.error("[ERRO CONTROLLER BRIGHTDATA PROGRESSO]:", err.message);
    return res.status(status).json({
      success: false,
      code: err.code || "BRIGHTDATA_PROGRESS_ERROR",
      error: err.message || "Erro ao consultar progresso da coleta Bright Data.",
    });
  }
};

/**
 * Proxy autenticado para miniaturas/avatares de CDNs sociais (evita bloqueio CORP/CORS no PDF e modal).
 */
export const proxyMidiaBrightDataController = async (req, res) => {
  const url = String(req.query.url || "").trim();
  if (!url) {
    return res.status(400).end();
  }

  try {
    const { contentType, buffer } = await baixarMidiaSocialPermitida(url);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    return res.send(buffer);
  } catch (err) {
    const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 502;
    return res.status(status).end();
  }
};
