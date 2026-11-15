/**
 * ==============================================================================
 * RIMUBUSCA - TRANSPARÊNCIA FEDERAL (CGU PORTAL DA TRANSPARÊNCIA)
 * Integração direta e auditada usando PORTAL_TRANSPARENCIA_API_KEY (.env):
 *  - Servidores Públicos Federais (Executivo Federal / SIAPE): vínculos,
 *    cargos, funções, lotação/exercício (incl. Universidades/IFs) e folha mensal.
 *  - Diárias e Viagens a Serviço (/viagens-por-cpf).
 *  - Benefícios & Auxílios Sociais por CPF/NIS (/pessoa-fisica + Novo Bolsa
 *    Família, Auxílio Brasil, Bolsa Família, BPC/LOAS, Auxílio Emergencial,
 *    Seguro-Defeso, Garantia-Safra e PETI).
 * ==============================================================================
 */

import { httpRequest } from "../core/httpClient.js";
import { cacheService } from "../core/cache.service.js";
import {
  PORTAL_TRANSPARENCIA_BASE,
  obterChavePortalTransparencia,
} from "./compliance.service.js";

const PORTAL_WEB_BASE = "https://portaldatransparencia.gov.br";

function digitsOnly(val) {
  return String(val || "").replace(/\D/g, "");
}

function formatCpf(digits) {
  const d = digitsOnly(digits);
  if (d.length !== 11) return digits ? String(digits) : "-";
  return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

function normalizarTexto(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function toNumber(val) {
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  if (val === null || val === undefined || val === "") return 0;
  const str = String(val).trim();
  if (/^-?\d+(\.\d+)?$/.test(str)) {
    const n = Number(str);
    return Number.isFinite(n) ? n : 0;
  }
  const cleaned = str.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function gerarMesesRecentes(quantidade = 5, refDate = new Date()) {
  const meses = [];
  const baseYear = refDate.getFullYear();
  const baseMonth = refDate.getMonth(); // 0-indexed

  for (let offset = 1; offset <= quantidade; offset++) {
    const d = new Date(baseYear, baseMonth - offset, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    meses.push(`${yyyy}${mm}`);
  }
  return meses;
}

function formatMesAnoLabel(mesAno) {
  const clean = digitsOnly(mesAno);
  if (clean.length === 6) {
    return `${clean.slice(4, 6)}/${clean.slice(0, 4)}`;
  }
  return mesAno ? String(mesAno) : "-";
}

function montarQueryString(params = {}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      sp.set(k, String(v).trim());
    }
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Executa requisição GET autenticada na API de Dados da CGU com tratamento uniforme.
 */
async function cguGet(endpoint, queryParams = {}, apiKey = null, timeout = 8000) {
  const key = apiKey || obterChavePortalTransparencia();
  if (!key) {
    return {
      ok: false,
      statusCode: 0,
      estado: "chave_nao_configurada",
      mensagem: "Chave PORTAL_TRANSPARENCIA_API_KEY não configurada no servidor (.env).",
      data: null,
    };
  }

  const url = `${PORTAL_TRANSPARENCIA_BASE}${endpoint}${montarQueryString(queryParams)}`;

  try {
    const res = await httpRequest(url, {
      method: "GET",
      headers: {
        "chave-api-dados": key,
        "Accept": "application/json",
        "User-Agent": "RimuBusca-OSINT/1.0",
      },
      timeout,
    });

    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        statusCode: res.status,
        estado: "chave_invalida_ou_restrita",
        mensagem:
          res.status === 401
            ? "Chave PORTAL_TRANSPARENCIA_API_KEY inválida ou expirada (HTTP 401)."
            : "Acesso bloqueado/restrito pela CGU para esta chave ou endpoint (HTTP 403).",
        data: null,
      };
    }

    if (res.status === 429) {
      return {
        ok: false,
        statusCode: 429,
        estado: "rate_limit",
        mensagem: "Limite de requisições por minuto atingido na API do Portal da Transparência (HTTP 429).",
        data: null,
      };
    }

    if (res.status === 404 || res.status === 204) {
      return {
        ok: true,
        empty: true,
        statusCode: res.status,
        estado: "sem_registros",
        data: null,
      };
    }

    if (!res.ok) {
      let msg = null;
      if (res.data && typeof res.data === "object") {
        msg =
          res.data["Erro na API"] ||
          res.data.mensagem ||
          res.data.message ||
          res.data.error ||
          (Array.isArray(res.data.erros) ? res.data.erros.join("; ") : null);
      } else if (typeof res.data === "string" && res.data.trim()) {
        try {
          const parsed = JSON.parse(res.data);
          msg = parsed["Erro na API"] || parsed.mensagem || parsed.message || parsed.error;
        } catch {
          msg = res.data;
        }
      }

      return {
        ok: false,
        statusCode: res.status || 0,
        estado: res.status === 400 ? "parametro_invalido" : "indisponivel",
        mensagem:
          msg ||
          (res.status ? `API CGU retornou HTTP ${res.status}` : "Falha de conexão com a API CGU."),
        data: null,
      };
    }

    const isEmptyObj =
      res.data === null ||
      res.data === undefined ||
      res.data === "" ||
      (Array.isArray(res.data) && res.data.length === 0) ||
      (typeof res.data === "object" && !Array.isArray(res.data) && Object.keys(res.data).length === 0);

    return {
      ok: true,
      empty: isEmptyObj,
      statusCode: res.status,
      estado: isEmptyObj ? "sem_registros" : "ok",
      data: res.data,
    };
  } catch (err) {
    return {
      ok: false,
      statusCode: 0,
      estado: "erro_rede",
      mensagem: `Falha ao consultar API CGU: ${err.message}`,
      data: null,
    };
  }
}

const FLAG_META_PESSOA_FISICA = [
  { key: "servidor", label: "Servidor Público Federal Ativo", categoria: "servidor", destaque: true },
  { key: "servidorInativo", label: "Servidor Federal Inativo / Aposentado", categoria: "servidor", destaque: true },
  { key: "pensionistaOuRepresentanteLegal", label: "Pensionista ou Rep. Legal Federal", categoria: "servidor", destaque: true },
  { key: "instituidorPensao", label: "Instituidor de Pensão Federal", categoria: "servidor", destaque: false },
  { key: "favorecidoNovoBolsaFamilia", label: "Favorecido Novo Bolsa Família", categoria: "beneficio", destaque: true },
  { key: "favorecidoAuxilioBrasil", label: "Favorecido Auxílio Brasil (Histórico)", categoria: "beneficio", destaque: true },
  { key: "favorecidoBolsaFamilia", label: "Favorecido Bolsa Família (Histórico)", categoria: "beneficio", destaque: false },
  { key: "favorecidoBpc", label: "Favorecido BPC / LOAS", categoria: "beneficio", destaque: true },
  { key: "auxilioEmergencial", label: "Favorecido Auxílio Emergencial", categoria: "beneficio", destaque: true },
  { key: "favorecidoAuxilioReconstrucao", label: "Favorecido Auxílio Reconstrução", categoria: "beneficio", destaque: true },
  { key: "favorecidoSeguroDefeso", label: "Favorecido Seguro-Defeso", categoria: "beneficio", destaque: true },
  { key: "favorecidoSafra", label: "Favorecido Garantia-Safra", categoria: "beneficio", destaque: true },
  { key: "favorecidoPeti", label: "Favorecido PETI", categoria: "beneficio", destaque: true },
  { key: "beneficiarioDiarias", label: "Recebeu Diárias / Viagens Federais", categoria: "outro", destaque: false },
  { key: "favorecidoDespesas", label: "Favorecido de Despesas Diretas", categoria: "outro", destaque: false },
  { key: "participanteLicitacao", label: "Participante de Licitações", categoria: "outro", destaque: false },
  { key: "sancionadoCEIS", label: "Sancionado no CEIS", categoria: "sancao", destaque: true },
  { key: "sancionadoCNEP", label: "Sancionado no CNEP", categoria: "sancao", destaque: true },
  { key: "sancionadoCEAF", label: "Sancionado no CEAF (Expulsão Adm.)", categoria: "sancao", destaque: true },
];

/**
 * Consulta o cadastro síntese /pessoa-fisica da CGU (retorna CPF, NIS e flags oficiais).
 */
export async function consultarPerfilPessoaFisica({ cpf = "", nis = "" } = {}, apiKey = null) {
  const cpfLimpo = digitsOnly(cpf);
  const nisLimpo = digitsOnly(nis);

  if (cpfLimpo.length !== 11 && nisLimpo.length !== 11) {
    return {
      status: "ignorado",
      encontrado: false,
      mensagem: "Informe CPF ou NIS com 11 dígitos para consultar o perfil síntese CGU.",
      dados: null,
      flagsAtivas: [],
    };
  }

  const params = {};
  if (cpfLimpo.length === 11) params.cpf = cpfLimpo;
  else params.nis = nisLimpo;

  const res = await cguGet("/pessoa-fisica", params, apiKey, 7000);
  if (!res.ok) {
    return {
      status: res.estado,
      statusCode: res.statusCode,
      encontrado: false,
      mensagem: res.mensagem,
      dados: null,
      flagsAtivas: [],
    };
  }

  if (res.empty || !res.data || typeof res.data !== "object") {
    return {
      status: "sem_registros",
      statusCode: res.statusCode,
      encontrado: false,
      mensagem: "Pessoa física sem ocorrências registradas na síntese do Portal da Transparência.",
      dados: null,
      flagsAtivas: [],
    };
  }

  const d = res.data;
  const flagsAtivas = FLAG_META_PESSOA_FISICA.filter((meta) => Boolean(d[meta.key])).map((meta) => ({
    key: meta.key,
    label: meta.label,
    categoria: meta.categoria,
    destaque: meta.destaque,
  }));

  return {
    status: "ok",
    statusCode: res.statusCode,
    encontrado: true,
    dados: {
      cpf: d.cpf || (cpfLimpo ? formatCpf(cpfLimpo) : null),
      nome: d.nome || null,
      nis: d.nis ? digitsOnly(d.nis) : nisLimpo || null,
      rawFlags: d,
    },
    flagsAtivas,
  };
}

function detectarEducacaoFederal({ cargo = "", orgaoLotacao = "", orgaoExercicio = "", uorg = "" } = {}) {
  const texto = normalizarTexto([cargo, orgaoLotacao, orgaoExercicio, uorg].filter(Boolean).join(" "));
  if (!texto) return false;
  const keywords = [
    "professor",
    "magisterio",
    "docente",
    "universidade federal",
    "instituto federal",
    "cefet",
    "colegio pedro",
    "ministerio da educacao",
    "capes",
    "fnde",
    "inep",
    "ensino basico",
  ];
  return keywords.some((kw) => texto.includes(kw));
}

function mapearFichasServidor(rawItem = {}) {
  const vinculos = [];

  const grupos = [
    { lista: rawItem.fichasCargoEfetivo, tipoFicha: "Cargo Efetivo" },
    { lista: rawItem.fichasFuncao, tipoFicha: "Função / Cargo Comissionado" },
    { lista: rawItem.fichasAposentadoria, tipoFicha: "Aposentadoria" },
    { lista: rawItem.fichasMilitar, tipoFicha: "Militar" },
    { lista: rawItem.fichasPensaoCivil, tipoFicha: "Pensão Civil" },
    { lista: rawItem.fichasPensaoMilitar, tipoFicha: "Pensão Militar" },
    { lista: rawItem.fichasDemaisSituacoes, tipoFicha: "Outras Situações" },
    { lista: rawItem.fichasReformado, tipoFicha: "Militar Reformado / Reserva" },
  ];

  for (const g of grupos) {
    if (!Array.isArray(g.lista)) continue;
    for (const f of g.lista) {
      vinculos.push({
        tipoFicha: g.tipoFicha,
        cargoOuFuncao: f.cargo || f.funcao || f.atividade || f.tipoAposentadoria || f.tipoPensao || "Não informado",
        classeNivel: [f.classeCargo, f.padraoCargo, f.nivelCargo].filter(Boolean).join(" / ") || null,
        orgaoLotacao:
          f.orgaoLotacao ||
          f.orgaoServidorLotacao?.nome ||
          f.orgaoSuperiorLotacao ||
          f.orgao ||
          f.orgaoSuperior ||
          null,
        orgaoExercicio:
          f.orgaoExercicio ||
          f.orgaoServidorExercicio?.nome ||
          f.orgaoSuperiorExercicio ||
          null,
        uorg: f.uorgLotacao || f.uorgExercicio || null,
        ufExercicio: f.ufExercicio || null,
        regimeJuridico: f.regimeJuridico || null,
        jornadaTrabalho: f.jornadaTrabalho || null,
        situacaoServidor: f.situacaoServidor || null,
        dataIngressoOrgao: f.dataIngressoOrgao || f.dataInicioPensao || f.dataAposentadoria || null,
        dataIngressoServicoPublico: f.dataIngressoServicoPublico || f.dataIngressoCargo || f.dataIngressoFuncao || null,
        diplomaLegal: f.diplomaLegal || f.formaIngresso || null,
        afastamentos: f.afastamentos || null,
      });
    }
  }

  return vinculos;
}

function normalizarServidorItem(rawItem = {}) {
  const srv = rawItem.servidor || rawItem || {};
  const pessoa = srv.pessoa || {};
  const lotacao = srv.orgaoServidorLotacao || {};
  const exercicio = srv.orgaoServidorExercicio || {};
  const funcao = srv.funcao || {};
  const fichas = mapearFichasServidor(rawItem);

  const cargoPrincipal =
    fichas.find((f) => f.tipoFicha === "Cargo Efetivo")?.cargoOuFuncao ||
    funcao.descricaoFuncaoCargo ||
    fichas[0]?.cargoOuFuncao ||
    "Servidor Executivo Federal";

  const orgaoLotacaoNome = lotacao.nome || fichas[0]?.orgaoLotacao || "Não informado";
  const orgaoExercicioNome = exercicio.nome || fichas[0]?.orgaoExercicio || orgaoLotacaoNome;
  const uorgPrincipal = fichas.find((f) => f.uorg)?.uorg || null;

  const isEducacaoFederal = detectarEducacaoFederal({
    cargo: cargoPrincipal,
    orgaoLotacao: orgaoLotacaoNome,
    orgaoExercicio: orgaoExercicioNome,
    uorg: uorgPrincipal,
  });

  return {
    idServidor: srv.idServidorAposentadoPensionista || srv.id || null,
    nome: pessoa.nome || fichas[0]?.nome || "Nome não informado",
    cpfFormatado: pessoa.cpfFormatado || srv.cpfDescaracterizado || null,
    matriculaFormatada: srv.codigoMatriculaFormatado || null,
    situacao: srv.situacao || fichas[0]?.situacaoServidor || "Não informada",
    tipoServidor: srv.tipoServidor || "Civil",
    flagAfastado: Boolean(srv.flagAfastado),
    isEducacaoFederal,
    cargoPrincipal,
    funcaoComissionada: funcao.descricaoFuncaoCargo
      ? `${funcao.codigoFuncaoCargo ? `${funcao.codigoFuncaoCargo} - ` : ""}${funcao.descricaoFuncaoCargo}`
      : null,
    orgaoLotacao: {
      codigo: lotacao.codigo || null,
      sigla: lotacao.sigla || null,
      nome: orgaoLotacaoNome,
      orgaoSuperior: lotacao.nomeOrgaoVinculado || null,
    },
    orgaoExercicio: {
      codigo: exercicio.codigo || null,
      sigla: exercicio.sigla || null,
      nome: orgaoExercicioNome,
    },
    ufExercicio: srv.estadoExercicio?.sigla || fichas.find((f) => f.ufExercicio)?.ufExercicio || null,
    fichas,
    remuneracoes: [],
  };
}

function normalizarRemuneracaoDto(r = {}) {
  const rubricas = Array.isArray(r.rubricas)
    ? r.rubricas.map((rb) => ({
        codigo: rb.codigo || null,
        descricao: rb.descricao || "Rubrica",
        valor: toNumber(rb.valor),
      }))
    : [];

  return {
    mesAno: r.skMesReferencia || r.mesAno || null,
    mesAnoLabel: r.mesAnoPorExtenso || formatMesAnoLabel(r.skMesReferencia || r.mesAno),
    remuneracaoBasicaBruta: toNumber(r.remuneracaoBasicaBruta),
    gratificacaoNatalina: toNumber(r.gratificacaoNatalina),
    ferias: toNumber(r.ferias),
    outrasRemuneracoesEventuais: toNumber(r.outrasRemuneracoesEventuais),
    abateTeto: toNumber(r.abateRemuneracaoBasicaBruta) + toNumber(r.abateGratificacaoNatalina),
    impostoRetidoNaFonte: toNumber(r.impostoRetidoNaFonte),
    previdenciaOficial: toNumber(r.previdenciaOficial),
    outrasDeducoesObrigatorias: toNumber(r.outrasDeducoesObrigatorias),
    fundoSaude: toNumber(r.fundoSaude),
    pensaoMilitar: toNumber(r.pensaoMilitar),
    verbasIndenizatorias:
      toNumber(r.verbasIndenizatorias) ||
      toNumber(r.verbasIndenizatoriasCivil) + toNumber(r.verbasIndenizatoriasMilitar),
    valorLiquido: toNumber(r.valorTotalRemuneracaoAposDeducoes),
    remuneracaoEmpresaPublica: Boolean(r.remuneracaoEmpresaPublica),
    observacoes: Array.isArray(r.observacoes)
      ? r.observacoes.join(" | ")
      : r.observacoes || null,
    rubricas,
  };
}

/**
 * Busca folha de remuneração de um servidor (por idServidor ou CPF) tentando mês explícito
 * ou as últimas competências fechadas automaticamente.
 */
async function buscarRemuneracoesServidor({ idServidor = null, cpf = "", mesAno = "" }, apiKey = null) {
  const mesExplicit = digitsOnly(mesAno);
  const candidatosMes = mesExplicit.length === 6 ? [mesExplicit] : gerarMesesRecentes(5);
  const cpfLimpo = digitsOnly(cpf);

  if (!idServidor && cpfLimpo.length !== 11) {
    return { status: "ignorado", mesAnoConsultado: null, mesesTentados: [], remuneracoes: [] };
  }

  const mesesTentados = [];
  for (const mes of candidatosMes) {
    mesesTentados.push(mes);
    const params = { mesAno: mes, pagina: 1 };
    if (idServidor) params.id = idServidor;
    else params.cpf = cpfLimpo;

    const res = await cguGet("/servidores/remuneracao", params, apiKey, 7500);
    if (!res.ok) {
      if (res.estado === "chave_invalida_ou_restrita" || res.estado === "rate_limit") {
        return {
          status: res.estado,
          mensagem: res.mensagem,
          mesAnoConsultado: mes,
          mesesTentados,
          remuneracoes: [],
        };
      }
      continue;
    }

    if (Array.isArray(res.data) && res.data.length > 0) {
      const lista = [];
      for (const bloco of res.data) {
        const dtos = Array.isArray(bloco.remuneracoesDTO) ? bloco.remuneracoesDTO : [];
        for (const dto of dtos) {
          lista.push(normalizarRemuneracaoDto(dto));
        }
      }
      if (lista.length > 0) {
        return {
          status: "ok",
          mesAnoConsultado: mes,
          mesesTentados,
          remuneracoes: lista,
        };
      }
    }
  }

  return {
    status: "sem_registros",
    mesAnoConsultado: candidatosMes[0] || null,
    mesesTentados,
    remuneracoes: [],
  };
}

/**
 * Dicionário rápido de siglas e instituições federais de ensino e ministérios mapeados para códigos SIAPE da CGU.
 */
export const ORGAOS_ACRONYM_MAP = {
  // Institutos Federais (IFs)
  ifes: "26406",
  ifsp: "26439",
  ifrj: "26433",
  iff: "26434",
  ifmg: "26409",
  ifnmg: "26410",
  ifsudestemg: "26411",
  ifsuldeminas: "26412",
  iftm: "26413",
  ifb: "26356",
  ifpr: "26432",
  ifsc: "26438",
  ifc: "26422",
  ifrs: "26419",
  iffar: "26420",
  ifsul: "26436",
  ifba: "26427",
  ifbaiano: "26404",
  ifpe: "26418",
  ifsertao: "26430",
  ifsertaope: "26430",
  ifce: "26405",
  ifg: "26429",
  ifgoiano: "26407",
  ifma: "26408",
  ifpi: "26431",
  ifrn: "26435",
  ifpb: "26417",
  ifse: "26423",
  ifal: "26402",
  ifac: "26401",
  ifam: "26403",
  ifap: "26426",
  ifpa: "26416",
  ifro: "26421",
  ifrr: "26437",
  ifto: "26424",
  ifms: "26415",
  ifmt: "26414",

  // Universidades Federais & Colégios Federais
  ufes: "26234",
  ufrj: "26245",
  uff: "26236",
  ufrrj: "26249",
  unirio: "26259",
  ufmg: "26238",
  ufjf: "26237",
  unifesp: "26262",
  ufabc: "26352",
  ufscar: "26260",
  unb: "26252",
  ufpr: "26241",
  utfpr: "26257",
  ufsc: "26246",
  ufrgs: "26244",
  ufsm: "26247",
  ufba: "26232",
  ufc: "26233",
  ufpe: "26242",
  ufrpe: "26248",
  ufg: "26235",
  ufal: "26231",
  ufpa: "26239",
  ufpb: "26240",
  ufrn: "26243",
  ufms: "26250",
  ufmt: "26251",
  pedroii: "26265",
  cefetrj: "26264",
  cefetmg: "26266",

  // Ministérios e Órgãos Federais Estratégicos
  mec: "26000",
  mj: "20000",
  mjsp: "20000",
  ms: "36000",
  pf: "20001",
  prf: "20002",
  inss: "40701",
  ibama: "44207",
  fazenda: "25000",
  receita: "25000",
};

export const PRESETS_ORGAOS_FEDERAIS = [
  // ES
  { codigo: "26406", sigla: "IFES", nome: "Instituto Federal do Espírito Santo", uf: "ES", categoria: "IF" },
  { codigo: "26234", sigla: "UFES", nome: "Universidade Federal do Espírito Santo", uf: "ES", categoria: "Universidade" },
  // SP
  { codigo: "26439", sigla: "IFSP", nome: "Instituto Federal de São Paulo", uf: "SP", categoria: "IF" },
  { codigo: "26262", sigla: "UNIFESP", nome: "Universidade Federal de São Paulo", uf: "SP", categoria: "Universidade" },
  { codigo: "26352", sigla: "UFABC", nome: "Universidade Federal do ABC", uf: "SP", categoria: "Universidade" },
  { codigo: "26260", sigla: "UFSCar", nome: "Universidade Federal de São Carlos", uf: "SP", categoria: "Universidade" },
  // RJ
  { codigo: "26245", sigla: "UFRJ", nome: "Universidade Federal do Rio de Janeiro", uf: "RJ", categoria: "Universidade" },
  { codigo: "26236", sigla: "UFF", nome: "Universidade Federal Fluminense", uf: "RJ", categoria: "Universidade" },
  { codigo: "26433", sigla: "IFRJ", nome: "Instituto Federal do Rio de Janeiro", uf: "RJ", categoria: "IF" },
  { codigo: "26434", sigla: "IFF", nome: "Instituto Federal Fluminense", uf: "RJ", categoria: "IF" },
  { codigo: "26249", sigla: "UFRRJ", nome: "Universidade Federal Rural do Rio de Janeiro", uf: "RJ", categoria: "Universidade" },
  { codigo: "26259", sigla: "UNIRIO", nome: "Universidade Federal do Estado do Rio de Janeiro", uf: "RJ", categoria: "Universidade" },
  { codigo: "26265", sigla: "CPII", nome: "Colégio Pedro II", uf: "RJ", categoria: "Colégio Federal" },
  { codigo: "26264", sigla: "CEFET-RJ", nome: "Centro Federal de Educação Tecnológica Celso Suckow", uf: "RJ", categoria: "CEFET" },
  // MG
  { codigo: "26238", sigla: "UFMG", nome: "Universidade Federal de Minas Gerais", uf: "MG", categoria: "Universidade" },
  { codigo: "26409", sigla: "IFMG", nome: "Instituto Federal de Minas Gerais", uf: "MG", categoria: "IF" },
  { codigo: "26237", sigla: "UFJF", nome: "Universidade Federal de Juiz de Fora", uf: "MG", categoria: "Universidade" },
  { codigo: "26410", sigla: "IFNMG", nome: "Instituto Federal do Norte de Minas Gerais", uf: "MG", categoria: "IF" },
  { codigo: "26411", sigla: "IF Sudeste MG", nome: "Instituto Federal do Sudeste de Minas Gerais", uf: "MG", categoria: "IF" },
  { codigo: "26412", sigla: "IFSULDEMINAS", nome: "Instituto Federal do Sul de Minas Gerais", uf: "MG", categoria: "IF" },
  { codigo: "26413", sigla: "IFTM", nome: "Instituto Federal do Triângulo Mineiro", uf: "MG", categoria: "IF" },
  { codigo: "26266", sigla: "CEFET-MG", nome: "Centro Federal de Educação Tecnológica de Minas Gerais", uf: "MG", categoria: "CEFET" },
  // DF / Nacional
  { codigo: "26000", sigla: "MEC", nome: "Ministério da Educação", uf: "DF", categoria: "Ministério" },
  { codigo: "26252", sigla: "UnB", nome: "Universidade de Brasília", uf: "DF", categoria: "Universidade" },
  { codigo: "26356", sigla: "IFB", nome: "Instituto Federal de Brasília", uf: "DF", categoria: "IF" },
  { codigo: "20000", sigla: "MJSP", nome: "Ministério da Justiça e Segurança Pública", uf: "DF", categoria: "Ministério" },
  { codigo: "36000", sigla: "MS", nome: "Ministério da Saúde", uf: "DF", categoria: "Ministério" },
  { codigo: "20001", sigla: "PF", nome: "Polícia Federal (DPF)", uf: "DF", categoria: "Segurança" },
  { codigo: "20002", sigla: "PRF", nome: "Polícia Rodoviária Federal (DPRF)", uf: "DF", categoria: "Segurança" },
  { codigo: "40701", sigla: "INSS", nome: "Instituto Nacional do Seguro Social", uf: "DF", categoria: "Autarquia" },
  // PR
  { codigo: "26241", sigla: "UFPR", nome: "Universidade Federal do Paraná", uf: "PR", categoria: "Universidade" },
  { codigo: "26432", sigla: "IFPR", nome: "Instituto Federal do Paraná", uf: "PR", categoria: "IF" },
  { codigo: "26257", sigla: "UTFPR", nome: "Universidade Tecnológica Federal do Paraná", uf: "PR", categoria: "Universidade" },
  // SC
  { codigo: "26246", sigla: "UFSC", nome: "Universidade Federal de Santa Catarina", uf: "SC", categoria: "Universidade" },
  { codigo: "26438", sigla: "IFSC", nome: "Instituto Federal de Santa Catarina", uf: "SC", categoria: "IF" },
  { codigo: "26422", sigla: "IFC", nome: "Instituto Federal Catarinense", uf: "SC", categoria: "IF" },
  // RS
  { codigo: "26244", sigla: "UFRGS", nome: "Universidade Federal do Rio Grande do Sul", uf: "RS", categoria: "Universidade" },
  { codigo: "26419", sigla: "IFRS", nome: "Instituto Federal do Rio Grande do Sul", uf: "RS", categoria: "IF" },
  { codigo: "26247", sigla: "UFSM", nome: "Universidade Federal de Santa Maria", uf: "RS", categoria: "Universidade" },
  { codigo: "26420", sigla: "IFFar", nome: "Instituto Federal Farroupilha", uf: "RS", categoria: "IF" },
  { codigo: "26436", sigla: "IFSUL", nome: "Instituto Federal Sul-rio-grandense", uf: "RS", categoria: "IF" },
  // BA
  { codigo: "26232", sigla: "UFBA", nome: "Universidade Federal da Bahia", uf: "BA", categoria: "Universidade" },
  { codigo: "26427", sigla: "IFBA", nome: "Instituto Federal da Bahia", uf: "BA", categoria: "IF" },
  { codigo: "26404", sigla: "IF Baiano", nome: "Instituto Federal Baiano", uf: "BA", categoria: "IF" },
  // CE
  { codigo: "26233", sigla: "UFC", nome: "Universidade Federal do Ceará", uf: "CE", categoria: "Universidade" },
  { codigo: "26405", sigla: "IFCE", nome: "Instituto Federal do Ceará", uf: "CE", categoria: "IF" },
  // PE
  { codigo: "26242", sigla: "UFPE", nome: "Universidade Federal de Pernambuco", uf: "PE", categoria: "Universidade" },
  { codigo: "26418", sigla: "IFPE", nome: "Instituto Federal de Pernambuco", uf: "PE", categoria: "IF" },
  { codigo: "26430", sigla: "IFSertãoPE", nome: "Instituto Federal do Sertão Pernambucano", uf: "PE", categoria: "IF" },
  // GO
  { codigo: "26235", sigla: "UFG", nome: "Universidade Federal de Goiás", uf: "GO", categoria: "Universidade" },
  { codigo: "26429", sigla: "IFG", nome: "Instituto Federal de Goiás", uf: "GO", categoria: "IF" },
  { codigo: "26407", sigla: "IF Goiano", nome: "Instituto Federal Goiano", uf: "GO", categoria: "IF" },
];

/**
 * Resolve código SIAPE de órgão federal a partir de número ('26406') ou sigla/nome ('IFES', 'UFES').
 */
export function resolverOrgaoSiape(val) {
  if (!val) return null;
  const str = String(val).trim();
  const digits = digitsOnly(str);
  if (digits.length >= 3 && digits.length <= 6 && /^\d+$/.test(str)) {
    return digits;
  }
  const clean = normalizarTexto(str).replace(/[^a-z0-9]/g, "");
  if (ORGAOS_ACRONYM_MAP[clean]) {
    return ORGAOS_ACRONYM_MAP[clean];
  }
  for (const [acronym, code] of Object.entries(ORGAOS_ACRONYM_MAP)) {
    if (clean === acronym || clean.includes(acronym)) {
      return code;
    }
  }
  return null;
}

/**
 * Detecta se o usuário digitou uma sigla de órgão no final do nome (ex: 'Cezar Henrique IFES').
 */
export function extrairOrgaoDoNome(nome) {
  const cleanNome = String(nome || "").trim();
  const parts = cleanNome.split(/\s+/);
  if (parts.length > 1) {
    const lastWord = normalizarTexto(parts[parts.length - 1]).replace(/[^a-z0-9]/g, "");
    if (ORGAOS_ACRONYM_MAP[lastWord]) {
      return {
        nomeSemOrgao: parts.slice(0, -1).join(" "),
        orgaoCodigo: ORGAOS_ACRONYM_MAP[lastWord],
      };
    }
  }
  return {
    nomeSemOrgao: cleanNome,
    orgaoCodigo: null,
  };
}

/**
 * Lista órgãos do SIAPE no Portal da Transparência (útil para achar Universidades e IFs).
 */
export async function buscarOrgaosSiape({ termo = "", codigo = "", pagina = 1 } = {}) {
  const cleanTermo = String(termo || "").trim();
  const cleanCodigo = digitsOnly(codigo);

  // Se busca vazia, devolve presets curados sem gastar requisição CGU
  if (!cleanTermo && !cleanCodigo) {
    return {
      status: "ok",
      origem: "presets",
      orgaos: PRESETS_ORGAOS_FEDERAIS,
    };
  }

  // Se termo bate direto com sigla curada (ex: IFES, UFES, MEC)
  const acrMatch = resolverOrgaoSiape(cleanTermo);
  const presetsFiltrados = PRESETS_ORGAOS_FEDERAIS.filter((p) => {
    if (cleanCodigo && p.codigo === cleanCodigo) return true;
    if (cleanTermo) {
      const norm = normalizarTexto(cleanTermo);
      return (
        normalizarTexto(p.sigla).includes(norm) ||
        normalizarTexto(p.nome).includes(norm) ||
        normalizarTexto(p.uf).toLowerCase() === norm ||
        p.codigo === norm
      );
    }
    return false;
  });

  const apiKey = obterChavePortalTransparencia();
  if (!apiKey) {
    return {
      status: "ok",
      origem: "presets_offline",
      orgaos: presetsFiltrados,
    };
  }

  const cacheKey = `orgaos:${cleanCodigo}:${normalizarTexto(cleanTermo)}:${pagina}`;

  try {
    const cached = await cacheService.get("cgu_orgaos_siape", cacheKey);
    if (cached?.hit && cached.dados) {
      return { ...cached.dados, cacheHit: true };
    }
  } catch {
    // Segue ao vivo
  }

  const res = await cguGet(
    "/orgaos-siape",
    {
      codigo: cleanCodigo || (acrMatch ? acrMatch : undefined),
      descricao: !cleanCodigo && !acrMatch ? cleanTermo : undefined,
      pagina: Math.max(1, Number(pagina) || 1),
    },
    apiKey,
    7000
  );

  const orgaosApi = res.ok && Array.isArray(res.data)
    ? res.data.map((o) => ({
        codigo: o.codigo || o.codigoSiape || null,
        sigla: o.sigla || null,
        nome: o.descricao || o.nome || "Órgão SIAPE",
      }))
    : [];

  // Mescla presets relevantes no topo para garantir rápida identificação
  const codigosVistos = new Set();
  const orgaosFinais = [];

  for (const p of presetsFiltrados) {
    if (p.codigo && !codigosVistos.has(p.codigo)) {
      codigosVistos.add(p.codigo);
      orgaosFinais.push(p);
    }
  }

  for (const o of orgaosApi) {
    if (o.codigo && !codigosVistos.has(o.codigo)) {
      codigosVistos.add(o.codigo);
      orgaosFinais.push(o);
    }
  }

  const payload = { status: "ok", orgaos: orgaosFinais };
  try {
    await cacheService.set("cgu_orgaos_siape", cacheKey, payload, { ttlMs: 24 * 60 * 60 * 1000 });
  } catch {
    // Opcional
  }
  return payload;
}

/**
 * Orquestrador: Consulta Servidores Públicos Federais (Executivo Federal / SIAPE).
 */
export async function consultarServidoresFederais({
  cpf = "",
  nome = "",
  orgaoServidorLotacao = "",
  tipoServidor = "",
  situacaoServidor = "",
  mesAno = "",
  incluirRemuneracao = true,
  incluirViagens = true,
  pagina = 1,
} = {}) {
  const apiKey = obterChavePortalTransparencia();
  const cpfLimpo = digitsOnly(cpf);
  let nomeClean = String(nome || "").trim();
  let orgaoInput = String(orgaoServidorLotacao || "").trim();

  // Se não foi passado órgão explícito, tenta extrair sigla/órgão do final do nome digitado (ex: "Cezar Henrique IFES")
  if (!orgaoInput && nomeClean) {
    const extraido = extrairOrgaoDoNome(nomeClean);
    if (extraido.orgaoCodigo) {
      nomeClean = extraido.nomeSemOrgao;
      orgaoInput = extraido.orgaoCodigo;
    }
  }

  // Resolve órgão SIAPE (aceita '26406', 'IFES', 'ifes', 'UFES', etc.)
  const orgaoResolvido = orgaoInput ? resolverOrgaoSiape(orgaoInput) || orgaoInput : "";
  const tipoNum = tipoServidor ? Number(tipoServidor) : null;
  const situacaoNum = situacaoServidor ? Number(situacaoServidor) : null;
  const mesClean = digitsOnly(mesAno);
  const paginaNum = Math.max(1, Math.min(20, Number(pagina) || 1));

  if (cpf && cpfLimpo.length > 0 && cpfLimpo.length !== 11) {
    return {
      sucesso: false,
      erro: "CPF informado inválido. Digite os 11 dígitos do CPF.",
    };
  }

  if (cpfLimpo.length !== 11 && nomeClean.length < 3 && !orgaoResolvido) {
    return {
      sucesso: false,
      erro: "Informe um CPF válido (11 dígitos), um Nome completo/parcial (mín. 3 letras) ou o código do Órgão SIAPE.",
    };
  }

  const linksOficiais = [
    {
      titulo: "Portal da Transparência — Servidores Federais",
      url:
        cpfLimpo.length === 11
          ? `${PORTAL_WEB_BASE}/servidores/consulta?cpf=${encodeURIComponent(cpfLimpo)}`
          : nomeClean
          ? `${PORTAL_WEB_BASE}/servidores/consulta?nome=${encodeURIComponent(nomeClean)}`
          : `${PORTAL_WEB_BASE}/servidores`,
    },
  ];

  if (!apiKey) {
    return {
      sucesso: false,
      status: "chave_nao_configurada",
      erro: "PORTAL_TRANSPARENCIA_API_KEY não configurada no arquivo .env do servidor.",
      linksOficiais,
    };
  }

  // Trava essencial da CGU: Para pesquisar por Nome, a API exige CPF OU Órgão SIAPE
  if (cpfLimpo.length !== 11 && !orgaoResolvido) {
    return {
      sucesso: false,
      status: "orgao_obrigatorio_para_nome",
      erro: "A API oficial da CGU exige informar a Instituição / Órgão SIAPE (ex: 26406 para IFES, 26234 para UFES, 26000 para MEC) ao pesquisar apenas por Nome para evitar sobrecarga no banco de dados federal.",
      dica: "Dica de ouro: Se você não sabe a instituição do servidor, descubra o CPF dele pelo Nome na ferramenta de Pessoas/Receita (Zeroy) e depois pesquise pelo CPF aqui — com o CPF, a busca localiza o servidor em qualquer órgão do Brasil sem precisar de código!",
      exigeOrgao: true,
      linksOficiais,
    };
  }

  const cacheKey = `srv:${cpfLimpo}:${normalizarTexto(nomeClean)}:${orgaoResolvido}:${tipoNum || ""}:${situacaoNum || ""}:${mesClean || "auto"}:${incluirRemuneracao ? 1 : 0}:${paginaNum}`;
  try {
    const cached = await cacheService.get("servidores_federais", cacheKey);
    if (cached?.hit && cached.dados) {
      return { ...cached.dados, cacheHit: true };
    }
  } catch {
    // Segue sem interromper
  }

  const srvQuery = {
    cpf: cpfLimpo.length === 11 ? cpfLimpo : undefined,
    nome: nomeClean || undefined,
    orgaoServidorLotacao: orgaoResolvido || undefined,
    tipoServidor: tipoNum === 1 || tipoNum === 2 ? tipoNum : undefined,
    situacaoServidor: [1, 2, 3].includes(situacaoNum) ? situacaoNum : undefined,
    pagina: paginaNum,
  };

  const [perfilSettled, servidoresSettled] = await Promise.allSettled([
    cpfLimpo.length === 11
      ? consultarPerfilPessoaFisica({ cpf: cpfLimpo }, apiKey)
      : Promise.resolve({ status: "ignorado", encontrado: false, dados: null, flagsAtivas: [] }),
    cguGet("/servidores", srvQuery, apiKey, 8500),
  ]);

  const perfilPessoa =
    perfilSettled.status === "fulfilled"
      ? perfilSettled.value
      : { status: "erro", encontrado: false, dados: null, flagsAtivas: [] };

  const srvRes =
    servidoresSettled.status === "fulfilled"
      ? servidoresSettled.value
      : { ok: false, estado: "erro_rede", mensagem: "Falha ao consultar /servidores", data: null };

  let buscaAproximadaInfo = null;

  // Fallback inteligente para erros de digitação em sobrenomes quando busca nominal por órgão vier vazia
  if (
    srvRes.ok &&
    Array.isArray(srvRes.data) &&
    srvRes.data.length === 0 &&
    nomeClean &&
    orgaoResolvido
  ) {
    const partesNome = nomeClean.split(/\s+/).filter(Boolean);
    if (partesNome.length >= 3) {
      const nomeAproximado = partesNome.slice(0, 2).join(" ");
      const fallbackRes = await cguGet(
        "/servidores",
        {
          ...srvQuery,
          nome: nomeAproximado,
          pagina: 1,
        },
        apiKey,
        7500
      );

      if (fallbackRes.ok && Array.isArray(fallbackRes.data) && fallbackRes.data.length > 0) {
        srvRes.data = fallbackRes.data;
        buscaAproximadaInfo = {
          termoOriginal: nomeClean,
          termoUtilizado: nomeAproximado,
          aviso: `A busca exata por '${nomeClean}' não retornou registros no órgão. Foi aplicada aproximação por '${nomeAproximado}', localizando o servidor.`,
        };
      }
    }
  }

  if (!srvRes.ok) {
    return {
      sucesso: false,
      status: srvRes.estado,
      erro: srvRes.mensagem || "Falha ao consultar servidores federais na CGU.",
      linksOficiais,
    };
  }

  const rawList = Array.isArray(srvRes.data) ? srvRes.data : [];
  const servidores = rawList.map(normalizarServidorItem);

  // Enriquecimento de folha salarial (limite seguro até 4 servidores por consulta para preservar rate limit CGU)
  let competenciaDetectada = mesClean || null;
  if (incluirRemuneracao && servidores.length > 0) {
    const limiteFolha = Math.min(servidores.length, 4);
    const folhasPromises = [];
    for (let i = 0; i < limiteFolha; i++) {
      const s = servidores[i];
      folhasPromises.push(
        buscarRemuneracoesServidor(
          {
            idServidor: s.idServidor,
            cpf: cpfLimpo.length === 11 ? cpfLimpo : "",
            mesAno: mesClean,
          },
          apiKey
        ).then((remRes) => ({ index: i, remRes }))
      );
    }

    const folhasRes = await Promise.allSettled(folhasPromises);
    for (const f of folhasRes) {
      if (f.status === "fulfilled") {
        const { index, remRes } = f.value;
        servidores[index].remuneracoes = remRes.remuneracoes || [];
        servidores[index].remuneracaoStatus = remRes.status;
        servidores[index].mesesTentados = remRes.mesesTentados || [];
        if (!competenciaDetectada && remRes.mesAnoConsultado && remRes.remuneracoes?.length > 0) {
          competenciaDetectada = remRes.mesAnoConsultado;
        }
      }
    }
  } else if (incluirRemuneracao && cpfLimpo.length === 11 && servidores.length === 0) {
    // Fallback raro: caso /servidores venha vazio mas haja remuneração direta por CPF
    const fallbackRem = await buscarRemuneracoesServidor({ cpf: cpfLimpo, mesAno: mesClean }, apiKey);
    if (fallbackRem.remuneracoes.length > 0) {
      competenciaDetectada = fallbackRem.mesAnoConsultado;
      servidores.push({
        idServidor: null,
        nome: perfilPessoa.dados?.nome || "Servidor Federal (Remuneração Localizada)",
        cpfFormatado: formatCpf(cpfLimpo),
        matriculaFormatada: null,
        situacao: "Localizado em Folha",
        tipoServidor: "Executivo Federal",
        flagAfastado: false,
        isEducacaoFederal: false,
        cargoPrincipal: "Verificar folha detalhada",
        funcaoComissionada: null,
        orgaoLotacao: { codigo: null, sigla: null, nome: "Executivo Federal", orgaoSuperior: null },
        orgaoExercicio: { codigo: null, sigla: null, nome: "Executivo Federal" },
        ufExercicio: null,
        fichas: [],
        remuneracoes: fallbackRem.remuneracoes,
        remuneracaoStatus: fallbackRem.status,
      });
    }
  }

  // Viagens a serviço / Diárias (/viagens-por-cpf)
  let viagensInfo = { status: "ignorado", totalEncontrado: 0, viagens: [], valorTotalGasto: 0 };
  const deveConsultarViagens =
    incluirViagens &&
    cpfLimpo.length === 11 &&
    (!perfilPessoa.encontrado || perfilPessoa.dados?.rawFlags?.beneficiarioDiarias !== false);

  if (deveConsultarViagens) {
    const vRes = await cguGet("/viagens-por-cpf", { cpf: cpfLimpo, pagina: 1 }, apiKey, 7000);
    if (vRes.ok && Array.isArray(vRes.data) && vRes.data.length > 0) {
      const listaV = vRes.data.slice(0, 15).map((v) => ({
        id: v.id || null,
        pcdp: v.viagem?.pcdp || v.viagem?.numPcdp || null,
        motivo: v.viagem?.motivo || "Viagem a serviço",
        situacao: v.situacao || null,
        orgao: v.orgao?.nome || v.unidadeGestoraResponsavel?.nome || "Órgão Federal",
        cargo: v.cargo?.descricao || null,
        inicio: v.dataInicioAfastamento || null,
        fim: v.dataFimAfastamento || null,
        diarias: toNumber(v.valorTotalDiarias),
        passagens: toNumber(v.valorTotalPassagem),
        totalViagem: toNumber(v.valorTotalViagem),
      }));
      viagensInfo = {
        status: "ok",
        totalEncontrado: vRes.data.length,
        viagens: listaV,
        valorTotalGasto: listaV.reduce((acc, item) => acc + item.totalViagem, 0),
      };
    } else if (vRes.ok) {
      viagensInfo = { status: "sem_registros", totalEncontrado: 0, viagens: [], valorTotalGasto: 0 };
    } else {
      viagensInfo = {
        status: vRes.estado,
        mensagem: vRes.mensagem,
        totalEncontrado: 0,
        viagens: [],
        valorTotalGasto: 0,
      };
    }
  } else if (cpfLimpo.length === 11 && perfilPessoa.encontrado && perfilPessoa.dados?.rawFlags?.beneficiarioDiarias === false) {
    viagensInfo = { status: "nao_beneficiario_cgu", totalEncontrado: 0, viagens: [], valorTotalGasto: 0 };
  }

  const totalServidores = servidores.length;
  const totalEducacao = servidores.filter((s) => s.isEducacaoFederal).length;
  const maiorLiquido = servidores.reduce((max, s) => {
    const first = s.remuneracoes?.[0]?.valorLiquido || 0;
    return first > max ? first : max;
  }, 0);
  const maiorBruto = servidores.reduce((max, s) => {
    const r = s.remuneracoes?.[0];
    if (!r) return max;
    const bruto = r.remuneracaoBasicaBruta + r.gratificacaoNatalina + r.ferias + r.outrasRemuneracoesEventuais;
    return bruto > max ? bruto : max;
  }, 0);

  const resultado = {
    sucesso: true,
    status: !srvRes.ok ? srvRes.estado : totalServidores > 0 ? "ok" : "sem_registros",
    avisoApi: !srvRes.ok ? srvRes.mensagem : null,
    escopo: "Poder Executivo Federal (SIAPE / Portal da Transparência CGU)",
    consulta: {
      cpf: cpfLimpo || null,
      cpfFormatado: cpfLimpo.length === 11 ? formatCpf(cpfLimpo) : null,
      nome: nomeClean || perfilPessoa.dados?.nome || null,
      orgaoServidorLotacao: orgaoResolvido || null,
      tipoServidor: tipoNum || null,
      situacaoServidor: situacaoNum || null,
      mesAnoSolicitado: mesClean || "Automático",
      competenciaRetornada: competenciaDetectada ? formatMesAnoLabel(competenciaDetectada) : null,
      pagina: paginaNum,
    },
    buscaAproximada: buscaAproximadaInfo,
    resumo: {
      totalServidores,
      totalEducacaoFederal: totalEducacao,
      maiorBrutoEncontrado: maiorBruto,
      maiorLiquidoEncontrado: maiorLiquido,
      totalViagens: viagensInfo.totalEncontrado,
      valorTotalViagens: viagensInfo.valorTotalGasto,
      nisVinculadoCgu: perfilPessoa.dados?.nis || null,
    },
    perfilPessoa,
    servidores,
    viagens: viagensInfo,
    linksOficiais,
    notaEstadualMunicipal:
      "Esta consulta cobre servidores do Poder Executivo Federal (SIAPE — inclui professores de Universidades Federais, Institutos Federais e Colégios Federais). Folhas estaduais e municipais não integram a API da CGU.",
    timestamp: new Date().toISOString(),
  };

  try {
    await cacheService.set("servidores_federais", cacheKey, resultado, { ttlMs: 6 * 60 * 60 * 1000 });
  } catch {
    // Opcional
  }

  return resultado;
}

/**
 * Normalizadores de parcelas para cada programa social da CGU.
 */
function normalizarParcelaBolsaFamilia(programaNome, item = {}, campoPessoaKey = "beneficiarioNovoBolsaFamilia") {
  const ben =
    item[campoPessoaKey] ||
    item.beneficiario ||
    item.titularBolsaFamilia ||
    item.beneficiarioAuxilioBrasil ||
    item.beneficiarioBolsaFamilia ||
    {};
  const mun = item.municipio || {};
  const uf = mun.uf?.sigla || mun.uf || "";
  return {
    programa: programaNome,
    competencia: item.dataMesCompetencia || item.mesDisponibilizacao || item.dataMesReferencia || "-",
    referencia: item.dataMesReferencia || item.dataMesCompetencia || "-",
    dataSaque: item.dataSaque || item.dataDisponibilizacaoRecurso || null,
    valor: toNumber(item.valorSaque ?? item.valor),
    situacao: item.situacao || item.situacaoAuxilioEmergencial || (item.valorSaque !== undefined ? "Sacado / Disponibilizado" : "Registrado"),
    parcela: item.numeroParcela || item.parcela || null,
    detalhe: item.enquadramentoAuxilioEmergencial || (item.concedidoJudicialmente ? "Concessão Judicial" : null) || null,
    municipio: mun.nomeIBGE ? `${mun.nomeIBGE}${uf ? ` - ${uf}` : ""}` : uf || "-",
    beneficiarioNome: ben.nome || null,
    beneficiarioCpf: ben.cpfFormatado || null,
    beneficiarioNis: ben.nis || null,
    representanteLegal: ben.nomeRepresentanteLegal || null,
  };
}

const PROGRAMAS_SOCIAIS_CONFIG = [
  {
    id: "novo_bolsa_familia",
    nome: "Novo Bolsa Família",
    flagKey: "favorecidoNovoBolsaFamilia",
    endpoint: "/novo-bolsa-familia-sacado-por-cpf-ou-nis",
    fallbackNisEndpoint: "/novo-bolsa-familia-sacado-por-nis",
    paramName: "codigo",
    usePage: true,
    normalizer: (item) => normalizarParcelaBolsaFamilia("Novo Bolsa Família", item, "beneficiarioNovoBolsaFamilia"),
  },
  {
    id: "auxilio_brasil",
    nome: "Auxílio Brasil (Histórico)",
    flagKey: "favorecidoAuxilioBrasil",
    endpoint: "/auxilio-brasil-sacado-por-cpf-ou-nis",
    paramName: "codigo",
    usePage: true,
    normalizer: (item) => normalizarParcelaBolsaFamilia("Auxílio Brasil", item, "beneficiarioAuxilioBrasil"),
  },
  {
    id: "bolsa_familia_legado",
    nome: "Bolsa Família (Série Anterior)",
    flagKey: "favorecidoBolsaFamilia",
    endpoint: "/bolsa-familia-sacado-por-cpf-ou-nis",
    paramName: "codigo",
    usePage: true,
    normalizer: (item) => normalizarParcelaBolsaFamilia("Bolsa Família", item, "beneficiarioBolsaFamilia"),
  },
  {
    id: "bpc",
    nome: "BPC / LOAS",
    flagKey: "favorecidoBpc",
    endpoint: "/bpc-por-cpf-ou-nis",
    paramName: "codigo",
    usePage: true,
    normalizer: (item) => normalizarParcelaBolsaFamilia("BPC / LOAS", item, "beneficiario"),
  },
  {
    id: "auxilio_emergencial",
    nome: "Auxílio Emergencial",
    flagKey: "auxilioEmergencial",
    endpoint: "/auxilio-emergencial-por-cpf-ou-nis",
    paramName: "codigoBeneficiario",
    usePage: true,
    normalizer: (item) => normalizarParcelaBolsaFamilia("Auxílio Emergencial", item, "beneficiario"),
  },
  {
    id: "seguro_defeso",
    nome: "Seguro-Defeso (Pescador)",
    flagKey: "favorecidoSeguroDefeso",
    endpoint: "/seguro-defeso-codigo",
    paramName: "codigo",
    usePage: true,
    normalizer: (item) => ({
      ...normalizarParcelaBolsaFamilia("Seguro-Defeso", item, "pessoaSeguroDefeso"),
      detalhe: [item.portaria ? `Portaria ${item.portaria}` : null, item.rgp ? `RGP ${item.rgp}` : null]
        .filter(Boolean)
        .join(" • ") || null,
    }),
  },
  {
    id: "garantia_safra",
    nome: "Garantia-Safra",
    flagKey: "favorecidoSafra",
    endpoint: "/safra-codigo-por-cpf-ou-nis",
    paramName: "codigo",
    usePage: true,
    normalizer: (item) => normalizarParcelaBolsaFamilia("Garantia-Safra", item, "beneficiarioSafra"),
  },
  {
    id: "peti",
    nome: "PETI (Erradicação Trab. Infantil)",
    flagKey: "favorecidoPeti",
    endpoint: "/peti-por-cpf-ou-nis",
    paramName: "codigo",
    usePage: true,
    normalizer: (item) => normalizarParcelaBolsaFamilia("PETI", item, "beneficiarioPeti"),
  },
];

/**
 * Orquestrador: Consulta Benefícios & Auxílios Sociais Federais (CGU) por CPF ou NIS.
 */
export async function consultarBeneficiosSociais({
  cpf = "",
  nis = "",
  varreduraCompleta = true,
  pagina = 1,
} = {}) {
  const apiKey = obterChavePortalTransparencia();
  const cpfLimpo = digitsOnly(cpf);
  const nisInformado = digitsOnly(nis);
  const paginaNum = Math.max(1, Math.min(20, Number(pagina) || 1));

  if (cpf && cpfLimpo.length > 0 && cpfLimpo.length !== 11) {
    return {
      sucesso: false,
      erro: "CPF informado inválido. Informe os 11 dígitos.",
    };
  }

  if (nis && nisInformado.length > 0 && nisInformado.length !== 11) {
    return {
      sucesso: false,
      erro: "NIS informado inválido. O NIS/PIS/PASEP possui 11 dígitos.",
    };
  }

  if (cpfLimpo.length !== 11 && nisInformado.length !== 11) {
    return {
      sucesso: false,
      erro: "Informe um CPF (11 dígitos) e/ou NIS (11 dígitos) válido para consultar benefícios sociais.",
    };
  }

  const codigoInicial = cpfLimpo.length === 11 ? cpfLimpo : nisInformado;
  const linksOficiais = [
    {
      titulo: "Portal da Transparência — Benefícios ao Cidadão",
      url: `${PORTAL_WEB_BASE}/beneficios/consulta?termo=${encodeURIComponent(codigoInicial)}`,
    },
  ];

  if (!apiKey) {
    return {
      sucesso: false,
      status: "chave_nao_configurada",
      erro: "PORTAL_TRANSPARENCIA_API_KEY não configurada no servidor (.env).",
      linksOficiais,
    };
  }

  const cacheKey = `ben:${cpfLimpo}:${nisInformado}:${varreduraCompleta ? "full" : "smart"}:${paginaNum}`;
  try {
    const cached = await cacheService.get("beneficios_auxilios", cacheKey);
    if (cached?.hit && cached.dados) {
      return { ...cached.dados, cacheHit: true };
    }
  } catch {
    // Segue ao vivo
  }

  // Etapa 1: Consulta perfil síntese (/pessoa-fisica) para descobrir NIS vinculado e flags
  const perfilPessoa = await consultarPerfilPessoaFisica(
    { cpf: cpfLimpo, nis: nisInformado },
    apiKey
  );

  if (perfilPessoa.status === "chave_invalida_ou_restrita" && !varreduraCompleta) {
    return {
      sucesso: false,
      status: perfilPessoa.status,
      erro: perfilPessoa.mensagem,
      linksOficiais,
    };
  }

  const cpfResolvido = digitsOnly(perfilPessoa.dados?.cpf) || cpfLimpo;
  const nisResolvido = digitsOnly(perfilPessoa.dados?.nis) || nisInformado;
  const rawFlags = perfilPessoa.dados?.rawFlags || {};
  const codigoConsulta = cpfResolvido || nisResolvido;

  // Decide quais endpoints consultar (todos na varredura completa, ou apenas sinalizados + principais quando modo econômico)
  const programasAlvo = PROGRAMAS_SOCIAIS_CONFIG.filter((prog) => {
    if (varreduraCompleta || !perfilPessoa.encontrado) return true;
    return Boolean(rawFlags[prog.flagKey]);
  });

  const settledProgramas = await Promise.allSettled(
    programasAlvo.map(async (prog) => {
      const params = {
        [prog.paramName]: codigoConsulta,
        pagina: prog.usePage ? paginaNum : undefined,
      };
      let res = await cguGet(prog.endpoint, params, apiKey, 7500);

      // Fallback automático por NIS caso a rota por CPF/NIS retorne vazio e haja NIS conhecido
      if (
        res.ok &&
        res.empty &&
        prog.fallbackNisEndpoint &&
        nisResolvido.length === 11
      ) {
        const resNis = await cguGet(
          prog.fallbackNisEndpoint,
          { nis: nisResolvido, pagina: paginaNum },
          apiKey,
          7500
        );
        if (resNis.ok && !resNis.empty) {
          res = resNis;
        }
      }

      const listaBruta = Array.isArray(res.data) ? res.data : [];
      const parcelas = listaBruta.map(prog.normalizer);
      const totalValor = parcelas.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);

      return {
        id: prog.id,
        nome: prog.nome,
        flagAtivaPerfilCgu: perfilPessoa.encontrado ? Boolean(rawFlags[prog.flagKey]) : null,
        status: res.ok ? (parcelas.length > 0 ? "encontrado" : "sem_parcelas") : res.estado,
        statusCode: res.statusCode,
        mensagem: res.mensagem || null,
        totalParcelas: parcelas.length,
        valorTotalPagina: totalValor,
        parcelas,
      };
    })
  );

  const programas = settledProgramas.map((s, idx) =>
    s.status === "fulfilled"
      ? s.value
      : {
          id: PROGRAMAS_SOCIAIS_CONFIG[idx]?.id || `prog_${idx}`,
          nome: PROGRAMAS_SOCIAIS_CONFIG[idx]?.nome || "Programa Social",
          status: "erro",
          totalParcelas: 0,
          valorTotalPagina: 0,
          parcelas: [],
        }
  );

  // Consolidar parcelas para linha do tempo unificada
  const todasParcelas = [];
  for (const p of programas) {
    for (const item of p.parcelas) {
      todasParcelas.push(item);
    }
  }
  todasParcelas.sort((a, b) => String(b.competencia || "").localeCompare(String(a.competencia || "")));

  const programasAtivos = programas.filter((p) => p.totalParcelas > 0 || p.flagAtivaPerfilCgu === true);
  const auxilioReconstrucaoFlag = Boolean(rawFlags.favorecidoAuxilioReconstrucao);
  const vinculoServidorFlag = Boolean(
    rawFlags.servidor || rawFlags.servidorInativo || rawFlags.pensionistaOuRepresentanteLegal
  );

  const valorTotalConsolidado = programas.reduce((acc, p) => acc + (p.valorTotalPagina || 0), 0);
  const municipiosSet = new Set(todasParcelas.map((p) => p.municipio).filter((m) => m && m !== "-"));

  const nomePrincipal =
    perfilPessoa.dados?.nome ||
    todasParcelas.find((p) => p.beneficiarioNome)?.beneficiarioNome ||
    null;

  const resultado = {
    sucesso: true,
    escopo: "Benefícios & Auxílios Sociais Federais (Portal da Transparência CGU)",
    consulta: {
      cpf: cpfResolvido || null,
      cpfFormatado: cpfResolvido ? formatCpf(cpfResolvido) : null,
      nis: nisResolvido || null,
      nome: nomePrincipal,
      varreduraCompleta: Boolean(varreduraCompleta),
      pagina: paginaNum,
    },
    resumo: {
      totalProgramasIdentificados: programasAtivos.length + (auxilioReconstrucaoFlag ? 1 : 0),
      totalParcelasPagina: todasParcelas.length,
      valorTotalParcelasPagina: valorTotalConsolidado,
      recebeAuxilioOuHistorico:
        todasParcelas.length > 0 ||
        programasAtivos.length > 0 ||
        auxilioReconstrucaoFlag,
      auxilioReconstrucaoFlag,
      vinculoServidorFederalAlerta: vinculoServidorFlag,
      municipios: Array.from(municipiosSet),
    },
    perfilPessoa,
    programas,
    todasParcelas,
    linksOficiais,
    notaRestricoesCgu:
      "Os endpoints individuais de benefícios ao cidadão são classificados pela CGU como APIs restritas (limite por minuto) e a tabela acima reflete os registros públicos da página consultada.",
    timestamp: new Date().toISOString(),
  };

  try {
    await cacheService.set("beneficios_auxilios", cacheKey, resultado, { ttlMs: 6 * 60 * 60 * 1000 });
  } catch {
    // Opcional
  }

  return resultado;
}
