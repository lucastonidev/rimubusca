/**
 * ==============================================================================
 * ZEROY API INTERPRETER - COMPANY & CNPJ (COMPANY.JS)
 * Decodes Receita Federal corporate registrations, legal status, share capital,
 * CNAE economic activities, and board of partners (QSA).
 * Standardized with Clean Code principles and English naming.
 * ==============================================================================
 */

import { Formatters } from "../../utils.js";

export const CompanyInterpreter = {
  /**
   * Renders company and corporate partnership details from Zeroy API response
   * @param {Object} dataPayload Unwrapped data object
   * @returns {string} HTML markup
   */
  render(dataPayload) {
    const data = dataPayload || {};
    const partners = Array.isArray(data.sociosQSA)
      ? data.sociosQSA
      : Array.isArray(data.qsa)
      ? data.qsa
      : Array.isArray(data.socios)
      ? data.socios
      : Array.isArray(data.quadro_societario)
      ? data.quadro_societario
      : [];

    const corporateName = data.razaoSocial || data.nome || "Razão Social Não Informada";
    const tradeName = data.nomeFantasia || "Não informado";
    const status = data.situacaoCadastral || data.situacao || "ATIVA";
    const cnpj = Formatters.cnpj(data.cnpj);
    const openingDate = Formatters.date(data.dataAbertura || data.dataInicio);
    const shareCapital = Formatters.currency(data.capitalSocial);
    const mainCnae = `${data.cnaePrincipal?.codigo || data.cnae || "N/A"} - ${data.cnaePrincipal?.descricao || ""}`;

    return `
      <div class="card" style="margin-bottom: var(--space-4); border-left: 4px solid #60A5FA;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;">
          <div>
            <span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #60A5FA; margin-bottom: 6px;">
              ${status}
            </span>
            <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--color-text); margin: 0;">${corporateName}</h2>
            <div style="font-size: 0.9rem; color: var(--color-text-muted); margin-top: 4px;">Nome Fantasia: <strong>${tradeName}</strong></div>
          </div>

          <div style="text-align: right;">
            <span style="font-size: 0.75rem; color: var(--color-text-muted); text-transform: uppercase;">CNPJ</span>
            <div style="font-size: 1.25rem; font-weight: 800; font-family: var(--font-mono); color: #60A5FA;">${cnpj}</div>
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-4);">
        <!-- Atividade Econômica & Capital -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title" style="display: flex; align-items: center; gap: 8px;">
              <i data-lucide="briefcase" style="color: #F59E0B; width: 18px; height: 18px;"></i>
              <span>Atividade Econômica</span>
            </h3>
          </div>
          <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.875rem;">
            <div>
              <span style="color: var(--color-text-muted); font-size: 0.75rem;">CNAE Principal:</span>
              <div style="font-weight: 600; color: #FFFFFF;">${mainCnae}</div>
            </div>
            <div>
              <span style="color: var(--color-text-muted); font-size: 0.75rem;">Capital Social:</span>
              <div style="font-weight: 700; color: #10B981; font-family: var(--font-mono);">${shareCapital}</div>
            </div>
            <div>
              <span style="color: var(--color-text-muted); font-size: 0.75rem;">Abertura:</span>
              <div style="font-weight: 600;">${openingDate}</div>
            </div>
          </div>
        </div>

        <!-- Quadro Societário (QSA) -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title" style="display: flex; align-items: center; gap: 8px;">
              <i data-lucide="users" style="color: #A78BFA; width: 18px; height: 18px;"></i>
              <span>Quadro Societário (QSA) (${partners.length})</span>
            </h3>
          </div>
          <div style="font-size: 0.875rem; max-height: 220px; overflow-y: auto;">
            ${
              partners.length > 0
                ? partners
                    .map((partner) => {
                      const cleanPartnerDoc = String(partner.cpf || partner.documento || "").replace(/\D/g, "");
                      const formattedDoc =
                        cleanPartnerDoc.length === 11
                          ? Formatters.cpf(cleanPartnerDoc)
                          : cleanPartnerDoc.length === 14
                            ? Formatters.cnpj(cleanPartnerDoc)
                            : cleanPartnerDoc;

                      return `
                <div style="background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 8px 12px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <strong style="color: #FFFFFF;">${partner.nome || partner.nomeSocio || "Sócio"}</strong>
                    <div style="font-size: 0.75rem; color: var(--color-text-dim);">${partner.qualificacao || "Sócio"} ${formattedDoc ? `&bull; ${formattedDoc}` : ""}</div>
                  </div>
                  ${
                    cleanPartnerDoc.length === 11
                      ? `
                    <button type="button" class="btn-action-puxar btn-puxar-cpf" data-cpf="${cleanPartnerDoc}" title="Consultar dados deste sócio">
                      <span>Puxar</span>
                    </button>
                  `
                      : ""
                  }
                </div>
              `;
                    })
                    .join("")
                : `
              <div style="color: var(--color-text-muted); font-size: 0.85rem; padding: 12px 0;">Nenhum sócio informado.</div>
            `
            }
          </div>
        </div>
      </div>
    `;
  },
};

// Backward compatibility alias
export const CnpjEmpresaInterpreter = CompanyInterpreter;

