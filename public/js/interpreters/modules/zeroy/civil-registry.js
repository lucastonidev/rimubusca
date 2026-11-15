/**
 * ==============================================================================
 * ZEROY API INTERPRETER - CIVIL REGISTRY & NOTARY RECORDS (CIVIL-REGISTRY.JS)
 * Decodes birth, marriage, and death entries from official Notary Offices (Cartório),
 * book/sheet/term coordinates, and 32-digit national certificate codes.
 * Standardized with Clean Code principles and English naming.
 * ==============================================================================
 */

export const CivilRegistryInterpreter = {
  /**
   * Renders civil registry certificates from Zeroy API response
   * @param {Object} responseData Top-level response metadata
   * @param {Object} dataPayload Unwrapped data object
   * @returns {string} HTML markup
   */
  render(responseData, dataPayload) {
    const payload = dataPayload?.data || dataPayload?.dados || dataPayload || {};
    const personName = payload.nome || payload.registrado || "Registrado";
    const term = payload.termo || payload.numeroTermo || "N/A";
    const book = payload.livro || "N/A";
    const page = payload.folha || "N/A";
    const registryOffice =
      payload.cartorio ||
      payload.nomeCartorio ||
      payload.serventia ||
      "Cartório de Registro Civil";
    const city = payload.cidade || payload.municipio || "";
    const state = payload.uf || "";
    const certificateNumber = payload.matricula || payload.numeroCertidao || "";

    return `
      <div class="card" style="margin-bottom: var(--space-4); border-top: 4px solid #F59E0B; background: radial-gradient(circle at 95% 5%, rgba(245, 158, 11, 0.06) 0%, transparent 60%), var(--color-surface);">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
          <div>
            <span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.3); font-weight: 700;">
              <i data-lucide="scroll" style="width: 12px; height: 12px;"></i>
              ASSENTO DE REGISTRO CIVIL (CARTÓRIO)
            </span>
            <h2 style="font-size: 1.35rem; font-weight: 800; color: var(--color-text); margin-top: 6px;">
              ${personName}
            </h2>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-top: 14px;">
          <div style="background: var(--color-surface-2); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
            <span style="font-size: 0.7rem; color: var(--color-text-dim); text-transform: uppercase; font-weight: 700;">Termo</span>
            <div style="font-weight: 700; color: var(--color-text); font-family: var(--font-mono); font-size: 1.1rem;">${term}</div>
          </div>
          <div style="background: var(--color-surface-2); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
            <span style="font-size: 0.7rem; color: var(--color-text-dim); text-transform: uppercase; font-weight: 700;">Livro / Folha</span>
            <div style="font-weight: 700; color: var(--color-text); font-family: var(--font-mono); font-size: 1.1rem;">Livro ${book} &bull; Fls ${page}</div>
          </div>
          <div style="background: var(--color-surface-2); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
            <span style="font-size: 0.7rem; color: var(--color-text-dim); text-transform: uppercase; font-weight: 700;">Cartório de Registro</span>
            <div style="font-weight: 600; color: var(--color-text);">${registryOffice} ${city ? `(${city}/${state})` : ""}</div>
          </div>
        </div>

        ${
          certificateNumber
            ? `
          <div style="margin-top: 12px; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: var(--radius-md); padding: 10px 14px;">
            <span style="font-size: 0.7rem; text-transform: uppercase; font-weight: 700; color: #F59E0B;">Número de Matrícula Oficial (32 Dígitos)</span>
            <div style="font-family: var(--font-mono); font-weight: 700; font-size: 0.95rem; color: var(--color-text); margin-top: 2px;">
              ${certificateNumber}
            </div>
          </div>
        `
            : ""
        }
      </div>
    `;
  },
};

// Backward compatibility alias
export const CertidaoCartorioInterpreter = CivilRegistryInterpreter;

