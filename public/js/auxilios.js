/**
 * ==============================================================================
 * RIMUBUSCA - CONTROLADOR FRONTEND: BENEFÍCIOS & AUXÍLIOS SOCIAIS (CGU)
 * ==============================================================================
 */
(function () {
  "use strict";

  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatBrl(val) {
    const num = Number(val || 0);
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function digitsOnly(str) {
    return String(str || "").replace(/\D/g, "");
  }

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("formAuxilios");
    const cpfEl = document.getElementById("auxCpf");
    const nisEl = document.getElementById("auxNis");
    const paginaEl = document.getElementById("auxPagina");
    const varreduraEl = document.getElementById("auxVarreduraCompleta");

    const erroBox = document.getElementById("auxErroBox");
    const erroMsg = document.getElementById("auxErroMsg");
    const loadingBox = document.getElementById("auxLoadingBox");
    const resBox = document.getElementById("auxResultados");

    const modalAux = document.getElementById("modalRelatorioAuxilios");
    const modalAuxBody = document.getElementById("modalRelatorioAuxiliosBody");

    let ultimoResultado = null;
    let filtroProgramaAtivo = "TODOS";

    function mostrarErro(msg) {
      if (erroMsg) erroMsg.textContent = msg || "Falha ao consultar benefícios sociais.";
      if (erroBox) erroBox.style.display = "block";
      window.toast?.error(msg || "Falha na consulta.");
    }

    function limparErro() {
      if (erroBox) erroBox.style.display = "none";
    }

    function renderTabelaParcelas() {
      const wrap = document.getElementById("auxParcelasTableWrap");
      if (!wrap || !ultimoResultado) return;

      const todas = Array.isArray(ultimoResultado.todasParcelas) ? ultimoResultado.todasParcelas : [];
      const filtradas =
        filtroProgramaAtivo === "TODOS"
          ? todas
          : todas.filter((p) => p.programa === filtroProgramaAtivo);

      if (filtradas.length === 0) {
        wrap.innerHTML = `<div style="font-size:0.84rem;color:var(--color-text-muted);">Nenhuma parcela detalhada retornada para o filtro selecionado.</div>`;
        return;
      }

      wrap.innerHTML = `
        <table class="cguben-table">
          <thead>
            <tr>
              <th>Programa</th>
              <th>Competência</th>
              <th>Referência</th>
              <th>Data Saque</th>
              <th>Valor</th>
              <th>Situação</th>
              <th>Município / UF</th>
              <th>Observação</th>
            </tr>
          </thead>
          <tbody>
            ${filtradas
              .map(
                (p) => `
              <tr>
                <td><strong style="color:#38BDF8;">${escapeHtml(p.programa)}</strong></td>
                <td style="font-family:var(--font-mono);">${escapeHtml(p.competencia)}</td>
                <td style="font-family:var(--font-mono);">${escapeHtml(p.referencia)}</td>
                <td style="font-family:var(--font-mono);">${escapeHtml(p.dataSaque || "-")}</td>
                <td style="font-family:var(--font-mono);color:#34D399;"><strong>${escapeHtml(formatBrl(p.valor))}</strong></td>
                <td>${escapeHtml(p.situacao)}</td>
                <td>${escapeHtml(p.municipio)}</td>
                <td>${escapeHtml(p.detalhe || p.representanteLegal || "-")}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      `;
    }

    function renderResultado(data) {
      ultimoResultado = data;
      filtroProgramaAtivo = "TODOS";

      const consulta = data.consulta || {};
      const resumo = data.resumo || {};
      const perfil = data.perfilPessoa || {};
      const programas = Array.isArray(data.programas) ? data.programas : [];
      const todas = Array.isArray(data.todasParcelas) ? data.todasParcelas : [];

      const statusBadge = document.getElementById("auxStatusBadge");
      const srvAlertBadge = document.getElementById("auxSrvAlertBadge");
      const cacheBadge = document.getElementById("auxCacheBadge");
      const banner = document.getElementById("auxBanner");
      const tituloEl = document.getElementById("auxResTitulo");
      const subEl = document.getElementById("auxResSubtitulo");
      const kpiGrid = document.getElementById("auxKpiGrid");

      const encontrou = Boolean(resumo.recebeAuxilioOuHistorico);

      if (statusBadge) {
        statusBadge.textContent = encontrou
          ? `${resumo.totalProgramasIdentificados} PROGRAMA(S) IDENTIFICADO(S)`
          : "SEM BENEFÍCIOS LOCALIZADOS";
        statusBadge.style.background = encontrou ? "rgba(16, 185, 129, 0.16)" : "rgba(148, 163, 184, 0.16)";
        statusBadge.style.color = encontrou ? "#34D399" : "#CBD5E1";
      }
      if (banner) {
        banner.style.borderLeftColor = encontrou ? "#10B981" : "#64748B";
      }
      if (srvAlertBadge) {
        srvAlertBadge.style.display = resumo.vinculoServidorFederalAlerta ? "inline-flex" : "none";
      }
      if (cacheBadge) {
        cacheBadge.style.display = data.cacheHit ? "inline-flex" : "none";
      }

      if (tituloEl) {
        tituloEl.textContent =
          consulta.nome ||
          consulta.cpfFormatado ||
          (consulta.nis ? `NIS ${consulta.nis}` : "Beneficiário Consultando CGU");
      }
      if (subEl) {
        subEl.textContent = `CPF: ${consulta.cpfFormatado || "-"} • NIS: ${
          consulta.nis || "Não vinculado"
        } • Página ${consulta.pagina || 1}`;
      }

      if (kpiGrid) {
        const kpis = [
          {
            label: "Benefícios Identificados",
            value: String(resumo.totalProgramasIdentificados || 0),
            color: encontrou ? "#34D399" : "#94A3B8",
          },
          {
            label: "Parcelas na Página",
            value: String(resumo.totalParcelasPagina || 0),
            color: "#38BDF8",
          },
          {
            label: "Soma da Página",
            value: formatBrl(resumo.valorTotalParcelasPagina || 0),
            color: "#FBBF24",
          },
          {
            label: "NIS Resolvido (CGU)",
            value: consulta.nis || "Não informado",
            color: "#A78BFA",
          },
          {
            label: "Auxílio Reconstrução",
            value: resumo.auxilioReconstrucaoFlag ? "SIM (Sinalizado)" : "Não sinalizado",
            color: resumo.auxilioReconstrucaoFlag ? "#FBBF24" : "#94A3B8",
          },
        ];
        kpiGrid.innerHTML = kpis
          .map(
            (k) => `
          <div class="cguben-kv">
            <div class="cguben-kv-label">${escapeHtml(k.label)}</div>
            <div class="cguben-kv-val" style="color:${k.color};font-family:var(--font-mono);">${escapeHtml(k.value)}</div>
          </div>
        `
          )
          .join("");
      }

      // Pivôs OSINT
      const pivotWrap = document.getElementById("auxPivotWrap");
      const pivotBtns = document.getElementById("auxPivotBtns");
      const pivots = [];
      const cpfPivot = digitsOnly(consulta.cpf);
      if (cpfPivot.length === 11) {
        pivots.push(`
          <a href="/basic/servidores?cpf=${encodeURIComponent(cpfPivot)}&auto=1" class="btn btn-secondary btn-sm">
            <i data-lucide="landmark" style="width:13px;height:13px;"></i>
            Verificar Vínculo Servidor Federal
          </a>
        `);
        pivots.push(`
          <a href="/advanced/person?tipo=cpf&termo=${encodeURIComponent(cpfPivot)}&auto=1" class="btn btn-primary btn-sm">
            <i data-lucide="user-search" style="width:13px;height:13px;"></i>
            Puxar CPF Completo + Compliance
          </a>
        `);
      }
      if (Array.isArray(data.linksOficiais) && data.linksOficiais[0]?.url) {
        pivots.push(`
          <a href="${escapeHtml(data.linksOficiais[0].url)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm">
            <i data-lucide="external-link" style="width:13px;height:13px;"></i>
            Abrir no Portal da Transparência
          </a>
        `);
      }
      if (pivotWrap && pivotBtns) {
        if (pivots.length > 0) {
          pivotBtns.innerHTML = pivots.join("");
          pivotWrap.style.display = "flex";
        } else {
          pivotWrap.style.display = "none";
        }
      }

      // Flags /pessoa-fisica
      const flagsCard = document.getElementById("auxFlagsCard");
      const flagsBody = document.getElementById("auxFlagsBody");
      const nisBadge = document.getElementById("auxNisResolvidoBadge");
      if (flagsCard && flagsBody) {
        if (perfil.encontrado) {
          if (nisBadge) {
            nisBadge.textContent = consulta.nis ? `NIS: ${consulta.nis}` : "Sem NIS vinculado";
          }
          const flags = Array.isArray(perfil.flagsAtivas) ? perfil.flagsAtivas : [];
          flagsBody.innerHTML =
            flags.length > 0
              ? `<div style="display:flex;flex-wrap:wrap;gap:8px;">${flags
                  .map((f) => {
                    const color =
                      f.categoria === "sancao"
                        ? "#F87171"
                        : f.categoria === "beneficio"
                        ? "#10B981"
                        : f.categoria === "servidor"
                        ? "#38BDF8"
                        : "#A78BFA";
                    return `<span class="badge" style="background:rgba(255,255,255,0.04);border:1px solid ${color};color:${color};">${escapeHtml(f.label)}</span>`;
                  })
                  .join("")}</div>`
              : `<span style="font-size:0.84rem;color:var(--color-text-muted);">Pessoa localizada em /pessoa-fisica sem sinalizadores de benefícios ou sanções ativas.</span>`;
          flagsCard.style.display = "block";
        } else {
          flagsCard.style.display = "none";
        }
      }

      // Matriz de Programas
      const progGrid = document.getElementById("auxProgramasGrid");
      const matrizBadge = document.getElementById("auxMatrizBadge");
      if (matrizBadge) matrizBadge.textContent = `${programas.length} programas verificados`;
      if (progGrid) {
        progGrid.innerHTML = programas
          .map((p) => {
            const ativo = p.totalParcelas > 0 || p.flagAtivaPerfilCgu === true;
            const restrito = p.status === "chave_invalida_ou_restrita" || p.status === "rate_limit" || p.status === "indisponivel";
            const cor = ativo ? "#34D399" : restrito ? "#FBBF24" : "#64748B";
            const statusTexto =
              p.totalParcelas > 0
                ? `${p.totalParcelas} PARCELA(S)`
                : p.flagAtivaPerfilCgu === true
                ? "SINALIZADO NO PERFIL CGU"
                : p.status === "sem_parcelas"
                ? "SEM REGISTROS"
                : String(p.status || "-").toUpperCase();

            return `
              <div class="cguben-prog-card" style="border-left:3px solid ${cor};">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px;">
                  <strong style="font-size:0.85rem;color:var(--color-text);">${escapeHtml(p.nome)}</strong>
                  <span class="badge badge-dark" style="color:${cor};border-color:${cor};font-size:0.65rem;">${escapeHtml(statusTexto)}</span>
                </div>
                <div style="font-family:var(--font-mono);font-size:0.9rem;font-weight:700;color:${ativo ? "#34D399" : "var(--color-text-muted)"};">
                  ${escapeHtml(formatBrl(p.valorTotalPagina || 0))}
                </div>
                ${p.mensagem ? `<div style="font-size:0.72rem;color:#FBBF24;margin-top:4px;">${escapeHtml(p.mensagem)}</div>` : ""}
              </div>
            `;
          })
          .join("");
      }

      // Filtros de programa na tabela de parcelas
      const filtrosEl = document.getElementById("auxFiltroProgramas");
      if (filtrosEl) {
        const programasPresentes = Array.from(new Set(todas.map((t) => t.programa)));
        if (programasPresentes.length > 0) {
          const btns = ["TODOS", ...programasPresentes];
          filtrosEl.innerHTML = btns
            .map(
              (nome) => `
            <button type="button" class="cguben-filter-chip ${nome === "TODOS" ? "active" : ""}" data-filtro-prog="${escapeHtml(nome)}">
              ${escapeHtml(nome)}
            </button>
          `
            )
            .join("");

          filtrosEl.querySelectorAll("[data-filtro-prog]").forEach((btn) => {
            btn.addEventListener("click", () => {
              filtroProgramaAtivo = btn.getAttribute("data-filtro-prog") || "TODOS";
              filtrosEl.querySelectorAll("[data-filtro-prog]").forEach((b) => b.classList.remove("active"));
              btn.classList.add("active");
              renderTabelaParcelas();
            });
          });
        } else {
          filtrosEl.innerHTML = "";
        }
      }

      renderTabelaParcelas();

      if (resBox) resBox.style.display = "block";
      if (window.lucide) window.lucide.createIcons();
    }

    async function executarConsulta() {
      limparErro();
      const payload = {
        cpf: String(cpfEl?.value || "").trim(),
        nis: String(nisEl?.value || "").trim(),
        pagina: Number(paginaEl?.value || 1) || 1,
        varreduraCompleta: Boolean(varreduraEl?.checked),
      };

      if (loadingBox) loadingBox.style.display = "block";
      if (resBox) resBox.style.display = "none";

      try {
        const resp = await window.api.post("/api/auxilios/consultar", payload);
        if (!resp?.success || !resp?.data) {
          mostrarErro(resp?.error || "Falha ao consultar benefícios sociais.");
          return;
        }
        renderResultado(resp.data);
        window.toast?.success("Varredura social CGU concluída.");
      } catch (err) {
        mostrarErro(err?.message || "Erro na comunicação com o servidor.");
      } finally {
        if (loadingBox) loadingBox.style.display = "none";
      }
    }

    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      executarConsulta();
    });

    document.getElementById("btnLimparAux")?.addEventListener("click", () => {
      form?.reset();
      if (paginaEl) paginaEl.value = "1";
      if (varreduraEl) varreduraEl.checked = true;
      limparErro();
      if (resBox) resBox.style.display = "none";
      ultimoResultado = null;
    });

    document.getElementById("btnCopiarJsonAux")?.addEventListener("click", () => {
      if (!ultimoResultado) return;
      window.copyToClipboard?.(JSON.stringify(ultimoResultado, null, 2), "JSON copiado para a área de transferência!");
    });

    document.getElementById("btnGerarRelatorioAux")?.addEventListener("click", () => {
      if (!ultimoResultado || !window.OsintDarkReport?.renderBeneficiosSociaisReport) return;
      modalAuxBody.innerHTML = window.OsintDarkReport.renderBeneficiosSociaisReport({
        termo: ultimoResultado.consulta?.nome || ultimoResultado.consulta?.cpfFormatado || ultimoResultado.consulta?.nis || "",
        resultado: ultimoResultado,
      });
      modalAux.style.display = "flex";
    });

    document.getElementById("btnFecharModalAux")?.addEventListener("click", () => {
      if (modalAux) modalAux.style.display = "none";
    });

    modalAux?.addEventListener("click", (e) => {
      if (e.target === modalAux) modalAux.style.display = "none";
    });

    document.getElementById("btnHtmlAux")?.addEventListener("click", () => {
      if (!modalAuxBody?.innerHTML || !window.OsintDarkReport) return;
      window.OsintDarkReport.downloadHtml({
        innerHtml: modalAuxBody.innerHTML,
        titlePrefix: "dossie-beneficios-sociais",
        termo: ultimoResultado?.consulta?.cpf || ultimoResultado?.consulta?.nis || "cgu",
      });
    });

    document.getElementById("btnPdfAux")?.addEventListener("click", () => {
      if (!modalAuxBody?.innerHTML || !window.OsintDarkReport) return;
      window.OsintDarkReport.exportPdf({
        innerHtml: modalAuxBody.innerHTML,
        titleText: "Dossiê CGU • Benefícios & Auxílios Sociais",
      });
    });

    // Hidratação via querystring (?cpf=...&nis=...&auto=1)
    const qs = new URLSearchParams(window.location.search);
    if (qs.get("cpf") && cpfEl) cpfEl.value = qs.get("cpf");
    if (qs.get("nis") && nisEl) nisEl.value = qs.get("nis");
    if (qs.get("auto") === "1" && (qs.get("cpf") || qs.get("nis"))) {
      executarConsulta();
    }
  });
})();
