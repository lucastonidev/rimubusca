import { hexysApi } from "./hexys.service.js";
import { interpretHexys } from "./interpreter/index.js";
import { cacheService } from "../core/cache.service.js";
import { consultarCnpjOficial, normalizarBrasilApiCnpj } from "./cnpj.service.js";

/**
 * ==============================================================================
 * RIMUBUSCA - CENTRALIZADOR DE CONSULTAS CADASTRAIS (CONSULTA.SERVICE.JS)
 * Centralizador de consultas da página principal (/advanced/person).
 * Conecta nativamente à Hexys API (CPF, Telefone, Nome, CEP, Operadora,
 * Foto, Placa, E-mail, Vizinhos e Título de Eleitor).
 * Suporta cache multi-tier no Supabase (24h a 7 dias) e fallback resiliente.
 * ==============================================================================
 */

export async function puxarDados({ tipo = "cpf", termo = "", uf = "" }) {
  const isMock = process.env.MOCK_MODE === "true";
  const cleanTerm = String(termo || "").trim();
  const tipoNormalizado = String(tipo || "cpf").toLowerCase().trim();
  const cacheKeyModulo = `consulta_${tipoNormalizado}`;

  // 1. Tenta recuperar resultado do Cache Multi-Tier (RAM -> Supabase api_cache)
  try {
    const cached = await cacheService.get(cacheKeyModulo, cleanTerm);
    if (cached && cached.data) {
      console.log(`[HEXYS CACHE HIT] Tipo: ${tipoNormalizado} (${cleanTerm}) via ${cached.source}`);
      return {
        tipo: tipoNormalizado,
        termo: cleanTerm,
        fonte: `Hexys Dev Intelligence (${cached.source === "memory" ? "Cache Rápido" : "Cache Supabase"})`,
        timestamp: cached.cachedAt || new Date().toISOString(),
        cached: true,
        cacheSource: cached.source,
        remainingCredits: null,
        dados: cached.data,
      };
    }
  } catch (cacheErr) {
    console.warn(`[HEXYS CACHE READ ERROR]: ${cacheErr.message}`);
  }

  // 2. Se API Hexys estiver configurada ou se for consulta CNPJ (fonte pública resiliente):
  if (!isMock && (hexysApi.isConfigured() || tipoNormalizado === "cnpj")) {
    try {
      console.log(`[HEXYS PUXAR DADOS] Consultando tipo: ${tipoNormalizado} | Termo: ${cleanTerm}`);

      let hexysResult = null;

      switch (tipoNormalizado) {
        case "cpf":
          hexysResult = await hexysApi.cpf(cleanTerm);
          break;

        case "telefone":
        case "celular":
        case "telefone_puxar":
          hexysResult = await hexysApi.telefone(cleanTerm);
          break;

        case "operadora":
          hexysResult = await hexysApi.operadora(cleanTerm);
          break;

        case "nome":
          hexysResult = await hexysApi.nome(cleanTerm, uf);
          break;

        case "cep":
          hexysResult = await hexysApi.cep(cleanTerm);
          break;

        case "foto":
          hexysResult = await hexysApi.foto(cleanTerm);
          break;

        case "placa":
        case "veiculo":
          hexysResult = await hexysApi.placa(cleanTerm);
          break;

        case "email":
        case "email_puxar":
          hexysResult = await hexysApi.email(cleanTerm);
          break;

        case "vizinhos":
          hexysResult = await hexysApi.vizinhos(cleanTerm);
          break;

        case "titulo":
          hexysResult = await hexysApi.titulo(cleanTerm);
          break;

        case "cnpj": {
          const cleanCnpj = cleanTerm.replace(/\D/g, "");
          if (cleanCnpj.length === 14) {
            hexysResult = await consultarCnpjOficial(cleanCnpj);
          } else {
            throw new Error("Informe um CNPJ válido com 14 dígitos.");
          }
          break;
        }

        default:
          throw new Error(`Módulo de consulta '${tipoNormalizado}' não suportado ou temporariamente indisponível.`);
      }

      if (hexysResult) {
        const rawPayload = hexysResult.resultado !== undefined ? hexysResult.resultado : hexysResult;
        const payloadData = interpretHexys(tipoNormalizado, rawPayload);

        // Grava no cache persistente do Supabase com TTL inteligente:
        // 7 dias para documentos cadastrais (cpf, rg, titulo, foto, parentes, cnpj)
        // 24 horas para dados de telecomunicações/localização (telefone, operadora, cep, email)
        try {
          const isDocEstatico = ["cpf", "rg", "titulo", "foto", "parentes", "cnpj"].includes(tipoNormalizado);
          const ttlMs = isDocEstatico ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
          await cacheService.set(cacheKeyModulo, cleanTerm, payloadData, { ttlMs, metadata: { tipo: tipoNormalizado } });
        } catch (cacheSaveErr) {
          console.warn(`[HEXYS CACHE SAVE ERROR]: ${cacheSaveErr.message}`);
        }

        return {
          tipo: tipoNormalizado,
          termo: cleanTerm,
          fonte: tipoNormalizado === "cnpj" ? "Receita Federal do Brasil / CNPJ" : "Hexys Dev Intelligence (Live)",
          timestamp: new Date().toISOString(),
          remainingCredits: hexysResult.remainingCredits ?? null,
          dados: payloadData,
          raw: hexysResult,
        };
      } else {
        throw new Error("Nenhum dado retornado para a consulta informada.");
      }
    } catch (err) {
      console.warn(`[HEXYS ERRO] Falha ao comunicar com a API (${err.message}).`);
      // Se for erro de NOT_FOUND retornado pela base
      if (
        err.code === "CONSULTA_NOT_FOUND" ||
        err.status === 404 ||
        err.message?.includes("Nenhum dado foi encontrado") ||
        err.message?.includes("Nenhum registro") ||
        err.message?.includes("não localizado")
      ) {
        throw new Error(err.message || "Nenhum registro localizado para o termo pesquisado na base oficial.");
      }

      if (err.status === 504 || err.message?.includes("504") || err.message?.includes("Gateway Timeout")) {
        throw new Error("A API externa de consulta demorou para responder (HTTP 504 / Gateway Timeout). Tente novamente em instantes.");
      }

      throw new Error(err.message || "Falha na comunicação com o serviço oficial de consultas.");
    }
  }

  // 3. Simulação Mock: EXCLUSIVAMENTE quando MOCK_MODE for true no .env (testes locais)
  if (isMock) {
    const mockRes = gerarMockPorTipo(tipoNormalizado, cleanTerm);
    if (mockRes && mockRes.dados) {
      mockRes.dados = interpretHexys(tipoNormalizado, mockRes.dados);
      mockRes.isMock = true;
      mockRes.fonte = "Simulação Mock (MOCK_MODE=true)";
    }
    return mockRes;
  }

  throw new Error("Serviço de consulta não configurado ou credenciais de API ausentes.");
}

function gerarMockPorTipo(tipo, termo) {
  const baseTimestamp = new Date().toISOString();

  switch (tipo.toLowerCase()) {
    case "cpf":
      return {
        tipo: "cpf",
        termo,
        fonte: "Simulação Cadastral / Adapter Mock",
        timestamp: baseTimestamp,
        dados: {
          cpf: termo,
          nome: "CARLOS EDUARDO DA SILVA PEREIRA",
          situacaoCadastral: "REGULAR",
          dataNascimento: "14/08/1986",
          idade: 39,
          sexo: "MASCULINO",
          nomeMae: "MARIA APARECIDA DA SILVA PEREIRA",
          nomePai: "JOSE CARLOS PEREIRA",
          cns: "789123456789012",
          rendaPresumida: "R$ 6.850,00",
          classeSocial: "B2",
          rg: "38.452.190-X SSP/SP",
          tituloEleitor: "312456780141",
          pisPasep: "123.45678.90-1",
          telefones: [
            { numero: "(11) 98765-4321", tipo: "Móvel", operadora: "Vivo", whatsApp: true },
            { numero: "(11) 3214-5678", tipo: "Fixo", operadora: "Claro" },
          ],
          enderecos: [
            {
              logradouro: "Avenida Paulista",
              numero: "1578",
              complemento: "Apto 102",
              bairro: "Bela Vista",
              cidade: "São Paulo",
              uf: "SP",
              cep: "01310-200",
              tipo: "Residencial Atual",
            },
          ],
          emails: ["carlos.silva.pereira@gmail.com", "carlos.eduardo@empresa.com.br"],
        },
      };

    case "nome":
      return {
        tipo: "nome",
        termo,
        fonte: "Simulação Cadastral Nominal / Adapter Mock",
        timestamp: baseTimestamp,
        dados: [
          {
            nome: termo.toUpperCase(),
            cpf: "***.452.190-**",
            nascimento: "14/08/1986",
            nomeMae: "MARIA APARECIDA DA SILVA PEREIRA",
            cidade: "São Paulo - SP",
          },
          {
            nome: termo.toUpperCase(),
            cpf: "***.891.234-**",
            nascimento: "22/03/1992",
            nomeMae: "LUCIA HELENA SANTOS",
            cidade: "Campinas - SP",
          },
        ],
      };

    case "rg":
      return {
        tipo: "rg",
        termo,
        fonte: "Consulta RG / Registro Geral",
        timestamp: baseTimestamp,
        dados: {
          rg: termo,
          nome: "CARLOS EDUARDO DA SILVA PEREIRA",
          orgaoEmissor: "SSP",
          ufExpedicao: "SP",
          cpfVinculado: "123.456.789-00",
          dataNascimento: "14/08/1986",
          naturalidade: "São Paulo - SP",
          filiacao: "JOSE CARLOS PEREIRA e MARIA APARECIDA DA SILVA PEREIRA",
        },
      };

    case "telefone":
      return {
        tipo: "telefone",
        termo,
        fonte: "Base Cadastral de Telecom / API de Titularidade",
        timestamp: baseTimestamp,
        dados: {
          numeroConsultado: termo,
          statusLinha: "ATIVA (Pós-Pago / Linha Pessoal)",
          titularNome: "CARLOS EDUARDO DA SILVA PEREIRA",
          titularCpf: "123.456.789-00",
          dataNascimento: "14/08/1986",
          nomeMae: "MARIA APARECIDA DA SILVA PEREIRA",
          operadoraAtual: "Telefônica Brasil (Vivo)",
          planoContratado: "Móvel Pós-Pago 5G",
          dataAtivacao: "18/02/2019",
          enderecoFatura: "Avenida Paulista, 1578, Apto 102 - Bela Vista, São Paulo - SP, CEP 01310-200",
          outrosTelefonesVinculados: ["(11) 99123-4567", "(11) 3214-5678"],
        },
      };

    case "placa":
      return {
        tipo: "placa",
        termo,
        fonte: "Base Veicular Nacional",
        timestamp: baseTimestamp,
        dados: {
          plate: termo.toUpperCase(),
          brand: "HONDA CIVIC EXL",
          model: "CIVIC EXL 2.0",
          color: "PRETO",
          year_fab: "2021",
          year_model: "2022",
          chassis: "9BWZZZ377VT004251",
          renavam: "01238914029",
          fuel: "FLEX",
          situacao_veiculo: "EM CIRCULACAO",
        },
      };

    case "titulo":
      return {
        tipo: "titulo",
        termo,
        fonte: "Justiça Eleitoral / TSE Footprint",
        timestamp: baseTimestamp,
        dados: {
          tituloEleitor: termo,
          nomeEleitor: "CARLOS EDUARDO DA SILVA PEREIRA",
          situacaoInscricao: "REGULAR",
          zonaEleitoral: "001",
          secaoEleitoral: "0254",
          municipioVotacao: "SÃO PAULO",
          uf: "SP",
          biometriaCadastrada: true,
          dataEmissao: "12/05/2004",
        },
      };

    case "nis":
    case "pis":
      return {
        tipo,
        termo,
        fonte: "Bases Sociais e Trabalhistas (NIS / PIS)",
        timestamp: baseTimestamp,
        dados: {
          numeroInscricao: termo,
          nome: "CARLOS EDUARDO DA SILVA PEREIRA",
          cpf: "123.456.789-00",
          dataNascimento: "14/08/1986",
          situacaoPis: "ATIVO",
          orgaoPagador: "Caixa Econômica Federal",
          ultimoEmpregador: "TECNOLOGIA E SISTEMAS S.A. (CNPJ: 12.345.678/0001-90)",
        },
      };

    case "parentes":
      return {
        tipo: "parentes",
        termo,
        fonte: "Árvore de Vínculos Familiares",
        timestamp: baseTimestamp,
        dados: {
          titular: termo,
          parentescos: [
            { vinculo: "MÃE", nome: "MARIA APARECIDA DA SILVA PEREIRA", cpf: "***.234.567-**", idade: 64 },
            { vinculo: "PAI", nome: "JOSE CARLOS PEREIRA", cpf: "***.890.123-**", idade: 67 },
            { vinculo: "IRMÃ(O)", nome: "JULIANA DA SILVA PEREIRA", cpf: "***.345.678-**", idade: 35 },
            { vinculo: "CÔNJUGE", nome: "FERNANDA LIMA PEREIRA", cpf: "***.901.234-**", idade: 38 },
          ],
        },
      };

    case "vizinhos":
      return {
        tipo: "vizinhos",
        termo,
        fonte: "Geolocalização de Vizinhança & Logradouro",
        timestamp: baseTimestamp,
        dados: [
          { numero: "1578 Apto 101", morador: "MARCOS AURELIO DE SOUZA", cpf: "***.789.012-**" },
          { numero: "1578 Apto 103", morador: "BEATRIZ GONCALVES LIMA", cpf: "***.456.789-**" },
          { numero: "1578 Apto 201", morador: "RENATO FERREIRA COSTA", cpf: "***.321.654-**" },
        ],
      };

    case "cep":
      return {
        tipo: "cep",
        termo,
        fonte: "Correios & Cadastro Geográfico",
        timestamp: baseTimestamp,
        dados: {
          cep: termo,
          logradouro: "Avenida Paulista",
          bairro: "Bela Vista",
          cidade: "São Paulo",
          uf: "SP",
          ddd: "11",
          codigoIbge: "3550308",
          totalResidentesEstimados: 4200,
        },
      };

    case "email":
      return {
        tipo: "email",
        termo,
        fonte: "Cruzamento de E-mails e Identidades",
        timestamp: baseTimestamp,
        dados: {
          email: termo,
          titularProvavel: "CARLOS EDUARDO DA SILVA PEREIRA",
          cpfVinculado: "***.452.190-**",
          contasAssociadas: ["LinkedIn", "Facebook", "Spotify", "MercadoLivre", "Gov.br"],
          vazamentoHistoricoDetectado: true,
        },
      };

    case "foto":
      return {
        tipo: "foto",
        termo,
        fonte: "Biometria e Registros de Documentos",
        timestamp: baseTimestamp,
        dados: {
          alvo: termo,
          registroBiometricoDisponivel: true,
          orgaoOrigem: "Detran / CNH Digital",
          ultimaAtualizacaoBiometria: "2023-11-10",
          imagemDemonstrativa: "Registro facial digitalizado e autenticado na base oficial.",
        },
      };

    case "cnpj":
      return {
        tipo: "cnpj",
        termo,
        fonte: "Receita Federal do Brasil / CNPJ",
        timestamp: baseTimestamp,
        dados: {
          cnpj: termo,
          razaoSocial: "RIMU TECNOLOGIA E INTELIGENCIA LTDA",
          nomeFantasia: "RIMUBUSCA SECURITY LAB",
          situacaoCadastral: "ATIVA",
          dataAbertura: "15/03/2021",
          naturezaJuridica: "206-2 - Sociedade Empresária Limitada",
          capitalSocial: "R$ 250.000,00",
          cnaePrincipal: "62.01-5-01 - Desenvolvimento de programas de computador sob encomenda",
          sociosQSA: [
            { nome: "CARLOS EDUARDO DA SILVA PEREIRA", qualificacao: "49-Sócio-Administrador" },
            { nome: "LUCAS SILVA", qualificacao: "49-Sócio-Administrador" },
          ],
          endereco: "Avenida Paulista, 1578, Sala 12, Bela Vista, São Paulo - SP, CEP 01310-200",
        },
      };

    default:
      return {
        tipo,
        termo,
        fonte: "Consulta Genérica Cadastral",
        timestamp: baseTimestamp,
        dados: {
          termo,
          status: "Dados consultados com sucesso.",
        },
      };
  }
}


