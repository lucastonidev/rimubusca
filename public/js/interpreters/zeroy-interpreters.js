/**
 * ==============================================================================
 * RIMUBUSCA - VISUAL INTERPRETERS MASTER COORDINATOR (ZERROY & HEXYS)
 * Multi-provider architecture ("Duas ou mais frentes de API")
 *
 * Coordinates data visualizers for multiple intelligence providers:
 *  - Hexys Dev Intelligence (/modules/hexys/)
 *  - Zeroy API (/modules/zeroy/)
 *
 * Clean Code standards with English identifiers and backward-compatible aliases.
 * ==============================================================================
 */

import { Formatters, escapeHtml, renderScoreBadge } from "./utils.js";
import {
  ZeroyInterpreter,
  dispatchZeroy,
  CpfDossierInterpreter as ZeroyCpfDossierInterpreter,
  NameHomonymsInterpreter,
  VehicleInterpreter as ZeroyVehicleInterpreter,
  CompanyInterpreter,
  FinancialPixInterpreter,
  PhoneInterpreter as ZeroyPhoneInterpreter,
  BiometricsInterpreter as ZeroyBiometricsInterpreter,
  HealthInterpreter,
  CivilRegistryInterpreter,
  GenericInterpreter as ZeroyGenericInterpreter,
} from "./modules/zeroy/index.js?v=2.9";

import {
  HexysInterpreter,
  dispatchHexys,
  CpfDossierInterpreter as HexysCpfDossierInterpreter,
  VehicleInterpreter as HexysVehicleInterpreter,
  PhoneInterpreter as HexysPhoneInterpreter,
  PhotoInterpreter as HexysPhotoInterpreter,
  RecordsTableInterpreter as HexysRecordsTableInterpreter,
  GenericInterpreter as HexysGenericInterpreter,
  PhonePersonsInterpreter as HexysPhonePersonsInterpreter,
  RelativesInterpreter as HexysRelativesInterpreter,
  EmailInterpreter as HexysEmailInterpreter,
  CompanyInterpreter as HexysCompanyInterpreter,
  EmploymentInterpreter as HexysEmploymentInterpreter,
  CepInterpreter as HexysCepInterpreter,
  OabInterpreter as HexysOabInterpreter,
  NameProfileInterpreter as HexysNameProfileInterpreter,
  LeaksInterpreter as HexysLeaksInterpreter,
  bindCepResidentsFilters,
  bindEmploymentFilters,
  bindLeaksFilters,
  extractPersonsList,
} from "./modules/hexys/index.js?v=2.11";

/**
 * Multi-provider Dispatcher
 * Routes response payload to the appropriate provider interpreter
 *
 * @param {Object} responseData - Raw or structured response object from backend API
 * @param {string} [preferredProvider="hexys"] - Fallback provider if not specified in responseData
 * @returns {string} Safe HTML string ready to render in the results DOM
 */
export function dispatch(responseData, preferredProvider = "rimuapi") {
  if (!responseData) return "";

  const fonte = String(responseData.fonte || "").toLowerCase();
  const provider = String(
    responseData.provedor ||
    responseData.provider ||
    responseData.api ||
    (fonte.includes("rimu")
      ? "rimuapi"
      : fonte.includes("hexys")
        ? "hexys"
        : fonte.includes("zeroy")
          ? "zeroy"
          : preferredProvider) ||
    "rimuapi"
  ).toLowerCase().trim();

  switch (provider) {
    case "rimuapi":
    case "rimu":
    case "santbuscas":
    case "hexys":
      return dispatchHexys(responseData);
    case "zeroy":
      return dispatchZeroy(responseData);
    default:
      if (fonte.includes("rimu") || fonte.includes("hexys")) return dispatchHexys(responseData);
      return dispatchZeroy(responseData);
  }
}

// Visual Interpreters Registry
export const RimuInterpreters = {
  // Master dispatchers
  dispatch,
  dispatchRimuApi: dispatchHexys,
  dispatchHexys,
  dispatchZeroy,

  // Utilities & Helpers
  Formatters,
  escapeHtml,
  renderScoreBadge,

  // RimuAPI Sub-bundle
  RimuApi: HexysInterpreter,

  // Hexys Sub-bundle (Legacy Alias)
  Hexys: HexysInterpreter,

  // Zeroy Sub-bundle
  Zeroy: ZeroyInterpreter,

  // Hexys Visual Modules
  HexysCpfDossier: HexysCpfDossierInterpreter,
  HexysVehicle: HexysVehicleInterpreter,
  HexysPhone: HexysPhoneInterpreter,
  HexysPhoto: HexysPhotoInterpreter,
  HexysRecordsTable: HexysRecordsTableInterpreter,
  HexysGeneric: HexysGenericInterpreter,
  HexysPhonePersons: HexysPhonePersonsInterpreter,
  HexysRelatives: HexysRelativesInterpreter,
  HexysEmail: HexysEmailInterpreter,
  HexysCompany: HexysCompanyInterpreter,
  HexysEmployment: HexysEmploymentInterpreter,
  HexysCep: HexysCepInterpreter,
  HexysOab: HexysOabInterpreter,
  HexysNameProfile: HexysNameProfileInterpreter,
  HexysLeaks: HexysLeaksInterpreter,
  bindCepResidentsFilters,
  bindEmploymentFilters,
  bindLeaksFilters,
  extractPersonsList,

  // Zeroy Visual Modules
  ZeroyCpfDossier: ZeroyCpfDossierInterpreter,
  ZeroyNameHomonyms: NameHomonymsInterpreter,
  ZeroyVehicle: ZeroyVehicleInterpreter,
  ZeroyCompany: CompanyInterpreter,
  ZeroyFinancialPix: FinancialPixInterpreter,
  ZeroyPhone: ZeroyPhoneInterpreter,
  ZeroyBiometrics: ZeroyBiometricsInterpreter,
  ZeroyHealth: HealthInterpreter,
  ZeroyCivilRegistry: CivilRegistryInterpreter,
  ZeroyGeneric: ZeroyGenericInterpreter,
  ZeroyCep: HexysCepInterpreter,

  // Legacy Aliases
  CpfDossier: HexysCpfDossierInterpreter,
  Vehicle: HexysVehicleInterpreter,
  Phone: HexysPhoneInterpreter,
  Relatives: HexysRelativesInterpreter,
  Email: HexysEmailInterpreter,
  Company: HexysCompanyInterpreter,
  Generic: HexysGenericInterpreter,
};

// Expose globally on window for browser-wide accessibility
if (typeof window !== "undefined") {
  window.RimuInterpreters = RimuInterpreters;
}

export {
  dispatchHexys,
  dispatchZeroy,
  HexysInterpreter,
  ZeroyInterpreter,
  HexysOabInterpreter,
  HexysNameProfileInterpreter,
  HexysLeaksInterpreter,
  HexysEmploymentInterpreter,
  Formatters,
  escapeHtml,
  renderScoreBadge,
  extractPersonsList,
  bindCepResidentsFilters,
  bindEmploymentFilters,
  bindLeaksFilters,
};

export default RimuInterpreters;
