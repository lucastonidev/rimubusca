/**
 * ==============================================================================
 * RIMUBUSCA - CONTROLADOR FRONTEND: INVESTIGAÇÃO BITCOIN (BTC OSINT)
 * Renderização dinâmica em Vanilla JavaScript:
 *  - Dados On-Chain (Blockchain API)
 *  - Menções Surface Web (Google Search / SERP)
 *  - Menções Dark Web (.onion Ahmia)
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

  function formatBtc(val) {
    const num = Number(val || 0);
    return num.toLocaleString("pt-BR", { minimumFractionDigits: 8, maximumFractionDigits: 8 }) + " BTC";
  }

  function formatBrl(val) {
    const num = Number(val || 0);
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function formatUsd(val) {
    const num = Number(val || 0);
    return num.toLocaleString("en-US", { style: "currency", currency: "USD" });
  }

  function formatDataIso(isoStr) {
    if (!isoStr) return "-";
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return isoStr;
    }
  }

  function encurtarHash(hash, chars = 10) {
    if (!hash || hash.length <= chars * 2) return hash || "-";
    return `${hash.slice(0, chars)}...${hash.slice(-chars)}`;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("formBitcoin");
    const addressInput = document.getElementById("btcAddressInput");
    const btnSubmit = document.getElementById("btnInvestigarBtc");
    const btnLimpar = document.getElementById("btnLimparBtc");

    const erroBox = document.getElementById("btcAvisoErro");
    const erroMsg = document.getElementById("btcErroMsg");
    const loadingBox = document.getElementById("btcLoadingBox");
    const resContainer = document.getElementById("btcResultadosContainer");
    const alertaAbusoCard = document.getElementById("btcAlertaAbusoCard");

    // KPIs & Cabeçalho
    const badgeFormato = document.getElementById("btcBadgeFormato");
    const badgeStatus = document.getElementById("btcBadgeStatus");
    const badgeCache = document.getElementById("btcBadgeCache");
    const tempoExecEl = document.getElementById("btcTempoExec");
    const addressHeader = document.getElementById("btcAddressHeader");
    const cotacaoUsdEl = document.getElementById("btcCotacaoUsd");
    const cotacaoBrlEl = document.getElementById("btcCotacaoBrl");

    const kpiSaldoBtc = document.getElementById("kpiSaldoBtc");
    const kpiSaldoFiat = document.getElementById("kpiSaldoFiat");
    const kpiRecebidoBtc = document.getElementById("kpiRecebidoBtc");
    const kpiRecebidoFiat = document.getElementById("kpiRecebidoFiat");
    const kpiEnviadoBtc = document.getElementById("kpiEnviadoBtc");
    const kpiTotalTx = document.getElementById("kpiTotalTx");
    const kpiSurfaceWeb = document.getElementById("kpiSurfaceWeb");
    const kpiDarkWeb = document.getElementById("kpiDarkWeb");

    // Coluna On-Chain
    const onchainProvedor = document.getElementById("btcOnchainProvedor");
    const listaTransacoes = document.getElementById("btcListaTransacoes");
    const lnkMempool = document.getElementById("lnkExplorerMempool");
    const lnkBlockchain = document.getElementById("lnkExplorerBlockchain");
    const lnkBlockstream = document.getElementById("lnkExplorerBlockstream");

    // Coluna Surface / Dark Web
    const countTabSurface = document.getElementById("countTabSurface");
    const countTabDark = document.getElementById("countTabDark");
    const surfaceLista = document.getElementById("btcSurfaceLista");
    const darkLista = document.getElementById("btcDarkLista");
    const lnkAhmiaDirect = document.getElementById("lnkAhmiaDirect");
    const pivotsList = document.getElementById("btcPivotsList");

    // Abas
    const tabBtns = document.querySelectorAll(".btc-tab-btn");
    const tabSurface = document.getElementById("tabContentSurface");
    const tabDark = document.getElementById("tabContentDark");
    const tabPivots = document.getElementById("tabContentPivots");

    // Modal Relatório
    const modal = document.getElementById("modalRelatorioBtc");
    const modalBody = document.getElementById("modalRelatorioBtcBody");
    const btnGerarRelatorio = document.getElementById("btnGerarRelatorioBtc");
    const btnFecharModal = document.getElementById("btnFecharModalBtc");

    let ultimoResultado = null;

    function mostrarErro(msg) {
      if (erroMsg) erroMsg.textContent = msg || "Falha ao investigar carteira Bitcoin.";
      if (erroBox) erroBox.style.display = "block";
      if (window.toast) window.toast.error(msg || "Falha na consulta.");
      if (window.lucide) window.lucide.createIcons();
    }

    function limparErro() {
      if (erroBox) erroBox.style.display = "none";
    }

    // Gestão de abas
    tabBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        tabBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const tab = btn.getAttribute("data-tab");

        if (tabSurface) tabSurface.style.display = tab === "surface" ? "block" : "none";
        if (tabDark) tabDark.style.display = tab === "dark" ? "block" : "none";
        if (tabPivots) tabPivots.style.display = tab === "pivots" ? "block" : "none";
      });
    });

    // Exemplos rápidos
    document.querySelectorAll("[data-example]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const ex = btn.getAttribute("data-example");
        if (ex && addressInput) {
          addressInput.value = ex;
          executarInvestigacao(ex);
        }
      });
    });

    btnLimpar?.addEventListener("click", () => {
      form?.reset();
      limparErro();
      if (resContainer) resContainer.style.display = "none";
      ultimoResultado = null;
    });

    function renderResultado(data) {
      ultimoResultado = data;
      const consulta = data.consulta || {};
      const resumo = data.resumo || {};
      const onChain = data.onChain || {};
      const surfaceWeb = data.surfaceWeb || {};
      const darkWeb = data.darkWeb || {};

      // Alerta de abuso
      if (alertaAbusoCard) {
        alertaAbusoCard.style.display = resumo.alertaAbuso ? "block" : "none";
      }

      // Cabeçalho
      if (addressHeader) addressHeader.textContent = consulta.address || "-";
      if (badgeFormato) badgeFormato.textContent = consulta.formato || "Bitcoin";
      if (badgeStatus) {
        badgeStatus.textContent = resumo.statusCarteira || "Identificada";
        if (resumo.statusCarteira?.includes("Gênese")) {
          badgeStatus.className = "badge badge-warning";
        } else if (resumo.saldoBtc > 0) {
          badgeStatus.className = "badge badge-success";
        } else {
          badgeStatus.className = "badge badge-dark";
        }
      }
      if (badgeCache) {
        badgeCache.style.display = data.cacheHit ? "inline-flex" : "none";
      }
      if (tempoExecEl) {
        tempoExecEl.textContent = `${data.tempoExecucaoMs || 0}ms`;
      }

      // Cotações
      const cotacao = onChain.cotacaoBtc || {};
      if (cotacaoUsdEl) cotacaoUsdEl.textContent = formatUsd(cotacao.usd || 0);
      if (cotacaoBrlEl) cotacaoBrlEl.textContent = formatBrl(cotacao.brl || 0);

      // KPIs
      if (kpiSaldoBtc) kpiSaldoBtc.textContent = formatBtc(resumo.saldoBtc || 0);
      if (kpiSaldoFiat) {
        kpiSaldoFiat.textContent = `${formatBrl(resumo.saldoBrl || 0)} • ${formatUsd(resumo.saldoUsd || 0)}`;
      }
      if (kpiRecebidoBtc) kpiRecebidoBtc.textContent = formatBtc(resumo.totalRecebidoBtc || 0);
      if (kpiRecebidoFiat) {
        const recBrl = (resumo.totalRecebidoBtc || 0) * (cotacao.brl || 0);
        kpiRecebidoFiat.textContent = `Aprox. ${formatBrl(recBrl)}`;
      }
      if (kpiEnviadoBtc) kpiEnviadoBtc.textContent = formatBtc(resumo.totalEnviadoBtc || 0);
      if (kpiTotalTx) kpiTotalTx.textContent = String(resumo.totalTransacoes || 0);
      if (kpiSurfaceWeb) kpiSurfaceWeb.textContent = String(resumo.mencoesSurfaceWeb || 0);
      if (kpiDarkWeb) kpiDarkWeb.textContent = String(resumo.mencoesDarkWeb || 0);

      // Provedor On-chain
      if (onchainProvedor) {
        onchainProvedor.textContent = onChain.provedor || "Blockchain API";
      }

      // Links de Exploradores
      const addrEncoded = encodeURIComponent(consulta.address || "");
      if (lnkMempool) lnkMempool.href = `https://mempool.space/address/${addrEncoded}`;
      if (lnkBlockchain) lnkBlockchain.href = `https://www.blockchain.com/explorer/addresses/btc/${addrEncoded}`;
      if (lnkBlockstream) lnkBlockstream.href = `https://blockstream.info/address/${addrEncoded}`;

      // 1. Tabela de Transações On-Chain
      const txs = Array.isArray(onChain.ultimasTransacoes) ? onChain.ultimasTransacoes : [];
      if (listaTransacoes) {
        if (txs.length === 0) {
          listaTransacoes.innerHTML = `
            <div style="padding: 24px; text-align: center; color: var(--color-text-muted); font-size: 0.85rem;">
              <i data-lucide="info" style="width: 24px; height: 24px; color: var(--color-text-dim); margin: 0 auto 8px; display: block;"></i>
              Nenhuma transação confirmada registrada nesta carteira.
            </div>
          `;
        } else {
          listaTransacoes.innerHTML = `
            <table class="btc-table">
              <thead>
                <tr>
                  <th>Transação (Hash)</th>
                  <th>Tipo</th>
                  <th>Valor (BTC)</th>
                  <th>Data</th>
                  <th>Link</th>
                </tr>
              </thead>
              <tbody>
                ${txs
                  .map(
                    (tx) => `
                  <tr class="btc-tx-row">
                    <td>
                      <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-family: var(--font-mono); font-size: 0.78rem; color: #38BDF8;" title="${escapeHtml(tx.hash)}">
                          ${escapeHtml(encurtarHash(tx.hash, 8))}
                        </span>
                        <button type="button" class="btn btn-ghost btn-sm" style="padding: 2px 4px; height: auto;" onclick="window.copyToClipboard('${escapeHtml(tx.hash)}', 'Hash copiado!')" title="Copiar Hash">
                          <i data-lucide="copy" style="width: 11px; height: 11px;"></i>
                        </button>
                      </div>
                    </td>
                    <td>
                      <span class="badge ${tx.tipo === "RECEBIDO" ? "badge-success" : "badge-red"}" style="font-size: 0.68rem; padding: 2px 6px;">
                        ${escapeHtml(tx.tipo)}
                      </span>
                    </td>
                    <td style="font-family: var(--font-mono); font-weight: 600; color: ${tx.tipo === "RECEBIDO" ? "#34D399" : "#F87171"};">
                      ${tx.tipo === "RECEBIDO" ? "+" : "-"}${formatBtc(tx.valorBtc)}
                    </td>
                    <td style="font-size: 0.75rem; color: var(--color-text-muted);">
                      ${escapeHtml(formatDataIso(tx.data))}
                    </td>
                    <td>
                      <a href="${escapeHtml(tx.mempoolUrl || tx.blockchainUrl)}" target="_blank" rel="noopener noreferrer" style="color: #F59E0B;" title="Ver no Mempool.space">
                        <i data-lucide="external-link" style="width: 13px; height: 13px;"></i>
                      </a>
                    </td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>
          `;
        }
      }

      // 2. Surface Web Hits (Google / SERP)
      const surfaceHits = Array.isArray(surfaceWeb.resultados) ? surfaceWeb.resultados : [];
      if (countTabSurface) countTabSurface.textContent = String(surfaceHits.length);
      if (surfaceLista) {
        if (surfaceHits.length === 0) {
          surfaceLista.innerHTML = `
            <div style="padding: 24px; text-align: center; color: var(--color-text-muted); font-size: 0.85rem;">
              <i data-lucide="globe" style="width: 24px; height: 24px; color: var(--color-text-dim); margin: 0 auto 8px; display: block;"></i>
              Nenhuma menção indexada na Surface Web retornada para este endereço exato.
              <div style="font-size: 0.75rem; margin-top: 6px; color: var(--color-text-dim);">
                Consulte os pivôs manuais ao lado (Reddit, GitHub, BitcoinAbuse) para varredura avançada.
              </div>
            </div>
          `;
        } else {
          surfaceLista.innerHTML = surfaceHits
            .map((hit) => {
              const catCor =
                hit.categoria.includes("Denúncia") || hit.categoria.includes("Scam")
                  ? "#EF4444"
                  : hit.categoria.includes("GitHub")
                  ? "#A78BFA"
                  : hit.categoria.includes("Reddit")
                  ? "#F97316"
                  : hit.categoria.includes("BitcoinTalk")
                  ? "#F59E0B"
                  : "#38BDF8";

              return `
              <div class="btc-hit-card">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 4px;">
                  <a href="${escapeHtml(hit.url)}" target="_blank" rel="noopener noreferrer" style="font-size: 0.86rem; font-weight: 700; color: #38BDF8; text-decoration: none; line-height: 1.3;">
                    ${escapeHtml(hit.titulo)} &rarr;
                  </a>
                  <span class="badge" style="background: rgba(255,255,255,0.05); border: 1px solid ${catCor}; color: ${catCor}; font-size: 0.65rem; white-space: nowrap;">
                    ${escapeHtml(hit.categoria)}
                  </span>
                </div>
                <div style="font-size: 0.72rem; color: #10B981; font-family: var(--font-mono); word-break: break-all; margin-bottom: 6px;">
                  ${escapeHtml(hit.url)}
                </div>
                <div style="font-size: 0.78rem; color: var(--color-text-muted); line-height: 1.4;">
                  ${escapeHtml(hit.snippet)}
                </div>
              </div>
            `;
            })
            .join("");
        }
      }

      // 3. Dark Web Hits (.onion Ahmia)
      const darkHits = Array.isArray(darkWeb.resultados) ? darkWeb.resultados : [];
      if (countTabDark) countTabDark.textContent = String(darkHits.length);
      if (lnkAhmiaDirect) {
        lnkAhmiaDirect.href = darkWeb.ahmiaSearchUrl || `https://ahmia.fi/search/?q=${addrEncoded}`;
      }
      if (darkLista) {
        if (darkHits.length === 0) {
          darkLista.innerHTML = `
            <div style="padding: 24px; text-align: center; color: var(--color-text-muted); font-size: 0.85rem;">
              <i data-lucide="eye-off" style="width: 24px; height: 24px; color: var(--color-text-dim); margin: 0 auto 8px; display: block;"></i>
              Nenhuma menção indexada em sites .onion da Dark Web via Ahmia para este endereço.
            </div>
          `;
        } else {
          darkLista.innerHTML = darkHits
            .map(
              (hit) => `
              <div class="btc-hit-card" style="border-left: 3px solid #A78BFA;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 4px;">
                  <strong style="font-size: 0.86rem; color: #E2E8F0;">
                    ${escapeHtml(hit.titulo)}
                  </strong>
                  <span class="badge" style="background: rgba(167, 139, 250, 0.15); color: #C4B5FD; font-size: 0.65rem;">
                    Tor .onion
                  </span>
                </div>
                <div style="font-size: 0.72rem; color: #A78BFA; font-family: var(--font-mono); word-break: break-all; margin-bottom: 6px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <span>${escapeHtml(hit.urlOnion)}</span>
                  ${
                    hit.urlClearnet && hit.urlClearnet !== hit.urlOnion
                      ? `<a href="${escapeHtml(hit.urlClearnet)}" target="_blank" rel="noopener noreferrer" style="color: #38BDF8; font-size: 0.7rem; text-decoration: underline;" title="Visualizar via proxy clearnet (.onion.pet)">[Espelho Web]</a>`
                      : ""
                  }
                  <button type="button" class="btn btn-ghost btn-sm" style="padding: 1px 4px; height: auto;" onclick="window.copyToClipboard('${escapeHtml(hit.urlOnion)}', 'Link .onion copiado!')" title="Copiar link Tor">
                    <i data-lucide="copy" style="width: 11px; height: 11px;"></i>
                  </button>
                </div>
                <div style="font-size: 0.78rem; color: var(--color-text-muted); line-height: 1.4;">
                  ${escapeHtml(hit.snippet)}
                </div>
              </div>
            `
            )
            .join("");
        }
      }

      // 4. Pivôs Anti-Scam e Bases Externas
      const pivots = [
        ...(Array.isArray(surfaceWeb.pivots) ? surfaceWeb.pivots : []),
        { nome: "Tor Ahmia (.onion)", url: darkWeb.torAhmiaUrl || `http://juhanurmihxlp77nkq76byazcldy2hlmovfu2epvl5ankdibsot4csyd.onion/search/?q=${addrEncoded}` },
      ];

      if (pivotsList) {
        pivotsList.innerHTML = pivots
          .map(
            (p) => `
            <a href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm" style="display: flex; justify-content: space-between; align-items: center; text-align: left; padding: 8px 12px;">
              <span style="font-weight: 600;">${escapeHtml(p.nome)}</span>
              <i data-lucide="external-link" style="width: 13px; height: 13px; color: var(--color-text-muted);"></i>
            </a>
          `
          )
          .join("");
      }

      if (resContainer) resContainer.style.display = "block";
      if (window.lucide) window.lucide.createIcons();
    }

    async function executarInvestigacao(address) {
      limparErro();
      const addrClean = String(address || "").trim();

      if (!addrClean) {
        mostrarErro("Digite um endereço de carteira Bitcoin válido.");
        return;
      }

      if (loadingBox) loadingBox.style.display = "block";
      if (resContainer) resContainer.style.display = "none";

      try {
        const resp = await window.api.post("/api/bitcoin/investigar", { address: addrClean });

        if (!resp?.success || !resp?.data) {
          mostrarErro(resp?.error || "Falha na investigação da carteira Bitcoin.");
          return;
        }

        renderResultado(resp.data);
        if (window.toast) window.toast.success("Investigação Bitcoin concluída com sucesso!");
      } catch (err) {
        mostrarErro(err?.message || "Erro na comunicação com o servidor.");
      } finally {
        if (loadingBox) loadingBox.style.display = "none";
      }
    }

    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      executarInvestigacao(addressInput?.value);
    });

    // Copiar endereço
    document.getElementById("btnCopiarEndereco")?.addEventListener("click", () => {
      if (!ultimoResultado?.consulta?.address) return;
      window.copyToClipboard?.(ultimoResultado.consulta.address, "Endereço Bitcoin copiado com sucesso!");
    });

    // Copiar JSON
    document.getElementById("btnCopiarJsonBtc")?.addEventListener("click", () => {
      if (!ultimoResultado) return;
      window.copyToClipboard?.(JSON.stringify(ultimoResultado, null, 2), "JSON completo copiado para a área de transferência!");
    });

    // Modal Dossiê Dark
    btnGerarRelatorio?.addEventListener("click", () => {
      if (!ultimoResultado || !modalBody) return;
      if (window.OsintDarkReport?.renderBitcoinReport) {
        modalBody.innerHTML = window.OsintDarkReport.renderBitcoinReport({
          termo: ultimoResultado.consulta?.address || "",
          resultado: ultimoResultado,
        });
      } else {
        modalBody.innerHTML = `
          <div style="padding: 20px; font-family: var(--font-mono); color: var(--color-text);">
            <h3>Dossiê Forense de Carteira Bitcoin</h3>
            <p><strong>Endereço:</strong> ${escapeHtml(ultimoResultado.consulta?.address)}</p>
            <p><strong>Saldo:</strong> ${formatBtc(ultimoResultado.resumo?.saldoBtc)} (${formatBrl(ultimoResultado.resumo?.saldoBrl)})</p>
            <p><strong>Total Recebido:</strong> ${formatBtc(ultimoResultado.resumo?.totalRecebidoBtc)}</p>
            <p><strong>Transações On-Chain:</strong> ${ultimoResultado.resumo?.totalTransacoes}</p>
            <p><strong>Menções Surface Web:</strong> ${ultimoResultado.resumo?.mencoesSurfaceWeb}</p>
            <p><strong>Menções Dark Web:</strong> ${ultimoResultado.resumo?.mencoesDarkWeb}</p>
          </div>
        `;
      }
      if (modal) modal.style.display = "flex";
      if (window.lucide) window.lucide.createIcons();
    });

    btnFecharModal?.addEventListener("click", () => {
      if (modal) modal.style.display = "none";
    });

    modal?.addEventListener("click", (e) => {
      if (e.target === modal) modal.style.display = "none";
    });

    document.getElementById("btnHtmlBtc")?.addEventListener("click", () => {
      if (!modalBody?.innerHTML || !window.OsintDarkReport) return;
      window.OsintDarkReport.downloadHtml({
        innerHtml: modalBody.innerHTML,
        titlePrefix: "dossie-bitcoin",
        termo: ultimoResultado?.consulta?.address || "btc",
      });
    });

    document.getElementById("btnPdfBtc")?.addEventListener("click", () => {
      if (!modalBody?.innerHTML || !window.OsintDarkReport) return;
      window.OsintDarkReport.exportPdf({
        innerHtml: modalBody.innerHTML,
        titleText: "Dossiê Forense • Carteira Bitcoin (BTC)",
      });
    });

    // Hidratação via Query String (?address=...&auto=1)
    const qs = new URLSearchParams(window.location.search);
    const qsAddress = qs.get("address") || qs.get("btc") || qs.get("wallet");
    if (qsAddress && addressInput) {
      addressInput.value = qsAddress;
      if (qs.get("auto") === "1") {
        executarInvestigacao(qsAddress);
      }
    }
  });
})();
