/**
 * ==============================================================================
 * RIMUBUSCA - DASHBOARD MODULES CLIENT (DASHBOARD.JS)
 * Busca módulos no Supabase via /api/modules e renderiza os cards dinamicamente
 * ==============================================================================
 */

(function () {
  "use strict";

  // Mapeamento dos containers da view
  const CONTAINERS = {
    consultas: document.getElementById("modules-consultas-grid"),
    osint: document.getElementById("modules-osint-grid"),
    forense: document.getElementById("modules-forense-grid"),
    dynamic: document.getElementById("modules-dynamic-container"),
  };

  const BADGES_COUNT = {
    consultas: document.getElementById("badge-count-consultas"),
    osint: document.getElementById("badge-count-osint"),
    forense: document.getElementById("badge-count-forense"),
    total: document.getElementById("kpi-total-modules"),
  };

  /**
   * Renderiza os esqueletos (skeletons) de carregamento nos grids
   */
  function renderSkeletons() {
    const skeletonPuxar = `
      <div class="puxar-card skeleton-loading" style="min-height: 110px; opacity: 0.6; pointer-events: none;">
        <div class="puxar-top" style="justify-content: space-between; align-items: center;">
          <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(255,255,255,0.06);"></div>
          <div style="width: 60px; height: 18px; border-radius: 4px; background: rgba(255,255,255,0.06);"></div>
        </div>
        <div style="width: 70%; height: 16px; margin-top: 12px; border-radius: 4px; background: rgba(255,255,255,0.08);"></div>
        <div style="width: 90%; height: 12px; margin-top: 8px; border-radius: 4px; background: rgba(255,255,255,0.04);"></div>
      </div>
    `;

    const skeletonModule = `
      <div class="module-card skeleton-loading" style="min-height: 170px; opacity: 0.6; pointer-events: none;">
        <div style="width: 46px; height: 46px; border-radius: 12px; background: rgba(255,255,255,0.06); margin-bottom: 12px;"></div>
        <div style="width: 60%; height: 18px; border-radius: 4px; background: rgba(255,255,255,0.08); margin-bottom: 8px;"></div>
        <div style="width: 90%; height: 12px; border-radius: 4px; background: rgba(255,255,255,0.04); margin-bottom: 6px;"></div>
        <div style="width: 80%; height: 12px; border-radius: 4px; background: rgba(255,255,255,0.04);"></div>
      </div>
    `;

    if (CONTAINERS.consultas) {
      CONTAINERS.consultas.innerHTML = skeletonPuxar.repeat(4);
    }
    if (CONTAINERS.osint) {
      CONTAINERS.osint.innerHTML = skeletonModule.repeat(4);
    }
    if (CONTAINERS.forense) {
      CONTAINERS.forense.innerHTML = skeletonModule.repeat(1);
    }
  }

  /**
   * Renderiza elemento de ícone Lucide ou imagem/thumbnail
   * @param {Object} mod
   * @param {number} size
   * @returns {string}
   */
  function renderIconOrImage(mod, size = 20) {
    if (mod.imagem_url) {
      return `<img src="${escapeHtml(mod.imagem_url)}" alt="${escapeHtml(mod.nome)}" style="width: ${size}px; height: ${size}px; object-fit: contain; border-radius: 4px;" loading="lazy" />`;
    }
    const iconName = mod.icone || "box";
    return `<i data-lucide="${escapeHtml(iconName)}" style="width: ${size}px; height: ${size}px;"></i>`;
  }

  /**
   * Sanitiza strings para exibição segura no DOM
   */
  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Cria o HTML de um card compacto de Consulta / Puxar Dados
   */
  function createPuxarCard(mod) {
    const isLocked = mod.em_breve || mod.manutencao;
    const href = isLocked ? "javascript:void(0)" : escapeHtml(mod.rota);
    const styleCursor = isLocked ? "cursor: not-allowed; opacity: 0.75;" : "";

    return `
      <a href="${href}" class="puxar-card" style="${styleCursor}" data-slug="${escapeHtml(mod.slug)}">
        <div class="puxar-top">
          <div class="puxar-icon" style="${mod.cor_icone ? `color: ${escapeHtml(mod.cor_icone)};` : ''}">
            ${renderIconOrImage(mod, 18)}
          </div>
          <span class="badge ${escapeHtml(mod.badge_cor || 'badge-purple')}">${escapeHtml(mod.badge_texto || 'Consulta')}</span>
        </div>
        <div class="puxar-title">
          <span>${escapeHtml(mod.nome)}</span>
          <i data-lucide="${isLocked ? 'lock' : 'arrow-right'}" style="width: 16px; height: 16px;"></i>
        </div>
        <p class="puxar-desc">${escapeHtml(mod.descricao || '')}</p>
        ${mod.em_breve ? '<span class="badge badge-dark" style="margin-top: 8px; width: fit-content;">Em breve</span>' : ''}
        ${mod.manutencao ? '<span class="badge badge-red" style="margin-top: 8px; width: fit-content;">Manutenção</span>' : ''}
      </a>
    `;
  }

  /**
   * Cria o HTML de um card robusto de Módulo OSINT / Forense
   */
  function createModuleCard(mod) {
    const isLocked = mod.em_breve || mod.manutencao;
    const href = isLocked ? "javascript:void(0)" : escapeHtml(mod.rota);
    const styleCursor = isLocked ? "cursor: not-allowed; opacity: 0.8;" : "";

    return `
      <a href="${href}" class="module-card" style="${styleCursor}" data-slug="${escapeHtml(mod.slug)}">
        <div class="module-icon-wrap" style="${mod.cor_icone ? `color: ${escapeHtml(mod.cor_icone)};` : ''}">
          ${renderIconOrImage(mod, 24)}
        </div>
        <h3 class="module-title">
          <span>${escapeHtml(mod.nome)}</span>
          <i data-lucide="${isLocked ? 'lock' : 'arrow-right'}" style="width: 18px; height: 18px;"></i>
        </h3>
        <p class="module-desc">${escapeHtml(mod.descricao || '')}</p>
        <div class="module-footer">
          ${mod.badge_texto ? `<span class="badge ${escapeHtml(mod.badge_cor || 'badge-purple')}">${escapeHtml(mod.badge_texto)}</span>` : ''}
          ${mod.em_breve ? '<span class="badge badge-dark">Em breve</span>' : ''}
          ${mod.manutencao ? '<span class="badge badge-red">Manutenção</span>' : ''}
        </div>
      </a>
    `;
  }

  /**
   * Exibe aviso de erro caso a chamada da API falhe
   */
  function renderErrorState(message) {
    const errorHtml = `
      <div style="grid-column: 1 / -1; padding: 24px; text-align: center; background: rgba(239,68,68,0.08); border: 1px dashed rgba(239,68,68,0.3); border-radius: 12px;">
        <i data-lucide="alert-triangle" style="width: 32px; height: 32px; color: var(--color-danger); margin-bottom: 8px;"></i>
        <p style="color: var(--color-text-muted); font-size: 0.95rem; margin-bottom: 12px;">${escapeHtml(message)}</p>
        <button type="button" class="btn btn-outline btn-sm" id="btn-retry-modules">
          <i data-lucide="refresh-cw" style="width: 14px; height: 14px;"></i>
          <span>Tentar novamente</span>
        </button>
      </div>
    `;

    if (CONTAINERS.osint) CONTAINERS.osint.innerHTML = errorHtml;
    if (CONTAINERS.consultas) CONTAINERS.consultas.innerHTML = "";
    if (CONTAINERS.forense) CONTAINERS.forense.innerHTML = "";

    const retryBtn = document.getElementById("btn-retry-modules");
    if (retryBtn) {
      retryBtn.addEventListener("click", loadDashboardModules);
    }

    if (window.lucide) window.lucide.createIcons();
  }

  /**
   * Função principal de carregamento e orquestração dos módulos
   */
  async function loadDashboardModules() {
    renderSkeletons();

    try {
      let result;

      // Utiliza o cliente de API global já configurado ou fetch nativo com timeout
      if (window.api && typeof window.api.get === "function") {
        result = await window.api.get("/api/modules");
      } else {
        const response = await fetch("/api/modules", {
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          throw new Error(`Erro ${response.status}: Falha ao buscar módulos`);
        }
        result = await response.json();
      }

      const modules = result.data || [];

      if (!Array.isArray(modules) || modules.length === 0) {
        if (CONTAINERS.osint) {
          CONTAINERS.osint.innerHTML = `
            <div style="grid-column: 1 / -1; padding: 32px; text-align: center; color: var(--color-text-muted);">
              Nenhum módulo ativo configurado no momento.
            </div>
          `;
        }
        if (CONTAINERS.consultas) CONTAINERS.consultas.innerHTML = "";
        if (CONTAINERS.forense) CONTAINERS.forense.innerHTML = "";
        return;
      }

      // Agrupa módulos por categoria
      const groups = {
        consultas: [],
        osint: [],
        forense: [],
        outros: [],
      };

      modules.forEach((mod) => {
        const cat = (mod.categoria || "osint").toLowerCase();
        if (cat === "consultas" || cat === "cadastral" || cat === "dados_pessoais") {
          groups.consultas.push(mod);
        } else if (cat === "forense" || cat === "arquivos") {
          groups.forense.push(mod);
        } else if (cat === "osint" || cat === "inteligencia") {
          groups.osint.push(mod);
        } else {
          groups.outros.push(mod);
        }
      });

      // Controla a visibilidade das seções com base na existência de módulos
      const sectionConsultas = document.getElementById("category-consultas");
      if (sectionConsultas) {
        sectionConsultas.style.display = groups.consultas.length > 0 ? "" : "none";
      }

      const sectionOsint = document.getElementById("category-osint");
      if (sectionOsint) {
        sectionOsint.style.display = (groups.osint.length + groups.outros.length) > 0 ? "" : "none";
      }

      const sectionForense = document.getElementById("category-forense");
      if (sectionForense) {
        sectionForense.style.display = groups.forense.length > 0 ? "" : "none";
      }

      // 1. Renderiza Categoria Consultas / Puxar
      if (CONTAINERS.consultas && groups.consultas.length > 0) {
        CONTAINERS.consultas.innerHTML = groups.consultas.map(createPuxarCard).join("");
      }

      // 2. Renderiza Categoria OSINT (e outros módulos não categorizados)
      if (CONTAINERS.osint && (groups.osint.length + groups.outros.length) > 0) {
        const osintModules = [...groups.osint, ...groups.outros];
        CONTAINERS.osint.innerHTML = osintModules.map(createModuleCard).join("");
      }

      // 3. Renderiza Categoria Forense
      if (CONTAINERS.forense && groups.forense.length > 0) {
        CONTAINERS.forense.innerHTML = groups.forense.map(createModuleCard).join("");
      }

      // Atualiza os contadores de badge dinamicamente
      if (BADGES_COUNT.consultas) {
        BADGES_COUNT.consultas.textContent = `${groups.consultas.length} Módulos`;
      }
      if (BADGES_COUNT.osint) {
        BADGES_COUNT.osint.textContent = `${groups.osint.length + groups.outros.length} Módulos`;
      }
      if (BADGES_COUNT.forense) {
        BADGES_COUNT.forense.textContent = `${groups.forense.length} Módulos`;
      }
      if (BADGES_COUNT.total) {
        BADGES_COUNT.total.textContent = modules.length;
      }

      // Atualiza o saldo do Hub Pay-per-Use no banner se presente
      const dashHubSaldo = document.getElementById("dashHubSaldo");
      if (dashHubSaldo) {
        try {
          fetch("/api/hubapi/status")
            .then((r) => r.json())
            .then((res) => {
              if (res.success && res.data) {
                dashHubSaldo.textContent = res.data.saldoFormatado;
              }
            })
            .catch(() => {});
        } catch (_) {}
      }

      // Converte tags <i> em ícones SVG do Lucide
      if (window.lucide && typeof window.lucide.createIcons === "function") {
        window.lucide.createIcons();
      }
    } catch (err) {
      console.error("[DASHBOARD MODULES ERROR]:", err);
      renderErrorState("Não foi possível carregar os módulos. Verifique sua conexão ou tente novamente.");
    }
  }

  /**
   * Atualiza as métricas dos KPIs restritas a Puxar Dados & Consultas Pessoais
   */
  async function loadDashboardStats() {
    const kpiHoje = document.getElementById("kpi-consultas-hoje");
    const kpiHistorico = document.getElementById("kpi-total-historico");
    const kpiModulos = document.getElementById("kpi-total-modules");
    const kpiDisponiveis = document.getElementById("kpi-requisicoes-hoje");
    const dashHubSaldo = document.getElementById("dashHubSaldo");
    const dashHubTeto = document.getElementById("dashHubTeto");

    try {
      const res = await fetch("/api/dashboard/stats");
      const json = await res.json();
      if (json.success && json.data) {
        const d = json.data;
        if (kpiHoje) kpiHoje.textContent = d.totalHoje;
        if (kpiHistorico) kpiHistorico.textContent = d.totalHistorico;
        if (kpiModulos && (!kpiModulos.textContent || kpiModulos.textContent === "...")) {
          kpiModulos.textContent = d.totalModulos;
        }
        if (kpiDisponiveis) kpiDisponiveis.textContent = d.consumoFormatado || `${d.totalHoje} / ${d.limiteDiario}`;
        if (dashHubSaldo && d.saldoFormatado) dashHubSaldo.textContent = d.saldoFormatado;
        if (dashHubTeto && d.tetoFormatado) dashHubTeto.textContent = d.tetoFormatado;
      }
    } catch (e) {
      // Ignora falhas secundárias
    }
  }

  // Inicializa quando o DOM estiver pronto
  function initDashboard() {
    loadDashboardModules();
    loadDashboardStats();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initDashboard);
  } else {
    initDashboard();
  }
})();
