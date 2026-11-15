import { z } from "zod";
import { supabaseAdmin } from "../../config/supabase.js";
import { registrarAuditoria } from "../../services/core/auditoria.service.js";

const trocarSenhaSchema = z
  .object({
    novaSenha: z.string().min(6, "A nova senha deve ter no mínimo 6 caracteres."),
    confirmarSenha: z.string(),
  })
  .refine((data) => data.novaSenha === data.confirmarSenha, {
    message: "As senhas não conferem.",
    path: ["confirmarSenha"],
  });

export const alterarSenhaController = async (req, res) => {
  const userId = req.user?.id;
  const ip =
    req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0";
  const userAgent = req.headers["user-agent"] || "";

  const validation = trocarSenhaSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: validation.error.errors[0]?.message || "Dados inválidos.",
    });
  }

  const { novaSenha } = validation.data;

  try {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: novaSenha,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message || "Não foi possível atualizar a senha.",
      });
    }

    await registrarAuditoria({
      userId,
      acao: "auth_senha_alterada",
      detalhes: { motivo: "Alteração de senha solicitada pelo usuário" },
      ip,
      userAgent,
    });

    return res.json({
      success: true,
      mensagem: "Senha atualizada com sucesso.",
    });
  } catch (err) {
    console.error("[ERRO CONTROLLER CONFIGURACOES]:", err);
    return res.status(500).json({
      success: false,
      error: "Falha interna ao atualizar credenciais.",
    });
  }
};

