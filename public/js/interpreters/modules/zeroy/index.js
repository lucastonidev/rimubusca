/**
 * ==============================================================================
 * ZEROY API INTERPRETERS BUNDLE (INDEX.JS)
 * Consolidates all Zeroy API modules and provides the provider-specific dispatcher.
 * Standardized with Clean Code principles and English naming.
 * ==============================================================================
 */

import { CpfDossierInterpreter } from "./cpf-dossier.js?v=2.9";
import { NameHomonymsInterpreter } from "./name-homonyms.js";
import { VehicleInterpreter } from "./vehicle.js";
import { CompanyInterpreter } from "./company.js";
import { FinancialPixInterpreter } from "./financial-pix.js";
import { PhoneInterpreter } from "./phone.js?v=2.9";
import { BiometricsInterpreter } from "./biometrics.js?v=2.9";
import { HealthInterpreter } from "./health.js";
import { CivilRegistryInterpreter } from "./civil-registry.js";
import { GenericInterpreter } from "./generic.js";
import { CepInterpreter } from "../hexys/cep.js?v=2.6";
import { escapeHtml } from "../../utils.js";

export {
  CpfDossierInterpreter,
  NameHomonymsInterpreter,
  VehicleInterpreter,
  CompanyInterpreter,
  FinancialPixInterpreter,
  PhoneInterpreter,
  BiometricsInterpreter,
  HealthInterpreter,
  CivilRegistryInterpreter,
  GenericInterpreter,
  CepInterpreter,
};

/**
 * Dispatches a Zeroy API response to its corresponding visual module interpreter
 * @param {Object} responseData
 * @returns {string} HTML markup
 */
export function dispatchZeroy(responseData) {
  if (!responseData) return "";

  const payload = responseData.dados || responseData.data || responseData;
  const moduleType = String(
    responseData.tipo || responseData.id || responseData.moduloId || ""
  ).toLowerCase();

  // Estado vazio padronizado para qualquer módulo Zeroy com notFound
  if (responseData.notFound || payload?.notFound || payload?.isNotFound) {
    if (moduleType === "telefone" || moduleType.includes("telefone")) {
      return PhoneInterpreter.render(responseData, payload);
    }
    if (moduleType === "reconnc") {
      return BiometricsInterpreter.render(responseData, payload);
    }
    const termoEmpty = responseData.termo ? ` para <strong>${escapeHtml(String(responseData.termo))}</strong>` : "";
    const msgEmpty = payload?.mensagem ? escapeHtml(String(payload.mensagem)) : `Não foi localizado nenhum registro${termoEmpty} na base da Zeroy API.`;
    return `
      <div class="card osint-empty-card osint-empty-card--purple">
        <div class="osint-empty-icon osint-empty-icon--warning">
          <i data-lucide="search-x" class="icon-xl"></i>
        </div>
        <h3 class="osint-empty-title">Nenhum Registro Localizado</h3>
        <p class="osint-empty-desc">${msgEmpty}</p>
      </div>
    `;
  }

  // 0. CEP & Endereçamento Postal
  if (
    moduleType === "cep" ||
    moduleType.includes("cep") ||
    (!payload.cpf && !payload.name && (payload.cep || payload.dados?.cep || payload.logradouro || payload.dados?.logradouro))
  ) {
    const cepPayload = payload.dados || payload;
    return CepInterpreter.render(responseData, cepPayload);
  }

  // 1. Phone & Line Carrier Registry
  if (
    moduleType === "telefone" ||
    moduleType.includes("telefone") ||
    payload.operadora ||
    payload.tipoLinha
  ) {
    return PhoneInterpreter.render(responseData, payload);
  }

  // 2. PIX, SISBAJUD, BACEN SPI, and Bank Relationships
  if (
    moduleType.includes("pix") ||
    moduleType.includes("sisbajud") ||
    moduleType.includes("bacen") ||
    payload.chaves ||
    payload.chavesPix ||
    payload.sisbajud ||
    payload.contas ||
    payload.relacionamentos
  ) {
    return FinancialPixInterpreter.render(responseData, payload);
  }

  // 3. Facial Biometrics, Facial Recognition (reconnc) & CNH Mirror
  if (
    moduleType === "reconnc" ||
    moduleType.includes("foto") ||
    moduleType.includes("biometria") ||
    Array.isArray(payload.matches) ||
    payload.foto ||
    payload.fotoBase64 ||
    payload.face ||
    (typeof payload.base64 === "string" && payload.base64.length > 200)
  ) {
    return BiometricsInterpreter.render(responseData, payload);
  }

  // 4. Vaccination Card & ConecteSUS Health Records
  if (
    moduleType.includes("vacina") ||
    moduleType.includes("cns") ||
    moduleType.includes("sus") ||
    payload.vacinas ||
    payload.imunizacoes
  ) {
    return HealthInterpreter.render(responseData, payload);
  }

  // 5. Civil Registry (Birth & Death Certificates)
  if (
    moduleType.includes("nascimento") ||
    moduleType.includes("obito") ||
    payload.certidao ||
    payload.termo ||
    payload.livro
  ) {
    return CivilRegistryInterpreter.render(responseData, payload);
  }

  // 6. Complete CPF Dossier (Physical Person)
  if (
    moduleType === "cpf" ||
    moduleType === "cpf-zeroy" ||
    payload.data?.dadosBasicos ||
    payload.dadosBasicos ||
    payload.carteriaHabilitacao ||
    payload.telefonesHistorico
  ) {
    return CpfDossierInterpreter.render(payload);
  }

  // 7. Nominal Search & Homonyms Listing
  if (
    moduleType === "nome" ||
    moduleType.includes("nome") ||
    moduleType.includes("homonimo") ||
    Array.isArray(payload.registros) ||
    Array.isArray(payload.data?.registros) ||
    Array.isArray(payload.dados?.registros) ||
    Array.isArray(payload.resultados) ||
    Array.isArray(payload.homonimos)
  ) {
    return NameHomonymsInterpreter.render(responseData, payload);
  }

  // 8. Vehicle, License Plate, Renavam & Chassi
  if (
    moduleType.includes("placa") ||
    moduleType.includes("chassi") ||
    moduleType.includes("renavam") ||
    moduleType.includes("veiculo") ||
    moduleType.includes("crlv") ||
    payload.placa ||
    payload.chassi ||
    payload.marca ||
    payload.marcaModelo
  ) {
    return VehicleInterpreter.render(responseData, payload);
  }

  // 9. Company, Corporate CNPJ & QSA
  if (moduleType.includes("cnpj") || payload.cnpj || payload.razaoSocial) {
    return CompanyInterpreter.render(payload);
  }

  // 10. Smart Recursive Generic Fallback
  return GenericInterpreter.render(payload);
}

export const ZeroyInterpreter = {
  dispatch: dispatchZeroy,
  CpfDossier: CpfDossierInterpreter,
  NameHomonyms: NameHomonymsInterpreter,
  Vehicle: VehicleInterpreter,
  Company: CompanyInterpreter,
  FinancialPix: FinancialPixInterpreter,
  Phone: PhoneInterpreter,
  Biometrics: BiometricsInterpreter,
  Health: HealthInterpreter,
  CivilRegistry: CivilRegistryInterpreter,
  Generic: GenericInterpreter,
  Cep: CepInterpreter,

  // Portuguese backward-compatible aliases
  CpfDossie: CpfDossierInterpreter,
  NomeLista: NameHomonymsInterpreter,
  VeiculoPlaca: VehicleInterpreter,
  CnpjEmpresa: CompanyInterpreter,
  PixFinanceiro: FinancialPixInterpreter,
  Telefone: PhoneInterpreter,
  FotoBiometria: BiometricsInterpreter,
  VacinaSaude: HealthInterpreter,
  CertidaoCartorio: CivilRegistryInterpreter,
  CepEndereco: CepInterpreter,
  Generico: GenericInterpreter,
};

export default ZeroyInterpreter;

