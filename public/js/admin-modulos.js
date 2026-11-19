/**
 * admin-modulos.js
 * Gerenciamento de módulos — 100% data-driven via API.
 * Dependências: window.api (api.js), window.toast (ui.js), window.renderLucide (main.js)
 */
(function () {
  'use strict';

  /* ============================================================
     Estado global da página
     ============================================================ */
  const state = {
    modulos: [],          // lista completa carregada da API
    filtrado: [],         // lista após filtros aplicados
    filtroCategoria: 'all',
    filtroStatus: 'all',
    filtroTexto: '',
    editandoId: null,     // null = novo módulo | string = id do módulo em edição
    deletandoId: null,    // id do módulo aguardando confirmação de exclusão
  };

  /* ============================================================
     Seletores de elementos DOM
     ============================================================ */
  const el = {
    // KPIs
    kpiTotal:       document.getElementById('kpiTotal'),
    kpiAtivos:      document.getElementById('kpiAtivos'),
    kpiManutencao:  document.getElementById('kpiManutencao'),
    kpiConsultas:   document.getElementById('kpiConsultas'),

    // Filtros
    inputBusca:     document.getElementById('inputBuscaModulos'),
    selectStatus:   document.getElementById('selectFiltroStatus'),
    filterBtns:     document.querySelectorAll('[data-filter]'),

    // Ações
    btnNovo:        document.getElementById('btnNovoModulo'),
    btnRecarregar:  document.getElementById('btnRecarregar'),
    iconRecarregar: document.getElementById('iconRecarregar'),

    // Tabela
    tbody:          document.getElementById('modulesTableBody'),

    // Modal criar/editar
    modalModulo:    document.getElementById('modalModulo'),
    modalTitle:     document.getElementById('modalModuloTitle'),
    btnFechar:      document.getElementById('btnFecharModal'),
    btnCancelar:    document.getElementById('btnCancelarModal'),
    btnSalvar:      document.getElementById('btnSalvarModulo'),

    // Campos do formulário
    formModulo:     document.getElementById('formModulo'),
    fieldSlug:      document.getElementById('fieldSlug'),
    fieldNome:      document.getElementById('fieldNome'),
    fieldIcone:     document.getElementById('fieldIcone'),
    fieldCorIcone:  document.getElementById('fieldCorIcone'),
    fieldCorColor:  document.getElementById('fieldCorIconeColor'),
    fieldRota:      document.getElementById('fieldRota'),
    fieldCategoria: document.getElementById('fieldCategoria'),
    fieldOrdem:     document.getElementById('fieldOrdem'),
    fieldBadgeTexto:document.getElementById('fieldBadgeTexto'),
    fieldBadgeCor:  document.getElementById('fieldBadgeCor'),
    fieldDescricao: document.getElementById('fieldDescricao'),
    fieldAtivo:     document.getElementById('fieldAtivo'),
    fieldEmBreve:   document.getElementById('fieldEmBreve'),
    fieldManutencao:document.getElementById('fieldManutencao'),

    // Live preview
    liveIconEl:     document.getElementById('liveIconEl'),
    livePreviewName:document.getElementById('livePreviewName'),
    livePreviewSlug:document.getElementById('livePreviewSlug'),

    // Modal de exclusão
    modalDelete:    document.getElementById('modalConfirmDelete'),
    btnFecharDelete:document.getElementById('btnFecharDelete'),
    btnCancelarDel: document.getElementById('btnCancelarDelete'),
    btnConfirmarDel:document.getElementById('btnConfirmarDelete'),
    deleteNome:     document.getElementById('deleteNomeModulo'),
  };

  /* ============================================================
     Helpers de exibição
     ============================================================ */

  /**
   * Retorna classe CSS do badge de categoria para a tabela.
   */
  function badgeCategoria(cat) {
    const map = {
      consultas: 'badge-red',
      osint:     'badge-purple',
      forense:   'badge-warning',
      outros:    'badge-dark',
    };
    return map[cat] || 'badge-dark';
  }

  /**
   * Retorna label e classe CSS da pílula de status.
   */
  function statusInfo(modulo) {
    if (modulo.manutencao) return { label: 'Manutenção', cls: 'manutencao' };
    if (modulo.em_breve)   return { label: 'Em Breve',   cls: 'em-breve'   };
    if (modulo.ativo)      return { label: 'Ativo',      cls: 'ativo'      };
    return { label: 'Inativo', cls: 'inativo' };
  }

  /**
   * Escapa HTML básico para prevenir XSS ao inserir strings no innerHTML.
   */
  function esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Chama window.renderLucide (definido em main.js / lucide CDN)
   * para converter os atributos data-lucide em SVGs.
   */
  function renderLucide() {
    if (typeof window.renderLucide === 'function') {
      window.renderLucide();
    } else if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  /* ============================================================
     1. Carregar módulos da API
     ============================================================ */
  async function carregarModulos(mostrarSpin) {
    if (mostrarSpin !== false) {
      el.tbody.innerHTML = `
        <tr class="table-loading">
          <td colspan="7">
            <div class="loading-inner">
              <span class="spinner"></span>
              <span>Carregando módulos…</span>
            </div>
          </td>
        </tr>`;
    }

    // Animação do botão recarregar
    if (el.iconRecarregar) el.iconRecarregar.classList.add('spin');

    try {
      const res = await window.api.get('/api/admin/modulos');
      if (res && res.success && Array.isArray(res.data)) {
        state.modulos = res.data;
      } else {
        state.modulos = [];
        window.toast.error('Resposta inesperada da API ao carregar módulos.');
      }
    } catch (err) {
      state.modulos = [];
      window.toast.error('Erro ao carregar módulos: ' + (err.message || 'falha de rede'));
    } finally {
      if (el.iconRecarregar) el.iconRecarregar.classList.remove('spin');
    }

    atualizarKPIs();
    aplicarFiltros();
  }

  /* ============================================================
     2. Atualizar KPIs
     ============================================================ */
  function atualizarKPIs() {
    const total     = state.modulos.length;
    const ativos    = state.modulos.filter(m => m.ativo && !m.manutencao).length;
    const manut     = state.modulos.filter(m => m.manutencao === true).length;
    const consultas = state.modulos.filter(m => m.categoria === 'consultas').length;

    el.kpiTotal.textContent      = total;
    el.kpiAtivos.textContent     = ativos;
    el.kpiManutencao.textContent = manut;
    el.kpiConsultas.textContent  = consultas;
  }

  /* ============================================================
     3. Aplicar filtros
     ============================================================ */
  function aplicarFiltros() {
    const texto = state.filtroTexto.toLowerCase().trim();
    const cat   = state.filtroCategoria;
    const status= state.filtroStatus;

    state.filtrado = state.modulos.filter(m => {
      // Filtro de categoria
      if (cat !== 'all' && m.categoria !== cat) return false;

      // Filtro de status
      if (status !== 'all') {
        if (status === 'ativo'     && !(m.ativo && !m.manutencao && !m.em_breve)) return false;
        if (status === 'manutencao'&& !m.manutencao) return false;
        if (status === 'em_breve'  && !m.em_breve)   return false;
        if (status === 'inativo'   && m.ativo)        return false;
      }

      // Filtro de texto
      if (texto) {
        const haystack = [
          m.nome,
          m.slug,
          m.rota,
          m.descricao,
          m.badge_texto,
          m.config?.subcategoria,
          m.config?.categoriaNome,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(texto)) return false;
      }

      return true;
    });

    renderTabela();
  }

  /* ============================================================
     4. Renderizar tabela
     ============================================================ */
  function renderTabela() {
    if (state.filtrado.length === 0) {
      el.tbody.innerHTML = `
        <tr class="table-empty">
          <td colspan="7">
            <div class="empty-inner">
              <i data-lucide="inbox"></i>
              <p>Nenhum módulo encontrado.</p>
            </div>
          </td>
        </tr>`;
      renderLucide();
      return;
    }

    const rows = state.filtrado.map(m => {
      const { label, cls } = statusInfo(m);
      const catBadge = badgeCategoria(m.categoria);
      const baseCat = { consultas: 'Consultas', osint: 'OSINT', forense: 'Forense', outros: 'Outros' }[m.categoria] || m.categoria;
      const catLabel = m.config?.categoriaNome ? `${baseCat} (${m.config.categoriaNome})` : baseCat;

      // Status pill clicável apenas para ativo/inativo
      const pillClickable = !m.manutencao && !m.em_breve;
      const pillTitle = pillClickable
        ? (m.ativo ? 'Clique para desativar' : 'Clique para ativar')
        : '';

      return `
        <tr>
          <td><span class="mod-ordem">#${esc(m.ordem)}</span></td>
          <td>
            <div class="mod-icon-box">
              <i data-lucide="${esc(m.icone)}" style="color:${esc(m.cor_icone)};"></i>
            </div>
          </td>
          <td>
            <div class="mod-name-cell">
              <span class="mod-title">${esc(m.nome)}</span>
              <span class="mod-slug">${esc(m.slug)}</span>
              ${m.descricao ? `<span class="mod-desc">${esc(m.descricao)}</span>` : ''}
            </div>
          </td>
          <td>
            <span class="badge ${catBadge}">${esc(catLabel)}</span>
          </td>
          <td>
            <div class="mod-rota-wrap">
              <span class="mod-rota-code" title="${esc(m.rota)}">${esc(m.rota)}</span>
              <button
                class="btn-copy"
                title="Copiar rota"
                onclick="window.copyToClipboard && window.copyToClipboard('${esc(m.rota)}')"
              >
                <i data-lucide="copy"></i>
              </button>
            </div>
          </td>
          <td>
            <button
              class="status-pill ${cls}"
              title="${esc(pillTitle)}"
              ${pillClickable ? `data-toggle-id="${esc(m.id)}" data-toggle-ativo="${m.ativo}"` : 'disabled'}
              style="${!pillClickable ? 'cursor:default;pointer-events:none;' : ''}"
            >${esc(label)}</button>
          </td>
          <td>
            <div class="table-actions">
              <button class="btn-edit"   title="Editar"  data-edit-id="${esc(m.id)}">
                <i data-lucide="pencil"></i>
              </button>
              <button class="btn-delete" title="Excluir" data-delete-id="${esc(m.id)}" data-delete-nome="${esc(m.nome)}">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </td>
        </tr>`;
    }).join('');

    el.tbody.innerHTML = rows;
    renderLucide();

    // Delegar eventos do tbody
    el.tbody.querySelectorAll('[data-toggle-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id   = btn.dataset.toggleId;
        const ativo= btn.dataset.toggleAtivo === 'true';
        toggleStatus(id, ativo);
      });
    });

    el.tbody.querySelectorAll('[data-edit-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.editId;
        const mod = state.modulos.find(m => m.id === id);
        if (mod) abrirModalEditar(mod);
      });
    });

    el.tbody.querySelectorAll('[data-delete-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        abrirConfirmDelete(btn.dataset.deleteId, btn.dataset.deleteNome);
      });
    });
  }

  /* ============================================================
     5. Abrir modal — Novo
     ============================================================ */
  function abrirModalNovo() {
    state.editandoId = null;
    el.modalTitle.textContent = 'Novo Módulo';
    el.formModulo.reset();

    // Resetar cor
    el.fieldCorIcone.value  = '#A78BFA';
    el.fieldCorColor.value  = '#A78BFA';

    // Resetar live preview
    atualizarLivePreview();

    abrirModal(el.modalModulo);
  }

  /* ============================================================
     6. Abrir modal — Editar
     ============================================================ */
  function abrirModalEditar(modulo) {
    state.editandoId = modulo.id;
    el.modalTitle.textContent = 'Editar Módulo';

    el.fieldSlug.value        = modulo.slug        || '';
    el.fieldNome.value        = modulo.nome         || '';
    el.fieldIcone.value       = modulo.icone        || '';
    el.fieldCorIcone.value    = modulo.cor_icone    || '#A78BFA';
    el.fieldCorColor.value    = modulo.cor_icone    || '#A78BFA';
    el.fieldRota.value        = modulo.rota         || '';
    el.fieldCategoria.value   = modulo.categoria    || '';
    el.fieldOrdem.value       = modulo.ordem != null ? modulo.ordem : '';
    el.fieldBadgeTexto.value  = modulo.badge_texto  || '';
    el.fieldBadgeCor.value    = modulo.badge_cor    || '';
    el.fieldDescricao.value   = modulo.descricao    || '';
    el.fieldAtivo.checked     = !!modulo.ativo;
    el.fieldEmBreve.checked   = !!modulo.em_breve;
    el.fieldManutencao.checked= !!modulo.manutencao;

    atualizarLivePreview();
    abrirModal(el.modalModulo);
  }

  /* ============================================================
     7. Fechar modal criar/editar
     ============================================================ */
  function fecharModal() {
    fecharModalEl(el.modalModulo);
  }

  /* ============================================================
     8. Salvar módulo (POST ou PUT)
     ============================================================ */
  async function salvarModulo() {
    // Validação básica dos campos obrigatórios
    const slug      = el.fieldSlug.value.trim();
    const nome      = el.fieldNome.value.trim();
    const icone     = el.fieldIcone.value.trim();
    const cor_icone = el.fieldCorIcone.value.trim();
    const rota      = el.fieldRota.value.trim();
    const categoria = el.fieldCategoria.value;

    if (!slug || !nome || !icone || !cor_icone || !rota || !categoria) {
      window.toast.error('Preencha todos os campos obrigatórios.');
      return;
    }

    const payload = {
      slug,
      nome,
      icone,
      cor_icone,
      rota,
      categoria,
      descricao:   el.fieldDescricao.value.trim()   || null,
      badge_texto: el.fieldBadgeTexto.value.trim()  || null,
      badge_cor:   el.fieldBadgeCor.value           || null,
      ordem:       el.fieldOrdem.value !== '' ? parseInt(el.fieldOrdem.value, 10) : 0,
      ativo:       el.fieldAtivo.checked,
      em_breve:    el.fieldEmBreve.checked,
      manutencao:  el.fieldManutencao.checked,
    };

    el.btnSalvar.disabled = true;
    el.btnSalvar.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span> Salvando…';

    try {
      let res;
      if (state.editandoId) {
        res = await window.api.put('/api/admin/modulos/' + state.editandoId, payload);
      } else {
        res = await window.api.post('/api/admin/modulos', payload);
      }

      if (res && res.success) {
        window.toast.success(res.message || 'Módulo salvo com sucesso!');
        fecharModal();
        await carregarModulos(false);
      } else {
        window.toast.error((res && res.message) || 'Erro ao salvar módulo.');
      }
    } catch (err) {
      window.toast.error('Erro ao salvar módulo: ' + (err.message || 'falha de rede'));
    } finally {
      el.btnSalvar.disabled = false;
      el.btnSalvar.innerHTML = '<i data-lucide="save"></i> Salvar Módulo';
      renderLucide();
    }
  }

  /* ============================================================
     9. Toggle de status rápido (ativo ↔ inativo)
     ============================================================ */
  async function toggleStatus(id, ativo) {
    try {
      const res = await window.api.put('/api/admin/modulos/' + id + '/status', { ativo: !ativo });
      if (res && res.success) {
        window.toast.success(res.message || 'Status atualizado.');
        await carregarModulos(false);
      } else {
        window.toast.error((res && res.message) || 'Erro ao alterar status.');
      }
    } catch (err) {
      window.toast.error('Erro ao alterar status: ' + (err.message || 'falha de rede'));
    }
  }

  /* ============================================================
     10. Abrir confirmação de exclusão
     ============================================================ */
  function abrirConfirmDelete(id, nome) {
    state.deletandoId = id;
    el.deleteNome.textContent = nome || 'este módulo';
    abrirModal(el.modalDelete);
  }

  /* ============================================================
     11. Confirmar exclusão
     ============================================================ */
  async function confirmarDelete() {
    if (!state.deletandoId) return;

    el.btnConfirmarDel.disabled = true;
    el.btnConfirmarDel.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span> Excluindo…';

    try {
      const res = await window.api.delete('/api/admin/modulos/' + state.deletandoId);
      if (res && res.success) {
        window.toast.success(res.message || 'Módulo excluído com sucesso.');
        fecharModalEl(el.modalDelete);
        state.deletandoId = null;
        await carregarModulos(false);
      } else {
        window.toast.error((res && res.message) || 'Erro ao excluir módulo.');
      }
    } catch (err) {
      window.toast.error('Erro ao excluir módulo: ' + (err.message || 'falha de rede'));
    } finally {
      el.btnConfirmarDel.disabled = false;
      el.btnConfirmarDel.innerHTML = '<i data-lucide="trash-2"></i> Excluir';
      renderLucide();
    }
  }

  /* ============================================================
     12. Atualizar live preview do modal
     ============================================================ */
  function atualizarLivePreview() {
    const icone = el.fieldIcone.value.trim() || 'box';
    const cor   = el.fieldCorIcone.value.trim() || '#A78BFA';
    const nome  = el.fieldNome.value.trim()  || 'Nome do módulo';
    const slug  = el.fieldSlug.value.trim()  || 'slug';

    // Atualiza o ícone do live preview recriando o elemento
    const previewIconContainer = el.livePreviewIcon || document.getElementById('livePreviewIcon');
    if (previewIconContainer) {
      previewIconContainer.innerHTML = `<i data-lucide="${esc(icone)}" style="color:${esc(cor)};"></i>`;
      renderLucide();
    }

    if (el.livePreviewName) el.livePreviewName.textContent = nome;
    if (el.livePreviewSlug) el.livePreviewSlug.textContent = slug;
  }

  /* ============================================================
     Utilitários de modal
     ============================================================ */
  function abrirModal(modalEl) {
    modalEl.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function fecharModalEl(modalEl) {
    modalEl.classList.remove('active');
    // Remove overflow hidden apenas se nenhum outro modal estiver aberto
    const abertos = document.querySelectorAll('.modal-backdrop.active');
    if (abertos.length === 0) {
      document.body.style.overflow = '';
    }
  }

  /* ============================================================
     13. Inicializar — event listeners e carga inicial
     ============================================================ */
  function inicializar() {
    // Botão Novo Módulo
    el.btnNovo.addEventListener('click', abrirModalNovo);

    // Botão Recarregar
    el.btnRecarregar.addEventListener('click', () => carregarModulos(true));

    // Filtro de busca (debounce leve)
    let debounceTimer;
    el.inputBusca.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        state.filtroTexto = el.inputBusca.value;
        aplicarFiltros();
      }, 220);
    });

    // Filtro por categoria
    el.filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        el.filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.filtroCategoria = btn.dataset.filter;
        aplicarFiltros();
      });
    });

    // Filtro de status
    el.selectStatus.addEventListener('change', () => {
      state.filtroStatus = el.selectStatus.value;
      aplicarFiltros();
    });

    // Fechar modal criar/editar
    el.btnFechar.addEventListener('click', fecharModal);
    el.btnCancelar.addEventListener('click', fecharModal);
    el.modalModulo.addEventListener('click', e => {
      if (e.target === el.modalModulo) fecharModal();
    });

    // Salvar módulo
    el.btnSalvar.addEventListener('click', salvarModulo);

    // Fechar modal de exclusão
    el.btnFecharDelete.addEventListener('click', () => fecharModalEl(el.modalDelete));
    el.btnCancelarDel.addEventListener('click',  () => fecharModalEl(el.modalDelete));
    el.modalDelete.addEventListener('click', e => {
      if (e.target === el.modalDelete) fecharModalEl(el.modalDelete);
    });

    // Confirmar exclusão
    el.btnConfirmarDel.addEventListener('click', confirmarDelete);

    // Escape fecha modais
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (el.modalDelete.classList.contains('active')) {
          fecharModalEl(el.modalDelete);
        } else if (el.modalModulo.classList.contains('active')) {
          fecharModal();
        }
      }
    });

    // Live preview — campos que influenciam o preview
    [el.fieldIcone, el.fieldNome, el.fieldSlug].forEach(campo => {
      campo.addEventListener('input', atualizarLivePreview);
    });

    el.fieldCorIcone.addEventListener('input', () => {
      // Sincroniza o color picker com o text input
      const val = el.fieldCorIcone.value.trim();
      if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
        el.fieldCorColor.value = val;
      }
      atualizarLivePreview();
    });

    el.fieldCorColor.addEventListener('input', () => {
      el.fieldCorIcone.value = el.fieldCorColor.value;
      atualizarLivePreview();
    });

    // Carga inicial
    carregarModulos(true);
  }

  /* ============================================================
     Bootstrap — aguarda DOM pronto
     ============================================================ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }

})();
