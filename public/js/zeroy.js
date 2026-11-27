/**
 * ==============================================================================
 * RIMUBUSCA - CENTRAL ZEROY API FRONTEND (ZEROY.JS)
 * Gerenciamento de abas veiculares e cadastrais, consulta via /api/zeroy/consultar
 * e delegação para interpretadores visuais modulares (window.RimuInterpreters).
 * ==============================================================================
 */

(function () {
  "use strict";

  const METADADOS_ABAS = {
    placa: {
      label: "Placa do Veículo (Mercosul ou Padrão)",
      placeholder: "Ex: BRA2E19 ou ABC1234",
      mask: (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7),
    },
    frota: {
      label: "CPF ou CNPJ do Titular da Frota",
      placeholder: "Ex: 000.000.000-00",
      mask: (v) => (window.masks?.cpf ? window.masks.cpf(v) : v),
    },
    chassi: {
      label: "Número do Chassi (VIN)",
      placeholder: "Ex: 9BWZZZ377VT004251",
      mask: (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 17),
    },
    motor: {
      label: "Número / Bloco do Motor",
      placeholder: "Ex: L15B755219",
      mask: (v) => v.toUpperCase().trim(),
    },
    renavam: {
      label: "Código do Renavam",
      placeholder: "Ex: 01238914029",
      mask: (v) => v.replace(/\D/g, "").slice(0, 11),
    },
    cnh: {
      label: "CPF do Condutor para Consulta de CNH",
      placeholder: "Ex: 000.000.000-00",
      mask: (v) => (window.masks?.cpf ? window.masks.cpf(v) : v),
    },
    crlv: {
      label: "Placa do Veículo para Emissão CRLV-e",
      placeholder: "Ex: BRA2E19",
      mask: (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7),
    },
    cpf: {
      label: "Número do CPF (Zeroy Cadastral Completo)",
      placeholder: "Ex: 000.000.000-00",
      mask: (v) => (window.masks?.cpf ? window.masks.cpf(v) : v),
    },
    cnpj: {
      label: "Número do CNPJ da Empresa",
      placeholder: "Ex: 00.000.000/0001-00",
      mask: (v) => v.replace(/\D/g, "").slice(0, 14),
    },
    nome: {
      label: "Nome Completo para Investigação Nominal",
      placeholder: "Ex: Carlos Eduardo da Silva Pereira",
      mask: (v) => v,
    },
    telefone: {
      label: "Telefone com DDD",
      placeholder: "Ex: (11) 98765-4321",
      mask: (v) => (window.masks?.telefone ? window.masks.telefone(v) : v),
    },
    relacionados: {
      label: "CPF para Mapeamento de Parentes / Sócios",
      placeholder: "Ex: 000.000.000-00",
      mask: (v) => (window.masks?.cpf ? window.masks.cpf(v) : v),
    },
    inss: {
      label: "CPF para Consulta Previdenciária INSS",
      placeholder: "Ex: 000.000.000-00",
      mask: (v) => (window.masks?.cpf ? window.masks.cpf(v) : v),
    },
    rg: {
      label: "CPF para Localização de RG",
      placeholder: "Ex: 000.000.000-00",
      mask: (v) => (window.masks?.cpf ? window.masks.cpf(v) : v),
    },
    mae: {
      label: "CPF para Localização da Filiação Materna",
      placeholder: "Ex: 000.000.000-00",
      mask: (v) => (window.masks?.cpf ? window.masks.cpf(v) : v),
    },
    pai: {
      label: "CPF para Localização da Filiação Paterna",
      placeholder: "Ex: 000.000.000-00",
      mask: (v) => (window.masks?.cpf ? window.masks.cpf(v) : v),
    },
    obito: {
      label: "CPF para Checagem de Óbito em Cartórios",
      placeholder: "Ex: 000.000.000-00",
      mask: (v) => (window.masks?.cpf ? window.masks.cpf(v) : v),
    },
    renda: {
      label: "CPF para Renda Presumida e Capacidade",
      placeholder: "Ex: 000.000.000-00",
      mask: (v) => (window.masks?.cpf ? window.masks.cpf(v) : v),
    },
    bens: {
      label: "CPF ou CNPJ para Levantamento de Bens",
      placeholder: "Ex: 000.000.000-00",
      mask: (v) => (window.masks?.cpf ? window.masks.cpf(v) : v),
    },
    cep: {
      label: "Código do CEP",
      placeholder: "Ex: 01310-100",
      mask: (v) => v.replace(/\D/g, "").slice(0, 8),
    },
    titulo: {
      label: "CPF ou Nº do Título de Eleitor",
      placeholder: "Ex: 000.000.000-00",
      mask: (v) => v,
    },
    sus: {
      label: "CPF para Cartão SUS (CNS)",
      placeholder: "Ex: 000.000.000-00",
      mask: (v) => (window.masks?.cpf ? window.masks.cpf(v) : v),
    },
    foto: {
      label: "CPF para Recuperação de Foto / Face",
      placeholder: "Ex: 000.000.000-00",
      mask: (v) => (window.masks?.cpf ? window.masks.cpf(v) : v),
    },
    score: {
      label: "CPF para Avaliação de Score de Crédito",
      placeholder: "Ex: 000.000.000-00",
      mask: (v) => (window.masks?.cpf ? window.masks.cpf(v) : v),
    },
    vizinhos: {
      label: "CEP ou Endereço para Mapeamento de Vizinhos",
      placeholder: "Ex: 01310-100",
      mask: (v) => v,
    },
    gravame: {
      label: "Placa para Consulta de Gravame e Restrição",
      placeholder: "Ex: BRA2E19",
      mask: (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7),
    },
    multas: {
      label: "Placa para Débitos, IPVA e Multas",
      placeholder: "Ex: BRA2E19",
      mask: (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7),
    },
    "roubo-furto": {
      label: "Placa para Checagem Policial de Roubo e Furto",
      placeholder: "Ex: BRA2E19",
      mask: (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7),
    },
    proprietario: {
      label: "Placa para Identificação de Proprietário",
      placeholder: "Ex: BRA2E19",
      mask: (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7),
    },
    "frota-pesada": {
      label: "Placa de Caminhão / Frota Pesada",
      placeholder: "Ex: BRA2E19",
      mask: (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7),
    },
    scr: {
      label: "CPF ou CNPJ para SCR Bacen",
      placeholder: "Ex: 000.000.000-00",
      mask: (v) => v,
    },
    ccs: {
      label: "CPF ou CNPJ para Bacen CCS",
      placeholder: "Ex: 000.000.000-00",
      mask: (v) => v,
    },
    restricoes: {
      label: "CPF ou CNPJ para Restrições Comerciais",
      placeholder: "Ex: 000.000.000-00",
      mask: (v) => v,
    },
    protestos: {
      label: "CPF ou CNPJ para Protestos em Cartório",
      placeholder: "Ex: 000.000.000-00",
      mask: (v) => v,
    },
    ccf: {
      label: "CPF ou CNPJ para Cheques sem Fundo",
      placeholder: "Ex: 000.000.000-00",
      mask: (v) => v,
    },
    risco: {
      label: "CPF para Risco de Crédito",
      placeholder: "Ex: 000.000.000-00",
      mask: (v) => v,
    },
    "dividas-ativas": {
      label: "CPF ou CNPJ para Dívida Ativa da União",
      placeholder: "Ex: 000.000.000-00",
      mask: (v) => v,
    },
    falencia: {
      label: "CNPJ da Empresa para Falência e Recuperação",
      placeholder: "Ex: 00.000.000/0001-00",
      mask: (v) => v.replace(/\D/g, "").slice(0, 14),
    },
    processos: {
      label: "Nome, CPF ou Nº do Processo Judicial (CNJ)",
      placeholder: "Ex: Nome ou 0000000-00.0000.0.00.0000",
      mask: (v) => v,
    },
    diarios: {
      label: "Nome Completo para Citações em Diários Oficiais",
      placeholder: "Ex: Carlos Eduardo da Silva Pereira",
      mask: (v) => v,
    },
  };

  const DOM = {
    form: document.getElementById("formZeroyConsulta"),
    tipoInput: document.getElementById("zeroyTipoInput"),
    pathInput: document.getElementById("zeroyPathInput"),
    textInputRow: document.getElementById("zeroyTextInputRow"),
    termoInput: document.getElementById("zeroyTermoInput"),
    reconncPanel: document.getElementById("zeroyReconncPanel"),
    reconncFile: document.getElementById("zeroyReconncFile"),
    reconncDropzone: document.getElementById("zeroyReconncDropzone"),
    reconncPrompt: document.getElementById("zeroyReconncPrompt"),
    reconncPreview: document.getElementById("zeroyReconncPreview"),
    reconncPreviewImg: document.getElementById("zeroyReconncPreviewImg"),
    reconncFileName: document.getElementById("zeroyReconncFileName"),
    reconncFileMeta: document.getElementById("zeroyReconncFileMeta"),
    reconncCropBadge: document.getElementById("zeroyReconncCropBadge"),
    btnAbrirCropperReconnc: document.getElementById("btnAbrirCropperReconnc"),
    btnUsarOriginalReconnc: document.getElementById("btnUsarOriginalReconnc"),
    btnRemoverFotoReconnc: document.getElementById("btnRemoverFotoReconnc"),
    reconncCropBox: document.getElementById("zeroyReconncCropBox"),
    reconncShapes: document.getElementById("zeroyReconncShapes"),
    reconncCropStage: document.getElementById("zeroyReconncCropStage"),
    reconncCropImg: document.getElementById("zeroyReconncCropImg"),
    reconncCropSelection: document.getElementById("zeroyReconncCropSelection"),
    reconncCropInfo: document.getElementById("zeroyReconncCropInfo"),
    btnResetarCropReconnc: document.getElementById("btnResetarCropReconnc"),
    btnCancelarCropReconnc: document.getElementById("btnCancelarCropReconnc"),
    btnAplicarCropReconnc: document.getElementById("btnAplicarCropReconnc"),
    reconncTopK: document.getElementById("zeroyReconncTopK"),
    reconncThreshold: document.getElementById("zeroyReconncThreshold"),
    btnReconncSubmit: document.getElementById("btnZeroyReconncSubmit"),
    btnReconncText: document.getElementById("btnZeroyReconncText"),
    bancoInput: document.getElementById("zeroyBancoInput"),
    filtrosExtras: document.getElementById("zeroyFiltrosExtras"),
    selectTipoPixContainer: document.getElementById("zeroySelectTipoPixContainer"),
    selectTipoPix: document.getElementById("zeroySelectTipoPix"),
    tipoPixParamHint: document.getElementById("zeroyTipoPixParamHint"),
    detectadoRow: document.getElementById("zeroyDetectadoRow"),
    detectadoTexto: document.getElementById("zeroyTipoDetectadoTexto"),
    detectadoBadge: document.getElementById("zeroyTipoDetectadoBadge"),
    labelInput: document.getElementById("zeroyInputLabel"),
    pathBadge: document.getElementById("zeroyPathBadge"),
    custoBadge: document.getElementById("zeroyCustoBadge"),
    btnSubmit: document.getElementById("btnZeroyConsultar"),
    btnText: document.getElementById("btnZeroyText"),
    tabsBar: document.getElementById("zeroyTabsBar"),
    tabBtns: document.querySelectorAll("#zeroyTabsBar .tipo-tab-btn"),
    demoBtns: document.querySelectorAll(".demo-consulta-btn"),
    loading: document.getElementById("zeroyLoading"),
    resultsArea: document.getElementById("zeroyResultsArea"),
    resultsContent: document.getElementById("zeroyResultsContent"),
    rawJson: document.getElementById("zeroyRawJson"),
    rawJsonContainer: document.getElementById("zeroyRawJsonContainer"),
    timestamp: document.getElementById("resZeroyTimestamp"),
    fonteBadge: document.getElementById("resZeroyFonteBadge"),
    debitoBadge: document.getElementById("resZeroyDebitoBadge"),
    saldoBadge: document.getElementById("resZeroySaldoBadge"),
    headerSaldoDisplay: document.getElementById("zeroyHeaderSaldoDisplay"),
    btnCopiarJson: document.getElementById("btnCopiarJsonZeroy"),
    fotoModal: document.getElementById("zeroyFotoModal"),
    imgModal: document.getElementById("imgZeroyModal"),
    legendaModal: document.getElementById("legendaZeroyModal"),
    btnFecharModal: document.getElementById("btnFecharFotoModal"),
  };

  const CONFIG_TIPO_PIX_BACEN = {
    cpf_titular: {
      label: "CPF do Titular da Conta (Bacen SPI)",
      placeholder: "Ex: 000.000.000-00",
      paramHint: "Param Zeroy: cpf",
      parametro: "cpf",
      mask: "cpf",
    },
    chave_cpf: {
      label: "Chave PIX: CPF",
      placeholder: "Ex: 000.000.000-00",
      paramHint: "Param Zeroy: chave",
      parametro: "chave",
      mask: "cpf",
    },
    chave_cnpj: {
      label: "Chave PIX: CNPJ da Empresa",
      placeholder: "Ex: 00.000.000/0001-00",
      paramHint: "Param Zeroy: chave",
      parametro: "chave",
      mask: "cnpj",
    },
    chave_telefone: {
      label: "Chave PIX: Telefone / Celular com DDD",
      placeholder: "Ex: (11) 98765-4321",
      paramHint: "Param Zeroy: chave",
      parametro: "chave",
      mask: "telefone",
    },
    chave_email: {
      label: "Chave PIX: E-mail",
      placeholder: "Ex: usuario@exemplo.com.br",
      paramHint: "Param Zeroy: chave",
      parametro: "chave",
      mask: "email",
    },
    chave_evp: {
      label: "Chave PIX: EVP / Chave Aleatória (UUID)",
      placeholder: "Ex: 123e4567-e89b-12d3-a456-426614174000",
      paramHint: "Param Zeroy: chave",
      parametro: "chave",
      mask: "evp",
    },
  };

  function formatarTermoPorTipoPix(tipoMascara, valor) {
    if (!valor) return "";
    if (tipoMascara === "cpf") return formatarTermoPorParametro("cpf", valor);
    if (tipoMascara === "cnpj") return formatarTermoPorParametro("cnpj", valor);
    if (tipoMascara === "telefone") return formatarTermoPorParametro("telefone", valor);
    if (tipoMascara === "email") return valor.trim().toLowerCase();
    if (tipoMascara === "evp") return valor.trim().toLowerCase();
    return valor;
  }

  function atualizarConfiguracaoPixBacen(tipoEscolhido) {
    const config = CONFIG_TIPO_PIX_BACEN[tipoEscolhido] || CONFIG_TIPO_PIX_BACEN.cpf_titular;
    if (DOM.labelInput) DOM.labelInput.textContent = config.label;
    if (DOM.tipoPixParamHint) DOM.tipoPixParamHint.textContent = config.paramHint;
    if (DOM.termoInput) {
      DOM.termoInput.placeholder = config.placeholder;
      if (DOM.termoInput.value) {
        DOM.termoInput.value = formatarTermoPorTipoPix(config.mask, DOM.termoInput.value);
      }
    }
  }

  let moduloAtivoAtual = null;
  let originalReconncFile = null;
  let selectedReconncFile = null;
  let reconncPreviewUrl = null;
  let reconncCropper = null;
  let activeCropShapeLabel = "";
  let lastRenderedTermo = "";

  function formatBytesLabel(bytes) {
    const kb = Math.max(1, Math.round((Number(bytes) || 0) / 1024));
    return kb >= 1024 ? `${(kb / 1024).toFixed(2)} MB` : `${kb} KB`;
  }

  function atualizarPreviewReconncUi(file, cropped = false, shapeLabel = "") {
    if (!file) return;
    if (reconncPreviewUrl) {
      try {
        URL.revokeObjectURL(reconncPreviewUrl);
      } catch {}
    }
    reconncPreviewUrl = URL.createObjectURL(file);

    if (DOM.reconncPreviewImg) DOM.reconncPreviewImg.src = reconncPreviewUrl;
    if (DOM.reconncFileName) DOM.reconncFileName.textContent = file.name || "foto_facial.jpg";

    if (DOM.reconncCropBadge) {
      if (cropped) {
        DOM.reconncCropBadge.textContent = shapeLabel ? `Recorte • ${shapeLabel}` : "Recorte Ativo";
        DOM.reconncCropBadge.style.display = "inline-flex";
      } else {
        DOM.reconncCropBadge.style.display = "none";
      }
    }
    if (DOM.btnUsarOriginalReconnc) {
      DOM.btnUsarOriginalReconnc.style.display = cropped ? "inline-flex" : "none";
    }
    if (DOM.reconncFileMeta) {
      if (cropped && originalReconncFile && originalReconncFile.size > 0) {
        const pct = Math.max(0, Math.round((1 - file.size / originalReconncFile.size) * 100));
        const reductionText = pct > 0 ? ` (${pct}% menor)` : "";
        DOM.reconncFileMeta.textContent = `Original ${formatBytesLabel(originalReconncFile.size)} → Recorte ${formatBytesLabel(file.size)}${reductionText}`;
      } else {
        DOM.reconncFileMeta.textContent = `${formatBytesLabel(file.size)} • Otimização e Base64 automáticos no envio`;
      }
    }
  }

  function fecharCropperReconnc() {
    if (DOM.reconncCropBox) DOM.reconncCropBox.style.display = "none";
  }

  function garantirCropperInicializado() {
    if (reconncCropper || !window.RimuImageCropper || !DOM.reconncCropStage || !DOM.reconncCropImg || !DOM.reconncCropSelection) {
      return reconncCropper;
    }
    reconncCropper = new window.RimuImageCropper({
      stageEl: DOM.reconncCropStage,
      imgEl: DOM.reconncCropImg,
      selectionEl: DOM.reconncCropSelection,
      onChange: (info) => {
        activeCropShapeLabel = info.shapeLabel;
        if (DOM.reconncCropInfo) {
          DOM.reconncCropInfo.textContent = `${info.shapeLabel} • ${info.width} × ${info.height} px (de ${info.naturalWidth} × ${info.naturalHeight} px)`;
        }
      },
    });
    return reconncCropper;
  }

  async function abrirCropperReconnc() {
    const baseFile = originalReconncFile || selectedReconncFile;
    if (!baseFile || !DOM.reconncCropBox) return;
    DOM.reconncCropBox.style.display = "block";
    const cropper = garantirCropperInicializado();
    if (!cropper) return;
    try {
      await cropper.loadFile(baseFile);
      if (window.renderLucide) window.renderLucide();
    } catch {
      window.toast?.warning("Não foi possível carregar o editor de recorte para esta imagem.");
      fecharCropperReconnc();
    }
  }

  async function aplicarRecorteReconnc({ silent = false } = {}) {
    if (!reconncCropper || !originalReconncFile) return false;
    try {
      const croppedFile = await reconncCropper.exportCroppedFile(0.9);
      selectedReconncFile = croppedFile;
      atualizarPreviewReconncUi(croppedFile, true, activeCropShapeLabel);
      fecharCropperReconnc();
      if (!silent) {
        window.toast?.success(`Recorte aplicado (${formatBytesLabel(croppedFile.size)})! Pronto para buscar.`);
      }
      return true;
    } catch (err) {
      if (!silent) {
        window.toast?.error(err.message || "Falha ao recortar imagem.");
      }
      return false;
    }
  }

  function restaurarImagemOriginalReconnc() {
    if (!originalReconncFile) return;
    selectedReconncFile = originalReconncFile;
    atualizarPreviewReconncUi(originalReconncFile, false);
    fecharCropperReconnc();
    window.toast?.info("Imagem original restaurada.");
  }

  function limparArquivoReconnc() {
    originalReconncFile = null;
    selectedReconncFile = null;
    activeCropShapeLabel = "";
    if (reconncPreviewUrl) {
      try {
        URL.revokeObjectURL(reconncPreviewUrl);
      } catch {}
      reconncPreviewUrl = null;
    }
    fecharCropperReconnc();
    if (DOM.reconncFile) DOM.reconncFile.value = "";
    if (DOM.reconncPreviewImg) DOM.reconncPreviewImg.src = "";
    if (DOM.reconncPreview) DOM.reconncPreview.style.display = "none";
    if (DOM.reconncPrompt) DOM.reconncPrompt.style.display = "block";
    if (DOM.reconncCropBadge) DOM.reconncCropBadge.style.display = "none";
    if (DOM.btnUsarOriginalReconnc) DOM.btnUsarOriginalReconnc.style.display = "none";
  }

  function definirArquivoReconnc(file) {
    if (!file) return;
    if (!String(file.type || "").startsWith("image/")) {
      window.toast?.warning("Selecione um arquivo de imagem válido (JPG, PNG ou WEBP).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      window.toast?.warning("A imagem selecionada excede o limite de 10 MB.");
      return;
    }

    originalReconncFile = file;
    selectedReconncFile = file;
    activeCropShapeLabel = "";
    fecharCropperReconnc();
    atualizarPreviewReconncUi(file, false);

    if (DOM.reconncPrompt) DOM.reconncPrompt.style.display = "none";
    if (DOM.reconncPreview) DOM.reconncPreview.style.display = "flex";
  }

  /**
   * Reconhecimento inteligente do formato da entrada digitada pelo usuário
   */
  function detectarFormatoEntrada(valor, modId) {
    if (!valor) return null;

    const mid = String(modId || moduloAtivoAtual?.id || "").toLowerCase();
    const param = String(moduloAtivoAtual?.parametro || "").toLowerCase();

    // Se estiver no módulo Telefone: NUNCA tenta identificar formato (módulo exclusivo de telefone, envia apenas números)
    if (mid === "telefone" || mid.includes("telefone") || param === "telefone") {
      return null;
    }

    const v = String(valor).trim();
    const digits = v.replace(/\D/g, "");

    // Para o módulo Chave PIX: aceita ESTRITAMENTE CPF ou CNPJ
    if (modId === "chave-pix") {
      if (digits.length === 14) {
        return { tipo: "cnpj", label: "CNPJ da Pessoa Jurídica" };
      }
      if (digits.length === 11) {
        return { tipo: "cpf", label: "CPF do Titular da Chave PIX" };
      }
      if (v.includes("@") || (v.includes("-") && v.length > 20)) {
        return { tipo: "aviso", label: "Apenas CPF ou CNPJ aceitos neste módulo" };
      }
      return null;
    }

    // Para o módulo PIX Bacen: valida e formata de acordo com a opção selecionada no select
    if (modId === "pix-bacen") {
      const tipoPix = DOM.selectTipoPix ? DOM.selectTipoPix.value : "cpf_titular";
      if (tipoPix === "cpf_titular") {
        if (digits.length === 11) return { tipo: "cpf", label: "CPF do Titular Bacen SPI (param 'cpf')" };
        return null;
      }
      if (tipoPix === "chave_cpf") {
        if (digits.length === 11) return { tipo: "cpf", label: "Chave PIX: CPF (param 'chave')" };
        return null;
      }
      if (tipoPix === "chave_cnpj") {
        if (digits.length === 14) return { tipo: "cnpj", label: "Chave PIX: CNPJ (param 'chave')" };
        return null;
      }
      if (tipoPix === "chave_telefone") {
        if (digits.length >= 10) return { tipo: "telefone", label: "Chave PIX: Telefone (param 'chave')" };
        return null;
      }
      if (tipoPix === "chave_email") {
        if (v.includes("@") && v.includes(".")) return { tipo: "email", label: "Chave PIX: E-mail (param 'chave')" };
        return null;
      }
      if (tipoPix === "chave_evp") {
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) {
          return { tipo: "evp", label: "Chave PIX: EVP Válida (param 'chave')" };
        }
        return null;
      }
      return null;
    }

    if (v.includes("@") && v.includes(".")) {
      return { tipo: "email", label: "Chave PIX (E-mail)" };
    }
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) {
      return { tipo: "evp", label: modId === "pix-sisbajud" ? "UUID Judicial / Chave" : "Chave PIX (EVP / UUID)" };
    }
    if (digits.length === 14) {
      return { tipo: "cnpj", label: modId === "pix-sisbajud" ? "CNPJ para SISBAJUD" : "CNPJ Identificado" };
    }
    if (digits.length === 11 && !v.startsWith("+55")) {
      return { tipo: "cpf", label: modId === "pix-sisbajud" ? "CPF para SISBAJUD" : (modId === "pix-bacen" ? "CPF do Titular / Chave" : "CPF Identificado") };
    }
    if (v.startsWith("+55") || (v.startsWith("(") && digits.length >= 10)) {
      return { tipo: "telefone", label: "Chave PIX (Telefone)" };
    }
    const cleanAlnum = v.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (cleanAlnum.length === 7 && /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/i.test(cleanAlnum)) {
      return { tipo: "placa", label: "Placa Identificada" };
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
      return { tipo: "data", label: "Data de Nascimento" };
    }
    return null;
  }

  /**
   * Aplicação flexível de máscaras baseada no parâmetro do módulo
   */
  function formatarTermoPorParametro(parametro, valor) {
    if (!valor) return "";
    const p = String(parametro || "").toLowerCase().trim();

    if (p === "cpf") {
      if (window.masks?.cpf) return window.masks.cpf(valor);
      const clean = valor.replace(/\D/g, "").slice(0, 11);
      return clean.replace(/^(\d{3})(\d{3})?(\d{3})?(\d{2})?/, (_, p1, p2, p3, p4) => {
        let r = p1;
        if (p2) r += `.${p2}`;
        if (p3) r += `.${p3}`;
        if (p4) r += `-${p4}`;
        return r;
      });
    }

    if (p === "cnpj") {
      if (window.masks?.cnpj) return window.masks.cnpj(valor);
      const clean = valor.replace(/\D/g, "").slice(0, 14);
      return clean.replace(/^(\d{2})(\d{3})?(\d{3})?(\d{4})?(\d{2})?/, (_, p1, p2, p3, p4, p5) => {
        let r = p1;
        if (p2) r += `.${p2}`;
        if (p3) r += `.${p3}`;
        if (p4) r += `/${p4}`;
        if (p5) r += `-${p5}`;
        return r;
      });
    }

    if (p === "telefone") {
      if (window.masks?.telefone) return window.masks.telefone(valor);
      const raw = String(valor || "").trim();
      let clean = raw.replace(/\D/g, "");
      if ((raw.startsWith("+55") || (clean.length >= 12 && clean.length <= 13)) && clean.startsWith("55")) {
        clean = clean.slice(2);
      }
      if (clean.startsWith("0") && clean.length >= 11) clean = clean.slice(1);
      clean = clean.slice(0, 11);
      if (clean.length > 10) {
        return clean.replace(/^(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
      }
      return clean.replace(/^(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    }

    if (p === "placa") {
      return valor.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
    }

    if (p === "chassi") {
      return valor.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 17);
    }

    if (p === "renavam") {
      return valor.replace(/\D/g, "").slice(0, 11);
    }

    if (p === "cep") {
      const clean = valor.replace(/\D/g, "").slice(0, 8);
      return clean.replace(/^(\d{5})(\d{3})/, "$1-$2");
    }

    if (p === "data" || p === "nascimento") {
      const clean = valor.replace(/\D/g, "").slice(0, 8);
      return clean.replace(/^(\d{2})(\d{2})?(\d{4})?/, (_, d, m, y) => {
        let r = d;
        if (m) r += `/${m}`;
        if (y) r += `/${y}`;
        return r;
      });
    }

    return valor;
  }

  function inicializar() {
    if (!DOM.form) return;

    // Exporta para os interpretadores poderem abrir lightbox de fotos
    window.abrirFotoLightbox = abrirFotoModal;

    // 1. Delegação de cliques nas abas dinâmicas
    document.addEventListener("click", (e) => {
      const tabBtn = e.target.closest("#zeroyTabsBar .tipo-tab-btn");
      if (tabBtn) {
        e.preventDefault();
        const id = tabBtn.getAttribute("data-id") || tabBtn.getAttribute("data-tipo");
        selecionarModulo(id);
        return;
      }

      // Amostras rápidas de teste
      const demoBtn = e.target.closest(".demo-consulta-btn");
      if (demoBtn) {
        e.preventDefault();
        const demoValor = demoBtn.getAttribute("data-demo");
        const demoId = demoBtn.getAttribute("data-demo-id") || demoBtn.getAttribute("data-demo-tipo");
        const demoTipoPix = demoBtn.getAttribute("data-demo-tipo-pix");
        if (demoId) selecionarModulo(demoId);
        if (demoTipoPix && DOM.selectTipoPix) {
          DOM.selectTipoPix.value = demoTipoPix;
          atualizarConfiguracaoPixBacen(demoTipoPix);
        }
        if (DOM.termoInput && demoValor) {
          DOM.termoInput.value = demoValor;
          DOM.termoInput.focus();
        }
        return;
      }
    });

    // 2. Aplicação de máscaras e detecção inteligente de tipo em tempo real
    DOM.termoInput?.addEventListener("input", (e) => {
      const val = e.target.value;
      const modId = moduloAtivoAtual?.id || "";
      const detectado = detectarFormatoEntrada(val, modId);

      if (detectado && DOM.detectadoRow && DOM.detectadoTexto) {
        DOM.detectadoTexto.textContent = detectado.label;
        if (detectado.tipo === "aviso") {
          DOM.detectadoBadge.style.background = "rgba(245, 158, 11, 0.15)";
          DOM.detectadoBadge.style.color = "#F59E0B";
          DOM.detectadoBadge.style.borderColor = "rgba(245, 158, 11, 0.3)";
        } else {
          DOM.detectadoBadge.style.background = "rgba(16, 185, 129, 0.15)";
          DOM.detectadoBadge.style.color = "#10B981";
          DOM.detectadoBadge.style.borderColor = "rgba(16, 185, 129, 0.3)";
        }
        DOM.detectadoRow.style.display = "flex";
      } else if (DOM.detectadoRow) {
        DOM.detectadoRow.style.display = "none";
      }

      // Máscaras adaptativas por módulo
      if (modId === "chave-pix") {
        const digits = val.replace(/\D/g, "");
        if (digits.length > 11) {
          e.target.value = formatarTermoPorParametro("cnpj", val);
        } else {
          e.target.value = formatarTermoPorParametro("cpf", val);
        }
      } else if (modId === "pix-bacen") {
        const tipoPix = DOM.selectTipoPix ? DOM.selectTipoPix.value : "cpf_titular";
        const cfg = CONFIG_TIPO_PIX_BACEN[tipoPix] || CONFIG_TIPO_PIX_BACEN.cpf_titular;
        e.target.value = formatarTermoPorTipoPix(cfg.mask, val);
      } else if (modId === "pix-sisbajud" || modId === "frota") {
        const digits = val.replace(/\D/g, "");
        if (digits.length > 11) {
          e.target.value = formatarTermoPorParametro("cnpj", val);
        } else if (digits.length > 0 && !val.includes("@") && !val.includes("-")) {
          e.target.value = formatarTermoPorParametro("cpf", val);
        }
      } else {
        const parametro = moduloAtivoAtual?.parametro || "cpf";
        e.target.value = formatarTermoPorParametro(parametro, val);
      }
    });

    // 2.1 Listener do select de tipo PIX Bacen
    DOM.selectTipoPix?.addEventListener("change", (e) => {
      atualizarConfiguracaoPixBacen(e.target.value);
      if (DOM.termoInput) DOM.termoInput.focus();
    });

    // 2.2 Upload e Drag-and-Drop de Foto Facial (Reconhecimento Facial Nacional - reconnc)
    DOM.reconncDropzone?.addEventListener("click", (e) => {
      if (e.target.closest("#btnRemoverFotoReconnc, #btnAbrirCropperReconnc, #btnUsarOriginalReconnc")) return;
      DOM.reconncFile?.click();
    });

    DOM.btnAbrirCropperReconnc?.addEventListener("click", (e) => {
      e.stopPropagation();
      abrirCropperReconnc();
    });

    DOM.btnUsarOriginalReconnc?.addEventListener("click", (e) => {
      e.stopPropagation();
      restaurarImagemOriginalReconnc();
    });

    DOM.reconncShapes?.addEventListener("click", (e) => {
      const shapeBtn = e.target.closest(".osint-crop-shape-btn");
      if (!shapeBtn) return;
      const shapeKey = shapeBtn.getAttribute("data-shape");
      DOM.reconncShapes.querySelectorAll(".osint-crop-shape-btn").forEach((b) => {
        b.classList.toggle("active", b === shapeBtn);
      });
      reconncCropper?.setShape(shapeKey);
    });

    DOM.btnResetarCropReconnc?.addEventListener("click", () => {
      reconncCropper?.resetSelection();
    });

    DOM.btnCancelarCropReconnc?.addEventListener("click", () => {
      fecharCropperReconnc();
    });

    DOM.btnAplicarCropReconnc?.addEventListener("click", () => {
      aplicarRecorteReconnc();
    });

    DOM.reconncDropzone?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        DOM.reconncFile?.click();
      }
    });

    DOM.reconncDropzone?.addEventListener("dragover", (e) => {
      e.preventDefault();
      DOM.reconncDropzone.classList.add("is-dragover");
    });

    DOM.reconncDropzone?.addEventListener("dragleave", () => {
      DOM.reconncDropzone.classList.remove("is-dragover");
    });

    DOM.reconncDropzone?.addEventListener("drop", (e) => {
      e.preventDefault();
      DOM.reconncDropzone.classList.remove("is-dragover");
      const file = e.dataTransfer?.files?.[0];
      if (file) definirArquivoReconnc(file);
    });

    DOM.reconncFile?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (file) definirArquivoReconnc(file);
    });

    DOM.btnRemoverFotoReconnc?.addEventListener("click", (e) => {
      e.stopPropagation();
      limparArquivoReconnc();
    });

    // 3. Copiar JSON bruto
    DOM.btnCopiarJson?.addEventListener("click", () => {
      if (!DOM.rawJson) return;
      navigator.clipboard.writeText(DOM.rawJson.textContent).then(() => {
        if (window.toast) window.toast.success("JSON da Zeroy API copiado!");
      });
    });

    // 3.1 Relatório Dark OSINT (Modal, Exportar PDF, Baixar HTML)
    document.getElementById("btnGerarRelatorioZeroy")?.addEventListener("click", () => {
      abrirRelatorioDarkZeroy();
    });

    // 3.2 Grafo Interativo de Vínculos & Link Analysis
    document.getElementById("btnAbrirGrafoZeroy")?.addEventListener("click", () => {
      abrirGrafoZeroy();
    });

    document.getElementById("btnGrafoModalRelatorioZeroy")?.addEventListener("click", () => {
      fecharModalRelatorioZeroy();
      abrirGrafoZeroy();
    });

    document.getElementById("btnFecharModalRelatorioZeroy")?.addEventListener("click", fecharModalRelatorioZeroy);

    document.getElementById("modalRelatorioOsint")?.addEventListener("click", (e) => {
      if (e.target && e.target.id === "modalRelatorioOsint") fecharModalRelatorioZeroy();
    });

    document.getElementById("btnDownloadHtmlRelatorioZeroy")?.addEventListener("click", () => {
      const contentEl = document.getElementById("modalRelatorioContentZeroy");
      if (!contentEl || !window.OsintDarkReport) return;
      const ok = window.OsintDarkReport.downloadHtml({
        innerHtml: contentEl.innerHTML,
        titlePrefix: `zeroy_${DOM.tipoInput?.value || "dossie"}`,
        termo: DOM.termoInput?.value?.trim() || "consulta",
      });
      if (ok && window.toast) window.toast.success("Dossiê Dark HTML baixado com sucesso!");
    });

    document.getElementById("btnGerarPdfRelatorioZeroy")?.addEventListener("click", () => {
      const contentEl = document.getElementById("modalRelatorioContentZeroy");
      if (!contentEl || !window.OsintDarkReport) return;
      window.OsintDarkReport.exportPdf({
        innerHtml: contentEl.innerHTML,
        titleText: `Dossiê OSINT Zeroy - ${DOM.termoInput?.value?.trim() || "Consulta"}`,
      });
    });

    // Intercepta botões internos ".btn-imprimir-dossie" dos interpretadores para abrir o Dossiê Dark limpo
    document.addEventListener(
      "click",
      (e) => {
        const printBtn = e.target && e.target.closest ? e.target.closest(".btn-imprimir-dossie") : null;
        if (!printBtn) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        abrirRelatorioDarkZeroy();
      },
      true
    );

    // 4. Submit da Consulta
    DOM.form.addEventListener("submit", async (e) => {
      e.preventDefault();
      await executarConsulta();
    });

    // 5. Fechamento do Modal de Foto Ampliada & Modal de Relatório
    DOM.btnFecharModal?.addEventListener("click", fecharFotoModal);
    DOM.fotoModal?.addEventListener("click", (e) => {
      if (e.target === DOM.fotoModal) fecharFotoModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (DOM.fotoModal && DOM.fotoModal.style.display === "flex") {
          fecharFotoModal();
        }
        const relModal = document.getElementById("modalRelatorioOsint");
        if (relModal && relModal.style.display === "flex") {
          fecharModalRelatorioZeroy();
        }
      }
    });

    // 6. Conexão reativa com as Configurações (exibir ou ocultar gaveta de JSON)
    window.addEventListener("rimu:settingsChanged", (e) => {
      if (e.detail && e.detail.key === "showRawJson" && DOM.rawJsonContainer) {
        DOM.rawJsonContainer.style.display = e.detail.value ? "block" : "none";
      }
    });

    // 7. Sincroniza módulo a partir da URL (?id=...) ou padrão do servidor
    const params = new URLSearchParams(window.location.search);
    const idUrl = params.get("id") || params.get("tipo") || params.get("modulo") || params.get("type");

    if (idUrl) {
      selecionarModulo(idUrl);
    } else if (window.MODULO_ATIVO && window.MODULO_ATIVO.id) {
      selecionarModulo(window.MODULO_ATIVO.id);
    } else {
      selecionarModulo("cpf-zeroy");
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

  function abrirRelatorioDarkZeroy(customState) {
    const moduloId = customState?.moduloId || DOM.tipoInput?.value || moduloAtivoAtual?.id || "cpf-zeroy";
    const moduloNome = customState?.moduloNome || moduloAtivoAtual?.nome || moduloAtivoAtual?.label || moduloId.toUpperCase();
    const parametro = customState?.parametro || moduloAtivoAtual?.parametro || "";
    const path = customState?.path || DOM.pathInput?.value || moduloAtivoAtual?.path || "";
    const termo = customState?.termo || DOM.termoInput?.value?.trim() || lastRenderedTermo || "Alvo não especificado";

    let rawResponse = customState?.rawResponse;
    if (!rawResponse && DOM.rawJson?.textContent) {
      try {
        rawResponse = JSON.parse(DOM.rawJson.textContent);
      } catch {
        rawResponse = DOM.rawJson.textContent;
      }
    }

    if (!rawResponse || (typeof rawResponse === "object" && Object.keys(rawResponse).length === 0)) {
      if (window.toast) window.toast.warning("Execute uma consulta válida antes de gerar o relatório.");
      return false;
    }

    if (!window.OsintDarkReport) {
      if (window.toast) window.toast.error("Motor de relatórios Dark OSINT não carregado.");
      return false;
    }

    const html = window.OsintDarkReport.generateZeroyReport({
      moduloId,
      moduloNome,
      parametro,
      path,
      termo,
      rawResponse,
    });

    const contentEl = document.getElementById("modalRelatorioContentZeroy");
    const modalEl = document.getElementById("modalRelatorioOsint");
    if (contentEl) contentEl.innerHTML = html;
    if (modalEl) {
      modalEl.style.display = "flex";
      document.body.style.overflow = "hidden";
    }
    if (window.renderLucide) window.renderLucide();
    return true;
  }

  function fecharModalRelatorioZeroy() {
    const modalEl = document.getElementById("modalRelatorioOsint");
    if (modalEl) modalEl.style.display = "none";
    document.body.style.overflow = "";
  }

  function abrirGrafoZeroy(customState) {
    const moduloId = customState?.moduloId || DOM.tipoInput?.value || moduloAtivoAtual?.id || "cpf-zeroy";
    const moduloNome = customState?.moduloNome || moduloAtivoAtual?.nome || moduloAtivoAtual?.label || moduloId.toUpperCase();
    const termo = customState?.termo || DOM.termoInput?.value?.trim() || "Alvo";

    let rawResponse = customState?.rawResponse;
    if (!rawResponse && DOM.rawJson?.textContent) {
      try {
        rawResponse = JSON.parse(DOM.rawJson.textContent);
      } catch {
        rawResponse = DOM.rawJson.textContent;
      }
    }

    if (!rawResponse || (typeof rawResponse === "object" && Object.keys(rawResponse).length === 0)) {
      if (window.toast) window.toast.warning("Execute uma consulta válida antes de abrir o Grafo de Vínculos.");
      return false;
    }

    if (!window.OsintGraph) {
      if (window.toast) window.toast.error("Motor de Grafos OSINT não carregado.");
      return false;
    }

    window.OsintGraph.open(rawResponse, {
      moduloId,
      moduloNome,
      termo,
    });
    return true;
  }

  window.ZeroyReportController = {
    abrirRelatorioDarkZeroy,
    fecharModalRelatorioZeroy,
    abrirGrafoZeroy,
    generateHtml: (opts) => (window.OsintDarkReport ? window.OsintDarkReport.generateZeroyReport(opts) : ""),
  };

  function abrirFotoModal(src, legenda) {
    if (!DOM.fotoModal || !DOM.imgModal) return;
    DOM.imgModal.src = src;
    if (DOM.legendaModal) DOM.legendaModal.textContent = legenda || "Foto Cadastral Ampliada";
    DOM.fotoModal.style.display = "flex";
  }

  function fecharFotoModal() {
    if (!DOM.fotoModal) return;
    DOM.fotoModal.style.display = "none";
    if (DOM.imgModal) DOM.imgModal.src = "";
  }

  /**
   * Seleciona o módulo pelo ID do JSON central e ajusta dinamicamente a interface
   */
  function selecionarModulo(idOuTipo) {
    const rawId = String(idOuTipo || "cpf-zeroy").toLowerCase().trim();
    const modulos = window.MODULOS_HUB || [];

    // Localiza o módulo correspondente no catálogo carregado do JSON
    const modulo =
      modulos.find(
        (m) =>
          m.id === rawId ||
          m.id.toLowerCase() === rawId ||
          (m.path && m.path.toLowerCase().endsWith(`/${rawId}`))
      ) || null;

    let idFinal = rawId;
    let label = `Consulta ${rawId.toUpperCase()}`;
    let placeholder = "Informe o valor para consulta...";
    let path = `/api/v1/${rawId}`;
    let custo = 0.1;
    let parametro = "cpf";

    if (modulo) {
      idFinal = modulo.id;
      label = modulo.parametroLabel || modulo.nome;
      placeholder = modulo.placeholder || "Informe o valor para consulta...";
      path = modulo.path;
      custo = modulo.custo;
      parametro = modulo.parametro || "cpf";
      moduloAtivoAtual = modulo;
    } else if (METADADOS_ABAS[rawId]) {
      const fallback = METADADOS_ABAS[rawId];
      label = fallback.label;
      placeholder = fallback.placeholder;
      parametro = rawId;
      moduloAtivoAtual = { id: rawId, parametro: rawId, label, placeholder, path };
    } else {
      moduloAtivoAtual = { id: idFinal, parametro, label, placeholder, path, custo };
    }

    // 1. Atualiza abas visuais
    const botoes = document.querySelectorAll("#zeroyTabsBar .tipo-tab-btn");
    let encontrouAba = false;

    botoes.forEach((btn) => {
      const btnId = btn.getAttribute("data-id") || btn.getAttribute("data-tipo");
      const isAtiva = btnId === idFinal || btnId.toLowerCase() === idFinal.toLowerCase();
      btn.classList.toggle("active", isAtiva);
      if (isAtiva) {
        encontrouAba = true;
        btn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    });

    // Se o módulo não estiver entre as abas renderizadas, cria uma aba dinâmica
    if (!encontrouAba && DOM.tabsBar) {
      const novaAba = document.createElement("button");
      novaAba.type = "button";
      novaAba.className = "tipo-tab-btn active";
      novaAba.setAttribute("data-id", idFinal);
      novaAba.setAttribute("data-tipo", idFinal);
      novaAba.setAttribute("data-param", parametro);
      novaAba.innerHTML = `
        <i data-lucide="zap" style="width: 14px; height: 14px; color: #10B981;"></i>
        <span>${modulo ? modulo.nome.replace(/^Módulo\s+/i, '') : idFinal.toUpperCase()}</span>
      `;
      DOM.tabsBar.appendChild(novaAba);
      if (window.renderLucide) window.renderLucide();
    }

    // 2. Atualiza formulário e badges informativas
    if (DOM.tipoInput) DOM.tipoInput.value = idFinal;
    if (DOM.pathInput) DOM.pathInput.value = path;
    if (DOM.labelInput) DOM.labelInput.textContent = label;
    if (DOM.pathBadge) DOM.pathBadge.textContent = path;
    if (DOM.custoBadge) DOM.custoBadge.textContent = `R$ ${Number(custo).toFixed(2).replace(".", ",")}`;

    const isReconnc = idFinal === "reconnc";
    if (DOM.textInputRow) {
      DOM.textInputRow.style.display = isReconnc ? "none" : "flex";
    }
    if (DOM.reconncPanel) {
      DOM.reconncPanel.style.display = isReconnc ? "block" : "none";
    }
    if (DOM.termoInput) {
      DOM.termoInput.placeholder = placeholder;
      DOM.termoInput.required = !isReconnc;
      if (!isReconnc) {
        DOM.termoInput.focus();
      }
    }

    // Exibe ou oculta campos avançados (como filtro por Banco para SISBAJUD)
    if (DOM.filtrosExtras) {
      if (idFinal === "pix-sisbajud") {
        DOM.filtrosExtras.style.display = "block";
      } else {
        DOM.filtrosExtras.style.display = "none";
        if (DOM.bancoInput) DOM.bancoInput.value = "";
      }
    }

    // Exibe ou oculta o seletor específico de tipos PIX Bacen
    if (DOM.selectTipoPixContainer) {
      if (idFinal === "pix-bacen") {
        DOM.selectTipoPixContainer.style.display = "block";
        const tipoAtual = DOM.selectTipoPix ? DOM.selectTipoPix.value : "cpf_titular";
        atualizarConfiguracaoPixBacen(tipoAtual);
      } else {
        DOM.selectTipoPixContainer.style.display = "none";
      }
    }

    if (DOM.detectadoRow) {
      DOM.detectadoRow.style.display = "none";
    }

    // 3. Mantém a URL sincronizada com ?id=<modulo.id> e atualiza o título da aba no navegador
    const url = new URL(window.location.href);
    url.searchParams.set("id", idFinal);
    url.searchParams.delete("tipo");
    url.searchParams.delete("type");
    url.searchParams.delete("modulo");
    window.history.replaceState({}, "", url.toString());

    const nomeAba = modulo ? modulo.nome : idFinal.toUpperCase();
    document.title = `Zeroy API - ${nomeAba} - RimuBusca`;
  }

  // Compatibilidade com código legado que invoca selecionarAba
  const selecionarAba = selecionarModulo;

  async function executarConsulta() {
    const moduloId = DOM.tipoInput?.value || "cpf-zeroy";
    const isReconnc = moduloId === "reconnc";
    const termo = DOM.termoInput?.value.trim() || "";
    const banco = DOM.bancoInput?.value.trim() || undefined;

    if (isReconnc) {
      if (!selectedReconncFile) {
        if (window.toast) window.toast.warning("Selecione ou arraste uma foto de rosto antes de consultar.");
        return;
      }
    } else if (!termo) {
      if (window.toast) window.toast.error("Informe o valor a ser consultado.");
      return;
    }

    const digits = termo.replace(/\D/g, "");

    // Validação específica: Módulo Chave PIX aceita exclusivamente CPF ou CNPJ
    if (moduloId === "chave-pix" && digits.length !== 11 && digits.length !== 14) {
      if (window.toast) {
        window.toast.warning("O Módulo Chave PIX aceita exclusivamente CPF do titular (11 dígitos) ou CNPJ (14 dígitos).");
      }
      return;
    }

    // Validação específica: Módulo PIX Bacen conforme tipo selecionado
    if (moduloId === "pix-bacen") {
      const tipoPix = DOM.selectTipoPix ? DOM.selectTipoPix.value : "cpf_titular";
      if ((tipoPix === "cpf_titular" || tipoPix === "chave_cpf") && digits.length !== 11) {
        if (window.toast) window.toast.warning("Para este tipo de consulta, informe um CPF válido com 11 dígitos.");
        return;
      }
      if (tipoPix === "chave_cnpj" && digits.length !== 14) {
        if (window.toast) window.toast.warning("Para Chave PIX CNPJ, informe os 14 dígitos.");
        return;
      }
      if (tipoPix === "chave_email" && (!termo.includes("@") || !termo.includes("."))) {
        if (window.toast) window.toast.warning("Informe um endereço de e-mail válido.");
        return;
      }
      if (tipoPix === "chave_telefone" && digits.length < 10) {
        if (window.toast) window.toast.warning("Informe um número de telefone com DDD (mínimo 10 dígitos).");
        return;
      }
    }

    // Validação específica: Módulo Telefone
    if (moduloId === "telefone") {
      let cleanPhone = digits;
      if ((termo.startsWith("+55") || (cleanPhone.length >= 12 && cleanPhone.length <= 13)) && cleanPhone.startsWith("55")) {
        cleanPhone = cleanPhone.slice(2);
      }
      if (cleanPhone.startsWith("0") && cleanPhone.length >= 11) {
        cleanPhone = cleanPhone.slice(1);
      }
      if (cleanPhone.length < 10 || cleanPhone.length > 11) {
        if (window.toast) {
          window.toast.warning("Informe um telefone válido com DDD (10 ou 11 dígitos numéricos, ex: 27996977634).");
        }
        return;
      }
    }

    // UI Loading
    if (DOM.loading) DOM.loading.style.display = "block";
    if (DOM.resultsArea) DOM.resultsArea.style.display = "none";
    if (DOM.btnSubmit) DOM.btnSubmit.disabled = true;
    if (DOM.btnText) DOM.btnText.textContent = "Consultando...";
    if (DOM.btnReconncSubmit) DOM.btnReconncSubmit.disabled = true;
    if (DOM.btnReconncText) DOM.btnReconncText.textContent = "Otimizando e Analisando Rosto...";

    try {
      let requestBody;
      let termoAtual = termo;

      if (isReconnc) {
        if (DOM.reconncCropBox && DOM.reconncCropBox.style.display !== "none" && reconncCropper) {
          await aplicarRecorteReconnc({ silent: true });
        }
        const topK = DOM.reconncTopK ? Number(DOM.reconncTopK.value) || 3 : 3;
        const thresholdVal = DOM.reconncThreshold ? Number(DOM.reconncThreshold.value) : 0.35;
        const threshold = Number.isFinite(thresholdVal) ? Math.min(1, Math.max(0, thresholdVal)) : 0.35;
        const formData = new FormData();
        formData.append("id", "reconnc");
        formData.append("tipo", "reconnc");
        formData.append("imagem", selectedReconncFile);
        formData.append("top_k", String(topK));
        formData.append("threshold", String(threshold));
        requestBody = formData;
        termoAtual = selectedReconncFile?.name || "Reconhecimento Facial";
      } else {
        const payload = {
          id: moduloId,
          tipo: moduloId,
          termo,
        };

        if (moduloId === "chave-pix") {
          if (digits.length === 14) payload.cnpj = digits;
          else if (digits.length === 11) payload.cpf = digits;
        } else if (moduloId === "telefone") {
          let cleanPhone = digits;
          if ((termo.startsWith("+55") || (cleanPhone.length >= 12 && cleanPhone.length <= 13)) && cleanPhone.startsWith("55")) {
            cleanPhone = cleanPhone.slice(2);
          }
          if (cleanPhone.startsWith("0") && cleanPhone.length >= 11) {
            cleanPhone = cleanPhone.slice(1);
          }
          payload.termo = cleanPhone;
          payload.telefone = cleanPhone;
        } else if (moduloId === "pix-bacen") {
          const tipoPix = DOM.selectTipoPix ? DOM.selectTipoPix.value : "cpf_titular";
          payload.tipoPix = tipoPix;
          if (tipoPix === "cpf_titular") {
            payload.cpf = digits;
          } else {
            payload.chave = (tipoPix === "chave_cpf" || tipoPix === "chave_cnpj") ? digits : termo;
          }
        } else if (moduloId === "pix-sisbajud" && banco) {
          payload.banco = banco;
        }
        requestBody = payload;
        termoAtual = payload.termo || payload.telefone || termo || "";
      }

      const resp = await window.api.post("/api/zeroy/consultar", requestBody, { timeout: 65000 });

      if (resp.success && resp.data) {
        lastRenderedTermo = resp.data.termo || termoAtual || "";
        // Atualiza saldo global no topo da página
        if (resp.data.carteira?.saldoFormatado) {
          const headerSaldo = document.getElementById("zeroyHeaderSaldoDisplay");
          if (headerSaldo) {
            headerSaldo.textContent = resp.data.carteira.saldoFormatado;
          }
        }

        renderizarResultados(resp.data);

        if (resp.data.notFound || resp.data.dados?.notFound) {
          window.toast?.info("Nenhum registro localizado na Zeroy API (sem débito na carteira).");
          return;
        }

        if (window.toast) {
          if (resp.data.cached) {
            window.toast.success("Consulta instantânea recuperada do Cache! (Sem desconto na carteira)");
          } else if (resp.data.carteira && resp.data.carteira.custoDebitado > 0) {
            window.toast.success(
              `Consulta realizada! Debitado ${resp.data.carteira.custoFormatado} da carteira global. Saldo atual: ${resp.data.carteira.saldoFormatado}`
            );
          } else {
            window.toast.success("Consulta na Zeroy API finalizada com sucesso!");
          }
        }
      } else {
        throw new Error(resp.error || "Nenhum registro encontrado.");
      }
    } catch (err) {
      console.error("[ZEROY FRONTEND ERRO]:", err);
      const isNotFoundErr =
        err.status === 404 ||
        /nenhum\s+registro|nenhum\s+dado|n[aã]o\s+encontrad|n[aã]o\s+localizad|not\s+found|sem\s+registro/i.test(String(err.message || ""));

      if (isNotFoundErr) {
        renderizarResultados({
          id: moduloId,
          tipo: moduloId,
          termo: lastRenderedTermo || termo || (selectedReconncFile?.name || ""),
          fonte: "Zeroy API (Conexão Oficial)",
          timestamp: new Date().toISOString(),
          notFound: true,
          dados: { notFound: true, termo, mensagem: err.message },
        });
      } else if (window.toast) {
        window.toast.error(err.message || "Falha na consulta.");
      }
    } finally {
      if (DOM.loading) DOM.loading.style.display = "none";
      if (DOM.btnSubmit) DOM.btnSubmit.disabled = false;
      if (DOM.btnText) DOM.btnText.textContent = "Consultar";
      if (DOM.btnReconncSubmit) DOM.btnReconncSubmit.disabled = false;
      if (DOM.btnReconncText) DOM.btnReconncText.textContent = "Buscar Correspondência Facial";
    }
  }

  function renderizarInfoToken(infoToken) {
    if (!infoToken) return "";
    const expiracao = infoToken.expiracao ? new Date(infoToken.expiracao).toLocaleDateString("pt-BR") : "Ilimitada";
    return `
      <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: var(--radius-md); padding: 8px 14px; margin-bottom: var(--space-4); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; font-size: 0.8rem; color: #10B981;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <i data-lucide="shield-check" style="width: 15px; height: 15px;"></i>
          <span>Autenticado via Zeroy Live API Oficial</span>
        </div>
        <div style="display: flex; align-items: center; gap: 12px; font-family: var(--font-mono); font-size: 0.75rem;">
          <span>Módulo: <strong>${infoToken.modulo || "Ativo"}</strong></span>
          <span style="color: var(--color-border);">&bull;</span>
          <span>Uso na Sessão: <strong>${infoToken.uso_atual || 1}</strong></span>
          <span style="color: var(--color-border);">&bull;</span>
          <span>Validade: <strong>${expiracao}</strong></span>
        </div>
      </div>
    `;
  }

  function renderizarResultados(respData) {
    if (!DOM.resultsArea || !DOM.resultsContent) return;

    if (DOM.timestamp) {
      DOM.timestamp.textContent = new Date(respData.timestamp || Date.now()).toLocaleString("pt-BR");
    }
    if (DOM.fonteBadge) {
      DOM.fonteBadge.textContent = respData.fonte || "Zeroy API (Conexão Oficial)";
    }

    // Exibe badges de débito e saldo da carteira compartilhada
    if (DOM.debitoBadge) {
      if (respData.cached) {
        DOM.debitoBadge.style.display = "inline-flex";
        DOM.debitoBadge.textContent = "⚡ Cache (R$ 0,00)";
        DOM.debitoBadge.style.background = "rgba(16, 185, 129, 0.15)";
        DOM.debitoBadge.style.color = "#10B981";
      } else if (respData.carteira && respData.carteira.custoDebitado > 0) {
        DOM.debitoBadge.style.display = "inline-flex";
        DOM.debitoBadge.textContent = `Debitado: ${respData.carteira.custoFormatado}`;
        DOM.debitoBadge.style.background = "rgba(59, 130, 246, 0.15)";
        DOM.debitoBadge.style.color = "#60A5FA";
      } else {
        DOM.debitoBadge.style.display = "none";
      }
    }

    if (DOM.saldoBadge && respData.carteira?.saldoFormatado) {
      DOM.saldoBadge.style.display = "inline-flex";
      DOM.saldoBadge.textContent = `Saldo Carteira: ${respData.carteira.saldoFormatado}`;
    }

    let payload = respData.dados || respData;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
        if (respData.dados) respData.dados = payload;
      } catch {
        // mantém como string se não for JSON
      }
    }

    if (DOM.rawJson) {
      DOM.rawJson.textContent = JSON.stringify(payload, null, 2);
    }
    if (DOM.rawJsonContainer) {
      DOM.rawJsonContainer.style.display = deveExibirRawJson() ? "block" : "none";
    }

    let html = "";

    // 1. Informações de cota / token oficial se presentes
    const tokenInfo = payload.info_token || respData.info_token;
    if (tokenInfo) {
      html += renderizarInfoToken(tokenInfo);
    }

    // 2. Delega para os Interpretadores Visuais Modulares
    if (window.RimuInterpreters?.dispatch) {
      html += window.RimuInterpreters.dispatch(respData);
    } else {
      html += `<div class="card"><p style="color: var(--color-text-muted);">Interpretador não carregado. Veja o JSON bruto abaixo.</p></div>`;
    }

    DOM.resultsContent.innerHTML = html;
    DOM.resultsArea.style.display = "block";

    // Setup de eventos interativos dos resultados
    setupEventosResultados(payload);

    if (window.renderLucide) window.renderLucide();
  }

  function setupEventosResultados(dados) {
    // 1. Filtro dinâmico na tabela de homônimos
    const inputFiltro = document.getElementById("inputFiltroTabelaZeroy");
    if (inputFiltro) {
      inputFiltro.addEventListener("input", (e) => {
        const termo = e.target.value.toLowerCase().trim();
        const linhas = document.querySelectorAll("#tabelaRegistrosZeroy tbody .linha-registro-zeroy");
        linhas.forEach((linha) => {
          const texto = linha.getAttribute("data-search") || "";
          linha.style.display = (!termo || texto.includes(termo)) ? "" : "none";
        });
      });
    }

    // 2. Filtro dinâmico na tabela de vizinhos
    const inputFiltroVizinhos = document.getElementById("filtroVizinhosInput");
    if (inputFiltroVizinhos) {
      inputFiltroVizinhos.addEventListener("input", (e) => {
        const termo = e.target.value.toLowerCase().trim();
        const linhas = document.querySelectorAll("#tabelaVizinhosZeroy tbody .linha-vizinho-zeroy");
        linhas.forEach((linha) => {
          const texto = linha.getAttribute("data-search") || "";
          linha.style.display = (!termo || texto.includes(termo)) ? "" : "none";
        });
      });
    }

    // 2.1 Filtros da tabela de residentes por CEP
    window.RimuInterpreters?.bindCepResidentsFilters?.(DOM.resultsArea);

    // 3. Botão genérico "Copiar Texto"
    document.querySelectorAll(".btn-copiar-texto").forEach((btn) => {
      btn.addEventListener("click", () => {
        const texto = btn.getAttribute("data-copy");
        if (texto) {
          navigator.clipboard.writeText(texto).then(() => {
            if (window.toast) window.toast.success("Copiado para a área de transferência!");
          });
        }
      });
    });

    // 4. Botão "Copiar CPF"
    document.querySelectorAll(".btn-copiar-cpf").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cpf = btn.getAttribute("data-cpf");
        if (cpf) {
          navigator.clipboard.writeText(cpf).then(() => {
            if (window.toast) window.toast.success(`CPF copiado: ${cpf}`);
          });
        }
      });
    });

    // 5. Botão "Copiar Resumo OSINT"
    document.querySelectorAll(".btn-copiar-resumo-dossie").forEach((btn) => {
      btn.addEventListener("click", () => {
        const raw = btn.getAttribute("data-resumo");
        if (raw) {
          const textoDecodificado = decodeURIComponent(raw);
          navigator.clipboard.writeText(textoDecodificado).then(() => {
            if (window.toast) window.toast.success("Resumo do Dossiê copiado com sucesso!");
          });
        }
      });
    });

    // 6. Botão "Imprimir / PDF"
    document.querySelectorAll(".btn-imprimir-dossie").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.print();
      });
    });

    // 7. Botão "Ver JSON Bruto" (rolagem suave)
    document.querySelectorAll(".btn-scroll-json").forEach((btn) => {
      btn.addEventListener("click", () => {
        DOM.rawJson?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });

    // 8. Botão "Puxar CPF": seleciona a aba CPF, preenche e rola até a busca
    document.querySelectorAll(".btn-puxar-cpf").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cpf = btn.getAttribute("data-cpf");
        if (cpf) {
          selecionarAba("cpf");
          if (DOM.termoInput) {
            const clean = cpf.replace(/\D/g, "");
            DOM.termoInput.value = clean.length === 11 ? clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") : cpf;
            DOM.form?.scrollIntoView({ behavior: "smooth", block: "center" });
            if (window.toast) window.toast.info(`CPF preenchido. Clique em 'Consultar' para carregar o dossiê.`);
          }
        }
      });
    });

    // 9. Botão "Buscar Nome Alvo" (Mãe, Pai, Parente)
    document.querySelectorAll(".btn-buscar-nome-alvo").forEach((btn) => {
      btn.addEventListener("click", () => {
        const nome = btn.getAttribute("data-nome");
        if (nome) {
          selecionarAba("nome");
          if (DOM.termoInput) {
            DOM.termoInput.value = nome;
            DOM.form?.scrollIntoView({ behavior: "smooth", block: "center" });
            if (window.toast) window.toast.info(`Nome preenchido. Clique em 'Consultar' para buscar homônimos.`);
          }
        }
      });
    });

    // 10. Botão "Buscar Vizinhos por CEP"
    document.querySelectorAll(".btn-buscar-cep-vizinhos").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cep = btn.getAttribute("data-cep");
        if (cep) {
          selecionarAba("vizinhos");
          if (DOM.termoInput) {
            DOM.termoInput.value = cep;
            DOM.form?.scrollIntoView({ behavior: "smooth", block: "center" });
            if (window.toast) window.toast.info(`CEP preenchido. Clique em 'Consultar' para mapear vizinhos.`);
          }
        }
      });
    });

    // 11. Botão "Consultar Placa"
    document.querySelectorAll(".btn-consultar-placa").forEach((btn) => {
      btn.addEventListener("click", () => {
        const placa = btn.getAttribute("data-placa");
        if (placa) {
          selecionarAba("placa");
          if (DOM.termoInput) {
            DOM.termoInput.value = placa;
            DOM.form?.scrollIntoView({ behavior: "smooth", block: "center" });
            if (window.toast) window.toast.info(`Placa preenchida. Clique em 'Consultar' para ver o veículo.`);
          }
        }
      });
    });

    // 12. Modal de Foto Biométrica Ampliada
    document.querySelectorAll(".btn-abrir-foto-modal").forEach((btn) => {
      btn.addEventListener("click", () => {
        const foto = btn.getAttribute("data-foto");
        const nome = btn.getAttribute("data-nome") || "Foto Cadastral";
        if (foto) {
          abrirFotoModal(foto, `Foto Cadastral: ${nome}`);
        }
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inicializar);
  } else {
    inicializar();
  }
})();
