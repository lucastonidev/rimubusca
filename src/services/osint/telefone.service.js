import { httpRequest } from '../core/httpClient.js';

// Configurações da API de Consulta de Operadora (Omkar Cloud)
const CARRIER_LOOKUP_API_URL = process.env.CARRIER_LOOKUP_API_URL || 'https://carrier-lookup-api.omkar.cloud/lookup';
const CARRIER_LOOKUP_API_KEY = process.env.CARRIER_LOOKUP_API_KEY || 'ok_4f610277a574c2e507137f72ec9e36dd';

// Mapeamento abrangente de DDDs do Brasil (Anatel)
const DDD_BRASIL = {
  11: { regiao: 'São Paulo (Capital e Região Metropolitana)', estado: 'SP', uf: 'São Paulo' },
  12: { regiao: 'Vale do Paraíba, Litoral Norte e Serra da Mantiqueira', estado: 'SP', uf: 'São Paulo' },
  13: { regiao: 'Baixada Santista e Litoral Sul', estado: 'SP', uf: 'São Paulo' },
  14: { regiao: 'Bauru, Jaú, Marília, Botucatu', estado: 'SP', uf: 'São Paulo' },
  15: { regiao: 'Sorocaba, Itapetininga e Região', estado: 'SP', uf: 'São Paulo' },
  16: { regiao: 'Ribeirão Preto, Franca, São Carlos, Araraquara', estado: 'SP', uf: 'São Paulo' },
  17: { regiao: 'São José do Rio Preto, Barretos, Catanduva', estado: 'SP', uf: 'São Paulo' },
  18: { regiao: 'Presidente Prudente, Araçatuba, Assis', estado: 'SP', uf: 'São Paulo' },
  19: { regiao: 'Campinas, Piracicaba, Americana, Rio Claro', estado: 'SP', uf: 'São Paulo' },
  21: { regiao: 'Rio de Janeiro (Capital e Região Metropolitana)', estado: 'RJ', uf: 'Rio de Janeiro' },
  22: { regiao: 'Campos dos Goytacazes, Macaé, Cabo Frio, Nova Friburgo', estado: 'RJ', uf: 'Rio de Janeiro' },
  24: { regiao: 'Petrópolis, Volta Redonda, Angra dos Reis, Resende', estado: 'RJ', uf: 'Rio de Janeiro' },
  27: { regiao: 'Vitória e Região Metropolitana', estado: 'ES', uf: 'Espírito Santo' },
  28: { regiao: 'Cachoeiro de Itapemirim e Região Sul', estado: 'ES', uf: 'Espírito Santo' },
  31: { regiao: 'Belo Horizonte e Região Metropolitana', estado: 'MG', uf: 'Minas Gerais' },
  32: { regiao: 'Juiz de Fora, Barbacena e Zona da Mata', estado: 'MG', uf: 'Minas Gerais' },
  33: { regiao: 'Governador Valadares, Teófilo Otoni e Vale do Aço', estado: 'MG', uf: 'Minas Gerais' },
  34: { regiao: 'Uberlândia, Uberaba e Triângulo Mineiro', estado: 'MG', uf: 'Minas Gerais' },
  35: { regiao: 'Poços de Caldas, Varginha, Pouso Alegre e Sul de Minas', estado: 'MG', uf: 'Minas Gerais' },
  37: { regiao: 'Divinópolis, Itaúna e Centro-Oeste Mineiro', estado: 'MG', uf: 'Minas Gerais' },
  38: { regiao: 'Montes Claros, Diamantina e Norte de Minas', estado: 'MG', uf: 'Minas Gerais' },
  41: { regiao: 'Curitiba e Região Metropolitana', estado: 'PR', uf: 'Paraná' },
  42: { regiao: 'Ponta Grossa, Guarapuava e Campos Gerais', estado: 'PR', uf: 'Paraná' },
  43: { regiao: 'Londrina, Apucarana e Norte Paranaense', estado: 'PR', uf: 'Paraná' },
  44: { regiao: 'Maringá, Campo Mourão, Umuarama', estado: 'PR', uf: 'Paraná' },
  45: { regiao: 'Foz do Iguaçu, Cascavel e Oeste', estado: 'PR', uf: 'Paraná' },
  46: { regiao: 'Francisco Beltrão, Pato Branco e Sudoeste', estado: 'PR', uf: 'Paraná' },
  47: { regiao: 'Joinville, Blumenau, Balneário Camboriú, Itajaí', estado: 'SC', uf: 'Santa Catarina' },
  48: { regiao: 'Florianópolis e Região Metropolitana, Criciúma', estado: 'SC', uf: 'Santa Catarina' },
  49: { regiao: 'Chapecó, Lages e Oeste Catarinense', estado: 'SC', uf: 'Santa Catarina' },
  51: { regiao: 'Porto Alegre e Região Metropolitana, Vale dos Sinos', estado: 'RS', uf: 'Rio Grande do Sul' },
  53: { regiao: 'Pelotas, Rio Grande e Região Sul', estado: 'RS', uf: 'Rio Grande do Sul' },
  54: { regiao: 'Caxias do Sul, Bento Gonçalves, Passo Fundo (Serra)', estado: 'RS', uf: 'Rio Grande do Sul' },
  55: { regiao: 'Santa Maria, Uruguaiana e Noroeste Gaúcho', estado: 'RS', uf: 'Rio Grande do Sul' },
  61: { regiao: 'Brasília (Distrito Federal) e Entorno', estado: 'DF', uf: 'Distrito Federal' },
  62: { regiao: 'Goiânia e Região Metropolitana, Anápolis', estado: 'GO', uf: 'Goiás' },
  63: { regiao: 'Palmas e Estado do Tocantins', estado: 'TO', uf: 'Tocantins' },
  64: { regiao: 'Rio Verde, Jataí, Caldas Novas, Itumbiara', estado: 'GO', uf: 'Goiás' },
  65: { regiao: 'Cuiabá e Região Metropolitana', estado: 'MT', uf: 'Mato Grosso' },
  66: { regiao: 'Rondonópolis, Sinop e Interior', estado: 'MT', uf: 'Mato Grosso' },
  67: { regiao: 'Campo Grande, Dourados e Todo o Estado', estado: 'MS', uf: 'Mato Grosso do Sul' },
  68: { regiao: 'Rio Branco e Todo o Estado do Acre', estado: 'AC', uf: 'Acre' },
  69: { regiao: 'Porto Velho e Todo o Estado de Rondônia', estado: 'RO', uf: 'Rondônia' },
  71: { regiao: 'Salvador e Região Metropolitana', estado: 'BA', uf: 'Bahia' },
  73: { regiao: 'Ilhéus, Itabuna, Porto Seguro e Sul Baiano', estado: 'BA', uf: 'Bahia' },
  74: { regiao: 'Juazeiro e Região Norte da Bahia', estado: 'BA', uf: 'Bahia' },
  75: { regiao: 'Feira de Santana e Região', estado: 'BA', uf: 'Bahia' },
  77: { regiao: 'Vitória da Conquista, Barreiras e Oeste Baiano', estado: 'BA', uf: 'Bahia' },
  79: { regiao: 'Aracaju e Todo o Estado de Sergipe', estado: 'SE', uf: 'Sergipe' },
  81: { regiao: 'Recife e Região Metropolitana, Caruaru', estado: 'PE', uf: 'Pernambuco' },
  82: { regiao: 'Maceió e Todo o Estado de Alagoas', estado: 'AL', uf: 'Alagoas' },
  83: { regiao: 'João Pessoa, Campina Grande e Todo o Estado', estado: 'PB', uf: 'Paraíba' },
  84: { regiao: 'Natal, Mossoró e Todo o Estado', estado: 'RN', uf: 'Rio Grande do Norte' },
  85: { regiao: 'Fortaleza e Região Metropolitana', estado: 'CE', uf: 'Ceará' },
  86: { regiao: 'Teresina, Parnaíba e Região Norte', estado: 'PI', uf: 'Piauí' },
  87: { regiao: 'Petrolina, Garanhuns e Sertão Pernambucano', estado: 'PE', uf: 'Pernambuco' },
  88: { regiao: 'Juazeiro do Norte, Sobral e Interior', estado: 'CE', uf: 'Ceará' },
  89: { regiao: 'Picos, Floriano e Interior Piauiense', estado: 'PI', uf: 'Piauí' },
  91: { regiao: 'Belém e Região Metropolitana', estado: 'PA', uf: 'Pará' },
  92: { regiao: 'Manaus e Região Metropolitana', estado: 'AM', uf: 'Amazonas' },
  93: { regiao: 'Santarém, Altamira e Oeste do Pará', estado: 'PA', uf: 'Pará' },
  94: { regiao: 'Marabá, Parauapebas e Sudeste Paraense', estado: 'PA', uf: 'Pará' },
  95: { regiao: 'Boa Vista e Todo o Estado de Roraima', estado: 'RR', uf: 'Roraima' },
  96: { regiao: 'Macapá e Todo o Estado do Amapá', estado: 'AP', uf: 'Amapá' },
  97: { regiao: 'Interior e Oeste do Estado do Amazonas', estado: 'AM', uf: 'Amazonas' },
  98: { regiao: 'São Luís e Região Metropolitana', estado: 'MA', uf: 'Maranhão' },
  99: { regiao: 'Imperatriz e Interior do Maranhão', estado: 'MA', uf: 'Maranhão' },
};

// Países comuns e DDI
const DDIS = {
  '55': { pais: 'Brasil', iso: 'BR', flag: '🇧🇷', prefixo: '+55' },
  '1': { pais: 'Estados Unidos / Canadá', iso: 'US/CA', flag: '🇺🇸', prefixo: '+1' },
  '351': { pais: 'Portugal', iso: 'PT', flag: '🇵🇹', prefixo: '+351' },
  '34': { pais: 'Espanha', iso: 'ES', flag: '🇪🇸', prefixo: '+34' },
  '44': { pais: 'Reino Unido', iso: 'GB', flag: '🇬🇧', prefixo: '+44' },
  '49': { pais: 'Alemanha', iso: 'DE', flag: '🇩🇪', prefixo: '+49' },
  '33': { pais: 'França', iso: 'FR', flag: '🇫🇷', prefixo: '+33' },
  '39': { pais: 'Itália', iso: 'IT', flag: '🇮🇹', prefixo: '+39' },
  '54': { pais: 'Argentina', iso: 'AR', flag: '🇦🇷', prefixo: '+54' },
  '598': { pais: 'Uruguai', iso: 'UY', flag: '🇺🇾', prefixo: '+598' },
  '595': { pais: 'Paraguai', iso: 'PY', flag: '🇵🇾', prefixo: '+595' },
};

/**
 * Traduz o tipo de linha retornado pela API
 */
function traduzirTipoLinha(lineType) {
  if (!lineType) return 'Móvel (Celular)';
  const lt = String(lineType).toLowerCase();
  if (lt.includes('mobile')) return 'Móvel (Celular / Smartphone)';
  if (lt.includes('landline') || lt.includes('fixed')) return 'Fixo (Linha Cabeada / STFC)';
  if (lt.includes('voip')) return 'VoIP (Telefonia IP / Virtual)';
  if (lt.includes('toll_free')) return 'Toll-Free (0800 / Gratuito)';
  if (lt.includes('premium')) return 'Linha Premium / Serviços';
  return lineType;
}

/**
 * Normaliza e sanitiza um número de telefone bruto para E.164
 */
export function normalizarTelefone(raw) {
  let cleaned = String(raw).trim().replace(/[\s\-\(\)\.]/g, '');
  if (!cleaned.startsWith('+')) {
    // Se for 10 ou 11 dígitos puro, assume Brasil (+55)
    if (cleaned.length === 10 || cleaned.length === 11) {
      cleaned = '+55' + cleaned;
    } else if (cleaned.startsWith('55') && (cleaned.length === 12 || cleaned.length === 13)) {
      cleaned = '+' + cleaned;
    } else {
      cleaned = '+' + cleaned;
    }
  }
  return cleaned;
}

/**
 * Adapter central de inteligência de Telefone (Carrier Lookup API + Telecom Core)
 * @param {string} rawNumber
 * @returns {Promise<Object>}
 */
export async function consultarTelefone(rawNumber) {
  const normalized = normalizarTelefone(rawNumber);
  const digits = normalized.replace(/\D/g, '');

  let liveData = null;
  let apiAviso = null;

  // 1. Consulta à Carrier Lookup API (Omkar Cloud)
  try {
    const url = `${CARRIER_LOOKUP_API_URL}?phone=${encodeURIComponent(normalized)}`;
    const res = await httpRequest(url, {
      method: 'GET',
      headers: {
        'API-Key': CARRIER_LOOKUP_API_KEY,
        'Accept': 'application/json',
      },
      timeout: 7000,
    });

    if (res.ok && res.data && res.data.is_valid_number !== undefined) {
      liveData = res.data;
    } else if (res.data?.code === 'activation_required') {
      apiAviso = 'A chave da Carrier Lookup API requer ativação do plano gratuito no painel da Omkar Cloud.';
      console.warn('[CARRIER LOOKUP API WARN]:', res.data.message);
    }
  } catch (err) {
    console.warn(`[CARRIER LOOKUP API AVISO] Falha ao conectar (${err.message}). Usando Telecom Intelligence Core.`);
  }

  // 2. Processa com Telecom Engine e mescla com dados da Carrier API se disponíveis
  return processarAnalise(normalized, digits, liveData, apiAviso);
}

/**
 * Processamento e enriquecimento forense
 */
function processarAnalise(normalized, digits, liveData, apiAviso) {
  let ddi = '55';
  let countryInfo = DDIS['55'];

  if (digits.startsWith('55')) {
    ddi = '55';
    countryInfo = DDIS['55'];
  } else if (digits.startsWith('1')) {
    ddi = '1';
    countryInfo = DDIS['1'];
  } else if (digits.startsWith('351')) {
    ddi = '351';
    countryInfo = DDIS['351'];
  } else {
    for (const [code, info] of Object.entries(DDIS)) {
      if (digits.startsWith(code)) {
        ddi = code;
        countryInfo = info;
        break;
      }
    }
  }

  const isBrazil = ddi === '55';
  let formatoNacional = normalized;
  let formatoInternacional = normalized;
  let operadoraEstimada = 'Desconhecida / Portada';
  let tipoLinha = 'Móvel (Celular)';
  let regiao = 'Internacional';
  let estado = 'N/A';
  let ddd = '';

  if (isBrazil) {
    const semDdi = digits.slice(2);
    ddd = semDdi.slice(0, 2);
    const numeroLocal = semDdi.slice(2);
    const dddData = DDD_BRASIL[ddd];

    if (dddData) {
      regiao = dddData.regiao;
      estado = `${dddData.uf} (${dddData.estado})`;
    }

    if (numeroLocal.length === 9 && numeroLocal.startsWith('9')) {
      tipoLinha = 'Móvel (Celular / Smartphone)';
      formatoNacional = `(${ddd}) ${numeroLocal.slice(0, 5)}-${numeroLocal.slice(5)}`;
      formatoInternacional = `+55 ${ddd} ${numeroLocal.slice(0, 5)}-${numeroLocal.slice(5)}`;

      const digitoOperadora = parseInt(numeroLocal.charAt(1), 10);
      if ([7, 8, 9].includes(digitoOperadora)) {
        operadoraEstimada = 'Telefônica Brasil (Vivo)';
      } else if ([1, 2, 3].includes(digitoOperadora)) {
        operadoraEstimada = 'Claro Brasil (América Móvil)';
      } else if ([4, 5, 6].includes(digitoOperadora)) {
        operadoraEstimada = 'TIM Brasil Telecom';
      } else {
        operadoraEstimada = 'Operadora Móvel Regional / MVNO';
      }
    } else if (numeroLocal.length === 8) {
      const primeiroDigito = numeroLocal.charAt(0);
      if (['2', '3', '4', '5'].includes(primeiroDigito)) {
        tipoLinha = 'Fixo (Linha Telefônica Cabeada / STFC)';
        formatoNacional = `(${ddd}) ${numeroLocal.slice(0, 4)}-${numeroLocal.slice(4)}`;
        formatoInternacional = `+55 ${ddd} ${numeroLocal.slice(0, 4)}-${numeroLocal.slice(4)}`;
        operadoraEstimada = 'Concessionária Fixa Local (Oi / Vivo / Claro / Algar)';
      } else if (primeiroDigito === '9') {
        tipoLinha = 'Móvel Antigo (8 dígitos)';
        formatoNacional = `(${ddd}) 9${numeroLocal.slice(0, 4)}-${numeroLocal.slice(4)}`;
        formatoInternacional = `+55 ${ddd} ${numeroLocal}`;
      }
    }
  } else {
    formatoNacional = normalized;
    formatoInternacional = normalized;
    tipoLinha = 'Internacional / Móvel ou Fixo';
    regiao = countryInfo ? countryInfo.pais : 'Desconhecida';
    estado = countryInfo ? countryInfo.iso : 'N/A';
  }

  // Se a Carrier Lookup API respondeu com sucesso, sobrepõe com a inteligência ao vivo
  let operadoraFinal = operadoraEstimada;
  let tipoLinhaFinal = tipoLinha;
  let validoFinal = digits.length >= 10 && digits.length <= 15;
  let fonteFinal = 'Telecom Intelligence Core (Anatel Regulatory Footprint)';
  let carrierDetails = null;

  if (liveData) {
    if (liveData.carrier) {
      operadoraFinal = liveData.carrier;
    }
    if (liveData.line_type) {
      tipoLinhaFinal = traduzirTipoLinha(liveData.line_type);
    }
    if (liveData.is_valid_number !== undefined) {
      validoFinal = Boolean(liveData.is_valid_number);
    }
    if (liveData.national_format) {
      formatoNacional = liveData.national_format;
    }
    if (liveData.phone_number) {
      formatoInternacional = liveData.phone_number;
    }

    carrierDetails = {
      carrier: liveData.carrier,
      lineType: liveData.line_type,
      countryCode: liveData.country_code,
      callingCountryCode: liveData.calling_country_code,
      mcc: liveData.mobile_country_code,
      mnc: liveData.mobile_network_code,
    };

    fonteFinal = 'Carrier Lookup API (Omkar Cloud Live)';
  } else if (apiAviso) {
    fonteFinal = 'Telecom Intelligence Core (Carrier API pendente de ativação)';
  }

  // Gera Dorks do Google e Links de Footprint OSINT
  const plainDigits = digits;
  const dorks = [
    {
      nome: 'Busca Exata Geral',
      query: `"${normalized}" OR "${formatoNacional}"`,
      url: `https://www.google.com/search?q=${encodeURIComponent(`"${normalized}" OR "${formatoNacional}"`)}`,
    },
    {
      nome: 'Redes Sociais (Facebook, LinkedIn, Instagram)',
      query: `site:facebook.com OR site:linkedin.com OR site:instagram.com "${normalized}"`,
      url: `https://www.google.com/search?q=${encodeURIComponent(`site:facebook.com OR site:linkedin.com OR site:instagram.com "${normalized}"`)}`,
    },
    {
      nome: 'Documentos e Listas Expostas (PDF/XLSX/TXT)',
      query: `filetype:pdf OR filetype:xlsx OR filetype:txt "${normalized}"`,
      url: `https://www.google.com/search?q=${encodeURIComponent(`filetype:pdf OR filetype:xlsx OR filetype:txt "${normalized}"`)}`,
    },
    {
      nome: 'Queixas de Spam / Telemarketing (Quem Perturba)',
      query: `quem liga "${formatoNacional}" OR "spam"`,
      url: `https://www.google.com/search?q=${encodeURIComponent(`"${formatoNacional}" OR "${normalized}" spam OR golpe`)}`,
    },
  ];

  const linksDiretos = {
    whatsapp: `https://wa.me/${plainDigits}`,
    telegram: `https://t.me/+${plainDigits}`,
    truecaller: `https://www.truecaller.com/search/br/${plainDigits}`,
    syncme: `https://sync.me/search/?number=${plainDigits}`,
  };

  return {
    consulta: normalized,
    valido: validoFinal,
    pais: countryInfo?.pais || 'Internacional',
    bandeira: countryInfo?.flag || '🌐',
    iso: liveData?.country_code || countryInfo?.iso || 'XX',
    ddi: `+${ddi}`,
    ddd: ddd || null,
    estado,
    regiao,
    formatoE164: normalized,
    formatoNacional,
    formatoInternacional,
    tipoLinha: tipoLinhaFinal,
    operadora: operadoraFinal,
    portabilidadeNota: liveData
      ? 'Dados obtidos diretamente da Carrier Lookup API (Omkar Cloud).'
      : 'Operadora baseada em faixa regulatória ANATEL. Números portados podem ter migrado.',
    carrierDetails,
    apiAviso,
    linksDiretos,
    dorks,
    fonte: fonteFinal,
    timestamp: new Date().toISOString(),
  };
}
