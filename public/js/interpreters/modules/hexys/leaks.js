/**
 * ==============================================================================
 * RIMUBUSCA - HEXYS DEV INTERPRETER - LEAKS & CLOUD CREDENTIALS (LEAKS.JS)
 * Renderizador dedicado para vazamentos por domínio/URL, usuário e dumps
 * (cloud_url, cloud_usuario, dump_cpf, dump_email, dump_telefone).
 * ==============================================================================
 */

import { Formatters, escapeHtml } from "../../utils.js";

const INITIAL_PAGE_SIZE = 150;
const PAGE_STEP = 200;
const LEAKS_STORE = new WeakMap();

function cleanLeakText(val) {
  if (val === null || val === undefined) return "";
  const s = String(val).trim();
  const up = s.replace(/[()]/g, "").trim().toUpperCase();
  if (
    up === "" ||
    up === "SEM RESULTADO" ||
    up === "N/I" ||
    up === "N/A" ||
    up === "NULL" ||
    up === "NONE" ||
    up === "UNDEFINED"
  ) {
    return "";
  }
  return s;
}

function extractHostname(rawUrl) {
  if (!rawUrl) return "";
  try {
    const withProto = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    return new URL(withProto).hostname || "";
  } catch (_) {
    return String(rawUrl).split("/")[0] || "";
  }
}

function isSafeHttpUrl(rawUrl) {
  return /^https?:\/\/[^\s"'<>]+$/i.test(String(rawUrl || "").trim());
}

function extractLeakRecords(responseData, dataPayload) {
  const src = dataPayload || responseData?.dados || responseData || {};
  const listRaw = Array.isArray(src)
    ? src
    : Array.isArray(src.registros)
      ? src.registros
      : Array.isArray(src.resultado)
        ? src.resultado
        : Array.isArray(src.resultados)
          ? src.resultados
          : Array.isArray(src.vazamentos)
            ? src.vazamentos
            : [];

  return listRaw
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const url = cleanLeakText(item.url || item.URL || item.host || item.HOST || item.dominio || item.DOMINIO);
      const usuario = cleanLeakText(item.usuario || item.USUARIO || item.user || item.USER || item.login || item.LOGIN);
      const email = cleanLeakText(item.email || item.EMAIL);
      const senhaRaw = String(item.senha ?? item.SENHA ?? item.password ?? item.PASSWORD ?? "").trim();
      const senha = senhaRaw && senhaRaw.toUpperCase() !== "SEM RESULTADO" ? senhaRaw : "";
      const nome = cleanLeakText(item.nome || item.NOME);
      const cpfRaw = cleanLeakText(item.cpf || item.CPF);
      const cpf = cpfRaw ? (cpfRaw.replace(/\D/g, "").length === 11 ? Formatters.cpf(cpfRaw) : cpfRaw) : "";
      const telefone = cleanLeakText(item.telefone || item.TELEFONE);
      const origem = cleanLeakText(item.origem || item.ORIGEM);
      const data = cleanLeakText(item.data || item.DATA);
      const host = extractHostname(url);

      if (!url && !usuario && !email && !senha && !nome && !cpf && !telefone) {
        return null;
      }

      return {
        url,
        host,
        usuario,
        email,
        senha,
        nome,
        cpf,
        cpfDigits: cpfRaw.replace(/\D/g, ""),
        telefone,
        origem,
        data,
        searchText: `${url} ${host} ${usuario} ${email} ${senha} ${nome} ${cpf} ${telefone} ${origem}`.toLowerCase(),
      };
    })
    .filter(Boolean);
}

function renderLeakRowHtml(item, idx, cols) {
  const combo = item.usuario && item.senha
    ? `${item.usuario}:${item.senha}`
    : item.email && item.senha
      ? `${item.email}:${item.senha}`
      : "";

  const urlCell = cols.hasUrl
    ? `<td>
        ${
          item.url
            ? `<div class="osint-chip-row">
                ${
                  isSafeHttpUrl(item.url)
                    ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="osint-leak-url">
                        <i data-lucide="external-link" class="icon-xs"></i>
                        <span>${escapeHtml(item.url)}</span>
                      </a>`
                    : `<span class="osint-td-meta">${escapeHtml(item.url)}</span>`
                }
              </div>`
            : `<span class="osint-td-dim">-</span>`
        }
      </td>`
    : "";

  const userCell = cols.hasUsuario
    ? `<td>
        ${
          item.usuario
            ? `<div class="osint-td-cpf-wrap">
                <span class="osint-td-name">${escapeHtml(item.usuario)}</span>
                <button type="button" class="btn btn-ghost btn-copy-inline btn-copiar-texto" data-copy="${escapeHtml(item.usuario)}" title="Copiar Usuário">
                  <i data-lucide="copy" class="icon-xs"></i>
                </button>
              </div>`
            : `<span class="osint-td-dim">-</span>`
        }
      </td>`
    : "";

  const emailCell = cols.hasEmail
    ? `<td>
        ${
          item.email
            ? `<div class="osint-td-cpf-wrap">
                <span class="osint-td-meta">${escapeHtml(item.email)}</span>
                <button type="button" class="btn btn-ghost btn-copy-inline btn-copiar-texto" data-copy="${escapeHtml(item.email)}" title="Copiar E-mail">
                  <i data-lucide="copy" class="icon-xs"></i>
                </button>
              </div>`
            : `<span class="osint-td-dim">-</span>`
        }
      </td>`
    : "";

  const senhaCell = cols.hasSenha
    ? `<td>
        ${
          item.senha
            ? `<div class="osint-td-cpf-wrap">
                <span class="osint-leak-pass">${escapeHtml(item.senha)}</span>
                <button type="button" class="btn btn-ghost btn-copy-inline btn-copiar-texto" data-copy="${escapeHtml(item.senha)}" title="Copiar Senha">
                  <i data-lucide="copy" class="icon-xs"></i>
                </button>
              </div>`
            : `<span class="osint-td-dim">-</span>`
        }
      </td>`
    : "";

  const pessoaCell = cols.hasPessoa
    ? `<td>
        ${item.nome ? `<div class="osint-td-name">${escapeHtml(item.nome)}</div>` : ""}
        ${item.cpf ? `<div class="osint-td-cpf-val">${escapeHtml(item.cpf)}</div>` : ""}
        ${item.telefone ? `<div class="osint-td-meta">${escapeHtml(item.telefone)}</div>` : ""}
        ${!item.nome && !item.cpf && !item.telefone ? `<span class="osint-td-dim">-</span>` : ""}
      </td>`
    : "";

  const actionCell = `
    <td class="osint-td-right">
      <div class="osint-chip-row" style="justify-content: flex-end;">
        ${
          combo
            ? `<button type="button" class="btn btn-outline btn-xs btn-copiar-texto" data-copy="${escapeHtml(combo)}" title="Copiar usuário:senha">
                <i data-lucide="key" class="icon-xs"></i>
                <span>Combo</span>
              </button>`
            : ""
        }
        ${
          item.cpfDigits.length === 11
            ? `<button type="button" class="btn btn-primary btn-xs btn-puxar-cpf-item" data-cpf="${escapeHtml(item.cpfDigits)}" title="Investigar CPF">
                <i data-lucide="search" class="icon-xs"></i>
                <span>CPF</span>
              </button>`
            : ""
        }
      </div>
    </td>
  `;

  return `
    <tr>
      <td class="osint-td-index">${idx + 1}</td>
      ${urlCell}
      ${userCell}
      ${emailCell}
      ${senhaCell}
      ${pessoaCell}
      ${actionCell}
    </tr>
  `;
}

/**
 * Conecta busca em tempo real, pílulas e paginação incremental na tabela de vazamentos
 * @param {HTMLElement} container
 */
export function bindLeaksFilters(container) {
  if (!container) return;
  const section = container.querySelector("#osintLeaksSection");
  if (!section) return;

  const store = LEAKS_STORE.get(section) || window.__RIMU_LAST_LEAKS_STATE__;
  if (!store || !Array.isArray(store.records)) return;

  const textInput = section.querySelector("#inputFiltroVazamentos");
  const pills = section.querySelectorAll(".btn-filtro-leaks");
  const tbody = section.querySelector("#tabelaVazamentosBody");
  const counterEl = section.querySelector("#contadorVazamentos");
  const emptyEl = section.querySelector("#emptyStateFiltroVazamentos");
  const tableWrap = section.querySelector("#leaksTableWrap");
  const loadMoreBtn = section.querySelector("#btnCarregarMaisVazamentos");
  const showAllBtn = section.querySelector("#btnMostrarTodosVazamentos");
  const clearBtn = section.querySelector("#btnLimparFiltrosVazamentos");
  const footerWrap = section.querySelector("#leaksFooterControls");

  if (!tbody) return;

  let currentLimit = INITIAL_PAGE_SIZE;

  const renderFiltered = () => {
    const query = (textInput?.value || "").toLowerCase().trim();
    const activePill = section.querySelector(".btn-filtro-leaks.active");
    const filterType = activePill ? activePill.getAttribute("data-filter") : "todos";

    const filtered = store.records.filter((r) => {
      if (query && !r.searchText.includes(query)) return false;
      if (filterType === "com_email" && !r.email) return false;
      if (filterType === "com_senha" && !r.senha) return false;
      return true;
    });

    const visibleSlice = filtered.slice(0, currentLimit);
    tbody.innerHTML = visibleSlice
      .map((item, idx) => renderLeakRowHtml(item, idx, store.cols))
      .join("");

    if (counterEl) {
      counterEl.textContent = `Exibindo ${visibleSlice.length} de ${filtered.length}${filtered.length !== store.records.length ? ` (${store.records.length} no total)` : ""}`;
    }

    if (emptyEl) emptyEl.classList.toggle("is-hidden", filtered.length > 0);
    if (tableWrap) tableWrap.classList.toggle("is-hidden", filtered.length === 0);

    const remaining = filtered.length - visibleSlice.length;
    if (footerWrap) {
      footerWrap.classList.toggle("is-hidden", remaining <= 0);
    }
    if (loadMoreBtn && remaining > 0) {
      const nextBatch = Math.min(remaining, PAGE_STEP);
      loadMoreBtn.textContent = `Carregar +${nextBatch} registros (${remaining} restantes)`;
    }

    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons({ root: tbody });
    }
  };

  if (textInput) {
    textInput.addEventListener("input", () => {
      currentLimit = INITIAL_PAGE_SIZE;
      renderFiltered();
    });
  }

  pills.forEach((pill) => {
    pill.addEventListener("click", () => {
      pills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      currentLimit = INITIAL_PAGE_SIZE;
      renderFiltered();
    });
  });

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", () => {
      currentLimit += PAGE_STEP;
      renderFiltered();
    });
  }

  if (showAllBtn) {
    showAllBtn.addEventListener("click", () => {
      currentLimit = store.records.length;
      renderFiltered();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (textInput) textInput.value = "";
      pills.forEach((p) => p.classList.toggle("active", p.getAttribute("data-filter") === "todos"));
      currentLimit = INITIAL_PAGE_SIZE;
      renderFiltered();
    });
  }

  if (window.__RIMU_LAST_LEAKS_STATE__) {
    LEAKS_STORE.set(section, window.__RIMU_LAST_LEAKS_STATE__);
  }
}

export const LeaksInterpreter = {
  /**
   * Renderiza tabela filtrável de logs e credenciais vazadas (cloud_url, cloud_usuario, dump_*)
   * @param {Object} responseData
   * @param {Object|Array} dataPayload
   * @returns {string} HTML markup
   */
  render(responseData, dataPayload) {
    const records = extractLeakRecords(responseData, dataPayload);
    const queryType = String(responseData?.tipo || dataPayload?.tipo || "cloud_url").toLowerCase();
    const termo = cleanLeakText(responseData?.termo) || "Alvo Consultado";

    const typeLabels = {
      cloud_url: "VAZAMENTOS POR URL / DOMÍNIO",
      cloud_usuario: "VAZAMENTOS POR USUÁRIO",
      dump_cpf: "DUMP EM MASSA (CPF)",
      dump_email: "DUMP EM MASSA (E-MAIL)",
      dump_telefone: "DUMP EM MASSA (TELEFONE)",
    };

    if (records.length === 0 || responseData?.notFound || dataPayload?.notFound) {
      return `
        <div class="card osint-empty-card osint-empty-card--emerald">
          <div class="osint-empty-icon osint-empty-icon--emerald">
            <i data-lucide="shield-check" class="icon-xl"></i>
          </div>
          <h3 class="osint-empty-title">Nenhum Vazamento Localizado</h3>
          <p class="osint-empty-desc">
            Não foram encontradas credenciais, logs ou registros expostos associados a <strong>${escapeHtml(termo)}</strong> nas bases monitoradas.
          </p>
        </div>
      `;
    }

    const totalSenhas = records.filter((r) => r.senha).length;
    const totalEmails = records.filter((r) => r.email).length;
    const uniqueHosts = new Set(records.map((r) => r.host).filter(Boolean)).size;
    const uniqueUsers = new Set(records.map((r) => (r.usuario || r.email || r.cpf).toLowerCase()).filter(Boolean)).size;

    const cols = {
      hasUrl: records.some((r) => r.url),
      hasUsuario: records.some((r) => r.usuario),
      hasEmail: totalEmails > 0,
      hasSenha: totalSenhas > 0,
      hasPessoa: records.some((r) => r.nome || r.cpf || r.telefone),
    };

    if (typeof window !== "undefined") {
      window.__RIMU_LAST_LEAKS_STATE__ = { records, cols };
    }

    const initialSlice = records.slice(0, INITIAL_PAGE_SIZE);
    const remaining = records.length - initialSlice.length;

    return `
      <div class="osint-cep-kpi-grid">
        <div class="osint-cep-kpi">
          <span class="osint-cep-kpi-label">REGISTROS EXPOSTOS</span>
          <div class="osint-cep-kpi-val osint-kv-value--red">${records.length.toLocaleString("pt-BR")}</div>
          <span class="osint-cep-kpi-sub">${escapeHtml(typeLabels[queryType] || "LOGS & CREDENCIAIS")}</span>
        </div>

        ${
          totalSenhas > 0
            ? `<div class="osint-cep-kpi">
                <span class="osint-cep-kpi-label">SENHAS EM TEXTO CLARO</span>
                <div class="osint-cep-kpi-val osint-kv-value--amber">${totalSenhas.toLocaleString("pt-BR")}</div>
                <span class="osint-cep-kpi-sub">Credenciais expostas</span>
              </div>`
            : ""
        }

        ${
          uniqueHosts > 0
            ? `<div class="osint-cep-kpi">
                <span class="osint-cep-kpi-label">HOSTS / SUBDOMÍNIOS</span>
                <div class="osint-cep-kpi-val osint-cep-kpi-val--sky">${uniqueHosts.toLocaleString("pt-BR")}</div>
                <span class="osint-cep-kpi-sub">Domínios distintos</span>
              </div>`
            : ""
        }

        <div class="osint-cep-kpi">
          <span class="osint-cep-kpi-label">CONTAS ÚNICAS</span>
          <div class="osint-cep-kpi-val osint-cep-kpi-val--purple">${uniqueUsers.toLocaleString("pt-BR")}</div>
          <span class="osint-cep-kpi-sub">Usuários / identidades</span>
        </div>
      </div>

      <div id="osintLeaksSection" class="card osint-section-card osint-section-card--red">
        <div class="card-header osint-cep-residents-header">
          <h3 class="card-title">
            <i data-lucide="shield-alert" class="icon-md icon-red"></i>
            <span>${escapeHtml(typeLabels[queryType] || "Vazamentos & Credenciais")} (${records.length})</span>
          </h3>
          <span id="contadorVazamentos" class="osint-filter-counter">
            Exibindo ${initialSlice.length} de ${records.length}
          </span>
        </div>

        <div class="osint-filter-bar">
          <div class="osint-filter-inputs">
            <input
              type="text"
              id="inputFiltroVazamentos"
              class="input-filter-inline"
              placeholder="Filtrar nos ${records.length} registros por URL, usuário, e-mail ou senha..."
            >
          </div>
          <div class="osint-chip-row">
            <button type="button" class="btn-filtro-pill btn-filtro-leaks active" data-filter="todos">
              Todos (${records.length})
            </button>
            ${
              totalEmails > 0
                ? `<button type="button" class="btn-filtro-pill btn-filtro-leaks" data-filter="com_email">
                    Com E-mail (${totalEmails})
                  </button>`
                : ""
            }
            ${
              totalSenhas > 0
                ? `<button type="button" class="btn-filtro-pill btn-filtro-leaks" data-filter="com_senha">
                    Com Senha (${totalSenhas})
                  </button>`
                : ""
            }
          </div>
        </div>

        <div id="leaksTableWrap" class="table-responsive osint-table-scroll">
          <table class="osint-table" id="tabelaVazamentosRimu">
            <thead>
              <tr>
                <th class="osint-th-index">#</th>
                ${cols.hasUrl ? "<th>URL / Origem</th>" : ""}
                ${cols.hasUsuario ? "<th>Usuário</th>" : ""}
                ${cols.hasEmail ? "<th>E-mail</th>" : ""}
                ${cols.hasSenha ? "<th>Senha</th>" : ""}
                ${cols.hasPessoa ? "<th>Dados</th>" : ""}
                <th class="osint-th-action">Ação</th>
              </tr>
            </thead>
            <tbody id="tabelaVazamentosBody">
              ${initialSlice.map((item, idx) => renderLeakRowHtml(item, idx, cols)).join("")}
            </tbody>
          </table>
        </div>

        <div id="leaksFooterControls" class="osint-leak-footer ${remaining <= 0 ? "is-hidden" : ""}">
          <span class="osint-td-meta">Mostrando lote parcial para melhor desempenho. Use a busca acima para filtrar todos os ${records.length} registros.</span>
          <div class="osint-chip-row">
            <button type="button" id="btnCarregarMaisVazamentos" class="btn btn-outline btn-sm">
              Carregar +${Math.min(remaining, PAGE_STEP)} registros (${remaining} restantes)
            </button>
            <button type="button" id="btnMostrarTodosVazamentos" class="btn btn-primary btn-sm">
              Mostrar Todos
            </button>
          </div>
        </div>

        <div id="emptyStateFiltroVazamentos" class="osint-empty-card osint-empty-card--dashed is-hidden">
          <div class="osint-empty-icon osint-empty-icon--warning">
            <i data-lucide="filter-x" class="icon-xl"></i>
          </div>
          <h4 class="osint-empty-title">Nenhum registro corresponde ao filtro</h4>
          <p class="osint-empty-desc">Limpe ou altere o termo digitado para voltar a visualizar os vazamentos encontrados.</p>
          <div class="mt-4">
            <button type="button" id="btnLimparFiltrosVazamentos" class="btn btn-outline btn-sm">
              <i data-lucide="rotate-ccw" class="icon-xs"></i>
              Limpar Filtros
            </button>
          </div>
        </div>
      </div>
    `;
  },
};
