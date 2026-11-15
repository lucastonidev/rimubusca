import { z } from "zod";
import { investigarEmail } from "../../services/osint/email.service.js";
import { supabaseAdmin } from "../../config/supabase.js";
import { registrarAuditoria } from "../../services/core/auditoria.service.js";

const consultaEmailSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Por favor, informe um endereço de e-mail válido."),
});

/**
 * Controller OSINT de E-mail (Mosint + Holehe + GHunt)
 */
export const investigarEmailController = async (req, res) => {
  const userId = req.user?.id;
  const ip =
    req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0";
  const userAgent = req.headers["user-agent"] || "";

  const validation = consultaEmailSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error:
        validation.error.errors[0]?.message || "Endereço de e-mail inválido.",
    });
  }

  const { email } = validation.data;

  try {
    const resultado = await investigarEmail(email);

    // Salva no histórico individual do operador no Supabase
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && userId) {
      await supabaseAdmin.from("buscas").insert([
        {
          user_id: userId,
          modulo: "email",
          input: resultado.email || email,
          resultado_json: resultado,
        },
      ]);
    }

    // Registra na trilha de auditoria imutável
    await registrarAuditoria({
      userId,
      acao: "busca_email_osint",
      detalhes: {
        alvo: resultado.email,
        dominio: resultado.dominio,
        isGoogle: resultado.ghunt?.isGoogleAccount || false,
        contasEncontradas: resultado.holehe?.totalEncontrados || 0,
      },
      ip,
      userAgent,
    });

    return res.json({
      success: true,
      data: resultado,
    });
  } catch (err) {
    console.error("[ERRO CONTROLLER EMAIL]:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Falha interna ao processar a investigação do e-mail.",
    });
  }
};

