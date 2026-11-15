/**
 * ==============================================================================
 * RIMUBUSCA - CLASSE BASE FRONTEND PARA CATÁLOGOS DE HUBS DE APIS
 * (HUBCLIENT.JS)
 *
 * Arquitetura Orientada a Objetos (OOP) para o Frontend:
 * Permite criar e plugar qualquer nova aba de catálogo Pay-per-Use facilmente.
 *
 * Exemplo de uso para criar uma nova aba no futuro:
 *   const meuHub = new RimuHubCatalog({
 *     apiEndpoint: '/api/meu-hub',
 *     containerId: 'meuHubContainer',
 *   });
 *   meuHub.init();
 * ==============================================================================
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RimuHubCatalog = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  class RimuHubCatalog {
    /**
     * @param {Object} options
     * @param {string} [options.apiEndpoint='/api/hubapi'] - Rota base da API
     * @param {string} [options.walletEndpoint] - Endpoint de status da carteira
     * @param {string} [options.consultEndpoint] - Endpoint para execução de consulta
     * @param {string} [options.rechargeEndpoint] - Endpoint para recarga de saldo
     * @param {Object} [options.samples] - Valores de teste rápido
     */
    constructor(options = {}) {
      this.apiEndpoint = options.apiEndpoint || '/api/hubapi';
      this.walletEndpoint = options.walletEndpoint || `${this.apiEndpoint}/status`;
      this.consultEndpoint = options.consultEndpoint || `${this.apiEndpoint}/consultar`;
      this.rechargeEndpoint = options.rechargeEndpoint || `${this.apiEndpoint}/recarregar`;

      this.samples = options.samples || {
        cpf: '456.789.012-34',
        cnpj: '12.345.678/0001-90',
        nome: 'Carlos Eduardo da Silva',
        telefone: '(11) 98765-4321',
        placa: 'BRA2E19',
        chassi: '9BWZZZ377VT004251',
        termo: 'Rafael Toniato Rodrigues',
        email: 'carlos.silva@empresa.com.br',
        cep: '01310-100',
      };

      this.state = {
        saldoAtual: 20.0,
        orcamentoMensal: 20.0,
        totalGasto: 0.0,
        totalConsultas: 0,
        percentualSaldo: 100,
        modulos: [],
        historico: [],
      };

      this.moduloSelecionado = null;
      this.currentFilterCategory = 'todas';
      this.currentSearchTerm = '';
    }

    /**
     * Inicializa os seletores do DOM e liga os event listeners
     */
    init() {
      this.cacheDomElements();
      this.bindEvents();
      this.carregarStatusCarteira();
    }

    /**
     * Mapeia os elementos do DOM
     */
    cacheDomElements() {
      this.dom = {
        saldoDisplay: document.getElementById('carteiraSaldoDisplay'),
        orcamentoDisplay: document.getElementById('carteiraOrcamentoDisplay'),
        gastoDisplay: document.getElementById('carteiraGastoDisplay'),
        consultasDisplay: document.getElementById('carteiraConsultasDisplay'),
        progressFill: document.getElementById('carteiraProgressFill'),
        percentualLabel: document.getElementById('carteiraPercentualLabel'),

        searchInput: document.getElementById('hubSearchInput'),
        btnLimparBusca: document.getElementById('btnLimparBusca'),
        tabBtns: document.querySelectorAll('.hub-tab-btn'),
        sections: document.querySelectorAll('.hub-category-section'),
        cards: document.querySelectorAll('.hub-card'),
        nenhumResultado: document.getElementById('hubNenhumResultado'),

        modalConsulta: document.getElementById('modalExecutarConsulta'),
        btnFecharModalConsulta: document.getElementById('btnFecharModalConsulta'),
        btnCancelarConsulta: document.getElementById('btnCancelarConsulta'),
        btnConfirmarConsulta: document.getElementById('btnConfirmarConsulta'),
        btnConfirmarTexto: document.getElementById('btnConfirmarTexto'),
        modalModIcon: document.getElementById('modalModIcon'),
        modalModNome: document.getElementById('modalModNome'),
        modalModCusto: document.getElementById('modalModCusto'),
        modalSaldoAtual: document.getElementById('modalSaldoAtual'),
        modalSaldoPrevisto: document.getElementById('modalSaldoPrevisto'),
        labelParametroNome: document.getElementById('labelParametroNome'),
        inputParametroValor: document.getElementById('inputParametroValor'),
        inputModuloId: document.getElementById('inputModalModuloId'),
        btnUsarExemploTeste: document.getElementById('btnUsarExemploTeste'),
        execucaoLoading: document.getElementById('hubExecucaoLoading'),
        hubLoadingText: document.getElementById('hubLoadingText'),
        execucaoErro: document.getElementById('hubExecucaoErro'),
        resultadoArea: document.getElementById('hubResultadoArea'),
        jsonResultadoPre: document.getElementById('jsonResultadoPre'),
        btnCopiarJson: document.getElementById('btnCopiarJsonResultado'),
        checkUsarCache: document.getElementById('checkUsarCache'),
        hubCacheBadge: document.getElementById('hubCacheBadge'),
        btnForcarRecarregarAoVivo: document.getElementById('btnForcarRecarregarAoVivo'),

        btnAbrirRecarga: document.getElementById('btnAbrirRecarga'),
        modalRecarga: document.getElementById('modalRecarga'),
        btnFecharModalRecarga: document.getElementById('btnFecharModalRecarga'),
        btnCancelarRecarga: document.getElementById('btnCancelarRecarga'),
        btnConfirmarRecarga: document.getElementById('btnConfirmarRecarga'),
        inputValorRecarga: document.getElementById('inputValorRecarga'),
        presetRecargaBtns: document.querySelectorAll('.btn-preset-recarga'),
        recargaSaldoAtualDisplay: document.getElementById('recargaSaldoAtualDisplay'),
        recargaSaldoFinalDisplay: document.getElementById('recargaSaldoFinalDisplay'),

        btnVerExtrato: document.getElementById('btnVerExtrato'),
        modalExtrato: document.getElementById('modalExtrato'),
        btnFecharModalExtrato: document.getElementById('btnFecharModalExtrato'),
        btnFecharExtratoFooter: document.getElementById('btnFecharExtratoFooter'),
        extratoListContainer: document.getElementById('extratoListContainer'),
      };
    }

    /**
     * Vincula todos os eventos de clique, busca e submissão
     */
    bindEvents() {
      // 1. Abertura do modal de consulta ao clicar no card
      if (this.dom.cards) {
        this.dom.cards.forEach((card) => {
          card.addEventListener('click', (e) => {
            if (e.target.closest('button') || e.target.closest('a')) return;
            this.abrirModalConsulta({
              id: card.dataset.id,
              nome: card.dataset.nome,
              custo: parseFloat(card.dataset.custo || '0'),
              parametro: card.dataset.parametro || 'Termo',
              categoria: card.dataset.categoria || 'Geral',
              icone: card.dataset.icone || 'search',
            });
          });

          const btnAction = card.querySelector('.btn-executar-modulo');
          if (btnAction) {
            btnAction.addEventListener('click', (e) => {
              e.stopPropagation();
              this.abrirModalConsulta({
                id: card.dataset.id,
                nome: card.dataset.nome,
                custo: parseFloat(card.dataset.custo || '0'),
                parametro: card.dataset.parametro || 'Termo',
                categoria: card.dataset.categoria || 'Geral',
                icone: card.dataset.icone || 'search',
              });
            });
          }
        });
      }

      // 2. Busca e Filtros
      if (this.dom.searchInput) {
        this.dom.searchInput.addEventListener('input', (e) => {
          this.currentSearchTerm = e.target.value.toLowerCase().trim();
          if (this.dom.btnLimparBusca) {
            this.dom.btnLimparBusca.style.display = this.currentSearchTerm ? 'flex' : 'none';
          }
          this.aplicarFiltros();
        });
      }

      if (this.dom.btnLimparBusca) {
        this.dom.btnLimparBusca.addEventListener('click', () => {
          if (this.dom.searchInput) {
            this.dom.searchInput.value = '';
            this.currentSearchTerm = '';
            this.dom.btnLimparBusca.style.display = 'none';
            this.aplicarFiltros();
            this.dom.searchInput.focus();
          }
        });
      }

      if (this.dom.tabBtns) {
        this.dom.tabBtns.forEach((tab) => {
          tab.addEventListener('click', () => {
            this.dom.tabBtns.forEach((t) => t.classList.remove('active'));
            tab.classList.add('active');
            this.currentFilterCategory = tab.dataset.categoria || tab.dataset.cat || tab.getAttribute('data-categoria') || 'todas';
            this.aplicarFiltros();
          });
        });
      }

      // 3. Execução de consulta
      if (this.dom.btnConfirmarConsulta) {
        this.dom.btnConfirmarConsulta.addEventListener('click', () => this.executarConsulta());
      }

      if (this.dom.inputParametroValor) {
        this.dom.inputParametroValor.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.executarConsulta();
          }
        });
      }

      if (this.dom.btnUsarExemploTeste) {
        this.dom.btnUsarExemploTeste.addEventListener('click', () => {
          if (!this.moduloSelecionado || !this.dom.inputParametroValor) return;
          const paramTipo = (this.moduloSelecionado.parametro || '').toLowerCase();
          let exemplo = this.samples.termo;
          for (const key of Object.keys(this.samples)) {
            if (paramTipo.includes(key)) {
              exemplo = this.samples[key];
              break;
            }
          }
          this.dom.inputParametroValor.value = exemplo;
          this.dom.inputParametroValor.focus();
        });
      }

      // 4. Fechamento de Modais
      const fecharModalConsulta = () => this.fecharModal(this.dom.modalConsulta);
      if (this.dom.btnFecharModalConsulta) this.dom.btnFecharModalConsulta.addEventListener('click', fecharModalConsulta);
      if (this.dom.btnCancelarConsulta) this.dom.btnCancelarConsulta.addEventListener('click', fecharModalConsulta);

      const fecharModalRecarga = () => this.fecharModal(this.dom.modalRecarga);
      if (this.dom.btnFecharModalRecarga) this.dom.btnFecharModalRecarga.addEventListener('click', fecharModalRecarga);
      if (this.dom.btnCancelarRecarga) this.dom.btnCancelarRecarga.addEventListener('click', fecharModalRecarga);

      const fecharModalExtrato = () => this.fecharModal(this.dom.modalExtrato);
      if (this.dom.btnFecharModalExtrato) this.dom.btnFecharModalExtrato.addEventListener('click', fecharModalExtrato);
      if (this.dom.btnFecharExtratoFooter) this.dom.btnFecharExtratoFooter.addEventListener('click', fecharModalExtrato);

      // 5. Recarga
      if (this.dom.btnAbrirRecarga) {
        this.dom.btnAbrirRecarga.addEventListener('click', () => this.abrirModalRecarga());
      }
      if (this.dom.btnConfirmarRecarga) {
        this.dom.btnConfirmarRecarga.addEventListener('click', () => this.executarRecarga());
      }

      // 6. Extrato
      if (this.dom.btnVerExtrato) {
        this.dom.btnVerExtrato.addEventListener('click', () => this.abrirModalExtrato());
      }

      // 7. Cópia de JSON
      if (this.dom.btnCopiarJson) {
        this.dom.btnCopiarJson.addEventListener('click', () => {
          const jsonText = this.dom.jsonResultadoPre?.textContent || '';
          if (jsonText && typeof window.copyToClipboard === 'function') {
            window.copyToClipboard(jsonText, 'JSON copiado para a área de transferência!');
          }
        });
      }
    }

    /**
     * Aplica filtros de pesquisa textual e abas de categoria
     */
    aplicarFiltros() {
      let cardsVisiveisTotal = 0;

      if (!this.dom.sections) return;

      this.dom.sections.forEach((section) => {
        const secCat = section.dataset.categoria || section.dataset.cat || section.getAttribute('data-cat') || '';
        let cardsNaSecao = 0;
        const cards = section.querySelectorAll('.hub-card');

        cards.forEach((card) => {
          const cardCat = card.dataset.categoria || card.dataset.cat || card.getAttribute('data-cat') || secCat;
          const cardNome = (card.dataset.nome || card.getAttribute('data-nome') || '').toLowerCase();
          const cardDesc = (card.dataset.desc || card.getAttribute('data-desc') || card.querySelector('.hub-card-desc')?.textContent || '').toLowerCase();
          const cardParam = (card.dataset.param || card.dataset.parametro || card.getAttribute('data-param') || '').toLowerCase();
          const cardId = (card.dataset.id || card.getAttribute('data-id') || '').toLowerCase();

          const bateCategoria = this.currentFilterCategory === 'todas' || cardCat === this.currentFilterCategory;
          const bateBusca =
            !this.currentSearchTerm ||
            cardNome.includes(this.currentSearchTerm) ||
            cardDesc.includes(this.currentSearchTerm) ||
            cardParam.includes(this.currentSearchTerm) ||
            cardId.includes(this.currentSearchTerm);

          if (bateCategoria && bateBusca) {
            card.style.display = 'flex';
            cardsNaSecao++;
            cardsVisiveisTotal++;
          } else {
            card.style.display = 'none';
          }
        });

        section.style.display = cardsNaSecao > 0 ? 'block' : 'none';
      });

      if (this.dom.nenhumResultado) {
        this.dom.nenhumResultado.style.display = cardsVisiveisTotal === 0 ? 'block' : 'none';
      }
    }

    /**
     * Carrega o status atualizado da carteira compartilhada via API
     */
    async carregarStatusCarteira() {
      try {
        const response = await fetch(this.walletEndpoint);
        if (!response.ok) return;

        const res = await response.json();
        if (res.success && res.data) {
          this.state = {
            ...this.state,
            ...res.data,
          };
          this.atualizarDisplaysCarteira();
        }
      } catch (err) {
        console.warn(`[${this.constructor.name}] Erro ao consultar status:`, err.message);
      }
    }

    /**
     * Atualiza os números e a barra de progresso visual da carteira
     */
    atualizarDisplaysCarteira() {
      const saldo = Number(this.state.saldoAtual || 0);
      const orcamento = Number(this.state.orcamentoMensal || 20);
      const gasto = Number(this.state.totalGasto || 0);
      const consultas = Number(this.state.totalConsultas || 0);
      const percent = orcamento > 0 ? Math.max(0, Math.min(100, Math.round((saldo / orcamento) * 100))) : 0;

      if (this.dom.saldoDisplay) this.dom.saldoDisplay.textContent = this.formatCurrency(saldo);
      if (this.dom.orcamentoDisplay) this.dom.orcamentoDisplay.textContent = this.formatCurrency(orcamento);
      if (this.dom.gastoDisplay) this.dom.gastoDisplay.textContent = this.formatCurrency(gasto);
      if (this.dom.consultasDisplay) this.dom.consultasDisplay.textContent = String(consultas);

      if (this.dom.progressFill) {
        this.dom.progressFill.style.width = `${percent}%`;
        if (percent > 40) {
          this.dom.progressFill.style.background = 'linear-gradient(90deg, #10B981, #06B6D4)';
        } else if (percent > 15) {
          this.dom.progressFill.style.background = 'linear-gradient(90deg, #F59E0B, #EF4444)';
        } else {
          this.dom.progressFill.style.background = '#EF4444';
        }
      }

      if (this.dom.percentualLabel) {
        this.dom.percentualLabel.textContent = `${percent}% restante`;
      }
    }

    /**
     * Abre o modal de execução de consulta de um módulo
     */
    abrirModalConsulta(mod) {
      this.moduloSelecionado = mod;
      if (!this.dom.modalConsulta) return;

      if (this.dom.modalModNome) this.dom.modalModNome.textContent = mod.nome;
      if (this.dom.modalModCusto) this.dom.modalModCusto.textContent = this.formatCurrency(mod.custo);
      if (this.dom.modalSaldoAtual) this.dom.modalSaldoAtual.textContent = this.formatCurrency(this.state.saldoAtual);

      const previsto = Math.max(0, this.state.saldoAtual - mod.custo);
      if (this.dom.modalSaldoPrevisto) this.dom.modalSaldoPrevisto.textContent = this.formatCurrency(previsto);

      if (this.dom.labelParametroNome) this.dom.labelParametroNome.textContent = mod.parametro || 'Parâmetro de Busca';
      if (this.dom.inputModuloId) this.dom.inputModuloId.value = mod.id;

      if (this.dom.inputParametroValor) {
        this.dom.inputParametroValor.value = '';
        this.dom.inputParametroValor.placeholder = `Informe ${mod.parametro || 'o valor'}...`;
      }

      if (this.dom.execucaoLoading) this.dom.execucaoLoading.style.display = 'none';
      if (this.dom.execucaoErro) this.dom.execucaoErro.style.display = 'none';
      if (this.dom.resultadoArea) this.dom.resultadoArea.style.display = 'none';

      this.abrirModal(this.dom.modalConsulta);
      setTimeout(() => this.dom.inputParametroValor?.focus(), 150);
    }

    /**
     * Dispara a execução da consulta via API
     */
    async executarConsulta() {
      if (!this.moduloSelecionado) return;

      const valor = this.dom.inputParametroValor?.value.trim();
      if (!valor) {
        window.toast?.error(`Informe o valor para ${this.moduloSelecionado.parametro || 'a busca'}.`);
        this.dom.inputParametroValor?.focus();
        return;
      }

      const usarCache = this.dom.checkUsarCache ? this.dom.checkUsarCache.checked : true;

      if (this.dom.execucaoLoading) this.dom.execucaoLoading.style.display = 'flex';
      if (this.dom.execucaoErro) this.dom.execucaoErro.style.display = 'none';
      if (this.dom.resultadoArea) this.dom.resultadoArea.style.display = 'none';
      if (this.dom.btnConfirmarConsulta) this.dom.btnConfirmarConsulta.disabled = true;

      try {
        const res = await fetch(this.consultEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            moduloId: this.moduloSelecionado.id,
            parametroValor: valor,
            forceRefresh: !usarCache,
          }),
        });

        const data = await res.json();

        if (this.dom.execucaoLoading) this.dom.execucaoLoading.style.display = 'none';
        if (this.dom.btnConfirmarConsulta) this.dom.btnConfirmarConsulta.disabled = false;

        if (!data.success) {
          throw new Error(data.error || 'Falha ao executar consulta.');
        }

        // Renderiza resultado
        if (this.dom.jsonResultadoPre) {
          this.dom.jsonResultadoPre.textContent = JSON.stringify(data.data?.dados || data.data, null, 2);
        }
        if (this.dom.resultadoArea) {
          this.dom.resultadoArea.style.display = 'block';
        }

        // Atualiza carteira
        await this.carregarStatusCarteira();
        window.toast?.success(`Consulta '${this.moduloSelecionado.nome}' realizada com sucesso!`);
      } catch (err) {
        if (this.dom.execucaoLoading) this.dom.execucaoLoading.style.display = 'none';
        if (this.dom.btnConfirmarConsulta) this.dom.btnConfirmarConsulta.disabled = false;

        if (this.dom.execucaoErro) {
          this.dom.execucaoErro.style.display = 'block';
          this.dom.execucaoErro.textContent = err.message;
        }
        window.toast?.error(err.message);
      }
    }

    /**
     * Abre modal de recarga
     */
    abrirModalRecarga() {
      if (!this.dom.modalRecarga) return;
      if (this.dom.recargaSaldoAtualDisplay) {
        this.dom.recargaSaldoAtualDisplay.textContent = this.formatCurrency(this.state.saldoAtual);
      }
      this.abrirModal(this.dom.modalRecarga);
    }

    /**
     * Executa recarga
     */
    async executarRecarga() {
      const valor = parseFloat(this.dom.inputValorRecarga?.value || '0');
      if (valor < 1) {
        window.toast?.error('O valor mínimo de recarga é R$ 1,00.');
        return;
      }

      if (this.dom.btnConfirmarRecarga) this.dom.btnConfirmarRecarga.disabled = true;

      try {
        const res = await fetch(this.rechargeEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ valor }),
        });

        const data = await res.json();
        if (this.dom.btnConfirmarRecarga) this.dom.btnConfirmarRecarga.disabled = false;

        if (!data.success) throw new Error(data.error || 'Falha ao processar recarga.');

        this.fecharModal(this.dom.modalRecarga);
        await this.carregarStatusCarteira();
        window.toast?.success(data.message || 'Recarga efetuada com sucesso!');
      } catch (err) {
        if (this.dom.btnConfirmarRecarga) this.dom.btnConfirmarRecarga.disabled = false;
        window.toast?.error(err.message);
      }
    }

    /**
     * Abre modal de extrato
     */
    abrirModalExtrato() {
      if (!this.dom.modalExtrato) return;
      const container = this.dom.extratoListContainer;
      if (container) {
        const items = this.state.historico || [];
        if (items.length === 0) {
          container.innerHTML = '<div style="text-align: center; padding: 24px; color: var(--color-text-dim);">Nenhuma transação registrada até o momento.</div>';
        } else {
          container.innerHTML = items
            .map((item) => {
              const isDebito = item.tipo === 'DEBITO';
              return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: var(--color-surface-2); border-radius: var(--radius-sm); border-left: 3px solid ${isDebito ? '#EF4444' : '#10B981'};">
                  <div>
                    <div style="font-weight: 600; font-size: 0.85rem; color: var(--color-text);">${item.moduloNome || item.moduloId}</div>
                    <div style="font-size: 0.75rem; color: var(--color-text-dim); margin-top: 2px;">${item.parametro || ''} • ${item.userNome || 'Operador'}</div>
                  </div>
                  <div style="text-align: right;">
                    <div style="font-weight: 700; font-family: var(--font-mono); color: ${isDebito ? '#EF4444' : '#10B981'};">${isDebito ? '-' : '+'}${this.formatCurrency(item.custo)}</div>
                    <div style="font-size: 0.7rem; color: var(--color-text-dim);">${item.timestamp ? new Date(item.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                  </div>
                </div>
              `;
            })
            .join('');
        }
      }
      this.abrirModal(this.dom.modalExtrato);
    }

    abrirModal(modalElem) {
      if (modalElem) {
        modalElem.style.display = 'flex';
        document.body.style.overflow = 'hidden';
      }
    }

    fecharModal(modalElem) {
      if (modalElem) {
        modalElem.style.display = 'none';
        document.body.style.overflow = '';
      }
    }

    formatCurrency(val) {
      return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
  }

  return RimuHubCatalog;
});
