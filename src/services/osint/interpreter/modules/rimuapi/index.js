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
export function interpretRimuApi(tipo, rawData, termo = null) {
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
    // 2. NOMES: NOME COMPLETO (1 RESULTADO) vs NOME SIMILAR (LISTA HOMÔNIMOS)
    // ==========================================================================
    case "nome": {
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
          ...(item.DADOS ? item.DADOS : {}),
        };
      });

      const primeiroNome = lista[0] || {};
      return {
        tipo: "nome",
        ...primeiroNome,
        total: 1,
        resultado: [primeiroNome],
        resultados: [primeiroNome],
      };
    }

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
        tipo: "nome_similar",
        isList: true,
        total: lista.length,
        resultado: lista,
        resultados: lista,
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
      const d = primeiro.DADOS || primeiro.dados || (Array.isArray(primeiro.DADOS_PESSOAIS) ? primeiro.DADOS_PESSOAIS[0] : (primeiro.DADOS_PESSOAIS || primeiro.dadosPessoais)) || primeiro;

      // 1. Caso a API retorne o dossiê cadastral completo do titular associado à linha
      if (
        primeiro.DADOS ||
        primeiro.dados ||
        primeiro.CPF ||
        primeiro.cpf ||
        primeiro.NOME ||
        primeiro.nome ||
        primeiro.DADOS_PESSOAIS ||
        primeiro.dadosPessoais ||
        d.CPF ||
        d.cpf ||
        d.NOME ||
        d.nome
      ) {
        const pessoaNorm = normalizarPessoaRimu(primeiro, "telefone");
        const telConsultado = formatPhone(
          termo ||
          rawData?.termo ||
          primeiro.TELEFONE?.[0]?.TELEFONE ||
          d.TELEFONE ||
          d.telefone ||
          (Array.isArray(d.telefones) && (d.telefones[0]?.numero || d.telefones[0]?.telefone)) ||
          ""
        );

        return {
          ...pessoaNorm,
          tipo: "telefone",
          numeroConsultado: telConsultado,
          titularNome: pessoaNorm.nome,
          titularCpf: pessoaNorm.cpf,
        };
      }

      // 2. Consulta de operadora ou lista de telefones sem titular completo
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
        numeroConsultado: formatPhone(rawData?.termo || primeiro.TELEFONE?.[0]?.TELEFONE || primeiro.telefone || ""),
        operadora: primeiro.OPERADORA || primeiro.operadora || telefonesNormalizados[0]?.operadora || "Telefonia Móvel",
        portabilidade: primeiro.PORTABILIDADE || primeiro.portabilidade || false,
        telefones: telefonesNormalizados,
        enderecos: enderecosNormalizados,
        totalTelefones: telefonesNormalizados.length,
      };
    }

    // ==========================================================================
    // 6. E-MAIL & VÍNCULOS DIGITAIS
    // ==========================================================================
    case "email": {
      const emailConsultado = String(
        termo ||
        rawData?.termo ||
        primeiro.EMAIL ||
        primeiro.email ||
        primeiro.DADOS?.EMAIL ||
        primeiro.dados?.EMAIL ||
        (Array.isArray(primeiro.VINCULOS) && primeiro.VINCULOS[0]?.EMAIL) ||
        (Array.isArray(primeiro.vinculos) && primeiro.vinculos[0]?.email) ||
        ""
      ).trim().toLowerCase();

      // 1. Caso a API retorne o dossiê da pessoa titular vinculada ao e-mail
      if (
        primeiro.DADOS ||
        primeiro.dados ||
        primeiro.CPF ||
        primeiro.cpf ||
        primeiro.NOME ||
        primeiro.nome ||
        primeiro.DADOS_PESSOAIS ||
        primeiro.dadosPessoais
      ) {
        const pessoaNorm = normalizarPessoaRimu(primeiro, "email");
        const rawVinculos = Array.isArray(primeiro.VINCULOS)
          ? primeiro.VINCULOS
          : Array.isArray(primeiro.vinculos)
            ? primeiro.vinculos
            : [];
        const vinculos = rawVinculos.map((v) => ({
          email: v.EMAIL || v.email,
          dominio: v.DOMINIO || v.dominio,
          origem: v.ORIGEM || v.origem || "Cadastro Oficial",
          ultimaAtualizacao: v.ULTIMA_ATUALIZACAO || v.ultima_atualizacao,
        }));

        const emailsList = Array.from(
          new Set([emailConsultado, ...(pessoaNorm.emails || [])].filter(Boolean))
        );

        return {
          ...pessoaNorm,
          tipo: "email",
          email: emailConsultado,
          emails: emailsList,
          vinculos,
          totalEmails: emailsList.length,
          titularNome: pessoaNorm.nome,
          titularCpf: pessoaNorm.cpf,
          raw: rawData,
        };
      }

      // 2. Consulta de vínculos pura
      const d = primeiro.DADOS || primeiro;
      const vinculos = Array.isArray(primeiro.VINCULOS)
        ? primeiro.VINCULOS
        : Array.isArray(primeiro.vinculos)
          ? primeiro.vinculos
          : [];

      return {
        tipo: "email",
        email: emailConsultado,
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

  // Caso 1: Envelope canônico DADOS / dados (ex: módulo cpf básico, rg, titulo, cns)
  // Caso 2: Envelope canônico DADOS_PESSOAIS / dadosPessoais (ex: módulo cpf_completo / PRO)
  const d =
    raw.DADOS ||
    raw.dados ||
    (Array.isArray(raw.DADOS_PESSOAIS) ? raw.DADOS_PESSOAIS[0] : (raw.DADOS_PESSOAIS || raw.dadosPessoais)) ||
    (Array.isArray(raw.dados_pessoais) ? raw.dados_pessoais[0] : raw.dados_pessoais) ||
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

  // 1. Extração rica de Telefones com separação por Operadora
  const telsMap = new Map();

  function registrarTelefone(rawNum, dadosExtras = {}) {
    if (!rawNum) return;
    const clean = String(rawNum).replace(/\D/g, "");
    if (clean.length < 8) return;

    let fullClean = clean;
    if ((clean.length === 8 || clean.length === 9) && dadosExtras.ddd) {
      const cleanDdd = String(dadosExtras.ddd).replace(/\D/g, "");
      if (cleanDdd) fullClean = cleanDdd + clean;
    }

    const fmt = formatPhone(fullClean);
    const isMobile = fullClean.length === 11 || (fullClean.length === 9 && fullClean.startsWith("9"));

    const existing = telsMap.get(fullClean) || {};
    telsMap.set(fullClean, {
      numero: fmt,
      numeroLimpo: fullClean,
      operadora: dadosExtras.operadora || existing.operadora || (isMobile ? "Móvel" : "Fixo"),
      tipo: dadosExtras.tipo || existing.tipo || (isMobile ? "Celular" : "Fixo"),
      whatsApp: dadosExtras.whatsApp !== undefined ? dadosExtras.whatsApp : (isMobile || existing.whatsApp || false),
      dataInstalacao: dadosExtras.dataInstalacao || existing.dataInstalacao || null,
      data: dadosExtras.data || existing.data || null,
      enderecoLinha: dadosExtras.enderecoLinha || existing.enderecoLinha || null,
      bairro: dadosExtras.bairro || existing.bairro || null,
      cidade: dadosExtras.cidade || existing.cidade || null,
      uf: dadosExtras.uf || existing.uf || null,
      cep: dadosExtras.cep || existing.cep || null,
      origem: dadosExtras.origem || existing.origem || "Cadastro",
    });
  }

  // Operadora VIVO
  if (Array.isArray(raw.OPERADORA_VIVO)) {
    for (const v of raw.OPERADORA_VIVO) {
      const endParts = [
        v.ENDERECO ? `${v.ENDERECO}${v.NUMERO ? `, ${v.NUMERO}` : ""}` : null,
        v.BAIRRO ? `Bairro ${v.BAIRRO}` : null,
        v.CEP ? `CEP ${formatCep(v.CEP)}` : null,
      ].filter(Boolean);

      registrarTelefone(v.TELEFONE, {
        operadora: "VIVO",
        origem: "Base Telefônica VIVO",
        dataInstalacao: v.DATA_INSTALACAO || null,
        enderecoLinha: endParts.length > 0 ? endParts.join(" - ") : null,
        bairro: v.BAIRRO || null,
        cep: v.CEP ? formatCep(v.CEP) : null,
      });
    }
  }

  // Operadora CLARO
  if (Array.isArray(raw.OPERADORA_CLARO)) {
    for (const c of raw.OPERADORA_CLARO) {
      registrarTelefone(c.FONE || c.TELEFONE, {
        ddd: c.DDD || "",
        operadora: "CLARO",
        origem: "Base Telefônica CLARO",
        dataInstalacao: c.INST || null,
      });
    }
  }

  // Operadora TIM
  if (Array.isArray(raw.OPERADORA_TIM)) {
    for (const t of raw.OPERADORA_TIM) {
      registrarTelefone(t.FONE || t.TELEFONE, {
        ddd: t.DDD || "",
        operadora: "TIM",
        origem: "Base Telefônica TIM",
        dataInstalacao: t.INST || t.DATA_INSTALACAO || null,
      });
    }
  }

  // Operadora OI
  if (Array.isArray(raw.OPERADORA_OI)) {
    for (const o of raw.OPERADORA_OI) {
      registrarTelefone(o.FONE || o.TELEFONE, {
        ddd: o.DDD || "",
        operadora: "OI",
        origem: "Base Telefônica OI",
        dataInstalacao: o.INST || o.DATA_INSTALACAO || null,
      });
    }
  }

  // Histórico de Telefones
  if (Array.isArray(raw.HISTORICO_TELEFONE)) {
    for (const h of raw.HISTORICO_TELEFONE) {
      registrarTelefone(h.TELEFONE || h.telefone, {
        tipo: h.TIPO_TELEFONE || "Telefone",
        data: h.DT_INCLUSAO || h.DT_INFORMACAO || null,
        origem: "Histórico Telefônico",
      });
    }
  }

  // Último Telefone
  if (Array.isArray(raw.ULTIMO_TELEFONE)) {
    for (const u of raw.ULTIMO_TELEFONE) {
      registrarTelefone(u.TELEFONE || u.telefone, {
        data: u.DT_TIMESTAMP || null,
        origem: "Último Telefone Cadastrado",
      });
    }
  }

  // TELEFONES genéricos (suporta maiúsculas, minúsculas e aninhamento sob dados)
  const rawTels = [
    ...(Array.isArray(raw.TELEFONES) ? raw.TELEFONES : []),
    ...(Array.isArray(raw.telefones) ? raw.telefones : []),
    ...(Array.isArray(raw.TELEFONE) ? raw.TELEFONE : []),
    ...(Array.isArray(raw.telefone) ? raw.telefone : []),
    ...(Array.isArray(d.TELEFONES) ? d.TELEFONES : []),
    ...(Array.isArray(d.telefones) ? d.telefones : []),
    ...(Array.isArray(d.TELEFONE) ? d.TELEFONE : []),
    ...(Array.isArray(d.telefone) ? d.telefone : []),
  ];

  for (const t of rawTels) {
    if (!t) continue;
    const num = typeof t === "string" ? t : (t.TELEFONE || t.telefone || t.numero || t.numeroLimpo);
    const op = typeof t === "object" ? (t.OPERADORA || t.operadora) : null;
    const tip = typeof t === "object" ? (t.TIPO || t.tipo) : null;
    const wpp = typeof t === "object" ? (t.WHATSAPP !== undefined ? t.WHATSAPP : (t.whatsapp !== undefined ? t.whatsapp : true)) : true;
    const dt = typeof t === "object" ? (t.DT_TIMESTAMP || t.data) : null;
    registrarTelefone(num, { operadora: op, tipo: tip, whatsApp: wpp, data: dt });
  }

  const telefonesNormalizados = Array.from(telsMap.values());
  const telefonesPorOperadora = {
    VIVO: telefonesNormalizados.filter((t) => t.operadora?.toUpperCase() === "VIVO"),
    CLARO: telefonesNormalizados.filter((t) => t.operadora?.toUpperCase() === "CLARO"),
    TIM: telefonesNormalizados.filter((t) => t.operadora?.toUpperCase() === "TIM"),
    OI: telefonesNormalizados.filter((t) => t.operadora?.toUpperCase() === "OI"),
    OUTROS: telefonesNormalizados.filter(
      (t) => !["VIVO", "CLARO", "TIM", "OI"].includes(t.operadora?.toUpperCase())
    ),
  };

  // 2. E-mails
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

  // 3. Veículos vinculados (HISTORICO_VEICULOS, ULTIMO_VEICULOS, VEICULOS)
  const rawVeiculos = [
    ...(Array.isArray(raw.HISTORICO_VEICULOS) ? raw.HISTORICO_VEICULOS : []),
    ...(Array.isArray(raw.historicoVeiculos) ? raw.historicoVeiculos : []),
    ...(Array.isArray(raw.ULTIMO_VEICULOS) ? raw.ULTIMO_VEICULOS : []),
    ...(Array.isArray(raw.ultimoVeiculos) ? raw.ultimoVeiculos : []),
    ...(Array.isArray(raw.VEICULOS) ? raw.VEICULOS : []),
    ...(Array.isArray(raw.veiculos) ? raw.veiculos : []),
    ...(Array.isArray(d.HISTORICO_VEICULOS) ? d.HISTORICO_VEICULOS : []),
    ...(Array.isArray(d.historicoVeiculos) ? d.historicoVeiculos : []),
    ...(Array.isArray(d.VEICULOS) ? d.VEICULOS : []),
    ...(Array.isArray(d.veiculos) ? d.veiculos : []),
  ];

  const veiculosMap = new Map();
  for (const v of rawVeiculos) {
    const rawPlaca = String(v.PLACA || v.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const rawChassi = String(v.CHASSI || v.chassi || "").toUpperCase();
    const rawRenavam = String(v.RENAVAM || v.renavam || "").trim();
    if (!rawPlaca && !rawChassi && !rawRenavam) continue;

    const key = rawPlaca || rawChassi || rawRenavam;
    if (!veiculosMap.has(key)) {
      const marcaModelo = String(v.MARCA || v.marca || v.MODELO || v.modelo || "Veículo Registrado").trim();
      const placaFmt = rawPlaca.length === 7 ? `${rawPlaca.slice(0, 3)}-${rawPlaca.slice(3)}` : rawPlaca;

      veiculosMap.set(key, {
        placa: rawPlaca,
        placaFormatada: placaFmt,
        plate: rawPlaca,
        marca: marcaModelo,
        modelo: marcaModelo,
        model: marcaModelo,
        marcaModelo: marcaModelo,
        chassi: rawChassi || "NÃO INFORMADO",
        renavam: rawRenavam || "NÃO INFORMADO",
        motor: String(v.MOTOR || v.motor || "").trim() || "N/I",
        ano: v.ANO || v.ano || v.ANO_MODELO || v.anoModelo || null,
        cor: v.COR || v.cor || null,
        situacao: (v.SITUACAO || v.situacao || "CIRCULAR").toUpperCase(),
      });
    }
  }
  const veiculosNormalizados = Array.from(veiculosMap.values());

  // 4. Histórico Vacinal COVID-19 & Locais de Vacinação (SUS)
  const rawCovid = [
    ...(Array.isArray(raw.COVID) ? raw.COVID : []),
    ...(Array.isArray(raw.covid) ? raw.covid : []),
    ...(Array.isArray(raw.VACINAS) ? raw.VACINAS : []),
    ...(Array.isArray(raw.vacinas) ? raw.vacinas : []),
    ...(Array.isArray(d.COVID) ? d.COVID : []),
    ...(Array.isArray(d.covid) ? d.covid : []),
    ...(Array.isArray(d.VACINAS) ? d.VACINAS : []),
    ...(Array.isArray(d.vacinas) ? d.vacinas : []),
  ];

  const vacinasCovid = rawCovid.map((v) => {
    const estabelecimento = String(
      v.NOME_DO_ESTABELECIMENTO || v.ESTABELECIMENTO || v.estabelecimento || "Posto de Saúde Municipal"
    ).trim();
    const municipio = String(v.MUNICIPIO || v.municipio || "").trim();
    const uf = String(v.UF || v.uf || "").trim().toUpperCase();
    const bairro = String(v.BAIRRO || v.bairro || "").trim();

    const localCompleto = [
      estabelecimento,
      bairro ? `Bairro ${bairro}` : null,
      municipio && uf ? `${municipio}/${uf}` : (municipio || uf || null),
    ]
      .filter(Boolean)
      .join(" - ");

    return {
      dose: v.DESCRICAO_DA_VACINA || v.DOSE || v.dose || "Dose Registrada",
      vacina: v.NOME_DA_VACINA || v.VACINA || v.vacina || "COVID-19",
      dataAplicacao: v.DATA_DE_APLICACAO || v.DATA_APLICACAO || v.data_aplicacao || "Data não informada",
      lote: v.LOTE_DA_VACINA || v.LOTE || v.lote || "N/I",
      local: estabelecimento,
      estabelecimento,
      localCompleto,
      municipio,
      uf,
      bairro,
      aplicador: v.APLICADOR_DE_VACINA || v.APLICADOR || v.aplicador || null,
      grupoAtendimento: v.GRUPO_DE_ATENDIMENTO || v.GRUPO || v.grupo || null,
      status: v.STATUS || v.status || "Finalizado",
      cns: v.CNS || v.cns || null,
    };
  });

  // 5. Dados Bancários
  const rawBancos = Array.isArray(raw.DADOS_BANCARIOS) ? raw.DADOS_BANCARIOS : [];
  const dadosBancarios = rawBancos.map((b) => ({
    banco: String(b.INSTITUICAO || b.BANCO || b.banco || "Instituição Financeira").trim(),
    agencia: b.AGENCIA || b.agencia || "Não informada",
    numero: b.NUMERO || b.numero || null,
  }));

  // 6. RAIS & Vínculos Empregatícios
  const rawRais = Array.isArray(raw.RAIS) ? raw.RAIS : [];
  const vinculosRais = rawRais.map((r) => ({
    cnpj: formatCnpj(r.CNPJ || r.cnpj),
    razaoSocial: String(r.RAZAO_SOCIAL || r.razao_social || "EMPRESA").toUpperCase().trim(),
    situacao: r.SITUACAO || r.situacao || "ENTREGUE",
    dataAdmissao: r.DATA_ADMISSAO || null,
    dataDesligamento: r.DATA_DESLIGAMENTO || null,
    faixaRenda: r.FAIXA_RENDA || null,
  }));

  // 7. Benefícios INSS
  const rawInss = Array.isArray(raw.INSS) ? raw.INSS : [];
  const beneficiosInss = rawInss.map((i) => ({
    nb: i.NB || i.nb || "N/I",
    especie: i.ESPECIE || i.especie || "Benefício",
    entidade: i.ENTIDADE || i.entidade || "SIAPE/INSS",
    valor: i.VALOR && i.VALOR !== "N" ? i.VALOR : null,
  }));

  // 8. PIS & NIS
  const pisItem = Array.isArray(raw.PIS) && raw.PIS[0] ? raw.PIS[0] : (raw.PIS || {});
  const pisNumero = pisItem?.PIS || d.PIS || d.NIS || null;

  // 9. Poder Aquisitivo e Renda
  const poderAquisitivoBloco = Array.isArray(raw.PODER_AQUISITIVO)
    ? raw.PODER_AQUISITIVO[0]
    : (raw.PODER_AQUISITIVO || {});
  const rendaPoderAquisitivo = poderAquisitivoBloco?.RENDA_PODER_AQUISITIVO || d.RENDA || null;
  const nivelPoderAquisitivo = poderAquisitivoBloco?.PODER_AQUISITIVO || null;

  // 10. Senhas Vazadas vinculadas ao CPF
  const rawSenhas = Array.isArray(raw.SENHA_CPF) ? raw.SENHA_CPF : [];
  const senhasVazadas = rawSenhas.map((s) => ({
    cpf: formatCpf(s.CPF || rawCpf),
    senha: s.SENHA || s.senha,
    fonte: "Vazamento Público de Credenciais",
    titulo: "Senha Comprometida",
    data: s.DT_INCLUSAO || null,
  }));

  // 10.5 CNH (Carteira Nacional de Habilitação)
  const rawCnh = Array.isArray(raw.CNH) ? raw.CNH : raw.CNH ? [raw.CNH] : [];
  const cnhPrincipal = rawCnh[0] || {};
  const cnhNumero = cnhPrincipal.NUMERO_CNH || cnhPrincipal.numero || d.CNH || d.cnh || null;
  const cnhUf = cnhPrincipal.SIGLA_UF || cnhPrincipal.uf || null;
  const cnhPrimeira = cnhPrincipal.DT_PRIMEIRA_CNH || cnhPrincipal.data_primeira_habilitacao || null;
  const cnhUltima = cnhPrincipal.DT_ULTIMA_ATUALIZACAO || null;
  const cnhObj = cnhNumero
    ? {
        numero: cnhNumero,
        num_cnh: cnhNumero,
        numero_registro: cnhNumero,
        uf: cnhUf,
        primeira_habilitacao: cnhPrimeira,
        data_primeira_habilitacao: cnhPrimeira,
        ultima_atualizacao: cnhUltima,
      }
    : (d.CNH || d.cnh ? { num_cnh: d.CNH || d.cnh } : null);

  // 11. Score e dados socioeconômicos (CSB8 / CSBA)
  const scoreBloco = Array.isArray(raw.SCORE) ? raw.SCORE[0] : (raw.SCORE || {});
  const csb8Val = scoreBloco?.CSB8 || null;
  const csbaVal = scoreBloco?.CSBA || null;
  const scoreValor = csb8Val || csbaVal || scoreBloco?.SCORE || d.SCORE || null;
  const scoreFaixa = scoreBloco?.CSB8_FAIXA || scoreBloco?.CSBA_FAIXA || d.FAIXA_RENDA_ID || null;

  // 12. Endereços
  const rawEnds = [
    ...(Array.isArray(raw.ENDERECOS) ? raw.ENDERECOS : []),
    ...(Array.isArray(raw.enderecos) ? raw.enderecos : []),
    ...(Array.isArray(raw.ENDERECO) ? raw.ENDERECO : []),
    ...(Array.isArray(raw.endereco) ? raw.endereco : []),
    ...(Array.isArray(d.ENDERECOS) ? d.ENDERECOS : []),
    ...(Array.isArray(d.enderecos) ? d.enderecos : []),
    ...(Array.isArray(d.ENDERECO) ? d.ENDERECO : []),
    ...(Array.isArray(d.endereco) ? d.endereco : []),
    ...(raw.ENDERECO && typeof raw.ENDERECO === "object" && !Array.isArray(raw.ENDERECO) ? [raw.ENDERECO] : []),
    ...(raw.endereco && typeof raw.endereco === "object" && !Array.isArray(raw.endereco) ? [raw.endereco] : []),
    ...(d.ENDERECO && typeof d.ENDERECO === "object" && !Array.isArray(d.ENDERECO) ? [d.ENDERECO] : []),
    ...(d.endereco && typeof d.endereco === "object" && !Array.isArray(d.endereco) ? [d.endereco] : []),
  ];

  const enderecosNormalizados = normalizarListaEnderecos(rawEnds);

  // 13. Parentes
  const rawParentes = [
    ...(Array.isArray(raw.PARENTES) ? raw.PARENTES : []),
    ...(Array.isArray(raw.parentes) ? raw.parentes : []),
    ...(Array.isArray(d.PARENTES) ? d.PARENTES : []),
    ...(Array.isArray(d.parentes) ? d.parentes : []),
  ];

  const parentesNormalizados = rawParentes.map((p) => ({
    nome: (p.NOME || p.NOME_VINCULO || p.nome || "").toUpperCase(),
    vinculo: (p.VINCULO || p.vinculo || "PARENTESCO").toUpperCase(),
    cpf: formatCpf(p.CPF || p.CPF_VINCULO || p.cpf),
    cpf_raw: String(p.CPF || p.CPF_VINCULO || p.cpf || "").replace(/\D/g, ""),
  }));

  // 14. CNS (Cartão Nacional de Saúde)
  const rawCns = Array.isArray(raw.CNS) ? raw.CNS : raw.CNS ? [raw.CNS] : [];
  const cnsNormalizado = rawCns.map((c) => ({
    numero: c.CNS_NUMERO || c.NUMERO_CNS || c.CNS || c.cns,
    tipo: c.TIPO_DE_CARTAO === "D" ? "DEFINITIVO" : c.TIPO_DE_CARTAO === "P" ? "PROVISÓRIO" : (c.TIPO || c.tipo || "DEFINITIVO"),
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
    cnh: cnhObj,
    cnhNumero: cnhNumero || d.CNH || d.cnh || null,
    cnhUf,
    cnhPrimeiraHabilitacao: cnhPrimeira,
    cnhDetalhes: rawCnh,
    cbo: d.CBO || d.cbo || null,
    profissao: d.CBO || d.profissao || "Não informada",
    nacionalidade: d.NACIONALID || d.nacionalidade || "BRASILEIRA",
    situacaoCadastral: situacaoReceita,
    pis: pisNumero,
    telefones: telefonesNormalizados,
    phones: telefonesNormalizados,
    telefonesPorOperadora,
    enderecos: enderecosNormalizados,
    endereco: enderecosNormalizados[0] || null,
    parentes: parentesNormalizados,
    cns: cnsNormalizado,
    emails: emailsNormalizados,
    veiculos: veiculosNormalizados,
    vehicles: {
      list: veiculosNormalizados,
      total: veiculosNormalizados.length,
    },
    vacinas_covid: vacinasCovid,
    covid: vacinasCovid,
    dadosBancarios,
    vinculosEmpregaticios: vinculosRais,
    rais: vinculosRais,
    beneficiosInss,
    rendaPoderAquisitivo,
    nivelPoderAquisitivo,
    rendaPresumida: rendaPoderAquisitivo ? formatCurrency(rendaPoderAquisitivo) : (d.RENDA ? formatCurrency(d.RENDA) : null),
    vazamentos: senhasVazadas,
    senhasVazadas,
    score: (scoreValor !== null && scoreValor !== undefined)
      ? {
          valor: scoreValor,
          value: scoreValor,
          score: scoreValor,
          csb8: csb8Val,
          csba: csbaVal,
          faixa: scoreFaixa,
          csb8_faixa: scoreBloco?.CSB8_FAIXA,
          csba_faixa: scoreBloco?.CSBA_FAIXA,
          csb8_range: scoreBloco?.CSB8_FAIXA,
          csba_range: scoreBloco?.CSBA_FAIXA,
        }
      : null,
    totalTelefones: telefonesNormalizados.length,
    totalEnderecos: enderecosNormalizados.length,
    totalParentes: parentesNormalizados.length,
    totalEmails: emailsNormalizados.length,
    totalVeiculos: veiculosNormalizados.length,
    totalVacinas: vacinasCovid.length,
    totalBancos: dadosBancarios.length,
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
  const combustivel = v.COMBUSTIVEL || v.combustivel || "ALCOOL/GASOLINA";
  const potencia = v.POTENCIA || v.potencia || null;
  const cilindradas = v.CILINDRADAS || v.cilindradas || null;
  const numeroMotor = v.MOTOR || v.numeromotor || v.motor || null;
  const situacao = (v.SITUACAO_DO_VEICULO || v.situacao || "CIRCULAR").toUpperCase();
  const cidade = v.CIDADE || v.municipio_nome || "N/I";
  const uf = (v.UF_PLACA || v.municipio_uf || "").toUpperCase();

  // Proprietário
  let propNome = v.PROPRIETARIO_NOME || v.proprietario_nome || null;
  let propDoc = v.PROPRIETARIO_DOC || v.proprietario_documento || null;
  let propMae = null;
  let propNasc = null;
  let propCbo = null;
  let propRenda = null;
  let propTitulo = null;
  let propSexo = null;

  if (Array.isArray(raw.PROPRIETARIO_DADOS) && raw.PROPRIETARIO_DADOS[0]) {
    const pd = raw.PROPRIETARIO_DADOS[0];
    propNome = propNome || pd.NOME;
    propDoc = propDoc || pd.CPF || pd.cpf;
    propMae = pd.NOME_MAE || pd.nomeMae;
    propNasc = pd.NASC || pd.nascimento;
    propCbo = pd.CBO || pd.cbo;
    propRenda = pd.RENDA || pd.renda;
    propTitulo = pd.TITULO_ELEITOR || pd.tituloEleitor;
    propSexo = pd.SEXO || pd.sexo;
  }

  const telefonesProp = (raw.PROPRIETARIO_TELEFONE || []).map((t) => ({
    numero: formatPhone(t.TELEFONE || t.telefone),
    data: t.DT_TIMESTAMP || null,
  }));

  const enderecosProp = normalizarListaEnderecos(raw.PROPRIETARIO_ENDERECO || []);

  const cnhProp = Array.isArray(raw.PROPRIETARIO_CNH) && raw.PROPRIETARIO_CNH[0]
    ? {
        numero: raw.PROPRIETARIO_CNH[0].NUMERO_CNH || raw.PROPRIETARIO_CNH[0].numero,
        uf: raw.PROPRIETARIO_CNH[0].SIGLA_UF || raw.PROPRIETARIO_CNH[0].uf,
        primeiraHabilitacao: raw.PROPRIETARIO_CNH[0].DT_PRIMEIRA_CNH || raw.PROPRIETARIO_CNH[0].primeiraHabilitacao,
        ultimaAtualizacao: raw.PROPRIETARIO_CNH[0].DT_ULTIMA_ATUALIZACAO || null,
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
    potencia,
    cilindradas,
    situacao,
    numeroMotor,
    motor: numeroMotor,
    engine: numeroMotor,
    cidade,
    uf,
    municipio: cidade && uf ? `${cidade}/${uf}` : cidade,
    proprietario: {
      nome: propNome ? String(propNome).toUpperCase() : null,
      name: propNome ? String(propNome).toUpperCase() : null,
      documento: propDoc ? (propDoc.length > 11 ? formatCnpj(propDoc) : formatCpf(propDoc)) : null,
      cpf: propDoc ? (propDoc.length > 11 ? formatCnpj(propDoc) : formatCpf(propDoc)) : null,
      mae: propMae,
      nomeMae: propMae,
      nascimento: propNasc,
      birth_date: propNasc,
      sexo: propSexo,
      cbo: propCbo,
      renda: propRenda,
      tituloEleitor: propTitulo,
      cnh: cnhProp,
      telefones: telefonesProp,
      phones: telefonesProp,
      enderecos: enderecosProp,
      addresses: enderecosProp,
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
