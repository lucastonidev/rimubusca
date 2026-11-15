/**
 * ==============================================================================
 * RIMUBUSCA - CLIENT CONTROLLER DE DOMÍNIO & DNS (PUBLIC/JS/DOMINIO.JS)
 * ==============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('formInvestigarDominio');
  const inputDominio = document.getElementById('inputDominio');
  const btnSubmit = document.getElementById('btnSubmitDominio');
  const skeleton = document.getElementById('domSkeleton');
  const containerResultados = document.getElementById('domResultados');

  let ultimoResultado = null;

  // Botões de Exemplo Rápido
  document.querySelectorAll('.demo-dom-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dom = btn.dataset.dominio;
      if (dom) {
        inputDominio.value = dom;
        form.dispatchEvent(new Event('submit'));
      }
    });
  });

  // Submissão do Formulário
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dominio = inputDominio.value.trim();

    if (!dominio || dominio.length < 3) {
      window.toast?.error('Por favor, informe um domínio válido.');
      inputDominio.focus();
      return;
    }

    // Estado de Loading
    btnSubmit.disabled = true;
    skeleton.style.display = 'block';
    containerResultados.style.display = 'none';

    try {
      const response = await window.api.post('/api/dominio/investigar', { dominio });

      if (response && response.success && response.data) {
        ultimoResultado = response.data;
        renderizarResultados(response.data);
        containerResultados.style.display = 'block';
        window.toast?.success('Diagnóstico de domínio concluído com sucesso!');

        // Scroll suave até os resultados
        containerResultados.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.toast?.error(response.error || 'Falha ao mapear o domínio informado.');
      }
    } catch (err) {
      console.error('[ERRO CLIENTE DOMINIO]:', err);
      window.toast?.error(err.message || 'Erro de comunicação com o servidor.');
    } finally {
      btnSubmit.disabled = false;
      skeleton.style.display = 'none';
    }
  });

  /**
   * Preenche todos os campos com os dados retornados
   */
  function renderizarResultados(data) {
    // 1. Header do Alvo
    document.getElementById('resDominioTitulo').textContent = data.dominio;
    document.getElementById('resServerHeader').textContent = data.http?.server || 'Oculto / Protegido';
    document.getElementById('resHttpCode').textContent = data.http?.statusCode ? `${data.http.statusCode} OK` : 'Inacessível';

    // Status Online/Offline
    const statusBadge = document.getElementById('resStatusBadge');
    if (data.http?.online || data.dns?.ativo) {
      statusBadge.textContent = 'ONLINE';
      statusBadge.className = 'badge badge-purple';
    } else {
      statusBadge.textContent = 'OFFLINE';
      statusBadge.className = 'badge badge-red';
    }

    // Score de Segurança
    const score = data.scoreSeguranca || 0;
    const resScoreNum = document.getElementById('resScoreNum');
    const resScoreBadge = document.getElementById('resScoreBadge');

    resScoreNum.textContent = `${score}/100`;

    if (score >= 80) {
      resScoreBadge.textContent = 'ALTO (SEGURO)';
      resScoreBadge.className = 'badge badge-purple';
    } else if (score >= 50) {
      resScoreBadge.textContent = 'MODERADO';
      resScoreBadge.className = 'badge badge-dark';
      resScoreBadge.style.color = '#F59E0B';
    } else {
      resScoreBadge.textContent = 'FRÁGIL / BAIXO';
      resScoreBadge.className = 'badge badge-red';
    }

    // 2. Registros DNS
    const dnsContainer = document.getElementById('resDnsListContainer');
    const totalDnsBadge = document.getElementById('resTotalDnsBadge');
    let totalDnsCount = 0;
    let dnsHtml = '';

    // Registros A
    if (data.dns?.a && data.dns.a.length > 0) {
      data.dns.a.forEach((ip) => {
        totalDnsCount++;
        dnsHtml += `
          <div class="dns-item-row">
            <span class="dns-record-badge dns-badge-a">A</span>
            <span style="color: var(--color-primary); flex: 1;">${ip}</span>
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.copyToClipboard('${ip}', 'IP copiado!')" style="padding: 2px 6px; font-size: 0.7rem;">Copiar</button>
          </div>
        `;
      });
    }

    // Registros AAAA (IPv6)
    if (data.dns?.aaaa && data.dns.aaaa.length > 0) {
      data.dns.aaaa.forEach((ip6) => {
        totalDnsCount++;
        dnsHtml += `
          <div class="dns-item-row">
            <span class="dns-record-badge dns-badge-a" style="border-color: #60A5FA;">AAAA</span>
            <span style="color: #60A5FA; flex: 1; word-break: break-all;">${ip6}</span>
          </div>
        `;
      });
    }

    // Registros MX
    if (data.dns?.mx && data.dns.mx.length > 0) {
      data.dns.mx.forEach((mx) => {
        totalDnsCount++;
        dnsHtml += `
          <div class="dns-item-row">
            <span class="dns-record-badge dns-badge-mx">MX</span>
            <span style="color: var(--color-secondary); flex: 1;">[Prio ${mx.priority}] ${mx.exchange}</span>
          </div>
        `;
      });
    }

    // Registros NS
    if (data.dns?.ns && data.dns.ns.length > 0) {
      data.dns.ns.forEach((ns) => {
        totalDnsCount++;
        dnsHtml += `
          <div class="dns-item-row">
            <span class="dns-record-badge dns-badge-ns">NS</span>
            <span style="color: var(--color-success); flex: 1;">${ns}</span>
          </div>
        `;
      });
    }

    // Registros TXT
    if (data.dns?.txt && data.dns.txt.length > 0) {
      data.dns.txt.forEach((txt) => {
        totalDnsCount++;
        dnsHtml += `
          <div class="dns-item-row" style="flex-direction: column; gap: 4px;">
            <div><span class="dns-record-badge dns-badge-txt">TXT</span></div>
            <div style="color: var(--color-text-dim); font-size: 0.75rem; word-break: break-all; background: var(--color-surface-2); padding: 4px 6px; border-radius: 4px;">${txt}</div>
          </div>
        `;
      });
    }

    if (totalDnsCount === 0) {
      dnsHtml = '<div style="color: var(--color-text-dim); padding: 8px 0; font-size: 0.8rem;">Nenhum registro DNS detectado para este host.</div>';
    }

    totalDnsBadge.textContent = `${totalDnsCount} Registros`;
    dnsContainer.innerHTML = dnsHtml;

    // 3. Certificado SSL / TLS
    const sslBadge = document.getElementById('resSslStatusBadge');
    const sslEmissor = document.getElementById('resSslEmissor');
    const sslTitular = document.getElementById('resSslTitular');
    const sslValidade = document.getElementById('resSslValidade');
    const sslDias = document.getElementById('resSslDiasRestantes');
    const sslSans = document.getElementById('resSslSans');

    if (data.ssl) {
      sslBadge.textContent = data.ssl.isValid ? 'Válido' : 'Expirado';
      sslBadge.className = data.ssl.isValid ? 'badge badge-purple' : 'badge badge-red';

      sslEmissor.textContent = data.ssl.emissor || 'Não identificado';
      sslTitular.textContent = data.ssl.titular || data.dominio;
      sslValidade.textContent = data.ssl.validoAte ? new Date(data.ssl.validoAte).toLocaleDateString('pt-BR') : '-';
      sslDias.textContent = `${data.ssl.diasRestantes} dias restantes`;
      sslDias.style.color = data.ssl.diasRestantes > 15 ? 'var(--color-success)' : 'var(--color-secondary)';

      if (data.ssl.san && data.ssl.san.length > 0) {
        sslSans.textContent = data.ssl.san.join(', ');
      } else {
        sslSans.textContent = 'Nenhum SAN adicional listado.';
      }
    } else {
      sslBadge.textContent = 'Sem SSL';
      sslBadge.className = 'badge badge-red';
      sslEmissor.textContent = 'Porta 443 fechada ou sem certificado';
      sslTitular.textContent = '-';
      sslValidade.textContent = '-';
      sslDias.textContent = 'Não protegido';
      sslDias.style.color = 'var(--color-secondary)';
      sslSans.textContent = '-';
    }

    // 4. Cabeçalhos HTTP
    renderHeaderBadge('resHstsBadge', data.http?.headers?.hsts, 'Ativo (Preload)', 'Ausente');
    renderHeaderBadge('resCspBadge', data.http?.headers?.csp, 'Configurado', 'Ausente');
    renderHeaderBadge(
      'resFrameOptionsBadge',
      !!data.http?.headers?.xFrameOptions,
      data.http?.headers?.xFrameOptions || 'Ativo',
      'Ausente (Vulnerável)'
    );
    renderHeaderBadge('resContentTypeBadge', data.http?.headers?.xContentTypeOptions, 'nosniff (OK)', 'Ausente');

    // 5. WHOIS & RDAP
    const esc = (s) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const whois = data.whois || {};
    document.getElementById('resWhoisFonte').textContent = whois.fonte || 'RDAP';
    document.getElementById('resWhoisTitular').textContent = whois.titular || 'Privado / Oculto';
    document.getElementById('resWhoisCriadoEm').textContent = whois.criadoEm ? new Date(whois.criadoEm).toLocaleDateString('pt-BR') : 'Não divulgado';
    document.getElementById('resWhoisExpiraEm').textContent = whois.expiraEm ? new Date(whois.expiraEm).toLocaleDateString('pt-BR') : 'Não divulgado';

    const docEl = document.getElementById('resWhoisDocumento');
    const docTipoEl = document.getElementById('resWhoisDocTipo');
    if (docEl) {
      docEl.textContent = whois.documento || whois.titularHandle || 'Não exposto';
      docEl.style.color = whois.documentoLimpo ? '#38BDF8' : 'var(--color-text-muted)';
    }
    if (docTipoEl) {
      if (whois.documentoTipo) {
        docTipoEl.textContent = whois.documentoMascarado ? `${whois.documentoTipo.toUpperCase()} (LGPD)` : whois.documentoTipo.toUpperCase();
        docTipoEl.style.display = 'inline-flex';
      } else {
        docTipoEl.style.display = 'none';
      }
    }

    const rowResp = document.getElementById('resWhoisRowResp');
    const respEl = document.getElementById('resWhoisResponsavel');
    const respTexto = [whois.responsavelLegal, whois.emailTitular].filter(Boolean).join(' • ');
    if (rowResp && respEl) {
      if (respTexto) {
        respEl.textContent = respTexto;
        rowResp.style.display = 'flex';
      } else {
        rowResp.style.display = 'none';
      }
    }

    const idadeEl = document.getElementById('resWhoisIdade');
    const idadeBadge = document.getElementById('resWhoisIdadeBadge');
    if (idadeEl) {
      idadeEl.textContent = whois.idadeFormatada || 'Não calculada';
    }
    if (idadeBadge) {
      if (whois.alertaDominioRecente) {
        idadeBadge.textContent = whois.nivelRiscoIdade === 'CRÍTICO' ? 'RECÉM-CRIADO (<30d)' : 'RECENTE (<90d)';
        idadeBadge.className = 'badge badge-red';
        idadeBadge.style.display = 'inline-flex';
      } else if (whois.idadeDias !== null && whois.idadeDias !== undefined) {
        idadeBadge.textContent = 'ESTABELECIDO';
        idadeBadge.className = 'badge badge-purple';
        idadeBadge.style.display = 'inline-flex';
      } else {
        idadeBadge.style.display = 'none';
      }
    }

    const empBox = document.getElementById('resWhoisEmpresaBox');
    const empInfo = document.getElementById('resWhoisEmpresaInfo');
    if (empBox && empInfo) {
      if (whois.empresaTitular?.razaoSocial) {
        const emp = whois.empresaTitular;
        empInfo.innerHTML = `
          <div><strong>${esc(emp.razaoSocial)}</strong>${emp.nomeFantasia ? ` (${esc(emp.nomeFantasia)})` : ''}</div>
          <div style="color: var(--color-text-muted); font-size: 0.75rem; margin-top: 2px;">
            Situação: <strong style="color: #34D399;">${esc(emp.situacaoCadastral || 'N/I')}</strong>
            ${emp.municipio ? ` • ${esc(emp.municipio)}/${esc(emp.uf || '')}` : ''}
            ${emp.totalSocios ? ` • ${esc(emp.totalSocios)} sócio(s)` : ''}
          </div>
        `;
        empBox.style.display = 'block';
      } else {
        empBox.style.display = 'none';
      }
    }

    const pivotWrap = document.getElementById('resWhoisPivotActions');
    if (pivotWrap) {
      const btns = [];
      if (whois.documentoLimpo && whois.documentoTipo === 'cnpj') {
        btns.push(`<a href="/advanced/person?tipo=cnpj&termo=${encodeURIComponent(whois.documentoLimpo)}&auto=1" class="btn btn-primary btn-sm" style="font-size: 0.74rem;">Puxar CNPJ &amp; Compliance</a>`);
        btns.push(`<a href="/basic/processos?tipo=documento&termo=${encodeURIComponent(whois.documentoLimpo)}" class="btn btn-secondary btn-sm" style="font-size: 0.74rem;">Buscar Processos Judiciais</a>`);
      } else if (whois.documentoLimpo && whois.documentoTipo === 'cpf') {
        btns.push(`<a href="/advanced/person?tipo=cpf&termo=${encodeURIComponent(whois.documentoLimpo)}&auto=1" class="btn btn-primary btn-sm" style="font-size: 0.74rem;">Puxar CPF Completo</a>`);
        btns.push(`<a href="/basic/processos?tipo=documento&termo=${encodeURIComponent(whois.documentoLimpo)}" class="btn btn-secondary btn-sm" style="font-size: 0.74rem;">Buscar Processos</a>`);
      } else if (whois.titular && !String(whois.titular).toLowerCase().includes('privado')) {
        btns.push(`<a href="/advanced/person?tipo=nome&termo=${encodeURIComponent(whois.titular)}" class="btn btn-secondary btn-sm" style="font-size: 0.74rem;">Pesquisar Titular em Dossiê</a>`);
      }
      if (btns.length > 0) {
        pivotWrap.innerHTML = btns.join('');
        pivotWrap.style.display = 'flex';
      } else {
        pivotWrap.style.display = 'none';
        pivotWrap.innerHTML = '';
      }
    }

    const nsList = whois.nameservers || [];
    if (nsList.length > 0) {
      document.getElementById('resWhoisNameservers').innerHTML = nsList.map((ns) => `<div>• ${esc(ns)}</div>`).join('');
    } else {
      document.getElementById('resWhoisNameservers').textContent = 'Nenhum nameserver retornado pelo servidor WHOIS.';
    }

    // 6. Google Dorks (Padrão: Oculto se não ativado nas configurações)
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

  function renderHeaderBadge(id, isOk, textOk, textFail) {
    const el = document.getElementById(id);
    if (!el) return;
    if (isOk) {
      el.textContent = textOk;
      el.className = 'badge badge-purple';
    } else {
      el.textContent = textFail;
      el.className = 'badge badge-dark';
      el.style.color = 'var(--color-secondary)';
    }
  }

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

  // Pivô direto via QueryString (?dominio=exemplo.com.br)
  const urlDomParams = new URLSearchParams(window.location.search);
  const queryDominio = urlDomParams.get('dominio');
  const inpDominio = document.getElementById('inputDominio');
  if (queryDominio && inpDominio) {
    inpDominio.value = queryDominio.trim();
    const formDom = inpDominio.closest('form');
    if (formDom) {
      setTimeout(() => {
        if (typeof formDom.requestSubmit === 'function') {
          formDom.requestSubmit();
        } else {
          formDom.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
      }, 60);
    }
  }
});

