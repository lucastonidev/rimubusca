import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { supabaseAdmin } from "../../config/supabase.js";
import { parseSupabaseError } from "../../utils/supabaseErrorParser.js";

/**
 * ==============================================================================
 * RIMUBUSCA - SERVIÇO DE GERENCIAMENTO DE MÓDULOS (MODULES.SERVICE.JS)
 * Gerencia o catálogo de módulos do banco de dados (tabela 'modules') com
 * persistência local em cache (data/modules.json) para alta disponibilidade.
 * ==============================================================================
 */

const DATA_DIR = path.resolve(process.cwd(), "data");
const MODULES_FILE = path.join(DATA_DIR, "modules.json");

// Catálogo base de módulos para seed e fallback
export const MODULOS_PADRAO = [
  // 1. CONSULTAS CADASTRAIS (PUXAR DADOS)
  {
    id: "mod-cpf",
    slug: "cpf",
    nome: "Puxar por CPF",
    descricao: "Situação na Receita, nascimento, filiação e dados completos.",
    icone: "credit-card",
    cor_icone: "#EF4444",
    badge_texto: "Cadastral",
    badge_cor: "badge-red",
    rota: "/advanced/person?tipo=cpf",
    categoria: "consultas",
    ordem: 1,
    ativo: true,
    em_breve: false,
    manutencao: false,
  },
  {
    id: "mod-nome",
    slug: "nome",
    nome: "Puxar por Nome",
    descricao: "Localização de homônimos, faixa etária e mães.",
    icone: "user",
    cor_icone: "#A78BFA",
    badge_texto: "Nominal",
    badge_cor: "badge-purple",
    rota: "/advanced/person?tipo=nome",
    categoria: "consultas",
    ordem: 2,
    ativo: true,
    em_breve: false,
    manutencao: false,
  },
  {
    id: "mod-rg",
    slug: "rg",
    nome: "Puxar por RG",
    descricao: "Registro Geral, órgão emissor e UF de expedição.",
    icone: "id-card",
    cor_icone: "#A78BFA",
    badge_texto: "Identidade",
    badge_cor: "badge-purple",
    rota: "/advanced/person?tipo=rg",
    categoria: "consultas",
    ordem: 3,
    ativo: true,
    em_breve: false,
    manutencao: false,
  },
  {
    id: "mod-telefone_puxar",
    slug: "telefone_puxar",
    nome: "Puxar por Telefone",
    descricao: "Puxar nome do titular, CPF vinculado, endereço e cadastro da linha.",
    icone: "phone-forwarded",
    cor_icone: "#EF4444",
    badge_texto: "Titularidade",
    badge_cor: "badge-red",
    rota: "/advanced/person?tipo=telefone",
    categoria: "consultas",
    ordem: 4,
    ativo: true,
    em_breve: false,
    manutencao: false,
  },
  {
    id: "mod-titulo",
    slug: "titulo",
    nome: "Título Eleitoral",
    descricao: "Zona eleitoral, seção, município e biometria.",
    icone: "vote",
    cor_icone: "#94A3B8",
    badge_texto: "Eleitoral",
    badge_cor: "badge-dark",
    rota: "/advanced/person?tipo=titulo",
    categoria: "consultas",
    ordem: 5,
    ativo: true,
    em_breve: false,
    manutencao: false,
  },
  {
    id: "mod-nis",
    slug: "nis",
    nome: "Puxar por NIS",
    descricao: "Identificação Social (CadÚnico / Benefícios).",
    icone: "badge-percent",
    cor_icone: "#94A3B8",
    badge_texto: "Social",
    badge_cor: "badge-dark",
    rota: "/advanced/person?tipo=nis",
    categoria: "consultas",
    ordem: 6,
    ativo: true,
    em_breve: false,
    manutencao: false,
  },
  {
    id: "mod-pis",
    slug: "pis",
    nome: "PIS / PASEP",
    descricao: "PIS ativo, NIS vinculado e histórico funcional.",
    icone: "briefcase",
    cor_icone: "#94A3B8",
    badge_texto: "Trabalho",
    badge_cor: "badge-dark",
    rota: "/advanced/person?tipo=pis",
    categoria: "consultas",
    ordem: 7,
    ativo: true,
    em_breve: false,
    manutencao: false,
  },
  {
    id: "mod-placa",
    slug: "placa",
    nome: "Placa de Veículo",
    descricao: "Marca/modelo, ano, Renavam, multas e proprietário.",
    icone: "car",
    cor_icone: "#A78BFA",
    badge_texto: "Veículos",
    badge_cor: "badge-purple",
    rota: "/advanced/person?tipo=placa",
    categoria: "consultas",
    ordem: 8,
    ativo: true,
    em_breve: false,
    manutencao: false,
  },
  {
    id: "mod-cnpj_puxar",
    slug: "cnpj_puxar",
    nome: "Puxar por CNPJ",
    descricao: "Razão social, QSA (sócios), capital e filiais.",
    icone: "building",
    cor_icone: "#EF4444",
    badge_texto: "Receita Federal",
    badge_cor: "badge-red",
    rota: "/advanced/person?tipo=cnpj",
    categoria: "consultas",
    ordem: 9,
    ativo: true,
    em_breve: false,
    manutencao: false,
  },
  {
    id: "mod-cep",
    slug: "cep",
    nome: "CEP & Endereços",
    descricao: "Busca de moradores e empresas por logradouro.",
    icone: "map-pin",
    cor_icone: "#94A3B8",
    badge_texto: "Localização",
    badge_cor: "badge-dark",
    rota: "/advanced/person?tipo=cep",
    categoria: "consultas",
    ordem: 10,
    ativo: true,
    em_breve: false,
    manutencao: false,
  },
  {
    id: "mod-email_puxar",
    slug: "email_puxar",
    nome: "E-mail Pessoal",
    descricao: "Contas vinculadas ao titular e cadastros.",
    icone: "mail",
    cor_icone: "#A78BFA",
    badge_texto: "Contas",
    badge_cor: "badge-purple",
    rota: "/advanced/person?tipo=email",
    categoria: "consultas",
    ordem: 11,
    ativo: true,
    em_breve: false,
    manutencao: false,
  },
  {
    id: "mod-foto",
    slug: "foto",
    nome: "Foto & Biometria",
    descricao: "Registro facial de documentos e CNH.",
    icone: "camera",
    cor_icone: "#EF4444",
    badge_texto: "Biometria",
    badge_cor: "badge-red",
    rota: "/advanced/person?tipo=foto",
    categoria: "consultas",
    ordem: 12,
    ativo: true,
    em_breve: false,
    manutencao: false,
  },

  // 2. INTELIGÊNCIA OSINT
  {
    id: "mod-processos",
    slug: "processos",
    nome: "Processos Judiciais",
    descricao: "Rastreamento unificado no DataJud (CNJ - 91 Tribunais), validação Módulo 97 e diários.",
    icone: "scale",
    cor_icone: "#F59E0B",
    badge_texto: "DataJud CNJ & Scraper",
    badge_cor: "badge-purple",
    rota: "/basic/processes",
    categoria: "osint",
    ordem: 20,
    ativo: true,
    em_breve: false,
    manutencao: false,
  },
  {
    id: "mod-redes",
    slug: "redes",
    nome: "Redes Sociais & Contas Online",
    descricao: "Descubra contas em mais de 80 plataformas por @Username ou localize perfis cruzando Nome, E-mail e Telefone.",
    icone: "users",
    cor_icone: "#EC4899",
    badge_texto: "80+ Redes & Instagram",
    badge_cor: "badge-purple",
    rota: "/basic/instagram",
    categoria: "osint",
    ordem: 21,
    ativo: true,
    em_breve: false,
    manutencao: false,
  },
  {
    id: "mod-telefone",
    slug: "telefone",
    nome: "Telefone OSINT (Telecom)",
    descricao: "Identificação de operadora original, DDD/região Anatel, tipo de linha e dorks.",
    icone: "phone-call",
    cor_icone: "#A78BFA",
    badge_texto: "Dados Básicos & Telecom",
    badge_cor: "badge-purple",
    rota: "/basic/smartphone",
    categoria: "osint",
    ordem: 22,
    ativo: true,
    em_breve: false,
    manutencao: false,
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
    ordem: 23,
    ativo: true,
    em_breve: false,
    manutencao: false,
  },
  {
    id: "mod-email",
    slug: "email",
    nome: "E-mail OSINT (Holehe & GHunt)",
    descricao: "Inteligência de e-mail com Mosint (DNS/MX), Holehe (contas sociais) e GHunt (Google).",
    icone: "mail-search",
    cor_icone: "#38BDF8",
    badge_texto: "Holehe & GHunt",
    badge_cor: "badge-purple",
    rota: "/basic/email",
    categoria: "osint",
    ordem: 24,
    ativo: true,
    em_breve: false,
    manutencao: false,
  },
  {
    id: "mod-cnpj",
    slug: "cnpj",
    nome: "Empresa / CNPJ",
    descricao: "Quadro de sócios e administradores (QSA), capital social, filiais e situação cadastral.",
    icone: "building-2",
    cor_icone: "#F59E0B",
    badge_texto: "Corporativo",
    badge_cor: "badge-dark",
    rota: "/advanced/person?tipo=cnpj",
    categoria: "osint",
    ordem: 25,
    ativo: true,
    em_breve: false,
    manutencao: false,
  },
  {
    id: "mod-hubapi",
    slug: "hubapi",
    nome: "Catálogo de APIs Pay-per-Use",
    descricao: "46 módulos integrados da Aspect API com gestão orçamentária pré-paga e saldo dinâmico.",
    icone: "coins",
    cor_icone: "#F59E0B",
    badge_texto: "Aspect Hub",
    badge_cor: "badge-warning",
    rota: "/hub-api",
    categoria: "osint",
    ordem: 26,
    ativo: true,
    em_breve: false,
    manutencao: false,
  },

  // 3. FORENSE
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
    ordem: 30,
    ativo: true,
    em_breve: false,
    manutencao: false,
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

function comTimeout(prom, ms = 1200) {
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

      const { data, error } = await comTimeout(query, 1200);

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
 * Busca um módulo específico pelo ID ou Slug
 */
export const getModuleByIdService = async (idOuSlug) => {
  if (!idOuSlug) return null;

  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOuSlug);
      const query = supabaseAdmin.from("modules").select("*");
      
      if (isUuid) {
        query.eq("id", idOuSlug);
      } else {
        query.eq("slug", idOuSlug);
      }

      const { data, error } = await comTimeout(query.maybeSingle(), 1200);
      if (!error && data) return data;
    } catch (_) {}
  }

  const locais = carregarModulosLocal();
  return locais.find((m) => m.id === idOuSlug || m.slug === idOuSlug) || null;
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
