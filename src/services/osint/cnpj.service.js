/**
 * ==============================================================================
 * RIMUBUSCA - SERVIÇO OFICIAL DE CONSULTA CNPJ (CNPJ.SERVICE.JS)
 * Consulta cadastral corporativa, quadro societário (QSA), atividades econômicas
 * (CNAE) e situação cadastral com Tolerância a Falhas Multi-Provider:
 *
 * 1. Minha Receita (Open-source, base da Receita Federal, sem restrição Cloudflare)
 * 2. BrasilAPI v1 (com User-Agent moderno para contornar HTTP 403 do Cloudflare)
 * 3. ReceitaWS (API pública de consulta com espelho oficial)
 * 4. CNPJ.ws Pública (Fallback adicional de contingência)
 * ==============================================================================
 */

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 RimuBuscas/1.0";

const HTTP_HEADERS = {
  "User-Agent": BROWSER_USER_AGENT,
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "Cache-Control": "no-cache",
};

/**
 * Formata número de CNPJ para XX.XXX.XXX/XXXX-XX
 */
export function formatarCnpj(cnpj) {
  const digits = String(cnpj || "").replace(/\D/g, "");
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }
  return String(cnpj || "");
}

/**
 * Formata CEP para XXXXX-XXX
 */
export function formatarCep(cep) {
  if (!cep) return null;
  const digits = String(cep).replace(/\D/g, "");
  if (digits.length === 8) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return String(cep);
}

/**
 * Formata número de telefone brasileiro com DDD
 */
export function formatarTelefone(telStr) {
  if (!telStr) return null;
  const digits = String(telStr).replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length > 2) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  return String(telStr).trim() || null;
}

/**
 * Formata valor de capital social para R$ XX.XXX,XX
 */
export function formatarCapitalSocial(val) {
  if (val === null || val === undefined || val === "") return "Não informado";
  const num = typeof val === "number" ? val : parseFloat(String(val).replace(/[^\d.-]/g, ""));
  if (!isNaN(num)) {
    return `R$ ${num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return String(val);
}

/**
 * Normaliza os dados retornados pela BrasilAPI ou Minha Receita
 */
export function normalizarBrasilApiCnpj(d, rawCnpj) {
  const cnpjLimpo = String(rawCnpj || d.cnpj || "").replace(/\D/g, "");
  const cnpjFmt = formatarCnpj(cnpjLimpo);

  const cepFmt = formatarCep(d.cep);
  const enderecoFormatado = [
    [d.descricao_tipo_de_logradouro, d.logradouro].filter(Boolean).join(" "),
    d.numero ? `nº ${d.numero}` : null,
    d.complemento ? `(${d.complemento})` : null,
    d.bairro ? `- ${d.bairro}` : null,
    d.municipio ? `${d.municipio}/${d.uf || ""}` : null,
    cepFmt ? `CEP ${cepFmt}` : null,
  ].filter(Boolean).join(", ");

  const socios = (Array.isArray(d.qsa) ? d.qsa : []).map((s) => ({
    nome: s.nome_socio || s.nome || "Sócio",
    qualificacao: s.qualificacao_socio || s.qualificacao || "Sócio",
    cpf: s.cnpj_cpf_do_socio || s.cpf || null,
    faixaEtaria: s.faixa_etaria || null,
    dataEntrada: s.data_entrada_sociedade || null,
  }));

  const cnaeSecundarios = (Array.isArray(d.cnaes_secundarios) ? d.cnaes_secundarios : []).map((c) => ({
    codigo: c.codigo ? String(c.codigo) : "",
    descricao: c.descricao || "",
  }));

  const tipoMatriz =
    d.descricao_identificador_matriz_filial ||
    (d.identificador_matriz_filial === 2 || (!cnpjLimpo.endsWith("0001") && cnpjLimpo.slice(8, 12) !== "0001")
      ? "FILIAL"
      : "MATRIZ");

  return {
    cnpj: cnpjFmt,
    cnpj_limpo: cnpjLimpo,
    razaoSocial: d.razao_social || "Razão Social Não Informada",
    nomeFantasia: d.nome_fantasia || "Não informado",
    situacaoCadastral: d.descricao_situacao_cadastral || (d.situacao_cadastral === 2 ? "ATIVA" : "BAIXADA"),
    dataAbertura: d.data_inicio_atividade || null,
    dataSituacaoCadastral: d.data_situacao_cadastral || null,
    motivoSituacaoCadastral: d.descricao_motivo_situacao_cadastral || null,
    naturezaJuridica: d.natureza_juridica || null,
    porte: d.porte || "Não informado",
    capitalSocial: formatarCapitalSocial(d.capital_social),
    cnaePrincipal: {
      codigo: d.cnae_fiscal ? String(d.cnae_fiscal) : "",
      descricao: d.cnae_fiscal_descricao || "Atividade principal",
    },
    cnaesSecundarios: cnaeSecundarios,
    tipoMatrizFilial: tipoMatriz,
    sociosQSA: socios,
    totalSocios: socios.length,
    endereco: enderecoFormatado || "Não informado",
    logradouro: d.logradouro || null,
    numero: d.numero || null,
    complemento: d.complemento || null,
    bairro: d.bairro || null,
    municipio: d.municipio || null,
    uf: d.uf || null,
    cep: cepFmt,
    telefone: formatarTelefone(d.ddd_telefone_1),
    telefone2: formatarTelefone(d.ddd_telefone_2),
    email: d.email || null,
  };
}

/**
 * Normaliza os dados retornados pela ReceitaWS
 */
export function normalizarReceitaWsCnpj(d, rawCnpj) {
  const cnpjLimpo = String(rawCnpj || d.cnpj || "").replace(/\D/g, "");
  const cnpjFmt = formatarCnpj(cnpjLimpo);
  const cepFmt = formatarCep(d.cep);

  const enderecoFormatado = [
    d.logradouro,
    d.numero ? `nº ${d.numero}` : null,
    d.complemento ? `(${d.complemento})` : null,
    d.bairro ? `- ${d.bairro}` : null,
    d.municipio ? `${d.municipio}/${d.uf || ""}` : null,
    cepFmt ? `CEP ${cepFmt}` : null,
  ].filter(Boolean).join(", ");

  const socios = (Array.isArray(d.qsa) ? d.qsa : []).map((s) => ({
    nome: s.nome || "Sócio",
    qualificacao: s.qual || "Sócio",
    cpf: s.cpf || null,
    faixaEtaria: null,
    dataEntrada: null,
  }));

  const atvPrincipal =
    Array.isArray(d.atividade_principal) && d.atividade_principal[0] ? d.atividade_principal[0] : {};
  const cnaeSecundarios = (Array.isArray(d.atividades_secundarias) ? d.atividades_secundarias : []).map((c) => ({
    codigo: c.code ? String(c.code).replace(/\D/g, "") : "",
    descricao: c.text || "",
  }));

  const tipoMatriz =
    d.tipo ||
    (!cnpjLimpo.endsWith("0001") && cnpjLimpo.slice(8, 12) !== "0001" ? "FILIAL" : "MATRIZ");

  return {
    cnpj: cnpjFmt,
    cnpj_limpo: cnpjLimpo,
    razaoSocial: d.nome || "Razão Social Não Informada",
    nomeFantasia: d.fantasia || "Não informado",
    situacaoCadastral: d.situacao || "ATIVA",
    dataAbertura: d.abertura || null,
    dataSituacaoCadastral: d.data_situacao || null,
    motivoSituacaoCadastral: d.motivo_situacao || null,
    naturezaJuridica: d.natureza_juridica || null,
    porte: d.porte || "Não informado",
    capitalSocial: formatarCapitalSocial(d.capital_social),
    cnaePrincipal: {
      codigo: atvPrincipal.code ? String(atvPrincipal.code).replace(/\D/g, "") : "",
      descricao: atvPrincipal.text || "Atividade principal",
    },
    cnaesSecundarios: cnaeSecundarios,
    tipoMatrizFilial: tipoMatriz,
    sociosQSA: socios,
    totalSocios: socios.length,
    endereco: enderecoFormatado || "Não informado",
    logradouro: d.logradouro || null,
    numero: d.numero || null,
    complemento: d.complemento || null,
    bairro: d.bairro || null,
    municipio: d.municipio || null,
    uf: d.uf || null,
    cep: cepFmt,
    telefone: formatarTelefone(d.telefone),
    telefone2: null,
    email: d.email || null,
  };
}

/**
 * Normaliza os dados retornados pela CNPJ.ws Pública
 */
export function normalizarCnpjWs(d, rawCnpj) {
  const est = d.estabelecimento || {};
  const cnpjLimpo = String(rawCnpj || est.cnpj || "").replace(/\D/g, "");
  const cnpjFmt = formatarCnpj(cnpjLimpo);
  const cepFmt = formatarCep(est.cep);

  const enderecoFormatado = [
    [est.tipo_logradouro, est.logradouro].filter(Boolean).join(" "),
    est.numero ? `nº ${est.numero}` : null,
    est.complemento ? `(${est.complemento})` : null,
    est.bairro ? `- ${est.bairro}` : null,
    est.cidade?.nome ? `${est.cidade.nome}/${est.estado?.sigla || ""}` : null,
    cepFmt ? `CEP ${cepFmt}` : null,
  ].filter(Boolean).join(", ");

  const socios = (Array.isArray(d.socios) ? d.socios : []).map((s) => ({
    nome: s.nome || "Sócio",
    qualificacao: s.qualificacao_socio?.descricao || "Sócio",
    cpf: s.cpf_cnpj_socio || null,
    faixaEtaria: s.faixa_etaria || null,
    dataEntrada: s.data_entrada || null,
  }));

  const atvPrincipal = est.atividade_principal || {};
  const cnaeSecundarios = (Array.isArray(est.atividades_secundarias) ? est.atividades_secundarias : []).map((c) => ({
    codigo: c.id ? String(c.id) : (c.subclasse ? String(c.subclasse) : ""),
    descricao: c.descricao || "",
  }));

  const tel1 = est.ddd1 && est.telefone1 ? `${est.ddd1}${est.telefone1}` : null;
  const tel2 = est.ddd2 && est.telefone2 ? `${est.ddd2}${est.telefone2}` : null;

  return {
    cnpj: cnpjFmt,
    cnpj_limpo: cnpjLimpo,
    razaoSocial: d.razao_social || "Razão Social Não Informada",
    nomeFantasia: est.nome_fantasia || "Não informado",
    situacaoCadastral: est.situacao_cadastral || "ATIVA",
    dataAbertura: est.data_inicio_atividade || null,
    dataSituacaoCadastral: est.data_situacao_cadastral || null,
    motivoSituacaoCadastral: est.motivo_situacao_cadastral?.descricao || null,
    naturezaJuridica: d.natureza_juridica?.descricao || null,
    porte: d.porte?.descricao || "Não informado",
    capitalSocial: formatarCapitalSocial(d.capital_social),
    cnaePrincipal: {
      codigo: atvPrincipal.id ? String(atvPrincipal.id) : (atvPrincipal.subclasse ? String(atvPrincipal.subclasse) : ""),
      descricao: atvPrincipal.descricao || "Atividade principal",
    },
    cnaesSecundarios: cnaeSecundarios,
    tipoMatrizFilial: est.tipo || (cnpjLimpo.slice(8, 12) === "0001" ? "MATRIZ" : "FILIAL"),
    sociosQSA: socios,
    totalSocios: socios.length,
    endereco: enderecoFormatado || "Não informado",
    logradouro: est.logradouro || null,
    numero: est.numero || null,
    complemento: est.complemento || null,
    bairro: est.bairro || null,
    municipio: est.cidade?.nome || null,
    uf: est.estado?.sigla || null,
    cep: cepFmt,
    telefone: formatarTelefone(tel1),
    telefone2: formatarTelefone(tel2),
    email: est.email || null,
  };
}

/**
 * Consulta oficial de CNPJ com tolerância a falhas e multi-provider fallback
 * @param {string} rawCnpj - CNPJ pesquisado com ou sem formatação
 * @returns {Promise<Object>} Dados normalizados do CNPJ
 */
export async function consultarCnpjOficial(rawCnpj) {
  const cleanCnpj = String(rawCnpj || "").replace(/\D/g, "");

  if (cleanCnpj.length !== 14) {
    throw new Error("Informe um CNPJ válido com 14 dígitos numéricos.");
  }

  // Lista ordenada de provedores oficiais/espelho
  const providers = [
    {
      name: "Minha Receita",
      url: `https://minhareceita.org/${cleanCnpj}`,
      headers: HTTP_HEADERS,
      timeoutMs: 8000,
      parser: async (res) => {
        if (res.status === 404) return { notFound: true };
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return normalizarBrasilApiCnpj(data, cleanCnpj);
      },
    },
    {
      name: "BrasilAPI",
      url: `https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`,
      headers: HTTP_HEADERS,
      timeoutMs: 8000,
      parser: async (res) => {
        if (res.status === 404) return { notFound: true };
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return normalizarBrasilApiCnpj(data, cleanCnpj);
      },
    },
    {
      name: "ReceitaWS",
      url: `https://receitaws.com.br/v1/cnpj/${cleanCnpj}`,
      headers: HTTP_HEADERS,
      timeoutMs: 8000,
      parser: async (res) => {
        if (res.status === 404) return { notFound: true };
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.status === "ERROR") {
          if (data.message && /não encontrado|inválido/i.test(data.message)) {
            return { notFound: true };
          }
          throw new Error(data.message || "Erro no retorno da ReceitaWS");
        }
        return normalizarReceitaWsCnpj(data, cleanCnpj);
      },
    },
    {
      name: "CNPJ.ws",
      url: `https://publica.cnpj.ws/cnpj/${cleanCnpj}`,
      headers: HTTP_HEADERS,
      timeoutMs: 8000,
      parser: async (res) => {
        if (res.status === 404) return { notFound: true };
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return normalizarCnpjWs(data, cleanCnpj);
      },
    },
  ];

  let lastError = null;
  let notFoundCount = 0;

  for (const provider of providers) {
    try {
      console.log(`[CNPJ OFICIAL] Consultando CNPJ ${cleanCnpj} via provedor '${provider.name}'...`);
      const ctrl = new AbortController();
      const tm = setTimeout(() => ctrl.abort(), provider.timeoutMs);

      const resp = await fetch(provider.url, {
        headers: provider.headers,
        signal: ctrl.signal,
      });
      clearTimeout(tm);

      const parsed = await provider.parser(resp);

      if (parsed?.notFound) {
        console.warn(`[CNPJ OFICIAL] Provedor '${provider.name}' informou que CNPJ não foi localizado.`);
        notFoundCount++;
        // Tenta o próximo provedor caso haja atraso na sincronização entre bases
        continue;
      }

      if (parsed && (parsed.razaoSocial || parsed.cnpj)) {
        console.log(`[CNPJ OFICIAL SUCESSO] CNPJ ${cleanCnpj} consultado com êxito via '${provider.name}'.`);
        return parsed;
      }
    } catch (err) {
      console.warn(`[CNPJ OFICIAL AVISO] Falha no provedor '${provider.name}': ${err.message}`);
      lastError = err;
    }
  }

  // Se algum provedor respondeu explicitamente 404/não localizado e nenhum retornou dados
  if (notFoundCount > 0) {
    throw new Error("CNPJ não localizado na base oficial da Receita Federal.");
  }

  throw new Error(
    lastError?.message
      ? `Falha ao consultar CNPJ na base da Receita Federal (${lastError.message}). Tente novamente em instantes.`
      : "Falha na comunicação com o serviço oficial de consultas de CNPJ."
  );
}

export default {
  consultarCnpjOficial,
  normalizarBrasilApiCnpj,
  normalizarReceitaWsCnpj,
  normalizarCnpjWs,
  formatarCnpj,
  formatarCep,
  formatarTelefone,
  formatarCapitalSocial,
};
