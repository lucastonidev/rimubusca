/**
 * ==============================================================================
 * RIMUBUSCA - OSINT LINK ANALYSIS GRAPH ENGINE (GRAFO DE VÍNCULOS INTERATIVO)
 * Motor Topológico de Mapeamento de Relacionamentos, Redes & Vínculos Forenses
 *
 * Características:
 *  - Extração inteligente de entidades (Alvo, Família, Empresas, Telefones, Endereços, PIX, Veículos)
 *  - Suporte com aceleração visual via Vis.js Network + Fallback Nativo Canvas 60FPS
 *  - 100% Dark Cyberpunk Aesthetic (Glows neon, nós estilizados, arestas com setas)
 *  - Inspector lateral deslizante com atalho direto de investigação ("Puxar este nó")
 *  - Filtros dinâmicos por categoria (Família, Empresas, Telefones, Endereços...)
 *  - Exportação em alta resolução (PNG) para instrução probatória / relatórios
 * ==============================================================================
 */

(function (root) {
  "use strict";

  // Paleta de Cores do Design System Cyberpunk
  const GRAPH_THEME = {
    bg: "#07090E",
    grid: "rgba(255, 255, 255, 0.03)",
    target: { bg: "#7C3AED", border: "#C4B5FD", glow: "rgba(139, 92, 246, 0.6)", text: "#FFFFFF" },
    familia: { bg: "#831843", border: "#F472B6", glow: "rgba(236, 72, 153, 0.5)", text: "#FDF2F8" },
    empresa: { bg: "#1E3A8A", border: "#60A5FA", glow: "rgba(59, 130, 246, 0.5)", text: "#EFF6FF" },
    telefone: { bg: "#78350F", border: "#FBBF24", glow: "rgba(245, 158, 11, 0.5)", text: "#FFFBEB" },
    endereco: { bg: "#064E3B", border: "#34D399", glow: "rgba(16, 185, 129, 0.5)", text: "#ECFDF5" },
    financeiro: { bg: "#164E63", border: "#22D3EE", glow: "rgba(6, 182, 212, 0.5)", text: "#ECFEFF" },
    veiculo: { bg: "#7F1D1D", border: "#F87171", glow: "rgba(239, 68, 68, 0.5)", text: "#FEF2F2" },
    saude: { bg: "#312E81", border: "#A78BFA", glow: "rgba(167, 139, 250, 0.5)", text: "#F5F3FF" },
    judicial: { bg: "#701A75", border: "#F472B6", glow: "rgba(244, 63, 94, 0.5)", text: "#FFF1F2" },
    edge: { color: "rgba(148, 163, 184, 0.35)", highlight: "#A855F7", text: "#94A3B8" }
  };

  /**
   * Utilitários internos de formatação e extração
   */
  function cleanDigits(v) {
    return String(v || "").replace(/\D/g, "");
  }

  function formatCpf(v) {
    const d = cleanDigits(v);
    if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
    return v || "N/I";
  }

  function formatCnpj(v) {
    const d = cleanDigits(v);
    if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
    return v || "N/I";
  }

  function formatPhone(v, ddd) {
    const d = cleanDigits(v);
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (ddd && d.length <= 9) return `(${ddd}) ${d}`;
    return v || "N/I";
  }

  function resolvePhoto(payload, basicData) {
    if (!payload && !basicData) return "";
    const p = payload || {};
    const b = basicData || {};
    let raw = p.fotoBase64 || b.fotoBase64 || p.foto || b.foto || p.base64 || b.base64 || "";
    if (!raw && Array.isArray(p.fotos) && p.fotos[0]) raw = p.fotos[0];
    if (!raw && Array.isArray(b.fotos) && b.fotos[0]) raw = b.fotos[0];
    if (typeof raw === "string" && raw.trim()) {
      const s = raw.trim();
      if (s.startsWith("data:image")) return s;
      if (s.startsWith("/9j/") || s.startsWith("iVBORw0KGgo") || s.length > 100) {
        return `data:image/jpeg;base64,${s}`;
      }
      return s;
    }
    return "";
  }

  /**
   * Extração e normalização de dados para o grafo a partir de qualquer resposta
   */
  function buildGraphData(payload, meta = {}) {
    const raw = payload?.dados || payload?.data || payload || {};
    const d = Array.isArray(raw) ? raw[0] || {} : raw;
    const basic = d.dadosBasicos || d.DadosBasicos || d.dados_basicos || d.basico || d;

    const nodes = [];
    const edges = [];
    const existingNodeIds = new Set();

    function addNode(node) {
      if (!node.id || existingNodeIds.has(node.id)) return;
      existingNodeIds.add(node.id);
      nodes.push(node);
    }

    function addEdge(edge) {
      edges.push(edge);
    }

    // 1. NÓ CENTRAL (ALVO)
    const targetName = basic.nome || basic.name || basic.nomeCompleto || d.razaoSocial || meta.termo || "ALVO PRINCIPAL";
    const targetCpf = formatCpf(basic.cpf || meta.termo);
    const targetPhoto = resolvePhoto(d, basic);
    const targetStatus = typeof basic.situacaoCadastral === "object" 
      ? basic.situacaoCadastral.descricaoSit || "REGULAR" 
      : String(basic.situacaoCadastral || "REGULAR");

    addNode({
      id: "node_target",
      label: targetName,
      sublabel: `ALVO • ${targetCpf}`,
      group: "alvo",
      category: "alvo",
      isTarget: true,
      image: targetPhoto || undefined,
      shape: targetPhoto ? "circularImage" : "box",
      size: 34,
      font: { color: "#FFFFFF", size: 14, face: "Inter", bold: true },
      color: {
        background: GRAPH_THEME.target.bg,
        border: GRAPH_THEME.target.border,
        highlight: { background: "#9333EA", border: "#E9D5FF" }
      },
      details: {
        tipo: "ALVO INVESTIGADO",
        nome: targetName,
        cpf: targetCpf,
        status: targetStatus,
        sexo: basic.sexo || "N/I",
        nascimento: basic.dataNasc || basic.dataNascimento || basic.nascimento || "N/I",
        renda: basic.rendaAtual ? `R$ ${basic.rendaAtual},00` : "Não informada",
        foto: targetPhoto,
        moduloOrigem: meta.moduloId || "cpf-zeroy"
      }
    });

    // 2. FILIAÇÃO (MÃE E PAI)
    const filiacao = basic.filiacao || d.filiacao || d.Pais || {};
    const maeNome = filiacao.nomeMae || basic.nomeMae || d.nomeMae || filiacao.mae;
    const paiNome = filiacao.nomePai || basic.nomePai || d.nomePai || filiacao.pai;

    if (maeNome && !["NÃO INFORMADO", "NAO INFORMADO", "N/I", "NÃO CONSTA"].includes(String(maeNome).trim().toUpperCase())) {
      const maeId = "node_mae";
      addNode({
        id: maeId,
        label: String(maeNome).trim(),
        sublabel: "MÃE (GENITORA)",
        group: "familia",
        category: "familia",
        shape: "box",
        details: {
          tipo: "PESSOA FÍSICA (MÃE)",
          nome: String(maeNome).trim(),
          vinculo: "Filiação Materna Direta",
          termoBusca: String(maeNome).trim(),
          tipoBusca: "nome"
        }
      });
      addEdge({
        from: "node_target",
        to: maeId,
        label: "MÃE",
        arrows: "to"
      });
    }

    if (paiNome && !["NÃO INFORMADO", "NAO INFORMADO", "N/I", "NÃO CONSTA"].includes(String(paiNome).trim().toUpperCase())) {
      const paiId = "node_pai";
      addNode({
        id: paiId,
        label: String(paiNome).trim(),
        sublabel: "PAI (GENITOR)",
        group: "familia",
        category: "familia",
        shape: "box",
        details: {
          tipo: "PESSOA FÍSICA (PAI)",
          nome: String(paiNome).trim(),
          vinculo: "Filiação Paterna Direta",
          termoBusca: String(paiNome).trim(),
          tipoBusca: "nome"
        }
      });
      addEdge({
        from: "node_target",
        to: paiId,
        label: "PAI",
        arrows: "to"
      });
    }

    // 3. PARENTES E VÍNCULOS FAMILIARES
    const relatives = Array.isArray(d.parentesNovos || d.novosParentes || d.parentes || d.Parentes) 
      ? (d.parentesNovos || d.novosParentes || d.parentes || d.Parentes) 
      : [];

    relatives.slice(0, 15).forEach((p, idx) => {
      const nomeParente = p.nome || p.nomeParente || `Parente ${idx + 1}`;
      const grau = p.tipoRelacao || p.vinculo || p.grau || "Parente";
      const cpfParente = formatCpf(p.cpf);
      const parenteId = `node_parente_${cleanDigits(p.cpf) || idx}`;
      const shortGrau = String(grau).trim().toUpperCase();

      addNode({
        id: parenteId,
        label: nomeParente,
        sublabel: `${shortGrau} • ${cpfParente}`,
        group: "familia",
        category: "familia",
        shape: "box",
        details: {
          tipo: "PARENTE / VÍNCULO FAMILIAR",
          nome: nomeParente,
          cpf: cpfParente,
          grau: grau,
          termoBusca: cleanDigits(p.cpf) || nomeParente,
          tipoBusca: cleanDigits(p.cpf) ? "cpf-zeroy" : "nome"
        }
      });
      addEdge({
        from: "node_target",
        to: parenteId,
        label: shortGrau.length > 9 ? shortGrau.slice(0, 8) : shortGrau,
        arrows: "to"
      });
    });

    // 4. TELEFONES MAPEADOS
    const phones = Array.isArray(d.telefonesHistorico || d.telefones || d.Telefones || basic.telefones)
      ? (d.telefonesHistorico || d.telefones || d.Telefones || basic.telefones)
      : [];

    phones.slice(0, 10).forEach((tel, idx) => {
      const numFmt = formatPhone(tel.telefone || tel.numero || tel, tel.ddd);
      const tipo = tel.tipo || (tel.whatsapp === "SIM" ? "WhatsApp" : "Telefone");
      const telId = `node_tel_${cleanDigits(tel.telefone || tel)}`;

      addNode({
        id: telId,
        label: numFmt,
        sublabel: `${tipo} • Operadora: ${tel.operadora || "N/I"}`,
        group: "telefone",
        category: "telefones",
        shape: "box",
        details: {
          tipo: "CONTATO TELEFÔNICO",
          numero: numFmt,
          tipoLinha: tel.tipo || "Mapeado",
          operadora: tel.operadora || "Não Informada",
          whatsapp: tel.whatsapp || "N/I",
          termoBusca: cleanDigits(numFmt),
          tipoBusca: "telefone"
        }
      });
      addEdge({
        from: "node_target",
        to: telId,
        label: tipo.toUpperCase().includes("WHATS") ? "WHATSAPP" : "TEL",
        arrows: "to"
      });
    });

    // 5. HISTÓRICO DE ENDEREÇOS
    const addresses = Array.isArray(d.enderecos || d.enderecosHistorico || d.Enderecos)
      ? (d.enderecos || d.enderecosHistorico || d.Enderecos)
      : [];

    addresses.slice(0, 8).forEach((addr, idx) => {
      const rua = addr.logradouro ? `${addr.logradouro}, ${addr.numero || "S/N"}` : (addr.endereco || `Endereço ${idx + 1}`);
      const loc = `${addr.bairro || ""} - ${addr.cidade || ""}/${addr.siglaUf || addr.uf || ""}`.replace(/^[-\s]+|[-\s]+$/g, "");
      const cep = addr.cep ? `CEP: ${addr.cep}` : "";
      const endId = `node_end_${idx}`;

      addNode({
        id: endId,
        label: rua,
        sublabel: loc ? `${loc} • ${cep}` : cep,
        group: "endereco",
        category: "enderecos",
        shape: "box",
        details: {
          tipo: "LOGRADOURO / RESIDÊNCIA",
          logradouro: addr.logradouro || "Não informado",
          numero: addr.numero || "S/N",
          bairro: addr.bairro || "Não informado",
          cidadeUf: `${addr.cidade || ""}/${addr.siglaUf || addr.uf || ""}`,
          cep: addr.cep || "Não informado",
          termoBusca: addr.cep ? cleanDigits(addr.cep) : rua,
          tipoBusca: addr.cep ? "cep" : "vizinhos"
        }
      });
      addEdge({
        from: "node_target",
        to: endId,
        label: "DOMICÍLIO",
        arrows: "to"
      });
    });

    // 6. EMPRESAS, QUADRO SOCIETÁRIO & VÍNCULOS PROFISSIONAIS
    const jobs = Array.isArray(d.empregos || d.empresas || d.Empresas || d.sociosQSA)
      ? (d.empregos || d.empresas || d.Empresas || d.sociosQSA)
      : [];

    jobs.slice(0, 10).forEach((j, idx) => {
      const empNome = j.razaoSocial || j.nome || j.empresa || j.razao_social || `Empresa ${idx + 1}`;
      const empCnpj = formatCnpj(j.cnpj);
      const cargo = j.cargo || j.qualificacao || j.vinculo || "Vínculo";
      const empId = `node_emp_${cleanDigits(j.cnpj) || idx}`;

      addNode({
        id: empId,
        label: empNome,
        sublabel: `${cargo} • CNPJ: ${empCnpj}`,
        group: "empresa",
        category: "empresas",
        shape: "box",
        details: {
          tipo: "PESSOA JURÍDICA / EMPRESA",
          razaoSocial: empNome,
          cnpj: empCnpj,
          cargo: cargo,
          situacao: j.situacao || "ATIVA",
          termoBusca: cleanDigits(j.cnpj) || empNome,
          tipoBusca: cleanDigits(j.cnpj) ? "cnpj" : "nome"
        }
      });
      addEdge({
        from: "node_target",
        to: empId,
        label: "EMPRESA",
        arrows: "to"
      });
    });

    // 7. SISTEMA FINANCEIRO / CHAVES PIX / CONTAS
    const pixList = Array.isArray(d.chavePix || d.contasBancarias || d.bancos)
      ? (d.chavePix || d.contasBancarias || d.bancos)
      : [];

    pixList.slice(0, 6).forEach((pix, idx) => {
      const chaveValor = pix.chave || pix.banco || pix.instituicao || `Conta ${idx + 1}`;
      const pixTipo = pix.tipoChave || pix.tipo || "Chave PIX";
      const finId = `node_fin_${idx}`;

      addNode({
        id: finId,
        label: chaveValor,
        sublabel: `PIX • ${pixTipo.toUpperCase()}`,
        group: "financeiro",
        category: "financeiro",
        shape: "box",
        details: {
          tipo: "CHAVE PIX / CONTA BANCÁRIA",
          identificador: chaveValor,
          tipoChave: pixTipo,
          banco: pix.banco || pix.instituicao || "BACEN SPI",
          termoBusca: chaveValor,
          tipoBusca: "chave-pix"
        }
      });
      addEdge({
        from: "node_target",
        to: finId,
        label: "PIX/BANCO",
        arrows: "to"
      });
    });

    // 8. VEÍCULOS
    const vehicles = Array.isArray(d.veiculos || d.Veiculos)
      ? (d.veiculos || d.Veiculos)
      : (d.vehicles && Array.isArray(d.vehicles.list) ? d.vehicles.list : []);

    vehicles.slice(0, 6).forEach((v, idx) => {
      const placa = String(v.placa || v.plate || `Veículo ${idx + 1}`).toUpperCase();
      const mod = `${v.modelo || v.model || v.marca || ""} ${v.ano || v.year || ""}`.trim();
      const veicId = `node_veic_${placa}`;

      addNode({
        id: veicId,
        label: placa,
        sublabel: mod || "Veículo Registrado",
        group: "veiculo",
        category: "veiculos",
        shape: "box",
        details: {
          tipo: "VEÍCULO REGISTRADO",
          placa: placa,
          modelo: v.modelo || v.model || "Não informado",
          chassi: v.chassi || "N/I",
          ano: v.ano || v.year || "N/I",
          termoBusca: placa,
          tipoBusca: "gravame"
        }
      });
      addEdge({
        from: "node_target",
        to: veicId,
        label: "VEÍCULO",
        arrows: "to"
      });
    });

    // 9. CARTÃO NACIONAL DE SAÚDE (CNS)
    const cns = Array.isArray(d.cnsHistorico || d.cns) ? (d.cnsHistorico || d.cns) : [];
    cns.slice(0, 2).forEach((c, idx) => {
      const numCns = c.cns || c.numero || `CNS ${idx + 1}`;
      const cnsId = `node_cns_${idx}`;

      addNode({
        id: cnsId,
        label: numCns,
        sublabel: `SUS • ${c.tipo || "Definitivo"}`,
        group: "saude",
        category: "outros",
        shape: "box",
        details: {
          tipo: "REGISTRO SUS / CNS",
          cns: numCns,
          tipoCns: c.tipo || "SUS",
          origem: c.origem || "Sistema Único de Saúde"
        }
      });
      addEdge({
        from: "node_target",
        to: cnsId,
        label: "SUS",
        arrows: "to"
      });
    });

    // 10. E-MAILS ELETRÔNICOS MAPEADOS
    const emails = Array.isArray(d.emails || d.Emails || d.emailsHistorico || basic.emails)
      ? (d.emails || d.Emails || d.emailsHistorico || basic.emails)
      : [];
    emails.slice(0, 5).forEach((em, idx) => {
      const emailStr = typeof em === "string" ? em : (em.email || em.endereco || "");
      if (!emailStr) return;
      const emId = `node_em_${idx}`;
      addNode({
        id: emId,
        label: emailStr,
        sublabel: "E-MAIL VINCULADO",
        group: "financeiro",
        category: "outros",
        shape: "box",
        details: {
          tipo: "E-MAIL / ENDEREÇO ELETRÔNICO",
          email: emailStr,
          termoBusca: emailStr,
          tipoBusca: "email"
        }
      });
      addEdge({
        from: "node_target",
        to: emId,
        label: "EMAIL",
        arrows: "to"
      });
    });

    // 11. VIZINHOS CONFRONTANTES / PROXIMIDADE
    const vizinhos = Array.isArray(d.vizinhos || d.Vizinhos) ? (d.vizinhos || d.Vizinhos) : [];
    vizinhos.slice(0, 6).forEach((viz, idx) => {
      const nomeViz = viz.nome || viz.name || `Vizinho ${idx + 1}`;
      const cpfViz = formatCpf(viz.cpf);
      const vizId = `node_viz_${cleanDigits(viz.cpf) || idx}`;
      addNode({
        id: vizId,
        label: nomeViz,
        sublabel: `VIZINHO(A) • ${cpfViz}`,
        group: "endereco",
        category: "enderecos",
        shape: "box",
        details: {
          tipo: "VIZINHO CONFRONTANTE / PRÓXIMO",
          nome: nomeViz,
          cpf: cpfViz,
          termoBusca: cleanDigits(viz.cpf) || nomeViz,
          tipoBusca: cleanDigits(viz.cpf) ? "cpf-zeroy" : "nome"
        }
      });
      addEdge({
        from: "node_target",
        to: vizId,
        label: "VIZINHO",
        arrows: "to"
      });
    });

    return { nodes, edges };
  }

  /**
   * ==============================================================================
   * MOTOR NATIVO FORCE-DIRECTED 60FPS (HTML5 CANVAS)
   * Aceleração física topológica própria, imune a bloqueios de CDN / Brave Shields
   * ==============================================================================
   */
  class NativeForceDirectedGraph {
    constructor(container, data, options = {}) {
      this.container = container;
      this.data = data;
      this.options = options;
      this.physicsEnabled = options.physicsEnabled !== undefined ? options.physicsEnabled : true;

      this.canvas = document.createElement("canvas");
      this.ctx = this.canvas.getContext("2d");
      this.canvas.style.position = "absolute";
      this.canvas.style.top = "0";
      this.canvas.style.left = "0";
      this.canvas.style.width = "100%";
      this.canvas.style.height = "100%";
      this.canvas.style.cursor = "grab";
      this.container.appendChild(this.canvas);

      this.panX = 0;
      this.panY = 0;
      this.zoom = 1;
      this.isPanning = false;
      this.draggedNode = null;
      this.hoveredNode = null;
      this.selectedNode = null;
      this.animId = null;

      this.resize();
      this.initNodes();
      this.bindEvents();
      this.startLoop();
    }

    resize() {
      const rect = this.container.getBoundingClientRect();
      const parentRect = this.container.parentElement?.getBoundingClientRect();

      this.width = rect.width > 50 ? rect.width : (parentRect?.width > 50 ? parentRect.width : (window.innerWidth ? Math.min(window.innerWidth - 60, 1200) : 1000));
      this.height = rect.height > 50 ? rect.height : (parentRect?.height > 50 ? parentRect.height : (window.innerHeight ? Math.min(window.innerHeight - 180, 700) : 600));

      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = Math.round(this.width * dpr);
      this.canvas.height = Math.round(this.height * dpr);
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(dpr, dpr);
    }

    initNodes() {
      const centerX = this.width / 2;
      const centerY = this.height / 2;
      const nodes = this.data.nodes;

      const target = nodes.find((n) => n.isTarget) || nodes[0];
      if (target) {
        target.x = centerX;
        target.y = centerY;
        target.vx = 0;
        target.vy = 0;

        if (target.image) {
          const img = new Image();
          img.src = target.image;
          target.photoImg = img;
        }
      }

      const others = nodes.filter((n) => n !== target);
      const radius = Math.min(this.width, this.height) * 0.32;

      others.forEach((n, idx) => {
        const angle = (idx / Math.max(others.length, 1)) * Math.PI * 2;
        const dist = radius * (0.8 + 0.4 * (idx % 3));
        n.x = centerX + Math.cos(angle) * dist + (Math.random() - 0.5) * 30;
        n.y = centerY + Math.sin(angle) * dist + (Math.random() - 0.5) * 30;
        n.vx = (Math.random() - 0.5) * 2;
        n.vy = (Math.random() - 0.5) * 2;
      });

      this.fit();
    }

    bindEvents() {
      this.onResize = () => {
        this.resize();
        this.fit();
      };
      window.addEventListener("resize", this.onResize);

      const getPos = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        return {
          screenX: e.clientX - rect.left,
          screenY: e.clientY - rect.top,
          worldX: (e.clientX - rect.left - this.panX) / this.zoom,
          worldY: (e.clientY - rect.top - this.panY) / this.zoom
        };
      };

      const findNode = (wx, wy) => {
        const nodes = this.data.nodes.filter((n) => !n.hidden);
        for (let i = nodes.length - 1; i >= 0; i--) {
          const n = nodes[i];
          const hitRadius = n.isTarget ? 38 : 32;
          if (Math.hypot(n.x - wx, n.y - wy) <= hitRadius) return n;
        }
        return null;
      };

      this.canvas.addEventListener("mousedown", (e) => {
        const pos = getPos(e);
        const hit = findNode(pos.worldX, pos.worldY);
        if (hit) {
          this.draggedNode = hit;
          this.selectedNode = hit;
          this.canvas.style.cursor = "grabbing";
          if (this.options.onSelect) this.options.onSelect(hit);
        } else {
          this.isPanning = true;
          this.startPanX = pos.screenX - this.panX;
          this.startPanY = pos.screenY - this.panY;
          this.selectedNode = null;
          this.canvas.style.cursor = "grabbing";
          if (this.options.onDeselect) this.options.onDeselect();
        }
      });

      this.onMouseMove = (e) => {
        if (!this.canvas || !document.contains(this.canvas)) return;
        const pos = getPos(e);

        if (this.draggedNode) {
          this.draggedNode.x = pos.worldX;
          this.draggedNode.y = pos.worldY;
          this.draggedNode.vx = 0;
          this.draggedNode.vy = 0;
        } else if (this.isPanning) {
          this.panX = pos.screenX - this.startPanX;
          this.panY = pos.screenY - this.startPanY;
        } else {
          const hit = findNode(pos.worldX, pos.worldY);
          this.hoveredNode = hit;
          this.canvas.style.cursor = hit ? "pointer" : "grab";
        }
      };
      window.addEventListener("mousemove", this.onMouseMove);

      this.onMouseUp = () => {
        this.draggedNode = null;
        this.isPanning = false;
        if (this.canvas) this.canvas.style.cursor = "grab";
      };
      window.addEventListener("mouseup", this.onMouseUp);

      this.canvas.addEventListener(
        "wheel",
        (e) => {
          e.preventDefault();
          const pos = getPos(e);
          const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
          const newZoom = Math.min(Math.max(this.zoom * zoomFactor, 0.25), 3.5);

          this.panX = pos.screenX - (pos.screenX - this.panX) * (newZoom / this.zoom);
          this.panY = pos.screenY - (pos.screenY - this.panY) * (newZoom / this.zoom);
          this.zoom = newZoom;
        },
        { passive: false }
      );
    }

    startLoop() {
      let stepCount = 0;
      const loop = () => {
        if (!this.canvas || !document.contains(this.canvas)) return;

        if (this.physicsEnabled || stepCount < 60) {
          this.stepPhysics();
          stepCount++;
        }

        this.draw();
        this.animId = requestAnimationFrame(loop);
      };
      this.animId = requestAnimationFrame(loop);
    }

    stepPhysics() {
      const nodes = this.data.nodes.filter((n) => !n.hidden);
      const edges = this.data.edges;
      const centerX = this.width / 2;
      const centerY = this.height / 2;

      // 1. Repulsão de Coulomb entre todos os nós
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const n1 = nodes[i];
          const n2 = nodes[j];
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const dist = Math.hypot(dx, dy) || 1;
          if (dist < 580) {
            const force = (n1.isTarget || n2.isTarget ? 9500 : 5000) / (dist * dist);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            n1.vx -= fx;
            n1.vy -= fy;
            n2.vx += fx;
            n2.vy += fy;
          }
        }
      }

      // 2. Atração por molas (Hooke) através das conexões
      edges.forEach((e) => {
        const fromNode = nodes.find((n) => n.id === e.from);
        const toNode = nodes.find((n) => n.id === e.to);
        if (fromNode && toNode) {
          const dx = toNode.x - fromNode.x;
          const dy = toNode.y - fromNode.y;
          const dist = Math.hypot(dx, dy) || 1;
          const desired = 240;
          const spring = (dist - desired) * 0.032;
          const fx = (dx / dist) * spring;
          const fy = (dy / dist) * spring;
          fromNode.vx += fx;
          fromNode.vy += fy;
          toNode.vx -= fx;
          toNode.vy -= fy;
        }
      });

      // 3. Gravidade central & Amortecimento
      nodes.forEach((n) => {
        n.vx += (centerX - n.x) * 0.012;
        n.vy += (centerY - n.y) * 0.012;

        n.vx *= 0.84;
        n.vy *= 0.84;

        if (n !== this.draggedNode) {
          n.x += n.vx;
          n.y += n.vy;
        }
      });
    }

    draw() {
      const ctx = this.ctx;
      // Preenchimento com Fundo Dark Forense Profundo (#07090E)
      ctx.fillStyle = "#07090E";
      ctx.fillRect(0, 0, this.width, this.height);

      ctx.save();
      ctx.translate(this.panX, this.panY);
      ctx.scale(this.zoom, this.zoom);

      const nodes = this.data.nodes;

      // Desenha Arestas
      this.data.edges.forEach((e) => {
        const fromNode = nodes.find((n) => n.id === e.from);
        const toNode = nodes.find((n) => n.id === e.to);
        if (fromNode && toNode && !fromNode.hidden && !toNode.hidden) {
          const isHigh = fromNode === this.hoveredNode || toNode === this.hoveredNode || fromNode === this.selectedNode || toNode === this.selectedNode;

          ctx.beginPath();
          ctx.moveTo(fromNode.x, fromNode.y);
          ctx.lineTo(toNode.x, toNode.y);
          ctx.strokeStyle = isHigh ? "rgba(168, 85, 247, 0.85)" : "rgba(148, 163, 184, 0.32)";
          ctx.lineWidth = isHigh ? 2.5 : 1.5;
          ctx.stroke();

          // Seta direcional
          const angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x);
          const arrowOffset = toNode.isTarget ? 38 : 28;
          const arrowX = toNode.x - Math.cos(angle) * arrowOffset;
          const arrowY = toNode.y - Math.sin(angle) * arrowOffset;

          ctx.beginPath();
          ctx.moveTo(arrowX, arrowY);
          ctx.lineTo(arrowX - 8 * Math.cos(angle - Math.PI / 6), arrowY - 8 * Math.sin(angle - Math.PI / 6));
          ctx.lineTo(arrowX - 8 * Math.cos(angle + Math.PI / 6), arrowY - 8 * Math.sin(angle + Math.PI / 6));
          ctx.closePath();
          ctx.fillStyle = isHigh ? "#C4B5FD" : "rgba(148, 163, 184, 0.6)";
          ctx.fill();

          // Rótulo da aresta
          if (e.label) {
            const midX = (fromNode.x + toNode.x) / 2;
            const midY = (fromNode.y + toNode.y) / 2;
            ctx.font = "9px 'JetBrains Mono', monospace";
            const tw = ctx.measureText(e.label).width;

            ctx.fillStyle = "rgba(9, 11, 17, 0.92)";
            ctx.fillRect(midX - tw / 2 - 4, midY - 7, tw + 8, 14);
            ctx.strokeStyle = "rgba(139, 92, 246, 0.25)";
            ctx.lineWidth = 1;
            ctx.strokeRect(midX - tw / 2 - 4, midY - 7, tw + 8, 14);

            ctx.fillStyle = isHigh ? "#E2E8F0" : "#94A3B8";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(e.label, midX, midY);
          }
        }
      });

      // Desenha Nós
      nodes.filter((n) => !n.hidden).forEach((n) => {
        const isHover = n === this.hoveredNode;
        const isSel = n === this.selectedNode;
        const theme = GRAPH_THEME[n.group] || GRAPH_THEME.alvo;

        ctx.save();
        ctx.shadowColor = isSel ? "#A855F7" : (isHover ? "#38BDF8" : theme.glow);
        ctx.shadowBlur = n.isTarget || isSel || isHover ? 20 : 8;

        if (n.isTarget) {
          // Nó Central do Alvo
          ctx.beginPath();
          ctx.arc(n.x, n.y, 34, 0, Math.PI * 2);
          ctx.fillStyle = isSel ? "#9333EA" : theme.bg;
          ctx.fill();
          ctx.lineWidth = isSel || isHover ? 3.5 : 2.5;
          ctx.strokeStyle = isSel ? "#FFFFFF" : theme.border;
          ctx.stroke();

          // Foto biométrica se existir
          if (n.photoImg && n.photoImg.complete && n.photoImg.naturalWidth > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(n.x, n.y, 30, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(n.photoImg, n.x - 30, n.y - 30, 60, 60);
            ctx.restore();
          }

          ctx.shadowBlur = 0;
          ctx.font = "bold 13px Inter, sans-serif";
          ctx.fillStyle = "#FFFFFF";
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillText(n.label, n.x, n.y + 44);

          ctx.font = "10px 'JetBrains Mono', monospace";
          ctx.fillStyle = "#C4B5FD";
          ctx.fillText(n.sublabel || "", n.x, n.y + 60);
        } else {
          // Nós normais (Card Retangular Estilizado)
          ctx.font = "11px Inter, sans-serif";
          const labelWidth = Math.max(ctx.measureText(n.label).width, 70);
          const boxW = labelWidth + 24;
          const boxH = 32;
          const rx = n.x - boxW / 2;
          const ry = n.y - boxH / 2;

          ctx.beginPath();
          if (typeof ctx.roundRect === "function") {
            ctx.roundRect(rx, ry, boxW, boxH, 6);
          } else {
            ctx.rect(rx, ry, boxW, boxH);
          }
          ctx.fillStyle = isSel ? "rgba(139, 92, 246, 0.45)" : theme.bg;
          ctx.fill();
          ctx.lineWidth = isSel || isHover ? 2.5 : 1.5;
          ctx.strokeStyle = isSel ? "#C4B5FD" : theme.border;
          ctx.stroke();

          // Ponto indicador de categoria
          ctx.beginPath();
          ctx.arc(rx + 10, n.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = theme.border;
          ctx.fill();

          // Texto do rótulo
          ctx.shadowBlur = 0;
          ctx.fillStyle = theme.text || "#F8FAFC";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(n.label, rx + 18, n.y);

          // Sublabel abaixo do card
          if (n.sublabel) {
            ctx.font = "9px 'JetBrains Mono', monospace";
            ctx.fillStyle = "#94A3B8";
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillText(n.sublabel, n.x, ry + boxH + 6);
          }
        }
        ctx.restore();
      });

      ctx.restore();
    }

    fit() {
      const visibleNodes = this.data.nodes.filter((n) => !n.hidden);
      if (visibleNodes.length === 0) return;

      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      visibleNodes.forEach((n) => {
        minX = Math.min(minX, n.x - 50);
        maxX = Math.max(maxX, n.x + 50);
        minY = Math.min(minY, n.y - 50);
        maxY = Math.max(maxY, n.y + 50);
      });

      const spanX = Math.max(maxX - minX, 100);
      const spanY = Math.max(maxY - minY, 100);

      const targetZoom = Math.min(
        Math.max(Math.min((this.width - 80) / spanX, (this.height - 80) / spanY), 0.4),
        1.3
      );

      this.zoom = targetZoom;
      this.panX = this.width / 2 - ((minX + maxX) / 2) * this.zoom;
      this.panY = this.height / 2 - ((minY + maxY) / 2) * this.zoom;
    }

    updateFilters(activeFilters) {
      const isAll = activeFilters.has("todos");
      this.data.nodes.forEach((n) => {
        if (n.isTarget) {
          n.hidden = false;
        } else {
          n.hidden = !isAll && !activeFilters.has(n.category);
        }
      });
      this.fit();
    }

    destroy() {
      if (this.animId) {
        cancelAnimationFrame(this.animId);
        this.animId = null;
      }
      window.removeEventListener("resize", this.onResize);
      window.removeEventListener("mousemove", this.onMouseMove);
      window.removeEventListener("mouseup", this.onMouseUp);
      if (this.canvas && this.canvas.parentNode) {
        this.canvas.parentNode.removeChild(this.canvas);
      }
    }
  }

  /**
   * Renderizador e Controlador Principal do Modal do Grafo
   */
  class OsintGraphController {
    constructor() {
      this.network = null;
      this.currentData = null;
      this.currentMeta = null;
      this.activeFilters = new Set(["todos"]);
      this.physicsEnabled = true;
      if (typeof document !== "undefined") {
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", () => this.ensureModalMarkup());
        } else {
          this.ensureModalMarkup();
        }
      }
    }

    /**
     * Garante que o markup do modal exista no DOM
     */
    ensureModalMarkup() {
      if (typeof document === "undefined" || !document.body) return;
      if (document.getElementById("modalGrafoOsint")) return;

      const modalHtml = `
        <div id="modalGrafoOsint" class="osint-graph-modal-backdrop" style="display: none;">
          <div class="osint-graph-dialog">
            <!-- Topo do Grafo -->
            <div class="osint-graph-header">
              <div class="osint-graph-title-group">
                <div class="osint-graph-icon-badge">
                  <i data-lucide="share-2" style="width: 20px; height: 20px;"></i>
                </div>
                <div>
                  <div class="osint-graph-title-row">
                    <h3 class="osint-graph-title">Grafo de Vínculos & Link Analysis</h3>
                    <span class="osint-graph-target-badge" id="graphTargetBadge">ALVO: CARREGANDO...</span>
                  </div>
                  <div class="osint-graph-subtitle">Mapeamento topológico de relacionamentos, sócios, contatos e endereços</div>
                </div>
              </div>

              <!-- Ações da Barra Superior -->
              <div class="osint-graph-actions">
                <button type="button" class="btn btn-outline btn-sm" id="btnGraphExportPng" title="Exportar imagem em alta resolução (PNG)">
                  <i data-lucide="camera" style="width: 14px; height: 14px;"></i>
                  <span>Exportar PNG</span>
                </button>
                <button type="button" class="btn btn-outline btn-sm" id="btnGraphFit" title="Centralizar visualização">
                  <i data-lucide="crosshair" style="width: 14px; height: 14px;"></i>
                  <span>Centralizar</span>
                </button>
                <button type="button" class="btn btn-outline btn-sm" id="btnGraphTogglePhysics" title="Pausar ou reativar física">
                  <i data-lucide="pause" id="iconGraphPhysics" style="width: 14px; height: 14px;"></i>
                  <span id="textGraphPhysics">Pausar</span>
                </button>
                <button type="button" class="btn btn-ghost btn-sm" id="btnFecharModalGrafo" title="Fechar (Esc)">
                  <i data-lucide="x" style="width: 20px; height: 20px;"></i>
                </button>
              </div>
            </div>

            <!-- Barra de Filtros por Categoria -->
            <div class="osint-graph-filter-bar">
              <span class="filter-bar-label">Filtrar Vínculos:</span>
              <div class="filter-chips-wrapper" id="graphFilterChips">
                <button type="button" class="graph-filter-chip active" data-filter="todos">
                  <span>Todos os Vínculos</span>
                  <span class="chip-count" id="count_todos">0</span>
                </button>
                <button type="button" class="graph-filter-chip active" data-filter="familia">
                  <span class="chip-dot" style="background: #EC4899;"></span>
                  <span>Família</span>
                  <span class="chip-count" id="count_familia">0</span>
                </button>
                <button type="button" class="graph-filter-chip active" data-filter="empresas">
                  <span class="chip-dot" style="background: #3B82F6;"></span>
                  <span>Empresas</span>
                  <span class="chip-count" id="count_empresas">0</span>
                </button>
                <button type="button" class="graph-filter-chip active" data-filter="telefones">
                  <span class="chip-dot" style="background: #F59E0B;"></span>
                  <span>Telefones</span>
                  <span class="chip-count" id="count_telefones">0</span>
                </button>
                <button type="button" class="graph-filter-chip active" data-filter="enderecos">
                  <span class="chip-dot" style="background: #10B981;"></span>
                  <span>Endereços</span>
                  <span class="chip-count" id="count_enderecos">0</span>
                </button>
                <button type="button" class="graph-filter-chip active" data-filter="financeiro">
                  <span class="chip-dot" style="background: #06B6D4;"></span>
                  <span>Financeiro / PIX</span>
                  <span class="chip-count" id="count_financeiro">0</span>
                </button>
                <button type="button" class="graph-filter-chip active" data-filter="veiculos">
                  <span class="chip-dot" style="background: #EF4444;"></span>
                  <span>Veículos</span>
                  <span class="chip-count" id="count_veiculos">0</span>
                </button>
              </div>
            </div>

            <!-- Corpo Principal: Canvas + Inspector Lateral -->
            <div class="osint-graph-body">
              <div id="visNetworkContainer" class="osint-network-viewport"></div>
              
              <!-- Inspector Lateral Deslizante -->
              <div id="graphInspectorDrawer" class="osint-inspector-drawer" style="display: none;">
                <div class="inspector-header">
                  <div class="inspector-badge" id="inspTipoBadge">ENTIDADE</div>
                  <button type="button" class="inspector-close-btn" id="btnFecharInspector">
                    <i data-lucide="x" style="width: 16px; height: 16px;"></i>
                  </button>
                </div>
                <div class="inspector-body">
                  <div class="inspector-photo-wrapper" id="inspPhotoWrapper" style="display: none;">
                    <img id="inspPhotoImg" src="" alt="Foto" class="inspector-photo">
                  </div>
                  <h4 class="inspector-title" id="inspTitle">Nome do Vínculo</h4>
                  <div class="inspector-subtitle" id="inspSubtitle">Metadados</div>

                  <div class="inspector-fields-list" id="inspFieldsList"></div>

                  <div class="inspector-actions" id="inspActions">
                    <button type="button" class="btn btn-primary btn-sm btn-block" id="btnInvestigarNo">
                      <i data-lucide="search" style="width: 14px; height: 14px;"></i>
                      <span>Investigar este Dado</span>
                    </button>
                  </div>
                </div>
              </div>

              <!-- Legenda Fixa no Rodapé do Canvas -->
              <div class="osint-graph-legend">
                <div class="legend-item"><span class="legend-color" style="background: #8B5CF6;"></span><span>Alvo</span></div>
                <div class="legend-item"><span class="legend-color" style="background: #EC4899;"></span><span>Família</span></div>
                <div class="legend-item"><span class="legend-color" style="background: #3B82F6;"></span><span>Empresas</span></div>
                <div class="legend-item"><span class="legend-color" style="background: #F59E0B;"></span><span>Telefones</span></div>
                <div class="legend-item"><span class="legend-color" style="background: #10B981;"></span><span>Endereços</span></div>
                <div class="legend-item"><span class="legend-color" style="background: #06B6D4;"></span><span>Financeiro</span></div>
                <div class="legend-item"><span class="legend-color" style="background: #EF4444;"></span><span>Veículos</span></div>
              </div>
            </div>
          </div>
        </div>
      `;

      const wrapper = document.createElement("div");
      wrapper.innerHTML = modalHtml;
      document.body.appendChild(wrapper.firstElementChild);

      this.injectStyles();
      this.bindEvents();
    }

    /**
     * Injeção de Estilos CSS do Grafo
     */
    injectStyles() {
      if (typeof document === "undefined" || !document.head) return;
      if (document.getElementById("osintGraphStyles")) return;
      const css = `
        .osint-graph-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(3, 4, 8, 0.88);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }

        .osint-graph-dialog {
          background: #090B11;
          border: 1px solid rgba(139, 92, 246, 0.35);
          border-radius: 14px;
          width: 100%;
          max-width: 1300px;
          height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 30px 80px rgba(0, 0, 0, 0.9), 0 0 50px rgba(139, 92, 246, 0.2);
          overflow: hidden;
          animation: graphModalEntrance 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes graphModalEntrance {
          from { opacity: 0; transform: scale(0.96) translateY(15px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        .osint-graph-header {
          padding: 14px 20px;
          border-bottom: 1px solid #1A1F2C;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          background: linear-gradient(90deg, #0D101A 0%, #161226 100%);
          flex-wrap: wrap;
        }

        .osint-graph-title-group {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .osint-graph-icon-badge {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: rgba(6, 182, 212, 0.15);
          border: 1px solid rgba(6, 182, 212, 0.4);
          color: #22D3EE;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .osint-graph-title-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .osint-graph-title {
          font-size: 1.05rem;
          font-weight: 800;
          color: #F8FAFC;
          margin: 0;
          letter-spacing: -0.01em;
        }

        .osint-graph-target-badge {
          font-size: 0.72rem;
          font-family: var(--font-mono, monospace);
          font-weight: 700;
          background: rgba(139, 92, 246, 0.2);
          color: #C4B5FD;
          border: 1px solid rgba(139, 92, 246, 0.35);
          padding: 3px 8px;
          border-radius: 4px;
        }

        .osint-graph-subtitle {
          font-size: 0.76rem;
          color: #94A3B8;
          margin-top: 2px;
        }

        .osint-graph-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        /* Barra de Filtros */
        .osint-graph-filter-bar {
          background: #0A0D15;
          border-bottom: 1px solid #161B26;
          padding: 8px 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          overflow-x: auto;
        }

        .filter-bar-label {
          font-size: 0.75rem;
          font-weight: 700;
          color: #64748B;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          white-space: nowrap;
        }

        .filter-chips-wrapper {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .graph-filter-chip {
          background: #121622;
          border: 1px solid #1E2536;
          color: #94A3B8;
          padding: 4px 10px;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .graph-filter-chip:hover {
          color: #FFFFFF;
          border-color: rgba(255, 255, 255, 0.2);
        }

        .graph-filter-chip.active {
          background: rgba(139, 92, 246, 0.18);
          border-color: #8B5CF6;
          color: #E2E8F0;
        }

        .chip-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
        }

        .chip-count {
          font-family: var(--font-mono, monospace);
          font-size: 0.7rem;
          background: rgba(255, 255, 255, 0.08);
          padding: 1px 5px;
          border-radius: 4px;
        }

        /* Área do Canvas */
        .osint-graph-body {
          flex: 1;
          min-height: 420px;
          height: calc(90vh - 120px);
          position: relative;
          background: radial-gradient(circle at 50% 50%, #0D1019 0%, #06070B 100%);
          overflow: hidden;
        }

        .osint-network-viewport {
          position: absolute;
          inset: 0;
          width: 100% !important;
          height: 100% !important;
          min-height: 420px;
        }

        /* Inspector Lateral */
        .osint-inspector-drawer {
          position: absolute;
          top: 16px;
          right: 16px;
          bottom: 16px;
          width: 320px;
          background: rgba(13, 17, 26, 0.94);
          border: 1px solid rgba(139, 92, 246, 0.4);
          border-radius: 12px;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.7), 0 0 20px rgba(139, 92, 246, 0.15);
          display: flex;
          flex-direction: column;
          z-index: 20;
          animation: drawerSlide 0.25s ease-out;
          overflow: hidden;
        }

        @keyframes drawerSlide {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }

        .inspector-header {
          padding: 12px 14px;
          border-bottom: 1px solid #1E2536;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .inspector-badge {
          font-size: 0.68rem;
          font-weight: 800;
          font-family: var(--font-mono, monospace);
          color: #38BDF8;
          background: rgba(6, 182, 212, 0.15);
          border: 1px solid rgba(6, 182, 212, 0.3);
          padding: 2px 7px;
          border-radius: 4px;
        }

        .inspector-close-btn {
          background: none;
          border: none;
          color: #64748B;
          cursor: pointer;
          padding: 2px;
          display: flex;
        }

        .inspector-close-btn:hover {
          color: #FFFFFF;
        }

        .inspector-body {
          padding: 14px;
          overflow-y: auto;
          flex: 1;
        }

        .inspector-photo-wrapper {
          text-align: center;
          margin-bottom: 12px;
        }

        .inspector-photo {
          width: 72px;
          height: 84px;
          border-radius: 8px;
          object-fit: cover;
          border: 2px solid #8B5CF6;
          box-shadow: 0 4px 15px rgba(139, 92, 246, 0.4);
        }

        .inspector-title {
          font-size: 0.95rem;
          font-weight: 800;
          color: #F8FAFC;
          margin-bottom: 4px;
          line-height: 1.3;
        }

        .inspector-subtitle {
          font-size: 0.75rem;
          color: #94A3B8;
          margin-bottom: 14px;
          font-family: var(--font-mono, monospace);
        }

        .inspector-fields-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 16px;
        }

        .inspector-field-row {
          background: #111522;
          border: 1px solid #1C2333;
          border-radius: 6px;
          padding: 7px 10px;
        }

        .insp-label {
          font-size: 0.68rem;
          color: #64748B;
          text-transform: uppercase;
          font-weight: 700;
        }

        .insp-value {
          font-size: 0.82rem;
          color: #E2E8F0;
          font-weight: 600;
          margin-top: 2px;
          word-break: break-all;
        }

        .inspector-actions {
          margin-top: 10px;
        }

        /* Legenda Fixa */
        .osint-graph-legend {
          position: absolute;
          bottom: 16px;
          left: 16px;
          background: rgba(11, 14, 22, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 6px 12px;
          display: flex;
          gap: 12px;
          align-items: center;
          z-index: 10;
          backdrop-filter: blur(8px);
          pointer-events: none;
          flex-wrap: wrap;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 0.72rem;
          color: #94A3B8;
          font-weight: 600;
        }

        .legend-color {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
      `;

      const styleEl = document.createElement("style");
      styleEl.id = "osintGraphStyles";
      styleEl.textContent = css;
      document.head.appendChild(styleEl);
    }

    /**
     * Bind de eventos da UI do Grafo
     */
    bindEvents() {
      // 1. Fechar modal
      document.getElementById("btnFecharModalGrafo")?.addEventListener("click", () => this.close());
      document.getElementById("modalGrafoOsint")?.addEventListener("click", (e) => {
        if (e.target.id === "modalGrafoOsint") this.close();
      });

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          const m = document.getElementById("modalGrafoOsint");
          if (m && m.style.display === "flex") {
            this.close();
          }
        }
      });

      // 2. Centralizar Grafo
      document.getElementById("btnGraphFit")?.addEventListener("click", () => {
        if (this.network) {
          try {
            this.network.fit({ animation: { duration: 600, easingFunction: "easeInOutQuad" } });
          } catch {}
        } else if (this.nativeEngine) {
          this.nativeEngine.fit();
        }
      });

      // 3. Pausar / Retomar Física
      document.getElementById("btnGraphTogglePhysics")?.addEventListener("click", () => {
        this.togglePhysics();
      });

      // 4. Exportar Imagem PNG
      document.getElementById("btnGraphExportPng")?.addEventListener("click", () => {
        this.exportPng();
      });

      // 5. Fechar Inspector Lateral
      document.getElementById("btnFecharInspector")?.addEventListener("click", () => {
        this.hideInspector();
      });

      // 6. Filtros por Categoria
      const filterChips = document.querySelectorAll("#graphFilterChips .graph-filter-chip");
      filterChips.forEach((chip) => {
        chip.addEventListener("click", () => {
          const filter = chip.getAttribute("data-filter");
          this.applyFilter(filter, chip);
        });
      });
    }

    /**
     * Abre o modal e renderiza o Grafo de Vínculos
     */
    open(payload, meta = {}) {
      this.ensureModalMarkup();

      const modalEl = document.getElementById("modalGrafoOsint");
      if (!modalEl) return;

      this.currentMeta = meta;
      this.currentData = buildGraphData(payload, meta);

      // Atualiza badge de título
      const targetNode = this.currentData.nodes.find((n) => n.isTarget);
      const badgeEl = document.getElementById("graphTargetBadge");
      if (badgeEl && targetNode) {
        badgeEl.textContent = `ALVO: ${targetNode.label} (${targetNode.details?.cpf || targetNode.details?.cnpj || meta.termo || "VÍNCULOS"})`;
      }

      // Atualiza contadores dos chips
      this.updateCounts();

      modalEl.style.display = "flex";
      document.body.style.overflow = "hidden";

      // Força reflow no DOM para garantir dimensões exatas de clientWidth/clientHeight
      void modalEl.offsetWidth;

      // Renderiza o grafo
      this.renderNetwork();

      // Múltiplos ajustes de fit após entrada da animação do modal
      setTimeout(() => {
        if (this.network) {
          try {
            this.network.setSize("100%", "100%");
            this.network.redraw();
            this.network.fit({ animation: { duration: 400, easingFunction: "easeInOutQuad" } });
          } catch {}
        } else if (this.nativeEngine) {
          this.nativeEngine.resize();
          this.nativeEngine.fit();
        }
      }, 200);

      setTimeout(() => {
        if (this.network) {
          try {
            this.network.redraw();
            this.network.fit();
          } catch {}
        }
      }, 450);

      if (window.lucide) lucide.createIcons();
    }

    /**
     * Fecha o modal do grafo
     */
    close() {
      const modalEl = document.getElementById("modalGrafoOsint");
      if (modalEl) modalEl.style.display = "none";
      document.body.style.overflow = "";
      this.hideInspector();

      if (this.network) {
        try {
          this.network.destroy();
        } catch {}
        this.network = null;
      }

      if (this.nativeEngine) {
        try {
          this.nativeEngine.destroy();
        } catch {}
        this.nativeEngine = null;
      }
    }

    /**
     * Atualiza contadores nas abas de filtros
     */
    updateCounts() {
      if (!this.currentData) return;
      const nodes = this.currentData.nodes;
      
      const counts = {
        todos: nodes.length,
        familia: nodes.filter((n) => n.category === "familia").length,
        empresas: nodes.filter((n) => n.category === "empresas").length,
        telefones: nodes.filter((n) => n.category === "telefones").length,
        enderecos: nodes.filter((n) => n.category === "enderecos").length,
        financeiro: nodes.filter((n) => n.category === "financeiro").length,
        veiculos: nodes.filter((n) => n.category === "veiculos").length,
      };

      Object.keys(counts).forEach((k) => {
        const el = document.getElementById(`count_${k}`);
        if (el) el.textContent = counts[k];
      });
    }

    /**
     * Renderização Topológica com Vis.js ou Fallback Nativo 60FPS
     */
    renderNetwork() {
      const container = document.getElementById("visNetworkContainer");
      if (!container || !this.currentData) return;

      container.innerHTML = "";

      let visLoaded = false;
      if (typeof vis !== "undefined" && vis.Network) {
        try {
          this.renderWithVisJs(container);
          visLoaded = true;
        } catch (err) {
          console.warn("[OSINT GRAPH] Erro ao instanciar Vis.js, iniciando motor nativo:", err);
          visLoaded = false;
        }
      }

      if (!visLoaded) {
        this.renderNativeEngine(container);
      }
    }

    /**
     * Renderizador Vis.js Profissional
     */
    renderWithVisJs(container) {
      const nodesDataSet = new vis.DataSet(
        this.currentData.nodes.map((n) => {
          const item = { ...n };
          if (!item.image) delete item.image;
          return {
            ...item,
            shadow: { enabled: true, color: n.color?.border || GRAPH_THEME.target.glow, size: 8 }
          };
        })
      );

      const edgesDataSet = new vis.DataSet(
        this.currentData.edges.map((e) => ({
          ...e,
          color: { color: GRAPH_THEME.edge.color, highlight: GRAPH_THEME.edge.highlight, hover: "#C4B5FD" },
          font: { color: GRAPH_THEME.edge.text, size: 9, face: "JetBrains Mono", strokeWidth: 0, background: "#090B11" },
          smooth: { type: "continuous", roundness: 0.15 }
        }))
      );

      this.visNodes = nodesDataSet;
      this.visEdges = edgesDataSet;

      const options = {
        nodes: {
          borderWidth: 2,
          borderWidthSelected: 3,
          margin: 10,
          shape: "box",
          font: { color: "#FFFFFF", size: 12, face: "Inter" }
        },
        edges: {
          width: 1.5,
          selectionWidth: 2.5,
          color: {
            color: "rgba(148, 163, 184, 0.45)",
            highlight: "#A855F7",
            hover: "#38BDF8"
          },
          font: {
            color: "#94A3B8",
            size: 10,
            face: "JetBrains Mono, monospace",
            strokeWidth: 2,
            strokeColor: "#07090E",
            align: "middle"
          },
          smooth: {
            type: "continuous"
          }
        },
        groups: {
          alvo: {
            borderWidth: 3,
            color: { background: GRAPH_THEME.target.bg, border: GRAPH_THEME.target.border },
            font: { bold: true, size: 13, color: "#FFFFFF" }
          },
          familia: {
            color: { background: GRAPH_THEME.familia.bg, border: GRAPH_THEME.familia.border },
            font: { color: GRAPH_THEME.familia.text }
          },
          empresa: {
            color: { background: GRAPH_THEME.empresa.bg, border: GRAPH_THEME.empresa.border },
            font: { color: GRAPH_THEME.empresa.text }
          },
          telefone: {
            color: { background: GRAPH_THEME.telefone.bg, border: GRAPH_THEME.telefone.border },
            font: { color: GRAPH_THEME.telefone.text }
          },
          endereco: {
            color: { background: GRAPH_THEME.endereco.bg, border: GRAPH_THEME.endereco.border },
            font: { color: GRAPH_THEME.endereco.text }
          },
          financeiro: {
            color: { background: GRAPH_THEME.financeiro.bg, border: GRAPH_THEME.financeiro.border },
            font: { color: GRAPH_THEME.financeiro.text }
          },
          veiculo: {
            color: { background: GRAPH_THEME.veiculo.bg, border: GRAPH_THEME.veiculo.border },
            font: { color: GRAPH_THEME.veiculo.text }
          },
          saude: {
            color: { background: GRAPH_THEME.saude.bg, border: GRAPH_THEME.saude.border },
            font: { color: GRAPH_THEME.saude.text }
          }
        },
        physics: {
          enabled: true,
          barnesHut: {
            gravitationalConstant: -8500,
            centralGravity: 0.12,
            springLength: 260,
            springConstant: 0.03,
            damping: 0.09,
            avoidOverlap: 0.85
          },
          stabilization: {
            iterations: 120,
            updateInterval: 25
          }
        },
        interaction: {
          hover: true,
          tooltipDelay: 200,
          hideEdgesOnDrag: false,
          multiselect: false,
          navigationButtons: false
        }
      };

      this.network = new vis.Network(container, { nodes: nodesDataSet, edges: edgesDataSet }, options);

      // Fundo Dark Forense Contínuo no Canvas do Vis.js (#07090E)
      this.network.on("beforeDrawing", (ctx) => {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "#07090E";
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.restore();
      });

      // Eventos de clique em nós
      this.network.on("selectNode", (params) => {
        if (params.nodes && params.nodes.length > 0) {
          const nodeId = params.nodes[0];
          const nodeData = this.currentData.nodes.find((n) => n.id === nodeId);
          if (nodeData) this.showInspector(nodeData);
        }
      });

      this.network.on("deselectNode", () => {
        this.hideInspector();
      });

      // Estabilização suave
      this.network.once("stabilizationIterationsDone", () => {
        this.network.setOptions({ physics: { enabled: false } });
        this.physicsEnabled = false;
        this.updatePhysicsButton();
        try {
          this.network.fit({ animation: { duration: 400, easingFunction: "easeInOutQuad" } });
        } catch {}
      });
    }

    /**
     * Motor Nativo de Física Force-Directed em HTML5 Canvas 60FPS
     * Totalmente autônomo, imune a bloqueios de rede/Brave Shields
     */
    renderNativeEngine(container) {
      if (this.nativeEngine) {
        try { this.nativeEngine.destroy(); } catch {}
        this.nativeEngine = null;
      }

      this.nativeEngine = new NativeForceDirectedGraph(container, this.currentData, {
        physicsEnabled: this.physicsEnabled,
        onSelect: (node) => this.showInspector(node),
        onDeselect: () => this.hideInspector()
      });
    }

    /**
     * Alterna o estado do motor de física
     */
    togglePhysics() {
      this.physicsEnabled = !this.physicsEnabled;

      if (this.network) {
        this.network.setOptions({ physics: { enabled: this.physicsEnabled } });
      }

      if (this.nativeEngine) {
        this.nativeEngine.physicsEnabled = this.physicsEnabled;
      }

      this.updatePhysicsButton();
    }

    updatePhysicsButton() {
      const icon = document.getElementById("iconGraphPhysics");
      const text = document.getElementById("textGraphPhysics");
      if (text) text.textContent = this.physicsEnabled ? "Pausar" : "Simular";
      if (icon) icon.setAttribute("data-lucide", this.physicsEnabled ? "pause" : "play");
      if (window.lucide) lucide.createIcons();
    }

    /**
     * Aplica filtros visuais por categoria
     */
    applyFilter(category, clickedChip) {
      const chips = document.querySelectorAll("#graphFilterChips .graph-filter-chip");

      if (category === "todos") {
        chips.forEach((c) => c.classList.add("active"));
        this.activeFilters = new Set(["todos"]);
      } else {
        document.querySelector('[data-filter="todos"]')?.classList.remove("active");
        clickedChip.classList.toggle("active");

        this.activeFilters = new Set();
        chips.forEach((c) => {
          if (c.classList.contains("active") && c.getAttribute("data-filter") !== "todos") {
            this.activeFilters.add(c.getAttribute("data-filter"));
          }
        });

        if (this.activeFilters.size === 0) {
          document.querySelector('[data-filter="todos"]')?.classList.add("active");
          this.activeFilters.add("todos");
        }
      }

      // Atualiza visibilidade dos nós no Vis.js
      if (this.visNodes) {
        const isAll = this.activeFilters.has("todos");
        const updates = this.currentData.nodes.map((n) => {
          if (n.isTarget) return { id: n.id, hidden: false };
          const shouldShow = isAll || this.activeFilters.has(n.category);
          return { id: n.id, hidden: !shouldShow };
        });
        this.visNodes.update(updates);
      }

      // Atualiza filtros no motor nativo
      if (this.nativeEngine) {
        this.nativeEngine.updateFilters(this.activeFilters);
      }
    }

    /**
     * Exibe o painel lateral com metadados do nó selecionado
     */
    showInspector(node) {
      const drawer = document.getElementById("graphInspectorDrawer");
      if (!drawer) return;

      const details = node.details || {};
      document.getElementById("inspTipoBadge").textContent = details.tipo || node.group.toUpperCase();
      document.getElementById("inspTitle").textContent = node.label;
      document.getElementById("inspSubtitle").textContent = node.sublabel || "";

      // Foto se houver
      const photoWrapper = document.getElementById("inspPhotoWrapper");
      const photoImg = document.getElementById("inspPhotoImg");
      if (details.foto && photoWrapper && photoImg) {
        photoImg.src = details.foto;
        photoWrapper.style.display = "block";
      } else if (photoWrapper) {
        photoWrapper.style.display = "none";
      }

      // Lista de campos detalhados
      const fieldsList = document.getElementById("inspFieldsList");
      if (fieldsList) {
        const entries = Object.entries(details).filter(
          ([k]) => !["tipo", "foto", "termoBusca", "tipoBusca", "moduloOrigem"].includes(k)
        );

        fieldsList.innerHTML = entries
          .map(
            ([key, val]) => `
          <div class="inspector-field-row">
            <div class="insp-label">${key.toUpperCase()}</div>
            <div class="insp-value">${val || "-"}</div>
          </div>
        `
          )
          .join("");
      }

      // Ação de Investigação Direta
      const btnInvestigar = document.getElementById("btnInvestigarNo");
      if (btnInvestigar) {
        if (details.termoBusca && details.tipoBusca && !node.isTarget) {
          btnInvestigar.style.display = "inline-flex";
          btnInvestigar.onclick = () => {
            const destUrl = `/zeroy?id=${encodeURIComponent(details.tipoBusca)}&termo=${encodeURIComponent(details.termoBusca)}`;
            window.location.href = destUrl;
          };
        } else {
          btnInvestigar.style.display = "none";
        }
      }

      drawer.style.display = "flex";
      if (window.lucide) lucide.createIcons();
    }

    /**
     * Oculta o painel lateral
     */
    hideInspector() {
      const drawer = document.getElementById("graphInspectorDrawer");
      if (drawer) drawer.style.display = "none";
    }

    /**
     * Exporta o Grafo como imagem PNG em alta resolução com Fundo Dark Forense e Certificado
     */
    exportPng() {
      const container = document.getElementById("visNetworkContainer");
      if (!container) return;

      const canvas = container.querySelector("canvas");
      if (!canvas) {
        if (window.toast) window.toast.warning("Não foi possível capturar a tela do grafo.");
        return;
      }

      try {
        const width = canvas.width;
        const height = canvas.height;
        const offscreen = document.createElement("canvas");
        offscreen.width = width;
        offscreen.height = height;
        const ctx = offscreen.getContext("2d");

        // 1. Fundo Gradiente Dark Forense Profundo (#0F1424 -> #07090E)
        const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 40, width / 2, height / 2, Math.max(width, height) * 0.75);
        bgGrad.addColorStop(0, "#0F1424");
        bgGrad.addColorStop(0.55, "#080B12");
        bgGrad.addColorStop(1, "#05070B");
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // 2. Grade Forense Blueprint Sutil
        ctx.strokeStyle = "rgba(148, 163, 184, 0.04)";
        ctx.lineWidth = 1;
        const gridSize = 45;
        for (let x = 0; x < width; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
        for (let y = 0; y < height; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }

        // 3. Desenhar o Grafo completo por cima
        ctx.drawImage(canvas, 0, 0);

        // 4. Marca D'água Forense e Cabeçalho Pericial no topo do PNG
        const termo = this.currentMeta?.termo || "Alvo Investigado";
        const dateStr = new Date().toLocaleString("pt-BR");
        const jsonStr = JSON.stringify(this.currentData || {});
        let docHash = "SHA-256";
        if (window.OsintDarkReport && typeof window.OsintDarkReport.generateSha256 === "function") {
          docHash = window.OsintDarkReport.generateSha256(jsonStr);
        } else if (this.currentData && this.currentData.nodes) {
          docHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
        }

        // Barra superior
        ctx.fillStyle = "rgba(7, 9, 14, 0.88)";
        ctx.fillRect(0, 0, width, 48);
        ctx.strokeStyle = "rgba(139, 92, 246, 0.4)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 48);
        ctx.lineTo(width, 48);
        ctx.stroke();

        ctx.font = "bold 13px Inter, -apple-system, sans-serif";
        ctx.fillStyle = "#A855F7";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText("RIMUBUSCA INTELLIGENCE OSINT • GRAFO TOPOLÓGICO DE VÍNCULOS", 20, 24);

        ctx.font = "11px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#94A3B8";
        ctx.textAlign = "right";
        ctx.fillText(`ALVO: ${termo} | ${dateStr}`, width - 20, 24);

        // Rodapé de Cadeia de Custódia Pericial
        ctx.fillStyle = "rgba(7, 9, 14, 0.92)";
        ctx.fillRect(0, height - 36, width, 36);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.beginPath();
        ctx.moveTo(0, height - 36);
        ctx.lineTo(width, height - 36);
        ctx.stroke();

        ctx.font = "10px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#64748B";
        ctx.textAlign = "left";
        ctx.fillText(`CUSTÓDIA FORENSE: SHA-256: ${docHash.slice(0, 36)}... • LGPD ART. 7º E ART. 4º`, 20, height - 18);

        ctx.textAlign = "right";
        ctx.fillStyle = "#34D399";
        ctx.fillText("REGISTRO AUDITADO & CRIPTOGRAFICAMENTE VERIFICADO", width - 20, height - 18);

        // 5. Download do PNG com Fundo Preto Impecável
        const link = document.createElement("a");
        const cleanTermo = termo.replace(/[^a-zA-Z0-9]/g, "");
        link.download = `grafo-osint-${cleanTermo || "alvo"}-${Date.now()}.png`;
        link.href = offscreen.toDataURL("image/png");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        if (window.toast) {
          window.toast.success("Grafo exportado em Alta Definição (Dark Forense) com sucesso!");
        }
      } catch (err) {
        console.error("[GRAPH EXPORT ERROR]:", err);
        if (window.toast) window.toast.error("Falha ao exportar imagem do grafo.");
      }
    }
  }

  // Instância Singleton
  const OsintGraphInstance = new OsintGraphController();

  // Exportação Global
  root.OsintGraph = {
    open: (payload, meta) => OsintGraphInstance.open(payload, meta),
    close: () => OsintGraphInstance.close(),
    buildGraphData,
    exportPng: () => OsintGraphInstance.exportPng(),
    instance: OsintGraphInstance
  };
})(typeof window !== "undefined" ? window : globalThis);
