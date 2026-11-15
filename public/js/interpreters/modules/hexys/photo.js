/**
 * ==============================================================================
 * HEXYS API INTERPRETER - FACIAL BIOMETRICS (PHOTO.JS)
 * Visual renderer for standalone facial photo / biometric queries.
 * Clean Code standards with English identifiers and strict null-safety.
 * ==============================================================================
 */

import { Formatters, escapeHtml } from "../../utils.js";

export const PhotoInterpreter = {
  /**
   * Renders standalone facial biometrics from Hexys API payload
   * @param {Object} responseData - Root query response metadata
   * @param {Object} dataPayload - Extracted data payload
   * @returns {string} HTML markup
   */
  render(responseData, dataPayload) {
    const data = dataPayload || {};
    const photoSrc =
      data.fotoBase64 ||
      data.base64 ||
      data.foto_url ||
      data.foto ||
      (typeof data === "string" && data.startsWith("http") ? data : null);

    const docConsultado = responseData?.termo || data.cpf || "Documento Consultado";
    const formattedCpf = Formatters.cpf(docConsultado);
    const contentType = data.contentType || "Imagem JPEG/PNG";

    return `
      <div class="card" style="margin-bottom: var(--space-4); border-top: 4px solid #8B5CF6;">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <h3 class="card-title" style="color: #A78BFA; display: flex; align-items: center; gap: 8px;">
            <i data-lucide="camera" style="width: 20px; height: 20px;"></i>
            <span>Biometria Facial & Espelho Fotográfico</span>
          </h3>
          <span class="badge" style="background: rgba(139, 92, 246, 0.15); color: #C4B5FD;">Registro Oficial</span>
        </div>

        <div style="display: flex; gap: var(--space-6); flex-wrap: wrap; align-items: flex-start; padding-top: var(--space-4);">
          <div style="text-align: center; flex-shrink: 0;">
            ${
              photoSrc
                ? `
              <div style="position: relative; display: inline-block;">
                <img 
                  src="${photoSrc}" 
                  alt="Foto Facial" 
                  style="width: 200px; height: 250px; object-fit: cover; border-radius: var(--radius-md); border: 2px solid #8B5CF6; box-shadow: 0 4px 20px rgba(139, 92, 246, 0.35);"
                >
              </div>
              <div style="margin-top: 10px;">
                <a href="${photoSrc}" download="foto-facial-${docConsultado}.jpg" class="btn btn-outline btn-sm" style="font-size: 0.75rem;">
                  <i data-lucide="download" style="width: 14px; height: 14px;"></i> Baixar Imagem
                </a>
              </div>
            `
                : `
              <div style="width: 200px; height: 250px; background: var(--color-surface-2); border-radius: var(--radius-md); border: 2px dashed var(--color-border); display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--color-text-dim);">
                <i data-lucide="camera-off" style="width: 36px; height: 36px; margin-bottom: 8px;"></i>
                <span style="font-size: 0.85rem;">Foto não localizada</span>
              </div>
            `
            }
          </div>

          <div style="flex: 1; min-width: 260px;">
            <h4 style="font-size: 1.15rem; font-weight: 700; color: var(--color-text); margin-bottom: 12px;">
              Documento Consultado: <span style="font-family: var(--font-mono); color: #6EE7B7;">${escapeHtml(formattedCpf)}</span>
            </h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; font-size: 0.875rem;">
              <div style="background: var(--color-surface-2); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
                <span style="color: var(--color-text-muted); font-size: 0.75rem; display: block;">Status da Foto</span>
                <strong style="color: ${photoSrc ? "#10B981" : "#F59E0B"};">
                  ${photoSrc ? "Disponível na Base Hexys" : "Não encontrada"}
                </strong>
              </div>
              <div style="background: var(--color-surface-2); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
                <span style="color: var(--color-text-muted); font-size: 0.75rem; display: block;">Formato Retornado</span>
                <strong style="color: var(--color-text);">${escapeHtml(contentType)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },
};

