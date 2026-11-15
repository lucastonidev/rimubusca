/**
 * ==============================================================================
 * BACKEND INTERPRETER - ZEROY MODULES INDEX (INDEX.JS)
 * Standardizes raw responses from Zeroy API endpoints before caching or rendering.
 * ==============================================================================
 */

export function interpretZeroy(moduleId, rawData) {
  if (!rawData || typeof rawData !== "object") return rawData;

  const data = { ...rawData };
  const idLower = String(moduleId || "").toLowerCase();

  // Basic normalization for vehicles
  if (idLower.includes("placa") || idLower.includes("chassi") || idLower.includes("veiculo")) {
    if (data.dados_veiculo) {
      data.dados_veiculo.placa = String(data.dados_veiculo.placa || "").toUpperCase();
    }
  }

  // Basic normalization for CPF / individuals
  if (idLower.includes("cpf") || idLower.includes("nome")) {
    if (data.dadosBasicos && data.dadosBasicos.cpf) {
      data.dadosBasicos.cleanCpf = String(data.dadosBasicos.cpf).replace(/\D/g, "");
    }
  }

  return data;
}

export default interpretZeroy;

