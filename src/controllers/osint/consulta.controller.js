import { z } from "zod";
import { puxarDados } from "../../services/osint/consulta.service.js";
import { supabaseAdmin } from "../../config/supabase.js";
import { registrarAuditoria } from "../../services/core/auditoria.service.js";

const puxarDadosSchema = z.object({
  tipo: z.string().default("cpf"),
  termo: z
    .string()
    .min(1, "Termo de consulta deve conter no mínimo 1 caractere.")
    .max(200, "Termo de busca excessivamente longo.")
    .trim(),
  uf: z.string().optional(),
});

export const puxarDadosController = async (req, res) => {
  const userId = req.user?.id;
  const ip =
    req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0";
  const userAgent = req.headers["user-agent"] || "";

  const validation = puxarDadosSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: validation.error.errors[0]?.message || "Dados inválidos.",
    });
  }

  const { tipo, termo, uf } = validation.data;

  try {
    const resultado = await puxarDados({ tipo, termo, uf });

    // Salva no histórico de buscas do Supabase apenas se for resultado legítimo (nunca salva dados mockados ou simulados)
    if (
      process.env.SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      userId &&
      !resultado.isMock &&
      !resultado.contingencia
    ) {
      await supabaseAdmin.from("buscas").insert([
        {
          user_id: userId,
          modulo: `consulta_${tipo}`,
          input: termo,
          resultado_json: resultado,
        },
      ]);
    }

    await registrarAuditoria({
      userId,
      acao: `consulta_cadastral_${tipo}`,
      detalhes: { tipo, alvo: termo },
      ip,
      userAgent,
    });

    return res.json({
      success: true,
      data: resultado,
    });
  } catch (err) {
    console.error("[ERRO CONTROLLER CONSULTA]:", err);
    return res.status(400).json({
      success: false,
      error: err.message || "Falha ao processar a consulta cadastral.",
    });
  }
};

