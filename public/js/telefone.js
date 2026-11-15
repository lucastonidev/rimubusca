/**
 * ==============================================================================
 * RIMUBUSCA - MÓDULO TELEFONE & PHONEINFOGA ADAPTER (TELEFONE.JS)
 * Interações de interface, máscaras dinâmicas e consulta assíncrona
 * ==============================================================================
 */

class TelefoneController {
  constructor() {
    this.currentData = null;
    this.init();
  }

  init() {
    this.bindForm();
    this.bindMask();
    this.bindDemos();
    this.bindCopyButtons();
  }

  // 1. MÁSCARA DINÂMICA DE TELEFONE
  bindMask() {
    const input = document.getElementById('telefoneInput');
    const ddiSelect = document.getElementById('ddiSelect');

    if (!input) return;

    input.addEventListener('input', (e) => {
      const ddi = ddiSelect ? ddiSelect.value : '+55';

      // Se for Brasil (+55), aplica máscara brasileira inteligente (fixo ou celular)
      if (ddi === '+55') {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 11) val = val.slice(0, 11);

        if (val.length > 10) {
          e.target.value = val.replace(/^(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        } else if (val.length > 6) {
          e.target.value = val.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
        } else if (val.length > 2) {
          e.target.value = val.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
        } else if (val.length > 0) {
          e.target.value = `(${val}`;
        }
      }
    });
  }

  // 2. ATALHOS DE TESTE RÁPIDO (DEMOS)
  bindDemos() {
    const demoBtns = document.querySelectorAll('.demo-phone-btn');
    const input = document.getElementById('telefoneInput');
    const ddiSelect = document.getElementById('ddiSelect');
    const form = document.getElementById('telefoneForm');

    demoBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const number = btn.dataset.number;
        const ddi = btn.dataset.ddi || '+55';

        if (ddiSelect) ddiSelect.value = ddi;
        if (input) {
          input.value = number;
          // Dispara input para aplicar máscara
          input.dispatchEvent(new Event('input'));
        }

        // Submete automaticamente para conveniência do operador
        if (form) {
          form.dispatchEvent(new Event('submit'));
        }
      });
    });
  }

  // 3. SUBMISSÃO DO FORMULÁRIO DE CONSULTA
  bindForm() {
    const form = document.getElementById('telefoneForm');
    const submitBtn = document.getElementById('btnSubmitTelefone');
    const input = document.getElementById('telefoneInput');
    const ddiSelect = document.getElementById('ddiSelect');

    if (!form || !submitBtn || !input) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const rawValue = input.value.trim();
      const ddi = ddiSelect ? ddiSelect.value : '+55';

      if (!rawValue) {
        window.toast?.error('Por favor, informe um número de telefone.');
        input.focus();
        return;
      }

      // Constrói o número completo para envio
      let numeroCompleto = rawValue;
      if (!rawValue.startsWith('+')) {
        numeroCompleto = `${ddi}${rawValue.replace(/\D/g, '')}`;
      }

      this.showState('loading');
      submitBtn.disabled = true;

      try {
        const res = await window.api.post('/api/telefone/consultar', {
          telefone: numeroCompleto,
        });

        if (res.success && res.data) {
          this.currentData = res.data;
          this.renderResults(res.data);
          this.showState('results');
          window.toast?.success(`Inteligência do número ${res.data.formatoNacional} obtida com sucesso!`);
        } else {
          throw new Error(res.error || 'Não foi possível analisar o número.');
        }
      } catch (err) {
        console.error('[ERRO TELEFONE CLIENT]:', err);
        this.showState('error', err.message || 'Falha ao consultar operadora e PhoneInfoga.');
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  // 4. RENDERIZAÇÃO DOS RESULTADOS NA TELA
  renderResults(data) {
    // 1. Resumo e Formatações
    document.getElementById('resTelE164').textContent = data.formatoE164;
    document.getElementById('resTelNacional').textContent = data.formatoNacional;
    document.getElementById('resTelInternacional').textContent = data.formatoInternacional;

    const badgeValido = document.getElementById('resTelStatusBadge');
    if (badgeValido) {
      badgeValido.className = `badge ${data.valido ? 'badge-success' : 'badge-error'}`;
      badgeValido.textContent = data.valido ? 'Número Válido (E.164)' : 'Formato Inválido / Incompleto';
    }

    // 2. Operadora e Tipo de Linha
    document.getElementById('resTelOperadora').textContent = data.operadora;
    document.getElementById('resTelTipoLinha').textContent = data.tipoLinha;
    document.getElementById('resTelNotaPortabilidade').textContent = data.portabilidadeNota;

    const rowMccMnc = document.getElementById('rowMccMnc');
    const resTelMccMnc = document.getElementById('resTelMccMnc');
    if (rowMccMnc && resTelMccMnc) {
      if (data.carrierDetails?.mcc || data.carrierDetails?.mnc) {
        rowMccMnc.style.display = 'table-row';
        resTelMccMnc.textContent = `${data.carrierDetails.mcc || 'N/A'} / ${data.carrierDetails.mnc || 'N/A'}`;
      } else {
        rowMccMnc.style.display = 'none';
      }
    }

    const fonteBadge = document.getElementById('resTelFonteBadge');
    if (fonteBadge && data.fonte) {
      fonteBadge.textContent = data.carrierDetails ? 'Carrier Lookup API (Ao Vivo)' : 'Telecom Core';
    }

    if (data.apiAviso) {
      window.toast?.info(data.apiAviso);
    }

    // Ícone dinâmico móvel vs fixo
    const iconLinha = document.getElementById('iconTipoLinha');
    if (iconLinha) {
      const isMobile = data.tipoLinha.toLowerCase().includes('móvel') || data.tipoLinha.toLowerCase().includes('celular');
      iconLinha.setAttribute('data-lucide', isMobile ? 'smartphone' : 'phone-call');
    }

    // 3. Localização & Anatel
    document.getElementById('resTelPais').textContent = `${data.bandeira} ${data.pais} (${data.iso})`;
    document.getElementById('resTelDdiDdd').textContent = `${data.ddi} ${data.ddd ? `/ DDD ${data.ddd}` : ''}`;
    document.getElementById('resTelEstado').textContent = data.estado;
    document.getElementById('resTelRegiao').textContent = data.regiao;

    // 4. Mensageiros e Links Diretos
    if (data.linksDiretos) {
      document.getElementById('btnLinkWhatsapp')?.setAttribute('href', data.linksDiretos.whatsapp);
      document.getElementById('btnLinkTelegram')?.setAttribute('href', data.linksDiretos.telegram);
      document.getElementById('btnLinkTruecaller')?.setAttribute('href', data.linksDiretos.truecaller);
      document.getElementById('btnLinkSyncme')?.setAttribute('href', data.linksDiretos.syncme);
    }

    // 5. Dorks do Google
    this.renderDorks(data.dorks);

    // 6. JSON Bruto
    document.getElementById('telRawJson').textContent = JSON.stringify(data, null, 2);

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  renderDorks(dorks = []) {
    const container = document.getElementById('telDorksContainer');
    if (!container) return;

    const cardDorks = container.closest('.card');
    const showDorksPref = window.rimuSettings ? window.rimuSettings.showGoogleDorks : (localStorage.getItem('rimu_pref_show_google_dorks') === 'true');

    if (cardDorks) {
      cardDorks.style.display = showDorksPref ? 'block' : 'none';
    }

    if (!showDorksPref) return;

    container.innerHTML = '';
    dorks.forEach((dork) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.style.padding = 'var(--space-3) var(--space-4)';
      card.style.backgroundColor = 'var(--color-surface-2)';

      card.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
          <span style="font-size: 0.8125rem; font-weight: 600; color: var(--color-primary);">${this.escapeHtml(dork.nome)}</span>
          <a href="${dork.url}" target="_blank" rel="noopener noreferrer" class="btn btn-ghost btn-sm" style="padding: 2px 8px; font-size: 0.75rem;">
            <span>Abrir Google</span>
            <i data-lucide="external-link" style="width: 12px; height: 12px;"></i>
          </a>
        </div>
        <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--color-text-dim); word-break: break-all;">
          ${this.escapeHtml(dork.query)}
        </div>
      `;

      container.appendChild(card);
    });

    if (window.lucide) window.lucide.createIcons({ root: container });
  }

  // 5. BOTÕES DE CÓPIA E CONTROLES
  bindCopyButtons() {
    const copyJsonBtn = document.getElementById('btnCopyTelJson');
    if (copyJsonBtn) {
      copyJsonBtn.addEventListener('click', (e) => {
        if (!this.currentData) return;
        window.copyToClipboard(JSON.stringify(this.currentData, null, 2), e.currentTarget);
      });
    }

    const resetBtn = document.getElementById('btnNovaConsultaTel');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.currentData = null;
        const input = document.getElementById('telefoneInput');
        if (input) {
          input.value = '';
          input.focus();
        }
        this.showState('initial');
      });
    }
  }

  // 6. GERENCIADOR DE ESTADOS DE TELA
  showState(state, errorMsg = '') {
    const loadingState = document.getElementById('telLoadingState');
    const resultsState = document.getElementById('telResultsState');
    const errorState = document.getElementById('telErrorState');

    if (loadingState) loadingState.style.display = state === 'loading' ? 'block' : 'none';
    if (resultsState) resultsState.style.display = state === 'results' ? 'block' : 'none';
    if (errorState) {
      errorState.style.display = state === 'error' ? 'block' : 'none';
      if (state === 'error') {
        document.getElementById('telErrorMessage').textContent = errorMsg;
      }
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.telefoneController = new TelefoneController();
});

