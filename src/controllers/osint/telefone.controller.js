import { z } from "zod";
import { consultarTelefone } from "../../services/osint/telefone.service.js";
import { supabaseAdmin } from "../../config/supabase.js";
import { registrarAuditoria } from "../../services/core/auditoria.service.js";

const consultaTelefoneSchema = z.object({
  telefone: z
    .string()
    .min(8, "O número de telefone deve conter no mínimo 8 dígitos.")
    .max(25, "Número excessivamente longo.")
    .trim(),
});

export const consultarTelefoneController = async (req, res) => {
  const userId = req.user?.id;
  const ip =
    req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0";
  const userAgent = req.headers["user-agent"] || "";

  const validation = consultaTelefoneSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error:
        validation.error.errors[0]?.message || "Número de telefone inválido.",
    });
  }

  const { telefone } = validation.data;

  try {
    const resultado = await consultarTelefone(telefone);

    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && userId) {
      await supabaseAdmin.from("buscas").insert([
        {
          user_id: userId,
          modulo: "telefone",
          input: resultado.formatoE164 || telefone,
          resultado_json: resultado,
        },
      ]);
    }

    await registrarAuditoria({
      userId,
      acao: "busca_telefone",
      detalhes: {
        alvo: resultado.formatoE164,
        pais: resultado.pais,
        operadora: resultado.operadora,
        valido: resultado.valido,
      },
      ip,
      userAgent,
    });

    return res.json({
      success: true,
      data: resultado,
    });
  } catch (err) {
    console.error("[ERRO CONTROLLER TELEFONE]:", err);
    return res.status(500).json({
      success: false,
      error: "Falha interna ao processar a consulta do telefone.",
    });
  }
};

