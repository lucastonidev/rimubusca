import { z } from "zod";
import { investigarCarteiraBitcoin } from "../../services/osint/bitcoin.service.js";
import { supabaseAdmin } from "../../config/supabase.js";
import { registrarAuditoria } from "../../services/core/auditoria.service.js";

const bitcoinSchema = z.object({
  address: z
    .string({ required_error: "Informe um endereço de carteira Bitcoin." })
    .min(26, "Endereço Bitcoin deve ter no mínimo 26 caracteres.")
    .max(90, "Endereço excede o tamanho máximo de endereço Bitcoin.")
    .trim(),
});

/**
 * Controller: Investigação Forense de Carteiras de Bitcoin (BTC On-Chain + Surface + Dark Web).
 * Execução paralela compatível com funções serverless da Vercel.
 */
export const investigarBitcoinController = async (req, res) => {
  const userId = req.user?.id;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0";
  const userAgent = req.headers["user-agent"] || "";

  const validation = bitcoinSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: validation.error.errors[0]?.message || "Endereço Bitcoin inválido.",
    });
  }

  const { address } = validation.data;

  try {
    const resultado = await investigarCarteiraBitcoin(address, { userId, ip });

    if (!resultado.sucesso) {
      return res.status(400).json({
        success: false,
        error: resultado.erro || "Falha ao investigar carteira Bitcoin.",
      });
    }

    // Registro seguro de histórico do operador
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && userId) {
      try {
        await supabaseAdmin.from("buscas").insert([
          {
            user_id: userId,
            modulo: "bitcoin_forense",
            input: address,
            resultado_json: resultado,
          },
        ]);
      } catch (dbErr) {
        console.warn("[BITCOIN BUSCA LOG WARN]:", dbErr.message);
      }
    }

    // Auditoria de segurança
    await registrarAuditoria({
      userId,
      acao: "investigacao_carteira_bitcoin",
      detalhes: {
        address,
        formato: resultado.consulta?.formato,
        saldoBtc: resultado.resumo?.saldoBtc,
        totalTransacoes: resultado.resumo?.totalTransacoes,
        mencoesSurfaceWeb: resultado.resumo?.mencoesSurfaceWeb,
        mencoesDarkWeb: resultado.resumo?.mencoesDarkWeb,
        alertaAbuso: resultado.resumo?.alertaAbuso,
        tempoExecucaoMs: resultado.tempoExecucaoMs,
      },
      ip,
      userAgent,
    });

    return res.json({
      success: true,
      data: resultado,
    });
  } catch (err) {
    console.error("[ERRO CONTROLLER BITCOIN]:", err);
    return res.status(500).json({
      success: false,
      error: "Falha interna ao processar investigação de carteira Bitcoin.",
    });
  }
};
