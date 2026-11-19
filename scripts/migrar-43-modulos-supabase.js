/**
 * ==============================================================================
 * RIMUBUSCA - SCRIPT DE MIGRAÇÃO DOS 43 MÓDULOS RIMUAPI PARA O SUPABASE
 * scripts/migrar-43-modulos-supabase.js
 *
 * Migra e sincroniza todos os 43 módulos da RimuAPI na tabela 'modules' do Supabase.
 * Permite ao administrador interditar, colocar em manutenção ou ativar módulos
 * diretamente através do painel de administração (/admin/modulos).
 * ==============================================================================
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { supabaseAdmin } from "../src/config/supabase.js";
import { RIMU_MODULOS } from "../src/data/rimuModulos.js";

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

// Módulos OSINT e Forense nativos para manter na tabela
const MODULOS_SISTEMA_COMPLEMENTARES = [
  {
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
  },
  {
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
  },
  {
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
  },
  {
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
  },
  {
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
  },
  {
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
  },
  {
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
  },
  {
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
  },
  {
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
  },
  {
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
  },
];

async function migrarModulos() {
  console.log("==================================================");
  console.log("INICIANDO MIGRAÇÃO DOS 43 MÓDULOS RIMUAPI NO SUPABASE");
  console.log("==================================================");

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Credenciais do Supabase não configuradas no arquivo .env");
  }

  // 1. Busca os módulos já existentes no Supabase
  const { data: modulosExistentes, error: errBusca } = await supabaseAdmin
    .from("modules")
    .select("*");

  if (errBusca) {
    throw new Error(`Falha ao ler módulos existentes do Supabase: ${errBusca.message}`);
  }

  console.log(`Módulos atualmente no Supabase: ${modulosExistentes.length}`);
  const mapaExistentesPorSlug = new Map();
  for (const mod of modulosExistentes) {
    mapaExistentesPorSlug.set(mod.slug, mod);
  }

  // 2. Remove slugs obsoletos duplicados (telefone_puxar, cnpj_puxar, email_puxar, foto)
  const slugsObsoletos = ["telefone_puxar", "cnpj_puxar", "email_puxar", "foto"];
  for (const slugObs of slugsObsoletos) {
    if (mapaExistentesPorSlug.has(slugObs)) {
      console.log(`Removendo slug legado/duplicado '${slugObs}'...`);
      await supabaseAdmin.from("modules").delete().eq("slug", slugObs);
    }
  }

  // Se o slug antigo 'telefone' apontava para /basic/smartphone, renomear/atualizar para 'telefone_osint'
  const telefoneExistente = mapaExistentesPorSlug.get("telefone");
  if (telefoneExistente && telefoneExistente.rota?.includes("/basic/smartphone")) {
    console.log("Atualizando slug antigo 'telefone' (OSINT) para 'telefone_osint'...");
    await supabaseAdmin.from("modules").update({ slug: "telefone_osint" }).eq("id", telefoneExistente.id);
  }

  // Se o slug antigo 'email' apontava para /basic/email, renomear/atualizar para 'email_osint'
  const emailExistente = mapaExistentesPorSlug.get("email");
  if (emailExistente && emailExistente.rota?.includes("/basic/email")) {
    console.log("Atualizando slug antigo 'email' (OSINT) para 'email_osint'...");
    await supabaseAdmin.from("modules").update({ slug: "email_osint" }).eq("id", emailExistente.id);
  }

  // 3. Monta os 43 módulos da RimuAPI
  const agora = new Date().toISOString();
  const modulosParaUpsert = [];

  RIMU_MODULOS.forEach((mod, index) => {
    const slug = mod.tipo;
    const existente = mapaExistentesPorSlug.get(slug);

    const registro = {
      id: existente ? existente.id : crypto.randomUUID(),
      slug: slug,
      nome: mod.nome,
      descricao: mod.descricao,
      icone: mod.icone || "box",
      imagem_url: null,
      cor_icone: mod.badgeColor || "#A78BFA",
      badge_texto: mod.badge || mod.categoriaNome,
      badge_cor: mapBadgeColor(mod.badgeColor),
      rota: `/advanced/person?tipo=${mod.tipo}`,
      categoria: "consultas",
      ordem: index + 1,
      ativo: existente?.ativo !== undefined ? existente.ativo : true,
      em_breve: existente?.em_breve !== undefined ? existente.em_breve : false,
      manutencao: existente?.manutencao !== undefined ? existente.manutencao : false,
      roles_permitidas: ["user", "admin"],
      config: {
        subcategoria: mod.categoria,
        categoriaNome: mod.categoriaNome,
        tipo: mod.tipo,
        placeholder: mod.placeholder,
        mask: mod.mask,
        parametroNome: mod.parametroNome,
        badge: mod.badge,
        badgeColor: mod.badgeColor,
        demo: mod.demo,
      },
      criado_em: existente?.criado_em || agora,
      atualizado_em: agora,
    };

    modulosParaUpsert.push(registro);
  });

  // 4. Adiciona os módulos OSINT e Forense complementares
  MODULOS_SISTEMA_COMPLEMENTARES.forEach((mod) => {
    const existente = mapaExistentesPorSlug.get(mod.slug);
    const registro = {
      id: existente ? existente.id : crypto.randomUUID(),
      slug: mod.slug,
      nome: mod.nome,
      descricao: mod.descricao,
      icone: mod.icone,
      imagem_url: null,
      cor_icone: mod.cor_icone,
      badge_texto: mod.badge_texto,
      badge_cor: mod.badge_cor,
      rota: mod.rota,
      categoria: mod.categoria,
      ordem: mod.ordem,
      ativo: existente?.ativo !== undefined ? existente.ativo : true,
      em_breve: existente?.em_breve !== undefined ? existente.em_breve : false,
      manutencao: existente?.manutencao !== undefined ? existente.manutencao : false,
      roles_permitidas: ["user", "admin"],
      config: {},
      criado_em: existente?.criado_em || agora,
      atualizado_em: agora,
    };

    modulosParaUpsert.push(registro);
  });

  console.log(`Total de módulos a serem inseridos/atualizados: ${modulosParaUpsert.length}`);

  // 5. Executa Upsert no Supabase
  const { data: upsertData, error: errUpsert } = await supabaseAdmin
    .from("modules")
    .upsert(modulosParaUpsert, { onConflict: "slug" })
    .select();

  if (errUpsert) {
    throw new Error(`Erro no upsert do Supabase: ${errUpsert.message}`);
  }

  console.log(`✓ Sucesso! ${upsertData.length} módulos sincronizados no Supabase.`);

  // 6. Atualiza o arquivo de cache local (data/modules.json)
  const { data: todosModulos, error: errFinal } = await supabaseAdmin
    .from("modules")
    .select("*")
    .order("ordem", { ascending: true });

  if (!errFinal && Array.isArray(todosModulos)) {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(MODULES_FILE, JSON.stringify(todosModulos, null, 2), "utf-8");
    console.log(`✓ Cache local atualizado em: ${MODULES_FILE} (${todosModulos.length} módulos)`);
  }

  console.log("==================================================");
  console.log("MIGRAÇÃO CONCLUÍDA COM SUCESSO!");
  console.log("==================================================");
}

migrarModulos()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("ERRO FATAL NA MIGRAÇÃO:", err);
    process.exit(1);
  });
