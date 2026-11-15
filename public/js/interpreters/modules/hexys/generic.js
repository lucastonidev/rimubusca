/**
 * ==============================================================================
 * HEXYS API INTERPRETER - GENERIC OBJECT (GENERIC.JS)
 * Clean visual fallback for unmapped or nested response objects.
 * Clean Code standards with English identifiers and strict null-safety.
 * ==============================================================================
 */

import { escapeHtml } from "../../utils.js";

export const GenericInterpreter = {
  /**
   * Renders generic structured JSON object
   * @param {Object} responseData - Root query response metadata
   * @param {Object} dataPayload - Extracted data payload
   * @returns {string} HTML markup
   */
  render(responseData, dataPayload) {
    const data = dataPayload || {};
    const entries = Object.entries(data);

    if (entries.length === 0) {
      return `
        <div class="card" style="text-align: center; padding: var(--space-8);">
          <i data-lucide="info" style="width: 32px; height: 32px; color: #60A5FA; margin-bottom: 8px;"></i>
          <h3 style="font-size: 1.1rem; font-weight: 600;">Consulta Concluída</h3>
          <p style="color: var(--color-text-muted); font-size: 0.85rem;">Resposta recebida com sucesso, sem campos estruturados adicionais.</p>
        </div>
      `;
    }

    return `
      <div class="card" style="margin-bottom: var(--space-4);">
        <div class="card-header">
          <h3 class="card-title" style="display: flex; align-items: center; gap: 8px;">
            <i data-lucide="layers" style="color: var(--color-primary); width: 18px; height: 18px;"></i>
            <span>Resultado Estruturado</span>
          </h3>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px;">
          ${entries
            .map(([k, v]) => {
              const displayVal = typeof v === "object" ? JSON.stringify(v) : String(v ?? "N/A");
              return `
              <div style="background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
                <span style="font-size: 0.75rem; color: var(--color-text-muted); text-transform: uppercase; font-family: var(--font-mono);">${escapeHtml(k)}</span>
                <div style="font-weight: 600; color: var(--color-text); margin-top: 4px; word-break: break-all; font-size: 0.875rem;">
                  ${escapeHtml(displayVal)}
                </div>
              </div>
            `;
            })
            .join("")}
        </div>
      </div>
    `;
  },
};

