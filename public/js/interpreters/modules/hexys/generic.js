/**
 * ==============================================================================
 * HEXYS API INTERPRETER - GENERIC OBJECT (GENERIC.JS)
 * Elegant and robust visual fallback for unmapped or nested response objects.
 * Features:
 *  - Humanized labels (Title Case & Brazilian Portuguese acronyms)
 *  - Automatic exclusion of redundant internal debug blobs (raw, resultado wrapper)
 *  - Interactive chips and structured mini-cards for nested arrays/objects
 *  - One-click copy buttons and telephone links
 * ==============================================================================
 */

import { escapeHtml, Formatters } from "../../utils.js";

/**
 * Converte chaves técnicas (camelCase/snake_case) em rótulos legíveis
 * @param {string} key
 * @returns {string}
 */
function humanizeKey(key) {
  const customLabels = {
    cpf: "CPF",
    cnpj: "CNPJ",
    rg: "RG",
    cnh: "CNH",
    cns: "CNS",
    nis: "NIS",
    pis: "PIS",
    pasep: "PASEP",
    oab: "OAB",
    cep: "CEP",
    uf: "UF",
    ddd: "DDD",
    nome: "Nome Completo",
    name: "Nome Completo",
    titularNome: "Nome do Titular",
    titularCpf: "CPF do Titular",
    numeroConsultado: "Número Consultado",
    dataNascimento: "Data de Nascimento",
    data_nascimento: "Data de Nascimento",
    nascimento: "Data de Nascimento",
    sexo: "Sexo",
    genero: "Gênero",
    nomeMae: "Nome da Mãe",
    nomePai: "Nome do Pai",
    estadoCivil: "Estado Civil",
    situacaoCadastral: "Situação Cadastral",
    totalTelefones: "Total de Telefones",
    totalEnderecos: "Total de Endereços",
    totalParentes: "Total de Parentes",
    totalVeiculos: "Total de Veículos",
    totalVacinas: "Total de Doses Vacinais",
    operadora: "Operadora Telefônica",
    tipoLinha: "Tipo de Linha",
    renda: "Renda Estimada",
    faixaRenda: "Faixa de Renda",
    score: "Score de Crédito",
    mosaic: "Classificação Mosaic",
    profissao: "Profissão / Ocupação",
    cbo: "Código CBO",
    nacionalidade: "Nacionalidade",
    portabilidade: "Portabilidade Numérica",
  };

  if (customLabels[key]) return customLabels[key];

  return key
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Renderiza um valor primitivo com formatação rica e botão de cópia
 * @param {any} val
 * @param {string} key
 * @returns {string} HTML markup
 */
function renderScalarValue(val, key) {
  if (val === null || val === undefined || val === "") {
    return `<span style="color: var(--color-text-dim); font-size: 0.8125rem;">Não informado</span>`;
  }

  if (typeof val === "boolean") {
    return val
      ? `<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10B981; font-weight: 700;">SIM</span>`
      : `<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #EF4444; font-weight: 700;">NÃO</span>`;
  }

  const str = String(val).trim();
  const lowerKey = key.toLowerCase();

  // Detecção e formatação de CPF
  if (lowerKey.includes("cpf") && /^\d{11}$/.test(str)) {
    const formatted = Formatters.cpf(str);
    return `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-family: var(--font-mono); font-weight: 700; color: #6EE7B7;">${escapeHtml(formatted)}</span>
        <button type="button" class="btn btn-ghost btn-sm btn-copiar-texto" data-copy="${escapeHtml(str)}" title="Copiar CPF" style="padding: 2px 6px;">
          <i data-lucide="copy" style="width: 12px; height: 12px;"></i>
        </button>
      </div>
    `;
  }

  // Detecção e formatação de Telefone
  if ((lowerKey.includes("telefone") || lowerKey.includes("celular") || lowerKey.includes("numero")) && /^\d{10,11}$/.test(str)) {
    const formatted = Formatters.phone("", str);
    return `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-family: var(--font-mono); font-weight: 700; color: #93C5FD;">${escapeHtml(formatted)}</span>
        <a href="https://wa.me/55${str}" target="_blank" rel="noopener noreferrer" class="btn btn-ghost btn-sm" title="Abrir WhatsApp" style="padding: 2px 6px; color: #22C55E;">
          <i data-lucide="message-circle" style="width: 13px; height: 13px;"></i>
        </a>
        <button type="button" class="btn btn-ghost btn-sm btn-copiar-texto" data-copy="${escapeHtml(str)}" title="Copiar Telefone" style="padding: 2px 6px;">
          <i data-lucide="copy" style="width: 12px; height: 12px;"></i>
        </button>
      </div>
    `;
  }

  return `
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
      <span style="word-break: break-word;">${escapeHtml(str)}</span>
      ${str.length > 3 ? `<button type="button" class="btn btn-ghost btn-sm btn-copiar-texto" data-copy="${escapeHtml(str)}" title="Copiar" style="padding: 1px 5px; opacity: 0.6;"><i data-lucide="copy" style="width: 11px; height: 11px;"></i></button>` : ""}
    </div>
  `;
}

/**
 * Renderiza um item de array em formato de cartão limpo
 * @param {Object} item
 * @param {number} idx
 * @returns {string} HTML markup
 */
function renderArrayItemCard(item, idx) {
  if (typeof item !== "object" || item === null) {
    return `<div class="badge badge-dark" style="margin: 3px; font-size: 0.8rem;">${escapeHtml(String(item))}</div>`;
  }

  // 1. Sub-card para endereço
  if (item.logradouro || item.rua || item.cep || item.bairro || item.cidade) {
    const logr = item.logradouro || item.rua || "Logradouro";
    const num = item.numero || item.LOGR_NUMERO || "S/N";
    const compl = item.complemento || item.LOGR_COMPLEMENTO ? ` (${item.complemento || item.LOGR_COMPLEMENTO})` : "";
    const bairro = item.bairro ? ` - Bairro ${item.bairro}` : "";
    const cidade = item.cidade ? `, ${item.cidade}` : "";
    const uf = item.uf ? `/${item.uf}` : "";
    const cep = item.cep ? ` • CEP ${item.cep}` : "";
    const full = `${logr}, ${num}${compl}${bairro}${cidade}${uf}${cep}`;
    return `
      <div style="background: var(--color-surface); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--color-border); display: flex; align-items: center; justify-content: space-between; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 8px; font-size: 0.8125rem; color: var(--color-text);">
          <i data-lucide="map-pin" style="width: 14px; height: 14px; color: #10B981; flex-shrink: 0;"></i>
          <span>${escapeHtml(full)}</span>
        </div>
        <button type="button" class="btn btn-ghost btn-sm btn-copiar-texto" data-copy="${escapeHtml(full)}" title="Copiar Endereço" style="padding: 2px 5px; flex-shrink: 0;">
          <i data-lucide="copy" style="width: 12px; height: 12px;"></i>
        </button>
      </div>
    `;
  }

  // 2. Sub-card para telefone
  if (item.telefone || (item.numero && (item.operadora || item.ddd || String(item.numero).replace(/\D/g, "").length >= 8))) {
    const num = item.numero || item.telefone;
    const numLimpo = item.numeroLimpo || String(num).replace(/\D/g, "");
    const operadora = item.operadora || "Telefonia";
    const tipo = item.tipo || "Móvel";
    return `
      <div style="background: var(--color-surface); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--color-border); display: flex; align-items: center; justify-content: space-between; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <i data-lucide="phone" style="width: 14px; height: 14px; color: #38BDF8;"></i>
          <span style="font-family: var(--font-mono); font-weight: 700; color: var(--color-text); font-size: 0.875rem;">${escapeHtml(num)}</span>
          <span class="badge" style="background: rgba(56, 189, 248, 0.12); color: #38BDF8; font-size: 0.7rem;">${escapeHtml(operadora)} • ${escapeHtml(tipo)}</span>
        </div>
        <div style="display: flex; gap: 4px;">
          <a href="https://wa.me/55${numLimpo}" target="_blank" rel="noopener noreferrer" class="btn btn-ghost btn-sm" title="WhatsApp" style="padding: 2px 5px; color: #22C55E;">
            <i data-lucide="message-circle" style="width: 13px; height: 13px;"></i>
          </a>
          <button type="button" class="btn btn-ghost btn-sm btn-copiar-texto" data-copy="${escapeHtml(numLimpo)}" title="Copiar" style="padding: 2px 5px;">
            <i data-lucide="copy" style="width: 12px; height: 12px;"></i>
          </button>
        </div>
      </div>
    `;
  }

  // Formato genérico para outros objetos
  const subEntries = Object.entries(item).filter(([k, v]) => v !== null && v !== undefined && v !== "");
  return `
    <div style="background: var(--color-surface); padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--color-border); font-size: 0.8125rem;">
      <div style="font-weight: 700; color: #A78BFA; margin-bottom: 6px; font-size: 0.75rem;">REGISTRO #${idx + 1}</div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 6px;">
        ${subEntries
          .map(([k, v]) => `
            <div>
              <span style="font-size: 0.7rem; color: var(--color-text-dim); text-transform: uppercase;">${escapeHtml(humanizeKey(k))}:</span>
              <div style="color: var(--color-text); font-weight: 600;">${typeof v === "object" ? escapeHtml(JSON.stringify(v)) : escapeHtml(String(v))}</div>
            </div>
          `)
          .join("")}
      </div>
    </div>
  `;
}

export const GenericInterpreter = {
  /**
   * Renderiza resposta estruturada genérica
   * @param {Object} responseData - Metadados da consulta
   * @param {Object} dataPayload - Dados da consulta
   * @returns {string} HTML markup
   */
  render(responseData, dataPayload) {
    const data = dataPayload || {};
    const IGNORED_ROOT_KEYS = new Set([
      "resultado",
      "resultados",
      "raw",
      "cached",
      "timestamp",
      "remainingCredits",
      "fonte",
      "status",
      "success",
      "tipo",
      "type",
    ]);

    const entries = Object.entries(data).filter(([k]) => !IGNORED_ROOT_KEYS.has(k));

    if (entries.length === 0) {
      // Se apenas sobrou resultado ou raw, tente extrair
      const fallbackObj = data.resultado || data.raw || {};
      const fallbackEntries = Object.entries(fallbackObj).filter(([k]) => !IGNORED_ROOT_KEYS.has(k));
      if (fallbackEntries.length === 0) {
        return `
          <div class="card" style="text-align: center; padding: var(--space-8);">
            <i data-lucide="info" style="width: 32px; height: 32px; color: #60A5FA; margin-bottom: 8px;"></i>
            <h3 style="font-size: 1.1rem; font-weight: 600;">Consulta Concluída</h3>
            <p style="color: var(--color-text-muted); font-size: 0.85rem;">Resposta recebida com sucesso da base de dados.</p>
          </div>
        `;
      }
      return this.render(responseData, fallbackObj);
    }

    // Separa dados em escalares (campos simples) e listas/sub-objetos
    const scalars = entries.filter(([, v]) => typeof v !== "object" || v === null);
    const complex = entries.filter(([, v]) => typeof v === "object" && v !== null);

    return `
      <div class="card" style="margin-bottom: var(--space-4); border-top: 4px solid var(--color-primary);">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <h3 class="card-title" style="display: flex; align-items: center; gap: 8px; margin: 0;">
            <i data-lucide="layers" style="color: var(--color-primary); width: 18px; height: 18px;"></i>
            <span>Resultado Estruturado da Consulta</span>
          </h3>
          <span class="badge badge-dark" style="font-family: var(--font-mono); font-size: 0.72rem;">
            ${escapeHtml(responseData?.tipo || responseData?.type || "DADOS")}
          </span>
        </div>

        <!-- 1. Grid de Campos Escalares -->
        ${
          scalars.length > 0
            ? `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; margin-top: var(--space-3);">
            ${scalars
              .map(([k, v]) => `
                <div style="background: var(--color-surface-2); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
                  <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; font-family: var(--font-mono); display: block; margin-bottom: 4px;">
                    ${escapeHtml(humanizeKey(k))}
                  </span>
                  <div style="font-weight: 600; color: var(--color-text); font-size: 0.875rem;">
                    ${renderScalarValue(v, k)}
                  </div>
                </div>
              `)
              .join("")}
          </div>
        `
            : ""
        }

        <!-- 2. Seções de Listas e Objetos Complexos -->
        ${
          complex.length > 0
            ? `
          <div style="display: flex; flex-direction: column; gap: 14px; margin-top: var(--space-4);">
            ${complex
              .map(([k, v]) => {
                const label = humanizeKey(k);
                if (Array.isArray(v)) {
                  if (v.length === 0) return "";
                  return `
                    <div style="background: var(--color-surface-2); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
                      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                        <span style="font-size: 0.8125rem; font-weight: 700; color: #A78BFA; text-transform: uppercase;">
                          ${escapeHtml(label)} (${v.length})
                        </span>
                      </div>
                      <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${v.map((item, idx) => renderArrayItemCard(item, idx)).join("")}
                      </div>
                    </div>
                  `;
                }

                // Objeto simples não-nulo
                const subEntries = Object.entries(v).filter(([subK, subV]) => subV !== null && subV !== undefined && subV !== "" && !IGNORED_ROOT_KEYS.has(subK));
                if (subEntries.length === 0) return "";
                return `
                  <div style="background: var(--color-surface-2); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
                    <div style="font-size: 0.8125rem; font-weight: 700; color: #A78BFA; text-transform: uppercase; margin-bottom: 10px;">
                      ${escapeHtml(label)}
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px;">
                      ${subEntries
                        .map(([subK, subV]) => `
                          <div style="background: var(--color-surface); padding: 8px 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
                            <span style="font-size: 0.7rem; color: var(--color-text-dim); text-transform: uppercase; display: block;">${escapeHtml(humanizeKey(subK))}:</span>
                            <div style="color: var(--color-text); font-weight: 600; font-size: 0.8125rem; margin-top: 2px;">
                              ${renderScalarValue(subV, subK)}
                            </div>
                          </div>
                        `)
                        .join("")}
                    </div>
                  </div>
                `;
              })
              .join("")}
          </div>
        `
            : ""
        }
      </div>
    `;
  },
};
