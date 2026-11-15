/**
 * ==============================================================================
 * RIMUBUSCA - CLIENT CONTROLLER DE E-MAIL (PUBLIC/JS/EMAIL.JS)
 * Motores: Mosint (DNS & Técnico), Holehe (Contas) e GHunt (Google OSINT)
 * ==============================================================================
 */

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("formInvestigarEmail");
  const inputEmail = document.getElementById("inputEmail");
  const btnSubmit = document.getElementById("btnSubmitEmail");
  const skeleton = document.getElementById("emailSkeleton");
  const containerResultados = document.getElementById("emailResultados");

  let ultimoResultado = null;

  // Botões de Exemplo Rápido
  document.querySelectorAll(".demo-email-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const email = btn.dataset.email;
      if (email) {
        inputEmail.value = email;
        form.dispatchEvent(new Event("submit"));
      }
    });
  });

  // Submissão do Formulário
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = inputEmail.value.trim();

    if (!email || !email.includes("@")) {
      window.toast?.error("Por favor, informe um endereço de e-mail válido.");
      inputEmail.focus();
      return;
    }

    btnSubmit.disabled = true;
    skeleton.style.display = "block";
    containerResultados.style.display = "none";

    try {
      const response = await window.api.post("/api/email/investigar", { email });

      if (response && response.success && response.data) {
        ultimoResultado = response.data;
        renderizarResultados(response.data);
        containerResultados.style.display = "block";
        window.toast?.success("Investigação OSINT de e-mail concluída com sucesso!");

        containerResultados.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        window.toast?.error(response.error || "Falha ao investigar o e-mail informado.");
      }
    } catch (err) {
      console.error("[ERRO CLIENTE EMAIL]:", err);
      window.toast?.error(err.message || "Erro de comunicação com o servidor.");
    } finally {
      btnSubmit.disabled = false;
      skeleton.style.display = "none";
    }
  });

  /**
   * Renderiza os dados retornados pelos 3 motores (Mosint, Holehe, GHunt)
   */
  function renderizarResultados(data) {
    // 1. Cabeçalho Geral do Alvo
    document.getElementById("resEmailTitulo").textContent = data.email;
    document.getElementById("resUsuario").textContent = data.usuario;
    document.getElementById("resDominio").textContent = data.dominio;

    // Avatar Unificado (GHunt Google -> Gravatar -> Inicial)
    const avatarContainer = document.getElementById("resAvatarContainer");
    const avatarUrl = data.avatarUrl || data.ghunt?.avatarUrl;

    if (avatarUrl) {
      avatarContainer.innerHTML = `<img src="${avatarUrl}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" onerror="this.onerror=null; this.parentElement.innerHTML='<span style=\\'font-weight: 700; color: var(--color-primary); font-size: 1.25rem;\\'>${(data.usuario || 'U').charAt(0).toUpperCase()}</span>'">`;
    } else {
      const inicial = (data.usuario || "U").charAt(0).toUpperCase();
      avatarContainer.innerHTML = `<span style="font-weight: 700; color: var(--color-primary); font-size: 1.25rem;">${inicial}</span>`;
    }

    // Classificação Mosint
    const badgeClassificacao = document.getElementById("resBadgeClassificacao");
    const tipo = data.mosint?.tipo || "Corporativo";
    badgeClassificacao.textContent = tipo;
    if (data.mosint?.isDescartavel) {
      badgeClassificacao.className = "badge badge-red";
    } else if (data.mosint?.isCorporativo) {
      badgeClassificacao.className = "badge badge-purple";
    } else {
      badgeClassificacao.className = "badge badge-dark";
    }

    // Provedor de Correio
    document.getElementById("resProvedorDetectado").textContent =
      data.mosint?.provedorDetectado || "Desconhecido";

    // 2. MOTOR DIABLINDA (Substituto Turbinado do Holehe): Contas em Redes Sociais
    const totalHoleheBadge = document.getElementById("resTotalHoleheBadge");
    const holeheContainer = document.getElementById("resHoleheContainer");
    const diablindaSource = data.diablinda || data.holehe || {};
    const totalEncontrados = diablindaSource.totalEncontrados || 0;
    const totalVerificados = diablindaSource.totalVerificados || 0;

    totalHoleheBadge.textContent = `${totalEncontrados} / ${totalVerificados} Plataformas`;
    totalHoleheBadge.className = totalEncontrados > 0 ? "badge badge-purple" : "badge badge-dark";

    if (diablindaSource.plataformas && diablindaSource.plataformas.length > 0) {
      holeheContainer.innerHTML = diablindaSource.plataformas
        .map((p) => {
          const isReg = p.registrado;
          const brandColor = p.cor || (isReg ? 'var(--color-success)' : 'var(--color-text-dim)');
          const iconContent = p.iconSvg
            ? `<span style="width: 16px; height: 16px; display: inline-flex; align-items: center; justify-content: center; color: ${brandColor};">${p.iconSvg}</span>`
            : `<i data-lucide="${p.icone || 'globe'}" style="width: 16px; height: 16px; color: ${brandColor};"></i>`;

          let metaBadges = '';
          if (p.metadata && Object.keys(p.metadata).length > 0) {
            const m = p.metadata;
            if (m.streak) metaBadges += `<span class="badge badge-dark" style="font-size: 0.68rem; margin-top: 2px;">🔥 Streak: ${m.streak} dias</span> `;
            if (m.xp) metaBadges += `<span class="badge badge-dark" style="font-size: 0.68rem; margin-top: 2px;">⚡ ${m.xp} XP</span> `;
            if (m.repos) metaBadges += `<span class="badge badge-dark" style="font-size: 0.68rem; margin-top: 2px;">📦 ${m.repos} repos</span> `;
            if (m.followers) metaBadges += `<span class="badge badge-dark" style="font-size: 0.68rem; margin-top: 2px;">👥 ${m.followers} seg.</span> `;
            if (m.name && m.name !== p.nome) metaBadges += `<span class="badge badge-dark" style="font-size: 0.68rem; margin-top: 2px;">👤 ${m.name}</span> `;
          }

          return `
            <div class="holehe-item ${isReg ? "registered" : ""}" style="${isReg && p.cor ? `border-left: 3px solid ${p.cor};` : ''}">
              <div class="holehe-header">
                <span class="holehe-name">
                  ${iconContent}
                  <span>${p.nome}</span>
                </span>
                <span class="badge ${isReg ? 'badge-purple' : 'badge-dark'}" style="${isReg ? 'background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3);' : ''}">
                  ${isReg ? 'Registrado' : 'Não Detectado'}
                </span>
              </div>
              ${metaBadges ? `<div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px;">${metaBadges}</div>` : ''}
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: var(--color-text-dim); margin-top: 4px;">
                <span>${p.categoria}</span>
                ${isReg && p.urlPerfil ? `<a href="${p.urlPerfil}" target="_blank" rel="noopener noreferrer" style="color: var(--color-primary); display: flex; align-items: center; gap: 2px;">Abrir <i data-lucide="external-link" style="width: 10px; height: 10px;"></i></a>` : ''}
              </div>
            </div>
          `;
        })
        .join("");
    } else {
      holeheContainer.innerHTML = `<div style="grid-column: 1 / -1; color: var(--color-text-dim); font-size: 0.85rem;">Nenhuma checagem de conta disponível.</div>`;
    }

    // 3. MOTOR RIMUHUNT (Substituto Turbinado do GHunt): Inteligência Google
    const ghuntStatusBadge = document.getElementById("resGHuntStatusBadge");
    const ghuntContainer = document.getElementById("resGHuntContainer");
    const rimuhuntSource = data.rimuhunt || data.ghunt || {};

    if (rimuhuntSource.isGoogleAccount) {
      const hasGaia = Boolean(rimuhuntSource.gaiaId);
      ghuntStatusBadge.textContent = hasGaia ? "Rimuhunt Conectado (Gaia ID Ativo)" : "Conta Google Identificada";
      ghuntStatusBadge.className = "badge badge-purple";
      ghuntStatusBadge.style.color = "#4ade80";
      ghuntStatusBadge.style.borderColor = "rgba(34, 197, 94, 0.3)";

      const servicosHtml = (rimuhuntSource.servicosAtivos || [])
        .map(
          (s) => `
          <div class="ghunt-service-pill">
            <i data-lucide="${s.icone || 'check-circle'}" style="width: 20px; height: 20px; color: var(--color-primary); flex-shrink: 0; margin-top: 2px;"></i>
            <div>
              <div style="font-size: 0.85rem; font-weight: 600; color: var(--color-text);">${s.nome}</div>
              <div style="font-size: 0.75rem; color: var(--color-text-dim);">${s.descricao}</div>
            </div>
          </div>
        `
        )
        .join("");

      const avatarCardHtml = rimuhuntSource.avatarUrl
        ? `
        <div style="margin-top: var(--space-3); padding: 10px 14px; background: rgba(139, 92, 246, 0.08); border: 1px solid rgba(139, 92, 246, 0.25); border-radius: var(--radius-md); font-size: 0.8rem; color: var(--color-text); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <i data-lucide="image" style="width: 18px; height: 18px; color: var(--color-primary); flex-shrink: 0;"></i>
            <span><strong>Foto de Perfil Original Google (=s0 HD):</strong> Foto de resolução nativa extraída com sucesso.</span>
          </div>
          <a href="${rimuhuntSource.avatarUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="font-size: 0.72rem;">
            Ver Foto HD <i data-lucide="external-link" style="width: 10px; height: 10px;"></i>
          </a>
        </div>
      `
        : "";

      ghuntContainer.innerHTML = `
        <div class="ghunt-card">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-3); border-bottom: 1px solid var(--color-border); padding-bottom: var(--space-3);">
            <div>
              <div style="font-size: 0.75rem; color: var(--color-text-dim);">Tipo de Conta Google</div>
              <div style="font-size: 1rem; font-weight: 700; color: var(--color-text);">${rimuhuntSource.nomeCompleto ? `${rimuhuntSource.nomeCompleto} (${rimuhuntSource.tipoConta})` : (rimuhuntSource.tipoConta || 'Google Pessoal')}</div>
            </div>
            <div>
              <div style="font-size: 0.75rem; color: var(--color-text-dim);">Google Gaia ID / User ID</div>
              <div style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--color-primary);">${rimuhuntSource.gaiaId || 'Identificado na infraestrutura Google'}</div>
            </div>
          </div>

          ${avatarCardHtml}

          <div style="margin-top: var(--space-4);">
            <div style="font-size: 0.8rem; font-weight: 600; color: var(--color-text-muted); margin-bottom: 4px;">
              Serviços Google com Presença / Atividade Identificada:
            </div>
            <div class="ghunt-services-grid">
              ${servicosHtml || '<div style="font-size: 0.8rem; color: var(--color-text-dim);">Presença confirmada no Gmail e serviços do ecossistema.</div>'}
            </div>
          </div>

          <div style="display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-4); padding-top: var(--space-3); border-top: 1px solid var(--color-border);">
            <a href="${rimuhuntSource.linksDiretos?.googleMapsContributions || '#'}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">
              <i data-lucide="map-pin" style="width: 14px; height: 14px;"></i>
              Avaliações no Google Maps
            </a>
            <a href="${rimuhuntSource.linksDiretos?.youtubeSearch || '#'}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">
              <i data-lucide="video" style="width: 14px; height: 14px;"></i>
              Canal no YouTube
            </a>
            <a href="${rimuhuntSource.linksDiretos?.googleCalendar || '#'}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">
              <i data-lucide="calendar" style="width: 14px; height: 14px;"></i>
              Agenda Pública Google
            </a>
          </div>
        </div>
      `;
    } else {
      ghuntStatusBadge.textContent = "Não é Conta Google";
      ghuntStatusBadge.className = "badge badge-dark";
      ghuntContainer.innerHTML = `
        <div style="padding: var(--space-4); text-align: center; color: var(--color-text-dim); background: var(--color-surface-2); border-radius: var(--radius-md);">
          <i data-lucide="info" style="width: 24px; height: 24px; margin-bottom: 6px;"></i>
          <p style="margin: 0; font-size: 0.85rem;">${rimuhuntSource.mensagem || 'O domínio investigado não utiliza serviços do Google Workspace ou Gmail.'}</p>
        </div>
      `;
    }

    // 4. MOTOR MOSINT: DNS & Entregabilidade
    const resMxStatusBadge = document.getElementById("resMxStatusBadge");
    const resMxStatus = document.getElementById("resMxStatus");
    const resSpfStatus = document.getElementById("resSpfStatus");
    const resDmarcStatus = document.getElementById("resDmarcStatus");
    const resMxHostsList = document.getElementById("resMxHostsList");

    if (data.mosint?.dns?.mxAtivo) {
      resMxStatusBadge.textContent = "MX Válido";
      resMxStatusBadge.className = "badge badge-purple";
      resMxStatus.textContent = "Ativo e Respondendo";
      resMxStatus.style.color = "var(--color-success)";
    } else {
      resMxStatusBadge.textContent = "Sem MX";
      resMxStatusBadge.className = "badge badge-red";
      resMxStatus.textContent = "Inexistente / Não Recebe Mensagens";
      resMxStatus.style.color = "var(--color-secondary)";
    }

    resSpfStatus.textContent = data.mosint?.dns?.spfConfigurado ? "Configurado (v=spf1)" : "Não Detectado";
    resSpfStatus.style.color = data.mosint?.dns?.spfConfigurado ? "var(--color-success)" : "var(--color-secondary)";

    resDmarcStatus.textContent = data.mosint?.dns?.dmarcConfigurado ? "Protegido (v=DMARC1)" : "Não Detectado";
    resDmarcStatus.style.color = data.mosint?.dns?.dmarcConfigurado ? "var(--color-success)" : "var(--color-text-dim)";

    if (data.mosint?.dns?.mxRecords && data.mosint.dns.mxRecords.length > 0) {
      resMxHostsList.innerHTML = data.mosint.dns.mxRecords
        .map((mx) => `<div>[Prio ${mx.priority}] ${mx.exchange}</div>`)
        .join("");
    } else {
      resMxHostsList.innerHTML = '<span style="color: var(--color-secondary);">Nenhum registro MX encontrado na zona DNS.</span>';
    }

    // Hashes
    document.getElementById("resHashMd5").textContent = data.hashes.md5;
    document.getElementById("resHashSha256").textContent = data.hashes.sha256;

    document.getElementById("linkGoogleProfile").href =
      data.ghunt?.linksDiretos?.googleContacts || `https://contacts.google.com/search/${encodeURIComponent(data.email)}`;
    document.getElementById("linkGithubProfile").href =
      `https://github.com/search?q=${encodeURIComponent(data.email)}&type=users`;

    // 5. Google Dorks (Padrão: Oculto se não ativado nas configurações)
    const dorksContainer = document.getElementById("resDorksContainer");
    const cardDorks = dorksContainer ? dorksContainer.closest('.card') : null;
    const showDorksPref = window.rimuSettings ? window.rimuSettings.showGoogleDorks : (localStorage.getItem('rimu_pref_show_google_dorks') === 'true');

    if (cardDorks) {
      cardDorks.style.display = showDorksPref ? 'block' : 'none';
    }

    if (showDorksPref && dorksContainer && data.dorks && data.dorks.length > 0) {
      dorksContainer.innerHTML = data.dorks
        .map(
          (d) => `
          <div class="dork-item">
            <div class="dork-title">
              <span>${d.titulo}</span>
            </div>
            <div class="dork-query" title="${d.query}">${d.query}</div>
            <div class="dork-actions">
              <a href="${d.url}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="flex: 1; justify-content: center; font-size: 0.75rem;">
                <i data-lucide="external-link" style="width: 12px; height: 12px;"></i>
                Executar Dork
              </a>
              <button type="button" class="btn btn-secondary btn-sm btn-copiar-dork" data-query="${encodeURIComponent(d.query)}" title="Copiar query">
                <i data-lucide="copy" style="width: 12px; height: 12px;"></i>
              </button>
            </div>
          </div>
        `
        )
        .join("");

      document.querySelectorAll(".btn-copiar-dork").forEach((btn) => {
        btn.addEventListener("click", () => {
          const q = decodeURIComponent(btn.dataset.query || "");
          window.copyToClipboard(q, "Google Dork copiada!");
        });
      });
    }

    if (typeof lucide !== "undefined") {
      lucide.createIcons();
    }
  }

  // Copiar Hashes
  document.getElementById("btnCopiarHashes")?.addEventListener("click", () => {
    if (!ultimoResultado) return;
    const txt = `MD5: ${ultimoResultado.hashes.md5}\nSHA-256: ${ultimoResultado.hashes.sha256}`;
    window.copyToClipboard(txt, "Hashes copiados para a área de transferência!");
  });

  // Modal JSON
  const modalJson = document.getElementById("modalJson");
  const preModalJson = document.getElementById("preModalJson");

  document.getElementById("btnVerJsonCompleto")?.addEventListener("click", () => {
    if (!ultimoResultado) return;
    preModalJson.textContent = JSON.stringify(ultimoResultado, null, 2);
    modalJson.style.display = "flex";
  });

  document.getElementById("btnCopiarJsonModal")?.addEventListener("click", () => {
    if (!ultimoResultado) return;
    window.copyToClipboard(JSON.stringify(ultimoResultado, null, 2), "JSON copiado com sucesso!");
  });
});
