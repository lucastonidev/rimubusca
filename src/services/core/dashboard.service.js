/**
 * ==============================================================================
 * RIMUBUSCA - SERVIÇO DE ESTATÍSTICAS DO DASHBOARD (DASHBOARD.SERVICE.JS)
 * Consolida métricas exclusivas de "Puxar Dados & Consultas Pessoais" (cadastral)
 * e o saldo da carteira gerenciado pelo administrador.
 * ==============================================================================
 */

import { supabaseAdmin } from "../../config/supabase.js";

// Quantidade de tipos de consulta na Central de Puxar Dados (/advanced/person)
// (CPF, Nome, Telefone, Placa, Foto, CEP, E-mail, Vizinhos, Título Eleitor,
// Operadora, RG, CNPJ, Parentes, NIS, PIS/PASEP)
export const TOTAL_TIPOS_PUXAR_DADOS = 15;
export const LIMITE_DIARIO_PADRAO = 100;
export const SALDO_PADRAO = 30.0;

/**
 * Obtém as estatísticas do operador restritas a Puxar Dados & Consultas Pessoais
 * @param {string} userId - UUID do operador autenticado
 * @returns {Promise<Object>}
 */
export async function obterEstatisticasPuxarDados(userId) {
  let totalHoje = 0;
  let totalHistorico = 0;
  let limiteDiario = LIMITE_DIARIO_PADRAO;
  let saldoCarteira = SALDO_PADRAO;
  let orcamentoMensal = SALDO_PADRAO;
  const totalModulos = TOTAL_TIPOS_PUXAR_DADOS;

  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && userId) {
    try {
      // 1. Data de início de hoje (00:00:00 local do servidor)
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      // 2. Busca contagem de hoje em Puxar Dados (modulo consulta_*)
      const { count: countHoje, error: errHoje } = await supabaseAdmin
        .from("buscas")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .like("modulo", "consulta_%")
        .gte("criado_em", hoje.toISOString());

      if (!errHoje && typeof countHoje === "number") {
        totalHoje = countHoje;
      }

      // 3. Busca total histórico do operador em Puxar Dados (modulo consulta_*)
      const { count: countTotal, error: errTotal } = await supabaseAdmin
        .from("buscas")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .like("modulo", "consulta_%");

      if (!errTotal && typeof countTotal === "number") {
        totalHistorico = countTotal;
      }

      // 4. Busca perfil do usuário para ler limite diário e saldo individual
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (profile) {
        if (typeof profile.limite_diario === "number" && profile.limite_diario > 0) {
          limiteDiario = profile.limite_diario;
        }
        if (typeof profile.saldo_carteira === "number") {
          saldoCarteira = Number(profile.saldo_carteira);
        }
      }

      // 5. Consulta saldo da carteira configurado pelo administrador na tabela hub_carteira
      const { data: carteiraRow } = await supabaseAdmin
        .from("hub_carteira")
        .select("saldo_atual, orcamento_mensal")
        .eq("id", "global_wallet")
        .maybeSingle();

      if (carteiraRow) {
        // Se o usuário não tiver saldo individual customizado, herda da carteira global
        if (profile?.saldo_carteira === null || profile?.saldo_carteira === undefined) {
          saldoCarteira = Number(carteiraRow.saldo_atual ?? SALDO_PADRAO);
        }
        orcamentoMensal = Number(carteiraRow.orcamento_mensal ?? SALDO_PADRAO);
      }
    } catch (err) {
      console.warn("[DASHBOARD SERVICE ERROR]:", err.message);
    }
  }

  // Calcula requisições restantes hoje e proporção de consumo (ex: 0 / 100, 12 / 100)
  const disponiveisHoje = Math.max(0, limiteDiario - totalHoje);
  const consumoFormatado = `${totalHoje} / ${limiteDiario}`;

  return {
    totalHoje,
    totalHistorico,
    totalModulos,
    limiteDiario,
    disponiveisHoje,
    disponiveisFormatado: consumoFormatado,
    consumoFormatado,
    saldoCarteira: Number(saldoCarteira.toFixed(2)),
    saldoFormatado: `R$ ${Number(saldoCarteira).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    orcamentoMensal: Number(orcamentoMensal.toFixed(2)),
    tetoFormatado: `Teto: R$ ${Number(orcamentoMensal).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mês`,
  };
}

export default {
  obterEstatisticasPuxarDados,
  TOTAL_TIPOS_PUXAR_DADOS,
  LIMITE_DIARIO_PADRAO,
};
