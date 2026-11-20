import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { supabaseAdmin } from "../config/supabase.js";
import { registrarAuditoria } from "../services/core/auditoria.service.js";
import { cacheService } from "../services/core/cache.service.js";
import { hubApiService, definirSaldoCarteira } from "../services/osint/hubapi.service.js";
import {
  getModulesService,
  getModuleByIdService,
  createModuleService,
  updateModuleService,
  toggleModuleStatusService,
  deleteModuleService,
} from "../services/core/modules.service.js";

const router = Router();

// Middleware composto estritamente para as rotas administrativas (/admin e /api/admin)
router.use(["/admin", "/api/admin"], requireAuth, requireAdmin);

/**
 * ==============================================================================
 * 1. DASHBOARD ADMINISTRATIVO GERAL (/admin)
 * ==============================================================================
 */
router.get("/admin", async (req, res) => {
  try {
    // 1. Métricas Gerais
    const [usuariosRes, buscasRes, auditoriaRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, role, ativo", { count: "exact" }),
      supabaseAdmin.from("buscas").select("id, modulo", { count: "exact" }),
      supabaseAdmin.from("logs_auditoria").select("id", { count: "exact" }),
    ]);

    const totalUsuarios = usuariosRes.count || 0;
    const usuariosAtivos = (usuariosRes.data || []).filter(
      (u) => u.ativo,
    ).length;
    const totalBuscas = buscasRes.count || 0;
    const totalLogs = auditoriaRes.count || 0;

    // 2. Contagem de Buscas por Módulo
    const contagemModulos = (buscasRes.data || []).reduce((acc, curr) => {
      acc[curr.modulo] = (acc[curr.modulo] || 0) + 1;
      return acc;
    }, {});

    // 3. Últimos Logs de Auditoria
    const logsRecentesRes = await supabaseAdmin
      .from("logs_auditoria")
      .select(
        "id, acao, detalhes, ip, criado_em, user_id, profiles:user_id(nome, email)",
      )
      .order("criado_em", { ascending: false })
      .limit(8);

    const logsRecentes = logsRecentesRes.data || [];

    // 4. Status de Recursos do Sistema
    const statusSistema = {
      uptimeHoras: (process.uptime() / 3600).toFixed(1),
      memoriaMb: (process.memoryUsage().rss / 1024 / 1024).toFixed(1),
      nodeVersao: process.version,
      mockMode: process.env.MOCK_MODE === "true",
      timestamp: new Date().toISOString(),
    };

    res.render("admin/dashboard", {
      title: "Painel Geral de Administração - RimuBusca",
      pageTitle: "Painel Administrativo",
      user: req.user,
      isAdmin: true,
      currentPath: "/admin",
      metricas: {
        totalUsuarios,
        usuariosAtivos,
        totalBuscas,
        totalLogs,
        contagemModulos,
      },
      logsRecentes,
      statusSistema,
    });
  } catch (err) {
    console.error("[ERRO ADMIN DASHBOARD]:", err);
    res.status(500).render("errors/500", {
      title: "Erro Interno - 500",
      mensagem: "Falha ao carregar as métricas do painel administrativo.",
      user: req.user,
    });
  }
});

/**
 * ==============================================================================
 * 2. GESTÃO DE USUÁRIOS (/admin/usuarios)
 * ==============================================================================
 */
router.get("/admin/usuarios", async (req, res) => {
  try {
    let usuarios = [];
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, nome, role, ativo, saldo_carteira, limite_diario, criado_em, ultimo_acesso")
      .order("criado_em", { ascending: false });

    if (error) {
      // Fallback gracioso caso colunas de saldo/limite ainda não tenham sido migradas no banco
      const { data: fallbackData } = await supabaseAdmin
        .from("profiles")
        .select("id, email, nome, role, ativo, criado_em, ultimo_acesso")
        .order("criado_em", { ascending: false });
      usuarios = fallbackData || [];
    } else {
      usuarios = data || [];
    }

    // Obtém status da carteira global gerenciada pelo admin
    const carteira = await hubApiService.getWalletStatus();

    res.render("admin/usuarios", {
      title: "Gestão de Usuários & Operadores - RimuBusca",
      pageTitle: "Gestão de Usuários",
      user: req.user,
      isAdmin: true,
      currentPath: "/admin/usuarios",
      usuarios: usuarios || [],
      carteira,
    });
  } catch (err) {
    console.error("[ERRO LISTAR USUARIOS]:", err);
    res.status(500).render("errors/500", {
      title: "Erro - Usuários",
      mensagem: "Falha ao consultar a base de operadores.",
      user: req.user,
    });
  }
});

// Criar Novo Operador
const criarUsuarioSchema = z.object({
  email: z.string().email("E-mail inválido.").trim(),
  password: z.string().min(8, "A senha deve conter no mínimo 8 caracteres."),
  nome: z.string().min(2, "Informe o nome completo do operador.").trim(),
  role: z.enum(["admin", "user"]).default("user"),
});

router.post("/api/admin/usuarios/criar", async (req, res) => {
  const adminId = req.user.id;
  const ip =
    req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0";
  const userAgent = req.headers["user-agent"] || "";

  const validation = criarUsuarioSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: validation.error.errors[0]?.message || "Parâmetros inválidos.",
    });
  }

  const { email, password, nome, role } = validation.data;

  try {
    // 1. Cria usuário no Supabase Auth
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nome, role, ativo: true },
      });

    if (authError) throw authError;

    // 2. Atualiza profile caso o trigger tenha preenchido padrões
    if (authData.user) {
      await supabaseAdmin
        .from("profiles")
        .update({ nome, role, ativo: true })
        .eq("id", authData.user.id);
    }

    // 3. Auditoria
    await registrarAuditoria({
      userId: adminId,
      acao: "admin_criar_usuario",
      detalhes: { novoUsuarioId: authData.user.id, email, role },
      ip,
      userAgent,
    });

    return res.json({
      success: true,
      message: "Operador criado com sucesso!",
      user: authData.user,
    });
  } catch (err) {
    console.error("[ERRO CRIAR USUARIO]:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Erro ao provisionar usuário no sistema.",
    });
  }
});

// Alterar Status Ativo / Inativo
router.put("/api/admin/usuarios/:id/status", async (req, res) => {
  const { id } = req.params;
  const { ativo } = req.body;
  const adminId = req.user.id;
  const ip =
    req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0";

  if (id === adminId) {
    return res.status(400).json({
      success: false,
      error: "Você não pode desativar sua própria conta de administrador.",
    });
  }

  try {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ ativo: Boolean(ativo) })
      .eq("id", id);

    if (error) throw error;

    await registrarAuditoria({
      userId: adminId,
      acao: "admin_alterar_status_usuario",
      detalhes: { alvoUserId: id, novoStatusAtivo: Boolean(ativo) },
      ip,
      userAgent: req.headers["user-agent"] || "",
    });

    return res.json({
      success: true,
      message: `Usuário ${ativo ? "ativado" : "desativado"} com sucesso!`,
    });
  } catch (err) {
    console.error("[ERRO ALTERAR STATUS]:", err);
    return res
      .status(500)
      .json({ success: false, error: "Falha ao alterar status do usuário." });
  }
});

// Alterar Papel (Role)
router.put("/api/admin/usuarios/:id/role", async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  const adminId = req.user.id;
  const ip =
    req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0";

  if (!["admin", "user"].includes(role)) {
    return res
      .status(400)
      .json({ success: false, error: "Papel (role) inválido." });
  }

  if (id === adminId && role !== "admin") {
    return res.status(400).json({
      success: false,
      error:
        "Você não pode revogar seus próprios privilégios de administrador.",
    });
  }

  try {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ role })
      .eq("id", id);

    if (error) throw error;

    await registrarAuditoria({
      userId: adminId,
      acao: "admin_alterar_role_usuario",
      detalhes: { alvoUserId: id, novaRole: role },
      ip,
      userAgent: req.headers["user-agent"] || "",
    });

    return res.json({
      success: true,
      message: `Privilégio alterado para ${role.toUpperCase()} com sucesso!`,
    });
  } catch (err) {
    console.error("[ERRO ALTERAR ROLE]:", err);
    return res
      .status(500)
      .json({ success: false, error: "Falha ao alterar papel do usuário." });
  }
});

// Excluir Operador
router.delete("/api/admin/usuarios/:id", async (req, res) => {
  const { id } = req.params;
  const adminId = req.user.id;
  const ip =
    req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0";

  if (id === adminId) {
    return res.status(400).json({
      success: false,
      error: "Você não pode excluir sua própria conta de administrador.",
    });
  }

  try {
    // Exclui no auth.users (cascata excluirá profiles, buscas, logs)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) throw error;

    await registrarAuditoria({
      userId: adminId,
      acao: "admin_excluir_usuario",
      detalhes: { excluidoUserId: id },
      ip,
      userAgent: req.headers["user-agent"] || "",
    });

    return res.json({
      success: true,
      message: "Usuário removido permanentemente.",
    });
  } catch (err) {
    console.error("[ERRO EXCLUIR USUARIO]:", err);
    return res
      .status(500)
      .json({ success: false, error: "Falha ao excluir usuário." });
  }
});

// Alterar Saldo da Carteira e Limite Diário do Operador
router.put("/api/admin/usuarios/:id/saldo", async (req, res) => {
  const { id } = req.params;
  const adminId = req.user.id;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0";
  const { saldo_carteira, limite_diario } = req.body;

  const parseNumberSafe = (val) => {
    if (val === undefined || val === null || val === "") return undefined;
    const num = typeof val === "number" ? val : Number(String(val).trim().replace(",", "."));
    return isNaN(num) ? undefined : num;
  };

  const parsedSaldo = parseNumberSafe(saldo_carteira);
  const parsedLimite = parseNumberSafe(limite_diario);

  const updates = {};
  if (parsedSaldo !== undefined) {
    updates.saldo_carteira = Number(parsedSaldo.toFixed(2));
  }
  if (parsedLimite !== undefined) {
    updates.limite_diario = Math.max(1, parseInt(parsedLimite, 10));
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, error: "Nenhum valor válido informado." });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update(updates)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) throw error;

    await registrarAuditoria({
      userId: adminId,
      acao: "admin_alterar_saldo_usuario",
      detalhes: { alvoUserId: id, updates },
      ip,
      userAgent: req.headers["user-agent"] || "",
    });

    return res.json({
      success: true,
      message: "Saldo e limites do operador atualizados com sucesso!",
      data,
    });
  } catch (err) {
    console.error("[ERRO ALTERAR SALDO USUARIO]:", err);
    return res.status(500).json({ success: false, error: "Falha ao atualizar saldo e limite do operador." });
  }
});

// Alterar Carteira Global Pay-per-Use (Saldo e Teto Orçamentário)
router.put("/api/admin/carteira", async (req, res) => {
  const adminId = req.user.id;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0";
  const { saldo_atual, orcamento_mensal } = req.body;

  const parseNumberSafe = (val) => {
    if (val === undefined || val === null || val === "") return undefined;
    const num = typeof val === "number" ? val : Number(String(val).trim().replace(",", "."));
    return isNaN(num) ? undefined : num;
  };

  try {
    const parsedSaldo = parseNumberSafe(saldo_atual);
    const parsedOrcamento = parseNumberSafe(orcamento_mensal);

    const novoSaldo = parsedSaldo !== undefined ? Number(parsedSaldo.toFixed(2)) : undefined;
    const novoOrcamento = parsedOrcamento !== undefined ? Number(parsedOrcamento.toFixed(2)) : null;

    const carteira = await definirSaldoCarteira(novoSaldo, novoOrcamento, {
      userId: adminId,
      userNome: req.user.email,
    });

    await registrarAuditoria({
      userId: adminId,
      acao: "admin_alterar_carteira_global",
      detalhes: { novoSaldo, novoOrcamento },
      ip,
      userAgent: req.headers["user-agent"] || "",
    });

    return res.json({
      success: true,
      message: "Carteira global atualizada com sucesso!",
      data: carteira,
    });
  } catch (err) {
    console.error("[ERRO ALTERAR CARTEIRA]:", err);
    return res.status(500).json({ success: false, error: "Falha ao atualizar carteira global." });
  }
});

// Limpeza Manual de Cache (Supabase, Disco e Memória)
router.post("/api/admin/cache/limpar", async (req, res) => {
  const adminId = req.user.id;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0";
  const moduloId = req.body?.modulo || req.body?.moduloId || null;

  try {
    const resultado = await cacheService.limparTudo(moduloId);

    await registrarAuditoria({
      userId: adminId,
      acao: "admin_limpar_cache",
      detalhes: resultado,
      ip,
      userAgent: req.headers["user-agent"] || "",
    });

    return res.json({
      success: true,
      message: `Cache limpo com sucesso! Removidos: ${resultado.removidosDb} no Supabase, ${resultado.removidosMemoria} na memória.`,
      data: resultado,
    });
  } catch (err) {
    console.error("[ERRO LIMPAR CACHE]:", err);
    return res.status(500).json({ success: false, error: "Falha ao executar limpeza de cache." });
  }
});

/**
 * ==============================================================================
 * 3. LOGS DE AUDITORIA IMUTÁVEIS (/admin/logs)
 * ==============================================================================
 */
router.get("/admin/logs", async (req, res) => {
  const acaoFiltro = req.query.acao || "";
  const limite = Math.min(Number(req.query.limite) || 50, 100);

  try {
    let query = supabaseAdmin
      .from("logs_auditoria")
      .select(
        "id, acao, detalhes, ip, user_agent, criado_em, user_id, profiles:user_id(nome, email)",
      )
      .order("criado_em", { ascending: false })
      .limit(limite);

    if (acaoFiltro) {
      query = query.ilike("acao", `%${acaoFiltro}%`);
    }

    const { data: logs, error } = await query;
    if (error) throw error;

    res.render("admin/logs", {
      title: "Trilha de Auditoria & Conformidade - RimuBusca",
      pageTitle: "Logs de Auditoria",
      user: req.user,
      isAdmin: true,
      currentPath: "/admin/logs",
      logs: logs || [],
      acaoFiltro,
    });
  } catch (err) {
    console.error("[ERRO LISTAR AUDITORIA]:", err);
    res.status(500).render("errors/500", {
      title: "Erro - Auditoria",
      mensagem: "Falha ao recuperar os registros de auditoria.",
      user: req.user,
    });
  }
});

/**
 * ==============================================================================
 * 4. CHAVES DE API & SERVIÇOS (/admin/api-keys)
 * ==============================================================================
 */
router.get("/admin/api-keys", async (req, res) => {
  // Lista status das integrações sem expor segredos completos
  const servicos = [
    {
      id: "supabase",
      nome: "Supabase Database & Auth",
      ativo: Boolean(
        process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
      ),
      chaveParcial: process.env.SUPABASE_URL || "Não configurado",
      tipo: "Infraestrutura Principal",
    },
    {
      id: "rimuapi",
      nome: "RimuAPI (Sant Buscas Engine)",
      ativo: Boolean(
        process.env.RIMUAPI_KEY &&
        process.env.RIMUAPI_KEY !== "sua_chave_de_api_aqui" &&
        process.env.RIMUAPI_KEY !== "COLE_SUA_CHAVE_AQUI"
      ),
      chaveParcial: process.env.RIMUAPI_KEY
        ? "••••••••" + process.env.RIMUAPI_KEY.slice(-4)
        : "Mock Engine Ativo",
      tipo: "RimuAPI Engine (43 Módulos Oficiais)",
    },
    {
      id: "hibp",
      nome: "HaveIBeenPwned API",
      ativo: Boolean(
        process.env.HIBP_API_KEY &&
        process.env.HIBP_API_KEY !== "sua_chave_hibp_aqui",
      ),
      chaveParcial: process.env.HIBP_API_KEY
        ? "••••••••" + process.env.HIBP_API_KEY.slice(-4)
        : "Simulação Local Ativa",
      tipo: "Vazamentos de E-mail",
    },
    {
      id: "whoisxml",
      nome: "WhoisXML API",
      ativo: Boolean(
        process.env.WHOISXML_API_KEY &&
        process.env.WHOISXML_API_KEY !== "sua_chave_whois_aqui",
      ),
      chaveParcial: process.env.WHOISXML_API_KEY
        ? "••••••••" + process.env.WHOISXML_API_KEY.slice(-4)
        : "RDAP Oficial Ativo",
      tipo: "Domínios & WHOIS",
    },
    {
      id: "yesitsme_instagram",
      nome: "Instagram OSINT & YesItsMe (0x0be)",
      ativo: Boolean(
        process.env.INSTAGRAM_SESSION_ID &&
        process.env.INSTAGRAM_SESSION_ID !== "seu_session_id_instagram_aqui",
      ),
      chaveParcial:
        process.env.INSTAGRAM_SESSION_ID &&
        process.env.INSTAGRAM_SESSION_ID !== "seu_session_id_instagram_aqui"
          ? "••••••••" + process.env.INSTAGRAM_SESSION_ID.slice(-4)
          : "Motor de Correlação Heurística Ativo",
      tipo: "Cruzamento de Perfis (/redes)",
    },
    {
      id: "datajud_cnj",
      nome: "DataJud - Conselho Nacional de Justiça (CNJ)",
      ativo: true,
      chaveParcial: "API Pública Oficial (91 Tribunais)",
      tipo: "Processos Judiciais (/processos)",
    },
    {
      id: "buscaprocessos_api",
      nome: "BuscaProcessos.app.br (API Processos & IA)",
      ativo: Boolean(
        process.env.BUSCAPROCESSOS_API_KEY &&
        process.env.BUSCAPROCESSOS_API_KEY.trim().length > 0
      ),
      chaveParcial: process.env.BUSCAPROCESSOS_API_KEY && process.env.BUSCAPROCESSOS_API_KEY.trim().length > 0
        ? "••••••••" + process.env.BUSCAPROCESSOS_API_KEY.slice(-4)
        : "Fallback DataJud / Escavador Ativo",
      tipo: "Processos Judiciais (Plano Free/Pro)",
    },
    {
      id: "zeroy_api",
      nome: "Zeroy API (Pay-per-Use)",
      ativo: Boolean(
        process.env.ZEROY_API_KEY &&
        process.env.ZEROY_API_KEY !== "sua_chave_zeroy_api_aqui",
      ),
      chaveParcial: process.env.ZEROY_API_KEY && process.env.ZEROY_API_KEY !== "sua_chave_zeroy_api_aqui"
        ? "••••••••" + process.env.ZEROY_API_KEY.slice(-4)
        : (process.env.ZEROY_API_URL || "https://zeroyapi.online"),
      tipo: "Catálogo Pay-per-Use (/hub-api - 46 módulos)",
    },
    {
      id: "cgu_portal_transparencia",
      nome: "Portal da Transparência (CGU)",
      ativo: Boolean(
        process.env.PORTAL_TRANSPARENCIA_API_KEY &&
        process.env.PORTAL_TRANSPARENCIA_API_KEY !== "sua_chave_portal_transparencia_aqui" &&
        process.env.PORTAL_TRANSPARENCIA_API_KEY !== "COLE_SUA_CHAVE_AQUI"
      ),
      chaveParcial:
        process.env.PORTAL_TRANSPARENCIA_API_KEY &&
        process.env.PORTAL_TRANSPARENCIA_API_KEY !== "sua_chave_portal_transparencia_aqui"
          ? "••••••••" + process.env.PORTAL_TRANSPARENCIA_API_KEY.slice(-4)
          : "Chave Gratuita Gov.br Opcional (TSE/PNCP/Diários Ativos)",
      tipo: "Compliance (CEIS/PEP), Servidores Federais SIAPE & Auxílios Sociais",
    },
    {
      id: "brightdata_social",
      nome: "Bright Data Web Scraper v3",
      ativo: Boolean(
        (process.env.BRIGHTDATA_API_KEY &&
          process.env.BRIGHTDATA_API_KEY !== "sua_chave_brightdata_aqui" &&
          process.env.BRIGHTDATA_API_KEY !== "COLE_SUA_CHAVE_AQUI") ||
        (process.env.BRIGHTDATA_API_TOKEN &&
          process.env.BRIGHTDATA_API_TOKEN !== "sua_chave_brightdata_aqui")
      ),
      chaveParcial: (process.env.BRIGHTDATA_API_KEY || process.env.BRIGHTDATA_API_TOKEN)
        ? "••••••••" + (process.env.BRIGHTDATA_API_KEY || process.env.BRIGHTDATA_API_TOKEN).slice(-4)
        : "Não Configurada (Painel Social Profundo)",
      tipo: "OSINT Social (Instagram & X Posts/Comentários)",
    },
    {
      id: "serpapi_bitcoin",
      nome: "SERP API (Google Surface Web / BTC)",
      ativo: Boolean(
        (process.env.SERPAPI_KEY && process.env.SERPAPI_KEY !== "sua_chave_serpapi_aqui") ||
        (process.env.SERP_API_KEY && process.env.SERP_API_KEY !== "sua_chave_serpapi_aqui")
      ),
      chaveParcial: (process.env.SERPAPI_KEY || process.env.SERP_API_KEY)
        ? "••••••••" + (process.env.SERPAPI_KEY || process.env.SERP_API_KEY).slice(-4)
        : "Fallback DuckDuckGo / Surface Web Ativo",
      tipo: "Busca em Fóruns, GitHub & Reddit (/basic/bitcoin)",
    },
  ];

  res.render("admin/api-keys", {
    title: "Gestão de Chaves de API & Conexões - RimuBusca",
    pageTitle: "Chaves de API",
    user: req.user,
    isAdmin: true,
    currentPath: "/admin/api-keys",
    servicos,
  });
});

/**
 * ==============================================================================
 * 5. GESTÃO DE MÓDULOS NO BANCO DE DADOS (/admin/modulos)
 * ==============================================================================
 */

// Schema de Validação Zod para Módulos
const moduleValidationSchema = z.object({
  slug: z
    .string()
    .min(2, "O slug deve conter no mínimo 2 caracteres.")
    .max(60, "Slug excessivamente longo.")
    .regex(/^[a-z0-9_-]+$/i, "O slug deve conter apenas letras, números, hífen ou underline.")
    .trim(),
  nome: z
    .string()
    .min(2, "O nome do módulo deve conter no mínimo 2 caracteres.")
    .max(100, "Nome excessivamente longo.")
    .trim(),
  descricao: z.string().max(500, "Descrição muito longa.").trim().optional().default(""),
  icone: z.string().min(1).max(50).trim().default("box"),
  cor_icone: z.string().max(30).trim().default("#A78BFA"),
  badge_texto: z.string().max(50).trim().optional().default(""),
  badge_cor: z.string().max(30).trim().default("badge-purple"),
  rota: z.string().min(1, "A rota de acesso é obrigatória.").max(150).trim(),
  categoria: z.enum(["consultas", "osint", "forense", "outros"]).default("osint"),
  ordem: z.coerce.number().int().default(0),
  ativo: z.coerce.boolean().default(true),
  em_breve: z.coerce.boolean().default(false),
  manutencao: z.coerce.boolean().default(false),
});

// Renderiza a tela de Gestão de Módulos (shell — dados carregados via JS/API)
router.get("/admin/modulos", (req, res) => {
  res.render("admin/modulos", {
    title: "Gestão de Módulos do Sistema - RimuBusca",
    pageTitle: "Gestão de Módulos",
    user: req.user,
    isAdmin: true,
    currentPath: "/admin/modulos",
  });
});

// API: Listar todos os módulos (JSON)
router.get("/api/admin/modulos", async (req, res) => {
  try {
    const modulos = await getModulesService({ onlyActive: false });
    return res.json({ success: true, data: modulos });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API: Criar novo módulo
router.post("/api/admin/modulos", async (req, res) => {
  const adminId = req.user.id;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0";
  const userAgent = req.headers["user-agent"] || "";

  const validation = moduleValidationSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: validation.error.errors[0]?.message || "Parâmetros inválidos para o módulo.",
    });
  }

  try {
    const novoModulo = await createModuleService(validation.data);

    await registrarAuditoria({
      userId: adminId,
      acao: "admin_criar_modulo",
      detalhes: {
        moduloId: novoModulo.id,
        slug: novoModulo.slug,
        nome: novoModulo.nome,
        categoria: novoModulo.categoria,
      },
      ip,
      userAgent,
    });

    return res.status(201).json({
      success: true,
      message: `Módulo "${novoModulo.nome}" cadastrado com sucesso!`,
      data: novoModulo,
    });
  } catch (err) {
    console.error("[ERRO CRIAR MODULO]:", err);
    return res.status(400).json({
      success: false,
      error: err.message || "Erro ao salvar o módulo no banco de dados.",
    });
  }
});

// API: Atualizar módulo existente
router.put("/api/admin/modulos/:id", async (req, res) => {
  const { id } = req.params;
  const adminId = req.user.id;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0";
  const userAgent = req.headers["user-agent"] || "";

  const validation = moduleValidationSchema.partial().safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: validation.error.errors[0]?.message || "Parâmetros inválidos para atualização.",
    });
  }

  try {
    const moduloAtualizado = await updateModuleService(id, validation.data);

    await registrarAuditoria({
      userId: adminId,
      acao: "admin_editar_modulo",
      detalhes: {
        moduloId: id,
        camposAlterados: Object.keys(validation.data),
        nome: moduloAtualizado.nome,
      },
      ip,
      userAgent,
    });

    return res.json({
      success: true,
      message: `Módulo "${moduloAtualizado.nome}" atualizado com sucesso!`,
      data: moduloAtualizado,
    });
  } catch (err) {
    console.error("[ERRO ATUALIZAR MODULO]:", err);
    return res.status(400).json({
      success: false,
      error: err.message || "Erro ao atualizar dados do módulo.",
    });
  }
});

// API: Alternar status rápido (Ativo, Manutenção, Em Breve)
router.put(["/api/admin/modulos/:id/status", "/api/admin/modulos/:id/toggle"], async (req, res) => {
  const { id } = req.params;
  const adminId = req.user.id;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0";
  const userAgent = req.headers["user-agent"] || "";

  try {
    const { ativo, manutencao, em_breve } = req.body;
    const flags = {};
    if (ativo !== undefined) flags.ativo = Boolean(ativo);
    if (manutencao !== undefined) flags.manutencao = Boolean(manutencao);
    if (em_breve !== undefined) flags.em_breve = Boolean(em_breve);

    const moduloAtualizado = await toggleModuleStatusService(id, flags);

    await registrarAuditoria({
      userId: adminId,
      acao: "admin_alterar_status_modulo",
      detalhes: { moduloId: id, flags, nome: moduloAtualizado.nome },
      ip,
      userAgent,
    });

    return res.json({
      success: true,
      message: `Status do módulo "${moduloAtualizado.nome}" atualizado!`,
      data: moduloAtualizado,
    });
  } catch (err) {
    console.error("[ERRO ALTERAR STATUS MODULO]:", err);
    return res.status(400).json({
      success: false,
      error: err.message || "Falha ao alterar status do módulo.",
    });
  }
});

// API: Excluir módulo
router.delete("/api/admin/modulos/:id", async (req, res) => {
  const { id } = req.params;
  const adminId = req.user.id;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0";
  const userAgent = req.headers["user-agent"] || "";

  try {
    const moduloExistente = await getModuleByIdService(id);
    await deleteModuleService(id);

    await registrarAuditoria({
      userId: adminId,
      acao: "admin_excluir_modulo",
      detalhes: {
        moduloId: id,
        nome: moduloExistente?.nome || id,
        slug: moduloExistente?.slug,
      },
      ip,
      userAgent,
    });

    return res.json({
      success: true,
      message: `Módulo removido com sucesso.`,
    });
  } catch (err) {
    console.error("[ERRO EXCLUIR MODULO]:", err);
    return res.status(400).json({
      success: false,
      error: err.message || "Falha ao excluir módulo.",
    });
  }
});

export default router;
