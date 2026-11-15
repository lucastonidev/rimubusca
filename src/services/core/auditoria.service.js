import { supabaseAdmin } from "../../config/supabase.js";

/**
 * Registra um evento imutável na tabela de logs de auditoria (logs_auditoria).
 *
 * @param {Object} params
 * @param {string|null} params.userId - UUID do usuário que realizou a ação (null se não autenticado)
 * @param {string} params.acao - Nome padronizado da ação (ex: 'auth_login', 'auth_logout', 'busca_telefone')
 * @param {Object} [params.detalhes={}] - Informações adicionais em JSON
 * @param {string} [params.ip='0.0.0.0'] - Endereço IP do solicitante
 * @param {string} [params.userAgent=''] - User-Agent do cliente
 * @returns {Promise<boolean>}
 */
export async function registrarAuditoria({
  userId = null,
  acao,
  detalhes = {},
  ip = "0.0.0.0",
  userAgent = "",
}) {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.log(
        `[AUDITORIA MOCK] [${new Date().toISOString()}] Usuário: ${userId || "ANÔNIMO"} | Ação: ${acao} | IP: ${ip}`,
      );
      return true;
    }

    const { error } = await supabaseAdmin.from("logs_auditoria").insert([
      {
        user_id: userId,
        acao,
        detalhes,
        ip: ip.replace(/^.*:/, ""), // Sanitiza IPv4 mapeado em IPv6
        user_agent: userAgent ? userAgent.substring(0, 500) : "",
      },
    ]);

    if (error) {
      console.error("[ERRO AUDITORIA] Falha ao registrar log:", error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[ERRO AUDITORIA INESPERADO]:", err.message);
    return false;
  }
}

