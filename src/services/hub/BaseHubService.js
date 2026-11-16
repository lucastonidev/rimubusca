import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cacheService } from "../core/cache.service.js";
import { supabaseAdmin } from "../../config/supabase.js";

const SUPABASE_TIMEOUT_MS = 2500;

function withTimeout(promise, ms = SUPABASE_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Supabase timeout")), ms)),
  ]);
}

/**
 * ==============================================================================
 * RIMUBUSCA - CLASSE BASE PARA HUBS DE APIS E CATÁLOGOS PAY-PER-USE
 * (BASEHUBSERVICE.JS)
 *
 * Arquitetura Orientada a Objetos (OOP) que padroniza:
 * - Catálogo de módulos via JSON ou Array dinâmico
 * - Gestão de carteira e saldo compartilhado (memória, disco local e Supabase)
 * - Débito e controle de concorrência com travas de orçamento
 * - Histórico e extrato de transações auditadas
 * - Verificação de cache pré-consulta
 *
 * Para criar uma nova aba/hub no futuro:
 *   class NovoHubService extends BaseHubService { ... }
 *   const meuHub = new NovoHubService({ id: 'meuhub', catalogFilePath: '...' });
 * ==============================================================================
 */
export class BaseHubService {
  /**
   * @param {Object} options
   * @param {string} options.id - Identificador único do Hub (ex: 'zeroy_hub', 'aspect_hub')
   * @param {string} options.name - Nome amigável do Hub (ex: 'Catálogo Hub APIs')
   * @param {string} [options.catalogFilePath] - Caminho absoluto para o JSON com os módulos
   * @param {Array} [options.catalogModules] - Array direto de módulos caso não use JSON
   * @param {string} [options.walletId='global_wallet'] - ID da carteira compartilhada no Supabase
   * @param {number} [options.defaultBudget=20.0] - Orçamento mensal inicial padrão
   * @param {Object} [options.providerService] - Instância de serviço da API provedora
   * @param {string} [options.cachePrefix='hub'] - Prefixo para isolamento no cacheService
   * @param {string} [options.tableNameWallet='hub_carteira'] - Tabela no Supabase para carteira
   * @param {string} [options.tableNameTransacoes='hub_transacoes'] - Tabela no Supabase para extrato
   */
  constructor(options = {}) {
    this.id = options.id || "base_hub";
    this.name = options.name || "API Hub";
    this.catalogFilePath = options.catalogFilePath || null;
    this.initialCatalogModules = options.catalogModules || [];
    this.walletId = options.walletId || "global_wallet";
    this.defaultMonthlyBudget = Number(options.defaultBudget || 20.0);
    if (options.providerService !== undefined) {
      this.providerService = options.providerService;
    }
    this.cachePrefix = options.cachePrefix || "hub";
    this.tableNameWallet = options.tableNameWallet || "hub_carteira";
    this.tableNameTransacoes = options.tableNameTransacoes || "hub_transacoes";

    const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    this.dataDirectoryPath = isVercel
      ? path.join(os.tmpdir(), "rimubusca_data")
      : path.resolve(process.cwd(), "data");
    this.walletFilePath = path.join(this.dataDirectoryPath, `${this.walletId}_wallet.json`);

    this.walletState = {
      currentBalance: this.defaultMonthlyBudget,
      monthlyBudget: this.defaultMonthlyBudget,
      totalSpent: 0.0,
      totalQueries: 0,
      history: [],
    };

    this.modules = [];
    this.modulesMap = new Map();

    this.loadCatalog();
    this.loadWallet();
  }

  /**
   * Carrega o catálogo de módulos a partir do arquivo JSON ou do array fornecido
   */
  loadCatalog() {
    try {
      if (this.catalogFilePath && fs.existsSync(this.catalogFilePath)) {
        const raw = fs.readFileSync(this.catalogFilePath, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.modules = parsed;
          this.modulesMap.clear();
          for (const item of this.modules) {
            this.modulesMap.set(item.id, item);
          }
          return;
        }
      }
    } catch (err) {
      console.warn(`[${this.name}] Erro ao ler catálogo JSON (${this.catalogFilePath}):`, err.message);
    }

    if (Array.isArray(this.initialCatalogModules) && this.initialCatalogModules.length > 0) {
      this.modules = this.initialCatalogModules;
      this.modulesMap.clear();
      for (const item of this.modules) {
        this.modulesMap.set(item.id, item);
      }
      return;
    }

    this.modules = [];
    this.modulesMap.clear();
  }

  /**
   * Sincroniza saldo e transações compartilhadas a partir do Supabase
   */
  async syncFromDatabase() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return;
    }

    try {
      // 1. Busca saldo da carteira
      const { data: carteiraRow, error: errCarteira } = await withTimeout(
        supabaseAdmin
          .from(this.tableNameWallet)
          .select("*")
          .eq("id", this.walletId)
          .maybeSingle(),
        SUPABASE_TIMEOUT_MS
      );

      if (!errCarteira && carteiraRow) {
        this.walletState.currentBalance = Number(Number(carteiraRow.saldo_atual).toFixed(2));
        this.walletState.monthlyBudget = Number(Number(carteiraRow.orcamento_mensal).toFixed(2));
        this.walletState.totalSpent = Number(Number(carteiraRow.total_gasto).toFixed(2));
        this.walletState.totalQueries = Number(carteiraRow.total_consultas || 0);
      } else if (!errCarteira && !carteiraRow) {
        // Inicializa registro no banco
        await withTimeout(
          supabaseAdmin.from(this.tableNameWallet).upsert(
            [
              {
                id: this.walletId,
                saldo_atual: this.walletState.currentBalance,
                orcamento_mensal: this.walletState.monthlyBudget,
                total_gasto: this.walletState.totalSpent,
                total_consultas: this.walletState.totalQueries,
                atualizado_em: new Date().toISOString(),
              },
            ],
            { onConflict: "id" }
          ),
          SUPABASE_TIMEOUT_MS
        );
      }

      // 2. Busca histórico recente de transações
      const { data: transacoes, error: errTransacoes } = await withTimeout(
        supabaseAdmin
          .from(this.tableNameTransacoes)
          .select("*")
          .order("criado_em", { ascending: false })
          .limit(25),
        SUPABASE_TIMEOUT_MS
      );

      if (!errTransacoes && Array.isArray(transacoes) && transacoes.length > 0) {
        this.walletState.history = transacoes.map((t) => ({
          tipo: t.tipo,
          type: t.tipo,
          moduloId: t.modulo_id,
          moduloNome: t.modulo_nome,
          parametro: t.termo,
          custo: Number(t.custo || 0),
          saldoApos: Number(t.saldo_apos || 0),
          userId: t.user_id,
          userNome: t.user_nome || "Operador",
          timestamp: t.criado_em,
        }));
      }
    } catch {
      // Fallback gracioso para dados locais
    }
  }

  /**
   * Persiste saldo atualizado e histórico no Supabase e no disco local
   * @param {Object} [transacaoRecord]
   */
  async persistToDatabase(transacaoRecord = null) {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        await withTimeout(
          supabaseAdmin.from(this.tableNameWallet).upsert(
            [
              {
                id: this.walletId,
                saldo_atual: Number(this.walletState.currentBalance.toFixed(2)),
                orcamento_mensal: Number(this.walletState.monthlyBudget.toFixed(2)),
                total_gasto: Number(this.walletState.totalSpent.toFixed(2)),
                total_consultas: this.walletState.totalQueries,
                atualizado_em: new Date().toISOString(),
              },
            ],
            { onConflict: "id" }
          ),
          SUPABASE_TIMEOUT_MS
        );

        if (transacaoRecord) {
          await withTimeout(
            supabaseAdmin.from(this.tableNameTransacoes).insert([
              {
                tipo: transacaoRecord.tipo || "DEBITO",
                user_id: transacaoRecord.userId || null,
                user_nome: transacaoRecord.userNome || null,
                modulo_id: transacaoRecord.moduloId || null,
                modulo_nome: transacaoRecord.moduloNome || null,
                termo: transacaoRecord.parametro || null,
                custo: transacaoRecord.custo || 0,
                saldo_apos: transacaoRecord.saldoApos,
              },
            ]),
            SUPABASE_TIMEOUT_MS
          );
        }
      } catch {
        // Fallback gracioso
      }
    }

    this.saveWallet();
  }

  /**
   * Carrega estado local de contingência do disco
   */
  loadWallet() {
    try {
      if (fs.existsSync(this.walletFilePath)) {
        const raw = fs.readFileSync(this.walletFilePath, "utf-8");
        const parsed = JSON.parse(raw);
        if (typeof parsed.currentBalance === "number") {
          this.walletState = { ...this.walletState, ...parsed };
        } else if (typeof parsed.saldoAtual === "number") {
          this.walletState = {
            currentBalance: parsed.saldoAtual,
            monthlyBudget: parsed.orcamentoMensal || this.defaultMonthlyBudget,
            totalSpent: parsed.totalGasto || 0.0,
            totalQueries: parsed.totalConsultas || 0,
            history: parsed.historico || [],
          };
        }
      }
    } catch (err) {
      console.warn(`[${this.name}] Falha ao ler carteira local:`, err.message);
    }
  }

  /**
   * Salva estado local de contingência no disco
   */
  saveWallet() {
    try {
      if (!fs.existsSync(this.dataDirectoryPath)) {
        fs.mkdirSync(this.dataDirectoryPath, { recursive: true });
      }
      fs.writeFileSync(this.walletFilePath, JSON.stringify(this.walletState, null, 2), "utf-8");
    } catch {
      // Ignora silenciosamente em ambientes somente leitura
    }
  }

  /**
   * Retorna o status da carteira compartilhado
   */
  async getStatus() {
    await this.syncFromDatabase();

    const currentBalance = Number(this.walletState.currentBalance.toFixed(2));
    const monthlyBudget = Number(this.walletState.monthlyBudget.toFixed(2));
    const totalSpent = Number(this.walletState.totalSpent.toFixed(2));
    const percentRemaining =
      monthlyBudget > 0 ? Math.max(0, Math.min(100, Math.round((currentBalance / monthlyBudget) * 100))) : 0;

    return {
      hubId: this.id,
      hubName: this.name,
      saldoAtual: currentBalance,
      saldoDisponivel: currentBalance,
      orcamentoMensal: monthlyBudget,
      totalGasto: totalSpent,
      totalConsultas: this.walletState.totalQueries,
      percentualSaldo: percentRemaining,
      saldoCompartilhado: true,
      modulosTotal: this.modules.length,
      modulos: this.modules.map((m) => ({
        ...m,
        disponivelNoSaldo: currentBalance >= Number(m.custo || 0),
      })),
      historico: this.walletState.history.slice(0, 20),
    };
  }

  /**
   * Debita o custo de uma consulta da carteira compartilhada
   */
  async debitarSaldo({ custo, moduloId, moduloNome, parametro, userId = null, userNome = "Operador" }) {
    await this.syncFromDatabase();

    const custoNum = Number(Number(custo || 0).toFixed(2));
    if (this.walletState.currentBalance < custoNum) {
      const saldoFmt = this.walletState.currentBalance.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      const custoFmt = custoNum.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      throw new Error(`Saldo insuficiente na carteira compartilhada (${saldoFmt}). Esta consulta requer ${custoFmt}.`);
    }

    this.walletState.currentBalance = Number((this.walletState.currentBalance - custoNum).toFixed(2));
    this.walletState.totalSpent = Number((this.walletState.totalSpent + custoNum).toFixed(2));
    this.walletState.totalQueries += 1;

    const transacao = {
      tipo: "DEBITO",
      moduloId,
      moduloNome,
      parametro: String(parametro || "").slice(0, 60),
      custo: custoNum,
      saldoApos: this.walletState.currentBalance,
      userId,
      userNome,
      timestamp: new Date().toISOString(),
    };

    this.walletState.history.unshift(transacao);
    if (this.walletState.history.length > 50) {
      this.walletState.history.pop();
    }

    await this.persistToDatabase(transacao);

    return {
      sucesso: true,
      custoDebitado: custoNum,
      saldoRestante: this.walletState.currentBalance,
      transacao,
    };
  }

  /**
   * Recarrega o saldo ou ajusta o orçamento mensal
   */
  async recarregarSaldo({ valor = 0, novoOrcamento = null, userId = null, userNome = "Operador" }) {
    await this.syncFromDatabase();

    const valorNum = Number(Number(valor || 0).toFixed(2));

    if (valorNum > 0) {
      this.walletState.currentBalance = Number((this.walletState.currentBalance + valorNum).toFixed(2));
    }

    if (novoOrcamento !== null && typeof novoOrcamento === "number") {
      this.walletState.monthlyBudget = Number(Number(novoOrcamento).toFixed(2));
    }

    const transacao = {
      tipo: "CREDITO",
      moduloId: "recarga",
      moduloNome: novoOrcamento ? "Recarga & Ajuste de Teto" : "Recarga Manual de Saldo",
      parametro: `+R$ ${valorNum.toFixed(2)}`,
      custo: valorNum,
      saldoApos: this.walletState.currentBalance,
      userId,
      userNome,
      timestamp: new Date().toISOString(),
    };

    this.walletState.history.unshift(transacao);
    await this.persistToDatabase(transacao);

    return {
      sucesso: true,
      novoSaldo: this.walletState.currentBalance,
      novoOrcamento: this.walletState.monthlyBudget,
      transacao,
    };
  }

  /**
   * Executa consulta em um módulo do catálogo com validação de saldo e cache
   */
  async executarConsulta({ moduloId, parametroValor, userId = null, userNome = "Operador", forceRefresh = false }) {
    const modulo = this.modulesMap.get(moduloId);
    if (!modulo) {
      throw new Error(`Módulo '${moduloId}' não encontrado no catálogo ${this.name}.`);
    }

    if (!modulo.ativo) {
      throw new Error(`O módulo '${modulo.nome}' está temporariamente indisponível.`);
    }

    const termoLimpo = String(parametroValor || "").trim();
    if (!termoLimpo) {
      throw new Error("Parâmetro de consulta não informado.");
    }

    const cacheKey = `${this.cachePrefix}_${moduloId}`;

    // 1. Verifica cache multi-tier se não forçar recarga
    if (!forceRefresh) {
      const cached = await cacheService.get(cacheKey, termoLimpo);
      if (cached && cached.data) {
        return {
          sucesso: true,
          origem: "cache",
          cacheSource: cached.source,
          cachedAt: cached.cachedAt,
          modulo: {
            id: modulo.id,
            nome: modulo.nome,
            categoria: modulo.categoria,
            custo: 0.0,
            custoReal: modulo.custo,
          },
          termo: termoLimpo,
          dados: cached.data.dados || cached.data,
          saldoRestante: this.walletState.currentBalance,
        };
      }
    }

    // 2. Valida e debita saldo antes de chamar a API externa
    const debito = await this.debitarSaldo({
      custo: modulo.custo,
      moduloId: modulo.id,
      moduloNome: modulo.nome,
      parametro: termoLimpo,
      userId,
      userNome,
    });

    // 3. Executa a requisição no provedor correspondente
    let resultadoApi;
    if (this.providerService && typeof this.providerService.consultarModulo === "function") {
      resultadoApi = await this.providerService.consultarModulo(modulo, termoLimpo);
    } else if (this.providerService && typeof this.providerService.consultar === "function") {
      resultadoApi = await this.providerService.consultar(modulo, termoLimpo);
    } else {
      resultadoApi = {
        status: "sucesso",
        modulo: modulo.nome,
        consulta: termoLimpo,
        resultado: "Provedor padrão de demonstração.",
        timestamp: new Date().toISOString(),
      };
    }

    // 4. Salva no cache
    await cacheService.set(cacheKey, termoLimpo, resultadoApi, 24 * 60 * 60 * 1000);

    return {
      sucesso: true,
      origem: "live",
      modulo: {
        id: modulo.id,
        nome: modulo.nome,
        categoria: modulo.categoria,
        custo: modulo.custo,
      },
      termo: termoLimpo,
      dados: resultadoApi.dados || resultadoApi,
      saldoRestante: debito.saldoRestante,
      transacao: debito.transacao,
    };
  }
}
