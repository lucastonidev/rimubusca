/**
 * ==============================================================================
 * ZEROY API INTERPRETER - TELEPHONY & LINE REGISTRY (PHONE.JS)
 * Decodes operator data, titular name and CPF/CNPJ, line status (active/inactive),
 * portability history, installation address, and 1-click WhatsApp Web redirect.
 * Standardized with Clean Code principles and English naming.
 * ==============================================================================
 */

import { Formatters, escapeHtml } from "../../utils.js";

function cleanZeroyPhoneVal(val) {
  if (val === null || val === undefined) return "";
  const s = String(val).trim();
  const up = s.replace(/[()]/g, "").trim().toUpperCase();
  if (
    up === "" ||
    up === "N/I" ||
    up === "N/A" ||
    up === "SEM RESULTADO" ||
    up === "NULL" ||
    up === "NONE" ||
    up === "NAO INFORMADO" ||
    up === "NÃO INFORMADO" ||
    up === "TITULAR NÃO INFORMADO" ||
    up === "OPERADORA NÃO INFORMADA"
  ) {
    return "";
  }
  return s;
}

export const PhoneInterpreter = {
  /**
   * Renders telephone carrier and line details from Zeroy API response
   * @param {Object} responseData Top-level response metadata
   * @param {Object} dataPayload Unwrapped data object or array
   * @returns {string} HTML markup
   */
  render(responseData, dataPayload) {
    const payload = dataPayload?.data || dataPayload?.dados || dataPayload || {};
    const record = Array.isArray(payload) ? payload[0] || {} : payload;

    const rawTerm = String(responseData?.termo || record?.telefone || "").replace(/\D/g, "");
    const areaCode =
      record.ddd || (rawTerm.length >= 10 ? rawTerm.slice(0, 2) : "");
    const phoneNumber =
      record.numero ||
      record.telefone ||
      (rawTerm.length >= 10 ? rawTerm.slice(2) : rawTerm);
    const formattedPhone = Formatters.phone(areaCode || "N/I", phoneNumber);
    const fullPhoneDigits = `${areaCode}${phoneNumber}`.replace(/\D/g, "");

    const rawHolder = cleanZeroyPhoneVal(
      (typeof record.titular === "object" ? record.titular?.nome : record.titular) ||
      record.nome ||
      record.razaoSocial ||
      record.cliente
    );

    const rawDoc = String(
      record.cpf ||
      record.cnpj ||
      record.documento ||
      (typeof record.titular === "object" ? (record.titular?.cpf || record.titular?.documento) : "") ||
      ""
    ).replace(/\D/g, "");

    const rawCarrier = cleanZeroyPhoneVal(record.operadora || record.prestadora || record.provedor);
    const rawRegion = cleanZeroyPhoneVal(record.uf || record.estado || record.cidade);
    const rawActivation = cleanZeroyPhoneVal(record.dataAtivacao || record.instalacao || record.data);

    const isEmptyRecord =
      Boolean(responseData?.notFound || dataPayload?.notFound || payload?.notFound || record?.notFound) ||
      (Array.isArray(payload) && payload.length === 0) ||
      (!rawHolder && !rawDoc && !rawCarrier && !rawRegion && !rawActivation);

    if (isEmptyRecord) {
      const targetPhone = formattedPhone && formattedPhone !== "N/I" ? formattedPhone : (responseData?.termo || "");
      return `
        <div class="card osint-empty-card osint-empty-card--purple">
          <div class="osint-empty-icon osint-empty-icon--warning">
            <i data-lucide="phone-off" class="icon-xl"></i>
          </div>
          <h3 class="osint-empty-title">Nenhum Dado Encontrado</h3>
          <p class="osint-empty-desc">
            Não foi localizado nenhum registro de titular, operadora ou vínculo cadastral ${targetPhone ? `para o número <strong>${escapeHtml(targetPhone)}</strong> ` : ""}na base da Zeroy API.
          </p>
        </div>
      `;
    }

    const holder = rawHolder || "Titular Não Informado";

    const formattedDoc =
      rawDoc.length === 14
        ? Formatters.cnpj(rawDoc)
        : rawDoc.length === 11
          ? Formatters.cpf(rawDoc)
          : rawDoc || "Não informado";

    const carrier = (rawCarrier || "Operadora Não Informada").toUpperCase();

    const lineType =
      record.tipoLinha ||
      record.tipo ||
      (phoneNumber.length === 9 && phoneNumber.startsWith("9")
        ? "MÓVEL (CELULAR)"
        : "FIXO");

    const lineStatus = record.status || record.situacao || "ATIVA";
    const portability = record.portabilidade || record.portado || null;
    const donorCarrier =
      record.operadoraOrigem || record.operadoraDoadora || null;
    const region = rawRegion || "N/I";
    const activationDate = rawActivation
      ? Formatters.date(
          record.dataAtivacao || record.instalacao || record.data
        )
      : null;

    const isMobile =
      fullPhoneDigits.length === 11 ||
      (phoneNumber.length === 9 && phoneNumber.startsWith("9"));
    const whatsAppLink = isMobile ? `https://wa.me/55${fullPhoneDigits}` : null;

    const phoneSummaryText = encodeURIComponent(
      [
        `=== RIMUBUSCA - CONSULTA TELEFÔNICA ===`,
        `TELEFONE: ${formattedPhone}`,
        `TITULAR: ${holder}`,
        rawDoc ? `DOCUMENTO: ${formattedDoc}` : null,
        `OPERADORA: ${carrier}`,
        `TIPO: ${lineType}`,
        `STATUS: ${lineStatus}`,
        portability
          ? `PORTABILIDADE: Sim (Origem: ${donorCarrier || "N/A"})`
          : null,
        `UF/REGIÃO: ${region}`,
        `CONSULTA EM: ${new Date().toLocaleString("pt-BR")}`,
      ]
        .filter(Boolean)
        .join("\n")
    );

    return `
      <div class="card" style="margin-bottom: var(--space-4); border-top: 4px solid #F59E0B;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 14px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.3); font-weight: 700;">
                <i data-lucide="phone-call" style="width: 12px; height: 12px;"></i>
                ${carrier}
              </span>
              <span class="badge" style="background: rgba(16, 185, 129, 0.12); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.25); font-weight: 700;">
                ${String(lineStatus).toUpperCase()}
              </span>
              <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--color-text-dim);">
                ${responseData.path || "/api/v1/telefone"}
              </span>
            </div>
            <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--color-text); margin-top: 8px; font-family: var(--font-mono); letter-spacing: 0.5px;">
              ${formattedPhone}
            </h2>
            <div style="font-size: 0.9rem; color: var(--color-text-muted); margin-top: 4px; display: flex; align-items: center; gap: 8px;">
              <span>Titular: <strong style="color: var(--color-text);">${holder}</strong></span>
              ${rawDoc.length === 11 ? `<button type="button" class="btn-action-puxar btn-puxar-cpf" data-cpf="${rawDoc}"><i data-lucide="user-search" style="width: 12px; height: 12px;"></i> Dossiê CPF</button>` : ""}
            </div>
          </div>

          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${
              whatsAppLink
                ? `
              <a href="${whatsAppLink}" target="_blank" rel="noopener noreferrer" class="btn" style="background: #25D366; color: #FFFFFF; font-size: 0.75rem; padding: 6px 12px; gap: 6px; text-decoration: none; border-radius: var(--radius-sm); font-weight: 600; display: inline-flex; align-items: center;">
                <i data-lucide="message-circle" style="width: 14px; height: 14px;"></i>
                <span>WhatsApp</span>
              </a>
            `
                : ""
            }
            <button type="button" class="btn btn-outline btn-copiar-resumo-dossie" data-resumo="${phoneSummaryText}" style="font-size: 0.75rem; padding: 6px 12px; gap: 6px;">
              <i data-lucide="copy" style="width: 13px; height: 13px;"></i>
              <span>Copiar Resumo</span>
            </button>
            <button type="button" class="btn btn-outline btn-imprimir-dossie" style="font-size: 0.75rem; padding: 6px 12px; gap: 6px;">
              <i data-lucide="printer" style="width: 13px; height: 13px;"></i>
              <span>Imprimir</span>
            </button>
          </div>
        </div>

        <!-- KPIS TELEFÔNICOS -->
        <div class="zeroy-kpi-bar" style="margin-top: var(--space-4); margin-bottom: 0;">
          <div class="zeroy-kpi-item">
            <div class="zeroy-kpi-icon" style="background: rgba(245, 158, 11, 0.15); color: #F59E0B;">
              <i data-lucide="signal" style="width: 20px; height: 20px;"></i>
            </div>
            <div class="zeroy-kpi-info">
              <span class="zeroy-kpi-label">Operadora / Provedor</span>
              <span class="zeroy-kpi-value" style="font-size: 1rem;">${carrier}</span>
            </div>
          </div>

          <div class="zeroy-kpi-item">
            <div class="zeroy-kpi-icon" style="background: rgba(59, 130, 246, 0.15); color: #3B82F6;">
              <i data-lucide="smartphone" style="width: 20px; height: 20px;"></i>
            </div>
            <div class="zeroy-kpi-info">
              <span class="zeroy-kpi-label">Tipo de Linha</span>
              <span class="zeroy-kpi-value" style="font-size: 1rem;">${lineType}</span>
            </div>
          </div>

          <div class="zeroy-kpi-item">
            <div class="zeroy-kpi-icon" style="background: rgba(139, 92, 246, 0.15); color: #8B5CF6;">
              <i data-lucide="map-pin" style="width: 20px; height: 20px;"></i>
            </div>
            <div class="zeroy-kpi-info">
              <span class="zeroy-kpi-label">UF / Região do DDD</span>
              <span class="zeroy-kpi-value" style="font-size: 1rem;">DDD ${areaCode} (${region})</span>
            </div>
          </div>
        </div>
      </div>

      <!-- DETALHES CADASTRAIS DA LINHA -->
      <div class="card" style="margin-bottom: var(--space-4);">
        <div class="card-header">
          <h3 class="card-title" style="display: flex; align-items: center; gap: 8px;">
            <i data-lucide="file-text" style="color: #F59E0B; width: 18px; height: 18px;"></i>
            <span>Vínculo Cadastral & Portabilidade da Linha</span>
          </h3>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; font-size: 0.85rem;">
          <div>
            <span style="color: var(--color-text-muted); font-size: 0.75rem;">Nome Completo / Titular</span>
            <div style="font-weight: 700; color: var(--color-text); margin-top: 2px;">${holder}</div>
          </div>
          <div>
            <span style="color: var(--color-text-muted); font-size: 0.75rem;">Documento (CPF / CNPJ)</span>
            <div style="font-family: var(--font-mono); font-weight: 700; color: #10B981; margin-top: 2px;">${formattedDoc}</div>
          </div>
          <div>
            <span style="color: var(--color-text-muted); font-size: 0.75rem;">Portabilidade Cadastrada</span>
            <div style="font-weight: 700; color: ${portability ? "#F59E0B" : "var(--color-text)"}; margin-top: 2px;">
              ${portability ? `SIM ${donorCarrier ? `(Doadora: ${donorCarrier})` : ""}` : "NÃO / LINHA ORIGINAL"}
            </div>
          </div>
          ${
            activationDate
              ? `
            <div>
              <span style="color: var(--color-text-muted); font-size: 0.75rem;">Data de Ativação / Registro</span>
              <div style="font-weight: 700; color: #60A5FA; margin-top: 2px;">${activationDate}</div>
            </div>
          `
              : ""
          }
          ${
            record.endereco || record.logradouro
              ? `
            <div style="grid-column: 1 / -1; margin-top: 4px; padding-top: 8px; border-top: 1px dashed var(--color-border);">
              <span style="color: var(--color-text-muted); font-size: 0.75rem;">Endereço de Faturamento / Instalação:</span>
              <div style="color: var(--color-text); font-weight: 600; margin-top: 2px;">
                ${[record.endereco || record.logradouro, record.numero, record.bairro, record.cidade, record.uf].filter(Boolean).join(", ")}
              </div>
            </div>
          `
              : ""
          }
        </div>
      </div>
    `;
  },
};

// Backward compatibility alias
export const TelefoneInterpreter = PhoneInterpreter;
