/**
 * ==============================================================================
 * RIMUBUSCA - HEXYS DEV INTERPRETER - CEP & ENDEREÇOS (CEP.JS)
 * Renderizador de alta fidelidade para consultas geográficas e postais de CEP,
 * logradouros, geolocalização por satélite, telecom e divisão territorial IBGE.
 * ==============================================================================
 */

import { Formatters } from "../../utils.js";

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export const CepInterpreter = {
  /**
   * Renderiza o dossiê geográfico e postal completo do CEP
   * @param {Object} responseData Objeto raiz da resposta da API
   * @param {Object} dataPayload Objeto desempacotado 'dados'
   * @returns {string} Markup HTML moderno e responsivo
   */
  render(responseData, dataPayload) {
    const data = dataPayload || responseData?.dados || responseData || {};

    const rawCep = String(data.cepLimpo || data.cep || responseData?.termo || "").replace(/\D/g, "");
    const formattedCep = rawCep.length === 8 ? Formatters.cep(rawCep) : (data.cep || "Não informado");

    const logradouro = data.logradouro || data.endereco || data.street || "Não informado";
    const complemento = data.complemento ? String(data.complemento).trim() : "";
    const bairro = data.bairro || data.neighborhood || "Não informado";
    const cidade = data.cidade || data.localidade || data.municipio || data.city || "Não informada";
    const uf = String(data.uf || data.estado || data.state || "N/I").toUpperCase().slice(0, 2);
    const estadoNome = data.estado || data.state || uf;

    // Código IBGE (higienizado contra [object Object])
    let codigoIbge = "N/I";
    if (data.codigoIbge && typeof data.codigoIbge === "string" && data.codigoIbge !== "[object Object]" && data.codigoIbge !== "null") {
      codigoIbge = data.codigoIbge;
    } else if (data.ibge && typeof data.ibge === "string" && data.ibge !== "[object Object]") {
      codigoIbge = data.ibge;
    } else if (typeof data.codigoIbge === "number") {
      codigoIbge = String(data.codigoIbge);
    } else if (typeof data.ibge === "number") {
      codigoIbge = String(data.ibge);
    }

    // DDD
    const ddd = data.ddd && String(data.ddd) !== "N/I" && String(data.ddd) !== "null" ? String(data.ddd).replace(/\D/g, "") : "N/I";

    // SIAFI e GIA
    const siafi = data.siafi ? String(data.siafi) : null;
    const gia = data.gia ? String(data.gia) : null;
    const regiao = data.regiao || null;

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

    // Moradores
    const rawResidents = Array.isArray(data.moradores)
      ? data.moradores
      : Array.isArray(data.residentes)
      ? data.residentes
      : Array.isArray(data.pessoas)
      ? data.pessoas
      : [];

    const moradores = rawResidents.filter((r) => r && typeof r === "object");

    // Fonte / Provedor
    const fonte = responseData?.fonte || data.fonte || "DNE / Correios / IBGE Oficial";
    const provedor = (data.provedor || "Correios").toUpperCase();

    // Monta endereço completo para rotas e mapas
    const enderecoCompleto = [
      logradouro !== "Não informado" ? logradouro : null,
      complemento ? `(${complemento})` : null,
      bairro !== "Não informado" ? bairro : null,
      cidade !== "Não informada" ? `${cidade} - ${uf}` : null,
      formattedCep !== "Não informado" ? `CEP ${formattedCep}` : null,
    ].filter(Boolean).join(", ");

    const googleMapsUrl = hasCoords
      ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoCompleto)}`;

    const wazeUrl = hasCoords
      ? `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`
      : `https://waze.com/ul?q=${encodeURIComponent(enderecoCompleto)}`;

    const osmMapUrl = hasCoords
      ? `https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.008}%2C${lat - 0.006}%2C${lon + 0.008}%2C${lat + 0.006}&layer=mapnik&marker=${lat}%2C${lon}`
      : null;

    return `
      <!-- TOP CARD / HERO DO CEP -->
      <div class="card" style="margin-bottom: var(--space-5); border-left: 4px solid #10B981; background: linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(59, 130, 246, 0.03) 100%), var(--color-surface);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
          <div style="flex: 1; min-width: 280px;">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;">
              <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.35); font-weight: 700;">
                <i data-lucide="map-pin" style="width: 12px; height: 12px;"></i>
                LOGRADOURO OFICIAL
              </span>
              <span class="badge badge-dark" style="font-size: 0.75rem; border: 1px solid var(--color-border);">
                ${escapeHtml(provedor)}
              </span>
              <span class="badge badge-purple" style="font-size: 0.75rem;">
                ZONA POSTAL: ${escapeHtml(uf)}
              </span>
            </div>

            <h2 style="font-size: 1.45rem; font-weight: 800; color: var(--color-text); margin: 0; line-height: 1.3;">
              ${escapeHtml(logradouro)}
            </h2>

            <div style="font-size: 0.875rem; color: var(--color-text-muted); margin-top: 6px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span>Bairro: <strong style="color: var(--color-text);">${escapeHtml(bairro)}</strong></span>
              <span style="color: var(--color-border);">&bull;</span>
              <span>Município: <strong style="color: #38BDF8;">${escapeHtml(cidade)} / ${escapeHtml(uf)}</strong></span>
            </div>

            <div style="font-size: 0.78rem; color: var(--color-text-dim); margin-top: 6px; font-family: var(--font-mono);">
              ${escapeHtml(enderecoCompleto)}
            </div>
          </div>

          <div style="text-align: right; background: var(--color-surface-2); padding: 12px 18px; border-radius: var(--radius-md); border: 1px solid var(--color-border); min-width: 200px;">
            <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; font-weight: 600; display: block;">Código Postal (CEP)</span>
            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 2px;">
              <span style="font-size: 1.4rem; font-weight: 800; font-family: var(--font-mono); color: #10B981;">
                ${escapeHtml(formattedCep)}
              </span>
              <button type="button" class="btn btn-ghost btn-sm btn-action-copy" data-copy="${escapeHtml(rawCep)}" title="Copiar CEP" style="padding: 2px 6px;">
                <i data-lucide="copy" style="width: 14px; height: 14px;"></i>
              </button>
            </div>
            <div style="font-size: 0.72rem; color: var(--color-text-dim); margin-top: 4px;">
              ${escapeHtml(fonte)}
            </div>
          </div>
        </div>

        <!-- BOTÕES DE AÇÃO RÁPIDA -->
        <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 16px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.06);">
          <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="display: inline-flex; align-items: center; gap: 6px; text-decoration: none; font-size: 0.8rem;">
            <i data-lucide="map" style="width: 14px; height: 14px; color: #38BDF8;"></i>
            Abrir no Google Maps
          </a>
          <a href="${wazeUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="display: inline-flex; align-items: center; gap: 6px; text-decoration: none; font-size: 0.8rem;">
            <i data-lucide="navigation" style="width: 14px; height: 14px; color: #10B981;"></i>
            Abrir no Waze
          </a>
          <button type="button" class="btn btn-secondary btn-sm btn-action-copy" data-copy="${escapeHtml(enderecoCompleto)}" style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.8rem;">
            <i data-lucide="clipboard" style="width: 14px; height: 14px; color: #A78BFA;"></i>
            Copiar Endereço Completo
          </button>
        </div>
      </div>

      <!-- CARDS DE INDICADORES CHAVE (KPIS) -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: var(--space-5);">
        <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 14px;">
          <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; font-weight: 600; display: block;">CEP</span>
          <div style="font-size: 1.25rem; font-weight: 800; color: #10B981; font-family: var(--font-mono); margin-top: 2px;">
            ${escapeHtml(formattedCep)}
          </div>
          <span style="font-size: 0.72rem; color: var(--color-text-dim);">DNE / Correios</span>
        </div>

        <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 14px;">
          <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; font-weight: 600; display: block;">MUNICÍPIO / UF</span>
          <div style="font-size: 1.15rem; font-weight: 800; color: #38BDF8; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${escapeHtml(cidade)} / ${escapeHtml(uf)}
          </div>
          <span style="font-size: 0.72rem; color: var(--color-text-dim);">${escapeHtml(estadoNome)}</span>
        </div>

        <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 14px;">
          <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; font-weight: 600; display: block;">DDD TELEFÔNICO</span>
          <div style="font-size: 1.25rem; font-weight: 800; color: #A78BFA; font-family: var(--font-mono); margin-top: 2px;">
            ${ddd !== "N/I" ? `(${escapeHtml(ddd)})` : "N/I"}
          </div>
          <span style="font-size: 0.72rem; color: var(--color-text-dim);">Prefixo Nacional Anatel</span>
        </div>

        <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 14px;">
          <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; font-weight: 600; display: block;">CÓDIGO IBGE</span>
          <div style="font-size: 1.25rem; font-weight: 800; color: #F59E0B; font-family: var(--font-mono); margin-top: 2px;">
            ${escapeHtml(codigoIbge)}
          </div>
          <span style="font-size: 0.72rem; color: var(--color-text-dim);">Divisão Territorial Oficial</span>
        </div>
      </div>

      <!-- GRID DE CARDS PRINCIPAIS -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-5);">
        
        <!-- CARD 1: DADOS CADASTRAIS DO LOGRADOURO -->
        <div class="card">
          <div class="card-header" style="border-bottom: 1px solid var(--color-border); padding-bottom: 10px; margin-bottom: 12px;">
            <h3 class="card-title" style="display: flex; align-items: center; gap: 8px; font-size: 0.95rem; margin: 0;">
              <i data-lucide="home" style="color: #10B981; width: 18px; height: 18px;"></i>
              <span>Especificações do Endereço</span>
            </h3>
          </div>
          <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.85rem;">
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.04); padding-bottom: 6px;">
              <span style="color: var(--color-text-muted);">Logradouro:</span>
              <span style="font-weight: 600; color: #FFFFFF; text-align: right; max-width: 65%;">${escapeHtml(logradouro)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.04); padding-bottom: 6px;">
              <span style="color: var(--color-text-muted);">Bairro / Setor:</span>
              <span style="font-weight: 600; color: var(--color-text);">${escapeHtml(bairro)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.04); padding-bottom: 6px;">
              <span style="color: var(--color-text-muted);">Complemento:</span>
              <span style="font-weight: 500; color: ${complemento ? "var(--color-text)" : "var(--color-text-dim)"};">
                ${escapeHtml(complemento || "Sem complemento cadastrado")}
              </span>
            </div>
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.04); padding-bottom: 6px;">
              <span style="color: var(--color-text-muted);">Município:</span>
              <span style="font-weight: 600; color: #38BDF8;">${escapeHtml(cidade)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.04); padding-bottom: 6px;">
              <span style="color: var(--color-text-muted);">Estado / UF:</span>
              <span style="font-weight: 600; color: var(--color-text);">${escapeHtml(estadoNome)} (${escapeHtml(uf)})</span>
            </div>
            ${
              regiao
                ? `
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--color-text-muted);">Região Geográfica:</span>
              <span style="font-weight: 600; color: #A78BFA;">${escapeHtml(regiao)}</span>
            </div>
            `
                : ""
            }
          </div>
        </div>

        <!-- CARD 2: TERRITORIAL, CARTOGRAFIA & TELECOM -->
        <div class="card">
          <div class="card-header" style="border-bottom: 1px solid var(--color-border); padding-bottom: 10px; margin-bottom: 12px;">
            <h3 class="card-title" style="display: flex; align-items: center; gap: 8px; font-size: 0.95rem; margin: 0;">
              <i data-lucide="compass" style="color: #38BDF8; width: 18px; height: 18px;"></i>
              <span>Cartografia & Divisão Territorial</span>
            </h3>
          </div>
          <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.85rem;">
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.04); padding-bottom: 6px;">
              <span style="color: var(--color-text-muted);">Código IBGE:</span>
              <span style="font-weight: 700; color: #F59E0B; font-family: var(--font-mono);">${escapeHtml(codigoIbge)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.04); padding-bottom: 6px;">
              <span style="color: var(--color-text-muted);">Prefixo DDD:</span>
              <span style="font-weight: 700; color: #A78BFA; font-family: var(--font-mono);">${ddd !== "N/I" ? `DDD ${escapeHtml(ddd)}` : "Não identificado"}</span>
            </div>
            ${
              siafi
                ? `
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.04); padding-bottom: 6px;">
              <span style="color: var(--color-text-muted);">Código SIAFI:</span>
              <span style="font-weight: 600; color: var(--color-text); font-family: var(--font-mono);">${escapeHtml(siafi)}</span>
            </div>
            `
                : ""
            }
            ${
              gia
                ? `
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.04); padding-bottom: 6px;">
              <span style="color: var(--color-text-muted);">Código GIA:</span>
              <span style="font-weight: 600; color: var(--color-text); font-family: var(--font-mono);">${escapeHtml(gia)}</span>
            </div>
            `
                : ""
            }
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.04); padding-bottom: 6px;">
              <span style="color: var(--color-text-muted);">Latitude:</span>
              <span style="font-weight: 600; color: ${hasCoords ? "#34D399" : "var(--color-text-dim)"}; font-family: var(--font-mono);">
                ${hasCoords ? lat.toFixed(6) : "Não informada"}
              </span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--color-text-muted);">Longitude:</span>
              <span style="font-weight: 600; color: ${hasCoords ? "#34D399" : "var(--color-text-dim)"}; font-family: var(--font-mono);">
                ${hasCoords ? lon.toFixed(6) : "Não informada"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- MAPA INTERATIVO / SATÉLITE QUANDO HOUVER COORDENADAS -->
      ${
        osmMapUrl
          ? `
      <div class="card" style="margin-bottom: var(--space-5); overflow: hidden; padding: 0;">
        <div style="padding: 12px 18px; background: var(--color-surface-2); border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-size: 0.95rem; font-weight: 700; color: #38BDF8; margin: 0; display: flex; align-items: center; gap: 8px;">
            <i data-lucide="map" style="width: 16px; height: 16px;"></i>
            Mapeamento Cartográfico & Satélite
          </h3>
          <span style="font-size: 0.75rem; color: var(--color-text-muted); font-family: var(--font-mono);">
            ${lat.toFixed(5)}, ${lon.toFixed(5)}
          </span>
        </div>
        <div style="width: 100%; height: 260px; background: #080B11; position: relative;">
          <iframe 
            width="100%" 
            height="100%" 
            frameborder="0" 
            scrolling="no" 
            marginheight="0" 
            marginwidth="0" 
            src="${osmMapUrl}"
            style="border: 0; filter: contrast(1.05) brightness(0.95);">
          </iframe>
        </div>
        <div style="padding: 10px 18px; background: var(--color-surface); display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem; color: var(--color-text-muted);">
          <span>Marcador georreferenciado via OpenStreetMap & Correios</span>
          <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" style="color: #60A5FA; text-decoration: none; font-weight: 600;">
            Ver no Google Earth &rarr;
          </a>
        </div>
      </div>
      `
          : ""
      }

      <!-- SEÇÃO DE RESIDENTES / MORADORES VINCULADOS -->
      ${
        moradores.length > 0
          ? `
      <div class="card" style="margin-bottom: var(--space-5);">
        <div class="card-header" style="border-bottom: 1px solid var(--color-border); padding-bottom: 10px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
          <h3 class="card-title" style="display: flex; align-items: center; gap: 8px; font-size: 0.95rem; margin: 0; color: #38BDF8;">
            <i data-lucide="users" style="width: 18px; height: 18px;"></i>
            <span>Residentes / Registros Vinculados (${moradores.length})</span>
          </h3>
        </div>
        <div class="table-responsive">
          <table class="osint-table" style="width: 100%; font-size: 0.85rem;">
            <thead>
              <tr style="border-bottom: 1px solid var(--color-border); text-align: left; color: var(--color-text-muted);">
                <th style="padding: 8px 12px;">Nome</th>
                <th style="padding: 8px 12px;">CPF</th>
                <th style="padding: 8px 12px;">Número</th>
                <th style="padding: 8px 12px;">Complemento</th>
              </tr>
            </thead>
            <tbody>
              ${moradores
                .map(
                  (m) => `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                  <td style="padding: 8px 12px; font-weight: 600; color: #FFFFFF;">${escapeHtml(m.nome || m.morador || m.name || "N/I")}</td>
                  <td style="padding: 8px 12px; font-family: var(--font-mono); color: #38BDF8;">${escapeHtml(m.cpf ? Formatters.cpf(m.cpf) : "N/I")}</td>
                  <td style="padding: 8px 12px;">${escapeHtml(m.numero || "S/N")}</td>
                  <td style="padding: 8px 12px; color: var(--color-text-muted);">${escapeHtml(m.complemento || "-")}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
      `
          : ""
      }
    `;
  },
};
