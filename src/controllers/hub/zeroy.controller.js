import { z } from "zod";
import { zeroyService } from "../../services/osint/zeroy.service.js";
import { hubApiService } from "../../services/osint/hubapi.service.js";
import { supabaseAdmin } from "../../config/supabase.js";
import { registrarAuditoria } from "../../services/core/auditoria.service.js";

/**
 * ==============================================================================
 * RIMUBUSCA - CONTROLLER ZEROY API (ZEROY.CONTROLLER.JS)
 * Gerencia as requisições HTTP da API REST para a Zeroy API a partir dos IDs
 * dos módulos cadastrados no JSON (src/data/hubapis.json).
 * ==============================================================================
 */

const zeroyConsultaSchema = z
  .object({
    id: z.string().optional(),
    tipo: z.string().optional(),
    moduloId: z.string().optional(),
    termo: z.string().max(250).optional().default(""),
    nome: z.string().max(250).optional(),
    valor: z.string().max(250).optional(),
    parametroValor: z.string().max(250).optional(),
    busca: z.string().max(250).optional(),
    query: z.string().max(250).optional(),
    cpf: z.string().max(30).optional(),
    cnpj: z.string().max(30).optional(),
    chave: z.string().max(150).optional(),
    telefone: z.string().max(30).optional(),
    banco: z.string().max(60).optional(),
    tipoPix: z.string().max(50).optional(),
    imagem: z.string().max(10_000_000).optional(),
    top_k: z.coerce.number().int().min(1).max(10).optional().default(3),
    threshold: z.coerce.number().min(0).max(1).optional().default(0.35),
    forceRefresh: z
      .preprocess((v) => v === true || v === "true" || v === "1", z.boolean())
      .optional()
      .default(false),
  });

export class ZeroyController {
  constructor(service = zeroyService) {
    this.service = service;
    this.consultar = this.consultar.bind(this);
    this.listarModulos = this.listarModulos.bind(this);
    this.obterModuloPorId = this.obterModuloPorId.bind(this);
  }

  /**
   * Endpoint GET /api/zeroy/modulos
   * Retorna todos os módulos configurados a partir do JSON central
   */
  async listarModulos(req, res) {
    return res.json({
      success: true,
      data: hubApiService.modules,
    });
  }

  /**
   * Endpoint GET /api/zeroy/modulos/:id
   * Retorna os metadados de um módulo específico pelo ID
   */
  async obterModuloPorId(req, res) {
    const modulo = hubApiService.getModuleById(req.params.id);
    if (!modulo) {
      return res.status(404).json({
        success: false,
        error: `Módulo '${req.params.id}' não encontrado no catálogo.`,
      });
    }
    return res.json({
      success: true,
      data: modulo,
    });
  }

  /**
   * Endpoint POST /api/zeroy/consultar
   * Executa a busca real na Zeroy API resolvendo o path e parâmetro pelo ID do JSON
   */
  async consultar(req, res) {
    const userId = req.user?.id;
    const userNome = req.user?.nome || req.user?.name || req.profile?.nome || "Operador";
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0";
    const userAgent = req.headers["user-agent"] || "";

    const validation = zeroyConsultaSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0]?.message || "Parâmetros inválidos.",
      });
    }

    const moduloId = String(
      validation.data.id || validation.data.tipo || validation.data.moduloId || "placa"
    )
      .toLowerCase()
      .trim();

    const isReconnc = moduloId === "reconnc";
    const termoNormalizado =
      validation.data.termo ||
      validation.data.nome ||
      validation.data.parametroValor ||
      validation.data.valor ||
      validation.data.busca ||
      validation.data.query ||
      validation.data.cpf ||
      validation.data.cnpj ||
      validation.data.chave ||
      validation.data.telefone ||
      "";

    if (isReconnc) {
      if (!req.file?.buffer && !validation.data.imagem) {
        return res.status(400).json({
          success: false,
          error: "Envie uma foto facial válida para o módulo de Reconhecimento Facial.",
        });
      }
    } else if (!termoNormalizado.trim()) {
      return res.status(400).json({
        success: false,
        error: "Informe ao menos um valor de busca (CPF, CNPJ, Chave, Telefone, Nome ou Termo).",
      });
    }

    const consultaInput = isReconnc
      ? {
          ...validation.data,
          termo: termoNormalizado || req.file?.originalname || "Reconhecimento Facial",
          imageBuffer: req.file?.buffer || null,
          originalName: req.file?.originalname || "face.jpg",
          imagem: validation.data.imagem || null,
        }
      : {
          ...validation.data,
          termo: termoNormalizado,
        };

    // Obtém metadados do módulo a partir do catálogo central para custo e nome
    const metaModulo = hubApiService.getModuleById(moduloId) || {
      id: moduloId,
      nome: moduloId,
      custo: isReconnc ? 0.05 : 0.1,
      path: `/${moduloId}`,
    };

    try {
      // 1. Verifica saldo da carteira global antes de executar a consulta
      await hubApiService.verificarSaldoDisponivel(metaModulo.custo);

      // 2. Executa a requisição na Zeroy API puxando o path e parâmetro do JSON
      const resultado = await this.service.consultar(moduloId, consultaInput);
      const inputSalvo = String(resultado.termo || termoNormalizado || moduloId).slice(0, 200);

      // 3. Debita o custo do módulo apenas quando não for notFound nem cache hit
      const isNotFound = Boolean(resultado.notFound);
      const infoCarteira =
        isNotFound || resultado.cached
          ? await hubApiService.getWalletSummary(metaModulo.custo)
          : await hubApiService.debitarConsultaZeroy(metaModulo, inputSalvo, {
              userId,
              userNome,
              ip,
            });

      resultado.carteira = infoCarteira;
      resultado.custo = isNotFound || resultado.cached ? 0 : metaModulo.custo;
      resultado.custoFormatado = hubApiService.formatCurrency(resultado.custo);

      // Salva histórico e auditoria de forma assíncrona não bloqueante
      if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && userId && !isNotFound) {
        Promise.resolve(
          supabaseAdmin.from("buscas").insert([
            {
              user_id: userId,
              modulo: `zeroy_${moduloId}`,
              input: inputSalvo,
              resultado_json: resultado,
            },
          ])
        ).catch((dbErr) => {
          console.warn("[SUPABASE HISTORICO]:", dbErr.message);
        });
      }

      Promise.resolve(
        registrarAuditoria({
          userId,
          acao: `consulta_zeroy_${moduloId}`,
          detalhes: {
            moduloId,
            termo: inputSalvo,
            fonte: resultado.fonte,
            custo: resultado.custo,
            saldoApos: infoCarteira.saldoAtual,
            cached: Boolean(resultado.cached),
            notFound: isNotFound,
            url: resultado.urlConsultada,
          },
          ip,
          userAgent,
        })
      ).catch((auditErr) => {
        console.warn("[AUDITORIA]:", auditErr.message);
      });

      return res.json({
        success: true,
        data: resultado,
      });
    } catch (err) {
      console.error("[ZEROY CONTROLLER ERRO]:", err.message);
      const isBalanceErr = Boolean(err.message && err.message.includes("Saldo compartilhado insuficiente"));
      const statusCode = err.statusCode || (isBalanceErr ? 402 : 502);
      return res.status(statusCode).json({
        success: false,
        error: err.message || "Falha ao conectar com a Zeroy API.",
      });
    }
  }
}

// Instância Singleton para uso nas rotas
export const zeroyController = new ZeroyController();

// Exportações funcionais para compatibilidade
export const consultarZeroyController = (req, res) => zeroyController.consultar(req, res);
export const listarModulosZeroyController = (req, res) => zeroyController.listarModulos(req, res);
export const obterModuloZeroyController = (req, res) => zeroyController.obterModuloPorId(req, res);

