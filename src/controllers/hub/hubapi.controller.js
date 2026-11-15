import { z } from "zod";
import {
  obterStatusCarteira,
  executarConsultaHubModulo,
  recarregarSaldoCarteira,
} from "../../services/osint/hubapi.service.js";
import { supabaseAdmin } from "../../config/supabase.js";
import { registrarAuditoria } from "../../services/core/auditoria.service.js";

/**
 * ==============================================================================
 * RIMUBUSCA - CONTROLLER DE APIS PAY-PER-USE / ASPECT HUB (HUBAPI.CONTROLLER.JS)
 * ==============================================================================
 */

const consultaSchema = z.object({
  moduloId: z.string().min(1, "Identificador do módulo é obrigatório.").trim(),
  parametroValor: z
    .string()
    .min(1, "O parâmetro de busca deve ser informado.")
    .max(120, "Parâmetro excessivamente longo.")
    .trim(),
  forceRefresh: z.boolean().optional().default(false),
});

const recargaSchema = z.object({
  valor: z
    .number({ invalid_type_error: "O valor de recarga deve ser numérico." })
    .min(1, "O valor mínimo de recarga é R$ 1,00.")
    .max(500, "O valor máximo de recarga por operação é R$ 500,00.")
    .optional(),
  novoOrcamento: z
    .number({ invalid_type_error: "O novo orçamento deve ser numérico." })
    .min(5, "O orçamento mínimo é R$ 5,00.")
    .max(1000, "O orçamento máximo é R$ 1.000,00.")
    .optional(),
});

/**
 * Retorna o status da carteira e a lista dos 46 módulos com dados de saldo
 */
export const obterStatusCarteiraController = async (req, res) => {
  try {
    const status = await obterStatusCarteira();
    return res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error("[HUB API CONTROLLER] Erro ao obter status da carteira:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Erro interno ao obter status da carteira Pay-per-Use.",
    });
  }
};

/**
 * Executa uma consulta em um dos 46 módulos Pay-per-Use
 */
export const executarConsultaHubController = async (req, res) => {
  const userId = req.user?.id;
  const ip =
    req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0";
  const userAgent = req.headers["user-agent"] || "";

  const validation = consultaSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error:
        validation.error.errors[0]?.message || "Parâmetros de busca inválidos.",
    });
  }

  const { moduloId, parametroValor, forceRefresh } = validation.data;
  const userNome = req.profile?.nome || req.user?.nome || (req.user?.email ? req.user.email.split("@")[0] : "Operador");

  try {
    const resultado = await executarConsultaHubModulo({
      moduloId,
      parametroValor,
      userId,
      userNome,
      forceRefresh,
    });

    // Registra busca e auditoria de forma assíncrona não bloqueante
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && userId) {
      Promise.resolve(
        supabaseAdmin.from("buscas").insert([
          {
            user_id: userId,
            modulo: `hub_${moduloId}`,
            input: parametroValor,
            resultado_json: resultado,
          },
        ])
      ).catch((dbErr) => {
        console.warn("[SUPABASE HISTORICO HUB]:", dbErr.message);
      });
    }

    Promise.resolve(
      registrarAuditoria({
        userId,
        acao: "consulta_hub_pay_per_use",
        detalhes: {
          moduloId,
          moduloNome: resultado.modulo?.nome,
          custo: resultado.modulo?.custoDebitado,
          parametro: parametroValor,
          saldoRestante: resultado.carteira?.saldoAtual,
        },
        ip,
        userAgent,
      })
    ).catch((auditErr) => {
      console.warn("[AUDITORIA HUB]:", auditErr.message);
    });

    return res.status(200).json({
      success: true,
      data: resultado,
    });
  } catch (error) {
    const isInsufficientBalance = error.message && error.message.includes("Saldo insuficiente");
    const statusCode = isInsufficientBalance ? 402 : 400; // 402 Payment Required

    return res.status(statusCode).json({
      success: false,
      error: error.message || "Falha ao executar consulta no módulo Pay-per-Use.",
    });
  }
};

/**
 * Recarrega o saldo ou ajusta o teto orçamentário mensal
 */
export const recarregarSaldoController = async (req, res) => {
  const userId = req.user?.id;
  const ip =
    req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0";
  const userAgent = req.headers["user-agent"] || "";

  const validation = recargaSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error:
        validation.error.errors[0]?.message || "Dados de recarga inválidos.",
    });
  }

  const { valor = 20.0, novoOrcamento = null } = validation.data;
  const userNome = req.profile?.nome || req.user?.nome || (req.user?.email ? req.user.email.split("@")[0] : "Operador");

  try {
    const carteiraAtualizada = await recarregarSaldoCarteira(valor, novoOrcamento, { userId, userNome });

    await registrarAuditoria({
      userId,
      acao: "recarga_saldo_hub_api",
      detalhes: {
        valorAdicionado: valor,
        novoSaldo: carteiraAtualizada.saldoAtual,
        orcamentoMensal: carteiraAtualizada.orcamentoMensal,
      },
      ip,
      userAgent,
    });

    return res.status(200).json({
      success: true,
      message: `Recarga de R$ ${valor.toFixed(2).replace(".", ",")} realizada com sucesso!`,
      data: carteiraAtualizada,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Erro ao recarregar saldo da carteira.",
    });
  }
};

