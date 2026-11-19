/**
 * ==============================================================================
 * BACKEND INTERPRETER - RIMUAPI (SANT BUSCAS API ENGINE)
 * src/services/osint/interpreter/modules/rimuapi/index.js
 *
 * Normalizador canônico para todos os 43 módulos da RimuAPI.
 * Converte payloads com envelopes oficiais { status: true, response: [...] }
 * em DTOs ricos, tipados, com contratos seguros para a UI do RimuBusca.
 * ==============================================================================
 */

import {
  formatCpf,
  formatCnpj,
  formatPhone,
  formatCep,
  formatCurrency,
  parseBirthDate,
} from "../hexys/cpf.interpreter.js";

/**
 * Normaliza qualquer registro ou conjunto de registros da RimuAPI
 * @param {string} tipo - Nome do módulo (ex: 'cpf', 'cpf_completo', 'placa_ghost', 'razao_social', etc.)
 * @param {any} rawData - Resposta em dados.response da RimuAPI (array ou objeto)
 * @returns {any} DTO formatado e enriquecido
 */
export function interpretRimuApi(tipo, rawData) {
  if (!rawData) return rawData;

  const t = String(tipo || "").toLowerCase().trim();
  const registros = Array.isArray(rawData) ? rawData : [rawData];
  const primeiro = registros[0] || {};

  switch (t) {
    // ==========================================================================
    // 1. PESSOA: CPF & CPF COMPLETO (PRO) & RG & TITULO & CNS & NIS
    // ==========================================================================
    case "cpf":
    case "cpf_completo":
    case "rg":
    case "titulo":
    case "cns":
    case "nis": {
      return normalizarPessoaRimu(primeiro, t);
    }

    // ==========================================================================
    // 2. NOMES & HOMÔNIMOS (LISTAS)
    // ==========================================================================
    case "nome":
    case "nome_similar": {
      const lista = registros.map((item) => {
        const cpfRaw = item.CPF || item.cpf || "";
        const birthInfo = parseBirthDate(item.NASCIMENTO || item.NASC || item.nascimento);
        return {
          cpf: formatCpf(cpfRaw),
          cpf_raw: cpfRaw,
          nome: String(item.NOME || item.nome || "").toUpperCase(),
          sexo: (item.SEXO || item.sexo || "NÃO INFORMADO").toUpperCase(),
          nascimento: birthInfo.birthFormatted || item.NASCIMENTO || item.NASC || "Não informada",
          data_nascimento: birthInfo.birthFormatted,
          idade: birthInfo.age,
          signo: birthInfo.sign,
          nomeMae: item.NOME_MAE || item.nome_mae || null,
          nomePai: item.NOME_PAI || item.nome_pai || null,
        };
      });

      return {
        tipo: t,
        isList: true,
        total: lista.length,
        resultado: lista,
        resultados: lista,
        ...(lista.length === 1 ? lista[0] : {}),
      };
    }

    // ==========================================================================
    // 3. VACINAS COVID-19
    // ==========================================================================
    case "covid": {
      const vacinas = registros.map((v) => ({
        vacina: v.VACINA || v.vacina || "Não especificada",
        dose: v.DOSE || v.dose || "Dose Única",
        dataAplicacao: v.DATA_APLICACAO || v.data_aplicacao || "Data não informada",
        lote: v.LOTE || v.lote || "N/I",
        estabelecimento: v.ESTABELECIMENTO || v.estabelecimento || "Posto de Saúde",
        municipio: v.MUNICIPIO || v.municipio || "N/I",
        uf: v.UF || v.uf || "",
      }));

      return {
        tipo: "covid",
        isList: true,
        total: vacinas.length,
        vacinas,
        resultado: vacinas,
      };
    }

    // ==========================================================================
    // 4. BIOMETRIA FACIAL / FOTOS
    // ==========================================================================
    case "fotos":
    case "foto": {
      const fotosList = registros.map((f) => {
        const src = f.FOTO_BASE64 || f.foto_base64 || f.FOTO || f.foto || f.URL || f.url || null;
        return {
          cpf: formatCpf(f.CPF || f.cpf),
          nome: f.NOME || f.nome || "Não informado",
          fotoUrl: src,
          fotoSrc: src,
          fotoBase64: f.FOTO_BASE64 || f.foto_base64 || null,
          titulo: f.TITULO || f.titulo || "Foto de Documento Oficial",
          data: f.DATA || f.data || null,
        };
      });

      const fotoPrincipal = fotosList[0] || {};
      return {
        tipo: "foto",
        isImage: true,
        fotoSrc: fotoPrincipal.fotoSrc,
        fotoUrl: fotoPrincipal.fotoUrl,
        fotoBase64: fotoPrincipal.fotoBase64,
        titulo: fotoPrincipal.titulo,
        total: fotosList.length,
        fotos: fotosList,
        resultado: fotosList,
      };
    }

    // ==========================================================================
    // 5. TELEFONE & CONTATO
    // ==========================================================================
    case "telefone":
    case "celular":
    case "operadora": {
      const d = primeiro.DADOS || primeiro;
      const telArr = Array.isArray(primeiro.TELEFONE)
        ? primeiro.TELEFONE
        : Array.isArray(primeiro.TELEFONES)
          ? primeiro.TELEFONES
          : [];

      const endArr = Array.isArray(primeiro.ENDERECO)
        ? primeiro.ENDERECO
        : Array.isArray(primeiro.ENDERECOS)
          ? primeiro.ENDERECOS
          : [];

      const telefonesNormalizados = telArr.map((tItem) => ({
        numero: formatPhone(tItem.TELEFONE || tItem.telefone || tItem.numero),
        numeroLimpo: String(tItem.TELEFONE || tItem.telefone || "").replace(/\D/g, ""),
        operadora: tItem.OPERADORA || tItem.operadora || "Telefonia Móvel",
        tipo: tItem.TIPO || tItem.tipo || "Móvel",
        whatsapp: String(tItem.WHATSAPP || tItem.whatsapp || "").toUpperCase() === "SIM" || true,
        data: tItem.DT_TIMESTAMP || tItem.data || null,
      }));

      const enderecosNormalizados = normalizarListaEnderecos(endArr);

      return {
        tipo: "telefone",
        numeroConsultado: formatPhone(primeiro.TELEFONE?.[0]?.TELEFONE || d.TELEFONE || ""),
        titularNome: (d.NOME || d.nome || "Não informado").toUpperCase(),
        titularCpf: formatCpf(d.CPF || d.cpf),
        dataNascimento: d.NASC || d.nascimento || "Não informada",
        sexo: d.SEXO || d.sexo || "NÃO INFORMADO",
        telefones: telefonesNormalizados,
        enderecos: enderecosNormalizados,
        totalTelefones: telefonesNormalizados.length,
        resultado: {
          dados: d,
          telefones: telefonesNormalizados,
          enderecos: enderecosNormalizados,
        },
      };
    }

    // ==========================================================================
    // 6. E-MAIL & VÍNCULOS DIGITAIS
    // ==========================================================================
    case "email": {
      const d = primeiro.DADOS || primeiro;
      const vinculos = Array.isArray(primeiro.VINCULOS)
        ? primeiro.VINCULOS
        : Array.isArray(primeiro.vinculos)
          ? primeiro.vinculos
          : [];

      return {
        tipo: "email",
        email: vinculos[0]?.EMAIL || d.EMAIL || "",
        cpf: formatCpf(d.CPF || d.cpf),
        nome: (d.NOME || d.nome || "").toUpperCase(),
        sexo: d.SEXO || d.sexo || "",
        nascimento: d.NASC || d.nascimento || "",
        vinculos: vinculos.map((v) => ({
          email: v.EMAIL || v.email,
          dominio: v.DOMINIO || v.dominio,
          origem: v.ORIGEM || v.origem || "Cadastro Oficial",
          ultimaAtualizacao: v.ULTIMA_ATUALIZACAO || v.ultima_atualizacao,
        })),
        resultado: {
          dados: d,
          vinculos,
        },
      };
    }

    // ==========================================================================
    // 7. CEP & ENDEREÇOS
    // ==========================================================================
    case "cep":
    case "cep_avancado":
    case "endereco": {
      const moradores = registros
        .filter((r) => r.DADOS?.CPF || r.DADOS?.NOME || r.CPF || r.NOME)
        .map((r) => {
          const d = r.DADOS || r;
          return {
            cpf: formatCpf(d.CPF || d.cpf),
            nome: (d.NOME || d.nome || "").toUpperCase(),
            sexo: d.SEXO || d.sexo || "NÃO INFORMADO",
            nascimento: d.NASC || d.NASCIMENTO || d.nascimento || "Não informada",
          };
        });

      const end = primeiro.ENDERECO || primeiro.ENDERECOS?.[0] || primeiro;
      const logradouro =
        [end.LOGR_TIPO || end.tipoLogradouro, end.LOGR_NOME || end.logradouro || end.rua]
          .filter(Boolean)
          .join(" ")
          .trim() || "Logradouro não informado";

      return {
        tipo: "cep",
        cep: formatCep(end.CEP || end.cep),
        cepLimpo: String(end.CEP || end.cep || "").replace(/\D/g, ""),
        logradouro,
        numero: end.LOGR_NUMERO || end.numero || "S/N",
        complemento: end.LOGR_COMPLEMENTO || end.complemento || "",
        bairro: end.BAIRRO || end.bairro || "Não informado",
        cidade: end.CIDADE || end.cidade || "Não informada",
        uf: (end.UF || end.uf || "").toUpperCase(),
        totalResidentesEstimados: moradores.length,
        residentes: moradores,
        moradores,
        resultado: {
          endereco: end,
          moradores,
        },
      };
    }

    // ==========================================================================
    // 8. VEÍCULOS (PLACA, PLACA_GHOST, CNH, CHASSI, RENAVAM)
    // ==========================================================================
    case "placa":
    case "placa_ghost":
    case "chassi":
    case "renavam":
    case "cnh": {
      return normalizarVeiculoRimu(primeiro, t);
    }

    // ==========================================================================
    // 9. FINANCEIRO (SCORE, APOSENTADO, PIS)
    // ==========================================================================
    case "score": {
      const d = primeiro.DADOS || primeiro;
      const scoreNum = parseInt(String(d.SCORE || d.score || "0").replace(/\D/g, ""), 10) || 0;
      const faixa =
        d.FAIXA_RENDA_ID ||
        (scoreNum >= 800 ? "EXCELENTE" : scoreNum >= 600 ? "BOM" : scoreNum >= 400 ? "MÉDIO" : "REGULAR");

      return {
        tipo: "score",
        cpf: formatCpf(d.CPF || d.cpf),
        nome: (d.NOME || d.nome || "").toUpperCase(),
        renda: d.RENDA || d.renda || "Não informada",
        faixaRenda: d.FAIXA_RENDA_ID || d.faixa || "N/I",
        mosaic: d.CD_MOSAIC || d.mosaic || "N/I",
        score: {
          valor: scoreNum || "N/A",
          faixa,
          display: scoreNum ? `${scoreNum} (${faixa})` : "N/A",
        },
        resultado: d,
      };
    }

    case "aposentado": {
      const beneficios = Array.isArray(primeiro.BENEFICIOS)
        ? primeiro.BENEFICIOS
        : Array.isArray(primeiro.beneficios)
          ? primeiro.beneficios
          : [];

      return {
        tipo: "aposentado",
        cpf: formatCpf(primeiro.CPF || primeiro.cpf),
        nome: (primeiro.NOME || primeiro.nome || "").toUpperCase(),
        totalBeneficios: beneficios.length,
        beneficios: beneficios.map((b) => ({
          numero: b.NUMERO_BENEFICIO || b.numero,
          especie: b.ESPECIE || b.especie || "Benefício INSS",
          valor: b.VALOR || b.valor || "Não informado",
          dataInicio: b.DATA_INICIO || b.data_inicio || "N/I",
          status: b.STATUS || b.status || "ATIVO",
          banco: b.BANCO || b.banco || "Não informado",
          agencia: b.AGENCIA || b.agencia || "N/I",
        })),
        resultado: primeiro,
      };
    }

    case "pis": {
      const d = primeiro.DADOS || primeiro;
      return {
        tipo: "pis",
        cpf: formatCpf(d.CPF || d.cpf),
        nome: (d.NOME || d.nome || "").toUpperCase(),
        pis: d.PIS || d.NIS || d.pis || d.nis || "",
        resultado: d,
      };
    }

    // ==========================================================================
    // 10. EMPRESA & JURÍDICO (CNPJ, CNPJ2, RAZAO_SOCIAL, SOCIOS, FUNCIONARIOS, EMPREGOS, OAB)
    // ==========================================================================
    case "cnpj":
    case "cnpj2":
    case "razao_social": {
      return normalizarEmpresaRimu(registros, t);
    }

    case "socios":
    case "socios2": {
      const listaSocios = registros.map((s) => ({
        cnpj: formatCnpj(s.CNPJ || s.cnpj),
        razaoSocial: (s.RAZAO_SOCIAL || s.razao_social || "").toUpperCase(),
        qualificacao: s.QUALIFICACAO || s.qualificacao || "SÓCIO",
        dataEntrada: s.DATA_ENTRADA || s.data_entrada || "Não informada",
        percentualCapital: s.PERCENTUAL_CAPITAL || s.percentual_capital || "N/I",
      }));

      return {
        tipo: "socios",
        isList: true,
        total: listaSocios.length,
        socios: listaSocios,
        resultado: listaSocios,
      };
    }

    case "funcionarios": {
      const listaFunc = registros.map((f) => ({
        cpf: formatCpf(f.CPF || f.cpf),
        nome: (f.NOME || f.nome || "").toUpperCase(),
        cargo: f.CARGO || f.cargo || "Não especificado",
        dataAdmissao: f.DATA_ADMISSAO || f.data_admissao || "N/I",
        remuneracao: f.REMUNERACAO || f.remuneracao || "N/I",
      }));

      return {
        tipo: "funcionarios",
        isList: true,
        total: listaFunc.length,
        funcionarios: listaFunc,
        resultado: listaFunc,
      };
    }

    case "empregos": {
      const listaEmp = registros.map((e) => ({
        razaoSocial: (e.RAZAO_SOCIAL || e.razao_social || "").toUpperCase(),
        cnpj: formatCnpj(e.CNPJ || e.cnpj),
        cargo: e.CARGO || e.cargo || "Não informado",
        dataAdmissao: e.DATA_ADMISSAO || e.data_admissao || "N/I",
        dataDemissao: e.DATA_DEMISSAO || e.data_demissao || "Atual",
      }));

      return {
        tipo: "empregos",
        isList: true,
        total: listaEmp.length,
        empregos: listaEmp,
        resultado: listaEmp,
      };
    }

    case "oab": {
      const advs = Array.isArray(primeiro.ADVOGADOS)
        ? primeiro.ADVOGADOS
        : registros.map((r) => r.ADVOGADOS || r).flat();

      const listaAdv = advs.map((a) => ({
        nome: (a.NOME || a.nome || "").toUpperCase(),
        inscricao: a.INSCRICAO || a.inscricao || "",
        seccional: (a.SECCIONAL || a.seccional || "").toUpperCase(),
        subsecao: a.SUBSECAO || a.subsecao || "",
        categoria: a.CATEGORIA || a.categoria || "ADVOGADO(A)",
        enderecoProfissional: a.ENDERECO_PROFISSIONAL || a.endereco || "N/I",
        telefoneProfissional: formatPhone(a.TELEFONE_PROFISSIONAL || a.telefone),
        situacao: (a.SITUACAO || a.situacao || "REGULAR").toUpperCase(),
        fotoUrl: a.FOTO_URL || a.foto_url || null,
      }));

      return {
        tipo: "oab",
        isList: true,
        total: listaAdv.length,
        advogados: listaAdv,
        resultado: listaAdv,
        ...(listaAdv.length === 1 ? listaAdv[0] : {}),
      };
    }

    // ==========================================================================
    // 11. FAMÍLIA (MAE, PAI, PARENTES, ARVORE_FAMILIAR)
    // ==========================================================================
    case "mae":
    case "pai": {
      const filhos = registros.map((f) => ({
        cpf: formatCpf(f.CPF || f.cpf),
        cpf_raw: String(f.CPF || f.cpf || "").replace(/\D/g, ""),
        nome: (f.NOME || f.nome || "").toUpperCase(),
        nascimento: f.NASCIMENTO || f.NASC || f.nascimento || "Não informada",
        nomeMae: (f.NOME_MAE || f.nome_mae || "").toUpperCase(),
        nomePai: (f.NOME_PAI || f.nome_pai || "").toUpperCase(),
      }));

      return {
        tipo: t,
        isList: true,
        total: filhos.length,
        filhos,
        resultado: filhos,
      };
    }

    case "parentes":
    case "arvore_familiar": {
      const parentesList = (primeiro.PARENTES || primeiro.parentes || []).map((p) => ({
        cpf: formatCpf(p.CPF_VINCULO || p.CPF || p.cpf),
        cpf_raw: String(p.CPF_VINCULO || p.CPF || p.cpf || "").replace(/\D/g, ""),
        nome: (p.NOME_VINCULO || p.NOME || p.nome || "").toUpperCase(),
        vinculo: (p.VINCULO || p.vinculo || "PARENTESCO").toUpperCase(),
      }));

      return {
        tipo: "parentes",
        cpf: formatCpf(primeiro.CPF || primeiro.cpf),
        totalParentes: parentesList.length,
        parentes: parentesList,
        resultado: {
          cpf: primeiro.CPF || primeiro.cpf,
          parentes: parentesList,
        },
      };
    }

    // ==========================================================================
    // 12. VAZADOS & SEGURANÇA (DESMASCARADOR, CLOUD_URL, CLOUD_USUARIO, SENHA, DUMP_CPF)
    // ==========================================================================
    case "desmascarador": {
      const lista = registros.map((item) => ({
        cpf: formatCpf(item.CPF || item.cpf),
        cpf_raw: String(item.CPF || item.cpf || "").replace(/\D/g, ""),
        nome: (item.NOME || item.nome || "").toUpperCase(),
        nascimento: item.NASCIMENTO || item.nascimento || "Não informada",
        nomeMae: item.NOME_MAE || item.nome_mae || "Não informada",
        chaveInformada: item.CHAVE_INFORMADA || item.chave_informada || "",
      }));

      return {
        tipo: "desmascarador",
        isList: true,
        total: lista.length,
        desmascarados: lista,
        resultado: lista,
        ...(lista.length === 1 ? lista[0] : {}),
      };
    }

    case "cloud_url":
    case "cloud_usuario":
    case "senha":
    case "dump_cpf":
    case "dump_email":
    case "dump_telefone": {
      return {
        tipo: t,
        isList: true,
        total: registros.length,
        registros,
        resultado: registros,
      };
    }

    // ==========================================================================
    // 13. GERADORES (GERADOR_ESTADO, GERADOR_CBO)
    // ==========================================================================
    case "gerador_estado":
    case "gerador_cbo": {
      return {
        tipo: t,
        dados: primeiro,
        resultado: primeiro,
      };
    }

    default:
      return rawData;
  }
}

/**
 * Normaliza objetos completos de Pessoa Física da RimuAPI
 */
function normalizarPessoaRimu(raw, tipo) {
  if (!raw || typeof raw !== "object") return {};

  // Caso 1: Envelope canônico DADOS (ex: módulo cpf básico, rg, titulo, cns)
  // Caso 2: Envelope canônico DADOS_PESSOAIS (ex: módulo cpf_completo / PRO)
  const d =
    raw.DADOS ||
    (Array.isArray(raw.DADOS_PESSOAIS) ? raw.DADOS_PESSOAIS[0] : raw.DADOS_PESSOAIS) ||
    raw;

  const rawCpf = String(d.CPF || raw.CPF || d.cpf || "").replace(/\D/g, "");
  const formattedCpf = formatCpf(rawCpf);
  const nomeCompleto = String(d.NOME || d.nome || "NOME NÃO INFORMADO").toUpperCase();

  const birthRaw = d.NASC || d.NASCIMENTO || d.nascimento || d.data_nascimento;
  const { age, birthFormatted, sign } = parseBirthDate(birthRaw);

  const nomeMae = String(d.NOME_MAE || d.NOME_DA_MAE || d.nomeMae || "NÃO INFORMADA").toUpperCase();
  const nomePai = String(d.NOME_PAI || d.NOME_DO_PAI || d.nomePai || "NÃO INFORMADO").toUpperCase();

  let sexo = String(d.SEXO || d.sexo || "NÃO INFORMADO").toUpperCase();
  if (sexo === "M") sexo = "MASCULINO";
  if (sexo === "F") sexo = "FEMININO";

  const situacaoReceita = String(
    d.CD_SIT_CAD || d.SITUACAO || d.situacaoCadastral || "REGULAR"
  ).toUpperCase();

  // Telefones
  let rawTels = [];
  if (Array.isArray(raw.TELEFONES) && raw.TELEFONES.length > 0) {
    rawTels = raw.TELEFONES;
  } else if (Array.isArray(raw.HISTORICO_TELEFONE) || Array.isArray(raw.ULTIMO_TELEFONE)) {
    rawTels = [
      ...(Array.isArray(raw.HISTORICO_TELEFONE) ? raw.HISTORICO_TELEFONE : []),
      ...(Array.isArray(raw.ULTIMO_TELEFONE) ? raw.ULTIMO_TELEFONE : []),
    ];
  } else if (Array.isArray(raw.TELEFONE)) {
    rawTels = raw.TELEFONE;
  }

  const telsMap = new Map();
  for (const t of rawTels) {
    const rawNum = String(t.TELEFONE || t.telefone || t.numero || "").replace(/\D/g, "");
    if (rawNum.length >= 8 && !telsMap.has(rawNum)) {
      telsMap.set(rawNum, {
        numero: formatPhone(rawNum),
        numeroLimpo: rawNum,
        operadora: t.OPERADORA || t.operadora || "Móvel",
        tipo: t.TIPO_TELEFONE || t.TIPO || t.tipo || "Móvel",
        whatsApp: String(t.WHATSAPP || t.whatsapp || "").toUpperCase() === "SIM",
        data: t.DT_TIMESTAMP || t.DT_INFORMACAO || t.data || null,
      });
    }
  }
  const telefonesNormalizados = Array.from(telsMap.values());

  // E-mails
  const rawEmails = Array.isArray(raw.EMAILS)
    ? raw.EMAILS
    : Array.isArray(raw.EMAIL)
      ? raw.EMAIL
      : raw.EMAIL
        ? [raw.EMAIL]
        : [];
  const emailsNormalizados = rawEmails
    .map((e) => (typeof e === "string" ? e : e.EMAIL || e.email || ""))
    .filter(Boolean);

  // Veículos vinculados
  const rawVeiculos = [
    ...(Array.isArray(raw.HISTORICO_VEICULOS) ? raw.HISTORICO_VEICULOS : []),
    ...(Array.isArray(raw.ULTIMO_VEICULOS) ? raw.ULTIMO_VEICULOS : []),
    ...(Array.isArray(raw.VEICULOS) ? raw.VEICULOS : []),
  ];

  // Score e dados socioeconômicos
  const scoreBloco = Array.isArray(raw.SCORE) ? raw.SCORE[0] : raw.SCORE;
  const scoreValor = scoreBloco?.CSB8 || scoreBloco?.SCORE || d.SCORE || null;
  const scoreFaixa = scoreBloco?.CSB8_FAIXA || d.FAIXA_RENDA_ID || null;

  // Endereços
  const rawEnds = Array.isArray(raw.ENDERECOS)
    ? raw.ENDERECOS
    : Array.isArray(raw.ENDERECO)
      ? raw.ENDERECO
      : raw.ENDERECO
        ? [raw.ENDERECO]
        : [];

  const enderecosNormalizados = normalizarListaEnderecos(rawEnds);

  // Parentes
  const rawParentes = Array.isArray(raw.PARENTES)
    ? raw.PARENTES
    : Array.isArray(raw.parentes)
      ? raw.parentes
      : [];

  const parentesNormalizados = rawParentes.map((p) => ({
    nome: (p.NOME || p.NOME_VINCULO || p.nome || "").toUpperCase(),
    vinculo: (p.VINCULO || p.vinculo || "PARENTESCO").toUpperCase(),
    cpf: formatCpf(p.CPF || p.CPF_VINCULO || p.cpf),
    cpf_raw: String(p.CPF || p.CPF_VINCULO || p.cpf || "").replace(/\D/g, ""),
  }));

  // CNS
  const rawCns = Array.isArray(raw.CNS) ? raw.CNS : raw.CNS ? [raw.CNS] : [];
  const cnsNormalizado = rawCns.map((c) => ({
    numero: c.NUMERO_CNS || c.CNS || c.cns,
    tipo: c.TIPO || c.tipo || "DEFINITIVO",
    ativo: c.ATIVO || c.ativo || "SIM",
  }));

  return {
    tipo,
    cpf: formattedCpf,
    cpf_raw: rawCpf,
    cpf_masked: formattedCpf,
    nome: nomeCompleto,
    name: nomeCompleto,
    dataNascimento: birthFormatted || birthRaw,
    data_nascimento: birthFormatted || birthRaw,
    idade: age || d.IDADE || d.idade || null,
    signo: sign || d.SIGNO || d.signo || null,
    sexo,
    gender: sexo,
    nomeMae,
    mother_name: nomeMae,
    nomePai,
    father_name: nomePai,
    estadoCivil: d.ESTCIV || d.ESTADO_CIVIL || d.estado_civil || "Não informado",
    rg: d.RG || d.rg || null,
    rgEmissor: d.ORGAO_EMISSOR || d.UF_EMISSAO ? `${d.ORGAO_EMISSOR || "SSP"}/${d.UF_EMISSAO || ""}` : null,
    tituloEleitor: d.TITULO_ELEITOR || d.titulo || null,
    cbo: d.CBO || d.cbo || null,
    profissao: d.CBO || d.profissao || "Não informada",
    nacionalidade: d.NACIONALID || d.nacionalidade || "BRASILEIRA",
    situacaoCadastral: situacaoReceita,
    telefones: telefonesNormalizados,
    enderecos: enderecosNormalizados,
    endereco: enderecosNormalizados[0] || null,
    parentes: parentesNormalizados,
    cns: cnsNormalizado,
    emails: emailsNormalizados,
    veiculos: rawVeiculos,
    score: scoreValor ? { valor: scoreValor, faixa: scoreFaixa } : null,
    totalTelefones: telefonesNormalizados.length,
    totalEnderecos: enderecosNormalizados.length,
    totalParentes: parentesNormalizados.length,
    totalEmails: emailsNormalizados.length,
    totalVeiculos: rawVeiculos.length,
    raw,
  };
}

/**
 * Normaliza objetos de Veículos da RimuAPI (placa, placa_ghost, etc.)
 */
function normalizarVeiculoRimu(raw, tipo) {
  if (!raw || typeof raw !== "object") return {};

  const v = raw.VEICULO || raw;

  const placa = String(v.PLACA || v.placa || "").toUpperCase();
  const renavam = v.RENAVAM || v.renavam || "N/I";
  const chassi = v.CHASSI || v.chassi || "N/I";
  const marcaModelo = v.MARCA || v.marcaModelo || v.marca || "N/I";
  const cor = (v.COR_DO_VEICULO || v.cor || "N/I").toUpperCase();
  const anoModelo = v.ANO_DO_MODELO || v.anoModelo || "N/I";
  const anoFabricacao = v.ANO_DE_FABRICACAO || v.anoFabricacao || "N/I";
  const combustivel = v.combustivel || "ALCOOL/GASOLINA";
  const situacao = (v.SITUACAO_DO_VEICULO || v.situacao || "CIRCULAR").toUpperCase();
  const cidade = v.CIDADE || v.municipio_nome || "N/I";
  const uf = (v.UF_PLACA || v.municipio_uf || "").toUpperCase();

  // Proprietário
  let propNome = v.PROPRIETARIO_NOME || v.proprietario_nome || null;
  let propDoc = v.PROPRIETARIO_DOC || v.proprietario_documento || null;

  if (Array.isArray(raw.PROPRIETARIO_DADOS) && raw.PROPRIETARIO_DADOS[0]) {
    const pd = raw.PROPRIETARIO_DADOS[0];
    propNome = propNome || pd.NOME;
  }

  const telefonesProp = (raw.PROPRIETARIO_TELEFONE || []).map((t) => ({
    numero: formatPhone(t.TELEFONE || t.telefone),
    data: t.DT_TIMESTAMP || null,
  }));

  const enderecosProp = normalizarListaEnderecos(raw.PROPRIETARIO_ENDERECO || []);

  const cnhProp = Array.isArray(raw.PROPRIETARIO_CNH) && raw.PROPRIETARIO_CNH[0]
    ? {
        numero: raw.PROPRIETARIO_CNH[0].NUMERO_CNH,
        uf: raw.PROPRIETARIO_CNH[0].SIGLA_UF,
        primeiraHabilitacao: raw.PROPRIETARIO_CNH[0].DT_PRIMEIRA_CNH,
      }
    : null;

  return {
    tipo,
    placa,
    plate: placa,
    renavam,
    chassi,
    marcaModelo,
    brand: marcaModelo,
    model: marcaModelo,
    cor,
    color: cor,
    anoModelo,
    anoFabricacao,
    combustivel,
    potencia: v.potencia || null,
    cilindradas: v.cilindradas || null,
    situacao,
    numeroMotor: v.numeromotor || null,
    cidade,
    uf,
    municipio: cidade && uf ? `${cidade}/${uf}` : cidade,
    proprietario: {
      nome: propNome ? String(propNome).toUpperCase() : "Não informado",
      documento: propDoc ? (propDoc.length > 11 ? formatCnpj(propDoc) : formatCpf(propDoc)) : "N/I",
      cnh: cnhProp,
      telefones: telefonesProp,
      enderecos: enderecosProp,
    },
    restricoes: v.restricao1 || "SEM RESTRIÇÃO",
    leilao: v.leilao || "NÃO CONSTA",
    rouboFurto: v.rouboFurto || "NADA CONSTA",
    raw,
  };
}

/**
 * Normaliza empresas da RimuAPI (CNPJ, CNPJ2, Razão Social)
 */
function normalizarEmpresaRimu(registros, tipo) {
  const lista = (Array.isArray(registros) ? registros : [registros]).map((item) => {
    const emp = Array.isArray(item.EMPRESA) ? item.EMPRESA[0] : item.EMPRESA || item;
    const est = Array.isArray(item.ESTABELECIMENTO)
      ? item.ESTABELECIMENTO[0]
      : item.ESTABELECIMENTO || item;
    const simples = Array.isArray(item.SIMPLES) ? item.SIMPLES[0] : item.SIMPLES || {};
    const sociosRaw = Array.isArray(item.SOCIOS) ? item.SOCIOS : item.SOCIOS ? [item.SOCIOS] : [];

    const cnpjRaw = emp.CNPJ || est.CNPJ || "";
    const socios = sociosRaw.map((s) => ({
      nome: (s.NOME_SOCIO || s.nome || "").toUpperCase(),
      qualificacao: s.QUALIFICACAO_SOCIO || s.qualificacao || "SÓCIO",
      documento: s.CPF_CNPJ_SOCIO || s.cpf || s.cnpj || null,
    }));

    return {
      cnpj: formatCnpj(cnpjRaw),
      cnpj_raw: cnpjRaw.replace(/\D/g, ""),
      razaoSocial: (emp.RAZAO_SOCIAL || est.NOME_FANTASIA || "").toUpperCase(),
      nomeFantasia: (est.NOME_FANTASIA || emp.RAZAO_SOCIAL || "").toUpperCase(),
      naturezaJuridica: emp.NATUREZA_JURIDICA || "Sociedade Empresária",
      capitalSocial: emp.CAPITAL_SOCIAL ? formatCurrency(emp.CAPITAL_SOCIAL) : "Não informado",
      porte: emp.PORTE_EMPRESA || "DEMAIS",
      situacaoCadastral: (est.SITUACAO_CADASTRAL || "ATIVA").toUpperCase(),
      dataSituacaoCadastral: est.DT_SITUACAO_CADASTRAL || null,
      dataInicioAtividade: est.DT_INICIO_ATIVIDADE || null,
      cnaePrincipal: est.CNAE_FISCAL_PRINCIPAL || null,
      endereco: {
        logradouro: [est.TIPO_LOGRADOURO, est.LOGRADOURO].filter(Boolean).join(" "),
        numero: est.NUMERO || "S/N",
        bairro: est.BAIRRO || "",
        cidade: est.CIDADE || "",
        uf: (est.UF || "").toUpperCase(),
        cep: formatCep(est.CEP || ""),
      },
      simplesNacional: simples.OPCAO_SIMPLES || "NAO",
      mei: simples.OPCAO_MEI || "NAO",
      socios,
      totalSocios: socios.length,
    };
  });

  if (lista.length === 1) {
    return {
      tipo,
      ...lista[0],
      isList: false,
      resultado: lista[0],
    };
  }

  return {
    tipo,
    isList: true,
    total: lista.length,
    empresas: lista,
    resultado: lista,
  };
}

/**
 * Normaliza listas heterogêneas de endereços
 */
function normalizarListaEnderecos(arr) {
  if (!Array.isArray(arr)) return [];

  return arr
    .filter(Boolean)
    .map((end) => {
      const tipoLogr = end.LOGR_TIPO || end.tipoLogradouro || "";
      const nomeLogr = end.LOGR_NOME || end.LOGRADOURO || end.logradouro || end.rua || "";
      const logradouro = [tipoLogr, nomeLogr].filter(Boolean).join(" ").trim() || "Não informado";

      return {
        logradouro,
        numero: end.LOGR_NUMERO || end.NUMERO || end.numero || "S/N",
        complemento: end.LOGR_COMPLEMENTO || end.COMPLEMENTO || end.complemento || "",
        bairro: end.BAIRRO || end.bairro || "Não informado",
        cidade: end.CIDADE || end.cidade || "Não informada",
        uf: (end.UF || end.uf || "").toUpperCase(),
        cep: formatCep(end.CEP || end.cep || ""),
        cepLimpo: String(end.CEP || end.cep || "").replace(/\D/g, ""),
        dataAtualizacao: end.DT_TIMESTAMP || end.DT_ATUALIZACAO || end.data || null,
      };
    });
}

export default interpretRimuApi;
