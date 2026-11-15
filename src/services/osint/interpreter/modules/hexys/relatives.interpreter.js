/**
 * ==============================================================================
 * BACKEND INTERPRETER - HEXYS RELATIVES & KINSHIP TREE (RELATIVES.INTERPRETER.JS)
 * Standardizes familial relationships, kinships, and family tree connections.
 * Clean Code standards with English identifiers and strict null-safety.
 * ==============================================================================
 */

/**
 * Categorizes kinship type for styling and hierarchy
 * @param {string} vinculo
 * @returns {"ascendente" | "conjugal" | "colateral" | "descendente" | "outro"}
 */
export function categorizeKinship(vinculo) {
  const norm = String(vinculo || "").toUpperCase();
  if (norm.includes("MÃE") || norm.includes("MAE") || norm.includes("PAI") || norm.includes("AVÔ") || norm.includes("AVO") || norm.includes("AVÓ")) {
    return "ascendente";
  }
  if (norm.includes("CÔNJUGE") || norm.includes("CONJUGE") || norm.includes("ESPOS") || norm.includes("MARIDO") || norm.includes("COMPANHEIR")) {
    return "conjugal";
  }
  if (norm.includes("IRMÃ") || norm.includes("IRMAO") || norm.includes("IRMÃO") || norm.includes("TIO") || norm.includes("TIA") || norm.includes("PRIM")) {
    return "colateral";
  }
  if (norm.includes("FILH") || norm.includes("NET")) {
    return "descendente";
  }
  return "outro";
}

/**
 * Translates relationship to English keyword
 * @param {string} vinculo
 * @returns {string}
 */
export function translateKinship(vinculo) {
  const norm = String(vinculo || "").toUpperCase();
  if (norm.includes("MÃE") || norm.includes("MAE")) return "mother";
  if (norm.includes("PAI")) return "father";
  if (norm.includes("CÔNJUGE") || norm.includes("CONJUGE") || norm.includes("ESPOS") || norm.includes("MARIDO")) return "spouse";
  if (norm.includes("IRMÃ") || norm.includes("IRMAO") || norm.includes("IRMÃO")) return "sibling";
  if (norm.includes("FILH")) return "child";
  return "relative";
}

/**
 * Normalizes a single kinship entry
 * @param {Object} item
 * @returns {Object}
 */
export function normalizeRelativeItem(item) {
  if (!item || typeof item !== "object") return null;

  const vinculoRaw = item.vinculo || item.parentesco || item.grau || item.relationship || "Parente";
  const vinculo = String(vinculoRaw).toUpperCase().trim();
  const nome = String(item.nome || item.name || "NÃO INFORMADO").toUpperCase().trim();
  
  const rawCpf = String(item.cpf || item.documento || "").trim();
  const cleanDigits = rawCpf.replace(/\D/g, "");
  const isMaskedCpf = rawCpf.includes("*") || cleanDigits.length !== 11;
  const cleanCpf = cleanDigits.length === 11 ? cleanDigits : null;

  const idade = item.idade !== undefined && item.idade !== null ? Number(item.idade) : (item.age || null);
  const dataNascimento = item.dataNascimento || item.data_nascimento || item.birthDate || null;

  const category = categorizeKinship(vinculo);
  const relationship = translateKinship(vinculo);

  return {
    vinculo,
    relationship,
    category,
    nome,
    name: nome,
    cpf: rawCpf || "Não informado",
    cleanCpf,
    isMaskedCpf,
    idade,
    age: idade,
    dataNascimento,
    birthDate: dataNascimento,
  };
}

/**
 * Normalizes root family tree payload
 * @param {Object|Array} rawData
 * @returns {Object} Standardized Relatives DTO
 */
export function interpretHexysRelatives(rawData) {
  if (!rawData) return rawData;

  let titular = "";
  let list = [];

  if (Array.isArray(rawData)) {
    list = rawData;
  } else if (typeof rawData === "object") {
    titular = rawData.titular || rawData.target || rawData.termo || rawData.name || rawData.nome || "";
    if (Array.isArray(rawData.parentescos)) {
      list = rawData.parentescos;
    } else if (Array.isArray(rawData.parentes)) {
      list = rawData.parentes;
    } else if (Array.isArray(rawData.resultado)) {
      list = rawData.resultado;
    } else if (Array.isArray(rawData.resultados)) {
      list = rawData.resultados;
    } else if (Array.isArray(rawData.data)) {
      list = rawData.data;
    }
  }

  const normalizedList = list.map(normalizeRelativeItem).filter(Boolean);

  // Group metrics
  let ascendentes = 0;
  let conjuges = 0;
  let colaterais = 0;
  let descendentes = 0;
  let outros = 0;

  normalizedList.forEach((r) => {
    switch (r.category) {
      case "ascendente":
        ascendentes++;
        break;
      case "conjugal":
        conjuges++;
        break;
      case "colateral":
        colaterais++;
        break;
      case "descendente":
        descendentes++;
        break;
      default:
        outros++;
        break;
    }
  });

  return {
    tipo: "parentes",
    titular: titular ? String(titular).toUpperCase().trim() : "ALVO PESQUISADO",
    target: titular,
    totalParentes: normalizedList.length,
    total: normalizedList.length,
    parentescos: normalizedList,
    parentes: normalizedList,
    metrics: {
      total: normalizedList.length,
      ascendentes,
      conjuges,
      colaterais,
      descendentes,
      outros,
    },
  };
}

export default interpretHexysRelatives;

