/**
 * ==============================================================================
 * RIMUBUSCA - CLIENT CONTROLLER DE REDES SOCIAIS & YESITSME (PUBLIC/JS/REDES.JS)
 * Motor avançado de correlação de perfis com cálculo de probabilidade exata,
 * Extração Profunda (Foto HD, Idade da Conta via ID, Parser de Bio/Entidades
 * e Pivotamento Social Cross-Platform).
 * ==============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('formRedes');
  const inputNome = document.getElementById('inputNome');
  const inputEmail = document.getElementById('inputEmail');
  const inputTelefone = document.getElementById('inputTelefone');
  const inputUsername = document.getElementById('inputUsername');
  const selectProfissao = document.getElementById('selectProfissao');
  const btnSubmit = document.getElementById('btnSubmitRedes');
  const skeleton = document.getElementById('redesSkeleton');
  const containerResultados = document.getElementById('redesResultados');

  let ultimoResultado = null;

  // Controle de Abas de Busca
  const tabModeUsername = document.getElementById('tabModeUsername');
  const tabModePessoa = document.getElementById('tabModePessoa');
  const tabModeBrightData = document.getElementById('tabModeBrightData');
  const panelModeUsername = document.getElementById('panelModeUsername');
  const panelModePessoa = document.getElementById('panelModePessoa');
  const btnSubmitText = document.getElementById('btnSubmitText');

  function ativarModoBusca(modo) {
    [tabModeUsername, tabModePessoa, tabModeBrightData].forEach((t) => {
      if (t) {
        t.style.background = 'var(--color-surface-2)';
        t.style.color = 'var(--color-text-muted)';
        t.style.borderColor = 'var(--color-border)';
      }
    });

    if (modo === 'username') {
      if (tabModeUsername) {
        tabModeUsername.style.background = 'rgba(139, 92, 246, 0.2)';
        tabModeUsername.style.color = '#FFFFFF';
        tabModeUsername.style.borderColor = 'var(--color-primary)';
      }
      if (panelModeUsername) panelModeUsername.style.display = 'block';
      if (panelModePessoa) panelModePessoa.style.display = 'none';
      if (btnSubmitText) btnSubmitText.textContent = 'Rastrear Contas em 80+ Redes';
      if (inputUsername) inputUsername.focus();
    } else if (modo === 'pessoa') {
      if (tabModePessoa) {
        tabModePessoa.style.background = 'rgba(56, 189, 248, 0.2)';
        tabModePessoa.style.color = '#FFFFFF';
        tabModePessoa.style.borderColor = '#38BDF8';
      }
      if (panelModeUsername) panelModeUsername.style.display = 'none';
      if (panelModePessoa) panelModePessoa.style.display = 'block';
      if (btnSubmitText) btnSubmitText.textContent = 'Cruzar Dados & Localizar Perfis';
      if (inputNome) inputNome.focus();
    } else if (modo === 'brightdata') {
      const bdSection = document.getElementById('bdSocialSection');
      if (bdSection) {
        bdSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const targetInput = document.getElementById('bdTargetInput');
        if (targetInput) setTimeout(() => targetInput.focus(), 400);
      }
    }
  }

  tabModeUsername?.addEventListener('click', () => ativarModoBusca('username'));
  tabModePessoa?.addEventListener('click', () => ativarModoBusca('pessoa'));
  tabModeBrightData?.addEventListener('click', () => ativarModoBusca('brightdata'));

  // Carrega opções de classificações/profissões do catálogo central se o select estiver vazio
  async function carregarClassificacoesDinamicas() {
    if (!selectProfissao || selectProfissao.options.length > 2) return;
    try {
      const res = await window.api.get('/api/redes/classificacoes');
      if (res && res.success && res.data) {
        selectProfissao.innerHTML = '<option value="">Automático / Geral (Varre todas as variantes)</option>';
        Object.entries(res.data).forEach(([key, item]) => {
          const opt = document.createElement('option');
          opt.value = key;
          opt.textContent = item.label || key;
          selectProfissao.appendChild(opt);
        });
      }
    } catch {
      // Ignora erro caso o SSR já tenha populado as opções
    }
  }
  carregarClassificacoesDinamicas();

  // Botões de Demonstração
  document.querySelectorAll('.demo-redes-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      inputNome.value = btn.dataset.nome || '';
      inputEmail.value = btn.dataset.email || '';
      inputTelefone.value = btn.dataset.phone || '';
      if (inputUsername) inputUsername.value = btn.dataset.user || '';
      if (selectProfissao) selectProfissao.value = btn.dataset.prof || '';
      form.dispatchEvent(new Event('submit'));
    });
  });

  // Submissão do Formulário
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nome = inputNome.value.trim();
    const email = inputEmail.value.trim();
    const telefone = inputTelefone.value.trim();
    const username = inputUsername ? inputUsername.value.trim() : '';
    const profissao = selectProfissao ? selectProfissao.value.trim() : '';

    if (!nome && !email && !telefone && !username) {
      window.toast?.error('Por favor, informe ao menos um critério (Nome, E-mail, Telefone ou @Username).');
      inputNome.focus();
      return;
    }

    btnSubmit.disabled = true;
    skeleton.style.display = 'block';
    containerResultados.style.display = 'none';

    try {
      const response = await window.api.post('/api/redes/investigar', {
        nome,
        email,
        telefone,
        username,
        profissao,
      });

      if (response && response.success && response.data) {
        ultimoResultado = response.data;
        renderizarResultados(response.data);
        containerResultados.style.display = 'block';
        window.toast?.success('Correlação e extração profunda concluídas!');
        containerResultados.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.toast?.error(response.error || 'Falha ao correlacionar perfis sociais.');
      }
    } catch (err) {
      console.error('[ERRO CLIENTE REDES]:', err);
      window.toast?.error(err.message || 'Erro de comunicação com o servidor.');
    } finally {
      btnSubmit.disabled = false;
      skeleton.style.display = 'none';
    }
  });

  function formatarContagem(val) {
    if (val === undefined || val === null || val === '') return '0';
    const n = Number(val);
    if (isNaN(n)) return String(val);
    if (n >= 1_000_000_000) {
      return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
    }
    if (n >= 1_000_000) {
      return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (n >= 10_000) {
      return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return n.toLocaleString('pt-BR');
  }

  function renderizarResultados(data) {
    document.getElementById('resTotalPerfis').textContent = `${data.totalResultados} Perfil(s) Encontrado(s)`;
    document.getElementById('resFonte').textContent = data.statusSessao || data.fonte || 'YesItsMe OSINT Engine';

    // Badge do Melhor Match
    const badgeMelhorMatch = document.getElementById('resMelhorMatchBadge');
    if (badgeMelhorMatch && data.melhorScore !== undefined) {
      badgeMelhorMatch.style.display = 'inline-flex';
      badgeMelhorMatch.textContent = `Melhor Certeza: ${data.melhorScore}%`;
      if (data.melhorScore >= 75) {
        badgeMelhorMatch.className = 'badge badge-green';
        badgeMelhorMatch.style.borderColor = 'rgba(34, 197, 94, 0.4)';
        badgeMelhorMatch.style.color = 'var(--color-success)';
      } else if (data.melhorScore >= 45) {
        badgeMelhorMatch.className = 'badge badge-purple';
        badgeMelhorMatch.style.color = 'var(--color-primary)';
      } else {
        badgeMelhorMatch.className = 'badge badge-dark';
        badgeMelhorMatch.style.color = 'var(--color-text-dim)';
      }
    }

    // Badge de Permutações Avaliadas
    const badgePerms = document.getElementById('resTotalPermsBadge');
    if (badgePerms) {
      if (data.totalPermutacoes) {
        badgePerms.style.display = 'inline-flex';
        badgePerms.textContent = `${data.totalPermutacoes} Permutações Avaliadas`;
      } else {
        badgePerms.style.display = 'none';
      }
    }

    // Máscaras Oficiais Esperadas
    const boxMascaras = document.getElementById('resMascarasContainer');
    const boxMaskEmail = document.getElementById('resBoxMaskEmail');
    const boxMaskTel = document.getElementById('resBoxMaskTel');
    const txtMaskEmail = document.getElementById('resTextoMaskEmail');
    const txtMaskTel = document.getElementById('resTextoMaskTel');

    if (boxMascaras) {
      const temMaskEmail = Boolean(data.mascarasEsperadas?.email);
      const temMaskTel = Boolean(data.mascarasEsperadas?.telefone);

      if (temMaskEmail || temMaskTel) {
        boxMascaras.style.display = 'flex';
        if (boxMaskEmail && temMaskEmail) {
          boxMaskEmail.style.display = 'inline-flex';
          boxMaskEmail.style.alignItems = 'center';
          boxMaskEmail.style.gap = '6px';
          txtMaskEmail.textContent = data.mascarasEsperadas.email;
        } else if (boxMaskEmail) {
          boxMaskEmail.style.display = 'none';
        }

        if (boxMaskTel && temMaskTel) {
          boxMaskTel.style.display = 'inline-flex';
          boxMaskTel.style.alignItems = 'center';
          boxMaskTel.style.gap = '6px';
          txtMaskTel.textContent = data.mascarasEsperadas.telefone;
        } else if (boxMaskTel) {
          boxMaskTel.style.display = 'none';
        }
      } else {
        boxMascaras.style.display = 'none';
      }
    }

    // Renderização das Permutações Combinatórias (Inversão, Preposições & Profissões)
    const boxPerms = document.getElementById('resPermutacoesBox');
    const countPill = document.getElementById('resPermsCountPill');
    const gridPerms = document.getElementById('resPermsPillsGrid');

    if (boxPerms && data.permutacoes && data.permutacoes.length > 0) {
      boxPerms.style.display = 'block';
      if (countPill) countPill.textContent = `${data.totalPermutacoes || data.permutacoes.length} Geradas`;
      if (gridPerms) {
        gridPerms.innerHTML = data.permutacoes.map((p) => `
          <span class="badge badge-dark" style="font-family: var(--font-mono); font-size: 0.72rem; padding: 3px 8px; border: 1px solid var(--color-border); color: var(--color-text-dim); background: var(--color-surface-2);">
            @${p}
          </span>
        `).join('');
      }
    } else if (boxPerms) {
      boxPerms.style.display = 'none';
    }

    // Renderização Multiplataforma (80+ Plataformas OSINT)
    const patrickContainer = document.getElementById('resPatrickContainer');
    const patrickBadge = document.getElementById('resPatrickBadge');
    const patrickGrid = document.getElementById('resPatrickGrid');

    function normalizarCategoria(cat, site) {
      const c = String(cat || '').toLowerCase();
      const s = String(site || '').toLowerCase();
      if (['social', 'chat', 'messaging'].includes(c) || ['instagram', 'twitter', 'x', 'tiktok', 'facebook', 'linkedin', 'snapchat', 'threads', 'telegram', 'mastodon', 'vk'].some(x => s.includes(x))) return 'social';
      if (['tech', 'developer', 'code'].includes(c) || ['github', 'gitlab', 'bitbucket', 'stackoverflow', 'npm', 'pypi', 'docker', 'replit', 'codepen'].some(x => s.includes(x))) return 'tech';
      if (['media', 'music', 'video', 'streaming'].includes(c) || ['youtube', 'spotify', 'soundcloud', 'twitch', 'vimeo', 'dailymotion', 'deezer'].some(x => s.includes(x))) return 'media';
      if (['forum', 'community', 'discussion'].includes(c) || ['reddit', 'pinterest', 'medium', 'quora', 'tumblr', 'devto', 'hackernews'].some(x => s.includes(x))) return 'forum';
      if (['gaming', 'games'].includes(c) || ['steam', 'discord', 'roblox', 'chess', 'playstation', 'xbox'].some(x => s.includes(x))) return 'gaming';
      return 'social';
    }

    if (patrickContainer && data.patrickuser) {
      const pData = data.patrickuser;
      const totalEncontrados = pData.totalEncontrados || (pData.encontrados ? pData.encontrados.length : 0);
      const totalPlataformas = pData.totalPlataformas || 80;

      if (totalEncontrados > 0 && pData.encontrados && pData.encontrados.length > 0) {
        patrickContainer.style.display = 'block';
        patrickBadge.textContent = `${totalEncontrados} / ${totalPlataformas} Plataformas com Conta Ativa`;
        patrickBadge.className = 'badge badge-purple';

        // Contadores por Categoria
        const counts = { todas: totalEncontrados, social: 0, tech: 0, media: 0, forum: 0, gaming: 0 };

        pData.encontrados.forEach((item) => {
          const cat = normalizarCategoria(item.categoria, item.site);
          counts[cat] = (counts[cat] || 0) + 1;
        });

        const elTodas = document.getElementById('catCountTodas');
        const elSocial = document.getElementById('catCountSocial');
        const elTech = document.getElementById('catCountTech');
        const elMedia = document.getElementById('catCountMedia');
        const elForum = document.getElementById('catCountForum');
        const elGaming = document.getElementById('catCountGaming');

        if (elTodas) elTodas.textContent = counts.todas;
        if (elSocial) elSocial.textContent = counts.social;
        if (elTech) elTech.textContent = counts.tech;
        if (elMedia) elMedia.textContent = counts.media;
        if (elForum) elForum.textContent = counts.forum;
        if (elGaming) elGaming.textContent = counts.gaming;

        patrickGrid.innerHTML = pData.encontrados
          .map((item) => {
            const meta = item.metadata || {};
            const avatarImg = meta.avatarUrl || meta.image;
            const category = normalizarCategoria(item.categoria, item.site);
            const followers = meta.followers !== undefined && meta.followers !== null ? meta.followers : null;
            const bioText = meta.bio || meta.description || '';

            return `
              <div class="social-item-card" data-cat="${category}" style="background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-3); display: flex; flex-direction: column; justify-content: space-between; gap: 8px; transition: all var(--transition-fast);">
                <div>
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      ${avatarImg ? `
                        <div style="width: 28px; height: 28px; border-radius: 50%; overflow: hidden; background: var(--color-surface-3); flex-shrink: 0; border: 1px solid var(--color-border);">
                          <img src="${avatarImg}" alt="${item.site}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.parentElement.style.display='none'">
                        </div>
                      ` : `
                        <div style="width: 28px; height: 28px; border-radius: var(--radius-sm); background: rgba(139, 92, 246, 0.12); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                          <i data-lucide="globe" style="width: 15px; height: 15px; color: var(--color-primary);"></i>
                        </div>
                      `}
                      <div>
                        <strong style="color: var(--color-text); font-size: 0.85rem;">${item.site}</strong>
                        ${meta.name ? `<div style="font-size: 0.72rem; color: var(--color-text-dim);">${meta.name}</div>` : ''}
                      </div>
                    </div>
                    <span class="badge badge-dark" style="font-size: 0.65rem; text-transform: uppercase;">${category}</span>
                  </div>

                  ${bioText ? `
                    <div style="font-size: 0.73rem; color: var(--color-text-muted); line-height: 1.35; margin: 4px 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;" title="${bioText.replace(/"/g, '&quot;')}">
                      ${bioText}
                    </div>
                  ` : ''}

                  ${followers !== null ? `
                    <div style="font-size: 0.7rem; color: var(--color-primary); font-family: var(--font-mono); margin-top: 2px;">
                      👥 ${formatarContagem(followers)} seguidores
                    </div>
                  ` : ''}
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 6px; border-top: 1px solid var(--color-border); font-size: 0.72rem;">
                  <span style="color: var(--color-text-dim); font-family: var(--font-mono);">${item.duracaoMs ? `${item.duracaoMs}ms` : 'Verificado'}</span>
                  <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="font-size: 0.7rem; padding: 2px 8px; gap: 4px;">
                    Abrir Perfil <i data-lucide="external-link" style="width: 10px; height: 10px;"></i>
                  </a>
                </div>
              </div>
            `;
          })
          .join('');
      } else {
        patrickContainer.style.display = 'none';
      }
    }

    const containerPerfis = document.getElementById('resPerfisContainer');

    if (data.perfis && data.perfis.length > 0) {
      containerPerfis.innerHTML = data.perfis
        .map((p) => {
          const matchClass = p.matchLevel === 'HIGH'
            ? 'match-pill-high'
            : p.matchLevel === 'MEDIUM'
            ? 'match-pill-medium'
            : 'match-pill-low';

          const scoreCor = p.cor || (p.score >= 75 ? 'var(--color-success)' : p.score >= 45 ? 'var(--color-warning)' : 'var(--color-text-dim)');

          // Renderização do Checklist de Fatores
          let checklistHtml = '';
          if (p.checklist && p.checklist.length > 0) {
            checklistHtml = `
              <div style="margin-top: 12px;">
                <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--color-text-muted); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                  <i data-lucide="check-square" style="width: 13px; height: 13px; color: var(--color-primary);"></i>
                  Detalhamento da Probabilidade Matemática (${p.pontosObtidos || p.score}/${p.pontosMaximos || 100} pts):
                </div>
                <div class="factors-checklist">
                  ${p.checklist.map((item) => `
                    <div class="factor-item ${item.match ? 'factor-match' : 'factor-mismatch'}">
                      <i data-lucide="${item.match ? 'check-circle' : 'alert-circle'}" style="width: 16px; height: 16px; color: ${item.match ? 'var(--color-success)' : 'var(--color-danger)'}; flex-shrink: 0; margin-top: 1px;"></i>
                      <div style="flex: 1;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                          <strong style="color: var(--color-text); font-size: 0.75rem;">${item.categoria}</strong>
                          <span style="font-size: 0.7rem; font-family: var(--font-mono); color: ${item.match ? 'var(--color-success)' : 'var(--color-text-dim)'};">${item.pontos}/${item.max} pts</span>
                        </div>
                        <div style="color: var(--color-text-muted); line-height: 1.35; font-size: 0.72rem;">${item.descricao}</div>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            `;
          }

          const originBadge = p.realConfirmado
            ? `<span class="badge badge-green" style="font-size: 0.72rem; color: var(--color-success); border-color: rgba(34, 197, 94, 0.4); display: inline-flex; align-items: center; gap: 4px;"><i data-lucide="check-circle-2" style="width: 12px; height: 12px;"></i> Perfil Real no Instagram</span>`
            : `<span class="badge badge-purple" style="font-size: 0.72rem;">Permutação Heurística</span>`;

          // Badge de Idade da Conta via User ID
          let idadeBadgeHtml = '';
          if (p.idadeConta) {
            idadeBadgeHtml = `
              <span class="account-age-badge" style="border-color: ${p.idadeConta.cor}55; color: ${p.idadeConta.cor};" title="Meta User ID (PK): ${p.userId || p.idadeConta.userId} • Calibração cronológica precisa">
                <i data-lucide="calendar" style="width: 12px; height: 12px;"></i>
                ${p.idadeConta.anoEstimado} • ${p.idadeConta.nivel}
                ${p.userId ? `<span style="font-family: var(--font-mono); font-size: 0.65rem; opacity: 0.85; margin-left: 2px;">(ID: ${p.userId})</span>` : ''}
              </span>
            `;
          } else if (p.userId) {
            idadeBadgeHtml = `
              <span class="account-age-badge" title="User ID Meta (PK)">
                <i data-lucide="hash" style="width: 11px; height: 11px;"></i> ID: ${p.userId}
              </span>
            `;
          }

          // Parser de Entidades na Bio
          const ent = p.entidadesBio || {};
          const hasWa = ent.whatsapp && ent.whatsapp.length > 0;
          const hasEm = ent.emails && ent.emails.length > 0;
          const hasPix = ent.pix && ent.pix.length > 0;
          const hasLinks = ent.links && ent.links.length > 0;
          const hasMencoes = ent.mencoes && ent.mencoes.length > 0;

          let entidadesHtml = '';
          if (hasWa || hasEm || hasPix || hasLinks || hasMencoes) {
            entidadesHtml = `
              <div class="bio-entities-container">
                ${hasWa ? ent.whatsapp.map(w => `
                  <a href="https://wa.me/${String(w).replace(/\D/g, '')}" target="_blank" rel="noopener noreferrer" class="entity-pill entity-pill-whatsapp" title="Abrir conversa no WhatsApp">
                    <i data-lucide="message-circle" style="width: 12px; height: 12px;"></i> WhatsApp: ${w}
                  </a>
                `).join('') : ''}

                ${hasEm ? ent.emails.map(e => `
                  <a href="mailto:${e}" class="entity-pill entity-pill-email" title="Enviar e-mail">
                    <i data-lucide="mail" style="width: 12px; height: 12px;"></i> ${e}
                  </a>
                `).join('') : ''}

                ${hasPix ? ent.pix.map(px => `
                  <span class="entity-pill entity-pill-pix" title="Chave Pix identificada na bio">
                    <i data-lucide="key" style="width: 12px; height: 12px;"></i> Pix: ${px}
                  </span>
                `).join('') : ''}

                ${hasLinks ? ent.links.map(lk => `
                  <a href="${lk.startsWith('http') ? lk : 'https://' + lk}" target="_blank" rel="noopener noreferrer" class="entity-pill entity-pill-link" title="Abrir link externo">
                    <i data-lucide="link" style="width: 12px; height: 12px;"></i> ${lk.replace(/^https?:\/\/(www\.)?/, '')}
                  </a>
                `).join('') : ''}

                ${hasMencoes ? ent.mencoes.map(m => `
                  <a href="https://www.instagram.com/${m}/" target="_blank" rel="noopener noreferrer" class="entity-pill entity-pill-mention" title="Ver perfil mencionado">
                    <i data-lucide="at-sign" style="width: 11px; height: 11px;"></i> @${m}
                  </a>
                `).join('') : ''}
              </div>
            `;
          }

          // Toolbar de Pivotamento Social
          let pivotHtml = '';
          if (p.pivotLinks) {
            pivotHtml = `
              <div class="pivot-toolbar">
                <span style="font-size: 0.68rem; font-weight: 700; color: var(--color-text-dim); text-transform: uppercase; margin-right: 4px; display: inline-flex; align-items: center; gap: 4px;">
                  <i data-lucide="network" style="width: 12px; height: 12px; color: var(--color-primary);"></i> Pivotar:
                </span>
                ${p.pivotLinks.threads ? `
                  <a href="${p.pivotLinks.threads}" target="_blank" rel="noopener noreferrer" class="pivot-btn" title="Buscar no Threads (Meta)">
                    <i data-lucide="message-square" style="width: 11px; height: 11px; color: var(--color-primary);"></i> Threads
                  </a>
                ` : ''}
                ${p.pivotLinks.tiktok ? `
                  <a href="${p.pivotLinks.tiktok}" target="_blank" rel="noopener noreferrer" class="pivot-btn" title="Buscar no TikTok">
                    <i data-lucide="video" style="width: 11px; height: 11px; color: #fe2c55;"></i> TikTok
                  </a>
                ` : ''}
                ${p.pivotLinks.x ? `
                  <a href="${p.pivotLinks.x}" target="_blank" rel="noopener noreferrer" class="pivot-btn" title="Buscar no X / Twitter">
                    <i data-lucide="twitter" style="width: 11px; height: 11px; color: #1d9bf0;"></i> X/Twitter
                  </a>
                ` : ''}
                ${p.pivotLinks.github ? `
                  <a href="${p.pivotLinks.github}" target="_blank" rel="noopener noreferrer" class="pivot-btn" title="Buscar no GitHub">
                    <i data-lucide="github" style="width: 11px; height: 11px;"></i> GitHub
                  </a>
                ` : ''}
                ${p.pivotLinks.linkedin ? `
                  <a href="${p.pivotLinks.linkedin}" target="_blank" rel="noopener noreferrer" class="pivot-btn" title="Buscar no LinkedIn">
                    <i data-lucide="briefcase" style="width: 11px; height: 11px; color: #0a66c2;"></i> LinkedIn
                  </a>
                ` : ''}
              </div>
            `;
          }

          // Botões de Busca Reversa Rápida
          const lensUrl = p.linksReversos?.googleLens || '';
          const yandexUrl = p.linksReversos?.yandex || '';
          const bingUrl = p.linksReversos?.bing || '';
          const tineyeUrl = p.linksReversos?.tineye || '';
          const fotoHdUrl = p.fotoPerfilHd || p.fotoPerfil;

          return `
            <div class="profile-card">
              <!-- Coluna do Avatar com visualizador HD e Busca Reversa -->
              <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
                <div class="profile-avatar-wrapper btn-abrir-avatar-modal" 
                     data-user="${p.username}" 
                     data-img="${fotoHdUrl}" 
                     data-lens="${lensUrl}" 
                     data-yandex="${yandexUrl}" 
                     data-bing="${bingUrl}" 
                     data-tineye="${tineyeUrl}" 
                     title="Clique para ver Foto HD e Investigação Visual">
                  <div class="profile-avatar-box">
                    <img src="${p.fotoPerfil}" alt="${p.username}" onerror="this.onerror=null; this.src='https://api.dicebear.com/7.x/identicon/svg?seed=${p.username}&backgroundColor=1e1b4b';" style="width: 100%; height: 100%; object-fit: cover;">
                  </div>
                  <span class="avatar-hd-badge"><i data-lucide="zoom-in" style="width: 10px; height: 10px;"></i> HD</span>
                </div>

                ${lensUrl ? `
                  <div style="display: flex; gap: 4px;">
                    <a href="${lensUrl}" target="_blank" rel="noopener noreferrer" class="reverse-search-btn" title="Pesquisar foto no Google Lens">
                      <i data-lucide="search" style="width: 10px; height: 10px; color: #4285F4;"></i> Lens
                    </a>
                    <a href="${yandexUrl}" target="_blank" rel="noopener noreferrer" class="reverse-search-btn" title="Pesquisar foto no Yandex">
                      <i data-lucide="external-link" style="width: 10px; height: 10px; color: #fc3f1d;"></i> Yandex
                    </a>
                  </div>
                ` : ''}
              </div>

              <div style="flex: 1; min-width: 0;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px;">
                  <div>
                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                      <a href="${p.linkPerfil}" target="_blank" rel="noopener noreferrer" style="font-size: 1.15rem; font-weight: 700; color: var(--color-primary); text-decoration: none; font-family: var(--font-mono);">
                        @${p.username}
                      </a>
                      ${p.verificado ? '<i data-lucide="check-circle" style="width: 15px; height: 15px; color: var(--color-primary);" title="Conta Verificada Oficial"></i>' : ''}
                      ${p.privado ? '<i data-lucide="lock" style="width: 15px; height: 15px; color: var(--color-text-dim);" title="Conta Privada"></i>' : ''}
                      ${originBadge}
                      ${idadeBadgeHtml}
                      <button type="button" class="btn btn-secondary btn-sm btn-copiar-user" data-user="${p.username}" title="Copiar @" style="padding: 2px 6px; font-size: 0.7rem;">
                        <i data-lucide="copy" style="width: 11px; height: 11px;"></i>
                      </button>
                    </div>
                    <div style="font-size: 0.875rem; font-weight: 600; color: var(--color-text); margin-top: 2px;">
                      ${p.nomeCompleto}
                    </div>
                  </div>

                  <!-- Badge de Certeza & Score Exato -->
                  <div style="text-align: right;">
                    <span class="badge ${matchClass}" style="font-size: 0.8rem; padding: 4px 10px;">
                      ${p.score}% CERTEZA • ${p.matchLevel}
                    </span>
                    <div style="font-size: 0.7rem; color: var(--color-text-dim); margin-top: 3px;">
                      ${p.classificacao || 'Análise Probabilística'}
                    </div>
                  </div>
                </div>

                <!-- Barra Visual de Probabilidade -->
                <div style="margin: 10px 0 6px 0;">
                  <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--color-text-dim); margin-bottom: 2px;">
                    <span>Concordância com o Alvo</span>
                    <strong style="color: ${scoreCor}; font-family: var(--font-mono);">${p.score}%</strong>
                  </div>
                  <div class="prob-bar-track">
                    <div class="prob-bar-fill" style="width: ${p.score}%; background: ${scoreCor};"></div>
                  </div>
                </div>

                ${p.bio ? `<p style="font-size: 0.825rem; color: var(--color-text-muted); margin: 8px 0; line-height: 1.45;">${p.bio}</p>` : ''}

                <!-- Banner de Correlação por E-mail (PatrickUser Filter) -->
                ${p.emailCorrelation && p.emailCorrelation.ativo && p.emailCorrelation.coincidente ? `
                  <div class="email-correlation-banner" style="background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.35); border-radius: var(--radius-sm); padding: 8px 12px; margin: 10px 0; font-size: 0.78rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <span style="font-weight: 700; color: var(--color-success); display: inline-flex; align-items: center; gap: 5px;">
                        <i data-lucide="check-check" style="width: 14px; height: 14px;"></i>
                        ↳ Filtro E-mail: COINCIDENTE
                      </span>
                      <span style="color: var(--color-text-dim); font-family: var(--font-mono); font-size: 0.72rem;">(${p.emailCorrelation.emailAlvo})</span>
                    </div>
                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                      ${(p.emailCorrelation.tags || []).map(t => `<span class="badge badge-green" style="font-size: 0.68rem; padding: 2px 7px;">${t}</span>`).join('')}
                    </div>
                  </div>
                ` : ''}

                <!-- Segmentação Forense de Contatos: Recuperação Meta API vs Públicos/Bio -->
                <div style="margin: 10px 0; display: flex; flex-direction: column; gap: 8px;">
                  <!-- Contatos de Recuperação Ofuscados (Meta API) -->
                  <div style="background: var(--color-surface-2); padding: 9px 12px; border-radius: var(--radius-sm); border: 1px solid var(--color-border); font-size: 0.76rem; font-family: var(--font-mono);">
                    <div style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: var(--color-text-muted); margin-bottom: 5px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
                      <span style="display: inline-flex; align-items: center; gap: 5px; color: var(--color-text);">
                        <i data-lucide="shield-check" style="width: 12px; height: 12px; color: var(--color-primary);"></i>
                        Contatos de Recuperação Ofuscados (Meta API)
                      </span>
                      <span style="color: var(--color-text-dim); font-size: 0.68rem; font-weight: normal;">
                        ${p.contatoOfuscado?.temSessaoAtiva ? '✓ Máscaras extraídas ao vivo' : 'Sessão Meta opcional no .env'}
                      </span>
                    </div>
                    <div style="display: flex; flex-wrap: wrap; gap: 14px; align-items: center;">
                      ${p.contatoOfuscado?.emailMascarado ? `<div><span style="color: var(--color-text-dim);">E-mail Mascarado:</span> <strong style="color: var(--color-primary);">${p.contatoOfuscado.emailMascarado}</strong></div>` : ''}
                      ${p.contatoOfuscado?.telefoneMascarado ? `<div><span style="color: var(--color-text-dim);">Telefone Mascarado:</span> <strong style="color: var(--color-success);">${p.contatoOfuscado.telefoneMascarado}</strong></div>` : ''}
                      ${!p.contatoOfuscado?.emailMascarado && !p.contatoOfuscado?.telefoneMascarado ? `<div style="color: var(--color-text-dim); font-size: 0.72rem;">Máscaras de recuperação restritas a contas com sessão autenticada.</div>` : ''}
                    </div>
                  </div>

                  <!-- Contatos Públicos e de Negócios (Extraídos da Bio e Links) -->
                  ${(hasWa || hasEm || hasPix || hasLinks) ? `
                    <div style="background: rgba(59, 130, 246, 0.05); padding: 9px 12px; border-radius: var(--radius-sm); border: 1px solid rgba(59, 130, 246, 0.2); font-size: 0.76rem;">
                      <div style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: #60A5FA; margin-bottom: 6px; display: flex; align-items: center; gap: 5px;">
                        <i data-lucide="globe" style="width: 12px; height: 12px; color: #3B82F6;"></i>
                        Contatos Públicos / Comerciais (Extraídos da Bio & Links Externos)
                      </div>
                      ${entidadesHtml}
                    </div>
                  ` : ''}
                </div>

                <!-- Checklist dos Fatores -->
                ${checklistHtml}

                <!-- Toolbar de Pivotamento Social -->
                ${pivotHtml}

                <!-- Rodapé do Card com Estatísticas e Link de Abertura -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--color-border); flex-wrap: wrap; gap: 8px;">
                  <div style="display: flex; gap: 14px; font-size: 0.75rem; color: var(--color-text-dim);">
                    ${p.seguidores !== undefined && p.seguidores !== null ? `<span><strong style="color: var(--color-text);">${formatarContagem(p.seguidores)}</strong> seguidores</span>` : (p.seguidoresEstimados ? `<span><strong style="color: var(--color-text);">${formatarContagem(p.seguidoresEstimados)}</strong> seguidores</span>` : '')}
                    ${p.seguindo !== undefined && p.seguindo !== null ? `<span><strong style="color: var(--color-text);">${formatarContagem(p.seguindo)}</strong> seguindo</span>` : ''}
                    ${p.publicacoes !== undefined && p.publicacoes !== null ? `<span><strong style="color: var(--color-text);">${formatarContagem(p.publicacoes)}</strong> publicações</span>` : ''}
                  </div>

                  <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button type="button" class="btn btn-primary btn-sm btn-pivot-brightdata" data-username="${String(p.username || '').replace(/[^a-zA-Z0-9._-]/g, '')}" style="font-size: 0.75rem;">
                      <i data-lucide="sparkles" style="width: 12px; height: 12px;"></i>
                      Analisar Posts &amp; Comentários
                    </button>
                    <a href="${p.linkPerfil}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="font-size: 0.75rem;">
                      <i data-lucide="external-link" style="width: 12px; height: 12px;"></i>
                      Abrir no Instagram
                    </a>
                  </div>
                </div>
              </div>
            </div>
          `;
        })
        .join('');

      // Ouvintes para copiar username
      document.querySelectorAll('.btn-copiar-user').forEach((btn) => {
        btn.addEventListener('click', () => {
          const u = btn.dataset.user;
          if (u) window.copyToClipboard(`@${u}`, 'Nome de usuário copiado!');
        });
      });

      // Ouvintes para abrir modal do Avatar HD e Busca Reversa
      document.querySelectorAll('.btn-abrir-avatar-modal').forEach((box) => {
        box.addEventListener('click', () => {
          abrirModalAvatarHd(
            box.dataset.user,
            box.dataset.img,
            box.dataset.lens,
            box.dataset.yandex,
            box.dataset.bing,
            box.dataset.tineye
          );
        });
      });

      // Ouvintes para pivotamento direto para Coleta Social Profunda (Bright Data)
      document.querySelectorAll('.btn-pivot-brightdata').forEach((btn) => {
        btn.addEventListener('click', () => {
          const username = btn.dataset.username;
          if (username && typeof window.rimuPrefillBrightData === 'function') {
            window.rimuPrefillBrightData({ plataforma: 'instagram', modo: 'perfil', alvo: username, autoStart: false });
          }
        });
      });
    } else {
      containerPerfis.innerHTML = '<div style="text-align: center; padding: var(--space-5); color: var(--color-text-dim);">Nenhum perfil correlacionado com os critérios informados.</div>';
    }

    // Google Dorks (Padrão: Oculto se não ativado nas configurações)
    const dorksContainer = document.getElementById('resDorksContainer');
    const cardDorks = dorksContainer ? dorksContainer.closest('.card') : null;
    const showDorksPref = window.rimuSettings ? window.rimuSettings.showGoogleDorks : (localStorage.getItem('rimu_pref_show_google_dorks') === 'true');

    if (cardDorks) {
      cardDorks.style.display = showDorksPref ? 'block' : 'none';
    }

    if (showDorksPref && data.dorks && data.dorks.length > 0) {
      dorksContainer.innerHTML = data.dorks
        .map((d) => `
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
        `)
        .join('');

      document.querySelectorAll('.btn-copiar-dork').forEach((btn) => {
        btn.addEventListener('click', () => {
          const q = decodeURIComponent(btn.dataset.query || '');
          window.copyToClipboard(q, 'Dork copiada para a área de transferência!');
        });
      });
    }

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  // Controle do Modal Avatar HD & Busca Reversa
  const modalAvatar = document.getElementById('modalAvatarHd');
  const imgAvatarModal = document.getElementById('imgAvatarModal');
  const txtAvatarUser = document.getElementById('txtAvatarUser');
  const btnLensModal = document.getElementById('btnLensModal');
  const btnYandexModal = document.getElementById('btnYandexModal');
  const btnBingModal = document.getElementById('btnBingModal');
  const btnTinEyeModal = document.getElementById('btnTinEyeModal');
  const btnCopiarUrlFoto = document.getElementById('btnCopiarUrlFoto');

  let fotoAtualUrl = '';

  function abrirModalAvatarHd(user, imgUrl, lensUrl, yandexUrl, bingUrl, tineyeUrl) {
    if (!modalAvatar) return;
    fotoAtualUrl = imgUrl || '';
    imgAvatarModal.src = imgUrl || '';
    txtAvatarUser.textContent = user ? `@${user}` : 'Foto de Perfil';

    btnLensModal.href = lensUrl || `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(imgUrl)}`;
    btnYandexModal.href = yandexUrl || `https://yandex.com/images/search?rpt=imageview&url=${encodeURIComponent(imgUrl)}`;
    btnBingModal.href = bingUrl || `https://www.bing.com/images/search?view=detailv2&iss=sbi&FORM=SBIHMP&sbisrc=UrlPaste&q=imgurl:${encodeURIComponent(imgUrl)}`;
    btnTinEyeModal.href = tineyeUrl || `https://tineye.com/search?url=${encodeURIComponent(imgUrl)}`;

    modalAvatar.style.display = 'flex';
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  btnCopiarUrlFoto?.addEventListener('click', () => {
    if (fotoAtualUrl) {
      window.copyToClipboard(fotoAtualUrl, 'URL da foto copiada!');
    }
  });

  document.querySelectorAll('.btn-fechar-modal-avatar').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (modalAvatar) modalAvatar.style.display = 'none';
    });
  });

  modalAvatar?.addEventListener('click', (e) => {
    if (e.target === modalAvatar) modalAvatar.style.display = 'none';
  });

  // Modal JSON
  const modalJson = document.getElementById('modalJson');
  const preModalJson = document.getElementById('preModalJson');

  document.getElementById('btnVerJsonCompleto')?.addEventListener('click', () => {
    if (!ultimoResultado) return;
    preModalJson.textContent = JSON.stringify(ultimoResultado, null, 2);
    modalJson.style.display = 'flex';
  });

  document.getElementById('btnCopiarJsonModal')?.addEventListener('click', () => {
    if (!ultimoResultado) return;
    window.copyToClipboard(JSON.stringify(ultimoResultado, null, 2), 'JSON copiado com sucesso!');
  });

  // Fechar Modal JSON
  document.querySelectorAll('#modalJson button[onclick*="none"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      modalJson.style.display = 'none';
    });
  });

  modalJson?.addEventListener('click', (e) => {
    if (e.target === modalJson) modalJson.style.display = 'none';
  });

  // Filtro Dinâmico por Categoria na Lista de 80+ Plataformas
  document.querySelectorAll('.social-cat-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.social-cat-btn').forEach((b) => {
        b.style.background = 'var(--color-surface-2)';
        b.style.color = 'var(--color-text-muted)';
        b.style.borderColor = 'var(--color-border)';
        b.classList.remove('active');
      });

      btn.style.background = 'rgba(139, 92, 246, 0.2)';
      btn.style.color = '#FFFFFF';
      btn.style.borderColor = 'var(--color-primary)';
      btn.classList.add('active');

      const catAlvo = btn.dataset.cat || 'todas';
      document.querySelectorAll('.social-item-card').forEach((card) => {
        if (catAlvo === 'todas' || card.dataset.cat === catAlvo) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });

  // Copiar Links de Todas as Contas Encontradas
  document.getElementById('btnCopiarLinks')?.addEventListener('click', () => {
    if (!ultimoResultado) {
      window.toast?.warning('Nenhum resultado disponível para cópia.');
      return;
    }

    const lines = [];
    const termo = ultimoResultado.username || ultimoResultado.nome || ultimoResultado.email || 'Alvo';
    lines.push(`[RIMUBUSCA OSINT] Contas e Perfis Identificados (${termo}):`);

    if (ultimoResultado.patrickuser?.encontrados && ultimoResultado.patrickuser.encontrados.length > 0) {
      lines.push('\n--- Contas em Plataformas Online (80+ Redes) ---');
      ultimoResultado.patrickuser.encontrados.forEach((item) => {
        lines.push(`• ${item.site} [${item.categoria || 'social'}]: ${item.url}`);
      });
    }

    if (ultimoResultado.perfis && ultimoResultado.perfis.length > 0) {
      lines.push('\n--- Perfis Correlacionados no Instagram ---');
      ultimoResultado.perfis.forEach((p) => {
        lines.push(`• @${p.username} (${p.score}% certeza): https://instagram.com/${p.username}`);
      });
    }

    if (lines.length <= 1) {
      window.toast?.info('Nenhuma conta encontrada para copiar.');
      return;
    }

    const textoFinal = lines.join('\n');
    if (typeof window.copyToClipboard === 'function') {
      window.copyToClipboard(textoFinal, 'Lista de links copiada para a área de transferência!');
    } else {
      navigator.clipboard.writeText(textoFinal).then(() => {
        window.toast?.success('Lista de links copiada com sucesso!');
      });
    }
  });

  // Exportar Dossiê Forense em PDF
  document.getElementById('btnExportarPdf')?.addEventListener('click', () => {
    if (!ultimoResultado || !window.OsintDarkReport) {
      window.toast?.warning('Execute uma busca antes de exportar o relatório.');
      return;
    }
    const termo = ultimoResultado.username || ultimoResultado.nome || ultimoResultado.email || 'alvo-redes';
    const html = window.OsintDarkReport.renderGenericReport({
      termo: `@${termo}`,
      payload: ultimoResultado,
      moduleLabel: 'REDES SOCIAIS & CONTAS ONLINE',
      sourceLabel: 'Varredura Multiplataforma (80+ Redes)',
      systemBadge: 'RIMUBUSCA OSINT SOCIAL'
    });
    window.OsintDarkReport.exportPdf({
      innerHtml: html,
      titleText: `Dossiê de Redes Sociais - ${termo}`
    });
  });

  // Baixar Relatório Standalone em HTML com Hash SHA-256 e Cadeia de Custódia
  document.getElementById('btnBaixarHtml')?.addEventListener('click', () => {
    if (!ultimoResultado || !window.OsintDarkReport) {
      window.toast?.warning('Execute uma busca antes de exportar o relatório.');
      return;
    }
    const termo = ultimoResultado.username || ultimoResultado.nome || ultimoResultado.email || 'alvo-redes';
    const html = window.OsintDarkReport.renderGenericReport({
      termo: `@${termo}`,
      payload: ultimoResultado,
      moduleLabel: 'REDES SOCIAIS & CONTAS ONLINE',
      sourceLabel: 'Varredura Multiplataforma (80+ Redes)',
      systemBadge: 'RIMUBUSCA OSINT SOCIAL'
    });
    window.OsintDarkReport.downloadHtml({
      innerHtml: html,
      titlePrefix: 'dossie-redes-sociais',
      termo
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'Esc') {
      if (modalJson && modalJson.style.display === 'flex') {
        modalJson.style.display = 'none';
      }
      if (modalAvatar && modalAvatar.style.display === 'flex') {
        modalAvatar.style.display = 'none';
      }
    }
  });
});
