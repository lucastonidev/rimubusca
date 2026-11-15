/**
 * ==============================================================================
 * ZEROY API INTERPRETER - NAME SEARCH & HOMONYMS (NAME-HOMONYMS.JS)
 * Formats multi-person homonym registries with match score badges,
 * dynamic search filters, and fast OSINT CPF pull actions.
 * Standardized with Clean Code principles and English naming.
 * ==============================================================================
 */

import { Formatters, renderScoreBadge, escapeHtml } from "../../utils.js";

export const NameHomonymsInterpreter = {
  /**
   * Renders homonyms listing table from Zeroy API response
   * @param {Object} responseData Top-level response metadata
   * @param {Object} dataPayload Unwrapped data object or array
   * @returns {string} HTML markup
   */
  render(responseData, dataPayload) {
    const rawData = dataPayload || {};

    // Resilient extraction across multiple possible nesting structures
    let records = [];
    if (Array.isArray(rawData.registros)) {
      records = rawData.registros;
    } else if (Array.isArray(rawData.data?.registros)) {
      records = rawData.data.registros;
    } else if (Array.isArray(rawData.dados?.registros)) {
      records = rawData.dados.registros;
    } else if (Array.isArray(rawData.resultados)) {
      records = rawData.resultados;
    } else if (Array.isArray(rawData.homonimos)) {
      records = rawData.homonimos;
    } else if (Array.isArray(rawData.data)) {
      records = rawData.data;
    } else if (Array.isArray(rawData)) {
      records = rawData;
    }

    const totalCount = rawData.total ?? rawData.data?.total ?? records.length;
    const searchTerm =
      rawData.busca ||
      rawData.data?.busca ||
      rawData.nome ||
      responseData.termo ||
      responseData.parametroValor ||
      "Pesquisa Nominal";

    const exactMatches = records.filter((r) =>
      String(r.score || "").includes("100")
    ).length;

    const maxDisplayCount = 100;
    const displayedRecords = records.slice(0, maxDisplayCount);

    return `
      <!-- Barra de KPIs da Busca Nominal -->
      <div class="zeroy-kpi-bar">
        <div class="zeroy-kpi-item">
          <div class="zeroy-kpi-icon" style="background: rgba(16, 185, 129, 0.15); color: #10B981;">
            <i data-lucide="users" style="width: 20px; height: 20px;"></i>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: var(--color-text-muted); text-transform: uppercase;">Total Localizado</div>
            <div style="font-size: 1.25rem; font-weight: 800; color: #10B981;">${totalCount} ${totalCount === 1 ? "Pessoa" : "Pessoas"}</div>
          </div>
        </div>

        <div class="zeroy-kpi-item">
          <div class="zeroy-kpi-icon" style="background: rgba(139, 92, 246, 0.15); color: #A78BFA;">
            <i data-lucide="check-check" style="width: 20px; height: 20px;"></i>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: var(--color-text-muted); text-transform: uppercase;">Matches 100%</div>
            <div style="font-size: 1.25rem; font-weight: 800; color: #A78BFA;">${exactMatches} ${exactMatches === 1 ? "Exato" : "Exatos"}</div>
          </div>
        </div>

        <div class="zeroy-kpi-item">
          <div class="zeroy-kpi-icon" style="background: rgba(59, 130, 246, 0.15); color: #60A5FA;">
            <i data-lucide="search" style="width: 20px; height: 20px;"></i>
          </div>
          <div style="overflow: hidden;">
            <div style="font-size: 0.75rem; color: var(--color-text-muted); text-transform: uppercase;">Termo Buscado</div>
            <div style="font-size: 0.95rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(searchTerm)}">${escapeHtml(searchTerm)}</div>
          </div>
        </div>
      </div>

      ${
        records.length > maxDisplayCount
          ? `
        <div style="background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: var(--radius-md); padding: 8px 14px; margin-bottom: var(--space-4); display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 0.8rem; color: #60A5FA;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <i data-lucide="info" style="width: 15px; height: 15px;"></i>
            <span>Exibindo os primeiros <strong>${maxDisplayCount}</strong> de <strong>${records.length}</strong> homônimos para máxima fluidez do navegador. Use o filtro dinâmico abaixo para refinar.</span>
          </div>
        </div>
      `
          : ""
      }

      <!-- Tabela Rica de Pessoas Encontradas -->
      <div class="zeroy-table-container">
        <div class="zeroy-table-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <i data-lucide="user-search" style="color: #10B981; width: 20px; height: 20px;"></i>
            <span style="font-weight: 700; font-size: 1rem;">Homônimos & Registros Vinculados</span>
            <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10B981;">${records.length} itens</span>
          </div>

          <div class="zeroy-table-search">
            <i data-lucide="search"></i>
            <input type="text" id="inputFiltroTabelaZeroy" placeholder="Filtrar por nome, CPF, ano..." autocomplete="off">
          </div>
        </div>

        <div style="overflow-x: auto;">
          <table class="zeroy-data-table" id="tabelaRegistrosZeroy">
            <thead>
              <tr>
                <th style="width: 100px;">Match</th>
                <th>Nome Completo</th>
                <th style="width: 160px;">CPF</th>
                <th style="width: 150px;">Nascimento / Idade</th>
                <th style="width: 110px;">Sexo</th>
                <th style="text-align: right; width: 130px;">Ação OSINT</th>
              </tr>
            </thead>
            <tbody>
              ${
                records.length === 0
                  ? `
                <tr>
                  <td colspan="6" style="text-align: center; padding: 36px 16px; color: var(--color-text-muted);">
                    <i data-lucide="user-x" style="width: 28px; height: 28px; color: #F59E0B; margin-bottom: 6px; display: inline-block;"></i>
                    <div style="font-size: 0.95rem; font-weight: 600; color: var(--color-text); margin-top: 4px;">Nenhum registro localizado</div>
                    <div style="font-size: 0.8rem; color: var(--color-text-dim); margin-top: 2px;">Não foram encontrados homônimos cadastrais para o termo "${escapeHtml(searchTerm)}".</div>
                  </td>
                </tr>
              `
                  : displayedRecords
                      .map((reg, idx) => {
                        const cleanCpf = String(reg.cpf || "").replace(/\D/g, "");
                        const formattedCpf = Formatters.cpf(reg.cpf);
                        const age = Formatters.age(reg.nascimento);
                        const rawGender = String(reg.sexo || "").toUpperCase();
                        const isMale = rawGender === "M" || rawGender.startsWith("MASC");

                        return `
                  <tr class="linha-registro-zeroy" data-search="${String(reg.nome || "").toLowerCase()} ${cleanCpf} ${String(reg.nascimento || "")}">
                    <td>${renderScoreBadge(reg.score)}</td>
                    <td>
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="width: 32px; height: 32px; border-radius: 50%; background: ${idx === 0 ? "rgba(16, 185, 129, 0.2)" : "var(--color-surface-2)"}; color: ${idx === 0 ? "#10B981" : "var(--color-text-muted)"}; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem; flex-shrink: 0; border: 1px solid var(--color-border);">
                          ${(reg.nome || "P").charAt(0).toUpperCase()}
                        </div>
                        <span style="font-weight: 700; color: var(--color-text); font-size: 0.9rem;">${reg.nome || "Não informado"}</span>
                      </div>
                    </td>
                    <td>
                      <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-family: var(--font-mono); font-weight: 600; color: #6EE7B7;">${formattedCpf}</span>
                        <button type="button" class="btn-action-copy btn-copiar-cpf" data-cpf="${cleanCpf}" title="Copiar CPF">
                          <i data-lucide="copy" style="width: 12px; height: 12px;"></i>
                        </button>
                      </div>
                    </td>
                    <td>
                      <div style="font-size: 0.85rem;">
                        <div style="font-family: var(--font-mono);">${reg.nascimento || "N/A"}</div>
                        ${age !== null ? `<div style="font-size: 0.75rem; color: var(--color-text-dim);">${age} anos</div>` : ""}
                      </div>
                    </td>
                    <td>
                      <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.8rem; color: var(--color-text-muted);">
                        <i data-lucide="${isMale ? "user" : "user-check"}" style="width: 13px; height: 13px; color: ${isMale ? "#60A5FA" : "#F472B6"};"></i>
                        <span>${isMale ? "Masc" : "Fem"}</span>
                      </span>
                    </td>
                    <td style="text-align: right;">
                      <button type="button" class="btn-action-puxar btn-puxar-cpf" data-cpf="${cleanCpf}" title="Consultar todos os dados deste CPF na Zeroy API">
                        <span>Puxar CPF</span>
                        <i data-lucide="arrow-right" style="width: 12px; height: 12px;"></i>
                      </button>
                    </td>
                  </tr>
                `;
                      })
                      .join("")
              }
            </tbody>
          </table>
        </div>
      </div>
    `;
  },
};

// Backward compatibility alias
export const NomeListaInterpreter = NameHomonymsInterpreter;

