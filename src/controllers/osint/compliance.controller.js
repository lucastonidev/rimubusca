import { z } from "zod";
import { consultarComplianceCompleto } from "../../services/osint/compliance.service.js";
import { registrarAuditoria } from "../../services/core/auditoria.service.js";

const complianceSchema = z.object({
  tipo: z.string().max(40).optional().default(""),
  termo: z.string().max(200).optional().default(""),
  nome: z.string().max(200).optional().default(""),
  uf: z.string().max(5).optional().default(""),
  municipio: z.string().max(120).optional().default(""),
});

/**
 * Controller para varredura de Compliance Público (CGU/CEIS/CNEP/CEPIM, TSE, PNCP e Diários Oficiais).
 */
export const consultarComplianceController = async (req, res) => {
  const userId = req.user?.id;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0";
  const userAgent = req.headers["user-agent"] || "";

  const parsed = complianceSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: "Parâmetros inválidos para consulta de compliance.",
    });
  }

  const { tipo, termo, nome, uf, municipio } = parsed.data;
  if (!termo && !nome) {
    return res.status(400).json({
      success: false,
      error: "Informe ao menos um documento (CPF/CNPJ) ou nome completo.",
    });
  }

  try {
    const data = await consultarComplianceCompleto({ tipo, termo, nome, uf, municipio });

    await registrarAuditoria({
      userId,
      acao: "consulta_compliance_publico",
      detalhes: {
        tipo: data.alvo.tipo,
        uf: data.alvo.uf,
        classificacaoRisco: data.resumo.classificacaoRisco,
        totalSancoesCgu: data.resumo.totalSancoesCgu,
        totalCandidaturasTse: data.resumo.totalCandidaturasTse,
      },
      ip,
      userAgent,
    });

    return res.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error("[ERRO CONTROLLER COMPLIANCE]:", err);
    return res.status(500).json({
      success: false,
      error: "Falha ao processar consulta de compliance governamental.",
    });
  }
};
