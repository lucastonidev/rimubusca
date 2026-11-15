/**
 * ==============================================================================
 * RIMUBUSCA - BACKEND OSINT INTERPRETERS COORDINATOR
 * Multi-provider normalizers for Hexys and Zeroy.
 * Clean Code standards with English identifiers.
 * ==============================================================================
 */

import { interpretHexys } from "./modules/hexys/index.js";
import { interpretZeroy } from "./modules/zeroy/index.js";

export { interpretHexys, interpretZeroy };

export function interpretData(provider, typeOrModule, rawData) {
  const p = String(provider || "").toLowerCase().trim();
  if (p === "hexys") {
    return interpretHexys(typeOrModule, rawData);
  }
  if (p === "zeroy") {
    return interpretZeroy(typeOrModule, rawData);
  }
  return rawData;
}

export default interpretData;

