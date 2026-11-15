/**
 * ==============================================================================
 * HEXYS API INTERPRETER - RECORDS TABLE (RECORDS-TABLE.JS)
 * Visual renderer for multi-result queries (Name searches, CEP street lists,
 * neighbor records, and homonyms).
 * Clean Code standards with English identifiers and strict null-safety.
 * ==============================================================================
 */

import { Formatters, escapeHtml } from "../../utils.js";

export const RecordsTableInterpreter = {
  /**
   * Renders a tabular list of person / cadastral records
   * @param {Object} responseData - Root query response metadata
   * @param {Array} items - List of result items
   * @returns {string} HTML markup
   */
  render(responseData, items) {
    const records = Array.isArray(items) ? items : [];

    if (records.length === 0) {
      return `
        <div class="card" style="text-align: center; padding: var(--space-8);">
          <i data-lucide="user-x" style="width: 36px; height: 36px; color: #F59E0B; margin-bottom: 8px;"></i>
          <h3 style="font-size: 1.1rem; font-weight: 600; color: var(--color-text);">Nenhum registro localizado</h3>
          <p style="color: var(--color-text-muted); font-size: 0.85rem;">Não encontramos registros para o termo informado na base oficial.</p>
        </div>
      `;
    }

    return `
      <div class="card" style="margin-bottom: var(--space-4);">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <i data-lucide="list-filter" style="color: var(--color-primary); width: 20px; height: 20px;"></i>
            <h3 class="card-title" style="color: var(--color-text);">Resultados Localizados (${records.length})</h3>
          </div>
          <input 
            type="text" 
            id="inputFiltroResultados" 
            placeholder="Filtrar por nome, CPF, cidade..." 
            style="padding: 6px 14px; background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: var(--radius-md); color: var(--color-text); font-size: 0.8125rem; outline: none; min-width: 220px;"
          >
        </div>

        <div class="table-responsive" style="max-height: 550px; overflow-y: auto;">
          <table class="osint-table" id="tabelaResultadosPuxar">
            <thead>
              <tr>
                <th style="width: 40px;">#</th>
                <th>Nome Completo</th>
                <th style="width: 170px;">CPF</th>
                <th>Nascimento</th>
                <th>Mãe</th>
                <th>Localização / Endereço</th>
                <th style="text-align: right; width: 120px;">Ação</th>
              </tr>
            </thead>
            <tbody>
              ${records
                .map((item, idx) => {
                  const nome = item.name || item.nome || "Não informado";
                  const rawCpf = String(item.cpf || "").replace(/\D/g, "");
                  const formattedCpf = Formatters.cpf(item.cpf);
                  const nasc = item.birth_date || item.nascimento || "N/I";
                  const mae = item.mother_name || item.nomeMae || item.nome_mae || "N/I";
                  const end = item.endereco || item.address;
                  const loc = end
                    ? [end.logradouro || end.street, end.numero || end.number, end.cidade || end.city, end.uf || end.state]
                        .filter(Boolean)
                        .join(", ")
                    : item.cidade || item.city || "Brasil";

                  return `
                  <tr class="linha-resultado-item" data-search="${nome.toLowerCase()} ${rawCpf} ${String(loc).toLowerCase()}">
                    <td style="color: var(--color-text-dim); font-size: 0.75rem;">${idx + 1}</td>
                    <td style="font-weight: 700; color: var(--color-text);">${escapeHtml(nome)}</td>
                    <td>
                      <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-family: var(--font-mono); color: #6EE7B7; font-weight: 600;">${formattedCpf}</span>
                        <button type="button" class="btn btn-ghost btn-sm btn-copiar-cpf" data-cpf="${rawCpf}" title="Copiar CPF">
                          <i data-lucide="copy" style="width: 12px; height: 12px;"></i>
                        </button>
                      </div>
                    </td>
                    <td style="color: var(--color-text-muted); font-size: 0.8125rem;">${escapeHtml(nasc)}</td>
                    <td style="color: var(--color-text-muted); font-size: 0.8125rem;">${escapeHtml(mae)}</td>
                    <td style="color: var(--color-text-muted); font-size: 0.8125rem;">${escapeHtml(loc)}</td>
                    <td style="text-align: right;">
                      <button type="button" class="btn btn-primary btn-sm btn-puxar-cpf-item" data-cpf="${rawCpf}">
                        <i data-lucide="search" style="width: 12px; height: 12px;"></i> Investigar
                      </button>
                    </td>
                  </tr>
                `;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },
};

