/**
 * ==============================================================================
 * RIMUBUSCA - BACKEND COMPANY / CNPJ INTERPRETER (COMPANY.INTERPRETER.JS)
 * Padroniza e normaliza dados cadastrais de Pessoas Jurídicas (CNPJ),
 * quadro de sócios (QSA), atividades econômicas (CNAE) e situação cadastral.
 * ==============================================================================
 */

export function normalizeCnpjRecord(raw) {
  if (!raw || typeof raw !== "object") return raw;

  const cleanCnpj = String(raw.cnpj || raw.cnpj_limpo || "").replace(/\D/g, "");
  const formattedCnpj = cleanCnpj.length === 14
    ? cleanCnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
    : raw.cnpj || "Não informado";

  // Quadro Societário (QSA)
  const rawSocios = Array.isArray(raw.sociosQSA)
    ? raw.sociosQSA
    : Array.isArray(raw.qsa)
    ? raw.qsa
    : Array.isArray(raw.socios)
    ? raw.socios
    : Array.isArray(raw.quadro_societario)
    ? raw.quadro_societario
    : [];

  const sociosQSA = rawSocios.map((s) => {
    const rawDoc = String(s.cpf || s.cnpj_cpf_do_socio || s.documento || "").replace(/\D/g, "");
    let docFormatado = rawDoc;
    if (rawDoc.length === 11) {
      docFormatado = rawDoc.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
    } else if (rawDoc.length === 14) {
      docFormatado = rawDoc.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
    }

    return {
      nome: s.nome || s.nome_socio || s.nomeSocio || "Sócio",
      qualificacao: s.qualificacao || s.qualificacao_socio || s.qualificacaoSocio || "Sócio",
      cpf: rawDoc || null,
      documento: docFormatado || null,
      faixaEtaria: s.faixaEtaria || s.faixa_etaria || null,
      dataEntrada: s.dataEntrada || s.data_entrada_sociedade || null,
    };
  });

  // CNAE Principal
  let cnaePrincipal = raw.cnaePrincipal;
  if (!cnaePrincipal && (raw.cnae_fiscal || raw.cnae)) {
    cnaePrincipal = {
      codigo: raw.cnae_fiscal || raw.cnae,
      descricao: raw.cnae_fiscal_descricao || raw.cnaeDescricao || "",
    };
  } else if (typeof cnaePrincipal === "string") {
    const parts = cnaePrincipal.split(" - ");
    cnaePrincipal = {
      codigo: parts[0] || "",
      descricao: parts.slice(1).join(" - ") || cnaePrincipal,
    };
  }

  // Endereço
  let endereco = raw.endereco;
  if (!endereco && (raw.logradouro || raw.municipio)) {
    endereco = [
      [raw.descricao_tipo_de_logradouro, raw.logradouro].filter(Boolean).join(" "),
      raw.numero ? `nº ${raw.numero}` : null,
      raw.complemento ? `(${raw.complemento})` : null,
      raw.bairro ? `- ${raw.bairro}` : null,
      raw.municipio ? `${raw.municipio}/${raw.uf || ""}` : null,
      raw.cep ? `CEP ${raw.cep}` : null,
    ].filter(Boolean).join(", ");
  }

  return {
    cnpj: formattedCnpj,
    cnpj_limpo: cleanCnpj,
    razaoSocial: raw.razaoSocial || raw.razao_social || raw.nome || "Razão Social Não Informada",
    nomeFantasia: raw.nomeFantasia || raw.nome_fantasia || "Não informado",
    situacaoCadastral: String(raw.situacaoCadastral || raw.descricao_situacao_cadastral || raw.situacao || "ATIVA").toUpperCase(),
    dataAbertura: raw.dataAbertura || raw.data_inicio_atividade || null,
    dataSituacaoCadastral: raw.dataSituacaoCadastral || raw.data_situacao_cadastral || null,
    motivoSituacaoCadastral: raw.motivoSituacaoCadastral || raw.descricao_motivo_situacao_cadastral || null,
    naturezaJuridica: raw.naturezaJuridica || raw.natureza_juridica || null,
    porte: raw.porte || raw.porteEmpresa || "Não informado",
    capitalSocial: raw.capitalSocial || raw.capital_social || "Não informado",
    cnaePrincipal: cnaePrincipal || { codigo: "N/A", descricao: "Não especificado" },
    cnaesSecundarios: raw.cnaesSecundarios || raw.cnaes_secundarios || [],
    tipoMatrizFilial: raw.tipoMatrizFilial || raw.descricao_identificador_matriz_filial || "MATRIZ",
    sociosQSA,
    totalSocios: sociosQSA.length,
    endereco: endereco || "Não informado",
    logradouro: raw.logradouro || null,
    numero: raw.numero || null,
    complemento: raw.complemento || null,
    bairro: raw.bairro || null,
    municipio: raw.municipio || null,
    uf: raw.uf || null,
    cep: raw.cep || null,
    telefone: raw.telefone || raw.ddd_telefone_1 || null,
    email: raw.email || null,
  };
}

export function interpretHexysCompany(rawData) {
  if (!rawData) return rawData;
  if (Array.isArray(rawData)) {
    return rawData.map(normalizeCnpjRecord);
  }
  return normalizeCnpjRecord(rawData);
}

export default interpretHexysCompany;
