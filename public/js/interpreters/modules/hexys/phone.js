/**
 * ==============================================================================
 * HEXYS API INTERPRETER - TELECOM & CARRIER (PHONE.JS)
 * Visual renderer for phone and telecommunication operator lookups.
 * Clean Code standards with English identifiers and strict null-safety.
 * ==============================================================================
 */

import { Formatters, escapeHtml } from "../../utils.js";

function cleanPhoneField(val) {
  if (val === null || val === undefined) return "";
  const s = String(val).trim();
  const up = s.replace(/[()]/g, "").trim().toUpperCase();
  if (
    up === "" ||
    up === "SEM RESULTADO" ||
    up === "N/I" ||
    up === "N/A" ||
    up === "NULL" ||
    up === "NONE" ||
    up === "NAO INFORMADO" ||
    up === "NÃO INFORMADO" ||
    up === "NAO INFORMADA" ||
    up === "NÃO INFORMADA" ||
    up === "OPERADORA DESCONHECIDA" ||
    up === "OPERADORA NÃO INFORMADA"
  ) {
    return "";
  }
  return s;
}

export function renderPhoneNotFoundCard(formattedPhone, description) {
  const numLabel = formattedPhone && formattedPhone !== "N/I" ? `para <strong>${escapeHtml(formattedPhone)}</strong>` : "para o número informado";
  return `
    <div class="card osint-empty-card osint-empty-card--purple">
      <div class="osint-empty-icon osint-empty-icon--warning">
        <i data-lucide="phone-off" class="icon-xl"></i>
      </div>
      <h3 class="osint-empty-title">Telefone Não Encontrado</h3>
      <p class="osint-empty-desc">
        ${description ? escapeHtml(description) : `Não foram localizados registros de titularidade, operadora ou vínculos ${numLabel} nas bases consultadas.`}
      </p>
    </div>
  `;
}

export const PhoneInterpreter = {
  /**
   * Renders carrier and telephony lookup details from Hexys API payload
   * @param {Object} responseData - Root query response metadata
   * @param {Object} dataPayload - Extracted data payload
   * @returns {string} HTML markup
   */
  render(responseData, dataPayload) {
    const data = dataPayload || {};
    const rawNumber = String(data.numeroConsultado || data.telefone || responseData?.termo || "");
    const formattedPhone = Formatters.phone(data.ddd, rawNumber);
    const operadoraVal = cleanPhoneField(data.operadora || data.operator || data.telefones?.[0]?.operadora);
    const hasValidPhones = Array.isArray(data.telefones) && data.telefones.length > 0;
    const titularVal = cleanPhoneField(data.titularNome || data.titular || data.nome || data.name);
    const cpfVal = cleanPhoneField(data.titularCpf || data.cpf);

    if (
      responseData?.notFound ||
      data.notFound ||
      data.isNotFound ||
      (!operadoraVal && !hasValidPhones && !titularVal && !cpfVal)
    ) {
      return renderPhoneNotFoundCard(formattedPhone, data.mensagem);
    }

    const operadora = operadoraVal || "Operadora não informada";
    const portabilidade = data.portabilidade ? "Sim (Linha Portada)" : "Não (Linha Original)";
    const confianca = data.confianca || data.confidence || "Alta (Base Anatel)";
    const tipoLinha = data.tipo_linha || data.line_type || (data.tipo && data.tipo !== "telefone" ? data.tipo : null) || "Móvel / Celular";
    const estado = cleanPhoneField(data.estado || data.state || data.uf) || "Brasil";
    const ddd = data.ddd || (rawNumber.replace(/\D/g, "").length >= 10 ? rawNumber.replace(/\D/g, "").slice(0, 2) : "N/I");

    // Dynamic brand color by telecom operator
    const opLower = operadora.toLowerCase();
    let opColor = "#3B82F6";
    let opBg = "rgba(59, 130, 246, 0.15)";
    if (opLower.includes("vivo")) {
      opColor = "#8B5CF6";
      opBg = "rgba(139, 92, 246, 0.15)";
    } else if (opLower.includes("claro")) {
      opColor = "#EF4444";
      opBg = "rgba(239, 68, 68, 0.15)";
    } else if (opLower.includes("tim")) {
      opColor = "#3B82F6";
      opBg = "rgba(59, 130, 246, 0.15)";
    } else if (opLower.includes("oi")) {
      opColor = "#F59E0B";
      opBg = "rgba(245, 158, 11, 0.15)";
    }

    return `
      <div class="card" style="margin-bottom: var(--space-4); border-top: 4px solid ${opColor};">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 14px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px;">
              <span class="badge" style="background: ${opBg}; color: ${opColor}; font-weight: 700;">
                <i data-lucide="radio" style="width: 12px; height: 12px;"></i> TELECOM & OPERADORA
              </span>
              <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10B981;">
                Confiança: ${escapeHtml(confianca)}
              </span>
            </div>
            <h2 style="font-size: 1.45rem; font-weight: 800; color: var(--color-text); margin: 0; font-family: var(--font-mono);">
              ${escapeHtml(formattedPhone)}
            </h2>
          </div>

          <div style="text-align: right;">
            <span class="badge badge-purple" style="font-size: 0.95rem; font-weight: 700; padding: 6px 14px; background: ${opBg}; color: ${opColor}; border: 1px solid ${opColor};">
              ${escapeHtml(operadora)}
            </span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; margin-top: var(--space-5);">
          <div style="background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
            <span style="font-size: 0.75rem; color: var(--color-text-muted); text-transform: uppercase;">Operadora Cadastrada</span>
            <div style="font-weight: 700; color: ${opColor}; margin-top: 2px;">${escapeHtml(operadora)}</div>
          </div>

          <div style="background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
            <span style="font-size: 0.75rem; color: var(--color-text-muted); text-transform: uppercase;">Tipo de Conexão</span>
            <div style="font-weight: 700; color: var(--color-text); margin-top: 2px;">${escapeHtml(tipoLinha)}</div>
          </div>

          <div style="background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
            <span style="font-size: 0.75rem; color: var(--color-text-muted); text-transform: uppercase;">Estado / DDD</span>
            <div style="font-weight: 700; color: var(--color-text); margin-top: 2px;">${escapeHtml(estado)} (DDD ${escapeHtml(ddd)})</div>
          </div>

          <div style="background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
            <span style="font-size: 0.75rem; color: var(--color-text-muted); text-transform: uppercase;">Histórico de Portabilidade</span>
            <div style="font-weight: 600; color: #F59E0B; margin-top: 2px;">${escapeHtml(portabilidade)}</div>
          </div>
        </div>
      </div>
    `;
  },
};

