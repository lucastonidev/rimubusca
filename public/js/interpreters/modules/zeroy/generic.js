/**
 * ==============================================================================
 * ZEROY API INTERPRETER - GENERIC SMART RECURSIVE ENGINE (GENERIC.JS)
 * Automatically converts any arbitrary or unmapped JSON response into clean
 * grid cards, tabular layouts, and copyable badges.
 * Standardized with Clean Code principles and English naming.
 * ==============================================================================
 */

import { Formatters } from "../../utils.js";

export const GenericInterpreter = {
  /**
   * Main render entrypoint for generic JSON formatting
   * @param {Object|string} dataInput
   * @returns {string} HTML markup
   */
  render(dataInput) {
    let raw = dataInput;
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = { resultado: raw };
      }
    }
    const payload = raw?.dados || raw?.data || raw;

    if (!payload || (typeof payload === "object" && Object.keys(payload).length === 0)) {
      return `<div class="card" style="text-align: center; padding: 32px;"><p style="color: var(--color-text-muted);">Nenhum dado retornado para esta consulta.</p></div>`;
    }

    // Array of objects -> render generic data table
    if (Array.isArray(payload) && payload.length > 0) {
      return GenericInterpreter.renderGenericTable(payload);
    }

    // Object containing an array property (e.g. { registros: [...] } or { items: [...] })
    for (const [key, val] of Object.entries(payload)) {
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === "object") {
        const formattedTitle = key.replace(/([A-Z])/g, " $1").toUpperCase();
        return `
          <div class="card" style="margin-bottom: var(--space-4);">
            <div class="card-header">
              <h3 class="card-title" style="display: flex; align-items: center; gap: 8px;">
                <i data-lucide="database" style="color: #10B981; width: 18px; height: 18px;"></i>
                <span>${formattedTitle} (${val.length} registros)</span>
              </h3>
            </div>
            ${GenericInterpreter.renderGenericTable(val)}
          </div>
        `;
      }
    }

    // Key-value structured object
    return `
      <div class="card">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h3 class="card-title" style="display: flex; align-items: center; gap: 8px;">
            <i data-lucide="database" style="color: #10B981; width: 18px; height: 18px;"></i>
            <span>Resultado Oficial Estruturado</span>
          </h3>
          <span class="badge" style="background: rgba(16, 185, 129, 0.12); color: #10B981;">Interpretação Ativa</span>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; margin-top: 14px;">
          ${Object.entries(payload)
            .filter(([k]) => k !== "info_token")
            .map(([k, v]) => GenericInterpreter.renderFieldCard(k, v))
            .join("")}
        </div>
      </div>
    `;
  },

  /**
   * Renders an individual key-value card with type detection
   * @param {string} key
   * @param {*} value
   * @returns {string}
   */
  renderFieldCard(key, value) {
    const humanLabel = key
      .replace(/([A-Z])/g, " $1")
      .replace(/_/g, " ")
      .trim();

    if (value === null || value === undefined || value === "") {
      return `
        <div style="background: var(--color-surface-2); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
          <span style="font-size: 0.72rem; text-transform: uppercase; color: var(--color-text-dim); font-weight: 700;">${humanLabel}</span>
          <div style="color: var(--color-text-dim); font-size: 0.85rem; margin-top: 3px;">Não informado</div>
        </div>
      `;
    }

    // Nested object
    if (typeof value === "object" && !Array.isArray(value)) {
      return `
        <div style="grid-column: 1 / -1; background: var(--color-surface-2); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border); margin-top: 4px;">
          <span style="font-size: 0.78rem; text-transform: uppercase; color: #10B981; font-weight: 800; letter-spacing: 0.5px; display: block; margin-bottom: 8px;">
            ${humanLabel}
          </span>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px;">
            ${Object.entries(value)
              .map(([subKey, subVal]) => GenericInterpreter.renderFieldCard(subKey, subVal))
              .join("")}
          </div>
        </div>
      `;
    }

    // Simple array
    if (Array.isArray(value)) {
      const isPhotoKey = /(foto|imagem|image|photo|cnh|biometria|facial)/i.test(key);
      const imageItems = value
        .map((item, idx) => {
          if (!item) return null;
          if (typeof item === "string") {
            const photoUrl = Formatters.base64Image(item);
            if (photoUrl) return { url: photoUrl, title: `${humanLabel} #${idx + 1}` };
            if (isPhotoKey && item.length > 50) {
              const url = item.startsWith("data:") ? item : `data:image/jpeg;base64,${item.trim()}`;
              return { url, title: `${humanLabel} #${idx + 1}` };
            }
          } else if (typeof item === "object") {
            const raw = item.foto || item.fotoBase64 || item.base64 || item.url || item.imagem || "";
            const photoUrl = Formatters.base64Image(raw);
            if (photoUrl) return { url: photoUrl, title: item.tipo || item.descricao || `${humanLabel} #${idx + 1}` };
          }
          return null;
        })
        .filter(Boolean);

      if (imageItems.length > 0) {
        return `
          <div style="grid-column: 1 / -1; background: var(--color-surface-2); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
            <span style="font-size: 0.78rem; text-transform: uppercase; color: #10B981; font-weight: 800; display: block; margin-bottom: 10px;">
              ${humanLabel} (${imageItems.length})
            </span>
            <div style="display: flex; flex-wrap: wrap; gap: 14px;">
              ${imageItems
                .map(
                  (img) => `
                <div style="text-align: center; background: var(--color-surface); padding: 10px; border-radius: var(--radius-md); border: 1px solid var(--color-border); box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
                  <img src="${img.url}" alt="${img.title}" style="max-height: 200px; max-width: 100%; object-fit: contain; border-radius: var(--radius-md); border: 2px solid #10B981; cursor: pointer;" onclick="if(window.abrirFotoLightbox){window.abrirFotoLightbox('${img.url}','${img.title}')}else{window.open('${img.url}','_blank')}">
                  <div style="margin-top: 6px; font-size: 0.75rem; color: var(--color-text-muted);">${img.title}</div>
                </div>
              `
                )
                .join("")}
            </div>
          </div>
        `;
      }

      return `
        <div style="grid-column: 1 / -1; background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
          <span style="font-size: 0.75rem; text-transform: uppercase; color: var(--color-text-muted); font-weight: 700;">${humanLabel} (${value.length})</span>
          <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px;">
            ${value
              .map(
                (item) => `
              <span class="badge" style="background: var(--color-surface); border: 1px solid var(--color-border); color: var(--color-text); font-family: var(--font-mono);">
                ${typeof item === "object" ? JSON.stringify(item) : String(item)}
              </span>
            `
              )
              .join("")}
          </div>
        </div>
      `;
    }

    const strValue = String(value).trim();
    const cleanDigits = strValue.replace(/\D/g, "");

    // CPF detection (11 digits, no @)
    if (cleanDigits.length === 11 && !strValue.includes("@")) {
      return `
        <div style="background: var(--color-surface-2); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
          <span style="font-size: 0.72rem; text-transform: uppercase; color: var(--color-text-muted); font-weight: 700;">${humanLabel}</span>
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 4px;">
            <span style="font-family: var(--font-mono); font-weight: 700; color: var(--color-text);">${Formatters.cpf(cleanDigits)}</span>
            <div style="display: flex; gap: 4px;">
              <button type="button" class="btn-action-copy btn-copiar-texto" data-copy="${cleanDigits}" title="Copiar"><i data-lucide="copy" style="width: 12px; height: 12px;"></i></button>
              <button type="button" class="btn-action-puxar btn-puxar-cpf" data-cpf="${cleanDigits}" title="Puxar Dossiê"><i data-lucide="search" style="width: 12px; height: 12px;"></i></button>
            </div>
          </div>
        </div>
      `;
    }

    // CNPJ detection (14 digits)
    if (cleanDigits.length === 14) {
      return `
        <div style="background: var(--color-surface-2); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
          <span style="font-size: 0.72rem; text-transform: uppercase; color: var(--color-text-muted); font-weight: 700;">${humanLabel}</span>
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 4px;">
            <span style="font-family: var(--font-mono); font-weight: 700; color: var(--color-text);">${Formatters.cnpj(cleanDigits)}</span>
            <button type="button" class="btn-action-copy btn-copiar-texto" data-copy="${cleanDigits}" title="Copiar"><i data-lucide="copy" style="width: 12px; height: 12px;"></i></button>
          </div>
        </div>
      `;
    }

    // Date (YYYY-MM-DD or ISO)
    if (/^\d{4}-\d{2}-\d{2}/.test(strValue)) {
      return `
        <div style="background: var(--color-surface-2); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
          <span style="font-size: 0.72rem; text-transform: uppercase; color: var(--color-text-muted); font-weight: 700;">${humanLabel}</span>
          <div style="font-weight: 700; color: #10B981; font-family: var(--font-mono); margin-top: 4px;">${Formatters.date(strValue)}</div>
        </div>
      `;
    }

    // Boolean
    if (typeof value === "boolean") {
      return `
        <div style="background: var(--color-surface-2); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
          <span style="font-size: 0.72rem; text-transform: uppercase; color: var(--color-text-muted); font-weight: 700;">${humanLabel}</span>
          <div style="margin-top: 4px;">
            <span class="badge" style="background: ${value ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)"}; color: ${value ? "#10B981" : "#EF4444"}; font-weight: 700;">
              ${value ? "SIM / ATIVO" : "NÃO / INATIVO"}
            </span>
          </div>
        </div>
      `;
    }

    // Base64 Image
    const isPhotoKey = /(foto|imagem|image|photo|cnh|biometria|facial)/i.test(key);
    if (
      strValue.length > 50 &&
      (strValue.startsWith("data:image") || strValue.startsWith("/9j/") || strValue.startsWith("iVBOR") || isPhotoKey)
    ) {
      const photoUrl = Formatters.base64Image(strValue) || (strValue.startsWith("data:") ? strValue : `data:image/jpeg;base64,${strValue}`);
      if (photoUrl) {
        return `
          <div style="grid-column: 1 / -1; background: var(--color-surface-2); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border); text-align: center;">
            <span style="font-size: 0.75rem; text-transform: uppercase; color: #10B981; font-weight: 800; display: block; margin-bottom: 8px;">${humanLabel}</span>
            <img src="${photoUrl}" alt="${humanLabel}" style="max-height: 240px; max-width: 100%; border-radius: var(--radius-md); border: 2px solid #10B981; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.25); cursor: pointer;" onclick="if(window.abrirFotoLightbox){window.abrirFotoLightbox('${photoUrl}','${humanLabel}')}else{window.open('${photoUrl}','_blank')}">
          </div>
        `;
      }
    }

    // Fallback standard text
    return `
      <div style="background: var(--color-surface-2); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
        <span style="font-size: 0.72rem; text-transform: uppercase; color: var(--color-text-muted); font-weight: 700;">${humanLabel}</span>
        <div style="font-weight: 600; color: var(--color-text); margin-top: 4px; word-break: break-all;">${strValue}</div>
      </div>
    `;
  },

  /**
   * Renders a generic table from an array of records
   * @param {Array<Object>} items
   * @returns {string}
   */
  renderGenericTable(items) {
    if (!items || items.length === 0) return "";
    const columns = Object.keys(items[0]).filter((c) => c !== "info_token");

    return `
      <div style="overflow-x: auto; margin-top: 10px;">
        <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 0.825rem;">
          <thead>
            <tr style="border-bottom: 1px solid var(--color-border); background: var(--color-surface-2);">
              ${columns
                .map(
                  (c) => `
                <th style="padding: 10px 12px; text-align: left; font-weight: 700; color: var(--color-text-muted); text-transform: uppercase; font-size: 0.7rem;">
                  ${c.replace(/([A-Z])/g, " $1").replace(/_/g, " ")}
                </th>
              `
                )
                .join("")}
            </tr>
          </thead>
          <tbody>
            ${items
              .map(
                (item) => `
              <tr style="border-bottom: 1px solid var(--color-border);">
                ${columns
                  .map((c) => {
                    const val = item[c];
                    return `
                    <td style="padding: 10px 12px; color: var(--color-text); word-break: break-word;">
                      ${typeof val === "object" && val !== null ? JSON.stringify(val) : (val ?? "-")}
                    </td>
                  `;
                  })
                  .join("")}
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  },
};

// Backward compatibility alias
export const GenericoInterpreter = GenericInterpreter;

