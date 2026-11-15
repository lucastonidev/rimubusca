import { z } from "zod";
import { supabaseAdmin } from "../../config/supabase.js";
import { registrarAuditoria } from "../../services/core/auditoria.service.js";

const salvarMetadadosSchema = z.object({
  nomeArquivo: z.string().min(1).max(255).trim(),
  tipoMime: z.string().max(100).default("application/octet-stream"),
  tamanhoBytes: z.number().nonnegative(),
  sha256: z.string().length(64).optional(),
  md5: z.string().length(32).optional(),
  tagsExif: z.record(z.any()).default({}),
  resumoLocalizacao: z
    .object({
      latitude: z.number().optional(),
      longitude: z.number().optional(),
    })
    .optional(),
});

export const salvarMetadadosController = async (req, res) => {
  const userId = req.user?.id;
  const ip =
    req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0";
  const userAgent = req.headers["user-agent"] || "";

  const validation = salvarMetadadosSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: "Estrutura de dados de metadados inválida.",
      detalhes: validation.error.flatten(),
    });
  }

  const payload = validation.data;

  try {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && userId) {
      await supabaseAdmin.from("buscas").insert([
        {
          user_id: userId,
          modulo: "metadados",
          input: payload.nomeArquivo,
          resultado_json: payload,
        },
      ]);
    }

    await registrarAuditoria({
      userId,
      acao: "extracao_metadados_forense",
      detalhes: {
        arquivo: payload.nomeArquivo,
        tamanho: payload.tamanhoBytes,
        temGps: !!payload.resumoLocalizacao?.latitude,
        sha256: payload.sha256,
      },
      ip,
      userAgent,
    });

    return res.json({
      success: true,
      mensagem: "Metadados registrados com sucesso no histórico operacional.",
    });
  } catch (err) {
    console.error("[ERRO CONTROLLER METADADOS]:", err);
    return res.status(500).json({
      success: false,
      error: "Falha ao persistir metadados no histórico.",
    });
  }
};

