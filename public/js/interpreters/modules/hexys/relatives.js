/**
 * ==============================================================================
 * HEXYS API INTERPRETER - RELATIVES & KINSHIP TREE (RELATIVES.JS)
 * Visual renderer for family tree and kinship connections.
 * Displays target titular, categorized relatives (parents, spouse, siblings),
 * masked/clean CPFs, ages, and quick investigation shortcuts.
 *
 * Clean Code standards with English identifiers and strict null-safety.
 * ==============================================================================
 */

import { Formatters, escapeHtml } from "../../utils.js";

export const RelativesInterpreter = {
  /**
   * Renders kinship and family tree dossier from Hexys API payload
   * @param {Object} responseData - Root query response metadata
   * @param {Object} dataPayload - Extracted data payload
   * @returns {string} HTML markup
   */
  render(responseData, dataPayload) {
    const data = dataPayload || {};
    const queryType = String(responseData?.tipo || responseData?.type || "").toLowerCase().trim();
    const externalUrl = String(data?.url || data?.link || responseData?.url || responseData?.link || "").trim();
    const isValidExternalUrl = /^https?:\/\//i.test(externalUrl);

    if (
      queryType === "arvore_familiar" ||
      (isValidExternalUrl && !Array.isArray(data?.parentescos) && !Array.isArray(data?.parentes))
    ) {
      if (responseData?.notFound || responseData?.isNotFound || data?.notFound || data?.isNotFound || !isValidExternalUrl) {
        return `
          <div class="card osint-empty-card osint-empty-card--purple">
            <div class="osint-empty-icon osint-empty-icon--purple">
              <i data-lucide="git-merge" class="icon-xl"></i>
            </div>
            <h3 class="osint-empty-title">Árvore Genealógica Não Localizada</h3>
            <p class="osint-empty-desc">
              Não foi possível gerar ou localizar o link da árvore genealógica para o documento informado.
            </p>
          </div>
        `;
      }

      const cpfDigits = String(data?.cpf || responseData?.termo || "").replace(/\D/g, "");
      const cpfFmt = cpfDigits.length === 11 ? Formatters.cpf(cpfDigits) : String(data?.cpf || responseData?.termo || "Documento");
      return `
        <div class="card osint-empty-card osint-empty-card--purple">
          <div class="osint-empty-icon osint-empty-icon--purple">
            <i data-lucide="git-merge" class="icon-xl"></i>
          </div>
          <div class="osint-chip-row mb-4" style="justify-content: center;">
            <span class="badge badge-purple">
              <i data-lucide="git-merge" class="icon-xs"></i> ÁRVORE GENEALÓGICA EXTERNA
            </span>
            <span class="badge badge-emerald">${escapeHtml(cpfFmt)}</span>
          </div>
          <h3 class="osint-empty-title">Árvore Genealógica Pronta para Visualização</h3>
          <p class="osint-empty-desc" style="margin-bottom: var(--space-5);">
            O mapeamento genealógico completo foi gerado em um painel externo interativo. Clique abaixo para abrir em uma nova aba.
          </p>
          <div class="osint-chip-row" style="justify-content: center; gap: 10px;">
            <a href="${escapeHtml(externalUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
              <i data-lucide="external-link" class="icon-xs"></i> Abrir Árvore Genealógica
            </a>
            <button type="button" class="btn btn-outline btn-copiar-texto" data-copy="${escapeHtml(externalUrl)}">
              <i data-lucide="copy" class="icon-xs"></i> Copiar Link
            </button>
          </div>
        </div>
      `;
    }

    const termo = responseData?.termo || data?.titular || data?.target || "Alvo";
    const titular = String(data.titular || data.target || data.termo || termo || "Titular Não Informado").toUpperCase();

    // Raw relatives list
    const rawList = Array.isArray(data.parentescos)
      ? data.parentescos
      : Array.isArray(data.parentes)
        ? data.parentes
        : Array.isArray(data.resultado)
          ? data.resultado
          : Array.isArray(data)
            ? data
            : [];

    if (responseData?.notFound || responseData?.isNotFound || data?.notFound || data?.isNotFound || rawList.length === 0) {
      return `
        <div class="card osint-empty-card osint-empty-card--purple">
          <div class="osint-empty-icon osint-empty-icon--purple">
            <i data-lucide="users" class="icon-xl"></i>
          </div>
          <h3 class="osint-empty-title">Nenhum Vínculo Familiar Localizado</h3>
          <p class="osint-empty-desc">
            Não encontramos parentes ou vínculos familiares registrados para o documento consultado.
          </p>
        </div>
      `;
    }

    const relatives = rawList.map((item) => {
      const vinculo = String(item.vinculo || item.parentesco || item.grau || item.relationship || "Parente").toUpperCase();
      const nome = String(item.nome || item.name || "NÃO INFORMADO").toUpperCase();
      const cpf = String(item.cpf || item.documento || "Não informado");
      const cleanDigits = cpf.replace(/\D/g, "");
      const isCleanCpf = cleanDigits.length === 11 && !cpf.includes("*");
      const cleanCpf = isCleanCpf ? cleanDigits : null;
      const idade = item.idade !== undefined && item.idade !== null ? Number(item.idade) : (item.age || null);

      // Determine category and styling
      let category = "outro";
      let badgeBg = "rgba(148, 163, 184, 0.15)";
      let badgeColor = "#94A3B8";
      let icon = "users";
      let borderColor = "#334155";

      if (vinculo.includes("MÃE") || vinculo.includes("MAE") || vinculo.includes("PAI") || vinculo.includes("AVÔ") || vinculo.includes("AVÓ")) {
        category = "ascendente";
        badgeBg = "rgba(99, 102, 241, 0.15)";
        badgeColor = "#818CF8";
        icon = "user";
        borderColor = "#6366F1";
      } else if (vinculo.includes("CÔNJUGE") || vinculo.includes("CONJUGE") || vinculo.includes("ESPOS") || vinculo.includes("MARIDO") || vinculo.includes("COMPANHEIR")) {
        category = "conjugal";
        badgeBg = "rgba(244, 63, 94, 0.15)";
        badgeColor = "#FB7185";
        icon = "heart";
        borderColor = "#F43F5E";
      } else if (vinculo.includes("IRMÃ") || vinculo.includes("IRMAO") || vinculo.includes("IRMÃO") || vinculo.includes("TIO") || vinculo.includes("TIA") || vinculo.includes("PRIM")) {
        category = "colateral";
        badgeBg = "rgba(16, 185, 129, 0.15)";
        badgeColor = "#34D399";
        icon = "git-merge";
        borderColor = "#10B981";
      } else if (vinculo.includes("FILH") || vinculo.includes("NET")) {
        category = "descendente";
        badgeBg = "rgba(245, 158, 11, 0.15)";
        badgeColor = "#FBBF24";
        icon = "baby";
        borderColor = "#F59E0B";
      }

      return {
        vinculo,
        nome,
        cpf,
        cleanCpf,
        isCleanCpf,
        idade,
        category,
        badgeBg,
        badgeColor,
        icon,
        borderColor,
      };
    });

    const total = relatives.length;
    const countAscendentes = relatives.filter((r) => r.category === "ascendente").length;
    const countConjuges = relatives.filter((r) => r.category === "conjugal").length;
    const countColaterais = relatives.filter((r) => r.category === "colateral").length;
    const countDescendentes = relatives.filter((r) => r.category === "descendente").length;

    return `
      <div class="relatives-dossier-wrapper" style="margin-bottom: var(--space-5);">

        <!-- ============================================================== -->
        <!-- 1. HERO BANNER: ÁRVORE GENEALÓGICA & TITULAR                   -->
        <!-- ============================================================== -->
        <div class="card" style="margin-bottom: var(--space-4); border-top: 4px solid #8B5CF6; background: radial-gradient(circle at 95% 5%, rgba(139, 92, 246, 0.12) 0%, transparent 60%), var(--color-surface);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px;">
                <span class="badge" style="background: rgba(139, 92, 246, 0.18); color: #C4B5FD; font-weight: 800; letter-spacing: 0.5px;">
                  <i data-lucide="git-merge" style="width: 12px; height: 12px;"></i> ÁRVORE DE VÍNCULOS FAMILIARES
                </span>
                <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #34D399; font-weight: 700;">
                  ${total} ${total === 1 ? "Parente Identificado" : "Parentes Identificados"}
                </span>
              </div>

              <h1 style="font-size: 1.55rem; font-weight: 800; color: var(--color-text); margin: 0; line-height: 1.25;">
                ${escapeHtml(titular)}
              </h1>

              <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-top: 8px; font-size: 0.8rem; color: var(--color-text-muted);">
                <span>Vínculos Mapeados:</span>
                ${countAscendentes > 0 ? `<span style="color: #818CF8; font-weight: 600;">Pais/Ascendentes: ${countAscendentes}</span> &bull;` : ""}
                ${countConjuges > 0 ? `<span style="color: #FB7185; font-weight: 600;">Cônjuge/União: ${countConjuges}</span> &bull;` : ""}
                ${countColaterais > 0 ? `<span style="color: #34D399; font-weight: 600;">Irmãos/Colaterais: ${countColaterais}</span>` : ""}
                ${countDescendentes > 0 ? `&bull; <span style="color: #FBBF24; font-weight: 600;">Filhos: ${countDescendentes}</span>` : ""}
              </div>
            </div>

            <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
              <button type="button" class="btn btn-ghost btn-sm btn-copiar-texto" data-copy="${escapeHtml(titular)}" title="Copiar Nome do Titular">
                <i data-lucide="copy" style="width: 13px; height: 13px;"></i> Copiar Titular
              </button>
            </div>
          </div>
        </div>

        <!-- ============================================================== -->
        <!-- 2. QUADRO DE FILTRO RÁPIDO & BUSCA EM TEMPO REAL              -->
        <!-- ============================================================== -->
        <div class="card" style="margin-bottom: var(--space-4); padding: 14px 18px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              <button type="button" class="btn btn-sm btn-outline btn-filter-relatives active" data-category="all" style="font-size: 0.75rem; padding: 4px 10px;">
                Todos (${total})
              </button>
              ${countAscendentes > 0 ? `<button type="button" class="btn btn-sm btn-outline btn-filter-relatives" data-category="ascendente" style="font-size: 0.75rem; padding: 4px 10px; color: #818CF8;"><i data-lucide="user" style="width: 11px; height: 11px;"></i> Pais (${countAscendentes})</button>` : ""}
              ${countConjuges > 0 ? `<button type="button" class="btn btn-sm btn-outline btn-filter-relatives" data-category="conjugal" style="font-size: 0.75rem; padding: 4px 10px; color: #FB7185;"><i data-lucide="heart" style="width: 11px; height: 11px;"></i> Cônjuge (${countConjuges})</button>` : ""}
              ${countColaterais > 0 ? `<button type="button" class="btn btn-sm btn-outline btn-filter-relatives" data-category="colateral" style="font-size: 0.75rem; padding: 4px 10px; color: #34D399;"><i data-lucide="git-merge" style="width: 11px; height: 11px;"></i> Irmãos (${countColaterais})</button>` : ""}
            </div>

            <div style="position: relative; min-width: 200px; flex: 1; max-width: 320px;">
              <input type="text" id="filterRelativesInput" placeholder="Filtrar por nome ou vínculo..." class="input-field" style="width: 100%; padding: 6px 10px 6px 30px; font-size: 0.78rem; background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: 6px; color: var(--color-text);">
              <i data-lucide="search" style="position: absolute; left: 9px; top: 50%; transform: translateY(-50%); width: 13px; height: 13px; color: var(--color-text-muted);"></i>
            </div>
          </div>
        </div>

        <!-- ============================================================== -->
        <!-- 3. GRADE DE MEMBROS FAMILIARES                                 -->
        <!-- ============================================================== -->
        <div id="relativesGrid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px;">
          ${relatives
            .map((rel, index) => {
              return `
              <div class="card relative-card" data-category="${rel.category}" data-search="${escapeHtml(rel.nome.toLowerCase())} ${escapeHtml(rel.vinculo.toLowerCase())}" style="margin: 0; padding: 16px; border-top: 3px solid ${rel.borderColor}; background: #0D111A; border-color: var(--color-border); display: flex; flex-direction: column; justify-content: space-between; transition: transform 0.2s ease, border-color 0.2s ease;">
                
                <div>
                  <!-- Header do Card: Vínculo & Idade -->
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <span class="badge" style="background: ${rel.badgeBg}; color: ${rel.badgeColor}; font-weight: 800; font-size: 0.75rem; letter-spacing: 0.5px;">
                      <i data-lucide="${rel.icon}" style="width: 11px; height: 11px; margin-right: 4px;"></i>
                      ${escapeHtml(rel.vinculo)}
                    </span>
                    
                    ${
                      rel.idade !== null
                        ? `
                      <span class="badge badge-dark" style="font-family: var(--font-mono); font-size: 0.72rem; color: #E2E8F0;">
                        ${rel.idade} anos
                      </span>
                    `
                        : ""
                    }
                  </div>

                  <!-- Nome do Parente -->
                  <h3 style="font-size: 1.05rem; font-weight: 800; color: #FFFFFF; margin: 0 0 8px 0; line-height: 1.3;">
                    ${escapeHtml(rel.nome)}
                  </h3>

                  <!-- CPF / Documento -->
                  <div style="display: flex; align-items: center; justify-content: space-between; background: #080B11; border: 1px solid #1E2538; padding: 8px 10px; border-radius: 6px; margin-bottom: 12px;">
                    <div>
                      <span style="font-size: 0.68rem; color: #94A3B8; text-transform: uppercase; display: block;">Documento CPF</span>
                      <span style="font-family: var(--font-mono); font-weight: 700; color: #6EE7B7; font-size: 0.88rem;">
                        ${escapeHtml(rel.cpf)}
                      </span>
                    </div>

                    ${
                      rel.cpf && rel.cpf !== "Não informado"
                        ? `
                      <button type="button" class="btn btn-ghost btn-xs btn-copiar-texto" data-copy="${escapeHtml(rel.cpf)}" title="Copiar CPF">
                        <i data-lucide="copy" style="width: 12px; height: 12px;"></i>
                      </button>
                    `
                        : ""
                    }
                  </div>
                </div>

                <!-- Ações do Card -->
                <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; border-top: 1px solid #1E2538; padding-top: 12px;">
                  ${
                    rel.isCleanCpf && rel.cleanCpf
                      ? `
                    <button type="button" class="btn btn-primary btn-sm btn-puxar-cpf" data-cpf="${rel.cleanCpf}" style="flex: 1; font-size: 0.75rem;">
                      <i data-lucide="search" style="width: 12px; height: 12px;"></i> Investigar CPF
                    </button>
                  `
                      : `
                    <button type="button" class="btn btn-outline btn-sm btn-puxar-nome-item" data-nome="${escapeHtml(rel.nome)}" style="flex: 1; font-size: 0.75rem;">
                      <i data-lucide="search" style="width: 12px; height: 12px;"></i> Investigar Nome
                    </button>
                  `
                  }
                </div>

              </div>
            `;
            })
            .join("")}
        </div>

      </div>
    `;
  },
};

export default RelativesInterpreter;

