import dns from 'dns/promises';
import tls from 'tls';
import { httpRequest } from '../core/httpClient.js';

/**
 * ==============================================================================
 * RIMUBUSCA - MÓDULO OSINT DE DOMÍNIO & DNS (DOMINIOSERVICE.JS)
 * Resolução completa de DNS (A, AAAA, MX, TXT, NS, SOA), verificação de SSL/TLS,
 * análise de cabeçalhos de segurança HTTP, RDAP/WHOIS e Google Dorks.
 * ==============================================================================
 */

/**
 * Investiga um domínio com profundidade técnica e OSINT
 * @param {string} rawDomain
 * @returns {Promise<Object>}
 */
export async function investigarDominio(rawDomain) {
  // Limpeza de protocolo e caminhos: https://www.exemplo.com.br/path -> exemplo.com.br
  let domain = rawDomain.trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/:\d+$/, '');

  if (!domain || !domain.includes('.') || domain.length < 3) {
    throw new Error('Nome de domínio inválido.');
  }

  // 1. Resoluções DNS em Paralelo
  const [dnsA, dnsAaaa, dnsMx, dnsTxt, dnsNs, dnsSoa] = await Promise.allSettled([
    dns.resolve4(domain),
    dns.resolve6(domain),
    dns.resolveMx(domain),
    dns.resolveTxt(domain),
    dns.resolveNs(domain),
    dns.resolveSoa(domain),
  ]);

  const registrosA = dnsA.status === 'fulfilled' ? dnsA.value : [];
  const registrosAaaa = dnsAaaa.status === 'fulfilled' ? dnsAaaa.value : [];
  const registrosMx = dnsMx.status === 'fulfilled' ? dnsMx.value.sort((a, b) => a.priority - b.priority) : [];
  const registrosTxt = dnsTxt.status === 'fulfilled' ? dnsTxt.value.map((v) => v.join(' ')) : [];
  const registrosNs = dnsNs.status === 'fulfilled' ? dnsNs.value : [];
  const registroSoa = dnsSoa.status === 'fulfilled' ? dnsSoa.value : null;

  const dnsAtivo = registrosA.length > 0 || registrosMx.length > 0;

  // 2. Análise de Segurança HTTP (Cabeçalhos e Servidor)
  const httpSecurity = await analisarSegurancaHttp(domain);

  // 3. Inspeção de Certificado SSL/TLS
  const sslInfo = await obterCertificadoSsl(domain);

  // 4. Consulta WHOIS / RDAP
  const whoisInfo = await consultarWhoisRdap(domain);

  // 5. Cálculo do Score de Segurança do Domínio (0 a 100)
  let securityScore = 40; // Base
  if (sslInfo?.isValid) securityScore += 20;
  if (httpSecurity.headers.hsts) securityScore += 10;
  if (httpSecurity.headers.csp) securityScore += 10;
  if (httpSecurity.headers.xFrameOptions) securityScore += 10;
  if (registrosMx.length > 0) securityScore += 5;
  if (registrosTxt.some((t) => t.includes('v=spf1'))) securityScore += 5;
  securityScore = Math.min(securityScore, 100);

  // 6. Google Dorks de Reconhecimento de Infraestrutura
  const dorks = [
    {
      titulo: 'Subdomínios Expostos',
      query: `site:${domain} -www`,
      url: `https://www.google.com/search?q=${encodeURIComponent(`site:${domain} -www`)}`,
    },
    {
      titulo: 'Documentos e Planilhas Públicas',
      query: `site:${domain} filetype:pdf OR filetype:xls OR filetype:xlsx OR filetype:docx`,
      url: `https://www.google.com/search?q=${encodeURIComponent(`site:${domain} filetype:pdf OR filetype:xls OR filetype:xlsx OR filetype:docx`)}`,
    },
    {
      titulo: 'Painéis Administrativos e Login',
      query: `site:${domain} inurl:admin OR inurl:login OR inurl:portal OR inurl:painel`,
      url: `https://www.google.com/search?q=${encodeURIComponent(`site:${domain} inurl:admin OR inurl:login OR inurl:portal OR inurl:painel`)}`,
    },
    {
      titulo: 'Arquivos Sensíveis (.env, .sql, .log)',
      query: `site:${domain} ext:env OR ext:sql OR ext:log OR ext:bkp OR ext:config`,
      url: `https://www.google.com/search?q=${encodeURIComponent(`site:${domain} ext:env OR ext:sql OR ext:log OR ext:bkp OR ext:config`)}`,
    },
    {
      titulo: 'Vazamentos no GitHub',
      query: `site:github.com "${domain}"`,
      url: `https://www.google.com/search?q=${encodeURIComponent(`site:github.com "${domain}"`)}`,
    },
    {
      titulo: 'Certificados em crt.sh (Transparência)',
      query: `https://crt.sh/?q=%25.${domain}`,
      url: `https://crt.sh/?q=%25.${domain}`,
      isDirectUrl: true,
    },
  ];

  return {
    dominio: domain,
    dns: {
      ativo: dnsAtivo,
      a: registrosA,
      aaaa: registrosAaaa,
      mx: registrosMx,
      ns: registrosNs,
      txt: registrosTxt,
      soa: registroSoa,
    },
    ssl: sslInfo,
    http: httpSecurity,
    whois: whoisInfo,
    scoreSeguranca: securityScore,
    dorks,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Inspeciona cabeçalhos HTTP e tecnologias do servidor
 */
async function analisarSegurancaHttp(domain) {
  const result = {
    online: false,
    statusCode: null,
    server: 'Não divulgado',
    poweredBy: null,
    redirectsToHttps: false,
    headers: {
      hsts: false,
      csp: false,
      xFrameOptions: null,
      xContentTypeOptions: false,
      referrerPolicy: null,
    },
  };

  try {
    const response = await httpRequest(`https://${domain}`, {
      method: 'GET',
      timeout: 5000,
    });

    result.online = true;
    result.statusCode = response.status;
    result.redirectsToHttps = true;

    // Detecta cabeçalhos
    const headers = response.headers || {};
    result.server = headers['server'] || 'Protegido / Oculto';
    result.poweredBy = headers['x-powered-by'] || null;

    result.headers.hsts = !!headers['strict-transport-security'];
    result.headers.csp = !!headers['content-security-policy'];
    result.headers.xFrameOptions = headers['x-frame-options'] || null;
    result.headers.xContentTypeOptions = headers['x-content-type-options'] === 'nosniff';
    result.headers.referrerPolicy = headers['referrer-policy'] || null;
  } catch (err) {
    // Tenta fallback HTTP se HTTPS falhar
    try {
      const fallbackRes = await httpRequest(`http://${domain}`, {
        method: 'HEAD',
        timeout: 4000,
      });
      result.online = true;
      result.statusCode = fallbackRes.status;
      result.server = fallbackRes.headers?.['server'] || 'Detectado via HTTP';
    } catch {
      result.online = false;
    }
  }

  return result;
}

/**
 * Obtém detalhes do certificado SSL/TLS via socket nativo
 */
function obterCertificadoSsl(domain) {
  return new Promise((resolve) => {
    const socket = tls.connect(443, domain, { servername: domain, timeout: 4500 }, () => {
      try {
        const cert = socket.getPeerCertificate();
        socket.destroy();

        if (!cert || !cert.subject) {
          return resolve(null);
        }

        const validTo = new Date(cert.valid_to);
        const daysRemaining = Math.max(0, Math.floor((validTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

        resolve({
          emissor: cert.issuer?.O || cert.issuer?.CN || 'Autoridade Certificadora Desconhecida',
          titular: cert.subject?.CN || domain,
          validoDe: cert.valid_from,
          validoAte: cert.valid_to,
          diasRestantes: daysRemaining,
          isValid: daysRemaining > 0,
          san: cert.subjectaltname ? cert.subjectaltname.split(', ') : [],
        });
      } catch {
        resolve(null);
      }
    });

    socket.on('error', () => resolve(null));
    socket.on('timeout', () => {
      socket.destroy();
      resolve(null);
    });
  });
}

/**
 * Realiza consulta WHOIS ou RDAP (Registro.br ou IANA)
 */
function extractVcardFields(entity) {
  const fields = { nome: null, email: null, kind: null };
  const entries = entity?.vcardArray?.[1];
  if (!Array.isArray(entries)) return fields;

  for (const item of entries) {
    if (!Array.isArray(item) || item.length < 4) continue;
    const key = String(item[0] || "").toLowerCase();
    const val = item[3];
    if (key === "fn" && val) fields.nome = String(val).trim();
    if (key === "email" && val) fields.email = String(val).trim();
    if (key === "kind" && val) fields.kind = String(val).trim();
  }
  return fields;
}

function formatarDocumentoBr(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }
  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  return raw;
}

function formatarIdadeDominio(dias) {
  if (dias === null || dias === undefined || !Number.isFinite(dias) || dias < 0) return null;
  if (dias === 0) return "Registrado hoje (0 dias)";
  if (dias < 30) return `${dias} ${dias === 1 ? "dia" : "dias"}`;
  const meses = Math.floor(dias / 30);
  if (dias < 365) return `${meses} ${meses === 1 ? "mês" : "meses"} (${dias} dias)`;
  const anos = Math.floor(dias / 365);
  const mesesRest = Math.floor((dias % 365) / 30);
  return mesesRest > 0
    ? `${anos} ${anos === 1 ? "ano" : "anos"} e ${mesesRest} ${mesesRest === 1 ? "mês" : "meses"} (${dias} dias)`
    : `${anos} ${anos === 1 ? "ano" : "anos"} (${dias} dias)`;
}

async function consultarResumoCnpjSeguro(cnpjLimpo) {
  try {
    const { consultarCnpjOficial } = await import("./cnpj.service.js");
    const cnpjResult = await Promise.race([
      consultarCnpjOficial(cnpjLimpo),
      new Promise((_, reject) => setTimeout(() => reject(new Error("CNPJ enrichment timeout")), 3500)),
    ]);
    if (!cnpjResult || typeof cnpjResult !== "object") return null;
    const raw = cnpjResult.resultado || cnpjResult;
    return {
      cnpj: raw.cnpj || formatarDocumentoBr(cnpjLimpo),
      cnpjLimpo,
      razaoSocial: raw.razaoSocial || raw.razao_social || raw.nome || null,
      nomeFantasia: raw.nomeFantasia || raw.nome_fantasia || null,
      situacaoCadastral: raw.situacaoCadastral || raw.situacao || null,
      dataAbertura: raw.dataAbertura || raw.data_inicio_atividade || null,
      municipio: raw.municipio || null,
      uf: raw.uf || null,
      cnaePrincipal: raw.cnaePrincipal || null,
      totalSocios: Array.isArray(raw.sociosQSA) ? raw.sociosQSA.length : Array.isArray(raw.qsa) ? raw.qsa.length : 0,
    };
  } catch {
    return null;
  }
}

/**
 * Extrai estruturalmente titular, CNPJ/CPF (publicIds), e-mails e idade de um payload RDAP.
 */
export function parsearRdapRegistroPayload(domain, data) {
  const isBr = String(domain || "").toLowerCase().endsWith(".br");
  const statusList = data?.status || [];
  const events = data?.events || [];

  const registrationEvent = events.find((e) => e.eventAction === "registration");
  const expirationEvent = events.find((e) => e.eventAction === "expiration");
  const lastChangedEvent = events.find((e) => e.eventAction === "last changed");

  const criadoEm = registrationEvent?.eventDate || null;
  const expiraEm = expirationEvent?.eventDate || null;

  let idadeDias = null;
  if (criadoEm) {
    const createdMs = Date.parse(criadoEm);
    if (!Number.isNaN(createdMs)) {
      idadeDias = Math.max(0, Math.floor((Date.now() - createdMs) / 86400000));
    }
  }

  let diasParaExpirar = null;
  if (expiraEm) {
    const expMs = Date.parse(expiraEm);
    if (!Number.isNaN(expMs)) {
      diasParaExpirar = Math.ceil((expMs - Date.now()) / 86400000);
    }
  }

  const alertaDominioRecente = idadeDias !== null && idadeDias < 90;
  const nivelRiscoIdade =
    idadeDias === null
      ? "DESCONHECIDO"
      : idadeDias < 30
        ? "CRÍTICO"
        : idadeDias < 90
          ? "ATENÇÃO"
          : "ESTABELECIDO";

  let titular = "Privado / Protegido por Whois Privacy";
  let documento = null;
  let documentoLimpo = null;
  let documentoTipo = null;
  let documentoMascarado = false;
  let responsavelLegal = null;
  let tipoTitular = null;
  let emailTitular = null;
  let titularHandle = null;
  const emailsContato = new Set();
  const contatos = [];

  if (Array.isArray(data?.entities) && data.entities.length > 0) {
    for (const ent of data.entities) {
      const vcard = extractVcardFields(ent);
      if (vcard.email) emailsContato.add(vcard.email);
      contatos.push({
        roles: ent.roles || [],
        handle: ent.handle || null,
        nome: vcard.nome || ent.handle || null,
        email: vcard.email || null,
      });
    }

    const titularEntity =
      data.entities.find((e) => Array.isArray(e.roles) && e.roles.includes("registrant")) ||
      data.entities[0];

    if (titularEntity) {
      const vcardTitular = extractVcardFields(titularEntity);
      titular = vcardTitular.nome || titularEntity.handle || titular;
      tipoTitular = vcardTitular.kind || null;
      emailTitular = vcardTitular.email || null;
      titularHandle = titularEntity.handle || null;
      responsavelLegal = titularEntity.legalRepresentative || null;

      const publicIds = Array.isArray(titularEntity.publicIds) ? titularEntity.publicIds : [];
      const docEntry =
        publicIds.find((p) => /cnpj|cpf|document|tax/i.test(String(p?.type || ""))) ||
        publicIds[0] ||
        null;

      if (docEntry?.identifier) {
        const rawDoc = String(docEntry.identifier).trim();
        const isMasked = rawDoc.includes("*");
        const digits = rawDoc.replace(/\D/g, "");
        const typeHint = String(docEntry.type || "").toLowerCase();

        documentoMascarado = isMasked;
        documento = isMasked ? rawDoc : formatarDocumentoBr(rawDoc);

        if (typeHint.includes("cnpj") || (!isMasked && digits.length === 14)) {
          documentoTipo = "cnpj";
          if (!isMasked && digits.length === 14) documentoLimpo = digits;
        } else if (typeHint.includes("cpf") || (!isMasked && digits.length === 11) || isMasked) {
          documentoTipo = "cpf";
          if (!isMasked && digits.length === 11) documentoLimpo = digits;
        }
      } else if (
        titularEntity.legalRepresentative &&
        /^\d[\d./-]+\d$/.test(String(titularEntity.legalRepresentative).trim())
      ) {
        const digits = String(titularEntity.legalRepresentative).replace(/\D/g, "");
        if (digits.length === 14 || digits.length === 11) {
          documento = formatarDocumentoBr(digits);
          documentoLimpo = digits;
          documentoTipo = digits.length === 14 ? "cnpj" : "cpf";
        }
      }
    }
  }

  return {
    fonte: isBr ? "Registro.br (RDAP Oficial)" : "RDAP.org (ICANN)",
    handle: data?.handle || domain,
    titular,
    titularHandle,
    tipoTitular,
    documento,
    documentoLimpo,
    documentoTipo,
    documentoMascarado,
    responsavelLegal,
    emailTitular,
    emailsContato: Array.from(emailsContato),
    contatos,
    empresaTitular: null,
    status: statusList,
    criadoEm,
    expiraEm,
    atualizadoEm: lastChangedEvent?.eventDate || null,
    idadeDias,
    idadeFormatada: formatarIdadeDominio(idadeDias),
    diasParaExpirar,
    alertaDominioRecente,
    nivelRiscoIdade,
    nameservers: data?.nameservers?.map((ns) => ns.ldhName || ns) || [],
  };
}

export async function consultarWhoisRdap(domain) {
  const isBr = domain.endsWith('.br');
  const rdapUrl = isBr
    ? `https://rdap.registro.br/domain/${encodeURIComponent(domain)}`
    : `https://rdap.org/domain/${encodeURIComponent(domain)}`;

  try {
    const response = await httpRequest(rdapUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/rdap+json, application/json',
        'User-Agent': 'RimuBusca-OSINT/1.0',
      },
      timeout: 5500,
    });

    if (response.status === 200 && response.data) {
      const parsed = parsearRdapRegistroPayload(domain, response.data);

      // Se domínio .br revelou CNPJ completo do titular, busca resumo cadastral oficial (sem bloquear)
      if (isBr && parsed.documentoTipo === 'cnpj' && parsed.documentoLimpo && parsed.documentoLimpo.length === 14) {
        const empresaTitular = await consultarResumoCnpjSeguro(parsed.documentoLimpo);
        if (empresaTitular) {
          parsed.empresaTitular = empresaTitular;
          if (
            empresaTitular.razaoSocial &&
            (parsed.titular === 'Privado / Protegido por Whois Privacy' || parsed.titular === parsed.titularHandle)
          ) {
            parsed.titular = empresaTitular.razaoSocial;
          }
        }
      }

      return parsed;
    }
  } catch (err) {
    console.warn(`[RDAP AVISO] Falha ao consultar RDAP para ${domain}:`, err.message);
  }

  // Fallback estruturado
  return {
    fonte: 'Zona Local / WHOIS Cache',
    handle: domain,
    titular: 'Informações protegidas ou servidor WHOIS indisponível',
    status: ['active'],
    criadoEm: null,
    expiraEm: null,
    atualizadoEm: null,
    nameservers: [],
  };
}

