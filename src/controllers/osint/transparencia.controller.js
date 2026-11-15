import { z } from "zod";
import {
  buscarOrgaosSiape,
  consultarBeneficiosSociais,
  consultarServidoresFederais,
} from "../../services/osint/transparencia.service.js";
import { supabaseAdmin } from "../../config/supabase.js";
import { registrarAuditoria } from "../../services/core/auditoria.service.js";

const servidoresSchema = z.object({
  cpf: z.string().max(32).optional().default(""),
  nome: z.string().max(160).optional().default(""),
  orgaoServidorLotacao: z.string().max(32).optional().default(""),
  tipoServidor: z.union([z.string(), z.number()]).optional().default(""),
  situacaoServidor: z.union([z.string(), z.number()]).optional().default(""),
  mesAno: z.string().max(12).optional().default(""),
  incluirRemuneracao: z.boolean().optional().default(true),
  incluirViagens: z.boolean().optional().default(true),
  pagina: z.coerce.number().int().min(1).max(20).optional().default(1),
});

const beneficiosSchema = z.object({
  cpf: z.string().max(32).optional().default(""),
  nis: z.string().max(32).optional().default(""),
  varreduraCompleta: z.boolean().optional().default(true),
  pagina: z.coerce.number().int().min(1).max(20).optional().default(1),
});

async function registrarBuscaHistorico({ userId, modulo, input, resultadoJson }) {
  if (!userId || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    await supabaseAdmin.from("buscas").insert([
      {
        user_id: userId,
        modulo,
        input: String(input || "").slice(0, 140),
        resultado_json: resultadoJson,
      },
    ]);
  } catch (err) {
    console.warn(`[TRANSPARENCIA BUSCA LOG ${modulo}]:`, err.message);
  }
}

/**
 * Controller: Consulta Servidores Públicos Federais (SIAPE / Portal da Transparência CGU).
 */
export const consultarServidoresFederaisController = async (req, res) => {
  const userId = req.user?.id;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0";
  const userAgent = req.headers["user-agent"] || "";

  const parsed = servidoresSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: parsed.error.errors[0]?.message || "Parâmetros inválidos para consulta de servidores federais.",
    });
  }

  try {
    const data = await consultarServidoresFederais(parsed.data);
    if (!data.sucesso) {
      const status = data.status === "chave_nao_configurada" ? 503 : data.status === "rate_limit" ? 429 : 400;
      return res.status(status).json({
        success: false,
        status: data.status || "erro",
        error: data.erro || "Falha ao consultar servidores federais.",
        dica: data.dica || null,
        exigeOrgao: Boolean(data.exigeOrgao),
        linksOficiais: data.linksOficiais || [],
      });
    }

    const inputResumo =
      data.consulta.cpfFormatado ||
      data.consulta.nome ||
      (data.consulta.orgaoServidorLotacao ? `Órgão SIAPE ${data.consulta.orgaoServidorLotacao}` : "Servidor Federal");

    await Promise.allSettled([
      registrarBuscaHistorico({
        userId,
        modulo: "servidores_federais",
        input: inputResumo,
        resultadoJson: data,
      }),
      registrarAuditoria({
        userId,
        acao: "consulta_servidores_federais",
        detalhes: {
          temCpf: Boolean(data.consulta.cpf),
          temNome: Boolean(data.consulta.nome),
          orgao: data.consulta.orgaoServidorLotacao,
          totalServidores: data.resumo.totalServidores,
          totalEducacaoFederal: data.resumo.totalEducacaoFederal,
        },
        ip,
        userAgent,
      }),
    ]);

    return res.json({ success: true, data });
  } catch (err) {
    console.error("[ERRO CONTROLLER SERVIDORES FEDERAIS]:", err);
    return res.status(500).json({
      success: false,
      error: "Erro interno ao consultar o Portal da Transparência Federal.",
    });
  }
};

/**
 * Controller auxiliar: Lista órgãos do SIAPE por nome ou código (ex.: Universidades Federais e IFs).
 */
export const buscarOrgaosSiapeController = async (req, res) => {
  const termo = String(req.query.q || req.query.termo || "").trim();
  const codigo = String(req.query.codigo || "").trim();
  const pagina = Number(req.query.pagina || 1) || 1;

  try {
    const data = await buscarOrgaosSiape({ termo, codigo, pagina });
    return res.json({ success: true, data });
  } catch (err) {
    console.error("[ERRO CONTROLLER ORGAOS SIAPE]:", err);
    return res.status(500).json({
      success: false,
      error: "Falha ao listar órgãos SIAPE na CGU.",
    });
  }
};

/**
 * Controller: Consulta Benefícios & Auxílios Sociais Federais (Bolsa Família, BPC, Auxílio Emergencial, Defeso, Safra, PETI).
 */
export const consultarBeneficiosSociaisController = async (req, res) => {
  const userId = req.user?.id;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0";
  const userAgent = req.headers["user-agent"] || "";

  const parsed = beneficiosSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: parsed.error.errors[0]?.message || "Parâmetros inválidos para consulta de benefícios sociais.",
    });
  }

  try {
    const data = await consultarBeneficiosSociais(parsed.data);
    if (!data.sucesso) {
      const status = data.status === "chave_nao_configurada" ? 503 : data.status === "rate_limit" ? 429 : 400;
      return res.status(status).json({
        success: false,
        status: data.status || "erro",
        error: data.erro || "Falha ao consultar benefícios sociais.",
        linksOficiais: data.linksOficiais || [],
      });
    }

    const inputResumo = data.consulta.cpfFormatado || (data.consulta.nis ? `NIS ${data.consulta.nis}` : "Benefícios CGU");

    await Promise.allSettled([
      registrarBuscaHistorico({
        userId,
        modulo: "beneficios_auxilios",
        input: inputResumo,
        resultadoJson: data,
      }),
      registrarAuditoria({
        userId,
        acao: "consulta_beneficios_auxilios",
        detalhes: {
          temCpf: Boolean(data.consulta.cpf),
          temNis: Boolean(data.consulta.nis),
          programasIdentificados: data.resumo.totalProgramasIdentificados,
          totalParcelasPagina: data.resumo.totalParcelasPagina,
        },
        ip,
        userAgent,
      }),
    ]);

    return res.json({ success: true, data });
  } catch (err) {
    console.error("[ERRO CONTROLLER BENEFICIOS SOCIAIS]:", err);
    return res.status(500).json({
      success: false,
      error: "Erro interno ao consultar benefícios no Portal da Transparência.",
    });
  }
};
