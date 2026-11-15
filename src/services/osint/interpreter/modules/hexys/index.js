/**
 * ==============================================================================
 * BACKEND INTERPRETER - HEXYS MODULES INDEX (INDEX.JS)
 * Routes and normalizes payloads for all Hexys endpoints.
 * Standardizes single entities and lists into clean, unified contracts.
 * ==============================================================================
 */

import { interpretHexysCpf, normalizePersonRecord } from "./cpf.interpreter.js";
import { interpretHexysVehicle } from "./vehicle.interpreter.js";
import { interpretHexysPhone, extractPersonsList } from "./phone.interpreter.js";
import { interpretHexysPhoto } from "./photo.interpreter.js";
import { interpretHexysRelatives } from "./relatives.interpreter.js";
import { interpretHexysEmail } from "./email.interpreter.js";
import { interpretHexysCompany } from "./company.interpreter.js";

export function interpretHexys(type, rawData) {
  if (!rawData) return rawData;

  const normalizedType = String(type || "").toLowerCase().trim();

  switch (normalizedType) {
    case "cpf":
    case "titulo":
      if (Array.isArray(rawData)) {
        return rawData.map(normalizePersonRecord);
      }
      return interpretHexysCpf(rawData);

    case "parentes":
    case "parentesco":
      return interpretHexysRelatives(rawData);

    case "nome":
    case "vizinhos": {
      // If array or object containing person list
      const list = extractPersonsList(rawData);
      if (list.length > 0) {
        const normalizedList = list.map(normalizePersonRecord);
        return {
          tipo: normalizedType,
          isList: true,
          total: normalizedList.length,
          resultado: normalizedList,
          resultados: normalizedList,
          ...(normalizedList.length === 1 ? normalizedList[0] : {}),
        };
      }
      if (typeof rawData === "object" && (rawData.name || rawData.nome || rawData.cpf)) {
        return normalizePersonRecord(rawData);
      }
      return rawData;
    }

    case "placa":
    case "veiculo":
      return interpretHexysVehicle(rawData);

    case "telefone":
    case "celular":
    case "operadora":
      return interpretHexysPhone(rawData);

    case "foto":
      return interpretHexysPhoto(rawData);

    case "email":
    case "email_puxar":
      return interpretHexysEmail(rawData);

    case "cnpj":
    case "empresa":
      return interpretHexysCompany(rawData);

    default:
      if (rawData && typeof rawData === "object" && (rawData.cnpj || rawData.razaoSocial || rawData.razao_social || rawData.sociosQSA)) {
        return interpretHexysCompany(rawData);
      }
      if (rawData && typeof rawData === "object" && (rawData.email || rawData.pessoas_vinculadas)) {
        return interpretHexysEmail(rawData);
      }
      if (Array.isArray(rawData)) {
        if (rawData.some((i) => i && typeof i === "object" && (i.cpf || i.name || i.nome))) {
          return rawData.map(normalizePersonRecord);
        }
        return rawData;
      }
      if (typeof rawData === "object" && (rawData.name || rawData.nome || rawData.cpf)) {
        return normalizePersonRecord(rawData);
      }
      return rawData;
  }
}

export {
  interpretHexysCpf,
  interpretHexysVehicle,
  interpretHexysPhone,
  interpretHexysPhoto,
  interpretHexysRelatives,
  interpretHexysEmail,
  interpretHexysCompany,
  normalizePersonRecord,
  extractPersonsList,
};

export default interpretHexys;
