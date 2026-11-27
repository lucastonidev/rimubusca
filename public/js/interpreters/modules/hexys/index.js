/**
 * ==============================================================================
 * HEXYS API INTERPRETERS BUNDLE (INDEX.JS)
 * Consolidates all visual interpreters for Hexys API and routes query payloads.
 * Standardized with Clean Code principles and English naming.
 * ==============================================================================
 */

import { escapeHtml } from "../../utils.js";
import { CpfDossierInterpreter } from "./cpf-dossier.js?v=2.5";
import { VehicleInterpreter } from "./vehicle.js";
import { PhoneInterpreter } from "./phone.js?v=2.6";
import { PhotoInterpreter } from "./photo.js";
import { RecordsTableInterpreter } from "./records-table.js?v=2.8";
import { GenericInterpreter } from "./generic.js?v=2.11";
import { PhonePersonsInterpreter, extractPersonsList } from "./phone-persons.js";
import { RelativesInterpreter } from "./relatives.js?v=2.8";
import { EmailInterpreter } from "./email.js?v=2.8";
import { CompanyInterpreter } from "./company.js?v=2.11";
import { EmploymentInterpreter, bindEmploymentFilters } from "./employment.js?v=2.11";
import { CepInterpreter, bindCepResidentsFilters } from "./cep.js?v=2.7";
import { OabInterpreter } from "./oab.js?v=2.7";
import { NameProfileInterpreter } from "./name.js?v=2.8";
import { LeaksInterpreter, bindLeaksFilters } from "./leaks.js?v=2.7";

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
  EmploymentInterpreter,
  CepInterpreter,
  OabInterpreter,
  NameProfileInterpreter,
  LeaksInterpreter,
  bindCepResidentsFilters,
  bindEmploymentFilters,
  bindLeaksFilters,
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
        <div class="card osint-empty-card osint-empty-card--purple">
          <div class="osint-empty-icon osint-empty-icon--purple">
            <i data-lucide="eye-off" class="icon-xl"></i>
          </div>
          <h3 class="osint-empty-title">Nenhum Cadastro Localizado</h3>
          <p class="osint-empty-desc">
            Não foi localizado nenhum titular correspondente à combinação dos 6 dígitos centrais do CPF com o nome informado na base oficial.
          </p>
        </div>
      `;
    }
    return CpfDossierInterpreter.render(responseData, payload);
  }

  // 1.6 Similar / Phonetic Name searches (only Nome, CPF and 9th-digit estimated origin)
  if (queryType === "nome_similar") {
    const items = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.resultado)
        ? payload.resultado
        : Array.isArray(payload?.resultados)
          ? payload.resultados
          : Array.isArray(responseData?.raw?.resultado)
            ? responseData.raw.resultado
            : [];
    return RecordsTableInterpreter.render(responseData, items);
  }

  // 1.7 OAB / Cadastro Nacional dos Advogados (CNA)
  if (
    queryType === "oab" ||
    Boolean(payload?.CNA_ADVOGADOS || responseData?.raw?.CNA_ADVOGADOS) ||
    (Array.isArray(payload?.advogados) && !payload?.cpf)
  ) {
    return OabInterpreter.render(responseData, payload);
  }

  // 1.75 Quadro de Funcionários (CNPJ) & Histórico Trabalhista (CTPS / CPF)
  if (queryType === "funcionarios" || queryType === "empregos") {
    return EmploymentInterpreter.render(responseData, payload);
  }

  // 1.8 Simple Full Name Lookup (Nome Completo - without empty CPF dossier sections)
  const hasRichDossierFields = Boolean(
    payload?.rg ||
    payload?.tituloEleitor ||
    payload?.cnh ||
    payload?.score ||
    payload?.rendaPresumida ||
    payload?.serasa_completo ||
    (Array.isArray(payload?.telefones) && payload.telefones.length > 0) ||
    (Array.isArray(payload?.enderecos) && payload.enderecos.length > 0) ||
    (Array.isArray(payload?.empresas) && payload.empresas.length > 0) ||
    (Array.isArray(payload?.empresas_vinculadas) && payload.empresas_vinculadas.length > 0)
  );
  if (queryType === "nome" && (responseData?.notFound || responseData?.isNotFound || payload?.notFound || !hasRichDossierFields)) {
    return NameProfileInterpreter.render(responseData, payload);
  }

  // 1.9 Filiação (Mãe e Pai): tabela limpa com Nascimento e estimativa pelo 9º dígito (sem campos vazios)
  if (queryType === "mae" || queryType === "pai") {
    const filhos = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.filhos)
        ? payload.filhos
        : Array.isArray(payload?.resultado)
          ? payload.resultado
          : (payload?.nome || payload?.cpf)
            ? [payload]
            : [];
    return RecordsTableInterpreter.render(responseData, filhos);
  }

  // 2. Individual Dossier (CPF, Voter ID, or explicit Person Document)
  const isPlaceholderVal = (val) => {
    const s = String(val ?? "").trim().toUpperCase();
    return (
      !s ||
      s === "NÃO INFORMADO" ||
      s === "NAO INFORMADO" ||
      s === "NOME NÃO INFORMADO" ||
      s === "NOME NAO INFORMADO" ||
      s === "NÃO INFORMADA" ||
      s === "NAO INFORMADA" ||
      s === "N/I" ||
      s === "N/A" ||
      s === "NULL" ||
      s === "UNDEFINED"
    );
  };
  const hasRealDocCpf = (doc) => String(doc || "").replace(/\D/g, "").length >= 11;
  const isNonCpfModule = [
    "email",
    "email_puxar",
    "mae",
    "pai",
    "arvore_familiar",
    "parentes",
    "parentesco",
    "cnpj",
    "empresa",
    "razao_social",
    "cnaes",
    "socios",
    "funcionarios",
    "empregos",
    "oab",
    "telefone",
    "celular",
    "telefone_puxar",
    "operadora",
    "cep",
    "cep_avancado",
    "cloud_url",
    "cloud_usuario",
    "senha",
    "nome_similar",
  ].includes(queryType);

  if (
    queryType === "cpf" ||
    queryType === "cpf_completo" ||
    queryType === "titulo" ||
    (!isNonCpfModule &&
      (hasRealDocCpf(payload.cpf) || hasRealDocCpf(payload.cpf_raw)) &&
      !isPlaceholderVal(payload.name || payload.nome) &&
      !payload.titular &&
      !payload.parentescos)
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

  // 4. Relatives & Family Tree queries (ONLY explicit parentes, arvore_familiar or kinship payloads)
  if (
    queryType === "parentes" ||
    queryType === "parentesco" ||
    queryType === "arvore_familiar" ||
    (!payload.name && !payload.cpf && (payload.parentescos || payload.url || payload.link || (payload.titular && Array.isArray(payload.parentes))))
  ) {
    return RelativesInterpreter.render(responseData, payload);
  }

  // 5. Telephony with Associated Individuals (Single or Multiple Titulars)
  const hasRealPersonField = (val) => {
    const s = String(val || "").trim();
    const up = s.replace(/[()]/g, "").trim().toUpperCase();
    return Boolean(
      up &&
      up !== "N/I" &&
      up !== "N/A" &&
      up !== "SEM RESULTADO" &&
      up !== "NOME NÃO INFORMADO" &&
      up !== "NOME NAO INFORMADO" &&
      up !== "NÃO INFORMADO" &&
      up !== "NAO INFORMADO"
    );
  };
  const hasValidPersonIdentity = (p) => {
    if (!p || typeof p !== "object") return false;
    const cpfDigits = String(p.cpf_raw || p.cpf || p.titularCpf || "").replace(/\D/g, "");
    const nomeOk = hasRealPersonField(p.nome || p.name || p.titularNome);
    return cpfDigits.length >= 6 || nomeOk;
  };

  const personsFromPhone = extractPersonsList(payload, responseData).filter(hasValidPersonIdentity);
  if (queryType === "telefone" || queryType === "celular" || queryType === "telefone_puxar") {
    if (responseData?.notFound || payload?.notFound || payload?.isNotFound) {
      return PhoneInterpreter.render(responseData, payload);
    }

    // 5.1 Se o payload possui titular identificado com dados pessoais
    if (hasValidPersonIdentity(payload)) {
      return CpfDossierInterpreter.render(responseData, {
        ...payload,
        cpf: payload.cpf || payload.titularCpf,
        nome: payload.nome || payload.name || payload.titularNome,
        name: payload.name || payload.nome || payload.titularNome,
      });
    }

    // 5.2 Se tiver apenas 1 pessoa na lista associada
    if (personsFromPhone.length === 1) {
      const p0 = personsFromPhone[0];
      return CpfDossierInterpreter.render(responseData, { ...payload, ...p0 });
    }

    // 5.3 Múltiplos titulares vinculados à linha
    if (personsFromPhone.length > 1) {
      return PhonePersonsInterpreter.render(responseData, payload);
    }

    // 5.4 Se não encontrou titular, renderiza operadora ou card vazio de "não encontrado"
    return PhoneInterpreter.render(responseData, payload);
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
    queryType === "cnpj2" ||
    queryType === "razao_social" ||
    queryType === "socios" ||
    queryType === "socios2" ||
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
    queryType === "cep_avancado" ||
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
        <div class="card osint-empty-card osint-empty-card--emerald">
          <div class="osint-empty-icon osint-empty-icon--emerald">
            <i data-lucide="shield-check" class="icon-xl"></i>
          </div>
          <h3 class="osint-empty-title">Nenhum Vazamento de Senha Localizado</h3>
          <p class="osint-empty-desc">
            O alvo pesquisado foi auditado contra os repositórios públicos e corporativos de vazamentos monitorados e <strong>não possui senhas em texto claro expostas</strong>.
          </p>
          <div class="mt-4">
            <span class="badge badge-emerald">
              Segurança Preservada
            </span>
          </div>
        </div>
      `;
    }

    return `
      <div class="card osint-section-card osint-section-card--red">
        <div class="card-header">
          <h3 class="card-title">
            <i data-lucide="shield-alert" class="icon-lg icon-red"></i>
            <span>Credenciais &amp; Senhas Expostas (${validPasswords.length})</span>
          </h3>
          <span class="badge badge-danger">Alerta de Vazamento</span>
        </div>
        <div class="osint-chip-row" style="flex-direction: column; align-items: stretch; gap: 10px;">
          ${validPasswords
            .map((item, idx) => {
              const pass = item.senha || item.SENHA || "";
              const mail = item.email || item.EMAIL || null;
              return `
              <div class="osint-leak-item">
                <div class="osint-chip-row">
                  <span class="text-mono" style="font-size: 0.75rem; color: var(--color-text-dim);">#${idx + 1}</span>
                  ${
                    mail
                      ? `<div style="font-size: 0.875rem; color: var(--color-text); font-weight: 500; display: inline-flex; align-items: center; gap: 6px;">
                          <i data-lucide="mail" class="icon-sm icon-cyan"></i>
                          <span>${escapeHtml(mail)}</span>
                        </div>`
                      : ""
                  }
                  <div class="osint-chip-row">
                    <span class="text-mono" style="font-size: 0.75rem; color: #F87171; text-transform: uppercase; font-weight: 700;">Senha:</span>
                    <span class="osint-leak-pass">${escapeHtml(pass)}</span>
                  </div>
                </div>
                <button type="button" class="btn btn-ghost btn-sm btn-osint-red btn-copiar-texto" data-copy="${escapeHtml(pass)}" title="Copiar Senha">
                  <i data-lucide="copy" class="icon-xs"></i>
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

  // 9.6 Cloud URL, Cloud Usuario & Credential Dump searches
  const leakSampleList = Array.isArray(payload?.registros)
    ? payload.registros
    : Array.isArray(payload)
      ? payload
      : [];
  const hasCredentialFields = leakSampleList.some(
    (item) => item && typeof item === "object" && (item.url || item.URL || item.usuario || item.USUARIO || item.senha || item.SENHA)
  );
  if (
    queryType === "cloud_url" ||
    queryType === "cloud_usuario" ||
    queryType === "dump_cpf" ||
    queryType === "dump_email" ||
    queryType === "dump_telefone" ||
    hasCredentialFields
  ) {
    return LeaksInterpreter.render(responseData, payload);
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
  Employment: EmploymentInterpreter,
  Cep: CepInterpreter,
  Oab: OabInterpreter,
  NameProfile: NameProfileInterpreter,
};

export default HexysInterpreter;
