/**
 * ==============================================================================
 * RIMUBUSCA - CATÁLOGO DE APIS PAY-PER-USE / ASPECT HUB (HUBAPI.JS)
 * Gestão de orçamento mensal de R$ 30,00, cálculo de progresso em tempo real,
 * filtros, busca e execução dinâmica de consultas dos 46 módulos.
 * ==============================================================================
 */

(function () {
  "use strict";

  // Estado local sincronizado
  let carteiraLocal = {
    saldoAtual: 30.0,
    orcamentoMensal: 30.0,
    totalGasto: 0.0,
    totalConsultas: 0,
    percentualSaldo: 100,
    modulos: [],
    historico: [],
  };

  // Mapeamento de amostras válidas para teste em 1 clique
  const AMOSTRAS_TESTE = {
    cpf: "456.789.012-34",
    cnpj: "12.345.678/0001-90",
    nome: "Carlos Eduardo da Silva",
    telefone: "(11) 98765-4321",
    placa: "BRA2E19",
    chassi: "9BWZZZ377VT004251",
    termo: "Rafael Toniato Rodrigues",
    email: "carlos.silva@empresa.com.br",
    cep: "01310-100",
  };

  let moduloSelecionado = null;

  // Elementos do DOM
  const DOM = {
    // Carteira
    saldoDisplay: document.getElementById("carteiraSaldoDisplay"),
    orcamentoDisplay: document.getElementById("carteiraOrcamentoDisplay"),
    gastoDisplay: document.getElementById("carteiraGastoDisplay"),
    consultasDisplay: document.getElementById("carteiraConsultasDisplay"),
    progressFill: document.getElementById("carteiraProgressFill"),
    percentualLabel: document.getElementById("carteiraPercentualLabel"),

    // Busca & Filtros
    searchInput: document.getElementById("hubSearchInput"),
    btnLimparBusca: document.getElementById("btnLimparBusca"),
    tabBtns: document.querySelectorAll(".hub-tab-btn"),
    sections: document.querySelectorAll(".hub-category-section"),
    cards: document.querySelectorAll(".hub-card"),
    nenhumResultado: document.getElementById("hubNenhumResultado"),

    // Modal Consulta
    modalConsulta: document.getElementById("modalExecutarConsulta"),
    btnFecharModalConsulta: document.getElementById("btnFecharModalConsulta"),
    btnCancelarConsulta: document.getElementById("btnCancelarConsulta"),
    btnConfirmarConsulta: document.getElementById("btnConfirmarConsulta"),
    btnConfirmarTexto: document.getElementById("btnConfirmarTexto"),
    modalModIcon: document.getElementById("modalModIcon"),
    modalModNome: document.getElementById("modalModNome"),
    modalModCusto: document.getElementById("modalModCusto"),
    modalSaldoAtual: document.getElementById("modalSaldoAtual"),
    modalSaldoPrevisto: document.getElementById("modalSaldoPrevisto"),
    labelParametroNome: document.getElementById("labelParametroNome"),
    inputParametroValor: document.getElementById("inputParametroValor"),
    inputModuloId: document.getElementById("inputModalModuloId"),
    btnUsarExemploTeste: document.getElementById("btnUsarExemploTeste"),
    execucaoLoading: document.getElementById("hubExecucaoLoading"),
    hubLoadingText: document.getElementById("hubLoadingText"),
    execucaoErro: document.getElementById("hubExecucaoErro"),
    resultadoArea: document.getElementById("hubResultadoArea"),
    jsonResultadoPre: document.getElementById("jsonResultadoPre"),
    btnCopiarJson: document.getElementById("btnCopiarJsonResultado"),
    checkUsarCache: document.getElementById("checkUsarCache"),
    hubCacheBadge: document.getElementById("hubCacheBadge"),
    btnForcarRecarregarAoVivo: document.getElementById("btnForcarRecarregarAoVivo"),

    // Modal Recarga
    btnAbrirRecarga: document.getElementById("btnAbrirRecarga"),
    modalRecarga: document.getElementById("modalRecarga"),
    btnFecharModalRecarga: document.getElementById("btnFecharModalRecarga"),
    btnCancelarRecarga: document.getElementById("btnCancelarRecarga"),
    btnConfirmarRecarga: document.getElementById("btnConfirmarRecarga"),
    inputValorRecarga: document.getElementById("inputValorRecarga"),
    presetRecargaBtns: document.querySelectorAll(".btn-preset-recarga"),
    recargaSaldoAtualDisplay: document.getElementById("recargaSaldoAtualDisplay"),
    recargaSaldoFinalDisplay: document.getElementById("recargaSaldoFinalDisplay"),

    // Modal Extrato
    btnVerExtrato: document.getElementById("btnVerExtrato"),
    modalExtrato: document.getElementById("modalExtrato"),
    btnFecharModalExtrato: document.getElementById("btnFecharModalExtrato"),
    btnFecharExtratoFooter: document.getElementById("btnFecharExtratoFooter"),
    extratoListContainer: document.getElementById("extratoListContainer"),
  };

  /**
   * ==============================================================================
   * 1. SINCRONIZAÇÃO DE STATUS E CARTEIRA
   * ==============================================================================
   */

  async function sincronizarStatusCarteira() {
    try {
      const res = await fetch("/api/hubapi/status");
      const json = await res.json();
      if (json.success && json.data) {
        carteiraLocal = json.data;
        atualizarInterfaceCarteira(carteiraLocal);
      }
    } catch (err) {
      console.warn("[HUB API CLIENT] Falha ao sincronizar status da carteira:", err);
    }
  }

  function atualizarInterfaceCarteira(data) {
    if (!data) return;

    // Atualiza cabeçalho com dados e fallbacks seguros
    const saldoTxt = data.saldoFormatado || "R$ 20,00";
    const orcamentoTxt = data.orcamentoFormatado || "R$ 20,00";
    const gastoTxt = data.totalGastoFormatado || "R$ 0,00";
    const consultasVal = typeof data.totalConsultas === "number" ? data.totalConsultas : 0;

    if (DOM.saldoDisplay) DOM.saldoDisplay.textContent = saldoTxt;
    if (DOM.orcamentoDisplay) DOM.orcamentoDisplay.textContent = `${orcamentoTxt}/mês`;
    if (DOM.gastoDisplay) DOM.gastoDisplay.textContent = gastoTxt;
    if (DOM.consultasDisplay) DOM.consultasDisplay.textContent = consultasVal;

    const pct = typeof data.percentualSaldo === "number" ? data.percentualSaldo : 100;
    if (DOM.progressFill) DOM.progressFill.style.width = `${pct}%`;
    if (DOM.percentualLabel) DOM.percentualLabel.textContent = `${pct}% restante`;

    // Atualiza saldo no modal de recarga
    if (DOM.recargaSaldoAtualDisplay) DOM.recargaSaldoAtualDisplay.textContent = data.saldoFormatado;
    atualizarPreviewRecarga();

    // Atualiza cada um dos 46 cards com barra de progresso individual
    if (Array.isArray(data.modulos)) {
      data.modulos.forEach((m) => {
        const countEl = document.getElementById(`count-card-${m.id}`);
        const barEl = document.getElementById(`bar-card-${m.id}`);
        const btnConsultar = document.querySelector(`.hub-btn-consultar[data-modulo-id="${m.id}"]`);

        if (countEl) {
          countEl.textContent = `${m.consultasRestantes} consultas`;
        }

        if (barEl) {
          barEl.style.width = `${m.percentualSaldo}%`;
          barEl.classList.remove("low-balance", "mid-balance");
          if (m.percentualSaldo < 15) {
            barEl.classList.add("low-balance");
          } else if (m.percentualSaldo < 40) {
            barEl.classList.add("mid-balance");
          }
        }

        if (btnConsultar) {
          if (!m.disponivel) {
            btnConsultar.disabled = true;
            btnConsultar.innerHTML = `<i data-lucide="lock" style="width: 13px; height: 13px;"></i><span>Sem Saldo</span>`;
          } else {
            btnConsultar.disabled = false;
            btnConsultar.innerHTML = `<i data-lucide="play" style="width: 13px; height: 13px;"></i><span>Consultar</span>`;
          }
        }
      });

      if (window.lucide) window.lucide.createIcons();
    }
  }

  /**
   * ==============================================================================
   * 2. FILTRAGEM POR CATEGORIA E BUSCA EM TEMPO REAL
   * ==============================================================================
   */

  function setupFiltrosEBusca() {
    let categoriaAtiva = "todas";

    // Abas de categoria
    DOM.tabBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        DOM.tabBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        categoriaAtiva = btn.getAttribute("data-categoria") || "todas";
        aplicarFiltros(categoriaAtiva, DOM.searchInput ? DOM.searchInput.value : "");
      });
    });

    // Busca rápida
    if (DOM.searchInput) {
      DOM.searchInput.addEventListener("input", (e) => {
        const termo = e.target.value.trim().toLowerCase();
        if (DOM.btnLimparBusca) {
          DOM.btnLimparBusca.style.display = termo ? "inline-flex" : "none";
        }
        aplicarFiltros(categoriaAtiva, termo);
      });
    }

    // Limpar busca
    if (DOM.btnLimparBusca) {
      DOM.btnLimparBusca.addEventListener("click", () => {
        if (DOM.searchInput) {
          DOM.searchInput.value = "";
          DOM.searchInput.focus();
        }
        DOM.btnLimparBusca.style.display = "none";
        aplicarFiltros(categoriaAtiva, "");
      });
    }
  }

  function aplicarFiltros(categoria, termo) {
    let totalVisiveis = 0;

    DOM.sections.forEach((sec) => {
      const secCat = sec.getAttribute("data-cat");
      const deveExibirSecaoPorCategoria = categoria === "todas" || categoria === secCat;

      if (!deveExibirSecaoPorCategoria) {
        sec.style.display = "none";
        return;
      }

      let visiveisNaSecao = 0;
      const cardsNaSecao = sec.querySelectorAll(".hub-card");

      cardsNaSecao.forEach((card) => {
        const nome = card.getAttribute("data-nome") || "";
        const param = card.getAttribute("data-param") || "";
        const desc = card.getAttribute("data-desc") || "";

        const matchTermo =
          !termo ||
          nome.includes(termo) ||
          param.includes(termo) ||
          desc.includes(termo);

        if (matchTermo) {
          card.style.display = "flex";
          visiveisNaSecao++;
          totalVisiveis++;
        } else {
          card.style.display = "none";
        }
      });

      sec.style.display = visiveisNaSecao > 0 ? "block" : "none";
    });

    if (DOM.nenhumResultado) {
      DOM.nenhumResultado.style.display = totalVisiveis === 0 ? "block" : "none";
    }
  }

  /**
   * Converte o identificador interno do módulo para o tipo correspondente na Zeroy API
   */
  function converterModuloIdParaTipoZeroy(moduloId, pathAttr) {
    if (pathAttr) {
      const cleanPath = pathAttr.replace(/^\/+/, "").trim();
      if (cleanPath) return cleanPath;
    }

    const mapa = {
      "cpf-live": "cpf",
      "prev-inss": "inss",
      "titulo-eleitor": "titulo",
      "cartao-sus": "sus",
      "foto-face": "foto",
      "score-cadastral": "score",
      "renda-presumida": "renda",
      "debitos-multas": "multas",
      "proprietario-veiculo": "proprietario",
      "score-b1": "score",
      "score-b2": "score",
      "score-b3": "score",
      "score-b4": "score",
      "score-b5": "score",
      "score-b6": "score",
      "score-b7": "score",
      "tj-processos": "processos",
      "dje-diarios": "diarios",
    };
    return mapa[moduloId] || moduloId;
  }

  /**
   * ==============================================================================
   * 3. REDIRECIONAMENTO DE CONSULTA PARA A CENTRAL ZEROY API
   * ==============================================================================
   */

  function setupModalConsulta() {
    // Ao clicar em qualquer botão "Consultar" ou no card do módulo, direciona para a página da Zeroy API
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".hub-btn-consultar");
      const card = e.target.closest(".hub-card");

      const alvo = btn || card;
      if (!alvo) return;

      const moduloId = alvo.getAttribute("data-modulo-id") || alvo.getAttribute("data-id");
      if (!moduloId) return;

      e.preventDefault();
      window.location.href = `/zeroy?id=${encodeURIComponent(moduloId)}`;
    });

    // Fechar modal
    if (DOM.btnFecharModalConsulta) {
      DOM.btnFecharModalConsulta.addEventListener("click", fecharModalConsulta);
    }
    if (DOM.btnCancelarConsulta) {
      DOM.btnCancelarConsulta.addEventListener("click", fecharModalConsulta);
    }
    if (DOM.modalConsulta) {
      DOM.modalConsulta.addEventListener("click", (e) => {
        if (e.target === DOM.modalConsulta) fecharModalConsulta();
      });
    }

    // Botão de preencher amostra válida para teste em 1 clique
    if (DOM.btnUsarExemploTeste) {
      DOM.btnUsarExemploTeste.addEventListener("click", () => {
        if (!moduloSelecionado || !DOM.inputParametroValor) return;
        const param = moduloSelecionado.parametro || "cpf";
        const amostra = AMOSTRAS_TESTE[param] || moduloSelecionado.placeholder || "456.789.012-34";
        DOM.inputParametroValor.value = amostra;
        DOM.inputParametroValor.focus();
      });
    }

    // Submissão da consulta
    if (DOM.btnConfirmarConsulta) {
      DOM.btnConfirmarConsulta.addEventListener("click", () => executarConsultaSelecionada(false));
    }

    // Forçar recarga ao vivo (ignora cache)
    if (DOM.btnForcarRecarregarAoVivo) {
      DOM.btnForcarRecarregarAoVivo.addEventListener("click", () => executarConsultaSelecionada(true));
    }

    // Copiar JSON
    if (DOM.btnCopiarJson) {
      DOM.btnCopiarJson.addEventListener("click", () => {
        if (!DOM.jsonResultadoPre) return;
        const jsonText = DOM.jsonResultadoPre.textContent;
        navigator.clipboard.writeText(jsonText).then(() => {
          if (window.toast) window.toast.success("Payload JSON copiado para a área de transferência!");
        });
      });
    }
  }

  function abrirModalConsulta(mod) {
    if (!DOM.modalConsulta) return;

    if (DOM.inputModuloId) DOM.inputModuloId.value = mod.id;
    if (DOM.modalModNome) DOM.modalModNome.textContent = mod.nome;
    if (DOM.modalModCusto) DOM.modalModCusto.textContent = mod.custoFormatado;
    if (DOM.modalSaldoAtual) DOM.modalSaldoAtual.textContent = carteiraLocal.saldoFormatado || "R$ 30,00";

    const saldoApos = Math.max(0, carteiraLocal.saldoAtual - mod.custo);
    if (DOM.modalSaldoPrevisto) {
      DOM.modalSaldoPrevisto.textContent = `R$ ${saldoApos.toFixed(2).replace(".", ",")}`;
    }

    if (DOM.labelParametroNome) DOM.labelParametroNome.textContent = mod.parametroLabel;
    if (DOM.inputParametroValor) {
      DOM.inputParametroValor.value = "";
      DOM.inputParametroValor.placeholder = mod.placeholder || `Informe ${mod.parametroLabel}`;
    }

    if (DOM.btnConfirmarTexto) {
      DOM.btnConfirmarTexto.textContent = `Confirmar e Consultar (${mod.custoFormatado})`;
    }

    // Reseta áreas de feedback
    if (DOM.execucaoLoading) DOM.execucaoLoading.style.display = "none";
    if (DOM.execucaoErro) DOM.execucaoErro.style.display = "none";
    if (DOM.resultadoArea) DOM.resultadoArea.style.display = "none";
    if (DOM.jsonResultadoPre) DOM.jsonResultadoPre.textContent = "";

    DOM.modalConsulta.classList.add("active");
    setTimeout(() => {
      if (DOM.inputParametroValor) DOM.inputParametroValor.focus();
    }, 100);
  }

  function fecharModalConsulta() {
    if (DOM.modalConsulta) {
      DOM.modalConsulta.classList.remove("active");
    }
  }

  function deveExibirRawJson() {
    if (window.rimuSettings && typeof window.rimuSettings.get === "function") {
      return Boolean(window.rimuSettings.get("showRawJson", false));
    }
    try {
      const raw = localStorage.getItem("rimubuscas_settings");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.showRawJson === "boolean") return parsed.showRawJson;
      }
      const legacy = localStorage.getItem("rimu_pref_show_raw_json");
      if (legacy !== null) return legacy === "true";
    } catch {}
    return false;
  }

  async function executarConsultaSelecionada(forceRefresh = false) {
    if (!moduloSelecionado) return;

    const valor = DOM.inputParametroValor ? DOM.inputParametroValor.value.trim() : "";
    if (!valor) {
      if (DOM.execucaoErro) {
        DOM.execucaoErro.textContent = `Por favor, informe ${moduloSelecionado.parametroLabel}.`;
        DOM.execucaoErro.style.display = "block";
      }
      return;
    }

    const usarCache = DOM.checkUsarCache ? DOM.checkUsarCache.checked : true;
    const finalForceRefresh = Boolean(forceRefresh || !usarCache);

    // Feedback visual de carregamento com timeout estendido de 50s
    if (DOM.execucaoErro) DOM.execucaoErro.style.display = "none";
    if (DOM.resultadoArea) DOM.resultadoArea.style.display = "none";
    if (DOM.hubCacheBadge) DOM.hubCacheBadge.style.display = "none";
    if (DOM.btnForcarRecarregarAoVivo) DOM.btnForcarRecarregarAoVivo.style.display = "none";
    if (DOM.execucaoLoading) DOM.execucaoLoading.style.display = "block";
    if (DOM.hubLoadingText) {
      DOM.hubLoadingText.textContent = finalForceRefresh
        ? "Conectando ao vivo com a Zeroy API (sem cache)..."
        : "Verificando cache inteligente e consultando bases externas...";
    }
    if (DOM.btnConfirmarConsulta) DOM.btnConfirmarConsulta.disabled = true;

    const abortController = new AbortController();
    const abortTimeout = setTimeout(() => abortController.abort(), 50000); // 50 segundos

    try {
      const resp = await fetch("/api/hubapi/consultar", {
        method: "POST",
        signal: abortController.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduloId: moduloSelecionado.id,
          parametroValor: valor,
          forceRefresh: finalForceRefresh,
        }),
      });

      clearTimeout(abortTimeout);
      const res = await resp.json();

      if (!resp.ok || !res.success) {
        throw new Error(res.error || "Erro ao executar consulta no módulo Pay-per-Use.");
      }

      // SUCESSO: Exibe o JSON e atualiza os saldos e barras de progresso
      if (DOM.resultadoArea && DOM.jsonResultadoPre) {
        DOM.jsonResultadoPre.textContent = JSON.stringify(res.data, null, 2);
        DOM.resultadoArea.style.display = "block";

        const mostrarJson = deveExibirRawJson();
        DOM.jsonResultadoPre.style.display = mostrarJson ? "block" : "none";

        let noticeEl = document.getElementById("hubJsonOcultoNotice");
        if (!mostrarJson) {
          if (!noticeEl) {
            noticeEl = document.createElement("div");
            noticeEl.id = "hubJsonOcultoNotice";
            noticeEl.style.cssText = "background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 14px; margin-top: 10px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;";
            DOM.jsonResultadoPre.parentNode.insertBefore(noticeEl, DOM.jsonResultadoPre);
          }
          noticeEl.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; color: var(--color-text-dim); font-size: 0.82rem;">
              <i data-lucide="eye-off" style="width: 16px; height: 16px; color: #94A3B8;"></i>
              <span>O payload JSON bruto está oculto conforme suas <strong>Configurações</strong>.</span>
            </div>
            <button type="button" class="btn btn-outline btn-sm" id="btnToggleHubJsonManual" style="font-size: 0.75rem; padding: 3px 10px;">
              <i data-lucide="code" style="width: 12px; height: 12px;"></i>
              <span>Ver JSON nesta consulta</span>
            </button>
          `;
          noticeEl.style.display = "flex";
          document.getElementById("btnToggleHubJsonManual")?.addEventListener("click", () => {
            DOM.jsonResultadoPre.style.display = "block";
            noticeEl.style.display = "none";
          });
          if (window.renderLucide) window.renderLucide();
        } else if (noticeEl) {
          noticeEl.style.display = "none";
        }
      }

      if (res.data.cached) {
        if (DOM.hubCacheBadge) {
          DOM.hubCacheBadge.textContent = `⚡ Cache Instantâneo (${res.data.cacheSource || 'Vercel Cache'}) • Economizou ${moduloSelecionado.custoFormatado}`;
          DOM.hubCacheBadge.style.display = "inline-flex";
        }
        if (DOM.btnForcarRecarregarAoVivo) {
          DOM.btnForcarRecarregarAoVivo.style.display = "inline-flex";
        }
        if (window.toast) {
          window.toast.success(
            `Resposta instantânea via Cache! Saldo poupado: R$ 0,00 debitado.`
          );
        }
      } else {
        if (window.toast) {
          window.toast.success(
            `Consulta realizada com sucesso! Custo debitado: ${res.data.modulo.custoFormatado}`
          );
        }
      }

      // Atualiza o saldo local e na barra do dashboard se existir
      await sincronizarStatusCarteira();

      const dashHubSaldo = document.getElementById("dashHubSaldo");
      if (dashHubSaldo && carteiraLocal.saldoFormatado) {
        dashHubSaldo.textContent = carteiraLocal.saldoFormatado;
      }
    } catch (err) {
      clearTimeout(abortTimeout);
      const isTimeout = err.name === "AbortError" || err.message?.includes("Timeout");
      const errorMsg = isTimeout
        ? "Tempo limite de resposta excedido (50s). A base externa pode estar instável. O saldo NÃO foi debitado."
        : (err.message || "Falha na comunicação com o servidor.");

      if (DOM.execucaoErro) {
        DOM.execucaoErro.textContent = errorMsg;
        DOM.execucaoErro.style.display = "block";
      }
      if (window.toast) window.toast.error(errorMsg);
    } finally {
      if (DOM.execucaoLoading) DOM.execucaoLoading.style.display = "none";
      if (DOM.btnConfirmarConsulta) DOM.btnConfirmarConsulta.disabled = false;
    }
  }

  /**
   * ==============================================================================
   * 4. MODAL DE RECARGA E AJUSTE DE LIMITE
   * ==============================================================================
   */

  function setupModalRecarga() {
    if (DOM.btnAbrirRecarga) {
      DOM.btnAbrirRecarga.addEventListener("click", () => {
        if (DOM.modalRecarga) DOM.modalRecarga.classList.add("active");
        if (DOM.recargaSaldoAtualDisplay) {
          DOM.recargaSaldoAtualDisplay.textContent = carteiraLocal.saldoFormatado || "R$ 30,00";
        }
        atualizarPreviewRecarga();
      });
    }

    if (DOM.btnFecharModalRecarga) {
      DOM.btnFecharModalRecarga.addEventListener("click", fecharModalRecarga);
    }
    if (DOM.btnCancelarRecarga) {
      DOM.btnCancelarRecarga.addEventListener("click", fecharModalRecarga);
    }
    if (DOM.modalRecarga) {
      DOM.modalRecarga.addEventListener("click", (e) => {
        if (e.target === DOM.modalRecarga) fecharModalRecarga();
      });
    }

    // Botões de valor predefinido (+10, +30, +50)
    DOM.presetRecargaBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        DOM.presetRecargaBtns.forEach((b) => {
          b.classList.remove("active");
          b.style.borderColor = "";
          b.style.background = "";
        });
        btn.classList.add("active");
        btn.style.borderColor = "#F59E0B";
        btn.style.background = "rgba(245, 158, 11, 0.1)";

        const val = btn.getAttribute("data-valor");
        if (DOM.inputValorRecarga) {
          DOM.inputValorRecarga.value = val;
          atualizarPreviewRecarga();
        }
      });
    });

    if (DOM.inputValorRecarga) {
      DOM.inputValorRecarga.addEventListener("input", atualizarPreviewRecarga);
    }

    // Confirmar recarga
    if (DOM.btnConfirmarRecarga) {
      DOM.btnConfirmarRecarga.addEventListener("click", executarRecarga);
    }
  }

  function fecharModalRecarga() {
    if (DOM.modalRecarga) DOM.modalRecarga.classList.remove("active");
  }

  function atualizarPreviewRecarga() {
    const v = Number(DOM.inputValorRecarga ? DOM.inputValorRecarga.value : 0) || 0;
    const finalVal = carteiraLocal.saldoAtual + v;
    if (DOM.recargaSaldoFinalDisplay) {
      DOM.recargaSaldoFinalDisplay.textContent = `R$ ${finalVal.toFixed(2).replace(".", ",")}`;
    }
  }

  async function executarRecarga() {
    const valor = Number(DOM.inputValorRecarga ? DOM.inputValorRecarga.value : 0);
    if (!valor || valor <= 0) {
      if (window.toast) window.toast.error("Informe um valor de recarga válido maior que R$ 0,00.");
      return;
    }

    if (DOM.btnConfirmarRecarga) DOM.btnConfirmarRecarga.disabled = true;

    try {
      const resp = await fetch("/api/hubapi/recarregar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valor }),
      });

      const res = await resp.json();
      if (!resp.ok || !res.success) {
        throw new Error(res.error || "Falha ao processar recarga.");
      }

      if (window.toast) window.toast.success(res.message || "Recarga realizada com sucesso!");
      fecharModalRecarga();
      await sincronizarStatusCarteira();

      const dashHubSaldo = document.getElementById("dashHubSaldo");
      if (dashHubSaldo && carteiraLocal.saldoFormatado) {
        dashHubSaldo.textContent = carteiraLocal.saldoFormatado;
      }
    } catch (err) {
      if (window.toast) window.toast.error(err.message);
    } finally {
      if (DOM.btnConfirmarRecarga) DOM.btnConfirmarRecarga.disabled = false;
    }
  }

  /**
   * ==============================================================================
   * 5. MODAL DE EXTRATO / HISTÓRICO DE TRANSAÇÕES
   * ==============================================================================
   */

  function setupModalExtrato() {
    if (DOM.btnVerExtrato) {
      DOM.btnVerExtrato.addEventListener("click", () => {
        renderizarExtrato();
        if (DOM.modalExtrato) DOM.modalExtrato.classList.add("active");
      });
    }

    if (DOM.btnFecharModalExtrato) {
      DOM.btnFecharModalExtrato.addEventListener("click", fecharModalExtrato);
    }
    if (DOM.btnFecharExtratoFooter) {
      DOM.btnFecharExtratoFooter.addEventListener("click", fecharModalExtrato);
    }
    if (DOM.modalExtrato) {
      DOM.modalExtrato.addEventListener("click", (e) => {
        if (e.target === DOM.modalExtrato) fecharModalExtrato();
      });
    }
  }

  function fecharModalExtrato() {
    if (DOM.modalExtrato) DOM.modalExtrato.classList.remove("active");
  }

  function renderizarExtrato() {
    if (!DOM.extratoListContainer) return;

    const hist = carteiraLocal.historico || [];
    if (hist.length === 0) {
      DOM.extratoListContainer.innerHTML = `
        <div style="text-align: center; padding: 32px; color: var(--color-text-dim);">
          <i data-lucide="receipt" style="width: 32px; height: 32px; margin-bottom: 8px;"></i>
          <p>Nenhuma transação ou consulta registrada até o momento.</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    const html = hist
      .map((item) => {
        const isRecarga = item.tipo === "RECARGA";
        const corValor = isRecarga ? "#10B981" : "#EF4444";
        const sinal = isRecarga ? "+" : "-";
        const desc = isRecarga
          ? item.descricao
          : `Consulta: ${item.moduloNome || item.moduloId} (${item.parametro || ""})`;
        const hora = item.timestamp ? new Date(item.timestamp).toLocaleString("pt-BR") : "Recentemente";
        const operador = item.userNome || (isRecarga ? "Administrador" : "Operador");

        return `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; background: var(--color-surface-2); border-radius: var(--radius-md); margin-bottom: 8px; border: 1px solid var(--color-border);">
            <div>
              <div style="font-size: 0.85rem; font-weight: 600; color: var(--color-text); margin-bottom: 2px;">
                ${desc}
              </div>
              <div style="font-size: 0.725rem; color: var(--color-text-dim);">
                ${hora} • Operador: <strong style="color: var(--color-primary);">${operador}</strong> • Saldo após: R$ ${item.saldoApos ? item.saldoApos.toFixed(2).replace(".", ",") : "0,00"}
              </div>
            </div>
            <div style="font-family: var(--font-mono); font-weight: 700; font-size: 0.95rem; color: ${corValor}; white-space: nowrap;">
              ${sinal} R$ ${(item.valor || item.custo || 0).toFixed(2).replace(".", ",")}
            </div>
          </div>
        `;
      })
      .join("");

    DOM.extratoListContainer.innerHTML = html;
  }

  /**
   * ==============================================================================
   * INICIALIZAÇÃO
   * ==============================================================================
   */

  function inicializar() {
    setupFiltrosEBusca();
    setupModalConsulta();
    setupModalRecarga();
    setupModalExtrato();

    // Sincroniza estado inicial com a API
    sincronizarStatusCarteira();

    // Fechar modais ao teclar ESC
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        fecharModalConsulta();
        fecharModalRecarga();
        fecharModalExtrato();
      }
    });

    if (window.lucide) window.lucide.createIcons();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inicializar);
  } else {
    inicializar();
  }
})();

