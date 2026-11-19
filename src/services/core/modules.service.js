import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { supabaseAdmin } from "../../config/supabase.js";
import { parseSupabaseError } from "../../utils/supabaseErrorParser.js";
import { RIMU_MODULOS } from "../../data/rimuModulos.js";

/**
 * ==============================================================================
 * RIMUBUSCA - SERVIÇO DE GERENCIAMENTO DE MÓDULOS (MODULES.SERVICE.JS)
 * Gerencia o catálogo de módulos do banco de dados (tabela 'modules') com
 * persistência local em cache (data/modules.json) para alta disponibilidade.
 * Suporta os 43 módulos da RimuAPI + módulos nativos de OSINT e Forense.
 * ==============================================================================
 */

const DATA_DIR = path.resolve(process.cwd(), "data");
const MODULES_FILE = path.join(DATA_DIR, "modules.json");

function mapBadgeColor(hexColor) {
  if (!hexColor) return "badge-purple";
  const hex = hexColor.toLowerCase();
  if (hex === "#10b981") return "badge-green";
  if (hex === "#8b5cf6" || hex === "#6366f1" || hex === "#a855f7") return "badge-purple";
  if (hex === "#3b82f6" || hex === "#06b6d4" || hex === "#0ea5e9") return "badge-purple";
  if (hex === "#ef4444" || hex === "#dc2626" || hex === "#f43f5e") return "badge-red";
  if (hex === "#f59e0b" || hex === "#eab308") return "badge-warning";
  return "badge-purple";
}

// Catálogo base de módulos para seed e fallback resiliente
export const MODULOS_PADRAO = [
  // 1. OS 43 MÓDULOS OFICIAIS DA RIMUAPI
  ...RIMU_MODULOS.map((m, index) => ({
    id: `mod-${m.tipo}`,
    slug: m.tipo,
    nome: m.nome,
    descricao: m.descricao,
    icone: m.icone || "box",
    imagem_url: null,
    cor_icone: m.badgeColor || "#A78BFA",
    badge_texto: m.badge || m.categoriaNome,
    badge_cor: mapBadgeColor(m.badgeColor),
    rota: `/advanced/person?tipo=${m.tipo}`,
    categoria: "consultas",
    ordem: index + 1,
    ativo: true,
    em_breve: false,
    manutencao: false,
    roles_permitidas: ["user", "admin"],
    config: {
      subcategoria: m.categoria,
      categoriaNome: m.categoriaNome,
      tipo: m.tipo,
      placeholder: m.placeholder,
      mask: m.mask,
      parametroNome: m.parametroNome,
      badge: m.badge,
      badgeColor: m.badgeColor,
    },
  })),

  // 2. MÓDULOS DE INTELIGÊNCIA OSINT
  {
    id: "mod-processos",
    slug: "processos",
    nome: "Processos Judiciais",
    descricao: "Rastreamento unificado no DataJud (CNJ - 91 Tribunais), validação Módulo 97 e diários.",
    icone: "scale",
    cor_icone: "#F59E0B",
    badge_texto: "DataJud CNJ",
    badge_cor: "badge-purple",
    rota: "/basic/processes",
    categoria: "osint",
    ordem: 50,
    ativo: true,
    em_breve: false,
    manutencao: false,
    roles_permitidas: ["user", "admin"],
    config: {},
  },
  {
    id: "mod-redes",
    slug: "redes",
    nome: "Redes Sociais & Contas Online",
    descricao: "Descubra contas em mais de 80 plataformas por @Username ou localize perfis cruzando dados.",
    icone: "users",
    cor_icone: "#EC4899",
    badge_texto: "80+ Redes",
    badge_cor: "badge-purple",
    rota: "/basic/instagram",
    categoria: "osint",
    ordem: 51,
    ativo: true,
    em_breve: false,
    manutencao: false,
    roles_permitidas: ["user", "admin"],
    config: {},
  },
  {
    id: "mod-telefone_osint",
    slug: "telefone_osint",
    nome: "Telefone OSINT (Telecom)",
    descricao: "Identificação de operadora original, DDD/região Anatel, tipo de linha e telecom.",
    icone: "phone-call",
    cor_icone: "#A78BFA",
    badge_texto: "Telecom",
    badge_cor: "badge-purple",
    rota: "/basic/smartphone",
    categoria: "osint",
    ordem: 52,
    ativo: true,
    em_breve: false,
    manutencao: false,
    roles_permitidas: ["user", "admin"],
    config: {},
  },
  {
    id: "mod-dominio",
    slug: "dominio",
    nome: "Domínio & DNS",
    descricao: "Consultas WHOIS, zonas de DNS (A, MX, TXT), subdomínios expostos e tecnologias.",
    icone: "globe-2",
    cor_icone: "#38BDF8",
    badge_texto: "WHOIS / DNS",
    badge_cor: "badge-purple",
    rota: "/basic/domain",
    categoria: "osint",
    ordem: 53,
    ativo: true,
    em_breve: false,
    manutencao: false,
    roles_permitidas: ["user", "admin"],
    config: {},
  },
  {
    id: "mod-email_osint",
    slug: "email_osint",
    nome: "E-mail OSINT (Holehe & GHunt)",
    descricao: "Inteligência de e-mail com Mosint (DNS/MX), Holehe (contas sociais) e GHunt (Google).",
    icone: "mail-search",
    cor_icone: "#38BDF8",
    badge_texto: "Holehe & GHunt",
    badge_cor: "badge-purple",
    rota: "/basic/email",
    categoria: "osint",
    ordem: 54,
    ativo: true,
    em_breve: false,
    manutencao: false,
    roles_permitidas: ["user", "admin"],
    config: {},
  },
  {
    id: "mod-servidores_federais",
    slug: "servidores_federais",
    nome: "Servidores Públicos Federais",
    descricao: "Consulta Executivo Federal (SIAPE): vínculos, cargos, universidades/IFs e remuneração mensal (CGU).",
    icone: "landmark",
    cor_icone: "#38BDF8",
    badge_texto: "CGU SIAPE",
    badge_cor: "badge-purple",
    rota: "/basic/servidores",
    categoria: "osint",
    ordem: 55,
    ativo: true,
    em_breve: false,
    manutencao: false,
    roles_permitidas: ["user", "admin"],
    config: {},
  },
  {
    id: "mod-beneficios_auxilios",
    slug: "beneficios_auxilios",
    nome: "Benefícios & Auxílios Sociais",
    descricao: "Novo Bolsa Família, BPC/LOAS, Auxílio Emergencial, Seguro-Defeso, Garantia-Safra e PETI por CPF ou NIS.",
    icone: "hand-coins",
    cor_icone: "#10B981",
    badge_texto: "CGU Social",
    badge_cor: "badge-purple",
    rota: "/basic/auxilios",
    categoria: "osint",
    ordem: 56,
    ativo: true,
    em_breve: false,
    manutencao: false,
    roles_permitidas: ["user", "admin"],
    config: {},
  },

  // 3. MÓDULOS FORENSES
  {
    id: "mod-metadados",
    slug: "metadados",
    nome: "Dados de Arquivo (Metadados Forenses)",
    descricao: "Extração EXIF, GPS com mapa interativo, autor, software e hashes SHA-256/MD5.",
    icone: "file-search",
    cor_icone: "#A78BFA",
    badge_texto: "Forense EXIF",
    badge_cor: "badge-purple",
    rota: "/basic/metadata",
    categoria: "forense",
    ordem: 60,
    ativo: true,
    em_breve: false,
    manutencao: false,
    roles_permitidas: ["user", "admin"],
    config: {},
  },
  {
    id: "mod-pix_boleto",
    slug: "pix_boleto",
    nome: "PIX & Boleto Forense",
    descricao: "Decodificador BR Code (CRC16) e auditoria matemática de Boletos FEBRABAN (Mod 10/11 & fator 2025).",
    icone: "qr-code",
    cor_icone: "#34D399",
    badge_texto: "Zero API Cost",
    badge_cor: "badge-purple",
    rota: "/basic/financeiro",
    categoria: "forense",
    ordem: 61,
    ativo: true,
    em_breve: false,
    manutencao: false,
    roles_permitidas: ["user", "admin"],
    config: {},
  },
  {
    id: "mod-bitcoin",
    slug: "bitcoin",
    nome: "Investigação Bitcoin (BTC)",
    descricao: "Rastreamento on-chain (saldo, transações), cruzamento Surface Web e varredura Dark Web (.onion).",
    icone: "bitcoin",
    cor_icone: "#F59E0B",
    badge_texto: "On-Chain + Dark Web",
    badge_cor: "badge-warning",
    rota: "/basic/bitcoin",
    categoria: "forense",
    ordem: 62,
    ativo: true,
    em_breve: false,
    manutencao: false,
    roles_permitidas: ["user", "admin"],
    config: {},
  },
];

/**
 * Carrega a lista local de módulos
 */
function carregarModulosLocal() {
  try {
    if (fs.existsSync(MODULES_FILE)) {
      const raw = fs.readFileSync(MODULES_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("[MODULES SERVICE] Falha ao ler cache local de módulos:", err.message);
  }

  // Inicializa com os módulos padrão se o arquivo não existir
  salvarModulosLocal(MODULOS_PADRAO);
  return MODULOS_PADRAO;
}

let ultimoHashModulos = null;

/**
 * Salva a lista de módulos no cache local (evita I/O desnecessário se não houver alteração)
 */
function salvarModulosLocal(modulos) {
  try {
    const jsonStr = JSON.stringify(modulos, null, 2);
    if (jsonStr === ultimoHashModulos && fs.existsSync(MODULES_FILE)) {
      return;
    }
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(MODULES_FILE, jsonStr, "utf-8");
    ultimoHashModulos = jsonStr;
  } catch (err) {
    console.warn("[MODULES SERVICE] Falha ao salvar cache local de módulos:", err.message);
  }
}

function comTimeout(prom, ms = 3000) {
  return Promise.race([
    prom,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout ao conectar com Supabase")), ms)
    ),
  ]);
}

/**
 * Busca todos os módulos do sistema
 * @param {Object} [options]
 * @param {boolean} [options.onlyActive=false] - Se deve filtrar apenas módulos ativos
 * @returns {Promise<Array>}
 */
const MODULOS_NATIVOS_BUILTIN = [
  {
    id: "9c4e7f2a-4b11-48d9-9e3c-2f81b6a10201",
    slug: "pix_boleto",
    nome: "PIX & Boleto Forense",
    descricao: "Decodificador BR Code (CRC16) e auditoria matemática de Boletos FEBRABAN (Mod 10/11 & fator 2025).",
    icone: "qr-code",
    imagem_url: null,
    cor_icone: "#34D399",
    badge_texto: "Zero API Cost",
    badge_cor: "badge-purple",
    rota: "/basic/financeiro",
    categoria: "forense",
    ordem: 31,
    ativo: true,
    em_breve: false,
    manutencao: false,
    roles_permitidas: ["user", "admin"],
    config: {},
    criado_em: "2026-11-11T00:00:00.000Z",
    atualizado_em: "2026-11-11T00:00:00.000Z",
  },
  {
    id: "8d2b4e10-7c92-4a8e-8f11-4b23c9d50102",
    slug: "servidores_federais",
    nome: "Servidores Públicos Federais",
    descricao: "Consulta Executivo Federal (SIAPE): vínculos, cargos, universidades/IFs e remuneração mensal (CGU).",
    icone: "landmark",
    imagem_url: null,
    cor_icone: "#38BDF8",
    badge_texto: "CGU SIAPE",
    badge_cor: "badge-purple",
    rota: "/basic/servidores",
    categoria: "osint",
    ordem: 27,
    ativo: true,
    em_breve: false,
    manutencao: false,
    roles_permitidas: ["user", "admin"],
    config: {},
    criado_em: "2026-11-11T00:00:00.000Z",
    atualizado_em: "2026-11-11T00:00:00.000Z",
  },
  {
    id: "4f7a9c31-6e15-4d2b-9a03-7e12d4b80203",
    slug: "beneficios_auxilios",
    nome: "Benefícios & Auxílios Sociais",
    descricao: "Novo Bolsa Família, BPC/LOAS, Auxílio Emergencial, Seguro-Defeso, Garantia-Safra e PETI por CPF ou NIS.",
    icone: "hand-coins",
    imagem_url: null,
    cor_icone: "#10B981",
    badge_texto: "CGU Social",
    badge_cor: "badge-purple",
    rota: "/basic/auxilios",
    categoria: "osint",
    ordem: 28,
    ativo: true,
    em_breve: false,
    manutencao: false,
    roles_permitidas: ["user", "admin"],
    config: {},
    criado_em: "2026-11-11T00:00:00.000Z",
    atualizado_em: "2026-11-11T00:00:00.000Z",
  },
  {
    id: "7c1e5a20-8f3b-4c91-9e22-5d34e6f70304",
    slug: "bitcoin",
    nome: "Investigação Bitcoin (BTC)",
    descricao: "Rastreamento on-chain (saldo, transações), cruzamento na Surface Web (Google/SERP) e varredura na Dark Web (.onion via Ahmia).",
    icone: "bitcoin",
    imagem_url: null,
    cor_icone: "#F59E0B",
    badge_texto: "On-Chain + Dark Web",
    badge_cor: "badge-warning",
    rota: "/basic/bitcoin",
    categoria: "forense",
    ordem: 29,
    ativo: true,
    em_breve: false,
    manutencao: false,
    roles_permitidas: ["user", "admin"],
    config: {},
    criado_em: "2026-11-14T00:00:00.000Z",
    atualizado_em: "2026-11-14T00:00:00.000Z",
  },
];

function assegurarModulosNativosNaLista(lista = []) {
  const resultado = Array.isArray(lista) ? [...lista] : [];
  for (const moduloNativo of MODULOS_NATIVOS_BUILTIN) {
    if (!resultado.some((m) => m.slug === moduloNativo.slug || m.id === moduloNativo.id)) {
      resultado.push({ ...moduloNativo });
    }
  }
  return resultado;
}

export const getModulesService = async ({ onlyActive = false } = {}) => {
  // 1. Tenta buscar no Supabase se houver credenciais
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      let query = supabaseAdmin
        .from("modules")
        .select("*")
        .order("ordem", { ascending: true });

      const { data, error } = await comTimeout(query, 3000);

      if (!error && Array.isArray(data) && data.length > 0) {
        const enriquecido = assegurarModulosNativosNaLista(data);
        // Atualiza cache local
        salvarModulosLocal(enriquecido);
        const filtrado = onlyActive ? enriquecido.filter((m) => m.ativo) : enriquecido;
        return filtrado.sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0));
      }
    } catch (err) {
      console.warn("[MODULES SERVICE] Supabase indisponível, usando fallback local:", err.message);
    }
  }

  // 2. Fallback resiliente no armazenamento local
  const locais = carregarModulosLocal();
  let resultado = assegurarModulosNativosNaLista(locais);

  if (onlyActive) {
    resultado = resultado.filter((m) => m.ativo);
  }

  return resultado.sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0));
};

/**
 * Busca um módulo específico pelo ID ou Slug (com suporte a normalização e aliases)
 */
export const getModuleByIdService = async (idOuSlug) => {
  if (!idOuSlug) return null;
  const raw = String(idOuSlug).trim();
  const lower = raw.toLowerCase();

  // Mapeamento de compatibilidade de aliases
  const aliasMap = {
    foto: "fotos",
    telefone_puxar: "telefone",
    cnpj_puxar: "cnpj",
    email_puxar: "email",
    celular: "telefone",
  };
  const slugBuscado = aliasMap[lower] || lower;

  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);
      const query = supabaseAdmin.from("modules").select("*");
      
      if (isUuid) {
        query.eq("id", raw);
      } else {
        query.eq("slug", slugBuscado);
      }

      const { data, error } = await comTimeout(query.maybeSingle(), 3000);
      if (!error && data) return data;
    } catch (_) {}
  }

  const locais = carregarModulosLocal();
  return (
    locais.find((m) => {
      const mSlug = String(m.slug || "").toLowerCase();
      const mId = String(m.id || "").toLowerCase();
      const mTipo = String(m.config?.tipo || "").toLowerCase();
      return (
        mId === lower ||
        mSlug === lower ||
        mSlug === slugBuscado ||
        mTipo === lower ||
        mTipo === slugBuscado
      );
    }) || null
  );
};

/**
 * Cria um novo módulo no banco de dados
 */
export const createModuleService = async (dadosModulo) => {
  const idGerado = dadosModulo.id || crypto.randomUUID();
  const agora = new Date().toISOString();

  const novoModulo = {
    id: idGerado,
    slug: String(dadosModulo.slug).trim().toLowerCase(),
    nome: String(dadosModulo.nome).trim(),
    descricao: dadosModulo.descricao ? String(dadosModulo.descricao).trim() : "",
    icone: dadosModulo.icone ? String(dadosModulo.icone).trim() : "box",
    cor_icone: dadosModulo.cor_icone || "#A78BFA",
    badge_texto: dadosModulo.badge_texto ? String(dadosModulo.badge_texto).trim() : "",
    badge_cor: dadosModulo.badge_cor || "badge-purple",
    rota: String(dadosModulo.rota).trim(),
    categoria: dadosModulo.categoria || "osint",
    ordem: Number(dadosModulo.ordem) || 99,
    ativo: dadosModulo.ativo !== undefined ? Boolean(dadosModulo.ativo) : true,
    em_breve: Boolean(dadosModulo.em_breve),
    manutencao: Boolean(dadosModulo.manutencao),
    criado_em: agora,
    atualizado_em: agora,
  };

  // 1. Tenta inserir no Supabase
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { data, error } = await comTimeout(
        supabaseAdmin
          .from("modules")
          .insert([novoModulo])
          .select()
          .single(),
        1500
      );

      if (!error && data) {
        const locais = carregarModulosLocal().filter((m) => m.slug !== novoModulo.slug);
        locais.push(data);
        salvarModulosLocal(locais);
        return data;
      } else if (error) {
        console.warn("[MODULES SERVICE] Erro ao inserir no Supabase:", error.message);
      }
    } catch (err) {
      console.warn("[MODULES SERVICE] Falha de conexão ao inserir no Supabase:", err.message);
    }
  }

  // 2. Persiste localmente
  const locais = carregarModulosLocal();
  if (locais.some((m) => m.slug === novoModulo.slug)) {
    throw new Error(`Já existe um módulo cadastrado com o slug '${novoModulo.slug}'.`);
  }

  locais.push(novoModulo);
  salvarModulosLocal(locais);
  return novoModulo;
};

/**
 * Atualiza um módulo existente
 */
export const updateModuleService = async (id, dadosAtualizacao) => {
  const agora = new Date().toISOString();

  const camposAtualizados = {
    ...dadosAtualizacao,
    atualizado_em: agora,
  };

  // Se ordem ou booleans forem passados, sanitiza
  if (camposAtualizados.ordem !== undefined) {
    camposAtualizados.ordem = Number(camposAtualizados.ordem) || 0;
  }
  if (camposAtualizados.ativo !== undefined) {
    camposAtualizados.ativo = Boolean(camposAtualizados.ativo);
  }
  if (camposAtualizados.em_breve !== undefined) {
    camposAtualizados.em_breve = Boolean(camposAtualizados.em_breve);
  }
  if (camposAtualizados.manutencao !== undefined) {
    camposAtualizados.manutencao = Boolean(camposAtualizados.manutencao);
  }

  // 1. Atualiza no Supabase
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { data, error } = await comTimeout(
        supabaseAdmin
          .from("modules")
          .update(camposAtualizados)
          .eq("id", id)
          .select()
          .maybeSingle(),
        1500
      );

      if (!error && data) {
        const locais = carregarModulosLocal().map((m) => (m.id === id ? { ...m, ...data } : m));
        salvarModulosLocal(locais);
        return data;
      }
    } catch (err) {
      console.warn("[MODULES SERVICE] Falha ao atualizar módulo no Supabase:", err.message);
    }
  }

  // 2. Atualiza localmente
  const locais = carregarModulosLocal();
  const index = locais.findIndex((m) => m.id === id || m.slug === id);

  if (index === -1) {
    throw new Error(`Módulo com ID '${id}' não encontrado.`);
  }

  locais[index] = {
    ...locais[index],
    ...camposAtualizados,
  };

  salvarModulosLocal(locais);
  return locais[index];
};

/**
 * Alterna rapidamente status ativo, manutenção ou em_breve de um módulo
 */
export const toggleModuleStatusService = async (id, flags) => {
  return updateModuleService(id, flags);
};

/**
 * Exclui um módulo do banco de dados
 */
export const deleteModuleService = async (id) => {
  // 1. Exclui no Supabase
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { error } = await comTimeout(
        supabaseAdmin
          .from("modules")
          .delete()
          .eq("id", id),
        1500
      );

      if (error) {
        console.warn("[MODULES SERVICE] Aviso ao excluir no Supabase:", error.message);
      }
    } catch (err) {
      console.warn("[MODULES SERVICE] Falha de conexão ao excluir no Supabase:", err.message);
    }
  }

  // 2. Exclui localmente
  const locais = carregarModulosLocal();
  const novoArray = locais.filter((m) => m.id !== id && m.slug !== id);

  if (novoArray.length === locais.length) {
    throw new Error(`Módulo com ID '${id}' não localizado para exclusão.`);
  }

  salvarModulosLocal(novoArray);
  return { success: true, id };
};
