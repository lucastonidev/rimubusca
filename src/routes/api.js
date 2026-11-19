import express from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { supabaseAdmin } from "../config/supabase.js";
import { registrarAuditoria } from "../services/core/auditoria.service.js";
import { obterClassificacoesYesItsMe } from "../utils/classificacoes.utils.js";

// Core Controllers & Services
import { getModules } from "../controllers/system/modules.controller.js";
import { getModulesService } from "../services/core/modules.service.js";
import { alterarSenhaController } from "../controllers/system/configuracoes.controller.js";
import { obterEstatisticasPuxarDados } from "../services/core/dashboard.service.js";

// OSINT Controllers
import {
  consultarProcesso,
  obterDetalhesProcessoController,
} from "../controllers/osint/processos.controller.js";
import { consultarTelefoneController } from "../controllers/osint/telefone.controller.js";
import { investigarDominioController } from "../controllers/osint/dominio.controller.js";
import { analisarFinanceiroController } from "../controllers/osint/financeiro.controller.js";
import { consultarComplianceController } from "../controllers/osint/compliance.controller.js";
import {
  consultarServidoresFederaisController,
  buscarOrgaosSiapeController,
  consultarBeneficiosSociaisController,
} from "../controllers/osint/transparencia.controller.js";
import { investigarEmailController } from "../controllers/osint/email.controller.js";
import { investigarRedesController } from "../controllers/osint/redes.controller.js";
import {
  obterStatusBrightDataController,
  iniciarColetaBrightDataController,
  consultarProgressoBrightDataController,
  proxyMidiaBrightDataController,
} from "../controllers/osint/brightdata.controller.js";
import { puxarDadosController } from "../controllers/osint/consulta.controller.js";
import { RIMU_CATEGORIAS, RIMU_MODULOS } from "../data/rimuModulos.js";
import { salvarMetadadosController } from "../controllers/osint/metadados.controller.js";
import {
  obterStatusCarteiraController,
  executarConsultaHubController,
  recarregarSaldoController,
} from "../controllers/hub/hubapi.controller.js";
import {
  consultarZeroyController,
  listarModulosZeroyController,
  obterModuloZeroyController,
} from "../controllers/hub/zeroy.controller.js";
import { investigarBitcoinController } from "../controllers/osint/bitcoin.controller.js";

const api = express.Router();

/**
 * ==============================================================================
 * 1. ROTAS CORE / SISTEMA
 * ==============================================================================
 */
api.get(["/modules", "/api/modules"], requireAuth, getModules);
api.post(["/configuracoes/senha", "/api/configuracoes/senha"], requireAuth, alterarSenhaController);
api.get(["/dashboard/stats", "/api/dashboard/stats"], requireAuth, async (req, res) => {
  try {
    const stats = await obterEstatisticasPuxarDados(req.user?.id);
    return res.json({ success: true, data: stats });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * ==============================================================================
 * 2. ROTAS OSINT (INVESTIGAÇÃO & INTELIGÊNCIA)
 * ==============================================================================
 */

// E-mail OSINT (Mosint + Holehe + GHunt)
api.post(["/email/investigar", "/api/email/investigar"], requireAuth, investigarEmailController);

// Processos Judiciais (DataJud & Diários Oficiais)
api.post(["/processos/consultar", "/api/processos/consultar"], requireAuth, consultarProcesso);
api.post(["/processos/detalhes", "/api/processos/detalhes"], requireAuth, obterDetalhesProcessoController);

// Telefone OSINT (Telecom & PhoneInfoga)
api.post(["/telefone/consultar", "/api/telefone/consultar"], requireAuth, consultarTelefoneController);

// Domínio & DNS (WHOIS / Zonas DNS / Subdomínios)
api.post(["/dominio/investigar", "/api/dominio/investigar"], requireAuth, investigarDominioController);

// Redes Sociais (Instagram YesItsMe)
api.get(["/redes/classificacoes", "/api/redes/classificacoes"], requireAuth, (req, res) => {
  try {
    const data = obterClassificacoesYesItsMe();
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
api.post(["/redes/investigar", "/api/redes/investigar"], requireAuth, investigarRedesController);

// Consultas Cadastrais (Puxar Dados - RimuAPI Engine)
api.post(["/consulta/puxar", "/api/consulta/puxar"], requireAuth, puxarDadosController);
api.get(["/rimu/modulos", "/api/rimu/modulos"], requireAuth, async (req, res) => {
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

  res.json({
    success: true,
    total: modulosEnriquecidos.length,
    categorias: RIMU_CATEGORIAS,
    modulos: modulosEnriquecidos,
  });
});

// Forense de Arquivos & Metadados
api.post(["/metadados/salvar-historico", "/api/metadados/salvar-historico"], requireAuth, salvarMetadadosController);

// Hub de APIs Pay-per-Use (Zeroy API / Carteira R$ 30/mês)
api.get(["/hubapi/status", "/api/hubapi/status"], requireAuth, obterStatusCarteiraController);
api.post(["/hubapi/consultar", "/api/hubapi/consultar"], requireAuth, executarConsultaHubController);
api.post(["/hubapi/recarregar", "/api/hubapi/recarregar"], requireAuth, recarregarSaldoController);

// Zeroy API - Central de Consultas Veiculares & Cadastrais
api.get(["/zeroy/modulos", "/api/zeroy/modulos"], requireAuth, listarModulosZeroyController);
api.get(["/zeroy/modulos/:id", "/api/zeroy/modulos/:id"], requireAuth, obterModuloZeroyController);
api.post(["/zeroy/consultar", "/api/zeroy/consultar"], requireAuth, consultarZeroyController);

/**
 * ==============================================================================
 * 3. GESTÃO DE HISTÓRICO INDIVIDUAL DO OPERADOR
 * ==============================================================================
 */
api.delete(["/historico/:id", "/api/historico/:id", "/dashboard/historico/:id", "/api/dashboard/historico/:id"], requireAuth, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const { error } = await supabaseAdmin
      .from("buscas")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;

    await registrarAuditoria({
      userId,
      acao: "excluir_historico_item",
      detalhes: { id },
      ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0",
      userAgent: req.headers["user-agent"] || "",
    });

    return res.json({ success: true, message: "Item removido do histórico com sucesso!" });
  } catch (err) {
    console.error("[ERRO EXCLUIR HISTORICO ITEM]:", err);
    return res.status(500).json({ success: false, error: "Falha ao remover item do histórico." });
  }
});

api.delete(["/historico", "/api/historico", "/dashboard/historico", "/api/dashboard/historico"], requireAuth, async (req, res) => {
  const userId = req.user.id;

  try {
    const { error } = await supabaseAdmin
      .from("buscas")
      .delete()
      .eq("user_id", userId);

    if (error) throw error;

    await registrarAuditoria({
      userId,
      acao: "limpar_todo_historico",
      detalhes: { userId },
      ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0",
      userAgent: req.headers["user-agent"] || "",
    });

    return res.json({ success: true, message: "Histórico completo limpo com sucesso!" });
  } catch (err) {
    console.error("[ERRO LIMPAR HISTORICO]:", err);
    return res.status(500).json({ success: false, error: "Falha ao limpar histórico." });
  }
});

// Forense Financeira BR (PIX BR Code & Boleto FEBRABAN)
api.post(["/financeiro/analisar", "/api/financeiro/analisar"], requireAuth, analisarFinanceiroController);

// Compliance Público BR (CGU/CEIS/CNEP/CEPIM/PEP, TSE DivulgaCandContas, PNCP & Querido Diário)
api.post(["/compliance/consultar", "/api/compliance/consultar"], requireAuth, consultarComplianceController);

// Coleta Social Profunda via Bright Data Web Scraper API v3 (Instagram & X/Twitter)
api.get(["/redes/brightdata/status", "/api/redes/brightdata/status"], requireAuth, obterStatusBrightDataController);
api.get(["/redes/brightdata/midia", "/api/redes/brightdata/midia"], requireAuth, proxyMidiaBrightDataController);
api.post(["/redes/brightdata/iniciar", "/api/redes/brightdata/iniciar"], requireAuth, iniciarColetaBrightDataController);
api.get(["/redes/brightdata/progresso/:snapshotId", "/api/redes/brightdata/progresso/:snapshotId"], requireAuth, consultarProgressoBrightDataController);

// Transparência Federal (Servidores Executivo Federal SIAPE & Benefícios/Auxílios Sociais CGU)
api.post(["/servidores/consultar", "/api/servidores/consultar"], requireAuth, consultarServidoresFederaisController);
api.get(["/servidores/orgaos-siape", "/api/servidores/orgaos-siape"], requireAuth, buscarOrgaosSiapeController);
api.post(["/auxilios/consultar", "/api/auxilios/consultar"], requireAuth, consultarBeneficiosSociaisController);

// Investigação Forense de Bitcoin (BTC On-Chain + Surface Web SERP + Ahmia Dark Web)
api.post(["/bitcoin/investigar", "/api/bitcoin/investigar"], requireAuth, investigarBitcoinController);

export default api;
