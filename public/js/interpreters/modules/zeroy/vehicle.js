/**
 * ==============================================================================
 * ZEROY API INTERPRETER - VEHICLE & LICENSE PLATE (VEHICLE.JS)
 * Decodes Mercosul and standard license plate registrations, Renavam, VIN/Chassi,
 * engine details, technical specifications, and linked vehicle owner.
 * Standardized with Clean Code principles and English naming.
 * ==============================================================================
 */

import { Formatters } from "../../utils.js";

export const VehicleInterpreter = {
  /**
   * Renders vehicle and registration details from Zeroy API response
   * @param {Object} responseData Top-level response metadata
   * @param {Object} dataPayload Unwrapped data object
   * @returns {string} HTML markup
   */
  render(responseData, dataPayload) {
    const data = dataPayload || {};
    const plate = String(data.placa || responseData.termo || "PLACA").toUpperCase();
    const brandModel =
      data.marcaModelo ||
      `${data.marca || ""} ${data.modelo || ""}`.trim() ||
      "Modelo não informado";

    const vehicleStatus = data.situacaoVeiculo || data.situacao || "CIRCULAÇÃO REGULAR";
    const manufactureYear = data.anoFabricacao || "----";
    const modelYear = data.anoModelo || "----";
    const color = data.cor || "N/A";
    const fuel = data.combustivel || "N/A";

    const chassi = data.chassi || "N/A";
    const renavam = data.renavam || "N/A";
    const engineNumber = data.motor || "N/A";
    const municipality = data.municipio || "N/A";
    const state = data.uf ? `/ ${data.uf}` : "";

    const ownerName =
      data.proprietario?.nome ||
      data.nomeProprietario ||
      "Não informado";

    const rawOwnerDoc = String(
      data.proprietario?.documento ||
      data.cpfProprietario ||
      data.cnpjProprietario ||
      ""
    );
    const cleanOwnerDoc = rawOwnerDoc.replace(/\D/g, "");
    const formattedOwnerDoc =
      cleanOwnerDoc.length === 14
        ? Formatters.cnpj(cleanOwnerDoc)
        : cleanOwnerDoc.length === 11
          ? Formatters.cpf(cleanOwnerDoc)
          : rawOwnerDoc || "Não informado";

    return `
      <!-- Box Placa Mercosul & Título -->
      <div style="display: grid; grid-template-columns: auto 1fr; gap: var(--space-4); align-items: center; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: var(--space-4); margin-bottom: var(--space-4);">
        <div class="placa-box-mercosul">
          <div class="placa-header-mercosul">BRASIL</div>
          <div class="placa-body-mercosul">${plate}</div>
        </div>

        <div>
          <div style="display: flex; gap: 8px; margin-bottom: 4px;">
            <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10B981; font-weight: 700;">REGISTRO AUTOMOTIVO</span>
            <span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #60A5FA;">${vehicleStatus}</span>
          </div>
          <h2 style="font-size: 1.35rem; font-weight: 800; color: var(--color-text); margin: 0;">${brandModel}</h2>
          <div style="font-size: 0.85rem; color: var(--color-text-muted); margin-top: 4px;">
            ${manufactureYear} / ${modelYear} &bull; Cor: <strong>${color}</strong> &bull; Combustível: <strong>${fuel}</strong>
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-4);">
        <!-- Dados Técnicos -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title" style="display: flex; align-items: center; gap: 8px;">
              <i data-lucide="hash" style="color: #60A5FA; width: 18px; height: 18px;"></i>
              <span>Dados Técnicos & Identificação</span>
            </h3>
          </div>
          <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.875rem;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--color-text-muted);">Chassi:</span>
              <span style="font-family: var(--font-mono); font-weight: 600;">${chassi}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--color-text-muted);">Renavam:</span>
              <span style="font-family: var(--font-mono); font-weight: 600;">${renavam}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--color-text-muted);">Número do Motor:</span>
              <span style="font-family: var(--font-mono); font-weight: 600;">${engineNumber}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--color-text-muted);">Município Emplacamento:</span>
              <span style="font-weight: 600;">${municipality} ${state}</span>
            </div>
          </div>
        </div>

        <!-- Proprietário Vinculado -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title" style="display: flex; align-items: center; gap: 8px;">
              <i data-lucide="user-check" style="color: #A78BFA; width: 18px; height: 18px;"></i>
              <span>Proprietário Vinculado</span>
            </h3>
          </div>
          <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.875rem;">
            <div>
              <span style="color: var(--color-text-muted); font-size: 0.75rem; text-transform: uppercase;">Nome do Titular</span>
              <div style="font-weight: 700; font-size: 0.95rem; color: var(--color-text);">${ownerName}</div>
            </div>
            <div>
              <span style="color: var(--color-text-muted); font-size: 0.75rem; text-transform: uppercase;">CPF / CNPJ</span>
              <div style="display: flex; align-items: center; gap: 8px; margin-top: 2px;">
                <span style="font-family: var(--font-mono); font-weight: 600; color: #10B981;">${formattedOwnerDoc}</span>
                ${
                  cleanOwnerDoc.length === 11
                    ? `
                  <button type="button" class="btn-action-puxar btn-puxar-cpf" data-cpf="${cleanOwnerDoc}">
                    <span>Consultar Titular</span>
                  </button>
                `
                    : ""
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },
};

// Backward compatibility alias
export const VeiculoPlacaInterpreter = VehicleInterpreter;

