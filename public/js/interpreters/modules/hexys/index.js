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

  // 2. Individual Dossier (CPF, Voter ID, or explicit Person Document)
  if (
    queryType === "cpf" ||
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
    if (personsFromPhone.length > 0) {
      return PhonePersonsInterpreter.render(responseData, payload);
    }
    // If no persons found but operator is returned
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
  if (payload.name || payload.nome || payload.cpf) {
    return CpfDossierInterpreter.render(responseData, payload);
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
