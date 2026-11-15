/**
 * ==============================================================================
 * ZEROY API INTERPRETER - PIX & FINANCIAL SISBAJUD (FINANCIAL-PIX.JS)
 * Decodes active PIX keys, linked banking accounts, BACEN SPI relationships,
 * and SISBAJUD judicial attachments.
 * Standardized with Clean Code principles and English naming.
 * ==============================================================================
 */

import { Formatters } from "../../utils.js";

export const FinancialPixInterpreter = {
  /**
   * Renders PIX and financial accounts from Zeroy API response
   * @param {Object} responseData Top-level response metadata
   * @param {Object} dataPayload Unwrapped data object or array
   * @returns {string} HTML markup
   */
  render(responseData, dataPayload) {
    const payload = dataPayload?.data || dataPayload?.dados || dataPayload || {};
    const queryType = String(responseData.tipo || responseData.id || "pix").toUpperCase();

    // Normalizes list of accounts / keys / relationships
    let accounts = [];
    let individualKeys = [];

    if (Array.isArray(payload)) {
      accounts = payload;
    } else if (Array.isArray(payload.contas)) {
      accounts = payload.contas;
    } else if (Array.isArray(payload.relacionamentos)) {
      accounts = payload.relacionamentos;
    } else if (Array.isArray(payload.chaves) || Array.isArray(payload.chavesPix)) {
      individualKeys = payload.chaves || payload.chavesPix;
    } else if (Array.isArray(payload.registros)) {
      accounts = payload.registros;
    } else if (payload.banco || payload.chave || payload.chavePix) {
      accounts = [payload];
    }

    // Group detached keys into bank accounts if no explicit accounts list
    if (individualKeys.length > 0 && accounts.length === 0) {
      const keysWithBank = individualKeys.filter(
        (k) => k && typeof k === "object" && (k.banco || k.instituicao)
      );

      if (keysWithBank.length > 0) {
        const grouped = {};
        individualKeys.forEach((k) => {
          const bank =
            (typeof k === "object" && (k.banco || k.instituicao)) ||
            payload.banco ||
            "Instituição Financeira";
          if (!grouped[bank]) grouped[bank] = [];
          grouped[bank].push(k);
        });

        accounts = Object.keys(grouped).map((bank) => ({
          banco: bank,
          agencia: payload.agencia || "0001",
          conta: payload.conta || "N/A",
          chaves: grouped[bank],
        }));
      } else {
        accounts = [
          {
            banco: payload.banco || payload.instituicao || "Instituição Financeira",
            agencia: payload.agencia || "0001",
            conta: payload.conta || "N/A",
            chaves: individualKeys,
          },
        ];
      }
    }

    const holder =
      payload.titular ||
      payload.nome ||
      payload.nomeTitular ||
      payload.razaoSocial ||
      "Titular Identificado";

    const rawDoc =
      payload.cpf ||
      payload.cnpj ||
      payload.documento ||
      responseData.termo ||
      "";

    const formattedDoc =
      rawDoc.length === 14
        ? Formatters.cnpj(rawDoc)
        : rawDoc.length === 11
          ? Formatters.cpf(rawDoc)
          : rawDoc;

    const pixType = responseData.tipoPix || responseData.dados?.tipoPix || null;
    const queriedTerm = responseData.termo || "";

    const PIX_TYPE_METADATA = {
      cpf_titular: {
        label: "Busca por CPF do Titular",
        badgeColor: "rgba(16, 185, 129, 0.15)",
        textColor: "#10B981",
        icon: "user-check",
        formattedTerm: Formatters.cpf(queriedTerm),
      },
      chave_cpf: {
        label: "Busca por Chave PIX: CPF",
        badgeColor: "rgba(59, 130, 246, 0.15)",
        textColor: "#3B82F6",
        icon: "key",
        formattedTerm: Formatters.cpf(queriedTerm),
      },
      chave_cnpj: {
        label: "Busca por Chave PIX: CNPJ",
        badgeColor: "rgba(139, 92, 246, 0.15)",
        textColor: "#8B5CF6",
        icon: "building-2",
        formattedTerm: Formatters.cnpj(queriedTerm),
      },
      chave_telefone: {
        label: "Busca por Chave PIX: Telefone",
        badgeColor: "rgba(245, 158, 11, 0.15)",
        textColor: "#F59E0B",
        icon: "phone",
        formattedTerm: Formatters.phone(null, queriedTerm),
      },
      chave_email: {
        label: "Busca por Chave PIX: E-mail",
        badgeColor: "rgba(236, 72, 153, 0.15)",
        textColor: "#EC4899",
        icon: "mail",
        formattedTerm: queriedTerm.toLowerCase(),
      },
      chave_evp: {
        label: "Busca por Chave PIX: EVP (Aleatória)",
        badgeColor: "rgba(6, 182, 212, 0.15)",
        textColor: "#06B6D4",
        icon: "fingerprint",
        formattedTerm: queriedTerm.toLowerCase(),
      },
    };

    const pixTypeInfo = pixType && PIX_TYPE_METADATA[pixType] ? PIX_TYPE_METADATA[pixType] : null;

    // Calculate total keys
    let totalKeys = 0;
    accounts.forEach((acc) => {
      if (Array.isArray(acc.chaves)) totalKeys += acc.chaves.length;
      else if (acc.chave || acc.chavePix) totalKeys++;
    });
    if (totalKeys === 0 && individualKeys.length > 0) {
      totalKeys = individualKeys.length;
    }

    const pixSummaryText = encodeURIComponent(
      [
        `=== RIMUBUSCA - CONSULTA PIX / SISBAJUD / BACEN ===`,
        `MÓDULO: ${queryType}`,
        pixTypeInfo
          ? `TIPO CONSULTA: ${pixTypeInfo.label} (${pixTypeInfo.formattedTerm})`
          : null,
        `TITULAR: ${holder}`,
        `DOCUMENTO: ${formattedDoc}`,
        `TOTAL DE CONTAS: ${accounts.length}`,
        `TOTAL DE CHAVES: ${totalKeys}`,
        `CONSULTA EM: ${new Date().toLocaleString("pt-BR")}`,
      ]
        .filter(Boolean)
        .join("\n")
    );

    return `
      <!-- HEADER FINANCEIRO / PIX -->
      <div class="card" style="margin-bottom: var(--space-4); border-top: 4px solid #B91C1C;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 14px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="badge" style="background: rgba(185, 28, 28, 0.15); color: #EF4444; border: 1px solid rgba(185, 28, 28, 0.3); font-weight: 700;">
                <i data-lucide="landmark" style="width: 12px; height: 12px;"></i>
                ${queryType.includes("SISBAJUD") ? "SISBAJUD JUDICIAL" : queryType.includes("BACEN") ? "BACEN SPI" : "CHAVE PIX"}
              </span>
              <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--color-text-dim);">
                ${responseData.path || "/api/v1/pix"}
              </span>
            </div>
            <h2 style="font-size: 1.35rem; font-weight: 800; color: var(--color-text); margin-top: 6px;">
              ${holder}
            </h2>
            <div style="display: flex; align-items: center; gap: 10px; margin-top: 4px; font-family: var(--font-mono); font-size: 0.85rem; color: var(--color-text-muted);">
              <span>Doc: <strong style="color: var(--color-text);">${formattedDoc}</strong></span>
              ${rawDoc.length === 11 ? `<button type="button" class="btn-action-puxar btn-puxar-cpf" data-cpf="${rawDoc}"><i data-lucide="user-search" style="width: 12px; height: 12px;"></i> Dossiê CPF</button>` : ""}
            </div>
          </div>

          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button type="button" class="btn btn-outline btn-copiar-resumo-dossie" data-resumo="${pixSummaryText}" style="font-size: 0.75rem; padding: 6px 12px; gap: 6px;">
              <i data-lucide="copy" style="width: 13px; height: 13px;"></i>
              <span>Copiar Resumo</span>
            </button>
            <button type="button" class="btn btn-outline btn-imprimir-dossie" style="font-size: 0.75rem; padding: 6px 12px; gap: 6px;">
              <i data-lucide="printer" style="width: 13px; height: 13px;"></i>
              <span>Imprimir</span>
            </button>
          </div>
        </div>

        <!-- BANNER ESPECÍFICO DO TIPO PIX SELECIONADO -->
        ${
          pixTypeInfo
            ? `
          <div style="background: var(--color-surface-2); border: 1px solid var(--color-border); border-left: 4px solid ${pixTypeInfo.textColor}; border-radius: var(--radius-md); padding: 10px 14px; margin-top: 14px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span class="badge" style="background: ${pixTypeInfo.badgeColor}; color: ${pixTypeInfo.textColor}; border: 1px solid ${pixTypeInfo.textColor}; font-weight: 700; font-size: 0.75rem;">
                <i data-lucide="${pixTypeInfo.icon}" style="width: 12px; height: 12px;"></i>
                ${pixTypeInfo.label}
              </span>
              <span style="font-family: var(--font-mono); font-weight: 700; color: var(--color-text); font-size: 0.95rem;">
                ${pixTypeInfo.formattedTerm}
              </span>
            </div>
            <button type="button" class="btn-action-copy btn-copiar-texto" data-copy="${queriedTerm}" title="Copiar Parâmetro Consultado">
              <i data-lucide="copy" style="width: 12px; height: 12px;"></i> Copiar
            </button>
          </div>
        `
            : ""
        }

        <!-- KPIS FINANCEIROS -->
        <div class="zeroy-kpi-bar" style="margin-top: var(--space-4); margin-bottom: 0;">
          <div class="zeroy-kpi-item">
            <div class="zeroy-kpi-icon" style="background: rgba(185, 28, 28, 0.15); color: #EF4444;">
              <i data-lucide="key" style="width: 20px; height: 20px;"></i>
            </div>
            <div class="zeroy-kpi-info">
              <span class="zeroy-kpi-label">Chaves PIX</span>
              <span class="zeroy-kpi-value">${totalKeys}</span>
            </div>
          </div>

          <div class="zeroy-kpi-item">
            <div class="zeroy-kpi-icon" style="background: rgba(59, 130, 246, 0.15); color: #3B82F6;">
              <i data-lucide="building" style="width: 20px; height: 20px;"></i>
            </div>
            <div class="zeroy-kpi-info">
              <span class="zeroy-kpi-label">Instituições / Contas</span>
              <span class="zeroy-kpi-value">${accounts.length}</span>
            </div>
          </div>

          <div class="zeroy-kpi-item">
            <div class="zeroy-kpi-icon" style="background: rgba(16, 185, 129, 0.15); color: #10B981;">
              <i data-lucide="shield-check" style="width: 20px; height: 20px;"></i>
            </div>
            <div class="zeroy-kpi-info">
              <span class="zeroy-kpi-label">Status Bacen SPI</span>
              <span class="zeroy-kpi-value" style="font-size: 0.95rem; color: #10B981;">ATIVO / LOCALIZADO</span>
            </div>
          </div>
        </div>
      </div>

      <!-- LISTAGEM DE CONTAS E CHAVES PIX -->
      <div style="display: flex; flex-direction: column; gap: var(--space-4);">
        ${
          accounts.length === 0
            ? `
          <div class="card" style="text-align: center; padding: 32px 16px;">
            <i data-lucide="alert-circle" style="width: 32px; height: 32px; color: #F59E0B; margin-bottom: 8px;"></i>
            <h4 style="color: var(--color-text);">Nenhuma conta vinculada localizada</h4>
            <p style="color: var(--color-text-muted); font-size: 0.85rem;">Não foram encontradas chaves PIX ou relacionamentos bancários para o termo informado.</p>
          </div>
        `
            : accounts
                .map((acc, idx) => {
                  const bankName =
                    acc.banco ||
                    acc.instituicao ||
                    acc.nomeBanco ||
                    `Instituição #${idx + 1}`;
                  const branch = acc.agencia || "0001";
                  const accountNumber = acc.conta || acc.numeroConta || "Não informada";
                  const accountType = acc.tipoConta || acc.tipo || "CONTA DE PAGAMENTO";
                  const ispb = acc.ispb ? `ISPB: ${acc.ispb}` : "";
                  const openingDate =
                    acc.dataAbertura || acc.criacao
                      ? Formatters.date(acc.dataAbertura || acc.criacao)
                      : null;

                  let keyList = [];
                  if (Array.isArray(acc.chaves)) {
                    keyList = acc.chaves;
                  } else if (acc.chave || acc.chavePix) {
                    keyList = [
                      {
                        tipo: acc.tipoChave || "CHAVE",
                        chave: acc.chave || acc.chavePix,
                        dataCriacao: acc.dataCriacao || acc.criacao || null,
                      },
                    ];
                  }

                  return `
            <div class="card" style="border: 1px solid var(--color-border); background: var(--color-surface);">
              <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; padding-bottom: 12px; border-bottom: 1px solid var(--color-border);">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <div style="width: 38px; height: 38px; border-radius: var(--radius-md); background: rgba(185, 28, 28, 0.12); color: #EF4444; display: flex; align-items: center; justify-content: center;">
                    <i data-lucide="landmark" style="width: 20px; height: 20px;"></i>
                  </div>
                  <div>
                    <h4 style="font-size: 1rem; font-weight: 700; color: var(--color-text); margin: 0;">${bankName}</h4>
                    <span style="font-size: 0.75rem; color: var(--color-text-dim); font-family: var(--font-mono);">${ispb}</span>
                  </div>
                </div>

                <div style="display: flex; align-items: center; gap: 8px;">
                  <span class="badge" style="background: rgba(59, 130, 246, 0.12); color: #60A5FA; border: 1px solid rgba(59, 130, 246, 0.25); font-size: 0.72rem;">
                    ${accountType}
                  </span>
                  <span class="badge" style="background: rgba(16, 185, 129, 0.12); color: #34D399; border: 1px solid rgba(16, 185, 129, 0.25); font-size: 0.72rem;">
                    Agência: ${branch} &bull; Conta: ${accountNumber}
                  </span>
                </div>
              </div>

              <div style="padding-top: 14px;">
                <span style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: var(--color-text-muted); letter-spacing: 0.5px; display: block; margin-bottom: 8px;">
                  Chaves PIX Registradas (${keyList.length}):
                </span>

                ${
                  keyList.length === 0
                    ? `
                  <p style="font-size: 0.85rem; color: var(--color-text-dim);">Conta identificada sem chaves detalhadas ou com relacionamento ativo no Bacen.</p>
                `
                    : `
                  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px;">
                    ${keyList
                      .map((k) => {
                        const keyValue =
                          typeof k === "string"
                            ? k
                            : k.chave || k.valor || JSON.stringify(k);
                        const keyType =
                          typeof k === "object" && k.tipo
                            ? k.tipo
                            : keyValue.includes("@")
                              ? "EMAIL"
                              : keyValue.includes("-") && keyValue.length > 20
                                ? "EVP"
                                : "CHAVE";
                        const keyDate = k.dataCriacao
                          ? Formatters.date(k.dataCriacao)
                          : openingDate || "";

                        const cleanTermDigits = queriedTerm.replace(/\D/g, "");
                        const cleanKeyDigits = String(keyValue).replace(/\D/g, "");
                        const isMatch = Boolean(
                          queriedTerm &&
                          (String(keyValue).trim().toLowerCase() ===
                            queriedTerm.trim().toLowerCase() ||
                            (cleanTermDigits.length >= 10 && cleanTermDigits === cleanKeyDigits))
                        );

                        const cardStyle = isMatch
                          ? "background: rgba(16, 185, 129, 0.08); border: 2px solid #10B981; box-shadow: 0 0 14px rgba(16, 185, 129, 0.25);"
                          : "background: var(--color-surface-2); border: 1px solid var(--color-border);";

                        return `
                        <div style="${cardStyle} border-radius: var(--radius-md); padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                          <div style="overflow: hidden;">
                            <div style="display: flex; align-items: center; gap: 6px;">
                              <span style="font-size: 0.65rem; font-weight: 800; background: rgba(185, 28, 28, 0.15); color: #EF4444; padding: 1px 6px; border-radius: 4px; font-family: var(--font-mono);">
                                ${keyType}
                              </span>
                              ${
                                isMatch
                                  ? `
                                <span style="font-size: 0.65rem; font-weight: 800; background: rgba(16, 185, 129, 0.2); color: #10B981; padding: 1px 6px; border-radius: 4px; font-family: var(--font-mono);">
                                  ✓ CHAVE CONSULTADA
                                </span>
                              `
                                  : ""
                              }
                              ${keyDate ? `<span style="font-size: 0.7rem; color: var(--color-text-dim);">Criada em: ${keyDate}</span>` : ""}
                            </div>
                            <div style="font-family: var(--font-mono); font-weight: 700; font-size: 0.875rem; color: ${isMatch ? "#6EE7B7" : "var(--color-text)"}; margin-top: 4px; word-break: break-all;">
                              ${keyValue}
                            </div>
                          </div>
                          <button type="button" class="btn-action-copy btn-copiar-texto" data-copy="${keyValue}" title="Copiar Chave PIX" style="flex-shrink: 0;">
                            <i data-lucide="copy" style="width: 13px; height: 13px;"></i>
                          </button>
                        </div>
                      `;
                      })
                      .join("")}
                  </div>
                `
                }
              </div>
            </div>
          `;
                })
                .join("")
        }
      </div>
    `;
  },
};

// Backward compatibility alias
export const PixFinanceiroInterpreter = FinancialPixInterpreter;
