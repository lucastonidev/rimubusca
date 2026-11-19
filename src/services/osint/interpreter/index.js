/**
 * ==============================================================================
 * RIMUBUSCA - BACKEND OSINT INTERPRETERS COORDINATOR
 * src/services/osint/interpreter/index.js
 *
 * Multi-provider normalizers for RimuAPI (Sant Buscas), Hexys and Zeroy.
 * Clean Code standards with English identifiers.
 * ==============================================================================
 */

import { interpretRimuApi } from "./modules/rimuapi/index.js";
import { interpretHexys } from "./modules/hexys/index.js";
import { interpretZeroy } from "./modules/zeroy/index.js";

export { interpretRimuApi, interpretHexys, interpretZeroy };

export function interpretData(provider, typeOrModule, rawData) {
  const p = String(provider || "").toLowerCase().trim();
  if (p === "rimuapi" || p === "rimu" || p === "santbuscas") {
    return interpretRimuApi(typeOrModule, rawData);
  }
  if (p === "hexys") {
    return interpretHexys(typeOrModule, rawData);
  }
  if (p === "zeroy") {
    return interpretZeroy(typeOrModule, rawData);
  }
  return rawData;
}

export default interpretData;
