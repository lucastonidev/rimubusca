import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { zeroyService } from "./zeroy.service.js";
import { cacheService } from "../core/cache.service.js";
import { supabaseAdmin } from "../../config/supabase.js";
import { BaseHubService } from "../hub/BaseHubService.js";
import { hubRegistry } from "../hub/HubRegistry.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

let defaultHubCatalog = [];
try {
  defaultHubCatalog = require("../../data/hubapis.json");
} catch {
  try {
    defaultHubCatalog = require("../../../src/data/hubapis.json");
  } catch {
    defaultHubCatalog = [];
  }
}

/**
 * ==============================================================================
 * RIMUBUSCA - PAY-PER-USE API HUB SERVICE (HUBAPI.SERVICE.JS)
 * Gestão centralizada de saldo e orçamento compartilhado entre TODOS os usuários.
 *
 * Herda de BaseHubService (Arquitetura OOP) para garantir reuso imediato caso
 * novas abas e catálogos de APIs sejam adicionados no futuro.
 * ==============================================================================
 */

export const DEFAULT_MONTHLY_BUDGET = Number(process.env.HUB_MONTHLY_BUDGET || 30.0);
export const ORCAMENTO_MENSAL_PADRAO = DEFAULT_MONTHLY_BUDGET;

const SUPABASE_TIMEOUT_MS = 2500;

function withTimeout(promise, ms = SUPABASE_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Supabase timeout")), ms)),
  ]);
}

export class HubApiService extends BaseHubService {
  constructor() {
    super({
      id: "hubapi",
      name: "Catálogo Pay-per-Use Zeroy",
      catalogFilePath: path.resolve(__dirname, "../../data/hubapis.json"),
      catalogModules: Array.isArray(defaultHubCatalog) && defaultHubCatalog.length > 0 ? defaultHubCatalog : [],
      walletId: "global_wallet",
      defaultBudget: DEFAULT_MONTHLY_BUDGET,
      cachePrefix: "zeroy",
      tableNameWallet: "hub_carteira",
      tableNameTransacoes: "hub_transacoes",
    });
  }

  get providerService() {
    return zeroyService;
  }

  /**
   * Sincroniza o estado da carteira compartilhada a partir do Supabase
   */
  async syncFromDatabase() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return;
    }

    try {
      // 1. Consulta saldo e métricas da carteira global
      const { data: carteiraRow, error: errCarteira } = await withTimeout(
        supabaseAdmin
          .from("hub_carteira")
          .select("*")
          .eq("id", "global_wallet")
          .maybeSingle(),
        SUPABASE_TIMEOUT_MS
      );

      if (!errCarteira && carteiraRow) {
        this.walletState.currentBalance = Number(Number(carteiraRow.saldo_atual).toFixed(2));
        this.walletState.monthlyBudget = Number(Number(carteiraRow.orcamento_mensal).toFixed(2));
        this.walletState.totalSpent = Number(Number(carteiraRow.total_gasto).toFixed(2));
        this.walletState.totalQueries = Number(carteiraRow.total_consultas || 0);
      } else if (!errCarteira && !carteiraRow) {
        // Inicializa registro global no Supabase caso ainda não exista
        await withTimeout(
          supabaseAdmin.from("hub_carteira").upsert([
            {
              id: "global_wallet",
              saldo_atual: this.walletState.currentBalance,
              orcamento_mensal: this.walletState.monthlyBudget,
              total_gasto: this.walletState.totalSpent,
              total_consultas: this.walletState.totalQueries,
              atualizado_em: new Date().toISOString(),
            },
          ], { onConflict: "id" }),
          SUPABASE_TIMEOUT_MS
        );
      }

      // 2. Consulta histórico de transações compartilhadas recentes
      const { data: transacoes, error: errTransacoes } = await withTimeout(
        supabaseAdmin
          .from("hub_transacoes")
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
      // Fallback gracioso para a memória/disco local se o banco estiver offline
    }
  }

  /**
   * Persiste o saldo global e transações compartilhadas no Supabase e no disco
   */
  async persistToDatabase(transacaoRecord = null) {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        await withTimeout(
          supabaseAdmin.from("hub_carteira").upsert(
            [
              {
                id: "global_wallet",
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
            supabaseAdmin.from("hub_transacoes").insert([
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
   * Loads the API modules catalog from the central JSON file (src/data/hubapis.json)
   */
  loadCatalog() {
    try {
      if (fs.existsSync(this.catalogFilePath)) {
        const rawContent = fs.readFileSync(this.catalogFilePath, "utf-8");
        const parsedCatalog = JSON.parse(rawContent);

        if (Array.isArray(parsedCatalog)) {
          this.modules = parsedCatalog;
          this.modulesMap.clear();

          for (const moduleItem of this.modules) {
            this.modulesMap.set(moduleItem.id, moduleItem);
          }
          return;
        }
      }
      console.warn(`[HUB API SERVICE] Catalog file not found at: ${this.catalogFilePath}`);
    } catch (err) {
      console.error(`[HUB API SERVICE] Failed to load catalog from JSON:`, err.message);
    }

    // Defensive fallback in case JSON is missing or inaccessible
    this.modules = [];
    this.modulesMap.clear();
  }

  /**
   * Loads persistent wallet state from data/hub_wallet.json
   */
  loadWallet() {
    try {
      if (fs.existsSync(this.walletFilePath)) {
        const rawContent = fs.readFileSync(this.walletFilePath, "utf-8");
        const parsedWallet = JSON.parse(rawContent);

        if (typeof parsedWallet.currentBalance === "number") {
          this.walletState = {
            ...this.walletState,
            ...parsedWallet,
          };
        } else if (typeof parsedWallet.saldoAtual === "number") {
          // Backward compatibility with legacy Portuguese wallet files
          this.walletState = {
            currentBalance: parsedWallet.saldoAtual,
            monthlyBudget: parsedWallet.orcamentoMensal || this.defaultMonthlyBudget,
            totalSpent: parsedWallet.totalGasto || 0.0,
            totalQueries: parsedWallet.totalConsultas || 0,
            history: parsedWallet.historico || [],
          };
        }
      }
    } catch (err) {
      console.warn(`[HUB API SERVICE] Failed to load local wallet state:`, err.message);
    }
  }

  /**
   * Saves current wallet state to persistent local disk storage
   */
  saveWallet() {
    try {
      if (!fs.existsSync(this.dataDirectoryPath)) {
        fs.mkdirSync(this.dataDirectoryPath, { recursive: true });
      }

      const walletSnapshot = {
        currentBalance: Number(this.walletState.currentBalance.toFixed(2)),
        monthlyBudget: Number(this.walletState.monthlyBudget.toFixed(2)),
        totalSpent: Number(this.walletState.totalSpent.toFixed(2)),
        totalQueries: this.walletState.totalQueries,
        history: this.walletState.history.slice(-50),

        // Legacy compatibility fields
        saldoAtual: Number(this.walletState.currentBalance.toFixed(2)),
        orcamentoMensal: Number(this.walletState.monthlyBudget.toFixed(2)),
        totalGasto: Number(this.walletState.totalSpent.toFixed(2)),
        totalConsultas: this.walletState.totalQueries,
        historico: this.walletState.history.slice(-50),
      };

      fs.writeFileSync(this.walletFilePath, JSON.stringify(walletSnapshot, null, 2), "utf-8");
    } catch (err) {
      console.warn(`[HUB API SERVICE] Failed to save local wallet state:`, err.message);
    }
  }

  /**
   * Returns a specific module by its unique identifier (e.g. 'cpf-live', 'placa', 'cnpj')
   */
  getModuleById(moduleId) {
    if (!moduleId) return null;
    return this.modulesMap.get(String(moduleId).trim()) || null;
  }

  /**
   * Formats numbers to Brazilian Currency format (R$ 0,00)
   */
  formatCurrency(value) {
    const num = Number(value) || 0;
    return `R$ ${num.toFixed(2).replace(".", ",")}`;
  }

  /**
   * Calculates real-time wallet metrics and enriches every catalog module
   * with remaining query capacity based on current balance.
   * Syncs with Supabase to ensure shared balance across all users and Vercel workers.
   */
  async getWalletStatus() {
    // Sincroniza estado compartilhado mais recente do banco
    await this.syncFromDatabase();

    const currentBalance = Number(this.walletState.currentBalance.toFixed(2));
    const monthlyBudget = Number(this.walletState.monthlyBudget.toFixed(2));
    const balancePercentage = monthlyBudget > 0
      ? Math.max(0, Math.min(100, Math.round((currentBalance / monthlyBudget) * 100)))
      : 0;

    // Enriquecimento dinâmico de cada um dos 46 módulos com capacidade do saldo compartilhado
    const enrichedModules = this.modules.map((moduleItem) => {
      const remainingQueries = Math.floor(currentBalance / moduleItem.custo);
      const budgetMaxQueries = Math.floor(monthlyBudget / moduleItem.custo);
      const moduleBalancePercentage = budgetMaxQueries > 0
        ? Math.max(0, Math.min(100, Math.round((remainingQueries / budgetMaxQueries) * 100)))
        : 0;

      return {
        ...moduleItem,
        path: moduleItem.path || `/${moduleItem.id}`,
        custoFormatado: this.formatCurrency(moduleItem.custo),
        consultasRestantes: remainingQueries,
        maxConsultasComOrcamento: budgetMaxQueries,
        percentualSaldo: moduleBalancePercentage,
        disponivel: currentBalance >= moduleItem.custo,
      };
    });

    return {
      currentBalance,
      monthlyBudget,
      balancePercentage,
      totalSpent: Number(this.walletState.totalSpent.toFixed(2)),
      totalQueries: this.walletState.totalQueries,
      totalModules: this.modules.length,
      modules: enrichedModules,
      history: this.walletState.history.slice(-25).reverse(),

      // View & controller compatibility aliases
      saldoAtual: currentBalance,
      saldoFormatado: this.formatCurrency(currentBalance),
      saldoAtualFormatado: this.formatCurrency(currentBalance),
      orcamentoMensal: monthlyBudget,
      orcamentoFormatado: this.formatCurrency(monthlyBudget),
      orcamentoMensalFormatado: this.formatCurrency(monthlyBudget),
      percentualSaldo: balancePercentage,
      percentualSaldoGeral: balancePercentage,
      totalGasto: Number(this.walletState.totalSpent.toFixed(2)),
      totalGastoFormatado: this.formatCurrency(this.walletState.totalSpent),
      totalConsultas: this.walletState.totalQueries,
      totalModulos: this.modules.length,
      modulos: enrichedModules,
      historico: this.walletState.history.slice(-25).reverse(),
    };
  }

  /**
   * Recharges the shared wallet balance or adjusts monthly budget limit
   */
  async rechargeBalance(additionalAmount = 20.0, newBudgetLimit = null, meta = {}) {
    await this.syncFromDatabase();

    const amount = Number(additionalAmount) || 0;
    this.walletState.currentBalance = Math.max(0, Number((this.walletState.currentBalance + amount).toFixed(2)));

    if (newBudgetLimit && Number(newBudgetLimit) > 0) {
      this.walletState.monthlyBudget = Number(Number(newBudgetLimit).toFixed(2));
    }

    const rechargeRecord = {
      tipo: "RECARGA",
      type: "RECHARGE",
      descricao: `Recarga de Saldo Compartilhado no valor de ${this.formatCurrency(amount)}`,
      valor: amount,
      saldoApos: this.walletState.currentBalance,
      userId: meta.userId || null,
      userNome: meta.userNome || "Administrador",
      timestamp: new Date().toISOString(),
    };

    this.walletState.history.push(rechargeRecord);
    await this.persistToDatabase(rechargeRecord);

    return this.getWalletStatus();
  }

  /**
   * Define diretamente o saldo atual e/ou o orçamento mensal da carteira
   */
  async setWalletBalance(newBalance, newBudgetLimit = null, meta = {}) {
    await this.syncFromDatabase();

    if (typeof newBalance === "number" && !isNaN(newBalance) && newBalance >= 0) {
      this.walletState.currentBalance = Number(newBalance.toFixed(2));
    }

    if (newBudgetLimit !== null && typeof newBudgetLimit === "number" && !isNaN(newBudgetLimit) && newBudgetLimit >= 0) {
      this.walletState.monthlyBudget = Number(newBudgetLimit.toFixed(2));
    }

    const adjustRecord = {
      tipo: "AJUSTE_ADMIN",
      type: "ADMIN_ADJUST",
      descricao: `Ajuste Administrativo de Saldo para ${this.formatCurrency(this.walletState.currentBalance)}`,
      valor: this.walletState.currentBalance,
      saldoApos: this.walletState.currentBalance,
      userId: meta.userId || null,
      userNome: meta.userNome || "Administrador",
      timestamp: new Date().toISOString(),
    };

    this.walletState.history.push(adjustRecord);
    await this.persistToDatabase(adjustRecord);

    return this.getWalletStatus();
  }

  /**
   * Executes a paid OSINT query for a given module, deducting the cost from the SHARED wallet.
   * If total budget is R$ 20.00 and User X spends R$ 1.00, User Y will have R$ 19.00 available.
   * Includes multi-tier caching (Vercel-proof) and auto-refund on API failure.
   */
  async executeQuery(params = {}) {
    const rawModuleId = params.moduleId || params.moduloId || params.id;
    const rawQueryValue = params.queryValue || params.parametroValor || params.termo || params.valor;
    const userId = params.userId || null;
    const userNome = params.userNome || null;
    const forceRefresh = Boolean(params.forceRefresh);

    const targetModule = this.getModuleById(rawModuleId);
    if (!targetModule) {
      throw new Error(`Módulo '${rawModuleId}' não encontrado no Catálogo Pay-per-Use.`);
    }

    const cleanQueryValue = String(rawQueryValue || "").trim();
    if (!cleanQueryValue) {
      throw new Error(`Informe o parâmetro '${targetModule.parametroLabel}' para executar a consulta.`);
    }

    // 1. Verificação no Cache Multi-Tier (Vercel-proof): se já consultado, NÃO debita saldo!
    if (!forceRefresh) {
      try {
        const cached = await cacheService.get(targetModule.id, cleanQueryValue);
        if (cached && cached.data) {
          console.log(`[HUB API CACHE HIT] Módulo: ${targetModule.id} (${cleanQueryValue}) via ${cached.source}`);
          const remainingQueries = Math.floor(this.walletState.currentBalance / targetModule.custo);
          const balancePercentage = Math.round((this.walletState.currentBalance / this.walletState.monthlyBudget) * 100);

          return {
            success: true,
            cached: true,
            cacheSource: cached.source,
            cacheTimestamp: cached.cachedAt,
            modulo: {
              id: targetModule.id,
              nome: targetModule.nome,
              categoria: targetModule.categoria,
              path: targetModule.path || `/${targetModule.id}`,
              custoDebitado: 0,
              custoFormatado: "R$ 0,00 (Cache Instantâneo)",
            },
            carteira: {
              saldoAtual: this.walletState.currentBalance,
              saldoFormatado: this.formatCurrency(this.walletState.currentBalance),
              percentualSaldo: balancePercentage,
              consultasRestantes: remainingQueries,
            },
            consulta: {
              termo: cleanQueryValue,
              timestamp: new Date().toISOString(),
            },
            dados: cached.data,
          };
        }
      } catch (cacheErr) {
        console.warn("[HUB API CACHE READ ERROR]:", cacheErr.message);
      }
    }

    // 2. Sincroniza o saldo compartilhado mais recente entre todos os usuários
    await this.syncFromDatabase();

    // 3. Verificação de Saldo Compartilhado Suficiente
    if (this.walletState.currentBalance < targetModule.custo) {
      const missingBalance = (targetModule.custo - this.walletState.currentBalance).toFixed(2).replace(".", ",");
      throw new Error(
        `Saldo compartilhado insuficiente! Saldo atual para toda a equipe: ${this.formatCurrency(this.walletState.currentBalance)}. Esta consulta custa ${this.formatCurrency(targetModule.custo)}. Recarregue ao menos R$ ${missingBalance} para continuar.`
      );
    }

    // 4. Deduz o custo do saldo compartilhado
    this.walletState.currentBalance = Number((this.walletState.currentBalance - targetModule.custo).toFixed(2));
    this.walletState.totalSpent = Number((this.walletState.totalSpent + targetModule.custo).toFixed(2));
    this.walletState.totalQueries += 1;

    const debitRecord = {
      tipo: "DEBITO",
      type: "DEBIT",
      moduloId: targetModule.id,
      moduloNome: targetModule.nome,
      path: targetModule.path || `/${targetModule.id}`,
      parametro: cleanQueryValue,
      custo: targetModule.custo,
      saldoApos: this.walletState.currentBalance,
      userId: userId || null,
      userNome: userNome || "Operador",
      timestamp: new Date().toISOString(),
    };

    this.walletState.history.push(debitRecord);
    await this.persistToDatabase(debitRecord);

    // 5. Executa a consulta direta na ZeroyService com timeout de 45s
    let queryResult = null;
    try {
      const response = await zeroyService.consultar(targetModule.id, cleanQueryValue, { forceRefresh });
      queryResult = response.dados || response;

      // Grava no cache
      try {
        await cacheService.set(targetModule.id, cleanQueryValue, queryResult);
      } catch (cacheSaveErr) {
        console.warn("[HUB API CACHE SAVE ERROR]:", cacheSaveErr.message);
      }
    } catch (err) {
      console.warn(`[HUB API / ZEROY ERROR] Failed query on module ${targetModule.id}:`, err.message);
      // Estorna o saldo compartilhado em caso de falha externa
      this.walletState.currentBalance = Number((this.walletState.currentBalance + targetModule.custo).toFixed(2));
      this.walletState.totalSpent = Number((this.walletState.totalSpent - targetModule.custo).toFixed(2));
      this.walletState.totalQueries = Math.max(0, this.walletState.totalQueries - 1);
      this.walletState.history.pop();
      await this.persistToDatabase({
        tipo: "ESTORNO",
        moduloId: targetModule.id,
        moduloNome: targetModule.nome,
        parametro: cleanQueryValue,
        custo: 0,
        saldoApos: this.walletState.currentBalance,
        userId: userId || null,
        userNome: userNome || "Sistema",
      });
      throw err;
    }

    const remainingQueries = Math.floor(this.walletState.currentBalance / targetModule.custo);
    const balancePercentage = Math.round((this.walletState.currentBalance / this.walletState.monthlyBudget) * 100);

    return {
      success: true,
      cached: false,
      modulo: {
        id: targetModule.id,
        nome: targetModule.nome,
        categoria: targetModule.categoria,
        path: targetModule.path || `/${targetModule.id}`,
        custoDebitado: targetModule.custo,
        custoFormatado: this.formatCurrency(targetModule.custo),
      },
      carteira: {
        saldoAtual: this.walletState.currentBalance,
        saldoFormatado: this.formatCurrency(this.walletState.currentBalance),
        percentualSaldo: balancePercentage,
        consultasRestantes: remainingQueries,
      },
      consulta: {
        termo: cleanQueryValue,
        timestamp: new Date().toISOString(),
      },
      dados: queryResult,
    };
  }

  /**
   * Verifica se a carteira global possui saldo suficiente para cobrir um custo antes da consulta.
   * Lança erro com descrição do saldo atual e valor faltante caso não haja saldo.
   */
  async verificarSaldoDisponivel(custo) {
    await this.syncFromDatabase();
    const custoNum = Number(custo) || 0;
    if (this.walletState.currentBalance < custoNum) {
      const falta = (custoNum - this.walletState.currentBalance).toFixed(2).replace(".", ",");
      throw new Error(
        `Saldo compartilhado insuficiente! Saldo atual na carteira: ${this.formatCurrency(this.walletState.currentBalance)}. Esta consulta custa ${this.formatCurrency(custoNum)}. Adicione ao menos R$ ${falta} para continuar.`
      );
    }
    return true;
  }

  /**
   * Debita o custo de uma consulta Zeroy da carteira global compartilhada (hub_carteira e hub_transacoes).
   * Retorna resumo atualizado da carteira com saldo formatado.
   */
  async debitarConsultaZeroy(meta, termo, options = {}) {
    await this.syncFromDatabase();
    const custo = Number(meta?.custo || 0);

    if (custo > 0) {
      this.walletState.currentBalance = Number(Math.max(0, this.walletState.currentBalance - custo).toFixed(2));
      this.walletState.totalSpent = Number((this.walletState.totalSpent + custo).toFixed(2));
      this.walletState.totalQueries += 1;

      const debitRecord = {
        tipo: "DEBITO",
        type: "DEBIT",
        moduloId: meta?.id || "zeroy",
        moduloNome: meta?.nome || meta?.id || "Zeroy API",
        path: meta?.path || `/${meta?.id || ""}`,
        parametro: String(termo || "").trim(),
        custo: custo,
        saldoApos: this.walletState.currentBalance,
        userId: options.userId || null,
        userNome: options.userNome || "Operador",
        timestamp: new Date().toISOString(),
      };

      this.walletState.history.push(debitRecord);
      await this.persistToDatabase(debitRecord);
    }

    const remainingQueries = custo > 0 ? Math.floor(this.walletState.currentBalance / custo) : 0;
    const balancePercentage = this.walletState.monthlyBudget > 0
      ? Math.round((this.walletState.currentBalance / this.walletState.monthlyBudget) * 100)
      : 0;

    return {
      custoDebitado: custo,
      custoFormatado: this.formatCurrency(custo),
      saldoAtual: this.walletState.currentBalance,
      saldoFormatado: this.formatCurrency(this.walletState.currentBalance),
      percentualSaldo: balancePercentage,
      consultasRestantes: remainingQueries,
    };
  }

  /**
   * Retorna resumo rápido da carteira sem débito (para respostas servidas do cache)
   */
  async getWalletSummary(custo = 0) {
    await this.syncFromDatabase();
    const custoNum = Number(custo) || 0;
    const remainingQueries = custoNum > 0 ? Math.floor(this.walletState.currentBalance / custoNum) : 0;
    const balancePercentage = this.walletState.monthlyBudget > 0
      ? Math.round((this.walletState.currentBalance / this.walletState.monthlyBudget) * 100)
      : 0;

    return {
      custoDebitado: 0,
      custoFormatado: "R$ 0,00 (Cache Instantâneo)",
      saldoAtual: this.walletState.currentBalance,
      saldoFormatado: this.formatCurrency(this.walletState.currentBalance),
      percentualSaldo: balancePercentage,
      consultasRestantes: remainingQueries,
    };
  }
}

// Singleton Instance
export const hubApiService = new HubApiService();

// Registra no HubRegistry global (disponível para injeção e descoberta)
hubRegistry.register("hubapi", hubApiService);
hubRegistry.register("zeroy", hubApiService);
hubRegistry.register("main", hubApiService);

// Backward-compatible named exports for controllers and views
export const CATALOGO_MODULOS = hubApiService.modules;
export const obterStatusCarteira = () => hubApiService.getWalletStatus();
export const recarregarSaldoCarteira = (valorAdicional, novoOrcamento, meta) =>
  hubApiService.rechargeBalance(valorAdicional, novoOrcamento, meta);
export const definirSaldoCarteira = (novoSaldo, novoOrcamento, meta) =>
  hubApiService.setWalletBalance(novoSaldo, novoOrcamento, meta);
export const executarConsultaHubModulo = (params) =>
  hubApiService.executeQuery(params);
