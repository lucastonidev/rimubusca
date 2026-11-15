import { z } from "zod";
import { investigarDominio } from "../../services/osint/dominio.service.js";
import { supabaseAdmin } from "../../config/supabase.js";
import { registrarAuditoria } from "../../services/core/auditoria.service.js";

const consultaDominioSchema = z.object({
  dominio: z
    .string()
    .min(3, "O domínio deve conter no mínimo 3 caracteres.")
    .max(253, "Domínio excessivamente longo.")
    .trim(),
});

export const investigarDominioController = async (req, res) => {
  const userId = req.user?.id;
  const ip =
    req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0";
  const userAgent = req.headers["user-agent"] || "";

  const validation = consultaDominioSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: validation.error.errors[0]?.message || "Domínio inválido.",
    });
  }

  const { dominio } = validation.data;

  try {
    const resultado = await investigarDominio(dominio);

    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && userId) {
      await supabaseAdmin.from("buscas").insert([
        {
          user_id: userId,
          modulo: "dominio",
          input: resultado.dominio || dominio,
          resultado_json: resultado,
        },
      ]);
    }

    await registrarAuditoria({
      userId,
      acao: "busca_dominio_dns",
      detalhes: {
        dominio: resultado.dominio,
        dnsAtivo: resultado.dns?.ativo,
        ipsA: resultado.dns?.a?.length || 0,
        scoreSeguranca: resultado.scoreSeguranca,
      },
      ip,
      userAgent,
    });

    return res.json({
      success: true,
      data: resultado,
    });
  } catch (err) {
    console.error("[ERRO CONTROLLER DOMINIO]:", err);
    return res.status(500).json({
      success: false,
      error: "Falha ao processar a investigação do domínio.",
    });
  }
};

