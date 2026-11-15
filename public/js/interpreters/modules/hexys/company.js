/**
 * ==============================================================================
 * RIMUBUSCA - HEXYS DEV INTERPRETER - COMPANY & CNPJ (COMPANY.JS)
 * Renderizador de alta fidelidade para consultas corporativas de CNPJ,
 * quadro societário (QSA), atividades econômicas (CNAE) e situação cadastral.
 * ==============================================================================
 */

import { Formatters } from "../../utils.js";

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export const CompanyInterpreter = {
  /**
   * Renderiza os dados cadastrais da empresa e quadro societário (QSA)
   * @param {Object} responseData Objeto raiz da resposta da API
   * @param {Object} dataPayload Objeto desempacotado 'dados'
   * @returns {string} Markup HTML
   */
  render(responseData, dataPayload) {
    const data = dataPayload || responseData?.dados || responseData || {};

    const rawPartners = Array.isArray(data.sociosQSA)
      ? data.sociosQSA
      : Array.isArray(data.qsa)
      ? data.qsa
      : Array.isArray(data.socios)
      ? data.socios
      : Array.isArray(data.quadro_societario)
      ? data.quadro_societario
      : [];

    const corporateName = data.razaoSocial || data.razao_social || data.nome || "Razão Social Não Informada";
    const tradeName = data.nomeFantasia || data.nome_fantasia || "Não informado";
    const status = String(data.situacaoCadastral || data.descricao_situacao_cadastral || data.situacao || "ATIVA").toUpperCase();
    const cleanCnpj = String(data.cnpj_limpo || data.cnpj || "").replace(/\D/g, "");
    const formattedCnpj = cleanCnpj.length === 14 ? Formatters.cnpj(cleanCnpj) : (data.cnpj || "Não informado");
    const openingDate = data.dataAbertura || data.data_inicio_atividade || "Não informada";
    const formattedOpeningDate = openingDate.includes("-") ? Formatters.date(openingDate) : openingDate;
    const shareCapital = typeof data.capitalSocial === "number"
      ? Formatters.currency(data.capitalSocial)
      : (data.capitalSocial || data.capital_social || "Não informado");

    // CNAE Principal
    let cnaePrincipalText = "Não informado";
    if (data.cnaePrincipal && typeof data.cnaePrincipal === "object") {
      cnaePrincipalText = `${data.cnaePrincipal.codigo || ""} - ${data.cnaePrincipal.descricao || ""}`;
    } else if (data.cnaePrincipal) {
      cnaePrincipalText = String(data.cnaePrincipal);
    } else if (data.cnae_fiscal) {
      cnaePrincipalText = `${data.cnae_fiscal} - ${data.cnae_fiscal_descricao || ""}`;
    }

    // CNAEs Secundários
    const secondaryCnaes = Array.isArray(data.cnaesSecundarios || data.cnaes_secundarios)
      ? data.cnaesSecundarios || data.cnaes_secundarios
      : [];

    // Endereço
    const fullAddress = data.endereco || [
      [data.descricao_tipo_de_logradouro, data.logradouro].filter(Boolean).join(" "),
      data.numero ? `nº ${data.numero}` : null,
      data.complemento ? `(${data.complemento})` : null,
      data.bairro ? `- ${data.bairro}` : null,
      data.municipio ? `${data.municipio}/${data.uf || ""}` : null,
      data.cep ? `CEP ${data.cep}` : null,
    ].filter(Boolean).join(", ") || "Endereço não cadastrado";

    const legalNature = data.naturezaJuridica || data.natureza_juridica || "Não informada";
    const companySize = data.porte || data.porteEmpresa || "DEMAIS";
    const headquartersType = data.tipoMatrizFilial || data.descricao_identificador_matriz_filial || "MATRIZ";
    const phone = data.telefone || data.ddd_telefone_1 || null;
    const email = data.email || null;

    // Determina badge de status
    let statusBadgeClass = "badge-purple";
    let statusBadgeColor = "#10B981";
    let statusBadgeBg = "rgba(16, 185, 129, 0.15)";
    let statusBorderColor = "rgba(16, 185, 129, 0.35)";

    if (status.includes("BAIXADA") || status.includes("INAPTA") || status.includes("CANCELADA") || status.includes("NULA")) {
      statusBadgeColor = "#EF4444";
      statusBadgeBg = "rgba(239, 68, 68, 0.15)";
      statusBorderColor = "rgba(239, 68, 68, 0.35)";
    } else if (status.includes("SUSPENSA")) {
      statusBadgeColor = "#F59E0B";
      statusBadgeBg = "rgba(245, 158, 11, 0.15)";
      statusBorderColor = "rgba(245, 158, 11, 0.35)";
    }

    return `
      <!-- TOP CARD / HERO DA EMPRESA -->
      <div class="card" style="margin-bottom: var(--space-5); border-left: 4px solid #60A5FA; background: linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(139, 92, 246, 0.03) 100%), var(--color-surface);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
          <div style="flex: 1; min-width: 280px;">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;">
              <span class="badge" style="background: ${statusBadgeBg}; color: ${statusBadgeColor}; border: 1px solid ${statusBorderColor}; font-weight: 700;">
                <i data-lucide="shield-check" style="width: 12px; height: 12px;"></i>
                ${escapeHtml(status)}
              </span>
              <span class="badge badge-dark" style="font-size: 0.75rem;">
                ${escapeHtml(headquartersType)}
              </span>
              <span class="badge badge-purple" style="font-size: 0.75rem;">
                ${escapeHtml(companySize)}
              </span>
            </div>

            <h2 style="font-size: 1.45rem; font-weight: 800; color: var(--color-text); margin: 0; line-height: 1.3;">
              ${escapeHtml(corporateName)}
            </h2>

            <div style="font-size: 0.875rem; color: var(--color-text-muted); margin-top: 6px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span>Nome Fantasia: <strong style="color: var(--color-text);">${escapeHtml(tradeName)}</strong></span>
              <span style="color: var(--color-border);">&bull;</span>
              <span>Abertura: <strong style="color: var(--color-text);">${escapeHtml(formattedOpeningDate)}</strong></span>
            </div>
          </div>

          <div style="text-align: right; background: var(--color-surface-2); padding: 12px 18px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
            <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; font-weight: 600; display: block;">CNPJ Oficial</span>
            <div style="display: flex; align-items: center; gap: 8px; margin-top: 2px;">
              <span style="font-size: 1.3rem; font-weight: 800; font-family: var(--font-mono); color: #60A5FA;">
                ${escapeHtml(formattedCnpj)}
              </span>
              <button type="button" class="btn btn-ghost btn-sm btn-action-copy" data-copy="${escapeHtml(cleanCnpj)}" title="Copiar CNPJ Limpo" style="padding: 2px 6px;">
                <i data-lucide="copy" style="width: 13px; height: 13px;"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- GRID DE CARDS PRINCIPAIS -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-5);">
        
        <!-- CARD 1: DADOS CADASTRAIS & CAPITAL -->
        <div class="card">
          <div class="card-header" style="border-bottom: 1px solid var(--color-border); padding-bottom: 10px; margin-bottom: 12px;">
            <h3 class="card-title" style="display: flex; align-items: center; gap: 8px; font-size: 0.95rem; margin: 0;">
              <i data-lucide="file-text" style="color: #60A5FA; width: 18px; height: 18px;"></i>
              <span>Dados Societários & Fiscais</span>
            </h3>
          </div>
          <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.85rem;">
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.04); padding-bottom: 6px;">
              <span style="color: var(--color-text-muted);">Natureza Jurídica:</span>
              <span style="font-weight: 600; color: var(--color-text); text-align: right; max-width: 60%;">${escapeHtml(legalNature)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.04); padding-bottom: 6px;">
              <span style="color: var(--color-text-muted);">Capital Social:</span>
              <span style="font-weight: 700; color: #10B981; font-family: var(--font-mono);">${escapeHtml(shareCapital)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.04); padding-bottom: 6px;">
              <span style="color: var(--color-text-muted);">Porte Empresarial:</span>
              <span style="font-weight: 600; color: var(--color-text);">${escapeHtml(companySize)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--color-text-muted);">Classificação:</span>
              <span style="font-weight: 600; color: #A78BFA;">${escapeHtml(headquartersType)}</span>
            </div>
          </div>
        </div>

        <!-- CARD 2: ATIVIDADE ECONÔMICA (CNAE) -->
        <div class="card">
          <div class="card-header" style="border-bottom: 1px solid var(--color-border); padding-bottom: 10px; margin-bottom: 12px;">
            <h3 class="card-title" style="display: flex; align-items: center; gap: 8px; font-size: 0.95rem; margin: 0;">
              <i data-lucide="briefcase" style="color: #F59E0B; width: 18px; height: 18px;"></i>
              <span>Atividade Econômica (CNAE)</span>
            </h3>
          </div>
          <div style="font-size: 0.85rem;">
            <div style="color: var(--color-text-muted); font-size: 0.75rem; text-transform: uppercase; font-weight: 600; margin-bottom: 4px;">Atividade Principal:</div>
            <div style="font-weight: 600; color: #FFFFFF; background: var(--color-surface-2); padding: 8px 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border); line-height: 1.4;">
              ${escapeHtml(cnaePrincipalText)}
            </div>

            ${
              secondaryCnaes.length > 0
                ? `
              <div style="margin-top: 12px;">
                <div style="color: var(--color-text-muted); font-size: 0.75rem; text-transform: uppercase; font-weight: 600; margin-bottom: 6px;">
                  Secundárias (${secondaryCnaes.length}):
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px; max-height: 110px; overflow-y: auto;">
                  ${secondaryCnaes.slice(0, 5).map((sc) => `
                    <div style="font-size: 0.78rem; color: var(--color-text-dim); background: rgba(255,255,255,0.02); padding: 4px 8px; border-radius: 4px;">
                      <strong style="color: #F59E0B;">${escapeHtml(sc.codigo)}</strong> - ${escapeHtml(sc.descricao)}
                    </div>
                  `).join("")}
                  ${secondaryCnaes.length > 5 ? `<span style="font-size: 0.72rem; color: var(--color-text-muted); text-align: center;">+ ${secondaryCnaes.length - 5} outras atividades secundárias</span>` : ""}
                </div>
              </div>
            `
                : ""
            }
          </div>
        </div>

        <!-- CARD 3: LOCALIZAÇÃO & SEDE -->
        <div class="card">
          <div class="card-header" style="border-bottom: 1px solid var(--color-border); padding-bottom: 10px; margin-bottom: 12px;">
            <h3 class="card-title" style="display: flex; align-items: center; gap: 8px; font-size: 0.95rem; margin: 0;">
              <i data-lucide="map-pin" style="color: #EF4444; width: 18px; height: 18px;"></i>
              <span>Localização & Endereço</span>
            </h3>
          </div>
          <div style="font-size: 0.85rem;">
            <div style="font-weight: 600; color: var(--color-text); line-height: 1.5; margin-bottom: 10px;">
              ${escapeHtml(fullAddress)}
            </div>

            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px;">
              <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-xs" style="gap: 4px; font-size: 0.75rem;">
                <i data-lucide="external-link" style="width: 12px; height: 12px;"></i>
                Ver no Google Maps
              </a>
              <button type="button" class="btn btn-ghost btn-xs btn-action-copy" data-copy="${escapeHtml(fullAddress)}" style="gap: 4px; font-size: 0.75rem;">
                <i data-lucide="copy" style="width: 12px; height: 12px;"></i>
                Copiar Endereço
              </button>
            </div>
          </div>
        </div>

        <!-- CARD 4: CONTATOS REGISTRADOS -->
        <div class="card">
          <div class="card-header" style="border-bottom: 1px solid var(--color-border); padding-bottom: 10px; margin-bottom: 12px;">
            <h3 class="card-title" style="display: flex; align-items: center; gap: 8px; font-size: 0.95rem; margin: 0;">
              <i data-lucide="phone-call" style="color: #10B981; width: 18px; height: 18px;"></i>
              <span>Contatos Cadastrados</span>
            </h3>
          </div>
          <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.85rem;">
            <div>
              <span style="color: var(--color-text-muted); font-size: 0.75rem;">Telefone Principal:</span>
              <div style="font-weight: 600; font-family: var(--font-mono); color: #10B981; margin-top: 2px;">
                ${phone ? escapeHtml(phone) : "Não cadastrado"}
              </div>
            </div>
            <div>
              <span style="color: var(--color-text-muted); font-size: 0.75rem;">E-mail Corporativo:</span>
              <div style="font-weight: 600; font-family: var(--font-mono); color: #60A5FA; margin-top: 2px; word-break: break-all;">
                ${email ? escapeHtml(email) : "Não cadastrado"}
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- CARD FULL-WIDTH: QUADRO DE SÓCIOS E ADMINISTRADORES (QSA) -->
      <div class="card" style="margin-bottom: var(--space-4); border-top: 3px solid #8B5CF6;">
        <div class="card-header" style="border-bottom: 1px solid var(--color-border); padding-bottom: 12px; margin-bottom: var(--space-4); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div>
            <h3 class="card-title" style="display: flex; align-items: center; gap: 8px; font-size: 1.05rem; margin: 0;">
              <i data-lucide="users-2" style="color: #A78BFA; width: 20px; height: 20px;"></i>
              <span>Quadro de Sócios e Administradores (QSA)</span>
            </h3>
            <div style="font-size: 0.78rem; color: var(--color-text-muted); margin-top: 2px;">
              Vínculos societários identificados na Receita Federal do Brasil
            </div>
          </div>
          <span class="badge badge-purple" style="font-size: 0.8rem; font-weight: 700;">
            ${rawPartners.length} ${rawPartners.length === 1 ? "Sócio Encontrado" : "Sócios Encontrados"}
          </span>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: var(--space-3);">
          ${
            rawPartners.length > 0
              ? rawPartners
                  .map((partner) => {
                    const nomeSocio = partner.nome || partner.nome_socio || partner.nomeSocio || "Sócio Não Identificado";
                    const qualif = partner.qualificacao || partner.qualificacao_socio || partner.qualificacaoSocio || "Sócio";
                    const rawDoc = String(partner.cpf || partner.cnpj_cpf_do_socio || partner.documento || "").replace(/\D/g, "");
                    const isFullCpf = rawDoc.length === 11;
                    const docDisplay = partner.documento || partner.cnpj_cpf_do_socio || partner.cpf || (isFullCpf ? Formatters.cpf(rawDoc) : null);

                    return `
                      <div style="background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 14px 16px; display: flex; justify-content: space-between; align-items: center; gap: 12px; transition: all var(--transition-fast);">
                        <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
                          <div style="width: 40px; height: 40px; border-radius: var(--radius-md); background: rgba(139, 92, 246, 0.12); border: 1px solid rgba(139, 92, 246, 0.3); color: #A78BFA; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-weight: 700; font-size: 1rem;">
                            <i data-lucide="user-check" style="width: 20px; height: 20px;"></i>
                          </div>
                          <div style="min-width: 0;">
                            <div style="font-weight: 700; font-size: 0.95rem; color: #FFFFFF; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(nomeSocio)}">
                              ${escapeHtml(nomeSocio)}
                            </div>
                            <div style="font-size: 0.78rem; color: #A78BFA; font-weight: 600; margin-top: 2px;">
                              ${escapeHtml(qualif)}
                            </div>
                            ${
                              docDisplay
                                ? `<div style="font-size: 0.75rem; color: var(--color-text-dim); font-family: var(--font-mono); margin-top: 3px;">
                                    Doc: <strong>${escapeHtml(docDisplay)}</strong>
                                   </div>`
                                : ""
                            }
                          </div>
                        </div>

                        <div style="flex-shrink: 0;">
                          ${
                            isFullCpf
                              ? `
                            <button type="button" class="btn btn-primary btn-sm btn-puxar-cpf" data-cpf="${rawDoc}" title="Puxar Dossiê deste CPF" style="padding: 6px 12px; font-size: 0.78rem; gap: 6px;">
                              <i data-lucide="search" style="width: 13px; height: 13px;"></i>
                              <span>Puxar CPF</span>
                            </button>
                          `
                              : `
                            <button type="button" class="btn btn-outline btn-sm btn-puxar-nome-item" data-nome="${escapeHtml(nomeSocio)}" title="Investigar por Nome" style="padding: 6px 12px; font-size: 0.78rem; gap: 6px;">
                              <i data-lucide="search" style="width: 13px; height: 13px;"></i>
                              <span>Puxar Nome</span>
                            </button>
                          `
                          }
                        </div>
                      </div>
                    `;
                  })
                  .join("")
              : `
              <div style="grid-column: 1 / -1; text-align: center; padding: var(--space-6); background: var(--color-surface-2); border-radius: var(--radius-md); border: 1px dashed var(--color-border); color: var(--color-text-muted);">
                <i data-lucide="users" style="width: 28px; height: 28px; color: var(--color-text-dim); margin-bottom: 6px;"></i>
                <div>Nenhum sócio ou administrador indexado para este CNPJ na base da Receita Federal.</div>
              </div>
            `
          }
        </div>
      </div>
    `;
  },
};

export default CompanyInterpreter;
