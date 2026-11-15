/**
 * ==============================================================================
 * OSINT DARK REPORT ENGINE (SHARED)
 * Shared dark-mode OSINT dossier builders, formatters, standalone HTML downloader,
 * and isolated A4 dark PDF print exporter for /advanced/person and /advanced/zeroy.
 * ==============================================================================
 */
(function (root) {
  "use strict";

  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function digitsOnly(val) {
    return String(val || "").replace(/\D/g, "");
  }

  function pick(obj, keys, fallback = null) {
    if (!obj || typeof obj !== "object") return fallback;
    for (let i = 0; i < keys.length; i++) {
      const val = obj[keys[i]];
      if (val !== undefined && val !== null && val !== "") return val;
    }
    return fallback;
  }

  function formatCpf(cpf) {
    const clean = digitsOnly(cpf);
    if (clean.length !== 11) return cpf ? String(cpf) : "N/I";
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }

  function formatCnpj(cnpj) {
    const clean = digitsOnly(cnpj);
    if (clean.length !== 14) return cnpj ? String(cnpj) : "N/I";
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }

  function formatDocument(doc) {
    const clean = digitsOnly(doc);
    if (clean.length === 11) return formatCpf(clean);
    if (clean.length === 14) return formatCnpj(clean);
    return doc ? String(doc) : "N/I";
  }

  function formatCep(cep) {
    const clean = digitsOnly(cep);
    if (clean.length !== 8) return cep ? String(cep) : "N/I";
    return clean.replace(/(\d{5})(\d{3})/, "$1-$2");
  }

  function formatPhone(rawPhone, optionalDdd) {
    const combined = optionalDdd ? `${optionalDdd}${rawPhone || ""}` : String(rawPhone || "");
    let clean = digitsOnly(combined);
    if (clean.length > 11 && clean.startsWith("55")) clean = clean.slice(2);
    if (clean.length === 11) return clean.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    if (clean.length === 10) return clean.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    if (clean.length === 9) return clean.replace(/(\d{5})(\d{4})/, "$1-$2");
    if (clean.length === 8) return clean.replace(/(\d{4})(\d{4})/, "$1-$2");
    return rawPhone ? String(rawPhone) : "N/I";
  }

  function formatDate(dateVal) {
    if (!dateVal) return "N/I";
    const s = String(dateVal).trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
    const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
    const parsed = new Date(s);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("pt-BR");
    }
    return s;
  }

  function formatCurrency(val) {
    if (val === null || val === undefined || val === "") return "N/I";
    if (typeof val === "number") {
      return Number.isFinite(val)
        ? val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
        : "N/I";
    }
    const str = String(val).trim();
    if (!str || str === "Não informada" || str === "N/I") return "N/I";
    const normalized = str.replace(/R\$/gi, "").trim().includes(",")
      ? str.replace(/[^\d,-]/g, "").replace(",", ".")
      : str.replace(/[^\d.-]/g, "");
    const num = Number(normalized);
    return Number.isFinite(num)
      ? num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : str;
  }

  function resolveImageSrc(raw) {
    if (!raw) return "";
    if (typeof raw !== "string") {
      if (Array.isArray(raw) && raw.length > 0) return resolveImageSrc(raw[0]);
      if (typeof raw === "object") {
        const val = raw.foto || raw.fotoBase64 || raw.base64 || raw.url || raw.imagem || raw.image;
        if (val) return resolveImageSrc(val);
      }
      return "";
    }
    const trimmed = raw.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("data:image/")) return trimmed;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.startsWith("/9j/")) return `data:image/jpeg;base64,${trimmed}`;
    if (trimmed.startsWith("iVBOR")) return `data:image/png;base64,${trimmed}`;
    if (trimmed.startsWith("R0lGOD")) return `data:image/gif;base64,${trimmed}`;
    if (trimmed.startsWith("UklGR")) return `data:image/webp;base64,${trimmed}`;
    if (trimmed.length > 50 && /^[A-Za-z0-9+/=\r\n]+$/.test(trimmed)) {
      return `data:image/jpeg;base64,${trimmed.replace(/\s+/g, "")}`;
    }
    return "";
  }

  function unwrapPayload(raw) {
    let cur = raw;
    if (typeof cur === "string") {
      try {
        cur = JSON.parse(cur);
      } catch {
        return { resultado: cur };
      }
    }
    const hasEntityKeys = (obj) =>
      Boolean(
        obj.DadosBasicos ||
        obj.dadosBasicos ||
        obj.cpf ||
        obj.cnpj ||
        obj.placa ||
        obj.razaoSocial ||
        obj.operadora ||
        obj.chavesPix ||
        obj.vacinas ||
        obj.logradouro
      );
    for (let i = 0; i < 4; i++) {
      if (!cur || typeof cur !== "object" || Array.isArray(cur)) break;
      if (cur.dados !== undefined && cur.dados !== null && (typeof cur.dados === "object") && !hasEntityKeys(cur)) {
        cur = cur.dados;
        continue;
      }
      if (cur.data !== undefined && cur.data !== null && (typeof cur.data === "object") && !hasEntityKeys(cur)) {
        cur = cur.data;
        continue;
      }
      break;
    }
    return cur;
  }

  function generateProtocol(prefix = "OSINT") {
    return `${prefix}-${Date.now().toString(36).toUpperCase().slice(-7)}`;
  }

  function humanizeKey(key) {
    return String(key || "")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/_/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  }

  function formatAddressLine(addr) {
    if (!addr) return "Endereço não cadastrado";
    if (typeof addr === "string") return addr.trim() || "Endereço não cadastrado";
    if (addr.endereco_completo) return String(addr.endereco_completo);
    const street = addr.street || addr.logradouro || addr.endereco || "";
    const number = addr.number || addr.numero || "";
    const comp = addr.complement || addr.complemento || "";
    const bairro = addr.neighborhood || addr.bairro || "";
    const city = addr.city || addr.cidade || addr.municipio || "";
    const uf = addr.state || addr.uf || addr.siglaUf || "";
    const cep = digitsOnly(addr.zip_code || addr.cep).length === 8 ? `CEP ${formatCep(addr.zip_code || addr.cep)}` : "";
    const line1 = [street, number && number !== "Não Informado" ? number : "", comp && comp !== "Não Informado" ? comp : ""]
      .filter(Boolean)
      .join(", ");
    const line2 = city && uf ? `${city}/${uf}` : city || uf;
    return [line1, bairro, line2, cep].filter(Boolean).join(" • ") || "Endereço não cadastrado";
  }

  function extractPhoneDigits(raw) {
    if (!raw) return "";
    if (typeof raw === "object") {
      const ddd = raw.ddd ? String(raw.ddd) : "";
      const num = raw.numero || raw.number || raw.telefone || raw.formatado || raw.whatsapp || "";
      return digitsOnly(`${ddd}${num}`);
    }
    return digitsOnly(raw);
  }

  /**
   * ==============================================================================
   * MOTOR FORENSE DE HASH CRIPTOGRÁFICO SHA-256 (FIPS 180-4 STANDALONE SÍNCRONO)
   * Gera hash determinístico canônico instantâneo para Cadeia de Custódia Pericial
   * ==============================================================================
   */
  function generateSha256(str) {
    let input = "";
    if (typeof str !== "string") {
      try {
        input = JSON.stringify(str);
      } catch {
        input = String(str || "");
      }
    } else {
      input = str;
    }

    const utf8 = unescape(encodeURIComponent(input || ""));
    function rightRotate(value, amount) {
      return (value >>> amount) | (value << (32 - amount));
    }
    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    let lengthProperty = "length", i, j, result = "";
    const words = [];
    const asciiBitLength = utf8[lengthProperty] * 8;
    let hash = [], k = [], primeCounter = 0;
    const isComposite = {};
    for (let candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (i = 0; i < 313; i += candidate) isComposite[i] = candidate;
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    hash = hash.slice(0, 8);
    let ascii = utf8 + "\x80";
    while ((ascii[lengthProperty] % 64) - 56) ascii += "\x00";
    for (i = 0; i < ascii[lengthProperty]; i++) {
      j = ascii.charCodeAt(i);
      words[i >> 2] |= j << (((3 - i) % 4) * 8);
    }
    words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
    words[words[lengthProperty]] = asciiBitLength;
    for (j = 0; j < words[lengthProperty];) {
      const w = words.slice(j, (j += 16));
      const oldHash = hash;
      hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        const w15 = w[i - 15], w2 = w[i - 2];
        const a = hash[0], e = hash[4];
        const temp1 = hash[7] + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) + ((e & hash[5]) ^ (~e & hash[6])) + k[i] + (w[i] = (i < 16 ? w[i] : (w[i - 16] + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) | 0));
        const temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }
      for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for (i = 0; i < 8; i++) {
      for (j = 3; j + 1; j--) {
        const b = (hash[i] >> (j * 8)) & 255;
        result += (b < 16 ? 0 : "") + b.toString(16);
      }
    }
    return result;
  }

  /**
   * ==============================================================================
   * SMART FLAGS: DETECÇÃO AUTOMÁTICA DE ANOMALIAS FORENSES
   * Analisa discrepâncias de renda, óbito, dispersão territorial e consistência
   * ==============================================================================
   */
  function detectForensicAnomalies(payload, termo = "") {
    const raw = unwrapPayload(payload);
    const d = Array.isArray(raw) ? raw[0] || {} : raw || {};
    const basic = pick(d, ["DadosBasicos", "dadosBasicos", "dados_basicos", "basico"], d) || d;

    const flags = [];
    let riskScore = 10;

    // 1. Checagem de Óbito Cadastral
    const statusStr = typeof basic.situacaoCadastral === "object"
      ? basic.situacaoCadastral.descricaoSit || ""
      : String(basic.situacaoCadastral || "");
    const isDeceased = checkPersonDeceased(d, statusStr) || checkPersonDeceased(basic, statusStr);
    if (isDeceased) {
      flags.push({
        level: "critical",
        badge: "ÓBITO CONSTATADO",
        title: "Registro de Óbito / Falecimento Identificado",
        desc: "Consta certidão ou apontamento oficial de falecimento. Atenção prioritária para hipóteses de fraude de identidade, movimentação bancária post-mortem ou apropriação indevida de benefícios previdenciários.",
        icon: "alert-triangle",
        color: "#EF4444"
      });
      riskScore += 45;
    }

    // 2. Situação na Receita Federal
    const sitUpper = statusStr.toUpperCase();
    if (sitUpper && !sitUpper.includes("REGULAR") && !sitUpper.includes("TITULAR") && sitUpper !== "N/I") {
      flags.push({
        level: "high",
        badge: "IRREGULARIDADE FISCAL",
        title: `Situação Cadastral na Receita: ${escapeHtml(statusStr)}`,
        desc: "O documento possui restrições perante a Receita Federal (Pendente de Regularização, Suspenso ou Cancelado), indicando pendências com declarações de IRPF ou inconsistências cadastrais.",
        icon: "shield-alert",
        color: "#F97316"
      });
      riskScore += 25;
    }

    // 3. Inconsistência Patrimonial: Renda Declarada vs. Bens (Veículos / Empresas / Score)
    const rendaNum = Number(String(basic.rendaAtual || basic.renda || d.renda || 0).replace(/[^\d.]/g, ""));
    const veiculos = Array.isArray(d.veiculos || d.Veiculos) ? (d.veiculos || d.Veiculos) : [];
    const empresas = Array.isArray(d.empresas || d.Empresas || d.sociosQSA || d.empregos) ? (d.empresas || d.Empresas || d.sociosQSA || d.empregos) : [];

    if (rendaNum > 0 && rendaNum < 1500 && (veiculos.length >= 2 || empresas.length >= 2)) {
      flags.push({
        level: "high",
        badge: "ANOMALIA PATRIMONIAL",
        title: "Descompasso Renda Declarada vs. Bens Mapeados",
        desc: `Renda declarada baixa (R$ ${rendaNum.toLocaleString("pt-BR")},00), contrastando com patrimônio registrado composto por ${veiculos.length} veículo(s) e/ou ${empresas.length} vínculo(s) empresarial(is). Potencial subdeclaração ou blindagem patrimonial.`,
        icon: "trending-up",
        color: "#F97316"
      });
      riskScore += 20;
    }

    // 4. Dispersão Geográfica Interestadual (Multi-Estadual)
    const enderecos = Array.isArray(d.enderecos || d.enderecosHistorico || d.Enderecos) ? (d.enderecos || d.enderecosHistorico || d.Enderecos) : [];
    const ufs = new Set();
    enderecos.forEach((end) => {
      const uf = (end.siglaUf || end.uf || end.estado || "").toUpperCase().trim();
      if (uf && uf.length === 2) ufs.add(uf);
    });
    if (ufs.size >= 3) {
      flags.push({
        level: "medium",
        badge: "DISPERSÃO GEOGRÁFICA",
        title: `Histórico em ${ufs.size} Estados Distintos (${Array.from(ufs).join(", ")})`,
        desc: "Histórico de endereços pulverizado em múltiplos estados federativos, típico de mobilidade inter-regional contínua ou multiplicidade de cadastros de faturamento.",
        icon: "map-pin",
        color: "#F59E0B"
      });
      riskScore += 15;
    }

    // 5. Rotatividade de Contatos Telefônicos (Churn de Linhas)
    const telefones = Array.isArray(d.telefonesHistorico || d.telefones || d.Telefones) ? (d.telefonesHistorico || d.telefones || d.Telefones) : [];
    if (telefones.length >= 6) {
      flags.push({
        level: "medium",
        badge: "ROTATIVIDADE TELEFÔNICA",
        title: `${telefones.length} Números Telefônicos Vinculados`,
        desc: "Volume atípico de terminais móveis associados ao titular, sugerindo frequente descarte de linhas (burner SIMs) ou cadastros operados por terceiros.",
        icon: "phone-forwarded",
        color: "#F59E0B"
      });
      riskScore += 10;
    }

    // 6. Filiação Incompleta / Ausência de Registro Materno
    const maeNome = basic.nomeMae || d.nomeMae || (basic.filiacao && basic.filiacao.nomeMae);
    if (!maeNome || ["NÃO INFORMADO", "NAO INFORMADO", "N/I", "NÃO CONSTA", ""].includes(String(maeNome).trim().toUpperCase())) {
      flags.push({
        level: "low",
        badge: "CADASTRO UNILATERAL",
        title: "Ausência de Filiação Materna Primária",
        desc: "Falta de genitora cadastrada no registro nacional primário, reduzindo elementos para verificação de homonímia.",
        icon: "user-x",
        color: "#38BDF8"
      });
      riskScore += 5;
    }

    // 7. Vínculos Societários Expressivos
    if (empresas.length >= 3) {
      flags.push({
        level: "low",
        badge: "EXPOSIÇÃO EMPRESARIAL",
        title: `Participação em ${empresas.length} Entidades Empresariais`,
        desc: "Constatação de múltiplos quadros societários ativos, demandando verificação cruzada de CNPJs e eventual conflito de interesses.",
        icon: "briefcase",
        color: "#38BDF8"
      });
      riskScore += 5;
    }

    // 8. Chaves PIX Cadastradas em Grande Quantidade
    const pixList = Array.isArray(d.chavePix || d.contasBancarias || d.bancos) ? (d.chavePix || d.contasBancarias || d.bancos) : [];
    if (pixList.length >= 4) {
      flags.push({
        level: "low",
        badge: "DISPERSÃO FINANCEIRA",
        title: `${pixList.length} Chaves PIX / Contas Mapeadas`,
        desc: "Múltiplas instituições participantes do SPB/PIX detectadas no DICT/BACEN.",
        icon: "credit-card",
        color: "#38BDF8"
      });
      riskScore += 5;
    }

    riskScore = Math.min(Math.max(riskScore, 5), 100);

    let riskCategory = "BAIXO RISCO";
    let riskColor = "#10B981";
    if (riskScore >= 80) {
      riskCategory = "RISCO CRÍTICO";
      riskColor = "#EF4444";
    } else if (riskScore >= 55) {
      riskCategory = "RISCO ELEVADO";
      riskColor = "#F97316";
    } else if (riskScore >= 30) {
      riskCategory = "RISCO MODERADO";
      riskColor = "#F59E0B";
    }

    return {
      score: riskScore,
      category: riskCategory,
      color: riskColor,
      flagsCount: flags.length,
      flags,
      hasCritical: flags.some((f) => f.level === "critical"),
      hasHigh: flags.some((f) => f.level === "high")
    };
  }

  /**
   * ==============================================================================
   * RENDERIZADOR VISUAL DAS SMART FLAGS (SCORE E ANOMALIAS FORENSES)
   * ==============================================================================
   */
  function renderSmartFlagsSection(anomalies) {
    if (!anomalies || typeof anomalies !== "object") return "";
    const { score = 10, category = "BAIXO RISCO", color = "#10B981", flags = [] } = anomalies;

    const flagsHtml = flags.length > 0
      ? flags.map((f) => {
          const borderCol = f.color || "#A78BFA";
          const bgCol = f.level === "critical"
            ? "rgba(239, 68, 68, 0.08)"
            : f.level === "high"
            ? "rgba(249, 115, 22, 0.08)"
            : f.level === "medium"
            ? "rgba(245, 158, 11, 0.08)"
            : "rgba(56, 189, 248, 0.08)";

          return `
            <div style="background: ${bgCol}; border: 1px solid ${borderCol}40; border-left: 4px solid ${borderCol}; border-radius: 6px; padding: 12px 14px; margin-bottom: 10px;">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px; flex-wrap: wrap;">
                <span style="font-size: 0.85rem; font-weight: 800; color: #F8FAFC;">${escapeHtml(f.title)}</span>
                <span style="background: ${borderCol}22; color: ${borderCol}; border: 1px solid ${borderCol}55; font-size: 0.65rem; font-weight: 800; padding: 2px 7px; border-radius: 4px; letter-spacing: 0.5px;">${escapeHtml(f.badge)}</span>
              </div>
              <div style="font-size: 0.78rem; color: #CBD5E1; line-height: 1.45;">${escapeHtml(f.desc)}</div>
            </div>
          `;
        }).join("")
      : `
        <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-left: 4px solid #10B981; border-radius: 6px; padding: 14px 16px;">
          <div style="display: flex; align-items: center; gap: 8px; color: #34D399; font-weight: 700; font-size: 0.86rem; margin-bottom: 4px;">
            <svg style="width: 18px; height: 18px; flex-shrink: 0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            PADRÃO DE CONFORMIDADE NORMAL
          </div>
          <div style="font-size: 0.78rem; color: #94A3B8;">Nenhuma anomalia crítica, inconsistência patrimonial ou dispersão anômala detectada nos registros cadastrais homologados.</div>
        </div>
      `;

    return `
      <div class="dark-report-card" style="background: linear-gradient(135deg, #090C15 0%, #111726 100%); border: 1px solid #1E293B; border-radius: 8px; padding: 20px; margin-bottom: 22px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; margin-bottom: 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 14px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(139, 92, 246, 0.15); border: 1px solid rgba(139, 92, 246, 0.3); display: flex; align-items: center; justify-content: center; color: #A78BFA;">
              <svg style="width: 20px; height: 20px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <div>
              <h3 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #F8FAFC; letter-spacing: -0.2px;">SMART FLAGS &bull; DETECÇÃO AUTOMÁTICA DE ANOMALIAS FORENSES</h3>
              <div style="font-size: 0.72rem; color: #94A3B8;">Análise algorítmica de consistência cadastral, conformidade de renda e alertas de risco</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 12px; background: rgba(0, 0, 0, 0.4); border: 1px solid #1E293B; border-radius: 6px; padding: 6px 14px;">
            <div>
              <div style="font-size: 0.62rem; text-transform: uppercase; color: #64748B; font-weight: 700;">Score Forense</div>
              <div style="font-size: 1.25rem; font-weight: 900; color: ${color}; font-family: var(--font-mono);">${score}<span style="font-size: 0.75rem; color: #64748B;">/100</span></div>
            </div>
            <div style="height: 28px; width: 1px; background: #1E293B;"></div>
            <span style="background: ${color}22; color: ${color}; border: 1px solid ${color}55; font-size: 0.72rem; font-weight: 800; padding: 4px 10px; border-radius: 4px; letter-spacing: 0.6px;">${escapeHtml(category)}</span>
          </div>
        </div>
        <div>
          ${flagsHtml}
        </div>
      </div>
    `;
  }

  /**
   * ==============================================================================
   * CERTIFICADO OFICIAL DE CADEIA DE CUSTÓDIA FORENSE (CHAIN OF CUSTODY)
   * Emissão pericial com Hash SHA-256 autêntico e fundamentação legal LGPD
   * ==============================================================================
   */
  function renderChainOfCustodySection({
    termo = "",
    payload = {},
    moduleLabel = "OSINT",
    sourceLabel = "Bases Federais Homologadas",
    protocolId = "",
    timestamp = "",
    hash = ""
  }) {
    const ts = timestamp || new Date().toISOString();
    const proto = protocolId || generateProtocol("EVID");
    const finalHash = hash || generateSha256(JSON.stringify(payload || {}));

    return `
      <div class="dark-report-card chain-of-custody-card" style="background: linear-gradient(135deg, #07090F 0%, #0F1424 100%); border: 1px solid #2E3856; border-radius: 8px; padding: 22px; margin-top: 28px; position: relative; overflow: hidden;">
        <div style="position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #8B5CF6 0%, #06B6D4 50%, #10B981 100%);"></div>

        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 14px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(6, 182, 212, 0.15); border: 1px solid rgba(6, 182, 212, 0.3); display: flex; align-items: center; justify-content: center; color: #22D3EE;">
              <svg style="width: 20px; height: 20px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="background: #06B6D4; color: #04101A; font-size: 0.65rem; font-weight: 900; padding: 2px 7px; border-radius: 4px; letter-spacing: 0.6px;">CADEIA DE CUSTÓDIA FORENSE</span>
                <span style="background: rgba(16, 185, 129, 0.15); color: #34D399; border: 1px solid rgba(16, 185, 129, 0.3); font-size: 0.65rem; font-weight: 800; padding: 2px 7px; border-radius: 4px;">INVIOLABILIDADE DIGITAL</span>
              </div>
              <h3 style="margin: 4px 0 0; font-size: 1.05rem; font-weight: 800; color: #F8FAFC;">CERTIFICADO DE INTEGRIDADE &amp; AUDITORIA CRIPTOGRÁFICA</h3>
            </div>
          </div>
          <div style="text-align: right; font-family: var(--font-mono); font-size: 0.72rem; color: #94A3B8;">
            <div>EVIDÊNCIA ID: <strong style="color: #38BDF8;">${escapeHtml(proto)}</strong></div>
            <div>PADRÃO: <strong style="color: #A78BFA;">FIPS PUB 180-4 (SHA-256)</strong></div>
          </div>
        </div>

        <!-- Bloco de Destaque do Hash SHA-256 -->
        <div style="background: #04060A; border: 1px solid #1E293B; border-radius: 6px; padding: 14px 16px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
            <span style="font-size: 0.7rem; font-weight: 800; text-transform: uppercase; color: #64748B; letter-spacing: 0.8px;">Assinatura Criptográfica SHA-256 (Hash do Dossiê)</span>
            <button type="button" onclick="navigator.clipboard.writeText('${escapeHtml(finalHash)}').then(function(){ if(window.toast){ window.toast.success('Hash SHA-256 copiado para a área de transferência!'); } else { alert('Hash SHA-256 copiado!'); } })" style="background: rgba(139, 92, 246, 0.18); border: 1px solid rgba(139, 92, 246, 0.35); color: #C4B5FD; font-size: 0.7rem; font-weight: 700; padding: 4px 10px; border-radius: 4px; cursor: pointer; transition: all 0.2s ease;">
              Copiar Hash
            </button>
          </div>
          <div style="font-family: var(--font-mono); font-size: 0.85rem; color: #34D399; font-weight: 700; word-break: break-all; letter-spacing: 0.5px; line-height: 1.4;">
            ${escapeHtml(finalHash)}
          </div>
        </div>

        <!-- Metadados da Custódia e Fundamentos da LGPD -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; margin-bottom: 14px; font-size: 0.74rem;">
          <div style="background: rgba(0, 0, 0, 0.3); border: 1px solid #1E2538; border-radius: 6px; padding: 10px 12px;">
            <div style="color: #64748B; font-weight: 700; text-transform: uppercase; font-size: 0.65rem; margin-bottom: 2px;">Carimbo Temporal ISO 8601</div>
            <div style="color: #E2E8F0; font-family: var(--font-mono);">${escapeHtml(ts)}</div>
          </div>
          <div style="background: rgba(0, 0, 0, 0.3); border: 1px solid #1E2538; border-radius: 6px; padding: 10px 12px;">
            <div style="color: #64748B; font-weight: 700; text-transform: uppercase; font-size: 0.65rem; margin-bottom: 2px;">Alvo / Identificador</div>
            <div style="color: #38BDF8; font-family: var(--font-mono); font-weight: 700;">${escapeHtml(termo || "Alvo Não Informado")}</div>
          </div>
          <div style="background: rgba(0, 0, 0, 0.3); border: 1px solid #1E2538; border-radius: 6px; padding: 10px 12px;">
            <div style="color: #64748B; font-weight: 700; text-transform: uppercase; font-size: 0.65rem; margin-bottom: 2px;">Módulo Coletor &bull; Fonte Primária</div>
            <div style="color: #C4B5FD;">${escapeHtml(moduleLabel)} &bull; ${escapeHtml(sourceLabel)}</div>
          </div>
          <div style="background: rgba(0, 0, 0, 0.3); border: 1px solid #1E2538; border-radius: 6px; padding: 10px 12px;">
            <div style="color: #64748B; font-weight: 700; text-transform: uppercase; font-size: 0.65rem; margin-bottom: 2px;">Base Legal LGPD</div>
            <div style="color: #F8FAFC;">Art. 7º (II, IX, X) e Art. 4º (III) - Lei 13.709/18</div>
          </div>
        </div>

        <!-- Termo Pericial de Inviolabilidade -->
        <div style="font-size: 0.72rem; color: #94A3B8; line-height: 1.5; border-top: 1px solid rgba(255, 255, 255, 0.06); padding-top: 12px;">
          <strong style="color: #CBD5E1;">DECLARAÇÃO PERICIAL DE INVIOLABILIDADE:</strong> O hash criptográfico acima registrado vincula de forma unívoca e imutável os dados deste relatório ao instante temporal de sua extração. Qualquer modificação, inserção ou supressão de bytes nos registros tornará esta assinatura inválida, assegurando o valor probatório e a estrita observância da cadeia de custódia da evidência digital (Art. 158-A do CPP e Lei nº 13.709/2018).
        </div>
      </div>
    `;
  }

  function buildReportShell({
    systemBadge = "RIMUBUSCA OSINT",
    title = "DOSSIÊ DE INTELIGÊNCIA OSINT",
    moduleLabel = "CONSULTA",
    termo = "Alvo não especificado",
    fonteLabel = "Hub OSINT Analítico",
    protocolPrefix = "OSINT",
    kpis = [],
    bodyHtml = "",
    rawPayload = null,
    smartFlagsHtml = "",
    customHash = "",
    hideChainOfCustody = false,
  }) {
    const dataAtual = new Date().toLocaleString("pt-BR");
    const protocolId = generateProtocol(protocolPrefix);
    const kpiGridCols = kpis.length > 0 ? Math.min(kpis.length, 5) : 0;

    // Se não passou smartFlagsHtml explicitamente, mas passou rawPayload, calcula e renderiza automaticamente!
    let effectiveSmartFlagsHtml = smartFlagsHtml;
    if (!effectiveSmartFlagsHtml && rawPayload) {
      try {
        const anomalies = detectForensicAnomalies(rawPayload, termo);
        effectiveSmartFlagsHtml = renderSmartFlagsSection(anomalies);
      } catch (err) {
        console.warn("[SMART FLAGS ERROR]:", err);
      }
    }

    // Certificado de Cadeia de Custódia Pericial
    let custodyHtml = "";
    if (!hideChainOfCustody) {
      custodyHtml = renderChainOfCustodySection({
        termo,
        payload: rawPayload || { title, termo, moduleLabel, fonteLabel, protocolId },
        moduleLabel,
        sourceLabel: fonteLabel,
        protocolId,
        timestamp: new Date().toISOString(),
        hash: customHash,
      });
    }

    const kpiHtml = kpis.length > 0
      ? `
        <div style="display: grid; grid-template-columns: repeat(${kpiGridCols}, minmax(130px, 1fr)); gap: 12px; margin-bottom: 24px;">
          ${kpis
            .map(
              (k) => `
            <div style="background: #0D111A; border: 1px solid #1E2538; border-radius: 8px; padding: 14px;">
              <div style="font-size: 0.68rem; text-transform: uppercase; color: #94A3B8; font-weight: 700; margin-bottom: 4px;">${escapeHtml(k.label)}</div>
              <div style="font-size: ${k.small ? "0.95rem" : "1.35rem"}; font-weight: 800; color: ${k.color || "#F8FAFC"}; font-family: var(--font-mono); word-break: break-word;">${escapeHtml(String(k.value ?? "N/I"))}</div>
            </div>
          `
            )
            .join("")}
        </div>
      `
      : "";

    return `
      <div class="dark-report-sheet dark-report-container" style="background: #080B11; color: #F1F5F9; padding: 28px; border-radius: 10px; border: 1px solid #1E2538; font-family: 'Inter', system-ui, -apple-system, sans-serif;">
        <div style="background: linear-gradient(135deg, #0D111A 0%, #151029 100%); border: 1px solid #2D1F55; border-radius: 10px; padding: 20px 24px; display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 22px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
              <span style="background: #6D28D9; color: #FFFFFF; font-size: 0.68rem; font-weight: 800; padding: 3px 9px; border-radius: 4px; letter-spacing: 0.8px;">${escapeHtml(systemBadge)}</span>
              <span style="background: rgba(239, 68, 68, 0.15); color: #F87171; border: 1px solid rgba(239, 68, 68, 0.3); font-size: 0.68rem; font-weight: 700; padding: 2px 8px; border-radius: 4px;">CONFIDENCIAL • ACESSO AUDITADO</span>
            </div>
            <h1 style="margin: 0; font-size: 1.45rem; font-weight: 900; letter-spacing: -0.3px; color: #F8FAFC;">${escapeHtml(title)}</h1>
            <p style="margin: 4px 0 0; font-size: 0.84rem; color: #94A3B8;">
              Módulo Consultado: <strong style="color: #C4B5FD;">${escapeHtml(String(moduleLabel).toUpperCase())}</strong> • Alvo: <strong style="color: #38BDF8; font-family: var(--font-mono);">${escapeHtml(termo || "N/I")}</strong>
            </p>
          </div>
          <div style="text-align: right; font-family: var(--font-mono); font-size: 0.72rem; color: #94A3B8; background: rgba(0, 0, 0, 0.3); padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
            <div>PROTOCOLO: <strong style="color: #34D399;">${escapeHtml(protocolId)}</strong></div>
            <div>EMISSÃO: <strong style="color: #E2E8F0;">${escapeHtml(dataAtual)}</strong></div>
            <div>FONTE: <strong style="color: #A78BFA;">${escapeHtml(fonteLabel)}</strong></div>
          </div>
        </div>

        ${kpiHtml}
        ${effectiveSmartFlagsHtml || ""}
        ${bodyHtml}
        ${custodyHtml}

        <div style="margin-top: 28px; padding-top: 14px; border-top: 1px solid #1E2538; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; font-size: 0.72rem; color: #64748B;">
          <div>RimuBusca Intelligence Engine &bull; Tratamento restrito nos termos da LGPD (Art. 7º).</div>
          <div>Documento Digital Gerado em ${escapeHtml(dataAtual)}</div>
        </div>
      </div>
    `;
  }

  function renderDarkCard(title, innerHtml, accentColor = "#A78BFA", badgeHtml = "") {
    return `
      <div class="dark-report-card" style="background: #0D111A; border: 1px solid #1E2538; border-radius: 8px; padding: 18px 20px; margin-bottom: 18px;">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; border-bottom: 1px solid #1E2538; padding-bottom: 10px; margin-bottom: 14px; flex-wrap: wrap;">
          <h3 style="margin: 0; font-size: 0.95rem; font-weight: 800; color: ${accentColor}; text-transform: uppercase; letter-spacing: 0.4px;">${escapeHtml(title)}</h3>
          ${badgeHtml}
        </div>
        ${innerHtml}
      </div>
    `;
  }

  function renderFieldGrid(items, minWidth = "200px") {
    const valid = (items || []).filter((it) => it && it.label);
    if (valid.length === 0) return `<div style="color: #64748B; font-size: 0.85rem;">Sem informações adicionais.</div>`;
    return `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(${minWidth}, 1fr)); gap: 12px;">
        ${valid
          .map(
            (it) => `
          <div style="background: #080B11; border: 1px solid #1E2538; border-radius: 6px; padding: 10px 12px; ${it.spanFull ? "grid-column: 1 / -1;" : ""}">
            <div style="font-size: 0.68rem; color: #64748B; text-transform: uppercase; font-weight: 700; margin-bottom: 4px;">${escapeHtml(it.label)}</div>
            <div style="font-size: 0.86rem; font-weight: 700; color: ${it.color || "#E2E8F0"}; ${it.mono ? "font-family: var(--font-mono);" : ""} word-break: break-word;">${escapeHtml(String(it.value ?? "N/I"))}</div>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }

  function formatSmartScalar(key, val) {
    if (val === null || val === undefined || val === "") return { text: "Não informado", color: "#64748B", mono: false };
    if (typeof val === "boolean") {
      return { text: val ? "SIM / ATIVO" : "NÃO / INATIVO", color: val ? "#34D399" : "#F87171", mono: true };
    }
    const kLower = String(key || "").toLowerCase();
    const s = String(val).trim();
    const clean = digitsOnly(s);
    if (kLower.includes("cpf") && clean.length === 11) return { text: formatCpf(clean), color: "#34D399", mono: true };
    if (kLower.includes("cnpj") && clean.length === 14) return { text: formatCnpj(clean), color: "#38BDF8", mono: true };
    if (kLower.includes("cep") && clean.length === 8) return { text: formatCep(clean), color: "#FBBF24", mono: true };
    if ((kLower.includes("telefone") || kLower.includes("celular") || kLower.includes("whatsapp")) && (clean.length === 10 || clean.length === 11)) {
      return { text: formatPhone(clean), color: "#34D399", mono: true };
    }
    if (kLower.includes("renda") || kLower.includes("valor") || kLower.includes("capital") || kLower.includes("salario") || kLower.includes("saldo")) {
      const formatted = formatCurrency(val);
      if (formatted !== "N/I") return { text: formatted, color: "#34D399", mono: true };
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(s) || kLower.includes("data")) {
      const fd = formatDate(s);
      if (fd !== s || /^\d{2}\/\d{2}\/\d{4}$/.test(fd)) return { text: fd, color: "#60A5FA", mono: true };
    }
    return { text: s, color: "#E2E8F0", mono: clean.length >= 6 && clean.length === s.length };
  }

  function renderDarkTable(rows, columnsOverride = null) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return `<div style="color: #64748B; font-size: 0.85rem;">Nenhum registro encontrado.</div>`;
    }
    const cols = columnsOverride || Array.from(
      rows.reduce((set, row) => {
        if (row && typeof row === "object") {
          Object.keys(row).forEach((k) => {
            if (k !== "info_token" && !k.startsWith("_")) set.add(k);
          });
        }
        return set;
      }, new Set())
    );
    if (cols.length === 0) return "";

    return `
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
          <thead>
            <tr style="background: #131926; color: #94A3B8; text-align: left; border-bottom: 1px solid #1E2538;">
              ${cols.map((c) => `<th style="padding: 9px 10px; font-size: 0.7rem; text-transform: uppercase;">${escapeHtml(humanizeKey(c))}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${rows
              .slice(0, 120)
              .map(
                (row) => `
              <tr style="border-bottom: 1px solid #1A2233;">
                ${cols
                  .map((c) => {
                    const val = row ? row[c] : "";
                    if (typeof val === "object" && val !== null) {
                      const img = resolveImageSrc(val.base64 || val.foto || "");
                      if (img) return `<td style="padding: 6px 10px;"><img src="${img}" alt="Foto Biométrica" style="max-height: 48px; border-radius: 4px; border: 1px solid #10B981; object-fit: cover; cursor: pointer;" onclick="if(window.abrirFotoLightbox){window.abrirFotoLightbox(this.src,'Foto Biométrica')}else{window.open(this.src,'_blank')}" /></td>`;
                      const summary = Object.entries(val)
                        .filter(([, sv]) => sv !== null && sv !== undefined && sv !== "")
                        .map(([sk, sv]) => `${humanizeKey(sk)}: ${typeof sv === "object" ? JSON.stringify(sv) : sv}`)
                        .join(" | ");
                      return `<td style="padding: 8px 10px; color: #CBD5E1;">${escapeHtml(summary || "-")}</td>`;
                    }
                    const imgSrc = resolveImageSrc(typeof val === "string" ? val : "");
                    if (imgSrc) {
                      return `<td style="padding: 8px 10px;"><img src="${imgSrc}" alt="Foto" style="max-height: 44px; border-radius: 4px; border: 1px solid #334155;" /></td>`;
                    }
                    const fmt = formatSmartScalar(c, val);
                    return `<td style="padding: 8px 10px; color: ${fmt.color}; ${fmt.mono ? "font-family: var(--font-mono);" : ""}">${escapeHtml(fmt.text)}</td>`;
                  })
                  .join("")}
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderGenericBody(payload, excludeKeys = []) {
    const cleanExcluded = new Set(["info_token", "sucesso", "success", ...excludeKeys]);
    if (!payload || (typeof payload === "object" && Object.keys(payload).length === 0)) {
      return renderDarkCard("Resultado da Consulta", `<div style="color: #94A3B8; font-size: 0.88rem;">Nenhum dado estruturado disponível nesta consulta.</div>`);
    }

    if (Array.isArray(payload)) {
      if (typeof payload[0] === "object" && payload[0] !== null) {
        return renderDarkCard(`Registros Retornados (${payload.length})`, renderDarkTable(payload), "#38BDF8");
      }
      return renderDarkCard(
        `Lista de Valores (${payload.length})`,
        `<div style="display: flex; flex-wrap: wrap; gap: 8px;">${payload.map((v) => `<span style="background: #131926; border: 1px solid #2A344D; padding: 4px 10px; border-radius: 6px; font-family: var(--font-mono); font-size: 0.8rem; color: #E2E8F0;">${escapeHtml(String(v))}</span>`).join("")}</div>`,
        "#38BDF8"
      );
    }

    const scalars = [];
    const nestedSections = [];

    Object.entries(payload).forEach(([k, v]) => {
      if (cleanExcluded.has(k)) return;
      if (typeof v === "string") {
        let imgSrc = resolveImageSrc(v);
        const isPhotoKey = /(foto|imagem|image|photo|cnh|biometria|facial)/i.test(k);
        if (!imgSrc && isPhotoKey && v.length > 50) {
          imgSrc = v.startsWith("data:") ? v : `data:image/jpeg;base64,${v.trim()}`;
        }
        if (imgSrc) {
          nestedSections.push(
            renderDarkCard(
              humanizeKey(k),
              `<div style="text-align: center; padding: 14px; background: #080B11; border-radius: 8px; border: 1px solid #1E2538;">
                 <img src="${imgSrc}" alt="${escapeHtml(k)}" style="max-height: 280px; max-width: 100%; object-fit: contain; border-radius: 8px; border: 2px solid #10B981; box-shadow: 0 6px 20px rgba(16, 185, 129, 0.25); cursor: pointer;" onclick="if(window.abrirFotoLightbox){window.abrirFotoLightbox(this.src,'${escapeHtml(k)}')}else{window.open(this.src,'_blank')}" title="Clique para ampliar" />
                 <div style="margin-top: 10px;">
                   <a href="${imgSrc}" download="foto_${escapeHtml(k)}.jpg" style="font-size: 0.75rem; padding: 5px 12px; color: #10B981; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); border-radius: 4px; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; font-weight: 600;">
                     <svg style="width:13px;height:13px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                     Baixar Foto
                   </a>
                 </div>
               </div>`,
              "#10B981"
            )
          );
          return;
        }
      }
      if (Array.isArray(v)) {
        if (v.length === 0) {
          scalars.push({ label: humanizeKey(k), value: "0 registros", color: "#64748B" });
          return;
        }

        // Check if this array contains images (either strings or objects with photo fields)
        const isPhotoKey = /(foto|imagem|image|photo|cnh|biometria|facial)/i.test(k);
        const imageItems = v
          .map((item, idx) => {
            if (!item) return null;
            if (typeof item === "string") {
              const src = resolveImageSrc(item);
              if (src) return { src, title: `${humanizeKey(k)} #${idx + 1}` };
              if (isPhotoKey && item.length > 50) {
                const b64Src = item.startsWith("data:") ? item : `data:image/jpeg;base64,${item.trim()}`;
                return { src: b64Src, title: `${humanizeKey(k)} #${idx + 1}` };
              }
            } else if (typeof item === "object") {
              const rawSrc = item.foto || item.fotoBase64 || item.base64 || item.url || item.imagem || item.image || item.photo || "";
              const src = resolveImageSrc(rawSrc);
              if (src) {
                return {
                  src,
                  title: item.tipo || item.descricao || item.label || `${humanizeKey(k)} #${idx + 1}`,
                  data: item.data || item.dataCaptura || item.ano || "",
                };
              }
            }
            return null;
          })
          .filter(Boolean);

        if (imageItems.length > 0) {
          const galleryHtml = `
            <div style="display: flex; flex-wrap: wrap; gap: 16px; justify-content: flex-start; align-items: stretch; margin-top: 6px;">
              ${imageItems
                .map(
                  (img, idx) => `
                <div style="background: #080B11; border: 1px solid #1E2538; border-radius: 8px; padding: 14px; text-align: center; max-width: 260px; min-width: 180px; flex: 1 1 200px; box-shadow: 0 4px 14px rgba(0,0,0,0.35); display: flex; flex-direction: column; align-items: center; justify-content: space-between;">
                  <div style="position: relative; width: 100%; display: flex; justify-content: center; margin-bottom: 10px;">
                    <img src="${img.src}" alt="${escapeHtml(img.title)}" style="max-width: 100%; max-height: 240px; object-fit: contain; border-radius: 6px; border: 2px solid #10B981; cursor: pointer; transition: transform 0.2s;" onclick="if(window.abrirFotoLightbox){window.abrirFotoLightbox(this.src,'${escapeHtml(img.title)}')}else{window.open(this.src,'_blank')}" title="Clique para ampliar" />
                  </div>
                  <div style="width: 100%;">
                    <span style="font-size: 0.8rem; font-weight: 700; color: #F8FAFC; display: block; margin-bottom: 4px;">${escapeHtml(img.title)}</span>
                    ${img.data ? `<span style="font-size: 0.72rem; color: #94A3B8; font-family: var(--font-mono); display: block; margin-bottom: 8px;">${escapeHtml(img.data)}</span>` : ""}
                    <div style="margin-top: 8px; display: flex; gap: 6px; justify-content: center;">
                      <a href="${img.src}" download="foto_${k}_${idx + 1}.jpg" style="font-size: 0.75rem; padding: 4px 10px; color: #10B981; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); border-radius: 4px; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; font-weight: 600;">
                        <svg style="width:12px;height:12px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                        Baixar Foto
                      </a>
                    </div>
                  </div>
                </div>
              `
                )
                .join("")}
            </div>
          `;
          nestedSections.push(renderDarkCard(`${humanizeKey(k)} (${imageItems.length})`, galleryHtml, "#10B981"));
          return;
        }

        if (typeof v[0] === "object" && v[0] !== null) {
          nestedSections.push(renderDarkCard(`${humanizeKey(k)} (${v.length})`, renderDarkTable(v), "#A78BFA"));
        } else {
          nestedSections.push(
            renderDarkCard(
              `${humanizeKey(k)} (${v.length})`,
              `<div style="display: flex; flex-wrap: wrap; gap: 8px;">${v.map((item) => `<span style="background: #131926; border: 1px solid #2A344D; padding: 4px 10px; border-radius: 6px; font-family: var(--font-mono); font-size: 0.8rem; color: #E2E8F0;">${escapeHtml(String(item))}</span>`).join("")}</div>`,
              "#60A5FA"
            )
          );
        }
        return;
      }
      if (v && typeof v === "object") {
        nestedSections.push(renderGenericBody(v));
        return;
      }
      const fmt = formatSmartScalar(k, v);
      scalars.push({ label: humanizeKey(k), value: fmt.text, color: fmt.color, mono: fmt.mono });
    });

    const parts = [];
    if (scalars.length > 0) {
      parts.push(renderDarkCard("Dados Cadastrais Estruturados", renderFieldGrid(scalars, "210px"), "#34D399"));
    }
    return parts.concat(nestedSections).join("");
  }

  function renderGenericReport({ termo, payload, moduleLabel = "OSINT", sourceLabel = "Hub OSINT", systemBadge = "RIMUBUSCA OSINT" }) {
    const unwrapped = unwrapPayload(payload);
    const totalCount = Array.isArray(unwrapped) ? unwrapped.length : unwrapped && typeof unwrapped === "object" ? Object.keys(unwrapped).length : 1;
    return buildReportShell({
      systemBadge,
      title: `DOSSIÊ ANALÍTICO — ${String(moduleLabel).toUpperCase()}`,
      moduleLabel,
      termo,
      fonteLabel: sourceLabel,
      kpis: [
        { label: "MÓDULO", value: String(moduleLabel).toUpperCase(), color: "#A78BFA", small: true },
        { label: "ITENS / CAMPOS", value: totalCount, color: "#34D399" },
        { label: "STATUS", value: "ESTRUTURADO", color: "#38BDF8", small: true },
      ],
      bodyHtml: renderGenericBody(unwrapped),
    });
  }

  function renderPhotoReport({ termo, payload, moduleLabel = "FOTO BIOMÉTRICA", sourceLabel = "Biometria OSINT", systemBadge = "RIMUBUSCA OSINT" }) {
    const raw = unwrapPayload(payload);
    const d = Array.isArray(raw) ? raw[0] || {} : raw || {};
    const b64 = pick(d, ["fotoBase64", "base64", "foto", "imagem", "foto_cnh", "foto_rostinho", "foto_url", "url", "image"]) || (Array.isArray(d.fotos) ? d.fotos[0] : "");
    const imgSrc = resolveImageSrc(b64);

    const nome = pick(d, ["nome", "name", "titular", "nome_completo"]);
    const cpf = pick(d, ["cpf", "documento"], digitsOnly(termo).length === 11 ? termo : "");
    const rg = pick(d, ["rg"]);
    const cnh = pick(d, ["cnh", "registro"]);
    const nasc = pick(d, ["data_nascimento", "nascimento", "birth_date"]);
    const origem = pick(d, ["origem", "fonte", "orgao", "uf", "tipo"], "Base Biométrica Civil / Detran");
    const contentType = pick(d, ["contentType", "mimeType", "formato"], "image/jpeg");

    const imageBlock = imgSrc
      ? `<div style="text-align: center; background: #080B11; border: 1px solid #1E2538; border-radius: 8px; padding: 18px;">
           <img src="${imgSrc}" alt="Registro Biométrico" style="max-height: 280px; max-width: 100%; border-radius: 8px; border: 2px solid #10B981; box-shadow: 0 6px 24px rgba(16,185,129,0.22);" />
         </div>`
      : `<div style="padding: 18px; text-align: center; color: #F59E0B; background: rgba(245,158,11,0.08); border-radius: 6px; border: 1px solid rgba(245,158,11,0.25);">Imagem biométrica indisponível ou expirada na base consultada.</div>`;

    const metaGrid = renderFieldGrid([
      { label: "NOME VINCULADO", value: nome || "Não informado", color: "#F8FAFC" },
      { label: "CPF", value: formatCpf(cpf), color: "#34D399", mono: true },
      rg ? { label: "RG", value: rg, mono: true } : null,
      cnh ? { label: "REGISTRO CNH", value: cnh, color: "#60A5FA", mono: true } : null,
      nasc ? { label: "NASCIMENTO", value: formatDate(nasc), mono: true } : null,
      { label: "ORIGEM / BASE", value: origem, color: "#A78BFA" },
      { label: "FORMATO MIME", value: contentType, mono: true },
    ]);

    const extra = renderGenericBody(d, ["fotoBase64", "base64", "foto", "fotos", "imagem", "foto_cnh", "foto_rostinho", "foto_url", "url", "image", "nome", "name", "titular", "cpf", "documento", "rg", "cnh", "registro", "data_nascimento", "nascimento", "birth_date", "origem", "fonte", "orgao", "contentType", "mimeType"]);

    return buildReportShell({
      systemBadge,
      title: "DOSSIÊ BIOMÉTRICO & REGISTRO FOTOGRÁFICO",
      moduleLabel,
      termo,
      fonteLabel: sourceLabel,
      kpis: [
        { label: "CAPTURA BIOMÉTRICA", value: imgSrc ? "DISPONÍVEL" : "INDISPONÍVEL", color: imgSrc ? "#34D399" : "#F87171", small: true },
        { label: "CPF ALVO", value: formatCpf(cpf), color: "#38BDF8", mono: true, small: true },
        { label: "ORIGEM", value: origem, color: "#A78BFA", small: true },
      ],
      bodyHtml: renderDarkCard("Evidência Visual Biométrica", imageBlock, "#10B981") + renderDarkCard("Metadados de Identificação", metaGrid, "#60A5FA") + extra,
    });
  }

  function renderPhoneCarrierReport({ termo, payload, moduleLabel = "TELEFONIA / OPERADORA", sourceLabel = "Telecom / ANATEL", systemBadge = "RIMUBUSCA OSINT" }) {
    const raw = unwrapPayload(payload);
    const records = Array.isArray(raw) ? raw : [raw || {}];
    const r = records[0] || {};

    const cleanTerm = digitsOnly(termo);
    const ddd = pick(r, ["ddd"]) || (cleanTerm.length >= 10 ? cleanTerm.slice(0, 2) : "");
    const numeroRaw = pick(r, ["numero", "telefone", "fone"]) || (cleanTerm.length >= 10 ? cleanTerm.slice(2) : cleanTerm);
    const formattedPhone = formatPhone(numeroRaw, ddd);
    const carrier = String(pick(r, ["operadora", "operator", "prestadora", "provedor"], "NÃO INFORMADA")).toUpperCase();
    const lineType = String(pick(r, ["tipoLinha", "tipo_linha", "tipo"], "MÓVEL / FIXO")).toUpperCase();
    const status = String(pick(r, ["status", "situacao"], "ATIVA")).toUpperCase();
    const portabilidade = pick(r, ["portabilidade", "portado"]);
    const doadora = pick(r, ["operadoraOrigem", "operadoraDoadora", "operadora_origem"]);
    const region = pick(r, ["uf", "estado", "cidade"], "N/I");
    const confianca = pick(r, ["confianca"]);
    const ativacao = pick(r, ["dataAtivacao", "instalacao", "data"]);
    const titularObj = typeof r.titular === "object" && r.titular !== null ? r.titular : {};
    const titular = typeof r.titular === "string" ? r.titular : pick(r, ["nome", "razaoSocial", "cliente"]) || titularObj.nome || "Não informado";
    const doc = pick(r, ["cpf", "cnpj", "documento"]) || titularObj.cpf || titularObj.documento || "";
    const enderecoStr = formatAddressLine(r.endereco || r.logradouro ? r : null);

    const detailsGrid = renderFieldGrid([
      { label: "NÚMERO CONSULTADO", value: formattedPhone, color: "#34D399", mono: true },
      { label: "OPERADORA ATUAL", value: carrier, color: "#FBBF24" },
      { label: "TIPO DE LINHA", value: lineType, color: "#60A5FA" },
      { label: "STATUS DA LINHA", value: status, color: "#34D399" },
      { label: "UF / REGIÃO DDD", value: ddd ? `DDD ${ddd} (${region})` : region },
      {
        label: "PORTABILIDADE",
        value: portabilidade === true || String(portabilidade).toUpperCase() === "SIM"
          ? `SIM${doadora ? ` (Origem: ${doadora})` : ""}`
          : portabilidade === false
            ? "NÃO / ORIGINAL"
            : String(portabilidade || "N/I"),
        color: portabilidade ? "#F59E0B" : "#94A3B8",
      },
      { label: "TITULAR DA LINHA", value: titular, color: "#F8FAFC" },
      { label: "DOCUMENTO TITULAR", value: formatDocument(doc), color: "#38BDF8", mono: true },
      ativacao ? { label: "DATA DE ATIVAÇÃO", value: formatDate(ativacao), mono: true } : null,
      confianca !== null ? { label: "CONFIANÇA", value: String(confianca), color: "#A78BFA" } : null,
      enderecoStr !== "Endereço não cadastrado" ? { label: "ENDEREÇO DE FATURAMENTO / INSTALAÇÃO", value: enderecoStr, spanFull: true } : null,
    ]);

    const extraTable = records.length > 1
      ? renderDarkCard(`Demais Linhas / Vínculos (${records.length})`, renderDarkTable(records), "#F59E0B")
      : "";

    return buildReportShell({
      systemBadge,
      title: "DOSSIÊ DE INTELIGÊNCIA TELEFÔNICA & OPERADORA",
      moduleLabel,
      termo,
      fonteLabel: sourceLabel,
      kpis: [
        { label: "LINHA TELEFÔNICA", value: formattedPhone, color: "#34D399", small: true },
        { label: "OPERADORA", value: carrier, color: "#FBBF24", small: true },
        { label: "TIPO / STATUS", value: `${lineType} • ${status}`, color: "#60A5FA", small: true },
        { label: "UF / REGIÃO", value: region, color: "#A78BFA", small: true },
      ],
      bodyHtml: renderDarkCard("Identificação da Linha & Portabilidade", detailsGrid, "#F59E0B") + extraTable,
    });
  }

  function renderCepReport({ termo, payload, moduleLabel = "CEP / ENDEREÇO", sourceLabel = "DNE / Correios / IBGE", systemBadge = "RIMUBUSCA OSINT" }) {
    const raw = unwrapPayload(payload);
    const isArr = Array.isArray(raw);
    const base = isArr ? raw[0] || {} : raw || {};
    const residents = isArr
      ? raw
      : Array.isArray(base.moradores)
        ? base.moradores
        : Array.isArray(base.residentes)
          ? base.residentes
          : Array.isArray(base.pessoas)
            ? base.pessoas
            : Array.isArray(base.registros)
              ? base.registros
              : [];

    const cepFmt = formatCep(pick(base, ["cep"], termo));
    const logradouro = pick(base, ["logradouro", "endereco", "street"], "Não informado");
    const bairro = pick(base, ["bairro", "neighborhood"], "Não informado");
    const cidade = pick(base, ["cidade", "municipio", "localidade", "city"], "Não informada");
    const uf = pick(base, ["uf", "estado", "state"], "N/I");
    const ddd = pick(base, ["ddd"], "N/I");
    const ibge = pick(base, ["codigoIbge", "ibge"], "N/I");
    const estimativa = pick(base, ["totalResidentesEstimados", "residentes_estimados", "total"]);

    const geoCard = renderDarkCard(
      "Geolocalização & Logradouro Oficial",
      renderFieldGrid([
        { label: "CEP", value: cepFmt, color: "#34D399", mono: true },
        { label: "LOGRADOURO", value: logradouro, color: "#F8FAFC" },
        { label: "BAIRRO", value: bairro },
        { label: "CIDADE / UF", value: `${cidade} - ${uf}`, color: "#38BDF8" },
        { label: "DDD REGIONAL", value: ddd, mono: true },
        { label: "CÓDIGO IBGE", value: ibge, mono: true },
        estimativa !== null ? { label: "RESIDENTES ESTIMADOS", value: estimativa, color: "#A78BFA", mono: true } : null,
      ]),
      "#10B981"
    );

    const residentsCard = residents.length > 0
      ? renderDarkCard(`Residentes / Registros Vinculados (${residents.length})`, renderDarkTable(residents), "#38BDF8")
      : "";

    return buildReportShell({
      systemBadge,
      title: "DOSSIÊ GEOGRÁFICO & LOGRADOURO (CEP)",
      moduleLabel,
      termo: cepFmt !== "N/I" ? cepFmt : termo,
      fonteLabel: sourceLabel,
      kpis: [
        { label: "CEP CONSULTADO", value: cepFmt, color: "#34D399", small: true },
        { label: "CIDADE / UF", value: `${cidade}/${uf}`, color: "#38BDF8", small: true },
        { label: "DDD / IBGE", value: `${ddd} / ${ibge}`, color: "#A78BFA", small: true },
        { label: "RESIDENTES", value: residents.length || estimativa || 0, color: "#FBBF24" },
      ],
      bodyHtml: geoCard + residentsCard,
    });
  }

  function renderNeighborsReport({ termo, payload, moduleLabel = "VIZINHOS", sourceLabel = "Mapeamento Geográfico", systemBadge = "RIMUBUSCA OSINT" }) {
    const raw = unwrapPayload(payload);
    const list = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.vizinhos)
        ? raw.vizinhos
        : Array.isArray(raw?.moradores)
          ? raw.moradores
          : Array.isArray(raw?.resultados)
            ? raw.resultados
            : Array.isArray(raw?.pessoas)
              ? raw.pessoas
              : raw && typeof raw === "object"
                ? [raw]
                : [];

    const normalized = list.map((item, idx) => {
      const phones = Array.isArray(item.phones)
        ? item.phones.map((p) => formatPhone(extractPhoneDigits(p))).join(", ")
        : Array.isArray(item.telefones)
          ? item.telefones.map((p) => formatPhone(extractPhoneDigits(p))).join(", ")
          : item.telefone
            ? formatPhone(extractPhoneDigits(item.telefone))
            : "N/I";
      return {
        ORDEM: `#${idx + 1}`,
        NUMERO_ENDERECO: item.numero || item.endereco?.endereco_completo || formatAddressLine(item.endereco || item.address || item),
        MORADOR_NOME: item.morador || item.nome || item.name || "Não informado",
        CPF: formatCpf(item.cpf),
        NASCIMENTO: formatDate(item.data_nascimento || item.nascimento || item.birth_date),
        TELEFONES: phones,
      };
    });

    const cpfsCount = list.filter((i) => digitsOnly(i.cpf).length === 11).length;
    return buildReportShell({
      systemBadge,
      title: "DOSSIÊ DE VIZINHANÇA & RAIO GEOGRÁFICO",
      moduleLabel,
      termo,
      fonteLabel: sourceLabel,
      kpis: [
        { label: "VIZINHOS MAPEADOS", value: list.length, color: "#34D399" },
        { label: "CPFS IDENTIFICADOS", value: cpfsCount, color: "#38BDF8" },
        { label: "ALVO / RAIO", value: termo || "N/I", color: "#A78BFA", small: true },
      ],
      bodyHtml: renderDarkCard(`Relação de Moradores / Vizinhos (${list.length})`, renderDarkTable(normalized), "#10B981"),
    });
  }

  function renderDocumentReport({ termo, payload, tipo = "documento", sourceLabel = "Registro Civil / Federal", systemBadge = "RIMUBUSCA OSINT" }) {
    const raw = unwrapPayload(payload);
    const d = Array.isArray(raw) ? raw[0] || {} : raw || {};
    const tLower = String(tipo || "documento").toLowerCase();

    const titleMap = {
      titulo: "DOSSIÊ ELEITORAL (TÍTULO DE ELEITOR / TSE)",
      "titulo-eleitor": "DOSSIÊ ELEITORAL (TÍTULO DE ELEITOR / TSE)",
      rg: "DOSSIÊ DE IDENTIFICAÇÃO CIVIL (REGISTRO GERAL - RG)",
      nis: "DOSSIÊ SOCIAL & TRABALHISTA (NIS / CADÚNICO)",
      pis: "DOSSIÊ SOCIAL & TRABALHISTA (PIS / PASEP / NIT)",
      cnh: "DOSSIÊ DE HABILITAÇÃO (CNH / DENATRAN)",
    };

    const usedKeys = new Set([
      "nome", "name", "eleitor", "beneficiario", "cpf", "data_nascimento", "nascimento", "birth_date",
      "nome_mae", "mae", "nome_pai", "pai", "uf", "estado", "situacao",
    ]);

    const identityGrid = renderFieldGrid([
      { label: "TITULAR / PORTADOR", value: pick(d, ["nome", "name", "eleitor", "beneficiario"], "Não informado"), color: "#F8FAFC" },
      { label: "CPF", value: formatCpf(pick(d, ["cpf"], digitsOnly(termo).length === 11 ? termo : "")), color: "#34D399", mono: true },
      { label: "NASCIMENTO", value: formatDate(pick(d, ["data_nascimento", "nascimento", "birth_date"])), mono: true },
      { label: "NOME DA MÃE", value: pick(d, ["nome_mae", "mae"], "Não informado") },
      pick(d, ["nome_pai", "pai"]) ? { label: "NOME DO PAI", value: pick(d, ["nome_pai", "pai"]) } : null,
      { label: "SITUAÇÃO CADASTRAL", value: pick(d, ["situacao", "situacao_cadastral", "status"], "REGULAR"), color: "#34D399" },
    ]);

    const remainingHtml = renderGenericBody(d, Array.from(usedKeys));

    return buildReportShell({
      systemBadge,
      title: titleMap[tLower] || `DOSSIÊ DOCUMENTAL — ${tLower.toUpperCase()}`,
      moduleLabel: tLower.toUpperCase(),
      termo,
      fonteLabel: sourceLabel,
      kpis: [
        { label: "TIPO DOCUMENTAL", value: tLower.toUpperCase(), color: "#A78BFA", small: true },
        { label: "TITULAR", value: pick(d, ["nome", "name", "eleitor", "beneficiario"], "Consultado"), color: "#F8FAFC", small: true },
        { label: "CPF", value: formatCpf(pick(d, ["cpf"], termo)), color: "#34D399", small: true },
      ],
      bodyHtml: renderDarkCard("Identificação do Titular", identityGrid, "#60A5FA") + remainingHtml,
    });
  }

  function renderVehicleReport({ termo, payload, moduleLabel = "VEÍCULO / PLACA", sourceLabel = "SENATRAN / RENAVAM", systemBadge = "RIMUBUSCA OSINT" }) {
    const raw = unwrapPayload(payload);
    const list = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.veiculos)
        ? raw.veiculos
        : Array.isArray(raw?.frota)
          ? raw.frota
          : [raw || {}];

    const v = list[0] || {};
    const placa = String(pick(v, ["plate", "placa"], termo || "N/I")).toUpperCase();
    const brand = pick(v, ["brand", "marca"], "");
    const model = pick(v, ["model", "modelo"], "");
    const brandModel = pick(v, ["marcaModelo", "marca_modelo"]) || [brand, model].filter(Boolean).join(" ") || "N/I";
    const manufactureYear = pick(v, ["anoFabricacao", "ano_fabricacao", "year", "ano"], "N/I");
    const modelYear = pick(v, ["anoModelo", "ano_modelo", "modelYear"], "N/I");
    const color = pick(v, ["color", "cor"], "N/I");
    const fuel = pick(v, ["fuel", "combustivel"], "N/I");
    const chassi = pick(v, ["chassi", "vin"], "N/I");
    const renavam = pick(v, ["renavam"], "N/I");
    const motor = pick(v, ["motor", "numeroMotor"], "N/I");
    const municipio = pick(v, ["city", "municipio", "cidade"], "N/I");
    const uf = pick(v, ["state", "uf"], "N/I");
    const status = String(pick(v, ["situacaoVeiculo", "situacao", "status"], "CIRCULAÇÃO REGULAR")).toUpperCase();
    const ownerName = v.proprietario?.nome || pick(v, ["ownerName", "nomeProprietario", "proprietario_nome"], "Não informado");
    const ownerDoc = v.proprietario?.documento || v.proprietario?.cpf || pick(v, ["ownerCpf", "cpfProprietario", "cnpjProprietario"], "");

    const specsCard = renderDarkCard(
      "Especificações Técnicas & Registro SENATRAN",
      renderFieldGrid([
        { label: "PLACA", value: placa, color: "#34D399", mono: true },
        { label: "MARCA / MODELO", value: brandModel, color: "#F8FAFC" },
        { label: "ANO FAB / MODELO", value: `${manufactureYear} / ${modelYear}`, color: "#38BDF8" },
        { label: "COR / COMBUSTÍVEL", value: `${color} • ${fuel}` },
        { label: "CHASSI / VIN", value: chassi, mono: true },
        { label: "RENAVAM", value: renavam, mono: true },
        { label: "NÚMERO DO MOTOR", value: motor, mono: true },
        { label: "EMPLACAMENTO", value: `${municipio} / ${uf}` },
        { label: "PROPRIETÁRIO", value: ownerName, color: "#A78BFA" },
        { label: "DOCUMENTO PROPRIETÁRIO", value: formatDocument(ownerDoc), color: "#34D399", mono: true },
      ]),
      "#60A5FA",
      `<span style="background: rgba(16,185,129,0.15); color: #34D399; padding: 3px 10px; border-radius: 6px; font-size: 0.72rem; font-weight: 800;">${escapeHtml(status)}</span>`
    );

    const fleetTable = list.length > 1
      ? renderDarkCard(`Frota Completa Vinculada (${list.length} veículos)`, renderDarkTable(list), "#38BDF8")
      : "";

    const extra = list.length === 1
      ? renderGenericBody(v, ["plate", "placa", "brand", "marca", "model", "modelo", "marcaModelo", "marca_modelo", "anoFabricacao", "ano_fabricacao", "year", "ano", "anoModelo", "ano_modelo", "modelYear", "color", "cor", "fuel", "combustivel", "chassi", "vin", "renavam", "motor", "numeroMotor", "city", "municipio", "cidade", "state", "uf", "situacaoVeiculo", "situacao", "status", "proprietario", "ownerName", "nomeProprietario", "proprietario_nome", "ownerCpf", "cpfProprietario", "cnpjProprietario"])
      : "";

    return buildReportShell({
      systemBadge,
      title: list.length > 1 ? "DOSSIÊ DE FROTA & VEÍCULOS VINCULADOS" : "DOSSIÊ DE INTELIGÊNCIA VEICULAR",
      moduleLabel,
      termo: list.length > 1 ? termo : placa,
      fonteLabel: sourceLabel,
      kpis: [
        { label: "PLACA PRINCIPAL", value: placa, color: "#34D399", small: true },
        { label: "VEÍCULOS / FROTA", value: list.length, color: "#38BDF8" },
        { label: "ANO / MODELO", value: `${manufactureYear}/${modelYear}`, color: "#A78BFA", small: true },
        { label: "UF REGISTRO", value: uf, color: "#FBBF24", small: true },
      ],
      bodyHtml: specsCard + fleetTable + extra,
    });
  }

  function renderCompanyReport({ termo, payload, sourceLabel = "Receita Federal / CNPJ", systemBadge = "RIMUBUSCA OSINT" }) {
    const raw = unwrapPayload(payload);
    const data = Array.isArray(raw) ? raw[0] || {} : raw || {};

    const cnpjClean = digitsOnly(data.cnpj_limpo || data.cnpj || termo);
    const cnpjFmt = cnpjClean.length === 14 ? formatCnpj(cnpjClean) : String(data.cnpj || termo || "N/I");
    const razaoSocial = data.razaoSocial || data.razao_social || data.nome || "RAZÃO SOCIAL NÃO INFORMADA";
    const nomeFantasia = data.nomeFantasia || data.nome_fantasia || "Não informado";
    const situacao = String(data.situacaoCadastral || data.situacao_cadastral || data.situacao || "ATIVA").toUpperCase();
    const isAtiva = situacao.includes("ATIVA");
    const abertura = formatDate(data.dataAbertura || data.data_inicio_atividade || data.dataInicio);
    const capital = formatCurrency(data.capitalSocial ?? data.capital_social);
    const porte = data.porte || "Não informado";
    const natureza = data.naturezaJuridica || data.natureza_juridica || "Não informada";
    const fonte = data.fonte || sourceLabel;

    const cnaeCod = data.cnaePrincipal?.codigo || data.cnae_fiscal || data.cnae || "N/A";
    const cnaeDesc = data.cnaePrincipal?.descricao || data.cnae_fiscal_descricao || "";
    const cnaesSec = Array.isArray(data.cnaesSecundarios) ? data.cnaesSecundarios : Array.isArray(data.cnaes_secundarios) ? data.cnaes_secundarios : [];
    const socios = Array.isArray(data.sociosQSA) ? data.sociosQSA : Array.isArray(data.qsa) ? data.qsa : Array.isArray(data.socios) ? data.socios : Array.isArray(data.quadro_societario) ? data.quadro_societario : [];

    const endFmt = formatAddressLine(data);
    const telFmt = data.telefone || data.ddd_telefone_1 || "N/I";
    const emailFmt = data.email || "N/I";
    const simplesOpt = data.simples ? (data.simples.optante ? `SIM (Desde ${formatDate(data.simples.dataOpcao)})` : "NÃO OPTANTE") : "N/I";
    const meiOpt = data.mei ? (data.mei.optante ? "SIM (MEI)" : "NÃO") : "N/I";

    const idHtml = `
      <div class="dark-report-card" style="background: #0D111A; border: 1px solid #1E2538; border-left: 4px solid ${isAtiva ? "#10B981" : "#EF4444"}; border-radius: 8px; padding: 20px; margin-bottom: 18px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; border-bottom: 1px solid #1E2538; padding-bottom: 14px; margin-bottom: 14px;">
          <div>
            <h2 style="margin: 0; font-size: 1.25rem; font-weight: 800; color: #F8FAFC;">${escapeHtml(razaoSocial)}</h2>
            <div style="font-size: 0.85rem; color: #94A3B8; margin-top: 4px;">Nome Fantasia: <strong style="color: #E2E8F0;">${escapeHtml(nomeFantasia)}</strong></div>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <span style="background: rgba(56,189,248,0.12); color: #38BDF8; padding: 4px 10px; border-radius: 6px; font-family: var(--font-mono); font-size: 0.78rem; font-weight: 700;">CNPJ: ${escapeHtml(cnpjFmt)}</span>
            <span style="background: ${isAtiva ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)"}; color: ${isAtiva ? "#34D399" : "#F87171"}; padding: 4px 10px; border-radius: 6px; font-size: 0.78rem; font-weight: 800;">${escapeHtml(situacao)}</span>
          </div>
        </div>
        ${renderFieldGrid([
          { label: "NATUREZA JURÍDICA", value: natureza },
          { label: "PORTE EMPRESARIAL", value: porte },
          { label: "SIMPLES NACIONAL", value: simplesOpt },
          { label: "ENQUADRAMENTO MEI", value: meiOpt },
          { label: "ATIVIDADE PRINCIPAL (CNAE)", value: `${cnaeCod}${cnaeDesc ? ` — ${cnaeDesc}` : ""}`, spanFull: true },
        ], "210px")}
      </div>
    `;

    const contactHtml = renderDarkCard(
      "Localização & Canais Corporativos",
      renderFieldGrid([
        { label: "ENDEREÇO DA SEDE", value: endFmt, spanFull: true },
        { label: "TELEFONE OFICIAL", value: telFmt, color: "#34D399", mono: true },
        { label: "E-MAIL CORPORATIVO", value: emailFmt, color: "#38BDF8", mono: true },
      ]),
      "#60A5FA"
    );

    const qsaRows = socios.map((s) => ({
      NOME_SOCIO: s.nome || s.nomeSocio || s.nome_socio || "Sócio",
      QUALIFICACAO: s.qualificacao || s.qualificacao_socio || "Sócio",
      DOCUMENTO: formatDocument(s.cpf || s.cnpj || s.documento || s.cnpj_cpf_do_socio),
      ENTRADA: formatDate(s.dataEntrada || s.data_entrada_sociedade),
      FAIXA_ETARIA: s.faixaEtaria || s.faixa_etaria || "N/I",
    }));

    const qsaHtml = renderDarkCard(
      `Quadro de Sócios e Administradores (QSA - ${socios.length})`,
      qsaRows.length > 0 ? renderDarkTable(qsaRows) : `<div style="color: #64748B;">Nenhum sócio listado no registro público.</div>`,
      "#A78BFA"
    );

    const cnaeSecHtml = cnaesSec.length > 0
      ? renderDarkCard(
          `CNAEs Secundários (${cnaesSec.length})`,
          `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 8px;">${cnaesSec
            .slice(0, 20)
            .map((c) => `<div style="background: #080B11; border: 1px solid #1E2538; border-radius: 6px; padding: 8px 10px; font-size: 0.78rem;"><strong style="color: #38BDF8; font-family: var(--font-mono);">${escapeHtml(c.codigo || "")}</strong> — ${escapeHtml(c.descricao || "")}</div>`)
            .join("")}</div>`,
          "#94A3B8"
        )
      : "";

    const complianceHtml = renderComplianceSection(data.compliance || payload?.compliance);

    return buildReportShell({
      systemBadge,
      title: "DOSSIÊ EMPRESARIAL & RECEITA FEDERAL",
      moduleLabel: "CNPJ",
      termo: cnpjFmt,
      fonteLabel: fonte,
      kpis: [
        { label: "SITUAÇÃO CADASTRAL", value: situacao, color: isAtiva ? "#34D399" : "#F87171", small: true },
        { label: "CAPITAL SOCIAL", value: capital, color: "#34D399", small: true },
        { label: "DATA ABERTURA", value: abertura, color: "#38BDF8", small: true },
        { label: "SÓCIOS (QSA)", value: socios.length, color: "#A78BFA" },
        { label: "CNAES SECUNDÁRIOS", value: cnaesSec.length, color: "#FBBF24" },
      ],
      bodyHtml: idHtml + contactHtml + qsaHtml + cnaeSecHtml + complianceHtml,
    });
  }

  function renderNameHomonymsReport({ termo, payload, moduleLabel = "HOMÔNIMOS / NOME", sourceLabel = "Zeroy Name Search", systemBadge = "ZEROY OSINT ENGINE" }) {
    const raw = unwrapPayload(payload);
    const records = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.resultados)
        ? raw.resultados
        : Array.isArray(raw?.registros)
          ? raw.registros
          : Array.isArray(raw?.pessoas)
            ? raw.pessoas
            : raw && typeof raw === "object"
              ? [raw]
              : [];

    const rows = records.map((reg, idx) => ({
      ORDEM: `#${idx + 1}`,
      MATCH: reg.score !== undefined && reg.score !== null ? `${reg.score}%` : "ALTO",
      NOME_COMPLETO: reg.nome || reg.name || "Não informado",
      CPF: formatCpf(reg.cpf),
      NASCIMENTO: formatDate(reg.nascimento || reg.data_nascimento),
      SEXO: reg.sexo || reg.gender || "N/I",
      FILIACAO_MAE: reg.nomeMae || reg.nome_mae || reg.mae || "N/I",
    }));

    const uniqueCpfs = new Set(records.map((r) => digitsOnly(r.cpf)).filter((c) => c.length === 11)).size;

    return buildReportShell({
      systemBadge,
      title: "DOSSIÊ DE HOMÔNIMOS & IDENTIDADES CORRELATAS",
      moduleLabel,
      termo,
      fonteLabel: sourceLabel,
      kpis: [
        { label: "REGISTROS LOCALIZADOS", value: records.length, color: "#34D399" },
        { label: "CPFS ÚNICOS", value: uniqueCpfs, color: "#38BDF8" },
        { label: "CRITÉRIO DE BUSCA", value: String(moduleLabel).toUpperCase(), color: "#A78BFA", small: true },
      ],
      bodyHtml: renderDarkCard(`Lista de Candidatos / Homônimos (${records.length})`, renderDarkTable(rows), "#10B981"),
    });
  }

  function renderPixFinancialReport({ termo, payload, moduleLabel = "PIX / SISBAJUD", sourceLabel = "BACEN DICT / Financeiro", systemBadge = "ZEROY OSINT ENGINE" }) {
    const raw = unwrapPayload(payload);
    let accounts = [];
    if (Array.isArray(raw)) {
      accounts = raw;
    } else if (raw && typeof raw === "object") {
      if (Array.isArray(raw.resultados)) accounts = raw.resultados;
      else if (Array.isArray(raw.contas)) accounts = raw.contas;
      else if (Array.isArray(raw.data)) accounts = raw.data;
      else accounts = [raw];
    }

    let totalKeys = 0;
    const banksSet = new Set();

    const cardsHtml = accounts
      .map((acc, idx) => {
        const keysList = Array.isArray(acc.chavesPix)
          ? acc.chavesPix
          : Array.isArray(acc.chaves)
            ? acc.chaves
            : acc.chave
              ? [{ chave: acc.chave, tipo: acc.tipoChave || acc.tipo }]
              : [];
        totalKeys += keysList.length;

        const bankName = pick(acc, ["instituicao", "nomeBanco", "banco", "participante"], `Instituição Financeira #${idx + 1}`);
        banksSet.add(bankName);
        const ispb = pick(acc, ["ispb", "codigoBanco"], "N/I");
        const agencia = pick(acc, ["agencia"], "N/I");
        const conta = pick(acc, ["conta", "numeroConta"], "N/I");
        const tipoConta = pick(acc, ["tipoConta", "tipo"], "CORRENTE / PAGAMENTO");
        const titular = pick(acc, ["nomeTitular", "titular", "nome", "razaoSocial"], "Não informado");
        const doc = pick(acc, ["cpfCnpj", "cpf", "cnpj", "documento"], termo);
        const status = pick(acc, ["status", "situacao"], "ATIVA");
        const abertura = formatDate(pick(acc, ["dataAbertura", "dataCriacao"]));

        const accountFields = renderFieldGrid([
          { label: "INSTITUIÇÃO / BANCO", value: bankName, color: "#34D399" },
          { label: "CÓDIGO / ISPB", value: ispb, mono: true },
          { label: "TITULAR", value: titular, color: "#F8FAFC" },
          { label: "CPF / CNPJ", value: formatDocument(doc), color: "#38BDF8", mono: true },
          { label: "AGÊNCIA / CONTA", value: `Ag: ${agencia} • Cc: ${conta}`, mono: true },
          { label: "TIPO / STATUS", value: `${tipoConta} (${status})`, color: "#A78BFA" },
          abertura !== "N/I" ? { label: "DATA ABERTURA", value: abertura, mono: true } : null,
        ]);

        const keysRows = keysList.map((k) => ({
          TIPO: typeof k === "object" ? k.tipo || "CHAVE" : "CHAVE",
          CHAVE_PIX: typeof k === "object" ? k.chave || k.valor || JSON.stringify(k) : String(k),
          CRIACAO: typeof k === "object" && k.dataCriacao ? formatDate(k.dataCriacao) : abertura,
        }));

        const keysHtml = keysRows.length > 0
          ? `<div style="margin-top: 14px;">${renderDarkTable(keysRows)}</div>`
          : `<div style="margin-top: 10px; color: #64748B; font-size: 0.82rem;">Nenhuma chave DICT detalhada nesta conta.</div>`;

        return renderDarkCard(`Vínculo Financeiro #${idx + 1} — ${bankName}`, accountFields + keysHtml, "#F59E0B");
      })
      .join("");

    return buildReportShell({
      systemBadge,
      title: "DOSSIÊ FINANCEIRO BANCÁRIO & CHAVES PIX (BACEN/DICT)",
      moduleLabel,
      termo,
      fonteLabel: sourceLabel,
      kpis: [
        { label: "CONTAS / VÍNCULOS", value: accounts.length, color: "#34D399" },
        { label: "BANCOS DISTINTOS", value: banksSet.size, color: "#38BDF8" },
        { label: "CHAVES PIX MAPEADAS", value: totalKeys, color: "#FBBF24" },
      ],
      bodyHtml: cardsHtml || renderGenericBody(raw),
    });
  }

  function renderHealthReport({ termo, payload, moduleLabel = "SAÚDE / SUS / VACINAÇÃO", sourceLabel = "DATASUS / RNDS", systemBadge = "ZEROY OSINT ENGINE" }) {
    const raw = unwrapPayload(payload);
    const d = Array.isArray(raw) ? raw[0] || {} : raw || {};
    const vacinas = Array.isArray(d.vacinas)
      ? d.vacinas
      : Array.isArray(d.doses)
        ? d.doses
        : Array.isArray(d.imunizacoes)
          ? d.imunizacoes
          : Array.isArray(raw) && raw.length > 1
            ? raw
            : [];

    const cnsList = Array.isArray(d.cns) ? d.cns : d.cns ? [{ cns: d.cns }] : [];
    const pacienteObj = typeof d.paciente === "object" && d.paciente !== null ? d.paciente : {};
    const pacienteNome = (typeof d.paciente === "string" ? d.paciente : pacienteObj.nome) || pick(d, ["nome", "name"], "Não informado");
    const pacienteCns = pacienteObj.cns || pacienteObj.numeroCns || pick(d, ["numeroCns", "cartao_sus", "cns_principal"]) || (cnsList[0]?.cns || "N/I");

    const patientCard = renderDarkCard(
      "Prontuário & Identificação no SUS",
      renderFieldGrid([
        { label: "PACIENTE / TITULAR", value: pacienteNome, color: "#F8FAFC" },
        { label: "CPF", value: formatCpf(pick(d, ["cpf"], termo)), color: "#34D399", mono: true },
        { label: "CARTÃO SUS (CNS)", value: pacienteCns, color: "#38BDF8", mono: true },
        { label: "NASCIMENTO", value: formatDate(pick(d, ["data_nascimento", "nascimento", "dataNascimento"])), mono: true },
        { label: "MÃE", value: pick(d, ["nome_mae", "nomeMae", "mae"], "Não informado") },
        { label: "MUNICÍPIO / UF", value: `${pick(d, ["municipio", "cidade"], "N/I")} / ${pick(d, ["uf", "estado"], "N/I")}` },
      ]),
      "#10B981"
    );

    const vacinasCard = vacinas.length > 0
      ? renderDarkCard(`Histórico de Imunização / Vacinas (${vacinas.length})`, renderDarkTable(vacinas), "#38BDF8")
      : "";
    const cnsCard = cnsList.length > 0
      ? renderDarkCard(`Cartões Nacionais de Saúde (${cnsList.length})`, renderDarkTable(cnsList), "#A78BFA")
      : "";
    const extra = renderGenericBody(d, ["nome", "paciente", "name", "cpf", "numeroCns", "cartao_sus", "cns_principal", "cns", "data_nascimento", "nascimento", "dataNascimento", "nome_mae", "nomeMae", "mae", "municipio", "cidade", "uf", "estado", "vacinas", "doses", "imunizacoes"]);

    return buildReportShell({
      systemBadge,
      title: "DOSSIÊ DE SAÚDE PÚBLICA (SUS / CNS / IMUNIZAÇÕES)",
      moduleLabel,
      termo,
      fonteLabel: sourceLabel,
      kpis: [
        { label: "DOSES / REGISTROS", value: vacinas.length, color: "#34D399" },
        { label: "CARTÕES CNS", value: cnsList.length, color: "#38BDF8" },
        { label: "CPF VINCULADO", value: formatCpf(pick(d, ["cpf"], termo)), color: "#A78BFA", small: true },
      ],
      bodyHtml: patientCard + vacinasCard + cnsCard + extra,
    });
  }

  function renderCivilRegistryReport({ termo, payload, moduleLabel = "CARTÓRIO / NASCIMENTO", sourceLabel = "Registro Civil / CRC", systemBadge = "ZEROY OSINT ENGINE" }) {
    const raw = unwrapPayload(payload);
    const records = Array.isArray(raw) ? raw : [raw || {}];
    const r = records[0] || {};

    const registryCard = renderDarkCard(
      "Assento Civil & Cartório de Origem",
      renderFieldGrid([
        { label: "REGISTRADO", value: pick(r, ["nome", "registrado", "nome_registrado"], "Não informado"), color: "#F8FAFC" },
        { label: "CPF", value: formatCpf(pick(r, ["cpf"], termo)), color: "#34D399", mono: true },
        { label: "DATA DE NASCIMENTO", value: formatDate(pick(r, ["data_nascimento", "dataNascimento", "nascimento"])), color: "#38BDF8", mono: true },
        { label: "NATURALIDADE", value: `${pick(r, ["municipio_nascimento", "naturalidade", "cidade"], "N/I")} - ${pick(r, ["uf_nascimento", "uf"], "N/I")}` },
        { label: "GENITORA (MÃE)", value: pick(r, ["nome_mae", "mae", "genitora"], "Não informado") },
        { label: "GENITOR (PAI)", value: pick(r, ["nome_pai", "pai", "genitor"], "Não informado") },
        { label: "CARTÓRIO / SERVENTIA", value: pick(r, ["cartorio", "nomeCartorio", "serventia", "nome_cartorio"], "N/I"), spanFull: true },
        { label: "LIVRO / FOLHA / TERMO", value: `L: ${r.livro || "-"} • F: ${r.folha || "-"} • T: ${r.termo || r.numeroTermo || "-"}`, mono: true },
        { label: "MATRÍCULA / DNV", value: pick(r, ["matricula", "numeroCertidao", "dnv", "declaracao_nascido_vivo"], "N/I"), mono: true },
      ]),
      "#A78BFA"
    );

    const extra = records.length > 1
      ? renderDarkCard(`Outros Assentos Encontrados (${records.length})`, renderDarkTable(records), "#38BDF8")
      : renderGenericBody(r, ["nome", "registrado", "nome_registrado", "cpf", "data_nascimento", "dataNascimento", "nascimento", "municipio_nascimento", "naturalidade", "cidade", "uf_nascimento", "uf", "nome_mae", "mae", "genitora", "nome_pai", "pai", "genitor", "cartorio", "serventia", "nome_cartorio", "livro", "folha", "termo", "matricula", "dnv", "declaracao_nascido_vivo"]);

    return buildReportShell({
      systemBadge,
      title: "DOSSIÊ DE REGISTRO CIVIL (CERTIDÃO DE NASCIMENTO)",
      moduleLabel,
      termo,
      fonteLabel: sourceLabel,
      kpis: [
        { label: "REGISTROS", value: records.length, color: "#34D399" },
        { label: "DATA NASCIMENTO", value: formatDate(pick(r, ["data_nascimento", "dataNascimento", "nascimento"])), color: "#38BDF8", small: true },
        { label: "LIVRO / FOLHA", value: `${r.livro || "-"}/${r.folha || "-"}`, color: "#A78BFA", small: true },
      ],
      bodyHtml: registryCard + extra,
    });
  }

  function checkPersonDeceased(data, status = "") {
    if (!data || typeof data !== "object") return false;

    // 1. Status explícito em string ou objeto
    const st = String(status || "").toUpperCase();
    if (st.includes("FALECIDO") || st.includes("ÓBITO") || st.includes("OBITO")) {
      return true;
    }

    // 2. Campo obito / falecido
    const raw = data.obito !== undefined ? data.obito : data.falecido;
    if (raw === true) return true;
    if (raw === false || raw === null || raw === undefined) return false;

    if (typeof raw === "string") {
      const s = raw.trim().toUpperCase();
      if (["SIM", "S", "TRUE", "FALECIDO", "ÓBITO", "OBITO", "CONSTANTE", "SIM (CONSTANTE)"].includes(s)) return true;
      if (["NÃO", "NAO", "N", "FALSE", "NÃO CONSTA", "NAO CONSTA", "SEM REGISTRO", "NADA CONSTA", "SEM ÓBITO", "SEM OBITO"].includes(s)) return false;
      if (s.includes("FALECIDO") || s.includes("ÓBITO") || s.includes("OBITO")) return true;
      return false;
    }

    if (Array.isArray(raw)) {
      if (raw.length === 0) return false; // Array vazio NUNCA é óbito!
      return raw.some((item) => {
        if (!item) return false;
        if (typeof item === "string") {
          const s = item.trim().toUpperCase();
          return s && !["NÃO", "NAO", "FALSE", "SEM REGISTRO", "NADA CONSTA", "SEM OBITO", "SEM ÓBITO"].includes(s);
        }
        if (typeof item === "object") {
          return Boolean(item.certidao || item.dataObito || item.data || item.numero || item.livro || item.cartorio);
        }
        return Boolean(item);
      });
    }

    if (typeof raw === "object") {
      if (Object.keys(raw).length === 0) return false;
      return Boolean(raw.certidao || raw.dataObito || raw.data || raw.numero || raw.livro);
    }

    return false;
  }

  function renderZeroyCpfDossierReport({ termo, payload, moduleLabel = "CPF COMPLETO", sourceLabel = "Zeroy API Dossiê", systemBadge = "ZEROY OSINT ENGINE" }) {
    const raw = unwrapPayload(payload);
    const d = Array.isArray(raw) ? raw[0] || {} : raw || {};

    const basicData = pick(d, ["DadosBasicos", "dadosBasicos", "dados_basicos", "basico"], d) || d;
    const filiacaoObj = (basicData.filiacao && typeof basicData.filiacao === "object")
      ? basicData.filiacao
      : ((d.filiacao && typeof d.filiacao === "object") ? d.filiacao : {});
    const parents = pick(d, ["Pais", "pais", "filiacao"], filiacaoObj) || filiacaoObj;
    const purchasingPower = pick(d, ["PoderAquisitivo", "poderAquisitivo", "poder_aquisitivo"], {}) || {};
    const serasaMosaic = pick(d, ["Mosaic", "serasaMosaic", "mosaic"], {}) || {};
    const driverLicense = pick(d, ["Cnh", "cnh", "carteriaHabilitacao"], basicData.cnh && typeof basicData.cnh === "object" ? basicData.cnh : (basicData.carteriaHabilitacao || {})) || {};

    const cnsList = Array.isArray(d.Cns || d.cns || d.cnsHistorico) ? (d.Cns || d.cns || d.cnsHistorico) : (Array.isArray(basicData.cnsHistorico) ? basicData.cnsHistorico : []);
    const phones = Array.isArray(d.Telefones || d.telefones || d.telefonesHistorico) ? (d.Telefones || d.telefones || d.telefonesHistorico) : (Array.isArray(basicData.telefonesHistorico || basicData.telefones) ? (basicData.telefonesHistorico || basicData.telefones) : []);
    const emails = Array.isArray(d.Emails || d.emails || d.emailsHistorico) ? (d.Emails || d.emails || d.emailsHistorico) : (Array.isArray(basicData.emails) ? basicData.emails : []);
    const addresses = Array.isArray(d.Enderecos || d.enderecos || d.enderecosHistorico) ? (d.Enderecos || d.enderecos || d.enderecosHistorico) : (Array.isArray(basicData.enderecos) ? basicData.enderecos : []);
    const jobs = Array.isArray(d.Empregos || d.empregos || d.Empresas || d.empresas) ? (d.Empregos || d.empregos || d.Empresas || d.empresas) : [];
    const banks = Array.isArray(d.Bancos || d.bancos || d.contasBancarias) ? (d.Bancos || d.bancos || d.contasBancarias) : [];
    const incomeTax = Array.isArray(d.Irpf || d.irpf) ? (d.Irpf || d.irpf) : [];
    const relatives = Array.isArray(d.NovosParentes || d.novosParentes || d.Parentes || d.parentes || d.parentesNovos) ? (d.NovosParentes || d.novosParentes || d.Parentes || d.parentes || d.parentesNovos) : [];
    const neighbors = Array.isArray(d.Vizinhos || d.vizinhos) ? (d.Vizinhos || d.vizinhos) : [];

    const fullName = pick(basicData, ["nome", "name", "nomeCompleto"], "NOME NÃO INFORMADO");
    const cpfFormatted = formatCpf(pick(basicData, ["cpf"], termo));
    const birthDate = formatDate(pick(basicData, ["dataNasc", "dataNascimento", "nascimento", "data_nascimento", "dtNasc"]));
    const gender = pick(basicData, ["sexo", "gender"], "N/I");

    let statusText = "REGULAR";
    const rawStatus = pick(basicData, ["situacaoCadastral", "situacaoReceita", "statusReceita"], "REGULAR");
    if (rawStatus && typeof rawStatus === "object") {
      statusText = rawStatus.descricaoSit || rawStatus.situacao || rawStatus.descricao || rawStatus.status || "REGULAR";
    } else if (rawStatus) {
      statusText = String(rawStatus);
    }

    const obito = checkPersonDeceased(basicData, statusText);
    const rendaFmt = formatCurrency(pick(basicData, ["rendaAtual", "renda", "income"]));
    const mae = pick(parents, ["nomeMae", "mae", "nome_mae"], pick(filiacaoObj, ["nomeMae", "mae"], pick(basicData, ["nomeMae", "mae", "nome_mae"], "Não informada")));
    const pai = pick(parents, ["nomePai", "pai", "nome_pai"], pick(filiacaoObj, ["nomePai", "pai"], pick(basicData, ["nomePai", "pai", "nome_pai"], "Não informado")));
    const photoSrc = resolveImageSrc(
      pick(d, ["fotoBase64", "foto", "base64", "foto_cnh", "foto_rostinho"]) ||
      pick(basicData, ["fotoBase64", "foto", "base64", "foto_cnh", "foto_rostinho"]) ||
      (Array.isArray(d.fotos) && d.fotos[0] ? d.fotos[0] : "") ||
      (Array.isArray(d.Fotos) && d.Fotos[0] ? d.Fotos[0] : "") ||
      (Array.isArray(basicData.fotos) && basicData.fotos[0] ? basicData.fotos[0] : "") ||
      ""
    );

    const primaryCard = `
      <div class="dark-report-card" style="background: #0D111A; border: 1px solid #1E2538; border-left: 4px solid ${obito ? "#EF4444" : "#10B981"}; border-radius: 8px; padding: 20px; margin-bottom: 18px;">
        <div style="display: flex; gap: 16px; align-items: center; flex-wrap: wrap; border-bottom: 1px solid #1E2538; padding-bottom: 14px; margin-bottom: 14px;">
          ${photoSrc ? `<div style="position: relative; display: inline-block;"><img src="${photoSrc}" alt="Foto Biométrica" style="width: 82px; height: 96px; border-radius: 8px; object-fit: cover; border: 2px solid #10B981; box-shadow: 0 4px 12px rgba(16,185,129,0.3); cursor: pointer;" onclick="if(window.abrirFotoLightbox){window.abrirFotoLightbox(this.src,'Foto Cadastral')}else{window.open(this.src,'_blank')}" title="Clique para ampliar" /></div>` : ""}
          <div style="flex: 1; min-width: 240px;">
            <h2 style="margin: 0; font-size: 1.25rem; font-weight: 800; color: #F8FAFC;">${escapeHtml(fullName)}</h2>
            <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 6px; font-size: 0.82rem; color: #94A3B8;">
              <strong style="color: #34D399; font-family: var(--font-mono);">CPF: ${escapeHtml(cpfFormatted)}</strong>
              <span>&bull; Nasc: <strong style="color: #E2E8F0;">${escapeHtml(birthDate)}</strong></span>
              <span>&bull; Sexo: <strong style="color: #E2E8F0;">${escapeHtml(gender)}</strong></span>
            </div>
          </div>
          <span style="background: ${obito ? "rgba(239,68,68,0.18)" : "rgba(16,185,129,0.15)"}; color: ${obito ? "#F87171" : "#34D399"}; padding: 5px 12px; border-radius: 6px; font-size: 0.78rem; font-weight: 800;">
            ${escapeHtml(obito ? "ÓBITO / FALECIDO" : String(statusText).toUpperCase())}
          </span>
        </div>
        ${renderFieldGrid([
          { label: "FILIAÇÃO MATERNA (MÃE)", value: mae },
          { label: "FILIAÇÃO PATERNA (PAI)", value: pai },
          { label: "RENDA PRESUMIDA", value: rendaFmt, color: "#34D399", mono: true },
          basicData.faixaScore ? { label: "FAIXA SCORE SERASA", value: basicData.faixaScore, color: "#A78BFA" } : null,
          purchasingPower.PODER_AQUISITIVO ? { label: "PODER AQUISITIVO", value: purchasingPower.PODER_AQUISITIVO, color: "#38BDF8" } : null,
          serasaMosaic.codMosaic ? { label: "MOSAIC SERASA", value: serasaMosaic.codMosaic, mono: true } : null,
          pick(basicData, ["rg"]) ? { label: "RG", value: pick(basicData, ["rg"]), mono: true } : null,
          pick(basicData, ["tituloEleitor", "titulo_eleitor", "titulo"]) ? { label: "TÍTULO DE ELEITOR", value: pick(basicData, ["tituloEleitor", "titulo_eleitor", "titulo"]), mono: true } : null,
          driverLicense.registro ? { label: "CNH REGISTRO", value: `${driverLicense.registro} (${driverLicense.uf || "-"}) • Val: ${formatDate(driverLicense.validade)}`, mono: true } : null,
        ])}
      </div>
    `;

    const sections = [primaryCard];

    if (phones.length > 0) {
      sections.push(
        renderDarkCard(
          `Telefones Mapeados (${phones.length})`,
          renderDarkTable(
            phones.map((p) => ({
              TELEFONE: formatPhone(p.telefone || p.numero || p, p.ddd),
              WHATSAPP: p.whatsapp || "N/I",
              TIPO: p.tipo || "N/I",
              BASE_ANO: p.ano || "N/I",
            }))
          ),
          "#F59E0B"
        )
      );
    }

    if (emails.length > 0) {
      sections.push(
        renderDarkCard(
          `E-mails Identificados (${emails.length})`,
          renderDarkTable(
            emails.map((e) => ({
              EMAIL: typeof e === "object" ? e.email || e.endereco || "" : String(e),
              STATUS: typeof e === "object" ? e.statusVt || "Mapeado" : "Mapeado",
            }))
          ),
          "#A855F7"
        )
      );
    }

    if (addresses.length > 0) {
      sections.push(
        renderDarkCard(
          `Histórico de Endereços (${addresses.length})`,
          renderDarkTable(
            addresses.map((a) => ({
              ENDERECO: formatAddressLine(a),
              CEP: formatCep(a.cep),
              CIDADE_UF: `${a.cidade || "N/I"}/${a.siglaUf || a.uf || "N/I"}`,
            }))
          ),
          "#10B981"
        )
      );
    }

    if (relatives.length > 0) {
      sections.push(
        renderDarkCard(
          `Vínculos Familiares & Parentes (${relatives.length})`,
          renderDarkTable(
            relatives.map((p) => ({
              RELACAO: p.tipoRelacao || p.vinculo || p.grau || "PARENTE",
              NOME: p.nome || "N/I",
              CPF: formatCpf(p.cpf),
            }))
          ),
          "#EC4899"
        )
      );
    }

    if (jobs.length > 0) {
      sections.push(renderDarkCard(`Ocupação Profissional & Vínculos (${jobs.length})`, renderDarkTable(jobs), "#D97706"));
    }

    if (banks.length > 0) {
      sections.push(renderDarkCard(`Instituições Bancárias (${banks.length})`, renderDarkTable(banks), "#8B5CF6"));
    }

    if (incomeTax.length > 0) {
      sections.push(renderDarkCard(`Restituição IRPF (${incomeTax.length})`, renderDarkTable(incomeTax), "#10B981"));
    }

    if (cnsList.length > 0) {
      sections.push(renderDarkCard(`Cartão Nacional de Saúde - CNS (${cnsList.length})`, renderDarkTable(cnsList), "#10B981"));
    }

    if (neighbors.length > 0) {
      sections.push(
        renderDarkCard(
          `Vizinhos no Raio Geográfico (${neighbors.length})`,
          renderDarkTable(
            neighbors.slice(0, 60).map((vz) => ({
              NOME: vz.nome || vz.morador || "N/I",
              CPF: formatCpf(vz.cpf),
              NASCIMENTO: formatDate(vz.data_nascimento || vz.nascimento),
              ENDERECO: formatAddressLine(vz.endereco),
            }))
          ),
          "#10B981"
        )
      );
    }

    const handledKeys = [
      "DadosBasicos", "dadosBasicos", "dados_basicos", "basico",
      "Pais", "pais", "filiacao", "PoderAquisitivo", "poderAquisitivo", "poder_aquisitivo",
      "Mosaic", "serasaMosaic", "mosaic", "Cnh", "cnh", "carteriaHabilitacao",
      "Cns", "cns", "cnsHistorico",
      "Telefones", "telefones", "telefonesHistorico",
      "Emails", "emails", "emailsHistorico",
      "Enderecos", "enderecos", "enderecosHistorico",
      "Empregos", "empregos", "Empresas", "empresas",
      "Bancos", "bancos", "contasBancarias", "chavePix",
      "Irpf", "irpf",
      "NovosParentes", "novosParentes", "Parentes", "parentes", "parentesNovos",
      "Vizinhos", "vizinhos",
      "fotoBase64", "foto", "base64", "fotos", "Fotos",
      "compliance", "rgHistorico", "tituloHistorico", "pisHistorico",
    ];
    if (basicData === d) {
      handledKeys.push("nome", "name", "nomeCompleto", "cpf", "dataNascimento", "nascimento", "data_nascimento", "sexo", "gender", "situacaoCadastral", "situacaoReceita", "statusReceita", "obito", "falecido", "rendaAtual", "renda", "income", "faixaScore", "nomeMae", "mae", "nome_mae", "nomePai", "pai", "nome_pai", "rg", "tituloEleitor", "titulo_eleitor", "titulo");
    }
    const leftover = renderGenericBody(d, handledKeys);
    if (leftover) sections.push(leftover);

    const complianceSection = renderComplianceSection(d.compliance || payload?.compliance);
    if (complianceSection) sections.push(complianceSection);

    return buildReportShell({
      systemBadge,
      title: `DOSSIÊ INTEGRAL — ${String(moduleLabel).toUpperCase()}`,
      moduleLabel,
      termo: cpfFormatted !== "N/I" ? cpfFormatted : termo,
      fonteLabel: sourceLabel,
      rawPayload: d,
      kpis: [
        { label: "TELEFONES", value: phones.length, color: "#F59E0B" },
        { label: "ENDEREÇOS", value: addresses.length, color: "#34D399" },
        { label: "PARENTES", value: relatives.length, color: "#F472B6" },
        { label: "BANCOS / IRPF", value: banks.length + incomeTax.length, color: "#38BDF8" },
      ],
      bodyHtml: sections.join(""),
    });
  }

  function renderComplianceSection(compliance) {
    if (!compliance || typeof compliance !== "object") return "";
    const resumo = compliance.resumo || {};
    const cgu = compliance.cgu || {};
    const tse = compliance.tse || {};
    const diarios = compliance.diarios || {};
    const pncp = compliance.pncp || {};

    const sancoes = [
      ...(Array.isArray(cgu.ceis) ? cgu.ceis : []),
      ...(Array.isArray(cgu.cnep) ? cgu.cnep : []),
      ...(Array.isArray(cgu.cepim) ? cgu.cepim : []),
    ];
    const peps = Array.isArray(cgu.peps) ? cgu.peps : [];
    const candidaturas = Array.isArray(tse.candidaturas) ? tse.candidaturas : [];
    const ocorrencias = Array.isArray(diarios.ocorrencias) ? diarios.ocorrencias : [];
    const contratos = Array.isArray(pncp.resultados) ? pncp.resultados : [];

    const hasAlert = sancoes.length > 0;
    const statusColor = hasAlert ? "#F87171" : "#34D399";

    const parts = [];
    parts.push(`
      <div style="background: #080B11; border: 1px solid ${hasAlert ? "rgba(239,68,68,0.45)" : "#1E2538"}; border-radius: 6px; padding: 12px 14px; margin-bottom: 12px;">
        <div style="font-size: 0.72rem; color: ${statusColor}; font-weight: 800; text-transform: uppercase; margin-bottom: 4px;">
          STATUS COMPLIANCE: ${escapeHtml(resumo.classificacaoRisco || "AUDITORIA CONCLUÍDA")}
        </div>
        <div style="font-size: 0.82rem; color: #E2E8F0;">${escapeHtml(resumo.resumoTexto || "Consulta de integridade e transparência executada.")}</div>
      </div>
    `);

    if (sancoes.length > 0) {
      parts.push(
        renderDarkTable(
          sancoes.map((s) => ({
            CADASTRO: s.cadastro || "CGU",
            TIPO_SANCAO: s.tipoSancao || "Sanção",
            ORGAO: s.orgaoSancionador || "N/I",
            VIGENCIA: `${s.dataInicio || "N/I"} até ${s.dataFim || "Indeterminado"}`,
            PROCESSO: s.processo || "N/I",
          }))
        )
      );
    } else {
      parts.push(`<div style="font-size: 0.8rem; color: #94A3B8; margin-bottom: 10px;">• CGU (CEIS/CNEP/CEPIM/PEP): ${escapeHtml(cgu.mensagem || "Sem sanções localizadas.")}</div>`);
    }

    if (peps.length > 0) {
      parts.push(
        `<div style="margin-top: 10px;"><strong style="color: #FBBF24; font-size: 0.78rem;">Registro PEP (Pessoa Politicamente Exposta):</strong>${renderDarkTable(
          peps.map((p) => ({ FUNCAO: p.funcao, ORGAO: p.orgao, INICIO: p.dataInicio || "N/I", FIM: p.dataFim || "N/I" }))
        )}</div>`
      );
    }

    if (candidaturas.length > 0) {
      parts.push(
        `<div style="margin-top: 12px;"><strong style="color: #38BDF8; font-size: 0.78rem; display: block; margin-bottom: 6px;">TSE DivulgaCandContas (${candidaturas.length} candidatura(s)):</strong>${renderDarkTable(
          candidaturas.map((c) => ({
            ANO: String(c.ano || ""),
            NOME_URNA: c.nomeUrna || c.nomeCompleto,
            CARGO: c.cargo,
            PARTIDO: c.partido,
            LOCAL: c.abrangencia || c.uf,
            SITUACAO: c.situacao,
          }))
        )}</div>`
      );
    }

    if (contratos.length > 0) {
      parts.push(
        `<div style="margin-top: 12px;"><strong style="color: #34D399; font-size: 0.78rem; display: block; margin-bottom: 6px;">PNCP — Contratos Públicos (${contratos.length}):</strong>${renderDarkTable(
          contratos.map((ct) => ({
            TITULO: ct.titulo,
            ORGAO: ct.orgao,
            DATA: formatDate(ct.dataAssinatura),
            VALOR: ct.valorGlobal !== null ? formatCurrency(ct.valorGlobal) : "N/I",
          }))
        )}</div>`
      );
    }

    if (ocorrencias.length > 0) {
      parts.push(
        `<div style="margin-top: 12px;"><strong style="color: #C4B5FD; font-size: 0.78rem; display: block; margin-bottom: 6px;">Querido Diário — Diários Oficiais (${ocorrencias.length}):</strong>${renderDarkTable(
          ocorrencias.map((d) => ({
            MUNICIPIO: `${d.municipio}/${d.uf || ""}`,
            DATA: formatDate(d.dataPublicacao),
            TRECHO: d.trecho || "-",
          }))
        )}</div>`
      );
    }

    return renderDarkCard(
      "Compliance Público, Sanções (CGU / CEIS / TSE) & Transparência",
      parts.join(""),
      hasAlert ? "#EF4444" : "#10B981"
    );
  }

  function renderFinanceiroBrReport({ termo = "", resultado = {}, systemBadge = "RIMUBUSCA FORENSE BR" }) {
    const r = resultado || {};
    const d = r.dados || {};
    const isPix = r.modalidade === "pix";
    const alertas = Array.isArray(r.alertas) ? r.alertas : [];
    const riscoColor = r.nivelRisco === "CRÍTICO" || r.nivelRisco === "ALTO" ? "#F87171" : r.nivelRisco === "ATENÇÃO" ? "#FBBF24" : "#34D399";

    const resumoCampos = isPix
      ? [
          { label: "RECEBEDOR (TAG 59)", value: d.recebedor || "N/I", spanFull: false },
          { label: "CIDADE / PAÍS", value: `${d.cidade || "N/I"} / ${d.pais || "BR"}` },
          { label: "TIPO DE CHAVE", value: d.chaveRotulo || "N/I" },
          { label: "CHAVE PIX", value: d.chaveFormatada || d.urlQrDinamico || "N/I", mono: true, color: "#38BDF8" },
          { label: "VALOR", value: d.valorFormatado || "N/I", mono: true, color: "#34D399" },
          { label: "TXID / REFERÊNCIA", value: d.txId || "***", mono: true },
          { label: "CHECKSUM CRC16-CCITT", value: `${r.crcEncontrado || "N/A"} (Esperado: ${r.crcEsperado || "N/A"}) — ${r.crcValido ? "ÍNTEGRO" : "INVÁLIDO"}`, mono: true, color: r.crcValido ? "#34D399" : "#F87171", spanFull: true },
        ]
      : [
          { label: "MODALIDADE", value: r.tipoBoleto === "BANCARIO" ? "Boleto Bancário (FEBRABAN)" : "Guia Arrecadação / Convênio" },
          { label: r.tipoBoleto === "BANCARIO" ? "BANCO EMISSOR" : "SEGMENTO", value: r.tipoBoleto === "BANCARIO" ? `${d.bancoCodigo} — ${d.bancoNome}` : d.segmentoNome },
          { label: "VALOR NOMINAL", value: d.valorFormatado || "N/I", mono: true, color: "#34D399" },
          { label: r.tipoBoleto === "BANCARIO" ? "VENCIMENTO" : "TIPO DV", value: r.tipoBoleto === "BANCARIO" ? `${d.vencimentoBr} (${d.cicloVencimento})` : d.tipoCalculoDv, mono: true, color: "#38BDF8" },
          { label: "LINHA DIGITÁVEL", value: d.linhaDigitavelFormatada || d.linhaDigitavel || "N/I", mono: true, spanFull: true },
          { label: "CÓDIGO DE BARRAS (44D)", value: d.codigoBarras || "N/I", mono: true, spanFull: true },
          { label: "DAC GERAL", value: `${d.dacValido ? "ÍNTEGRO" : "INVÁLIDO"} (${d.dacGeral} / esp. ${d.dacEsperado})`, mono: true, color: d.dacValido ? "#34D399" : "#F87171", spanFull: true },
        ];

    const alertasCard = alertas.length > 0
      ? renderDarkCard(
          `Alertas de Integridade & Antifraude (${alertas.length})`,
          alertas
            .map(
              (a) =>
                `<div style="background: #080B11; border: 1px solid #1E2538; border-left: 3px solid #EF4444; border-radius: 6px; padding: 10px 12px; margin-bottom: 8px;"><strong style="color: #F87171; font-size: 0.82rem;">${escapeHtml(a.titulo)}</strong><div style="color: #CBD5E1; font-size: 0.78rem; margin-top: 2px;">${escapeHtml(a.detalhe)}</div></div>`
            )
            .join(""),
          "#EF4444"
        )
      : renderDarkCard(
          "Verificação Matemática & Antifraude",
          `<div style="color: #34D399; font-size: 0.85rem; font-weight: 700;">Validação estrutural aprovada sem inconsistências nos dígitos verificadores.</div>`,
          "#10B981"
        );

    const tlvCard = isPix && Array.isArray(r.tlv)
      ? renderDarkCard(
          "Estrutura EMV TLV Decodificada",
          renderDarkTable(r.tlv.map((t) => ({ TAG: t.id, CAMPO: t.label, TAMANHO: String(t.length), VALOR: t.value }))),
          "#A78BFA"
        )
      : "";

    return buildReportShell({
      systemBadge,
      title: isPix ? "LAUDO FORENSE — PIX BR CODE (EMVCO)" : "LAUDO FORENSE — BOLETO FEBRABAN",
      moduleLabel: isPix ? "PIX BR CODE" : "BOLETO",
      termo: termo || (isPix ? d.recebedor : d.linhaDigitavelFormatada),
      fonteLabel: "Motor Determinístico Local (EMVCo / FEBRABAN)",
      kpis: [
        { label: "RISCO DETECTADO", value: r.nivelRisco || "N/I", color: riscoColor, small: true },
        { label: "VALOR", value: d.valorFormatado || "N/I", color: "#34D399", small: true },
        { label: "INTEGRIDADE", value: (isPix ? r.crcValido : r.integridadeValida) ? "VÁLIDO" : "ERRO DV", color: (isPix ? r.crcValido : r.integridadeValida) ? "#34D399" : "#F87171", small: true },
        { label: "ALERTAS", value: alertas.length, color: alertas.length > 0 ? "#F87171" : "#38BDF8" },
      ],
      bodyHtml:
        renderDarkCard("Identificação & Dados Extraídos", renderFieldGrid(resumoCampos, "220px"), "#38BDF8") +
        alertasCard +
        tlvCard,
    });
  }

  function generateZeroyReport({ moduloId = "cpf-zeroy", moduloNome = "", parametro = "", path = "", termo = "", rawResponse = {} }) {
    const id = String(moduloId || "cpf-zeroy").toLowerCase().trim();
    const label = moduloNome ? moduloNome.replace(/^Módulo\s+/i, "") : id.toUpperCase();
    const payload = unwrapPayload(rawResponse);
    const metaSource = path ? `Zeroy API (${path})` : "Zeroy Intelligence Engine";

    if (id === "cnpj" || (!Array.isArray(payload) && (payload?.razaoSocial || payload?.qsa || payload?.sociosQSA))) {
      return renderCompanyReport({ termo, payload, sourceLabel: metaSource, systemBadge: "ZEROY OSINT ENGINE" });
    }

    if (
      ["placa", "placa2", "chassi", "motor", "renavam", "frota", "vistoria-veicular"].includes(id) ||
      (!Array.isArray(payload) && (payload?.placa || payload?.chassi || payload?.renavam || payload?.marcaModelo))
    ) {
      return renderVehicleReport({ termo, payload, moduleLabel: label, sourceLabel: metaSource, systemBadge: "ZEROY OSINT ENGINE" });
    }

    if (["pix-sisbajud", "chave-pix", "pix-bacen"].includes(id)) {
      return renderPixFinancialReport({ termo, payload, moduleLabel: label, sourceLabel: metaSource, systemBadge: "ZEROY OSINT ENGINE" });
    }

    if (id === "telefone" || (!Array.isArray(payload) && payload?.operadora && !payload?.DadosBasicos && !payload?.dadosBasicos)) {
      return renderPhoneCarrierReport({ termo, payload, moduleLabel: label, sourceLabel: metaSource, systemBadge: "ZEROY OSINT ENGINE" });
    }

    if (["foto-cnh", "foto-nc"].includes(id) || (!Array.isArray(payload) && (payload?.fotoBase64 || payload?.foto_cnh || payload?.foto_rostinho))) {
      return renderPhotoReport({ termo, payload, moduleLabel: label, sourceLabel: metaSource, systemBadge: "ZEROY OSINT ENGINE" });
    }

    if (["cartao-vacina", "cns"].includes(id) || (!Array.isArray(payload) && (payload?.vacinas || payload?.doses || payload?.imunizacoes))) {
      return renderHealthReport({ termo, payload, moduleLabel: label, sourceLabel: metaSource, systemBadge: "ZEROY OSINT ENGINE" });
    }

    if (id === "nascimento" || (!Array.isArray(payload) && (payload?.cartorio || payload?.livro || payload?.matricula))) {
      return renderCivilRegistryReport({ termo, payload, moduleLabel: label, sourceLabel: metaSource, systemBadge: "ZEROY OSINT ENGINE" });
    }

    if (id === "cep" || (!Array.isArray(payload) && payload?.cep && payload?.logradouro && !payload?.cpf && !payload?.DadosBasicos)) {
      return renderCepReport({ termo, payload, moduleLabel: label, sourceLabel: metaSource, systemBadge: "ZEROY OSINT ENGINE" });
    }

    if (
      Array.isArray(payload) ||
      Array.isArray(payload?.resultados) ||
      Array.isArray(payload?.registros) ||
      (["nome", "mae", "pai", "relacionados"].includes(id) && !payload?.DadosBasicos && !payload?.dadosBasicos && !payload?.Telefones && !payload?.Enderecos)
    ) {
      return renderNameHomonymsReport({ termo, payload, moduleLabel: label, sourceLabel: metaSource, systemBadge: "ZEROY OSINT ENGINE" });
    }

    if (payload && typeof payload === "object" && (payload.DadosBasicos || payload.dadosBasicos || payload.cpf || payload.nome || ["cpf-zeroy", "cpf-2", "prev-inss", "renda-presumida", "rg", "cnh", "titulo-eleitor"].includes(id))) {
      return renderZeroyCpfDossierReport({ termo, payload, moduleLabel: label, sourceLabel: metaSource, systemBadge: "ZEROY OSINT ENGINE" });
    }

    return renderGenericReport({ termo, payload, moduleLabel: label, sourceLabel: metaSource, systemBadge: "ZEROY OSINT ENGINE" });
  }

  function resolveSocialReportImageSrc(raw) {
    if (!raw || typeof raw !== "string") return "";
    const trimmed = raw.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("data:image/")) return trimmed;
    if (/^https:\/\/(?:[^/]+\.)?(?:cdninstagram\.com|fbcdn\.net|instagram\.com|twimg\.com)\//i.test(trimmed)) {
      return `/api/redes/brightdata/midia?url=${encodeURIComponent(trimmed)}`;
    }
    return resolveImageSrc(trimmed);
  }

  function renderBrightDataSocialReport({
    termo = "",
    data = {},
    systemBadge = "BRIGHT DATA SOCIAL OSINT",
    customImages = [],
    includePostImages = true,
  }) {
    const rep = data?.relatorio || data || {};
    const param = rep.parametros || {};
    const perfil = rep.perfil || {};
    const met = rep.metricas || {};
    const intel = rep.inteligenciaOsint || {};
    const ent = intel.entidadesExtraidas || {};
    const posts = Array.isArray(rep.posts) ? rep.posts : [];
    const kwHits = Array.isArray(intel.palavrasChaveResultados) ? intel.palavrasChaveResultados : [];
    const topCommenters = Array.isArray(intel.topComentaristas) ? intel.topComentaristas : [];
    const attachedImages = Array.isArray(customImages) ? customImages : [];

    const platLabel = param.plataforma === "x" ? "X (Twitter)" : "Instagram";
    const safeHandle = perfil.handle ? `@${String(perfil.handle).replace(/^@/, "")}` : (termo || param.alvo || "Alvo Social");
    const avatarSrc = resolveSocialReportImageSrc(perfil.fotoUrl || "");

    const kpis = [
      { label: "Posts Coletados", value: Number(met.totalPosts || posts.length || 0), color: "#A78BFA" },
      { label: "Comentários Extraídos", value: Number(met.totalComentariosColetados || 0), color: "#34D399" },
      { label: "Curtidas Totais", value: Number(met.totalLikes || 0).toLocaleString("pt-BR"), color: "#60A5FA" },
      { label: "Engajamento Médio", value: Number(met.engajamentoMedioPorPost || 0).toLocaleString("pt-BR"), color: "#FBBF24" },
      { label: "Hits Palavra-Chave", value: Number(met.totalOcorrenciasPalavraChave || kwHits.length || 0), color: kwHits.length > 0 ? "#F87171" : "#94A3B8" },
    ];

    let bodyHtml = "";

    const avatarBlock = avatarSrc
      ? `<div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;padding:10px 12px;border-radius:8px;background:#090D16;border:1px solid #1E2538;">
          <img src="${escapeHtml(avatarSrc)}" alt="Avatar do Alvo" referrerpolicy="no-referrer" style="width:62px;height:62px;border-radius:999px;object-fit:cover;border:2px solid #8B5CF6;background:#131926;" onerror="this.parentElement.style.display='none'" />
          <div>
            <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.06em;color:#94A3B8;">Foto de Perfil Coletada</div>
            <div style="font-size:0.95rem;font-weight:700;color:#F8FAFC;margin-top:2px;">${escapeHtml(perfil.nome || safeHandle)}</div>
            <div style="font-size:0.76rem;font-family:var(--font-mono);color:#A78BFA;">${escapeHtml(safeHandle)}</div>
          </div>
        </div>`
      : "";

    bodyHtml += renderDarkCard(
      `Identificação do Alvo & Travas de Cota (${platLabel})`,
      avatarBlock +
      renderFieldGrid([
        { label: "Plataforma", value: platLabel },
        { label: "Modo de Coleta", value: String(param.modo || "perfil").toUpperCase() },
        { label: "Alvo / @Handle", value: safeHandle, mono: true },
        { label: "Nome Exibido", value: perfil.nome || "-" },
        { label: "Seguidores", value: perfil.seguidores !== null && perfil.seguidores !== undefined ? Number(perfil.seguidores).toLocaleString("pt-BR") : "-" },
        { label: "Travas Aplicadas", value: `${param.maxPosts || 20} posts • ${param.maxCommentsPerPost ?? 15} coment./post` },
        { label: "Palavras-Chave", value: Array.isArray(param.palavrasChave) && param.palavrasChave.length ? param.palavrasChave.join(", ") : "Todas (sem filtro)" },
        { label: "Coletado em", value: rep.coletadoEm ? formatDate(rep.coletadoEm) : "-" },
        { label: "Biografia / Descrição", value: perfil.bio || "-", full: true },
      ]) +
      (rep.expiracaoMidiaAviso
        ? `<div style="margin-top:10px;padding:8px 12px;border-radius:6px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.35);color:#FCD34D;font-size:11px;">${escapeHtml(rep.expiracaoMidiaAviso)}</div>`
        : "")
    );

    if (kwHits.length > 0) {
      const kwRows = kwHits.slice(0, 40).map((hit) => ({
        origem: String(hit.origem || "").toUpperCase(),
        autor: hit.autor || "-",
        palavras_encontradas: Array.isArray(hit.palavrasEncontradas) ? hit.palavrasEncontradas.join(", ") : "-",
        trecho_identificado: String(hit.texto || "").slice(0, 220),
        data: hit.data ? formatDate(hit.data) : "-",
      }));
      bodyHtml += renderDarkCard(
        `Ocorrências de Palavras-Chave Específicas (${kwHits.length})`,
        renderDarkTable(kwRows, ["origem", "autor", "palavras_encontradas", "trecho_identificado", "data"])
      );
    }

    const emails = Array.isArray(ent.emails) ? ent.emails : [];
    const telefones = Array.isArray(ent.telefones) ? ent.telefones : [];
    const urlsExt = Array.isArray(ent.urlsExternas) ? ent.urlsExternas : [];
    const docs = Array.isArray(ent.documentos) ? ent.documentos : [];
    const topTags = (Array.isArray(intel.hashtagsFrequentes) ? intel.hashtagsFrequentes : []).map((h) => `${h.tag} (${h.count})`);
    const topMentions = (Array.isArray(intel.mencoesFrequentes) ? intel.mencoesFrequentes : []).map((m) => `${m.handle} (${m.count})`);
    const horarios = (Array.isArray(intel.horariosAtividade) ? intel.horariosAtividade : []).map((h) => `${h.faixa} (${h.count})`);

    bodyHtml += renderDarkCard(
      "Inteligência Extraída (Entidades, Contatos, Hashtags & Horários)",
      renderFieldGrid([
        { label: "E-mails Detectados", value: emails.length ? emails.join(", ") : "Nenhum identificado", full: true, mono: emails.length > 0 },
        { label: "Telefones / WhatsApp", value: telefones.length ? telefones.join(", ") : "Nenhum identificado", mono: telefones.length > 0 },
        { label: "Documentos (CPF/CNPJ)", value: docs.length ? docs.join(", ") : "Nenhum identificado", mono: docs.length > 0 },
        { label: "Hashtags Frequentes", value: topTags.length ? topTags.join(" • ") : "-", full: true },
        { label: "Menções Frequentes", value: topMentions.length ? topMentions.join(" • ") : "-", full: true },
        { label: "Janelas de Postagem", value: horarios.length ? horarios.join(" • ") : "-", full: true },
        { label: "URLs Externas", value: urlsExt.length ? urlsExt.slice(0, 8).join(" | ") : "-", full: true, mono: urlsExt.length > 0 },
      ])
    );

    if (topCommenters.length > 0) {
      const commenterRows = topCommenters.map((c) => ({
        usuario: `@${String(c.usuario || "").replace(/^@/, "")}`,
        comentarios: Number(c.totalComentarios || 0),
        posts_distintos: Number(c.postsDistintos || 0),
        curtidas_recebidas: Number(c.totalLikes || 0),
        match_palavra_chave: c.matchPalavraChave ? "SIM" : "Não",
      }));
      bodyHtml += renderDarkCard(
        `Ranking de Comentaristas / Círculo de Interação (${topCommenters.length})`,
        renderDarkTable(commenterRows, ["usuario", "comentarios", "posts_distintos", "curtidas_recebidas", "match_palavra_chave"])
      );
    }

    if (attachedImages.length > 0) {
      const evidenceGrid = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;">
        ${attachedImages
          .map((img, i) => {
            const safeSrc = resolveSocialReportImageSrc(img?.dataUrl || img?.src || "");
            if (!safeSrc) return "";
            const legenda = img?.legenda || img?.nome || `Evidência Visual #${i + 1}`;
            return `<figure style="margin:0;background:#0B101B;border:1px solid #1E2538;border-radius:8px;overflow:hidden;break-inside:avoid;page-break-inside:avoid;">
              <div style="background:#050811;display:flex;align-items:center;justify-content:center;max-height:290px;overflow:hidden;">
                <img src="${escapeHtml(safeSrc)}" alt="${escapeHtml(legenda)}" style="width:100%;max-height:290px;object-fit:contain;display:block;" />
              </div>
              <figcaption style="padding:8px 10px;font-size:11px;color:#CBD5E1;border-top:1px solid #1E2538;">
                <strong style="color:#A78BFA;">Evidência #${i + 1}:</strong> ${escapeHtml(legenda)}
              </figcaption>
            </figure>`;
          })
          .join("")}
      </div>`;
      bodyHtml += renderDarkCard(`Evidências Visuais Adicionadas pelo Analista (${attachedImages.length})`, evidenceGrid);
    }

    if (posts.length > 0) {
      const postsHtml = posts
        .map((p) => {
          const comments = Array.isArray(p.comentariosColetados) ? p.comentariosColetados : [];
          const postImgs = includePostImages
            ? (Array.isArray(p.midias) ? p.midias.filter((m) => m?.tipo === "image" && m?.url).slice(0, 3) : [])
            : [];

          const postImgsHtml = postImgs.length > 0
            ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
                ${postImgs
                  .map((m) => {
                    const resolved = resolveSocialReportImageSrc(m.url);
                    if (!resolved) return "";
                    return `<img src="${escapeHtml(resolved)}" alt="Mídia do Post" referrerpolicy="no-referrer" style="width:130px;height:130px;object-fit:cover;border-radius:6px;border:1px solid #26314A;background:#060911;" onerror="this.style.display='none'" />`;
                  })
                  .join("")}
              </div>`
            : "";

          const commentsHtml = comments.length
            ? `<div style="margin-top:8px;padding-top:8px;border-top:1px dashed rgba(148,163,184,0.2);">
                <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#94A3B8;margin-bottom:4px;">Comentários Coletados (${comments.length}):</div>
                ${comments
                  .map((c) => {
                    const isHiddenUser = c.usuarioOculto || c.usuario === "usuario_oculto_ig" || c.usuario === "usuario_anonimo";
                    const authorDisplay = isHiddenUser
                      ? "Usuário oculto (IG)"
                      : `@${String(c.usuario || "").replace(/^@/, "")}`;
                    return `<div style="font-size:11px;line-height:1.45;margin-bottom:4px;color:#E2E8F0;">
                      <strong style="color:${isHiddenUser ? "#94A3B8" : "#A78BFA"};">${escapeHtml(authorDisplay)}</strong>: ${escapeHtml(c.texto || "")}
                      <span style="color:#64748B;font-size:10px;"> (${Number(c.likes || 0)} likes${c.matchPalavrasChave?.length ? ` • Match: ${escapeHtml(c.matchPalavrasChave.join(", "))}` : ""})</span>
                    </div>`;
                  })
                  .join("")}
              </div>`
            : `<div style="margin-top:6px;font-size:11px;color:#64748B;">Sem comentários coletados para este post.</div>`;

          return `<div style="background:#0B101B;border:1px solid rgba(148,163,184,0.18);border-radius:8px;padding:12px;margin-bottom:10px;break-inside:avoid;page-break-inside:avoid;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
              <span style="font-size:11px;font-weight:700;color:#F8FAFC;">#${escapeHtml(String(p.indice || "-"))} • ${escapeHtml(p.tipo || "Post")} ${p.autor ? `(@${escapeHtml(p.autor)})` : ""}</span>
              <span style="font-size:10px;font-family:var(--font-mono);color:#94A3B8;">${escapeHtml(p.dataPublicacao ? formatDate(p.dataPublicacao) : "-")} • ❤ ${Number(p.likes || 0).toLocaleString("pt-BR")} • 💬 ${Number(p.numComentariosDeclarado || 0).toLocaleString("pt-BR")}</span>
            </div>
            <div style="font-size:12px;color:#E2E8F0;line-height:1.5;white-space:pre-wrap;word-break:break-word;">${escapeHtml(p.texto || "(Post sem legenda textual)")}</div>
            ${postImgsHtml}
            ${p.url ? `<div style="margin-top:6px;font-size:10px;font-family:var(--font-mono);color:#60A5FA;word-break:break-all;">${escapeHtml(p.url)}</div>` : ""}
            ${commentsHtml}
          </div>`;
        })
        .join("");

      bodyHtml += renderDarkCard(`Timeline de Posts & Comentários (${posts.length})`, postsHtml);
    }

    return buildReportShell({
      title: `DOSSIÊ SOCIAL OSINT • ${platLabel.toUpperCase()}`,
      moduleLabel: `REDES SOCIAIS (${platLabel})`,
      termo: safeHandle,
      fonteLabel: rep.provedor || "Bright Data Web Scraper API v3",
      systemBadge,
      kpis,
      bodyHtml,
    });
  }

  function renderServidoresFederaisReport({ termo = "", resultado = {} } = {}) {
    const res = resultado || {};
    const consulta = res.consulta || {};
    const resumo = res.resumo || {};
    const perfil = res.perfilPessoa || {};
    const servidores = Array.isArray(res.servidores) ? res.servidores : [];
    const viagens = res.viagens?.viagens || [];
    const flags = Array.isArray(perfil.flagsAtivas) ? perfil.flagsAtivas : [];

    const alvo =
      termo ||
      consulta.nome ||
      consulta.cpfFormatado ||
      (consulta.orgaoServidorLotacao ? `Órgão SIAPE ${consulta.orgaoServidorLotacao}` : "Consulta Federal");

    const kpis = [
      { label: "Vínculos Encontrados", value: resumo.totalServidores || 0, color: "#38BDF8" },
      { label: "Educação / Magistério", value: resumo.totalEducacaoFederal || 0, color: "#A78BFA" },
      { label: "Maior Bruto Mensal", value: formatCurrency(resumo.maiorBrutoEncontrado || 0), color: "#FBBF24", small: true },
      { label: "Maior Líquido Mensal", value: formatCurrency(resumo.maiorLiquidoEncontrado || 0), color: "#34D399", small: true },
      { label: "Diárias / Viagens", value: resumo.totalViagens || 0, color: "#F472B6" },
    ];

    let bodyHtml = renderDarkCard(
      "Parâmetros & Escopo da Varredura (CGU SIAPE)",
      renderFieldGrid([
        { label: "Alvo Consultado", value: alvo, mono: true, color: "#38BDF8" },
        { label: "CPF Informado", value: consulta.cpfFormatado || "Busca Nominal / Órgão", mono: true },
        { label: "NIS (Síntese CGU)", value: resumo.nisVinculadoCgu || "Não retornado", mono: true },
        { label: "Competência Folha", value: consulta.competenciaRetornada || consulta.mesAnoSolicitado || "-", mono: true },
        { label: "Escopo Legal", value: res.escopo || "Poder Executivo Federal (SIAPE)", spanFull: true },
      ]),
      "#38BDF8"
    );

    if (flags.length > 0) {
      const flagsRows = flags.map((f) => ({
        Indicador_CGU: f.label,
        Categoria: String(f.categoria || "-").toUpperCase(),
        Status: "SINALIZADO NO PORTAL DA TRANSPARÊNCIA",
      }));
      bodyHtml += renderDarkCard("Indicadores Oficiais /pessoa-fisica (CGU)", renderDarkTable(flagsRows), "#A78BFA");
    }

    if (servidores.length > 0) {
      const srvRows = servidores.map((s) => {
        const rem = s.remuneracoes?.[0];
        const bruto = rem
          ? rem.remuneracaoBasicaBruta + rem.gratificacaoNatalina + rem.ferias + rem.outrasRemuneracoesEventuais
          : null;
        return {
          Nome: s.nome,
          CPF: s.cpfFormatado || "-",
          Situacao: s.situacao,
          Cargo_Principal: s.cargoPrincipal,
          Funcao_Comissionada: s.funcaoComissionada || "-",
          Orgao_Lotacao: s.orgaoLotacao?.nome || "-",
          UF: s.ufExercicio || "-",
          Educacao_Federal: s.isEducacaoFederal ? "SIM (Magistério / UF / IF)" : "Não",
          Competencia: rem?.mesAnoLabel || "-",
          Bruto: bruto !== null ? formatCurrency(bruto) : "-",
          Liquido: rem ? formatCurrency(rem.valorLiquido) : "-",
        };
      });
      bodyHtml += renderDarkCard(
        `Vínculos Funcionais & Remuneração (${servidores.length})`,
        renderDarkTable(srvRows),
        "#34D399"
      );

      for (const s of servidores.slice(0, 6)) {
        const rem = s.remuneracoes?.[0];
        const subBlocks = [];

        if (Array.isArray(s.fichas) && s.fichas.length > 0) {
          const fichaRows = s.fichas.map((f) => ({
            Tipo_Ficha: f.tipoFicha,
            Cargo_ou_Funcao: f.cargoOuFuncao,
            Classe_Nivel: f.classeNivel || "-",
            Orgao_Lotacao: f.orgaoLotacao || "-",
            UORG: f.uorg || "-",
            Regime_Jornada: [f.regimeJuridico, f.jornadaTrabalho].filter(Boolean).join(" / ") || "-",
            Ingresso_Orgao: f.dataIngressoOrgao || "-",
          }));
          subBlocks.push(renderDarkTable(fichaRows));
        }

        if (rem) {
          subBlocks.push(
            `<div style="margin-top:12px;">${renderFieldGrid([
              { label: "Mês/Ano Folha", value: rem.mesAnoLabel, mono: true, color: "#A78BFA" },
              { label: "Remuneração Básica Bruta", value: formatCurrency(rem.remuneracaoBasicaBruta), color: "#FBBF24", mono: true },
              { label: "Gratificação Natalina", value: formatCurrency(rem.gratificacaoNatalina), mono: true },
              { label: "Férias", value: formatCurrency(rem.ferias), mono: true },
              { label: "Outras Eventuais", value: formatCurrency(rem.outrasRemuneracoesEventuais), mono: true },
              { label: "IRRF Retido", value: formatCurrency(rem.impostoRetidoNaFonte), color: "#F87171", mono: true },
              { label: "Previdência Oficial", value: formatCurrency(rem.previdenciaOficial), color: "#F87171", mono: true },
              { label: "Verbas Indenizatórias", value: formatCurrency(rem.verbasIndenizatorias), color: "#38BDF8", mono: true },
              { label: "Líquido Após Deduções", value: formatCurrency(rem.valorLiquido), color: "#34D399", mono: true },
            ], "165px")}</div>`
          );

          if (Array.isArray(rem.rubricas) && rem.rubricas.length > 0) {
            const rubRows = rem.rubricas.slice(0, 20).map((rb) => ({
              Codigo: rb.codigo || "-",
              Rubrica: rb.descricao,
              Valor: formatCurrency(rb.valor),
            }));
            subBlocks.push(`<div style="margin-top:12px;">${renderDarkTable(rubRows)}</div>`);
          }
        }

        if (subBlocks.length > 0) {
          bodyHtml += renderDarkCard(
            `Detalhamento SIAPE • ${s.nome}`,
            subBlocks.join(""),
            s.isEducacaoFederal ? "#A78BFA" : "#38BDF8"
          );
        }
      }
    } else {
      bodyHtml += renderDarkCard(
        "Resultado da Busca SIAPE",
        `<div style="color:#94A3B8;font-size:0.86rem;">Nenhum vínculo no Poder Executivo Federal retornado para os filtros informados. ${escapeHtml(res.notaEstadualMunicipal || "")}</div>`,
        "#F59E0B"
      );
    }

    if (viagens.length > 0) {
      const viagensRows = viagens.map((v) => ({
        PCDP: v.pcdp || "-",
        Orgao: v.orgao || "-",
        Inicio: v.inicio || "-",
        Fim: v.fim || "-",
        Diarias: formatCurrency(v.diarias),
        Passagens: formatCurrency(v.passagens),
        Total: formatCurrency(v.totalViagem),
        Motivo: String(v.motivo || "-").slice(0, 140),
      }));
      bodyHtml += renderDarkCard(`Viagens a Serviço & Diárias (${viagens.length})`, renderDarkTable(viagensRows), "#F472B6");
    }

    return buildReportShell({
      systemBadge: "CGU SIAPE FEDERAL",
      title: "DOSSIÊ DE SERVIDORES PÚBLICOS FEDERAIS",
      moduleLabel: "SERVIDORES FEDERAIS",
      termo: alvo,
      fonteLabel: "Portal da Transparência / CGU",
      protocolPrefix: "SRV",
      kpis,
      bodyHtml,
    });
  }

  function renderBeneficiosSociaisReport({ termo = "", resultado = {} } = {}) {
    const res = resultado || {};
    const consulta = res.consulta || {};
    const resumo = res.resumo || {};
    const perfil = res.perfilPessoa || {};
    const programas = Array.isArray(res.programas) ? res.programas : [];
    const todasParcelas = Array.isArray(res.todasParcelas) ? res.todasParcelas : [];
    const flags = Array.isArray(perfil.flagsAtivas) ? perfil.flagsAtivas : [];

    const alvo = termo || consulta.nome || consulta.cpfFormatado || consulta.nis || "Consulta Social";

    const kpis = [
      { label: "Benefícios Identificados", value: resumo.totalProgramasIdentificados || 0, color: resumo.recebeAuxilioOuHistorico ? "#10B981" : "#94A3B8" },
      { label: "Parcelas Listadas", value: resumo.totalParcelasPagina || 0, color: "#38BDF8" },
      { label: "Total Somado (Página)", value: formatCurrency(resumo.valorTotalParcelasPagina || 0), color: "#34D399", small: true },
      { label: "Municípios", value: resumo.municipios?.length ? resumo.municipios.join(", ") : "-", color: "#A78BFA", small: true },
      { label: "Alerta Servidor Federal", value: resumo.vinculoServidorFederalAlerta ? "SIM" : "Não", color: resumo.vinculoServidorFederalAlerta ? "#F87171" : "#64748B" },
    ];

    let bodyHtml = renderDarkCard(
      "Identificação do Favorecido & Síntese CGU",
      renderFieldGrid([
        { label: "Nome Identificado", value: consulta.nome || "Não retornado na consulta", color: "#F8FAFC" },
        { label: "CPF", value: consulta.cpfFormatado || "Não informado", mono: true, color: "#34D399" },
        { label: "NIS (Resolvido CGU)", value: consulta.nis || "Não vinculado", mono: true, color: "#38BDF8" },
        { label: "Auxílio Reconstrução (Flag)", value: resumo.auxilioReconstrucaoFlag ? "SIM (Sinalizado CGU)" : "Não sinalizado", color: resumo.auxilioReconstrucaoFlag ? "#FBBF24" : "#94A3B8" },
        { label: "Varredura Executada", value: consulta.varreduraCompleta ? "Completa (8 rotas sociais CGU)" : "Otimizada (Flags /pessoa-fisica)", spanFull: true },
      ]),
      "#10B981"
    );

    if (flags.length > 0) {
      const flagRows = flags.map((f) => ({
        Programa_ou_Indicador: f.label,
        Categoria: String(f.categoria || "-").toUpperCase(),
        Status_CGU: "POSITIVO",
      }));
      bodyHtml += renderDarkCard("Sinalizadores Oficiais /pessoa-fisica (CGU)", renderDarkTable(flagRows), "#A78BFA");
    }

    const resumoProgramasRows = programas.map((p) => ({
      Programa: p.nome,
      Flag_Perfil_CGU: p.flagAtivaPerfilCgu === null ? "-" : p.flagAtivaPerfilCgu ? "SIM" : "Não",
      Status_Consulta: p.status === "encontrado" ? "ENCONTRADO" : p.status,
      Parcelas_Pagina: p.totalParcelas,
      Valor_Pagina: formatCurrency(p.valorTotalPagina),
      Observacao: p.mensagem || "-",
    }));
    bodyHtml += renderDarkCard("Matriz de Programas Sociais Consultados", renderDarkTable(resumoProgramasRows), "#38BDF8");

    if (todasParcelas.length > 0) {
      const parcRows = todasParcelas.slice(0, 120).map((it) => ({
        Programa: it.programa,
        Competencia: it.competencia,
        Referencia: it.referencia,
        Data_Saque: it.dataSaque || "-",
        Valor: formatCurrency(it.valor),
        Situacao: it.situacao,
        Municipio: it.municipio,
        Detalhes: it.detalhe || it.representanteLegal || "-",
      }));
      bodyHtml += renderDarkCard(`Detalhamento de Parcelas & Saques (${todasParcelas.length})`, renderDarkTable(parcRows), "#34D399");
    }

    return buildReportShell({
      systemBadge: "CGU BENEFÍCIOS SOCIAIS",
      title: "DOSSIÊ DE BENEFÍCIOS & AUXÍLIOS SOCIAIS",
      moduleLabel: "BENEFÍCIOS & AUXÍLIOS",
      termo: alvo,
      fonteLabel: "Portal da Transparência / CGU",
      protocolPrefix: "BEN",
      kpis,
      bodyHtml,
    });
  }

  function renderBitcoinReport({ termo = "", resultado = {} } = {}) {
    const res = resultado || {};
    const consulta = res.consulta || {};
    const resumo = res.resumo || {};
    const onChain = res.onChain || {};
    const surfaceWeb = res.surfaceWeb || {};
    const darkWeb = res.darkWeb || {};

    const alvo = termo || consulta.address || "Carteira Bitcoin";
    const cotacao = onChain.cotacaoBtc || {};

    const kpis = [
      { label: "Saldo Atual (BTC)", value: `${Number(resumo.saldoBtc || 0).toFixed(8)} BTC`, color: "#FBBF24" },
      { label: "Valor Estimado (BRL)", value: formatCurrency(resumo.saldoBrl || 0), color: "#34D399", small: true },
      { label: "Total Recebido (BTC)", value: `${Number(resumo.totalRecebidoBtc || 0).toFixed(8)} BTC`, color: "#10B981", small: true },
      { label: "Transações On-Chain", value: resumo.totalTransacoes || 0, color: "#38BDF8" },
      { label: "Menções Surface Web", value: resumo.mencoesSurfaceWeb || 0, color: "#60A5FA" },
      { label: "Menções Dark Web (.onion)", value: resumo.mencoesDarkWeb || 0, color: "#A78BFA" },
    ];

    let bodyHtml = renderDarkCard(
      "Inteligência On-Chain da Carteira",
      renderFieldGrid([
        { label: "Endereço Bitcoin", value: consulta.address || "-", mono: true, color: "#FBBF24", spanFull: true },
        { label: "Formato / Tipo de Endereço", value: consulta.formato || "Bitcoin", mono: true, color: "#38BDF8" },
        { label: "Status Operacional", value: resumo.statusCarteira || "Identificada", color: resumo.saldoBtc > 0 ? "#34D399" : "#94A3B8" },
        { label: "Saldo em Satoshis", value: `${Number(resumo.saldoSatoshis || 0).toLocaleString("pt-BR")} sats`, mono: true },
        { label: "Valor Estimado (USD)", value: `$${Number(resumo.saldoUsd || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: "#34D399" },
        { label: "Cotação Base BTC/BRL", value: formatCurrency(cotacao.brl || 0), small: true },
        { label: "Cotação Base BTC/USD", value: `$${Number(cotacao.usd || 0).toLocaleString("en-US")}`, small: true },
        { label: "Alerta de Risco / Abuso", value: resumo.alertaAbuso ? "SIM (Palavras-chave de ransomware/scam detectadas)" : "Nenhum alerta crítico", color: resumo.alertaAbuso ? "#EF4444" : "#10B981" },
        { label: "Tempo de Execução Paralela", value: `${res.tempoExecucaoMs || 0}ms`, mono: true, small: true },
      ]),
      "#F59E0B"
    );

    const txs = Array.isArray(onChain.ultimasTransacoes) ? onChain.ultimasTransacoes : [];
    if (txs.length > 0) {
      const txRows = txs.slice(0, 15).map((t) => ({
        Hash_Transacao: t.hash ? `${t.hash.slice(0, 14)}...${t.hash.slice(-10)}` : "-",
        Tipo: t.tipo,
        Valor_BTC: `${Number(t.valorBtc || 0).toFixed(8)} BTC`,
        Taxa_BTC: `${Number(t.taxaBtc || 0).toFixed(8)} BTC`,
        Data_Confirmacao: t.data ? formatDate(t.data) : "-",
      }));
      bodyHtml += renderDarkCard("Últimas Movimentações On-Chain (Blockchain API)", renderDarkTable(txRows), "#38BDF8");
    }

    const surfaceHits = Array.isArray(surfaceWeb.resultados) ? surfaceWeb.resultados : [];
    if (surfaceHits.length > 0) {
      const surfaceRows = surfaceHits.slice(0, 15).map((h) => ({
        Titulo: h.titulo,
        Categoria: h.categoria,
        URL: h.url,
        Snippet: h.snippet ? (h.snippet.length > 90 ? `${h.snippet.slice(0, 90)}...` : h.snippet) : "-",
      }));
      bodyHtml += renderDarkCard(`Menções na Surface Web (Google Search — ${surfaceHits.length} ocorrências)`, renderDarkTable(surfaceRows), "#60A5FA");
    }

    const darkHits = Array.isArray(darkWeb.resultados) ? darkWeb.resultados : [];
    if (darkHits.length > 0) {
      const darkRows = darkHits.slice(0, 15).map((d) => ({
        Titulo: d.titulo,
        Endereco_Onion: d.urlOnion,
        Espelho_Clearnet: d.urlClearnet || "-",
        Snippet: d.snippet ? (d.snippet.length > 90 ? `${d.snippet.slice(0, 90)}...` : d.snippet) : "-",
        Ultima_Indexacao: d.lastSeen || "-",
      }));
      bodyHtml += renderDarkCard(`Ocorrências na Dark Web (Tor .onion via Ahmia — ${darkHits.length} ocorrências)`, renderDarkTable(darkRows), "#A78BFA");
    }

    return buildReportShell({
      tipo: "investigacao_bitcoin",
      tituloModulo: "DOSSIÊ FORENSE • CARTEIRA BITCOIN (BTC)",
      subtitulo: "Rastreamento On-Chain, Surface Web (Google) e Varredura Tor (.onion via Ahmia)",
      termo: alvo,
      fonteLabel: "Blockchain API &bull; Google SERP &bull; Ahmia Tor",
      protocolPrefix: "BTC",
      kpis,
      bodyHtml,
    });
  }

  function buildStandaloneHtmlDocument(innerHtml, titleText) {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(titleText)}</title>
  <style>
    :root { --font-mono: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { margin: 0; padding: 24px; background: #040609; color: #F1F5F9; font-family: 'Inter', system-ui, -apple-system, sans-serif; }
    .dark-report-sheet { max-width: 1080px; margin: 0 auto; }
    @media print {
      @page { size: A4; margin: 10mm; }
      body { background: #080B11 !important; padding: 0 !important; }
      .dark-report-sheet { border: none !important; max-width: 100% !important; }
      .dark-report-card { break-inside: avoid; page-break-inside: avoid; }
    }
  </style>
</head>
<body>${innerHtml}</body>
</html>`;
  }

  function downloadHtml({ innerHtml, titlePrefix = "dossie-osint", termo = "" }) {
    if (!innerHtml) return false;
    const safeTerm = String(termo || "consulta").replace(/[^a-zA-Z0-9_-]/g, "_");
    const fullDoc = buildStandaloneHtmlDocument(innerHtml, `${titlePrefix} — ${termo}`);
    const blob = new Blob([fullDoc], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${titlePrefix}_${safeTerm}_${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  }

  function exportPdf({ innerHtml, titleText = "Dossiê OSINT" }) {
    if (!innerHtml) return false;
    const printFrame = document.createElement("iframe");
    printFrame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow?.document || printFrame.contentDocument;
    if (!frameDoc) {
      document.body.removeChild(printFrame);
      return false;
    }

    frameDoc.open();
    frameDoc.write(buildStandaloneHtmlDocument(innerHtml, titleText));
    frameDoc.close();

    setTimeout(() => {
      try {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
      } catch {
        window.print();
      } finally {
        setTimeout(() => {
          if (printFrame.parentNode) printFrame.parentNode.removeChild(printFrame);
        }, 1200);
      }
    }, 300);
    return true;
  }

  root.OsintDarkReport = {
    escapeHtml,
    digitsOnly,
    pick,
    formatCpf,
    formatCnpj,
    formatDocument,
    formatCep,
    formatPhone,
    formatDate,
    formatCurrency,
    resolveImageSrc,
    unwrapPayload,
    formatAddressLine,
    extractPhoneDigits,
    buildReportShell,
    renderDarkCard,
    renderFieldGrid,
    renderDarkTable,
    renderGenericBody,
    renderGenericReport,
    renderPhotoReport,
    renderPhoneCarrierReport,
    renderCepReport,
    renderNeighborsReport,
    renderDocumentReport,
    renderVehicleReport,
    renderCompanyReport,
    renderNameHomonymsReport,
    renderPixFinancialReport,
    renderHealthReport,
    renderCivilRegistryReport,
    renderZeroyCpfDossierReport,
    renderComplianceSection,
    renderFinanceiroBrReport,
    renderBrightDataSocialReport,
    renderServidoresFederaisReport,
    renderBeneficiosSociaisReport,
    renderBitcoinReport,
    generateZeroyReport,
    generateSha256,
    detectForensicAnomalies,
    renderSmartFlagsSection,
    renderChainOfCustodySection,
    downloadHtml,
    exportPdf,
  };
})(typeof window !== "undefined" ? window : globalThis);
