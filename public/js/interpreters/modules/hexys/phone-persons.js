/**
 * ==============================================================================
 * HEXYS API INTERPRETER - PHONE & MULTI-PERSON RECORDS (PHONE-PERSONS.JS)
 * Visual renderer for telephone lookups returning one or multiple associated
 * individuals (titulars, historical records, and co-registrations).
 *
 * Features:
 *  - Real-time search by Name, partial CPF digits (e.g. 886, 143), city, occupation
 *  - Interactive filter pills (Todos, Apenas Regulares, Falecidos, Com Veículos, Com Empresas)
 *  - Comprehensive dark-theme cards with civil data, addresses, vehicles, and QSA
 *  - Individual and bulk intelligence dossier reports with Dark Mode print support
 *
 * Clean Code standards with English identifiers and strict null-safety.
 * ==============================================================================
 */

import { Formatters, escapeHtml } from "../../utils.js";

/**
 * Extracts list of persons from various raw API shapes (Arrays, indexed objects, resultado wrapper)
 * @param {any} payload
 * @param {Object} responseData
 * @returns {Array<Object>}
 */
export function extractPersonsList(payload, responseData) {
  if (!payload && !responseData) return [];

  // 1. Check payload.pessoas or payload.pessoas_vinculadas (already normalized array)
  if (Array.isArray(payload?.pessoas)) return payload.pessoas;
  if (Array.isArray(payload?.pessoas_vinculadas)) return payload.pessoas_vinculadas;

  // 2. Check indexed objects (e.g. { "0": {...}, "1": {...}, "2": {...} }) which contain the rich details
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const numericKeys = Object.keys(payload).filter((k) => /^\d+$/.test(k));
    if (numericKeys.length > 0) {
      numericKeys.sort((a, b) => Number(a) - Number(b));
      const extracted = numericKeys.map((k) => payload[k]).filter(Boolean);
      if (extracted.some((p) => p && typeof p === "object" && (p.cpf || p.name || p.nome))) {
        return extracted;
      }
    }

    // Object where values are person records
    const personValues = Object.values(payload).filter(
      (v) => v && typeof v === "object" && (v.cpf || v.name || v.nome)
    );
    if (personValues.length > 0) {
      return personValues;
    }
  }

  // 3. Direct array in payload
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.resultado)) return payload.resultado;
  if (Array.isArray(payload?.resultados)) return payload.resultados;
  if (Array.isArray(payload?.data)) return payload.data;

  // 4. Check responseData.raw
  if (Array.isArray(responseData?.raw?.resultado)) return responseData.raw.resultado;
  if (Array.isArray(responseData?.raw?.resultados)) return responseData.raw.resultados;
  if (Array.isArray(responseData?.raw?.data)) return responseData.raw.data;

  // 5. Single person object or titular record
  if (payload && typeof payload === "object") {
    if (payload.name || payload.nome || payload.cpf || payload.titularNome || payload.titularCpf) {
      return [
        {
          ...payload,
          nome: payload.nome || payload.name || payload.titularNome,
          name: payload.name || payload.nome || payload.titularNome,
          cpf: payload.cpf || payload.titularCpf,
          cpf_masked: payload.cpf_masked || payload.cpf || payload.titularCpf,
        },
      ];
    }
  }

  return [];
}

export const PhonePersonsInterpreter = {
  /**
   * Renders multi-person telephony search results
   * @param {Object} responseData - Complete response object from backend
   * @param {Object} dataPayload - Extracted data payload
   * @returns {string} HTML markup
   */
  render(responseData, dataPayload) {
    const rawNumber = String(
      responseData?.termo || dataPayload?.clean_phone || dataPayload?.telefone || ""
    );
    const formattedPhone = Formatters.phone("", rawNumber) || rawNumber || "Telefone Consultado";
    const persons = extractPersonsList(dataPayload, responseData);

    // Metadata counts for filter pills
    const totalCount = persons.length;
    let regularesCount = 0;
    let falecidosCount = 0;
    let comVeiculosCount = 0;
    let comEmpresasCount = 0;
    let comEmailsCount = 0;

    persons.forEach((p) => {
      const situacao = String(p.situacao_receita || p.situacaoCadastral || p.status || "").toUpperCase();
      const isFalecido = p.falecido === true || situacao.includes("FALECIDO");
      if (isFalecido) falecidosCount++;
      else if (situacao === "REGULAR" || situacao === "") regularesCount++;

      const veiculos = Array.isArray(p.veiculos) ? p.veiculos : Array.isArray(p.vehicles) ? p.vehicles : [];
      if (veiculos.length > 0) comVeiculosCount++;

      const empresas = Array.isArray(p.empresas_vinculadas) ? p.empresas_vinculadas : Array.isArray(p.empresas) ? p.empresas : [];
      if (empresas.length > 0) comEmpresasCount++;

      const emails = Array.isArray(p.emails) ? p.emails : p.email ? [p.email] : [];
      if (emails.length > 0) comEmailsCount++;
    });

    const operadora = dataPayload?.operadora || responseData?.dados?.operadora || "Não informada";
    const credits = responseData?.remainingCredits ?? null;

    return `
      <!-- ============================================================== -->
      <!-- CABEÇALHO DA CONSULTA DE TELEFONIA & TITULARES                 -->
      <!-- ============================================================== -->
      <div class="card osint-section-card osint-section-card--purple" style="background: radial-gradient(circle at 95% 10%, rgba(139, 92, 246, 0.12) 0%, transparent 70%), var(--color-surface);">
        <div class="osint-person-top">
          <div>
            <div class="osint-chip-row mb-4" style="margin-bottom: 6px;">
              <span class="badge badge-purple">
                <i data-lucide="phone-call" class="icon-xs"></i> TELEFONIA & VÍNCULOS CADASTRAIS
              </span>
              <span class="badge badge-dark">
                ${totalCount} ${totalCount === 1 ? "Titular Localizado" : "Titulares / Vínculos Localizados"}
              </span>
              ${operadora && operadora !== "Não informada" ? `<span class="badge badge-blue">Operadora: ${escapeHtml(operadora)}</span>` : ""}
            </div>

            <h2 class="osint-person-name text-mono">
              ${escapeHtml(formattedPhone)}
            </h2>
            <p class="osint-page-subtitle">
              Cruzamento de dados entre bases de telecomunicações, birôs de crédito e registros cadastrais federais.
            </p>
          </div>

          <!-- AÇÕES DO TOPO: RELATÓRIO & EXPORTAÇÃO -->
          <div class="osint-toolbar-group">
            <button type="button" class="btn btn-primary btn-sm btn-osint-violet btn-gerar-relatorio-geral">
              <i data-lucide="file-text" class="icon-sm"></i>
              <span>Gerar Relatório OSINT</span>
            </button>
            <button type="button" class="btn btn-outline btn-sm btn-copiar-todos-cpfs" title="Copiar lista de CPFs">
              <i data-lucide="copy" class="icon-xs"></i>
              <span>Copiar CPFs</span>
            </button>
          </div>
        </div>

        <!-- ============================================================== -->
        <!-- BARRA DE PESQUISA & FILTROS EM TEMPO REAL                      -->
        <!-- ============================================================== -->
        <div class="mt-5" style="padding-top: var(--space-4); border-top: 1px solid var(--color-border);">
          <div class="osint-toolbar" style="margin-bottom: 0;">
            <!-- Campo de Busca em Tempo Real (Nome ou Dígitos do CPF) -->
            <div class="input-search-wrap" style="min-width: 280px;">
              <i data-lucide="search"></i>
              <input 
                type="text" 
                id="inputFiltroPessoasTelefone" 
                class="input-search"
                placeholder="Buscar por nome, dígitos do CPF (ex: 886, 143), cidade..." 
              >
            </div>

            <!-- Contador de Resultados Visíveis -->
            <div style="font-size: 0.8125rem; color: var(--color-text-muted);">
              Exibindo <strong id="contadorPessoasVisiveis" class="osint-kv-value--mint">${totalCount}</strong> de ${totalCount} registros
            </div>
          </div>

          <!-- Pílulas de Filtro Rápido -->
          <div class="filtros-pills-container osint-chip-row mt-3">
            <button type="button" class="btn-filtro-pill active" data-filter="todos">
              Todos (${totalCount})
            </button>
            <button type="button" class="btn-filtro-pill" data-filter="regular">
              Regulares (${regularesCount})
            </button>
            ${falecidosCount > 0 ? `<button type="button" class="btn-filtro-pill btn-filtro-pill--danger" data-filter="falecido">Falecidos (${falecidosCount})</button>` : ""}
            ${comVeiculosCount > 0 ? `<button type="button" class="btn-filtro-pill" data-filter="veiculos">Com Veículos (${comVeiculosCount})</button>` : ""}
            ${comEmpresasCount > 0 ? `<button type="button" class="btn-filtro-pill" data-filter="empresas">Com Empresas (${comEmpresasCount})</button>` : ""}
            ${comEmailsCount > 0 ? `<button type="button" class="btn-filtro-pill" data-filter="emails">Com E-mail (${comEmailsCount})</button>` : ""}
          </div>
        </div>
      </div>

      <!-- ============================================================== -->
      <!-- LISTA DE CARDS DAS PESSOAS ENCONTRADAS                         -->
      <!-- ============================================================== -->
      <div id="listaCardsPessoasTelefone" style="display: flex; flex-direction: column; gap: var(--space-4);">
        ${persons
          .map((p, idx) => {
            const rawCpf = String(p.cpf || "").replace(/\D/g, "");
            const formattedCpf = Formatters.cpf(rawCpf);
            const nome = p.name || p.nome || "Nome não informado";
            const birthDate = Formatters.date(p.birth_date || p.dataNascimento || p.nascimento);
            const age = Formatters.age(p.birth_date || p.dataNascimento || p.nascimento);
            const mother = p.mother_name || p.nomeMae || p.nome_mae || "Não informada";
            const father = p.father_name || p.nomePai || p.nome_pai || null;
            const situacaoReceita = String(p.situacao_receita || p.situacaoCadastral || p.status || "REGULAR").toUpperCase();
            const isFalecido = p.falecido === true || situacaoReceita.includes("FALECIDO");
            const occupation = p.occupation || p.profissao || "Não informada";
            const incomeVal = p.income || p.renda || null;
            const incomeFmt = incomeVal ? Formatters.currency(incomeVal) : "N/I";

            // Endereço
            const addr = p.address || p.endereco || {};
            const street = addr.street || addr.logradouro || "";
            const number = addr.number || addr.numero || "S/N";
            const neighborhood = addr.neighborhood || addr.bairro || "";
            const city = addr.city || addr.cidade || p.city || p.cidade || "";
            const state = addr.state || addr.uf || p.state || p.uf || "";
            const cep = Formatters.cep(addr.zip_code || addr.cep);
            const fullAddress = [
              street ? `${street}, ${number}` : "",
              neighborhood,
              city ? `${city} - ${state}` : state,
              cep && cep !== "Não informado" ? `CEP ${cep}` : "",
            ]
              .filter(Boolean)
              .join(" • ") || "Endereço não cadastrado";

            // Telefones
            const phonesList = Array.isArray(p.telefones)
              ? p.telefones
              : Array.isArray(p.phones)
                ? p.phones
                : p.phone
                  ? [p.phone]
                  : [];
            const cleanPhones = Array.from(
              new Set(phonesList.map((ph) => String(ph).replace(/\D/g, "")).filter(Boolean))
            );

            // E-mails
            const emailsList = Array.isArray(p.emails)
              ? p.emails
              : p.email
                ? [p.email]
                : [];

            // Veículos
            const veiculosList = Array.isArray(p.veiculos)
              ? p.veiculos
              : Array.isArray(p.vehicles)
                ? p.vehicles
                : [];

            // Empresas
            const empresasList = Array.isArray(p.empresas_vinculadas)
              ? p.empresas_vinculadas
              : Array.isArray(p.empresas)
                ? p.empresas
                : [];

            // Search tags for instant filtering (Name, raw CPF, formatted CPF, city, state, occupation, mother)
            const searchIndex = `${nome.toLowerCase()} ${rawCpf} ${formattedCpf} ${city.toLowerCase()} ${state.toLowerCase()} ${occupation.toLowerCase()} ${mother.toLowerCase()}`;

            return `
            <div 
              class="card card-item-pessoa-telefone osint-person-card ${isFalecido ? "osint-person-card--falecido" : ""}" 
              data-search="${escapeHtml(searchIndex)}"
              data-status="${isFalecido ? "falecido" : situacaoReceita === "REGULAR" ? "regular" : "outro"}"
              data-has-veiculos="${veiculosList.length > 0 ? "true" : "false"}"
              data-has-empresas="${empresasList.length > 0 ? "true" : "false"}"
              data-has-emails="${emailsList.length > 0 ? "true" : "false"}"
            >
              <!-- Top Row: Titular Index, Status and Actions -->
              <div class="osint-person-top">
                <div>
                  <div class="osint-chip-row" style="margin-bottom: 6px;">
                    <span class="badge badge-purple">
                      #${idx + 1} • TITULAR VINCULADO
                    </span>
                    ${
                      isFalecido
                        ? `<span class="badge badge-red">
                            <i data-lucide="alert-octagon" class="icon-xs"></i> TITULAR FALECIDO
                           </span>`
                        : `<span class="badge badge-success">
                            <i data-lucide="check-circle-2" class="icon-xs"></i> REGULAR NA RECEITA
                           </span>`
                    }
                    <span class="badge badge-dark">PF</span>
                  </div>

                  <h3 class="osint-person-name">
                    ${escapeHtml(nome)}
                  </h3>

                  <div class="osint-cpf-row">
                    <span class="osint-cpf-code">${formattedCpf}</span>
                    <button type="button" class="btn btn-ghost btn-copy-inline btn-copiar-cpf" data-cpf="${rawCpf}" title="Copiar CPF">
                      <i data-lucide="copy" class="icon-xs"></i>
                    </button>
                  </div>
                </div>

                <!-- Botões de Ação Direta no Card -->
                <div class="osint-toolbar-group">
                  <button type="button" class="btn btn-primary btn-sm btn-puxar-cpf-item" data-cpf="${rawCpf}" title="Consultar Dossiê Completo por CPF">
                    <i data-lucide="search" class="icon-xs"></i>
                    <span>Investigar CPF</span>
                  </button>
                  <button type="button" class="btn btn-outline btn-sm btn-relatorio-individual" data-idx="${idx}" title="Gerar Relatório Deste Titular">
                    <i data-lucide="file-text" class="icon-xs"></i>
                    <span>Relatório</span>
                  </button>
                </div>
              </div>

              <!-- Grid de Dados Cadastrais Essenciais -->
              <div class="osint-kv-grid mt-4">
                <div class="osint-kv-item">
                  <span class="osint-kv-label">Nascimento / Idade</span>
                  <strong class="osint-kv-value">${birthDate} ${age !== null ? `(${age} anos)` : ""}</strong>
                </div>

                <div class="osint-kv-item">
                  <span class="osint-kv-label">Mãe</span>
                  <strong class="osint-kv-value" title="${escapeHtml(mother)}">${escapeHtml(mother)}</strong>
                </div>

                <div class="osint-kv-item">
                  <span class="osint-kv-label">Profissão</span>
                  <strong class="osint-kv-value">${escapeHtml(occupation)}</strong>
                </div>

                <div class="osint-kv-item">
                  <span class="osint-kv-label">Renda Estimada</span>
                  <strong class="osint-kv-value osint-kv-value--success">${incomeFmt}</strong>
                </div>
              </div>

              <!-- Endereço Cadastrado -->
              <div class="osint-address-bar">
                <i data-lucide="map-pin" class="icon-md icon-emerald"></i>
                <div>${escapeHtml(fullAddress)}</div>
              </div>

              <!-- Seção de Vínculos Especiais: Telefones, Veículos, Empresas e E-mails -->
              <div style="margin-top: 12px; display: flex; flex-direction: column; gap: 8px;">
                
                <!-- Telefones Vinculados -->
                ${
                  cleanPhones.length > 0
                    ? `
                  <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <span style="font-size: 0.75rem; color: var(--color-text-muted); font-weight: 700; text-transform: uppercase;">Telefones (${cleanPhones.length}):</span>
                    ${cleanPhones
                      .map((ph) => {
                        const fmtPh = Formatters.phone("", ph);
                        return `
                        <span class="badge badge-dark" style="font-family: var(--font-mono); font-size: 0.75rem; color: #6EE7B7;">
                          ${fmtPh}
                        </span>
                      `;
                      })
                      .join("")}
                  </div>
                `
                    : ""
                }

                <!-- Veículos Vinculados -->
                ${
                  veiculosList.length > 0
                    ? `
                  <div style="background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: var(--radius-md); padding: 10px 14px; margin-top: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 6px;">
                      <span style="font-size: 0.75rem; color: #60A5FA; font-weight: 700; text-transform: uppercase;">
                        <i data-lucide="car" style="width: 12px; height: 12px;"></i> Veículos Registrados (${veiculosList.length})
                      </span>
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                      ${veiculosList
                        .map((v) => {
                          const vPlate = String(v.plate || v.placa || "N/A").toUpperCase();
                          const vModel = v.model || v.modelo || (Array.isArray(v.years) ? `Ano ${v.years.join("/")}` : "");
                          return `
                          <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 4px; padding: 4px 10px; display: flex; align-items: center; gap: 8px;">
                            <span style="font-family: var(--font-mono); font-weight: 800; color: #60A5FA;">${vPlate}</span>
                            ${vModel ? `<span style="font-size: 0.75rem; color: var(--color-text-muted);">${escapeHtml(vModel)}</span>` : ""}
                            <button type="button" class="btn btn-ghost btn-sm btn-puxar-placa" data-placa="${vPlate}" style="padding: 2px 6px;" title="Puxar Placa">
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

                <!-- Empresas / QSA Vinculadas -->
                ${
                  empresasList.length > 0
                    ? `
                  <div style="background: rgba(20, 184, 166, 0.08); border: 1px solid rgba(20, 184, 166, 0.25); border-radius: var(--radius-md); padding: 10px 14px; margin-top: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 6px;">
                      <span style="font-size: 0.75rem; color: #2DD4BF; font-weight: 700; text-transform: uppercase;">
                        <i data-lucide="briefcase" style="width: 12px; height: 12px;"></i> Participações Societárias & Empresas QSA (${empresasList.length})
                      </span>
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                      ${empresasList.slice(0, 4).map((emp) => {
                        const cnpjFmt = Formatters.cnpj(emp.cnpj);
                        const nomeEmp = emp.nome_fantasia ? `${emp.nome_fantasia} (${emp.razao_social || ""})` : (emp.razao_social || "Empresa");
                        const sit = emp.situacao || "ATIVA";
                        return `
                          <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 4px; padding: 4px 10px; font-size: 0.75rem;">
                            <strong style="color: var(--color-text);">${escapeHtml(nomeEmp)}</strong>
                            <span style="font-family: var(--font-mono); color: #2DD4BF; margin-left: 4px;">(${cnpjFmt})</span>
                            <span class="badge" style="font-size: 0.65rem; margin-left: 4px; padding: 1px 5px;">${sit}</span>
                          </div>
                        `;
                      }).join("")}
                      ${empresasList.length > 4 ? `<span style="font-size: 0.75rem; color: var(--color-text-dim); align-self: center;">+ ${empresasList.length - 4} outras empresas</span>` : ""}
                    </div>
                  </div>
                `
                    : ""
                }

                <!-- E-mails Vinculados -->
                ${
                  emailsList.length > 0
                    ? `
                  <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 4px;">
                    <span style="font-size: 0.75rem; color: var(--color-text-muted); font-weight: 700; text-transform: uppercase;">E-mails:</span>
                    ${emailsList
                      .map((em) => `
                        <span class="badge" style="background: rgba(236, 72, 153, 0.15); color: #F472B6; font-family: var(--font-mono); font-size: 0.75rem;">
                          ${escapeHtml(em)}
                        </span>
                      `)
                      .join("")}
                  </div>
                `
                    : ""
                }
              </div>
            </div>
          `;
          })
          .join("")}
      </div>

      <!-- Estado Vazio após Filtragem -->
      <div id="emptyStateFiltroTelefone" class="card osint-empty-card osint-empty-card--dashed is-hidden">
        <div class="osint-empty-icon osint-empty-icon--warning">
          <i data-lucide="user-x" class="icon-xl"></i>
        </div>
        <h4 class="osint-empty-title">Nenhum titular corresponde ao filtro atual</h4>
        <p class="osint-empty-desc">Tente ajustar o termo de busca ou limpar os filtros de categoria.</p>
        <button type="button" class="btn btn-outline btn-sm mt-3" id="btnLimparFiltrosTelefone">
          Limpar Filtros
        </button>
      </div>
    `;
  },
};

export default PhonePersonsInterpreter;
