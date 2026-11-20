/**
 * ==============================================================================
 * HEXYS API INTERPRETER - EMAIL & DIGITAL IDENTITY (EMAIL.JS)
 * Visual renderer for email lookups returning Google ecosystem accounts,
 * Gaia ID, associated individuals (titulars), vehicles, and credential breach audits.
 *
 * Clean Code standards with English identifiers and strict null-safety.
 * ==============================================================================
 */

import { Formatters, escapeHtml } from "../../utils.js";

/**
 * Extracts and standardizes titular persons from email data
 * @param {Object} payload
 * @returns {Array<Object>}
 */
export function extractEmailPersons(payload) {
  if (!payload) return [];
  if (Array.isArray(payload.pessoas_vinculadas)) return payload.pessoas_vinculadas;
  if (Array.isArray(payload.pessoas)) return payload.pessoas;
  if (Array.isArray(payload.titulares)) return payload.titulares;
  if (Array.isArray(payload.resultado)) return payload.resultado;
  if (Array.isArray(payload.resultados)) return payload.resultados;
  if (payload.cpf && (payload.name || payload.nome)) return [payload];
  return [];
}

/**
 * Helper to render an icon or badge for Google Ecosystem apps
 * @param {string} appName
 * @returns {string} HTML badge
 */
function renderGoogleAppBadge(appName) {
  const name = String(appName || "").trim();
  const lower = name.toLowerCase();

  let bg = "rgba(139, 92, 246, 0.15)";
  let color = "#C4B5FD";
  let icon = "globe";

  if (lower.includes("youtube")) {
    bg = "rgba(239, 68, 68, 0.15)";
    color = "#F87171";
    icon = "video";
  } else if (lower.includes("photo")) {
    bg = "rgba(59, 130, 246, 0.15)";
    color = "#60A5FA";
    icon = "image";
  } else if (lower.includes("map")) {
    bg = "rgba(16, 185, 129, 0.15)";
    color = "#34D399";
    icon = "map-pin";
  } else if (lower.includes("meet")) {
    bg = "rgba(20, 184, 166, 0.15)";
    color = "#2DD4BF";
    icon = "video";
  } else if (lower.includes("mail") || lower.includes("gmail")) {
    bg = "rgba(234, 88, 12, 0.15)";
    color = "#FB923C";
    icon = "mail";
  } else if (lower.includes("calendar")) {
    bg = "rgba(99, 102, 241, 0.15)";
    color = "#818CF8";
    icon = "calendar";
  } else if (lower.includes("drive")) {
    bg = "rgba(245, 158, 11, 0.15)";
    color = "#FBBF24";
    icon = "hard-drive";
  }

  return `
    <span class="badge" style="background: ${bg}; color: ${color}; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; padding: 4px 9px; font-size: 0.75rem;">
      <i data-lucide="${icon}" style="width: 12px; height: 12px;"></i>
      ${escapeHtml(name)}
    </span>
  `;
}

export const EmailInterpreter = {
  /**
   * Renders email OSINT search results
   * @param {Object} responseData - Complete response object from backend
   * @param {Object} dataPayload - Extracted data payload
   * @returns {string} HTML markup
   */
  render(responseData, dataPayload) {
    const data = dataPayload || responseData?.dados || {};
    const email = String(data.email || responseData?.termo || "E-mail não informado").trim().toLowerCase();

    // 1. Google Profile & Digital Footprint
    const perfilGoogle = data.perfil_google || {};
    const contasGoogle = perfilGoogle.contasGoogle || perfilGoogle.contas_google || {};
    const gaiaId = perfilGoogle.gaia_id || perfilGoogle.gaiaId || contasGoogle.gaia_id || null;
    const photoUrl = data.foto || perfilGoogle.foto || perfilGoogle.photoUrl || contasGoogle.foto || contasGoogle.photoUrl || null;
    const appsAtivos = Array.isArray(perfilGoogle.apps_ativos)
      ? perfilGoogle.apps_ativos
      : Array.isArray(contasGoogle.apps_ativos)
        ? contasGoogle.apps_ativos
        : Array.isArray(contasGoogle.apps)
          ? contasGoogle.apps
          : [];
    const mapsContribUrl = perfilGoogle.maps_contrib_url || contasGoogle.maps_contrib_url || (gaiaId ? `https://www.google.com/maps/contrib/${gaiaId}/reviews` : null);
    const ultimaEdicao = perfilGoogle.ultima_edicao_perfil || contasGoogle.ultima_edicao_perfil || null;

    // 2. Associated Individuals (pessoas_vinculadas)
    const persons = extractEmailPersons(data);
    const totalPersons = persons.length;

    // 3. Companies & Leaks
    const empresas = Array.isArray(data.empresas_vinculadas) ? data.empresas_vinculadas : Array.isArray(data.empresas) ? data.empresas : [];
    const seguranca = data.seguranca || {};
    const vazamentos = Array.isArray(seguranca.vazamentos) ? seguranca.vazamentos : Array.isArray(data.vazamentos) ? data.vazamentos : [];
    const totalVazamentos = seguranca.total_vazamentos ?? (data.total_vazamentos ?? vazamentos.length);
    const isVulnerable = totalVazamentos > 0;

    // 4. Metrics & Counters
    let regularesCount = 0;
    let comVeiculosCount = 0;
    let comCnhCount = 0;

    persons.forEach((p) => {
      const sit = String(p.situacao_receita || p.situacaoCadastral || p.status || "").toUpperCase();
      if (sit === "REGULAR" || sit === "") regularesCount++;
      const v = Array.isArray(p.veiculos) ? p.veiculos : Array.isArray(p.vehicles) ? p.vehicles : [];
      if (v.length > 0) comVeiculosCount++;
      if (p.cnh && (p.cnh.numero || p.cnh.num_cnh)) comCnhCount++;
    });

    const credits = responseData?.remainingCredits ?? null;

    return `
      <!-- ============================================================== -->
      <!-- CABEÇALHO DO MÓDULO: INTELIGÊNCIA DE E-MAIL & PERFIL DIGITAL   -->
      <!-- ============================================================== -->
      <div class="card" style="margin-bottom: var(--space-4); border-top: 4px solid #06B6D4; background: radial-gradient(circle at 95% 10%, rgba(6, 182, 212, 0.12) 0%, transparent 70%), var(--color-surface);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
          
          <div style="display: flex; align-items: flex-start; gap: 16px; flex-wrap: wrap;">
            <!-- Avatar / Foto do Perfil Google ou Ícone -->
            <div style="position: relative; width: 72px; height: 72px; border-radius: 12px; background: #080B11; border: 2px solid #1E2538; overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(0,0,0,0.4);">
              ${
                photoUrl
                  ? `<img src="${photoUrl}" alt="Foto Google" style="width: 100%; height: 100%; object-fit: cover; border-radius: 10px;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                     <div style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center; color: #06B6D4;">
                       <i data-lucide="mail" style="width: 32px; height: 32px;"></i>
                     </div>`
                  : `<div style="color: #06B6D4; display: flex; align-items: center; justify-content: center;">
                       <i data-lucide="mail" style="width: 32px; height: 32px;"></i>
                     </div>`
              }
              ${
                photoUrl
                  ? `<div title="Foto do Perfil Google" style="position: absolute; bottom: 2px; right: 2px; background: #06B6D4; color: #080B11; border-radius: 4px; padding: 2px; font-size: 0.65rem; display: flex; align-items: center; justify-content: center;">
                       <i data-lucide="camera" style="width: 10px; height: 10px;"></i>
                     </div>`
                  : ""
              }
            </div>

            <!-- Dados Principais do E-mail Consultado -->
            <div>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px;">
                <span class="badge" style="background: rgba(6, 182, 212, 0.15); color: #67E8F9; font-weight: 700;">
                  <i data-lucide="mail" style="width: 12px; height: 12px;"></i> INTELIGÊNCIA DE E-MAIL & OSINT
                </span>

                ${
                  gaiaId || photoUrl
                    ? `<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #6EE7B7; font-weight: 700;">
                         <i data-lucide="check-circle" style="width: 12px; height: 12px;"></i> Conta Google Indexada
                       </span>`
                    : ""
                }

                <span class="badge" style="background: ${isVulnerable ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)'}; color: ${isVulnerable ? '#F87171' : '#6EE7B7'}; font-weight: 700;">
                  <i data-lucide="${isVulnerable ? 'shield-alert' : 'shield-check'}" style="width: 12px; height: 12px;"></i>
                  ${isVulnerable ? `${totalVazamentos} Vazamento(s) Detectado(s)` : '0 Vazamentos de Credenciais'}
                </span>
              </div>

              <!-- Endereço de E-mail em Destaque -->
              <h2 style="font-size: 1.4rem; font-weight: 800; margin: 0 0 4px 0; color: #FFFFFF; font-family: var(--font-mono); letter-spacing: -0.02em; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span>${escapeHtml(email)}</span>
                <button 
                  type="button" 
                  class="btn-icon" 
                  data-copy="${escapeHtml(email)}" 
                  title="Copiar E-mail"
                  style="background: transparent; border: none; color: var(--color-text-muted); cursor: pointer; padding: 2px;"
                >
                  <i data-lucide="copy" style="width: 14px; height: 14px;"></i>
                </button>
              </h2>

              <!-- Metadados de Identidade Digital (Gaia ID e Contribuições) -->
              <div style="font-size: 0.8rem; color: var(--color-text-dim); display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-top: 6px;">
                ${
                  gaiaId
                    ? `<span>Google Gaia ID: <strong style="font-family: var(--font-mono); color: #A5F3FC;">${escapeHtml(gaiaId)}</strong>
                         <button type="button" class="btn-icon" data-copy="${escapeHtml(gaiaId)}" title="Copiar Gaia ID" style="background: transparent; border: none; color: var(--color-text-muted); cursor: pointer; padding: 0 2px;">
                           <i data-lucide="copy" style="width: 11px; height: 11px;"></i>
                         </button>
                       </span>`
                    : ""
                }

                ${
                  mapsContribUrl
                    ? `<a href="${escapeHtml(mapsContribUrl)}" target="_blank" rel="noopener noreferrer" style="color: #38BDF8; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; font-weight: 600;">
                         <i data-lucide="map" style="width: 12px; height: 12px;"></i> Ver Avaliações no Maps <i data-lucide="external-link" style="width: 10px; height: 10px;"></i>
                       </a>`
                    : ""
                }

                ${
                  ultimaEdicao
                    ? `<span>Atualização Google: <strong style="color: var(--color-text);">${Formatters.date(ultimaEdicao)}</strong></span>`
                    : ""
                }
              </div>

              <!-- Apps do Ecossistema Google Detectados -->
              ${
                appsAtivos.length > 0
                  ? `
                <div style="margin-top: 10px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                  <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; font-weight: 700; margin-right: 4px;">Serviços Ativos:</span>
                  ${appsAtivos.map(renderGoogleAppBadge).join("")}
                </div>
              `
                  : ""
              }
            </div>
          </div>

          <!-- Ações Rápidas de Topo -->
          <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
            <button 
              type="button" 
              class="btn btn-secondary btn-sm" 
              id="btnGerarRelatorioEmailDossie" 
              title="Gerar e Baixar Relatório Dark OSINT em PDF"
              style="display: inline-flex; align-items: center; gap: 6px; background: rgba(6, 182, 212, 0.15); color: #67E8F9; border: 1px solid rgba(6, 182, 212, 0.3); font-weight: 700; padding: 8px 14px;"
            >
              <i data-lucide="file-text" style="width: 14px; height: 14px;"></i>
              <span>Gerar Relatório (PDF)</span>
            </button>

            <button 
              type="button" 
              class="btn btn-secondary btn-sm" 
              data-copy="${escapeHtml(email)}" 
              title="Copiar E-mail Consultado"
              style="display: inline-flex; align-items: center; gap: 6px;"
            >
              <i data-lucide="copy" style="width: 14px; height: 14px;"></i>
              <span>Copiar E-mail</span>
            </button>
          </div>

        </div>

        <!-- Barra de Métricas e Totais -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--color-border);">
          <div style="background: rgba(255, 255, 255, 0.02); padding: 8px 12px; border-radius: 8px; border: 1px solid var(--color-border);">
            <div style="font-size: 0.7rem; color: var(--color-text-dim); text-transform: uppercase; font-weight: 700;">Titulares Vinculados</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: #FFFFFF; font-family: var(--font-mono); margin-top: 2px;">
              ${totalPersons} ${totalPersons === 1 ? 'Pessoa' : 'Pessoas'}
            </div>
          </div>

          <div style="background: rgba(255, 255, 255, 0.02); padding: 8px 12px; border-radius: 8px; border: 1px solid var(--color-border);">
            <div style="font-size: 0.7rem; color: var(--color-text-dim); text-transform: uppercase; font-weight: 700;">Vínculos Empresariais</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: #60A5FA; font-family: var(--font-mono); margin-top: 2px;">
              ${empresas.length} ${empresas.length === 1 ? 'Empresa' : 'Empresas'}
            </div>
          </div>

          <div style="background: rgba(255, 255, 255, 0.02); padding: 8px 12px; border-radius: 8px; border: 1px solid var(--color-border);">
            <div style="font-size: 0.7rem; color: var(--color-text-dim); text-transform: uppercase; font-weight: 700;">Veículos Identificados</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: #F59E0B; font-family: var(--font-mono); margin-top: 2px;">
              ${comVeiculosCount > 0 ? `${comVeiculosCount} c/ veículos` : '0 cadastrados'}
            </div>
          </div>

          <div style="background: rgba(255, 255, 255, 0.02); padding: 8px 12px; border-radius: 8px; border: 1px solid var(--color-border);">
            <div style="font-size: 0.7rem; color: var(--color-text-dim); text-transform: uppercase; font-weight: 700;">Auditoria de Vazamentos</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: ${isVulnerable ? '#EF4444' : '#10B981'}; font-family: var(--font-mono); margin-top: 2px;">
              ${isVulnerable ? `${totalVazamentos} Vazamento(s)` : 'Nenhum Vazamento'}
            </div>
          </div>
        </div>
      </div>

      <!-- ============================================================== -->
      <!-- FILTROS E BUSCA RÁPIDA DE TITULARES                            -->
      <!-- ============================================================== -->
      ${
        totalPersons > 0
          ? `
        <div class="card" style="margin-bottom: var(--space-4); padding: 12px 16px; background: var(--color-surface); border: 1px solid var(--color-border);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            
            <div style="flex: 1; min-width: 240px; position: relative;">
              <i data-lucide="search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 14px; height: 14px; color: var(--color-text-muted);"></i>
              <input 
                type="text" 
                id="filterEmailPersonsInput" 
                placeholder="Filtrar titulares por nome, dígitos do CPF, cidade ou profissão..." 
                style="width: 100%; padding: 8px 12px 8px 34px; background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: 6px; color: #FFFFFF; font-size: 0.85rem;"
              />
            </div>

            <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
              <button type="button" class="btn btn-xs btn-outline btn-filter-email active" data-filter="all">Todos (${totalPersons})</button>
              ${regularesCount > 0 ? `<button type="button" class="btn btn-xs btn-outline btn-filter-email" data-filter="regular">Regulares (${regularesCount})</button>` : ''}
              ${comVeiculosCount > 0 ? `<button type="button" class="btn btn-xs btn-outline btn-filter-email" data-filter="veiculos">Com Veículos (${comVeiculosCount})</button>` : ''}
              ${comCnhCount > 0 ? `<button type="button" class="btn btn-xs btn-outline btn-filter-email" data-filter="cnh">Com CNH (${comCnhCount})</button>` : ''}
            </div>

          </div>
        </div>
      `
          : ""
      }

      <!-- ============================================================== -->
      <!-- CARDS DETALHADOS DE CADA TITULAR VINCULADO AO E-MAIL           -->
      <!-- ============================================================== -->
      <div id="emailPersonsListContainer">
        ${
          persons.length === 0
            ? `
          <div class="card" style="text-align: center; padding: 36px 16px; background: var(--color-surface); margin-bottom: var(--space-4);">
            <i data-lucide="user-x" style="width: 42px; height: 42px; color: var(--color-text-dim); margin-bottom: 12px;"></i>
            <h4 style="color: var(--color-text-muted); margin: 0 0 6px 0;">Nenhum titular físico vinculado a este e-mail</h4>
            <p style="color: var(--color-text-dim); font-size: 0.85rem; max-width: 480px; margin: 0 auto;">
              O e-mail foi consultado na base de dados, porém nenhum CPF ou pessoa física direta possui cadastro atrelado a este endereço no momento.
            </p>
          </div>
        `
            : persons.map((p, idx) => this.renderPersonCard(p, idx, photoUrl)).join("")
        }
      </div>

      <!-- ============================================================== -->
      <!-- SEÇÃO DE EMPRESAS VINCULADAS (PJ)                              -->
      <!-- ============================================================== -->
      ${this.renderEmpresasSection(empresas)}

      <!-- ============================================================== -->
      <!-- AUDITORIA DE SEGURANÇA: VAZAMENTOS & SENHAS                    -->
      <!-- ============================================================== -->
      ${this.renderVazamentosSection(vazamentos, seguranca)}
    `;
  },

  /**
   * Renders an individual titular person card with complete civil, vehicular, and contact data
   * @param {Object} p - Person DTO
   * @param {number} idx - Index
   * @param {string|null} fallbackPhoto
   * @returns {string} HTML markup
   */
  renderPersonCard(p, idx, fallbackPhoto) {
    const rawCpf = String(p.raw_cpf || p.cpf || "").replace(/\D/g, "");
    const formattedCpf = p.cpf_formatado || Formatters.cpf(rawCpf);
    const nome = String(p.name || p.nome || p.nome_completo || "Titular Vinculado").toUpperCase();

    const situacao = String(p.situacao_receita || p.situacaoCadastral || p.status || "REGULAR").toUpperCase();
    const isFalecido = p.falecido === true || situacao.includes("FALECIDO");
    const rawBirth = p.birth_date || p.nascimento || null;
    const dataNascimento = p.nascimento_formatado || (rawBirth ? Formatters.date(String(rawBirth).split(" ")[0]) : "Não informado");
    const calcAge = rawBirth ? Formatters.age(String(rawBirth).split(" ")[0]) : null;
    const idade = p.idade ? `${p.idade} anos` : (calcAge !== null ? `${calcAge} anos` : "");
    const signo = p.signo ? `&bull; ${p.signo}` : "";

    const nomeMae = String(p.mother_name || p.nomeMae || p.nome_mae || "Não informada").toUpperCase();
    const nomePai = String(p.father_name || p.nomePai || p.nome_pai || "Não informado").toUpperCase();
    const renda = p.renda_formatada || p.rendaPresumida || (p.income ? Formatters.currency(p.income) : (p.renda ? (typeof p.renda === "number" ? Formatters.currency(p.renda) : p.renda) : "Não estimada"));
    const profissao = String(p.occupation || p.profissao || p.cbo || "Não informada");

    // Documents
    const rg = p.rg || p.rgEmissor || (p.rg_issuer ? `${p.rg_issuer}` : "Não consta");
    const tituloEleitor = p.voter_id || p.titulo_eleitor || p.tituloEleitor || p.titulo || "Não consta";
    const cnhObj = p.cnh || (p.numero_cnh ? { numero: p.numero_cnh, uf: p.uf_cnh } : null);

    // Phones
    const telefones = Array.isArray(p.telefones)
      ? p.telefones
      : Array.isArray(p.phones)
        ? p.phones
        : p.phone
          ? [p.phone]
          : [];

    // Addresses
    const endereco = p.endereco_principal || p.endereco_completo || p.address || p.endereco || (Array.isArray(p.enderecos) ? p.enderecos[0] : null) || null;
    let enderecoTexto = "";
    if (endereco && typeof endereco === "object") {
      const parts = [
        endereco.street || endereco.logradouro,
        endereco.number || endereco.numero ? `Nº ${endereco.number || endereco.numero}` : null,
        endereco.neighborhood || endereco.bairro,
        endereco.city || endereco.cidade ? `${endereco.city || endereco.cidade}/${endereco.state || endereco.uf || ""}` : null,
        endereco.zip_code || endereco.cep ? `CEP: ${Formatters.cep(endereco.zip_code || endereco.cep)}` : null,
      ].filter(Boolean);
      if (parts.length > 0) enderecoTexto = parts.join(" - ");
    } else if (typeof endereco === "string" && endereco.trim()) {
      enderecoTexto = endereco.trim();
    }

    // Vehicles
    const veiculos = Array.isArray(p.veiculos) ? p.veiculos : Array.isArray(p.vehicles) ? p.vehicles : [];

    // Additional Emails
    const emailsList = Array.isArray(p.emails) ? p.emails : p.email ? [p.email] : [];

    // Sources & Operators
    const sources = Array.isArray(p.sources) ? p.sources : (p.source ? [p.source] : []);
    const operadoras = Array.isArray(p.operadoras) ? p.operadoras : [];

    const personPhoto = p.foto_url || p.foto_google || p.foto || p.foto_perfil || fallbackPhoto;

    // Search query attributes
    const searchTokens = [
      nome,
      rawCpf,
      formattedCpf,
      p.city || p.cidade || "",
      p.state || p.uf || "",
      profissao,
    ].join(" ").toLowerCase();

    return `
      <div 
        class="card card-email-person" 
        data-search="${escapeHtml(searchTokens)}"
        data-status="${isFalecido ? 'falecido' : 'regular'}"
        data-has-veiculos="${veiculos.length > 0}"
        data-has-cnh="${Boolean(cnhObj && (cnhObj.numero || cnhObj.num_cnh))}"
        style="margin-bottom: var(--space-4); background: #0D111A; border: 1px solid #1E2538; border-left: 4px solid ${isFalecido ? '#EF4444' : '#06B6D4'}; border-radius: 10px; padding: 20px; transition: transform 0.15s ease, border-color 0.15s ease;"
      >
        <!-- TOPO DO CARD DE TITULAR -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 14px; margin-bottom: 16px;">
          
          <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
            <!-- Avatar do Titular -->
            <div style="width: 52px; height: 52px; border-radius: 10px; background: #080B11; border: 1px solid #1E2538; overflow: hidden; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              ${
                personPhoto
                  ? `<img src="${personPhoto}" alt="${escapeHtml(nome)}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                     <div style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center; color: #06B6D4;">
                       <i data-lucide="user" style="width: 24px; height: 24px;"></i>
                     </div>`
                  : `<div style="color: #06B6D4; display: flex; align-items: center; justify-content: center;">
                       <i data-lucide="user" style="width: 24px; height: 24px;"></i>
                     </div>`
              }
            </div>

            <div>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px;">
                <span class="badge" style="background: rgba(6, 182, 212, 0.15); color: #67E8F9; font-weight: 700; font-size: 0.72rem;">
                  TITULAR VINCULADO #${idx + 1}
                </span>

                <span class="badge" style="background: ${isFalecido ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)'}; color: ${isFalecido ? '#F87171' : '#6EE7B7'}; font-weight: 700; font-size: 0.72rem;">
                  <i data-lucide="${isFalecido ? 'alert-triangle' : 'check-circle'}" style="width: 11px; height: 11px;"></i>
                  ${escapeHtml(situacao)}
                </span>

                ${
                  p.email_score
                    ? `<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #34D399; font-weight: 700; font-size: 0.72rem;">
                         Score E-mail: ${escapeHtml(p.email_score)}
                       </span>`
                    : ""
                }

                ${
                  p.city || p.cidade
                    ? `<span class="badge" style="background: rgba(255, 255, 255, 0.05); color: var(--color-text-muted); font-size: 0.72rem;">
                         ${escapeHtml(p.city || p.cidade)}${p.state || p.uf ? `/${escapeHtml(p.state || p.uf)}` : ''}
                       </span>`
                    : ""
                }
              </div>

              <h3 style="font-size: 1.15rem; font-weight: 800; color: #FFFFFF; margin: 0; letter-spacing: -0.01em;">
                ${escapeHtml(nome)}
              </h3>
            </div>
          </div>

          <!-- Ações Rápidas do Titular -->
          <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
            ${
              rawCpf
                ? `
              <button 
                type="button" 
                class="btn btn-sm btn-primary btn-puxar-cpf-item" 
                data-cpf="${rawCpf}" 
                title="Abrir Dossiê Completo de Pessoa Física para este CPF"
                style="display: inline-flex; align-items: center; gap: 6px; font-weight: 700; background: #06B6D4; color: #080B11; border: none; padding: 6px 12px; border-radius: 6px;"
              >
                <i data-lucide="shield-search" style="width: 13px; height: 13px;"></i>
                <span>Puxar CPF</span>
              </button>

              <button 
                type="button" 
                class="btn btn-sm btn-secondary" 
                data-copy="${rawCpf}" 
                title="Copiar CPF limpo"
                style="display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px;"
              >
                <i data-lucide="copy" style="width: 12px; height: 12px;"></i>
                <span>Copiar CPF</span>
              </button>
            `
                : ""
            }

            <button 
              type="button" 
              class="btn btn-sm btn-secondary btn-puxar-nome-item" 
              data-nome="${escapeHtml(nome)}" 
              title="Pesquisar por este Nome Completo"
              style="display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px;"
            >
              <i data-lucide="user-search" style="width: 12px; height: 12px;"></i>
              <span>Puxar Nome</span>
            </button>
          </div>

        </div>

        <!-- GRID DE DADOS CIVIS E CADASTRAIS -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; padding: 14px; background: #080B11; border: 1px solid #1E2538; border-radius: 8px; margin-bottom: 14px;">
          <div>
            <span style="font-size: 0.7rem; color: #94A3B8; text-transform: uppercase; display: block; margin-bottom: 2px;">CPF</span>
            <strong style="font-family: var(--font-mono); color: #67E8F9; font-size: 0.95rem;">${formattedCpf}</strong>
          </div>

          <div>
            <span style="font-size: 0.7rem; color: #94A3B8; text-transform: uppercase; display: block; margin-bottom: 2px;">Nascimento / Idade</span>
            <span style="font-size: 0.88rem; color: #F1F5F9;">
              ${dataNascimento} ${idade ? `<strong style="color: #A5F3FC;">(${idade})</strong>` : ''}
            </span>
          </div>

          <div>
            <span style="font-size: 0.7rem; color: #94A3B8; text-transform: uppercase; display: block; margin-bottom: 2px;">Nome da Mãe</span>
            <span style="font-size: 0.85rem; color: #F1F5F9;">${escapeHtml(nomeMae)}</span>
          </div>

          <div>
            <span style="font-size: 0.7rem; color: #94A3B8; text-transform: uppercase; display: block; margin-bottom: 2px;">Renda Estimada</span>
            <strong style="color: #10B981; font-size: 0.92rem; font-family: var(--font-mono);">${renda}</strong>
          </div>

          <div>
            <span style="font-size: 0.7rem; color: #94A3B8; text-transform: uppercase; display: block; margin-bottom: 2px;">Profissão / Cargo</span>
            <span style="font-size: 0.85rem; color: #F1F5F9;">${escapeHtml(profissao)}</span>
          </div>

          <div>
            <span style="font-size: 0.7rem; color: #94A3B8; text-transform: uppercase; display: block; margin-bottom: 2px;">Título de Eleitor</span>
            <span style="font-size: 0.85rem; font-family: var(--font-mono); color: #F1F5F9;">${escapeHtml(tituloEleitor)}</span>
          </div>

          <div>
            <span style="font-size: 0.7rem; color: #94A3B8; text-transform: uppercase; display: block; margin-bottom: 2px;">CNH / Habilitação</span>
            <span style="font-size: 0.85rem; font-family: var(--font-mono); color: #F1F5F9;">
              ${cnhObj && (cnhObj.numero || cnhObj.num_cnh) ? `${cnhObj.numero || cnhObj.num_cnh} ${cnhObj.uf ? `(${cnhObj.uf})` : ''}` : 'Não consta'}
            </span>
          </div>

          <div>
            <span style="font-size: 0.7rem; color: #94A3B8; text-transform: uppercase; display: block; margin-bottom: 2px;">RG / Documento</span>
            <span style="font-size: 0.85rem; font-family: var(--font-mono); color: #F1F5F9;">${escapeHtml(rg)}</span>
          </div>
        </div>

        <!-- TELEFONES & LINHAS DE CONTATO VINCULADAS -->
        ${
          telefones.length > 0
            ? `
          <div style="margin-bottom: 14px; background: rgba(255, 255, 255, 0.015); border: 1px solid #1E2538; border-radius: 8px; padding: 12px 14px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
              <span style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
                <i data-lucide="phone" style="width: 12px; height: 12px; color: #8B5CF6;"></i>
                Telefones Vinculados (${telefones.length})
              </span>
              ${
                operadoras.length > 0
                  ? `<div style="display: flex; gap: 4px;">${operadoras.map((op) => `<span class="badge" style="background: rgba(139, 92, 246, 0.15); color: #C4B5FD; font-size: 0.68rem;">${escapeHtml(op)}</span>`).join("")}</div>`
                  : ""
              }
            </div>

            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              ${telefones
                .map((tel) => {
                  const rawTel = typeof tel === "object" ? String(tel.numero || tel.phone || tel.telefone || "").replace(/\D/g, "") : String(tel).replace(/\D/g, "");
                  const fmtTel = (typeof tel === "object" && tel.formatado) ? tel.formatado : (Formatters.phone("", rawTel) || rawTel);
                  return `
                    <div style="background: #080B11; border: 1px solid #1E2538; border-radius: 6px; padding: 4px 8px; display: inline-flex; align-items: center; gap: 6px;">
                      <span style="font-family: var(--font-mono); font-size: 0.82rem; color: #E2E8F0;">${escapeHtml(fmtTel)}</span>
                      <button type="button" class="btn-icon" data-copy="${escapeHtml(rawTel)}" title="Copiar Telefone" style="background: transparent; border: none; color: var(--color-text-muted); cursor: pointer; padding: 2px;">
                        <i data-lucide="copy" style="width: 11px; height: 11px;"></i>
                      </button>
                      <button type="button" class="btn-icon btn-puxar-tel-item" data-telefone="${escapeHtml(rawTel)}" title="Investigar Telefone" style="background: transparent; border: none; color: #8B5CF6; cursor: pointer; padding: 2px;">
                        <i data-lucide="search" style="width: 11px; height: 11px;"></i>
                      </button>
                    </div>
                  `;
                })
                .join("")}
            </div>
          </div>
        `
            : ""
        }

        <!-- VEÍCULOS REGISTRADOS -->
        ${
          veiculos.length > 0
            ? `
          <div style="margin-bottom: 14px; background: rgba(255, 255, 255, 0.015); border: 1px solid #1E2538; border-radius: 8px; padding: 12px 14px;">
            <div style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase; font-weight: 700; margin-bottom: 8px; display: inline-flex; align-items: center; gap: 6px;">
              <i data-lucide="car" style="width: 12px; height: 12px; color: #F59E0B;"></i>
              Veículos Cadastrados (${veiculos.length})
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px;">
              ${veiculos
                .map((veh) => {
                  const placa = String(veh.plate || veh.placa || "N/A").toUpperCase().trim();
                  const renavam = veh.renavam || "N/I";
                  const ano = Array.isArray(veh.years) ? veh.years.join("/") : veh.year || veh.ano || "N/I";
                  return `
                    <div style="background: #080B11; border: 1px solid #1E2538; border-radius: 6px; padding: 8px 10px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                      <div>
                        <div style="font-family: var(--font-mono); font-weight: 800; font-size: 0.95rem; color: #F59E0B; letter-spacing: 0.05em;">
                          ${escapeHtml(placa)}
                        </div>
                        <div style="font-size: 0.72rem; color: var(--color-text-dim);">
                          Ano: ${escapeHtml(ano)} &bull; Renavam: ${escapeHtml(renavam)}
                        </div>
                      </div>
                      ${
                        placa && placa !== "N/A"
                          ? `
                        <button 
                          type="button" 
                          class="btn btn-xs btn-outline btn-puxar-placa-item" 
                          data-placa="${escapeHtml(placa)}" 
                          title="Puxar Ficha Completa do Veículo"
                          style="border-color: #F59E0B; color: #F59E0B; display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px;"
                        >
                          <i data-lucide="search" style="width: 10px; height: 10px;"></i>
                          <span>Puxar</span>
                        </button>
                      `
                          : ""
                      }
                    </div>
                  `;
                })
                .join("")}
            </div>
          </div>
        `
            : ""
        }

        <!-- ENDEREÇO & E-MAILS ADICIONAIS -->
        ${
          enderecoTexto || emailsList.length > 0
            ? `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px;">
          <!-- Endereço -->
          ${
            enderecoTexto
              ? `
          <div style="background: #080B11; border: 1px solid #1E2538; border-radius: 6px; padding: 10px 12px;">
            <span style="font-size: 0.7rem; color: #94A3B8; text-transform: uppercase; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; margin-bottom: 4px;">
              <i data-lucide="map-pin" style="width: 11px; height: 11px; color: #06B6D4;"></i> Endereço Cadastral
            </span>
            <div style="font-size: 0.82rem; color: #E2E8F0; line-height: 1.4;">
              ${escapeHtml(enderecoTexto)}
            </div>
          </div>
          `
              : ""
          }

          <!-- Outros E-mails Vinculados -->
          ${
            emailsList.length > 0
              ? `
            <div style="background: #080B11; border: 1px solid #1E2538; border-radius: 6px; padding: 10px 12px;">
              <span style="font-size: 0.7rem; color: #94A3B8; text-transform: uppercase; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; margin-bottom: 4px;">
                <i data-lucide="mail" style="width: 11px; height: 11px; color: #F472B6;"></i> E-mails Cadastrais (${emailsList.length})
              </span>
              <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px;">
                ${emailsList
                  .map(
                    (em) => `
                  <span style="background: #181F2E; color: #F472B6; font-family: var(--font-mono); font-size: 0.75rem; padding: 3px 8px; border-radius: 4px; border: 1px solid #2A364F;">
                    ${escapeHtml(em)}
                  </span>
                `
                  )
                  .join("")}
              </div>
            </div>
          `
              : ""
          }
        </div>
        `
            : ""
        }

        <!-- FONTES AUDITADAS -->
        ${
          sources.length > 0
            ? `
          <div style="margin-top: 12px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            <span style="font-size: 0.7rem; color: var(--color-text-dim); text-transform: uppercase; font-weight: 700;">Fontes:</span>
            ${sources
              .map(
                (src) => `
              <span class="badge" style="background: rgba(255, 255, 255, 0.04); color: var(--color-text-muted); font-size: 0.68rem; padding: 2px 7px;">
                ${escapeHtml(src)}
              </span>
            `
              )
              .join("")}
          </div>
        `
            : ""
        }
      </div>
    `;
  },

  /**
   * Renders the corporate / companies section
   * @param {Array<Object>} empresas
   * @returns {string} HTML markup
   */
  renderEmpresasSection(empresas) {
    if (!Array.isArray(empresas) || empresas.length === 0) {
      return "";
    }

    return `
      <div class="card" style="margin-bottom: var(--space-4); background: var(--color-surface); border: 1px solid var(--color-border); padding: 18px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px;">
          <i data-lucide="briefcase" style="width: 16px; height: 16px; color: #60A5FA;"></i>
          <h4 style="font-size: 1rem; font-weight: 700; color: #FFFFFF; margin: 0;">
            Vínculos Empresariais Vinculados ao E-mail (${empresas.length})
          </h4>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px;">
          ${empresas
            .map((emp) => {
              const cnpj = emp.cnpj_formatado || Formatters.cnpj(emp.cnpj);
              const rawCnpj = String(emp.cnpj || "").replace(/\D/g, "");
              const razao = emp.razao_social || emp.razaoSocial || emp.nome || "Razão Social não informada";
              const situacao = emp.situacao || emp.status || "ATIVA";
              const qual = emp.qualificacao || emp.qualificacao_socio || "SÓCIO / TITULAR";

              return `
                <div style="background: #080B11; border: 1px solid #1E2538; border-radius: 8px; padding: 14px;">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 6px;">
                    <span class="badge" style="background: rgba(96, 165, 250, 0.15); color: #60A5FA; font-weight: 700; font-size: 0.72rem;">
                      ${escapeHtml(situacao)}
                    </span>
                    ${
                      rawCnpj
                        ? `
                      <button 
                        type="button" 
                        class="btn btn-xs btn-outline btn-puxar-cnpj-item" 
                        data-cnpj="${rawCnpj}" 
                        title="Puxar Ficha Completa do CNPJ"
                        style="border-color: #60A5FA; color: #60A5FA; display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px;"
                      >
                        <i data-lucide="search" style="width: 10px; height: 10px;"></i>
                        <span>Puxar CNPJ</span>
                      </button>
                    `
                        : ""
                    }
                  </div>

                  <strong style="color: #FFFFFF; font-size: 0.92rem; display: block; margin-bottom: 4px;">
                    ${escapeHtml(razao)}
                  </strong>

                  <div style="font-size: 0.82rem; font-family: var(--font-mono); color: #94A3B8; margin-bottom: 4px;">
                    CNPJ: <span style="color: #67E8F9;">${cnpj}</span>
                  </div>

                  <div style="font-size: 0.75rem; color: var(--color-text-dim);">
                    Vínculo: <strong>${escapeHtml(qual)}</strong>
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
      </div>
    `;
  },

  /**
   * Renders the security audit & credentials breach section
   * @param {Array<Object>} vazamentos
   * @param {Object} seguranca
   * @returns {string} HTML markup
   */
  renderVazamentosSection(vazamentos, seguranca) {
    const total = vazamentos.length;
    const isVulnerable = total > 0;
    if (!isVulnerable) return "";

    return `
      <div class="card" style="margin-bottom: var(--space-4); background: var(--color-surface); border: 1px solid ${isVulnerable ? '#EF4444' : 'var(--color-border)'}; padding: 18px;">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <i data-lucide="${isVulnerable ? 'shield-alert' : 'shield-check'}" style="width: 18px; height: 18px; color: ${isVulnerable ? '#EF4444' : '#10B981'};"></i>
            <h4 style="font-size: 1rem; font-weight: 700; color: #FFFFFF; margin: 0;">
              Auditoria de Segurança & Exposição de Credenciais
            </h4>
          </div>

          <span class="badge" style="background: ${isVulnerable ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)'}; color: ${isVulnerable ? '#F87171' : '#6EE7B7'}; font-weight: 700;">
            ${isVulnerable ? `${total} Incidente(s) Encontrado(s)` : 'Nenhum Vazamento Registrado'}
          </span>
        </div>

        ${
          !isVulnerable
            ? `
          <div style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px; padding: 14px; display: flex; align-items: center; gap: 12px;">
            <i data-lucide="check-circle-2" style="width: 24px; height: 24px; color: #10B981; flex-shrink: 0;"></i>
            <div style="font-size: 0.85rem; color: #E2E8F0; line-height: 1.4;">
              Este endereço de e-mail foi auditado contra os bancos de dados de vazamentos públicos e <strong>não possui credenciais ou senhas em texto claro expostas</strong>.
            </div>
          </div>
        `
            : `
          <div style="display: grid; gap: 10px;">
            ${vazamentos
              .map((vz) => {
                const titulo = vz.titulo || vz.fonte || vz.breach || "Vazamento Público";
                const alvo = vz.alvo || vz.email || "";
                const dataVazamento = vz.data || vz.date ? Formatters.date(vz.data || vz.date) : "Data não informada";
                const senha = vz.senha || vz.password || null;

                return `
                  <div style="background: #080B11; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div>
                      <strong style="color: #EF4444; font-size: 0.92rem;">${escapeHtml(titulo)}</strong>
                      <div style="font-size: 0.8rem; color: #94A3B8; margin-top: 2px;">
                        Alvo: <span style="font-family: var(--font-mono); color: #F1F5F9;">${escapeHtml(alvo)}</span> &bull; Data: ${dataVazamento}
                      </div>
                    </div>

                    ${
                      senha
                        ? `<span class="badge" style="background: rgba(239, 68, 68, 0.2); color: #FCA5A5; font-family: var(--font-mono); font-weight: 700;">
                             Senha Exposta: ${escapeHtml(senha)}
                           </span>`
                        : ""
                    }
                  </div>
                `;
              })
              .join("")}
          </div>
        `
        }
      </div>
    `;
  },
};

export default EmailInterpreter;
