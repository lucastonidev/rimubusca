import { z } from "zod";
import { supabaseAdmin } from "../../config/supabase.js";
import { registrarAuditoria } from "../../services/core/auditoria.service.js";

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
 * ==============================================================================
 * RIMUBUSCA - CONTROLLER BASE REUTILIZÁVEL PARA HUBS DE APIS (BASEHUBCONTROLLER.JS)
 *
 * Permite criar rotas HTTP para qualquer novo Hub com apenas 2 linhas de código:
 *   const meuController = new BaseHubController(meuHubService);
 *   router.get('/meu-hub/status', meuController.obterStatus);
 *   router.post('/meu-hub/consultar', meuController.executarConsulta);
 *   router.post('/meu-hub/recarregar', meuController.recarregar);
 * ==============================================================================
 */
export class BaseHubController {
  /**
   * @param {BaseHubService} hubService
   */
  constructor(hubService) {
    if (!hubService) {
      throw new Error("Instância de BaseHubService é obrigatória para o Controller.");
    }
    this.hubService = hubService;
  }

  /**
   * Retorna o status da carteira e a lista dos módulos do Hub
   */
  obterStatus = async (req, res) => {
    try {
      const status = await this.hubService.getStatus();
      return res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error) {
      console.error(`[${this.hubService.name}] Erro ao obter status da carteira:`, error);
      return res.status(500).json({
        success: false,
        error: error.message || "Erro interno ao obter status da carteira.",
      });
    }
  };

  /**
   * Executa uma consulta em um dos módulos do catálogo
   */
  executarConsulta = async (req, res) => {
    const userId = req.user?.id;
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0";
    const userAgent = req.headers["user-agent"] || "";

    const validation = consultaSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0]?.message || "Parâmetros de busca inválidos.",
      });
    }

    const { moduloId, parametroValor, forceRefresh } = validation.data;
    const userNome =
      req.profile?.nome || req.user?.nome || (req.user?.email ? req.user.email.split("@")[0] : "Operador");

    try {
      const resultado = await this.hubService.executarConsulta({
        moduloId,
        parametroValor,
        userId,
        userNome,
        forceRefresh,
      });

      // Registra busca e auditoria de forma não bloqueante
      if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && userId) {
        Promise.resolve(
          supabaseAdmin.from("buscas").insert([
            {
              user_id: userId,
              modulo: `${this.hubService.cachePrefix}_${moduloId}`,
              input: parametroValor,
              resultado_json: resultado,
            },
          ])
        ).catch((dbErr) => {
          console.warn(`[SUPABASE HISTORICO ${this.hubService.id.toUpperCase()}]:`, dbErr.message);
        });
      }

      await registrarAuditoria({
        userId,
        acao: `consulta_${this.hubService.id}`,
        detalhes: {
          moduloId,
          moduloNome: resultado.modulo?.nome,
          parametro: parametroValor,
          custo: resultado.modulo?.custo,
          origem: resultado.origem,
          saldoRestante: resultado.saldoRestante,
        },
        ip,
        userAgent,
      }).catch(() => {});

      return res.status(200).json({
        success: true,
        data: resultado,
      });
    } catch (error) {
      console.error(`[${this.hubService.name}] Erro na execução de consulta:`, error);
      return res.status(400).json({
        success: false,
        error: error.message || "Falha ao processar consulta no Hub.",
      });
    }
  };

  /**
   * Recarrega o saldo ou ajusta o orçamento mensal
   */
  recarregar = async (req, res) => {
    const userId = req.user?.id;
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0";
    const userAgent = req.headers["user-agent"] || "";

    const validation = recargaSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0]?.message || "Parâmetros de recarga inválidos.",
      });
    }

    const { valor, novoOrcamento } = validation.data;
    const userNome =
      req.profile?.nome || req.user?.nome || (req.user?.email ? req.user.email.split("@")[0] : "Operador");

    try {
      const resultado = await this.hubService.recarregarSaldo({
        valor: valor || 0,
        novoOrcamento,
        userId,
        userNome,
      });

      await registrarAuditoria({
        userId,
        acao: `recarga_saldo_${this.hubService.id}`,
        detalhes: {
          valorRecarregado: valor || 0,
          novoOrcamento: novoOrcamento || null,
          novoSaldo: resultado.novoSaldo,
          operador: userNome,
        },
        ip,
        userAgent,
      }).catch(() => {});

      return res.status(200).json({
        success: true,
        message: `Saldo atualizado com sucesso para R$ ${resultado.novoSaldo.toFixed(2)}.`,
        data: resultado,
      });
    } catch (error) {
      console.error(`[${this.hubService.name}] Erro na recarga:`, error);
      return res.status(400).json({
        success: false,
        error: error.message || "Falha ao processar recarga.",
      });
    }
  };
}
