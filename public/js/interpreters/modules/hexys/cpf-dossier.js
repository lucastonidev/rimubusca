/**
 * ==============================================================================
 * HEXYS API INTERPRETER - CPF / INDIVIDUAL DOSSIER (CPF-DOSSIER.JS)
 * Visual intelligence dossier for individual queries (CPF, Full Name, Voter ID).
 * Decodes:
 *  1. Identity & Hero Profile with Avatar Biometrics
 *  2. Civil & Administrative Documentation (RG, CNH, CBO, Voter ID)
 *  3. Facial Biometrics, Available Photos & Google Accounts OSINT
 *  4. Serasa Completo & Credit Score Analysis (CSB8 / CSBA)
 *  5. Motor Vehicles & Fleet Registrations (Mercosul plates)
 *  6. Residential & Delivery / E-Commerce Addresses
 *  7. Telephony & Mobile Lines with Carrier Intelligence
 *  8. Digital Identity & E-mails
 *  9. Family Kinship & Relatives
 * 10. Corporate Ties & QSA Companies
 * 11. Compromised Passwords & Credential Breaches
 * 12. Geographic Neighbors
 *
 * Clean Code standards with English identifiers and strict null-safety.
 * ==============================================================================
 */

import { Formatters, escapeHtml } from "../../utils.js";

export const CpfDossierInterpreter = {
  /**
   * Renders the complete intelligence dossier for an individual
   * @param {Object} responseData - Root query response metadata
   * @param {Object} dataPayload - Extracted data payload
   * @returns {string} HTML markup
   */
  render(responseData, dataPayload) {
    const data = dataPayload || {};

    // 1. Basic Identity
    const fullName = data.name || data.nome || "Não informado";
    const rawCpf = String(data.cpf || responseData?.termo || "").replace(/\D/g, "");
    const formattedCpf = Formatters.cpf(data.cpf_masked || data.cpf || rawCpf);
    const birthDate = Formatters.date(data.birth_date || data.dataNascimento);
    const age = Formatters.age(data.birth_date || data.dataNascimento);
    const motherName = data.mother_name || data.nomeMae || data.nome_mae || "Não informada";
    const fatherName = data.father_name || data.nomePai || data.nome_pai || "Não informado";
    const rgDoc = data.rg ? `${data.rg} ${data.rg_issuer || ""} ${data.rg_state || ""}`.trim() : "Não informado";
    const voterId = data.voter_id || data.tituloEleitor || "Não informado";
    const federalStatus = data.federal_status || data.situacaoCadastral || "REGULAR";
    const rawGender = String(data.gender || "").trim().toUpperCase();
    const gender = rawGender === "F" ? "Feminino" : rawGender === "M" ? "Masculino" : data.gender || "Não informado";
    const originUf = data.estado_cpf || null;

    // 2. Photo / Avatar Resolution
    const photoUrl =
      data.foto_url ||
      data.foto_google ||
      data.fotoBase64 ||
      data.base64 ||
      data.foto ||
      (Array.isArray(data.fotos_disponiveis) && data.fotos_disponiveis[0]?.url) ||
      (Array.isArray(data.contas_google) && data.contas_google[0]?.photoUrl) ||
      null;

    // 3. Score & Credit
    const scoreObj = typeof data.score === "object" && data.score !== null ? data.score : {};
    let scoreVal = scoreObj.valor || scoreObj.value || scoreObj.csb8 || scoreObj.csba || scoreObj.score || null;
    if (scoreVal === null && typeof data.score !== "object" && data.score !== undefined && data.score !== null) {
      scoreVal = data.score;
    }
    scoreVal = scoreVal !== null && scoreVal !== undefined ? String(scoreVal) : "N/A";
    const csb8 = scoreObj.csb8 ? `${scoreObj.csb8} (${scoreObj.csb8_range || scoreObj.csb8_faixa || ""})` : null;
    const csba = scoreObj.csba ? `${scoreObj.csba} (${scoreObj.csba_range || scoreObj.csba_faixa || ""})` : null;
    const csb8Range = scoreObj.csb8_range || scoreObj.csb8_faixa || scoreObj.range || scoreObj.faixa || null;

    // 4. Income & Purchasing Power
    const incomeNum = data.income || data.renda_estimativas?.presumida?.valor || null;
    const formattedIncome = incomeNum ? Formatters.currency(incomeNum) : data.rendaPresumida || "N/A";
    const purchasingPowerVal = data.renda_estimativas?.poder_aquisitivo?.valor
      ? Formatters.currency(data.renda_estimativas.poder_aquisitivo.valor)
      : null;
    const purchasingPowerDesc =
      data.serasa_completo?.poder_aquisitivo?.FX_PODER_AQUISITIVO ||
      data.renda_estimativas?.poder_aquisitivo?.descricao ||
      null;

    // 5. Professional & Civic
    const occupation = data.occupation || data.profissao || "Não informada";
    const cbo = data.cbo || data.occupation_code || null;
    const cnh = data.cnh?.num_cnh || data.cnh?.numero_registro || data.cnh?.numero || (typeof data.cnh === "string" ? data.cnh : "Não informado");
    const cnhFirst = (data.cnh?.primeira_habilitacao || data.cnh?.data_primeira_habilitacao)
      ? String(data.cnh.primeira_habilitacao || data.cnh.data_primeira_habilitacao).split("T")[0]
      : null;
    const mosaic = data.mosaic || data.classeSocial || "N/A";

    // 6. Google Accounts & Photos
    const googleAccounts = Array.isArray(data.contas_google) ? data.contas_google : [];
    const availablePhotos = Array.isArray(data.fotos_disponiveis) ? data.fotos_disponiveis : [];

    // 7. Contacts (Phones & Emails)
    const phones = Array.isArray(data.phones) ? data.phones : Array.isArray(data.telefones) ? data.telefones : [];
    const vivoLines = Array.isArray(data.vivo_linhas) ? data.vivo_linhas : [];
    const carriersMap = {};
    if (Array.isArray(data.telefones_operadoras)) {
      data.telefones_operadoras.forEach((to) => {
        if (to.telefone && to.operadora) {
          carriersMap[String(to.telefone).replace(/\D/g, "")] = to.operadora;
        }
      });
    }

    const allEmails = [];
    if (data.email) allEmails.push(data.email);
    if (Array.isArray(data.additional_emails)) {
      data.additional_emails.forEach((em) => {
        if (em && !allEmails.includes(em)) allEmails.push(em);
      });
    }
    if (Array.isArray(data.emails)) {
      data.emails.forEach((eObj) => {
        const em = typeof eObj === "object" ? eObj.email || eObj.address : String(eObj);
        if (em && !allEmails.includes(em)) allEmails.push(em);
      });
    }

    // 8. Addresses (Merging primary, all_addresses and delivery_addresses without duplicates)
    const rawAllAddresses = Array.isArray(data.all_addresses)
      ? data.all_addresses
      : Array.isArray(data.enderecos)
        ? data.enderecos
        : data.address
          ? [data.address]
          : [];
    const deliveryAddresses = Array.isArray(data.delivery_addresses) ? data.delivery_addresses : [];
    const allAddresses = [...rawAllAddresses];

    deliveryAddresses.forEach((deliv) => {
      const exists = allAddresses.some((a) => {
        return (
          String(a.zip_code || a.cep || "").replace(/\D/g, "") === String(deliv.zip_code || deliv.cep || "").replace(/\D/g, "") &&
          String(a.number || a.numero || "") === String(deliv.number || deliv.numero || "")
        );
      });
      if (!exists) {
        allAddresses.push({ ...deliv, source: deliv.source || "DELIVERY_ECOMMERCE" });
      }
    });

    // 9. Vehicles
    const vehiclesList = (data.vehicles && Array.isArray(data.vehicles.list))
      ? data.vehicles.list
      : (data.vehicles_proprietario && Array.isArray(data.vehicles_proprietario.list))
        ? data.vehicles_proprietario.list
        : Array.isArray(data.detran_vehicles)
          ? data.detran_vehicles
          : [];

    // 10. Relatives & Companies
    const relatives = (Array.isArray(data.serasa_completo?.parentes) && data.serasa_completo.parentes.length > 0)
      ? data.serasa_completo.parentes
      : (Array.isArray(data.parentes) && data.parentes.length > 0)
        ? data.parentes
        : (Array.isArray(data.relatives) && data.relatives.length > 0)
          ? data.relatives
          : (Array.isArray(data.parentescos) && data.parentescos.length > 0)
            ? data.parentescos
            : (Array.isArray(data.serasa_completo?.parentes) ? data.serasa_completo.parentes : (Array.isArray(data.parentes) ? data.parentes : []));
    const companies = Array.isArray(data.empresas)
      ? data.empresas
      : Array.isArray(data.empresas_vinculadas)
        ? data.empresas_vinculadas
        : [];

    // 11. Leaks & Breaches
    const leaks = Array.isArray(data.vazamentos) ? data.vazamentos : [];
    const totalLeaks = data.total_vazamentos || leaks.length || 0;
    const auditedTargets = data.alvos_verificados_vazamentos || 0;

    // 12. Neighbors
    const neighbors = Array.isArray(data.vizinhos) ? data.vizinhos : [];

    // Coverage & Quality
    const totalSources = data.data_coverage?.total_sources || 16;

    return `
      <!-- ============================================================== -->
      <!-- CARTÃO PRINCIPAL (HERO) COM AVATAR BIOMÉTRICO                  -->
      <!-- ============================================================== -->
      <div class="card" style="margin-bottom: var(--space-4); border-top: 4px solid #8B5CF6;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
          
          <div style="display: flex; gap: 16px; align-items: center; flex-wrap: wrap;">
            <!-- Avatar / Foto Biometria Facial -->
            <div style="position: relative; flex-shrink: 0;">
              ${
                photoUrl
                  ? `
                <div style="position: relative; width: 100px; height: 120px; border-radius: var(--radius-md); overflow: hidden; border: 2px solid #8B5CF6; box-shadow: 0 4px 14px rgba(139, 92, 246, 0.35);">
                  <img 
                    src="${photoUrl}" 
                    alt="Biometria Facial" 
                    style="width: 100%; height: 100%; object-fit: cover;"
                    onerror="this.parentElement.style.display='none'"
                  >
                  <a href="${photoUrl}" target="_blank" title="Visualizar Imagem em Alta Resolução" style="position: absolute; bottom: 4px; right: 4px; background: rgba(0,0,0,0.7); color: #FFF; border-radius: 4px; padding: 2px 4px; font-size: 0.65rem; display: flex; align-items: center;">
                    <i data-lucide="maximize-2" style="width: 11px; height: 11px;"></i>
                  </a>
                </div>
              `
                  : `
                <div style="width: 80px; height: 95px; background: var(--color-surface-2); border-radius: var(--radius-md); border: 1px dashed var(--color-border); display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--color-text-dim);">
                  <i data-lucide="user" style="width: 32px; height: 32px;"></i>
                  <span style="font-size: 0.65rem; margin-top: 4px;">Sem Foto</span>
                </div>
              `
              }
            </div>

            <!-- Dados Identificadores -->
            <div>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px;">
                <span class="badge" style="background: rgba(139, 92, 246, 0.15); color: #C4B5FD; font-weight: 700;">
                  <i data-lucide="id-card" style="width: 12px; height: 12px;"></i> PESSOA FÍSICA
                </span>
                <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10B981; font-weight: 700;">
                  ${escapeHtml(federalStatus)}
                </span>
                ${originUf ? `<span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #60A5FA;">UF Origem: ${escapeHtml(originUf)}</span>` : ""}
                <span class="badge badge-dark" style="font-size: 0.72rem;">✓ ${totalSources} Fontes Auditadas</span>
                ${
                  auditedTargets > 0
                    ? `<span class="badge" style="background: ${totalLeaks === 0 ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)"}; color: ${totalLeaks === 0 ? "#10B981" : "#EF4444"}; font-size: 0.72rem;">
                        <i data-lucide="${totalLeaks === 0 ? "shield-check" : "shield-alert"}" style="width: 11px; height: 11px;"></i>
                        ${totalLeaks === 0 ? `Seguro (${auditedTargets} alvos)` : `${totalLeaks} vazamentos`}
                      </span>`
                    : ""
                }
              </div>

              <h2 style="font-size: 1.45rem; font-weight: 800; color: var(--color-text); margin: 0;">
                ${escapeHtml(fullName)}
              </h2>

              <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                <span style="font-family: var(--font-mono); font-size: 1.05rem; font-weight: 700; color: #6EE7B7;">${formattedCpf}</span>
                <button type="button" class="btn btn-ghost btn-sm btn-copiar-cpf" data-cpf="${rawCpf}" title="Copiar CPF">
                  <i data-lucide="copy" style="width: 13px; height: 13px;"></i>
                </button>
              </div>

              <!-- Quick Action Shortcuts -->
              <div style="display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap;">
                <button type="button" class="btn btn-outline btn-sm btn-puxar-foto" data-cpf="${rawCpf}" title="Consultar Biometria Facial na Hexys">
                  <i data-lucide="camera" style="width: 13px; height: 13px;"></i> Biometria Facial
                </button>
                <button type="button" class="btn btn-outline btn-sm btn-puxar-vizinhos" data-cpf="${rawCpf}" title="Mapear Vizinhos no Logradouro">
                  <i data-lucide="home" style="width: 13px; height: 13px;"></i> Mapear Vizinhos
                </button>
              </div>
            </div>
          </div>

          <!-- Score & Renda Widgets -->
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <div style="background: var(--color-surface-2); padding: 8px 14px; border-radius: var(--radius-md); text-align: center; border: 1px solid var(--color-border); min-width: 110px;">
              <span style="font-size: 0.7rem; color: var(--color-text-muted); text-transform: uppercase;">Score de Crédito</span>
              <div style="font-size: 1.25rem; font-weight: 800; color: #60A5FA;">${escapeHtml(scoreVal)}</div>
              ${csb8Range ? `<span style="font-size: 0.65rem; color: #34D399; font-weight: 700;">CSB8: ${escapeHtml(csb8Range)}</span>` : ""}
            </div>

            <div style="background: var(--color-surface-2); padding: 8px 14px; border-radius: var(--radius-md); text-align: center; border: 1px solid var(--color-border); min-width: 130px;">
              <span style="font-size: 0.7rem; color: var(--color-text-muted); text-transform: uppercase;">Renda Estimada</span>
              <div style="font-size: 1.15rem; font-weight: 800; color: #10B981;">${formattedIncome}</div>
              ${purchasingPowerVal ? `<span style="font-size: 0.68rem; color: #60A5FA; display: block; font-weight: 600;" title="Poder Aquisitivo Serasa">Poder Aq.: ${purchasingPowerVal}</span>` : purchasingPowerDesc ? `<span style="font-size: 0.65rem; color: var(--color-text-dim); display: block;">${escapeHtml(purchasingPowerDesc)}</span>` : ""}
            </div>
          </div>
        </div>
      </div>

      <!-- ============================================================== -->
      <!-- 1. DADOS CADASTRAIS & DOCUMENTOS CIVIS                          -->
      <!-- ============================================================== -->
      <div class="card" style="margin-bottom: var(--space-4);">
        <div class="card-header">
          <h3 class="card-title" style="display: flex; align-items: center; gap: 8px;">
            <i data-lucide="user-check" style="color: #60A5FA; width: 18px; height: 18px;"></i>
            <span>Documentos Civis & Filiação</span>
          </h3>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;">
          <div style="background: var(--color-surface-2); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
            <span style="font-size: 0.75rem; color: var(--color-text-muted); display: block;">Nome da Mãe</span>
            <strong style="color: var(--color-text);">${escapeHtml(motherName)}</strong>
          </div>

          <div style="background: var(--color-surface-2); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
            <span style="font-size: 0.75rem; color: var(--color-text-muted); display: block;">Nome do Pai</span>
            <strong style="color: var(--color-text);">${escapeHtml(fatherName)}</strong>
          </div>

          <div style="background: var(--color-surface-2); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
            <span style="font-size: 0.75rem; color: var(--color-text-muted); display: block;">Nascimento / Idade</span>
            <strong style="color: var(--color-text);">${birthDate} ${age !== null ? `(${age} anos)` : ""}</strong>
          </div>

          <div style="background: var(--color-surface-2); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
            <span style="font-size: 0.75rem; color: var(--color-text-muted); display: block;">Gênero</span>
            <strong style="color: var(--color-text);">${escapeHtml(gender)}</strong>
          </div>

          <div style="background: var(--color-surface-2); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
            <span style="font-size: 0.75rem; color: var(--color-text-muted); display: block;">Registro Geral (RG)</span>
            <strong style="color: #6EE7B7; font-family: var(--font-mono);">${escapeHtml(rgDoc)}</strong>
          </div>

          <div style="background: var(--color-surface-2); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
            <span style="font-size: 0.75rem; color: var(--color-text-muted); display: block;">Título de Eleitor</span>
            <strong style="color: #6EE7B7; font-family: var(--font-mono);">${escapeHtml(voterId)}</strong>
          </div>

          <div style="background: var(--color-surface-2); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
            <span style="font-size: 0.75rem; color: var(--color-text-muted); display: block;">Carteira de Habilitação (CNH)</span>
            <strong style="color: var(--color-text);">${escapeHtml(cnh)} ${cnhFirst ? `<span style="font-size: 0.7rem; color: var(--color-text-dim);">(1ª: ${cnhFirst})</span>` : ""}</strong>
          </div>

          <div style="background: var(--color-surface-2); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
            <span style="font-size: 0.75rem; color: var(--color-text-muted); display: block;">Ocupação / CBO</span>
            <strong style="color: var(--color-text);">${escapeHtml(occupation)} ${cbo ? `<span style="font-size: 0.7rem; color: #60A5FA;">(${cbo})</span>` : ""}</strong>
          </div>

          <div style="background: var(--color-surface-2); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
            <span style="font-size: 0.75rem; color: var(--color-text-muted); display: block;">Mosaico / Classe Social</span>
            <strong style="color: #F59E0B;">${escapeHtml(mosaic)}</strong>
          </div>
        </div>
      </div>

      <!-- ============================================================== -->
      <!-- 2. BIOMETRIA FACIAL, FOTOS & CONTAS GOOGLE                      -->
      <!-- ============================================================== -->
      ${
        (photoUrl || googleAccounts.length > 0 || availablePhotos.length > 0)
          ? `
        <div class="card" style="margin-bottom: var(--space-4); border-left: 4px solid #8B5CF6;">
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <h3 class="card-title" style="display: flex; align-items: center; gap: 8px; color: #A78BFA;">
              <i data-lucide="camera" style="width: 18px; height: 18px;"></i>
              <span>Biometria Facial, Fotos & Contas Google (${availablePhotos.length || (photoUrl ? 1 : 0)} fotos / ${googleAccounts.length} contas)</span>
            </h3>
            <span class="badge" style="background: rgba(139, 92, 246, 0.15); color: #C4B5FD;">Google OSINT & Registro</span>
          </div>

          <div style="display: flex; gap: var(--space-5); flex-wrap: wrap; align-items: flex-start; padding-top: var(--space-2);">
            ${
              photoUrl
                ? `
              <div style="text-align: center; flex-shrink: 0;">
                <div style="position: relative; display: inline-block;">
                  <img 
                    src="${photoUrl}" 
                    alt="Foto Biometria" 
                    style="width: 150px; height: 185px; object-fit: cover; border-radius: var(--radius-md); border: 2px solid #8B5CF6; box-shadow: 0 4px 15px rgba(139, 92, 246, 0.35);"
                  >
                </div>
                <div style="margin-top: 8px;">
                  <a href="${photoUrl}" target="_blank" download="foto-facial-${rawCpf}.jpg" class="btn btn-outline btn-sm" style="font-size: 0.75rem;">
                    <i data-lucide="download" style="width: 12px; height: 12px;"></i> Baixar Foto
                  </a>
                </div>
              </div>
            `
                : ""
            }

            <div style="flex: 1; min-width: 250px;">
              ${
                googleAccounts.length > 0
                  ? `
                <span style="font-size: 0.75rem; color: var(--color-text-muted); text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 8px;">
                  Contas Google Vinculadas (${googleAccounts.length})
                </span>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 8px;">
                  ${googleAccounts
                    .map((acc, aIdx) => {
                      const accEmail = acc.email || "E-mail não informado";
                      const accPhoto = acc.photoUrl || null;
                      return `
                      <div style="background: var(--color-surface-2); padding: 10px; border-radius: var(--radius-md); border: 1px solid var(--color-border); display: flex; align-items: center; gap: 10px;">
                        ${
                          accPhoto
                            ? `<img src="${accPhoto}" alt="Avatar Google" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 1px solid #8B5CF6;">`
                            : `<div style="width: 36px; height: 36px; border-radius: 50%; background: rgba(139, 92, 246, 0.15); color: #A78BFA; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.8rem;">G</div>`
                        }
                        <div style="overflow: hidden;">
                          <div style="font-weight: 600; color: var(--color-text); font-size: 0.85rem; word-break: break-all;">${escapeHtml(accEmail)}</div>
                          <span style="font-size: 0.7rem; color: #10B981;">Conta Ativa #${aIdx + 1}</span>
                        </div>
                      </div>
                    `;
                    })
                    .join("")}
                </div>
              `
                  : `<p style="font-size: 0.85rem; color: var(--color-text-dim);">Foto oficial obtida através de cruzamento biométrico.</p>`
              }

              ${
                availablePhotos.length > 1
                  ? `
                <div style="margin-top: 14px;">
                  <span style="font-size: 0.75rem; color: var(--color-text-muted); text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 6px;">
                    Outros Espelhos Fotográficos Localizados (${availablePhotos.length})
                  </span>
                  <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    ${availablePhotos
                      .map((p, pIdx) => {
                        const pUrl = p.url || (p.base64 ? `data:image/jpeg;base64,${p.base64}` : null);
                        if (!pUrl) return "";
                        return `
                        <a href="${pUrl}" target="_blank" style="display: block; width: 50px; height: 60px; border-radius: var(--radius-sm); overflow: hidden; border: 1px solid var(--color-border);">
                          <img src="${pUrl}" alt="Espelho #${pIdx + 1}" style="width: 100%; height: 100%; object-fit: cover;">
                        </a>
                      `;
                      })
                      .join("")}
                  </div>
                </div>
              `
                  : ""
              }
            </div>
          </div>
        </div>
      `
          : ""
      }

      <!-- ============================================================== -->
      <!-- 3. VEÍCULOS & FROTA AUTOMOTIVA                                  -->
      <!-- ============================================================== -->
      <div class="card" style="margin-bottom: var(--space-4);">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h3 class="card-title" style="display: flex; align-items: center; gap: 8px;">
            <i data-lucide="car" style="color: #3B82F6; width: 18px; height: 18px;"></i>
            <span>Veículos Registrados (${vehiclesList.length})</span>
          </h3>
          <span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #60A5FA;">Bases Detran & Renavam</span>
        </div>

        ${
          vehiclesList.length > 0
            ? `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(310px, 1fr)); gap: 12px;">
            ${vehiclesList
              .map((v) => {
                const plate = String(v.plate || v.placa || "N/A").toUpperCase();
                const model = v.model || v.modelo || v.brand || v.marca || "Veículo";
                const year = v.year_model || v.ano || (Array.isArray(v.years) ? v.years.join("/") : "N/A");
                const color = v.color || v.cor || "N/A";
                const renavam = v.renavam || "N/A";
                const chassis = v.chassis || v.chassi || "N/A";
                const city = v.city || v.cidade || "";
                const uf = v.state || v.uf || "";
                const loc = [city, uf].filter(Boolean).join(" / ");

                return `
                <div style="background: var(--color-surface-2); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div style="background: #FFF; border: 2px solid #000; border-radius: 4px; padding: 1px 8px; font-family: var(--font-mono); font-weight: 800; font-size: 1rem; color: #000;">
                      ${plate}
                    </div>
                    <button type="button" class="btn btn-outline btn-sm btn-puxar-placa" data-placa="${plate}" style="font-size: 0.72rem; padding: 3px 8px;">
                      <i data-lucide="search" style="width: 12px; height: 12px;"></i> Puxar Placa
                    </button>
                  </div>
                  <strong style="color: var(--color-text); font-size: 0.95rem; display: block;">${escapeHtml(model)}</strong>
                  <div style="font-size: 0.78rem; color: var(--color-text-muted); margin-top: 4px;">
                    <span>Ano: <strong>${escapeHtml(year)}</strong></span> | 
                    <span>Cor: <strong>${escapeHtml(color)}</strong></span>
                    ${loc ? ` | <span>${escapeHtml(loc)}</span>` : ""}
                  </div>
                  <div style="font-size: 0.75rem; font-family: var(--font-mono); color: #60A5FA; margin-top: 6px;">
                    Chassi: ${escapeHtml(chassis)}
                  </div>
                  <div style="font-size: 0.75rem; font-family: var(--font-mono); color: #34D399;">
                    Renavam: ${escapeHtml(renavam)}
                  </div>
                </div>
              `;
              })
              .join("")}
          </div>
        `
            : `
          <p style="color: var(--color-text-muted); font-size: 0.85rem; padding: var(--space-2) 0;">
            Nenhum veículo vinculado a este CPF nos registros nacionais do DETRAN.
          </p>
        `
        }
      </div>

      <!-- ============================================================== -->
      <!-- 4. ENDEREÇOS & LOGRADOUROS (COM DELIVERY / E-COMMERCE)           -->
      <!-- ============================================================== -->
      <div class="card" style="margin-bottom: var(--space-4);">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h3 class="card-title" style="display: flex; align-items: center; gap: 8px;">
            <i data-lucide="map-pin" style="color: #10B981; width: 18px; height: 18px;"></i>
            <span>Histórico de Endereços (${allAddresses.length})</span>
          </h3>
          <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10B981;">Residencial & E-Commerce</span>
        </div>

        ${
          allAddresses.length > 0
            ? `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(310px, 1fr)); gap: 12px;">
            ${allAddresses
              .map((addr, idx) => {
                const tipo = addr.type || addr.tipo || "";
                const logr = addr.street || addr.logradouro || "Logradouro não informado";
                const num = addr.number || addr.numero || "S/N";
                const compl = addr.complement || addr.complemento ? ` - ${addr.complement || addr.complemento}` : "";
                const bairro = addr.neighborhood || addr.bairro || "";
                const cidade = addr.city || addr.cidade || "";
                const uf = addr.state || addr.uf || "";
                const cep = Formatters.cep(addr.zip_code || addr.cep);
                const fonte = addr.source || addr.fonte || (idx === 0 ? "PRINCIPAL" : "RECEITA");

                return `
                <div style="background: var(--color-surface-2); padding: 12px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span class="badge badge-purple" style="font-size: 0.65rem;">${escapeHtml(fonte)}</span>
                    <span style="font-family: var(--font-mono); font-size: 0.75rem; color: #6EE7B7;">CEP ${cep}</span>
                  </div>
                  <strong style="color: var(--color-text); font-size: 0.9rem; display: block;">
                    ${escapeHtml(tipo ? `${tipo} ` : "")}${escapeHtml(logr)}, ${escapeHtml(num)}${escapeHtml(compl)}
                  </strong>
                  <div style="font-size: 0.8rem; color: var(--color-text-muted); margin-top: 4px;">
                    ${escapeHtml(bairro)} - ${escapeHtml(cidade)} / ${escapeHtml(uf)}
                  </div>
                </div>
              `;
              })
              .join("")}
          </div>
        `
            : `
          <p style="color: var(--color-text-muted); font-size: 0.85rem; padding: var(--space-2) 0;">
            Nenhum endereço localizado na base.
          </p>
        `
        }
      </div>

      <!-- ============================================================== -->
      <!-- 5. TELEFONES & LINHAS DE CONTATO                                -->
      <!-- ============================================================== -->
      <div class="card" style="margin-bottom: var(--space-4);">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h3 class="card-title" style="display: flex; align-items: center; gap: 8px;">
            <i data-lucide="phone" style="color: #F59E0B; width: 18px; height: 18px;"></i>
            <span>Telefones & Linhas Telefônicas (${phones.length + vivoLines.length})</span>
          </h3>
          <span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #F59E0B;">Operadoras & Histórico</span>
        </div>

        ${
          phones.length > 0 || vivoLines.length > 0
            ? `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 10px;">
            ${phones
              .map((p) => {
                const phoneStr = typeof p === "object" ? p.number || p.telefone || p.numero : String(p);
                const cleanPhone = String(phoneStr).replace(/\D/g, "");
                const formattedPhone = Formatters.phone(p.ddd, phoneStr);
                const tipo = p.tipo || p.type || "Móvel";
                const operadora = carriersMap[cleanPhone] || p.operadora || null;

                return `
                <div style="background: var(--color-surface-2); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <span style="font-family: var(--font-mono); font-weight: 700; color: #6EE7B7; font-size: 0.95rem;">${formattedPhone}</span>
                    <div style="font-size: 0.72rem; color: var(--color-text-muted); margin-top: 2px;">
                      <span>${escapeHtml(tipo)}</span>
                      ${operadora ? ` • <strong style="color: #60A5FA;">${escapeHtml(operadora)}</strong>` : ""}
                    </div>
                  </div>
                  <button type="button" class="btn btn-ghost btn-sm btn-puxar-operadora" data-telefone="${cleanPhone}" title="Identificar Operadora">
                    <i data-lucide="radio" style="width: 14px; height: 14px; color: #60A5FA;"></i>
                  </button>
                </div>
              `;
              })
              .join("")}

            ${vivoLines
              .map((vl) => {
                const clean = String(vl.numero || vl).replace(/\D/g, "");
                return `
                <div style="background: var(--color-surface-2); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid rgba(139, 92, 246, 0.3); display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <span style="font-family: var(--font-mono); font-weight: 700; color: #C4B5FD; font-size: 0.95rem;">${Formatters.phone("", clean)}</span>
                    <div style="font-size: 0.72rem; color: #A78BFA; margin-top: 2px;">Linha Ativa Vivo</div>
                  </div>
                  <span class="badge" style="background: rgba(139, 92, 246, 0.15); color: #C4B5FD; font-size: 0.65rem;">VIVO</span>
                </div>
              `;
              })
              .join("")}
          </div>
        `
            : `
          <p style="color: var(--color-text-muted); font-size: 0.85rem; padding: var(--space-2) 0;">
            Nenhum telefone localizado na base de telecomunicações.
          </p>
        `
        }
      </div>

      <!-- ============================================================== -->
      <!-- 6. E-MAILS & IDENTIDADE DIGITAL                                -->
      <!-- ============================================================== -->
      <div class="card" style="margin-bottom: var(--space-4);">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h3 class="card-title" style="display: flex; align-items: center; gap: 8px;">
            <i data-lucide="mail" style="color: #EC4899; width: 18px; height: 18px;"></i>
            <span>Endereços de E-mail (${allEmails.length})</span>
          </h3>
          <span class="badge" style="background: rgba(236, 72, 153, 0.15); color: #F472B6;">Identidade Digital</span>
        </div>

        ${
          allEmails.length > 0
            ? `
          <div style="display: flex; flex-wrap: wrap; gap: 10px;">
            ${allEmails
              .map((email) => {
                return `
                <div style="background: var(--color-surface-2); padding: 8px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border); display: flex; align-items: center; gap: 8px;">
                  <span style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--color-text);">${escapeHtml(email)}</span>
                  <button type="button" class="btn btn-ghost btn-sm btn-copiar-generico" data-copy="${escapeHtml(email)}" title="Copiar E-mail">
                    <i data-lucide="copy" style="width: 12px; height: 12px;"></i>
                  </button>
                </div>
              `;
              })
              .join("")}
          </div>
        `
            : `
          <p style="color: var(--color-text-muted); font-size: 0.85rem; padding: var(--space-2) 0;">
            Nenhum e-mail registrado.
          </p>
        `
        }
      </div>

      <!-- ============================================================== -->
      <!-- 7. PARENTES & VÍNCULOS FAMILIARES                              -->
      <!-- ============================================================== -->
      <div class="card" style="margin-bottom: var(--space-4);">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h3 class="card-title" style="display: flex; align-items: center; gap: 8px;">
            <i data-lucide="users" style="color: #6366F1; width: 18px; height: 18px;"></i>
            <span>Parentes & Vínculos de Filiação (${relatives.length})</span>
          </h3>
          <span class="badge" style="background: rgba(99, 102, 241, 0.15); color: #818CF8;">Grau de Parentesco</span>
        </div>

        ${
          relatives.length > 0
            ? `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px;">
            ${relatives
              .map((par) => {
                const pNome = par.nome || par.name || "Parente";
                const pVinculo = par.vinculo || par.grau || par.relacao || "Familiar";
                const pCpf = par.cpf ? Formatters.cpf(par.cpf) : null;
                const rawParCpf = String(par.cpf || "").replace(/\D/g, "");

                return `
                <div style="background: var(--color-surface-2); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <strong style="color: var(--color-text); font-size: 0.875rem; display: block;">${escapeHtml(pNome)}</strong>
                    <div style="font-size: 0.75rem; color: #818CF8; margin-top: 2px;">
                      ${escapeHtml(pVinculo)} ${pCpf ? `• <span style="font-family: var(--font-mono);">${pCpf}</span>` : ""}
                    </div>
                  </div>
                  ${
                    rawParCpf
                      ? `<button type="button" class="btn btn-outline btn-sm btn-puxar-cpf-item" data-cpf="${rawParCpf}" title="Investigar Parente">
                           <i data-lucide="search" style="width: 12px; height: 12px;"></i>
                         </button>`
                      : ""
                  }
                </div>
              `;
              })
              .join("")}
          </div>
        `
            : `
          <p style="color: var(--color-text-muted); font-size: 0.85rem; padding: var(--space-2) 0;">
            Nenhum vínculo de parentesco indexado na base.
          </p>
        `
        }
      </div>

      <!-- ============================================================== -->
      <!-- 8. EMPRESAS & PARTICIPAÇÕES SOCIETÁRIAS (QSA)                  -->
      <!-- ============================================================== -->
      <div class="card" style="margin-bottom: var(--space-4);">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h3 class="card-title" style="display: flex; align-items: center; gap: 8px;">
            <i data-lucide="briefcase" style="color: #14B8A6; width: 18px; height: 18px;"></i>
            <span>Empresas & Participações Societárias (${companies.length})</span>
          </h3>
          <span class="badge" style="background: rgba(20, 184, 166, 0.15); color: #2DD4BF;">Receita Federal (QSA)</span>
        </div>

        ${
          companies.length > 0
            ? `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px;">
            ${companies
              .map((emp) => {
                const cnpj = Formatters.cnpj(emp.cnpj);
                const razao = emp.razao_social || emp.nome || "Empresa";
                const cargo = emp.qualificacao || emp.cargo || "Sócio / Administrador";
                const participacao = emp.participacao ? `${emp.participacao}%` : null;

                return `
                <div style="background: var(--color-surface-2); padding: 12px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
                  <span style="font-family: var(--font-mono); font-size: 0.75rem; color: #2DD4BF; font-weight: 700;">${cnpj}</span>
                  <strong style="color: var(--color-text); font-size: 0.9rem; display: block; margin-top: 2px;">${escapeHtml(razao)}</strong>
                  <div style="font-size: 0.75rem; color: var(--color-text-muted); margin-top: 4px;">
                    Cargo: <strong>${escapeHtml(cargo)}</strong>
                    ${participacao ? ` • Cota: <strong>${participacao}</strong>` : ""}
                  </div>
                </div>
              `;
              })
              .join("")}
          </div>
        `
            : `
          <p style="color: var(--color-text-muted); font-size: 0.85rem; padding: var(--space-2) 0;">
            O titular não possui participações societárias ativas registradas na Receita Federal.
          </p>
        `
        }
      </div>

      <!-- ============================================================== -->
      <!-- 9. VAZAMENTOS DE CREDENCIAIS & SENHAS                           -->
      <!-- ============================================================== -->
      <div class="card" style="margin-bottom: var(--space-4);">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h3 class="card-title" style="display: flex; align-items: center; gap: 8px;">
            <i data-lucide="shield-alert" style="color: #EF4444; width: 18px; height: 18px;"></i>
            <span>Vazamentos de Credenciais & Senhas (${leaks.length})</span>
          </h3>
          <span class="badge" style="background: ${leaks.length === 0 ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)"}; color: ${leaks.length === 0 ? "#10B981" : "#EF4444"};">
            ${leaks.length === 0 ? "Nenhum Vazamento Crítico" : "Comprometido"}
          </span>
        </div>

        ${
          leaks.length > 0
            ? `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px;">
            ${leaks
              .map((vz) => {
                const leakName = vz.nome || vz.name || vz.fonte || "Vazamento Público";
                const leakDate = vz.data || vz.date || "Data não registrada";
                const fields = Array.isArray(vz.campos) ? vz.campos.join(", ") : vz.campos || "Dados Cadastrais";

                return `
                <div style="background: var(--color-surface-2); padding: 12px 14px; border-radius: var(--radius-md); border: 1px solid rgba(239, 68, 68, 0.25);">
                  <strong style="color: #F87171; font-size: 0.875rem; display: block;">${escapeHtml(leakName)}</strong>
                  <span style="font-size: 0.72rem; color: var(--color-text-dim);">Data: ${escapeHtml(leakDate)}</span>
                  <div style="font-size: 0.75rem; color: var(--color-text-muted); margin-top: 4px;">
                    Campos Expostos: <em>${escapeHtml(fields)}</em>
                  </div>
                </div>
              `;
              })
              .join("")}
          </div>
        `
            : `
          <p style="color: #10B981; font-size: 0.85rem; padding: var(--space-2) 0;">
            ✓ Nenhum registro de senha ou credencial vazada localizada nas bases de Dark Web monitoradas.
          </p>
        `
        }
      </div>

      <!-- ============================================================== -->
      <!-- 10. VIZINHOS GEOGRÁFICOS NO LOGRADOURO                          -->
      <!-- ============================================================== -->
      ${
        neighbors.length > 0
          ? `
        <div class="card" style="margin-bottom: var(--space-4);">
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
            <h3 class="card-title" style="display: flex; align-items: center; gap: 8px;">
              <i data-lucide="home" style="color: #8B5CF6; width: 18px; height: 18px;"></i>
              <span>Vizinhos no Mesmo Logradouro (${neighbors.length})</span>
            </h3>
            <span class="badge" style="background: rgba(139, 92, 246, 0.15); color: #C4B5FD;">Mapeamento Geográfico</span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px;">
            ${neighbors
              .map((vz) => {
                const vNome = vz.name || vz.nome || "Vizinho";
                const vCpf = Formatters.cpf(vz.cpf);
                const rawVzCpf = String(vz.cpf || "").replace(/\D/g, "");
                const vNum = vz.numero || vz.number || "S/N";

                return `
                <div style="background: var(--color-surface-2); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <strong style="color: var(--color-text); font-size: 0.875rem; display: block;">${escapeHtml(vNome)}</strong>
                    <div style="font-size: 0.75rem; color: var(--color-text-muted); margin-top: 2px;">
                      Nº ${escapeHtml(vNum)} • <span style="font-family: var(--font-mono); color: #6EE7B7;">${vCpf}</span>
                    </div>
                  </div>
                  ${
                    rawVzCpf
                      ? `<button type="button" class="btn btn-outline btn-sm btn-puxar-cpf-item" data-cpf="${rawVzCpf}" title="Investigar Vizinho">
                           <i data-lucide="search" style="width: 12px; height: 12px;"></i>
                         </button>`
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
    `;
  },
};

