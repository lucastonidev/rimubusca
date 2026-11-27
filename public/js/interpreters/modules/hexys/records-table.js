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
    const queryType = String(responseData?.tipo || responseData?.type || "").toLowerCase().trim();
    const isNomeSimilar = queryType === "nome_similar";
    const isFiliacao = queryType === "mae" || queryType === "pai";

    const rawRecords = Array.isArray(items)
      ? items
      : Array.isArray(items?.filhos)
        ? items.filhos
        : Array.isArray(items?.resultado)
          ? items.resultado
          : [];

    const isInvalidText = (v) => {
      const s = String(v ?? "").trim().toUpperCase();
      return (
        !s ||
        s === "NÃO INFORMADO" ||
        s === "NAO INFORMADO" ||
        s === "NÃO INFORMADA" ||
        s === "NAO INFORMADA" ||
        s === "NOME NÃO INFORMADO" ||
        s === "N/I" ||
        s === "N/A" ||
        s === "NULL" ||
        s === "UNDEFINED"
      );
    };

    const records = rawRecords.filter((item) => {
      if (!item || typeof item !== "object") return false;
      const nomeVal = item.name || item.nome || item.NOME || "";
      const cpfDigits = String(item.cpf_raw || item.cpf || item.CPF || "").replace(/\D/g, "");
      return !isInvalidText(nomeVal) || cpfDigits.length >= 11;
    });

    if (responseData?.notFound || responseData?.isNotFound || items?.notFound || items?.isNotFound || records.length === 0) {
      const emptyTitle = isFiliacao ? "Nenhum Filho Localizado" : "Nenhum registro localizado";
      const emptyDesc = isFiliacao
        ? `Não encontramos filhos vinculados para a consulta de ${queryType === "mae" ? "mãe" : "pai"} informada.`
        : "Não encontramos registros para o termo informado na base oficial.";
      return `
        <div class="card osint-empty-card osint-empty-card--purple">
          <div class="osint-empty-icon ${isFiliacao ? "osint-empty-icon--purple" : "osint-empty-icon--warning"}">
            <i data-lucide="user-x" class="icon-xl"></i>
          </div>
          <h3 class="osint-empty-title">${emptyTitle}</h3>
          <p class="osint-empty-desc">${emptyDesc}</p>
        </div>
      `;
    }

    return `
      <div class="card osint-section-card">
        <div class="card-header">
          <h3 class="card-title">
            <i data-lucide="list-filter" class="icon-lg icon-purple"></i>
            <span>${isFiliacao ? `Filhos Identificados (${records.length})` : `Resultados Localizados (${records.length})`}</span>
          </h3>
          <input 
            type="text" 
            id="inputFiltroResultados" 
            class="input-filter-inline"
            placeholder="${isNomeSimilar || isFiliacao ? 'Filtrar por nome, CPF, estado...' : 'Filtrar por nome, CPF, cidade...'}" 
          >
        </div>

        <div class="table-responsive osint-table-scroll">
          <table class="osint-table" id="tabelaResultadosPuxar">
            <thead>
              <tr>
                <th style="width: 40px;">#</th>
                <th>Nome Completo</th>
                <th style="width: 185px;">CPF</th>
                ${
                  isNomeSimilar
                    ? `<th>Local de Emissão Estimado (9º Dígito)</th>`
                    : isFiliacao
                      ? `
                        <th>Nascimento</th>
                        <th>Local de Emissão Estimado (9º Dígito)</th>
                      `
                      : `
                        <th>Nascimento</th>
                        <th>Mãe</th>
                        <th>Localização / Endereço</th>
                      `
                }
                <th style="text-align: right; width: 150px;">Ação</th>
              </tr>
            </thead>
            <tbody>
              ${records
                .map((item, idx) => {
                  const nome = !isInvalidText(item.name || item.nome || item.NOME)
                    ? String(item.name || item.nome || item.NOME).trim()
                    : "Não informado";
                  const cpfVal = item.cpf_raw || item.cpf || item.CPF || "";
                  const rawCpf = String(cpfVal).replace(/\D/g, "");
                  const formattedCpf = rawCpf.length === 11 ? Formatters.cpf(rawCpf) : (cpfVal ? escapeHtml(String(cpfVal)) : "Não informado");
                  const regiaoInfo = Formatters.cpfRegion(rawCpf || cpfVal);
                  const regiaoSigla = item.regiaoFiscal || regiaoInfo.regiao;
                  const regiao = item.localEmissao || regiaoInfo.estados;
                  const regiaoDesc = item.regiaoFiscalDesc || regiaoInfo.descricao;
                  const rawNasc = item.birth_date || item.data_nascimento || item.nascimento || item.NASCIMENTO || "";
                  const nasc = !isInvalidText(rawNasc)
                    ? (String(rawNasc).includes("-") || String(rawNasc).includes("/") ? Formatters.date(rawNasc) : String(rawNasc))
                    : "Não informado";
                  const idadeNum = item.idade ?? (!isInvalidText(rawNasc) ? Formatters.age(rawNasc) : null);
                  const nascDisplay = idadeNum !== null && nasc !== "Não informado" ? `${nasc} (${idadeNum} anos)` : nasc;
                  const mae = item.mother_name || item.nomeMae || item.nome_mae || "N/I";
                  const end = item.endereco || item.address;
                  const loc = end
                    ? [end.logradouro || end.street, end.numero || end.number, end.cidade || end.city, end.uf || end.state]
                        .filter(Boolean)
                        .join(", ")
                    : item.cidade || item.city || "Brasil";

                  const searchData = isNomeSimilar || isFiliacao
                    ? `${nome.toLowerCase()} ${rawCpf} ${formattedCpf} ${String(regiaoSigla).toLowerCase()} ${String(regiao).toLowerCase()} ${String(nascDisplay).toLowerCase()}`
                    : `${nome.toLowerCase()} ${rawCpf} ${formattedCpf} ${String(loc).toLowerCase()}`;

                  return `
                  <tr class="linha-resultado-item" data-search="${escapeHtml(searchData)}">
                    <td style="color: var(--color-text-dim); font-size: 0.75rem;">${idx + 1}</td>
                    <td style="font-weight: 700;">${escapeHtml(nome)}</td>
                    <td>
                      <div class="osint-chip-row" style="gap: 6px;">
                        <span class="osint-kv-value--mint" style="font-weight: 600;">${formattedCpf}</span>
                        ${
                          rawCpf
                            ? `<button type="button" class="btn btn-ghost btn-copy-inline btn-copiar-cpf" data-cpf="${rawCpf}" title="Copiar CPF">
                                 <i data-lucide="copy" class="icon-xs"></i>
                               </button>`
                            : ""
                        }
                      </div>
                    </td>
                    ${
                      isNomeSimilar
                        ? `
                        <td>
                          <span class="badge-regiao-fiscal" title="${escapeHtml(regiaoDesc)}">
                            <i data-lucide="map-pin"></i>
                            ${regiaoSigla && regiaoSigla !== "N/I" ? `<span class="badge-regiao-sigla">${escapeHtml(regiaoSigla)} &bull;</span>` : ""}${escapeHtml(regiao)}
                          </span>
                        </td>
                      `
                        : isFiliacao
                          ? `
                            <td style="color: var(--color-text-muted); font-size: 0.8125rem;">${escapeHtml(nascDisplay)}</td>
                            <td>
                              <span class="badge-regiao-fiscal" title="${escapeHtml(regiaoDesc)}">
                                <i data-lucide="map-pin"></i>
                                ${regiaoSigla && regiaoSigla !== "N/I" ? `<span class="badge-regiao-sigla">${escapeHtml(regiaoSigla)} &bull;</span>` : ""}${escapeHtml(regiao)}
                              </span>
                            </td>
                          `
                          : `
                            <td style="color: var(--color-text-muted); font-size: 0.8125rem;">${escapeHtml(nasc)}</td>
                            <td style="color: var(--color-text-muted); font-size: 0.8125rem;">${escapeHtml(mae)}</td>
                            <td style="color: var(--color-text-muted); font-size: 0.8125rem;">${escapeHtml(loc)}</td>
                          `
                    }
                    <td style="text-align: right;">
                      ${
                        rawCpf.length >= 11
                          ? `<button type="button" class="btn btn-primary btn-sm btn-puxar-cpf-item" data-cpf="${rawCpf}" title="Consultar dossiê completo deste CPF">
                               <i data-lucide="search" class="icon-xs"></i> Investigar CPF
                             </button>`
                          : `<span style="font-size: 0.75rem; color: var(--color-text-dim);">Parcial</span>`
                      }
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

