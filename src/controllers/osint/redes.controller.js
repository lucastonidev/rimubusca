import { z } from "zod";
import { investigarRedesSociais } from "../../services/osint/redes.service.js";
import { supabaseAdmin } from "../../config/supabase.js";
import { registrarAuditoria } from "../../services/core/auditoria.service.js";

const investigarRedesSchema = z
  .object({
    nome: z.string().trim().optional(),
    email: z.string().trim().optional(),
    telefone: z.string().trim().optional(),
    username: z.string().trim().optional(),
    profissao: z.string().trim().optional(),
  })
  .refine((data) => data.nome || data.email || data.telefone || data.username, {
    message: "Informe ao menos um parâmetro (Nome, E-mail, Telefone ou @Username) para iniciar a correlação.",
  });

export const investigarRedesController = async (req, res) => {
  const userId = req.user?.id;
  const ip =
    req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0";
  const userAgent = req.headers["user-agent"] || "";

  const validation = investigarRedesSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error:
        validation.error.errors[0]?.message || "Parâmetros de busca inválidos.",
    });
  }

  const { nome, email, telefone, username, profissao } = validation.data;

  try {
    const resultado = await investigarRedesSociais({
      nome,
      email,
      telefone,
      username,
      profissao,
    });

    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && userId) {
      await supabaseAdmin.from("buscas").insert([
        {
          user_id: userId,
          modulo: "redes_sociais",
          input: `${nome || ""}|${email || ""}|${telefone || ""}|${username || ""}`,
          resultado_json: resultado,
        },
      ]);
    }

    await registrarAuditoria({
      userId,
      acao: "busca_redes_sociais",
      detalhes: {
        parametros: { nome: !!nome, email: !!email, telefone: !!telefone, username: !!username },
        totalAlvos: resultado.totalResultados || resultado.total || 0,
      },
      ip,
      userAgent,
    });

    return res.json({
      success: true,
      data: resultado,
    });
  } catch (err) {
    console.error("[ERRO CONTROLLER REDES]:", err);
    return res.status(500).json({
      success: false,
      error: "Falha interna ao executar correlação em redes sociais.",
    });
  }
};

