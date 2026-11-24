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
    const queryType = String(responseData?.tipo || responseData?.type || "").toLowerCase().trim();
    const fullName = data.name || data.nome || data.titularNome || "Não informado";
    const rawCpf = String(data.cpf || data.titularCpf || (queryType.includes("cpf") ? responseData?.termo : "") || "").replace(/\D/g, "");
    const formattedCpf = Formatters.cpf(data.cpf_masked || data.cpf || data.titularCpf || rawCpf);
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
    const cnh = data.cnh?.num_cnh || data.cnh?.numero_registro || data.cnh?.numero || data.cnhNumero || (typeof data.cnh === "string" ? data.cnh : "Não informado");
    const cnhFirst = (data.cnh?.primeira_habilitacao || data.cnh?.data_primeira_habilitacao || data.cnhPrimeiraHabilitacao)
      ? String(data.cnh?.primeira_habilitacao || data.cnh?.data_primeira_habilitacao || data.cnhPrimeiraHabilitacao).split("T")[0]
      : null;
    const mosaic = data.mosaic || data.classeSocial || "N/A";

    const rawCnsList = Array.isArray(data.cns) ? data.cns : (data.cns ? [data.cns] : []);
    const cnsPrimary = rawCnsList[0]?.numero || data.cnsNumero || (typeof data.cns === "string" ? data.cns : "Não informado");
    const pisDoc = data.pis || data.nis || "Não informado";

    // 6. Google Accounts & Photos
    const googleAccounts = Array.isArray(data.contas_google) ? data.contas_google : [];
    const availablePhotos = Array.isArray(data.fotos_disponiveis) ? data.fotos_disponiveis : [];

    // 7. Contacts (Phones & Emails)
    const phones = (Array.isArray(data.telefones) && data.telefones.length > 0)
      ? data.telefones
      : (Array.isArray(data.phones) && data.phones.length > 0)
        ? data.phones
        : [];
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

    // 9. Vehicles (Detran, Renavam, Chassi e Motor)
    const vehiclesList = (Array.isArray(data.veiculos) && data.veiculos.length > 0)
      ? data.veiculos
      : (data.vehicles && Array.isArray(data.vehicles.list))
        ? data.vehicles.list
        : (data.vehicles_proprietario && Array.isArray(data.vehicles_proprietario.list))
          ? data.vehicles_proprietario.list
          : (data.raw && Array.isArray(data.raw.HISTORICO_VEICULOS))
            ? data.raw.HISTORICO_VEICULOS
            : Array.isArray(data.detran_vehicles)
              ? data.detran_vehicles
              : [];

    // 9.1 COVID-19 Vaccines & Health Centers (SUS)
    const vacinasCovid = (Array.isArray(data.vacinas_covid) && data.vacinas_covid.length > 0)
      ? data.vacinas_covid
      : (Array.isArray(data.covid) && data.covid.length > 0)
        ? data.covid
        : (data.raw && Array.isArray(data.raw.COVID))
          ? data.raw.COVID
          : [];

    // 9.2 Banking Institutions & Accounts
    const dadosBancarios = (Array.isArray(data.dadosBancarios) && data.dadosBancarios.length > 0)
      ? data.dadosBancarios
      : (data.raw && Array.isArray(data.raw.DADOS_BANCARIOS))
        ? data.raw.DADOS_BANCARIOS
        : [];

    // 9.3 Employment ties (RAIS / INSS / PIS)
    const vinculosRais = (Array.isArray(data.vinculosEmpregaticios) && data.vinculosEmpregaticios.length > 0)
      ? data.vinculosEmpregaticios
      : (Array.isArray(data.rais) && data.rais.length > 0)
        ? data.rais
        : (data.raw && Array.isArray(data.raw.RAIS))
          ? data.raw.RAIS
          : [];
    const beneficiosInss = (Array.isArray(data.beneficiosInss) && data.beneficiosInss.length > 0)
      ? data.beneficiosInss
      : (data.raw && Array.isArray(data.raw.INSS))
        ? data.raw.INSS
        : [];
    const pisNumero = data.pis || (data.raw && (data.raw.PIS || data.raw.DADOS_PESSOAIS?.PIS)) || null;

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

    // 11. Leaks & Compromised Passwords
    const senhasVazadas = (Array.isArray(data.senhasVazadas) && data.senhasVazadas.length > 0)
      ? data.senhasVazadas
      : (data.raw && Array.isArray(data.raw.SENHA_CPF))
        ? data.raw.SENHA_CPF.map((s) => ({
            senha: s.SENHA || s.senha,
            fonte: "Vazamento Público CPF",
            data: s.DATA || null,
          }))
        : [];
    const rawLeaks = Array.isArray(data.vazamentos) ? data.vazamentos : [];
    const leaks = [...rawLeaks];
    const totalLeaks = data.total_vazamentos || leaks.length + senhasVazadas.length;
    const auditedTargets = data.alvos_verificados_vazamentos || 0;

    // 12. Neighbors
    const neighbors = Array.isArray(data.vizinhos) ? data.vizinhos : [];

    // Coverage & Quality
    const totalSources = data.data_coverage?.total_sources || 16;

    return `
      ${
        queryType === "desmascarador"
          ? `
        <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%); border: 1px solid rgba(16, 185, 129, 0.35); border-radius: var(--radius-md); padding: 12px 18px; margin-bottom: var(--space-4); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 36px; height: 36px; border-radius: 50%; background: rgba(16, 185, 129, 0.2); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <i data-lucide="check-circle" style="width: 20px; height: 20px; color: #10B981;"></i>
            </div>
            <div>
              <div style="font-size: 0.9375rem; font-weight: 700; color: #6EE7B7;">
                Chave PIX Desmascarada com Sucesso
              </div>
              <div style="font-size: 0.8125rem; color: #E2E8F0; margin-top: 2px;">
                Identidade completa revelada a partir do nome do favorecido e dos 6 dígitos centrais.
                ${data.banco ? ` • <strong>Banco:</strong> ${escapeHtml(data.banco)}` : ""}
                ${data.chavePix ? ` • <strong>Chave:</strong> <code>${escapeHtml(data.chavePix)}</code>` : ""}
              </div>
            </div>
          </div>
          <span class="badge badge-success" style="font-weight: 700;">PIX VALIDADO</span>
        </div>
      `
          : ""
      }

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
            <div style="background: var(--color-surface-2); padding: 8px 14px; border-radius: var(--radius-md); text-align: center; border: 1px solid var(--color-border); min-width: 120px;">
              <span style="font-size: 0.7rem; color: var(--color-text-muted); text-transform: uppercase;">Score de Crédito</span>
              <div style="font-size: 1.25rem; font-weight: 800; color: #60A5FA;">${escapeHtml(scoreVal)}</div>
              <div style="display: flex; gap: 6px; justify-content: center; margin-top: 2px; flex-wrap: wrap;">
                ${scoreObj.csb8 ? `<span style="font-size: 0.65rem; color: #34D399; font-weight: 700;" title="Score CSB8">CSB8: ${escapeHtml(scoreObj.csb8)}</span>` : csb8Range ? `<span style="font-size: 0.65rem; color: #34D399; font-weight: 700;">${escapeHtml(csb8Range)}</span>` : ""}
                ${scoreObj.csba ? `<span style="font-size: 0.65rem; color: #A78BFA; font-weight: 700;" title="Score CSBA">CSBA: ${escapeHtml(scoreObj.csba)}</span>` : ""}
              </div>
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

          <div style="background: var(--color-surface-2); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
            <span style="font-size: 0.75rem; color: var(--color-text-muted); display: block;">Cartão SUS (CNS)</span>
            <strong style="color: #38BDF8; font-family: var(--font-mono);">${escapeHtml(cnsPrimary)}</strong>
          </div>

          <div style="background: var(--color-surface-2); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
            <span style="font-size: 0.75rem; color: var(--color-text-muted); display: block;">PIS / NIS</span>
            <strong style="color: #A78BFA; font-family: var(--font-mono);">${escapeHtml(pisDoc)}</strong>
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
      <!-- 3. VEÍCULOS & FROTA AUTOMOTIVA (MERCOSUL / RENAVAM / CHASSI)   -->
      <!-- ============================================================== -->
      ${
        vehiclesList.length > 0
          ? `
      <div class="card" style="margin-bottom: var(--space-4); border-left: 4px solid #3B82F6;">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <h3 class="card-title" style="display: flex; align-items: center; gap: 8px; color: #60A5FA;">
            <i data-lucide="car" style="color: #3B82F6; width: 18px; height: 18px;"></i>
            <span>Veículos Registrados &amp; Frota (${vehiclesList.length})</span>
          </h3>
          <span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #60A5FA;">Bases Detran &amp; Renavam</span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px; padding-top: 8px;">
            ${vehiclesList
              .map((v) => {
                const rawPlate = String(v.placa || v.PLACA || v.plate || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
                const formattedPlate = rawPlate.length === 7 ? `${rawPlate.slice(0, 3)}-${rawPlate.slice(3)}` : (rawPlate || "SEM PLACA");
                const model = v.marcaModelo || v.marca || v.modelo || v.MARCA || v.MODELO || v.model || v.brand || "Veículo Registrado";
                const year = v.ano || v.ano_fab || v.ano_modelo || v.ANO || v.year_model || (Array.isArray(v.years) ? v.years.join("/") : "");
                const color = v.cor || v.COR || v.color || "";
                const situation = v.situacao || v.SITUACAO || "CIRCULAR";
                const renavam = v.renavam || v.RENAVAM || "NÃO INFORMADO";
                const chassis = v.chassi || v.CHASSI || v.chassis || "NÃO INFORMADO";
                const motor = v.motor || v.MOTOR || "N/I";

                return `
                <div style="background: var(--color-surface-2); padding: 14px 16px; border-radius: var(--radius-md); border: 1px solid var(--color-border); display: flex; flex-direction: column; gap: 10px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                      <!-- Badge Placa Estilo Mercosul Oficial -->
                      <div style="display: inline-flex; flex-direction: column; align-items: center; border: 2px solid #3B82F6; border-radius: 5px; background: #FFFFFF; color: #000000; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.4); flex-shrink: 0;">
                        <div style="background: #1D4ED8; color: #FFFFFF; width: 100%; font-size: 0.55rem; font-weight: 900; text-align: center; padding: 1px 10px; letter-spacing: 1px;">
                          BRASIL
                        </div>
                        <div style="font-family: var(--font-mono); font-weight: 900; font-size: 1.15rem; padding: 1px 10px; letter-spacing: 2px; color: #0F172A;">
                          ${formattedPlate}
                        </div>
                      </div>

                      <div>
                        <h4 style="font-size: 1.05rem; font-weight: 800; color: #FFFFFF; margin: 0;">
                          ${escapeHtml(model)}
                        </h4>
                        <div style="font-size: 0.8rem; color: var(--color-text-muted); margin-top: 3px;">
                          ${year ? `Ano: <strong style="color: var(--color-text);">${escapeHtml(year)}</strong> &bull; ` : ""}
                          ${color ? `Cor: <strong style="color: var(--color-text);">${escapeHtml(color)}</strong> &bull; ` : ""}
                          Situação: <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10B981; font-size: 0.68rem; padding: 1px 6px;">${escapeHtml(situation)}</span>
                        </div>
                      </div>
                    </div>

                    ${
                      rawPlate
                        ? `
                      <button type="button" class="btn btn-primary btn-sm btn-puxar-placa" data-placa="${rawPlate}" style="display: inline-flex; align-items: center; gap: 6px;">
                        <i data-lucide="search" style="width: 14px; height: 14px;"></i>
                        <span>Puxar Dossiê da Placa</span>
                      </button>
                    `
                        : ""
                    }
                  </div>

                  <!-- Grid de Detalhes Técnicos: Chassi, Renavam, Motor -->
                  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 8px; background: var(--color-surface); padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid rgba(255, 255, 255, 0.04); font-size: 0.8rem;">
                    <div>
                      <span style="color: var(--color-text-dim); font-size: 0.72rem; text-transform: uppercase;">Chassi:</span>
                      <div style="font-family: var(--font-mono); color: #38BDF8; font-weight: 700; display: flex; align-items: center; gap: 6px; margin-top: 2px;">
                        <span>${escapeHtml(chassis)}</span>
                        ${chassis && chassis !== "NÃO INFORMADO" ? `<button type="button" class="btn btn-ghost btn-sm btn-copiar-texto" data-copy="${escapeHtml(chassis)}" title="Copiar Chassi" style="padding: 1px 4px;"><i data-lucide="copy" style="width: 11px; height: 11px;"></i></button>` : ""}
                      </div>
                    </div>

                    <div>
                      <span style="color: var(--color-text-dim); font-size: 0.72rem; text-transform: uppercase;">RENAVAM:</span>
                      <div style="font-family: var(--font-mono); color: #6EE7B7; font-weight: 700; display: flex; align-items: center; gap: 6px; margin-top: 2px;">
                        <span>${escapeHtml(renavam)}</span>
                        ${renavam && renavam !== "NÃO INFORMADO" ? `<button type="button" class="btn btn-ghost btn-sm btn-copiar-texto" data-copy="${escapeHtml(renavam)}" title="Copiar Renavam" style="padding: 1px 4px;"><i data-lucide="copy" style="width: 11px; height: 11px;"></i></button>` : ""}
                      </div>
                    </div>

                    <div>
                      <span style="color: var(--color-text-dim); font-size: 0.72rem; text-transform: uppercase;">Nº do Motor:</span>
                      <div style="font-family: var(--font-mono); color: #F1F5F9; font-weight: 600; margin-top: 2px;">
                        ${escapeHtml(motor)}
                      </div>
                    </div>
                  </div>
                </div>
              `;
              })
              .join("")}
          </div>
        </div>
      `
          : ""
      }

      <!-- ============================================================== -->
      <!-- 3.1 HISTÓRICO VACINAL COVID-19 & LOCAIS DE VACINAÇÃO (SUS)     -->
      <!-- ============================================================== -->
      ${
        vacinasCovid.length > 0
          ? `
        <div class="card" style="margin-bottom: var(--space-4); border-left: 4px solid #EC4899;">
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <h3 class="card-title" style="color: #EC4899; display: flex; align-items: center; gap: 8px;">
              <i data-lucide="syringe" style="width: 18px; height: 18px;"></i>
              <span>Histórico Vacinal COVID-19 &amp; Postos de Aplicação (${vacinasCovid.length} Doses Registradas)</span>
            </h3>
            <span class="badge" style="background: rgba(236, 72, 153, 0.15); color: #F472B6; font-size: 0.72rem; font-weight: 700;">
              Base ConecteSUS / MS
            </span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px; padding-top: 10px;">
            ${vacinasCovid
              .map((vac, idx) => {
                const dose = vac.dose || vac.DESCRICAO_DA_VACINA || vac.DOSE || `Dose #${idx + 1}`;
                const vacNome = vac.vacina || vac.NOME_DA_VACINA || "COVID-19";
                const data = vac.dataAplicacao || vac.DATA_DE_APLICACAO || vac.DATA_APLICACAO || "Data N/I";
                const lote = vac.lote || vac.LOTE_DA_VACINA || vac.LOTE || "N/I";
                const local = vac.localCompleto || vac.estabelecimento || vac.NOME_DO_ESTABELECIMENTO || vac.ESTABELECIMENTO || "Posto Municipal de Saúde";
                const mun = vac.municipio || vac.MUNICIPIO || "";
                const uf = vac.uf || vac.UF || "";
                const aplicador = vac.aplicador || vac.APLICADOR_DE_VACINA || null;
                const grupo = vac.grupoAtendimento || vac.GRUPO_DE_ATENDIMENTO || null;

                const isPfizer = String(vacNome).toUpperCase().includes("PFIZER");
                const isAstra = String(vacNome).toUpperCase().includes("ASTRAZENECA");
                const isCoronavac = String(vacNome).toUpperCase().includes("CORONAVAC") || String(vacNome).toUpperCase().includes("BUTANTAN");
                const badgeColor = isPfizer ? "#8B5CF6" : isAstra ? "#3B82F6" : isCoronavac ? "#10B981" : "#EC4899";

                return `
                <div style="background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 14px; position: relative; overflow: hidden;">
                  <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: ${badgeColor};"></div>
                  
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 8px;">
                    <div>
                      <span class="badge" style="background: rgba(236, 72, 153, 0.15); color: #F472B6; font-weight: 700; font-size: 0.72rem; text-transform: uppercase;">
                        ${escapeHtml(dose)}
                      </span>
                      <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--color-text); margin: 6px 0 0 0;">
                        ${escapeHtml(vacNome)}
                      </h4>
                    </div>
                    <span style="font-family: var(--font-mono); font-size: 0.78rem; color: #10B981; background: rgba(16, 185, 129, 0.12); padding: 3px 8px; border-radius: 4px; white-space: nowrap; font-weight: 600;">
                      📅 ${escapeHtml(data)}
                    </span>
                  </div>

                  <!-- Local / Posto onde tomou a vacina -->
                  <div style="background: var(--color-surface); padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid rgba(255, 255, 255, 0.04); margin-top: 10px;">
                    <div style="display: flex; align-items: flex-start; gap: 6px;">
                      <i data-lucide="map-pin" style="width: 14px; height: 14px; color: #EC4899; flex-shrink: 0; margin-top: 2px;"></i>
                      <div>
                        <div style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; font-weight: 700;">
                          Local / Posto de Vacinação:
                        </div>
                        <div style="font-size: 0.825rem; font-weight: 700; color: #F1F5F9; margin-top: 2px;">
                          ${escapeHtml(local)}
                        </div>
                        ${
                          mun || uf
                            ? `<div style="font-size: 0.75rem; color: #94A3B8; margin-top: 2px;">Município: <strong style="color: #CBD5E1;">${escapeHtml(mun)}${uf ? `/${escapeHtml(uf)}` : ""}</strong></div>`
                            : ""
                        }
                      </div>
                    </div>
                  </div>

                  <!-- Detalhes do Lote e Aplicador -->
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; font-size: 0.75rem;">
                    <div>
                      <span style="color: var(--color-text-dim);">Lote da Vacina:</span>
                      <div style="font-family: var(--font-mono); font-weight: 700; color: #C4B5FD;">${escapeHtml(lote)}</div>
                    </div>
                    ${
                      aplicador
                        ? `
                      <div>
                        <span style="color: var(--color-text-dim);">Profissional / Aplicador:</span>
                        <div style="color: var(--color-text); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(aplicador)}">
                          ${escapeHtml(aplicador)}
                        </div>
                      </div>
                    `
                        : ""
                    }
                  </div>

                  ${
                    grupo
                      ? `
                    <div style="margin-top: 8px; font-size: 0.72rem; color: var(--color-text-muted);">
                      Grupo de Atendimento: <span style="color: var(--color-text);">${escapeHtml(grupo)}</span>
                    </div>
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

      <!-- ============================================================== -->
      <!-- 4. ENDEREÇOS & LOGRADOUROS (COM DELIVERY / E-COMMERCE)           -->
      <!-- ============================================================== -->
      ${
        allAddresses.length > 0
          ? `
      <div class="card" style="margin-bottom: var(--space-4);">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h3 class="card-title" style="display: flex; align-items: center; gap: 8px;">
            <i data-lucide="map-pin" style="color: #10B981; width: 18px; height: 18px;"></i>
            <span>Histórico de Endereços (${allAddresses.length})</span>
          </h3>
          <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10B981;">Residencial & E-Commerce</span>
        </div>

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
      </div>
      `
          : ""
      }

      <!-- ============================================================== -->
      <!-- 5. TELEFONES & LINHAS DE CONTATO (SEPARADOS POR OPERADORA)     -->
      <!-- ============================================================== -->
      ${
        phones.length > 0 || vivoLines.length > 0
          ? (() => {
              const grupos = {
                VIVO: [],
                CLARO: [],
                TIM: [],
                OI: [],
                OUTROS: [],
              };

              phones.forEach((t) => {
                const phoneStr = typeof t === "object" ? t.numero || t.telefone || t.number : String(t);
                const clean = String(t.numeroLimpo || phoneStr || "").replace(/\D/g, "");
                const op = String(t.operadora || carriersMap[clean] || "").toUpperCase();
                if (op.includes("VIVO")) grupos.VIVO.push(t);
                else if (op.includes("CLARO")) grupos.CLARO.push(t);
                else if (op.includes("TIM")) grupos.TIM.push(t);
                else if (op.includes("OI")) grupos.OI.push(t);
                else grupos.OUTROS.push(t);
              });

              // Also integrate vivoLines if any are not already in VIVO
              vivoLines.forEach((vl) => {
                const clean = String(vl.numero || vl).replace(/\D/g, "");
                const exists = grupos.VIVO.some((x) => String(x.numero || x.telefone || x).replace(/\D/g, "") === clean);
                if (!exists) {
                  grupos.VIVO.push({
                    numero: clean,
                    operadora: "VIVO",
                    tipo: "Linha Ativa Vivo",
                  });
                }
              });

              const totalCount = phones.length + vivoLines.length;
              const totalOpCount =
                (grupos.VIVO.length > 0 ? 1 : 0) +
                (grupos.CLARO.length > 0 ? 1 : 0) +
                (grupos.TIM.length > 0 ? 1 : 0) +
                (grupos.OI.length > 0 ? 1 : 0);

              const renderTelCard = (t) => {
                const phoneStr = typeof t === "object" ? t.numero || t.telefone || t.number : String(t);
                const cleanNum = String(t.numeroLimpo || phoneStr || "").replace(/\D/g, "");
                const fmtNum = Formatters.phone(t.ddd, phoneStr);
                const isMobile = cleanNum.length === 11 || (cleanNum.length === 9 && cleanNum.startsWith("9"));
                const op = String(t.operadora || carriersMap[cleanNum] || (isMobile ? "Móvel" : "Fixo")).toUpperCase();
                const dataInst = t.dataInstalacao || t.data || null;
                const endLinha = t.enderecoLinha || t.ENDERECO || null;

                let opBg = "rgba(59, 130, 246, 0.15)";
                let opColor = "#60A5FA";
                let opBorder = "rgba(59, 130, 246, 0.3)";
                if (op.includes("VIVO")) {
                  opBg = "rgba(139, 92, 246, 0.18)";
                  opColor = "#A78BFA";
                  opBorder = "rgba(139, 92, 246, 0.4)";
                } else if (op.includes("CLARO")) {
                  opBg = "rgba(239, 68, 68, 0.18)";
                  opColor = "#F87171";
                  opBorder = "rgba(239, 68, 68, 0.4)";
                } else if (op.includes("TIM")) {
                  opBg = "rgba(37, 99, 235, 0.2)";
                  opColor = "#60A5FA";
                  opBorder = "rgba(37, 99, 235, 0.4)";
                } else if (op.includes("OI")) {
                  opBg = "rgba(245, 158, 11, 0.18)";
                  opColor = "#FBBF24";
                  opBorder = "rgba(245, 158, 11, 0.4)";
                }

                return `
                <div style="background: var(--color-surface-2); padding: 12px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border); display: flex; flex-direction: column; gap: 8px; flex: 1 1 280px; max-width: 100%;">
                  <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span style="font-family: var(--font-mono); font-weight: 800; font-size: 1.05rem; color: #FFFFFF;">${fmtNum}</span>
                      <span class="badge" style="background: ${opBg}; color: ${opColor}; border: 1px solid ${opBorder}; font-size: 0.68rem; font-weight: 700; padding: 2px 7px;">
                        ${op}
                      </span>
                      ${t.tipo && t.tipo !== op ? `<span style="font-size: 0.7rem; color: var(--color-text-dim);">(${escapeHtml(t.tipo)})</span>` : ""}
                    </div>
                    
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <button type="button" class="btn btn-ghost btn-sm btn-copiar-texto" data-copy="${cleanNum}" title="Copiar Telefone">
                        <i data-lucide="copy" style="width: 13px; height: 13px;"></i>
                      </button>
                      <button type="button" class="btn btn-ghost btn-sm btn-puxar-operadora" data-tel="${cleanNum}" data-telefone="${cleanNum}" title="Checar Portabilidade &amp; Operadora Atual">
                        <i data-lucide="radio" style="width: 13px; height: 13px; color: #F59E0B;"></i>
                      </button>
                      ${
                        isMobile
                          ? `
                        <a href="https://wa.me/55${cleanNum}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm" title="Abrir no WhatsApp Web" style="color: #10B981;">
                          <i data-lucide="message-circle" style="width: 14px; height: 14px;"></i>
                        </a>
                      `
                          : ""
                      }
                      <a href="tel:${cleanNum}" class="btn btn-ghost btn-sm" title="Ligar para o número" style="color: #38BDF8;">
                        <i data-lucide="phone-call" style="width: 13px; height: 13px;"></i>
                      </a>
                    </div>
                  </div>

                  ${
                    dataInst || endLinha
                      ? `
                    <div style="font-size: 0.75rem; color: var(--color-text-muted); background: var(--color-surface); padding: 6px 10px; border-radius: var(--radius-sm); border: 1px solid rgba(255, 255, 255, 0.03);">
                      ${dataInst ? `<div>📅 <strong style="color: var(--color-text);">Instalação:</strong> ${escapeHtml(dataInst)}</div>` : ""}
                      ${endLinha ? `<div style="margin-top: 2px;">📍 <strong style="color: var(--color-text);">Endereço da Linha:</strong> ${escapeHtml(endLinha)}</div>` : ""}
                    </div>
                  `
                      : ""
                  }
                </div>
              `;
              };

              return `
              <div class="card" style="margin-bottom: var(--space-4); border-left: 4px solid #60A5FA;">
                <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                  <h3 class="card-title" style="color: #60A5FA; display: flex; align-items: center; gap: 8px;">
                    <i data-lucide="phone" style="width: 18px; height: 18px;"></i>
                    <span>Telefones &amp; Linhas Telefônicas (${totalCount})</span>
                  </h3>
                  <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                    ${grupos.VIVO.length > 0 ? `<span class="badge" style="background: rgba(139, 92, 246, 0.2); color: #C4B5FD; font-size: 0.7rem;">${grupos.VIVO.length} Vivo</span>` : ""}
                    ${grupos.CLARO.length > 0 ? `<span class="badge" style="background: rgba(239, 68, 68, 0.2); color: #FCA5A5; font-size: 0.7rem;">${grupos.CLARO.length} Claro</span>` : ""}
                    ${grupos.TIM.length > 0 ? `<span class="badge" style="background: rgba(59, 130, 246, 0.2); color: #93C5FD; font-size: 0.7rem;">${grupos.TIM.length} TIM</span>` : ""}
                    ${grupos.OI.length > 0 ? `<span class="badge" style="background: rgba(245, 158, 11, 0.2); color: #FDE68A; font-size: 0.7rem;">${grupos.OI.length} Oi</span>` : ""}
                    ${grupos.OUTROS.length > 0 ? `<span class="badge badge-dark" style="font-size: 0.7rem;">${grupos.OUTROS.length} Outros</span>` : ""}
                  </div>
                </div>

                ${
                  totalOpCount > 1
                    ? `
                  <div style="display: flex; flex-direction: column; gap: 14px; padding-top: 10px;">
                    ${
                      grupos.VIVO.length > 0
                        ? `
                      <div>
                        <div style="font-size: 0.75rem; font-weight: 700; color: #A78BFA; text-transform: uppercase; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                          <span style="width: 8px; height: 8px; border-radius: 50%; background: #8B5CF6;"></span>
                          Linhas Telefônicas VIVO (${grupos.VIVO.length})
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                          ${grupos.VIVO.map(renderTelCard).join("")}
                        </div>
                      </div>
                    `
                        : ""
                    }
                    ${
                      grupos.CLARO.length > 0
                        ? `
                      <div>
                        <div style="font-size: 0.75rem; font-weight: 700; color: #F87171; text-transform: uppercase; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                          <span style="width: 8px; height: 8px; border-radius: 50%; background: #EF4444;"></span>
                          Linhas Telefônicas CLARO (${grupos.CLARO.length})
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                          ${grupos.CLARO.map(renderTelCard).join("")}
                        </div>
                      </div>
                    `
                        : ""
                    }
                    ${
                      grupos.TIM.length > 0
                        ? `
                      <div>
                        <div style="font-size: 0.75rem; font-weight: 700; color: #60A5FA; text-transform: uppercase; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                          <span style="width: 8px; height: 8px; border-radius: 50%; background: #3B82F6;"></span>
                          Linhas Telefônicas TIM (${grupos.TIM.length})
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                          ${grupos.TIM.map(renderTelCard).join("")}
                        </div>
                      </div>
                    `
                        : ""
                    }
                    ${
                      grupos.OI.length > 0
                        ? `
                      <div>
                        <div style="font-size: 0.75rem; font-weight: 700; color: #FBBF24; text-transform: uppercase; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                          <span style="width: 8px; height: 8px; border-radius: 50%; background: #F59E0B;"></span>
                          Linhas Telefônicas OI (${grupos.OI.length})
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                          ${grupos.OI.map(renderTelCard).join("")}
                        </div>
                      </div>
                    `
                        : ""
                    }
                    ${
                      grupos.OUTROS.length > 0
                        ? `
                      <div>
                        <div style="font-size: 0.75rem; font-weight: 700; color: #94A3B8; text-transform: uppercase; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                          <span style="width: 8px; height: 8px; border-radius: 50%; background: #64748B;"></span>
                          Histórico Geral de Telefones (${grupos.OUTROS.length})
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                          ${grupos.OUTROS.map(renderTelCard).join("")}
                        </div>
                      </div>
                    `
                        : ""
                    }
                  </div>
                `
                    : `
                  <div style="display: flex; flex-wrap: wrap; gap: 10px; padding-top: 10px;">
                    ${phones.map(renderTelCard).join("")}
                  </div>
                `
                }
              </div>
            `;
            })()
          : ""
      }

      <!-- ============================================================== -->
      <!-- 6. E-MAILS & IDENTIDADE DIGITAL                                -->
      <!-- ============================================================== -->
      ${
        allEmails.length > 0
          ? `
      <div class="card" style="margin-bottom: var(--space-4);">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h3 class="card-title" style="display: flex; align-items: center; gap: 8px;">
            <i data-lucide="mail" style="color: #EC4899; width: 18px; height: 18px;"></i>
            <span>Endereços de E-mail (${allEmails.length})</span>
          </h3>
          <span class="badge" style="background: rgba(236, 72, 153, 0.15); color: #F472B6;">Identidade Digital</span>
        </div>

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
      </div>
      `
          : ""
      }

      <!-- ============================================================== -->
      <!-- 7. PARENTES & VÍNCULOS FAMILIARES                              -->
      <!-- ============================================================== -->
      ${
        relatives.length > 0
          ? `
      <div class="card" style="margin-bottom: var(--space-4);">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h3 class="card-title" style="display: flex; align-items: center; gap: 8px;">
            <i data-lucide="users" style="color: #6366F1; width: 18px; height: 18px;"></i>
            <span>Parentes & Vínculos de Filiação (${relatives.length})</span>
          </h3>
          <span class="badge" style="background: rgba(99, 102, 241, 0.15); color: #818CF8;">Grau de Parentesco</span>
        </div>

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
      </div>
      `
          : ""
      }

      <!-- ============================================================== -->
      <!-- 8. EMPRESAS & PARTICIPAÇÕES SOCIETÁRIAS (QSA)                  -->
      <!-- ============================================================== -->
      ${
        companies.length > 0
          ? `
      <div class="card" style="margin-bottom: var(--space-4);">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h3 class="card-title" style="display: flex; align-items: center; gap: 8px;">
            <i data-lucide="briefcase" style="color: #14B8A6; width: 18px; height: 18px;"></i>
            <span>Empresas & Participações Societárias (${companies.length})</span>
          </h3>
          <span class="badge" style="background: rgba(20, 184, 166, 0.15); color: #2DD4BF;">Receita Federal (QSA)</span>
        </div>

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
      </div>
      `
          : ""
      }

      <!-- ============================================================== -->
      <!-- 8.1 DADOS BANCÁRIOS & CONTAS CADASTRADAS                       -->
      <!-- ============================================================== -->
      ${
        dadosBancarios.length > 0
          ? `
        <div class="card" style="margin-bottom: var(--space-4); border-left: 4px solid #3B82F6;">
          <div class="card-header">
            <h3 class="card-title" style="color: #60A5FA; display: flex; align-items: center; gap: 8px;">
              <i data-lucide="landmark" style="width: 18px; height: 18px;"></i>
              <span>Vínculos Bancários &amp; Contas Cadastradas (${dadosBancarios.length})</span>
            </h3>
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; padding-top: 8px;">
            ${dadosBancarios
              .map((b) => {
                const bNome = b.banco || b.INSTITUICAO || b.BANCO || "Instituição Financeira";
                const bAg = b.agencia || b.AGENCIA || "Não informada";
                const bNum = b.numero || b.NUMERO || null;
                return `
                <div style="background: var(--color-surface-2); padding: 12px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                    <i data-lucide="building" style="width: 16px; height: 16px; color: #60A5FA;"></i>
                    <strong style="color: var(--color-text); font-size: 0.875rem;">${escapeHtml(bNome)}</strong>
                  </div>
                  <div style="font-size: 0.8rem; color: var(--color-text-muted);">
                    Agência: <span style="font-family: var(--font-mono); color: #6EE7B7; font-weight: 700;">${escapeHtml(bAg)}</span>
                    ${bNum ? ` &bull; Conta: <span style="font-family: var(--font-mono); color: var(--color-text); font-weight: 600;">${escapeHtml(bNum)}</span>` : ""}
                  </div>
                </div>
              `;
              })
              .join("")}
          </div>
        </div>
      `
          : ""
      }

      <!-- ============================================================== -->
      <!-- 8.2 HISTÓRICO TRABALHISTA & VÍNCULOS FUNCIONAIS (RAIS / INSS) -->
      <!-- ============================================================== -->
      ${
        vinculosRais.length > 0 || beneficiosInss.length > 0 || pisNumero
          ? `
        <div class="card" style="margin-bottom: var(--space-4); border-left: 4px solid #F59E0B;">
          <div class="card-header">
            <h3 class="card-title" style="color: #F59E0B; display: flex; align-items: center; gap: 8px;">
              <i data-lucide="briefcase" style="width: 18px; height: 18px;"></i>
              <span>Vínculos Empregatícios &amp; Histórico Funcional (RAIS / INSS)</span>
            </h3>
          </div>
          <div style="display: flex; flex-direction: column; gap: 10px; padding-top: 8px;">
            ${
              pisNumero
                ? `
              <div style="background: var(--color-surface-2); padding: 8px 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border); display: flex; align-items: center; gap: 10px;">
                <span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #F59E0B; font-weight: 700;">PIS / PASEP</span>
                <span style="font-family: var(--font-mono); font-weight: 700; color: var(--color-text);">${escapeHtml(pisNumero)}</span>
              </div>
            `
                : ""
            }
            ${vinculosRais
              .map((r) => {
                const rNome = r.razaoSocial || r.RAZAO_SOCIAL || "Órgão / Empregador";
                const rCnpj = r.cnpj || r.CNPJ || "";
                const rSit = r.situacao || r.SITUACAO || "ENTREGUE";
                return `
                <div style="background: var(--color-surface-2); padding: 12px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                  <div>
                    <strong style="color: var(--color-text); font-size: 0.9rem;">${escapeHtml(rNome)}</strong>
                    <div style="font-size: 0.8rem; color: var(--color-text-muted); margin-top: 2px;">
                      ${rCnpj ? `CNPJ: <span style="font-family: var(--font-mono); color: #60A5FA;">${Formatters.cnpj(rCnpj)}</span> &bull; ` : ""}
                      Situação RAIS: <span style="color: #10B981; font-weight: 600;">${escapeHtml(rSit)}</span>
                    </div>
                  </div>
                  <span class="badge badge-dark" style="font-size: 0.7rem;">RAIS Oficial</span>
                </div>
              `;
              })
              .join("")}
            ${beneficiosInss
              .map((i) => {
                const nb = i.nb || i.NB || "N/I";
                const ent = i.entidade || i.ENTIDADE || "SIAPE / INSS";
                return `
                <div style="background: var(--color-surface-2); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                  <div>
                    <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase;">Benefício Previdenciário / Vínculo Público:</span>
                    <div style="font-weight: 700; color: #A78BFA; font-size: 0.85rem; margin-top: 2px;">${escapeHtml(ent)}</div>
                  </div>
                  <div style="text-align: right;">
                    <span style="font-size: 0.7rem; color: var(--color-text-dim);">Nº do Benefício:</span>
                    <div style="font-family: var(--font-mono); font-weight: 700; color: #6EE7B7;">${escapeHtml(nb)}</div>
                  </div>
                </div>
              `;
              })
              .join("")}
          </div>
        </div>
      `
          : ""
      }

      <!-- ============================================================== -->
      <!-- 9. VAZAMENTOS DE CREDENCIAIS & SENHAS COMPROMETIDAS             -->
      <!-- ============================================================== -->
      ${
        senhasVazadas.length > 0 || leaks.length > 0
          ? `
      <div class="card" style="margin-bottom: var(--space-4); border-left: 4px solid #EF4444;">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h3 class="card-title" style="display: flex; align-items: center; gap: 8px;">
            <i data-lucide="shield-alert" style="color: #EF4444; width: 18px; height: 18px;"></i>
            <span>Vazamentos de Credenciais &amp; Senhas (${senhasVazadas.length + leaks.length})</span>
          </h3>
          <span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #EF4444; font-weight: 700;">
            Comprometido
          </span>
        </div>

        ${
          senhasVazadas.length > 0
            ? `
          <div style="margin-bottom: 14px;">
            <div style="font-size: 0.75rem; font-weight: 700; color: #F87171; text-transform: uppercase; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: #EF4444;"></span>
              Senhas Comprometidas Indexadas (${senhasVazadas.length})
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              ${senhasVazadas
                .map((s) => {
                  const pass = s.senha || s.SENHA || "";
                  return `
                  <div style="background: var(--color-surface-2); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid rgba(239, 68, 68, 0.3); display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span class="badge badge-red" style="font-size: 0.65rem;">SENHA EXPOSTA</span>
                      <span style="font-family: var(--font-mono); font-weight: 800; color: #FCA5A5; font-size: 0.95rem;">${escapeHtml(pass)}</span>
                    </div>
                    <button type="button" class="btn btn-ghost btn-sm btn-copiar-texto" data-copy="${escapeHtml(pass)}" title="Copiar Senha">
                      <i data-lucide="copy" style="width: 12px; height: 12px;"></i>
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
            : ""
        }
      </div>
      `
          : ""
      }

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

