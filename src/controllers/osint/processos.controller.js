import { z } from "zod";
import {
  consultarProcessoJudicial,
  obterDetalhesProcessoJudicial,
} from "../../services/osint/processos.service.js";
import { supabaseAdmin } from "../../config/supabase.js";
import { registrarAuditoria } from "../../services/core/auditoria.service.js";

const consultaProcessosSchema = z.object({
  termo: z
    .string()
    .min(2, "O termo de busca deve conter ao menos 2 caracteres.")
    .max(120, "Termo de busca excessivamente longo.")
    .trim(),
  tipo: z.enum(["cnj", "nome", "documento", "oab"]).optional().default("cnj"),
});

const detalhesProcessoSchema = z.object({
  url: z.string().min(3, "Identificador ou URL do processo inválido.").trim(),
});

export const consultarProcesso = async (req, res) => {
  const userId = req.user?.id;
  const ip =
    req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0";
  const userAgent = req.headers["user-agent"] || "";

  const validation = consultaProcessosSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error:
        validation.error.errors[0]?.message || "Parâmetros de busca inválidos.",
    });
  }

  const { termo, tipo } = validation.data;

  try {
    const resultado = await consultarProcessoJudicial(termo, tipo);

    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && userId) {
      await supabaseAdmin.from("buscas").insert([
        {
          user_id: userId,
          modulo: "processos",
          input: resultado.alvo || termo,
          resultado_json: resultado,
        },
      ]);
    }

    await registrarAuditoria({
      userId,
      acao: "consulta_processo_judicial",
      detalhes: {
        tipo,
        alvo: resultado.alvo || termo,
        fonte: resultado.dados?.fonte || "DataJud & Scraper",
        tribunal: resultado.dados?.metadadosCnj?.tribunalSigla || "N/A",
      },
      ip,
      userAgent,
    });

    return res.json({
      success: true,
      data: resultado.dados,
    });
  } catch (err) {
    console.error("[ERRO CONTROLLER PROCESSOS]:", err);
    return res.status(400).json({
      success: false,
      error: err.message || "Erro ao consultar o processo judicial.",
    });
  }
};

export const obterDetalhesProcessoController = async (req, res) => {
  const validation = detalhesProcessoSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: validation.error.errors[0]?.message || "URL do processo inválida.",
    });
  }

  const { url } = validation.data;

  try {
    const detalhes = await obterDetalhesProcessoJudicial(url);
    if (!detalhes || !detalhes.sucesso) {
      return res.status(404).json({
        success: false,
        error: detalhes?.error || "Detalhes do processo não localizados.",
      });
    }

    return res.json({
      success: true,
      data: detalhes,
    });
  } catch (err) {
    console.error("[ERRO DETALHES PROCESSO]:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Falha ao extrair andamentos do processo.",
    });
  }
};

