/**
 * ==============================================================================
 * ZEROY API INTERPRETER - HEALTH & VACCINATION CARD (HEALTH.JS)
 * Decodes ConecteSUS Ministry of Health vaccination records, CNS card numbers,
 * vaccine batches, and immunization dates.
 * Standardized with Clean Code principles and English naming.
 * ==============================================================================
 */

import { Formatters } from "../../utils.js";

export const HealthInterpreter = {
  /**
   * Renders vaccination card and ConecteSUS records
   * @param {Object} responseData Top-level response metadata
   * @param {Object} dataPayload Unwrapped data object or array
   * @returns {string} HTML markup
   */
  render(responseData, dataPayload) {
    const payload = dataPayload?.data || dataPayload?.dados || dataPayload || {};
    const vaccines = Array.isArray(payload.vacinas)
      ? payload.vacinas
      : Array.isArray(payload.doses)
        ? payload.doses
        : Array.isArray(payload)
          ? payload
          : [];

    const patientName =
      (typeof payload.paciente === "object" ? payload.paciente?.nome : payload.paciente) ||
      payload.nome ||
      "Titular";
    const cnsNumber =
      (typeof payload.paciente === "object" ? (payload.paciente?.cns || payload.paciente?.numeroCns) : null) ||
      payload.cns ||
      payload.numeroCns ||
      "Não informado";

    return `
      <div class="card" style="margin-bottom: var(--space-4); border-top: 4px solid #6366F1;">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div>
            <span class="badge" style="background: rgba(99, 102, 241, 0.15); color: #818CF8; border: 1px solid rgba(99, 102, 241, 0.3); font-weight: 700;">
              <i data-lucide="syringe" style="width: 12px; height: 12px;"></i>
              CONECTESUS &bull; MINISTÉRIO DA SAÚDE
            </span>
            <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--color-text); margin-top: 6px;">
              ${patientName}
            </h3>
            <span style="font-size: 0.8rem; color: var(--color-text-dim); font-family: var(--font-mono);">CNS: ${cnsNumber}</span>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 14px;">
          ${
            vaccines.length === 0
              ? `
            <p style="color: var(--color-text-muted); font-size: 0.9rem;">Nenhuma dose de vacina localizada na base nacional do ConecteSUS.</p>
          `
              : vaccines
                  .map((v, idx) => {
                    const vaccineName =
                      v.vacina ||
                      v.imunobiologico ||
                      v.nome ||
                      `Imunização #${idx + 1}`;
                    const dose =
                      v.dose || v.descricaoDose || `${idx + 1}ª Dose`;
                    const applicationDate = Formatters.date(
                      v.dataAplicacao || v.data || v.dataVacinacao
                    );
                    const manufacturer =
                      v.fabricante || v.laboratorio || "Laboratório Oficial";
                    const batch = v.lote || "N/A";
                    const facility =
                      v.estabelecimento ||
                      v.local ||
                      v.municipio ||
                      "Unidade de Saúde";

                    return `
              <div style="background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10B981; font-weight: 700; font-size: 0.72rem;">
                      ${dose}
                    </span>
                    <strong style="color: var(--color-text); font-size: 0.95rem;">${vaccineName}</strong>
                  </div>
                  <div style="font-size: 0.78rem; color: var(--color-text-muted); margin-top: 4px;">
                    Fabricante: <strong>${manufacturer}</strong> &bull; Lote: <span style="font-family: var(--font-mono);">${batch}</span> &bull; Local: ${facility}
                  </div>
                </div>
                <div style="text-align: right; font-family: var(--font-mono); font-size: 0.85rem; color: #10B981; font-weight: 700;">
                  ${applicationDate}
                </div>
              </div>
            `;
                  })
                  .join("")
          }
        </div>
      </div>
    `;
  },
};

// Backward compatibility alias
export const VacinaSaudeInterpreter = HealthInterpreter;
