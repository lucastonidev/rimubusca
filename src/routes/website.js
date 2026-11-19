import express from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { supabaseAdmin } from "../config/supabase.js";
import { obterStatusCarteira, hubApiService } from "../services/osint/hubapi.service.js";
import { obterEstatisticasPuxarDados } from "../services/core/dashboard.service.js";
import { getModulesService } from "../services/core/modules.service.js";
import { obterClassificacoesYesItsMe } from "../utils/classificacoes.utils.js";
import { RIMU_CATEGORIAS, RIMU_MODULOS } from "../data/rimuModulos.js";

const website = express.Router();

/**
 * ==============================================================================
 * ROTAS DE PÁGINAS WEB (SSR COM EJS)
 * Responsabilidade única: Apenas renderizar as telas da plataforma
 * ==============================================================================
 */

// 1. Dashboard Principal (Estatísticas dedicadas de Puxar Dados & Consultas Cadastrais)
const renderDashboard = async (req, res) => {
  let estatisticas = {
    totalHoje: 0,
    totalHistorico: 0,
    totalModulos: 15,
    limiteDiario: 100,
    disponiveisHoje: 100,
    disponiveisFormatado: "100 / 100",
    saldoCarteira: 30.0,
    saldoFormatado: "R$ 30,00",
    orcamentoMensal: 30.0,
    tetoFormatado: "Teto: R$ 30,00/mês",
  };

  try {
    if (req.user?.id) {
      estatisticas = await obterEstatisticasPuxarDados(req.user.id);
    }
  } catch (err) {
    console.warn("[WEBSITE DASHBOARD STATS WARN]:", err.message);
  }

  res.render("dashboard", {
    title: "Dashboard - RimuBusca",
    pageTitle: "Dashboard",
    user: req.user,
    profile: req.profile,
    estatisticas,
  });
};

website.get("/", requireAuth, renderDashboard);
website.get("/dashboard", requireAuth, renderDashboard);

// 2. Histórico de Consultas
website.get("/history", requireAuth, async (req, res) => {
  let historicoBuscas = [];
  try {
    if (req.user?.id && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { data, error } = await supabaseAdmin
        .from("buscas")
        .select("id, modulo, input, resultado_json, criado_em")
        .eq("user_id", req.user.id)
        .order("criado_em", { ascending: false })
        .limit(100);

      if (!error && Array.isArray(data)) {
        historicoBuscas = data;
      }
    }
  } catch (err) {
    console.warn("[HISTORICO QUERY WARN]:", err.message);
  }

  res.render("history", {
    title: "Histórico de Investigações - RimuBusca",
    pageTitle: "Histórico",
    user: req.user,
    profile: req.profile,
    historicoBuscas,
  });
});

// 3. Configurações de Perfil
const renderSettings = (req, res) => {
  res.render("settings", {
    title: "Configurações do Perfil - RimuBusca",
    pageTitle: "Configurações",
    user: req.user,
    profile: req.profile,
  });
};
website.get("/settings", requireAuth, renderSettings);
website.get("/configuracoes", requireAuth, renderSettings);

// 4. Guia & Ajuda Operacional
const renderHelp = (req, res) => {
  res.render("help", {
    title: "Guia Operacional & Documentação - RimuBusca",
    pageTitle: "Guia Operacional",
    user: req.user,
    profile: req.profile,
  });
};
website.get("/help", requireAuth, renderHelp);
website.get("/ajuda", requireAuth, renderHelp);

/**
 * ==============================================================================
 * MÓDULOS BÁSICOS (OSINT & INVESTIGAÇÃO) - PADRONIZADOS EM PORTUGUÊS
 * ==============================================================================
 */

// 1. Telefone & Telecom
const renderTelefone = (req, res) => {
  res.render("modules/basic/telefone", {
    title: "Consulta de Telefone & Operadora - RimuBusca",
    pageTitle: "Consulta de Telefone",
    user: req.user,
    profile: req.profile,
  });
};
website.get("/basic/telefone", requireAuth, renderTelefone);
website.get("/basic/smartphone", requireAuth, renderTelefone);
website.get("/telefone", requireAuth, (req, res) => res.redirect("/basic/telefone"));

// 2. Domínio & DNS
const renderDominio = (req, res) => {
  res.render("modules/basic/dominio", {
    title: "Investigação de Domínio & DNS - RimuBusca",
    pageTitle: "Domínio & DNS",
    user: req.user,
    profile: req.profile,
  });
};
website.get("/basic/dominio", requireAuth, renderDominio);
website.get("/basic/domain", requireAuth, renderDominio);
website.get("/dominio", requireAuth, (req, res) => res.redirect("/basic/dominio"));

// 3. Redes Sociais / Instagram
const renderRedes = (req, res) => {
  res.render("modules/basic/instagram", {
    title: "Redes Sociais & Contas Online - RimuBusca",
    pageTitle: "Redes Sociais & Contas Online",
    user: req.user,
    profile: req.profile,
    profissoes: obterClassificacoesYesItsMe(),
  });
};
website.get("/basic/instagram", requireAuth, renderRedes);
website.get("/basic/redes", requireAuth, renderRedes);
website.get("/redes", requireAuth, (req, res) => res.redirect("/basic/instagram"));

// 4. E-mail OSINT
const renderEmail = (req, res) => {
  res.render("modules/basic/email", {
    title: "Investigação de E-mail - RimuBusca",
    pageTitle: "E-mail",
    user: req.user,
    profile: req.profile,
  });
};
website.get("/basic/email", requireAuth, renderEmail);
website.get("/email", requireAuth, (req, res) => res.redirect("/basic/email"));

// 5. Metadados de Arquivos
const renderMetadados = (req, res) => {
  res.render("modules/basic/metadados", {
    title: "Extração de Metadados - RimuBusca",
    pageTitle: "Metadados de Arquivos",
    user: req.user,
    profile: req.profile,
  });
};
website.get("/basic/metadados", requireAuth, renderMetadados);
website.get("/basic/metadata", requireAuth, renderMetadados);
website.get("/metadados", requireAuth, (req, res) => res.redirect("/basic/metadados"));

// 6. Processos Judiciais & CNJ DataJud
const renderProcessos = (req, res) => {
  res.render("modules/basic/processos", {
    title: "Processos Judiciais & Monitoramento - RimuBusca",
    pageTitle: "Processos Judiciais",
    user: req.user,
    profile: req.profile,
  });
};
website.get("/basic/processos", requireAuth, renderProcessos);
website.get("/basic/processes", requireAuth, renderProcessos);
website.get("/processos", requireAuth, (req, res) => res.redirect("/basic/processos"));

// 7. Forense Financeira BR (PIX BR Code & Boleto FEBRABAN)
const renderFinanceiro = (req, res) => {
  res.render("modules/basic/financeiro", {
    title: "Decodificador PIX & Boleto FEBRABAN - RimuBusca",
    pageTitle: "PIX & Boleto Forense",
    user: req.user,
    profile: req.profile,
    currentPath: "/basic/financeiro",
  });
};
website.get("/basic/financeiro", requireAuth, renderFinanceiro);
website.get("/basic/pix-boleto", requireAuth, renderFinanceiro);
website.get("/pix-boleto", requireAuth, (req, res) => res.redirect("/basic/financeiro"));
website.get("/financeiro", requireAuth, (req, res) => res.redirect("/basic/financeiro"));

// 8. Servidores Públicos Federais (Executivo Federal / SIAPE)
const renderServidoresFederais = (req, res) => {
  res.render("modules/basic/servidores", {
    title: "Servidores Públicos Federais (SIAPE) - RimuBusca",
    pageTitle: "Servidores Federais",
    user: req.user,
    profile: req.profile,
    currentPath: "/basic/servidores",
  });
};
website.get("/basic/servidores", requireAuth, renderServidoresFederais);
website.get("/basic/federal", requireAuth, renderServidoresFederais);
website.get("/servidores", requireAuth, (req, res) => res.redirect("/basic/servidores"));

// 9. Benefícios & Auxílios Sociais Federais (CGU)
const renderBeneficiosSociais = (req, res) => {
  res.render("modules/basic/auxilios", {
    title: "Benefícios & Auxílios Sociais (CGU) - RimuBusca",
    pageTitle: "Benefícios & Auxílios",
    user: req.user,
    profile: req.profile,
    currentPath: "/basic/auxilios",
  });
};
website.get("/basic/auxilios", requireAuth, renderBeneficiosSociais);
website.get("/basic/beneficios", requireAuth, renderBeneficiosSociais);
website.get("/auxilios", requireAuth, (req, res) => res.redirect("/basic/auxilios"));
website.get("/beneficios", requireAuth, (req, res) => res.redirect("/basic/auxilios"));

// 10. Investigação Forense de Bitcoin (BTC On-Chain + Surface Web + Dark Web)
const renderBitcoin = (req, res) => {
  res.render("modules/basic/bitcoin", {
    title: "Investigação Bitcoin (BTC) - RimuBusca",
    pageTitle: "Investigação Bitcoin",
    user: req.user,
    profile: req.profile,
    currentPath: "/basic/bitcoin",
  });
};
website.get("/basic/bitcoin", requireAuth, renderBitcoin);
website.get("/basic/btc", requireAuth, renderBitcoin);
website.get("/bitcoin", requireAuth, (req, res) => res.redirect("/basic/bitcoin"));
website.get("/btc", requireAuth, (req, res) => res.redirect("/basic/bitcoin"));

/**
 * ==============================================================================
 * MÓDULOS AVANÇADOS (CONSULTAS CADASTRAIS & PUXADAS)
 * ==============================================================================
 */

website.get("/advanced/person", requireAuth, async (req, res) => {
  const tipoAtivo = (req.query.type || req.query.tipo || "cpf").toLowerCase();

  let modulosDb = [];
  try {
    modulosDb = await getModulesService({ onlyActive: false });
  } catch (_) {}

  const mapaDb = new Map(modulosDb.map((m) => [m.slug, m]));
  const modulosEnriquecidos = RIMU_MODULOS.map((m) => {
    const dbItem = mapaDb.get(m.tipo);
    return {
      ...m,
      id: dbItem?.id || null,
      ativo: dbItem ? dbItem.ativo : true,
      manutencao: dbItem ? dbItem.manutencao : false,
      em_breve: dbItem ? dbItem.em_breve : false,
    };
  });

  res.render("modules/avanced/consulta", {
    title: "Central de Consultas Cadastrais - RimuBusca",
    pageTitle: "Puxar Dados",
    tipoAtivo,
    type: tipoAtivo,
    user: req.user,
    profile: req.profile,
    categorias: RIMU_CATEGORIAS,
    modulos: modulosEnriquecidos,
  });
});

website.get("/consulta", (req, res) => {
  const query = req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : "";
  res.redirect(`/advanced/person${query}`);
});

/**
 * ==============================================================================
 * CATÁLOGO DE APIS PAY-PER-USE (ASPECT API / HUB DE CONSULTAS)
 * ==============================================================================
 */
const renderHubApi = async (req, res) => {
  const statusCarteira = await obterStatusCarteira();
  res.render("modules/hubapi/catalogo", {
    title: "Catálogo de APIs Pay-per-Use - RimuBusca",
    pageTitle: "Catálogo Hub APIs",
    user: req.user,
    profile: req.profile,
    currentPath: "/hub-api",
    carteira: statusCarteira,
  });
};
website.get("/hub-api", requireAuth, renderHubApi);
website.get("/hubapi", requireAuth, (req, res) => res.redirect("/hub-api"));
website.get("/aspect-api", requireAuth, (req, res) => res.redirect("/hub-api"));
website.get("/pay-per-use", requireAuth, (req, res) => res.redirect("/hub-api"));

/**
 * ==============================================================================
 * CENTRAL ZEROY API (VEÍCULOS, FROTAS & CONSULTAS DIRETAS)
 * ==============================================================================
 */
const renderZeroyPage = async (req, res) => {
  const moduloId = (req.query.id || req.query.modulo || req.query.tipo || req.query.type || "cpf-zeroy").toLowerCase().trim();
  const carteira = await hubApiService.getWalletStatus();
  const modulos = carteira.modulos || hubApiService.modules;
  const moduloAtivo =
    hubApiService.getModuleById(moduloId) ||
    modulos.find((m) => m.id === moduloId || m.id.toLowerCase() === moduloId || (m.path && m.path.endsWith(`/${moduloId}`))) ||
    modulos[0] ||
    null;

  res.render("modules/avanced/zeroy", {
    title: `Zeroy API - ${moduloAtivo ? moduloAtivo.nome : "Consultas"} - RimuBusca`,
    pageTitle: "Zeroy API",
    moduloId: moduloAtivo ? moduloAtivo.id : moduloId,
    tipoAtivo: moduloAtivo ? moduloAtivo.id : moduloId,
    type: moduloAtivo ? moduloAtivo.id : moduloId,
    moduloAtivo,
    modulosHub: modulos,
    carteira,
    user: req.user,
    profile: req.profile,
    currentPath: "/zeroy",
  });
};

website.get("/zeroy", requireAuth, renderZeroyPage);
website.get("/zeroy-api", requireAuth, renderZeroyPage);
website.get("/veiculos", requireAuth, renderZeroyPage);
website.get("/veicular", requireAuth, renderZeroyPage);
website.get("/consulta-zeroy", requireAuth, renderZeroyPage);
website.get("/advanced/zeroy", requireAuth, renderZeroyPage);
website.get("/advanced/veiculos", requireAuth, renderZeroyPage);

/**
 * ==============================================================================
 * PÁGINAS INSTITUCIONAIS & LEGAIS (ACESSO PÚBLICO & AUTENTICADO)
 * ==============================================================================
 */
website.get("/termos", (req, res) => {
  res.render("termos", {
    title: "Termos de Uso e Diretrizes Éticas - RimuBusca",
    user: req.user || null,
    profile: req.profile || null,
    currentPath: "/termos",
  });
});

website.get("/privacidade", (req, res) => {
  res.render("privacidade", {
    title: "Política de Privacidade e LGPD - RimuBusca",
    user: req.user || null,
    profile: req.profile || null,
    currentPath: "/privacidade",
  });
});

export default website;
