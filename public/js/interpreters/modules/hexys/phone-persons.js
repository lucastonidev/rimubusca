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
      <div class="card" style="margin-bottom: var(--space-4); border-top: 4px solid #8B5CF6; background: radial-gradient(circle at 95% 10%, rgba(139, 92, 246, 0.12) 0%, transparent 70%), var(--color-surface);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px;">
              <span class="badge" style="background: rgba(139, 92, 246, 0.15); color: #C4B5FD; font-weight: 700;">
                <i data-lucide="phone-call" style="width: 12px; height: 12px;"></i> TELEFONIA & VÍNCULOS CADASTRAIS
              </span>
              <span class="badge badge-dark" style="font-size: 0.72rem;">
                ${totalCount} ${totalCount === 1 ? "Titular Localizado" : "Titulares / Vínculos Localizados"}
              </span>
              ${operadora && operadora !== "Não informada" ? `<span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #60A5FA;">Operadora: ${escapeHtml(operadora)}</span>` : ""}
            </div>

            <h2 style="font-size: 1.6rem; font-weight: 800; color: var(--color-text); margin: 0; font-family: var(--font-mono); letter-spacing: 0.5px;">
              ${escapeHtml(formattedPhone)}
            </h2>
            <p style="color: var(--color-text-muted); font-size: 0.8125rem; margin-top: 4px;">
              Cruzamento de dados entre bases de telecomunicações, birôs de crédito e registros cadastrais federais.
            </p>
          </div>

          <!-- AÇÕES DO TOPO: RELATÓRIO & EXPORTAÇÃO -->
          <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
            <button type="button" class="btn btn-primary btn-sm btn-gerar-relatorio-geral" style="font-weight: 700; box-shadow: 0 0 15px rgba(139, 92, 246, 0.3);">
              <i data-lucide="file-text" style="width: 14px; height: 14px;"></i>
              <span>Gerar Relatório OSINT</span>
            </button>
            <button type="button" class="btn btn-outline btn-sm btn-copiar-todos-cpfs" title="Copiar lista de CPFs">
              <i data-lucide="copy" style="width: 13px; height: 13px;"></i>
              <span>Copiar CPFs</span>
            </button>
          </div>
        </div>

        <!-- ============================================================== -->
        <!-- BARRA DE PESQUISA & FILTROS EM TEMPO REAL                      -->
        <!-- ============================================================== -->
        <div style="margin-top: var(--space-5); padding-top: var(--space-4); border-top: 1px solid var(--color-border);">
          <div style="display: flex; gap: 12px; flex-wrap: wrap; align-items: center; justify-content: space-between;">
            <!-- Campo de Busca em Tempo Real (Nome ou Dígitos do CPF) -->
            <div style="position: relative; flex: 1; min-width: 280px;">
              <i data-lucide="search" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; color: var(--color-text-muted);"></i>
              <input 
                type="text" 
                id="inputFiltroPessoasTelefone" 
                placeholder="Buscar por nome, dígitos do CPF (ex: 886, 143), cidade..." 
                style="width: 100%; padding: 10px 16px 10px 40px; background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: var(--radius-md); color: var(--color-text); font-size: 0.875rem; outline: none; transition: all 0.2s;"
              >
            </div>

            <!-- Contador de Resultados Visíveis -->
            <div style="font-size: 0.8125rem; color: var(--color-text-muted);">
              Exibindo <strong id="contadorPessoasVisiveis" style="color: #6EE7B7;">${totalCount}</strong> de ${totalCount} registros
            </div>
          </div>

          <!-- Pílulas de Filtro Rápido -->
          <div class="filtros-pills-container" style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px;">
            <button type="button" class="btn-filtro-pill active" data-filter="todos">
              Todos (${totalCount})
            </button>
            <button type="button" class="btn-filtro-pill" data-filter="regular">
              Regulares (${regularesCount})
            </button>
            ${falecidosCount > 0 ? `<button type="button" class="btn-filtro-pill" data-filter="falecido" style="border-color: rgba(239, 68, 68, 0.4); color: #F87171;">Falecidos (${falecidosCount})</button>` : ""}
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
              class="card card-item-pessoa-telefone" 
              data-search="${escapeHtml(searchIndex)}"
              data-status="${isFalecido ? "falecido" : situacaoReceita === "REGULAR" ? "regular" : "outro"}"
              data-has-veiculos="${veiculosList.length > 0 ? "true" : "false"}"
              data-has-empresas="${empresasList.length > 0 ? "true" : "false"}"
              data-has-emails="${emailsList.length > 0 ? "true" : "false"}"
              style="margin-bottom: 0; border-left: 4px solid ${isFalecido ? "#EF4444" : "#8B5CF6"};"
            >
              <!-- Top Row: Titular Index, Status and Actions -->
              <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;">
                <div>
                  <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px;">
                    <span class="badge" style="background: rgba(139, 92, 246, 0.15); color: #C4B5FD; font-weight: 700;">
                      #${idx + 1} • TITULAR VINCULADO
                    </span>
                    ${
                      isFalecido
                        ? `<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #F87171; font-weight: 700; border: 1px solid rgba(239, 68, 68, 0.3);">
                            <i data-lucide="alert-octagon" style="width: 12px; height: 12px;"></i> TITULAR FALECIDO
                           </span>`
                        : `<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10B981; font-weight: 700;">
                            <i data-lucide="check-circle-2" style="width: 12px; height: 12px;"></i> REGULAR NA RECEITA
                           </span>`
                    }
                    <span class="badge badge-dark" style="font-size: 0.72rem;">PF</span>
                  </div>

                  <h3 style="font-size: 1.35rem; font-weight: 800; color: var(--color-text); margin: 0;">
                    ${escapeHtml(nome)}
                  </h3>

                  <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                    <span style="font-family: var(--font-mono); font-size: 1.05rem; font-weight: 700; color: #6EE7B7;">${formattedCpf}</span>
                    <button type="button" class="btn btn-ghost btn-sm btn-copiar-cpf" data-cpf="${rawCpf}" title="Copiar CPF">
                      <i data-lucide="copy" style="width: 13px; height: 13px;"></i>
                    </button>
                  </div>
                </div>

                <!-- Botões de Ação Direta no Card -->
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                  <button type="button" class="btn btn-primary btn-sm btn-puxar-cpf-item" data-cpf="${rawCpf}" title="Consultar Dossiê Completo por CPF">
                    <i data-lucide="search" style="width: 13px; height: 13px;"></i>
                    <span>Investigar CPF</span>
                  </button>
                  <button type="button" class="btn btn-outline btn-sm btn-relatorio-individual" data-idx="${idx}" title="Gerar Relatório Deste Titular">
                    <i data-lucide="file-text" style="width: 13px; height: 13px;"></i>
                    <span>Relatório</span>
                  </button>
                </div>
              </div>

              <!-- Grid de Dados Cadastrais Essenciais -->
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px; margin-top: var(--space-4);">
                <div style="background: var(--color-surface-2); padding: 10px 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
                  <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; display: block;">Nascimento / Idade</span>
                  <strong style="color: var(--color-text); font-size: 0.875rem;">${birthDate} ${age !== null ? `(${age} anos)` : ""}</strong>
                </div>

                <div style="background: var(--color-surface-2); padding: 10px 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
                  <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; display: block;">Mãe</span>
                  <strong style="color: var(--color-text); font-size: 0.875rem;" title="${escapeHtml(mother)}">${escapeHtml(mother)}</strong>
                </div>

                <div style="background: var(--color-surface-2); padding: 10px 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
                  <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; display: block;">Profissão</span>
                  <strong style="color: var(--color-text); font-size: 0.875rem;">${escapeHtml(occupation)}</strong>
                </div>

                <div style="background: var(--color-surface-2); padding: 10px 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
                  <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; display: block;">Renda Estimada</span>
                  <strong style="color: #10B981; font-size: 0.875rem;">${incomeFmt}</strong>
                </div>
              </div>

              <!-- Endereço Cadastrado -->
              <div style="margin-top: 10px; background: var(--color-surface-2); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border); display: flex; align-items: center; gap: 10px;">
                <i data-lucide="map-pin" style="width: 18px; height: 18px; color: #10B981; flex-shrink: 0;"></i>
                <div style="font-size: 0.8125rem; color: var(--color-text);">
                  ${escapeHtml(fullAddress)}
                </div>
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
      <div id="emptyStateFiltroTelefone" style="display: none; text-align: center; padding: var(--space-8); background: var(--color-surface); border: 1px dashed var(--color-border); border-radius: var(--radius-lg); margin-top: var(--space-4);">
        <i data-lucide="user-x" style="width: 36px; height: 36px; color: #F59E0B; margin-bottom: 8px;"></i>
        <h4 style="font-size: 1.05rem; font-weight: 600; color: var(--color-text);">Nenhum titular corresponde ao filtro atual</h4>
        <p style="color: var(--color-text-muted); font-size: 0.85rem;">Tente ajustar o termo de busca ou limpar os filtros de categoria.</p>
        <button type="button" class="btn btn-outline btn-sm" id="btnLimparFiltrosTelefone" style="margin-top: 10px;">
          Limpar Filtros
        </button>
      </div>

      <style>
        .btn-filtro-pill {
          background: var(--color-surface-2);
          border: 1px solid var(--color-border);
          color: var(--color-text-muted);
          padding: 5px 12px;
          border-radius: var(--radius-full, 9999px);
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .btn-filtro-pill:hover {
          background: var(--color-surface-3);
          color: var(--color-text);
          border-color: rgba(139, 92, 246, 0.4);
        }
        .btn-filtro-pill.active {
          background: rgba(139, 92, 246, 0.25);
          border-color: #8B5CF6;
          color: #FFFFFF;
          box-shadow: 0 0 10px rgba(139, 92, 246, 0.25);
        }
      </style>
    `;
  },
};

export default PhonePersonsInterpreter;
