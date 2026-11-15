/**
 * ==============================================================================
 * ZEROY API INTERPRETER - FACIAL BIOMETRICS & CNH MIRROR (BIOMETRICS.JS)
 * Formats official facial biometrics with lightbox zoom modal, Detran registration,
 * issuing authority, and quick CPF dossier pull.
 * Standardized with Clean Code principles and English naming.
 * ==============================================================================
 */

import { Formatters } from "../../utils.js";

export const BiometricsInterpreter = {
  /**
   * Renders facial biometric photo and driver license mirror
   * @param {Object} responseData Top-level response metadata
   * @param {Object} dataPayload Unwrapped data object
   * @returns {string} HTML markup
   */
  render(responseData, dataPayload) {
    const payload = dataPayload?.data || dataPayload?.dados || dataPayload || {};
    const rawPhoto =
      payload.foto ||
      payload.base64 ||
      payload.fotoBase64 ||
      payload.imagem ||
      (Array.isArray(payload.fotos) ? payload.fotos[0] : null);

    const photoUrl =
      Formatters.base64Image(rawPhoto) ||
      (typeof rawPhoto === "string" && rawPhoto.startsWith("http") ? rawPhoto : null);

    const name = payload.nome || "Titular";
    const formattedCpf = Formatters.cpf(payload.cpf || responseData.termo || "");
    const cleanCpf = String(payload.cpf || responseData.termo || "").replace(/\D/g, "");
    const driverLicense = payload.cnh || payload.registro || "Disponível";
    const issuingAuthority = payload.orgao || payload.uf || "DETRAN";

    return `
      <div class="card" style="margin-bottom: var(--space-4); border-top: 4px solid #8B5CF6;">
        <div style="display: flex; gap: var(--space-5); flex-wrap: wrap; align-items: flex-start;">
          <!-- Foto com Zoom -->
          <div style="text-align: center; flex-shrink: 0;">
            ${
              photoUrl
                ? `
              <div style="position: relative; display: inline-block; cursor: pointer;" onclick="window.abrirFotoLightbox && window.abrirFotoLightbox('${photoUrl}', '${name}')">
                <img src="${photoUrl}" alt="Foto Cadastral" style="width: 170px; height: 210px; object-fit: cover; border-radius: var(--radius-md); border: 2px solid #8B5CF6; box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3);">
                <div style="position: absolute; bottom: 6px; right: 6px; background: rgba(0,0,0,0.7); color: #FFF; border-radius: 4px; padding: 2px 6px; font-size: 0.65rem; display: flex; align-items: center; gap: 4px;">
                  <i data-lucide="zoom-in" style="width: 11px; height: 11px;"></i> Ampliar
                </div>
              </div>
            `
                : `
              <div style="width: 170px; height: 210px; background: var(--color-surface-2); border-radius: var(--radius-md); border: 2px dashed var(--color-border); display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--color-text-dim);">
                <i data-lucide="camera-off" style="width: 32px; height: 32px; margin-bottom: 6px;"></i>
                <span style="font-size: 0.75rem;">Sem Espelho</span>
              </div>
            `
            }
          </div>

          <!-- Dados da Biometria -->
          <div style="flex: 1; min-width: 250px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="badge" style="background: rgba(139, 92, 246, 0.15); color: #A78BFA; border: 1px solid rgba(139, 92, 246, 0.3); font-weight: 700;">
                <i data-lucide="scan-face" style="width: 12px; height: 12px;"></i>
                BIOMETRIA FACIAL OFICIAL
              </span>
            </div>
            <h2 style="font-size: 1.35rem; font-weight: 800; color: var(--color-text); margin-top: 6px;">
              ${name}
            </h2>
            <div style="margin-top: 4px; font-family: var(--font-mono); font-size: 0.9rem; color: var(--color-text-muted);">
              CPF: <strong style="color: var(--color-text);">${formattedCpf}</strong>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-top: var(--space-4);">
              <div style="background: var(--color-surface-2); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
                <span style="font-size: 0.7rem; color: var(--color-text-dim); text-transform: uppercase; font-weight: 700;">Registro CNH</span>
                <div style="font-weight: 700; color: var(--color-text); font-family: var(--font-mono);">${driverLicense}</div>
              </div>
              <div style="background: var(--color-surface-2); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
                <span style="font-size: 0.7rem; color: var(--color-text-dim); text-transform: uppercase; font-weight: 700;">Órgão Emissor</span>
                <div style="font-weight: 700; color: var(--color-text); font-family: var(--font-mono);">${issuingAuthority}</div>
              </div>
            </div>

            ${
              cleanCpf
                ? `
              <div style="margin-top: var(--space-4);">
                <button type="button" class="btn-action-puxar btn-puxar-cpf" data-cpf="${cleanCpf}">
                  <i data-lucide="user-search" style="width: 13px; height: 13px;"></i>
                  Puxar Dossiê Completo por CPF
                </button>
              </div>
            `
                : ""
            }
          </div>
        </div>
      </div>
    `;
  },
};

// Backward compatibility alias
export const FotoBiometriaInterpreter = BiometricsInterpreter;

