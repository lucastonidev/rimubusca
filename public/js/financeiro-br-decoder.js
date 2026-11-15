/**
 * ==============================================================================
 * RIMUBUSCA - DECODIFICADOR FINANCEIRO BR (PIX EMVCO/BACEN & BOLETO FEBRABAN)
 * Motor determinístico 100% local (zero custo de API externa) compartilhado
 * entre navegador e Node.js (ESM).
 * ==============================================================================
 */

export const BANCOS_COMPE_BR = Object.freeze({
  "001": "Banco do Brasil S.A.",
  "003": "Banco da Amazônia S.A.",
  "004": "Banco do Nordeste do Brasil S.A.",
  "021": "Banestes S.A.",
  "033": "Banco Santander (Brasil) S.A.",
  "041": "Banrisul S.A.",
  "047": "Banco do Estado de Sergipe (Banese)",
  "070": "BRB - Banco de Brasília S.A.",
  "077": "Banco Inter S.A.",
  "084": "Uniprime do Brasil",
  "085": "Cooperativa Central de Crédito (Ailos)",
  "097": "Credisis Central",
  "104": "Caixa Econômica Federal",
  "121": "Banco Agibank S.A.",
  "136": "Unicred Cooperativa",
  "197": "Stone Instituição de Pagamento S.A.",
  "208": "Banco BTG Pactual S.A.",
  "212": "Banco Original S.A.",
  "218": "Banco BS2 S.A.",
  "237": "Banco Bradesco S.A.",
  "260": "Nu Pagamentos S.A. (Nubank)",
  "280": "Will Financeira / Banco Digio",
  "290": "PagSeguro Internet IP S.A. (PagBank)",
  "318": "Banco BMG S.A.",
  "323": "Mercado Pago IP Ltda.",
  "332": "Acesso Soluções de Pagamento (Méliuz)",
  "335": "Banco Digio S.A.",
  "336": "Banco C6 S.A. (C6 Bank)",
  "341": "Itaú Unibanco S.A.",
  "364": "Efí S.A. (Gerencianet)",
  "380": "PicPay Bank - Banco Múltiplo S.A.",
  "389": "Banco Mercantil do Brasil S.A.",
  "399": "Kirton Bank / HSBC",
  "403": "Cora Sociedade de Crédito Direto S.A.",
  "422": "Banco Safra S.A.",
  "450": "Fitbank Pagamentos Eletrônicos S.A.",
  "536": "Neon Pagamentos S.A.",
  "623": "Banco Pan S.A.",
  "633": "Banco Rendimento S.A.",
  "637": "Banco Sofisa S.A.",
  "643": "Banco Pine S.A.",
  "655": "Banco Votorantim (BV)",
  "707": "Banco Daycoval S.A.",
  "735": "Neon Financeira",
  "745": "Banco Citibank S.A.",
  "746": "Banco Modal S.A.",
  "748": "Banco Cooperativo Sicredi S.A.",
  "752": "Banco BNP Paribas Brasil S.A.",
  "756": "Banco Cooperativo Sicoob S.A.",
});

export const SEGMENTOS_ARRECADACAO = Object.freeze({
  "1": "Prefeituras (IPTU, ISS, Taxas Municipais)",
  "2": "Saneamento (Água e Esgoto)",
  "3": "Energia Elétrica e Gás",
  "4": "Telecomunicações",
  "5": "Órgãos Governamentais (DARF, FGTS, DAE, Tributos)",
  "6": "Carnês e Assemelhados / Empresas por CNPJ",
  "7": "Multas de Trânsito (DETRAN / PRF)",
  "9": "Uso Exclusivo do Banco",
});

export const EMV_ROOT_LABELS = Object.freeze({
  "00": "Payload Format Indicator",
  "01": "Point of Initiation Method",
  "26": "Merchant Account Information (Arranjo PIX)",
  "52": "Merchant Category Code (MCC)",
  "53": "Transaction Currency (ISO 4217)",
  "54": "Transaction Amount (Valor)",
  "58": "Country Code",
  "59": "Merchant Name (Recebedor)",
  "60": "Merchant City (Cidade)",
  "61": "Postal Code (CEP)",
  "62": "Additional Data Field Template",
  "63": "CRC16 Checksum",
  "80": "Unreserved Template / BR Code",
});

const EMV_ADDITIONAL_LABELS = Object.freeze({
  "05": "Reference Label (TxID)",
  "08": "Purpose of Transaction",
});

const EMV_PIX_MAI_LABELS = Object.freeze({
  "00": "GUI Arranjo",
  "01": "Chave PIX",
  "02": "Descrição / Info Adicional",
  "25": "URL QR Dinâmico (Payload Location)",
});

const PALAVRAS_SUSPEITAS_PIX = [
  "desbloqueio",
  "receita federal",
  "taxa alfandega",
  "alfandegaria",
  "correios",
  "serasa",
  "regularizacao",
  "regularize",
  "intimacao",
  "urgente",
  "premiacao",
  "resgate",
];

function digitsOnly(v) {
  return String(v || "").replace(/\D/g, "");
}

function formatBrl(num) {
  if (!Number.isFinite(num)) return null;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function validarCpfDigitos(cpf) {
  const clean = digitsOnly(cpf);
  if (clean.length !== 11 || /^(\d)\1{10}$/.test(clean)) return false;

  const calcDigit = (sliceLen) => {
    let sum = 0;
    for (let i = 0; i < sliceLen; i++) {
      sum += Number(clean[i]) * (sliceLen + 1 - i);
    }
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };

  return calcDigit(9) === Number(clean[9]) && calcDigit(10) === Number(clean[10]);
}

export function validarCnpjDigitos(cnpj) {
  const clean = digitsOnly(cnpj);
  if (clean.length !== 14 || /^(\d)\1{13}$/.test(clean)) return false;

  const calcDigit = (base) => {
    const weights = base.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < weights.length; i++) {
      sum += Number(base[i]) * weights[i];
    }
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };

  const d1 = calcDigit(clean.slice(0, 12));
  const d2 = calcDigit(clean.slice(0, 12) + d1);
  return d1 === Number(clean[12]) && d2 === Number(clean[13]);
}

export function crc16Ccitt(payload) {
  let crc = 0xffff;
  const str = String(payload || "");
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Faz parsing TLV (Tag-Length-Value) no padrão EMVCo Merchant Presented QR.
 */
export function parseEmvTlv(raw, labelMap = EMV_ROOT_LABELS) {
  const input = String(raw || "");
  const items = [];
  let idx = 0;

  while (idx < input.length) {
    if (idx + 4 > input.length) {
      return { items, error: `Estrutura TLV truncada no índice ${idx}.` };
    }
    const id = input.slice(idx, idx + 2);
    const lenStr = input.slice(idx + 2, idx + 4);
    if (!/^\d{2}$/.test(lenStr)) {
      return { items, error: `Tamanho TLV inválido '${lenStr}' na tag '${id}'.` };
    }
    const len = parseInt(lenStr, 10);
    const valStart = idx + 4;
    const valEnd = valStart + len;
    if (valEnd > input.length) {
      return { items, error: `Tag '${id}' declara tamanho ${len}, excedendo payload.` };
    }
    const value = input.slice(valStart, valEnd);
    items.push({
      id,
      length: len,
      value,
      label: labelMap[id] || `Tag ${id}`,
    });
    idx = valEnd;
  }

  return { items, error: null };
}

export function classificarChavePix(chaveRaw) {
  const chave = String(chaveRaw || "").trim();
  if (!chave) {
    return {
      tipo: "NAO_INFORMADA",
      rotulo: "Não informada (QR Dinâmico / URL)",
      valorFormatado: null,
      documentoPivote: null,
    };
  }

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(chave)) {
    return {
      tipo: "EMAIL",
      rotulo: "E-mail",
      valorFormatado: chave.toLowerCase(),
      dominioEmail: chave.split("@")[1]?.toLowerCase() || null,
      documentoPivote: null,
    };
  }

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chave)) {
    return {
      tipo: "EVP",
      rotulo: "Chave Aleatória (EVP / UUID)",
      valorFormatado: chave.toLowerCase(),
      documentoPivote: null,
    };
  }

  const digits = digitsOnly(chave);
  if (chave.startsWith("+") || (digits.startsWith("55") && (digits.length === 12 || digits.length === 13))) {
    return {
      tipo: "TELEFONE",
      rotulo: "Telefone Celular (+55)",
      valorFormatado: chave,
      documentoPivote: null,
    };
  }

  if (digits.length === 14 && validarCnpjDigitos(digits)) {
    const fmt = digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
    return {
      tipo: "CNPJ",
      rotulo: "CNPJ (Pessoa Jurídica)",
      valorFormatado: fmt,
      documentoPivote: { tipo: "cnpj", valor: digits, formatado: fmt },
    };
  }

  if (digits.length === 11 && validarCpfDigitos(digits)) {
    const fmt = digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
    return {
      tipo: "CPF",
      rotulo: "CPF (Pessoa Física)",
      valorFormatado: fmt,
      documentoPivote: { tipo: "cpf", valor: digits, formatado: fmt },
    };
  }

  if (digits.length === 10 || digits.length === 11) {
    return {
      tipo: "TELEFONE_OU_CPF",
      rotulo: "Numérica (Telefone / CPF não validado)",
      valorFormatado: chave,
      documentoPivote: null,
    };
  }

  return {
    tipo: "DESCONHECIDA",
    rotulo: "Formato Personalizado / Indefinido",
    valorFormatado: chave,
    documentoPivote: null,
  };
}

/**
 * Decodifica e audita um código PIX Copia e Cola (BR Code EMVCo/BACEN).
 */
export function decodificarPixBrCode(payloadRaw) {
  const payload = String(payloadRaw || "").trim();
  if (!payload || !payload.startsWith("0002")) {
    return {
      sucesso: false,
      modalidade: "pix",
      erro: "Código PIX Copia e Cola inválido (esperado prefixo EMV '000201...').",
    };
  }

  const parsedRoot = parseEmvTlv(payload, EMV_ROOT_LABELS);
  const tagMap = new Map();
  for (const tag of parsedRoot.items) {
    tagMap.set(tag.id, tag.value);
  }

  const tag63 = parsedRoot.items.find((t) => t.id === "63");
  const idx63 = payload.lastIndexOf("6304");
  const crcEncontrado = tag63?.value ? String(tag63.value).toUpperCase() : null;
  const crcEsperado = idx63 !== -1 ? crc16Ccitt(payload.slice(0, idx63 + 4)) : null;
  const crcValido = Boolean(crcEncontrado && crcEsperado && crcEncontrado === crcEsperado && !parsedRoot.error);

  // Merchant Account Information (Tags 26..51)
  const maiEntries = [];
  let pixInfo = null;
  for (const tag of parsedRoot.items) {
    const numId = parseInt(tag.id, 10);
    if (numId >= 26 && numId <= 51) {
      const sub = parseEmvTlv(tag.value, EMV_PIX_MAI_LABELS);
      const subMap = Object.fromEntries(sub.items.map((s) => [s.id, s.value]));
      const entry = {
        tagId: tag.id,
        gui: subMap["00"] || null,
        chave: subMap["01"] || null,
        descricao: subMap["02"] || null,
        urlDinamica: subMap["25"] || null,
        subTags: sub.items,
      };
      maiEntries.push(entry);
      if (String(subMap["00"] || "").toLowerCase().includes("br.gov.bcb.pix") || tag.id === "26") {
        pixInfo = entry;
      }
    }
  }

  const tag62Raw = tagMap.get("62") || null;
  const sub62 = tag62Raw ? parseEmvTlv(tag62Raw, EMV_ADDITIONAL_LABELS) : { items: [] };
  const sub62Map = Object.fromEntries(sub62.items.map((s) => [s.id, s.value]));

  const valorStr = tagMap.get("54") || null;
  const valorNumero = valorStr !== null && Number.isFinite(Number(valorStr)) ? Number(valorStr) : null;
  const pointOfInitiation = tagMap.get("01") || null;
  const tipoQr = pixInfo?.urlDinamica || pointOfInitiation === "12" ? "DINAMICO" : "ESTATICO";

  let dominioPsp = null;
  let protocoloUrlSegura = null;
  if (pixInfo?.urlDinamica) {
    const rawUrl = pixInfo.urlDinamica.startsWith("http")
      ? pixInfo.urlDinamica
      : `https://${pixInfo.urlDinamica}`;
    try {
      const u = new URL(rawUrl);
      dominioPsp = u.hostname.toLowerCase();
      protocoloUrlSegura = pixInfo.urlDinamica.toLowerCase().startsWith("http://") ? false : true;
    } catch {
      dominioPsp = null;
      protocoloUrlSegura = false;
    }
  }

  const chaveAnalise = classificarChavePix(pixInfo?.chave || "");
  const recebedor = tagMap.get("59") || "Não informado";
  const cidade = tagMap.get("60") || "Não informada";
  const cep = tagMap.get("61") || null;
  const mcc = tagMap.get("52") || "0000";
  const moedaCod = tagMap.get("53") || null;
  const pais = tagMap.get("58") || null;
  const txId = sub62Map["05"] || "***";

  // Heurísticas antifraude / integridade
  const alertas = [];
  if (parsedRoot.error) {
    alertas.push({
      nivel: "critico",
      titulo: "Estrutura TLV Corrompida",
      detalhe: parsedRoot.error,
    });
  }
  if (!crcValido) {
    alertas.push({
      nivel: "critico",
      titulo: "Checksum CRC16 Inválido (Adulteração ou Truncamento)",
      detalhe: `CRC encontrado '${crcEncontrado || "AUSENTE"}' diverge do calculado '${crcEsperado || "N/A"}'. Não realize transferência sem verificar o payload original.`,
    });
  }
  if (!pixInfo || !String(pixInfo.gui || "").toLowerCase().includes("br.gov.bcb.pix")) {
    alertas.push({
      nivel: "alto",
      titulo: "GUI BACEN (br.gov.bcb.pix) Ausente",
      detalhe: "O identificador global oficial do arranjo PIX não foi encontrado na tag Merchant Account Info (26).",
    });
  }
  if (tipoQr === "DINAMICO" && pixInfo?.urlDinamica && protocoloUrlSegura === false) {
    alertas.push({
      nivel: "alto",
      titulo: "Endpoint Dinâmico Inseguro (Sem HTTPS)",
      detalhe: "A URL do payload dinâmico utiliza esquema não criptografado ou inválido.",
    });
  }
  if (moedaCod && moedaCod !== "986") {
    alertas.push({
      nivel: "alto",
      titulo: `Moeda Estrangeira Detectada (${moedaCod})`,
      detalhe: "Códigos PIX domésticos devem utilizar ISO 4217 = 986 (BRL).",
    });
  }
  if (pais && pais.toUpperCase() !== "BR") {
    alertas.push({
      nivel: "alto",
      titulo: `Código de País Atípico (${pais})`,
      detalhe: "O código de país declarado não é BR.",
    });
  }
  if (recebedor.length < 3 || recebedor === "***") {
    alertas.push({
      nivel: "medio",
      titulo: "Identificação Genérica do Recebedor",
      detalhe: "O nome do recebedor declarado no EMV é curto ou genérico; valide o beneficiário final antes de confirmar.",
    });
  }

  const textoHeuristico = `${recebedor} ${pixInfo?.descricao || ""} ${txId}`.toLowerCase();
  const termoSuspeito = PALAVRAS_SUSPEITAS_PIX.find((p) => textoHeuristico.includes(p));
  if (termoSuspeito) {
    alertas.push({
      nivel: "alto",
      titulo: "Termo Recorrente em Golpes de Falsa Cobrança",
      detalhe: `Identificada expressão '${termoSuspeito}' nos metadados do PIX. Verifique se não se trata de boleto/guia falsa.`,
    });
  }

  if (valorNumero !== null && valorNumero >= 3000 && chaveAnalise.tipo === "EVP") {
    alertas.push({
      nivel: "medio",
      titulo: "Valor Elevado para Chave Aleatória (EVP)",
      detalhe: `Valor de ${formatBrl(valorNumero)} direcionado a chave aleatória sem vínculo nominal legível na chave.`,
    });
  }

  const nivelRisco = alertas.some((a) => a.nivel === "critico")
    ? "CRÍTICO"
    : alertas.some((a) => a.nivel === "alto")
      ? "ALTO"
      : alertas.length > 0
        ? "ATENÇÃO"
        : "ÍNTEGRO";

  return {
    sucesso: true,
    modalidade: "pix",
    payloadOriginal: payload,
    padrao: "EMVCo QR Merchant Presented (BR Code / BACEN)",
    tipoQr,
    crcValido,
    crcEncontrado,
    crcEsperado,
    nivelRisco,
    dados: {
      gui: pixInfo?.gui || null,
      chave: pixInfo?.chave || null,
      chaveTipo: chaveAnalise.tipo,
      chaveRotulo: chaveAnalise.rotulo,
      chaveFormatada: chaveAnalise.valorFormatado,
      documentoPivote: chaveAnalise.documentoPivote,
      dominioEmail: chaveAnalise.dominioEmail || null,
      descricao: pixInfo?.descricao || null,
      urlQrDinamico: pixInfo?.urlDinamica || null,
      dominioPsp,
      recebedor,
      cidade,
      cep,
      pais: pais || "N/I",
      moedaCodigo: moedaCod || "N/I",
      moedaNome: moedaCod === "986" ? "BRL (Real Brasileiro)" : moedaCod || "N/I",
      mcc,
      valor: valorNumero,
      valorFormatado: valorNumero !== null ? formatBrl(valorNumero) : "Em aberto (definido pelo pagador)",
      txId,
      pointOfInitiation,
    },
    alertas,
    tlv: parsedRoot.items,
    merchantAccountInfos: maiEntries,
    additionalTags: sub62.items,
  };
}

export function modulo10Febraban(numStr) {
  const digits = digitsOnly(numStr);
  let sum = 0;
  let weight = 2;
  for (let i = digits.length - 1; i >= 0; i--) {
    let prod = Number(digits[i]) * weight;
    if (prod > 9) prod = Math.floor(prod / 10) + (prod % 10);
    sum += prod;
    weight = weight === 2 ? 1 : 2;
  }
  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

export function modulo11Banco(digits43) {
  const digits = digitsOnly(digits43);
  let sum = 0;
  let weight = 2;
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += Number(digits[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const dv = 11 - (sum % 11);
  if (dv === 0 || dv === 10 || dv === 11) return 1;
  return dv;
}

export function modulo11Arrecadacao(numStr) {
  const digits = digitsOnly(numStr);
  let sum = 0;
  let weight = 2;
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += Number(digits[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const resto = sum % 11;
  if (resto === 0 || resto === 1) return 0;
  if (resto === 10) return 1;
  return 11 - resto;
}

/**
 * Calcula data de vencimento considerando o reset do fator BACEN em 22/02/2025.
 * A partir de 22/02/2025, o fator reiniciou em 1000.
 */
export function calcularVencimentoFator(fatorNum) {
  const fator = Number(fatorNum);
  if (!Number.isFinite(fator) || fator === 0) {
    return {
      fator: 0,
      semVencimento: true,
      dataVencimentoIso: null,
      dataVencimentoBr: "À vista / Sem vencimento definido",
      cicloAplicado: "Sem fator de vencimento",
      vencimentoCicloLegadoBr: null,
    };
  }

  const baseLegadaMs = Date.UTC(1997, 9, 7); // 1997-10-07
  const legadoDate = new Date(baseLegadaMs + fator * 86400000);

  if (fator < 1000) {
    const iso = legadoDate.toISOString().slice(0, 10);
    return {
      fator,
      semVencimento: false,
      dataVencimentoIso: iso,
      dataVencimentoBr: formatDateIsoBr(iso),
      cicloAplicado: "Ciclo Base 1997-10-07 (< 1000)",
      vencimentoCicloLegadoBr: formatDateIsoBr(iso),
    };
  }

  const baseReset2025Ms = Date.UTC(2025, 1, 22); // 2025-02-22 == fator 1000
  const novoCicloDate = new Date(baseReset2025Ms + (fator - 1000) * 86400000);
  const novoIso = novoCicloDate.toISOString().slice(0, 10);
  const legadoIso = legadoDate.toISOString().slice(0, 10);

  return {
    fator,
    semVencimento: false,
    dataVencimentoIso: novoIso,
    dataVencimentoBr: formatDateIsoBr(novoIso),
    cicloAplicado: "Ciclo Atual BACEN (Reset 22/02/2025 -> Fator 1000)",
    vencimentoCicloLegadoBr: formatDateIsoBr(legadoIso),
  };
}

function formatDateIsoBr(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || null;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function barcodeBancarioParaLinha(bar44) {
  const b = digitsOnly(bar44);
  if (b.length !== 44) return null;
  const banco = b.slice(0, 3);
  const moeda = b.slice(3, 4);
  const dac = b.slice(4, 5);
  const fator = b.slice(5, 9);
  const valor = b.slice(9, 19);
  const livre = b.slice(19, 44);

  const c1Base = `${banco}${moeda}${livre.slice(0, 5)}`;
  const c1 = `${c1Base}${modulo10Febraban(c1Base)}`;
  const c2Base = livre.slice(5, 15);
  const c2 = `${c2Base}${modulo10Febraban(c2Base)}`;
  const c3Base = livre.slice(15, 25);
  const c3 = `${c3Base}${modulo10Febraban(c3Base)}`;
  return `${c1}${c2}${c3}${dac}${fator}${valor}`;
}

function linhaBancariaParaBarcode(lin47) {
  const l = digitsOnly(lin47);
  if (l.length !== 47) return null;
  // Banco(3)+Moeda(1)+DAC(1)+Fator(4)+Valor(10)+CampoLivre(25)
  return `${l.slice(0, 4)}${l.slice(32, 33)}${l.slice(33, 47)}${l.slice(4, 9)}${l.slice(10, 20)}${l.slice(21, 31)}`;
}

/**
 * Analisa Boletos Bancários (47 dígitos / 44 barras) e Guias de Arrecadação (48 / 44 dígitos).
 */
export function analisarBoletoFebraban(codigoRaw) {
  const clean = digitsOnly(codigoRaw);
  if (![44, 47, 48].includes(clean.length)) {
    return {
      sucesso: false,
      modalidade: "boleto",
      erro: `Quantidade de dígitos inválida (${clean.length}). Esperado: 47 dígitos (Boleto Bancário), 48 dígitos (Arrecadação/Tributo) ou 44 dígitos (Código de Barras).`,
    };
  }

  // Caso A: Boleto Bancário (47 linha digitável ou 44 barras começando diferente de '8')
  const isArrecadacao = clean.startsWith("8") && (clean.length === 48 || clean.length === 44);

  if (!isArrecadacao) {
    let linha47 = clean.length === 47 ? clean : barcodeBancarioParaLinha(clean);
    let bar44 = clean.length === 44 ? clean : linhaBancariaParaBarcode(clean);

    const campo1 = linha47.slice(0, 10);
    const campo2 = linha47.slice(10, 21);
    const campo3 = linha47.slice(21, 32);
    const dacLinha = linha47.slice(32, 33);
    const campo5 = linha47.slice(33, 47);

    const dv1Ok = modulo10Febraban(campo1.slice(0, 9)) === Number(campo1[9]);
    const dv2Ok = modulo10Febraban(campo2.slice(0, 10)) === Number(campo2[10]);
    const dv3Ok = modulo10Febraban(campo3.slice(0, 10)) === Number(campo3[10]);

    const barSemDac = `${bar44.slice(0, 4)}${bar44.slice(5)}`;
    const dacEsperado = modulo11Banco(barSemDac);
    const dacOk = dacEsperado === Number(bar44[4]);

    const bancoCodigo = bar44.slice(0, 3);
    const bancoNome = BANCOS_COMPE_BR[bancoCodigo] || `Banco Código ${bancoCodigo} (Não Catalogado na Lista Rápida)`;
    const moedaCodigo = bar44.slice(3, 4);
    const fatorStr = bar44.slice(5, 9);
    const valorCentavos = parseInt(bar44.slice(9, 19), 10);
    const valorReais = valorCentavos / 100;
    const campoLivre = bar44.slice(19, 44);
    const vencimento = calcularVencimentoFator(parseInt(fatorStr, 10));

    const linhaFormatada = `${linha47.slice(0, 5)}.${linha47.slice(5, 10)} ${linha47.slice(10, 15)}.${linha47.slice(15, 21)} ${linha47.slice(21, 26)}.${linha47.slice(26, 32)} ${dacLinha} ${campo5}`;

    const alertas = [];
    if (!dv1Ok || !dv2Ok || !dv3Ok) {
      alertas.push({
        nivel: "critico",
        titulo: "Dígito Verificador de Campo Inválido (Mod 10)",
        detalhe: `Falha de validação: Campo 1 (${dv1Ok ? "OK" : "ERRO"}), Campo 2 (${dv2Ok ? "OK" : "ERRO"}), Campo 3 (${dv3Ok ? "OK" : "ERRO"}). Linha digitável adulterada ou digitada incorretamente.`,
      });
    }
    if (!dacOk) {
      alertas.push({
        nivel: "critico",
        titulo: "Dígito Verificador Geral (DAC Mod 11) Inválido",
        detalhe: `DAC encontrado '${bar44[4]}', esperado '${dacEsperado}'. O código de barras não fecha matematicamente.`,
      });
    }
    if (!BANCOS_COMPE_BR[bancoCodigo]) {
      alertas.push({
        nivel: "alto",
        titulo: `Código Bancário Incomum (${bancoCodigo})`,
        detalhe: "Em golpes de boleto adulterado, fraudadores trocam os 3 primeiros dígitos para desviar o crédito para conta em banco distinto da logo impressa no boleto.",
      });
    }
    if (moedaCodigo !== "9") {
      alertas.push({
        nivel: "medio",
        titulo: `Moeda Diferente de Real (Código ${moedaCodigo})`,
        detalhe: "Boletos bancários brasileiros em Real utilizam código de moeda '9'.",
      });
    }
    if (vencimento.dataVencimentoIso) {
      const todayIso = new Date().toISOString().slice(0, 10);
      if (vencimento.dataVencimentoIso < todayIso) {
        alertas.push({
          nivel: "atencao",
          titulo: `Título Vencido em ${vencimento.dataVencimentoBr}`,
          detalhe: "O vencimento extraído do fator já está no passado no ciclo BACEN atual.",
        });
      }
    }

    const nivelRisco = alertas.some((a) => a.nivel === "critico")
      ? "CRÍTICO"
      : alertas.some((a) => a.nivel === "alto")
        ? "ALTO"
        : alertas.length > 0
          ? "ATENÇÃO"
          : "ÍNTEGRO";

    return {
      sucesso: true,
      modalidade: "boleto",
      tipoBoleto: "BANCARIO",
      formatoEntrada: clean.length === 47 ? "Linha Digitável (47 dígitos)" : "Código de Barras (44 dígitos)",
      integridadeValida: dv1Ok && dv2Ok && dv3Ok && dacOk,
      nivelRisco,
      dados: {
        linhaDigitavel: linha47,
        linhaDigitavelFormatada: linhaFormatada,
        codigoBarras: bar44,
        bancoCodigo,
        bancoNome,
        bancoReconhecido: Boolean(BANCOS_COMPE_BR[bancoCodigo]),
        moedaCodigo,
        moedaNome: moedaCodigo === "9" ? "BRL (R$ - Código 9)" : `Código ${moedaCodigo}`,
        fatorVencimento: parseInt(fatorStr, 10),
        vencimentoBr: vencimento.dataVencimentoBr,
        vencimentoIso: vencimento.dataVencimentoIso,
        cicloVencimento: vencimento.cicloAplicado,
        vencimentoCicloLegadoBr: vencimento.vencimentoCicloLegadoBr,
        valor: valorReais,
        valorFormatado: valorCentavos > 0 ? formatBrl(valorReais) : "Valor em aberto / variável (R$ 0,00)",
        campoLivre,
        dacGeral: bar44[4],
        dacEsperado: String(dacEsperado),
        dacValido: dacOk,
        validacoesCampos: { campo1: dv1Ok, campo2: dv2Ok, campo3: dv3Ok, dacGeral: dacOk },
      },
      alertas,
      checklistFraude: `Confirme no aplicativo do seu banco se os 3 primeiros dígitos (${bancoCodigo} — ${bancoNome}) correspondem exatamente ao banco emissor impresso no cabeçalho do boleto.`,
    };
  }

  // Caso B: Guia de Arrecadação / Convênio / Tributos ('8...' - 48 ou 44 dígitos)
  let linha48 = clean.length === 48 ? clean : null;
  let bar44 = clean.length === 44 ? clean : null;

  const alertas = [];
  let blocosStatus = null;

  if (linha48) {
    const blocos = [
      linha48.slice(0, 12),
      linha48.slice(12, 24),
      linha48.slice(24, 36),
      linha48.slice(36, 48),
    ];
    bar44 = blocos.map((b) => b.slice(0, 11)).join("");
    const idValorRef = bar44[2];
    const usaMod10 = idValorRef === "6" || idValorRef === "7";
    const dvFn = usaMod10 ? modulo10Febraban : modulo11Arrecadacao;

    blocosStatus = blocos.map((b) => dvFn(b.slice(0, 11)) === Number(b[11]));
    if (blocosStatus.some((ok) => !ok)) {
      alertas.push({
        nivel: "critico",
        titulo: "Bloco da Linha Digitável de Arrecadação Inválido",
        detalhe: `Falha nos DVs dos blocos (${blocosStatus.map((ok, i) => `B${i + 1}:${ok ? "OK" : "ERRO"}`).join(" | ")}).`,
      });
    }
  } else {
    linha48 = [
      bar44.slice(0, 11),
      bar44.slice(11, 22),
      bar44.slice(22, 33),
      bar44.slice(33, 44),
    ]
      .map((seg) => {
        const idValorRef = bar44[2];
        const dvFn = idValorRef === "6" || idValorRef === "7" ? modulo10Febraban : modulo11Arrecadacao;
        return `${seg}${dvFn(seg)}`;
      })
      .join("");
  }

  const idProduto = bar44[0];
  const idSegmento = bar44[1];
  const idValorRef = bar44[2];
  const dvGeralEncontrado = Number(bar44[3]);
  const usaMod10Geral = idValorRef === "6" || idValorRef === "7";
  const dvGeralEsperado = usaMod10Geral
    ? modulo10Febraban(`${bar44.slice(0, 3)}${bar44.slice(4)}`)
    : modulo11Arrecadacao(`${bar44.slice(0, 3)}${bar44.slice(4)}`);
  const dvGeralOk = dvGeralEncontrado === dvGeralEsperado;

  if (!dvGeralOk) {
    alertas.push({
      nivel: "critico",
      titulo: "Dígito Verificador Geral do Convênio Inválido",
      detalhe: `DV geral '${dvGeralEncontrado}' diverge do calculado '${dvGeralEsperado}'.`,
    });
  }

  const valorCentavos = parseInt(bar44.slice(4, 15), 10);
  const valorEfetivoReais = idValorRef === "6" || idValorRef === "8" ? valorCentavos / 100 : null;
  const linhaFormatada = `${linha48.slice(0, 11)}-${linha48[11]} ${linha48.slice(12, 23)}-${linha48[23]} ${linha48.slice(24, 35)}-${linha48[35]} ${linha48.slice(36, 47)}-${linha48[47]}`;

  const nivelRisco = alertas.some((a) => a.nivel === "critico")
    ? "CRÍTICO"
    : alertas.length > 0
      ? "ATENÇÃO"
      : "ÍNTEGRO";

  return {
    sucesso: true,
    modalidade: "boleto",
    tipoBoleto: "ARRECADACAO",
    formatoEntrada: clean.length === 48 ? "Linha Digitável Convênio (48 dígitos)" : "Código de Barras Convênio (44 dígitos)",
    integridadeValida: dvGeralOk && (!blocosStatus || blocosStatus.every(Boolean)),
    nivelRisco,
    dados: {
      linhaDigitavel: linha48,
      linhaDigitavelFormatada: linhaFormatada,
      codigoBarras: bar44,
      produtoCodigo: idProduto,
      segmentoCodigo: idSegmento,
      segmentoNome: SEGMENTOS_ARRECADACAO[idSegmento] || `Segmento ${idSegmento}`,
      identificadorValorCodigo: idValorRef,
      tipoCalculoDv: usaMod10Geral ? "Módulo 10" : "Módulo 11 (Arrecadação)",
      empresaOrgaoCodigo: bar44.slice(15, 19),
      cnpjParcialOuIdentificador: idSegmento === "6" ? bar44.slice(15, 23) : null,
      campoLivre: bar44.slice(19, 44),
      valor: valorEfetivoReais,
      valorFormatado:
        valorEfetivoReais !== null
          ? formatBrl(valorEfetivoReais)
          : "Valor referenciado por moeda/índice (não direto em R$)",
      dacGeral: String(dvGeralEncontrado),
      dacEsperado: String(dvGeralEsperado),
      dacValido: dvGeralOk,
      blocosValidos: blocosStatus,
    },
    alertas,
    checklistFraude: `Guia de arrecadação segmentada como '${SEGMENTOS_ARRECADACAO[idSegmento] || idSegmento}'. Valide o órgão destinatário antes de confirmar.`,
  };
}

/**
 * Detecta automaticamente se o conteúdo é PIX Copia e Cola ou Boleto FEBRABAN.
 */
export function analisarCodigoFinanceiro(textoRaw) {
  const texto = String(textoRaw || "").trim();
  if (!texto) {
    return { sucesso: false, erro: "Cole um código PIX Copia e Cola ou Linha Digitável de Boleto para analisar." };
  }

  if (texto.startsWith("0002") || texto.toLowerCase().includes("br.gov.bcb.pix")) {
    return decodificarPixBrCode(texto);
  }

  const onlyDigits = digitsOnly(texto);
  if ([44, 47, 48].includes(onlyDigits.length)) {
    return analisarBoletoFebraban(texto);
  }

  return {
    sucesso: false,
    erro: "Formato não reconhecido. Informe um payload PIX BR Code (iniciado por 000201...) ou uma linha digitável/código de barras FEBRABAN (44, 47 ou 48 dígitos).",
  };
}

const FinanceiroBrDecoder = {
  BANCOS_COMPE_BR,
  SEGMENTOS_ARRECADACAO,
  validarCpfDigitos,
  validarCnpjDigitos,
  crc16Ccitt,
  parseEmvTlv,
  classificarChavePix,
  decodificarPixBrCode,
  modulo10Febraban,
  modulo11Banco,
  modulo11Arrecadacao,
  calcularVencimentoFator,
  analisarBoletoFebraban,
  analisarCodigoFinanceiro,
};

if (typeof window !== "undefined") {
  window.FinanceiroBrDecoder = FinanceiroBrDecoder;
}

export default FinanceiroBrDecoder;
