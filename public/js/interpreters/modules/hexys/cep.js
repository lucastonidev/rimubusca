/**
 * ==============================================================================
 * RIMUBUSCA - HEXYS DEV INTERPRETER - CEP & ENDEREÇOS (CEP.JS)
 * Renderizador semântico e higienizado para consultas de CEP, logradouros,
 * residentes vinculados (ENDERECO + DADOS) e filtragem avançada em tempo real.
 * ==============================================================================
 */

import { Formatters, escapeHtml } from "../../utils.js";

const UFS_BRASIL = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

function cleanAddressValue(val) {
  if (val === null || val === undefined) return "";
  const str = String(val).trim();
  if (!str) return "";
  const normalized = str.replace(/[()]/g, "").trim().toUpperCase();
  if (
    normalized === "" ||
    normalized === "SEM RESULTADO" ||
    normalized === "N/I" ||
    normalized === "N/" ||
    normalized === "N/A" ||
    normalized === "NULL" ||
    normalized === "NONE" ||
    normalized === "UNDEFINED" ||
    normalized === "NAO INFORMADO" ||
    normalized === "NÃO INFORMADO" ||
    normalized === "NAO INFORMADA" ||
    normalized === "NÃO INFORMADA" ||
    normalized === "-"
  ) {
    return "";
  }
  return str;
}

function resolveValidUf(val) {
  const clean = cleanAddressValue(val).toUpperCase().replace(/[^A-Z]/g, "");
  return UFS_BRASIL.has(clean) ? clean : "";
}

function normalizeResidentItem(m) {
  if (!m || typeof m !== "object") return null;
  const d = m.DADOS || m.dados || m;
  const endObj = m.ENDERECO || m.endereco || m.ENDERECOS?.[0] || m.enderecos?.[0] || {};

  const nome = cleanAddressValue(d.NOME || d.nome || m.nome || m.morador || m.name) || "N/I";
  const rawCpf = String(d.CPF || d.cpf || m.cpfLimpo || m.cpf || m.CPF || "").replace(/\D/g, "");
  const cpfFormatted =
    rawCpf.length === 11
      ? Formatters.cpf(rawCpf)
      : (cleanAddressValue(d.CPF || d.cpf || m.cpf || m.CPF) || "N/I");

  if (nome === "N/I" && cpfFormatted === "N/I") return null;

  const rawNumero =
    cleanAddressValue(
      m.numero ??
      m.LOGR_NUMERO ??
      m.logr_numero ??
      endObj.LOGR_NUMERO ??
      endObj.logr_numero ??
      endObj.NUMERO ??
      endObj.numero ??
      d.LOGR_NUMERO ??
      d.logr_numero ??
      d.numero
    ) || "S/N";
  const isSemNumero = /^s\/?n$/i.test(rawNumero);
  const numero = isSemNumero ? "S/N" : rawNumero;

  const complemento = cleanAddressValue(
    m.complemento ??
    m.LOGR_COMPLEMENTO ??
    m.logr_complemento ??
    endObj.LOGR_COMPLEMENTO ??
    endObj.logr_complemento ??
    endObj.COMPLEMENTO ??
    endObj.complemento ??
    d.LOGR_COMPLEMENTO ??
    d.complemento
  );

  return {
    nome,
    rawCpf,
    cpfFormatted,
    numero,
    complemento,
    hasNumero: !isSemNumero,
    hasComplemento: Boolean(complemento),
  };
}

function enrichResidentsFromRaw(rawResidents, rawPayload) {
  const rawList = Array.isArray(rawPayload)
    ? rawPayload
    : Array.isArray(rawPayload?.data)
      ? rawPayload.data
      : Array.isArray(rawPayload?.response)
        ? rawPayload.response
        : [];
  if (rawList.length === 0 || rawResidents.length === 0) return rawResidents;

  const needsMerge = rawResidents.some(
    (m) => m && !m.numero && !m.LOGR_NUMERO && !m.ENDERECO?.LOGR_NUMERO && !m.endereco?.LOGR_NUMERO
  );
  if (!needsMerge) return rawResidents;

  const usedIndices = new Set();

  return rawResidents.map((m, idx) => {
    if (!m || typeof m !== "object") return m;
    const mCpf = String(m.cpf || m.CPF || m.DADOS?.CPF || m.dados?.cpf || "").replace(/\D/g, "");
    let matchedRaw = null;

    const candidate = rawList[idx];
    if (candidate && typeof candidate === "object" && !usedIndices.has(idx)) {
      const cCpf = String(candidate.DADOS?.CPF || candidate.dados?.cpf || candidate.CPF || candidate.cpf || "").replace(/\D/g, "");
      if (!mCpf || !cCpf || mCpf === cCpf) {
        matchedRaw = candidate;
        usedIndices.add(idx);
      }
    }

    if (!matchedRaw && mCpf) {
      const foundIdx = rawList.findIndex((item, j) => {
        if (usedIndices.has(j) || !item || typeof item !== "object") return false;
        const cCpf = String(item.DADOS?.CPF || item.dados?.cpf || item.CPF || item.cpf || "").replace(/\D/g, "");
        return cCpf === mCpf;
      });
      if (foundIdx !== -1) {
        matchedRaw = rawList[foundIdx];
        usedIndices.add(foundIdx);
      }
    }

    if (!matchedRaw) return m;
    const endRaw = matchedRaw.ENDERECO || matchedRaw.endereco || matchedRaw.ENDERECOS?.[0] || matchedRaw.enderecos?.[0] || {};
    return {
      ...m,
      LOGR_NUMERO: m.LOGR_NUMERO ?? endRaw.LOGR_NUMERO ?? endRaw.logr_numero ?? endRaw.numero,
      LOGR_COMPLEMENTO: m.LOGR_COMPLEMENTO ?? endRaw.LOGR_COMPLEMENTO ?? endRaw.logr_complemento ?? endRaw.complemento,
    };
  });
}

function extractCepPayload(responseData, dataPayload) {
  const source = dataPayload !== undefined ? dataPayload : (responseData?.dados !== undefined ? responseData.dados : responseData);
  const unwrapped = source?.data !== undefined && !source?.cep && !source?.logradouro ? source.data : source;

  if (Array.isArray(unwrapped)) {
    const first = unwrapped[0] || {};
    const end = first.ENDERECO || first.endereco || first.ENDERECOS?.[0] || first.enderecos?.[0] || first;
    return { base: end, rawResidents: unwrapped };
  }

  const obj = unwrapped && typeof unwrapped === "object" ? unwrapped : {};
  const end = obj.ENDERECO || obj.endereco || obj.ENDERECOS?.[0] || obj.enderecos?.[0] || obj;

  let rawResidents = [];
  if (Array.isArray(obj.moradores)) rawResidents = obj.moradores;
  else if (Array.isArray(obj.residentes)) rawResidents = obj.residentes;
  else if (Array.isArray(obj.pessoas)) rawResidents = obj.pessoas;
  else if (Array.isArray(obj.resultado?.moradores)) rawResidents = obj.resultado.moradores;
  else if (Array.isArray(obj.response)) rawResidents = obj.response;
  else if (Array.isArray(obj.data?.response)) rawResidents = obj.data.response;
  else if (obj.DADOS || obj.dados || obj.CPF || obj.cpf || obj.NOME || obj.nome) rawResidents = [obj];

  rawResidents = enrichResidentsFromRaw(rawResidents, responseData?.raw);

  const base = obj.cep || obj.logradouro ? { ...end, ...obj } : end;
  return { base, rawResidents };
}

/**
 * Conecta os filtros interativos na tabela de residentes por CEP (reutilizado por consulta.js e zeroy.js)
 * @param {HTMLElement} container
 */
export function bindCepResidentsFilters(container) {
  if (!container) return;
  const textInput = container.querySelector("#inputFiltroCepMoradores");
  const numInput = container.querySelector("#inputFiltroCepNumero");
  const pills = container.querySelectorAll(".btn-filtro-cep");
  const rows = container.querySelectorAll(".linha-morador-cep");
  const counterEl = container.querySelector("#contadorCepMoradores");
  const emptyEl = container.querySelector("#emptyStateFiltroCepMoradores");
  const clearBtn = container.querySelector("#btnLimparFiltrosCep");
  const tableWrap = container.querySelector("#cepMoradoresTableWrap");

  if (!rows.length) return;

  const total = rows.length;

  const aplicarFiltros = () => {
    const query = (textInput?.value || "").toLowerCase().trim();
    const numQuery = (numInput?.value || "").toLowerCase().trim();
    const activePill = container.querySelector(".btn-filtro-cep.active");
    const filterType = activePill ? activePill.getAttribute("data-filter") : "todos";

    let visibleCount = 0;
    rows.forEach((row) => {
      const search = (row.getAttribute("data-search") || "").toLowerCase();
      const rowNum = (row.getAttribute("data-numero") || "").toLowerCase();
      const hasNum = row.getAttribute("data-has-numero") === "true";
      const hasComp = row.getAttribute("data-has-complemento") === "true";

      const matchQuery = !query || search.includes(query);
      const matchNum = !numQuery || rowNum.includes(numQuery);

      let matchPill = true;
      if (filterType === "com_numero") matchPill = hasNum;
      else if (filterType === "sem_numero") matchPill = !hasNum;
      else if (filterType === "com_complemento") matchPill = hasComp;

      const visible = matchQuery && matchNum && matchPill;
      row.style.display = visible ? "" : "none";
      if (visible) visibleCount++;
    });

    if (counterEl) {
      counterEl.textContent = `Exibindo ${visibleCount} de ${total}`;
    }
    if (emptyEl) {
      emptyEl.classList.toggle("is-hidden", visibleCount > 0);
    }
    if (tableWrap) {
      tableWrap.classList.toggle("is-hidden", visibleCount === 0);
    }
  };

  if (textInput) textInput.addEventListener("input", aplicarFiltros);
  if (numInput) numInput.addEventListener("input", aplicarFiltros);

  pills.forEach((pill) => {
    pill.addEventListener("click", () => {
      pills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      aplicarFiltros();
    });
  });

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (textInput) textInput.value = "";
      if (numInput) numInput.value = "";
      pills.forEach((p) => {
        p.classList.toggle("active", p.getAttribute("data-filter") === "todos");
      });
      aplicarFiltros();
    });
  }
}

export const CepInterpreter = {
  /**
   * Renderiza o dossiê geográfico e postal do CEP e tabela filtrável de residentes
   * @param {Object} responseData Objeto raiz da resposta da API
   * @param {Object|Array} dataPayload Objeto ou lista desempacotada
   * @returns {string} Markup HTML
   */
  render(responseData, dataPayload) {
    const { base: data, rawResidents } = extractCepPayload(responseData, dataPayload);

    const rawCep = String(data.cepLimpo || data.cep || data.CEP || responseData?.termo || "").replace(/\D/g, "");
    const formattedCep = rawCep.length === 8 ? Formatters.cep(rawCep) : (cleanAddressValue(data.cep || data.CEP) || "Não informado");

    const tipoLogr = cleanAddressValue(data.LOGR_TIPO || data.tipoLogradouro);
    const nomeLogr = cleanAddressValue(data.LOGR_NOME || data.logr_nome || data.LOGRADOURO || data.logradouro || data.rua || data.street);
    const logradouro =
      [tipoLogr, nomeLogr].filter(Boolean).join(" ").trim() ||
      cleanAddressValue(data.endereco) ||
      "Não informado";

    const complemento = cleanAddressValue(data.complemento || data.LOGR_COMPLEMENTO || data.logr_complemento);
    const bairro = cleanAddressValue(data.bairro || data.BAIRRO || data.neighborhood) || "Não informado";
    const cidade = cleanAddressValue(data.cidade || data.CIDADE || data.localidade || data.municipio || data.city) || "Não informada";
    const uf = resolveValidUf(data.uf || data.UF || data.estado || data.state);
    const estadoNome = cleanAddressValue(data.estado || data.state);
    const estadoSublabel = estadoNome && estadoNome !== uf ? estadoNome : "";

    // Coordenadas
    let lat = null;
    let lon = null;
    if (data.coordenadas && typeof data.coordenadas === "object") {
      lat = data.coordenadas.latitude ?? data.coordenadas.lat ?? null;
      lon = data.coordenadas.longitude ?? data.coordenadas.lng ?? data.coordenadas.lon ?? null;
    } else if (data.location?.coordinates) {
      lat = data.location.coordinates.latitude ?? null;
      lon = data.location.coordinates.longitude ?? null;
    } else if (data.lat && data.lng) {
      lat = parseFloat(data.lat);
      lon = parseFloat(data.lng);
    }

    const hasCoords = lat !== null && lon !== null && !isNaN(lat) && !isNaN(lon);
    const moradores = rawResidents.map(normalizeResidentItem).filter(Boolean);

    const fonte = cleanAddressValue(responseData?.fonte || data.fonte) || "DNE / Correios";
    const provedor = (cleanAddressValue(data.provedor) || "Correios").toUpperCase();

    // Monta endereço completo limpo (sem '(SEM RESULTADO)' e sem '- N/')
    const cidadeTexto = cidade !== "Não informada" ? (uf ? `${cidade} - ${uf}` : cidade) : null;
    const enderecoCompleto = [
      logradouro !== "Não informado" ? logradouro : null,
      complemento ? `(${complemento})` : null,
      bairro !== "Não informado" ? bairro : null,
      cidadeTexto,
      formattedCep !== "Não informado" ? `CEP ${formattedCep}` : null,
    ]
      .filter(Boolean)
      .join(", ");

    const googleMapsUrl = hasCoords
      ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoCompleto)}`;

    const osmMapUrl = hasCoords
      ? `https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.008}%2C${lat - 0.006}%2C${lon + 0.008}%2C${lat + 0.006}&layer=mapnik&marker=${lat}%2C${lon}`
      : null;

    const totalComNumero = moradores.filter((m) => m.hasNumero).length;
    const totalSemNumero = moradores.length - totalComNumero;
    const totalComCompl = moradores.filter((m) => m.hasComplemento).length;

    return `
      <!-- TOP CARD / HERO DO CEP -->
      <div class="card osint-cep-hero">
        <div class="osint-person-top">
          <div class="osint-cep-hero-main">
            <div class="osint-chip-row mb-4">
              <span class="badge badge-emerald">
                <i data-lucide="map-pin" class="icon-xs"></i>
                LOGRADOURO OFICIAL
              </span>
              <span class="badge badge-dark">
                ${escapeHtml(provedor)}
              </span>
              ${uf ? `<span class="badge badge-purple">UF: ${escapeHtml(uf)}</span>` : ""}
            </div>

            <h2 class="osint-cep-title">
              ${escapeHtml(logradouro)}
            </h2>

            <div class="osint-cep-meta">
              <span>Bairro: <strong>${escapeHtml(bairro)}</strong></span>
              <span>&bull;</span>
              <span>Município: <strong class="osint-cep-meta-city">${escapeHtml(cidade)}</strong></span>
            </div>

            ${
              enderecoCompleto
                ? `<div class="osint-cep-fulladdr">${escapeHtml(enderecoCompleto)}</div>`
                : ""
            }
          </div>

          <div class="osint-cep-codebox">
            <span class="osint-cep-codebox-label">Código Postal (CEP)</span>
            <div class="osint-cep-codebox-row">
              <span class="osint-cep-code">
                ${escapeHtml(formattedCep)}
              </span>
              <button type="button" class="btn btn-ghost btn-copy-inline btn-action-copy btn-copiar-texto" data-copy="${escapeHtml(rawCep || formattedCep)}" title="Copiar CEP">
                <i data-lucide="copy" class="icon-sm"></i>
              </button>
            </div>
            <div class="osint-cep-source">
              ${escapeHtml(fonte)}
            </div>
          </div>
        </div>

        <!-- BOTÕES DE AÇÃO RÁPIDA -->
        <div class="osint-cep-actions">
          <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm">
            <i data-lucide="map" class="icon-sm icon-blue"></i>
            Abrir no Google Maps
          </a>
          ${
            enderecoCompleto
              ? `<button type="button" class="btn btn-outline btn-sm btn-action-copy btn-copiar-texto" data-copy="${escapeHtml(enderecoCompleto)}">
                  <i data-lucide="clipboard" class="icon-sm icon-purple"></i>
                  Copiar Endereço Completo
                </button>`
              : ""
          }
        </div>
      </div>

      <!-- CARDS DE INDICADORES CHAVE (KPIS) -->
      <div class="osint-cep-kpi-grid">
        <div class="osint-cep-kpi">
          <span class="osint-cep-kpi-label">CEP</span>
          <div class="osint-cep-kpi-val osint-cep-kpi-val--emerald">
            ${escapeHtml(formattedCep)}
          </div>
          <span class="osint-cep-kpi-sub">DNE / Correios</span>
        </div>

        <div class="osint-cep-kpi">
          <span class="osint-cep-kpi-label">MUNICÍPIO</span>
          <div class="osint-cep-kpi-val osint-cep-kpi-val--sky">
            ${escapeHtml(cidade)}
          </div>
          ${estadoSublabel ? `<span class="osint-cep-kpi-sub">${escapeHtml(estadoSublabel)}</span>` : ""}
        </div>

        ${
          moradores.length > 0
            ? `<div class="osint-cep-kpi">
                <span class="osint-cep-kpi-label">RESIDENTES LOCALIZADOS</span>
                <div class="osint-cep-kpi-val osint-cep-kpi-val--purple">
                  ${moradores.length}
                </div>
                <span class="osint-cep-kpi-sub">${totalComNumero} com nº identificado</span>
              </div>`
            : ""
        }
      </div>

      <!-- MAPA INTERATIVO QUANDO HOUVER COORDENADAS -->
      ${
        osmMapUrl
          ? `
      <div class="card osint-cep-map-card">
        <div class="osint-cep-map-header">
          <h3 class="osint-cep-map-title">
            <i data-lucide="map" class="icon-md"></i>
            Mapeamento Cartográfico & Satélite
          </h3>
          <span class="osint-cep-map-coords">
            ${lat.toFixed(5)}, ${lon.toFixed(5)}
          </span>
        </div>
        <div class="osint-cep-map-frame-wrap">
          <iframe
            class="osint-cep-map-frame"
            frameborder="0"
            scrolling="no"
            marginheight="0"
            marginwidth="0"
            src="${osmMapUrl}">
          </iframe>
        </div>
        <div class="osint-cep-map-footer">
          <span>Marcador georreferenciado via OpenStreetMap & Correios</span>
          <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" class="osint-cep-map-link">
            Ver no Google Maps &rarr;
          </a>
        </div>
      </div>
      `
          : ""
      }

      <!-- SEÇÃO DE RESIDENTES / MORADORES VINCULADOS COM FILTROS -->
      ${
        moradores.length > 0
          ? `
      <div class="card osint-section-card">
        <div class="card-header osint-cep-residents-header">
          <h3 class="card-title">
            <i data-lucide="users" class="icon-md icon-cyan"></i>
            <span>Residentes / Registros Vinculados (${moradores.length})</span>
          </h3>
          <span id="contadorCepMoradores" class="osint-filter-counter">
            Exibindo ${moradores.length} de ${moradores.length}
          </span>
        </div>

        <div class="osint-filter-bar">
          <div class="osint-filter-inputs">
            <input
              type="text"
              id="inputFiltroCepMoradores"
              class="input-filter-inline"
              placeholder="Filtrar por nome, CPF, nº ou complemento..."
            >
            <input
              type="text"
              id="inputFiltroCepNumero"
              class="input-filter-inline input-filter-inline--sm"
              placeholder="Nº da casa..."
            >
          </div>
          <div class="osint-chip-row">
            <button type="button" class="btn-filtro-pill btn-filtro-cep active" data-filter="todos">
              Todos (${moradores.length})
            </button>
            <button type="button" class="btn-filtro-pill btn-filtro-cep" data-filter="com_numero">
              Com Nº (${totalComNumero})
            </button>
            ${
              totalSemNumero > 0
                ? `<button type="button" class="btn-filtro-pill btn-filtro-cep" data-filter="sem_numero">
                    S/N (${totalSemNumero})
                  </button>`
                : ""
            }
            ${
              totalComCompl > 0
                ? `<button type="button" class="btn-filtro-pill btn-filtro-cep" data-filter="com_complemento">
                    Com Complemento (${totalComCompl})
                  </button>`
                : ""
            }
          </div>
        </div>

        <div id="cepMoradoresTableWrap" class="table-responsive osint-table-scroll">
          <table class="osint-table" id="tabelaMoradoresCep">
            <thead>
              <tr>
                <th class="osint-th-index">#</th>
                <th>Nome</th>
                <th class="osint-th-cpf">CPF</th>
                <th>Número</th>
                <th>Complemento</th>
                <th class="osint-th-action">Ação</th>
              </tr>
            </thead>
            <tbody>
              ${moradores
                .map((m, idx) => {
                  const searchTokens = `${m.nome} ${m.cpfFormatted} ${m.rawCpf} ${m.numero} ${m.complemento}`.toLowerCase();
                  return `
                <tr
                  class="linha-morador-cep"
                  data-search="${escapeHtml(searchTokens)}"
                  data-numero="${escapeHtml(m.numero.toLowerCase())}"
                  data-has-numero="${m.hasNumero}"
                  data-has-complemento="${m.hasComplemento}"
                >
                  <td class="osint-td-index">${idx + 1}</td>
                  <td class="osint-td-name">${escapeHtml(m.nome)}</td>
                  <td>
                    <div class="osint-td-cpf-wrap">
                      <span class="osint-td-cpf-val">${escapeHtml(m.cpfFormatted)}</span>
                      ${
                        m.rawCpf
                          ? `<button type="button" class="btn btn-ghost btn-copy-inline btn-copiar-cpf" data-cpf="${escapeHtml(m.rawCpf)}" title="Copiar CPF">
                              <i data-lucide="copy" class="icon-xs"></i>
                            </button>`
                          : ""
                      }
                    </div>
                  </td>
                  <td class="osint-td-name">${escapeHtml(m.numero)}</td>
                  <td class="osint-td-meta">${escapeHtml(m.complemento || "-")}</td>
                  <td class="osint-td-right">
                    ${
                      m.rawCpf.length === 11
                        ? `<button type="button" class="btn btn-primary btn-xs btn-puxar-cpf-item btn-puxar-cpf" data-cpf="${escapeHtml(m.rawCpf)}" title="Investigar dossiê deste CPF">
                            <i data-lucide="search" class="icon-xs"></i>
                            <span>Investigar</span>
                          </button>`
                        : ""
                    }
                  </td>
                </tr>
              `;
                })
                .join("")}
            </tbody>
          </table>
        </div>

        <div id="emptyStateFiltroCepMoradores" class="osint-empty-card osint-empty-card--dashed is-hidden">
          <div class="osint-empty-icon osint-empty-icon--warning">
            <i data-lucide="filter-x" class="icon-xl"></i>
          </div>
          <h4 class="osint-empty-title">Nenhum morador encontrado com esses filtros</h4>
          <p class="osint-empty-desc">Ajuste o número da casa, nome ou CPF digitado para visualizar os registros.</p>
          <div class="mt-4">
            <button type="button" id="btnLimparFiltrosCep" class="btn btn-outline btn-sm">
              <i data-lucide="rotate-ccw" class="icon-xs"></i>
              Limpar Filtros
            </button>
          </div>
        </div>
      </div>
      `
          : ""
      }
    `;
  },
};
