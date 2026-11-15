/**
 * ==============================================================================
 * RIMUBUSCA - CONTROLADOR DO DECODIFICADOR PIX & BOLETO FEBRABAN
 * ==============================================================================
 */

import {
  analisarCodigoFinanceiro,
  crc16Ccitt,
  modulo10Febraban,
  modulo11Banco,
} from "/js/financeiro-br-decoder.js";

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildEmvTag(id, value) {
  const valStr = String(value || "");
  const len = String(valStr.length).padStart(2, "0");
  return `${id}${len}${valStr}`;
}

function buildPixBrCodeSample({ dynamic = false, chave = "", url = "", valor = "", recebedor = "", cidade = "", txId = "***", tamperCrc = false, desc = "" }) {
  const maiSub =
    buildEmvTag("00", "br.gov.bcb.pix") +
    (chave ? buildEmvTag("01", chave) : "") +
    (desc ? buildEmvTag("02", desc) : "") +
    (url ? buildEmvTag("25", url) : "");

  const addSub = buildEmvTag("05", txId);

  const semCrc =
    buildEmvTag("00", "01") +
    buildEmvTag("01", dynamic ? "12" : "11") +
    buildEmvTag("26", maiSub) +
    buildEmvTag("52", "0000") +
    buildEmvTag("53", "986") +
    (valor ? buildEmvTag("54", valor) : "") +
    buildEmvTag("58", "BR") +
    buildEmvTag("59", recebedor) +
    buildEmvTag("60", cidade) +
    buildEmvTag("62", addSub) +
    "6304";

  const crc = crc16Ccitt(semCrc);
  if (!tamperCrc) return semCrc + crc;
  const tampered = crc === "0000" ? "FFFF" : "0000";
  return semCrc + tampered;
}

function buildBancoBoleto47Sample() {
  const banco = "341";
  const moeda = "9";
  const fator = "1450";
  const valor = "0000028950";
  const livre = "1090063571277308714446400"; // 25 dígitos
  const barSemDac = `${banco}${moeda}${fator}${valor}${livre}`;
  const dac = modulo11Banco(barSemDac);

  const c1Base = `${banco}${moeda}${livre.slice(0, 5)}`;
  const c1 = `${c1Base}${modulo10Febraban(c1Base)}`;
  const c2Base = livre.slice(5, 15);
  const c2 = `${c2Base}${modulo10Febraban(c2Base)}`;
  const c3Base = livre.slice(15, 25);
  const c3 = `${c3Base}${modulo10Febraban(c3Base)}`;

  return `${c1.slice(0, 5)}.${c1.slice(5)} ${c2.slice(0, 5)}.${c2.slice(5)} ${c3.slice(0, 5)}.${c3.slice(5)} ${dac} ${fator}${valor}`;
}

function buildConvenioBoleto48Sample() {
  // Arrecadação '8' | Segmento '5' (Órgãos Gov) | idValorRef '6' (Mod 10 valor em R$)
  const prefixo = "856";
  const valor = "00000095000"; // R$ 950,00
  const campoEmpresaLivre = "0197202600000123456789012345"; // 4+25 = 29 dígitos? Ajustado para fechar 40 dígitos após DV
  const resto40 = `${valor}${campoEmpresaLivre}`.slice(0, 40);
  const dvGeral = modulo10Febraban(`${prefixo}${resto40}`);
  const bar44 = `${prefixo}${dvGeral}${resto40}`;

  return [
    bar44.slice(0, 11),
    bar44.slice(11, 22),
    bar44.slice(22, 33),
    bar44.slice(33, 44),
  ]
    .map((b) => `${b}-${modulo10Febraban(b)}`)
    .join(" ");
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("formFinanceiro");
  const textarea = document.getElementById("inputFinanceiro");
  const detectBadge = document.getElementById("finTipoDetectadoBadge");
  const erroBox = document.getElementById("finErroBox");
  const erroMsg = document.getElementById("finErroMsg");
  const resContainer = document.getElementById("finResultados");

  let ultimoResultado = null;

  const DEMOS = {
    "pix-estatico": buildPixBrCodeSample({
      chave: "00000000000191",
      valor: "149.90",
      recebedor: "BANCO DO BRASIL SA",
      cidade: "BRASILIA",
      txId: "RIMUOSINT01",
      desc: "Pagamento Auditoria Cadastral",
    }),
    "pix-dinamico": buildPixBrCodeSample({
      dynamic: true,
      url: "qr.pagseguro.com/pix/v2/cob/99a88b77c66d55",
      valor: "850.00",
      recebedor: "COMERCIO DIGITAL LTDA",
      cidade: "SAO PAULO",
      txId: "COBRANCA2026",
    }),
    "pix-adulterado": buildPixBrCodeSample({
      chave: "4f3e2d1c-1234-4abc-9def-001122334455",
      valor: "3950.00",
      recebedor: "CENTRAL DESBLOQUEIO",
      cidade: "SAO PAULO",
      txId: "TAXAURGENTE",
      desc: "Taxa de Desbloqueio Receita Federal",
      tamperCrc: true,
    }),
    "boleto-banco": buildBancoBoleto47Sample(),
    "boleto-convenio": buildConvenioBoleto48Sample(),
  };

  function atualizarBadgeDeteccao() {
    const val = (textarea?.value || "").trim();
    const digits = val.replace(/\D/g, "");
    if (!val) {
      detectBadge.textContent = "Aguardando entrada";
      detectBadge.className = "badge badge-dark";
    } else if (val.startsWith("0002") || val.toLowerCase().includes("br.gov.bcb.pix")) {
      detectBadge.textContent = "Detectado: PIX BR Code (EMVCo)";
      detectBadge.className = "badge badge-purple";
    } else if ([44, 47, 48].includes(digits.length)) {
      detectBadge.textContent = digits.startsWith("8")
        ? `Detectado: Arrecadação / Convênio (${digits.length}d)`
        : `Detectado: Boleto Bancário (${digits.length}d)`;
      detectBadge.className = "badge badge-purple";
    } else {
      detectBadge.textContent = `Entrada (${digits.length} dígitos)`;
      detectBadge.className = "badge badge-dark";
    }
  }

  textarea?.addEventListener("input", atualizarBadgeDeteccao);

  document.querySelectorAll(".fin-demo-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const sample = DEMOS[btn.dataset.demo];
      if (!sample || !textarea) return;
      textarea.value = sample;
      atualizarBadgeDeteccao();
      executarAnalise();
    });
  });

  document.getElementById("btnLimparFin")?.addEventListener("click", () => {
    if (textarea) textarea.value = "";
    ultimoResultado = null;
    if (erroBox) erroBox.style.display = "none";
    if (resContainer) resContainer.style.display = "none";
    atualizarBadgeDeteccao();
    textarea?.focus();
  });

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    executarAnalise();
  });

  async function executarAnalise() {
    const codigo = (textarea?.value || "").trim();
    const res = analisarCodigoFinanceiro(codigo);

    if (!res.sucesso) {
      ultimoResultado = null;
      if (resContainer) resContainer.style.display = "none";
      if (erroBox) erroBox.style.display = "block";
      if (erroMsg) erroMsg.textContent = res.erro || "Formato inválido.";
      return;
    }

    if (erroBox) erroBox.style.display = "none";
    ultimoResultado = res;
    renderizarResultado(res);

    // Registro assíncrono não-bloqueante em auditoria/histórico quando autenticado
    try {
      if (window.api?.post) {
        window.api.post("/api/financeiro/analisar", { codigo }).catch(() => {});
      }
    } catch {
      // Operação determinística local não depende de resposta do backend
    }
  }

  function renderKv(label, value, { mono = false, color = "" } = {}) {
    const styleVal = color ? `color: ${color};` : "";
    return `
      <div class="fin-row-kv">
        <span class="fin-label">${escapeHtml(label)}</span>
        <span class="fin-val ${mono ? "fin-val-mono" : ""}" style="${styleVal}">${escapeHtml(value ?? "N/I")}</span>
      </div>
    `;
  }

  function renderizarResultado(res) {
    resContainer.style.display = "block";

    const isCritico = res.nivelRisco === "CRÍTICO" || res.nivelRisco === "ALTO";
    const isAtencao = res.nivelRisco === "ATENÇÃO";
    const bannerColor = isCritico ? "#EF4444" : isAtencao ? "#F59E0B" : "#10B981";
    const riscoBg = isCritico
      ? "rgba(239, 68, 68, 0.16)"
      : isAtencao
        ? "rgba(245, 158, 11, 0.16)"
        : "rgba(16, 185, 129, 0.16)";

    document.getElementById("finTopBanner").style.borderLeftColor = bannerColor;

    const riscoBadge = document.getElementById("finResRiscoBadge");
    riscoBadge.textContent = `RISCO: ${res.nivelRisco}`;
    riscoBadge.style.background = riscoBg;
    riscoBadge.style.color = bannerColor;

    const intBadge = document.getElementById("finResIntegridadeBadge");
    const modBadge = document.getElementById("finResModalidadeBadge");
    const tituloEl = document.getElementById("finResTitulo");
    const subEl = document.getElementById("finResSubtitulo");
    const valorHero = document.getElementById("finResValorHero");

    if (res.modalidade === "pix") {
      const d = res.dados;
      modBadge.textContent = `PIX ${res.tipoQr}`;
      intBadge.textContent = res.crcValido
        ? `CRC16 ÍNTEGRO (${res.crcEncontrado})`
        : `CRC16 INVÁLIDO (${res.crcEncontrado || "AUSENTE"} != ${res.crcEsperado || "N/A"})`;
      intBadge.style.color = res.crcValido ? "#34D399" : "#F87171";

      tituloEl.textContent = d.recebedor;
      subEl.textContent = `Cidade: ${d.cidade} • Chave: ${d.chaveRotulo} • TxID: ${d.txId}`;
      valorHero.textContent = d.valorFormatado;
    } else {
      const d = res.dados;
      modBadge.textContent = res.tipoBoleto === "BANCARIO" ? "BOLETO BANCÁRIO FEBRABAN" : "GUIA DE ARRECADAÇÃO / CONVÊNIO";
      intBadge.textContent = res.integridadeValida ? "DVs MATEMATICAMENTE ÍNTEGROS" : "FALHA EM DÍGITO VERIFICADOR";
      intBadge.style.color = res.integridadeValida ? "#34D399" : "#F87171";

      tituloEl.textContent = res.tipoBoleto === "BANCARIO" ? `${d.bancoCodigo} — ${d.bancoNome}` : d.segmentoNome;
      subEl.textContent =
        res.tipoBoleto === "BANCARIO"
          ? `Vencimento: ${d.vencimentoBr} • Formato: ${res.formatoEntrada}`
          : `Tipo de DV: ${d.tipoCalculoDv} • Formato: ${res.formatoEntrada}`;
      valorHero.textContent = d.valorFormatado;
    }

    // Alertas Antifraude
    const alertasWrap = document.getElementById("finAlertasContainer");
    if (res.alertas && res.alertas.length > 0) {
      alertasWrap.innerHTML = res.alertas
        .map((a) => {
          const cor = a.nivel === "critico" ? "#EF4444" : a.nivel === "alto" ? "#F97316" : "#FBBF24";
          return `
            <div class="fin-alert-box" style="border-left: 4px solid ${cor};">
              <div style="font-size: 0.85rem; font-weight: 700; color: ${cor}; margin-bottom: 2px;">
                ${escapeHtml(a.titulo)}
              </div>
              <div style="font-size: 0.8rem; color: var(--color-text-muted); line-height: 1.4;">
                ${escapeHtml(a.detalhe)}
              </div>
            </div>
          `;
        })
        .join("");
    } else {
      alertasWrap.innerHTML = `
        <div class="fin-alert-box" style="border-left: 4px solid #10B981;">
          <div style="font-size: 0.85rem; font-weight: 700; color: #34D399;">
            Validação Estrutural e Matemática Aprovada
          </div>
          <div style="font-size: 0.8rem; color: var(--color-text-muted); margin-top: 2px;">
            ${escapeHtml(res.checklistFraude || "Nenhuma inconsistência estrutural detectada no payload informado.")}
          </div>
        </div>
      `;
    }

    // Pivô OSINT
    renderizarPivosOsint(res);

    // Cards detalhados + Tabela técnica
    const grid = document.getElementById("finCardsGrid");
    const tabelaWrap = document.getElementById("finTabelaContainer");
    const tabelaTitulo = document.getElementById("finTabelaTitulo");
    const tabelaBadge = document.getElementById("finTabelaBadge");

    if (res.modalidade === "pix") {
      const d = res.dados;
      grid.innerHTML = `
        <div class="card">
          <div class="card-header">
            <div class="card-title"><i data-lucide="user-check" style="color: #34D399;"></i><span>Beneficiário &amp; Chave PIX</span></div>
            <span class="badge badge-purple">${escapeHtml(d.chaveTipo)}</span>
          </div>
          <div class="card-body">
            ${renderKv("Recebedor (Tag 59)", d.recebedor, { color: "#FFFFFF" })}
            ${renderKv("Tipo de Chave", d.chaveRotulo)}
            ${renderKv("Chave PIX (Tag 26.01)", d.chaveFormatada || "Não embutida (QR Dinâmico)", { mono: true, color: "#38BDF8" })}
            ${renderKv("Cidade / País", `${d.cidade} / ${d.pais}`)}
            ${d.cep ? renderKv("CEP Declarado", d.cep, { mono: true }) : ""}
            ${renderKv("Descrição (Tag 26.02)", d.descricao || "Não informada")}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title"><i data-lucide="shield-check" style="color: #A78BFA;"></i><span>Parâmetros EMV &amp; Auditoria CRC</span></div>
            <span class="badge badge-dark">${escapeHtml(res.tipoQr)}</span>
          </div>
          <div class="card-body">
            ${renderKv("GUI do Arranjo", d.gui || "Ausente", { mono: true })}
            ${renderKv("Valor (Tag 54)", d.valorFormatado, { mono: true, color: "#34D399" })}
            ${renderKv("Moeda / MCC", `${d.moedaNome} • MCC ${d.mcc}`)}
            ${renderKv("TxID / Referência (Tag 62.05)", d.txId, { mono: true })}
            ${d.urlQrDinamico ? renderKv("URL Payload Dinâmico", d.urlQrDinamico, { mono: true, color: "#38BDF8" }) : ""}
            ${renderKv("CRC16 Encontrado / Esperado", `${res.crcEncontrado || "N/A"} / ${res.crcEsperado || "N/A"}`, { mono: true, color: res.crcValido ? "#34D399" : "#F87171" })}
          </div>
        </div>
      `;

      tabelaTitulo.textContent = "Árvore de Tags EMV (TLV BR Code)";
      tabelaBadge.textContent = `${res.tlv.length} Tags Raiz`;
      tabelaWrap.innerHTML = `
        <table class="fin-tlv-table">
          <thead>
            <tr>
              <th>Tag</th>
              <th>Descrição EMV / BACEN</th>
              <th>Tam.</th>
              <th>Valor Bruto Extraído</th>
            </tr>
          </thead>
          <tbody>
            ${res.tlv
              .map(
                (t) => `
              <tr>
                <td><code style="color: #A78BFA; font-weight: 700;">${escapeHtml(t.id)}</code></td>
                <td>${escapeHtml(t.label)}</td>
                <td style="font-family: var(--font-mono); color: var(--color-text-dim);">${escapeHtml(String(t.length))}</td>
                <td style="font-family: var(--font-mono); word-break: break-all;">${escapeHtml(t.value)}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      `;
    } else {
      const d = res.dados;
      if (res.tipoBoleto === "BANCARIO") {
        grid.innerHTML = `
          <div class="card">
            <div class="card-header">
              <div class="card-title"><i data-lucide="landmark" style="color: #60A5FA;"></i><span>Instituição Emissora &amp; Valor</span></div>
              <span class="badge badge-purple">COMPE ${escapeHtml(d.bancoCodigo)}</span>
            </div>
            <div class="card-body">
              ${renderKv("Banco Emissor", `${d.bancoCodigo} — ${d.bancoNome}`, { color: d.bancoReconhecido ? "#FFFFFF" : "#F87171" })}
              ${renderKv("Moeda", d.moedaNome)}
              ${renderKv("Valor Nominal", d.valorFormatado, { mono: true, color: "#34D399" })}
              ${renderKv("Vencimento (Ciclo Atual)", d.vencimentoBr, { mono: true, color: "#38BDF8" })}
              ${renderKv("Fator / Ciclo Aplicado", `${d.fatorVencimento} (${d.cicloVencimento})`)}
              ${d.vencimentoCicloLegadoBr && d.vencimentoCicloLegadoBr !== d.vencimentoBr ? renderKv("Ref. Ciclo Legado (1997)", d.vencimentoCicloLegadoBr, { mono: true }) : ""}
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title"><i data-lucide="check-circle-2" style="color: #A78BFA;"></i><span>Integridade FEBRABAN (Mod 10 / 11)</span></div>
              <span class="badge badge-dark">44 / 47 Dígitos</span>
            </div>
            <div class="card-body">
              ${renderKv("Campo 1 (Mod 10)", d.validacoesCampos.campo1 ? "Válido" : "INVÁLIDO", { color: d.validacoesCampos.campo1 ? "#34D399" : "#F87171" })}
              ${renderKv("Campo 2 (Mod 10)", d.validacoesCampos.campo2 ? "Válido" : "INVÁLIDO", { color: d.validacoesCampos.campo2 ? "#34D399" : "#F87171" })}
              ${renderKv("Campo 3 (Mod 10)", d.validacoesCampos.campo3 ? "Válido" : "INVÁLIDO", { color: d.validacoesCampos.campo3 ? "#34D399" : "#F87171" })}
              ${renderKv("DAC Geral (Mod 11)", `${d.dacValido ? "Válido" : "INVÁLIDO"} (${d.dacGeral} / esp. ${d.dacEsperado})`, { mono: true, color: d.dacValido ? "#34D399" : "#F87171" })}
              ${renderKv("Campo Livre (25d)", d.campoLivre, { mono: true })}
            </div>
          </div>
        `;
      } else {
        grid.innerHTML = `
          <div class="card">
            <div class="card-header">
              <div class="card-title"><i data-lucide="receipt" style="color: #FBBF24;"></i><span>Segmento &amp; Convênio Arrecadação</span></div>
              <span class="badge badge-purple">Segmento ${escapeHtml(d.segmentoCodigo)}</span>
            </div>
            <div class="card-body">
              ${renderKv("Segmento FEBRABAN", d.segmentoNome, { color: "#FFFFFF" })}
              ${renderKv("Valor Extraído", d.valorFormatado, { mono: true, color: "#34D399" })}
              ${renderKv("Identificador Valor/Ref.", `${d.identificadorValorCodigo} (${d.tipoCalculoDv})`)}
              ${renderKv("Código Órgão / Empresa", d.empresaOrgaoCodigo, { mono: true })}
              ${d.cnpjParcialOuIdentificador ? renderKv("Raiz CNPJ / Prefixo", d.cnpjParcialOuIdentificador, { mono: true }) : ""}
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title"><i data-lucide="shield-check" style="color: #A78BFA;"></i><span>Auditoria de Dígitos Verificadores</span></div>
              <span class="badge badge-dark">48 / 44 Dígitos</span>
            </div>
            <div class="card-body">
              ${renderKv("DV Geral", `${d.dacValido ? "Válido" : "INVÁLIDO"} (${d.dacGeral} / esp. ${d.dacEsperado})`, { mono: true, color: d.dacValido ? "#34D399" : "#F87171" })}
              ${d.blocosValidos ? renderKv("DVs dos 4 Blocos", d.blocosValidos.map((ok, i) => `B${i + 1}:${ok ? "OK" : "ERR"}`).join(" • "), { mono: true }) : ""}
              ${renderKv("Campo Livre Convênio", d.campoLivre, { mono: true })}
            </div>
          </div>
        `;
      }

      tabelaTitulo.textContent = "Representações Convertidas (Linha Digitável <-> Código de Barras 44d)";
      tabelaBadge.textContent = res.tipoBoleto;
      tabelaWrap.innerHTML = `
        <table class="fin-tlv-table">
          <thead>
            <tr>
              <th>Representação</th>
              <th>Sequência Completa</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Linha Digitável Formatada</strong></td>
              <td style="font-family: var(--font-mono); color: #38BDF8;">${escapeHtml(d.linhaDigitavelFormatada)}</td>
            </tr>
            <tr>
              <td><strong>Linha Digitável Numérica</strong></td>
              <td style="font-family: var(--font-mono);">${escapeHtml(d.linhaDigitavel)}</td>
            </tr>
            <tr>
              <td><strong>Código de Barras (44 posições)</strong></td>
              <td style="font-family: var(--font-mono); color: #A78BFA;">${escapeHtml(d.codigoBarras)}</td>
            </tr>
          </tbody>
        </table>
      `;
    }

    if (typeof lucide !== "undefined") {
      lucide.createIcons();
    }
  }

  function renderizarPivosOsint(res) {
    const pivotRow = document.getElementById("finPivotActions");
    const wrap = document.getElementById("finPivotButtonsWrap");
    const buttons = [];

    if (res.modalidade === "pix") {
      const d = res.dados;
      if (d.documentoPivote) {
        const tipo = d.documentoPivote.tipo;
        const val = d.documentoPivote.valor;
        buttons.push(`
          <a href="/advanced/person?tipo=${encodeURIComponent(tipo)}&termo=${encodeURIComponent(val)}&auto=1" class="btn btn-primary btn-sm">
            <i data-lucide="search" style="width: 13px; height: 13px;"></i>
            Investigar ${tipo.toUpperCase()} Titular
          </a>
        `);
        buttons.push(`
          <a href="/basic/processos?tipo=documento&termo=${encodeURIComponent(val)}" class="btn btn-secondary btn-sm">
            <i data-lucide="scale" style="width: 13px; height: 13px;"></i>
            Buscar Processos Judiciais
          </a>
        `);
      }

      const domAlvo = d.dominioPsp || d.dominioEmail;
      if (domAlvo) {
        buttons.push(`
          <a href="/basic/dominio?dominio=${encodeURIComponent(domAlvo)}" class="btn btn-secondary btn-sm">
            <i data-lucide="globe" style="width: 13px; height: 13px;"></i>
            Auditar Domínio (${escapeHtml(domAlvo)})
          </a>
        `);
      }

      if (d.chave) {
        buttons.push(`
          <a href="/advanced/zeroy?id=pix-bacen" class="btn btn-outline btn-sm">
            <i data-lucide="landmark" style="width: 13px; height: 13px;"></i>
            Consultar Chave no Zeroy BACEN
          </a>
        `);
      }
    } else if (res.dados?.bancoNome) {
      buttons.push(`
        <a href="/advanced/person?tipo=nome&termo=${encodeURIComponent(res.dados.bancoNome)}" class="btn btn-secondary btn-sm">
          <i data-lucide="building-2" style="width: 13px; height: 13px;"></i>
          Pesquisar Banco Emissor
        </a>
      `);
    }

    if (buttons.length > 0) {
      wrap.innerHTML = buttons.join("");
      pivotRow.style.display = "flex";
    } else {
      pivotRow.style.display = "none";
      wrap.innerHTML = "";
    }
  }

  document.getElementById("btnCopiarResumoFin")?.addEventListener("click", () => {
    if (!ultimoResultado) return;
    window.copyToClipboard?.(JSON.stringify(ultimoResultado.dados, null, 2), "Resumo copiado para a área de transferência!");
  });

  // Modal Relatório Dark
  const modalFin = document.getElementById("modalRelatorioFin");
  const modalBody = document.getElementById("modalRelatorioFinBody");

  document.getElementById("btnGerarRelatorioFin")?.addEventListener("click", () => {
    if (!ultimoResultado || !window.OsintDarkReport) return;
    const html = window.OsintDarkReport.renderFinanceiroBrReport({
      termo:
        ultimoResultado.modalidade === "pix"
          ? ultimoResultado.dados.recebedor
          : ultimoResultado.dados.linhaDigitavelFormatada,
      resultado: ultimoResultado,
    });
    modalBody.innerHTML = html;
    modalFin.style.display = "flex";
  });

  document.getElementById("btnFecharModalFin")?.addEventListener("click", () => {
    if (modalFin) modalFin.style.display = "none";
  });

  document.getElementById("btnHtmlFin")?.addEventListener("click", () => {
    if (!modalBody?.innerHTML || !window.OsintDarkReport) return;
    window.OsintDarkReport.downloadHtml({
      innerHtml: modalBody.innerHTML,
      titlePrefix: "dossie-financeiro-br",
      termo: ultimoResultado?.modalidade || "financeiro",
    });
  });

  document.getElementById("btnPdfFin")?.addEventListener("click", () => {
    if (!modalBody?.innerHTML || !window.OsintDarkReport) return;
    window.OsintDarkReport.exportPdf({
      innerHtml: modalBody.innerHTML,
      titleText: "Dossiê Forense Financeiro — RimuBusca OSINT",
    });
  });
});
