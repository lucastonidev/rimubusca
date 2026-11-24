/**
 * ==============================================================================
 * RIMUBUSCA - CENTRAL UNIFICADA DE CONSULTAS & PUXAR DADOS (CONSULTA.JS)
 * Manipulação de abas, máscaras de entrada e renderização de resultados
 * Conectado à Hexys API (CPF, Telefone, Nome, CEP, Operadora, Foto, Placa,
 * E-mail, Vizinhos e Título de Eleitor).
 * Suporte completo a todas as seções e estruturas avançadas retornadas pela Hexys.
 * ==============================================================================
 */

class ConsultaController {
  constructor() {
    this.currentTipo = "cpf";
    this.currentData = null;
    this.init();
  }

  init() {
    this.markMaintenanceChips();
    this.bindCategories();
    this.bindModuleFilter();
    this.bindTabs();
    this.bindForm();
    this.bindDemos();
    this.bindCopyButtons();
    this.bindReportModal();
    this.initFromUrl();
  }

  markMaintenanceChips() {
    const data = window.__RIMU_MODULOS_DATA__ || [];
    data.forEach((mod) => {
      if (mod.manutencao) {
        const chip = document.querySelector(`.rimu-mod-chip[data-tipo="${mod.tipo}"]`);
        if (chip) {
          chip.style.opacity = "0.75";
          const badge = chip.querySelector(".rimu-mod-badge");
          if (badge) {
            badge.textContent = "Manutenção";
            badge.style.background = "rgba(239, 68, 68, 0.25)";
            badge.style.color = "#EF4444";
          }
        }
      }
    });
  }

  // 1. GERENCIAMENTO DE CATEGORIAS E MÓDULOS (ESTILO HUBAPI)
  bindCategories() {
    const catBtns = document.querySelectorAll(".rimu-category-btn");
    catBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        catBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        const cat = btn.dataset.cat;
        this.filterModulesByCategory(cat);
      });
    });
  }

  filterModulesByCategory(cat) {
    const chips = document.querySelectorAll(".rimu-mod-chip");
    const searchVal = (document.getElementById("filtroModulosInput")?.value || "").toLowerCase().trim();

    chips.forEach((chip) => {
      const chipCat = chip.dataset.categoria || "";
      const chipNome = (chip.dataset.nome || chip.textContent || "").toLowerCase();
      const chipTipo = (chip.dataset.tipo || "").toLowerCase();

      const matchesCat = cat === "todas" || chipCat === cat;
      const matchesSearch = !searchVal || chipNome.includes(searchVal) || chipTipo.includes(searchVal);

      if (matchesCat && matchesSearch) {
        chip.style.display = "inline-flex";
      } else {
        chip.style.display = "none";
      }
    });
  }

  bindModuleFilter() {
    const searchInput = document.getElementById("filtroModulosInput");
    if (!searchInput) return;

    searchInput.addEventListener("input", (e) => {
      const val = e.target.value.toLowerCase().trim();
      const activeCatBtn = document.querySelector(".rimu-category-btn.active");
      const currentCat = activeCatBtn?.dataset.cat || "todas";

      const chips = document.querySelectorAll(".rimu-mod-chip");
      chips.forEach((chip) => {
        const chipCat = chip.dataset.categoria || "";
        const chipNome = (chip.dataset.nome || chip.textContent || "").toLowerCase();
        const chipTipo = (chip.dataset.tipo || "").toLowerCase();
        const chipDesc = (chip.dataset.desc || "").toLowerCase();

        const matchesCat = currentCat === "todas" || chipCat === currentCat;
        const matchesSearch = !val || chipNome.includes(val) || chipTipo.includes(val) || chipDesc.includes(val);

        if (matchesCat && matchesSearch) {
          chip.style.display = "inline-flex";
        } else {
          chip.style.display = "none";
        }
      });
    });
  }

  bindTabs() {
    // Escuta tanto os chips modernos (.rimu-mod-chip) quanto os botões legados (.tipo-tab-btn)
    const chips = document.querySelectorAll(".rimu-mod-chip, .tipo-tab-btn");
    chips.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tipo = btn.dataset.tipo;
        if (tipo) this.selectTab(tipo);
      });
    });
  }

  initFromUrl() {
    const urlParams = new URLSearchParams(window.location?.search || "");
    const tipo = urlParams.get("tipo") || urlParams.get("type");
    const termo = urlParams.get("termo");
    const auto = urlParams.get("auto");

    if (tipo) {
      this.selectTab(tipo.toLowerCase());
    } else {
      this.selectTab("cpf");
    }

    if (termo) {
      const input = document.getElementById("consultaInput");
      const form = document.getElementById("consultaForm");
      if (input) {
        input.value = termo.trim();
        input.dispatchEvent(new Event("input"));
        if (auto === "1" && form) {
          setTimeout(() => {
            if (typeof form.requestSubmit === "function") {
              form.requestSubmit();
            } else {
              form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
            }
          }, 80);
        }
      }
    }
  }

  // 2. SELEÇÃO DE MÓDULOS (43 MÓDULOS OFICIAIS RIMUAPI)
  selectTab(tipo) {
    const cleanTipo = String(tipo || "cpf").toLowerCase().trim();
    this.currentTipo = cleanTipo === "foto" ? "fotos" : cleanTipo;

    // Sincroniza o parâmetro na URL (?tipo=...) sem recarregar a página
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("tipo") !== this.currentTipo) {
        url.searchParams.set("tipo", this.currentTipo);
        window.history.replaceState({ tipo: this.currentTipo }, "", url.toString());
      }
    } catch (_) {}

    // Atualiza chips .rimu-mod-chip e .tipo-tab-btn
    const allChips = document.querySelectorAll(".rimu-mod-chip, .tipo-tab-btn");
    let activeChip = null;
    allChips.forEach((btn) => {
      const bTipo = (btn.dataset.tipo || "").toLowerCase();
      if (bTipo === this.currentTipo || (this.currentTipo === "fotos" && bTipo === "foto")) {
        btn.classList.add("active");
        activeChip = btn;
      } else {
        btn.classList.remove("active");
      }
    });

    // Catálogo completo de configurações e máscaras dos 43 Módulos
    const configs = {
      // 1. Pessoa (10)
      cpf: {
        nome: "CPF Básico",
        label: "Informe o CPF (11 dígitos):",
        placeholder: "000.000.000-00",
        mask: "cpf",
        paramHint: "CPF (11 dígitos)",
        badge: "Oficial",
        badgeColor: "#10B981",
        desc: "Consulta cadastral básica oficial de pessoa física (dados, contatos e endereços).",
      },
      cpf_completo: {
        nome: "CPF PRO (Dossiê)",
        label: "Informe o CPF para Dossiê Completo (CPF PRO):",
        placeholder: "000.000.000-00",
        mask: "cpf",
        paramHint: "CPF (11 dígitos)",
        badge: "PRO",
        badgeColor: "#8B5CF6",
        desc: "Dossiê completo com dados biográficos, parentes, CNS, telefones e endereços vinculados.",
      },
      nome: {
        nome: "Nome Completo",
        label: "Informe o Nome Completo para Busca Nominal:",
        placeholder: "Ex: Carlos Eduardo Pereira da Silva",
        mask: null,
        paramHint: "Nome Completo Exato",
        badge: "Oficial",
        badgeColor: "#3B82F6",
        desc: "Localização cadastral individual do titular a partir do nome completo exato (entrega 1 resultado oficial).",
      },
      nome_similar: {
        nome: "Nome Similar / Fonético",
        label: "Informe o Nome Aproximado / Fonético:",
        placeholder: "Ex: Carlos Pereira Silva",
        mask: null,
        paramHint: "Primeiro e último nome",
        badge: "Homônimos",
        badgeColor: "#6366F1",
        desc: "Busca ampla fonética e aproximada de homônimos (entrega a lista de todos os registros semelhantes).",
      },
      rg: {
        nome: "Registro Geral (RG)",
        label: "Informe o Número do Registro Geral (RG):",
        placeholder: "Ex: 28374921X ou apenas números",
        mask: null,
        paramHint: "Número do RG (apenas números)",
        badge: "RG",
        badgeColor: "#06B6D4",
        desc: "Busca do dossiê cadastral do titular diretamente pelo número do RG.",
      },
      titulo: {
        nome: "Título de Eleitor",
        label: "Informe o Número do Título de Eleitor:",
        placeholder: "000000000000 (12 dígitos)",
        mask: "titulo",
        paramHint: "Título Eleitoral (12 dígitos)",
        badge: "TSE",
        badgeColor: "#14B8A6",
        desc: "Consulta de dados de pessoa física através dos 12 dígitos do Título Eleitoral.",
      },
      cns: {
        nome: "Cartão Nacional de Saúde (CNS)",
        label: "Informe o Número do CNS (15 dígitos):",
        placeholder: "700801234567890",
        mask: null,
        paramHint: "Número CNS (15 dígitos)",
        badge: "SUS",
        badgeColor: "#10B981",
        desc: "Cartão Nacional de Saúde (CNS) com vínculos biográficos, contatos e residência.",
      },
      nis: {
        nome: "NIS / PIS / PASEP",
        label: "Informe o Número do NIS / PIS / PASEP:",
        placeholder: "000.00000.00-0 (11 dígitos)",
        mask: null,
        paramHint: "Número NIS (11 dígitos)",
        badge: "Social",
        badgeColor: "#F59E0B",
        desc: "Número de Identificação Social e benefícios sociais cadastrados.",
      },
      covid: {
        nome: "Vacinas COVID-19",
        label: "Informe o CPF para Histórico Vacinal COVID-19:",
        placeholder: "000.000.000-00",
        mask: "cpf",
        paramHint: "CPF do Titular",
        badge: "Vacinas",
        badgeColor: "#EC4899",
        desc: "Histórico completo de vacinas, fabricantes, doses, lotes e postos por CPF.",
      },
      fotos: {
        nome: "Biometria Facial / Fotos",
        label: "Informe o CPF do Alvo para Biometria Facial / Fotos:",
        placeholder: "000.000.000-00",
        mask: "cpf",
        paramHint: "CPF do Alvo",
        badge: "Foto",
        badgeColor: "#A855F7",
        desc: "Fotos oficiais registradas em documentos públicos (CNH/RG) em Base64 ou URL.",
      },
      foto: {
        nome: "Biometria Facial / Fotos",
        label: "Informe o CPF do Alvo para Biometria Facial / Fotos:",
        placeholder: "000.000.000-00",
        mask: "cpf",
        paramHint: "CPF do Alvo",
        badge: "Foto",
        badgeColor: "#A855F7",
        desc: "Fotos oficiais registradas em documentos públicos (CNH/RG) em Base64 ou URL.",
      },

      // 2. Contato (2)
      telefone: {
        nome: "Telefone & Titularidade",
        label: "Informe o Telefone com DDD:",
        placeholder: "(11) 98765-4321",
        mask: "telefone",
        paramHint: "Telefone com DDD",
        badge: "Telecom",
        badgeColor: "#3B82F6",
        desc: "Localização de titular, operadora e endereços a partir do número de telefone.",
      },
      email: {
        nome: "E-mail & Identidade Digital",
        label: "Informe o Endereço de E-mail:",
        placeholder: "carlos.silva@gmail.com",
        mask: null,
        paramHint: "Endereço de E-mail",
        badge: "E-mail",
        badgeColor: "#6366F1",
        desc: "Vínculos cadastrais, titularidade e redes associadas a um endereço de e-mail.",
      },

      // 3. Endereço (2)
      cep: {
        nome: "CEP & Moradores",
        label: "Informe o CEP (8 dígitos):",
        placeholder: "00000-000",
        mask: "cep",
        paramHint: "CEP (8 dígitos)",
        param2Label: "Número do imóvel (opcional)",
        param2Placeholder: "Ex: 450",
        badge: "CEP",
        badgeColor: "#10B981",
        desc: "Residentes e logradouro por CEP simples, com suporte a número de residência opcional.",
      },
      cep_avancado: {
        nome: "CEP Avançado",
        label: "Informe o Logradouro para Busca Avançada de CEP:",
        placeholder: "Ex: Avenida Paulista ou Rua das Flores",
        mask: null,
        paramHint: "Logradouro / Rua",
        param2Label: "UF (obrigatório, ex: SP)",
        param2Placeholder: "SP",
        badge: "Avançado",
        badgeColor: "#8B5CF6",
        desc: "Busca refinada de endereços e moradores por UF, logradouro, bairro e cidade.",
      },

      // 4. Veículos (5)
      placa: {
        nome: "Placa Padrão",
        label: "Informe a Placa do Veículo (Mercosul ou Antiga):",
        placeholder: "ABC1D23 ou ABC1234",
        mask: "placa",
        paramHint: "Placa Mercosul ou ABC1234",
        badge: "Veículo",
        badgeColor: "#F59E0B",
        desc: "Consulta veicular padrão (marca, modelo, chassi, renavam, proprietário e restrições).",
      },
      placa_ghost: {
        nome: "Placa Ghost (Dossiê)",
        label: "Informe a Placa para Dossiê Veicular Completo (Ghost):",
        placeholder: "ABC1D23 ou ABC1234",
        mask: "placa",
        paramHint: "Placa Mercosul ou ABC1234",
        badge: "Ghost PRO",
        badgeColor: "#EF4444",
        desc: "Dossiê veicular ampliado com dados aprofundados do proprietário, CNH, telefones e endereços.",
      },
      cnh: {
        nome: "CNH / Habilitação",
        label: "Informe o Número da CNH ou CPF:",
        placeholder: "01234567890",
        mask: null,
        paramHint: "Número da CNH ou CPF",
        badge: "Detran",
        badgeColor: "#10B981",
        desc: "Carteira Nacional de Habilitação (número, categoria, validade e condutor por CNH ou CPF).",
      },
      chassi: {
        nome: "Chassi Veicular",
        label: "Informe o Número do Chassi (17 caracteres):",
        placeholder: "Ex: 9BWAB41JXEP012345",
        mask: null,
        paramHint: "Chassi (17 caracteres)",
        badge: "Chassi",
        badgeColor: "#6B7280",
        desc: "Busca veicular direta pelo número de Chassi (17 caracteres).",
      },
      renavam: {
        nome: "Código RENAVAM",
        label: "Informe o Código RENAVAM (9 a 11 dígitos):",
        placeholder: "Ex: 00123456789",
        mask: null,
        paramHint: "Código RENAVAM",
        badge: "Renavam",
        badgeColor: "#3B82F6",
        desc: "Busca veicular completa diretamente pelo código RENAVAM do veículo.",
      },

      // 5. Financeiro (3)
      score: {
        nome: "Score de Crédito & Renda",
        label: "Informe o CPF para Consulta de Score & Renda Estimada:",
        placeholder: "000.000.000-00",
        mask: "cpf",
        paramHint: "CPF do Titular",
        badge: "Crédito",
        badgeColor: "#F59E0B",
        desc: "Pontuação de crédito estimada, renda presumida e classificação socioeconômica por CPF.",
      },
      aposentado: {
        nome: "INSS / Previdência",
        label: "Informe o CPF para Benefícios Previdenciários INSS:",
        placeholder: "000.000.000-00",
        mask: "cpf",
        paramHint: "CPF do Aposentado/Pensionista",
        badge: "INSS",
        badgeColor: "#10B981",
        desc: "Benefícios previdenciários do INSS (aposentadoria, pensão, valores e agência pagadora).",
      },
      pis: {
        nome: "PIS / PASEP",
        label: "Informe o Número do PIS / PASEP ou CPF:",
        placeholder: "000.00000.00-0 ou CPF",
        mask: null,
        paramHint: "PIS (11 dígitos) ou CPF",
        badge: "PIS",
        badgeColor: "#3B82F6",
        desc: "Cadastro e dados formais de integração de PIS / PASEP por CPF ou PIS.",
      },

      // 6. Empresa & Jurídico (8)
      cnpj: {
        nome: "CNPJ Completo (Receita)",
        label: "Informe o CNPJ da Empresa (14 dígitos):",
        placeholder: "00.000.000/0000-00",
        mask: "cnpj",
        paramHint: "CNPJ (14 dígitos)",
        badge: "Receita",
        badgeColor: "#10B981",
        desc: "Cadastro completo PJ (Empresa, Estabelecimento, Simples Nacional e Quadro de Sócios).",
      },
      cnpj2: {
        nome: "CNPJ Econômico (CNAEs)",
        label: "Informe o CNPJ para Atividades Econômicas & CNAEs:",
        placeholder: "00.000.000/0000-00",
        mask: "cnpj",
        paramHint: "CNPJ (14 dígitos)",
        badge: "CNAEs",
        badgeColor: "#6366F1",
        desc: "Consulta de CNPJ com ênfase nas atividades econômicas secundárias e CNAEs.",
      },
      razao_social: {
        nome: "Razão Social / Nome da Empresa",
        label: "Informe a Razão Social ou Nome Empresarial da Empresa:",
        placeholder: "Ex: PETROBRAS ou BANCO DO BRASIL",
        mask: null,
        paramHint: "Nome Empresarial",
        badge: "Nominal",
        badgeColor: "#3B82F6",
        desc: "Localização de empresas a partir da Razão Social ou Nome Empresarial.",
      },
      socios: {
        nome: "Quadro Societário (QSA)",
        label: "Informe o CPF ou CNPJ para Quadro Societário (QSA):",
        placeholder: "CPF ou CNPJ (apenas números)",
        mask: null,
        paramHint: "CPF ou CNPJ do Sócio",
        badge: "QSA",
        badgeColor: "#8B5CF6",
        desc: "Empresas nas quais o CPF ou CNPJ figura como sócio ou administrador.",
      },
      socios2: {
        nome: "Sócios Avançado (Cotas)",
        label: "Informe o CPF ou CNPJ para Participações Societárias Avançadas:",
        placeholder: "CPF ou CNPJ",
        mask: null,
        paramHint: "CPF ou CNPJ do Sócio",
        badge: "Cotas",
        badgeColor: "#A855F7",
        desc: "Quadro societário avançado com participações cruzadas e percentual de capital.",
      },
      funcionarios: {
        nome: "Funcionários por CNPJ",
        label: "Informe o CNPJ da Empresa para Relação de Funcionários:",
        placeholder: "00.000.000/0000-00",
        mask: "cnpj",
        paramHint: "CNPJ da Empresa",
        badge: "Equipe",
        badgeColor: "#EC4899",
        desc: "Relação de vínculos empregatícios ativos e funcionários registrados por CNPJ.",
      },
      empregos: {
        nome: "Histórico Trabalhista (CTPS)",
        label: "Informe o CPF para Histórico Trabalhista (CTPS/RAIS/CAGED):",
        placeholder: "000.000.000-00",
        mask: "cpf",
        paramHint: "CPF do Trabalhador",
        badge: "CTPS",
        badgeColor: "#F59E0B",
        desc: "Histórico formal de vínculos trabalhistas (CTPS/RAIS/CAGED) por CPF.",
      },
      oab: {
        nome: "Cadastro Nacional OAB / CNA",
        label: "Número de Inscrição da OAB:",
        placeholder: "Ex: 18442",
        mask: null,
        paramHint: "Número da OAB + Seccional (UF)",
        badge: "OAB",
        badgeColor: "#D97706",
        desc: "Cadastro Nacional dos Advogados (CNA / OAB) por número de inscrição e seccional (UF).",
        param2Label: "Estado (UF)",
        param2Placeholder: "UF (ex: ES)",
      },

      // 7. Família (4)
      mae: {
        nome: "Filhos por Nome da Mãe",
        label: "Informe o Nome Completo da Mãe para Localizar Filhos:",
        placeholder: "Ex: Maria Helena Pereira da Silva",
        mask: null,
        paramHint: "Nome da Mãe",
        badge: "Mãe",
        badgeColor: "#EC4899",
        desc: "Localização de filhos e dependentes a partir do nome completo da mãe.",
      },
      pai: {
        nome: "Filhos por Nome do Pai",
        label: "Informe o Nome Completo do Pai para Localizar Filhos:",
        placeholder: "Ex: Jose Roberto da Silva",
        mask: null,
        paramHint: "Nome do Pai",
        badge: "Pai",
        badgeColor: "#3B82F6",
        desc: "Localização de filhos e dependentes a partir do nome completo do pai.",
      },
      parentes: {
        nome: "Parentes Diretos por CPF",
        label: "Informe o CPF do Titular para Mapear Parentes Diretos:",
        placeholder: "000.000.000-00",
        mask: "cpf",
        paramHint: "CPF do Titular",
        badge: "Família",
        badgeColor: "#10B981",
        desc: "Vínculos familiares diretos (pais, filhos, irmãos e cônjuges) por CPF.",
      },
      arvore_familiar: {
        nome: "Árvore Genealógica",
        label: "Informe o CPF para Árvore Genealógica Ampliada:",
        placeholder: "000.000.000-00",
        mask: "cpf",
        paramHint: "CPF do Titular",
        badge: "Genealogia",
        badgeColor: "#8B5CF6",
        desc: "Rede genealógica ampliada com múltiplos graus de parentesco e afinidade.",
      },

      // 8. Vazados & Segurança (5)
      desmascarador: {
        nome: "Desmascarador de PIX / CPF",
        label: "Nome Completo do Titular (conforme comprovante PIX):",
        placeholder: "Ex: CARLOS EDUARDO DA SILVA",
        mask: null,
        paramHint: "Nome Completo + 6 dígitos centrais do CPF",
        param2Label: "6 Dígitos Centrais do CPF:",
        param2Placeholder: "***.123.456-**",
        badge: "PIX",
        badgeColor: "#8B5CF6",
        desc: "Localização do CPF completo e dossiê a partir do Nome Completo do favorecido e dos 6 dígitos centrais exibidos no PIX.",
      },
      cloud_url: {
        nome: "Vazamentos por Domínio / URL",
        label: "Informe o Domínio ou URL para Vasculhar Vazamentos:",
        placeholder: "Ex: empresa.com.br",
        mask: null,
        paramHint: "Domínio ou URL",
        badge: "Logs",
        badgeColor: "#EF4444",
        desc: "Credenciais e logs de acessos vazados associados a um domínio ou URL corporativa.",
      },
      cloud_usuario: {
        nome: "Vazamentos por Usuário",
        label: "Informe apenas o Nome de Usuário (Username):",
        placeholder: "Ex: rimublinda",
        mask: null,
        paramHint: "Apenas username (ex: rimublinda)",
        badge: "Username",
        badgeColor: "#F43F5E",
        desc: "Busca de vazamentos de credenciais exclusivamente por nome de usuário (username/nickname).",
      },
      senha: {
        nome: "Vazamentos por Senha / Credenciais",
        label: "Informe o CPF ou E-mail para Vazamentos de Senha:",
        placeholder: "Ex: 000.000.000-00 ou usuario@email.com",
        mask: null,
        paramHint: "CPF ou E-mail",
        badge: "Senhas",
        badgeColor: "#DC2626",
        desc: "Identifica senhas vazadas e credenciais comprometidas a partir do CPF ou endereço de e-mail do titular.",
      },
      dump_cpf: {
        nome: "Dump de CPFs (Em Massa)",
        label: "Informe os CPFs separados por vírgula (Consulta em Massa):",
        placeholder: "Ex: 12345678900, 98765432100, 11122233344",
        mask: null,
        paramHint: "CPFs separados por vírgula",
        badge: "Dump Lote",
        badgeColor: "#B91C1C",
        desc: "Consulta e extração em massa de dados cadastrais e nomes a partir de múltiplos CPFs separados por vírgula.",
      },

      // 9. Geradores & Lotes (4)
      dump_email: {
        nome: "Dump de E-mails (Em Massa)",
        label: "Informe os E-mails separados por vírgula (Consulta em Massa):",
        placeholder: "Ex: contato@empresa.com, carlos@gmail.com",
        mask: null,
        paramHint: "E-mails separados por vírgula",
        badge: "Dump Lote",
        badgeColor: "#3B82F6",
        desc: "Consulta e extração em massa de dados, vínculos e titulares a partir de múltiplos e-mails separados por vírgula.",
      },
      dump_telefone: {
        nome: "Dump de Telefones (Em Massa)",
        label: "Informe os Telefones com DDD separados por vírgula (Consulta em Massa):",
        placeholder: "Ex: 11987654321, 21998765432",
        mask: null,
        paramHint: "Telefones com DDD separados por vírgula",
        badge: "Dump Lote",
        badgeColor: "#0EA5E9",
        desc: "Consulta e extração em massa de dados e titulares a partir de múltiplos números de telefone separados por vírgula.",
      },
      gerador_estado: {
        nome: "Gerador por Estado (UF)",
        label: "Informe a Sigla do Estado (UF) para Gerar Dados Amostrais:",
        placeholder: "Ex: SP, RJ, MG",
        mask: null,
        paramHint: "Sigla do Estado (UF)",
        badge: "UF",
        badgeColor: "#10B981",
        desc: "Geração de dados cadastrais e estatísticos válidos por Estado / Unidade Federativa.",
      },
      gerador_cbo: {
        nome: "Consulta Ocupações (CBO)",
        label: "Informe o Código CBO ou Nome da Ocupação:",
        placeholder: "Ex: 212405 ou Desenvolvedor",
        mask: null,
        paramHint: "Código CBO ou Título",
        badge: "CBO",
        badgeColor: "#8B5CF6",
        desc: "Consulta da Classificação Brasileira de Ocupações (CBO) com código e descrição.",
      },
    };

    const cfg = configs[this.currentTipo] || {
      nome: this.currentTipo.toUpperCase(),
      label: "Informe o Alvo da Consulta:",
      placeholder: "Digite aqui...",
      mask: null,
      desc: "Consulta especializada via motor RimuAPI.",
      paramHint: "Termo de busca",
      badge: "Oficial",
      badgeColor: "#8B5CF6",
    };

    // Atualiza Painel Hero do Módulo Ativo
    const titleEl = document.getElementById("rimuActiveTitle");
    const badgeEl = document.getElementById("rimuActiveBadge");
    const descEl = document.getElementById("rimuActiveDesc");
    const hintEl = document.getElementById("rimuActiveParamHint");

    if (titleEl) titleEl.textContent = cfg.nome || activeChip?.dataset.nome || this.currentTipo.toUpperCase();
    if (badgeEl) {
      badgeEl.textContent = cfg.badge || "Oficial";
      if (cfg.badgeColor) {
        badgeEl.style.color = cfg.badgeColor;
        badgeEl.style.background = `${cfg.badgeColor}25`;
      }
    }
    if (descEl) descEl.textContent = cfg.desc || activeChip?.dataset.desc || "";
    if (hintEl) hintEl.textContent = `Parâmetro: ${cfg.paramHint || "Chave de busca"}`;

    // Configura Campo Primário
    const input = document.getElementById("consultaInput");
    const label = document.getElementById("consultaInputLabel");
    if (label) label.textContent = cfg.label;
    if (input) {
      input.placeholder = cfg.placeholder;
      input.dataset.mask = cfg.mask || "";
      input.value = "";
      input.focus();
    }

    // Configura Campo Secundário (Param2 / UF / Número)
    const param2Container = document.getElementById("param2Container");
    const param2Input = document.getElementById("consultaInputParam2");
    if (cfg.param2Label && param2Container && param2Input) {
      param2Container.style.display = "block";
      param2Input.placeholder = cfg.param2Placeholder || cfg.param2Label;
      param2Input.title = cfg.param2Label;
      param2Input.value = "";
      if (this.currentTipo === "desmascarador") {
        param2Input.style.width = "210px";
        param2Input.dataset.mask = "desmascarador";
      } else if (this.currentTipo === "oab") {
        param2Input.style.width = "110px";
        param2Input.dataset.mask = "uf";
      } else {
        param2Input.style.width = "140px";
        param2Input.dataset.mask = "";
      }
    } else if (param2Container) {
      param2Container.style.display = "none";
      if (param2Input) {
        param2Input.value = "";
        param2Input.dataset.mask = "";
      }
    }

    // Validação de Interdição e Manutenção (via dados do Supabase)
    const modulosData = window.__RIMU_MODULOS_DATA__ || [];
    const modInfo = modulosData.find(
      (m) => m.tipo === this.currentTipo || (this.currentTipo === "fotos" && m.tipo === "foto")
    );

    const bannerManutencao = document.getElementById("rimuModuloManutencaoBanner");
    const bannerTexto = document.getElementById("rimuModuloManutencaoTexto");
    const submitBtn = document.getElementById("btnSubmitConsulta");

    if (modInfo && (modInfo.manutencao || modInfo.ativo === false)) {
      if (bannerManutencao) {
        bannerManutencao.style.display = "flex";
        if (bannerTexto) {
          bannerTexto.textContent = modInfo.manutencao
            ? `⚠️ O módulo "${modInfo.nome}" está temporariamente em manutenção pela administração para melhorias.`
            : `O módulo "${modInfo.nome}" foi temporariamente desativado pela administração.`;
        }
      }
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.style.opacity = "0.5";
        submitBtn.style.cursor = "not-allowed";
        submitBtn.title = "Módulo indisponível no momento";
      }
    } else {
      if (bannerManutencao) {
        bannerManutencao.style.display = "none";
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.style.opacity = "1";
        submitBtn.style.cursor = "pointer";
        submitBtn.title = "";
      }
    }

    // Atualiza ícones Lucide dinâmicos se a biblioteca estiver disponível
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }

    // Atualiza demos exibidas
    this.updateDemosVisibility(this.currentTipo);

    // Se houver resultados de outro tipo, limpa
    this.showState("initial");
  }

  // 2. MÁSCARAS DE ENTRADA DINÂMICAS
  bindForm() {
    const input = document.getElementById("consultaInput");
    const param2Input = document.getElementById("consultaInputParam2");
    const form = document.getElementById("consultaForm");
    const submitBtn = document.getElementById("btnSubmitConsulta");

    const applyMask = (target, mask) => {
      if (!mask) return;
      if (mask === "cpf") {
        let v = target.value.replace(/\D/g, "").slice(0, 11);
        if (v.length > 9) v = v.replace(/^(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
        else if (v.length > 6) v = v.replace(/^(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
        else if (v.length > 3) v = v.replace(/^(\d{3})(\d{1,3})/, "$1.$2");
        target.value = v;
      } else if (mask === "telefone") {
        let v = target.value.replace(/\D/g, "").slice(0, 11);
        if (v.length > 10) v = v.replace(/^(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
        else if (v.length > 6) v = v.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
        else if (v.length > 2) v = v.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
        target.value = v;
      } else if (mask === "cep") {
        let v = target.value.replace(/\D/g, "").slice(0, 8);
        if (v.length > 5) v = v.replace(/^(\d{5})(\d{1,3})/, "$1-$2");
        target.value = v;
      } else if (mask === "cnpj") {
        let v = target.value.replace(/\D/g, "").slice(0, 14);
        if (v.length > 12) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})/, "$1.$2.$3/$4-$5");
        else if (v.length > 8) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{1,4})/, "$1.$2.$3/$4");
        else if (v.length > 5) v = v.replace(/^(\d{2})(\d{3})(\d{1,3})/, "$1.$2.$3");
        else if (v.length > 2) v = v.replace(/^(\d{2})(\d{1,3})/, "$1.$2");
        target.value = v;
      } else if (mask === "placa") {
        target.value = target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
      } else if (mask === "titulo") {
        target.value = target.value.replace(/\D/g, "").slice(0, 12);
      } else if (mask === "desmascarador") {
        const raw = target.value.replace(/\D/g, "").slice(0, 6);
        if (raw.length === 6) {
          target.value = `***.${raw.slice(0, 3)}.${raw.slice(3, 6)}-**`;
        } else if (raw.length > 3) {
          target.value = `***.${raw.slice(0, 3)}.${raw.slice(3)}`;
        } else if (raw.length > 0) {
          target.value = `***.${raw}`;
        } else {
          target.value = "";
        }
      } else if (mask === "uf") {
        target.value = target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
      }
    };

    if (input) {
      input.addEventListener("input", (e) => applyMask(e.target, input.dataset.mask));
    }
    if (param2Input) {
      param2Input.addEventListener("input", (e) => applyMask(e.target, param2Input.dataset.mask));
    }

    if (form && submitBtn) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const termo = input.value.trim();

        if (!termo) {
          window.toast?.error("Por favor, informe o dado para a consulta.");
          input.focus();
          return;
        }

        let termoEnvio = termo;
        const param2Val = param2Input && param2Input.value ? param2Input.value.trim() : null;

        if (this.currentTipo === "desmascarador") {
          let nomeEnvio = termo;
          let cpfEnvio = param2Val || "";

          // Suporta se o usuário digitou o CPF no input principal e o Nome no segundo
          if (/^\d{6}$/.test(termo.replace(/\D/g, ""))) {
            cpfEnvio = termo.replace(/\D/g, "");
            nomeEnvio = param2Val || "";
          } else {
            cpfEnvio = cpfEnvio.replace(/\D/g, "");
          }

          if (!nomeEnvio || nomeEnvio.trim().length < 3) {
            window.toast?.error("Informe o Nome Completo do Titular (conforme comprovante PIX).");
            input.focus();
            return;
          }

          if (cpfEnvio.length !== 6) {
            window.toast?.error("Informe os 6 dígitos centrais do CPF no campo secundário (ex: ***.123.456-**).");
            if (param2Input) param2Input.focus();
            return;
          }

          termoEnvio = cpfEnvio;
          param2Val = nomeEnvio.trim();
        } else if (this.currentTipo === "oab") {
          let numOab = termo;
          let ufOab = param2Val || "";

          if (!ufOab && /\s+|\/|-/.test(numOab)) {
            const parts = numOab.split(/[\s\/\-]+/).filter(Boolean);
            const ufPart = parts.find((p) => /^[a-zA-Z]{2}$/.test(p));
            const numPart = parts.find((p) => /^\d+$/.test(p));
            if (ufPart && numPart) {
              numOab = numPart;
              ufOab = ufPart.toUpperCase();
            }
          }

          if (!numOab) {
            window.toast?.error("Informe o Número de Inscrição da OAB.");
            input.focus();
            return;
          }

          if (!ufOab) {
            window.toast?.error("Informe o Estado (UF da seccional, ex: ES, SP, RJ).");
            if (param2Input) param2Input.focus();
            return;
          }

          termoEnvio = numOab;
          param2Val = ufOab.toUpperCase();
        }

        this.currentComplianceData = null;
        const compBox = document.getElementById("consultaComplianceContainer");
        if (compBox) {
          compBox.style.display = "none";
          compBox.innerHTML = "";
        }

        this.showState("loading");
        submitBtn.disabled = true;

        try {
          const payload = {
            tipo: this.currentTipo,
            termo: termoEnvio,
          };
          if (param2Val) {
            payload.param2 = param2Val;
          }

          const res = await window.api.post(
            "/api/consulta/puxar",
            payload,
            {
              timeout: 95000, // 95s para permitir consultas extensas de nomes e homônimos
            }
          );

          if (res.success && res.data) {
            this.currentData = res.data;
            this.renderResults(res.data);
            this.showState("results");
            window.toast?.success(
              `Dados da consulta (${this.currentTipo.toUpperCase()}) obtidos com sucesso!`
            );
          } else {
            throw new Error(res.error || "Nenhum dado encontrado para o termo pesquisado.");
          }
        } catch (err) {
          console.error("[ERRO CONSULTA]:", err);
          this.showState("error", err.message || "Falha ao comunicar com os serviços de consulta.");
        } finally {
          submitBtn.disabled = false;
        }
      });
    }
  }

  // 3. ATALHOS DE DEMONSTRAÇÃO
  bindDemos() {
    const demoBtns = document.querySelectorAll(".demo-consulta-btn");
    demoBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const input = document.getElementById("consultaInput");
        const param2Input = document.getElementById("consultaInputParam2");
        const form = document.getElementById("consultaForm");
        if (input && btn.dataset.val) {
          input.value = btn.dataset.val;
          input.dispatchEvent(new Event("input"));
          if (param2Input && btn.dataset.param2) {
            param2Input.value = btn.dataset.param2;
            param2Input.dispatchEvent(new Event("input"));
          }
          if (form) form.dispatchEvent(new Event("submit"));
        }
      });
    });
  }

  updateDemosVisibility(tipo) {
    const demoItems = document.querySelectorAll(".demo-consulta-btn");
    demoItems.forEach((btn) => {
      if (btn.dataset.tipo === tipo) {
        btn.style.display = "inline-flex";
      } else {
        btn.style.display = "none";
      }
    });
  }

  // 4. RENDERIZAÇÃO DOS RESULTADOS
  renderResults(res) {
    const dados = res.dados || {};
    const container = document.getElementById("consultaResultsContent");
    if (!container) return;

    // Badges de cabeçalho
    const badgeTipo = document.getElementById("resTipoBadge");
    const badgeFonte = document.getElementById("resFonteText");
    const badgeCredits = document.getElementById("resCreditsBadge");

    if (badgeTipo) badgeTipo.textContent = `MÓDULO: ${res.tipo.toUpperCase()}`;
    if (badgeFonte) badgeFonte.textContent = res.fonte || "RimuAPI Intelligence Engine";

    if (badgeCredits) {
      if (res.remainingCredits !== null && res.remainingCredits !== undefined) {
        badgeCredits.style.display = "inline-flex";
        badgeCredits.textContent = `⚡ Saldo RimuAPI: ${Number(res.remainingCredits).toLocaleString("pt-BR")} créditos`;
      } else {
        badgeCredits.style.display = "none";
      }
    }

    const rawJsonEl = document.getElementById("resRawJson");
    if (rawJsonEl) rawJsonEl.textContent = JSON.stringify(res, null, 2);

    // Preferência de exibição da gaveta técnica de Dados Brutos (JSON) - Padrão: Desativado (Oculto)
    const cardJson = document.getElementById("cardDadosBrutosJson");
    const showJsonPref = window.rimuSettings ? window.rimuSettings.showRawJson : (localStorage.getItem("rimu_pref_show_raw_json") === "true");
    if (cardJson) {
      cardJson.style.display = showJsonPref ? "block" : "none";
    }

    let html = "";

    // 1. Tenta renderizar através dos visual interpreters modulares da RimuAPI
    if (window.RimuInterpreters) {
      if (typeof window.RimuInterpreters.dispatch === "function") {
        try {
          html = window.RimuInterpreters.dispatch(res, "rimuapi");
        } catch (err) {
          console.warn("[INTERPRETER RIMUAPI ERRO]:", err);
        }
      } else if (typeof window.RimuInterpreters.dispatchRimuApi === "function") {
        try {
          html = window.RimuInterpreters.dispatchRimuApi(res);
        } catch (err) {
          console.warn("[INTERPRETER RIMUAPI ERRO]:", err);
        }
      } else if (typeof window.RimuInterpreters.dispatchHexys === "function") {
        try {
          html = window.RimuInterpreters.dispatchHexys(res);
        } catch (err) {
          console.warn("[INTERPRETER FALLBACK ERRO]:", err);
        }
      }
    }

    // 2. Fallback resiliente caso o interpreter não esteja disponível
    if (!html) {
      const tipoLower = String(res.tipo || "").toLowerCase().trim();

      // 4.1 FOTO / BIOMETRIA FACIAL EXCLUSIVA (Apenas quando a busca em si foi por foto)
      if (tipoLower === "foto") {
        html += this.renderFotoResult(dados, res);
      }
      // 4.2 VEÍCULO / PLACA
      else if (
        tipoLower === "placa" ||
        tipoLower === "veiculo" ||
        (!dados.name && !dados.cpf && (dados.plate || dados.placa))
      ) {
        html += this.renderPlacaResult(dados, res);
      }
      // 4.3 OPERADORA DE TELEFONIA
      else if (
        tipoLower === "operadora" ||
        (!dados.name && !dados.cpf && dados.operadora && dados.confianca)
      ) {
        html += this.renderOperadoraResult(dados, res);
      }
      // 4.4 DOSSIÊ COMPLETO DE PESSOA (CPF, TÍTULO, FICHA, NOME ÚNICO)
      else if (
        tipoLower === "cpf" ||
        tipoLower === "titulo" ||
        (dados.cpf && (dados.name || dados.nome) && !dados.titular && !dados.parentescos)
      ) {
        html += this.renderDossiePessoa(dados, res);
      }
      // 4.5 PARENTES / ÁRVORE GENEALÓGICA (Apenas consultas de parentesco)
      else if (
        tipoLower === "parentes" ||
        tipoLower === "parentesco" ||
        (!dados.name && !dados.cpf && (dados.parentescos || (dados.titular && Array.isArray(dados.parentes))))
      ) {
        html += this.renderParentesResult(dados, res);
      }
      // 4.6 EMPRESA / CNPJ / QUADRO SOCIETÁRIO (QSA)
      else if (
        tipoLower === "cnpj" ||
        tipoLower === "empresa" ||
        (!dados.name && !dados.cpf && (dados.razaoSocial || dados.razao_social || dados.sociosQSA || dados.qsa || (dados.cnpj && dados.capitalSocial)))
      ) {
        html += this.renderCnpjResult(dados, res);
      }
      // 4.7 CEP & ENDEREÇOS GEOGRÁFICOS
      else if (
        tipoLower === "cep" ||
        tipoLower === "endereco" ||
        tipoLower === "logradouro" ||
        (!dados.name && !dados.cpf && (dados.cep || dados.logradouro) && (dados.cidade || dados.bairro || dados.uf))
      ) {
        html += this.renderCepResult(dados, res);
      }
      // 4.7 E-MAIL & PERFIL DIGITAL
      else if (
        tipoLower === "email" ||
        tipoLower === "email_puxar" ||
        (!dados.name && !dados.cpf && (dados.email || dados.pessoas_vinculadas || dados.perfil_google))
      ) {
        html += this.renderEmailResult(dados, res);
      }
      // 4.7 LISTAS / ARRAYS (Nome, CEP, Telefone, Vizinhos)
      else if (
        Array.isArray(dados) ||
        Array.isArray(dados.resultado) ||
        Array.isArray(dados.resultados)
      ) {
        const items = Array.isArray(dados)
          ? dados
          : Array.isArray(dados.resultado)
            ? dados.resultado
            : dados.resultados;

        html += this.renderTabelaRegistros(items, res);
      }
      // 4.8 FALLBACK PARA QUALQUER ENTIDADE DE PESSOA
      else if (
        dados.name ||
        dados.nome ||
        dados.cpf
      ) {
        html += this.renderDossiePessoa(dados, res);
      }
      // 4.6 FALLBACK GENÉRICO
      else {
        html += this.renderGenericObject(dados, res);
      }
    }

    container.innerHTML = html;
    this.setupResultEvents(container);

    if (window.lucide) {
      window.lucide.createIcons({ root: container });
    }

    // Dispara enriquecimento gratuito de Compliance Público (CGU / TSE / PNCP / Querido Diário) em paralelo
    this.dispararComplianceEnriquecimento(res, dados);
  }

  // RENDER: FOTO FACIAL
  renderFotoResult(dados, res) {
    const fotoSrc = dados.fotoBase64 || dados.base64 || dados.foto_url || dados.foto;

    return `
      <div class="card" style="margin-bottom: var(--space-4); border-top: 4px solid #8B5CF6;">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <h3 class="card-title" style="color: #A78BFA; display: flex; align-items: center; gap: 8px;">
            <i data-lucide="camera" style="width: 20px; height: 20px;"></i>
            <span>Biometria Facial & Espelho Fotográfico</span>
          </h3>
          <span class="badge" style="background: rgba(139, 92, 246, 0.15); color: #C4B5FD;">Registro Oficial</span>
        </div>

        <div style="display: flex; gap: var(--space-6); flex-wrap: wrap; align-items: flex-start; padding-top: var(--space-4);">
          <div style="text-align: center; flex-shrink: 0;">
            ${
              fotoSrc
                ? `
              <div style="position: relative; display: inline-block;">
                <img src="${fotoSrc}" alt="Foto Facial" style="width: 200px; height: 250px; object-fit: cover; border-radius: var(--radius-md); border: 2px solid #8B5CF6; box-shadow: 0 4px 20px rgba(139, 92, 246, 0.35);">
              </div>
              <div style="margin-top: 10px;">
                <a href="${fotoSrc}" download="foto-facial-${res.termo}.jpg" class="btn btn-outline btn-sm" style="font-size: 0.75rem;">
                  <i data-lucide="download" style="width: 14px; height: 14px;"></i> Baixar Imagem
                </a>
              </div>
            `
                : `
              <div style="width: 200px; height: 250px; background: var(--color-surface-2); border-radius: var(--radius-md); border: 2px dashed var(--color-border); display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--color-text-dim);">
                <i data-lucide="camera-off" style="width: 36px; height: 36px; margin-bottom: 8px;"></i>
                <span style="font-size: 0.85rem;">Foto não localizada</span>
              </div>
            `
            }
          </div>

          <div style="flex: 1; min-width: 260px;">
            <h4 style="font-size: 1.15rem; font-weight: 700; color: var(--color-text); margin-bottom: 12px;">
              Documento Consultado: <span style="font-family: var(--font-mono); color: #6EE7B7;">${this.formatCpf(res.termo)}</span>
            </h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; font-size: 0.875rem;">
              <div style="background: var(--color-surface-2); padding: 10px 14px; border-radius: var(--radius-md);">
                <span style="color: var(--color-text-muted); font-size: 0.75rem; display: block;">Status da Foto</span>
                <strong style="color: ${fotoSrc ? "#10B981" : "#F59E0B"};">${fotoSrc ? "Disponível na Base RimuAPI" : "Não encontrada"}</strong>
              </div>
              <div style="background: var(--color-surface-2); padding: 10px 14px; border-radius: var(--radius-md);">
                <span style="color: var(--color-text-muted); font-size: 0.75rem; display: block;">Formato Retornado</span>
                <strong style="color: var(--color-text);">${dados.contentType || "Imagem JPEG/PNG"}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // RENDER: VEÍCULO / PLACA
  renderPlacaResult(dados, res) {
    if (window.RimuInterpreters && typeof window.RimuInterpreters.Vehicle?.render === "function") {
      try {
        return window.RimuInterpreters.Vehicle.render(res, dados);
      } catch (e) {
        console.warn("[RENDER PLACA VIA INTERPRETER ERROR]:", e);
      }
    }

    const plate = dados.plate || dados.placa || res?.termo || "PLACA";
    const brand = dados.brand || dados.marca || "Não informado";
    const model = dados.model || dados.modelo || "";
    const color = dados.color || dados.cor || "N/A";
    const year = `${dados.year_fab || dados.anoFabricacao || "N/A"} / ${dados.year_model || dados.anoModelo || "N/A"}`;
    const chassis = dados.chassis || dados.chassi || "N/A";
    const renavam = dados.renavam || "N/A";
    const engine = dados.motor || dados.engine || "N/A";
    const status = dados.situacao_veiculo || dados.situacao || "EM CIRCULACAO";

    return `
      <div class="card" style="margin-bottom: var(--space-4); border-top: 4px solid #3B82F6;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 14px;">
          <div style="display: flex; align-items: center; gap: 16px;">
            <!-- Badge Estilizado Placa Mercosul -->
            <div style="background: #FFF; border: 3px solid #000; border-radius: 6px; padding: 2px 10px; text-align: center; color: #000; min-width: 140px; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
              <div style="background: #003399; color: #FFF; font-size: 0.65rem; font-weight: 800; letter-spacing: 1px; padding: 1px 0; border-radius: 2px; text-transform: uppercase;">BRASIL</div>
              <div style="font-family: var(--font-mono); font-size: 1.4rem; font-weight: 900; letter-spacing: 2px; line-height: 1.2;">${plate}</div>
            </div>
            <div>
              <h2 style="font-size: 1.3rem; font-weight: 800; color: var(--color-text); margin: 0;">${brand} ${model}</h2>
              <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10B981; margin-top: 6px;">${status}</span>
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-top: var(--space-5);">
          <div style="background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md);">
            <span style="font-size: 0.75rem; color: var(--color-text-muted); text-transform: uppercase;">Ano Fabricação / Modelo</span>
            <div style="font-weight: 700; color: var(--color-text); margin-top: 2px;">${year}</div>
          </div>
          <div style="background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md);">
            <span style="font-size: 0.75rem; color: var(--color-text-muted); text-transform: uppercase;">Cor Predominante</span>
            <div style="font-weight: 700; color: var(--color-text); margin-top: 2px;">${color}</div>
          </div>
          <div style="background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md);">
            <span style="font-size: 0.75rem; color: var(--color-text-muted); text-transform: uppercase;">Combustível</span>
            <div style="font-weight: 700; color: var(--color-text); margin-top: 2px;">${dados.fuel || dados.combustivel || "N/A"}</div>
          </div>
          <div style="background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md);">
            <span style="font-size: 0.75rem; color: var(--color-text-muted); text-transform: uppercase;">Chassi (VIN)</span>
            <div style="font-family: var(--font-mono); font-weight: 700; color: #60A5FA; margin-top: 2px;">${chassis}</div>
          </div>
          <div style="background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md);">
            <span style="font-size: 0.75rem; color: var(--color-text-muted); text-transform: uppercase;">Renavam</span>
            <div style="font-family: var(--font-mono); font-weight: 700; color: #34D399; margin-top: 2px;">${renavam}</div>
          </div>
          <div style="background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md);">
            <span style="font-size: 0.75rem; color: var(--color-text-muted); text-transform: uppercase;">Número do Motor</span>
            <div style="font-family: var(--font-mono); font-weight: 700; color: #F59E0B; margin-top: 2px;">${engine}</div>
          </div>
        </div>
      </div>
    `;
  }

  // RENDER: OPERADORA & PORTABILIDADE
  renderOperadoraResult(dados, res) {
    const phone = dados.telefone_formatado || dados.telefone || res.termo;
    const operadora = dados.operadora || "Não informada";
    const tipo = dados.tipo || "Móvel";
    const portabilidade = dados.portabilidade || "Sem portabilidade detectada";
    const confianca = String(dados.confianca || "alta").toUpperCase();

    return `
      <div class="card" style="margin-bottom: var(--space-4); border-top: 4px solid #F59E0B;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div>
            <span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #F59E0B; font-weight: 700;">
              <i data-lucide="radio" style="width: 12px; height: 12px;"></i> OPERADORA TELEFÔNICA
            </span>
            <h3 style="font-size: 1.3rem; font-weight: 800; color: var(--color-text); margin-top: 6px;">
              ${phone} &bull; <span style="color: #60A5FA;">${operadora}</span>
            </h3>
          </div>
          <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10B981;">Confiança: ${confianca}</span>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-top: var(--space-4);">
          <div style="background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md);">
            <span style="font-size: 0.75rem; color: var(--color-text-muted);">Tipo de Linha</span>
            <div style="font-weight: 700; color: var(--color-text); margin-top: 2px;">${tipo}</div>
          </div>
          <div style="background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md);">
            <span style="font-size: 0.75rem; color: var(--color-text-muted);">Estado / DDD</span>
            <div style="font-weight: 700; color: var(--color-text); margin-top: 2px;">${dados.estado || "N/I"} (DDD ${dados.ddd || "N/I"})</div>
          </div>
          <div style="background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md);">
            <span style="font-size: 0.75rem; color: var(--color-text-muted);">Portabilidade</span>
            <div style="font-weight: 600; color: #F59E0B; margin-top: 2px;">${portabilidade}</div>
          </div>
        </div>
      </div>
    `;
  }

  // RENDER: PARENTES & ÁRVORE DE VÍNCULOS FAMILIARES
  renderParentesResult(dados, res) {
    if (window.RimuInterpreters && typeof window.RimuInterpreters.Relatives?.render === "function") {
      try {
        return window.RimuInterpreters.Relatives.render(res, dados);
      } catch (e) {
        console.warn("[RENDER PARENTES VIA INTERPRETER ERROR]:", e);
      }
    }

    const titular = dados.titular || dados.target || res?.termo || "Titular";
    const parentescos = Array.isArray(dados.parentescos)
      ? dados.parentescos
      : Array.isArray(dados.parentes)
        ? dados.parentes
        : [];

    return `
      <div class="card" style="margin-bottom: var(--space-4); border-top: 4px solid #8B5CF6;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
          <div>
            <span class="badge" style="background: rgba(139, 92, 246, 0.15); color: #C4B5FD; font-weight: 700;">
              <i data-lucide="git-merge" style="width: 12px; height: 12px;"></i> VÍNCULOS FAMILIARES
            </span>
            <h2 style="font-size: 1.3rem; font-weight: 800; color: var(--color-text); margin: 6px 0 0 0;">
              ${this.escapeHtml(titular)}
            </h2>
          </div>
          <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10B981;">
            ${parentescos.length} Vínculos
          </span>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px;">
          ${parentescos
            .map((p) => {
              const vinculo = p.vinculo || p.parentesco || "Parente";
              const nome = p.nome || p.name || "NÃO INFORMADO";
              const cpf = p.cpf || "Não informado";
              const idade = p.idade ? ` &bull; ${p.idade} anos` : "";
              return `
              <div style="background: var(--color-surface-2); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border); display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                  <span class="badge" style="background: rgba(99, 102, 241, 0.15); color: #818CF8; font-weight: 700; margin-bottom: 8px;">
                    ${this.escapeHtml(vinculo)}
                  </span>
                  <div style="font-weight: 800; color: var(--color-text); font-size: 1rem; margin-bottom: 6px;">
                    ${this.escapeHtml(nome)}
                  </div>
                  <div style="font-family: var(--font-mono); color: #94A3B8; font-size: 0.82rem;">
                    CPF: <strong style="color: #6EE7B7;">${this.escapeHtml(cpf)}</strong>${idade}
                  </div>
                </div>
                <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--color-border);">
                  <button type="button" class="btn btn-outline btn-xs btn-puxar-nome-item" data-nome="${this.escapeHtml(nome)}" style="width: 100%;">
                    <i data-lucide="search" style="width: 11px; height: 11px;"></i> Investigar Nome
                  </button>
                </div>
              </div>
            `;
            })
            .join("")}
        </div>
      </div>
    `;
  }

  // RENDER: E-MAIL & PERFIL DIGITAL
  renderEmailResult(dados, res) {
    if (window.RimuInterpreters && typeof window.RimuInterpreters.Email?.render === "function") {
      try {
        return window.RimuInterpreters.Email.render(res, dados);
      } catch (e) {
        console.warn("[RENDER EMAIL VIA INTERPRETER ERROR]:", e);
      }
    }

    const email = dados.email || res?.termo || "E-mail";
    const persons = Array.isArray(dados.pessoas_vinculadas) ? dados.pessoas_vinculadas : [];
    return `
      <div class="card" style="margin-bottom: var(--space-4); border-top: 4px solid #06B6D4;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
          <div>
            <span class="badge" style="background: rgba(6, 182, 212, 0.15); color: #67E8F9; font-weight: 700;">
              <i data-lucide="mail" style="width: 12px; height: 12px;"></i> E-MAIL OSINT
            </span>
            <h2 style="font-size: 1.3rem; font-weight: 800; color: #FFFFFF; margin: 6px 0 0 0; font-family: var(--font-mono);">
              ${this.escapeHtml(email)}
            </h2>
          </div>
          <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10B981;">
            ${persons.length} Titulares Vinculados
          </span>
        </div>
      </div>
    `;
  }

  // RENDER: EMPRESA, CNPJ & QUADRO SOCIETÁRIO (QSA)
  renderCnpjResult(dados, res) {
    if (window.RimuInterpreters && typeof window.RimuInterpreters.HexysCompany?.render === "function") {
      try {
        return window.RimuInterpreters.HexysCompany.render(res, dados);
      } catch (e) {
        console.warn("[RENDER CNPJ VIA INTERPRETER ERROR]:", e);
      }
    }
    if (window.RimuInterpreters && typeof window.RimuInterpreters.Company?.render === "function") {
      try {
        return window.RimuInterpreters.Company.render(res, dados);
      } catch (e) {
        console.warn("[RENDER CNPJ VIA INTERPRETER ERROR]:", e);
      }
    }
    if (window.RimuInterpreters && typeof window.RimuInterpreters.ZeroyCompany?.render === "function") {
      try {
        return window.RimuInterpreters.ZeroyCompany.render(res, dados);
      } catch (e) {
        console.warn("[RENDER CNPJ VIA ZEROY INTERPRETER ERROR]:", e);
      }
    }

    const data = dados || {};
    const rawPartners = Array.isArray(data.sociosQSA)
      ? data.sociosQSA
      : Array.isArray(data.qsa)
      ? data.qsa
      : Array.isArray(data.socios)
      ? data.socios
      : [];

    const corporateName = data.razaoSocial || data.razao_social || data.nome || "Razão Social Não Informada";
    const tradeName = data.nomeFantasia || data.nome_fantasia || "Não informado";
    const status = String(data.situacaoCadastral || data.descricao_situacao_cadastral || data.situacao || "ATIVA").toUpperCase();
    const cleanCnpj = String(data.cnpj_limpo || data.cnpj || "").replace(/\D/g, "");
    const formattedCnpj = cleanCnpj.length === 14 ? this.formatCnpj(cleanCnpj) : (data.cnpj || "Não informado");
    const openingDate = data.dataAbertura || data.data_inicio_atividade || "Não informada";
    const shareCapital = typeof data.capitalSocial === "number"
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(data.capitalSocial)
      : (data.capitalSocial || data.capital_social || "Não informado");

    let cnaePrincipalText = "Não informado";
    if (data.cnaePrincipal && typeof data.cnaePrincipal === "object") {
      cnaePrincipalText = `${data.cnaePrincipal.codigo || ""} - ${data.cnaePrincipal.descricao || ""}`;
    } else if (data.cnaePrincipal) {
      cnaePrincipalText = String(data.cnaePrincipal);
    } else if (data.cnae_fiscal) {
      cnaePrincipalText = `${data.cnae_fiscal} - ${data.cnae_fiscal_descricao || ""}`;
    }

    const fullAddress = data.endereco || [
      [data.descricao_tipo_de_logradouro, data.logradouro].filter(Boolean).join(" "),
      data.numero ? `nº ${data.numero}` : null,
      data.complemento ? `(${data.complemento})` : null,
      data.bairro ? `- ${data.bairro}` : null,
      data.municipio ? `${data.municipio}/${data.uf || ""}` : null,
      data.cep ? `CEP ${data.cep}` : null,
    ].filter(Boolean).join(", ") || "Endereço não cadastrado";

    const legalNature = data.naturezaJuridica || data.natureza_juridica || "Não informada";
    const companySize = data.porte || data.porteEmpresa || "DEMAIS";
    const phone = data.telefone || data.ddd_telefone_1 || null;
    const email = data.email || null;

    let statusColor = "#10B981";
    let statusBg = "rgba(16, 185, 129, 0.15)";
    if (status.includes("BAIXADA") || status.includes("INAPTA") || status.includes("CANCELADA") || status.includes("NULA")) {
      statusColor = "#EF4444";
      statusBg = "rgba(239, 68, 68, 0.15)";
    } else if (status.includes("SUSPENSA")) {
      statusColor = "#F59E0B";
      statusBg = "rgba(245, 158, 11, 0.15)";
    }

    return `
      <!-- HERO CORPORATIVO -->
      <div class="card" style="margin-bottom: var(--space-5); border-left: 4px solid #60A5FA; background: linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(139, 92, 246, 0.03) 100%), var(--color-surface);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
          <div style="flex: 1; min-width: 280px;">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;">
              <span class="badge" style="background: ${statusBg}; color: ${statusColor}; font-weight: 700;">
                <i data-lucide="shield-check" style="width: 12px; height: 12px;"></i>
                ${this.escapeHtml(status)}
              </span>
              <span class="badge badge-purple" style="font-size: 0.75rem;">
                ${this.escapeHtml(companySize)}
              </span>
            </div>

            <h2 style="font-size: 1.45rem; font-weight: 800; color: var(--color-text); margin: 0; line-height: 1.3;">
              ${this.escapeHtml(corporateName)}
            </h2>

            ${tradeName && tradeName !== "Não informado" ? `
              <div style="color: var(--color-text-muted); font-size: 0.9rem; margin-top: 4px; display: flex; align-items: center; gap: 6px;">
                <i data-lucide="building" style="width: 14px; height: 14px; color: #60A5FA;"></i>
                <span>Fantasia: <strong>${this.escapeHtml(tradeName)}</strong></span>
              </div>
            ` : ""}

            <div style="display: flex; align-items: center; gap: 10px; margin-top: 12px; flex-wrap: wrap;">
              <div style="display: inline-flex; align-items: center; gap: 8px; background: var(--color-surface-2); padding: 6px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
                <i data-lucide="hash" style="color: #60A5FA; width: 14px; height: 14px;"></i>
                <span style="font-family: var(--font-mono); font-size: 0.95rem; font-weight: 700; color: #93C5FD;">
                  ${this.escapeHtml(formattedCnpj)}
                </span>
                <button type="button" class="btn btn-ghost btn-sm btn-copiar-cpf" data-cpf="${cleanCnpj}" title="Copiar CNPJ" style="padding: 2px 6px;">
                  <i data-lucide="copy" style="width: 13px; height: 13px;"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- GRID DADOS FISCAIS E CADASTRAIS -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-4);">
        <!-- CARD: DADOS FISCAIS -->
        <div class="card" style="border-top: 3px solid #3B82F6;">
          <h3 class="card-title" style="display: flex; align-items: center; gap: 8px; font-size: 0.95rem; margin-bottom: var(--space-3); color: #93C5FD;">
            <i data-lucide="file-text" style="width: 16px; height: 16px;"></i>
            <span>Dados Fiscais & Constituição</span>
          </h3>
          <div style="display: grid; gap: 10px;">
            <div>
              <span style="color: var(--color-text-muted); font-size: 0.75rem;">Abertura:</span>
              <div style="font-weight: 600; color: var(--color-text);">${this.escapeHtml(openingDate)}</div>
            </div>
            <div>
              <span style="color: var(--color-text-muted); font-size: 0.75rem;">Capital Social:</span>
              <div style="font-weight: 700; color: #10B981; font-family: var(--font-mono);">${this.escapeHtml(shareCapital)}</div>
            </div>
            <div>
              <span style="color: var(--color-text-muted); font-size: 0.75rem;">Natureza Jurídica:</span>
              <div style="font-size: 0.85rem; color: var(--color-text);">${this.escapeHtml(legalNature)}</div>
            </div>
          </div>
        </div>

        <!-- CARD: ATIVIDADES (CNAE) -->
        <div class="card" style="border-top: 3px solid #10B981;">
          <h3 class="card-title" style="display: flex; align-items: center; gap: 8px; font-size: 0.95rem; margin-bottom: var(--space-3); color: #6EE7B7;">
            <i data-lucide="briefcase" style="width: 16px; height: 16px;"></i>
            <span>Atividade Econômica (CNAE)</span>
          </h3>
          <div>
            <span style="color: var(--color-text-muted); font-size: 0.75rem;">CNAE Principal:</span>
            <div style="font-weight: 600; font-size: 0.85rem; color: var(--color-text); margin-top: 2px;">
              ${this.escapeHtml(cnaePrincipalText)}
            </div>
          </div>
        </div>

        <!-- CARD: LOCALIZAÇÃO & CONTATO -->
        <div class="card" style="border-top: 3px solid #F59E0B;">
          <h3 class="card-title" style="display: flex; align-items: center; gap: 8px; font-size: 0.95rem; margin-bottom: var(--space-3); color: #FCD34D;">
            <i data-lucide="map-pin" style="width: 16px; height: 16px;"></i>
            <span>Localização & Contatos</span>
          </h3>
          <div style="display: grid; gap: 10px;">
            <div>
              <span style="color: var(--color-text-muted); font-size: 0.75rem;">Endereço:</span>
              <div style="font-size: 0.85rem; color: var(--color-text);">${this.escapeHtml(fullAddress)}</div>
            </div>
            <div style="display: flex; gap: 16px; flex-wrap: wrap;">
              ${phone ? `<div><span style="color: var(--color-text-muted); font-size: 0.75rem;">Telefone:</span><div style="font-weight: 600; font-family: var(--font-mono); color: #6EE7B7;">${this.escapeHtml(this.formatTelefone(phone))}</div></div>` : ""}
              ${email ? `<div><span style="color: var(--color-text-muted); font-size: 0.75rem;">E-mail:</span><div style="font-weight: 600; font-family: var(--font-mono); color: #60A5FA;">${this.escapeHtml(email)}</div></div>` : ""}
            </div>
          </div>
        </div>
      </div>

      <!-- CARD: QUADRO SOCIETÁRIO (QSA) -->
      <div class="card" style="margin-bottom: var(--space-4); border-top: 3px solid #8B5CF6;">
        <div class="card-header" style="border-bottom: 1px solid var(--color-border); padding-bottom: 12px; margin-bottom: var(--space-4); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div>
            <h3 class="card-title" style="display: flex; align-items: center; gap: 8px; font-size: 1.05rem; margin: 0;">
              <i data-lucide="users-2" style="color: #A78BFA; width: 20px; height: 20px;"></i>
              <span>Quadro de Sócios e Administradores (QSA)</span>
            </h3>
            <div style="font-size: 0.78rem; color: var(--color-text-muted); margin-top: 2px;">
              Vínculos societários identificados na Receita Federal do Brasil
            </div>
          </div>
          <span class="badge badge-purple" style="font-size: 0.8rem; font-weight: 700;">
            ${rawPartners.length} ${rawPartners.length === 1 ? "Sócio Encontrado" : "Sócios Encontrados"}
          </span>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: var(--space-3);">
          ${
            rawPartners.length > 0
              ? rawPartners
                  .map((partner) => {
                    const nomeSocio = partner.nome || partner.nome_socio || partner.nomeSocio || "Sócio Não Identificado";
                    const qualif = partner.qualificacao || partner.qualificacao_socio || partner.qualificacaoSocio || "Sócio";
                    const rawDoc = String(partner.cpf || partner.cnpj_cpf_do_socio || partner.documento || "").replace(/\D/g, "");
                    const isFullCpf = rawDoc.length === 11;
                    const docDisplay = partner.documento || partner.cnpj_cpf_do_socio || partner.cpf || (isFullCpf ? this.formatCpf(rawDoc) : null);

                    return `
                      <div style="background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 14px 16px; display: flex; justify-content: space-between; align-items: center; gap: 12px;">
                        <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
                          <div style="width: 40px; height: 40px; border-radius: var(--radius-md); background: rgba(139, 92, 246, 0.12); border: 1px solid rgba(139, 92, 246, 0.3); color: #A78BFA; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            <i data-lucide="user-check" style="width: 20px; height: 20px;"></i>
                          </div>
                          <div style="min-width: 0;">
                            <div style="font-weight: 700; font-size: 0.95rem; color: #FFFFFF; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${this.escapeHtml(nomeSocio)}">
                              ${this.escapeHtml(nomeSocio)}
                            </div>
                            <div style="font-size: 0.78rem; color: #A78BFA; font-weight: 600; margin-top: 2px;">
                              ${this.escapeHtml(qualif)}
                            </div>
                            ${
                              docDisplay
                                ? `<div style="font-size: 0.75rem; color: var(--color-text-dim); font-family: var(--font-mono); margin-top: 3px;">
                                    Doc: <strong>${this.escapeHtml(docDisplay)}</strong>
                                   </div>`
                                : ""
                            }
                          </div>
                        </div>

                        <div style="flex-shrink: 0;">
                          ${
                            isFullCpf
                              ? `
                            <button type="button" class="btn btn-primary btn-sm btn-puxar-cpf" data-cpf="${rawDoc}" title="Puxar Dossiê deste CPF" style="padding: 6px 12px; font-size: 0.78rem; gap: 6px;">
                              <i data-lucide="search" style="width: 13px; height: 13px;"></i>
                              <span>Puxar CPF</span>
                            </button>
                          `
                              : `
                            <button type="button" class="btn btn-secondary btn-sm btn-puxar-nome-item" data-nome="${this.escapeHtml(nomeSocio)}" title="Puxar por Nome" style="padding: 6px 12px; font-size: 0.78rem; gap: 6px;">
                              <i data-lucide="search" style="width: 13px; height: 13px;"></i>
                              <span>Puxar Nome</span>
                            </button>
                          `
                          }
                        </div>
                      </div>
                    `;
                  })
                  .join("")
              : `
              <div style="text-align: center; padding: 24px; color: var(--color-text-muted); font-size: 0.85rem; grid-column: 1 / -1;">
                Nenhum sócio ou administrador listado no quadro oficial desta empresa.
              </div>
            `
          }
        </div>
      </div>
    `;
  }

  // RENDER: CEP & ENDEREÇOS GEOGRÁFICOS
  renderCepResult(dados, res) {
    if (window.RimuInterpreters && typeof window.RimuInterpreters.HexysCep?.render === "function") {
      try {
        return window.RimuInterpreters.HexysCep.render(res, dados);
      } catch (e) {
        console.warn("[RENDER CEP VIA HEXYS CEP INTERPRETER ERROR]:", e);
      }
    }
    if (window.RimuInterpreters && typeof window.RimuInterpreters.dispatchHexys === "function") {
      try {
        const out = window.RimuInterpreters.dispatchHexys(res);
        if (out) return out;
      } catch (e) {
        console.warn("[RENDER CEP VIA DISPATCH ERROR]:", e);
      }
    }
    if (window.OsintDarkReport && typeof window.OsintDarkReport.renderCepReport === "function") {
      try {
        return window.OsintDarkReport.renderCepReport({
          termo: res?.termo || dados?.cep || "",
          payload: res,
          moduleLabel: "CEP",
          sourceLabel: res?.fonte || "DNE / Correios / IBGE",
        });
      } catch (e) {
        console.warn("[RENDER CEP VIA OSINT DARK REPORT ERROR]:", e);
      }
    }
    return this.renderGenericObject(dados, res);
  }

  // RENDER: TABELA DE REGISTROS (Nome, CEP, Telefone, Vizinhos)
  renderTabelaRegistros(items, res) {
    if (!items || items.length === 0) {
      return `
        <div class="card" style="text-align: center; padding: var(--space-8);">
          <i data-lucide="user-x" style="width: 32px; height: 32px; color: #F59E0B; margin-bottom: 8px;"></i>
          <h3 style="font-size: 1.1rem; font-weight: 600;">Nenhum registro localizado</h3>
          <p style="color: var(--color-text-muted); font-size: 0.85rem;">Não encontramos registros para o termo informado.</p>
        </div>
      `;
    }

    const queryType = String(res?.tipo || "").toLowerCase().trim();
    const isNomeSimilar = queryType === "nome_similar";

    return `
      <div class="card" style="margin-bottom: var(--space-4);">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <i data-lucide="list-filter" style="color: var(--color-primary); width: 20px; height: 20px;"></i>
            <h3 class="card-title" style="color: var(--color-text);">Resultados Localizados (${items.length})</h3>
          </div>
          <input 
            type="text" 
            id="inputFiltroResultados" 
            placeholder="${isNomeSimilar ? 'Filtrar por nome, CPF, estado...' : 'Filtrar por nome, CPF, cidade...'}" 
            style="padding: 6px 14px; background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: var(--radius-md); color: var(--color-text); font-size: 0.8125rem; outline: none; min-width: 220px;"
          >
        </div>

        <div class="table-responsive" style="max-height: 550px; overflow-y: auto;">
          <table class="osint-table" id="tabelaResultadosPuxar">
            <thead>
              <tr>
                <th style="width: 40px;">#</th>
                <th>Nome Completo</th>
                <th style="width: 170px;">CPF</th>
                ${
                  isNomeSimilar
                    ? `<th>Local de Emissão Estimado (9º Dígito)</th>`
                    : `
                    <th>Nascimento</th>
                    <th>Mãe</th>
                    <th>Localização / Endereço</th>
                  `
                }
                <th style="text-align: right; width: 120px;">Ação</th>
              </tr>
            </thead>
            <tbody>
              ${items
                .map((item, idx) => {
                  const nome = item.name || item.nome || "Não informado";
                  const rawCpf = String(item.cpf || "").replace(/\D/g, "");
                  const cpfFmt = this.formatCpf(item.cpf);
                  const regiao = item.localEmissao || this.obterRegiaoFiscalCpf(rawCpf);
                  const nasc = item.birth_date || item.nascimento || "N/I";
                  const mae = item.mother_name || item.nomeMae || item.nome_mae || "N/I";
                  const end = item.endereco || item.address;
                  const loc = end
                    ? [end.logradouro || end.street, end.numero || end.number, end.cidade || end.city, end.uf || end.state]
                        .filter(Boolean)
                        .join(", ")
                    : item.cidade || item.city || "Brasil";

                  const searchData = isNomeSimilar
                    ? `${nome.toLowerCase()} ${rawCpf} ${String(regiao).toLowerCase()}`
                    : `${nome.toLowerCase()} ${rawCpf} ${String(loc).toLowerCase()}`;

                  return `
                  <tr class="linha-resultado-item" data-search="${this.escapeHtml(searchData)}">
                    <td style="color: var(--color-text-dim); font-size: 0.75rem;">${idx + 1}</td>
                    <td style="font-weight: 700; color: var(--color-text);">${this.escapeHtml(nome)}</td>
                    <td>
                      <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-family: var(--font-mono); color: #6EE7B7; font-weight: 600;">${cpfFmt}</span>
                        <button type="button" class="btn btn-ghost btn-sm btn-copiar-cpf" data-cpf="${rawCpf}" title="Copiar CPF">
                          <i data-lucide="copy" style="width: 12px; height: 12px;"></i>
                        </button>
                      </div>
                    </td>
                    ${
                      isNomeSimilar
                        ? `
                        <td>
                          <span class="badge" style="background: rgba(139, 92, 246, 0.15); color: #C4B5FD; border: 1px solid rgba(139, 92, 246, 0.3); font-weight: 600; padding: 4px 10px; font-size: 0.8125rem;">
                            <i data-lucide="map-pin" style="width: 12px; height: 12px; vertical-align: middle; margin-right: 4px; color: #A78BFA;"></i>
                            ${this.escapeHtml(regiao)}
                          </span>
                        </td>
                      `
                        : `
                        <td style="font-size: 0.825rem;">${this.escapeHtml(String(nasc).split(" ")[0])}</td>
                        <td style="font-size: 0.825rem; color: var(--color-text-muted);">${this.escapeHtml(mae)}</td>
                        <td style="font-size: 0.8rem; color: var(--color-text-dim);">${this.escapeHtml(loc)}</td>
                      `
                    }
                    <td style="text-align: right;">
                      ${
                        rawCpf
                          ? `
                        <button type="button" class="btn btn-outline btn-sm btn-puxar-cpf" data-cpf="${rawCpf}" title="Puxar Dossiê deste CPF">
                          <i data-lucide="arrow-up-right" style="width: 12px; height: 12px;"></i>
                          <span>Puxar</span>
                        </button>
                      `
                          : ""
                      }
                    </td>
                  </tr>
                `;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  obterRegiaoFiscalCpf(cpf) {
    const clean = String(cpf || "").replace(/\D/g, "");
    if (clean.length < 9) return "Não identificado";
    const digit = clean.charAt(8);
    const mapa = {
      "1": "DF, GO, MT, MS, TO",
      "2": "AC, AM, AP, PA, RO, RR",
      "3": "CE, MA, PI",
      "4": "AL, PB, PE, RN",
      "5": "BA, SE",
      "6": "Minas Gerais (MG)",
      "7": "RJ, ES",
      "8": "São Paulo (SP)",
      "9": "PR, SC",
      "0": "Rio Grande do Sul (RS)",
    };
    return mapa[digit] || "Região não identificada";
  }

  // RENDER: DOSSIÊ COMPLETO DE PESSOA (CPF & DADOS CADASTRAIS HEXYS)
  renderDossiePessoa(dados, res) {
    const nome = dados.name || dados.nome || "Não informado";
    const cpfFmt = this.formatCpf(dados.cpf_masked || dados.cpf || res.termo);
    const rawCpf = String(dados.cpf || res.termo || "").replace(/\D/g, "");
    const nasc = dados.birth_date || dados.dataNascimento || "Não informado";
    const mae = dados.mother_name || dados.nomeMae || dados.nome_mae || "Não informada";
    const pai = dados.father_name || dados.nomePai || dados.nome_pai || "Não informado";
    const rg = dados.rg ? `${dados.rg} ${dados.rg_issuer || ""} ${dados.rg_state || ""}`.trim() : "Não informado";
    const voterId = dados.voter_id || dados.tituloEleitor || "Não informado";
    const status = dados.federal_status || dados.situacaoCadastral || "REGULAR";
    const gender = String(dados.gender || "").toUpperCase() === "F" ? "Feminino" : String(dados.gender || "").toUpperCase() === "M" ? "Masculino" : dados.gender || "N/I";

    // Score CSB8 e CSBA
    const scoreObj = typeof dados.score === "object" && dados.score !== null ? dados.score : {};
    let scoreVal = scoreObj.valor || scoreObj.value || scoreObj.csb8 || scoreObj.csba || scoreObj.score || null;
    if (scoreVal === null && typeof dados.score !== "object" && dados.score !== undefined && dados.score !== null) {
      scoreVal = dados.score;
    }
    scoreVal = scoreVal !== null && scoreVal !== undefined ? String(scoreVal) : "N/A";
    const csb8 = scoreObj.csb8 ? `${scoreObj.csb8} (${scoreObj.csb8_range || scoreObj.csb8_faixa || ""})` : null;
    const csba = scoreObj.csba ? `${scoreObj.csba} (${scoreObj.csba_range || scoreObj.csba_faixa || ""})` : null;
    const csb8Range = scoreObj.csb8_range || scoreObj.csb8_faixa || scoreObj.range || scoreObj.faixa || null;

    // Renda e Poder Aquisitivo
    const rendaPresumidaNum = dados.income || dados.renda_estimativas?.presumida?.valor || null;
    const incomeFmt = rendaPresumidaNum ? `R$ ${Number(rendaPresumidaNum).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : dados.rendaPresumida || "N/A";
    const poderAquisitivoVal = dados.renda_estimativas?.poder_aquisitivo?.valor
      ? `R$ ${Number(dados.renda_estimativas.poder_aquisitivo.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
      : null;
    const poderAquisitivo = dados.serasa_completo?.poder_aquisitivo?.FX_PODER_AQUISITIVO || dados.renda_estimativas?.poder_aquisitivo?.descricao || null;

    const occupation = dados.occupation || dados.profissao || "Não informada";
    const cbo = dados.cbo || dados.occupation_code || null;
    const cnh = dados.cnh?.num_cnh || dados.cnh?.numero_registro || dados.cnh?.numero || (typeof dados.cnh === "string" ? dados.cnh : "Não informado");
    const cnh1st = (dados.cnh?.primeira_habilitacao || dados.cnh?.data_primeira_habilitacao) ? String(dados.cnh.primeira_habilitacao || dados.cnh.data_primeira_habilitacao).split("T")[0] : null;
    const cnhUf = dados.cnh?.uf || dados.cnh?.fonte_uf || null;
    const cns = dados.cns || null;
    const ufCpf = dados.estado_cpf || null;
    const naturalidade = dados.birth_city && dados.birth_city !== "INVALIDO" ? dados.birth_city : null;
    const socialClass = dados.social_class?.social_class ? `Classe ${dados.social_class.social_class}` : "";
    const mosaic = dados.mosaic || dados.classeSocial || "N/A";

    // E-mails (combina email principal, additional_emails e emails serasa)
    const allEmails = [];
    if (dados.email) allEmails.push(dados.email);
    if (Array.isArray(dados.additional_emails)) {
      dados.additional_emails.forEach((em) => {
        if (em && !allEmails.includes(em)) allEmails.push(em);
      });
    }
    if (Array.isArray(dados.emails)) {
      dados.emails.forEach((eObj) => {
        const em = typeof eObj === "object" ? eObj.email || eObj.address : String(eObj);
        if (em && !allEmails.includes(em)) allEmails.push(em);
      });
    }

    // Telefones & Linhas
    const phones = (Array.isArray(dados.telefones) && dados.telefones.length > 0)
      ? dados.telefones
      : (Array.isArray(dados.phones) && dados.phones.length > 0)
        ? dados.phones
        : [];
    const telsPorOp = dados.telefonesPorOperadora || null;
    const vivoLinhas = Array.isArray(dados.vivo_linhas) ? dados.vivo_linhas : [];
    const operadorasMap = {};
    if (Array.isArray(dados.telefones_operadoras)) {
      dados.telefones_operadoras.forEach((to) => {
        if (to.telefone && to.operadora) operadorasMap[String(to.telefone).replace(/\D/g, "")] = to.operadora;
      });
    }

    // Endereços (all_addresses + delivery_addresses sem duplicatas)
    const rawAllAddresses = dados.all_addresses || dados.enderecos || (dados.address ? [dados.address] : []);
    const deliveryAddresses = Array.isArray(dados.delivery_addresses) ? dados.delivery_addresses : [];
    const allAddresses = [...rawAllAddresses];

    deliveryAddresses.forEach((deliv) => {
      const exists = allAddresses.some((a) => {
        return (
          String(a.zip_code || a.cep || "").replace(/\D/g, "") === String(deliv.zip_code || deliv.cep || "").replace(/\D/g, "") &&
          String(a.number || a.numero || "") === String(deliv.number || deliv.numero || "")
        );
      });
      if (!exists) {
        allAddresses.push({ ...deliv, source: deliv.source || "DELIVERY_ECOMMERCE" });
      }
    });

    // Empresas / QSA
    const empresas = Array.isArray(dados.empresas) ? dados.empresas : Array.isArray(dados.empresas_vinculadas) ? dados.empresas_vinculadas : [];

    // Parentes
    const parentes = Array.isArray(dados.serasa_completo?.parentes)
      ? dados.serasa_completo.parentes
      : Array.isArray(dados.parentes)
        ? dados.parentes
        : [];

    // Vizinhos
    const vizinhos = dados.vizinhos || [];

    // Veículos listados sob CPF (Automotores com Chassi, Renavam e Motor)
    const vehiclesList = (Array.isArray(dados.veiculos) && dados.veiculos.length > 0)
      ? dados.veiculos
      : (dados.vehicles && Array.isArray(dados.vehicles.list))
        ? dados.vehicles.list
        : (dados.raw && Array.isArray(dados.raw.HISTORICO_VEICULOS))
          ? dados.raw.HISTORICO_VEICULOS
          : [];

    // Histórico Vacinal COVID-19 & Locais de Vacinação (SUS)
    const vacinasCovid = (Array.isArray(dados.vacinas_covid) && dados.vacinas_covid.length > 0)
      ? dados.vacinas_covid
      : (Array.isArray(dados.covid) && dados.covid.length > 0)
        ? dados.covid
        : (dados.raw && Array.isArray(dados.raw.COVID))
          ? dados.raw.COVID
          : [];

    // Dados Bancários & Contas
    const dadosBancarios = (Array.isArray(dados.dadosBancarios) && dados.dadosBancarios.length > 0)
      ? dados.dadosBancarios
      : (dados.raw && Array.isArray(dados.raw.DADOS_BANCARIOS))
        ? dados.raw.DADOS_BANCARIOS
        : [];

    // Vínculos Empregatícios (RAIS / INSS / PIS)
    const vinculosRais = (Array.isArray(dados.vinculosEmpregaticios) && dados.vinculosEmpregaticios.length > 0)
      ? dados.vinculosEmpregaticios
      : (Array.isArray(dados.rais) && dados.rais.length > 0)
        ? dados.rais
        : (dados.raw && Array.isArray(dados.raw.RAIS))
          ? dados.raw.RAIS
          : [];
    const beneficiosInss = (Array.isArray(dados.beneficiosInss) && dados.beneficiosInss.length > 0)
      ? dados.beneficiosInss
      : (dados.raw && Array.isArray(dados.raw.INSS))
        ? dados.raw.INSS
        : [];

    // Vazamentos / Breaches (inclusive senhas vazadas da base CPF)
    const vazamentos = Array.isArray(dados.vazamentos) && dados.vazamentos.length > 0
      ? dados.vazamentos
      : (dados.raw && Array.isArray(dados.raw.SENHA_CPF))
        ? dados.raw.SENHA_CPF.map((s) => ({
            cpf: dados.cpf,
            senha: s.SENHA || s.senha,
            fonte: "Vazamento Público de Credenciais",
            titulo: "Senha Comprometida",
          }))
        : [];
    const totalVazamentos = dados.total_vazamentos || vazamentos.length || 0;
    const alvosVazamentos = dados.alvos_verificados_vazamentos || 0;

    // Cobertura OSINT
    const totalFontes = dados.data_coverage?.total_sources || 16;

    // Foto / Google Accounts / Espelhos
    const fotoSrc =
      dados.foto_url ||
      dados.foto_google ||
      dados.fotoBase64 ||
      dados.base64 ||
      dados.foto ||
      (Array.isArray(dados.fotos_disponiveis) && dados.fotos_disponiveis[0]?.url) ||
      (Array.isArray(dados.contas_google) && dados.contas_google[0]?.photoUrl) ||
      null;
    const googleAccounts = Array.isArray(dados.contas_google) ? dados.contas_google : [];
    const availablePhotos = Array.isArray(dados.fotos_disponiveis) ? dados.fotos_disponiveis : [];

    return `
      <!-- CARTÃO PRINCIPAL (HERO) -->
      <div class="card" style="margin-bottom: var(--space-4); border-top: 4px solid #8B5CF6;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
          
          <div style="display: flex; gap: 16px; align-items: center; flex-wrap: wrap;">
            <!-- Avatar / Foto Biometria Facial -->
            <div style="position: relative; flex-shrink: 0;">
              ${
                fotoSrc
                  ? `
                <div style="position: relative; width: 100px; height: 120px; border-radius: var(--radius-md); overflow: hidden; border: 2px solid #8B5CF6; box-shadow: 0 4px 14px rgba(139, 92, 246, 0.35);">
                  <img 
                    src="${fotoSrc}" 
                    alt="Biometria Facial" 
                    style="width: 100%; height: 100%; object-fit: cover;"
                    onerror="this.parentElement.style.display='none'"
                  >
                  <a href="${fotoSrc}" target="_blank" title="Visualizar Imagem em Alta Resolução" style="position: absolute; bottom: 4px; right: 4px; background: rgba(0,0,0,0.7); color: #FFF; border-radius: 4px; padding: 2px 4px; font-size: 0.65rem; display: flex; align-items: center;">
                    <i data-lucide="maximize-2" style="width: 11px; height: 11px;"></i>
                  </a>
                </div>
              `
                  : `
                <div style="width: 80px; height: 95px; background: var(--color-surface-2); border-radius: var(--radius-md); border: 1px dashed var(--color-border); display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--color-text-dim);">
                  <i data-lucide="user" style="width: 32px; height: 32px;"></i>
                  <span style="font-size: 0.65rem; margin-top: 4px;">Sem Foto</span>
                </div>
              `
              }
            </div>

            <!-- Dados Identificadores -->
            <div>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span class="badge" style="background: rgba(139, 92, 246, 0.15); color: #C4B5FD; font-weight: 700;">
                <i data-lucide="id-card" style="width: 12px; height: 12px;"></i> PESSOA FÍSICA
              </span>
              <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10B981; font-weight: 700;">
                ${status}
              </span>
              ${ufCpf ? `<span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #60A5FA;">UF Origem: ${ufCpf}</span>` : ""}
              <span class="badge badge-dark" style="font-size: 0.72rem;">✓ ${totalFontes} Fontes Consultadas</span>
              ${
                alvosVazamentos > 0
                  ? `<span class="badge" style="background: ${totalVazamentos === 0 ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)"}; color: ${totalVazamentos === 0 ? "#10B981" : "#EF4444"}; font-size: 0.72rem;">
                      <i data-lucide="${totalVazamentos === 0 ? "shield-check" : "shield-alert"}" style="width: 11px; height: 11px;"></i>
                      ${totalVazamentos === 0 ? `Seguro (${alvosVazamentos} alvos auditados)` : `${totalVazamentos} vazamentos`}
                    </span>`
                  : ""
              }
            </div>

            <h2 style="font-size: 1.45rem; font-weight: 800; color: var(--color-text); margin-top: 8px; margin-bottom: 2px;">
              ${this.escapeHtml(nome)}
            </h2>

            <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
              <span style="font-family: var(--font-mono); font-size: 1.05rem; font-weight: 700; color: #6EE7B7;">${cpfFmt}</span>
              <button type="button" class="btn btn-ghost btn-sm btn-copiar-cpf" data-cpf="${rawCpf}" title="Copiar CPF">
                <i data-lucide="copy" style="width: 13px; height: 13px;"></i>
              </button>
            </div>

            <!-- AÇÕES RÁPIDAS NO HEADER -->
            <div style="display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap;">
              <button type="button" class="btn btn-outline btn-sm btn-puxar-foto" data-cpf="${rawCpf}" title="Consultar Biometria Facial na RimuAPI">
                <i data-lucide="camera" style="width: 13px; height: 13px;"></i> Biometria Facial
              </button>
              <button type="button" class="btn btn-outline btn-sm btn-puxar-vizinhos" data-cpf="${rawCpf}" title="Mapear Vizinhos no Logradouro">
                <i data-lucide="home" style="width: 13px; height: 13px;"></i> Mapear Vizinhos
              </button>
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <div style="background: var(--color-surface-2); padding: 8px 14px; border-radius: var(--radius-md); text-align: center; border: 1px solid var(--color-border); min-width: 110px;">
              <span style="font-size: 0.7rem; color: var(--color-text-muted); text-transform: uppercase;">Score de Crédito</span>
              <div style="font-size: 1.25rem; font-weight: 800; color: #60A5FA;">${scoreVal}</div>
              ${csb8Range ? `<span style="font-size: 0.65rem; color: #34D399; font-weight: 700;">CSB8: ${csb8Range}</span>` : ""}
            </div>
            <div style="background: var(--color-surface-2); padding: 8px 14px; border-radius: var(--radius-md); text-align: center; border: 1px solid var(--color-border); min-width: 130px;">
              <span style="font-size: 0.7rem; color: var(--color-text-muted); text-transform: uppercase;">Renda Estimada</span>
              <div style="font-size: 1.15rem; font-weight: 800; color: #10B981;">${incomeFmt}</div>
              ${poderAquisitivoVal ? `<span style="font-size: 0.68rem; color: #60A5FA; display: block; font-weight: 600;" title="Poder Aquisitivo Serasa">Poder Aq.: ${poderAquisitivoVal}</span>` : poderAquisitivo ? `<span style="font-size: 0.65rem; color: var(--color-text-dim); display: block;">${poderAquisitivo}</span>` : ""}
            </div>
          </div>
        </div>

        <!-- GRID DADOS BÁSICOS -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-top: var(--space-5); font-size: 0.875rem;">
          <div>
            <span style="color: var(--color-text-muted); font-size: 0.75rem;">Data de Nascimento</span>
            <div style="font-weight: 700; color: var(--color-text); margin-top: 2px;">
              ${this.escapeHtml(String(nasc).split(" ")[0])}
            </div>
          </div>
          <div>
            <span style="color: var(--color-text-muted); font-size: 0.75rem;">Sexo</span>
            <div style="font-weight: 700; color: var(--color-text); margin-top: 2px;">${gender}</div>
          </div>
          ${
            naturalidade
              ? `<div>
                  <span style="color: var(--color-text-muted); font-size: 0.75rem;">Naturalidade</span>
                  <div style="font-weight: 700; color: var(--color-text); margin-top: 2px;">${this.escapeHtml(naturalidade)}</div>
                </div>`
              : ""
          }
          <div>
            <span style="color: var(--color-text-muted); font-size: 0.75rem;">Nome da Mãe</span>
            <div style="font-weight: 700; color: var(--color-text); margin-top: 2px;">${this.escapeHtml(mae)}</div>
          </div>
          <div>
            <span style="color: var(--color-text-muted); font-size: 0.75rem;">Nome do Pai</span>
            <div style="font-weight: 700; color: var(--color-text); margin-top: 2px;">${this.escapeHtml(pai)}</div>
          </div>
          <div>
            <span style="color: var(--color-text-muted); font-size: 0.75rem;">Registro Geral (RG)</span>
            <div style="font-family: var(--font-mono); font-weight: 700; color: var(--color-text); margin-top: 2px;">${this.escapeHtml(rg)}</div>
          </div>
          <div>
            <span style="color: var(--color-text-muted); font-size: 0.75rem;">Título de Eleitor</span>
            <div style="font-family: var(--font-mono); font-weight: 700; color: var(--color-text); margin-top: 2px;">${this.escapeHtml(voterId)}</div>
          </div>
          <div>
            <span style="color: var(--color-text-muted); font-size: 0.75rem;">Registro CNH</span>
            <div style="font-family: var(--font-mono); font-weight: 700; color: #F59E0B; margin-top: 2px;">
              ${this.escapeHtml(cnh)}
              ${cnhUf ? `<span class="badge badge-dark" style="font-size: 0.65rem; padding: 1px 4px; margin-left: 2px;">${cnhUf}</span>` : ""}
              ${cnh1st ? `<small style="font-size: 0.7rem; color: var(--color-text-dim); margin-left: 4px;">(1ª: ${cnh1st})</small>` : ""}
            </div>
          </div>
          <div>
            <span style="color: var(--color-text-muted); font-size: 0.75rem;">Cartão SUS (CNS)</span>
            <div style="font-family: var(--font-mono); font-weight: 700; color: #34D399; margin-top: 2px;">${cns || "Não informado"}</div>
          </div>
          <div>
            <span style="color: var(--color-text-muted); font-size: 0.75rem;">Ocupação / CBO</span>
            <div style="font-weight: 700; color: var(--color-text); margin-top: 2px;">
              ${this.escapeHtml(occupation)} ${cbo ? `<span style="font-family: var(--font-mono); color: var(--color-text-dim); font-size: 0.75rem;">(${cbo})</span>` : ""}
            </div>
          </div>
          <div>
            <span style="color: var(--color-text-muted); font-size: 0.75rem;">Mosaico / Classe</span>
            <div style="font-weight: 700; color: var(--color-text); margin-top: 2px;">
              ${mosaic}${socialClass ? ` &bull; ${socialClass}` : ""}
            </div>
          </div>
        </div>
      </div>

      <!-- SEÇÃO BIOMETRIA FACIAL & CONTAS GOOGLE -->
      ${
        (fotoSrc || googleAccounts.length > 0 || availablePhotos.length > 0)
          ? `
        <div class="card" style="margin-bottom: var(--space-4); border-left: 4px solid #8B5CF6;">
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <h3 class="card-title" style="display: flex; align-items: center; gap: 8px; color: #A78BFA;">
              <i data-lucide="camera" style="width: 18px; height: 18px;"></i>
              <span>Biometria Facial, Fotos & Contas Google (${availablePhotos.length || (fotoSrc ? 1 : 0)} fotos / ${googleAccounts.length} contas)</span>
            </h3>
            <span class="badge" style="background: rgba(139, 92, 246, 0.15); color: #C4B5FD;">Google OSINT & Registro</span>
          </div>

          <div style="display: flex; gap: var(--space-5); flex-wrap: wrap; align-items: flex-start; padding-top: var(--space-2);">
            ${
              fotoSrc
                ? `
              <div style="text-align: center; flex-shrink: 0;">
                <div style="position: relative; display: inline-block;">
                  <img 
                    src="${fotoSrc}" 
                    alt="Foto Biometria" 
                    style="width: 150px; height: 185px; object-fit: cover; border-radius: var(--radius-md); border: 2px solid #8B5CF6; box-shadow: 0 4px 15px rgba(139, 92, 246, 0.35);"
                  >
                </div>
                <div style="margin-top: 8px;">
                  <a href="${fotoSrc}" target="_blank" download="foto-facial-${rawCpf}.jpg" class="btn btn-outline btn-sm" style="font-size: 0.75rem;">
                    <i data-lucide="download" style="width: 12px; height: 12px;"></i> Baixar Foto
                  </a>
                </div>
              </div>
            `
                : ""
            }

            <div style="flex: 1; min-width: 250px;">
              ${
                googleAccounts.length > 0
                  ? `
                <span style="font-size: 0.75rem; color: var(--color-text-muted); text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 8px;">
                  Contas Google Vinculadas (${googleAccounts.length})
                </span>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 8px;">
                  ${googleAccounts
                    .map((acc, aIdx) => {
                      const accEmail = acc.email || "E-mail não informado";
                      const accPhoto = acc.photoUrl || null;
                      return `
                      <div style="background: var(--color-surface-2); padding: 10px; border-radius: var(--radius-md); border: 1px solid var(--color-border); display: flex; align-items: center; gap: 10px;">
                        ${
                          accPhoto
                            ? `<img src="${accPhoto}" alt="Avatar Google" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 1px solid #8B5CF6;">`
                            : `<div style="width: 36px; height: 36px; border-radius: 50%; background: rgba(139, 92, 246, 0.15); color: #A78BFA; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.8rem;">G</div>`
                        }
                        <div style="overflow: hidden;">
                          <div style="font-weight: 600; color: var(--color-text); font-size: 0.85rem; word-break: break-all;">${this.escapeHtml(accEmail)}</div>
                          <span style="font-size: 0.7rem; color: #10B981;">Conta Ativa #${aIdx + 1}</span>
                        </div>
                      </div>
                    `;
                    })
                    .join("")}
                </div>
              `
                  : `<p style="font-size: 0.85rem; color: var(--color-text-dim);">Foto oficial obtida através de cruzamento biométrico.</p>`
              }

              ${
                availablePhotos.length > 1
                  ? `
                <div style="margin-top: 14px;">
                  <span style="font-size: 0.75rem; color: var(--color-text-muted); text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 6px;">
                    Outros Espelhos Fotográficos Localizados (${availablePhotos.length})
                  </span>
                  <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    ${availablePhotos
                      .map((p, pIdx) => {
                        const pUrl = p.url || (p.base64 ? `data:image/jpeg;base64,${p.base64}` : null);
                        if (!pUrl) return "";
                        return `
                        <a href="${pUrl}" target="_blank" style="display: block; width: 50px; height: 60px; border-radius: var(--radius-sm); overflow: hidden; border: 1px solid var(--color-border);">
                          <img src="${pUrl}" alt="Espelho #${pIdx + 1}" style="width: 100%; height: 100%; object-fit: cover;">
                        </a>
                      `;
                      })
                      .join("")}
                  </div>
                </div>
              `
                  : ""
              }
            </div>
          </div>
        </div>
      `
          : ""
      }

      <!-- SEÇÃO E-MAILS CADASTRADOS -->
      ${
        allEmails.length > 0
          ? `
        <div class="card" style="margin-bottom: var(--space-4);">
          <div class="card-header">
            <h3 class="card-title" style="color: #EC4899; display: flex; align-items: center; gap: 8px;">
              <i data-lucide="mail" style="width: 18px; height: 18px;"></i>
              <span>E-mails Vinculados (${allEmails.length})</span>
            </h3>
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 8px; padding-top: 8px;">
            ${allEmails
              .map((em) => `
              <div style="background: var(--color-surface-2); padding: 7px 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border); display: flex; align-items: center; gap: 8px;">
                <span style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--color-text); font-weight: 600;">${this.escapeHtml(em)}</span>
                <button type="button" class="btn btn-ghost btn-sm btn-copiar-texto" data-copy="${this.escapeHtml(em)}" title="Copiar E-mail">
                  <i data-lucide="copy" style="width: 12px; height: 12px;"></i>
                </button>
              </div>
            `)
              .join("")}
          </div>
        </div>
      `
          : ""
      }

      <!-- SEÇÃO TELEFONES E LINHAS (SEPARADOS POR OPERADORA) -->
      ${
        phones.length > 0
          ? (() => {
              const grupos = {
                VIVO: [],
                CLARO: [],
                TIM: [],
                OI: [],
                OUTROS: [],
              };

              phones.forEach((t) => {
                const clean = String(t.numeroLimpo || (typeof t === "object" ? t.numero || t.telefone : t) || "").replace(/\D/g, "");
                const op = String(t.operadora || operadorasMap[clean] || "").toUpperCase();
                if (op.includes("VIVO")) grupos.VIVO.push(t);
                else if (op.includes("CLARO")) grupos.CLARO.push(t);
                else if (op.includes("TIM")) grupos.TIM.push(t);
                else if (op.includes("OI")) grupos.OI.push(t);
                else grupos.OUTROS.push(t);
              });

              const totalOpCount =
                (grupos.VIVO.length > 0 ? 1 : 0) +
                (grupos.CLARO.length > 0 ? 1 : 0) +
                (grupos.TIM.length > 0 ? 1 : 0) +
                (grupos.OI.length > 0 ? 1 : 0);

              const renderTelCard = (t) => {
                const num = typeof t === "object" ? t.numero || t.telefone || "" : String(t);
                const cleanNum = String(t.numeroLimpo || num).replace(/\D/g, "");
                const fmtNum = this.formatTelefone(num);
                const isMobile = cleanNum.length === 11 || (cleanNum.length === 9 && cleanNum.startsWith("9"));
                const op = String(t.operadora || operadorasMap[cleanNum] || (isMobile ? "Móvel" : "Fixo")).toUpperCase();
                const dataInst = t.dataInstalacao || t.data || null;
                const endLinha = t.enderecoLinha || null;

                let opBg = "rgba(59, 130, 246, 0.15)";
                let opColor = "#60A5FA";
                let opBorder = "rgba(59, 130, 246, 0.3)";
                if (op.includes("VIVO")) {
                  opBg = "rgba(139, 92, 246, 0.18)";
                  opColor = "#A78BFA";
                  opBorder = "rgba(139, 92, 246, 0.4)";
                } else if (op.includes("CLARO")) {
                  opBg = "rgba(239, 68, 68, 0.18)";
                  opColor = "#F87171";
                  opBorder = "rgba(239, 68, 68, 0.4)";
                } else if (op.includes("TIM")) {
                  opBg = "rgba(37, 99, 235, 0.2)";
                  opColor = "#60A5FA";
                  opBorder = "rgba(37, 99, 235, 0.4)";
                } else if (op.includes("OI")) {
                  opBg = "rgba(245, 158, 11, 0.18)";
                  opColor = "#FBBF24";
                  opBorder = "rgba(245, 158, 11, 0.4)";
                }

                return `
                <div style="background: var(--color-surface-2); padding: 12px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border); display: flex; flex-direction: column; gap: 8px; flex: 1 1 280px; max-width: 100%;">
                  <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span style="font-family: var(--font-mono); font-weight: 800; font-size: 1.05rem; color: #FFFFFF;">${fmtNum}</span>
                      <span class="badge" style="background: ${opBg}; color: ${opColor}; border: 1px solid ${opBorder}; font-size: 0.68rem; font-weight: 700; padding: 2px 7px;">
                        ${op}
                      </span>
                      ${t.tipo && t.tipo !== op ? `<span style="font-size: 0.7rem; color: var(--color-text-dim);">(${this.escapeHtml(t.tipo)})</span>` : ""}
                    </div>
                    
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <button type="button" class="btn btn-ghost btn-sm btn-copiar-texto" data-copy="${cleanNum}" title="Copiar Telefone">
                        <i data-lucide="copy" style="width: 13px; height: 13px;"></i>
                      </button>
                      <button type="button" class="btn btn-ghost btn-sm btn-puxar-operadora" data-tel="${cleanNum}" title="Checar Portabilidade & Operadora Atual">
                        <i data-lucide="radio" style="width: 13px; height: 13px; color: #F59E0B;"></i>
                      </button>
                      ${
                        isMobile
                          ? `
                        <a href="https://wa.me/55${cleanNum}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm" title="Abrir no WhatsApp Web" style="color: #10B981;">
                          <i data-lucide="message-circle" style="width: 14px; height: 14px;"></i>
                        </a>
                      `
                          : ""
                      }
                      <a href="tel:${cleanNum}" class="btn btn-ghost btn-sm" title="Ligar para o número" style="color: #38BDF8;">
                        <i data-lucide="phone-call" style="width: 13px; height: 13px;"></i>
                      </a>
                    </div>
                  </div>

                  ${
                    dataInst || endLinha
                      ? `
                    <div style="font-size: 0.75rem; color: var(--color-text-muted); background: var(--color-surface); padding: 6px 10px; border-radius: var(--radius-sm); border: 1px solid rgba(255, 255, 255, 0.03);">
                      ${dataInst ? `<div>📅 <strong style="color: var(--color-text);">Instalação:</strong> ${this.escapeHtml(dataInst)}</div>` : ""}
                      ${endLinha ? `<div style="margin-top: 2px;">📍 <strong style="color: var(--color-text);">Endereço da Linha:</strong> ${this.escapeHtml(endLinha)}</div>` : ""}
                    </div>
                  `
                      : ""
                  }
                </div>
              `;
              };

              return `
              <div class="card" style="margin-bottom: var(--space-4); border-left: 4px solid #60A5FA;">
                <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                  <h3 class="card-title" style="color: #60A5FA; display: flex; align-items: center; gap: 8px;">
                    <i data-lucide="phone" style="width: 18px; height: 18px;"></i>
                    <span>Telefones & Linhas Telefônicas (${phones.length})</span>
                  </h3>
                  <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                    ${grupos.VIVO.length > 0 ? `<span class="badge" style="background: rgba(139, 92, 246, 0.2); color: #C4B5FD; font-size: 0.7rem;">${grupos.VIVO.length} Vivo</span>` : ""}
                    ${grupos.CLARO.length > 0 ? `<span class="badge" style="background: rgba(239, 68, 68, 0.2); color: #FCA5A5; font-size: 0.7rem;">${grupos.CLARO.length} Claro</span>` : ""}
                    ${grupos.TIM.length > 0 ? `<span class="badge" style="background: rgba(59, 130, 246, 0.2); color: #93C5FD; font-size: 0.7rem;">${grupos.TIM.length} TIM</span>` : ""}
                    ${grupos.OI.length > 0 ? `<span class="badge" style="background: rgba(245, 158, 11, 0.2); color: #FDE68A; font-size: 0.7rem;">${grupos.OI.length} Oi</span>` : ""}
                    ${grupos.OUTROS.length > 0 ? `<span class="badge badge-dark" style="font-size: 0.7rem;">${grupos.OUTROS.length} Outros</span>` : ""}
                  </div>
                </div>

                ${
                  totalOpCount > 1
                    ? `
                  <div style="display: flex; flex-direction: column; gap: 14px; padding-top: 10px;">
                    ${
                      grupos.VIVO.length > 0
                        ? `
                      <div>
                        <div style="font-size: 0.75rem; font-weight: 700; color: #A78BFA; text-transform: uppercase; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                          <span style="width: 8px; height: 8px; border-radius: 50%; background: #8B5CF6;"></span>
                          Linhas Telefônicas VIVO (${grupos.VIVO.length})
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                          ${grupos.VIVO.map(renderTelCard).join("")}
                        </div>
                      </div>
                    `
                        : ""
                    }
                    ${
                      grupos.CLARO.length > 0
                        ? `
                      <div>
                        <div style="font-size: 0.75rem; font-weight: 700; color: #F87171; text-transform: uppercase; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                          <span style="width: 8px; height: 8px; border-radius: 50%; background: #EF4444;"></span>
                          Linhas Telefônicas CLARO (${grupos.CLARO.length})
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                          ${grupos.CLARO.map(renderTelCard).join("")}
                        </div>
                      </div>
                    `
                        : ""
                    }
                    ${
                      grupos.TIM.length > 0
                        ? `
                      <div>
                        <div style="font-size: 0.75rem; font-weight: 700; color: #60A5FA; text-transform: uppercase; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                          <span style="width: 8px; height: 8px; border-radius: 50%; background: #3B82F6;"></span>
                          Linhas Telefônicas TIM (${grupos.TIM.length})
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                          ${grupos.TIM.map(renderTelCard).join("")}
                        </div>
                      </div>
                    `
                        : ""
                    }
                    ${
                      grupos.OI.length > 0
                        ? `
                      <div>
                        <div style="font-size: 0.75rem; font-weight: 700; color: #FBBF24; text-transform: uppercase; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                          <span style="width: 8px; height: 8px; border-radius: 50%; background: #F59E0B;"></span>
                          Linhas Telefônicas OI (${grupos.OI.length})
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                          ${grupos.OI.map(renderTelCard).join("")}
                        </div>
                      </div>
                    `
                        : ""
                    }
                    ${
                      grupos.OUTROS.length > 0
                        ? `
                      <div>
                        <div style="font-size: 0.75rem; font-weight: 700; color: #94A3B8; text-transform: uppercase; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                          <span style="width: 8px; height: 8px; border-radius: 50%; background: #64748B;"></span>
                          Histórico Geral de Telefones (${grupos.OUTROS.length})
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                          ${grupos.OUTROS.map(renderTelCard).join("")}
                        </div>
                      </div>
                    `
                        : ""
                    }
                  </div>
                `
                    : `
                  <div style="display: flex; flex-wrap: wrap; gap: 10px; padding-top: 10px;">
                    ${phones.map(renderTelCard).join("")}
                  </div>
                `
                }
              </div>
            `;
            })()
          : ""
      }

      <!-- SEÇÃO EMPRESAS E PARTICIPAÇÕES SOCIETÁRIAS (QSA) -->
      ${
        empresas.length > 0
          ? `
        <div class="card" style="margin-bottom: var(--space-4); border-left: 4px solid #10B981;">
          <div class="card-header">
            <h3 class="card-title" style="color: #10B981; display: flex; align-items: center; gap: 8px;">
              <i data-lucide="building-2" style="width: 18px; height: 18px;"></i>
              <span>Empresas & Participações Societárias (${empresas.length})</span>
            </h3>
          </div>
          <div style="display: flex; flex-direction: column; gap: 14px; padding-top: 10px;">
            ${empresas
              .map((emp) => {
                const cnpjFmt = this.formatCnpj(emp.cnpj);
                const cleanCnpj = String(emp.cnpj || "").replace(/\D/g, "");
                const situacao = emp.situacao || "ATIVA";
                const isBaixada = situacao.toUpperCase().includes("BAIXADA");
                const socios = Array.isArray(emp.quadro_societario)
                  ? emp.quadro_societario
                  : Array.isArray(emp.socios)
                    ? emp.socios
                    : [];

                return `
                <div style="background: var(--color-surface-2); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
                    <div>
                      <h4 style="font-size: 1.05rem; font-weight: 800; color: var(--color-text); margin: 0;">
                        ${this.escapeHtml(emp.razao_social || "Razão Social")}
                      </h4>
                      <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                        <span style="font-family: var(--font-mono); font-weight: 700; color: #60A5FA;">CNPJ: ${cnpjFmt}</span>
                        <button type="button" class="btn btn-ghost btn-sm btn-copiar-texto" data-copy="${cleanCnpj}" title="Copiar CNPJ">
                          <i data-lucide="copy" style="width: 12px; height: 12px;"></i>
                        </button>
                      </div>
                    </div>
                    <span class="badge" style="background: ${isBaixada ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)"}; color: ${isBaixada ? "#EF4444" : "#10B981"}; font-weight: 700;">
                      ${situacao}
                    </span>
                  </div>

                  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-top: 12px; font-size: 0.8rem;">
                    <div>
                      <span style="color: var(--color-text-muted); font-size: 0.72rem;">Qualificação / Cargo:</span>
                      <div style="font-weight: 700; color: #F59E0B;">${this.escapeHtml(emp.qualificacao_socio || "Sócio")}</div>
                    </div>
                    <div>
                      <span style="color: var(--color-text-muted); font-size: 0.72rem;">Data de Abertura:</span>
                      <div style="font-weight: 600; color: var(--color-text);">${emp.data_abertura || "N/I"}</div>
                    </div>
                    <div>
                      <span style="color: var(--color-text-muted); font-size: 0.72rem;">Porte / Natureza:</span>
                      <div style="font-weight: 600; color: var(--color-text);">${this.escapeHtml(emp.natureza_juridica || emp.porte || "N/A")}</div>
                    </div>
                  </div>

                  ${
                    emp.cnae_principal || emp.cnae_descricao
                      ? `
                    <div style="margin-top: 8px; font-size: 0.78rem; color: var(--color-text-dim);">
                      <strong>CNAE:</strong> ${this.escapeHtml(emp.cnae_principal || emp.cnae_descricao)}
                    </div>
                  `
                      : ""
                  }

                  <!-- Quadro Societário da Empresa -->
                  ${
                    socios.length > 0
                      ? `
                    <div style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--color-border);">
                      <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Quadro de Sócios (QSA):</span>
                      <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 6px;">
                        ${socios
                          .map((socio) => {
                            const socioCpf = socio.cpf || socio.cpf_cnpj || socio.cpf_mascarado || "";
                            const cleanSocioCpf = String(socioCpf).replace(/\D/g, "");
                            return `
                            <div style="background: var(--color-surface); padding: 6px 10px; border-radius: var(--radius-sm); display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; gap: 8px;">
                              <div>
                                <strong style="color: var(--color-text);">${this.escapeHtml(socio.nome || "Sócio")}</strong>
                                <span style="color: var(--color-text-dim); margin-left: 6px;">(${this.escapeHtml(socio.qualificacao || "Sócio")})</span>
                              </div>
                              <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="font-family: var(--font-mono); color: #6EE7B7; font-size: 0.75rem;">${socioCpf}</span>
                                ${
                                  cleanSocioCpf.length === 11
                                    ? `
                                  <button type="button" class="btn btn-outline btn-sm btn-puxar-cpf" data-cpf="${cleanSocioCpf}" style="font-size: 0.7rem; padding: 2px 6px;">
                                    Puxar
                                  </button>
                                `
                                    : ""
                                }
                              </div>
                            </div>
                          `;
                          })
                          .join("")}
                      </div>
                    </div>
                  `
                      : ""
                  }
                </div>
              `;
              })
              .join("")}
          </div>
        </div>
      `
          : ""
      }

      <!-- SEÇÃO PARENTES / VÍNCULOS FAMILIARES -->
      ${
        parentes.length > 0
          ? `
        <div class="card" style="margin-bottom: var(--space-4);">
          <div class="card-header">
            <h3 class="card-title" style="color: #A78BFA; display: flex; align-items: center; gap: 8px;">
              <i data-lucide="users" style="width: 18px; height: 18px;"></i>
              <span>Vínculos Familiares / Parentes (${parentes.length})</span>
            </h3>
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px; padding-top: 8px;">
            ${parentes
              .map((p) => {
                const vinculo = p.vinculo || p.parentesco || "Parente";
                const pNome = p.nome || "Não informado";
                const pCpf = p.cpf || "Não informado";
                const cleanPCpf = String(pCpf).replace(/\D/g, "");

                return `
                <div style="background: var(--color-surface-2); padding: 8px 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="badge badge-purple" style="font-size: 0.72rem;">${this.escapeHtml(vinculo)}</span>
                    <strong style="color: var(--color-text); font-size: 0.875rem;">${this.escapeHtml(pNome)}</strong>
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-family: var(--font-mono); color: var(--color-text-dim); font-size: 0.8rem;">${pCpf}</span>
                    ${
                      cleanPCpf.length === 11
                        ? `
                      <button type="button" class="btn btn-outline btn-sm btn-puxar-cpf" data-cpf="${cleanPCpf}">Puxar</button>
                    `
                        : ""
                    }
                  </div>
                </div>
              `;
              })
              .join("")}
          </div>
        </div>
      `
          : ""
      }

      <!-- SEÇÃO ENDEREÇOS (HISTÓRICO & ENTREGA) -->
      ${
        allAddresses.length > 0
          ? `
        <div class="card" style="margin-bottom: var(--space-4);">
          <div class="card-header">
            <h3 class="card-title" style="color: #F87171; display: flex; align-items: center; gap: 8px;">
              <i data-lucide="map-pin" style="width: 18px; height: 18px;"></i>
              <span>Histórico de Endereços Registrados (${allAddresses.length})</span>
            </h3>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px; padding-top: 8px;">
            ${allAddresses
              .map((end) => {
                const log = [end.type || end.tipo, end.street || end.logradouro].filter(Boolean).join(" ");
                const num = end.number || end.numero || "S/N";
                const comp = end.complement || end.complemento ? `- ${end.complement || end.complemento}` : "";
                const bairro = end.neighborhood || end.bairro || "";
                const cid = end.city || end.cidade || "";
                const uf = end.state || end.uf || "";
                const cep = end.zip_code || end.cep || "";
                const source = end.source || end.fonte || "OFICIAL";

                return `
                <div style="background: var(--color-surface-2); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap;">
                  <div>
                    <div style="font-weight: 700; color: var(--color-text);">
                      ${this.escapeHtml(log)}, ${this.escapeHtml(num)} ${this.escapeHtml(comp)}
                    </div>
                    <div style="font-size: 0.8rem; color: var(--color-text-muted); margin-top: 2px;">
                      ${bairro ? `Bairro ${this.escapeHtml(bairro)} &bull; ` : ""}${this.escapeHtml(cid)} - ${this.escapeHtml(uf)} &bull; CEP: <span style="font-family: var(--font-mono);">${this.formatCep(cep)}</span>
                    </div>
                  </div>
                  <span class="badge badge-dark" style="font-size: 0.68rem; text-transform: uppercase;">Fonte: ${source}</span>
                </div>
              `;
              })
              .join("")}
          </div>
        </div>
      `
          : ""
      }

      <!-- SEÇÃO VIZINHOS NO LOGRADOURO -->
      ${
        vizinhos.length > 0
          ? `
        <div class="card" style="margin-bottom: var(--space-4);">
          <div class="card-header">
            <h3 class="card-title" style="color: #A78BFA; display: flex; align-items: center; gap: 8px;">
              <i data-lucide="home" style="width: 18px; height: 18px;"></i>
              <span>Vizinhos Mapeados no Logradouro (${vizinhos.length})</span>
            </h3>
          </div>
          <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
            <table class="osint-table">
              <thead>
                <tr>
                  <th>Morador</th>
                  <th>CPF</th>
                  <th>Número</th>
                  <th>Logradouro</th>
                  <th style="text-align: right;">Ação</th>
                </tr>
              </thead>
              <tbody>
                ${vizinhos
                  .map((v) => {
                    const cleanCpf = String(v.cpf || "").replace(/\D/g, "");
                    return `
                    <tr>
                      <td style="font-weight: 700;">${this.escapeHtml(v.nome || v.morador || "N/I")}</td>
                      <td style="font-family: var(--font-mono); color: #6EE7B7;">${this.formatCpf(v.cpf)}</td>
                      <td>${this.escapeHtml(v.numero || "")}</td>
                      <td>${this.escapeHtml(v.logradouro || "")}</td>
                      <td style="text-align: right;">
                        ${
                          cleanCpf
                            ? `
                          <button type="button" class="btn btn-outline btn-sm btn-puxar-cpf" data-cpf="${cleanCpf}">
                            Puxar
                          </button>
                        `
                            : ""
                        }
                      </td>
                    </tr>
                  `;
                  })
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>
      `
          : ""
      }

      <!-- SEÇÃO PEGADA DIGITAL & E-COMMERCE -->
      ${
        dados.saraiva || dados.paycom || deliveryAddresses.length > 0
          ? `
        <div class="card" style="margin-bottom: var(--space-4);">
          <div class="card-header">
            <h3 class="card-title" style="color: #F59E0B; display: flex; align-items: center; gap: 8px;">
              <i data-lucide="shopping-bag" style="width: 18px; height: 18px;"></i>
              <span>Pegada Digital & Contas E-commerce</span>
            </h3>
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; padding-top: 8px;">
            ${
              dados.saraiva
                ? `
              <div style="background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                  <span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #F59E0B; font-weight: 700;">Saraiva</span>
                  <span style="font-size: 0.72rem; color: var(--color-text-dim);">ID: ${dados.saraiva.customer_id}</span>
                </div>
                <div style="font-size: 0.8rem; color: var(--color-text);">E-mail: <strong>${dados.saraiva.email || "N/I"}</strong></div>
                <div style="font-size: 0.8rem; color: var(--color-text-muted);">Telefone: ${dados.saraiva.phone || "N/I"}</div>
              </div>
            `
                : ""
            }
            ${
              dados.paycom
                ? `
              <div style="background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                  <span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #60A5FA; font-weight: 700;">Paycom Buyer</span>
                  <span style="font-size: 0.72rem; color: var(--color-text-dim);">ID: ${dados.paycom.buyer_id}</span>
                </div>
                <div style="font-size: 0.8rem; color: var(--color-text);">E-mail: <strong>${dados.paycom.email || "N/I"}</strong></div>
                <div style="font-size: 0.75rem; color: var(--color-text-muted);">Cadastro: ${dados.paycom.created_at || "N/I"}</div>
              </div>
            `
                : ""
            }
          </div>
        </div>
      `
          : ""
      }

      <!-- SEÇÃO VEÍCULOS VINCULADOS AO CPF (AUTOMOTORES) -->
      ${
        vehiclesList.length > 0
          ? `
        <div class="card" style="margin-bottom: var(--space-4); border-left: 4px solid #F59E0B;">
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <h3 class="card-title" style="color: #F59E0B; display: flex; align-items: center; gap: 8px;">
              <i data-lucide="car" style="width: 18px; height: 18px;"></i>
              <span>Veículos & Automotores Registrados (${vehiclesList.length})</span>
            </h3>
            <span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #FBBF24; font-size: 0.72rem; font-weight: 700;">
              Base RENAVAM / DENATRAN
            </span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px; padding-top: 10px;">
            ${vehiclesList
              .map((v) => {
                const placa = String(v.placa || v.PLACA || v.plate || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
                const placaFmt = placa.length === 7 ? `${placa.slice(0, 3)}-${placa.slice(3)}` : (placa || "SEM PLACA");
                const modelo = v.marcaModelo || v.marca || v.modelo || v.MARCA || v.MODELO || "Veículo Registrado";
                const chassi = v.chassi || v.CHASSI || "NÃO INFORMADO";
                const renavam = v.renavam || v.RENAVAM || "NÃO INFORMADO";
                const motor = v.motor || v.MOTOR || "N/I";
                const ano = v.ano || v.ano_fab || v.ano_modelo || v.ANO || "";
                const cor = v.cor || v.color || v.COR || "";
                const situacao = v.situacao || v.SITUACAO || "CIRCULAR";

                return `
                <div style="background: var(--color-surface-2); padding: 14px 16px; border-radius: var(--radius-md); border: 1px solid var(--color-border); display: flex; flex-direction: column; gap: 10px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                      <!-- Badge Placa Estilo Mercosul / Oficial -->
                      <div style="display: inline-flex; flex-direction: column; align-items: center; border: 2px solid #3B82F6; border-radius: 5px; background: #FFFFFF; color: #000000; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.4);">
                        <div style="background: #1D4ED8; color: #FFFFFF; width: 100%; font-size: 0.55rem; font-weight: 900; text-align: center; padding: 1px 10px; letter-spacing: 1px;">
                          BRASIL
                        </div>
                        <div style="font-family: var(--font-mono); font-weight: 900; font-size: 1.15rem; padding: 1px 10px; letter-spacing: 2px; color: #0F172A;">
                          ${placaFmt}
                        </div>
                      </div>

                      <div>
                        <h4 style="font-size: 1.05rem; font-weight: 800; color: #FFFFFF; margin: 0;">
                          ${this.escapeHtml(modelo)}
                        </h4>
                        <div style="font-size: 0.8rem; color: var(--color-text-muted); margin-top: 3px;">
                          ${ano ? `Ano: <strong style="color: var(--color-text);">${ano}</strong> &bull; ` : ""}
                          ${cor ? `Cor: <strong style="color: var(--color-text);">${cor}</strong> &bull; ` : ""}
                          Situação: <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10B981; font-size: 0.68rem; padding: 1px 6px;">${this.escapeHtml(situacao)}</span>
                        </div>
                      </div>
                    </div>

                    ${
                      placa
                        ? `
                      <button type="button" class="btn btn-primary btn-sm btn-puxar-placa" data-placa="${placa}" style="display: inline-flex; align-items: center; gap: 6px;">
                        <i data-lucide="search" style="width: 14px; height: 14px;"></i>
                        <span>Puxar Dossiê da Placa</span>
                      </button>
                    `
                        : ""
                    }
                  </div>

                  <!-- Grid de Detalhes Técnicos: Chassi, Renavam, Motor -->
                  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 8px; background: var(--color-surface); padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid rgba(255, 255, 255, 0.04); font-size: 0.8rem;">
                    <div>
                      <span style="color: var(--color-text-dim); font-size: 0.72rem; text-transform: uppercase;">Chassi:</span>
                      <div style="font-family: var(--font-mono); color: #38BDF8; font-weight: 700; display: flex; align-items: center; gap: 6px; margin-top: 2px;">
                        <span>${this.escapeHtml(chassi)}</span>
                        ${chassi && chassi !== "NÃO INFORMADO" ? `<button type="button" class="btn btn-ghost btn-sm btn-copiar-texto" data-copy="${chassi}" title="Copiar Chassi" style="padding: 1px 4px;"><i data-lucide="copy" style="width: 11px; height: 11px;"></i></button>` : ""}
                      </div>
                    </div>

                    <div>
                      <span style="color: var(--color-text-dim); font-size: 0.72rem; text-transform: uppercase;">RENAVAM:</span>
                      <div style="font-family: var(--font-mono); color: #6EE7B7; font-weight: 700; display: flex; align-items: center; gap: 6px; margin-top: 2px;">
                        <span>${this.escapeHtml(renavam)}</span>
                        ${renavam && renavam !== "NÃO INFORMADO" ? `<button type="button" class="btn btn-ghost btn-sm btn-copiar-texto" data-copy="${renavam}" title="Copiar Renavam" style="padding: 1px 4px;"><i data-lucide="copy" style="width: 11px; height: 11px;"></i></button>` : ""}
                      </div>
                    </div>

                    <div>
                      <span style="color: var(--color-text-dim); font-size: 0.72rem; text-transform: uppercase;">Nº do Motor:</span>
                      <div style="font-family: var(--font-mono); color: #F1F5F9; font-weight: 600; margin-top: 2px;">
                        ${this.escapeHtml(motor)}
                      </div>
                    </div>
                  </div>
                </div>
              `;
              })
              .join("")}
          </div>
        </div>
      `
          : ""
      }

      <!-- SEÇÃO HISTÓRICO VACINAL COVID-19 & POSTOS DE APLICAÇÃO (SUS) -->
      ${
        vacinasCovid.length > 0
          ? `
        <div class="card" style="margin-bottom: var(--space-4); border-left: 4px solid #EC4899;">
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <h3 class="card-title" style="color: #EC4899; display: flex; align-items: center; gap: 8px;">
              <i data-lucide="syringe" style="width: 18px; height: 18px;"></i>
              <span>Histórico Vacinal COVID-19 & Postos de Aplicação (${vacinasCovid.length} Doses Registradas)</span>
            </h3>
            <span class="badge" style="background: rgba(236, 72, 153, 0.15); color: #F472B6; font-size: 0.72rem; font-weight: 700;">
              Base ConecteSUS / MS
            </span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; padding-top: 10px;">
            ${vacinasCovid
              .map((vac, idx) => {
                const dose = vac.dose || vac.DESCRICAO_DA_VACINA || vac.DOSE || `Dose #${idx + 1}`;
                const vacNome = vac.vacina || vac.NOME_DA_VACINA || "COVID-19";
                const data = vac.dataAplicacao || vac.DATA_DE_APLICACAO || vac.DATA_APLICACAO || "Data N/I";
                const lote = vac.lote || vac.LOTE_DA_VACINA || vac.LOTE || "N/I";
                const local = vac.localCompleto || vac.estabelecimento || vac.NOME_DO_ESTABELECIMENTO || vac.ESTABELECIMENTO || "Posto Municipal de Saúde";
                const mun = vac.municipio || vac.MUNICIPIO || "";
                const uf = vac.uf || vac.UF || "";
                const aplicador = vac.aplicador || vac.APLICADOR_DE_VACINA || null;
                const grupo = vac.grupoAtendimento || vac.GRUPO_DE_ATENDIMENTO || null;

                const isPfizer = vacNome.toUpperCase().includes("PFIZER");
                const isAstra = vacNome.toUpperCase().includes("ASTRAZENECA");
                const isCoronavac = vacNome.toUpperCase().includes("CORONAVAC") || vacNome.toUpperCase().includes("BUTANTAN");
                const badgeColor = isPfizer ? "#8B5CF6" : isAstra ? "#3B82F6" : isCoronavac ? "#10B981" : "#EC4899";

                return `
                <div style="background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 14px; position: relative; overflow: hidden;">
                  <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: ${badgeColor};"></div>
                  
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 8px;">
                    <div>
                      <span class="badge" style="background: rgba(236, 72, 153, 0.15); color: #F472B6; font-weight: 700; font-size: 0.72rem; text-transform: uppercase;">
                        ${this.escapeHtml(dose)}
                      </span>
                      <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--color-text); margin: 6px 0 0 0;">
                        ${this.escapeHtml(vacNome)}
                      </h4>
                    </div>
                    <span style="font-family: var(--font-mono); font-size: 0.78rem; color: #10B981; background: rgba(16, 185, 129, 0.12); padding: 3px 8px; border-radius: 4px; white-space: nowrap; font-weight: 600;">
                      📅 ${data}
                    </span>
                  </div>

                  <!-- Local / Posto onde tomou a vacina -->
                  <div style="background: var(--color-surface); padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid rgba(255, 255, 255, 0.04); margin-top: 10px;">
                    <div style="display: flex; align-items: flex-start; gap: 6px;">
                      <i data-lucide="map-pin" style="width: 14px; height: 14px; color: #EC4899; flex-shrink: 0; margin-top: 2px;"></i>
                      <div>
                        <div style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; font-weight: 700;">
                          Local / Posto de Vacinação:
                        </div>
                        <div style="font-size: 0.825rem; font-weight: 700; color: #F1F5F9; margin-top: 2px;">
                          ${this.escapeHtml(local)}
                        </div>
                        ${
                          mun || uf
                            ? `<div style="font-size: 0.75rem; color: #94A3B8; margin-top: 2px;">Município: <strong style="color: #CBD5E1;">${mun}${uf ? `/${uf}` : ""}</strong></div>`
                            : ""
                        }
                      </div>
                    </div>
                  </div>

                  <!-- Detalhes do Lote e Aplicador -->
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; font-size: 0.75rem;">
                    <div>
                      <span style="color: var(--color-text-dim);">Lote da Vacina:</span>
                      <div style="font-family: var(--font-mono); font-weight: 700; color: #C4B5FD;">${this.escapeHtml(lote)}</div>
                    </div>
                    ${
                      aplicador
                        ? `
                      <div>
                        <span style="color: var(--color-text-dim);">Profissional / Aplicador:</span>
                        <div style="color: var(--color-text); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${this.escapeHtml(aplicador)}">
                          ${this.escapeHtml(aplicador)}
                        </div>
                      </div>
                    `
                        : ""
                    }
                  </div>

                  ${
                    grupo
                      ? `
                    <div style="margin-top: 8px; font-size: 0.72rem; color: var(--color-text-muted);">
                      Grupo de Atendimento: <span style="color: var(--color-text);">${this.escapeHtml(grupo)}</span>
                    </div>
                  `
                      : ""
                  }
                </div>
              `;
              })
              .join("")}
          </div>
        </div>
      `
          : ""
      }

      <!-- SEÇÃO DADOS BANCÁRIOS & CONTAS -->
      ${
        dadosBancarios.length > 0
          ? `
        <div class="card" style="margin-bottom: var(--space-4); border-left: 4px solid #3B82F6;">
          <div class="card-header">
            <h3 class="card-title" style="color: #60A5FA; display: flex; align-items: center; gap: 8px;">
              <i data-lucide="landmark" style="width: 18px; height: 18px;"></i>
              <span>Vínculos Bancários & Contas Cadastradas (${dadosBancarios.length})</span>
            </h3>
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; padding-top: 8px;">
            ${dadosBancarios
              .map((b) => {
                const bNome = b.banco || b.INSTITUICAO || b.BANCO || "Instituição Financeira";
                const bAg = b.agencia || b.AGENCIA || "Não informada";
                const bNum = b.numero || b.NUMERO || null;
                return `
                <div style="background: var(--color-surface-2); padding: 12px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                    <i data-lucide="building" style="width: 16px; height: 16px; color: #60A5FA;"></i>
                    <strong style="color: var(--color-text); font-size: 0.875rem;">${this.escapeHtml(bNome)}</strong>
                  </div>
                  <div style="font-size: 0.8rem; color: var(--color-text-muted);">
                    Agência: <span style="font-family: var(--font-mono); color: #6EE7B7; font-weight: 700;">${this.escapeHtml(bAg)}</span>
                    ${bNum ? ` &bull; Conta: <span style="font-family: var(--font-mono); color: var(--color-text); font-weight: 600;">${this.escapeHtml(bNum)}</span>` : ""}
                  </div>
                </div>
              `;
              })
              .join("")}
          </div>
        </div>
      `
          : ""
      }

      <!-- SEÇÃO HISTÓRICO TRABALHISTA & VÍNCULOS FUNCIONAIS (RAIS / INSS) -->
      ${
        vinculosRais.length > 0 || beneficiosInss.length > 0 || dados.pis
          ? `
        <div class="card" style="margin-bottom: var(--space-4); border-left: 4px solid #F59E0B;">
          <div class="card-header">
            <h3 class="card-title" style="color: #F59E0B; display: flex; align-items: center; gap: 8px;">
              <i data-lucide="briefcase" style="width: 18px; height: 18px;"></i>
              <span>Vínculos Empregatícios & Histórico Funcional (RAIS / INSS)</span>
            </h3>
          </div>
          <div style="display: flex; flex-direction: column; gap: 10px; padding-top: 8px;">
            ${
              dados.pis
                ? `
              <div style="background: var(--color-surface-2); padding: 8px 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border); display: flex; align-items: center; gap: 10px;">
                <span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #F59E0B; font-weight: 700;">PIS / PASEP</span>
                <span style="font-family: var(--font-mono); font-weight: 700; color: var(--color-text);">${this.escapeHtml(dados.pis)}</span>
              </div>
            `
                : ""
            }
            ${vinculosRais
              .map((r) => {
                const rNome = r.razaoSocial || r.RAZAO_SOCIAL || "Órgão / Empregador";
                const rCnpj = r.cnpj || r.CNPJ || "";
                const rSit = r.situacao || r.SITUACAO || "ENTREGUE";
                return `
                <div style="background: var(--color-surface-2); padding: 12px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                  <div>
                    <strong style="color: var(--color-text); font-size: 0.9rem;">${this.escapeHtml(rNome)}</strong>
                    <div style="font-size: 0.8rem; color: var(--color-text-muted); margin-top: 2px;">
                      ${rCnpj ? `CNPJ: <span style="font-family: var(--font-mono); color: #60A5FA;">${this.formatCnpj(rCnpj)}</span> &bull; ` : ""}
                      Situação RAIS: <span style="color: #10B981; font-weight: 600;">${this.escapeHtml(rSit)}</span>
                    </div>
                  </div>
                  <span class="badge badge-dark" style="font-size: 0.7rem;">RAIS Oficial</span>
                </div>
              `;
              })
              .join("")}
            ${beneficiosInss
              .map((i) => {
                const nb = i.nb || i.NB || "N/I";
                const ent = i.entidade || i.ENTIDADE || "SIAPE / INSS";
                return `
                <div style="background: var(--color-surface-2); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                  <div>
                    <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase;">Benefício Previdenciário / Vínculo Público:</span>
                    <div style="font-weight: 700; color: #A78BFA; font-size: 0.85rem; margin-top: 2px;">${this.escapeHtml(ent)}</div>
                  </div>
                  <div style="text-align: right;">
                    <span style="font-size: 0.7rem; color: var(--color-text-dim);">Nº do Benefício:</span>
                    <div style="font-family: var(--font-mono); font-weight: 700; color: #6EE7B7;">${this.escapeHtml(nb)}</div>
                  </div>
                </div>
              `;
              })
              .join("")}
          </div>
        </div>
      `
          : ""
      }

      <!-- SEÇÃO VAZAMENTOS IDENTIFICADOS -->
      ${
        vazamentos.length > 0
          ? `
        <div class="card" style="margin-bottom: var(--space-4); border-left: 4px solid #EF4444;">
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <h3 class="card-title" style="color: #EF4444; display: flex; align-items: center; gap: 8px;">
              <i data-lucide="shield-alert" style="width: 18px; height: 18px;"></i>
              <span>Vazamentos de Credenciais / Data Breaches (${vazamentos.length})</span>
            </h3>
            <span class="badge badge-red" style="font-size: 0.72rem; font-weight: 700;">
              Alerta de Segurança
            </span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px; padding-top: 8px;">
            ${vazamentos
              .map((vz) => {
                const titulo = vz.titulo || vz.fonte || "Vazamento Público";
                const alvo = vz.alvo || vz.email || vz.cpf || "";
                const senha = vz.senha || "";
                return `
                <div style="background: var(--color-surface-2); padding: 12px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                  <div>
                    <strong style="color: #EF4444; font-size: 0.9rem;">${this.escapeHtml(titulo)}</strong>
                    <div style="font-size: 0.8rem; color: var(--color-text-muted); margin-top: 2px;">
                      Alvo: <span style="font-family: var(--font-mono); color: var(--color-text);">${this.escapeHtml(alvo)}</span>
                      ${vz.data ? ` &bull; Data: ${vz.data}` : ""}
                    </div>
                  </div>
                  ${
                    senha
                      ? `
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span class="badge" style="background: rgba(239, 68, 68, 0.18); color: #FCA5A5; font-family: var(--font-mono); font-size: 0.85rem; font-weight: 700; border: 1px solid rgba(239, 68, 68, 0.35);">
                        🔑 Senha: ${this.escapeHtml(senha)}
                      </span>
                      <button type="button" class="btn btn-ghost btn-sm btn-copiar-texto" data-copy="${this.escapeHtml(senha)}" title="Copiar Senha">
                        <i data-lucide="copy" style="width: 13px; height: 13px;"></i>
                      </button>
                    </div>
                  `
                      : ""
                  }
                </div>
              `;
              })
              .join("")}
          </div>
        </div>
      `
          : ""
      }
    `;
  }

  // RENDER: OBJETO GENÉRICO
  renderGenericObject(dados, res) {
    return `
      <div class="card" style="margin-bottom: var(--space-4);">
        <div class="card-header">
          <h3 class="card-title" style="color: var(--color-primary); display: flex; align-items: center; gap: 8px;">
            <i data-lucide="database" style="width: 20px; height: 20px;"></i>
            <span>Resultado Estruturado</span>
          </h3>
        </div>
        <div class="table-responsive">
          <table class="osint-table">
            <tbody>
              ${Object.entries(dados)
                .filter(([_, v]) => typeof v !== "object" || v === null)
                .map(([key, value]) => `
                  <tr>
                    <td style="color: var(--color-text-muted); width: 35%; font-weight: 500;">
                      ${this.formatLabel(key)}:
                    </td>
                    <td style="font-weight: 600; color: var(--color-text); word-break: break-all;">
                      ${this.escapeHtml(String(value ?? "Não informado"))}
                    </td>
                    <td style="text-align: right; width: 50px;">
                      <button 
                        class="btn btn-ghost btn-sm btn-copiar-texto" 
                        data-copy="${this.escapeHtml(String(value ?? ""))}"
                        title="Copiar"
                      >
                        <i data-lucide="copy" style="width: 14px; height: 14px;"></i>
                      </button>
                    </td>
                  </tr>
                `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // 5. EVENTOS DINÂMICOS DOS RESULTADOS
  setupResultEvents(container) {
    // 5.1 Copiar CPF
    container.querySelectorAll(".btn-copiar-cpf").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cpf = btn.getAttribute("data-cpf");
        if (cpf && window.copyToClipboard) {
          window.copyToClipboard(cpf, btn, `CPF ${this.formatCpf(cpf)} copiado!`);
        }
      });
    });

    // 5.2 Copiar Texto Genérico
    container.querySelectorAll(".btn-copiar-texto, .btn-copiar-generico").forEach((btn) => {
      btn.addEventListener("click", () => {
        const text = btn.getAttribute("data-copy");
        if (text && window.copyToClipboard) {
          window.copyToClipboard(text, btn, "Copiado para a área de transferência!");
        }
      });
    });

    // 5.3 Ação Rápida: Puxar CPF da lista / parente / sócio
    container.querySelectorAll(".btn-puxar-cpf, .btn-puxar-cpf-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cpf = btn.getAttribute("data-cpf");
        if (cpf) {
          this.selectTab("cpf");
          const input = document.getElementById("consultaInput");
          const form = document.getElementById("consultaForm");
          if (input) {
            input.value = cpf;
            input.dispatchEvent(new Event("input"));
            form?.scrollIntoView({ behavior: "smooth", block: "center" });
            if (form) form.dispatchEvent(new Event("submit"));
          }
        }
      });
    });

    // 5.4 Ação Rápida: Puxar Biometria Facial
    container.querySelectorAll(".btn-puxar-foto").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cpf = btn.getAttribute("data-cpf");
        if (cpf) {
          this.selectTab("foto");
          const input = document.getElementById("consultaInput");
          const form = document.getElementById("consultaForm");
          if (input) {
            input.value = cpf;
            input.dispatchEvent(new Event("input"));
            form?.scrollIntoView({ behavior: "smooth", block: "center" });
            if (form) form.dispatchEvent(new Event("submit"));
          }
        }
      });
    });

    // 5.5 Ação Rápida: Mapear Vizinhos
    container.querySelectorAll(".btn-puxar-vizinhos").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cpf = btn.getAttribute("data-cpf");
        if (cpf) {
          this.selectTab("vizinhos");
          const input = document.getElementById("consultaInput");
          const form = document.getElementById("consultaForm");
          if (input) {
            input.value = cpf;
            input.dispatchEvent(new Event("input"));
            form?.scrollIntoView({ behavior: "smooth", block: "center" });
            if (form) form.dispatchEvent(new Event("submit"));
          }
        }
      });
    });

    // 5.6 Ação Rápida: Checar Operadora
    container.querySelectorAll(".btn-puxar-operadora").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tel = btn.getAttribute("data-tel") || btn.getAttribute("data-telefone");
        if (tel) {
          this.selectTab("operadora");
          const input = document.getElementById("consultaInput");
          const form = document.getElementById("consultaForm");
          if (input) {
            input.value = tel;
            input.dispatchEvent(new Event("input"));
            form?.scrollIntoView({ behavior: "smooth", block: "center" });
            if (form) form.dispatchEvent(new Event("submit"));
          }
        }
      });
    });

    // 5.7 Ação Rápida: Consultar Placa de Veículo
    container.querySelectorAll(".btn-puxar-placa").forEach((btn) => {
      btn.addEventListener("click", () => {
        const placa = btn.getAttribute("data-placa");
        if (placa) {
          this.selectTab("placa");
          const input = document.getElementById("consultaInput");
          const form = document.getElementById("consultaForm");
          if (input) {
            input.value = placa;
            input.dispatchEvent(new Event("input"));
            form?.scrollIntoView({ behavior: "smooth", block: "center" });
            if (form) form.dispatchEvent(new Event("submit"));
          }
        }
      });
    });

    // 5.7.1 Ação Rápida: Investigar Nome de Parente / Associado
    container.querySelectorAll(".btn-puxar-nome-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const nome = btn.getAttribute("data-nome");
        if (nome) {
          this.selectTab("nome");
          const input = document.getElementById("consultaInput");
          const form = document.getElementById("consultaForm");
          if (input) {
            input.value = nome;
            input.dispatchEvent(new Event("input"));
            form?.scrollIntoView({ behavior: "smooth", block: "center" });
            if (form) form.dispatchEvent(new Event("submit"));
          }
        }
      });
    });

    // 5.7.2 Filtro por Categoria na Grade de Parentes
    container.querySelectorAll(".btn-filter-relatives").forEach((btn) => {
      btn.addEventListener("click", () => {
        container.querySelectorAll(".btn-filter-relatives").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const category = btn.getAttribute("data-category");
        const cards = container.querySelectorAll(".relative-card");
        cards.forEach((card) => {
          if (category === "all" || card.getAttribute("data-category") === category) {
            card.style.display = "";
          } else {
            card.style.display = "none";
          }
        });
      });
    });

    // 5.7.3 Busca ao Vivo na Grade de Parentes
    const filterRelInput = container.querySelector("#filterRelativesInput");
    if (filterRelInput) {
      filterRelInput.addEventListener("input", (e) => {
        const q = e.target.value.toLowerCase().trim();
        const cards = container.querySelectorAll(".relative-card");
        cards.forEach((card) => {
          const search = card.getAttribute("data-search") || "";
          card.style.display = search.includes(q) ? "" : "none";
        });
      });
    }

    // 5.8 Filtro de Busca na Tabela de Resultados
    const filtroInput = document.getElementById("inputFiltroResultados");
    if (filtroInput) {
      filtroInput.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase().trim();
        const rows = container.querySelectorAll(".linha-resultado-item");
        rows.forEach((row) => {
          const searchData = row.getAttribute("data-search") || "";
          row.style.display = searchData.includes(query) ? "" : "none";
        });
      });
    }

    // 5.9 Filtro em tempo real de Titulares por Telefone (Nome ou Dígitos do CPF como 886, 1433)
    const inputFiltroTel = container.querySelector("#inputFiltroPessoasTelefone");
    const pillsFiltro = container.querySelectorAll(".btn-filtro-pill");
    const contadorPessoas = container.querySelector("#contadorPessoasVisiveis");
    const emptyStateTel = container.querySelector("#emptyStateFiltroTelefone");
    const btnLimparFiltros = container.querySelector("#btnLimparFiltrosTelefone");
    const cardsPessoas = container.querySelectorAll(".card-item-pessoa-telefone");

    const aplicarFiltrosTelefone = () => {
      const query = (inputFiltroTel?.value || "").toLowerCase().trim();
      const activePill = container.querySelector(".btn-filtro-pill.active");
      const filterType = activePill ? activePill.getAttribute("data-filter") : "todos";

      let visiveis = 0;
      cardsPessoas.forEach((card) => {
        const searchData = (card.getAttribute("data-search") || "").toLowerCase();
        const status = card.getAttribute("data-status");
        const hasVeiculos = card.getAttribute("data-has-veiculos") === "true";
        const hasEmpresas = card.getAttribute("data-has-empresas") === "true";
        const hasEmails = card.getAttribute("data-has-emails") === "true";

        const matchQuery = !query || searchData.includes(query);

        let matchPill = true;
        if (filterType === "regular") matchPill = status === "regular";
        else if (filterType === "falecido") matchPill = status === "falecido";
        else if (filterType === "veiculos") matchPill = hasVeiculos;
        else if (filterType === "empresas") matchPill = hasEmpresas;
        else if (filterType === "emails") matchPill = hasEmails;

        if (matchQuery && matchPill) {
          card.style.display = "";
          visiveis++;
        } else {
          card.style.display = "none";
        }
      });

      if (contadorPessoas) contadorPessoas.textContent = String(visiveis);
      if (emptyStateTel) emptyStateTel.style.display = visiveis === 0 ? "block" : "none";
    };

    if (inputFiltroTel) {
      inputFiltroTel.addEventListener("input", aplicarFiltrosTelefone);
    }

    pillsFiltro.forEach((pill) => {
      pill.addEventListener("click", () => {
        pillsFiltro.forEach((p) => p.classList.remove("active"));
        pill.classList.add("active");
        aplicarFiltrosTelefone();
      });
    });

    if (btnLimparFiltros) {
      btnLimparFiltros.addEventListener("click", () => {
        if (inputFiltroTel) inputFiltroTel.value = "";
        pillsFiltro.forEach((p) => {
          if (p.getAttribute("data-filter") === "todos") p.classList.add("active");
          else p.classList.remove("active");
        });
        aplicarFiltrosTelefone();
      });
    }

    // 5.10 Copiar todos os CPFs da lista
    container.querySelectorAll(".btn-copiar-todos-cpfs").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cpfs = [];
        cardsPessoas.forEach((card) => {
          if (card.style.display !== "none") {
            const copyBtn = card.querySelector(".btn-copiar-cpf");
            const cpf = copyBtn ? copyBtn.getAttribute("data-cpf") : null;
            if (cpf) cpfs.push(cpf);
          }
        });
        if (cpfs.length > 0) {
          const lista = cpfs.join("\n");
          if (window.copyToClipboard) {
            window.copyToClipboard(lista, btn, `${cpfs.length} CPFs copiados para a área de transferência!`);
          } else {
            navigator.clipboard?.writeText(lista);
            window.toast?.success(`${cpfs.length} CPFs copiados para a área de transferência!`);
          }
        } else {
          window.toast?.info("Nenhum CPF visível para copiar.");
        }
      });
    });

    // 5.11 Puxar CPF do item da lista
    container.querySelectorAll(".btn-puxar-cpf-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cpf = btn.getAttribute("data-cpf");
        if (cpf) {
          this.selectTab("cpf");
          const input = document.getElementById("consultaInput");
          const form = document.getElementById("consultaForm");
          if (input) {
            input.value = this.formatCpf(cpf);
            input.dispatchEvent(new Event("input"));
            form?.scrollIntoView({ behavior: "smooth", block: "center" });
            if (form) form.dispatchEvent(new Event("submit"));
          }
        }
      });
    });

    // 5.12 Relatório Individual do Titular
    container.querySelectorAll(".btn-relatorio-individual").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.getAttribute("data-idx"));
        this.abrirRelatorioDark(idx);
      });
    });

    // 5.13 Relatório Geral do Módulo
    container.querySelectorAll(".btn-gerar-relatorio-geral").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.abrirRelatorioDark();
      });
    });

    // 5.14 Filtros e Busca no Módulo de E-mail
    const inputFiltroEmail = container.querySelector("#filterEmailPersonsInput");
    const pillsFiltroEmail = container.querySelectorAll(".btn-filter-email");
    const cardsEmail = container.querySelectorAll(".card-email-person");

    const aplicarFiltrosEmail = () => {
      const query = (inputFiltroEmail?.value || "").toLowerCase().trim();
      const activePill = container.querySelector(".btn-filter-email.active");
      const filterType = activePill ? activePill.getAttribute("data-filter") : "all";

      cardsEmail.forEach((card) => {
        const searchData = (card.getAttribute("data-search") || "").toLowerCase();
        const status = card.getAttribute("data-status");
        const hasVeiculos = card.getAttribute("data-has-veiculos") === "true";
        const hasCnh = card.getAttribute("data-has-cnh") === "true";

        const matchQuery = !query || searchData.includes(query);

        let matchPill = true;
        if (filterType === "regular") matchPill = status === "regular";
        else if (filterType === "veiculos") matchPill = hasVeiculos;
        else if (filterType === "cnh") matchPill = hasCnh;

        card.style.display = matchQuery && matchPill ? "" : "none";
      });
    };

    if (inputFiltroEmail) {
      inputFiltroEmail.addEventListener("input", aplicarFiltrosEmail);
    }

    pillsFiltroEmail.forEach((pill) => {
      pill.addEventListener("click", () => {
        pillsFiltroEmail.forEach((p) => p.classList.remove("active"));
        pill.classList.add("active");
        aplicarFiltrosEmail();
      });
    });

    // Botão de Relatório no Card de E-mail
    const btnRelatorioEmail = container.querySelector("#btnGerarRelatorioEmailDossie");
    if (btnRelatorioEmail) {
      btnRelatorioEmail.addEventListener("click", () => {
        this.abrirRelatorioDark();
      });
    }

    // Ações Rápidas adicionais de Placa, Telefone e CNPJ nos cartões
    container.querySelectorAll(".btn-puxar-placa-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const placa = btn.getAttribute("data-placa");
        if (placa) {
          this.selectTab("placa");
          const input = document.getElementById("consultaInput");
          const form = document.getElementById("consultaForm");
          if (input) {
            input.value = placa;
            input.dispatchEvent(new Event("input"));
            form?.scrollIntoView({ behavior: "smooth", block: "center" });
            if (form) form.dispatchEvent(new Event("submit"));
          }
        }
      });
    });

    container.querySelectorAll(".btn-puxar-tel-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tel = btn.getAttribute("data-telefone");
        if (tel) {
          this.selectTab("telefone");
          const input = document.getElementById("consultaInput");
          const form = document.getElementById("consultaForm");
          if (input) {
            input.value = this.formatTelefone(tel);
            input.dispatchEvent(new Event("input"));
            form?.scrollIntoView({ behavior: "smooth", block: "center" });
            if (form) form.dispatchEvent(new Event("submit"));
          }
        }
      });
    });

      // Ações Rápidas adicionais de Placa, Telefone e CNPJ nos cartões
    container.querySelectorAll(".btn-puxar-cnpj-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cnpj = btn.getAttribute("data-cnpj");
        if (cnpj) {
          this.selectTab("cnpj");
          const input = document.getElementById("consultaInput");
          const form = document.getElementById("consultaForm");
          if (input) {
            input.value = this.formatCnpj(cnpj);
            input.dispatchEvent(new Event("input"));
            form?.scrollIntoView({ behavior: "smooth", block: "center" });
            if (form) form.dispatchEvent(new Event("submit"));
          }
        }
      });
    });
  }

  extrairMetadadosCompliance(res, dados) {
    const tipoLower = String(res?.tipo || this.currentTipo || "").toLowerCase().trim();
    if (!["cpf", "cnpj", "nome", "titulo"].includes(tipoLower)) return null;

    let d = dados;
    if (Array.isArray(d)) d = d[0] || {};
    else if (Array.isArray(d?.resultados)) d = d.resultados[0] || {};
    else if (Array.isArray(d?.resultado)) d = d.resultado[0] || {};
    else if (Array.isArray(d?.pessoas)) d = d.pessoas[0] || {};
    d = d && typeof d === "object" ? d : {};

    const basic = d.DadosBasicos || d.dadosBasicos || d.dados_basicos || d;
    const nome =
      basic.razaoSocial ||
      basic.razao_social ||
      basic.nome ||
      basic.name ||
      basic.nomeCompleto ||
      (tipoLower === "nome" ? res.termo : "") ||
      "";

    const end0 =
      (Array.isArray(d.Enderecos) && d.Enderecos[0]) ||
      (Array.isArray(d.enderecos) && d.enderecos[0]) ||
      d.endereco ||
      {};
    const uf =
      d.uf ||
      basic.uf ||
      end0.uf ||
      end0.estado ||
      "";
    const municipio =
      d.municipio ||
      basic.municipio ||
      end0.cidade ||
      end0.municipio ||
      "";

    const docRaw = String(basic.cnpj_limpo || basic.cnpj || basic.cpf || (["cpf", "cnpj"].includes(tipoLower) ? res.termo : "")).replace(/\D/g, "");
    const tipoEfetivo =
      docRaw.length === 14 ? "cnpj" : docRaw.length === 11 ? "cpf" : tipoLower;

    return {
      tipo: tipoEfetivo,
      termo: docRaw || res.termo || nome,
      nome: String(nome || "").trim(),
      uf: String(uf || "").trim().toUpperCase().slice(0, 2),
      municipio: String(municipio || "").trim(),
    };
  }

  async dispararComplianceEnriquecimento(res, dados, ufOverride = null) {
    const box = document.getElementById("consultaComplianceContainer");
    if (!box) return;

    const meta = this.extrairMetadadosCompliance(res, dados);
    if (!meta) {
      this.currentComplianceData = null;
      box.style.display = "none";
      box.innerHTML = "";
      return;
    }

    if (ufOverride) {
      meta.uf = String(ufOverride).trim().toUpperCase().slice(0, 2);
    }

    this.currentComplianceData = null;
    box.style.display = "block";
    box.innerHTML = `
      <div class="card" style="border-left: 4px solid #38BDF8; padding: var(--space-4);">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 20px; height: 20px; border-radius: 50%; border: 2px solid #38BDF8; border-top-color: transparent; animation: spin 0.8s linear infinite;"></div>
          <div>
            <strong style="color: var(--color-text); font-size: 0.9rem;">Consultando Bases Públicas de Compliance (CGU, TSE, PNCP &amp; Diários Oficiais)...</strong>
            <div style="font-size: 0.78rem; color: var(--color-text-muted);">Cruzamento não-bloqueante de sanções administrativas e transparência governamental.</div>
          </div>
        </div>
      </div>
    `;

    try {
      const resp = await window.api.post("/api/compliance/consultar", meta, { timeout: 20000 });
      if (resp?.success && resp.data) {
        this.currentComplianceData = resp.data;
        if (this.currentData) this.currentData.compliance = resp.data;
        this.renderComplianceCard(resp.data, res, dados);
      } else {
        box.style.display = "none";
      }
    } catch {
      box.innerHTML = `
        <div class="card" style="border-left: 4px solid #64748B; padding: var(--space-4); font-size: 0.82rem; color: var(--color-text-muted);">
          Fontes externas de compliance governamental não responderam no momento.
        </div>
      `;
    }
  }

  renderComplianceCard(comp, resOriginal, dadosOriginal) {
    const box = document.getElementById("consultaComplianceContainer");
    if (!box || !comp) return;

    const esc = (s) => this.escapeHtml(s);
    const resumo = comp.resumo || {};
    const cgu = comp.cgu || {};
    const tse = comp.tse || {};
    const diarios = comp.diarios || {};
    const pncp = comp.pncp || {};

    const sancoes = [
      ...(Array.isArray(cgu.ceis) ? cgu.ceis : []),
      ...(Array.isArray(cgu.cnep) ? cgu.cnep : []),
      ...(Array.isArray(cgu.cepim) ? cgu.cepim : []),
    ];
    const peps = Array.isArray(cgu.peps) ? cgu.peps : [];
    const candidaturas = Array.isArray(tse.candidaturas) ? tse.candidaturas : [];
    const ocorrencias = Array.isArray(diarios.ocorrencias) ? diarios.ocorrencias : [];
    const contratos = Array.isArray(pncp.resultados) ? pncp.resultados : [];

    const hasCrit = sancoes.length > 0;
    const borderCol = hasCrit ? "#EF4444" : (peps.length > 0 || candidaturas.length > 0) ? "#F59E0B" : "#10B981";
    const statusBadgeClass = hasCrit ? "badge-red" : "badge-purple";

    const ufs = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

    box.innerHTML = `
      <div class="card" style="border-left: 4px solid ${borderCol};">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div class="card-title" style="display: flex; align-items: center; gap: 8px;">
            <i data-lucide="shield-check" style="color: ${borderCol}; width: 20px; height: 20px;"></i>
            <span>Compliance Público, Sanções (CGU / TSE) &amp; Transparência BR</span>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
            <span class="badge ${statusBadgeClass}">${esc(resumo.classificacaoRisco || "VERIFICADO")}</span>
            ${(cgu.linksOficiais || []).map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm" style="font-size: 0.72rem;">Portal CGU ↗</a>`).join("")}
          </div>
        </div>

        <div class="card-body" style="display: flex; flex-direction: column; gap: var(--space-4);">
          <div style="background: var(--color-surface-2); padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--color-border); font-size: 0.85rem; color: var(--color-text);">
            ${esc(resumo.resumoTexto || "Consulta pública executada.")}
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); gap: var(--space-4);">
            <!-- Bloco CGU -->
            <div style="background: var(--color-surface-2); padding: var(--space-4); border-radius: var(--radius-md); border: 1px solid var(--color-border);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <strong style="font-size: 0.85rem; color: #F87171;">CGU — CEIS / CNEP / CEPIM / PEP</strong>
                <span class="badge badge-dark" style="font-size: 0.68rem;">${sancoes.length} sanções • ${peps.length} PEP</span>
              </div>
              ${
                sancoes.length > 0
                  ? sancoes.map((s) => `
                    <div style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.25); border-radius: 6px; padding: 8px 10px; margin-bottom: 6px; font-size: 0.78rem;">
                      <strong style="color: #FCA5A5;">[${esc(s.cadastro)}] ${esc(s.tipoSancao)}</strong>
                      <div style="color: var(--color-text-muted); margin-top: 2px;">Órgão: ${esc(s.orgaoSancionador)} • Fim: ${esc(s.dataFim)}</div>
                      ${s.processo ? `<div style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--color-text-dim);">Proc: ${esc(s.processo)}</div>` : ""}
                    </div>
                  `).join("")
                  : `<div style="font-size: 0.78rem; color: var(--color-text-muted);">${esc(cgu.mensagem || "Nenhuma sanção nos cadastros impeditivos da CGU.")}</div>`
              }
              ${
                peps.length > 0
                  ? `<div style="margin-top: 8px; padding: 8px 10px; background: rgba(245,158,11,0.08); border-radius: 6px; font-size: 0.78rem;">
                      <strong style="color: #FBBF24;">PEP Identificado:</strong> ${peps.map((p) => `${esc(p.funcao)} (${esc(p.orgao)})`).join(" | ")}
                     </div>`
                  : ""
              }
            </div>

            <!-- Bloco TSE -->
            <div style="background: var(--color-surface-2); padding: var(--space-4); border-radius: var(--radius-md); border: 1px solid var(--color-border);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 6px; flex-wrap: wrap;">
                <strong style="font-size: 0.85rem; color: #38BDF8;">TSE — DivulgaCandContas</strong>
                <span class="badge badge-dark" style="font-size: 0.68rem;">${candidaturas.length} registro(s)</span>
              </div>
              ${
                candidaturas.length > 0
                  ? candidaturas.slice(0, 6).map((c) => `
                    <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 6px; padding: 8px 10px; margin-bottom: 6px; font-size: 0.78rem;">
                      <div style="display: flex; justify-content: space-between; gap: 6px;">
                        <strong style="color: #38BDF8;">${esc(String(c.ano))} • ${esc(c.cargo)} (${esc(c.partido)})</strong>
                        <span style="font-size: 0.7rem; color: #34D399;">${esc(c.situacao)}</span>
                      </div>
                      <div style="color: var(--color-text-muted); font-size: 0.74rem; margin-top: 2px;">
                        ${esc(c.nomeUrna || c.nomeCompleto)} • ${esc(c.abrangencia || c.uf)}
                        ${c.linkOficial ? ` &bull; <a href="${esc(c.linkOficial)}" target="_blank" rel="noopener noreferrer" style="color: #A78BFA;">Ficha TSE ↗</a>` : ""}
                      </div>
                    </div>
                  `).join("")
                  : `<div style="font-size: 0.78rem; color: var(--color-text-muted);">${esc(tse.mensagem || "Nenhuma candidatura localizada nas eleições 2022/2024.")}</div>`
              }
              ${
                tse.status === "uf_nao_informada"
                  ? `<div style="display: flex; gap: 6px; margin-top: 8px; align-items: center;">
                      <select id="selectTseUfFallback" class="btn btn-secondary btn-sm" style="padding: 4px 8px; font-size: 0.74rem;">
                        <option value="">Selecionar UF para TSE...</option>
                        ${ufs.map((u) => `<option value="${u}">${u}</option>`).join("")}
                      </select>
                      <button type="button" id="btnReconsultarTseUf" class="btn btn-primary btn-sm" style="font-size: 0.74rem;">Cruzar TSE</button>
                     </div>`
                  : ""
              }
            </div>

            <!-- Bloco PNCP & Querido Diário -->
            <div style="background: var(--color-surface-2); padding: var(--space-4); border-radius: var(--radius-md); border: 1px solid var(--color-border);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <strong style="font-size: 0.85rem; color: #A78BFA;">PNCP &amp; Diários Oficiais</strong>
                <span class="badge badge-dark" style="font-size: 0.68rem;">${contratos.length} PNCP • ${ocorrencias.length} Diários</span>
              </div>
              ${
                contratos.length > 0
                  ? contratos.slice(0, 3).map((ct) => `
                    <div style="border-bottom: 1px solid var(--color-border); padding-bottom: 6px; margin-bottom: 6px; font-size: 0.76rem;">
                      <a href="${esc(ct.url)}" target="_blank" rel="noopener noreferrer" style="color: #34D399; font-weight: 600;">${esc(ct.titulo)} ↗</a>
                      <div style="color: var(--color-text-muted);">${esc(ct.orgao)}</div>
                    </div>
                  `).join("")
                  : ""
              }
              ${
                ocorrencias.length > 0
                  ? ocorrencias.slice(0, 3).map((o) => `
                    <div style="border-bottom: 1px solid var(--color-border); padding-bottom: 6px; margin-bottom: 6px; font-size: 0.76rem;">
                      <strong style="color: #C4B5FD;">${esc(o.municipio)}/${esc(o.uf)} (${esc(o.dataPublicacao || "N/I")})</strong>
                      <div style="color: var(--color-text-muted);">${esc(o.trecho || "")}</div>
                      ${o.urlArquivo ? `<a href="${esc(o.urlArquivo)}" target="_blank" rel="noopener noreferrer" style="color: #38BDF8; font-size: 0.72rem;">Abrir Edição ↗</a>` : ""}
                    </div>
                  `).join("")
                  : ""
              }
              ${
                contratos.length === 0 && ocorrencias.length === 0
                  ? `<div style="font-size: 0.78rem; color: var(--color-text-muted);">Sem contratos PNCP ou menções recentes no Querido Diário para este identificador.</div>`
                  : ""
              }
            </div>
          </div>
        </div>
      </div>
    `;

    const btnTseUf = box.querySelector("#btnReconsultarTseUf");
    if (btnTseUf) {
      btnTseUf.addEventListener("click", () => {
        const ufSel = box.querySelector("#selectTseUfFallback")?.value;
        if (ufSel) this.dispararComplianceEnriquecimento(resOriginal, dadosOriginal, ufSel);
      });
    }

    if (window.lucide) {
      window.lucide.createIcons({ root: box });
    }
  }

  // 6. BOTÕES DE CONTROLE
  bindCopyButtons() {
    const copyJsonBtn = document.getElementById("btnCopyConsultaJson");
    if (copyJsonBtn) {
      copyJsonBtn.addEventListener("click", (e) => {
        if (!this.currentData) return;
        window.copyToClipboard(JSON.stringify(this.currentData, null, 2), e.currentTarget);
      });
    }

    const resetBtn = document.getElementById("btnNovaConsulta");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        this.currentData = null;
        this.currentComplianceData = null;
        const compBox = document.getElementById("consultaComplianceContainer");
        if (compBox) {
          compBox.style.display = "none";
          compBox.innerHTML = "";
        }
        const input = document.getElementById("consultaInput");
        if (input) {
          input.value = "";
          input.focus();
        }
        this.showState("initial");
      });
    }
  }

  // 6.0 ABRIR GRAFO INTERATIVO DE VÍNCULOS & LINK ANALYSIS
  abrirGrafoConsulta(customData = null) {
    let dataToUse = customData || this.currentData;
    if (!dataToUse) {
      const rawJsonEl = document.getElementById("resRawJson");
      if (rawJsonEl && rawJsonEl.textContent) {
        try {
          dataToUse = JSON.parse(rawJsonEl.textContent);
        } catch {}
      }
    }

    if (!dataToUse) {
      window.toast?.error("Nenhum dado disponível para abrir o Grafo de Vínculos.");
      return;
    }

    if (!window.OsintGraph) {
      window.toast?.error("Motor de Grafo de Vínculos não carregado.");
      return;
    }

    const payload = dataToUse.dados !== undefined ? dataToUse.dados : (dataToUse.data !== undefined ? dataToUse.data : dataToUse);
    const tipo = dataToUse.tipo || this.currentTipo || "consulta";
    const termo = dataToUse.termo || document.getElementById("consultaInput")?.value?.trim() || "Alvo";

    window.OsintGraph.open(payload, {
      moduloId: tipo,
      moduloNome: `MÓDULO ${tipo.toUpperCase()}`,
      termo: termo,
    });
  }

  // 6.1 GESTÃO DO MODAL DE RELATÓRIO / DOSSIÊ DARK OSINT
  bindReportModal() {
    const modal = document.getElementById("modalRelatorioOsint");
    const btnTop = document.getElementById("btnGerarRelatorioTop");
    const btnGrafoTop = document.getElementById("btnAbrirGrafoConsulta");
    const btnGrafoModal = document.getElementById("btnGrafoModalRelatorioConsulta");
    const btnClose = document.getElementById("btnFecharModalRelatorio");
    const btnPdf = document.getElementById("btnGerarPdfRelatorio") || document.getElementById("btnPrintRelatorioDark");
    const btnDownload = document.getElementById("btnDownloadHtmlRelatorio");

    if (btnGrafoTop) {
      btnGrafoTop.addEventListener("click", () => {
        this.abrirGrafoConsulta();
      });
    }

    if (btnGrafoModal) {
      btnGrafoModal.addEventListener("click", () => {
        if (modal) modal.style.display = "none";
        this.abrirGrafoConsulta();
      });
    }

    if (btnTop) {
      btnTop.addEventListener("click", () => {
        this.abrirRelatorioDark();
      });
    }

    if (btnClose && modal) {
      btnClose.addEventListener("click", () => {
        modal.style.display = "none";
      });
    }

    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          modal.style.display = "none";
        }
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal && modal.style.display === "flex") {
        modal.style.display = "none";
      }
    });

    if (btnPdf) {
      btnPdf.addEventListener("click", () => {
        this.exportarRelatorioPdf();
      });
    }

    if (btnDownload) {
      btnDownload.addEventListener("click", () => {
        const contentEl = document.getElementById("modalRelatorioContent");
        if (!contentEl) return;
        const targetTerm =
          this.currentData?.dados?.cpf ||
          this.currentData?.cpf ||
          this.currentData?.termo ||
          this.currentData?.dados?.placa ||
          this.currentData?.placa ||
          this.currentData?.dados?.cnpj ||
          this.currentData?.cnpj ||
          "alvo";
        const termoClean = String(targetTerm).replace(/\D/g, "") || String(targetTerm).trim().replace(/[^a-zA-Z0-9_-]/g, "_");
        const filename = `${termoClean}_relatorio_rimubuscas.html`;
        this.downloadRelatorioHtml(filename, contentEl.innerHTML);
      });
    }
  }

  // 6.2 ABRIR RELATÓRIO DARK (GERAL OU INDIVIDUAL)
  abrirRelatorioDark(personIndex = null) {
    if (!this.currentData) {
      window.toast?.error("Nenhum dado disponível para gerar relatório.");
      return;
    }

    const modal = document.getElementById("modalRelatorioOsint");
    const container = document.getElementById("modalRelatorioContent");
    if (!modal || !container) return;

    const reportHtml = this.gerarHtmlRelatorioDark(
      this.currentData.tipo || this.currentTipo,
      this.currentData.termo || "",
      this.currentData,
      personIndex
    );

    container.innerHTML = reportHtml;
    modal.style.display = "flex";

    if (window.lucide) {
      window.lucide.createIcons({ root: container });
    }
  }

  // 6.3 EXTRAÇÃO RESILIENTE DE PESSOAS DO PAYLOAD
  extractPersons(fullResponse) {
    const payload = fullResponse?.dados !== undefined ? fullResponse.dados : (fullResponse?.data !== undefined ? fullResponse.data : fullResponse);

    if (window.RimuInterpreters && typeof window.RimuInterpreters.extractPersonsList === "function") {
      try {
        const res = window.RimuInterpreters.extractPersonsList(payload, fullResponse);
        if (Array.isArray(res) && res.length > 0) return res;
      } catch (e) {
        console.warn("[EXTRACT PERSONS INTERPRETER ERROR]:", e);
      }
    }

    if (Array.isArray(payload?.pessoas)) return payload.pessoas;
    if (Array.isArray(payload?.pessoas_vinculadas)) return payload.pessoas_vinculadas;
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      const numericKeys = Object.keys(payload).filter((k) => /^\d+$/.test(k));
      if (numericKeys.length > 0) {
        numericKeys.sort((a, b) => Number(a) - Number(b));
        const list = numericKeys.map((k) => payload[k]).filter(Boolean);
        if (list.some((p) => p && typeof p === "object" && (p.cpf || p.name || p.nome))) {
          return list;
        }
      }
      const vals = Object.values(payload).filter((v) => v && typeof v === "object" && (v.cpf || v.name || v.nome));
      if (vals.length > 0) return vals;
    }

    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.resultado)) return payload.resultado;
    if (Array.isArray(payload?.resultados)) return payload.resultados;
    if (Array.isArray(payload?.data)) return payload.data;
    if (payload && typeof payload === "object" && (payload.name || payload.nome || payload.cpf)) {
      return [payload];
    }
    return [];
  }

  // 6.3.1 CONSTRUÇÃO DE RELATÓRIO DARK ESPECÍFICO PARA VEÍCULOS & FROTAS
  gerarHtmlRelatorioDarkVeiculo(termo, fullResponse, dataPayload) {
    const data = dataPayload || {};
    const protocolo = `OSINT-VEC-${Date.now().toString(36).toUpperCase()}`;
    const dataEmissao = new Date().toLocaleString("pt-BR");
    const fonte = fullResponse?.fonte || "RimuAPI Intelligence Engine (Live)";

    const plate = String(data.plate || data.placa || termo || "PLACA").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const plateMercosul =
      data.plateMercosul ||
      data.placa_nova ||
      data.plate_mercosul ||
      (plate.length === 7 && /[A-Z]{3}[0-9][A-Z][0-9]{2}/.test(plate) ? plate : null);
    const plateOld =
      data.plateOld ||
      data.placa_antiga ||
      data.old_plate ||
      (plate.length === 7 && /[A-Z]{3}[0-9]{4}/.test(plate) ? plate : null);

    const brand = data.brand || data.marca || "Marca não informada";
    const model = data.model || data.modelo || "";
    const version = data.version || data.versao || "";
    const brandModel = data.brandModel || data.marca_modelo || `${brand} ${model}`.trim();
    const segment = data.segment || data.sub_segmento || data.segmento || "Automóvel";
    const bodyType = data.bodyType || data.carroceria || "Sedã";

    const yearFab = data.yearFab || data.year_fab || data.anoFabricacao || data.ano_fabricacao || "N/A";
    const yearModel = data.yearModel || data.year_model || data.anoModelo || data.ano_modelo || data.ano || "N/A";
    const yearFormatted = data.yearFormatted || `${yearFab} / ${yearModel}`;
    const color = data.color || data.cor || "N/A";
    const fuel = data.fuel || data.combustivel || "N/A";
    const chassis = data.chassis || data.chassi || "N/A";
    const renavam = data.renavam || "N/A";
    const engine = data.engine || data.motor || "N/A";
    const gearboxNumber = data.gearboxNumber || data.caixa_cambio || "N/A";
    const transmission = data.transmission || data.cambio || "N/A";
    const traction = data.traction || data.tracao || "N/A";
    const steering = data.steering || data.direcao || "N/A";

    const statusVehicle = data.statusVehicle || data.situacao_veiculo || data.situacao || "EM CIRCULACAO";
    const statusChassis = data.statusChassis || data.situacao_chassi || "NORMAL";
    const isRegular = statusVehicle.toUpperCase().includes("CIRCULACAO") || statusVehicle.toUpperCase().includes("REGULAR");

    const city = data.city || data.municipio_emplacamento || data.municipio || data.cidade || "";
    const state = data.state || data.uf_placa || data.uf || data.estado || "";
    const location = [city, state].filter(Boolean).join(" / ") || "Brasil";

    // FIPE & IPVA
    const fipeObj = data.fipe || {};
    const fipeValue = fipeObj.value || fipeObj.valor || (Array.isArray(data.fipe_opcoes) && data.fipe_opcoes[0]?.valor) || "N/A";
    const fipeCode = fipeObj.code || fipeObj.codigo || (Array.isArray(data.fipe_opcoes) && data.fipe_opcoes[0]?.codigo) || "N/A";
    const fipeRef = fipeObj.reference || fipeObj.tabela || null;
    const venalValue = data.ipva?.venalValue || data.valor_venal || "N/A";
    const ipvaRate = data.ipva?.rate || data.aliquota_ipva || "N/A";
    const ipvaEstimated = data.ipva?.estimated || data.ipva_estimado || "N/A";
    const ipvaStates = data.ipva?.states || data.ipva_estados || [];

    // Proprietário
    const owner = data.owner || data.proprietario || null;
    const ownerDetails = data.proprietario_detalhes || {};
    const ownerName =
      owner?.name ||
      owner?.nome ||
      ownerDetails.nome ||
      data.ownerName ||
      data.nome_proprietario ||
      data.nomeProprietario ||
      (typeof data.owner === "string" ? data.owner : null);
    const ownerDocRaw =
      owner?.document ||
      owner?.documento ||
      owner?.cpf ||
      ownerDetails.cpf ||
      ownerDetails.cpf_cnpj ||
      data.ownerCpf ||
      data.cpf ||
      data.cpf_titular ||
      null;
    const ownerDocClean = ownerDocRaw ? String(ownerDocRaw).replace(/\D/g, "") : null;
    const ownerDocFormatted = owner?.documentFormatted || (ownerDocClean?.length === 11 ? this.formatCpf(ownerDocClean) : ownerDocRaw);
    const ownerIncome = owner?.incomeFormatted || (ownerDetails.renda_presumida ? Number(ownerDetails.renda_presumida).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : null);
    const ownerScore = owner?.scoreCsba || ownerDetails.score_csba || ownerDetails.score || null;
    const ownerScoreRange = owner?.scoreCsbaRange || ownerDetails.score_faixa || ownerDetails.faixa_risco || null;
    const ownerCnh = owner?.cnh?.numero || ownerDetails.cnh?.numero_cnh || null;
    const ownerMother = owner?.motherName || ownerDetails.mae || ownerDetails.nome_mae || data.owner_mother_name || null;
    const ownerBirthDate = owner?.birthDate || ownerDetails.nascimento || ownerDetails.data_nascimento || data.owner_birth_date || null;
    const ownerOccupation = owner?.occupation || ownerDetails.profissao || ownerDetails.ocupacao || null;
    const ownerPhones = owner?.phones || ownerDetails.telefones || data.owner_phones || [];
    const ownerEmails = owner?.emails || ownerDetails.emails || (data.owner_email ? [data.owner_email] : []);
    const otherVehicles = owner?.otherVehicles || ownerDetails.outros_veiculos || data.owner_vehicles || [];
    const ownerAddress = owner?.address || ownerDetails.endereco_principal || ownerDetails.endereco || data.address || null;

    // Ficha técnica & Equipamentos
    const specs = data.specs || data.fichaTecnica || {};
    const power = specs.power || data.power || "N/A";
    const torque = specs.torque || data.torque || "N/A";
    const acceleration = specs.acceleration0to100 || data.aceleracao_0_100 || "N/A";
    const topSpeed = specs.topSpeed || data.velocidade_maxima || "N/A";
    const urbanConsumption = specs.urbanConsumption || data.consumo_urbano || "N/A";
    const highwayConsumption = specs.highwayConsumption || data.consumo_rodoviario || "N/A";
    const trunk = specs.trunkCapacity || data.porta_malas || "N/A";
    const tank = specs.fuelTank || data.tanque_combustivel || "N/A";
    const weight = specs.curbWeight || data.peso || "N/A";
    const tires = specs.tires || data.pneus || "N/A";
    const engineCode = specs.engineCode || data.codigo_motor || "N/A";
    const equipment = data.equipment || data.equipamentos || [];
    const vehiclePhoto = data.vehiclePhoto || data.foto_veiculo || (Array.isArray(data.fotos_modelo) && (data.fotos_modelo[0]?.url || data.fotos_modelo[0]?.src || data.fotos_modelo[0]?.imagem)) || null;

    let html = `
      <div class="dark-report-container" style="font-family: var(--font-sans, system-ui, sans-serif); color: #E2E8F0; line-height: 1.5;">
        
        <!-- BANNER DE CABEÇALHO DO RELATÓRIO VEICULAR -->
        <div class="dark-report-card" style="background: radial-gradient(circle at 95% 10%, rgba(59, 130, 246, 0.18) 0%, transparent 65%), #0D111A; border: 1px solid rgba(59, 130, 246, 0.4); border-radius: 10px; padding: 22px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span style="background: linear-gradient(135deg, #2563EB, #1D4ED8); color: #FFFFFF; font-size: 0.72rem; font-weight: 800; padding: 3px 10px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.6px;">
                  RIMUBUSCA OSINT &bull; DOSSIÊ VEICULAR
                </span>
                <span style="background: rgba(16, 185, 129, 0.15); color: #6EE7B7; font-size: 0.72rem; font-weight: 700; padding: 3px 10px; border-radius: 4px; border: 1px solid rgba(16, 185, 129, 0.3);">
                  REGISTRO AUDITADO
                </span>
              </div>
              <h1 style="font-size: 1.55rem; font-weight: 800; color: #FFFFFF; margin: 0; letter-spacing: 0.5px;">
                ${this.escapeHtml(brandModel)}
              </h1>
              <p style="color: #94A3B8; font-size: 0.825rem; margin-top: 5px; margin-bottom: 0;">
                Placa: <strong style="color: #60A5FA; font-family: var(--font-mono); font-size: 1rem;">${plateMercosul || plate}</strong>
                ${plateOld && plateOld !== (plateMercosul || plate) ? ` &bull; Placa Anterior: <strong style="color: #94A3B8; font-family: var(--font-mono);">${plateOld}</strong>` : ""}
                &bull; Local: <strong style="color: #F1F5F9;">${this.escapeHtml(location)}</strong>
              </p>
            </div>

            <div style="text-align: right; font-family: var(--font-mono); font-size: 0.78rem; color: #94A3B8; background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
              <div>PROTOCOLO: <strong style="color: #6EE7B7;">${protocolo}</strong></div>
              <div>EMISSÃO: <strong style="color: #F1F5F9;">${dataEmissao}</strong></div>
              <div>FONTE: <strong style="color: #60A5FA;">${this.escapeHtml(fonte)}</strong></div>
            </div>
          </div>
        </div>

        <!-- QUADRO DE INDICADORES RÁPIDOS -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 22px;">
          <div class="dark-report-card" style="background: #0D111A; border: 1px solid #1E2538; padding: 12px 16px; border-radius: 8px;">
            <div style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase;">Situação Cadastral</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: ${isRegular ? "#10B981" : "#EF4444"}; font-family: var(--font-mono); margin-top: 2px;">${this.escapeHtml(statusVehicle)}</div>
          </div>

          <div class="dark-report-card" style="background: #0D111A; border: 1px solid #1E2538; padding: 12px 16px; border-radius: 8px;">
            <div style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase;">Ano Fabricação / Modelo</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: #FFFFFF; font-family: var(--font-mono); margin-top: 2px;">${this.escapeHtml(yearFormatted)}</div>
          </div>

          <div class="dark-report-card" style="background: #0D111A; border: 1px solid #1E2538; padding: 12px 16px; border-radius: 8px;">
            <div style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase;">Valor Tabela FIPE</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: #34D399; font-family: var(--font-mono); margin-top: 2px;">${this.escapeHtml(fipeValue)}</div>
          </div>

          <div class="dark-report-card" style="background: #0D111A; border: 1px solid #1E2538; padding: 12px 16px; border-radius: 8px;">
            <div style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase;">IPVA Estimado</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: #F59E0B; font-family: var(--font-mono); margin-top: 2px;">${this.escapeHtml(ipvaEstimated)}</div>
          </div>

          <div class="dark-report-card" style="background: #0D111A; border: 1px solid #1E2538; padding: 12px 16px; border-radius: 8px;">
            <div style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase;">Proprietário</div>
            <div style="font-size: 0.95rem; font-weight: 800; color: #60A5FA; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${this.escapeHtml(ownerName || "Não Informado")}</div>
          </div>
        </div>

        <!-- FOTO ILUSTRATIVA SE DISPONÍVEL -->
        ${vehiclePhoto ? `
          <div class="dark-report-card" style="background: #0D111A; border: 1px solid #1E2538; border-radius: 8px; padding: 16px; margin-bottom: 20px; text-align: center;">
            <div style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase; margin-bottom: 8px; font-weight: 700;">Registro Fotográfico Ilustrativo do Modelo</div>
            <img src="${vehiclePhoto}" alt="${this.escapeHtml(brandModel)}" style="max-height: 260px; max-width: 100%; border-radius: 6px; object-fit: contain; border: 1px solid #1E2538;">
          </div>
        ` : ""}

        <!-- SEÇÃO 1: IDENTIFICAÇÃO CADASTRAL & DETRAN -->
        <div class="dark-report-card" style="background: #0D111A; border: 1px solid #1E2538; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="font-size: 1.1rem; color: #38BDF8; margin-top: 0; margin-bottom: 14px; border-bottom: 1px solid #1E2538; padding-bottom: 8px;">
            Identificação Cadastral & Detran
          </h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px;">
            <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
              <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase; display: block;">Chassi (VIN)</span>
              <div style="font-family: var(--font-mono); font-weight: 800; color: #60A5FA; margin-top: 2px;">${this.escapeHtml(chassis)}</div>
            </div>
            <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
              <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase; display: block;">Renavam</span>
              <div style="font-family: var(--font-mono); font-weight: 800; color: #34D399; margin-top: 2px;">${this.escapeHtml(renavam)}</div>
            </div>
            <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
              <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase; display: block;">Número do Motor</span>
              <div style="font-family: var(--font-mono); font-weight: 800; color: #F59E0B; margin-top: 2px;">${this.escapeHtml(engine)}</div>
            </div>
            <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
              <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase; display: block;">Cor Predominante</span>
              <div style="font-weight: 700; color: #F1F5F9; margin-top: 2px;">${this.escapeHtml(color)}</div>
            </div>
            <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
              <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase; display: block;">Combustível</span>
              <div style="font-weight: 700; color: #F1F5F9; margin-top: 2px;">${this.escapeHtml(fuel)}</div>
            </div>
            <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
              <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase; display: block;">Transmissão / Câmbio</span>
              <div style="font-weight: 700; color: #F1F5F9; margin-top: 2px;">${this.escapeHtml(transmission)}</div>
            </div>
            <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
              <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase; display: block;">Tração / Direção</span>
              <div style="font-weight: 700; color: #F1F5F9; margin-top: 2px;">${this.escapeHtml(traction)} &bull; ${this.escapeHtml(steering)}</div>
            </div>
            <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
              <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase; display: block;">Carroceria & Segmento</span>
              <div style="font-weight: 700; color: #F1F5F9; margin-top: 2px;">${this.escapeHtml(bodyType)} &bull; ${this.escapeHtml(segment)}</div>
            </div>
            <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
              <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase; display: block;">Município de Emplacamento</span>
              <div style="font-weight: 700; color: #F1F5F9; margin-top: 2px;">${this.escapeHtml(location)}</div>
            </div>
          </div>
        </div>

        <!-- SEÇÃO 2: PROPRIETÁRIO ATUAL & VÍNCULO OSINT -->
        ${ownerName ? `
          <div class="dark-report-card" style="background: #0D111A; border: 1px solid rgba(139, 92, 246, 0.4); border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <h3 style="font-size: 1.1rem; color: #A78BFA; margin-top: 0; margin-bottom: 14px; border-bottom: 1px solid #1E2538; padding-bottom: 8px;">
              Proprietário Registrado & Vínculo OSINT
            </h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px;">
              <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
                <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase; display: block;">Nome Completo</span>
                <div style="font-weight: 800; color: #FFFFFF; font-size: 0.95rem; margin-top: 2px;">${this.escapeHtml(ownerName)}</div>
              </div>
              <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
                <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase; display: block;">Documento (CPF)</span>
                <div style="font-family: var(--font-mono); font-weight: 800; color: #6EE7B7; font-size: 1rem; margin-top: 2px;">${this.escapeHtml(ownerDocFormatted || "N/I")}</div>
              </div>
              ${ownerBirthDate ? `
                <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
                  <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase; display: block;">Nascimento</span>
                  <div style="font-weight: 700; color: #F1F5F9; margin-top: 2px;">${this.escapeHtml(ownerBirthDate)}</div>
                </div>
              ` : ""}
              ${ownerMother ? `
                <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
                  <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase; display: block;">Nome da Mãe</span>
                  <div style="font-weight: 700; color: #F1F5F9; margin-top: 2px;">${this.escapeHtml(ownerMother)}</div>
                </div>
              ` : ""}
              ${ownerIncome ? `
                <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
                  <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase; display: block;">Renda Presumida</span>
                  <div style="font-family: var(--font-mono); font-weight: 800; color: #34D399; margin-top: 2px;">${this.escapeHtml(ownerIncome)}</div>
                </div>
              ` : ""}
              ${ownerScore ? `
                <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
                  <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase; display: block;">Score Serasa</span>
                  <div style="font-family: var(--font-mono); font-weight: 800; color: #60A5FA; margin-top: 2px;">${this.escapeHtml(ownerScore)} ${ownerScoreRange ? `(${this.escapeHtml(ownerScoreRange)})` : ""}</div>
                </div>
              ` : ""}
              ${ownerCnh ? `
                <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
                  <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase; display: block;">CNH</span>
                  <div style="font-family: var(--font-mono); font-weight: 800; color: #F59E0B; margin-top: 2px;">${this.escapeHtml(ownerCnh)}</div>
                </div>
              ` : ""}
              ${ownerOccupation ? `
                <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
                  <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase; display: block;">Ocupação</span>
                  <div style="font-weight: 600; color: #F1F5F9; font-size: 0.85rem; margin-top: 2px;">${this.escapeHtml(ownerOccupation)}</div>
                </div>
              ` : ""}
            </div>

            ${ownerPhones && ownerPhones.length > 0 ? `
              <div style="margin-top: 12px; background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
                <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase; display: block; margin-bottom: 6px;">Telefones Vinculados</span>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                  ${ownerPhones.map(p => `<span style="background: #131A29; border: 1px solid #23304A; padding: 3px 8px; border-radius: 4px; font-family: var(--font-mono); font-size: 0.82rem; color: #60A5FA;">${this.formatTelefone(p)}</span>`).join("")}
                </div>
              </div>
            ` : ""}

            ${ownerAddress ? `
              <div style="margin-top: 10px; background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538; font-size: 0.85rem; color: #E2E8F0;">
                <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase; display: block; margin-bottom: 4px;">Endereço Residencial Cadastrado</span>
                <strong>${this.escapeHtml([ownerAddress.logradouro || ownerAddress.street, ownerAddress.numero || ownerAddress.number].filter(Boolean).join(", "))}</strong>
                ${ownerAddress.bairro || ownerAddress.neighborhood ? `&bull; ${this.escapeHtml(ownerAddress.bairro || ownerAddress.neighborhood)}` : ""}
                ${ownerAddress.cidade || ownerAddress.city ? `&bull; ${this.escapeHtml(ownerAddress.cidade || ownerAddress.city)}/${this.escapeHtml(ownerAddress.uf || ownerAddress.state)}` : ""}
                ${ownerAddress.cep || ownerAddress.zip_code ? `&bull; CEP: <span style="font-family: var(--font-mono); color: #6EE7B7;">${this.formatCep(ownerAddress.cep || ownerAddress.zip_code)}</span>` : ""}
              </div>
            ` : ""}

            ${otherVehicles && otherVehicles.length > 0 ? `
              <div style="margin-top: 12px; background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
                <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase; display: block; margin-bottom: 6px;">Outros Veículos Pertencentes ao Titular (${otherVehicles.length})</span>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                  ${otherVehicles.map(v => {
                    const vPlaca = String(v.plate || v.placa || "").toUpperCase();
                    const vMod = v.marca_modelo || v.modelo || "Veículo";
                    return `<span style="background: #181F2E; border: 1px solid #23304A; padding: 4px 8px; border-radius: 4px; font-size: 0.78rem; color: #F1F5F9;"><strong style="color: #6EE7B7; font-family: var(--font-mono);">${vPlaca}</strong> - ${this.escapeHtml(vMod)}</span>`;
                  }).join("")}
                </div>
              </div>
            ` : ""}
          </div>
        ` : ""}

        <!-- SEÇÃO 3: FIPE & IPVA NACIONAL -->
        <div class="dark-report-card" style="background: #0D111A; border: 1px solid #1E2538; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="font-size: 1.1rem; color: #10B981; margin-top: 0; margin-bottom: 14px; border-bottom: 1px solid #1E2538; padding-bottom: 8px;">
            Avaliação FIPE & Comparativo Nacional de IPVA
          </h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 14px;">
            <div style="background: #080B11; padding: 12px; border-radius: 6px; border: 1px solid #1E2538;">
              <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase;">Valor FIPE Atual</span>
              <div style="font-family: var(--font-mono); font-size: 1.25rem; font-weight: 800; color: #34D399; margin-top: 2px;">${this.escapeHtml(fipeValue)}</div>
              ${fipeRef ? `<div style="font-size: 0.7rem; color: #94A3B8; margin-top: 2px;">Ref: ${this.escapeHtml(fipeRef)}</div>` : ""}
            </div>
            <div style="background: #080B11; padding: 12px; border-radius: 6px; border: 1px solid #1E2538;">
              <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase;">Valor Venal (Base IPVA)</span>
              <div style="font-family: var(--font-mono); font-size: 1.2rem; font-weight: 700; color: #F1F5F9; margin-top: 2px;">${this.escapeHtml(venalValue)}</div>
            </div>
            <div style="background: #080B11; padding: 12px; border-radius: 6px; border: 1px solid #1E2538;">
              <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase;">Alíquota Estadual</span>
              <div style="font-family: var(--font-mono); font-size: 1.2rem; font-weight: 700; color: #60A5FA; margin-top: 2px;">${this.escapeHtml(ipvaRate)}</div>
            </div>
            <div style="background: #080B11; padding: 12px; border-radius: 6px; border: 1px solid #1E2538;">
              <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase;">IPVA Estimado (Origem)</span>
              <div style="font-family: var(--font-mono); font-size: 1.25rem; font-weight: 800; color: #F59E0B; margin-top: 2px;">${this.escapeHtml(ipvaEstimated)}</div>
            </div>
          </div>

          ${ipvaStates && ipvaStates.length > 0 ? `
            <div style="margin-top: 12px;">
              <span style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 8px;">Tabela Comparativa de IPVA em Todos os Estados (${ipvaStates.length} UFs)</span>
              <div style="overflow-x: auto; max-height: 250px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: left;">
                  <thead>
                    <tr style="border-bottom: 1px solid #1E2538; color: #94A3B8; font-size: 0.7rem; text-transform: uppercase;">
                      <th style="padding: 6px;">UF</th>
                      <th style="padding: 6px;">Valor Venal</th>
                      <th style="padding: 6px;">Alíquota</th>
                      <th style="padding: 6px;">Valor IPVA</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${ipvaStates.map(st => `
                      <tr style="border-bottom: 1px solid #141A29;">
                        <td style="padding: 6px; font-weight: 800; font-family: var(--font-mono); color: #F1F5F9;">${this.escapeHtml(st.estado)}</td>
                        <td style="padding: 6px; font-family: var(--font-mono); color: #94A3B8;">${this.escapeHtml(st.valor_venal)}</td>
                        <td style="padding: 6px; font-family: var(--font-mono); color: #38BDF8;">${this.escapeHtml(st.aliquota)}</td>
                        <td style="padding: 6px; font-family: var(--font-mono); font-weight: 700; color: #34D399;">${this.escapeHtml(st.valor_ipva)}</td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
              </div>
            </div>
          ` : ""}
        </div>

        <!-- SEÇÃO 4: FICHA TÉCNICA & PERFORMANCE -->
        <div class="dark-report-card" style="background: #0D111A; border: 1px solid #1E2538; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="font-size: 1.1rem; color: #F59E0B; margin-top: 0; margin-bottom: 14px; border-bottom: 1px solid #1E2538; padding-bottom: 8px;">
            Ficha Técnica & Desempenho
          </h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
            <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
              <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase;">Potência Máxima</span>
              <div style="font-weight: 800; color: #F59E0B; margin-top: 2px;">${this.escapeHtml(power)}</div>
            </div>
            <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
              <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase;">Torque Máximo</span>
              <div style="font-weight: 800; color: #F1F5F9; margin-top: 2px;">${this.escapeHtml(torque)}</div>
            </div>
            <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
              <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase;">Aceleração (0 a 100 km/h)</span>
              <div style="font-family: var(--font-mono); font-weight: 800; color: #38BDF8; margin-top: 2px;">${this.escapeHtml(acceleration)}</div>
            </div>
            <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
              <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase;">Velocidade Máxima</span>
              <div style="font-family: var(--font-mono); font-weight: 800; color: #EF4444; margin-top: 2px;">${this.escapeHtml(topSpeed)}</div>
            </div>
            <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
              <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase;">Consumo Urbano</span>
              <div style="font-weight: 700; color: #F1F5F9; margin-top: 2px;">${this.escapeHtml(urbanConsumption)}</div>
            </div>
            <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
              <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase;">Consumo Rodoviário</span>
              <div style="font-weight: 700; color: #F1F5F9; margin-top: 2px;">${this.escapeHtml(highwayConsumption)}</div>
            </div>
            <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
              <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase;">Porta-Malas</span>
              <div style="font-weight: 800; color: #6EE7B7; margin-top: 2px;">${this.escapeHtml(trunk)}</div>
            </div>
            <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
              <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase;">Tanque de Combustível</span>
              <div style="font-weight: 800; color: #F1F5F9; margin-top: 2px;">${this.escapeHtml(tank)}</div>
            </div>
          </div>
        </div>

        <!-- SEÇÃO 5: EQUIPAMENTOS DE SÉRIE -->
        ${equipment && equipment.length > 0 ? `
          <div class="dark-report-card" style="background: #0D111A; border: 1px solid #1E2538; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <h3 style="font-size: 1.1rem; color: #C4B5FD; margin-top: 0; margin-bottom: 14px; border-bottom: 1px solid #1E2538; padding-bottom: 8px;">
              Equipamentos de Série & Opcionais (${equipment.length} Itens)
            </h3>
            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
              ${equipment.map(eq => {
                const eqName = typeof eq === "string" ? eq : eq?.key || eq?.name || "";
                return `<span style="background: #080B11; border: 1px solid #1E2538; color: #E2E8F0; font-size: 0.72rem; padding: 3px 8px; border-radius: 4px;">&bull; ${this.escapeHtml(eqName)}</span>`;
              }).join("")}
            </div>
          </div>
        ` : ""}

        <!-- RODAPÉ DE CONFORMIDADE & LGPD -->
        <div style="margin-top: 24px; padding: 14px 18px; background: #0A0D14; border: 1px solid #1E2538; border-radius: 8px; font-size: 0.75rem; color: #64748B; text-align: center;">
          <strong style="color: #94A3B8;">TERMO DE CONFORMIDADE & SEGURANÇA DA INFORMAÇÃO:</strong> Documento emitido para fins de investigação veicular legítima, prevenção a fraudes e auditoria cadastral nos termos da LGPD (Lei Federal 13.709/2018). Todos os acessos são auditados pela plataforma RimuBusca OSINT Core.
        </div>
      </div>
    `;

    return html;
  }

  // 6.3.2 CONSTRUÇÃO DE RELATÓRIO DARK ESPECÍFICO PARA PARENTES & VÍNCULOS FAMILIARES
  gerarHtmlRelatorioDarkParentes(termo, fullResponse, dataPayload) {
    const data = dataPayload || {};
    const protocolo = `OSINT-FAM-${Date.now().toString(36).toUpperCase()}`;
    const dataEmissao = new Date().toLocaleString("pt-BR");
    const fonte = fullResponse?.fonte || "Árvore de Vínculos Familiares";
    const titular = String(data.titular || data.target || termo || "Titular Não Informado").toUpperCase();

    const rawList = Array.isArray(data.parentescos)
      ? data.parentescos
      : Array.isArray(data.parentes)
        ? data.parentes
        : Array.isArray(data.resultado)
          ? data.resultado
          : Array.isArray(data)
            ? data
            : [];

    const total = rawList.length;
    let countAsc = 0;
    let countConj = 0;
    let countColat = 0;

    rawList.forEach((r) => {
      const v = String(r.vinculo || r.parentesco || "").toUpperCase();
      if (v.includes("MÃE") || v.includes("PAI") || v.includes("AVÔ") || v.includes("AVÓ")) countAsc++;
      else if (v.includes("CÔNJUGE") || v.includes("ESPOS") || v.includes("MARIDO") || v.includes("COMPANHEIR")) countConj++;
      else if (v.includes("IRMÃ") || v.includes("IRMAO") || v.includes("TIO") || v.includes("PRIM")) countColat++;
    });

    let html = `
      <div class="dark-report-container" style="font-family: var(--font-sans, system-ui, sans-serif); color: #E2E8F0; line-height: 1.5;">
        
        <!-- BANNER DE CABEÇALHO DO RELATÓRIO DE PARENTESCO -->
        <div class="dark-report-card" style="background: radial-gradient(circle at 95% 10%, rgba(139, 92, 246, 0.18) 0%, transparent 65%), #0D111A; border: 1px solid rgba(139, 92, 246, 0.4); border-radius: 10px; padding: 22px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span style="background: linear-gradient(135deg, #7C3AED, #4F46E5); color: #FFFFFF; font-size: 0.72rem; font-weight: 800; padding: 3px 10px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.6px;">
                  RIMUBUSCA OSINT &bull; VÍNCULOS FAMILIARES
                </span>
                <span style="background: rgba(16, 185, 129, 0.15); color: #6EE7B7; font-size: 0.72rem; font-weight: 700; padding: 3px 10px; border-radius: 4px; border: 1px solid rgba(16, 185, 129, 0.3);">
                  ÁRVORE GENEALÓGICA AUDITADA
                </span>
              </div>
              <h1 style="font-size: 1.55rem; font-weight: 800; color: #FFFFFF; margin: 0; letter-spacing: 0.5px;">
                ${this.escapeHtml(titular)}
              </h1>
              <p style="color: #94A3B8; font-size: 0.825rem; margin-top: 5px; margin-bottom: 0;">
                Módulo Consultado: <strong style="color: #C4B5FD;">ÁRVORE DE PARENTESCO</strong> &bull; Total Identificado: <strong style="color: #6EE7B7;">${total} parentes</strong>
              </p>
            </div>

            <div style="text-align: right; font-family: var(--font-mono); font-size: 0.78rem; color: #94A3B8; background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
              <div>PROTOCOLO: <strong style="color: #6EE7B7;">${protocolo}</strong></div>
              <div>EMISSÃO: <strong style="color: #F1F5F9;">${dataEmissao}</strong></div>
              <div>FONTE: <strong style="color: #A78BFA;">${this.escapeHtml(fonte)}</strong></div>
            </div>
          </div>
        </div>

        <!-- QUADRO DE INDICADORES RÁPIDOS -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 22px;">
          <div class="dark-report-card" style="background: #0D111A; border: 1px solid #1E2538; padding: 12px 16px; border-radius: 8px;">
            <div style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase;">Total de Parentes</div>
            <div style="font-size: 1.35rem; font-weight: 800; color: #FFFFFF; font-family: var(--font-mono); margin-top: 2px;">${total}</div>
          </div>

          <div class="dark-report-card" style="background: #0D111A; border: 1px solid #1E2538; padding: 12px 16px; border-radius: 8px;">
            <div style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase;">Pais / Ascendentes</div>
            <div style="font-size: 1.35rem; font-weight: 800; color: #818CF8; font-family: var(--font-mono); margin-top: 2px;">${countAsc}</div>
          </div>

          <div class="dark-report-card" style="background: #0D111A; border: 1px solid #1E2538; padding: 12px 16px; border-radius: 8px;">
            <div style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase;">Cônjuge / União</div>
            <div style="font-size: 1.35rem; font-weight: 800; color: #FB7185; font-family: var(--font-mono); margin-top: 2px;">${countConj}</div>
          </div>

          <div class="dark-report-card" style="background: #0D111A; border: 1px solid #1E2538; padding: 12px 16px; border-radius: 8px;">
            <div style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase;">Irmãos / Colaterais</div>
            <div style="font-size: 1.35rem; font-weight: 800; color: #34D399; font-family: var(--font-mono); margin-top: 2px;">${countColat}</div>
          </div>
        </div>

        <!-- GRADE DE MEMBROS FAMILIARES -->
        <div class="dark-report-card" style="background: #0D111A; border: 1px solid #1E2538; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="font-size: 1.1rem; color: #A78BFA; margin-top: 0; margin-bottom: 14px; border-bottom: 1px solid #1E2538; padding-bottom: 8px;">
            Membros Familiares Mapeados
          </h3>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px;">
            ${rawList.map((rel) => {
              const vinculo = String(rel.vinculo || rel.parentesco || "Parente").toUpperCase();
              const nome = String(rel.nome || rel.name || "NÃO INFORMADO").toUpperCase();
              const cpf = String(rel.cpf || rel.documento || "Não informado");
              const idade = rel.idade ? ` &bull; ${rel.idade} anos` : "";
              return `
                <div style="background: #080B11; border: 1px solid #1E2538; padding: 14px; border-radius: 6px;">
                  <span style="background: rgba(139, 92, 246, 0.15); color: #C4B5FD; font-size: 0.72rem; font-weight: 800; padding: 2px 8px; border-radius: 4px; display: inline-block; margin-bottom: 6px;">
                    ${this.escapeHtml(vinculo)}
                  </span>
                  <div style="font-weight: 800; color: #FFFFFF; font-size: 0.95rem; margin-bottom: 4px;">
                    ${this.escapeHtml(nome)}
                  </div>
                  <div style="font-family: var(--font-mono); color: #94A3B8; font-size: 0.82rem;">
                    CPF: <strong style="color: #6EE7B7;">${this.escapeHtml(cpf)}</strong>${idade}
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>

        <!-- RODAPÉ DE CONFORMIDADE & LGPD -->
        <div style="margin-top: 24px; padding: 14px 18px; background: #0A0D14; border: 1px solid #1E2538; border-radius: 8px; font-size: 0.75rem; color: #64748B; text-align: center;">
          <strong style="color: #94A3B8;">TERMO DE CONFORMIDADE & SEGURANÇA DA INFORMAÇÃO:</strong> Documento emitido para fins de investigação legítima, prevenção a fraudes e auditoria cadastral nos termos da LGPD (Lei Federal 13.709/2018). Todos os acessos são auditados pela plataforma RimuBusca OSINT Core.
        </div>
      </div>
    `;

    return html;
  }

  // 6.3.3 CONSTRUÇÃO DE RELATÓRIO DARK ESPECÍFICO PARA E-MAIL & PERFIL DIGITAL
  gerarHtmlRelatorioDarkEmail(termo, fullResponse, dataPayload) {
    const data = dataPayload || {};
    const protocolo = `OSINT-EML-${Date.now().toString(36).toUpperCase()}`;
    const dataEmissao = new Date().toLocaleString("pt-BR");
    const fonte = fullResponse?.fonte || "RimuAPI Intelligence Engine (Live)";
    const email = String(data.email || termo || "E-mail Consultado").toLowerCase();

    const perfilGoogle = data.perfil_google || {};
    const gaiaId = perfilGoogle.gaia_id || perfilGoogle.gaiaId || null;
    const photoUrl = data.foto || perfilGoogle.foto || perfilGoogle.photoUrl || null;
    const appsAtivos = Array.isArray(perfilGoogle.apps_ativos) ? perfilGoogle.apps_ativos : [];
    const mapsContribUrl = perfilGoogle.maps_contrib_url || (gaiaId ? `https://www.google.com/maps/contrib/${gaiaId}/reviews` : null);

    const persons = Array.isArray(data.pessoas_vinculadas)
      ? data.pessoas_vinculadas
      : Array.isArray(data.pessoas)
        ? data.pessoas
        : Array.isArray(data.titulares)
          ? data.titulares
          : [];

    const totalPersons = persons.length;
    const empresas = Array.isArray(data.empresas_vinculadas) ? data.empresas_vinculadas : Array.isArray(data.empresas) ? data.empresas : [];
    const seguranca = data.seguranca || {};
    const vazamentos = Array.isArray(seguranca.vazamentos) ? seguranca.vazamentos : Array.isArray(data.vazamentos) ? data.vazamentos : [];
    const totalVazamentos = seguranca.total_vazamentos ?? (data.total_vazamentos ?? vazamentos.length);
    const isVulnerable = totalVazamentos > 0;

    let totalVeiculos = 0;
    persons.forEach((p) => {
      const v = Array.isArray(p.veiculos) ? p.veiculos : Array.isArray(p.vehicles) ? p.vehicles : [];
      totalVeiculos += v.length;
    });

    let html = `
      <div class="dark-report-container" style="font-family: var(--font-sans, system-ui, sans-serif); color: #E2E8F0; line-height: 1.5;">
        
        <!-- BANNER DE CABEÇALHO DO RELATÓRIO DE E-MAIL -->
        <div class="dark-report-card" style="background: radial-gradient(circle at 95% 10%, rgba(6, 182, 212, 0.18) 0%, transparent 65%), #0D111A; border: 1px solid rgba(6, 182, 212, 0.4); border-radius: 10px; padding: 22px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
            <div style="display: flex; align-items: flex-start; gap: 16px; flex-wrap: wrap;">
              ${
                photoUrl
                  ? `<div style="width: 64px; height: 64px; border-radius: 10px; border: 2px solid #06B6D4; overflow: hidden; flex-shrink: 0;">
                       <img src="${photoUrl}" alt="Foto Google" style="width: 100%; height: 100%; object-fit: cover;" />
                     </div>`
                  : ""
              }
              <div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
                  <span style="background: linear-gradient(135deg, #0891B2, #06B6D4); color: #080B11; font-size: 0.72rem; font-weight: 800; padding: 3px 10px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.6px;">
                    RIMUBUSCA OSINT &bull; INTELIGÊNCIA DE E-MAIL
                  </span>
                  <span style="background: rgba(16, 185, 129, 0.15); color: #6EE7B7; font-size: 0.72rem; font-weight: 700; padding: 3px 10px; border-radius: 4px; border: 1px solid rgba(16, 185, 129, 0.3);">
                    DOSSIÊ DIGITAL AUDITADO
                  </span>
                  ${
                    isVulnerable
                      ? `<span style="background: rgba(239, 68, 68, 0.15); color: #FCA5A5; font-size: 0.72rem; font-weight: 700; padding: 3px 10px; border-radius: 4px; border: 1px solid rgba(239, 68, 68, 0.3);">
                           ${totalVazamentos} VAZAMENTO(S) DETECTADO(S)
                         </span>`
                      : `<span style="background: rgba(16, 185, 129, 0.15); color: #6EE7B7; font-size: 0.72rem; font-weight: 700; padding: 3px 10px; border-radius: 4px; border: 1px solid rgba(16, 185, 129, 0.3);">
                           0 VAZAMENTOS (SEGURO)
                         </span>`
                  }
                </div>
                <h1 style="font-size: 1.55rem; font-weight: 800; color: #FFFFFF; margin: 0; font-family: var(--font-mono); letter-spacing: 0.5px;">
                  ${this.escapeHtml(email)}
                </h1>
                <p style="color: #94A3B8; font-size: 0.825rem; margin-top: 5px; margin-bottom: 0;">
                  Titulares Vinculados: <strong style="color: #67E8F9;">${totalPersons} titular(es)</strong> &bull; Empresas: <strong style="color: #60A5FA;">${empresas.length}</strong> &bull; Veículos: <strong style="color: #F59E0B;">${totalVeiculos}</strong>
                </p>
              </div>
            </div>

            <div style="text-align: right; font-family: var(--font-mono); font-size: 0.78rem; color: #94A3B8; background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
              <div>PROTOCOLO: <strong style="color: #6EE7B7;">${protocolo}</strong></div>
              <div>EMISSÃO: <strong style="color: #F1F5F9;">${dataEmissao}</strong></div>
              <div>FONTE: <strong style="color: #67E8F9;">${this.escapeHtml(fonte)}</strong></div>
            </div>
          </div>
        </div>

        <!-- SEÇÃO: PEGADA DIGITAL GOOGLE (SE DISPONÍVEL) -->
        ${
          gaiaId || appsAtivos.length > 0
            ? `
          <div class="dark-report-card" style="background: #0D111A; border: 1px solid #1E2538; border-radius: 8px; padding: 18px; margin-bottom: 20px;">
            <h3 style="font-size: 1rem; color: #67E8F9; margin-top: 0; margin-bottom: 12px; border-bottom: 1px solid #1E2538; padding-bottom: 8px;">
              Pegada Digital & Conta Google Identificada
            </h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
              ${
                gaiaId
                  ? `<div style="background: #080B11; padding: 10px 12px; border-radius: 6px; border: 1px solid #1E2538;">
                       <span style="font-size: 0.7rem; color: #94A3B8; text-transform: uppercase;">Google Gaia ID</span>
                       <div style="font-family: var(--font-mono); font-weight: 700; color: #A5F3FC; margin-top: 2px;">${this.escapeHtml(gaiaId)}</div>
                     </div>`
                  : ""
              }
              ${
                appsAtivos.length > 0
                  ? `<div style="background: #080B11; padding: 10px 12px; border-radius: 6px; border: 1px solid #1E2538;">
                       <span style="font-size: 0.7rem; color: #94A3B8; text-transform: uppercase;">Serviços Google Ativos</span>
                       <div style="font-weight: 700; color: #F1F5F9; margin-top: 2px;">${this.escapeHtml(appsAtivos.join(", "))}</div>
                     </div>`
                  : ""
              }
              ${
                mapsContribUrl
                  ? `<div style="background: #080B11; padding: 10px 12px; border-radius: 6px; border: 1px solid #1E2538;">
                       <span style="font-size: 0.7rem; color: #94A3B8; text-transform: uppercase;">Perfil Google Maps</span>
                       <div style="font-size: 0.8rem; margin-top: 2px;"><a href="${this.escapeHtml(mapsContribUrl)}" target="_blank" style="color: #38BDF8; text-decoration: none;">Ver Avaliações Públicas ↗</a></div>
                     </div>`
                  : ""
              }
            </div>
          </div>
        `
            : ""
        }

        <!-- SEÇÃO: TITULARES VINCULADOS AO E-MAIL -->
        <div style="margin-bottom: 20px;">
          <h3 style="font-size: 1.1rem; color: #FFFFFF; margin-top: 0; margin-bottom: 14px;">
            Titulares Vinculados ao Endereço (${totalPersons})
          </h3>

          ${persons.map((p, pIdx) => {
            const rawCpf = String(p.raw_cpf || p.cpf || "").replace(/\D/g, "");
            const cpfFmt = p.cpf_formatado || this.formatCpf(rawCpf);
            const nome = String(p.name || p.nome || "Titular").toUpperCase();
            const sit = String(p.situacao_receita || p.situacaoCadastral || p.status || "REGULAR").toUpperCase();
            const nasc = p.nascimento_formatado || (p.birth_date ? p.birth_date.split(" ")[0] : "Não informado");
            const mae = String(p.mother_name || p.nomeMae || p.nome_mae || "Não informada").toUpperCase();
            const renda = p.renda_formatada || (p.income ? `R$ ${Number(p.income).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "Não estimada");
            const prof = String(p.occupation || p.profissao || "Não informada");
            const telList = Array.isArray(p.telefones) ? p.telefones : Array.isArray(p.phones) ? p.phones : p.phone ? [p.phone] : [];
            const vehList = Array.isArray(p.veiculos) ? p.veiculos : Array.isArray(p.vehicles) ? p.vehicles : [];
            const cnh = p.cnh && (p.cnh.numero || p.cnh.num_cnh) ? `${p.cnh.numero || p.cnh.num_cnh} ${p.cnh.uf ? `(${p.cnh.uf})` : ''}` : "Não consta";

            return `
              <div class="dark-report-card" style="background: #0D111A; border: 1px solid #1E2538; border-left: 4px solid #06B6D4; border-radius: 8px; padding: 18px; margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                  <div>
                    <span style="font-size: 0.7rem; color: #06B6D4; font-weight: 800; text-transform: uppercase;">TITULAR #${pIdx + 1} &bull; ${sit}</span>
                    <h4 style="font-size: 1.15rem; font-weight: 800; color: #FFFFFF; margin: 4px 0 0 0;">${this.escapeHtml(nome)}</h4>
                  </div>
                  <div style="font-family: var(--font-mono); font-weight: 700; color: #67E8F9; font-size: 0.95rem; background: #080B11; padding: 4px 10px; border-radius: 4px; border: 1px solid #1E2538;">
                    CPF: ${cpfFmt}
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; background: #080B11; padding: 12px; border-radius: 6px; border: 1px solid #1E2538; margin-bottom: 12px;">
                  <div>
                    <span style="font-size: 0.68rem; color: #94A3B8; text-transform: uppercase; display: block;">Nascimento</span>
                    <strong style="font-size: 0.85rem; color: #F1F5F9;">${nasc}</strong>
                  </div>
                  <div>
                    <span style="font-size: 0.68rem; color: #94A3B8; text-transform: uppercase; display: block;">Mãe</span>
                    <span style="font-size: 0.85rem; color: #F1F5F9;">${this.escapeHtml(mae)}</span>
                  </div>
                  <div>
                    <span style="font-size: 0.68rem; color: #94A3B8; text-transform: uppercase; display: block;">Renda Estimada</span>
                    <strong style="font-size: 0.85rem; color: #10B981; font-family: var(--font-mono);">${renda}</strong>
                  </div>
                  <div>
                    <span style="font-size: 0.68rem; color: #94A3B8; text-transform: uppercase; display: block;">Profissão</span>
                    <span style="font-size: 0.85rem; color: #F1F5F9;">${this.escapeHtml(prof)}</span>
                  </div>
                  <div>
                    <span style="font-size: 0.68rem; color: #94A3B8; text-transform: uppercase; display: block;">CNH</span>
                    <span style="font-size: 0.85rem; font-family: var(--font-mono); color: #F1F5F9;">${this.escapeHtml(cnh)}</span>
                  </div>
                </div>

                ${telList.length > 0 ? `
                  <div style="margin-bottom: 10px;">
                    <span style="font-size: 0.7rem; color: #94A3B8; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 4px;">Telefones Vinculados (${telList.length}):</span>
                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                      ${telList.map(t => {
                        const raw = typeof t === "object" ? (t.numero || t.formatado || "") : String(t);
                        const fmt = (typeof t === "object" && t.formatado) ? t.formatado : this.formatTelefone(raw);
                        return `<span style="background: #080B11; color: #C4B5FD; font-family: var(--font-mono); font-size: 0.78rem; padding: 3px 8px; border-radius: 4px; border: 1px solid #1E2538;">${this.escapeHtml(fmt)}</span>`;
                      }).join("")}
                    </div>
                  </div>
                ` : ""}

                ${vehList.length > 0 ? `
                  <div>
                    <span style="font-size: 0.7rem; color: #94A3B8; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 4px;">Veículos Registrados (${vehList.length}):</span>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                      ${vehList.map(vh => {
                        const pl = String(vh.plate || vh.placa || "N/A").toUpperCase();
                        const re = vh.renavam || "N/I";
                        return `<span style="background: #080B11; color: #F59E0B; font-family: var(--font-mono); font-size: 0.78rem; padding: 4px 10px; border-radius: 4px; border: 1px solid #1E2538;">Placa: <strong>${this.escapeHtml(pl)}</strong> (Renavam: ${this.escapeHtml(re)})</span>`;
                      }).join("")}
                    </div>
                  </div>
                ` : ""}
              </div>
            `;
          }).join("")}
        </div>

        <!-- SEÇÃO: VÍNCULOS EMPRESARIAIS -->
        ${empresas.length > 0 ? `
          <div class="dark-report-card" style="background: #0D111A; border: 1px solid #1E2538; border-radius: 8px; padding: 18px; margin-bottom: 20px;">
            <h3 style="font-size: 1rem; color: #60A5FA; margin-top: 0; margin-bottom: 12px; border-bottom: 1px solid #1E2538; padding-bottom: 8px;">
              Vínculos Empresariais Vinculados ao E-mail (${empresas.length})
            </h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px;">
              ${empresas.map(emp => `
                <div style="background: #080B11; padding: 10px 12px; border-radius: 6px; border: 1px solid #1E2538;">
                  <strong style="color: #FFFFFF; font-size: 0.85rem; display: block;">${this.escapeHtml(emp.razao_social || emp.nome || "Empresa")}</strong>
                  <div style="font-family: var(--font-mono); font-size: 0.78rem; color: #67E8F9; margin-top: 2px;">CNPJ: ${this.formatCnpj(emp.cnpj)}</div>
                  <div style="font-size: 0.72rem; color: #94A3B8; margin-top: 2px;">Vínculo: ${this.escapeHtml(emp.qualificacao || "SÓCIO")}</div>
                </div>
              `).join("")}
            </div>
          </div>
        ` : ""}

        <!-- SEÇÃO: AUDITORIA DE SEGURANÇA & VAZAMENTOS -->
        <div class="dark-report-card" style="background: #0D111A; border: 1px solid ${isVulnerable ? '#EF4444' : '#1E2538'}; border-radius: 8px; padding: 18px; margin-bottom: 20px;">
          <h3 style="font-size: 1rem; color: ${isVulnerable ? '#F87171' : '#10B981'}; margin-top: 0; margin-bottom: 12px; border-bottom: 1px solid #1E2538; padding-bottom: 8px;">
            Auditoria de Segurança de Credenciais & Vazamentos
          </h3>
          ${!isVulnerable ? `
            <div style="font-size: 0.85rem; color: #E2E8F0;">
              Nenhum registro de credencial ou senha exposta para este e-mail em bancos de dados de vazamentos públicos.
            </div>
          ` : `
            <div style="display: grid; gap: 8px;">
              ${vazamentos.map(vz => `
                <div style="background: #080B11; border: 1px solid rgba(239, 68, 68, 0.3); padding: 8px 12px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <strong style="color: #EF4444; font-size: 0.85rem;">${this.escapeHtml(vz.titulo || vz.fonte || "Vazamento")}</strong>
                    <div style="font-size: 0.75rem; color: #94A3B8;">Alvo: ${this.escapeHtml(vz.alvo || vz.email || "")}</div>
                  </div>
                  ${vz.senha ? `<span style="background: rgba(239, 68, 68, 0.2); color: #FCA5A5; font-family: var(--font-mono); font-size: 0.75rem; padding: 2px 6px; border-radius: 4px;">Senha: ${this.escapeHtml(vz.senha)}</span>` : ""}
                </div>
              `).join("")}
            </div>
          `}
        </div>

        <!-- RODAPÉ DE CONFORMIDADE & LGPD -->
        <div style="margin-top: 24px; padding: 14px 18px; background: #0A0D14; border: 1px solid #1E2538; border-radius: 8px; font-size: 0.75rem; color: #64748B; text-align: center;">
          <strong style="color: #94A3B8;">TERMO DE CONFORMIDADE & SEGURANÇA DA INFORMAÇÃO:</strong> Documento emitido para fins de investigação legítima, prevenção a fraudes e auditoria cadastral nos termos da LGPD (Lei Federal 13.709/2018). Todos os acessos são auditados pela plataforma RimuBusca OSINT Core.
        </div>
      </div>
    `;

    return html;
  }

  // 6.3.4 CONSTRUÇÃO DE RELATÓRIO DARK ESPECÍFICO PARA EMPRESAS / CNPJ (PESSOA JURÍDICA)
  gerarHtmlRelatorioDarkCnpj(termo, fullResponse, dataPayload) {
    const data = dataPayload || {};
    const raw = fullResponse?.raw || {};
    const protocolo = `OSINT-CNPJ-${Date.now().toString(36).toUpperCase()}`;
    const dataEmissao = new Date().toLocaleString("pt-BR");
    const fonte = fullResponse?.fonte || "Receita Federal do Brasil / CNPJ";

    const cleanCnpj = String(data.cnpj_limpo || data.cnpj || termo || "").replace(/\D/g, "");
    const formattedCnpj = cleanCnpj.length === 14 ? this.formatCnpj(cleanCnpj) : (data.cnpj || termo || "Não informado");
    const corporateName = data.razaoSocial || data.razao_social || data.nome || "Razão Social Não Informada";
    const tradeName = data.nomeFantasia || data.nome_fantasia || "Não informado";
    const status = String(data.situacaoCadastral || data.descricao_situacao_cadastral || data.situacao || "ATIVA").toUpperCase();

    const formatDateBr = (val) => {
      if (!val) return "Não informada";
      const str = String(val).trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        const [y, m, d] = str.slice(0, 10).split("-");
        return `${d}/${m}/${y}`;
      }
      return str;
    };

    const openingDate = formatDateBr(data.dataAbertura || data.data_inicio_atividade);
    const statusDateRaw = data.dataSituacaoCadastral || data.data_situacao_cadastral || raw.dataSituacaoCadastral || null;
    const statusDate = statusDateRaw ? formatDateBr(statusDateRaw) : null;
    const statusReason = data.motivoSituacaoCadastral || data.descricao_motivo_situacao_cadastral || raw.motivoSituacaoCadastral || null;

    const legalNature = data.naturezaJuridica || data.natureza_juridica || "Não informada";
    const companySize = data.porte || data.porteEmpresa || "Não informado";
    const headquartersType =
      data.tipoMatrizFilial ||
      data.descricao_identificador_matriz_filial ||
      (cleanCnpj.length === 14 && cleanCnpj.slice(8, 12) !== "0001" ? "FILIAL" : "MATRIZ");

    const shareCapital =
      typeof data.capitalSocial === "number"
        ? Number(data.capitalSocial).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
        : (data.capitalSocial || data.capital_social || "Não informado");

    // CNAE Principal
    let cnaePrincipalCode = "";
    let cnaePrincipalDesc = "Não especificado";
    if (data.cnaePrincipal && typeof data.cnaePrincipal === "object") {
      cnaePrincipalCode = data.cnaePrincipal.codigo ? String(data.cnaePrincipal.codigo) : "";
      cnaePrincipalDesc = data.cnaePrincipal.descricao || "Não especificado";
    } else if (data.cnaePrincipal) {
      cnaePrincipalDesc = String(data.cnaePrincipal);
    } else if (data.cnae_fiscal) {
      cnaePrincipalCode = String(data.cnae_fiscal);
      cnaePrincipalDesc = data.cnae_fiscal_descricao || "Não especificado";
    }

    // CNAEs Secundários
    const rawSecundarios = Array.isArray(data.cnaesSecundarios)
      ? data.cnaesSecundarios
      : Array.isArray(data.cnaes_secundarios)
        ? data.cnaes_secundarios
        : [];
    const cnaesSecundarios = rawSecundarios.filter((c) => c && (c.codigo || c.descricao));

    // Endereço e Contatos
    const fullAddress =
      data.endereco ||
      [
        [data.descricao_tipo_de_logradouro, data.logradouro].filter(Boolean).join(" "),
        data.numero ? `nº ${data.numero}` : null,
        data.complemento ? `(${data.complemento})` : null,
        data.bairro ? `- ${data.bairro}` : null,
        data.municipio ? `${data.municipio}/${data.uf || ""}` : null,
        data.cep ? `CEP ${this.formatCep(data.cep)}` : null,
      ]
        .filter(Boolean)
        .join(", ") ||
      "Endereço não cadastrado";

    const phone1 = data.telefone || data.ddd_telefone_1 || raw.telefone || null;
    const phone2 = data.telefone2 || data.ddd_telefone_2 || raw.telefone2 || null;
    const phonesList = Array.from(new Set([phone1, phone2].filter(Boolean).map((ph) => this.formatTelefone(ph))));
    const email = data.email || raw.email || null;

    // Quadro Societário (QSA)
    const sociosList = Array.isArray(data.sociosQSA)
      ? data.sociosQSA
      : Array.isArray(data.qsa)
        ? data.qsa
        : Array.isArray(data.socios)
          ? data.socios
          : Array.isArray(data.quadro_societario)
            ? data.quadro_societario
            : [];

    // Estilização da Situação Cadastral
    let statusColor = "#10B981";
    let statusBg = "rgba(16, 185, 129, 0.15)";
    let statusBorder = "rgba(16, 185, 129, 0.35)";
    if (status.includes("BAIXADA") || status.includes("INAPTA") || status.includes("CANCELADA") || status.includes("NULA")) {
      statusColor = "#EF4444";
      statusBg = "rgba(239, 68, 68, 0.15)";
      statusBorder = "rgba(239, 68, 68, 0.35)";
    } else if (status.includes("SUSPENSA")) {
      statusColor = "#F59E0B";
      statusBg = "rgba(245, 158, 11, 0.15)";
      statusBorder = "rgba(245, 158, 11, 0.35)";
    }

    const html = `
      <div class="dark-report-container" style="font-family: var(--font-sans, system-ui, sans-serif); color: #E2E8F0; line-height: 1.5;">

        <!-- ============================================================== -->
        <!-- BANNER DE CABEÇALHO DO RELATÓRIO EMPRESARIAL (CNPJ)           -->
        <!-- ============================================================== -->
        <div class="dark-report-card" style="background: radial-gradient(circle at 95% 10%, rgba(59, 130, 246, 0.18) 0%, transparent 65%), #0D111A; border: 1px solid rgba(59, 130, 246, 0.4); border-radius: 10px; padding: 22px; margin-bottom: 20px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
            <div style="flex: 1; min-width: 260px;">
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;">
                <span style="background: linear-gradient(135deg, #2563EB, #4F46E5); color: #FFFFFF; font-size: 0.72rem; font-weight: 800; padding: 3px 10px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.6px;">
                  RIMUBUSCA OSINT &bull; DOSSIÊ EMPRESARIAL
                </span>
                <span style="background: ${statusBg}; color: ${statusColor}; font-size: 0.72rem; font-weight: 700; padding: 3px 10px; border-radius: 4px; border: 1px solid ${statusBorder};">
                  ${this.escapeHtml(status)}
                </span>
                <span style="background: rgba(139, 92, 246, 0.15); color: #C4B5FD; font-size: 0.72rem; font-weight: 700; padding: 3px 10px; border-radius: 4px; border: 1px solid rgba(139, 92, 246, 0.3);">
                  ${this.escapeHtml(headquartersType)}
                </span>
              </div>
              <h1 style="font-size: 1.5rem; font-weight: 800; color: #FFFFFF; margin: 0; letter-spacing: 0.4px;">
                ${this.escapeHtml(corporateName)}
              </h1>
              <p style="color: #94A3B8; font-size: 0.825rem; margin-top: 6px; margin-bottom: 0;">
                CNPJ: <strong style="color: #60A5FA; font-family: var(--font-mono); font-size: 0.95rem;">${this.escapeHtml(formattedCnpj)}</strong>
                ${tradeName && tradeName !== "Não informado" ? ` &bull; Fantasia: <strong style="color: #F1F5F9;">${this.escapeHtml(tradeName)}</strong>` : ""}
              </p>
            </div>

            <div style="text-align: right; font-family: var(--font-mono); font-size: 0.78rem; color: #94A3B8; background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
              <div>PROTOCOLO: <strong style="color: #6EE7B7;">${protocolo}</strong></div>
              <div>EMISSÃO: <strong style="color: #F1F5F9;">${dataEmissao}</strong></div>
              <div>FONTE: <strong style="color: #60A5FA;">${this.escapeHtml(fonte)}</strong></div>
            </div>
          </div>
        </div>

        <!-- ============================================================== -->
        <!-- QUADRO DE INDICADORES RÁPIDOS                                  -->
        <!-- ============================================================== -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 22px;">
          <div class="dark-report-card" style="background: #0D111A; border: 1px solid #1E2538; padding: 12px 16px; border-radius: 8px;">
            <div style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase;">Situação Cadastral</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: ${statusColor}; font-family: var(--font-mono); margin-top: 2px;">${this.escapeHtml(status)}</div>
          </div>

          <div class="dark-report-card" style="background: #0D111A; border: 1px solid #1E2538; padding: 12px 16px; border-radius: 8px;">
            <div style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase;">Capital Social</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: #10B981; font-family: var(--font-mono); margin-top: 2px;">${this.escapeHtml(shareCapital)}</div>
          </div>

          <div class="dark-report-card" style="background: #0D111A; border: 1px solid #1E2538; padding: 12px 16px; border-radius: 8px;">
            <div style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase;">Data de Abertura</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: #FFFFFF; font-family: var(--font-mono); margin-top: 2px;">${this.escapeHtml(openingDate)}</div>
          </div>

          <div class="dark-report-card" style="background: #0D111A; border: 1px solid #1E2538; padding: 12px 16px; border-radius: 8px;">
            <div style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase;">Porte Empresarial</div>
            <div style="font-size: 1rem; font-weight: 800; color: #C4B5FD; margin-top: 4px;">${this.escapeHtml(companySize)}</div>
          </div>

          <div class="dark-report-card" style="background: #0D111A; border: 1px solid #1E2538; padding: 12px 16px; border-radius: 8px;">
            <div style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase;">Sócios (QSA)</div>
            <div style="font-size: 1.25rem; font-weight: 800; color: #60A5FA; font-family: var(--font-mono); margin-top: 2px;">${sociosList.length}</div>
          </div>
        </div>

        <!-- ============================================================== -->
        <!-- SEÇÃO 1: IDENTIFICAÇÃO FISCAL & CONSTITUIÇÃO                   -->
        <!-- ============================================================== -->
        <div class="dark-report-card" style="background: #0D111A; border: 1px solid #1E2538; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="font-size: 1.05rem; color: #60A5FA; margin-top: 0; margin-bottom: 14px; border-bottom: 1px solid #1E2538; padding-bottom: 8px;">
            Identificação Fiscal & Constituição Societária
          </h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px;">
            <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
              <span style="font-size: 0.7rem; color: #94A3B8; text-transform: uppercase; display: block;">Razão Social</span>
              <strong style="color: #FFFFFF; font-size: 0.85rem;">${this.escapeHtml(corporateName)}</strong>
            </div>

            <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
              <span style="font-size: 0.7rem; color: #94A3B8; text-transform: uppercase; display: block;">Nome Fantasia</span>
              <strong style="color: #F1F5F9; font-size: 0.85rem;">${this.escapeHtml(tradeName)}</strong>
            </div>

            <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
              <span style="font-size: 0.7rem; color: #94A3B8; text-transform: uppercase; display: block;">CNPJ & Classificação</span>
              <strong style="color: #60A5FA; font-size: 0.85rem; font-family: var(--font-mono);">${this.escapeHtml(formattedCnpj)} (${this.escapeHtml(headquartersType)})</strong>
            </div>

            <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
              <span style="font-size: 0.7rem; color: #94A3B8; text-transform: uppercase; display: block;">Natureza Jurídica</span>
              <strong style="color: #F1F5F9; font-size: 0.85rem;">${this.escapeHtml(legalNature)}</strong>
            </div>

            <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
              <span style="font-size: 0.7rem; color: #94A3B8; text-transform: uppercase; display: block;">Abertura & Porte</span>
              <strong style="color: #F1F5F9; font-size: 0.85rem;">${this.escapeHtml(openingDate)} &bull; ${this.escapeHtml(companySize)}</strong>
            </div>

            <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
              <span style="font-size: 0.7rem; color: #94A3B8; text-transform: uppercase; display: block;">Capital Social Registrado</span>
              <strong style="color: #10B981; font-size: 0.9rem; font-family: var(--font-mono);">${this.escapeHtml(shareCapital)}</strong>
            </div>

            ${
              statusDate
                ? `
              <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
                <span style="font-size: 0.7rem; color: #94A3B8; text-transform: uppercase; display: block;">Data da Situação Cadastral</span>
                <strong style="color: ${statusColor}; font-size: 0.85rem;">${this.escapeHtml(status)} em ${this.escapeHtml(statusDate)}</strong>
              </div>
            `
                : ""
            }

            ${
              statusReason
                ? `
              <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
                <span style="font-size: 0.7rem; color: #94A3B8; text-transform: uppercase; display: block;">Motivo da Situação Cadastral</span>
                <strong style="color: #F1F5F9; font-size: 0.85rem;">${this.escapeHtml(statusReason)}</strong>
              </div>
            `
                : ""
            }
          </div>
        </div>

        <!-- ============================================================== -->
        <!-- SEÇÃO 2: LOCALIZAÇÃO & CONTATOS CORPORATIVOS                   -->
        <!-- ============================================================== -->
        <div class="dark-report-card" style="background: #0D111A; border: 1px solid #1E2538; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="font-size: 1.05rem; color: #FCD34D; margin-top: 0; margin-bottom: 14px; border-bottom: 1px solid #1E2538; padding-bottom: 8px;">
            Localização & Contatos Registrados
          </h3>
          <div style="background: #080B11; padding: 12px 14px; border-radius: 6px; border: 1px solid #1E2538; margin-bottom: 12px;">
            <span style="font-size: 0.7rem; color: #94A3B8; text-transform: uppercase; display: block; margin-bottom: 3px;">Endereço Oficial (Receita Federal)</span>
            <strong style="color: #F1F5F9; font-size: 0.88rem;">${this.escapeHtml(fullAddress)}</strong>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;">
            <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
              <span style="font-size: 0.7rem; color: #94A3B8; text-transform: uppercase; display: block; margin-bottom: 4px;">Telefones Corporativos</span>
              ${
                phonesList.length > 0
                  ? `<div style="display: flex; gap: 8px; flex-wrap: wrap;">
                       ${phonesList.map((ph) => `<span style="background: #181F2E; color: #6EE7B7; font-family: var(--font-mono); font-size: 0.8rem; padding: 2px 8px; border-radius: 4px; border: 1px solid #334155;">${this.escapeHtml(ph)}</span>`).join("")}
                     </div>`
                  : `<span style="color: #64748B; font-size: 0.82rem;">Não cadastrado</span>`
              }
            </div>

            <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
              <span style="font-size: 0.7rem; color: #94A3B8; text-transform: uppercase; display: block; margin-bottom: 4px;">E-mail Corporativo</span>
              ${
                email
                  ? `<strong style="color: #60A5FA; font-family: var(--font-mono); font-size: 0.84rem; word-break: break-all;">${this.escapeHtml(email)}</strong>`
                  : `<span style="color: #64748B; font-size: 0.82rem;">Não cadastrado</span>`
              }
            </div>
          </div>
        </div>

        <!-- ============================================================== -->
        <!-- SEÇÃO 3: ATIVIDADES ECONÔMICAS (CNAE)                          -->
        <!-- ============================================================== -->
        <div class="dark-report-card" style="background: #0D111A; border: 1px solid #1E2538; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="font-size: 1.05rem; color: #6EE7B7; margin-top: 0; margin-bottom: 14px; border-bottom: 1px solid #1E2538; padding-bottom: 8px;">
            Classificação Nacional de Atividades Econômicas (CNAE)
          </h3>

          <div style="background: #080B11; padding: 12px 14px; border-radius: 6px; border: 1px solid rgba(16, 185, 129, 0.35); margin-bottom: ${cnaesSecundarios.length > 0 ? "14px" : "0"};">
            <span style="font-size: 0.7rem; color: #10B981; font-weight: 700; text-transform: uppercase; display: block; margin-bottom: 4px;">Atividade Econômica Principal</span>
            <div style="color: #FFFFFF; font-size: 0.88rem; font-weight: 700;">
              ${cnaePrincipalCode ? `<span style="font-family: var(--font-mono); color: #6EE7B7; margin-right: 6px;">${this.escapeHtml(cnaePrincipalCode)}</span> &mdash; ` : ""}${this.escapeHtml(cnaePrincipalDesc)}
            </div>
          </div>

          ${
            cnaesSecundarios.length > 0
              ? `
            <div>
              <div style="font-size: 0.74rem; color: #94A3B8; font-weight: 700; text-transform: uppercase; margin-bottom: 8px;">
                Atividades Econômicas Secundárias (${cnaesSecundarios.length})
              </div>
              <div style="display: grid; gap: 6px;">
                ${cnaesSecundarios
                  .map(
                    (c) => `
                  <div style="background: #080B11; padding: 8px 12px; border-radius: 5px; border: 1px solid #1E2538; font-size: 0.8rem; color: #E2E8F0;">
                    ${c.codigo ? `<strong style="font-family: var(--font-mono); color: #F59E0B; margin-right: 6px;">${this.escapeHtml(String(c.codigo))}</strong> &bull; ` : ""}${this.escapeHtml(c.descricao || "")}
                  </div>
                `
                  )
                  .join("")}
              </div>
            </div>
          `
              : ""
          }
        </div>

        <!-- ============================================================== -->
        <!-- SEÇÃO 4: QUADRO DE SÓCIOS E ADMINISTRADORES (QSA)              -->
        <!-- ============================================================== -->
        <div class="dark-report-card" style="background: #0D111A; border: 1px solid rgba(139, 92, 246, 0.35); border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1E2538; padding-bottom: 10px; margin-bottom: 14px; flex-wrap: wrap; gap: 8px;">
            <h3 style="font-size: 1.05rem; color: #A78BFA; margin: 0;">
              Quadro de Sócios e Administradores (QSA)
            </h3>
            <span style="background: rgba(139, 92, 246, 0.15); color: #C4B5FD; font-size: 0.75rem; font-weight: 700; padding: 2px 10px; border-radius: 4px; border: 1px solid rgba(139, 92, 246, 0.3);">
              ${sociosList.length} ${sociosList.length === 1 ? "Integrante" : "Integrantes"}
            </span>
          </div>

          ${
            sociosList.length > 0
              ? `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 12px;">
              ${sociosList
                .map((s, idx) => {
                  const nomeSocio = s.nome || s.nome_socio || s.nomeSocio || "Sócio Não Identificado";
                  const qualif = s.qualificacao || s.qualificacao_socio || s.qualificacaoSocio || "Sócio";
                  const rawDoc = String(s.cpf || s.cnpj_cpf_do_socio || s.documento || "").replace(/\D/g, "");
                  const docDisplay = s.documento || s.cnpj_cpf_do_socio || s.cpf || (rawDoc.length === 11 ? this.formatCpf(rawDoc) : rawDoc.length === 14 ? this.formatCnpj(rawDoc) : null);
                  const faixa = s.faixaEtaria || s.faixa_etaria || null;
                  const entrada = s.dataEntrada || s.data_entrada_sociedade ? formatDateBr(s.dataEntrada || s.data_entrada_sociedade) : null;

                  return `
                    <div style="background: #080B11; border: 1px solid #1E2538; border-left: 3px solid #8B5CF6; border-radius: 6px; padding: 12px 14px;">
                      <div style="font-size: 0.7rem; color: #A78BFA; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">
                        #${idx + 1} &bull; ${this.escapeHtml(qualif)}
                      </div>
                      <div style="font-weight: 800; color: #FFFFFF; font-size: 0.92rem; margin-bottom: 4px;">
                        ${this.escapeHtml(nomeSocio)}
                      </div>
                      ${
                        docDisplay
                          ? `<div style="font-family: var(--font-mono); font-size: 0.78rem; color: #6EE7B7;">Doc: ${this.escapeHtml(docDisplay)}</div>`
                          : ""
                      }
                      ${
                        entrada || faixa
                          ? `<div style="font-size: 0.74rem; color: #94A3B8; margin-top: 4px;">
                               ${entrada ? `Entrada: <strong style="color: #F1F5F9;">${this.escapeHtml(entrada)}</strong>` : ""}
                               ${entrada && faixa ? " &bull; " : ""}
                               ${faixa ? `Faixa: <strong style="color: #F1F5F9;">${this.escapeHtml(faixa)}</strong>` : ""}
                             </div>`
                          : ""
                      }
                    </div>
                  `;
                })
                .join("")}
            </div>
          `
              : `
            <div style="background: #080B11; border: 1px dashed #334155; border-radius: 6px; padding: 18px; text-align: center; color: #94A3B8; font-size: 0.85rem;">
              Nenhum sócio ou administrador listado no quadro societário oficial para este CNPJ (ex: Empresário Individual / MEI ou sem QSA público).
            </div>
          `
          }
        </div>

        <!-- ============================================================== -->
        <!-- COMPLIANCE PÚBLICO, SANÇÕES CGU & TRANSPARÊNCIA                -->
        <!-- ============================================================== -->
        ${
          window.OsintDarkReport && (this.currentComplianceData || fullResponse?.compliance || dataPayload?.compliance)
            ? window.OsintDarkReport.renderComplianceSection(this.currentComplianceData || fullResponse?.compliance || dataPayload?.compliance)
            : ""
        }

        <!-- ============================================================== -->
        <!-- RODAPÉ DE CONFORMIDADE & LGPD                                  -->
        <!-- ============================================================== -->
        <div style="margin-top: 24px; padding: 14px 18px; background: #0A0D14; border: 1px solid #1E2538; border-radius: 8px; font-size: 0.75rem; color: #64748B; text-align: center;">
          <strong style="color: #94A3B8;">TERMO DE CONFORMIDADE & SEGURANÇA DA INFORMAÇÃO:</strong> Documento emitido para fins de investigação empresarial legítima, prevenção a fraudes, due diligence e auditoria cadastral nos termos da LGPD (Lei Federal 13.709/2018). Todos os acessos são registrados e auditados pela plataforma RimuBusca OSINT Core.
        </div>
      </div>
    `;

    return html;
  }

  // 6.4 CONSTRUÇÃO DO HTML COMPLETO DO RELATÓRIO DARK OSINT
  gerarHtmlRelatorioDark(tipo, termo, fullResponse, personIndex = null) {
    const payload = fullResponse?.dados !== undefined ? fullResponse.dados : (fullResponse?.data !== undefined ? fullResponse.data : fullResponse);
    const tipoLower = String(tipo || fullResponse?.tipo || "").toLowerCase().trim();

    // CHECAGEM SE É CONSULTA DE CNPJ / PESSOA JURÍDICA
    const isCnpjQuery =
      tipoLower === "cnpj" ||
      tipoLower === "cnpj_puxar" ||
      tipoLower === "empresa" ||
      (!payload?.name && !payload?.cpf && (payload?.razaoSocial || payload?.razao_social || payload?.sociosQSA || payload?.qsa || (payload?.cnpj && (payload?.capitalSocial || payload?.cnaePrincipal || payload?.situacaoCadastral))));

    if (isCnpjQuery) {
      return this.gerarHtmlRelatorioDarkCnpj(termo, fullResponse, payload);
    }

    // CHECAGEM SE É CONSULTA DE FOTO BIOMÉTRICA
    const isFotoQuery =
      tipoLower === "foto" ||
      (!payload?.name && !payload?.cpf && Boolean(payload?.fotoBase64 || payload?.base64 || payload?.foto_url || payload?.foto));

    if (isFotoQuery && window.OsintDarkReport) {
      return window.OsintDarkReport.renderPhotoReport({
        termo,
        payload,
        moduleLabel: tipoLower.toUpperCase(),
        sourceLabel: "Biometria Cadastral / Detran",
      });
    }

    // CHECAGEM SE É CONSULTA DE OPERADORA / TELEFONIA (LINHA PURA)
    const isOperadoraQuery =
      tipoLower === "operadora" ||
      (tipoLower === "telefone" &&
        !Array.isArray(payload) &&
        !payload?.pessoas &&
        !payload?.resultados &&
        !payload?.name &&
        !payload?.cpf &&
        Boolean(payload?.operadora || payload?.operator || payload?.portabilidade || payload?.tipo_linha));

    if (isOperadoraQuery && window.OsintDarkReport) {
      return window.OsintDarkReport.renderPhoneCarrierReport({
        termo,
        payload,
        moduleLabel: tipoLower.toUpperCase(),
        sourceLabel: "Telecom / ANATEL",
      });
    }

    // CHECAGEM SE É CONSULTA DE VIZINHOS / RAIO GEOGRÁFICO
    const isNeighborsQuery =
      tipoLower === "vizinhos" ||
      (Array.isArray(payload) && payload.length > 0 && Boolean(payload[0]?.morador));

    if (isNeighborsQuery && window.OsintDarkReport) {
      return window.OsintDarkReport.renderNeighborsReport({
        termo,
        payload,
        moduleLabel: "VIZINHOS",
        sourceLabel: "Mapeamento de Vizinhança / CEP",
      });
    }

    // CHECAGEM SE É CONSULTA DE CEP / ENDEREÇO GEOGRÁFICO
    const isCepGeoQuery =
      (tipoLower === "cep" || tipoLower === "endereco" || tipoLower === "logradouro") &&
      ((!Array.isArray(payload) && Boolean(payload?.logradouro || payload?.codigoIbge || payload?.totalResidentesEstimados || payload?.cidade)) ||
        (Array.isArray(payload) && payload.length > 0 && !payload[0]?.cpf && !payload[0]?.name && !payload[0]?.nome));

    if (isCepGeoQuery && window.OsintDarkReport) {
      return window.OsintDarkReport.renderCepReport({
        termo,
        payload,
        moduleLabel: "CEP",
        sourceLabel: "DNE / Correios / IBGE",
      });
    }

    // CHECAGEM SE É CONSULTA DOCUMENTAL FOCADA (TÍTULO, RG, NIS, PIS SEM ARRAY DE PESSOA COMPLETA)
    const isFocusedDocQuery =
      ["titulo", "rg", "nis", "pis"].includes(tipoLower) &&
      payload &&
      !Array.isArray(payload) &&
      !payload?.pessoas?.length &&
      !payload?.telefones?.length &&
      !payload?.enderecos?.length &&
      !payload?.empresas_vinculadas?.length &&
      !payload?.parentes?.length;

    if (isFocusedDocQuery && window.OsintDarkReport) {
      return window.OsintDarkReport.renderDocumentReport({
        termo,
        payload,
        tipo: tipoLower,
        sourceLabel: "Base Civil / Federal",
      });
    }

    // CHECAGEM SE É CONSULTA DE VEÍCULO / PLACA
    const isVehicleQuery =
      tipoLower === "placa" ||
      tipoLower === "veiculo" ||
      (!payload?.name && !payload?.cpf && (payload?.plate || payload?.placa));

    if (isVehicleQuery) {
      return this.gerarHtmlRelatorioDarkVeiculo(termo, fullResponse, payload);
    }

    // CHECAGEM SE É CONSULTA DE PARENTES / ÁRVORE GENEALÓGICA
    const isRelativesQuery =
      tipoLower === "parentes" ||
      tipoLower === "parentesco" ||
      (!payload?.name && !payload?.cpf && (payload?.parentescos || (payload?.titular && Array.isArray(payload?.parentes))));

    if (isRelativesQuery) {
      return this.gerarHtmlRelatorioDarkParentes(termo, fullResponse, payload);
    }

    // CHECAGEM SE É CONSULTA DE EMAIL & IDENTIDADE DIGITAL
    const isEmailQuery =
      tipoLower === "email" ||
      tipoLower === "email_puxar" ||
      (!payload?.name && !payload?.cpf && (payload?.email || payload?.pessoas_vinculadas || payload?.perfil_google));

    if (isEmailQuery) {
      return this.gerarHtmlRelatorioDarkEmail(termo, fullResponse, payload);
    }

    const allPersons = this.extractPersons(fullResponse);
    const isSinglePerson = personIndex !== null && typeof personIndex === "number";
    const persons = isSinglePerson ? [allPersons[personIndex]].filter(Boolean) : allPersons;

    const protocolo = `OSINT-${Date.now().toString(36).toUpperCase()}`;
    const dataEmissao = new Date().toLocaleString("pt-BR");
    const tipoUpper = String(tipo || "CONSULTA").toUpperCase();
    const fonte = fullResponse?.fonte || "RimuAPI Intelligence Engine (Live)";
    const termoFmt = tipoUpper === "TELEFONE" ? this.formatTelefone(termo) : tipoUpper === "CPF" ? this.formatCpf(termo) : termo;

    // Métricas
    const totalAlvos = persons.length;
    let falecidosCount = 0;
    let regularesCount = 0;
    let veiculosCount = 0;
    let empresasCount = 0;

    persons.forEach((p) => {
      const sit = String(p.situacao_receita || p.situacaoCadastral || p.status || "").toUpperCase();
      if (p.falecido === true || sit.includes("FALECIDO")) falecidosCount++;
      else regularesCount++;

      const v = Array.isArray(p.veiculos) ? p.veiculos : Array.isArray(p.vehicles) ? p.vehicles : [];
      veiculosCount += v.length;

      const emp = Array.isArray(p.empresas_vinculadas) ? p.empresas_vinculadas : Array.isArray(p.empresas) ? p.empresas : [];
      empresasCount += emp.length;
    });

    let html = `
      <div class="dark-report-container" style="font-family: var(--font-sans, system-ui, sans-serif); color: #E2E8F0; line-height: 1.5;">
        
        <!-- ============================================================== -->
        <!-- BANNER DE CABEÇALHO DO RELATÓRIO                              -->
        <!-- ============================================================== -->
        <div class="dark-report-card" style="background: radial-gradient(circle at 95% 10%, rgba(139, 92, 246, 0.18) 0%, transparent 65%), #0D111A; border: 1px solid rgba(139, 92, 246, 0.4); border-radius: 10px; padding: 22px; margin-bottom: 20px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span style="background: linear-gradient(135deg, #7C3AED, #4F46E5); color: #FFFFFF; font-size: 0.72rem; font-weight: 800; padding: 3px 10px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.6px;">
                  RIMUBUSCA OSINT
                </span>
                <span style="background: rgba(239, 68, 68, 0.15); color: #FCA5A5; font-size: 0.72rem; font-weight: 700; padding: 3px 10px; border-radius: 4px; border: 1px solid rgba(239, 68, 68, 0.3);">
                  CONFIDENCIAL &bull; ACESSO AUDITADO
                </span>
              </div>
              <h1 style="font-size: 1.55rem; font-weight: 800; color: #FFFFFF; margin: 0; letter-spacing: 0.5px;">
                DOSSIÊ DE INTELIGÊNCIA CADASTRAL
              </h1>
              <p style="color: #94A3B8; font-size: 0.825rem; margin-top: 5px; margin-bottom: 0;">
                Módulo Consultado: <strong style="color: #C4B5FD;">${tipoUpper}</strong> &bull; Alvo: <strong style="color: #6EE7B7; font-family: var(--font-mono);">${this.escapeHtml(termoFmt)}</strong>
              </p>
            </div>

            <div style="text-align: right; font-family: var(--font-mono); font-size: 0.78rem; color: #94A3B8; background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
              <div>PROTOCOLO: <strong style="color: #6EE7B7;">${protocolo}</strong></div>
              <div>EMISSÃO: <strong style="color: #F1F5F9;">${dataEmissao}</strong></div>
              <div>FONTE: <strong style="color: #A78BFA;">${this.escapeHtml(fonte)}</strong></div>
            </div>
          </div>
        </div>

        <!-- ============================================================== -->
        <!-- QUADRO DE MÉTRICAS & INDICADORES RÁPIDOS                      -->
        <!-- ============================================================== -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 22px;">
          <div class="dark-report-card" style="background: #0D111A; border: 1px solid #1E2538; padding: 12px 16px; border-radius: 8px;">
            <div style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase;">Total de Registros</div>
            <div style="font-size: 1.4rem; font-weight: 800; color: #FFFFFF; font-family: var(--font-mono); margin-top: 2px;">${totalAlvos}</div>
          </div>

          <div class="dark-report-card" style="background: #0D111A; border: 1px solid #1E2538; padding: 12px 16px; border-radius: 8px;">
            <div style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase;">Regulares na Receita</div>
            <div style="font-size: 1.4rem; font-weight: 800; color: #10B981; font-family: var(--font-mono); margin-top: 2px;">${regularesCount}</div>
          </div>

          <div class="dark-report-card" style="background: #0D111A; border: 1px solid #1E2538; padding: 12px 16px; border-radius: 8px;">
            <div style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase;">Óbitos / Falecidos</div>
            <div style="font-size: 1.4rem; font-weight: 800; color: ${falecidosCount > 0 ? '#EF4444' : '#64748B'}; font-family: var(--font-mono); margin-top: 2px;">${falecidosCount}</div>
          </div>

          <div class="dark-report-card" style="background: #0D111A; border: 1px solid #1E2538; padding: 12px 16px; border-radius: 8px;">
            <div style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase;">Veículos Vinculados</div>
            <div style="font-size: 1.4rem; font-weight: 800; color: #38BDF8; font-family: var(--font-mono); margin-top: 2px;">${veiculosCount}</div>
          </div>

          <div class="dark-report-card" style="background: #0D111A; border: 1px solid #1E2538; padding: 12px 16px; border-radius: 8px;">
            <div style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase;">Empresas / QSA</div>
            <div style="font-size: 1.4rem; font-weight: 800; color: #2DD4BF; font-family: var(--font-mono); margin-top: 2px;">${empresasCount}</div>
          </div>
        </div>
    `;

    // DETECÇÃO AUTOMÁTICA DE ANOMALIAS FORENSES (SMART FLAGS)
    if (window.OsintDarkReport && typeof window.OsintDarkReport.detectForensicAnomalies === "function") {
      try {
        const anomalies = window.OsintDarkReport.detectForensicAnomalies(payload, termo);
        html += window.OsintDarkReport.renderSmartFlagsSection(anomalies);
      } catch (err) {
        console.warn("[SMART FLAGS ERROR IN CONSULTA]:", err);
      }
    }

    // Se encontramos pessoas estruturadas
    if (persons.length > 0) {
      persons.forEach((p, idx) => {
        const rawCpf = String(p.cpf || "").replace(/\D/g, "");
        const formattedCpf = this.formatCpf(rawCpf);
        const nome = p.name || p.nome || "NOME NÃO INFORMADO";
        const birthDate = p.birth_date ? String(p.birth_date).slice(0, 10).split("-").reverse().join("/") : (p.dataNascimento || "N/I");
        const age = p.birth_date ? this.calculateAge(p.birth_date) : null;
        const mother = p.mother_name || p.nomeMae || p.nome_mae || "Não informada";
        const father = p.father_name || p.nomePai || p.nome_pai || "Não informado";
        const situacaoReceita = String(p.situacao_receita || p.situacaoCadastral || p.status || "REGULAR").toUpperCase();
        const isFalecido = p.falecido === true || situacaoReceita.includes("FALECIDO");
        const occupation = p.occupation || p.profissao || "Não informada";
        const rawIncome = p.income ?? p.renda ?? null;
        const parsedIncome = typeof rawIncome === "number"
          ? rawIncome
          : Number(String(rawIncome || "").replace(/R\$/gi, "").trim().replace(/\./g, "").replace(",", "."));
        const incomeFmt =
          rawIncome !== null && rawIncome !== "" && Number.isFinite(parsedIncome) && parsedIncome > 0
            ? parsedIncome.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
            : (p.renda_formatada && p.renda_formatada !== "Não informada" ? String(p.renda_formatada) : "N/I");
        const rawGender = p.gender || p.sexo || "";
        const gender = rawGender === "M" ? "Masculino" : rawGender === "F" ? "Feminino" : rawGender || "N/I";
        const rgIssuer = p.rg_issuer || p.rg_emissor || "";
        const rg = p.rg ? `${p.rg}${rgIssuer ? ` (${rgIssuer})` : ""}` : "N/I";

        // Endereço (suporta objeto estruturado, enderecos[0] ou string formatada)
        const rawAddr = p.address || p.endereco;
        const structuredAddr =
          (Array.isArray(p.enderecos) && p.enderecos[0]) ||
          (Array.isArray(p.all_addresses) && p.all_addresses[0]) ||
          (rawAddr && typeof rawAddr === "object" ? rawAddr : null) ||
          {};
        const street = structuredAddr.street || structuredAddr.logradouro || "";
        const number = structuredAddr.number || structuredAddr.numero || "S/N";
        const neighborhood = structuredAddr.neighborhood || structuredAddr.bairro || "";
        const city = structuredAddr.city || structuredAddr.cidade || p.city || p.cidade || "";
        const state = structuredAddr.state || structuredAddr.uf || p.state || p.uf || "";
        const cep = this.formatCep(structuredAddr.zip_code || structuredAddr.cep || p.cep);
        const fullAddress =
          (typeof rawAddr === "string" && rawAddr.trim()
            ? rawAddr.trim()
            : [
                street ? `${street}, ${number}` : "",
                neighborhood,
                city ? `${city} - ${state}` : state,
                cep && cep !== "N/I" ? `CEP ${cep}` : "",
              ]
                .filter(Boolean)
                .join(" • ")) || "Endereço não cadastrado";

        // Telefones (desembrulha objetos { numero, formatado } ou strings)
        const phonesList =
          Array.isArray(p.phones) && p.phones.length > 0
            ? p.phones
            : Array.isArray(p.telefones) && p.telefones.length > 0
              ? p.telefones
              : p.phone
                ? [p.phone]
                : p.telefone
                  ? [p.telefone]
                  : [];
        const cleanPhones = Array.from(
          new Set(
            phonesList
              .map((ph) => {
                const rawPh = typeof ph === "object" && ph !== null ? (ph.numero || ph.number || ph.telefone || ph.formatado || "") : ph;
                return String(rawPh || "").replace(/\D/g, "");
              })
              .filter(Boolean)
          )
        );

        // Veículos
        const veiculosList = Array.isArray(p.veiculos) ? p.veiculos : Array.isArray(p.vehicles) ? p.vehicles : [];

        // Empresas
        const empresasList = Array.isArray(p.empresas_vinculadas) ? p.empresas_vinculadas : Array.isArray(p.empresas) ? p.empresas : [];

        // E-mails
        const emailsList = Array.isArray(p.emails) ? p.emails : p.email ? [p.email] : [];

        html += `
          <div class="dark-report-card" style="background: #0D111A; border: 1px solid #1E2538; border-left: 5px solid ${isFalecido ? '#EF4444' : '#10B981'}; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            
            <!-- Topo do Card de Titular -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; border-bottom: 1px solid #1E2538; padding-bottom: 14px; margin-bottom: 16px;">
              <div>
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px;">
                  <span style="background: #181F2E; color: #C4B5FD; font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; font-family: var(--font-mono);">
                    #${idx + 1} &bull; TITULAR
                  </span>
                  ${
                    isFalecido
                      ? `<span style="background: rgba(239, 68, 68, 0.2); color: #FCA5A5; border: 1px solid rgba(239, 68, 68, 0.4); font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 4px;">
                           TITULAR FALECIDO
                         </span>`
                      : `<span style="background: rgba(16, 185, 129, 0.2); color: #6EE7B7; border: 1px solid rgba(16, 185, 129, 0.4); font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 4px;">
                           SITUAÇÃO REGULAR (RECEITA FEDERAL)
                         </span>`
                  }
                </div>
                <h2 style="font-size: 1.35rem; font-weight: 800; color: #FFFFFF; margin: 0;">
                  ${this.escapeHtml(nome)}
                </h2>
                <div style="font-family: var(--font-mono); font-size: 1.05rem; font-weight: 700; color: #6EE7B7; margin-top: 4px;">
                  ${formattedCpf}
                </div>
              </div>
            </div>

            <!-- Dados Cadastrais Detalhados -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; margin-bottom: 14px;">
              <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
                <span style="font-size: 0.7rem; color: #94A3B8; text-transform: uppercase; display: block;">Nascimento & Idade</span>
                <strong style="color: #FFFFFF; font-size: 0.85rem;">${birthDate} ${age !== null ? `(${age} anos)` : ""}</strong>
              </div>

              <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
                <span style="font-size: 0.7rem; color: #94A3B8; text-transform: uppercase; display: block;">Filiação (Mãe)</span>
                <strong style="color: #FFFFFF; font-size: 0.85rem;" title="${this.escapeHtml(mother)}">${this.escapeHtml(mother)}</strong>
              </div>

              <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
                <span style="font-size: 0.7rem; color: #94A3B8; text-transform: uppercase; display: block;">Filiação (Pai)</span>
                <strong style="color: #FFFFFF; font-size: 0.85rem;">${this.escapeHtml(father)}</strong>
              </div>

              <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
                <span style="font-size: 0.7rem; color: #94A3B8; text-transform: uppercase; display: block;">Gênero & RG</span>
                <strong style="color: #FFFFFF; font-size: 0.85rem;">${gender} &bull; ${rg}</strong>
              </div>

              <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
                <span style="font-size: 0.7rem; color: #94A3B8; text-transform: uppercase; display: block;">Profissão</span>
                <strong style="color: #FFFFFF; font-size: 0.85rem;">${this.escapeHtml(occupation)}</strong>
              </div>

              <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
                <span style="font-size: 0.7rem; color: #94A3B8; text-transform: uppercase; display: block;">Renda Estimada</span>
                <strong style="color: #10B981; font-size: 0.85rem; font-family: var(--font-mono);">${incomeFmt}</strong>
              </div>
            </div>

            <!-- Endereço Cadastrado -->
            <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538; margin-bottom: 14px;">
              <span style="font-size: 0.7rem; color: #94A3B8; text-transform: uppercase; display: block; margin-bottom: 2px;">Endereço Residencial / Comercial</span>
              <strong style="color: #F1F5F9; font-size: 0.825rem;">${this.escapeHtml(fullAddress)}</strong>
            </div>

            <!-- Telefones Vinculados -->
            ${
              cleanPhones.length > 0
                ? `
              <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538; margin-bottom: 14px;">
                <span style="font-size: 0.7rem; color: #94A3B8; text-transform: uppercase; display: block; margin-bottom: 6px;">Telecomunicações (${cleanPhones.length} números mapeados)</span>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                  ${cleanPhones
                    .map((ph) => `<span style="background: #181F2E; color: #6EE7B7; font-family: var(--font-mono); font-size: 0.75rem; padding: 3px 8px; border-radius: 4px; border: 1px solid #334155;">${this.formatTelefone(ph)}</span>`)
                    .join("")}
                </div>
              </div>
            `
                : ""
            }

            <!-- Veículos Vinculados -->
            ${
              veiculosList.length > 0
                ? `
              <div style="background: #080B11; padding: 12px 14px; border-radius: 6px; border: 1px solid rgba(56, 189, 248, 0.3); margin-bottom: 14px;">
                <span style="font-size: 0.72rem; color: #38BDF8; font-weight: 700; text-transform: uppercase; display: block; margin-bottom: 8px;">
                  Veículos Automotores Registrados (${veiculosList.length})
                </span>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  ${veiculosList
                    .map((v) => {
                      const vPlate = String(v.plate || v.placa || v.PLACA || "N/A").toUpperCase();
                      const vModel = v.marcaModelo || v.model || v.modelo || v.MARCA || v.MODELO || (Array.isArray(v.years) ? `Ano ${v.years.join("/")}` : "Veículo");
                      const vRenavam = v.renavam || v.RENAVAM || "";
                      const vChassi = v.chassi || v.CHASSI || "";
                      const vMotor = v.motor || v.MOTOR || "";
                      return `
                      <div style="background: #0D111A; border: 1px solid #1E2538; border-radius: 6px; padding: 8px 12px; font-size: 0.8rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                        <div>
                          <strong style="font-family: var(--font-mono); color: #38BDF8; font-size: 1rem; letter-spacing: 1px;">${vPlate}</strong>
                          <span style="color: #F1F5F9; margin-left: 8px; font-weight: 700;">${this.escapeHtml(vModel)}</span>
                        </div>
                        <div style="font-family: var(--font-mono); font-size: 0.75rem; color: #94A3B8; display: flex; gap: 10px; flex-wrap: wrap;">
                          ${vChassi && vChassi !== "NÃO INFORMADO" ? `<span>Chassi: <strong style="color: #CBD5E1;">${vChassi}</strong></span>` : ""}
                          ${vRenavam && vRenavam !== "NÃO INFORMADO" ? `<span>Renavam: <strong style="color: #6EE7B7;">${vRenavam}</strong></span>` : ""}
                          ${vMotor && vMotor !== "N/I" ? `<span>Motor: <strong style="color: #E2E8F0;">${vMotor}</strong></span>` : ""}
                        </div>
                      </div>
                    `;
                    })
                    .join("")}
                </div>
              </div>
            `
                : ""
            }

            <!-- Histórico Vacinal COVID-19 & Locais de Vacinação (SUS) -->
            ${
              Array.isArray(p.vacinas_covid || p.covid || p.raw?.COVID) && (p.vacinas_covid || p.covid || p.raw?.COVID).length > 0
                ? `
              <div style="background: #080B11; padding: 12px 14px; border-radius: 6px; border: 1px solid rgba(236, 72, 153, 0.3); margin-bottom: 14px;">
                <span style="font-size: 0.72rem; color: #EC4899; font-weight: 700; text-transform: uppercase; display: block; margin-bottom: 8px;">
                  Histórico Vacinal COVID-19 & Postos de Aplicação (${(p.vacinas_covid || p.covid || p.raw?.COVID).length} Doses)
                </span>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  ${(p.vacinas_covid || p.covid || p.raw?.COVID)
                    .map((vac) => {
                      const dose = vac.dose || vac.DESCRICAO_DA_VACINA || vac.DOSE || "Dose";
                      const vacNome = vac.vacina || vac.NOME_DA_VACINA || "COVID-19";
                      const data = vac.dataAplicacao || vac.DATA_DE_APLICACAO || vac.DATA_APLICACAO || "N/I";
                      const local = vac.localCompleto || vac.estabelecimento || vac.NOME_DO_ESTABELECIMENTO || vac.ESTABELECIMENTO || "Posto Municipal";
                      const lote = vac.lote || vac.LOTE_DA_VACINA || vac.LOTE || "";
                      return `
                      <div style="background: #0D111A; border: 1px solid #1E2538; border-radius: 4px; padding: 8px 12px; font-size: 0.78rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
                          <strong style="color: #F472B6;">${this.escapeHtml(dose)}: ${this.escapeHtml(vacNome)}</strong>
                          <span style="font-family: var(--font-mono); color: #10B981; font-weight: 700;">📅 ${data}</span>
                        </div>
                        <div style="color: #94A3B8; margin-top: 4px; font-size: 0.75rem;">
                          📍 Posto / Local: <strong style="color: #F1F5F9;">${this.escapeHtml(local)}</strong>
                          ${lote ? ` &bull; Lote: <span style="font-family: var(--font-mono); color: #C4B5FD;">${this.escapeHtml(lote)}</span>` : ""}
                        </div>
                      </div>
                    `;
                    })
                    .join("")}
                </div>
              </div>
            `
                : ""
            }

            <!-- Dados Bancários Vinculados -->
            ${
              Array.isArray(p.dadosBancarios || p.raw?.DADOS_BANCARIOS) && (p.dadosBancarios || p.raw?.DADOS_BANCARIOS).length > 0
                ? `
              <div style="background: #080B11; padding: 12px 14px; border-radius: 6px; border: 1px solid rgba(59, 130, 246, 0.3); margin-bottom: 14px;">
                <span style="font-size: 0.72rem; color: #60A5FA; font-weight: 700; text-transform: uppercase; display: block; margin-bottom: 8px;">
                  Instituições Bancárias & Contas Cadastradas (${(p.dadosBancarios || p.raw?.DADOS_BANCARIOS).length})
                </span>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                  ${(p.dadosBancarios || p.raw?.DADOS_BANCARIOS)
                    .map((b) => {
                      const bNome = b.banco || b.INSTITUICAO || b.BANCO || "Instituição";
                      const bAg = b.agencia || b.AGENCIA || "N/I";
                      return `
                      <div style="background: #0D111A; border: 1px solid #1E2538; border-radius: 4px; padding: 6px 12px; font-size: 0.75rem;">
                        <strong style="color: #60A5FA;">${this.escapeHtml(bNome)}</strong>
                        <span style="color: #94A3B8; margin-left: 6px;">Agência: <strong style="color: #F1F5F9; font-family: var(--font-mono);">${this.escapeHtml(bAg)}</strong></span>
                      </div>
                    `;
                    })
                    .join("")}
                </div>
              </div>
            `
                : ""
            }

            <!-- Empresas / QSA Vinculadas -->
            ${
              empresasList.length > 0
                ? `
              <div style="background: #080B11; padding: 12px 14px; border-radius: 6px; border: 1px solid rgba(45, 212, 191, 0.3); margin-bottom: 14px;">
                <span style="font-size: 0.72rem; color: #2DD4BF; font-weight: 700; text-transform: uppercase; display: block; margin-bottom: 8px;">
                  Participações Societárias & Empresas QSA (${empresasList.length})
                </span>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px;">
                  ${empresasList
                    .map((emp) => {
                      const cnpjFmt = this.formatCnpj(emp.cnpj);
                      const nomeEmp = emp.nome_fantasia ? `${emp.nome_fantasia} (${emp.razao_social || ""})` : emp.razao_social || "Empresa Cadastrada";
                      const sit = emp.situacao || "ATIVA";
                      const qual = emp.qualificacao_socio || "Sócio";
                      return `
                      <div style="background: #0D111A; border: 1px solid #1E2538; border-radius: 4px; padding: 8px 12px; font-size: 0.75rem;">
                        <div style="font-weight: 700; color: #FFFFFF; font-size: 0.8rem;">${this.escapeHtml(nomeEmp)}</div>
                        <div style="display: flex; gap: 8px; align-items: center; margin-top: 4px;">
                          <span style="font-family: var(--font-mono); color: #2DD4BF;">CNPJ: ${cnpjFmt}</span>
                          <span style="background: rgba(16, 185, 129, 0.15); color: #10B981; padding: 1px 6px; border-radius: 3px; font-size: 0.68rem;">${sit}</span>
                        </div>
                        <div style="color: #94A3B8; margin-top: 2px;">Qualificação: <strong style="color: #F1F5F9;">${this.escapeHtml(qual)}</strong></div>
                      </div>
                    `;
                    })
                    .join("")}
                </div>
              </div>
            `
                : ""
            }

            <!-- E-mails Vinculados -->
            ${
              emailsList.length > 0
                ? `
              <div style="background: #080B11; padding: 10px 14px; border-radius: 6px; border: 1px solid #1E2538;">
                <span style="font-size: 0.7rem; color: #94A3B8; text-transform: uppercase; display: block; margin-bottom: 6px;">Endereços de E-mail</span>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                  ${emailsList.map((em) => `<span style="background: #181F2E; color: #F472B6; font-family: var(--font-mono); font-size: 0.75rem; padding: 3px 8px; border-radius: 4px;">${this.escapeHtml(em)}</span>`).join("")}
                </div>
              </div>
            `
                : ""
            }

          </div>
        `;
      });
    } else {
      // Fallback estruturado sem despejo de JSON bruto
      const fallbackData = fullResponse?.dados !== undefined ? fullResponse.dados : (fullResponse || {});
      html += window.OsintDarkReport
        ? window.OsintDarkReport.renderGenericBody(fallbackData)
        : `
        <div class="dark-report-card" style="background: #0D111A; border: 1px solid #1E2538; border-radius: 8px; padding: 20px;">
          <h3 style="font-size: 1.1rem; color: #A78BFA; margin-top: 0;">Dados Retornados da Consulta</h3>
          <pre style="background: #080B11; padding: 14px; border-radius: 6px; border: 1px solid #1E2538; font-family: var(--font-mono); font-size: 0.8rem; color: #C4B5FD; overflow-x: auto; max-height: 400px;"><code>${this.escapeHtml(JSON.stringify(fallbackData, null, 2))}</code></pre>
        </div>
      `;
    }

    // Anexa seção de Compliance Público ao dossiê de pessoa (CPF/Nome) quando disponível
    if (window.OsintDarkReport && (this.currentComplianceData || fullResponse?.compliance)) {
      html += window.OsintDarkReport.renderComplianceSection(this.currentComplianceData || fullResponse?.compliance);
    }

    // CERTIFICADO OFICIAL DE CADEIA DE CUSTÓDIA FORENSE (SHA-256)
    if (window.OsintDarkReport && typeof window.OsintDarkReport.renderChainOfCustodySection === "function") {
      try {
        html += window.OsintDarkReport.renderChainOfCustodySection({
          termo: termoFmt,
          payload: payload || fullResponse,
          moduleLabel: tipoUpper,
          sourceLabel: fonte,
          protocolId: protocolo,
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        console.warn("[CHAIN OF CUSTODY ERROR IN CONSULTA]:", err);
      }
    }

    // Rodapé de Conformidade & LGPD
    html += `
        <div style="margin-top: 24px; padding: 14px 18px; background: #0A0D14; border: 1px solid #1E2538; border-radius: 8px; font-size: 0.75rem; color: #64748B; text-align: center;">
          <strong style="color: #94A3B8;">TERMO DE CONFORMIDADE & SEGURANÇA DA INFORMAÇÃO:</strong> Documento emitido para fins de investigação legítima, prevenção a fraudes e auditoria de conformidade cadastral nos termos da LGPD (Lei Federal 13.709/2018). Todos os acessos são registrados e auditados pela plataforma RimuBusca OSINT Core.
        </div>
      </div>
    `;

    return html;
  }

  // 6.5 DOWNLOAD DO RELATÓRIO STANDALONE COMO HTML ESCURO
  downloadRelatorioHtml(filename, htmlContent) {
    const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(filename.replace(/\.html$/, ""))}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 24px;
      background-color: #080B11 !important;
      color: #E2E8F0 !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.5;
    }
    .dark-report-container {
      max-width: 1000px;
      margin: 0 auto;
    }
    .dark-report-card {
      background: #0D111A !important;
      border: 1px solid #1E2538 !important;
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 16px;
    }
    @media print {
      body { padding: 0 !important; background-color: #080B11 !important; }
      *, *::before, *::after {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      .dark-report-card {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
    }
  </style>
</head>
<body>
  <div class="dark-report-container">
    ${htmlContent}
  </div>
</body>
</html>`;

    const blob = new Blob([fullHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
    window.toast?.success("Relatório HTML exportado com sucesso!");
  }

  // 6.6 CONVERSÃO E EXPORTAÇÃO DIRETA DE HTML PARA PDF (ISOLATED PDF EXPORT)
  exportarRelatorioPdf() {
    const contentEl = document.getElementById("modalRelatorioContent");
    if (!contentEl) return;

    const btnPdf = document.getElementById("btnGerarPdfRelatorio") || document.getElementById("btnPrintRelatorioDark");
    const originalHtml = btnPdf ? btnPdf.innerHTML : "";

    if (btnPdf) {
      btnPdf.disabled = true;
      btnPdf.innerHTML = `
        <i data-lucide="loader-2" style="width: 14px; height: 14px; animation: spin 0.8s linear infinite;"></i>
        <span>Preparando PDF...</span>
      `;
      if (window.lucide) window.lucide.createIcons({ root: btnPdf });
    }

    const targetTerm =
      this.currentData?.dados?.cpf ||
      this.currentData?.cpf ||
      this.currentData?.termo ||
      this.currentData?.dados?.placa ||
      this.currentData?.placa ||
      this.currentData?.dados?.cnpj ||
      this.currentData?.cnpj ||
      "alvo";
    const termoClean = String(targetTerm).replace(/\D/g, "") || String(targetTerm).trim().replace(/[^a-zA-Z0-9_-]/g, "_");
    const docTitle = `${termoClean}_relatorio_rimubuscas`;

    // Cria um iframe isolado para imprimir EXCLUSIVAMENTE o dossiê (sem nenhuma parte da página web de fundo)
    const printFrame = document.createElement("iframe");
    printFrame.style.position = "fixed";
    printFrame.style.top = "-99999px";
    printFrame.style.left = "-99999px";
    printFrame.style.width = "1024px";
    printFrame.style.height = "100%";
    printFrame.style.border = "none";
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow.document;
    frameDoc.open();
    frameDoc.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${this.escapeHtml(docTitle)}</title>
  <style>
    @page {
      margin: 8mm;
      size: A4 portrait;
      background: #080B11;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      background-color: #080B11 !important;
      background: #080B11 !important;
      color: #E2E8F0 !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.45;
    }
    .dark-report-container {
      width: 100%;
      margin: 0;
      padding: 0;
    }
    .dark-report-card {
      background: #0D111A !important;
      border: 1px solid #1E2538 !important;
      border-radius: 8px;
      padding: 14px 18px;
      margin-bottom: 12px;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    @media print {
      body {
        background-color: #080B11 !important;
      }
      .dark-report-card {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
    }
  </style>
</head>
<body>
  <div class="dark-report-container">
    ${contentEl.innerHTML}
  </div>
</body>
</html>`);
    frameDoc.close();

    setTimeout(() => {
      try {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
        window.toast?.success("Janela de exportação do PDF preparada com sucesso!");
      } catch (err) {
        console.error("[ERRO IMPRESSÃO IFRAME]:", err);
        // Fallback para impressão direta na página com a regra CSS de ocultar o layout
        document.body.classList.add("printing-modal-report");
        window.print();
        setTimeout(() => document.body.classList.remove("printing-modal-report"), 1000);
      } finally {
        setTimeout(() => {
          if (printFrame.parentNode) printFrame.parentNode.removeChild(printFrame);
          if (btnPdf) {
            btnPdf.disabled = false;
            btnPdf.innerHTML = originalHtml;
            if (window.lucide) window.lucide.createIcons({ root: btnPdf });
          }
        }, 1500);
      }
    }, 400);
  }

  calculateAge(dateStr) {
    if (!dateStr) return null;
    const birth = new Date(dateStr);
    if (isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age >= 0 ? age : null;
  }

  showState(state, errorMsg = "") {
    const loading = document.getElementById("consultaLoading");
    const error = document.getElementById("consultaError");
    const results = document.getElementById("consultaResults");
    const errorMsgSpan = document.getElementById("consultaErrorMessage");

    if (loading) loading.style.display = state === "loading" ? "block" : "none";
    if (error) error.style.display = state === "error" ? "block" : "none";
    if (results) results.style.display = state === "results" ? "block" : "none";

    if (state === "error" && errorMsgSpan) {
      errorMsgSpan.textContent = errorMsg;
    }
  }

  // UTILS & FORMATTERS
  formatCpf(val) {
    if (!val) return "Não informado";
    const clean = String(val).replace(/\D/g, "");
    if (clean.length === 11) {
      return clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
    }
    return String(val);
  }

  formatCnpj(val) {
    if (!val) return "Não informado";
    const clean = String(val).replace(/\D/g, "");
    if (clean.length === 14) {
      return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
    }
    return String(val);
  }

  formatTelefone(val) {
    if (!val) return "Não informado";
    const clean = String(val).replace(/\D/g, "");
    if (clean.length === 11) {
      return clean.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
    }
    if (clean.length === 10) {
      return clean.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
    }
    return String(val);
  }

  formatCep(val) {
    if (!val) return "N/I";
    const clean = String(val).replace(/\D/g, "");
    if (clean.length === 8) {
      return clean.replace(/^(\d{5})(\d{3})$/, "$1-$2");
    }
    return String(val);
  }

  formatLabel(key) {
    const labels = {
      cpf: "CPF",
      nome: "Nome Completo",
      name: "Nome Completo",
      birth_date: "Data de Nascimento",
      mother_name: "Nome da Mãe",
      father_name: "Nome do Pai",
      gender: "Sexo",
      email: "E-mail Principal",
      phone: "Telefone",
      income: "Renda Estimada",
      occupation: "Profissão / Ocupação",
      plate: "Placa",
      brand: "Marca",
      model: "Modelo",
      color: "Cor",
      fuel: "Combustível",
      chassis: "Chassi (VIN)",
      renavam: "Código Renavam",
      situacao_veiculo: "Situação do Veículo",
    };
    return (
      labels[key] ||
      key
        .replace(/([A-Z])/g, " $1")
        .replace(/_/g, " ")
        .replace(/^\w/, (c) => c.toUpperCase())
    );
  }

  escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

// Inicializa a Central Unificada
document.addEventListener("DOMContentLoaded", () => {
  window.consultaCtrl = new ConsultaController();
});
