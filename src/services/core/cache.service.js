import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { supabaseAdmin } from "../../config/supabase.js";

/**
 * ==============================================================================
 * RIMUBUSCA - SISTEMA DE CACHE MULTI-TIER (CACHE.SERVICE.JS)
 * Projetado especificamente para rodar com alta performance e persistência na VERCEL:
 *
 * Tier 1: In-Memory RAM LRU (Instantâneo < 1ms para requisições no mesmo worker)
 * Tier 2: Supabase Database (Persistente entre deploys e workers serverless na Vercel)
 *         - Tenta tabela dedicada `api_cache`
 *         - Fallback automático para tabela `buscas` existente (zero migração obrigatória)
 * Tier 3: Filesystem (/tmp ou data/cache) com proteção contra EROFS na Vercel
 * ==============================================================================
 */

// Tempo de vida padrão: 24 horas (em milissegundos)
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_MEMORY_ITEMS = 1000;
const SUPABASE_TIMEOUT_MS = 2500;

/**
 * Valida se um objeto de dados é fruto de simulação/mock ou contingência gerada
 */
function isMockOuContingencia(dados, termo = "") {
  if (!dados || typeof dados !== "object") return false;
  if (dados.isMock || dados.contingencia || dados.aviso?.includes("contingência") || dados.aviso?.includes("MOCK_MODE")) {
    return true;
  }
  const termoLimpo = String(termo || "").replace(/\D/g, "");
  // Se for o CNPJ consultado não é o de testes (12.644.825/0001-28), mas retorna os dados mock de Rimu Tecnologia
  if (dados.razaoSocial === "RIMU TECNOLOGIA E INTELIGENCIA LTDA" && termoLimpo && termoLimpo !== "12644825000128") {
    return true;
  }
  // Se for um CPF/Nome consultado que não é Carlos Eduardo, mas retorna o mock Carlos Eduardo
  if (dados.nome === "CARLOS EDUARDO DA SILVA PEREIRA" && termo && !String(termo).toLowerCase().includes("carlos eduardo")) {
    return true;
  }
  return false;
}

function withTimeout(promise, ms = SUPABASE_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("DB timeout")), ms)),
  ]);
}

export class CacheService {
  constructor(defaultTtlMs = DEFAULT_TTL_MS) {
    this.defaultTtlMs = defaultTtlMs;
    this.memoryCache = new Map();

    // Determina se o ambiente é serverless / Vercel (onde filesystem é efêmero/read-only)
    this.isVercel = Boolean(
      process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.NODE_ENV === "production"
    );

    // No Vercel, o cache persistente deve ser 100% no Supabase
    this.diskCacheDir = this.isVercel
      ? path.join(os.tmpdir(), "rimubusca_cache")
      : path.resolve(process.cwd(), "data", "cache");

    if (!this.isVercel) {
      this.ensureDiskDir();
    }

    // Inicializa agendamento de limpeza automática periódica (a cada 24 horas)
    this.iniciarLimpezaAutomatica();
  }

  /**
   * Garante a existência do diretório temporário/local de cache
   */
  ensureDiskDir() {
    try {
      if (!fs.existsSync(this.diskCacheDir)) {
        fs.mkdirSync(this.diskCacheDir, { recursive: true });
      }
    } catch {
      // Fallback de emergência para /tmp do SO se o diretório padrão for somente-leitura
      this.diskCacheDir = path.join(os.tmpdir(), "rimubusca_cache");
      try {
        if (!fs.existsSync(this.diskCacheDir)) {
          fs.mkdirSync(this.diskCacheDir, { recursive: true });
        }
      } catch {
        // Ignora silenciosamente caso o filesystem esteja completamente bloqueado
      }
    }
  }

  /**
   * Normaliza chaves de forma determinística
   * Exemplos:
   *   normalizarTermo("telefone", "(27) 99697-7634") -> "27996977634"
   *   normalizarTermo("cpf-zeroy", "000.111.222-33") -> "00011122233"
   *   normalizarTermo("placa", "bra-2e19") -> "BRA2E19"
   */
  normalizarTermo(moduloId, termo) {
    const mod = String(moduloId || "").toLowerCase().trim();
    const t = String(termo || "").trim();

    if (mod.includes("telefone") || mod === "telefone") {
      let digits = t.replace(/\D/g, "");
      if (digits.length > 11 && digits.startsWith("55")) digits = digits.slice(2);
      return digits || t;
    }

    if (mod.includes("cpf") || mod.includes("cnpj") || mod === "cnh" || mod === "renavam" || mod === "cep") {
      const digits = t.replace(/\D/g, "");
      if (digits.length >= 8) return digits;
    }

    if (mod.includes("placa") || mod === "chassi") {
      return t.toUpperCase().replace(/[^A-Z0-9]/g, "");
    }

    if (mod.includes("email")) {
      return t.toLowerCase().trim();
    }

    return t.toLowerCase().trim();
  }

  /**
   * Gera a chave padronizada de cache
   */
  gerarChave(moduloId, termo) {
    const modLimpo = String(moduloId || "modulo").toLowerCase().trim();
    const termoLimpo = this.normalizarTermo(modLimpo, termo);
    return `${modLimpo}:${termoLimpo}`;
  }

  /**
   * Gera hash SHA-256 seguro para nome de arquivo em disco
   */
  gerarHashArquivo(chave) {
    return crypto.createHash("sha256").update(chave).digest("hex").slice(0, 32);
  }

  /**
   * Obtém item do cache multi-tier (Memória -> Supabase -> Disco)
   *
   * @param {string} moduloId - Identificador do módulo
   * @param {string} termo - Termo consultado
   * @returns {Promise<{ data: any, cachedAt: string, source: string } | null>}
   */
  async get(moduloId, termo) {
    const chave = this.gerarChave(moduloId, termo);
    const now = Date.now();

    // -------------------------------------------------------------
    // Tier 1: In-Memory RAM (Ultra-rápido < 1ms)
    // -------------------------------------------------------------
    const memItem = this.memoryCache.get(chave);
    if (memItem) {
      if (isMockOuContingencia(memItem.data, termo)) {
        this.memoryCache.delete(chave);
      } else if (memItem.expiresAt > now) {
        return {
          data: memItem.data,
          cachedAt: memItem.cachedAt,
          source: "memory",
          chave,
        };
      } else {
        this.memoryCache.delete(chave);
      }
    }

    // -------------------------------------------------------------
    // Tier 2: Supabase (Persistente entre Workers Serverless na Vercel)
    // -------------------------------------------------------------
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        // 2.1 Tenta tabela dedicada api_cache
        const { data: cacheRow, error: cacheErr } = await withTimeout(
          supabaseAdmin
            .from("api_cache")
            .select("dados, created_at, expires_at")
            .eq("cache_key", chave)
            .gt("expires_at", new Date().toISOString())
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          SUPABASE_TIMEOUT_MS
        );

        if (!cacheErr && cacheRow && cacheRow.dados) {
          if (isMockOuContingencia(cacheRow.dados, termo)) {
            // Remove registro mock poluído do Supabase em segundo plano
            Promise.resolve(
              supabaseAdmin.from("api_cache").delete().eq("cache_key", chave)
            ).catch(() => {});
          } else {
            const ttlRestante = new Date(cacheRow.expires_at).getTime() - now;
            if (ttlRestante > 0) {
              this.setMemoria(chave, cacheRow.dados, ttlRestante, cacheRow.created_at);
              return {
                data: cacheRow.dados,
                cachedAt: cacheRow.created_at,
                source: "supabase_table",
                chave,
              };
            }
          }
        }

        // 2.2 Fallback transparente: consulta na tabela 'buscas' existente
        const moduloTagHub = `hub_${moduloId}`;
        const moduloTagZeroy = `zeroy_${moduloId}`;
        const termoNormalizado = this.normalizarTermo(moduloId, termo);

        const { data: buscaRow, error: buscaErr } = await withTimeout(
          supabaseAdmin
            .from("buscas")
            .select("resultado_json, criado_em")
            .or(`modulo.eq.${moduloTagHub},modulo.eq.${moduloTagZeroy},modulo.eq.${moduloId}`)
            .ilike("input", `%${termoNormalizado}%`)
            .order("criado_em", { ascending: false })
            .limit(1)
            .maybeSingle(),
          SUPABASE_TIMEOUT_MS
        );

        if (!buscaErr && buscaRow && buscaRow.resultado_json) {
          const dadosExtraidos = buscaRow.resultado_json.dados || buscaRow.resultado_json;
          if (!isMockOuContingencia(dadosExtraidos, termo) && !isMockOuContingencia(buscaRow.resultado_json, termo)) {
            const dataCriacao = new Date(buscaRow.criado_em).getTime();
            const idadeMs = now - dataCriacao;

            if (idadeMs < this.defaultTtlMs) {
              const ttlRestante = this.defaultTtlMs - idadeMs;
              this.setMemoria(chave, dadosExtraidos, ttlRestante, buscaRow.criado_em);
              return {
                data: dadosExtraidos,
                cachedAt: buscaRow.criado_em,
                source: "supabase_buscas",
                chave,
              };
            }
          }
        }
      } catch (dbErr) {
        // Falha no Supabase (ex: timeout de rede ou offline) não derruba a aplicação
        // Segue para verificação em disco
      }
    }

    // -------------------------------------------------------------
    // Tier 3: Filesystem (/tmp no Vercel ou data/cache local)
    // -------------------------------------------------------------
    try {
      const hash = this.gerarHashArquivo(chave);
      const filePath = path.join(this.diskCacheDir, `${hash}.json`);

      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, "utf-8");
        const parsed = JSON.parse(fileContent);

        if (parsed.expiresAt && parsed.expiresAt > now && parsed.data) {
          if (isMockOuContingencia(parsed.data, termo)) {
            try { fs.unlinkSync(filePath); } catch (_) {}
          } else {
            const ttlRestante = parsed.expiresAt - now;
            this.setMemoria(chave, parsed.data, ttlRestante, parsed.cachedAt);
            return {
              data: parsed.data,
              cachedAt: parsed.cachedAt,
              source: "disk",
              chave,
            };
          }
        } else {
          // Se expirou em disco, remove arquivo
          try { fs.unlinkSync(filePath); } catch (_) {}
        }
      }
    } catch {
      // Falhas no disco são silenciosamente ignoradas
    }

    return null;
  }

  /**
   * Salva item no cache em todos os tiers disponíveis
   *
   * @param {string} moduloId - Identificador do módulo
   * @param {string} termo - Termo consultado
   * @param {any} data - Dados a serem armazenados
   * @param {Object} options - { ttlMs, metadata }
   */
  async set(moduloId, termo, data, options = {}) {
    if (!data || isMockOuContingencia(data, termo)) return;

    const chave = this.gerarChave(moduloId, termo);
    const ttlMs = Number(options.ttlMs) || this.defaultTtlMs;
    const now = Date.now();
    const expiresAt = now + ttlMs;
    const cachedAt = new Date().toISOString();

    // 1. Grava na Memória RAM
    this.setMemoria(chave, data, ttlMs, cachedAt);

    // 2. Grava no Supabase com timeout de segurança para não travar a aplicação
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        await withTimeout(
          supabaseAdmin.from("api_cache").upsert(
            [
              {
                cache_key: chave,
                modulo: moduloId,
                termo: this.normalizarTermo(moduloId, termo),
                dados: data,
                expires_at: new Date(expiresAt).toISOString(),
                created_at: cachedAt,
              },
            ],
            { onConflict: "cache_key" }
          ),
          SUPABASE_TIMEOUT_MS
        );
      } catch {
        // Se a tabela api_cache não existir ou o banco estiver offline, ignora sem quebrar
      }
    }

    // 3. Grava no disco somente se não estiver rodando na Vercel / serverless
    if (!this.isVercel) {
      try {
        this.ensureDiskDir();
        const hash = this.gerarHashArquivo(chave);
        const filePath = path.join(this.diskCacheDir, `${hash}.json`);
        const payload = {
          chave,
          moduloId,
          cachedAt,
          expiresAt,
          data,
        };
        fs.writeFileSync(filePath, JSON.stringify(payload), "utf-8");
      } catch {
        // Ignora falhas de escrita caso o filesystem esteja bloqueado
      }
    }
  }

  /**
   * Helper para armazenar na memória com limite de tamanho LRU
   */
  setMemoria(chave, data, ttlMs, cachedAt) {
    if (this.memoryCache.size >= MAX_MEMORY_ITEMS) {
      // Remove o primeiro item inserido (FIFO/LRU simples)
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) this.memoryCache.delete(firstKey);
    }

    this.memoryCache.set(chave, {
      data,
      expiresAt: Date.now() + ttlMs,
      cachedAt: cachedAt || new Date().toISOString(),
    });
  }

  /**
   * Invalida explicitamente uma chave ou padrão
   */
  async invalidate(moduloId, termo) {
    const chave = this.gerarChave(moduloId, termo);
    this.memoryCache.delete(chave);

    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        await supabaseAdmin.from("api_cache").delete().eq("cache_key", chave);
      } catch {
        // Ignora
      }
    }

    try {
      const hash = this.gerarHashArquivo(chave);
      const filePath = path.join(this.diskCacheDir, `${hash}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // Ignora
    }
  }

  /**
   * Limpa registros expirados no Supabase e na memória RAM
   * Remove entradas com expires_at < NOW()
   * @returns {Promise<{ success: boolean, removidosDb: number, removidosMemoria: number }>}
   */
  async limparCacheExpirado() {
    const nowIso = new Date().toISOString();
    const nowMs = Date.now();
    let removidosMemoria = 0;
    let removidosDb = 0;

    // 1. Limpa na memória RAM
    for (const [key, item] of this.memoryCache.entries()) {
      if (item.expiresAt && item.expiresAt < nowMs) {
        this.memoryCache.delete(key);
        removidosMemoria++;
      }
    }

    // 2. Limpa no banco Supabase
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const { data, error } = await supabaseAdmin
          .from("api_cache")
          .delete()
          .lt("expires_at", nowIso)
          .select("id");

        if (!error && Array.isArray(data)) {
          removidosDb = data.length;
        }
      } catch (err) {
        console.warn("[CACHE CLEANUP DB ERROR]:", err.message);
      }
    }

    console.log(`[CACHE CLEANUP] Limpeza concluída: ${removidosMemoria} memória | ${removidosDb} Supabase.`);
    return {
      success: true,
      removidosDb,
      removidosMemoria,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Limpa TODO o cache incondicionalmente (Memória RAM, Disco e Supabase)
   * Usado para garantir que dados novos venham frescos da API após ação no painel admin
   * @param {string} [moduloId] - Se fornecido, limpa apenas o módulo especificado
   * @returns {Promise<{ success: boolean, removidosDb: number, removidosMemoria: number }>}
   */
  async limparTudo(moduloId = null) {
    let removidosMemoria = 0;
    let removidosDb = 0;

    // 1. Limpa na Memória RAM
    if (moduloId) {
      const prefix = `${String(moduloId).toLowerCase()}:`;
      for (const key of this.memoryCache.keys()) {
        if (key.startsWith(prefix)) {
          this.memoryCache.delete(key);
          removidosMemoria++;
        }
      }
    } else {
      removidosMemoria = this.memoryCache.size;
      this.memoryCache.clear();
    }

    // 2. Limpa no Supabase api_cache
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        let query = supabaseAdmin.from("api_cache").delete();
        if (moduloId) {
          query = query.ilike("cache_key", `${String(moduloId).toLowerCase()}:%`);
        } else {
          // Deleta todas as linhas
          query = query.gte("created_at", "1970-01-01T00:00:00Z");
        }
        const { data, error } = await query.select("id");
        if (!error && Array.isArray(data)) {
          removidosDb = data.length;
        }
      } catch (err) {
        console.warn("[CACHE PURGE DB ERROR]:", err.message);
      }
    }

    // 3. Limpa arquivos em disco (/tmp ou data/cache)
    try {
      if (fs.existsSync(this.diskCacheDir)) {
        const files = fs.readdirSync(this.diskCacheDir);
        for (const file of files) {
          if (file.endsWith(".json")) {
            fs.unlinkSync(path.join(this.diskCacheDir, file));
          }
        }
      }
    } catch (diskErr) {
      console.warn("[CACHE PURGE DISK ERROR]:", diskErr.message);
    }

    console.log(`[CACHE PURGE ALL] Cache completamente limpo: ${removidosMemoria} memória | ${removidosDb} Supabase.`);
    return {
      success: true,
      removidosDb,
      removidosMemoria,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Inicializa agendamento automático periódico de limpeza de cache a cada 24 horas
   */
  iniciarLimpezaAutomatica() {
    if (this._limpezaInterval) return;

    // Executa a cada 24 horas
    const intervalo24h = 24 * 60 * 60 * 1000;
    this._limpezaInterval = setInterval(() => {
      this.limparCacheExpirado().catch((err) => {
        console.warn("[AUTO CACHE CLEANUP ERROR]:", err.message);
      });
    }, intervalo24h);

    // Permite que o processo Node encerre sem ficar preso pelo timer
    if (typeof this._limpezaInterval.unref === "function") {
      this._limpezaInterval.unref();
    }
  }
}

export const cacheService = new CacheService();
