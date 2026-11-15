/**
 * ==============================================================================
 * BACKEND INTERPRETER - HEXYS EMAIL & DIGITAL IDENTITY (EMAIL.INTERPRETER.JS)
 * Standardizes email OSINT payloads, Google account profiling, Gaia ID tracking,
 * associated titulars, vehicles, and credential breach audits.
 *
 * Clean Code standards with English identifiers and strict null-safety.
 * ==============================================================================
 */

import { normalizePersonRecord, formatCnpj } from "./cpf.interpreter.js";

/**
 * Normalizes Hexys Email Intelligence payloads
 * @param {Object} rawData - Raw payload from Hexys API
 * @returns {Object} Standardized Email Intelligence DTO
 */
export function interpretHexysEmail(rawData) {
  if (!rawData || typeof rawData !== "object") return rawData;

  const data = { ...rawData };

  // 1. Searched email address
  const email = String(data.email || data.termo || "").trim().toLowerCase();

  // 2. Google Profile & Digital Identity
  const perfilGoogle = data.perfil_google || {};
  const contasGoogle = perfilGoogle.contasGoogle || perfilGoogle.contas_google || {};

  const gaiaId =
    perfilGoogle.gaiaId ||
    perfilGoogle.gaia_id ||
    contasGoogle.gaia_id ||
    null;

  const photoUrl =
    data.foto ||
    perfilGoogle.photoUrl ||
    perfilGoogle.foto ||
    contasGoogle.photoUrl ||
    contasGoogle.foto ||
    (Array.isArray(contasGoogle.fotos_containers) && contasGoogle.fotos_containers[0]?.url) ||
    null;

  // Active Google Ecosystem Apps (e.g., YouTube, Photos, Maps, Meet)
  const rawApps =
    perfilGoogle.apps_ativos ||
    contasGoogle.apps_ativos ||
    contasGoogle.apps ||
    [];
  const appsAtivos = Array.isArray(rawApps) ? [...new Set(rawApps)] : [];

  const mapsContribUrl =
    contasGoogle.maps_contrib_url ||
    perfilGoogle.maps_contrib_url ||
    (gaiaId ? `https://www.google.com/maps/contrib/${gaiaId}/reviews` : null);

  const ultimaEdicao =
    contasGoogle.ultima_edicao_perfil ||
    perfilGoogle.ultima_edicao_perfil ||
    null;

  const entidadeTipo =
    contasGoogle.entidade_tipo ||
    perfilGoogle.entidade_tipo ||
    "PERSON";

  // 3. Associated Individuals (pessoas_vinculadas)
  const rawPessoas = Array.isArray(data.pessoas_vinculadas)
    ? data.pessoas_vinculadas
    : Array.isArray(data.pessoas)
      ? data.pessoas
      : Array.isArray(data.titulares)
        ? data.titulares
        : [];

  const pessoasNormalizadas = rawPessoas.map((p) => {
    // If individual doesn't have an explicit photo but email has Google Avatar, associate it
    if (!p.foto_url && !p.foto && photoUrl) {
      p.foto_google = photoUrl;
    }

    const normalized = normalizePersonRecord(p);

    // Retain email-specific metadata
    normalized.email_score = p.email_score || "REGULAR";
    normalized.sources = Array.isArray(p.sources) ? p.sources : (p.source ? [p.source] : []);
    normalized.operadoras = Array.isArray(p.operadoras) ? p.operadoras : [];

    return normalized;
  });

  // 4. Associated Companies (empresas_vinculadas)
  const rawEmpresas = Array.isArray(data.empresas_vinculadas)
    ? data.empresas_vinculadas
    : Array.isArray(data.empresas)
      ? data.empresas
      : Array.isArray(data.empresas_empresAqui)
        ? data.empresas_empresAqui
        : [];

  const empresasNormalizadas = rawEmpresas.map((emp) => {
    const rawCnpj = String(emp.cnpj || "").replace(/\D/g, "");
    return {
      cnpj: rawCnpj,
      cnpj_formatado: formatCnpj(rawCnpj),
      razao_social: emp.razao_social || emp.razaoSocial || emp.nome || "Razão Social não informada",
      nome_fantasia: emp.nome_fantasia || emp.nomeFantasia || null,
      situacao: emp.situacao || emp.status || "ATIVA",
      qualificacao: emp.qualificacao_socio || emp.qualificacao || "SÓCIO / TITULAR",
      capital_social: emp.capital_social || null,
      data_abertura: emp.data_abertura || null,
    };
  });

  // 5. Credential Leaks & Security Audit (Vazamentos)
  const vazamentos = Array.isArray(data.vazamentos) ? data.vazamentos : [];
  const senhasVazadas = Array.isArray(data.senhas_vazadas) ? data.senhas_vazadas : [];
  const totalVazamentos = data.total_vazamentos ?? vazamentos.length;
  const totalEmailsVerificados = data.total_emails_verificados_vazamentos ?? 0;
  const alvosVerificados = data.alvos_verificados_vazamentos ?? 0;
  const emailsComprometidos = Array.isArray(data.emails_comprometidos) ? data.emails_comprometidos : [];

  // 6. Social Media & Tracking
  const redesSociais = Array.isArray(data.rastreamento_midias_sociais) ? data.rastreamento_midias_sociais : [];

  return {
    tipo: "email",
    email,
    foto: photoUrl,
    perfil_google: {
      ok: perfilGoogle.ok ?? Boolean(gaiaId || photoUrl),
      gaia_id: gaiaId,
      foto: photoUrl,
      apps_ativos: appsAtivos,
      maps_contrib_url: mapsContribUrl,
      ultima_edicao_perfil: ultimaEdicao,
      entidade_tipo: entidadeTipo,
    },
    pessoas_vinculadas: pessoasNormalizadas,
    total_pessoas: pessoasNormalizadas.length || Number(data.total_pessoas || 0),
    empresas_vinculadas: empresasNormalizadas,
    total_empresas: empresasNormalizadas.length || Number(data.total_empresas || 0),
    seguranca: {
      total_vazamentos: totalVazamentos,
      vazamentos: vazamentos,
      senhas_vazadas: senhasVazadas,
      total_emails_verificados: totalEmailsVerificados,
      alvos_verificados: alvosVerificados,
      emails_comprometidos: emailsComprometidos,
      status: totalVazamentos > 0 ? "VULNERAVEL" : "SEGURO",
    },
    redes_sociais: redesSociais,
    raw_status: data.status_processamento || "concluido",
  };
}

export default interpretHexysEmail;

