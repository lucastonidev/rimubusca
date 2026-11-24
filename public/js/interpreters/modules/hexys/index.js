/**
 * ==============================================================================
 * HEXYS API INTERPRETERS BUNDLE (INDEX.JS)
 * Consolidates all visual interpreters for Hexys API and routes query payloads.
 * Standardized with Clean Code principles and English naming.
 * ==============================================================================
 */

import { CpfDossierInterpreter } from "./cpf-dossier.js";
import { VehicleInterpreter } from "./vehicle.js";
import { PhoneInterpreter } from "./phone.js";
import { PhotoInterpreter } from "./photo.js";
import { RecordsTableInterpreter } from "./records-table.js";
import { GenericInterpreter } from "./generic.js";
import { PhonePersonsInterpreter, extractPersonsList } from "./phone-persons.js";
import { RelativesInterpreter } from "./relatives.js";
import { EmailInterpreter } from "./email.js";
import { CompanyInterpreter } from "./company.js";
import { CepInterpreter } from "./cep.js";

export {
  CpfDossierInterpreter,
  VehicleInterpreter,
  PhoneInterpreter,
  PhotoInterpreter,
  RecordsTableInterpreter,
  GenericInterpreter,
  PhonePersonsInterpreter,
  RelativesInterpreter,
  EmailInterpreter,
  CompanyInterpreter,
  CepInterpreter,
  extractPersonsList,
};

/**
 * Dispatches a Hexys API response to its corresponding visual module interpreter
 * @param {Object} responseData - Complete response object from backend
 * @returns {string} HTML markup
 */
export function dispatchHexys(responseData) {
  if (!responseData) return "";

  const payload = responseData.dados !== undefined ? responseData.dados : (responseData.data !== undefined ? responseData.data : responseData);
  const queryType = String(responseData.tipo || responseData.type || "").toLowerCase().trim();

  // 1. Standalone Facial Biometrics query
  if (queryType === "foto") {
    return PhotoInterpreter.render(responseData, payload);
  }

  // 1.5 Desmascarador de Dados / PIX
  if (queryType === "desmascarador") {
    if (payload?.isNotFound || (!payload.cpf && !payload.nome && !payload.name)) {
      return `
        <div class="card" style="text-align: center; padding: var(--space-8); border-top: 4px solid #8B5CF6;">
          <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(139, 92, 246, 0.12); display: inline-flex; align-items: center; justify-content: center; margin-bottom: 14px;">
            <i data-lucide="eye-off" style="width: 32px; height: 32px; color: #A78BFA;"></i>
          </div>
          <h3 style="font-size: 1.15rem; font-weight: 700; color: #FFFFFF; margin-bottom: 6px;">Nenhum Cadastro Localizado</h3>
          <p style="color: var(--color-text-muted); font-size: 0.875rem; max-width: 500px; margin: 0 auto;">
            Não foi localizado nenhum titular correspondente à combinação dos 6 dígitos centrais do CPF com o nome informado na base oficial.
          </p>
        </div>
      `;
    }
    return CpfDossierInterpreter.render(responseData, payload);
  }

  // 2. Individual Dossier (CPF, Voter ID, or explicit Person Document)
  if (
    queryType === "cpf" ||
    queryType === "cpf_completo" ||
    queryType === "titulo" ||
    (payload.cpf && (payload.name || payload.nome) && !payload.titular && !payload.parentescos)
  ) {
    return CpfDossierInterpreter.render(responseData, payload);
  }

  // 3. Vehicle / License Plate queries
  if (
    queryType === "placa" ||
    queryType === "veiculo" ||
    (!payload.name && !payload.cpf && (payload.plate || payload.placa))
  ) {
    return VehicleInterpreter.render(responseData, payload);
  }

  // 4. Relatives & Family Tree queries (ONLY explicit parentes or kinship payloads)
  if (
    queryType === "parentes" ||
    queryType === "parentesco" ||
    (!payload.name && !payload.cpf && (payload.parentescos || (payload.titular && Array.isArray(payload.parentes))))
  ) {
    return RelativesInterpreter.render(responseData, payload);
  }

  // 5. Telephony with Associated Individuals (Single or Multiple Titulars)
  const personsFromPhone = extractPersonsList(payload, responseData);
  if (queryType === "telefone" || queryType === "celular" || queryType === "telefone_puxar") {
    // 5.1 Se o payload possui titular identificado com dados pessoais
    if ((payload.cpf || payload.titularCpf) && (payload.nome || payload.name || payload.titularNome)) {
      return CpfDossierInterpreter.render(responseData, {
        ...payload,
        cpf: payload.cpf || payload.titularCpf,
        nome: payload.nome || payload.name || payload.titularNome,
        name: payload.name || payload.nome || payload.titularNome,
      });
    }

    // 5.2 Se tiver apenas 1 pessoa na lista associada
    if (personsFromPhone.length === 1 && (personsFromPhone[0].cpf || personsFromPhone[0].name || personsFromPhone[0].nome)) {
      const p0 = personsFromPhone[0];
      return CpfDossierInterpreter.render(responseData, { ...payload, ...p0 });
    }

    // 5.3 Múltiplos titulares vinculados à linha
    if (personsFromPhone.length > 1) {
      return PhonePersonsInterpreter.render(responseData, payload);
    }

    // 5.4 Se não encontrou titular, mas retornou dados de operadora
    if (payload.operadora || payload.operator) {
      return PhoneInterpreter.render(responseData, payload);
    }
  }

  // If query returned multiple persons through indexed object or persons array
  if (personsFromPhone.length > 1) {
    return PhonePersonsInterpreter.render(responseData, payload);
  }

  // 6. Pure Telecommunication Carrier queries
  if (
    queryType === "operadora" ||
    (!payload.name && !payload.cpf && payload.operadora && payload.confianca)
  ) {
    return PhoneInterpreter.render(responseData, payload);
  }

  // 7. Company / CNPJ / Corporate Registration queries (checked before Email because CNPJs often include company email)
  if (
    queryType === "cnpj" ||
    queryType === "empresa" ||
    (!payload.name && !payload.cpf && (payload.razaoSocial || payload.razao_social || payload.sociosQSA || payload.qsa || (payload.cnpj && payload.capitalSocial)))
  ) {
    return CompanyInterpreter.render(responseData, payload);
  }

  // 8. Email OSINT & Digital Identity queries
  if (
    queryType === "email" ||
    queryType === "email_puxar" ||
    (!payload.name && !payload.cpf && (payload.email || payload.pessoas_vinculadas || payload.perfil_google))
  ) {
    return EmailInterpreter.render(responseData, payload);
  }

  // 9. CEP & Geographic Address queries
  if (
    queryType === "cep" ||
    queryType === "endereco" ||
    queryType === "logradouro" ||
    (!payload.name && !payload.cpf && (payload.cep || payload.logradouro) && (payload.cidade || payload.bairro || payload.uf))
  ) {
    return CepInterpreter.render(responseData, payload);
  }

  // 9.5 Leaked Passwords & Credential Breaches query
  if (queryType === "senha") {
    const list = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.vazamentos)
        ? payload.vazamentos
        : Array.isArray(payload?.senhas)
          ? payload.senhas
          : Array.isArray(payload?.resultado)
            ? payload.resultado
            : [];

    const validPasswords = list.filter((item) => {
      if (!item) return false;
      const p = String(item.senha || item.SENHA || "").trim();
      const e = String(item.email || item.EMAIL || "").trim();
      return p !== "" || e !== "";
    });

    if (validPasswords.length === 0) {
      return `
        <div class="card" style="text-align: center; padding: var(--space-8); border-top: 4px solid #10B981;">
          <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(16, 185, 129, 0.12); display: inline-flex; align-items: center; justify-content: center; margin-bottom: 14px;">
            <i data-lucide="shield-check" style="width: 32px; height: 32px; color: #10B981;"></i>
          </div>
          <h3 style="font-size: 1.15rem; font-weight: 700; color: #FFFFFF; margin-bottom: 6px;">Nenhum Vazamento de Senha Localizado</h3>
          <p style="color: var(--color-text-muted); font-size: 0.875rem; max-width: 500px; margin: 0 auto;">
            O alvo pesquisado foi auditado contra os repositórios públicos e corporativos de vazamentos monitorados e <strong>não possui senhas em texto claro expostas</strong>.
          </p>
          <div style="margin-top: 16px;">
            <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3); font-weight: 600; padding: 4px 10px;">
              Segurança Preservada
            </span>
          </div>
        </div>
      `;
    }

    return `
      <div class="card" style="margin-bottom: var(--space-4); border-top: 4px solid #EF4444;">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <i data-lucide="shield-alert" style="color: #EF4444; width: 20px; height: 20px;"></i>
            <h3 class="card-title" style="color: var(--color-text); margin: 0;">
              Credenciais &amp; Senhas Expostas (${validPasswords.length})
            </h3>
          </div>
          <span class="badge badge-danger">Alerta de Vazamento</span>
        </div>
        <div style="padding: var(--space-4); display: flex; flex-direction: column; gap: 10px;">
          ${validPasswords
            .map((item, idx) => {
              const pass = item.senha || item.SENHA || "";
              const mail = item.email || item.EMAIL || null;
              return `
              <div style="background: var(--color-surface-2); padding: 12px 16px; border-radius: var(--radius-md); border: 1px solid rgba(239, 68, 68, 0.25); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--color-text-dim);">#${idx + 1}</span>
                  ${
                    mail
                      ? `<div style="font-size: 0.875rem; color: var(--color-text); font-weight: 500;">
                          <i data-lucide="mail" style="width: 14px; height: 14px; color: #38BDF8; vertical-align: middle; margin-right: 4px;"></i>
                          ${escapeHtml(mail)}
                        </div>`
                      : ""
                  }
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 0.75rem; color: #F87171; text-transform: uppercase; font-family: var(--font-mono); font-weight: 700;">Senha:</span>
                    <span style="font-family: var(--font-mono); font-size: 0.9375rem; font-weight: 700; color: #FCA5A5; background: rgba(239, 68, 68, 0.15); padding: 3px 8px; border-radius: 4px;">
                      ${escapeHtml(pass)}
                    </span>
                  </div>
                </div>
                <button type="button" class="btn btn-ghost btn-sm btn-copiar-texto" data-copy="${escapeHtml(pass)}" title="Copiar Senha" style="border: 1px solid rgba(239, 68, 68, 0.3); color: #FCA5A5;">
                  <i data-lucide="copy" style="width: 12px; height: 12px;"></i>
                  <span>Copiar</span>
                </button>
              </div>
            `;
            })
            .join("")}
        </div>
      </div>
    `;
  }

  // 10. Arrays / Tabular lists (Name homonyms, CEP street addresses, neighbors)
  if (
    Array.isArray(payload) ||
    Array.isArray(payload?.resultado) ||
    Array.isArray(payload?.resultados)
  ) {
    const items = Array.isArray(payload)
      ? payload
      : Array.isArray(payload.resultado)
        ? payload.resultado
        : payload.resultados;

    return RecordsTableInterpreter.render(responseData, items);
  }

  // 11. Individual Dossier Fallback
  if (payload.name || payload.nome || payload.cpf || payload.titularNome || payload.titularCpf) {
    return CpfDossierInterpreter.render(responseData, {
      ...payload,
      cpf: payload.cpf || payload.titularCpf,
      nome: payload.nome || payload.name || payload.titularNome,
      name: payload.name || payload.nome || payload.titularNome,
    });
  }

  // 12. Generic Object Fallback
  return GenericInterpreter.render(responseData, payload);
}

export const HexysInterpreter = {
  dispatch: dispatchHexys,
  CpfDossier: CpfDossierInterpreter,
  Vehicle: VehicleInterpreter,
  Phone: PhoneInterpreter,
  Photo: PhotoInterpreter,
  RecordsTable: RecordsTableInterpreter,
  Generic: GenericInterpreter,
  PhonePersons: PhonePersonsInterpreter,
  Relatives: RelativesInterpreter,
  Email: EmailInterpreter,
  Company: CompanyInterpreter,
  Cep: CepInterpreter,
};

export default HexysInterpreter;
