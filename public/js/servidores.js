/**
 * ==============================================================================
 * RIMUBUSCA - CONTROLADOR FRONTEND: SERVIDORES PÚBLICOS FEDERAIS (SIAPE / CGU)
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
    const form = document.getElementById("formServidores");
    const cpfEl = document.getElementById("srvCpf");
    const nomeEl = document.getElementById("srvNome");
    const orgaoEl = document.getElementById("srvOrgao");
    const presetSelect = document.getElementById("srvSelectOrgaoPreset");
    const nomeHelperLink = document.getElementById("lnkBuscarCpfPorNome");
    const mesAnoEl = document.getElementById("srvMesAno");
    const tipoEl = document.getElementById("srvTipo");
    const situacaoEl = document.getElementById("srvSituacao");
    const incluirRemEl = document.getElementById("srvIncluirRem");
    const incluirViagensEl = document.getElementById("srvIncluirViagens");

    const erroBox = document.getElementById("srvErroBox");
    const erroMsg = document.getElementById("srvErroMsg");
    const erroDica = document.getElementById("srvErroDica");
    const erroAcoes = document.getElementById("srvErroAcoes");
    const btnErroPivotPessoa = document.getElementById("btnErroPivotPessoa");
    const avisoAproximado = document.getElementById("srvAvisoAproximado");
    const avisoAproximadoTexto = document.getElementById("srvAvisoAproximadoTexto");

    const loadingBox = document.getElementById("srvLoadingBox");
    const resBox = document.getElementById("srvResultados");

    const orgaosBox = document.getElementById("srvOrgaosBox");
    const orgaoSearchInput = document.getElementById("srvOrgaoSearchInput");
    const orgaosResBox = document.getElementById("srvOrgaosResultados");

    const modalSrv = document.getElementById("modalRelatorioServidores");
    const modalSrvBody = document.getElementById("modalRelatorioServidoresBody");

    let ultimoResultado = null;

    function mostrarErro(msg, dica = null, exigeOrgao = false) {
      if (erroMsg) erroMsg.textContent = msg || "Falha ao consultar servidores federais.";
      if (erroDica) {
        if (dica) {
          erroDica.textContent = dica;
          erroDica.style.display = "block";
        } else {
          erroDica.style.display = "none";
        }
      }
      if (erroAcoes) {
        const precisaOrgao = Boolean(
          exigeOrgao ||
            (msg && (msg.includes("Órgão") || msg.includes("instituição") || msg.includes("SIAPE")))
        );
        if (precisaOrgao) {
          const nomeVal = String(nomeEl?.value || "").trim();
          if (btnErroPivotPessoa) {
            btnErroPivotPessoa.href = `/advanced/person?tipo=nome&termo=${encodeURIComponent(nomeVal)}&auto=1`;
          }
          erroAcoes.style.display = "flex";
        } else {
          erroAcoes.style.display = "none";
        }
      }
      if (erroBox) erroBox.style.display = "block";
      if (window.lucide) window.lucide.createIcons();
      window.toast?.error(msg || "Falha na consulta.");
    }

    function limparErro() {
      if (erroBox) erroBox.style.display = "none";
    }

    nomeEl?.addEventListener("input", () => {
      const v = String(nomeEl.value || "").trim();
      if (v.length >= 3 && nomeHelperLink) {
        nomeHelperLink.href = `/advanced/person?tipo=nome&termo=${encodeURIComponent(v)}&auto=1`;
        nomeHelperLink.style.display = "inline-flex";
      } else if (nomeHelperLink) {
        nomeHelperLink.style.display = "none";
      }
    });

    presetSelect?.addEventListener("change", () => {
      if (presetSelect.value && orgaoEl) {
        orgaoEl.value = presetSelect.value;
        limparErro();
        window.toast?.info(`Instituição ${presetSelect.value} selecionada.`);
      }
    });

    orgaoEl?.addEventListener("input", () => {
      const v = String(orgaoEl.value || "").trim();
      if (presetSelect) {
        const opt = Array.from(presetSelect.options).find((o) => o.value === v);
        presetSelect.value = opt ? v : "";
      }
    });

    document.querySelectorAll("[data-quick-orgao]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cod = btn.getAttribute("data-quick-orgao");
        if (cod && orgaoEl) {
          orgaoEl.value = cod;
          if (presetSelect) presetSelect.value = cod;
          limparErro();
          window.toast?.info(`Instituição ${cod} selecionada.`);
          if (nomeEl?.value?.trim() && !cpfEl?.value?.trim()) {
            executarConsulta();
          }
        }
      });
    });

    async function buscarOrgaosSiape() {
      const q = String(orgaoSearchInput?.value || "").trim();
      if (!q) return;
      orgaosResBox.textContent = "Consultando /orgaos-siape na CGU...";
      try {
        const resp = await window.api.get(`/api/servidores/orgaos-siape?q=${encodeURIComponent(q)}`);
        const orgaos = resp?.data?.orgaos || [];
        if (resp?.data?.status === "chave_nao_configurada") {
          orgaosResBox.innerHTML = `<span style="color:#F87171;">${escapeHtml(resp.data.mensagem)}</span>`;
          return;
        }
        if (orgaos.length === 0) {
          orgaosResBox.textContent = "Nenhum órgão SIAPE localizado com esse termo.";
          return;
        }
        orgaosResBox.innerHTML = orgaos
          .slice(0, 20)
          .map(
            (o) => `
            <button type="button" class="cgufed-chip" data-orgao-codigo="${escapeHtml(o.codigo || "")}">
              <strong style="color:#38BDF8;font-family:var(--font-mono);">${escapeHtml(o.codigo || "-")}</strong>
              <span>${escapeHtml(o.nome)}</span>
            </button>
          `
          )
          .join("");

        orgaosResBox.querySelectorAll("[data-orgao-codigo]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const cod = btn.getAttribute("data-orgao-codigo");
            if (cod && orgaoEl) {
              orgaoEl.value = cod;
              window.toast?.success(`Órgão SIAPE ${cod} selecionado.`);
            }
          });
        });
      } catch (err) {
        orgaosResBox.innerHTML = `<span style="color:#F87171;">Erro: ${escapeHtml(err.message)}</span>`;
      }
    }

    document.getElementById("btnToggleOrgaosHelper")?.addEventListener("click", () => {
      if (!orgaosBox) return;
      orgaosBox.style.display = orgaosBox.style.display === "none" ? "block" : "none";
    });

    document.getElementById("btnBuscarOrgaoSiape")?.addEventListener("click", buscarOrgaosSiape);

    document.querySelectorAll("[data-preset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const p = btn.getAttribute("data-preset");
        if (p === "mec") {
          if (cpfEl) cpfEl.value = "";
          if (nomeEl) nomeEl.value = "";
          if (orgaoEl) orgaoEl.value = "26000";
          if (situacaoEl) situacaoEl.value = "1";
          window.toast?.info("Filtro MEC (26000) Ativos preenchido. Opcionalmente adicione um Nome.");
        } else if (p === "uf-helper") {
          if (orgaosBox) orgaosBox.style.display = "block";
          if (orgaoSearchInput) orgaoSearchInput.value = "Universidade Federal";
          buscarOrgaosSiape();
        }
      });
    });

    document.getElementById("btnLimparSrv")?.addEventListener("click", () => {
      form?.reset();
      limparErro();
      if (resBox) resBox.style.display = "none";
      ultimoResultado = null;
    });

    function renderResultado(data) {
      ultimoResultado = data;
      const consulta = data.consulta || {};
      const resumo = data.resumo || {};
      const servidores = Array.isArray(data.servidores) ? data.servidores : [];
      const perfil = data.perfilPessoa || {};

      const statusBadge = document.getElementById("srvStatusBadge");
      const eduBadge = document.getElementById("srvEduBadge");
      const cacheBadge = document.getElementById("srvCacheBadge");
      const tituloEl = document.getElementById("srvResTitulo");
      const subEl = document.getElementById("srvResSubtitulo");
      const kpiGrid = document.getElementById("srvKpiGrid");

      if (statusBadge) {
        statusBadge.textContent =
          resumo.totalServidores > 0
            ? `${resumo.totalServidores} VÍNCULO(S) SIAPE`
            : "NENHUM VÍNCULO FEDERAL";
      }
      if (eduBadge) {
        eduBadge.style.display = resumo.totalEducacaoFederal > 0 ? "inline-flex" : "none";
      }
      if (cacheBadge) {
        cacheBadge.style.display = data.cacheHit ? "inline-flex" : "none";
      }

      const alvoLabel =
        consulta.nome ||
        consulta.cpfFormatado ||
        (consulta.orgaoServidorLotacao ? `Órgão SIAPE ${consulta.orgaoServidorLotacao}` : "Servidores Federais");

      if (tituloEl) tituloEl.textContent = alvoLabel;
      if (subEl) {
        subEl.textContent = `${data.escopo || ""} • Competência folha: ${
          consulta.competenciaRetornada || consulta.mesAnoSolicitado || "Auto"
        }${data.avisoApi ? ` • Aviso API: ${data.avisoApi}` : ""}`;
      }

      if (avisoAproximado) {
        if (data.buscaAproximada?.aviso) {
          if (avisoAproximadoTexto) avisoAproximadoTexto.textContent = data.buscaAproximada.aviso;
          avisoAproximado.style.display = "block";
        } else {
          avisoAproximado.style.display = "none";
        }
      }

      if (kpiGrid) {
        const kpis = [
          { label: "Servidores Retornados", value: String(resumo.totalServidores || 0), color: "#38BDF8" },
          { label: "Educação / Magistério Fed.", value: String(resumo.totalEducacaoFederal || 0), color: "#A78BFA" },
          { label: "Maior Bruto Mensal", value: formatBrl(resumo.maiorBrutoEncontrado || 0), color: "#FBBF24" },
          { label: "Maior Líquido Mensal", value: formatBrl(resumo.maiorLiquidoEncontrado || 0), color: "#34D399" },
          { label: "Diárias / Viagens", value: `${resumo.totalViagens || 0} (${formatBrl(resumo.valorTotalViagens || 0)})`, color: "#F472B6" },
        ];
        kpiGrid.innerHTML = kpis
          .map(
            (k) => `
          <div class="cgufed-kv">
            <div class="cgufed-kv-label">${escapeHtml(k.label)}</div>
            <div class="cgufed-kv-val" style="color:${k.color};font-family:var(--font-mono);">${escapeHtml(k.value)}</div>
          </div>
        `
          )
          .join("");
      }

      // Pivôs OSINT
      const pivotWrap = document.getElementById("srvPivotWrap");
      const pivotBtns = document.getElementById("srvPivotBtns");
      const pivots = [];
      const cpfPivot = digitsOnly(consulta.cpf);
      const nomePivot = consulta.nome || servidores[0]?.nome || "";
      if (cpfPivot.length === 11) {
        pivots.push(`
          <a href="/basic/auxilios?cpf=${encodeURIComponent(cpfPivot)}&auto=1" class="btn btn-primary btn-sm">
            <i data-lucide="hand-coins" style="width:13px;height:13px;"></i>
            Verificar Benefícios &amp; Auxílios (CPF)
          </a>
        `);
        pivots.push(`
          <a href="/advanced/person?tipo=cpf&termo=${encodeURIComponent(cpfPivot)}&auto=1" class="btn btn-secondary btn-sm">
            <i data-lucide="user-search" style="width:13px;height:13px;"></i>
            Puxar CPF Completo + Compliance
          </a>
        `);
      } else if (nomePivot) {
        pivots.push(`
          <a href="/advanced/person?tipo=nome&termo=${encodeURIComponent(nomePivot)}&auto=1" class="btn btn-secondary btn-sm">
            <i data-lucide="user-search" style="width:13px;height:13px;"></i>
            Pesquisar Nome na Receita/Zeroy
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
      const flagsCard = document.getElementById("srvPerfilFlagsCard");
      const flagsBody = document.getElementById("srvPerfilFlagsBody");
      const nisBadge = document.getElementById("srvNisBadge");
      if (flagsCard && flagsBody) {
        if (perfil.encontrado) {
          if (nisBadge) {
            nisBadge.textContent = resumo.nisVinculadoCgu ? `NIS: ${resumo.nisVinculadoCgu}` : "NIS não informado";
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
              : `<span style="font-size:0.84rem;color:var(--color-text-muted);">Pessoa localizada na síntese da CGU sem sinalizadores restritivos ou benefícios ativos.</span>`;
          flagsCard.style.display = "block";
        } else {
          flagsCard.style.display = "none";
        }
      }

      // Lista de servidores
      const listaEl = document.getElementById("srvListaCards");
      if (listaEl) {
        if (servidores.length === 0) {
          listaEl.innerHTML = `
            <div class="card" style="margin-bottom: var(--space-5); border-color: rgba(245, 158, 11, 0.35);">
              <div class="card-body">
                <strong style="color:#FBBF24;">Nenhum servidor encontrado no Poder Executivo Federal para estes critérios.</strong>
                <p style="font-size:0.84rem;color:var(--color-text-muted);margin:6px 0 0;">
                  ${escapeHtml(data.notaEstadualMunicipal || "")}
                </p>
              </div>
            </div>
          `;
        } else {
          listaEl.innerHTML = servidores
            .map((s) => {
              const rem = s.remuneracoes?.[0];
              const bruto = rem
                ? rem.remuneracaoBasicaBruta + rem.gratificacaoNatalina + rem.ferias + rem.outrasRemuneracoesEventuais
                : null;

              const fichasHtml =
                Array.isArray(s.fichas) && s.fichas.length > 0
                  ? `
                  <div style="margin-top:14px;overflow-x:auto;">
                    <table class="cgufed-table">
                      <thead>
                        <tr>
                          <th>Ficha</th>
                          <th>Cargo / Função</th>
                          <th>Classe / Nível</th>
                          <th>Lotação / UORG</th>
                          <th>Regime / Jornada</th>
                          <th>Ingresso</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${s.fichas
                          .map(
                            (f) => `
                          <tr>
                            <td><span class="badge badge-dark">${escapeHtml(f.tipoFicha)}</span></td>
                            <td><strong>${escapeHtml(f.cargoOuFuncao)}</strong></td>
                            <td style="font-family:var(--font-mono);">${escapeHtml(f.classeNivel || "-")}</td>
                            <td>${escapeHtml(f.uorg || f.orgaoLotacao || "-")}</td>
                            <td>${escapeHtml([f.regimeJuridico, f.jornadaTrabalho].filter(Boolean).join(" • ") || "-")}</td>
                            <td style="font-family:var(--font-mono);">${escapeHtml(f.dataIngressoOrgao || "-")}</td>
                          </tr>
                        `
                          )
                          .join("")}
                      </tbody>
                    </table>
                  </div>
                `
                  : "";

              const remHtml = rem
                ? `
                  <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--color-border);">
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
                      <strong style="font-size:0.86rem;color:#34D399;">Remuneração Mensal (${escapeHtml(rem.mesAnoLabel)})</strong>
                      <span class="badge badge-dark">Líquido: ${escapeHtml(formatBrl(rem.valorLiquido))}</span>
                    </div>
                    <div class="cgufed-kv-grid">
                      <div class="cgufed-kv"><div class="cgufed-kv-label">Básica Bruta</div><div class="cgufed-kv-val" style="color:#FBBF24;font-family:var(--font-mono);">${escapeHtml(formatBrl(rem.remuneracaoBasicaBruta))}</div></div>
                      <div class="cgufed-kv"><div class="cgufed-kv-label">Total Bruto Calculado</div><div class="cgufed-kv-val" style="font-family:var(--font-mono);">${escapeHtml(formatBrl(bruto))}</div></div>
                      <div class="cgufed-kv"><div class="cgufed-kv-label">IRRF + Previdência</div><div class="cgufed-kv-val" style="color:#F87171;font-family:var(--font-mono);">${escapeHtml(formatBrl(rem.impostoRetidoNaFonte + rem.previdenciaOficial))}</div></div>
                      <div class="cgufed-kv"><div class="cgufed-kv-label">Verbas Indenizatórias</div><div class="cgufed-kv-val" style="color:#38BDF8;font-family:var(--font-mono);">${escapeHtml(formatBrl(rem.verbasIndenizatorias))}</div></div>
                      <div class="cgufed-kv"><div class="cgufed-kv-label">Líquido Após Deduções</div><div class="cgufed-kv-val" style="color:#34D399;font-family:var(--font-mono);">${escapeHtml(formatBrl(rem.valorLiquido))}</div></div>
                    </div>
                  </div>
                `
                : `<div style="margin-top:12px;font-size:0.78rem;color:var(--color-text-dim);">Folha salarial não retornada para as últimas competências automáticas${s.mesesTentados?.length ? ` (${escapeHtml(s.mesesTentados.join(", "))})` : ""}. Informe uma competência AAAAMM específica acima se necessário.</div>`;

              return `
                <div class="card" style="margin-bottom: var(--space-5); border-left: 3px solid ${s.isEducacaoFederal ? "#A78BFA" : "#38BDF8"};">
                  <div class="card-header">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                      <strong style="font-size:1.02rem;color:var(--color-text);">${escapeHtml(s.nome)}</strong>
                      <span class="badge badge-dark">${escapeHtml(s.situacao)}</span>
                      <span class="badge badge-dark">${escapeHtml(s.tipoServidor)}</span>
                      ${s.isEducacaoFederal ? `<span class="badge" style="background:rgba(167,139,250,0.16);color:#C4B5FD;border:1px solid rgba(167,139,250,0.35);">Educação / Magistério Federal</span>` : ""}
                    </div>
                    <span style="font-family:var(--font-mono);font-size:0.78rem;color:var(--color-text-muted);">${escapeHtml(s.cpfFormatado || "-")} &bull; Mat. ${escapeHtml(s.matriculaFormatada || "-")}</span>
                  </div>
                  <div class="card-body">
                    <div class="cgufed-kv-grid">
                      <div class="cgufed-kv"><div class="cgufed-kv-label">Cargo / Vínculo Principal</div><div class="cgufed-kv-val">${escapeHtml(s.cargoPrincipal)}</div></div>
                      <div class="cgufed-kv"><div class="cgufed-kv-label">Função Comissionada</div><div class="cgufed-kv-val">${escapeHtml(s.funcaoComissionada || "Sem função comissionada")}</div></div>
                      <div class="cgufed-kv"><div class="cgufed-kv-label">Órgão de Lotação</div><div class="cgufed-kv-val">${escapeHtml(s.orgaoLotacao?.nome || "-")}</div></div>
                      <div class="cgufed-kv"><div class="cgufed-kv-label">Órgão Exercício / UF</div><div class="cgufed-kv-val">${escapeHtml([s.orgaoExercicio?.nome, s.ufExercicio].filter(Boolean).join(" — "))}</div></div>
                    </div>
                    ${fichasHtml}
                    ${remHtml}
                  </div>
                </div>
              `;
            })
            .join("");
        }
      }

      // Viagens
      const viagensCard = document.getElementById("srvViagensCard");
      const viagensBody = document.getElementById("srvViagensBody");
      const viagensBadge = document.getElementById("srvViagensBadge");
      const viagens = data.viagens?.viagens || [];
      if (viagensCard && viagensBody) {
        if (viagens.length > 0) {
          if (viagensBadge) viagensBadge.textContent = `${viagens.length} registro(s)`;
          viagensBody.innerHTML = `
            <table class="cgufed-table">
              <thead>
                <tr>
                  <th>PCDP</th>
                  <th>Período</th>
                  <th>Órgão</th>
                  <th>Diárias</th>
                  <th>Passagens</th>
                  <th>Total</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                ${viagens
                  .map(
                    (v) => `
                  <tr>
                    <td style="font-family:var(--font-mono);">${escapeHtml(v.pcdp || "-")}</td>
                    <td style="font-family:var(--font-mono);">${escapeHtml([v.inicio, v.fim].filter(Boolean).join(" a ") || "-")}</td>
                    <td>${escapeHtml(v.orgao || "-")}</td>
                    <td style="font-family:var(--font-mono);">${escapeHtml(formatBrl(v.diarias))}</td>
                    <td style="font-family:var(--font-mono);">${escapeHtml(formatBrl(v.passagens))}</td>
                    <td style="font-family:var(--font-mono);color:#34D399;"><strong>${escapeHtml(formatBrl(v.totalViagem))}</strong></td>
                    <td>${escapeHtml(v.motivo || "-")}</td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>
          `;
          viagensCard.style.display = "block";
        } else {
          viagensCard.style.display = "none";
        }
      }

      if (resBox) resBox.style.display = "block";
      if (window.lucide) window.lucide.createIcons();
    }

    async function executarConsulta() {
      limparErro();
      const payload = {
        cpf: String(cpfEl?.value || "").trim(),
        nome: String(nomeEl?.value || "").trim(),
        orgaoServidorLotacao: String(orgaoEl?.value || "").trim(),
        tipoServidor: String(tipoEl?.value || "").trim(),
        situacaoServidor: String(situacaoEl?.value || "").trim(),
        mesAno: String(mesAnoEl?.value || "").trim(),
        incluirRemuneracao: Boolean(incluirRemEl?.checked),
        incluirViagens: Boolean(incluirViagensEl?.checked),
      };

      if (loadingBox) loadingBox.style.display = "block";
      if (resBox) resBox.style.display = "none";

      try {
        const resp = await window.api.post("/api/servidores/consultar", payload);
        if (!resp?.success || !resp?.data) {
          mostrarErro(
            resp?.error || "Falha ao consultar servidores federais.",
            resp?.dica || null,
            Boolean(resp?.exigeOrgao || resp?.status === "orgao_obrigatorio_para_nome")
          );
          return;
        }
        renderResultado(resp.data);
        window.toast?.success("Consulta CGU SIAPE concluída.");
      } catch (err) {
        mostrarErro(
          err?.message || "Erro na comunicação com o servidor.",
          err?.data?.dica || null,
          Boolean(err?.data?.exigeOrgao || err?.data?.status === "orgao_obrigatorio_para_nome")
        );
      } finally {
        if (loadingBox) loadingBox.style.display = "none";
      }
    }

    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      executarConsulta();
    });

    document.getElementById("btnCopiarJsonSrv")?.addEventListener("click", () => {
      if (!ultimoResultado) return;
      window.copyToClipboard?.(JSON.stringify(ultimoResultado, null, 2), "JSON copiado para a área de transferência!");
    });

    document.getElementById("btnGerarRelatorioSrv")?.addEventListener("click", () => {
      if (!ultimoResultado || !window.OsintDarkReport?.renderServidoresFederaisReport) return;
      modalSrvBody.innerHTML = window.OsintDarkReport.renderServidoresFederaisReport({
        termo: ultimoResultado.consulta?.nome || ultimoResultado.consulta?.cpfFormatado || ultimoResultado.consulta?.orgaoServidorLotacao || "",
        resultado: ultimoResultado,
      });
      modalSrv.style.display = "flex";
    });

    document.getElementById("btnFecharModalSrv")?.addEventListener("click", () => {
      if (modalSrv) modalSrv.style.display = "none";
    });

    modalSrv?.addEventListener("click", (e) => {
      if (e.target === modalSrv) modalSrv.style.display = "none";
    });

    document.getElementById("btnHtmlSrv")?.addEventListener("click", () => {
      if (!modalSrvBody?.innerHTML || !window.OsintDarkReport) return;
      window.OsintDarkReport.downloadHtml({
        innerHtml: modalSrvBody.innerHTML,
        titlePrefix: "dossie-servidores-federais",
        termo: ultimoResultado?.consulta?.cpf || ultimoResultado?.consulta?.nome || "siape",
      });
    });

    document.getElementById("btnPdfSrv")?.addEventListener("click", () => {
      if (!modalSrvBody?.innerHTML || !window.OsintDarkReport) return;
      window.OsintDarkReport.exportPdf({
        innerHtml: modalSrvBody.innerHTML,
        titleText: "Dossiê CGU • Servidores Públicos Federais",
      });
    });

    // Hidratação via querystring (?cpf=...&nome=...&orgao=...&auto=1)
    const qs = new URLSearchParams(window.location.search);
    if (qs.get("cpf") && cpfEl) cpfEl.value = qs.get("cpf");
    if (qs.get("nome") && nomeEl) {
      nomeEl.value = qs.get("nome");
      if (nomeEl.value.trim().length >= 3 && nomeHelperLink) {
        nomeHelperLink.href = `/advanced/person?tipo=nome&termo=${encodeURIComponent(nomeEl.value.trim())}&auto=1`;
        nomeHelperLink.style.display = "inline-flex";
      }
    }
    if (qs.get("orgao") && orgaoEl) {
      orgaoEl.value = qs.get("orgao");
      if (presetSelect) presetSelect.value = qs.get("orgao");
    }
    if (qs.get("auto") === "1" && (qs.get("cpf") || qs.get("nome") || qs.get("orgao"))) {
      executarConsulta();
    }
    if (qs.get("auto") === "1" && (qs.get("cpf") || qs.get("nome") || qs.get("orgao"))) {
      executarConsulta();
    }
  });
})();
