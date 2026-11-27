/**
 * ==============================================================================
 * RIMUBUSCA - HEXYS DEV INTERPRETER - OAB / CNA ADVOGADOS (OAB.JS)
 * Renderizador dedicado ao Cadastro Nacional dos Advogados (CNA / OAB).
 * Suporta tanto o DTO normalizado pelo backend (advogados, sociedades) quanto
 * o envelope bruto da RimuAPI (CNA_ADVOGADOS, CNA_FOTOS, CNA_SOCIEDADES).
 * ==============================================================================
 */

import { Formatters, escapeHtml } from "../../utils.js";

function cleanOabValue(val) {
  if (val === null || val === undefined) return "";
  const s = String(val).trim();
  const upper = s.replace(/[()]/g, "").trim().toUpperCase();
  if (
    upper === "" ||
    upper === "SEM RESULTADO" ||
    upper === "N/I" ||
    upper === "N/A" ||
    upper === "NULL" ||
    upper === "NONE" ||
    upper === "NAO INFORMADO" ||
    upper === "NÃO INFORMADO"
  ) {
    return "";
  }
  return s;
}

function resolvePhotoSrc(fotoRaw) {
  if (!fotoRaw || typeof fotoRaw !== "string") return null;
  const trimmed = fotoRaw.trim();
  if (!trimmed || trimmed.toUpperCase() === "SEM RESULTADO") return null;
  if (trimmed.startsWith("data:image/") || /^https?:\/\//i.test(trimmed)) return trimmed;
  return Formatters.base64Image(trimmed);
}

function extractOabRecords(responseData, dataPayload) {
  const src = dataPayload || responseData?.dados || responseData || {};
  const candidates = [
    src.data?.response,
    src.data?.conteudo,
    src.response,
    src.conteudo,
    src.data,
    src,
  ].filter((c) => c && typeof c === "object");

  const root =
    candidates.find((c) => Array.isArray(c.advogados) && c.advogados.length > 0) ||
    candidates.find((c) => Array.isArray(c.CNA_ADVOGADOS) && c.CNA_ADVOGADOS.length > 0) ||
    candidates.find((c) => Array.isArray(c.ADVOGADOS) && c.ADVOGADOS.length > 0) ||
    candidates.find((c) => Array.isArray(c.CNA_ADVOGADOS) || Array.isArray(c.advogados)) ||
    candidates[0] ||
    src;

  const rawPhotos = Array.isArray(root.CNA_FOTOS)
    ? root.CNA_FOTOS
    : Array.isArray(responseData?.raw?.CNA_FOTOS)
      ? responseData.raw.CNA_FOTOS
      : [];

  const sociedades = Array.isArray(root.sociedades)
    ? root.sociedades
    : Array.isArray(root.CNA_SOCIEDADES)
      ? root.CNA_SOCIEDADES
      : Array.isArray(responseData?.raw?.CNA_SOCIEDADES)
        ? responseData.raw.CNA_SOCIEDADES
        : [];

  if (Array.isArray(root.advogados) && root.advogados.length > 0) {
    return { advogados: root.advogados, sociedades };
  }

  const cnaAdvs = Array.isArray(root.CNA_ADVOGADOS)
    ? root.CNA_ADVOGADOS
    : Array.isArray(root.ADVOGADOS)
      ? root.ADVOGADOS
      : Array.isArray(root.resultado)
        ? root.resultado
        : Array.isArray(responseData?.raw?.CNA_ADVOGADOS)
          ? responseData.raw.CNA_ADVOGADOS
          : (root.NOME || root.nome || root.INSCRICAO || root.inscricao)
            ? [root]
            : [];

  const advogados = cnaAdvs
    .filter((a) => a && typeof a === "object" && (a.NOME || a.nome || a.INSCRICAO || a.inscricao))
    .map((a, idx) => {
      const insc = String(a.INSCRICAO || a.inscricao || "").trim();
      const uf = String(a.UF || a.SECCIONAL || a.seccional || "").trim().toUpperCase();
      const photoMatch =
        rawPhotos.find((f) => String(f.INSCRICAO || "").trim() === insc && String(f.UF || "").trim().toUpperCase() === uf) ||
        rawPhotos.find((f) => String(f.INSCRICAO || "").trim() === insc) ||
        rawPhotos[idx] ||
        null;

      const allowRaw = a.ALLOW_EMAIL ?? a.allowEmail ?? a.allow_email;
      const allowEmail =
        allowRaw === undefined || allowRaw === null || allowRaw === ""
          ? null
          : String(allowRaw).trim() === "1" || allowRaw === true || String(allowRaw).toLowerCase() === "sim";

      return {
        inscricao: insc,
        uf,
        nome: (cleanOabValue(a.NOME || a.nome) || "Advogado(a)").toUpperCase(),
        nomeSocial: cleanOabValue(a.NOME_SOCIAL || a.nomeSocial || a.nome_social) || null,
        tipo: (cleanOabValue(a.TIPO || a.tipo || a.CATEGORIA || a.categoria) || "ADVOGADO(A)").toUpperCase(),
        qtdSociedades: a.QTD_SOCIEDADES ?? a.qtdSociedades ?? String(sociedades.length || 0),
        allowEmail,
        carteirinha: resolvePhotoSrc(
          a.carteirinha || a.FOTO_BASE64 || a.FOTO_URL || a.fotoUrl || a.foto_url || photoMatch?.FOTO_BASE64 || photoMatch?.FOTO_URL
        ),
        subsecao: cleanOabValue(a.SUBSECAO || a.subsecao) || "",
        enderecoProfissional: cleanOabValue(a.ENDERECO_PROFISSIONAL || a.enderecoProfissional || a.endereco) || "",
        telefoneProfissional: cleanOabValue(a.TELEFONE_PROFISSIONAL || a.telefoneProfissional || a.telefone) || "",
        situacao: cleanOabValue(a.SITUACAO || a.situacao) || "",
      };
    });

  return { advogados, sociedades };
}

export const OabInterpreter = {
  /**
   * Renderiza a ficha profissional OAB / CNA com inscrição, seccional, tipo e carteirinha abaixo
   * @param {Object} responseData
   * @param {Object} dataPayload
   * @returns {string} HTML markup
   */
  render(responseData, dataPayload) {
    const { advogados, sociedades } = extractOabRecords(responseData, dataPayload);

    if (advogados.length === 0) {
      return `
        <div class="card osint-empty-card osint-empty-card--purple">
          <div class="osint-empty-icon osint-empty-icon--warning">
            <i data-lucide="scale" class="icon-xl"></i>
          </div>
          <h3 class="osint-empty-title">Nenhum Registro OAB Localizado</h3>
          <p class="osint-empty-desc">
            Não foi encontrada inscrição ativa ou correspondente para o número OAB e seccional (UF) informados no CNA.
          </p>
        </div>
      `;
    }

    const cardsHtml = advogados
      .map((adv) => {
        const nome = adv.nome || "Advogado(a)";
        const nomeSocial = cleanOabValue(adv.nomeSocial);
        const insc = cleanOabValue(adv.inscricao) || "N/I";
        const uf = cleanOabValue(adv.uf || adv.seccional);
        const oabLabel = uf ? `OAB/${uf} ${insc}` : `OAB ${insc}`;
        const situacao = cleanOabValue(adv.situacao);
        const tipo = cleanOabValue(adv.tipo || adv.categoria) || "ADVOGADO(A)";
        const subsecao = cleanOabValue(adv.subsecao);
        const endProf = cleanOabValue(adv.enderecoProfissional);
        const telProf = cleanOabValue(adv.telefoneProfissional);
        const carteirinhaSrc = resolvePhotoSrc(adv.carteirinha || adv.fotoUrl);
        const qtdSoc = adv.qtdSociedades !== undefined && adv.qtdSociedades !== null ? String(adv.qtdSociedades) : "0";
        const allowEmailText =
          adv.allowEmail === true ? "Habilitado" : adv.allowEmail === false ? "Não autorizado" : null;

        return `
          <div class="card osint-section-card osint-section-card--purple">
            <div class="osint-person-top">
              <div>
                <div class="osint-chip-row mb-4">
                  <span class="badge badge-amber">
                    <i data-lucide="scale" class="icon-xs"></i> CNA / OAB
                  </span>
                  <span class="badge badge-purple">
                    ${escapeHtml(oabLabel)}
                  </span>
                  ${situacao ? `<span class="badge badge-emerald">${escapeHtml(situacao)}</span>` : ""}
                  <span class="badge badge-dark">
                    ${escapeHtml(tipo)}
                  </span>
                </div>

                <h2 class="osint-person-name">${escapeHtml(nome)}</h2>
                ${
                  nomeSocial
                    ? `<div class="osint-kv-note mt-3">Nome Social: <strong>${escapeHtml(nomeSocial)}</strong></div>`
                    : ""
                }

                <div class="osint-cpf-row">
                  <span class="osint-cpf-code">${escapeHtml(oabLabel)}</span>
                  <button type="button" class="btn btn-ghost btn-copy-inline btn-copiar-texto" data-copy="${escapeHtml(oabLabel)}" title="Copiar Inscrição OAB">
                    <i data-lucide="copy" class="icon-xs"></i>
                  </button>
                </div>

                <div class="osint-person-actions">
                  <button type="button" class="btn btn-outline btn-sm btn-puxar-nome-item" data-nome="${escapeHtml(nome)}" title="Buscar Pessoa pelo Nome Completo">
                    <i data-lucide="user-search" class="icon-sm"></i> Buscar Nome Completo
                  </button>
                </div>
              </div>
            </div>

            <div class="osint-kv-grid mt-5">
              <div class="osint-kv-item">
                <span class="osint-kv-label">Inscrição OAB</span>
                <strong class="osint-kv-value osint-kv-value--amber osint-kv-value--mono">${escapeHtml(insc)}</strong>
              </div>

              ${
                uf
                  ? `<div class="osint-kv-item">
                      <span class="osint-kv-label">Seccional (UF)</span>
                      <strong class="osint-kv-value osint-kv-value--cyan">${escapeHtml(uf)}</strong>
                    </div>`
                  : ""
              }

              <div class="osint-kv-item">
                <span class="osint-kv-label">Tipo / Categoria</span>
                <strong class="osint-kv-value">${escapeHtml(tipo)}</strong>
              </div>

              <div class="osint-kv-item">
                <span class="osint-kv-label">Sociedades Registradas</span>
                <strong class="osint-kv-value osint-kv-value--purple">${escapeHtml(qtdSoc)}</strong>
              </div>

              ${
                allowEmailText
                  ? `<div class="osint-kv-item">
                      <span class="osint-kv-label">Comunicação por E-mail</span>
                      <strong class="osint-kv-value">${escapeHtml(allowEmailText)}</strong>
                    </div>`
                  : ""
              }

              ${
                subsecao
                  ? `<div class="osint-kv-item">
                      <span class="osint-kv-label">Subseção</span>
                      <strong class="osint-kv-value">${escapeHtml(subsecao)}</strong>
                    </div>`
                  : ""
              }

              ${
                telProf
                  ? `<div class="osint-kv-item">
                      <span class="osint-kv-label">Telefone Profissional</span>
                      <strong class="osint-kv-value osint-kv-value--mint">${escapeHtml(telProf)}</strong>
                    </div>`
                  : ""
              }

              ${
                endProf
                  ? `<div class="osint-kv-item">
                      <span class="osint-kv-label">Endereço Profissional</span>
                      <strong class="osint-kv-value">${escapeHtml(endProf)}</strong>
                    </div>`
                  : ""
              }
            </div>
          </div>

          ${
            carteirinhaSrc
              ? `<div class="card osint-section-card osint-section-card--purple">
                  <div class="card-header">
                    <h3 class="card-title">
                      <i data-lucide="id-card" class="icon-md icon-amber"></i>
                      <span>Carteira de Identificação do Advogado (OAB)</span>
                    </h3>
                    <div class="osint-chip-row">
                      <a href="${carteirinhaSrc}" download="carteirinha-oab-${escapeHtml(insc)}-${escapeHtml(uf || "BR")}.jpg" class="btn btn-outline btn-sm">
                        <i data-lucide="download" class="icon-xs"></i> Baixar
                      </a>
                      <a href="${carteirinhaSrc}" target="_blank" rel="noopener noreferrer" class="btn btn-ghost btn-sm">
                        <i data-lucide="maximize-2" class="icon-xs"></i> Ampliar
                      </a>
                    </div>
                  </div>
                  <div class="osint-oab-card-frame">
                    <img src="${carteirinhaSrc}" alt="Carteirinha OAB de ${escapeHtml(nome)}" class="osint-oab-card-img" onerror="this.closest('.osint-section-card').style.display='none'">
                  </div>
                </div>`
              : ""
          }
        `;
      })
      .join("");

    const sociedadesHtml =
      sociedades.length > 0
        ? `
      <div class="card osint-section-card">
        <div class="card-header">
          <h3 class="card-title">
            <i data-lucide="building-2" class="icon-md icon-purple"></i>
            <span>Sociedades de Advocacia Vinculadas (${sociedades.length})</span>
          </h3>
        </div>
        <div class="osint-kv-grid">
          ${sociedades
            .map((soc) => {
              const razao = cleanOabValue(soc.NOME_SOCIEDADE || soc.RAZAO_SOCIAL || soc.nome || soc.razaoSocial) || "Sociedade OAB";
              const reg = cleanOabValue(soc.INSCRICAO || soc.REGISTRO || soc.inscricao);
              const sUf = cleanOabValue(soc.UF || soc.uf);
              return `
              <div class="osint-kv-item">
                <span class="osint-kv-label">${escapeHtml(sUf ? `Seccional ${sUf}` : "Sociedade")} ${reg ? `&bull; Reg. ${escapeHtml(reg)}` : ""}</span>
                <strong class="osint-kv-value">${escapeHtml(razao)}</strong>
              </div>
            `;
            })
            .join("")}
        </div>
      </div>
    `
        : "";

    return cardsHtml + sociedadesHtml;
  },
};
