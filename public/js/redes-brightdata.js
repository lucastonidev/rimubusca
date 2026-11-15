/**
 * ==============================================================================
 * RIMUBUSCA - FRONTEND CONTROLLER BRIGHT DATA SOCIAL OSINT (INSTAGRAM & X)
 * Gerencia disparo assíncrono, polling seguro de snapshots, filtro instantâneo
 * por palavras-chave, renderização de inteligência e Dossiê Dark Mode.
 * ==============================================================================
 */
document.addEventListener("DOMContentLoaded", () => {
  const section = document.getElementById("bdSocialSection");
  if (!section) return;

  const form = document.getElementById("formBrightDataSocial");
  const selectPlataforma = document.getElementById("bdSelectPlataforma");
  const selectModo = document.getElementById("bdSelectModo");
  const inputAlvo = document.getElementById("bdInputAlvo");
  const labelAlvo = document.getElementById("bdLabelAlvo");
  const inputPalavras = document.getElementById("bdInputPalavras");
  const inputMaxPosts = document.getElementById("bdInputMaxPosts");
  const inputMaxComments = document.getElementById("bdInputMaxComments");
  const checkComentarios = document.getElementById("bdCheckComentarios");
  const inputStartDate = document.getElementById("bdStartDate");
  const inputEndDate = document.getElementById("bdEndDate");
  const btnIniciar = document.getElementById("btnBdIniciar");
  const btnStatusBadge = document.getElementById("bdStatusBadge");
  const alertConfigBanner = document.getElementById("bdConfigAlertBanner");

  const progressBox = document.getElementById("bdProgressBox");
  const progressTitle = document.getElementById("bdProgressTitle");
  const progressSub = document.getElementById("bdProgressSub");
  const progressMeta = document.getElementById("bdProgressMeta");
  const btnCancelar = document.getElementById("btnBdCancelar");

  const resultadosBox = document.getElementById("bdResultadosBox");
  const localFilterInput = document.getElementById("bdLocalKeywordFilter");
  const btnAbrirDossie = document.getElementById("btnBdAbrirDossie");
  const modalDossie = document.getElementById("modalBdDossie");
  const modalDossieBody = document.getElementById("modalBdDossieBody");
  const btnBdExportPdf = document.getElementById("btnBdExportPdf");
  const btnBdDownloadHtml = document.getElementById("btnBdDownloadHtml");
  const btnBdAddImagem = document.getElementById("btnBdAddImagem");
  const inputCustomImages = document.getElementById("bdInputCustomImages");
  const customImagesCount = document.getElementById("bdCustomImagesCount");
  const customImagesPreview = document.getElementById("bdCustomImagesPreview");
  const checkIncluirFotosPosts = document.getElementById("bdCheckIncluirFotosPosts");

  let activePollTimer = null;
  let pollCancelled = false;
  let pollStartedAt = 0;
  let currentRelatorio = null;
  let currentDossieInnerHtml = "";
  let customDossieImages = [];

  function resolveSocialMediaUrl(raw) {
    if (!raw || typeof raw !== "string") return "";
    const trimmed = raw.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("data:image/")) return trimmed;
    if (/^https:\/\/(?:[^/]+\.)?(?:cdninstagram\.com|fbcdn\.net|instagram\.com|twimg\.com)\//i.test(trimmed)) {
      return `/api/redes/brightdata/midia?url=${encodeURIComponent(trimmed)}`;
    }
    return trimmed;
  }

  function esc(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function notify(message, type = "info") {
    const t = window.toast;
    if (!t) return;
    if (type === "success") return t.success(message);
    if (type === "error") return t.error(message);
    if (type === "warning" && typeof t.show === "function") {
      return t.show({ type: "info", title: "Atenção", message });
    }
    return t.info(message);
  }

  function formatNumber(n) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return "-";
    return Number(n).toLocaleString("pt-BR");
  }

  function fold(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function highlightTerms(escapedText, terms) {
    if (!terms || !terms.length) return escapedText;
    let out = escapedText;
    for (const term of terms) {
      const clean = String(term || "").trim();
      if (clean.length < 2) continue;
      const safeRegex = esc(clean).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      try {
        const re = new RegExp(`(${safeRegex})`, "gi");
        out = out.replace(
          re,
          '<mark style="background: rgba(245, 158, 11, 0.35); color: #FDE68A; padding: 0 3px; border-radius: 3px;">$1</mark>'
        );
      } catch {
        // Ignora regex inválida
      }
    }
    return out;
  }

  function updateModeLabels() {
    const plat = selectPlataforma?.value || "instagram";
    const modo = selectModo?.value || "perfil";
    const platName = plat === "x" ? "X (Twitter)" : "Instagram";

    if (modo === "perfil") {
      if (labelAlvo) labelAlvo.textContent = `@Usuário ou URL do Perfil (${platName})`;
      if (inputAlvo) {
        inputAlvo.placeholder = plat === "x"
          ? "Ex: @elonmusk ou https://x.com/elonmusk"
          : "Ex: @neymarjr ou https://www.instagram.com/neymarjr/";
      }
    } else if (modo === "post_url") {
      if (labelAlvo) labelAlvo.textContent = `URL Direta do Post / Reel / Tweet (${platName})`;
      if (inputAlvo) {
        inputAlvo.placeholder = plat === "x"
          ? "Ex: https://x.com/usuario/status/1234567890"
          : "Ex: https://www.instagram.com/p/Cuf4s0MNqNr/";
      }
    } else {
      if (labelAlvo) labelAlvo.textContent = `Palavras-Chave / #Hashtag para Buscar (${platName})`;
      if (inputAlvo) {
        inputAlvo.placeholder = plat === "x"
          ? "Ex: pix fraudulento, vazamento, #promocao"
          : "Ex: promocao relampago, #lojafalsa";
      }
    }

    // No X, o dataset já retorna tweets/respostas direto na fase única
    if (checkComentarios && inputMaxComments) {
      if (plat === "x") {
        checkComentarios.parentElement.title = "No X (Twitter), replies/respostas embutidas são extraídas junto aos posts.";
      } else {
        checkComentarios.parentElement.title = "Ativa coleta profunda de até N comentários por post no Instagram.";
      }
    }
  }

  async function carregarStatusBrightData() {
    try {
      const resp = await window.api.get("/api/redes/brightdata/status");
      if (!resp || !btnStatusBadge) return;

      if (resp.configured) {
        btnStatusBadge.className = "badge badge-green";
        btnStatusBadge.textContent = `API Ativa (${resp.keyMasked || "OK"})`;
        if (alertConfigBanner) alertConfigBanner.style.display = "none";
      } else {
        btnStatusBadge.className = "badge badge-red";
        btnStatusBadge.textContent = "Chave API Pendente (.env)";
        if (alertConfigBanner) alertConfigBanner.style.display = "block";
      }
    } catch {
      if (btnStatusBadge) {
        btnStatusBadge.className = "badge badge-dark";
        btnStatusBadge.textContent = "Status Indisponível";
      }
    }
  }

  function stopPolling() {
    pollCancelled = true;
    if (activePollTimer) {
      clearTimeout(activePollTimer);
      activePollTimer = null;
    }
    if (btnIniciar) {
      btnIniciar.disabled = false;
      btnIniciar.innerHTML = '<i data-lucide="radar" style="width:16px;height:16px;"></i> Coletar Posts &amp; Comentários';
      if (window.lucide) lucide.createIcons();
    }
  }

  function renderListaPosts(relatorio, extraFilterTerm = "") {
    const postsContainer = document.getElementById("bdPostsContainer");
    if (!postsContainer) return;

    const allPosts = Array.isArray(relatorio.posts) ? relatorio.posts : [];
    const filterTokens = [];
    if (Array.isArray(relatorio.parametros?.palavrasChave)) {
      filterTokens.push(...relatorio.parametros.palavrasChave);
    }
    if (extraFilterTerm && extraFilterTerm.trim().length >= 2) {
      filterTokens.push(...extraFilterTerm.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean));
    }

    const extraNorm = fold(extraFilterTerm);
    const filteredPosts = extraNorm
      ? allPosts.filter((p) => {
          const inCaption = fold(`${p.texto} ${p.autor} ${(p.hashtags || []).join(" ")}`).includes(extraNorm);
          const inComments = (p.comentariosColetados || []).some((c) =>
            fold(`${c.usuario} ${c.texto}`).includes(extraNorm)
          );
          return inCaption || inComments;
        })
      : allPosts;

    if (filteredPosts.length === 0) {
      postsContainer.innerHTML = `<div style="text-align:center;padding:var(--space-6);color:var(--color-text-dim);border:1px dashed var(--color-border);border-radius:var(--radius-md);">
        Nenhum post encontrado${extraFilterTerm ? ` contendo "${esc(extraFilterTerm)}"` : ""}.
      </div>`;
      return;
    }

    postsContainer.innerHTML = filteredPosts
      .map((p) => {
        const comments = Array.isArray(p.comentariosColetados) ? p.comentariosColetados : [];
        const visibleComments = extraNorm
          ? comments.filter((c) => fold(`${c.usuario} ${c.texto}`).includes(extraNorm) || fold(p.texto).includes(extraNorm))
          : comments;

        const firstImg = (p.midias || []).find((m) => m.tipo === "image");
        const textoHtml = highlightTerms(esc(p.texto || "(Publicação sem legenda)"), filterTokens);

        const commentsHtml = visibleComments.length > 0
          ? `<div style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--color-border);">
              <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;color:var(--color-text-muted);margin-bottom:6px;display:flex;align-items:center;gap:6px;">
                <i data-lucide="message-square" style="width:13px;height:13px;color:var(--color-primary);"></i>
                Comentários Coletados (${visibleComments.length} de ${p.numComentariosDeclarado || visibleComments.length}):
              </div>
              <div style="display:flex;flex-direction:column;gap:6px;max-height:240px;overflow-y:auto;padding-right:4px;">
                ${visibleComments
                  .map((c) => {
                    const isHidden = c.usuarioOculto || c.usuario === "usuario_oculto_ig" || c.usuario === "usuario_anonimo";
                    const authorDisplay = isHidden ? "Usuário oculto (IG)" : `@${esc(c.usuario)}`;
                    return `<div style="background:var(--color-surface-2);border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:7px 10px;font-size:0.78rem;">
                      <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:2px;">
                        <strong style="color:${isHidden ? "var(--color-text-muted)" : "var(--color-primary)"};font-family:var(--font-mono);">${authorDisplay}</strong>
                        <span style="font-size:0.7rem;color:var(--color-text-dim);">❤ ${formatNumber(c.likes)}${c.data ? ` • ${esc(new Date(c.data).toLocaleDateString("pt-BR"))}` : ""}</span>
                      </div>
                      <div style="color:var(--color-text);line-height:1.45;word-break:break-word;">${highlightTerms(esc(c.texto), filterTokens)}</div>
                    </div>`;
                  })
                  .join("")}
              </div>
            </div>`
          : `<div style="margin-top:8px;font-size:0.74rem;color:var(--color-text-dim);">Nenhum comentário extraído para esta publicação.</div>`;

        const firstImgSrc = firstImg ? resolveSocialMediaUrl(firstImg.url) : "";
        return `<article class="card" style="padding:var(--space-4);margin-bottom:var(--space-3);border-color:${p.matchPalavrasChave?.length ? "rgba(245, 158, 11, 0.5)" : "var(--color-border)"};">
          <div style="display:flex;gap:var(--space-4);align-items:flex-start;flex-wrap:wrap;">
            ${firstImgSrc ? `<div style="width:96px;height:96px;border-radius:var(--radius-md);overflow:hidden;border:1px solid var(--color-border);flex-shrink:0;background:var(--color-surface-3);">
              <img src="${esc(firstImgSrc)}" alt="Mídia post" loading="lazy" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.style.display='none'">
            </div>` : ""}
            <div style="flex:1;min-width:240px;">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                  <span class="badge badge-purple" style="font-size:0.7rem;">#${esc(String(p.indice))} • ${esc(p.tipo || "Post")}</span>
                  ${p.autor ? `<span style="font-family:var(--font-mono);font-size:0.78rem;color:var(--color-primary);">@${esc(p.autor)}</span>` : ""}
                  ${(p.matchPalavrasChave || []).map((k) => `<span class="badge badge-red" style="font-size:0.68rem;">Match: ${esc(k)}</span>`).join("")}
                </div>
                <span style="font-size:0.72rem;font-family:var(--font-mono);color:var(--color-text-dim);">
                  ${p.dataPublicacao ? esc(new Date(p.dataPublicacao).toLocaleString("pt-BR")) : "-"}
                </span>
              </div>
              <p style="font-size:0.84rem;color:var(--color-text);line-height:1.5;margin:6px 0;white-space:pre-wrap;word-break:break-word;">${textoHtml}</p>
              <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;font-size:0.75rem;color:var(--color-text-dim);margin-top:8px;">
                <span>❤ <strong style="color:var(--color-text);">${formatNumber(p.likes)}</strong> curtidas</span>
                <span>💬 <strong style="color:var(--color-text);">${formatNumber(p.numComentariosDeclarado)}</strong> comentários</span>
                ${p.compartilhamentos ? `<span>🔁 <strong style="color:var(--color-text);">${formatNumber(p.compartilhamentos)}</strong> reposts</span>` : ""}
                ${p.visualizacoes !== null ? `<span>👁 <strong style="color:var(--color-text);">${formatNumber(p.visualizacoes)}</strong> views</span>` : ""}
                ${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" style="color:var(--color-primary);text-decoration:none;margin-left:auto;">Abrir post ↗</a>` : ""}
              </div>
            </div>
          </div>
          ${commentsHtml}
        </article>`;
      })
      .join("");

    if (window.lucide) lucide.createIcons();
  }

  function renderRelatorioSocial(data) {
    const rel = data?.relatorio || data;
    if (!rel) return;
    currentRelatorio = rel;

    if (progressBox) progressBox.style.display = "none";
    if (resultadosBox) resultadosBox.style.display = "block";

    const perfil = rel.perfil || {};
    const met = rel.metricas || {};
    const intel = rel.inteligenciaOsint || {};
    const ent = intel.entidadesExtraidas || {};
    const param = rel.parametros || {};

    // KPIs
    const setKpi = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    setKpi("bdKpiPosts", formatNumber(met.totalPosts));
    setKpi("bdKpiComentarios", formatNumber(met.totalComentariosColetados));
    setKpi("bdKpiLikes", formatNumber(met.totalLikes));
    setKpi("bdKpiEngajamento", formatNumber(met.engajamentoMedioPorPost));
    setKpi("bdKpiKeywords", formatNumber(met.totalOcorrenciasPalavraChave));

    // Cabeçalho Perfil + Aviso 24h Instagram + Cache badge
    const headerBox = document.getElementById("bdPerfilHeader");
    if (headerBox) {
      const platBadge = param.plataforma === "x"
        ? '<span class="badge badge-dark">X (Twitter)</span>'
        : '<span class="badge badge-purple">Instagram</span>';
      const cacheBadge = data.cached
        ? '<span class="badge badge-green">Cache 24h (0 créditos extras)</span>'
        : '<span class="badge badge-purple">Coleta Ao Vivo Bright Data</span>';

      const avatarProxyUrl = perfil.fotoUrl ? resolveSocialMediaUrl(perfil.fotoUrl) : "";
      headerBox.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
          <div style="display:flex;align-items:center;gap:12px;">
            ${avatarProxyUrl ? `<img src="${esc(avatarProxyUrl)}" alt="Avatar" referrerpolicy="no-referrer" style="width:52px;height:52px;border-radius:999px;object-fit:cover;border:2px solid var(--color-primary);" onerror="this.style.display='none'">` : ""}
            <div>
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                <strong style="font-size:1.05rem;color:var(--color-text);">${esc(perfil.nome || perfil.handle || param.alvo || "Alvo")}</strong>
                ${perfil.handle ? `<span style="font-family:var(--font-mono);color:var(--color-primary);font-size:0.85rem;">@${esc(perfil.handle)}</span>` : ""}
                ${platBadge}
                ${cacheBadge}
              </div>
              <div style="font-size:0.78rem;color:var(--color-text-dim);margin-top:3px;">
                ${perfil.seguidores !== null && perfil.seguidores !== undefined ? `${formatNumber(perfil.seguidores)} seguidores • ` : ""}
                Travas: ${esc(String(param.maxPosts || 20))} posts &bull; ${esc(String(param.maxCommentsPerPost ?? 15))} comentários/post
              </div>
            </div>
          </div>
          ${perfil.url ? `<a href="${esc(perfil.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">Ver Perfil Original ↗</a>` : ""}
        </div>
        ${perfil.bio ? `<p style="font-size:0.8rem;color:var(--color-text-muted);margin:10px 0 0 0;line-height:1.45;">${esc(perfil.bio)}</p>` : ""}
        ${rel.expiracaoMidiaAviso ? `<div style="margin-top:10px;padding:8px 12px;border-radius:var(--radius-sm);background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.35);color:#FCD34D;font-size:0.75rem;">${esc(rel.expiracaoMidiaAviso)}</div>` : ""}
        ${Array.isArray(rel.errosColeta) && rel.errosColeta.length ? `<div style="margin-top:8px;padding:8px 12px;border-radius:var(--radius-sm);background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.35);color:#FCA5A5;font-size:0.75rem;">Aviso da origem: ${esc(rel.errosColeta.map((e) => e.mensagem).join(" | "))}</div>` : ""}
      `;
    }

    // Card Palavras-Chave Encontradas
    const kwCard = document.getElementById("bdKeywordsHitsBox");
    const kwHits = Array.isArray(intel.palavrasChaveResultados) ? intel.palavrasChaveResultados : [];
    if (kwCard) {
      if (kwHits.length > 0) {
        kwCard.style.display = "block";
        kwCard.innerHTML = `
          <div style="font-size:0.8rem;font-weight:700;color:#FBBF24;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
            <i data-lucide="search-check" style="width:15px;height:15px;"></i>
            Correspondências de Palavras-Chave Identificadas (${kwHits.length}):
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;max-height:220px;overflow-y:auto;">
            ${kwHits
              .slice(0, 25)
              .map(
                (h) => `<div style="background:var(--color-surface-2);border:1px solid rgba(245,158,11,0.3);border-radius:var(--radius-sm);padding:8px 10px;font-size:0.78rem;">
                  <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:3px;">
                    <span><strong style="color:#FBBF24;">[${esc(String(h.origem || "").toUpperCase())}]</strong> <span style="font-family:var(--font-mono);color:var(--color-primary);">${esc(h.autor)}</span></span>
                    <span style="font-size:0.72rem;color:var(--color-text-dim);">Termos: <strong>${esc((h.palavrasEncontradas || []).join(", "))}</strong></span>
                  </div>
                  <div style="color:var(--color-text);line-height:1.4;">${highlightTerms(esc(String(h.texto || "").slice(0, 220)), h.palavrasEncontradas || [])}</div>
                </div>`
              )
              .join("")}
          </div>
        `;
      } else {
        kwCard.style.display = "none";
      }
    }

    // Inteligência OSINT (Entidades + Top Comentaristas + Hashtags)
    const intelBox = document.getElementById("bdInteligenciaGrid");
    if (intelBox) {
      const topC = Array.isArray(intel.topComentaristas) ? intel.topComentaristas : [];
      const emails = ent.emails || [];
      const tels = ent.telefones || [];
      const docs = ent.documentos || [];
      const urlsExt = ent.urlsExternas || [];
      const tags = (intel.hashtagsFrequentes || []).slice(0, 10);
      const mencoes = (intel.mencoesFrequentes || []).slice(0, 10);

      intelBox.innerHTML = `
        <div class="card" style="padding:var(--space-4);">
          <div style="font-size:0.8rem;font-weight:700;color:var(--color-text);margin-bottom:8px;">Entidades &amp; Contatos Extraídos</div>
          <div style="font-size:0.76rem;color:var(--color-text-muted);display:flex;flex-direction:column;gap:5px;">
            <div><strong>E-mails:</strong> ${emails.length ? emails.map((x) => `<span class="badge badge-dark">${esc(x)}</span>`).join(" ") : "Nenhum"}</div>
            <div><strong>Telefones:</strong> ${tels.length ? tels.map((x) => `<span class="badge badge-dark">${esc(x)}</span>`).join(" ") : "Nenhum"}</div>
            <div><strong>CPF/CNPJ citados:</strong> ${docs.length ? docs.map((x) => `<span class="badge badge-red">${esc(x)}</span>`).join(" ") : "Nenhum"}</div>
            <div><strong>Links externos:</strong> ${urlsExt.length ? urlsExt.slice(0, 5).map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer" style="color:var(--color-primary);margin-right:8px;word-break:break-all;">${esc(u.replace(/^https?:\/\//, "").slice(0, 40))}</a>`).join(" ") : "Nenhum"}</div>
            <div><strong>Top Hashtags:</strong> ${tags.length ? tags.map((h) => `${esc(h.tag)} (${h.count})`).join(", ") : "-"}</div>
            <div><strong>Top Menções:</strong> ${mencoes.length ? mencoes.map((m) => `${esc(m.handle)} (${m.count})`).join(", ") : "-"}</div>
          </div>
        </div>
        <div class="card" style="padding:var(--space-4);">
          <div style="font-size:0.8rem;font-weight:700;color:var(--color-text);margin-bottom:8px;">Top Comentaristas (Círculo de Interação)</div>
          ${topC.length
            ? `<div style="display:flex;flex-direction:column;gap:5px;max-height:190px;overflow-y:auto;">
                ${topC
                  .slice(0, 10)
                  .map(
                    (c) => `<div style="display:flex;justify-content:space-between;align-items:center;font-size:0.76rem;padding:4px 8px;background:var(--color-surface-2);border-radius:var(--radius-sm);">
                      <span style="font-family:var(--font-mono);color:var(--color-primary);">@${esc(c.usuario)}</span>
                      <span style="color:var(--color-text-dim);">${c.totalComentarios} coment. • ${c.postsDistintos} post(s)</span>
                    </div>`
                  )
                  .join("")}
              </div>`
            : '<div style="font-size:0.76rem;color:var(--color-text-dim);">Sem comentaristas recorrentes na amostra coletada.</div>'}
        </div>
      `;
    }

    if (localFilterInput) localFilterInput.value = "";
    renderListaPosts(rel, "");
    if (window.lucide) lucide.createIcons();
    resultadosBox.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function pollSnapshot(snapshotId, contextParams, tentativa = 1) {
    if (pollCancelled) return;
    const elapsedSec = Math.round((Date.now() - pollStartedAt) / 1000);

    try {
      const qs = new URLSearchParams({
        phase: contextParams.phase || "posts",
        plataforma: contextParams.plataforma || "instagram",
        modo: contextParams.modo || "perfil",
        alvo: contextParams.alvo || "",
        palavrasChave: contextParams.palavrasChave || "",
        incluirComentarios: String(Boolean(contextParams.incluirComentarios)),
        maxPosts: String(contextParams.maxPosts || 20),
        maxCommentsPerPost: String(contextParams.maxCommentsPerPost ?? 15),
      });

      const res = await window.api.get(`/api/redes/brightdata/progresso/${encodeURIComponent(snapshotId)}?${qs.toString()}`);

      if (pollCancelled) return;

      if (res.status === "ready" && res.relatorio) {
        stopPolling();
        renderRelatorioSocial(res);
        notify("Coleta social Bright Data concluída!", "success");
        return;
      }

      if (res.status === "failed" || res.status === "canceled") {
        stopPolling();
        if (progressBox) progressBox.style.display = "none";
        notify(res.error || "Coleta interrompida na Bright Data.", "error");
        return;
      }

      // Se houve transição automática da Fase 1 (posts) para Fase 2 (comentários Instagram)
      const nextId = res.nextSnapshotId || res.snapshotId || snapshotId;
      const nextPhase = res.phase || contextParams.phase || "posts";

      if (progressTitle) {
        progressTitle.textContent = nextPhase === "comments"
          ? "Fase 2/2: Coletando comentários dos posts (trava até 15/post)..."
          : "Fase 1: Bright Data extraindo posts públicos...";
      }
      if (progressSub) {
        progressSub.textContent = res.postsColetados
          ? `${res.postsColetados} posts coletados! Extraindo comentários agora...`
          : "Aguardando worker distribuído da Bright Data processar a página alvo.";
      }
      if (progressMeta) {
        progressMeta.textContent = `Snapshot: ${nextId} • Decorrido: ${elapsedSec}s • Tentativa ${tentativa}`;
      }

      const delayMs = tentativa <= 3 ? 3500 : 5000;
      activePollTimer = setTimeout(() => {
        pollSnapshot(nextId, { ...contextParams, phase: nextPhase }, tentativa + 1);
      }, delayMs);
    } catch (err) {
      if (pollCancelled) return;
      stopPolling();
      if (progressBox) progressBox.style.display = "none";
      notify(err.message || "Falha ao monitorar snapshot Bright Data.", "error");
    }
  }

  async function executarColetaBrightData() {
    const plataforma = selectPlataforma?.value || "instagram";
    const modo = selectModo?.value || "perfil";
    const alvo = (inputAlvo?.value || "").trim();
    const palavrasChave = (inputPalavras?.value || "").trim();
    const maxPosts = Number(inputMaxPosts?.value || 20);
    const incluirComentarios = Boolean(checkComentarios?.checked);
    const maxCommentsPerPost = incluirComentarios ? Number(inputMaxComments?.value ?? 15) : 0;

    if (!alvo && !palavrasChave) {
      notify("Informe um @usuário, URL de post ou palavra-chave.", "warning");
      if (inputAlvo) inputAlvo.focus();
      return;
    }

    stopPolling();
    pollCancelled = false;
    pollStartedAt = Date.now();

    if (btnIniciar) {
      btnIniciar.disabled = true;
      btnIniciar.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span> Iniciando Coleta...';
    }
    if (resultadosBox) resultadosBox.style.display = "none";
    if (progressBox) progressBox.style.display = "block";
    if (progressTitle) progressTitle.textContent = "Disparando coleta assíncrona na Bright Data...";
    if (progressSub) progressSub.textContent = "Verificando cache de 24h e aplicando travas de cota.";
    if (progressMeta) progressMeta.textContent = `Travas: máx ${maxPosts} posts • até ${maxCommentsPerPost} comentários/post`;

    try {
      const payload = {
        plataforma,
        modo,
        alvo: alvo || palavrasChave,
        palavrasChave,
        incluirComentarios,
        maxPosts,
        maxCommentsPerPost,
        startDate: inputStartDate?.value || "",
        endDate: inputEndDate?.value || "",
      };

      const startRes = await window.api.post("/api/redes/brightdata/iniciar", payload);

      if (startRes.status === "ready" && startRes.relatorio) {
        stopPolling();
        renderRelatorioSocial(startRes);
        notify("Relatório carregado instantaneamente do cache 24h!", "success");
        return;
      }

      if (startRes.snapshotId) {
        if (progressTitle) {
          progressTitle.textContent = "Fase 1: Bright Data extraindo posts públicos...";
        }
        if (progressMeta) {
          progressMeta.textContent = `Snapshot: ${startRes.snapshotId} • Máx estimado: ${startRes.travas?.estimativaMaximaRegistros || maxPosts} registros`;
        }
        activePollTimer = setTimeout(() => {
          pollSnapshot(startRes.snapshotId, payload, 1);
        }, 3000);
      } else {
        throw new Error(startRes.error || "Resposta inesperada ao iniciar snapshot.");
      }
    } catch (err) {
      stopPolling();
      if (progressBox) progressBox.style.display = "none";
      notify(err.message || "Erro ao iniciar coleta Bright Data.", "error");
    }
  }

  function renderCustomImagesPreview() {
    if (customImagesCount) {
      const n = customDossieImages.length;
      customImagesCount.textContent = `${n} print${n === 1 ? "" : "s"}/imagem${n === 1 ? "" : "ns"} anexada${n === 1 ? "" : "s"}`;
      customImagesCount.className = n > 0 ? "badge badge-purple" : "badge badge-dark";
    }
    if (!customImagesPreview) return;

    if (customDossieImages.length === 0) {
      customImagesPreview.style.display = "none";
      customImagesPreview.innerHTML = "";
      return;
    }

    customImagesPreview.style.display = "flex";
    customImagesPreview.innerHTML = customDossieImages
      .map(
        (img) => `<div style="display:flex;align-items:center;gap:8px;background:#131926;border:1px solid #26314A;border-radius:6px;padding:6px 8px;max-width:290px;">
          <img src="${esc(img.dataUrl)}" alt="${esc(img.legenda || img.nome)}" style="width:44px;height:44px;object-fit:cover;border-radius:4px;flex-shrink:0;" />
          <div style="display:flex;flex-direction:column;gap:3px;min-width:140px;flex:1;">
            <input type="text" class="bd-custom-caption" data-id="${esc(img.id)}" value="${esc(img.legenda)}" placeholder="Legenda da evidência..." style="background:#080B11;border:1px solid #26314A;color:#E2E8F0;border-radius:4px;padding:3px 6px;font-size:0.72rem;width:100%;" />
            <span style="font-size:0.65rem;color:#64748B;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(img.nome)}</span>
          </div>
          <button type="button" class="btn-bd-remove-img" data-id="${esc(img.id)}" title="Remover imagem" style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#F87171;border-radius:4px;width:24px;height:24px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">&times;</button>
        </div>`
      )
      .join("");

    customImagesPreview.querySelectorAll(".bd-custom-caption").forEach((inp) => {
      inp.addEventListener("change", () => {
        const target = customDossieImages.find((x) => x.id === inp.dataset.id);
        if (target) {
          target.legenda = inp.value.trim();
          atualizarConteudoDossie();
        }
      });
    });

    customImagesPreview.querySelectorAll(".btn-bd-remove-img").forEach((btn) => {
      btn.addEventListener("click", () => {
        customDossieImages = customDossieImages.filter((x) => x.id !== btn.dataset.id);
        renderCustomImagesPreview();
        atualizarConteudoDossie();
      });
    });
  }

  function adicionarArquivosImagem(files) {
    const list = Array.from(files || []).filter((f) => f && f.type && f.type.startsWith("image/"));
    if (list.length === 0) return;

    const espacoRestante = Math.max(0, 10 - customDossieImages.length);
    if (espacoRestante === 0) {
      notify("Limite de 10 imagens extras atingido neste dossiê.", "warning");
      return;
    }

    list.slice(0, espacoRestante).forEach((file) => {
      if (file.size > 4 * 1024 * 1024) {
        notify(`Imagem "${file.name}" excede 4MB.`, "warning");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== "string") return;
        customDossieImages.push({
          id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          nome: file.name || "evidencia.png",
          legenda: file.name ? file.name.replace(/\.[^/.]+$/, "") : "Evidência anexada",
          dataUrl: reader.result,
        });
        renderCustomImagesPreview();
        atualizarConteudoDossie();
      };
      reader.readAsDataURL(file);
    });
  }

  function atualizarConteudoDossie() {
    if (!currentRelatorio || !window.OsintDarkReport?.renderBrightDataSocialReport) return;
    const termo = currentRelatorio.perfil?.handle
      ? `@${currentRelatorio.perfil.handle}`
      : (currentRelatorio.parametros?.alvo || "social-osint");

    currentDossieInnerHtml = window.OsintDarkReport.renderBrightDataSocialReport({
      termo,
      data: currentRelatorio,
      systemBadge: "BRIGHT DATA SOCIAL OSINT",
      customImages: customDossieImages,
      includePostImages: checkIncluirFotosPosts ? Boolean(checkIncluirFotosPosts.checked) : true,
    });

    if (modalDossieBody) modalDossieBody.innerHTML = currentDossieInnerHtml;
  }

  function abrirDossieSocial() {
    if (!currentRelatorio || !window.OsintDarkReport?.renderBrightDataSocialReport) {
      notify("Realize uma coleta primeiro para gerar o dossiê.", "warning");
      return;
    }
    renderCustomImagesPreview();
    atualizarConteudoDossie();
    if (modalDossie) modalDossie.style.display = "flex";
    if (window.lucide) lucide.createIcons();
  }

  // API pública para pivotar direto dos cards de perfis do PatrickUser/YesItsMe
  window.rimuPrefillBrightData = ({ plataforma = "instagram", modo = "perfil", alvo = "", autoStart = false } = {}) => {
    if (selectPlataforma) selectPlataforma.value = plataforma;
    if (selectModo) selectModo.value = modo;
    if (inputAlvo) inputAlvo.value = alvo;
    updateModeLabels();
    section.scrollIntoView({ behavior: "smooth", block: "start" });
    if (inputAlvo) inputAlvo.focus();
    if (autoStart) executarColetaBrightData();
  };

  if (selectPlataforma) selectPlataforma.addEventListener("change", updateModeLabels);
  if (selectModo) selectModo.addEventListener("change", updateModeLabels);

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      executarColetaBrightData();
    });
  }

  if (btnCancelar) {
    btnCancelar.addEventListener("click", () => {
      stopPolling();
      if (progressBox) progressBox.style.display = "none";
      notify("Acompanhamento encerrado localmente.", "info");
    });
  }

  if (localFilterInput) {
    localFilterInput.addEventListener("input", () => {
      if (currentRelatorio) renderListaPosts(currentRelatorio, localFilterInput.value);
    });
  }

  function buildOfflineHtmlWithLoadedImages() {
    if (!modalDossieBody) return currentDossieInnerHtml;
    const clone = modalDossieBody.cloneNode(true);
    const liveImgs = modalDossieBody.querySelectorAll("img");
    const clonedImgs = clone.querySelectorAll("img");
    liveImgs.forEach((img, i) => {
      const target = clonedImgs[i];
      if (!target) return;
      const src = img.getAttribute("src") || "";
      if (!src.startsWith("/api/redes/brightdata/midia") || !img.complete || img.naturalWidth === 0) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          target.setAttribute("src", canvas.toDataURL("image/jpeg", 0.88));
        }
      } catch {
        // Mantém URL original caso canvas não consiga converter
      }
    });
    return clone.innerHTML || currentDossieInnerHtml;
  }

  if (btnAbrirDossie) btnAbrirDossie.addEventListener("click", abrirDossieSocial);
  if (btnBdDownloadHtml) {
    btnBdDownloadHtml.addEventListener("click", () => {
      if (!currentDossieInnerHtml) return;
      const standaloneInner = buildOfflineHtmlWithLoadedImages();
      window.OsintDarkReport.downloadHtml({
        innerHtml: standaloneInner,
        titlePrefix: "dossie-social-brightdata",
        termo: currentRelatorio?.perfil?.handle || currentRelatorio?.parametros?.alvo || "social",
      });
    });
  }
  if (btnBdExportPdf) {
    btnBdExportPdf.addEventListener("click", () => {
      if (!currentDossieInnerHtml) return;
      window.OsintDarkReport.exportPdf({
        innerHtml: currentDossieInnerHtml,
        titleText: `Dossiê Social OSINT - ${currentRelatorio?.perfil?.handle || "Alvo"}`,
      });
    });
  }

  document.querySelectorAll(".btn-fechar-bd-dossie").forEach((b) => {
    b.addEventListener("click", () => {
      if (modalDossie) modalDossie.style.display = "none";
    });
  });

  if (modalDossie) {
    modalDossie.addEventListener("click", (e) => {
      if (e.target === modalDossie) modalDossie.style.display = "none";
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalDossie && modalDossie.style.display !== "none") {
      modalDossie.style.display = "none";
    }
  });

  if (btnBdAddImagem && inputCustomImages) {
    btnBdAddImagem.addEventListener("click", () => inputCustomImages.click());
    inputCustomImages.addEventListener("change", () => {
      if (inputCustomImages.files?.length) {
        adicionarArquivosImagem(inputCustomImages.files);
        inputCustomImages.value = "";
      }
    });
  }

  if (checkIncluirFotosPosts) {
    checkIncluirFotosPosts.addEventListener("change", atualizarConteudoDossie);
  }

  document.addEventListener("paste", (e) => {
    if (!modalDossie || modalDossie.style.display === "none") return;
    const items = e.clipboardData?.items;
    if (!items) return;
    const files = [];
    for (const item of items) {
      if (item.type && item.type.startsWith("image/")) {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length > 0) {
      adicionarArquivosImagem(files);
      notify(`${files.length} print(s) colado(s) no dossiê!`, "success");
    }
  });

  updateModeLabels();
  carregarStatusBrightData();
});
