/**
 * ==============================================================================
 * RIMUBUSCA - HEXYS DEV INTERPRETER - NOME COMPLETO (NAME.JS)
 * Renderizador limpo e focado exclusivamente nos dados reais retornados
 * pela consulta de Nome Completo (Nome, CPF, Emissão pelo 9º dígito e Nascimento).
 * ==============================================================================
 */

import { Formatters, escapeHtml } from "../../utils.js";

function cleanVal(val) {
  if (val === null || val === undefined) return "";
  const s = String(val).trim();
  const upper = s.replace(/[()]/g, "").trim().toUpperCase();
  if (
    upper === "" ||
    upper === "SEM RESULTADO" ||
    upper === "N/I" ||
    upper === "N/A" ||
    upper === "NULL" ||
    upper === "NONE" ||
    upper === "NAO INFORMADO" ||
    upper === "NÃO INFORMADO" ||
    upper === "NAO INFORMADA" ||
    upper === "NÃO INFORMADA"
  ) {
    return "";
  }
  return s;
}

export const NameProfileInterpreter = {
  /**
   * Renderiza cartão limpo para consulta por Nome Completo (sem Score, Renda ou Documentos Civis vazios)
   * @param {Object} responseData
   * @param {Object} dataPayload
   * @returns {string} HTML markup
   */
  render(responseData, dataPayload) {
    const raw = dataPayload || responseData?.dados || responseData || {};
    const item = Array.isArray(raw)
      ? raw[0] || {}
      : raw.nome || raw.name || raw.cpf
        ? raw
        : Array.isArray(raw.resultado)
          ? raw.resultado[0] || {}
          : {};

    const isExplicitNotFound = Boolean(responseData?.notFound || responseData?.isNotFound || raw?.notFound || raw?.isNotFound);
    const d = item.DADOS || item.dados || item;
    const nomeRaw = cleanVal(d.nome || d.name || d.NOME);
    const nome = nomeRaw || cleanVal(responseData?.termo) || "Não informado";
    const cpfRaw = String(d.cpf_raw || d.cpf || d.CPF || "").replace(/\D/g, "");
    const cpfFmt = cpfRaw.length === 11 ? Formatters.cpf(cpfRaw) : cleanVal(d.cpf || d.CPF) || "Não informado";

    const rawNasc = cleanVal(d.data_nascimento || d.nascimento || d.birth_date || d.NASCIMENTO || d.NASC);
    const birthDate = rawNasc ? Formatters.date(rawNasc) : "";
    const age = rawNasc ? (d.idade ?? Formatters.age(rawNasc)) : null;

    const regiaoInfo = cpfRaw.length >= 9 ? Formatters.cpfRegion(cpfRaw) : null;
    const regiaoSigla = item.regiaoFiscal || regiaoInfo?.regiao || "";
    const regiaoEstados = item.localEmissao || regiaoInfo?.estados || "";

    const rawSex = cleanVal(d.sexo || d.gender || d.SEXO).toUpperCase();
    const sexoLabel = rawSex === "M" || rawSex === "MASCULINO"
      ? "Masculino"
      : rawSex === "F" || rawSex === "FEMININO"
        ? "Feminino"
        : rawSex;

    const signo = cleanVal(d.signo);

    if (isExplicitNotFound || (nome === "Não informado" && !cpfRaw) || (!nomeRaw && !cpfRaw)) {
      return `
        <div class="card osint-empty-card osint-empty-card--purple">
          <div class="osint-empty-icon osint-empty-icon--purple">
            <i data-lucide="user-x" class="icon-xl"></i>
          </div>
          <h3 class="osint-empty-title">Nenhum Titular Localizado</h3>
          <p class="osint-empty-desc">
            Não foi encontrado registro nominal exato para o nome pesquisado.
          </p>
        </div>
      `;
    }

    return `
      <div class="card osint-section-card osint-section-card--purple">
        <div class="osint-person-top">
          <div>
            <div class="osint-chip-row mb-4">
              <span class="badge badge-purple">
                <i data-lucide="user-search" class="icon-xs"></i> NOME COMPLETO
              </span>
              ${
                regiaoSigla && regiaoSigla !== "N/I"
                  ? `<span class="badge-regiao-fiscal" title="${escapeHtml(regiaoInfo?.descricao || regiaoEstados)}">
                      <i data-lucide="map-pin"></i>
                      <span class="badge-regiao-sigla">${escapeHtml(regiaoSigla)} &bull;</span>${escapeHtml(regiaoEstados)}
                    </span>`
                  : ""
              }
            </div>

            <h2 class="osint-person-name">${escapeHtml(nome)}</h2>

            <div class="osint-cpf-row">
              <span class="osint-cpf-code">${escapeHtml(cpfFmt)}</span>
              ${
                cpfRaw
                  ? `<button type="button" class="btn btn-ghost btn-copy-inline btn-copiar-cpf" data-cpf="${escapeHtml(cpfRaw)}" title="Copiar CPF">
                      <i data-lucide="copy" class="icon-xs"></i>
                    </button>`
                  : ""
              }
            </div>
          </div>

          ${
            cpfRaw.length === 11
              ? `<div class="osint-chip-row">
                  <button type="button" class="btn btn-primary btn-sm btn-puxar-cpf-item btn-puxar-cpf" data-cpf="${escapeHtml(cpfRaw)}" title="Consultar Dossiê Completo deste CPF">
                    <i data-lucide="search" class="icon-sm"></i>
                    <span>Investigar Dossiê CPF</span>
                  </button>
                </div>`
              : ""
          }
        </div>

        <div class="osint-kv-grid mt-5">
          <div class="osint-kv-item">
            <span class="osint-kv-label">Nome Completo</span>
            <strong class="osint-kv-value">${escapeHtml(nome)}</strong>
          </div>

          <div class="osint-kv-item">
            <span class="osint-kv-label">CPF</span>
            <strong class="osint-kv-value osint-kv-value--mint">${escapeHtml(cpfFmt)}</strong>
          </div>

          ${
            birthDate
              ? `<div class="osint-kv-item">
                  <span class="osint-kv-label">Data de Nascimento</span>
                  <strong class="osint-kv-value">
                    ${escapeHtml(birthDate)}${age !== null && age !== undefined ? ` <span class="osint-kv-note">(${escapeHtml(String(age))} anos)</span>` : ""}
                  </strong>
                </div>`
              : ""
          }

          ${
            sexoLabel
              ? `<div class="osint-kv-item">
                  <span class="osint-kv-label">Sexo</span>
                  <strong class="osint-kv-value">${escapeHtml(sexoLabel)}</strong>
                </div>`
              : ""
          }

          ${
            signo
              ? `<div class="osint-kv-item">
                  <span class="osint-kv-label">Signo</span>
                  <strong class="osint-kv-value">${escapeHtml(signo)}</strong>
                </div>`
              : ""
          }

          ${
            regiaoEstados && regiaoEstados !== "Não identificado"
              ? `<div class="osint-kv-item">
                  <span class="osint-kv-label">Emissão Estimada (9º Dígito)</span>
                  <strong class="osint-kv-value osint-kv-value--purple">
                    ${regiaoSigla && regiaoSigla !== "N/I" ? `${escapeHtml(regiaoSigla)} &bull; ` : ""}${escapeHtml(regiaoEstados)}
                  </strong>
                </div>`
              : ""
          }
        </div>
      </div>
    `;
  },
};
