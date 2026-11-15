import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE_PATH = path.resolve(__dirname, "../data/yesitsme-classificacoes.json");

let cacheClassificacoes = null;
let ultimaLeitura = 0;
const CACHE_TTL = 30000; // 30 segundos de cache para alta performance

/**
 * Carrega o catálogo central de classificações profissionais
 * do arquivo JSON (src/data/yesitsme-classificacoes.json)
 */
export function obterClassificacoesYesItsMe() {
  const agora = Date.now();
  if (cacheClassificacoes && agora - ultimaLeitura < CACHE_TTL) {
    return cacheClassificacoes;
  }

  try {
    if (fs.existsSync(DATA_FILE_PATH)) {
      const raw = fs.readFileSync(DATA_FILE_PATH, "utf-8");
      cacheClassificacoes = JSON.parse(raw);
      ultimaLeitura = agora;
      return cacheClassificacoes;
    }
  } catch (err) {
    console.error("[CLASSIFICACOES UTILS] Erro ao carregar JSON:", err.message);
  }

  // Fallback defensivo se o arquivo estiver inacessível
  return {
    adv: {
      label: "⚖️ Advocacia (.adv, adv_, adv., dr.)",
      termos: ["adv", "advogado", "advogada", "direito", "juridico", "oab", "advocacia", "dr", "dra"],
      prefixos: ["dr.", "dr_", "dra.", "dra_", "adv.", "adv_"],
      sufixos: [".adv", "_adv", "adv", ".direito", "_direito", ".oab"]
    }
  };
}

/**
 * Retorna uma classificação específica pela sua chave (ex: "adv", "psi")
 */
export function obterClassificacaoPorChave(chave) {
  if (!chave) return null;
  const todas = obterClassificacoesYesItsMe();
  return todas[chave.toLowerCase().trim()] || null;
}

