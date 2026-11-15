/**
 * ==============================================================================
 * BACKEND INTERPRETER - HEXYS PHONE & CARRIER (PHONE.INTERPRETER.JS)
 * Normalizes phone queries, detecting single and multi-person cadastral records,
 * area codes, and telecommunication carriers.
 * Standardizes each individual using the comprehensive person normalizer.
 *
 * Clean Code standards with English identifiers and strict null-safety.
 * ==============================================================================
 */

import { normalizePersonRecord, formatPhone } from "./cpf.interpreter.js";

/**
 * Extracts list of persons from various raw API shapes (Arrays, indexed objects, resultado wrapper)
 * @param {any} rawData
 * @returns {Array<Object>}
 */
export function extractPersonsList(rawData) {
  if (Array.isArray(rawData)) return rawData;
  if (!rawData || typeof rawData !== "object") return [];

  if (Array.isArray(rawData.resultado)) return rawData.resultado;
  if (Array.isArray(rawData.resultados)) return rawData.resultados;
  if (Array.isArray(rawData.data)) return rawData.data;
  if (Array.isArray(rawData.pessoas)) return rawData.pessoas;

  // Extract from numeric string keys ("0", "1", "2"...)
  const numericKeys = Object.keys(rawData).filter((k) => /^\d+$/.test(k));
  if (numericKeys.length > 0) {
    numericKeys.sort((a, b) => Number(a) - Number(b));
    const extracted = numericKeys.map((k) => rawData[k]).filter(Boolean);
    if (extracted.some((p) => p && typeof p === "object" && (p.cpf || p.name || p.nome))) {
      return extracted;
    }
  }

  // Object where values are individual person records
  const personValues = Object.values(rawData).filter(
    (v) => v && typeof v === "object" && (v.cpf || v.name || v.nome)
  );
  if (personValues.length > 0) {
    return personValues;
  }

  // Single person record
  if (rawData.name || rawData.nome || rawData.cpf) {
    return [rawData];
  }

  return [];
}

/**
 * Normalizes telephone and carrier lookups
 * @param {Object} rawData
 * @returns {Object} Standardized Telephony DTO
 */
export function interpretHexysPhone(rawData) {
  if (!rawData) return rawData;

  const rawPersons = extractPersonsList(rawData);
  const persons = rawPersons.map(normalizePersonRecord);

  // If persons are found linked to the telephone
  if (persons.length > 0) {
    const rawNumber = String(
      rawData.telefone || rawData.number || rawData.clean_phone || persons[0]?.telefones?.[0]?.numero || persons[0]?.phones?.[0] || ""
    ).replace(/\D/g, "");

    const formattedPhone = formatPhone(rawNumber);
    const ddd = rawNumber.length >= 10 ? rawNumber.slice(0, 2) : null;
    const operadora = rawData.operadora || rawData.operator || (persons[0]?.telefones?.[0]?.operadora) || "Não informada";

    return {
      tipo: "telefone",
      isMultiPerson: true,
      total_titulares: persons.length,
      pessoas: persons,
      resultado: persons, // keep array alias for backward compatibility
      clean_phone: rawNumber,
      telefone_formatado: formattedPhone,
      ddd,
      operadora,
      portabilidade: Boolean(rawData.portabilidade),
      ...(persons.length === 1 ? persons[0] : {}),
    };
  }

  // Pure operator / telephony carrier lookup
  if (typeof rawData === "object") {
    const data = { ...rawData };
    const rawNumber = String(data.telefone || data.number || data.clean_phone || "").replace(/\D/g, "");
    const formattedPhone = formatPhone(rawNumber);

    data.clean_phone = rawNumber;
    data.telefone_formatado = formattedPhone;
    data.ddd = data.ddd || (rawNumber.length >= 10 ? rawNumber.slice(0, 2) : null);
    data.operadora = data.operadora || data.operator || "Não informada";
    data.portabilidade = Boolean(data.portabilidade);

    return data;
  }

  return rawData;
}

export default interpretHexysPhone;
