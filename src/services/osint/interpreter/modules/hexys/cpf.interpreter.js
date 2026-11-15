/**
 * ==============================================================================
 * BACKEND INTERPRETER - HEXYS CPF / INDIVIDUAL DOSSIER (CPF.INTERPRETER.JS)
 * Standardizes, normalizes, and enriches individual cadastral payloads from Hexys API.
 * The backend assumes full interpretation responsibility so the frontend receives
 * a clean, predictable DTO contract with zero nested guesswork.
 *
 * Clean Code standards with English identifiers and strict null-safety.
 * ==============================================================================
 */

/**
 * Formats a clean 11-digit CPF string into 000.000.000-00
 * @param {string|number} val
 * @returns {string}
 */
export function formatCpf(val) {
  if (!val) return "Não informado";
  const clean = String(val).replace(/\D/g, "");
  if (clean.length === 11) {
    return clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  return String(val);
}

/**
 * Formats a clean 14-digit CNPJ string into 00.000.000/0000-00
 * @param {string|number} val
 * @returns {string}
 */
export function formatCnpj(val) {
  if (!val) return "Não informado";
  const clean = String(val).replace(/\D/g, "");
  if (clean.length === 14) {
    return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }
  return String(val);
}

/**
 * Formats phone string into (00) 00000-0000 or (00) 0000-0000
 * @param {string|number} val
 * @returns {string}
 */
export function formatPhone(val) {
  if (!val) return "Não informado";
  let clean = String(val).replace(/\D/g, "");
  if (clean.startsWith("55") && clean.length > 11) {
    clean = clean.slice(2);
  }
  if (clean.length === 11) {
    return clean.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  }
  if (clean.length === 10) {
    return clean.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  }
  return String(val);
}

/**
 * Formats 8-digit CEP into 00000-000
 * @param {string|number} val
 * @returns {string}
 */
export function formatCep(val) {
  if (!val) return "N/I";
  const clean = String(val).replace(/\D/g, "");
  if (clean.length === 8) {
    return clean.replace(/^(\d{5})(\d{3})$/, "$1-$2");
  }
  return String(val);
}

/**
 * Formats currency number into BRL string (R$ 1.234,56)
 * @param {number|string} val
 * @returns {string}
 */
export function formatCurrency(val) {
  if (val === null || val === undefined || val === "") return "N/A";
  const num = typeof val === "number" ? val : parseFloat(String(val).replace(/\./g, "").replace(",", "."));
  if (isNaN(num)) return String(val);
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Calculates age and zodiac sign from birth date string
 * @param {string} dateStr
 * @returns {{ age: number|null, birthFormatted: string, sign: string|null }}
 */
export function parseBirthDate(dateStr) {
  if (!dateStr) return { age: null, birthFormatted: "Não informada", sign: null };

  let day = null;
  let month = null;
  let year = null;

  const raw = String(dateStr).trim();

  // Case DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}/.test(raw)) {
    const parts = raw.slice(0, 10).split("/");
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    year = parseInt(parts[2], 10);
  }
  // Case YYYY-MM-DD
  else if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const parts = raw.slice(0, 10).split("-");
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    day = parseInt(parts[2], 10);
  }

  if (!day || !month || !year || isNaN(day) || isNaN(month) || isNaN(year)) {
    return { age: null, birthFormatted: raw, sign: null };
  }

  const today = new Date();
  let age = today.getFullYear() - year;
  const m = today.getMonth() + 1 - month;
  if (m < 0 || (m === 0 && today.getDate() < day)) {
    age--;
  }

  const birthFormatted = `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;

  // Zodiac Sign
  const signs = [
    { sign: "Capricórnio", endDay: 19 },
    { sign: "Aquário", endDay: 18 },
    { sign: "Peixes", endDay: 20 },
    { sign: "Áries", endDay: 19 },
    { sign: "Touro", endDay: 20 },
    { sign: "Gêmeos", endDay: 20 },
    { sign: "Câncer", endDay: 22 },
    { sign: "Leão", endDay: 22 },
    { sign: "Virgem", endDay: 22 },
    { sign: "Libra", endDay: 22 },
    { sign: "Escorpião", endDay: 21 },
    { sign: "Sagitário", endDay: 21 },
    { sign: "Capricórnio", endDay: 31 },
  ];
  const sign = day <= signs[month - 1].endDay ? signs[month - 1].sign : signs[month].sign;

  return { age: age >= 0 ? age : null, birthFormatted, sign };
}

/**
 * Normalizes Score object ensuring it is never [object Object]
 * @param {any} scoreRaw
 * @returns {Object}
 */
export function normalizeScore(scoreRaw) {
  if (!scoreRaw && scoreRaw !== 0) {
    return {
      valor: "N/A",
      faixa: "N/A",
      csb8: null,
      csba: null,
      display: "N/A",
    };
  }

  if (typeof scoreRaw === "number" || typeof scoreRaw === "string") {
    const num = parseInt(scoreRaw, 10);
    const val = isNaN(num) ? String(scoreRaw) : num;
    const faixa = typeof num === "number" ? (num >= 800 ? "EXCELENTE" : num >= 600 ? "BOM" : num >= 400 ? "MÉDIO" : "BAIXO") : "REGULAR";
    return {
      valor: val,
      faixa,
      csb8: num,
      csba: null,
      display: `${val} (${faixa})`,
    };
  }

  if (typeof scoreRaw === "object") {
    let val = scoreRaw.value || scoreRaw.valor || scoreRaw.csb8 || scoreRaw.csba || scoreRaw.score || null;
    if (val === null) {
      val = "N/A";
    }
    const faixa = scoreRaw.range || scoreRaw.faixa || scoreRaw.csb8_range || scoreRaw.csba_range || (typeof val === "number" ? (val >= 800 ? "EXCELENTE" : val >= 600 ? "BOM" : "MÉDIO") : "REGULAR");
    const csb8 = scoreRaw.csb8 ? `${scoreRaw.csb8}${scoreRaw.csb8_range ? ` (${scoreRaw.csb8_range})` : ""}` : null;
    const csba = scoreRaw.csba ? `${scoreRaw.csba}${scoreRaw.csba_range ? ` (${scoreRaw.csba_range})` : ""}` : null;
    const display = val !== "N/A" ? `${val}${faixa !== "N/A" ? ` (${faixa})` : ""}` : "N/A";

    return {
      valor: val,
      faixa: String(faixa).toUpperCase(),
      csb8: scoreRaw.csb8 ?? null,
      csb8_faixa: scoreRaw.csb8_range ?? null,
      csba: scoreRaw.csba ?? null,
      csba_faixa: scoreRaw.csba_range ?? null,
      csb8_display: csb8,
      csba_display: csba,
      display,
    };
  }

  return {
    valor: "N/A",
    faixa: "N/A",
    csb8: null,
    csba: null,
    display: "N/A",
  };
}

/**
 * Normalizes any person record (CPF, Phone Titular, Homonym, Parente, etc.)
 * into a complete, clean, frontend-ready standard DTO.
 * @param {Object} rawData
 * @returns {Object} Standardized Person DTO
 */
export function normalizePersonRecord(rawData) {
  if (!rawData || typeof rawData !== "object") return {};

  const p = { ...rawData };

  // 1. CPF
  const rawCpf = String(p.cpf || p.cpf_masked || p.documento || "").replace(/\D/g, "");
  const formattedCpf = formatCpf(rawCpf);

  // 2. Name
  const nomeCompleto = String(p.name || p.nome || p.nome_completo || "Nome não informado").trim().toUpperCase();
  const nameParts = nomeCompleto.split(/\s+/);
  const primeiroNome = p.first_name || (nameParts[0] || "");
  const ultimoNome = p.last_name || (nameParts.length > 1 ? nameParts[nameParts.length - 1] : "");

  // 3. Birth, Age & Zodiac
  const rawBirth = p.birth_date || p.dataNascimento || p.nascimento || p.data_nascimento || null;
  const { age, birthFormatted, sign } = parseBirthDate(rawBirth);

  // 4. Parents & Family
  const nomeMae = String(p.mother_name || p.nomeMae || p.nome_mae || "Não informada").trim().toUpperCase();
  const nomePai = String(p.father_name || p.nomePai || p.nome_pai || "Não informado").trim().toUpperCase();

  // 5. Gender
  let sexo = String(p.gender || p.sexo || "").trim().toUpperCase();
  if (sexo === "M" || sexo.startsWith("MASC")) sexo = "MASCULINO";
  else if (sexo === "F" || sexo.startsWith("FEM")) sexo = "FEMININO";
  else sexo = "NÃO INFORMADO";

  // 6. Civil & Revenue Status
  const situacaoReceita = String(p.federal_status || p.situacao_receita || p.situacaoCadastral || p.status || "REGULAR").toUpperCase();
  const deathFlag = String(p.death_flag || p.obito || p.falecido || "");
  const isFalecido = deathFlag === "1" || deathFlag === "true" || p.falecido === true || situacaoReceita.includes("FALECIDO");
  const dataObito = p.death_date || p.data_obito || p.dataObito || null;

  // 7. Income, Purchasing Power & Occupation
  const rawIncome = p.income ?? p.renda ?? p.renda_estimada ?? p.renda_estimativas?.presumida?.valor ?? null;
  const rendaEstimada = rawIncome !== null && rawIncome !== undefined ? (typeof rawIncome === "number" ? rawIncome : parseFloat(String(rawIncome).replace(/\./g, "").replace(",", "."))) : null;
  const rendaFormatada = formatCurrency(rendaEstimada);
  const profissao = String(p.occupation || p.profissao || "Não informada").trim();
  const cbo = p.cbo || p.occupation_code || null;

  // 8. Credit Score (Object safe, never [object Object])
  const scoreObj = normalizeScore(p.score || p.score_credito || p.score_cadastral);

  // 9. Photo & Biometrics URL
  const fotoUrl =
    p.foto_url ||
    p.foto_google ||
    p.fotoBase64 ||
    p.base64 ||
    p.foto ||
    (Array.isArray(p.fotos_disponiveis) && p.fotos_disponiveis[0]?.url) ||
    (Array.isArray(p.contas_google) && p.contas_google[0]?.photoUrl) ||
    null;

  // 10. Documents
  const rg = p.rg ? String(p.rg).trim() : null;
  const rgEmissor = p.rg_issuer || p.rg_orgao_emissor || p.rg_emissor || null;
  const tituloEleitor = p.voter_id || p.titulo_eleitor || p.titulo || null;
  const cnh = p.cnh && typeof p.cnh === "object" ? p.cnh : (p.numero_cnh ? { numero: p.numero_cnh, categoria: p.categoria_cnh, validade: p.validade_cnh } : null);

  // 11. Addresses (Normalized & Deduplicated)
  const rawAddressesList = Array.isArray(p.all_addresses)
    ? p.all_addresses
    : Array.isArray(p.enderecos)
      ? p.enderecos
      : Array.isArray(p.addresses)
        ? p.addresses
        : p.address
          ? [p.address]
          : [];

  const deliveryList = Array.isArray(p.delivery_addresses) ? p.delivery_addresses : [];
  const combinedRawAddrs = [...rawAddressesList, ...deliveryList];

  const addressesSeen = new Set();
  const enderecosNormalizados = [];

  combinedRawAddrs.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const street = item.street || item.logradouro || "";
    const number = item.number || item.numero || "S/N";
    const comp = item.complement || item.complemento || "";
    const neigh = item.neighborhood || item.bairro || "";
    const city = item.city || item.cidade || p.city || p.cidade || "";
    const state = item.state || item.uf || p.state || p.uf || "";
    const rawZip = String(item.zip_code || item.cep || "").replace(/\D/g, "");
    const formattedZip = formatCep(rawZip);

    const dedupKey = `${street.toLowerCase().trim()}|${number.trim()}|${rawZip}`;
    if (addressesSeen.has(dedupKey) && dedupKey !== "||") return;
    addressesSeen.add(dedupKey);

    const fullParts = [
      street ? `${street}, ${number}` : "",
      comp,
      neigh,
      city ? `${city} - ${state}` : state,
      formattedZip && formattedZip !== "N/I" ? `CEP ${formattedZip}` : "",
    ].filter(Boolean);

    enderecosNormalizados.push({
      tipo: item.type || item.tipo || (index === 0 ? "PRINCIPAL" : "HISTÓRICO"),
      logradouro: street,
      numero: number,
      complemento: comp || null,
      bairro: neigh,
      cidade: city,
      uf: state,
      cep: rawZip,
      cep_formatado: formattedZip,
      endereco_completo: fullParts.join(" • ") || "Endereço não informado",
      source: item.source || (index === 0 ? "RECEITA_FEDERAL" : "SECUNDÁRIO"),
      principal: index === 0,
    });
  });

  const enderecoPrincipal = enderecosNormalizados[0] || {
    tipo: "NÃO CADASTRADO",
    logradouro: "",
    numero: "",
    complemento: null,
    bairro: "",
    cidade: p.city || p.cidade || "",
    uf: p.state || p.uf || "",
    cep: "",
    cep_formatado: "N/I",
    endereco_completo: p.city && p.state ? `${p.city} - ${p.state}` : "Endereço não cadastrado",
    principal: true,
  };

  // 12. Phones (Normalized & Deduplicated)
  const rawPhonesList = Array.isArray(p.telefones)
    ? p.telefones
    : Array.isArray(p.phones)
      ? p.phones
      : p.phone
        ? [p.phone]
        : [];

  const phonesSeen = new Set();
  const telefonesNormalizados = [];

  rawPhonesList.forEach((ph) => {
    let cleanPh = String(typeof ph === "object" ? ph.number || ph.telefone || ph.numero : ph).replace(/\D/g, "");
    if (cleanPh.startsWith("55") && cleanPh.length > 11) cleanPh = cleanPh.slice(2);
    if (!cleanPh || phonesSeen.has(cleanPh)) return;
    phonesSeen.add(cleanPh);

    const ddd = cleanPh.length >= 10 ? cleanPh.slice(0, 2) : "";
    const isMobile = cleanPh.length === 11 && cleanPh[2] === "9";

    telefonesNormalizados.push({
      numero: cleanPh,
      ddd,
      formatado: formatPhone(cleanPh),
      tipo: isMobile ? "MÓVEL / CELULAR" : "FIXO",
      operadora: typeof ph === "object" ? ph.operator || ph.operadora || null : null,
      whatsapp: isMobile,
    });
  });

  // 13. Emails (Normalized & Deduplicated)
  const emailsSet = new Set();
  if (p.email) emailsSet.add(String(p.email).trim().toLowerCase());
  const extraEmails = Array.isArray(p.additional_emails) ? p.additional_emails : Array.isArray(p.emails) ? p.emails : [];
  extraEmails.forEach((em) => {
    const emailStr = String(typeof em === "object" ? em.email || em.address : em).trim().toLowerCase();
    if (emailStr && emailStr.includes("@")) emailsSet.add(emailStr);
  });
  const emailsNormalizados = Array.from(emailsSet);

  // 14. Vehicles
  let rawVehList = [];
  if (p.vehicles && Array.isArray(p.vehicles.list)) {
    rawVehList = p.vehicles.list;
  } else if (p.vehicles_proprietario && Array.isArray(p.vehicles_proprietario.list)) {
    rawVehList = p.vehicles_proprietario.list;
  } else if (Array.isArray(p.detran_vehicles)) {
    rawVehList = p.detran_vehicles;
  } else if (Array.isArray(p.veiculos)) {
    rawVehList = p.veiculos;
  } else if (Array.isArray(p.vehicles)) {
    rawVehList = p.vehicles;
  }

  const veiculosNormalizados = rawVehList.map((v) => {
    const placa = String(v.plate || v.placa || "N/A").toUpperCase().trim();
    const placaAntiga = v.old_plate || v.placa_antiga || null;
    const modelo = v.model || v.modelo || (Array.isArray(v.years) ? `Ano ${v.years.join("/")}` : "Modelo não informado");
    const marca = v.brand || v.marca || null;
    const ano = v.year || v.ano || (Array.isArray(v.years) ? v.years[0] : null);
    const renavam = v.renavam || null;
    const chassi = v.chassis || v.chassi || null;
    const cor = v.color || v.cor || null;
    const situacao = v.status || v.situacao || "REGULAR";

    return {
      placa,
      placa_antiga: placaAntiga,
      modelo,
      marca,
      ano,
      renavam,
      chassi,
      cor,
      situacao,
    };
  });

  // 15. Companies & Corporate Shares (QSA)
  const rawEmpresasList = Array.isArray(p.empresas_vinculadas)
    ? p.empresas_vinculadas
    : Array.isArray(p.empresas)
      ? p.empresas
      : Array.isArray(p.companies)
        ? p.companies
        : [];

  const empresasNormalizadas = rawEmpresasList.map((emp) => {
    const rawCnpj = String(emp.cnpj || "").replace(/\D/g, "");
    return {
      cnpj: rawCnpj,
      cnpj_formatado: formatCnpj(rawCnpj),
      razao_social: emp.razao_social || emp.razaoSocial || emp.nome || "Razão Social não informada",
      nome_fantasia: emp.nome_fantasia || emp.nomeFantasia || null,
      situacao: emp.situacao || emp.status || "ATIVA",
      qualificacao_socio: emp.qualificacao_socio || emp.qualificacao || "SÓCIO / TITULAR",
      capital_social: emp.capital_social ? formatCurrency(emp.capital_social) : null,
      data_abertura: emp.data_abertura || emp.data_entrada_sociedade || null,
    };
  });

  // 16. Relatives (Parentes)
  let rawParentesList = [];
  if (Array.isArray(p.serasa_completo?.parentes) && p.serasa_completo.parentes.length > 0) {
    rawParentesList = p.serasa_completo.parentes;
  } else if (Array.isArray(p.parentes) && p.parentes.length > 0) {
    rawParentesList = p.parentes;
  } else if (Array.isArray(p.relatives) && p.relatives.length > 0) {
    rawParentesList = p.relatives;
  } else if (Array.isArray(p.parentescos) && p.parentescos.length > 0) {
    rawParentesList = p.parentescos;
  } else if (Array.isArray(p.familiares) && p.familiares.length > 0) {
    rawParentesList = p.familiares;
  } else if (Array.isArray(p.serasa_completo?.parentes)) {
    rawParentesList = p.serasa_completo.parentes;
  } else if (Array.isArray(p.parentes)) {
    rawParentesList = p.parentes;
  }

  const parentesNormalizados = rawParentesList.map((rel) => {
    const relCpf = String(rel.cpf || "").replace(/\D/g, "");
    return {
      nome: String(rel.nome || rel.name || "Parente").trim().toUpperCase(),
      vinculo: String(rel.vinculo || rel.grau || rel.relationship || "FAMILIAR").toUpperCase(),
      cpf: relCpf || null,
      cpf_formatado: relCpf ? formatCpf(relCpf) : "Não consta",
    };
  });

  // 17. Final Structured DTO
  return {
    ...p,
    // Identificação Civil
    cpf: rawCpf,
    cpf_formatado: formattedCpf,
    nome: nomeCompleto,
    name: nomeCompleto,
    primeiro_nome: primeiroNome,
    ultimo_nome: ultimoNome,
    sexo,
    gender: sexo === "MASCULINO" ? "M" : sexo === "FEMININO" ? "F" : "N/I",
    data_nascimento: birthFormatted,
    birth_date: birthFormatted,
    idade: age,
    age,
    signo: sign,
    nome_mae: nomeMae,
    mother_name: nomeMae,
    nome_pai: nomePai,
    father_name: nomePai,

    // Status Receita Federal & Óbito
    situacao_receita: situacaoReceita,
    federal_status: situacaoReceita,
    situacaoCadastral: situacaoReceita,
    is_falecido: isFalecido,
    falecido: isFalecido,
    data_obito: dataObito,

    // Perfil Profissional & Financeiro
    profissao,
    occupation: profissao,
    cbo,
    renda_estimada: rendaEstimada,
    renda_formatada: rendaFormatada,
    income: rendaEstimada,
    score: scoreObj,
    score_valor: scoreObj.valor,
    score_display: scoreObj.display,

    // Biometria Facial & Espelho CNH
    foto_url: fotoUrl,

    // Documentação
    rg,
    rg_emissor: rgEmissor,
    titulo_eleitor: tituloEleitor,
    voter_id: tituloEleitor,
    cnh,

    // Endereços & Telecomunicações
    endereco: enderecoPrincipal,
    address: enderecoPrincipal,
    enderecos: enderecosNormalizados,
    all_addresses: enderecosNormalizados,
    telefones: telefonesNormalizados,
    phones: Array.from(phonesSeen),
    emails: emailsNormalizados,
    all_emails: emailsNormalizados,

    // Bens & Vínculos Corporativos
    veiculos: veiculosNormalizados,
    vehicles: { count: veiculosNormalizados.length, list: veiculosNormalizados },
    empresas: empresasNormalizadas,
    empresas_vinculadas: empresasNormalizadas,
    parentes: parentesNormalizados,
    relatives: parentesNormalizados,

    // Outros dados complementares
    beneficios: Array.isArray(p.beneficios) ? p.beneficios : [],
    vacinas: Array.isArray(p.vacinas) ? p.vacinas : [],
  };
}

/**
 * Main Hexys CPF Interpreter function
 * @param {Object} rawData
 * @returns {Object} Clean normalized person DTO
 */
export function interpretHexysCpf(rawData) {
  if (!rawData || typeof rawData !== "object") return rawData;
  return normalizePersonRecord(rawData);
}

export default interpretHexysCpf;
