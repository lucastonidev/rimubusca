/**
 * ==============================================================================
 * RIMUBUSCA - OSINT INTERPRETERS UTILITIES (UTILS.JS)
 * Shared formatters, badge builders, and sanitizers for all API modules.
 * Standardized with Clean Code principles and English naming.
 * ==============================================================================
 */

/**
 * Common formatters for documents, currency, dates, and media.
 */
export const Formatters = {
  /**
   * Formats a raw CPF into 000.000.000-00
   * @param {string|number} value
   * @returns {string}
   */
  cpf(value) {
    if (!value) return "Não informado";
    const clean = String(value).replace(/\D/g, "");
    if (clean.length === 11) {
      return clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
    }
    return String(value);
  },

  /**
   * Formats a raw CNPJ into 00.000.000/0000-00
   * @param {string|number} value
   * @returns {string}
   */
  cnpj(value) {
    if (!value) return "Não informado";
    const clean = String(value).replace(/\D/g, "");
    if (clean.length === 14) {
      return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
    }
    return String(value);
  },

  /**
   * Formats an 8-digit postal code (CEP) into 00000-000
   * @param {string|number} value
   * @returns {string}
   */
  cep(value) {
    if (!value) return "Não informado";
    const clean = String(value).replace(/\D/g, "");
    if (clean.length === 8) {
      return clean.replace(/^(\d{5})(\d{3})$/, "$1-$2");
    }
    return String(value);
  },

  /**
   * Formats phone numbers with area code (DDD)
   * @param {string|number} ddd Area code (e.g. 11, 27)
   * @param {string|number} number Phone number
   * @returns {string}
   */
  phone(ddd, number) {
    if (number === undefined && ddd) {
      number = ddd;
      ddd = "";
    }
    if (!number) return "Não informado";
    const cleanNumber = String(number).replace(/\D/g, "");
    const cleanDdd = ddd ? String(ddd).replace(/\D/g, "") : "";

    if (cleanDdd) {
      if (cleanNumber.length === 9) {
        return `(${cleanDdd}) ${cleanNumber.slice(0, 5)}-${cleanNumber.slice(5)}`;
      }
      if (cleanNumber.length === 8) {
        return `(${cleanDdd}) ${cleanNumber.slice(0, 4)}-${cleanNumber.slice(4)}`;
      }
      return `(${cleanDdd}) ${cleanNumber}`;
    }

    if (cleanNumber.length === 11) {
      return `(${cleanNumber.slice(0, 2)}) ${cleanNumber.slice(2, 7)}-${cleanNumber.slice(7)}`;
    }
    if (cleanNumber.length === 10) {
      return `(${cleanNumber.slice(0, 2)}) ${cleanNumber.slice(2, 6)}-${cleanNumber.slice(6)}`;
    }

    return cleanNumber || String(number);
  },

  // Alias for backward compatibility
  telefone(ddd, num) {
    return Formatters.phone(ddd, num);
  },

  /**
   * Formats a monetary number into Brazilian Real (BRL)
   * @param {number|string} value
   * @returns {string}
   */
  currency(value) {
    if (value === null || value === undefined || value === "") {
      return "Não informado";
    }
    const numericValue = Number(value);
    if (isNaN(numericValue)) return String(value);
    return numericValue.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  },

  // Alias for backward compatibility
  dinheiro(value) {
    return Formatters.currency(value);
  },

  /**
   * Formats date strings to DD/MM/YYYY
   * @param {string} dateString
   * @returns {string}
   */
  date(dateString) {
    if (!dateString || dateString === "Não Informado") return "Não informado";
    if (dateString.includes("/")) return dateString;
    if (dateString.includes("-")) {
      const dateParts = dateString.split("T")[0].split("-");
      if (dateParts.length === 3) {
        return `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
      }
    }
    return dateString;
  },

  // Alias for backward compatibility
  data(dateString) {
    return Formatters.date(dateString);
  },

  /**
   * Calculates age in full years from date string
   * @param {string} dateString
   * @returns {number|null}
   */
  age(dateString) {
    if (!dateString || dateString === "Não Informado") return null;
    let day, month, year;

    if (dateString.includes("/")) {
      [day, month, year] = dateString.split("/").map(Number);
    } else if (dateString.includes("-")) {
      const parts = dateString.split("T")[0].split("-").map(Number);
      [year, month, day] = parts;
    } else {
      return null;
    }

    if (!day || !month || !year) return null;
    const birthDate = new Date(year, month - 1, day);
    const today = new Date();
    let calculatedAge = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      calculatedAge--;
    }

    return calculatedAge >= 0 ? calculatedAge : null;
  },

  // Alias for backward compatibility
  idade(dateString) {
    return Formatters.age(dateString);
  },

  /**
   * Sanitizes and formats base64 image strings with appropriate MIME prefix
   * @param {string} photoBase64
   * @returns {string|null}
   */
  base64Image(photoBase64) {
    if (!photoBase64 || typeof photoBase64 !== "string") return null;
    const clean = photoBase64.trim();

    // Filters out empty placeholders, transparent 1x1 GIF spacers
    if (clean.length < 30) return null;
    if (
      clean.includes("R0lGODlhAQAB") ||
      clean.includes("AMDAwAAAACH5BAEAAAAALAAAAAABAAE")
    ) {
      return null;
    }

    if (clean.startsWith("data:image")) return clean;

    let mime = "image/jpeg";
    if (clean.startsWith("R0lGOD")) mime = "image/gif";
    else if (clean.startsWith("iVBORw")) mime = "image/png";
    else if (clean.startsWith("/9j/")) mime = "image/jpeg";
    else if (clean.startsWith("UklGR")) mime = "image/webp";

    return `data:${mime};base64,${clean}`;
  },

  // Alias for backward compatibility
  fotoBase64(photoBase64) {
    return Formatters.base64Image(photoBase64);
  },
};

/**
 * Renders a stylized badge indicating the match relevance score
 * @param {string|number} score
 * @returns {string} HTML markup
 */
export function renderScoreBadge(score) {
  const scoreText = String(score || "100%").trim();
  const numericScore = parseInt(scoreText, 10);

  if (numericScore >= 95) {
    return `<span class="score-badge-100"><i data-lucide="check-check" style="width: 12px; height: 12px;"></i> ${scoreText} MATCH</span>`;
  }
  if (numericScore >= 70) {
    return `<span class="score-badge-high"><i data-lucide="check" style="width: 12px; height: 12px;"></i> ${scoreText} Similar</span>`;
  }
  return `<span class="score-badge-mid"><i data-lucide="percent" style="width: 12px; height: 12px;"></i> ${scoreText}</span>`;
}

/**
 * Escapes characters for safe HTML injection
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
