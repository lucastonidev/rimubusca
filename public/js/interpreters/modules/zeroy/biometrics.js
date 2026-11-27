/**
 * ==============================================================================
 * ZEROY API INTERPRETER - FACIAL BIOMETRICS & CNH MIRROR (BIOMETRICS.JS)
 * Formats official facial biometrics with lightbox zoom modal, Detran registration,
 * issuing authority, and quick CPF dossier pull.
 * Standardized with Clean Code principles and English naming.
 * ==============================================================================
 */

import { Formatters, escapeHtml, renderScoreBadge } from "../../utils.js";

function resolveMatchPhoto(rawPhoto) {
  return (
    Formatters.base64Image(rawPhoto) ||
    (typeof rawPhoto === "string" && /^https?:\/\//i.test(rawPhoto) ? rawPhoto : null)
  );
}

function renderReconncMatches(responseData, payload) {
  const matches = Array.isArray(payload?.matches)
    ? payload.matches
    : Array.isArray(responseData?.dados?.matches)
      ? responseData.dados.matches
      : [];

  if (responseData?.notFound || payload?.notFound || matches.length === 0) {
    return `
      <div class="card osint-empty-card osint-empty-card--purple">
        <div class="osint-empty-icon osint-empty-icon--warning">
          <i data-lucide="scan-face" class="icon-xl"></i>
        </div>
        <h3 class="osint-empty-title">Nenhum Rosto Compatível Localizado</h3>
        <p class="osint-empty-desc">
          Nenhuma correspondência facial atingiu o limite mínimo de similaridade informado. Tente uma foto frontal mais nítida ou reduza o <strong>threshold</strong>.
        </p>
      </div>
    `;
  }

  const otim = payload?.otimizacao || responseData?.dados?.otimizacao || null;
  const otimText =
    otim && otim.originalBytes && otim.optimizedBytes
      ? `Imagem otimizada no servidor: ${(otim.originalBytes / 1024).toFixed(0)} KB → ${(otim.optimizedBytes / 1024).toFixed(0)} KB${otim.width && otim.height ? ` (${otim.width}×${otim.height})` : ""}`
      : null;

  return `
    <div class="card" style="margin-bottom: var(--space-4); border-left: 4px solid #EC4899;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <span class="badge" style="background: rgba(236, 72, 153, 0.16); color: #F472B6; border: 1px solid rgba(236, 72, 153, 0.35); font-weight: 700;">
            <i data-lucide="scan-face" style="width: 13px; height: 13px;"></i> RECONHECIMENTO FACIAL NACIONAL
          </span>
          <strong style="font-size: 1rem; color: var(--color-text);">
            ${matches.length} ${matches.length === 1 ? "Correspondência Encontrada" : "Correspondências Encontradas"}
          </strong>
        </div>
        ${
          otimText
            ? `<span style="font-size: 0.76rem; color: #94A3B8; font-family: var(--font-mono);">${escapeHtml(otimText)}</span>`
            : ""
        }
      </div>
    </div>

    <div class="osint-match-grid">
      ${matches
        .map((match, idx) => {
          const det = match.detalhes && typeof match.detalhes === "object" ? match.detalhes : {};
          const photoUrl = resolveMatchPhoto(match.foto || match.base64 || match.imagem);
          const cleanCpf = String(match.cpf || "").replace(/\D/g, "");
          const formattedCpf = cleanCpf.length === 11 ? Formatters.cpf(cleanCpf) : escapeHtml(match.cpf || "Não informado");
          const similarity = match.similaridade || "N/I";
          const uf = match.estado || det.estado || "N/I";
          const birthRaw = det.nascimento || det.data_nascimento || match.nascimento || "";
          const birth = birthRaw ? (String(birthRaw).includes("-") ? Formatters.date(birthRaw) : escapeHtml(birthRaw)) : "Não informado";
          const mother = det.mae || det.nome_mae || match.mae || "Não informada";
          const rawGender = String(det.sexo || match.sexo || "").trim().toUpperCase();
          const gender =
            rawGender === "M" ? "Masculino" : rawGender === "F" ? "Feminino" : escapeHtml(det.sexo || match.sexo || "Não informado");
          const phones = Array.isArray(det.telefones) ? det.telefones.filter(Boolean) : [];
          const rankLabel = `#${match.ordem || idx + 1}`;
          const photoTitle = `${rankLabel} • CPF ${formattedCpf} (${similarity})`;

          return `
            <div class="card osint-match-card">
              <div class="osint-match-top">
                ${
                  photoUrl
                    ? `
                  <div style="position: relative; flex-shrink: 0;">
                    <img src="${photoUrl}" alt="${escapeHtml(photoTitle)}" class="osint-match-photo btn-abrir-foto-modal" data-foto="${escapeHtml(photoUrl)}" data-nome="${escapeHtml(photoTitle)}">
                    <span class="badge" style="position: absolute; top: 6px; left: 6px; background: rgba(0, 0, 0, 0.78); color: #F472B6; font-family: var(--font-mono); font-size: 0.7rem;">${rankLabel}</span>
                  </div>
                `
                    : `
                  <div class="osint-match-photo-empty">
                    <i data-lucide="camera-off" style="width: 24px; height: 24px; margin-bottom: 4px;"></i>
                    <span>Sem Foto</span>
                  </div>
                `
                }

                <div class="osint-match-meta">
                  <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;">
                    ${renderScoreBadge(similarity)}
                    <span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #60A5FA; font-family: var(--font-mono); font-weight: 700;">
                      UF: ${escapeHtml(uf)}
                    </span>
                  </div>

                  ${
                    match.nome
                      ? `<div style="font-weight: 800; font-size: 1rem; color: #FFFFFF; margin-bottom: 4px;">${escapeHtml(match.nome)}</div>`
                      : ""
                  }

                  <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px;">
                    <span style="font-size: 0.78rem; color: var(--color-text-muted);">CPF:</span>
                    <strong style="font-family: var(--font-mono); font-size: 0.98rem; color: #34D399;">${formattedCpf}</strong>
                    ${
                      cleanCpf
                        ? `<button type="button" class="btn-action-copy btn-copiar-cpf" data-cpf="${cleanCpf}" title="Copiar CPF">
                             <i data-lucide="copy" style="width: 11px; height: 11px;"></i>
                           </button>`
                        : ""
                    }
                  </div>

                  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; font-size: 0.8rem;">
                    <div style="background: var(--color-surface-2); padding: 7px 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
                      <span style="font-size: 0.68rem; color: var(--color-text-dim); text-transform: uppercase;">Nascimento</span>
                      <div style="font-weight: 600; color: var(--color-text);">${birth}</div>
                    </div>
                    <div style="background: var(--color-surface-2); padding: 7px 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
                      <span style="font-size: 0.68rem; color: var(--color-text-dim); text-transform: uppercase;">Sexo</span>
                      <div style="font-weight: 600; color: var(--color-text);">${gender}</div>
                    </div>
                    <div style="grid-column: 1 / -1; background: var(--color-surface-2); padding: 7px 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                      <div style="min-width: 0;">
                        <span style="font-size: 0.68rem; color: var(--color-text-dim); text-transform: uppercase;">Filiação Materna (Mãe)</span>
                        <div style="font-weight: 600; color: var(--color-text); overflow: hidden; text-overflow: ellipsis;">${escapeHtml(mother)}</div>
                      </div>
                      ${
                        mother && mother !== "Não informada"
                          ? `<button type="button" class="btn-action-puxar btn-buscar-nome-alvo" data-nome="${escapeHtml(mother)}" title="Buscar nome da mãe">
                               <i data-lucide="search" style="width: 11px; height: 11px;"></i>
                             </button>`
                          : ""
                      }
                    </div>
                  </div>
                </div>
              </div>

              ${
                phones.length > 0
                  ? `
                <div style="border-top: 1px solid var(--color-border); padding-top: 10px;">
                  <div style="font-size: 0.72rem; color: var(--color-text-dim); text-transform: uppercase; font-weight: 700; margin-bottom: 6px;">
                    Telefones Vinculados (${phones.length})
                  </div>
                  <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                    ${phones
                      .map((tel) => {
                        const cleanTel = String(tel).replace(/\D/g, "");
                        const fmtTel = Formatters.phone(cleanTel || tel);
                        return `
                          <button type="button" class="btn-action-copy btn-copiar-texto" data-copy="${escapeHtml(cleanTel || tel)}" title="Copiar telefone">
                            <i data-lucide="phone" style="width: 11px; height: 11px; color: #F59E0B;"></i>
                            <span>${escapeHtml(fmtTel)}</span>
                          </button>
                        `;
                      })
                      .join("")}
                  </div>
                </div>
              `
                  : ""
              }

              ${
                cleanCpf.length === 11
                  ? `
                <div style="border-top: 1px solid var(--color-border); padding-top: 10px; display: flex; justify-content: flex-end;">
                  <button type="button" class="btn-action-puxar btn-puxar-cpf" data-cpf="${cleanCpf}">
                    <i data-lucide="user-search" style="width: 13px; height: 13px;"></i>
                    <span>Puxar Dossiê Completo por CPF</span>
                  </button>
                </div>
              `
                  : ""
              }
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

export const BiometricsInterpreter = {
  /**
   * Renders facial biometric photo, driver license mirror, or facial recognition matches (reconnc)
   * @param {Object} responseData Top-level response metadata
   * @param {Object} dataPayload Unwrapped data object
   * @returns {string} HTML markup
   */
  render(responseData, dataPayload) {
    const payload = dataPayload?.data || dataPayload?.dados || dataPayload || {};
    const moduleId = String(responseData?.id || responseData?.tipo || payload?.tipo || "").toLowerCase();

    if (moduleId === "reconnc" || Array.isArray(payload?.matches) || Array.isArray(responseData?.dados?.matches)) {
      return renderReconncMatches(responseData, payload);
    }

    const rawPhoto =
      payload.foto ||
      payload.base64 ||
      payload.fotoBase64 ||
      payload.imagem ||
      (Array.isArray(payload.fotos) ? payload.fotos[0] : null);

    const photoUrl =
      Formatters.base64Image(rawPhoto) ||
      (typeof rawPhoto === "string" && rawPhoto.startsWith("http") ? rawPhoto : null);

    const name = payload.nome || "Titular";
    const safeName = escapeHtml(name);
    const formattedCpf = Formatters.cpf(payload.cpf || responseData?.termo || "");
    const cleanCpf = String(payload.cpf || responseData?.termo || "").replace(/\D/g, "");
    const driverLicense = escapeHtml(payload.cnh || payload.registro || "Disponível");
    const issuingAuthority = escapeHtml(payload.orgao || payload.uf || "DETRAN");

    return `
      <div class="card" style="margin-bottom: var(--space-4); border-top: 4px solid #8B5CF6;">
        <div style="display: flex; gap: var(--space-5); flex-wrap: wrap; align-items: flex-start;">
          <!-- Foto com Zoom -->
          <div style="text-align: center; flex-shrink: 0;">
            ${
              photoUrl
                ? `
              <div style="position: relative; display: inline-block; cursor: pointer;" class="btn-abrir-foto-modal" data-foto="${escapeHtml(photoUrl)}" data-nome="${safeName}">
                <img src="${photoUrl}" alt="Foto Cadastral" style="width: 170px; height: 210px; object-fit: cover; border-radius: var(--radius-md); border: 2px solid #8B5CF6; box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3);">
                <div style="position: absolute; bottom: 6px; right: 6px; background: rgba(0,0,0,0.7); color: #FFF; border-radius: 4px; padding: 2px 6px; font-size: 0.65rem; display: flex; align-items: center; gap: 4px;">
                  <i data-lucide="zoom-in" style="width: 11px; height: 11px;"></i> Ampliar
                </div>
              </div>
            `
                : `
              <div style="width: 170px; height: 210px; background: var(--color-surface-2); border-radius: var(--radius-md); border: 2px dashed var(--color-border); display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--color-text-dim);">
                <i data-lucide="camera-off" style="width: 32px; height: 32px; margin-bottom: 6px;"></i>
                <span style="font-size: 0.75rem;">Sem Espelho</span>
              </div>
            `
            }
          </div>

          <!-- Dados da Biometria -->
          <div style="flex: 1; min-width: 250px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="badge" style="background: rgba(139, 92, 246, 0.15); color: #A78BFA; border: 1px solid rgba(139, 92, 246, 0.3); font-weight: 700;">
                <i data-lucide="scan-face" style="width: 12px; height: 12px;"></i>
                BIOMETRIA FACIAL OFICIAL
              </span>
            </div>
            <h2 style="font-size: 1.35rem; font-weight: 800; color: var(--color-text); margin-top: 6px;">
              ${safeName}
            </h2>
            <div style="margin-top: 4px; font-family: var(--font-mono); font-size: 0.9rem; color: var(--color-text-muted);">
              CPF: <strong style="color: var(--color-text);">${escapeHtml(formattedCpf)}</strong>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-top: var(--space-4);">
              <div style="background: var(--color-surface-2); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
                <span style="font-size: 0.7rem; color: var(--color-text-dim); text-transform: uppercase; font-weight: 700;">Registro CNH</span>
                <div style="font-weight: 700; color: var(--color-text); font-family: var(--font-mono);">${driverLicense}</div>
              </div>
              <div style="background: var(--color-surface-2); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
                <span style="font-size: 0.7rem; color: var(--color-text-dim); text-transform: uppercase; font-weight: 700;">Órgão Emissor</span>
                <div style="font-weight: 700; color: var(--color-text); font-family: var(--font-mono);">${issuingAuthority}</div>
              </div>
            </div>

            ${
              cleanCpf
                ? `
              <div style="margin-top: var(--space-4);">
                <button type="button" class="btn-action-puxar btn-puxar-cpf" data-cpf="${cleanCpf}">
                  <i data-lucide="user-search" style="width: 13px; height: 13px;"></i>
                  Puxar Dossiê Completo por CPF
                </button>
              </div>
            `
                : ""
            }
          </div>
        </div>
      </div>
    `;
  },
};

// Backward compatibility alias
export const FotoBiometriaInterpreter = BiometricsInterpreter;

