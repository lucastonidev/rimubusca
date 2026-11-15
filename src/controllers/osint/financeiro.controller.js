import { z } from "zod";
import { analisarCodigoFinanceiro } from "../../../public/js/financeiro-br-decoder.js";
import { supabaseAdmin } from "../../config/supabase.js";
import { registrarAuditoria } from "../../services/core/auditoria.service.js";

const analisarFinanceiroSchema = z.object({
  codigo: z
    .string()
    .min(10, "Informe um código PIX Copia e Cola ou linha digitável de boleto válida.")
    .max(2048, "Código excede o limite permitido.")
    .trim(),
});

/**
 * Analisa deterministicamente código PIX BR Code ou Boleto FEBRABAN sem custo externo,
 * registrando histórico e auditoria do analista.
 */
export const analisarFinanceiroController = async (req, res) => {
  const userId = req.user?.id;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0";
  const userAgent = req.headers["user-agent"] || "";

  const validation = analisarFinanceiroSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: validation.error.errors[0]?.message || "Código financeiro inválido.",
    });
  }

  const { codigo } = validation.data;

  try {
    const resultado = analisarCodigoFinanceiro(codigo);
    if (!resultado.sucesso) {
      return res.status(400).json({
        success: false,
        error: resultado.erro || "Formato não reconhecido.",
      });
    }

    const resumoInput = codigo.length > 64 ? `${codigo.slice(0, 64)}...` : codigo;

    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && userId) {
      try {
        await supabaseAdmin.from("buscas").insert([
          {
            user_id: userId,
            modulo: "pix_boleto",
            input: resumoInput,
            resultado_json: resultado,
          },
        ]);
      } catch (dbErr) {
        console.warn("[FINANCEIRO BUSCA LOG AVISO]:", dbErr.message);
      }
    }

    await registrarAuditoria({
      userId,
      acao: "analise_pix_boleto",
      detalhes: {
        modalidade: resultado.modalidade,
        nivelRisco: resultado.nivelRisco,
        crcValido: resultado.crcValido ?? null,
        integridadeValida: resultado.integridadeValida ?? null,
      },
      ip,
      userAgent,
    });

    return res.json({
      success: true,
      data: resultado,
    });
  } catch (err) {
    console.error("[ERRO CONTROLLER FINANCEIRO]:", err);
    return res.status(500).json({
      success: false,
      error: "Falha ao processar a análise do código financeiro.",
    });
  }
};
