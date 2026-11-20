import { rimuApi, consultarRimuApi } from "./rimuapi.service.js";
import { interpretRimuApi } from "./interpreter/modules/rimuapi/index.js";
import { cacheService } from "../core/cache.service.js";
import { getModuleByIdService } from "../core/modules.service.js";
import { consultarCnpjOficial } from "./cnpj.service.js";
import { consultarEnderecoCep } from "./cep.service.js";

/**
 * ==============================================================================
 * RIMUBUSCA - CENTRALIZADOR DE CONSULTAS CADASTRAIS (CONSULTA.SERVICE.JS)
 * Centralizador de consultas da página principal (/advanced/person).
 * Conecta nativamente à RimuAPI (Sant Buscas Engine) com suporte aos 43 módulos
 * oficiais de inteligência (Pessoa, Contato, Endereço, Veículos, Financeiro,
 * Empresa & Jurídico, Família, Vazados & Segurança, Geradores & Lotes).
 * Suporta cache multi-tier no Supabase (24h a 7 dias) e fallback resiliente.
 * ==============================================================================
 */

export async function puxarDados({
  tipo = "cpf",
  termo = "",
  uf = "",
  param2 = null,
  params = null,
}) {
  const isMock = process.env.MOCK_MODE === "true";
  const cleanTerm = String(termo || "").trim();
  const tipoNormalizado = String(tipo || "cpf").toLowerCase().trim();
  const cacheKeyModulo = `consulta_${tipoNormalizado}`;

  // 0. Interdição / Manutenção: Valida se o módulo está ativo ou interditado pela administração no Supabase
  try {
    const metaModulo = await getModuleByIdService(tipoNormalizado);
    if (metaModulo) {
      if (metaModulo.manutencao) {
        const errManut = new Error(
          `O módulo "${metaModulo.nome}" está temporariamente em manutenção pela administração.`
        );
        errManut.statusCode = 503;
        errManut.manutencao = true;
        throw errManut;
      }
      if (metaModulo.ativo === false) {
        const errInativo = new Error(
          `O módulo "${metaModulo.nome}" foi temporariamente desativado pela administração.`
        );
        errInativo.statusCode = 403;
        errInativo.inativo = true;
        throw errInativo;
      }
    }
  } catch (checkErr) {
    if (checkErr.manutencao || checkErr.inativo) throw checkErr;
    console.warn(`[MODULE STATUS CHECK WARN]: ${checkErr.message}`);
  }

  // 1. Tenta recuperar resultado do Cache Multi-Tier (RAM -> Supabase api_cache)
  try {
    const cached = await cacheService.get(cacheKeyModulo, cleanTerm);
    if (cached && cached.data) {
      console.log(`[RIMUAPI CACHE HIT] Tipo: ${tipoNormalizado} (${cleanTerm}) via ${cached.source}`);
      return {
        tipo: tipoNormalizado,
        termo: cleanTerm,
        fonte: `RimuAPI Intelligence Engine (${cached.source === "memory" ? "Cache Rápido" : "Cache Supabase"})`,
        timestamp: cached.cachedAt || new Date().toISOString(),
        cached: true,
        cacheSource: cached.source,
        remainingCredits: null,
        dados: cached.data,
      };
    }
  } catch (cacheErr) {
    console.warn(`[RIMUAPI CACHE READ ERROR]: ${cacheErr.message}`);
  }

  // 2. Se RimuAPI estiver configurada ou se for consulta com fallback público:
  if (
    !isMock &&
    (rimuApi.isConfigured() ||
      tipoNormalizado === "cnpj" ||
      tipoNormalizado === "cep" ||
      tipoNormalizado === "endereco" ||
      tipoNormalizado === "logradouro")
  ) {
    try {
      console.log(`[RIMUAPI PUXAR DADOS] Consultando tipo: ${tipoNormalizado} | Termo: ${cleanTerm}`);

      let rimuResult = null;

      // Executa a busca através dos módulos da RimuAPI
      if (rimuApi.isConfigured()) {
        switch (tipoNormalizado) {
          case "cpf":
            rimuResult = await rimuApi.cpf(cleanTerm);
            break;

          case "cpf_completo":
          case "cpf_pro":
          case "cpf_dossie":
            rimuResult = await rimuApi.cpfCompleto(cleanTerm);
            break;

          case "nome":
            rimuResult = await rimuApi.nome(cleanTerm);
            break;

          case "nome_similar":
            rimuResult = await rimuApi.nomeSimilar(cleanTerm);
            break;

          case "rg":
            rimuResult = await rimuApi.rg(cleanTerm);
            break;

          case "titulo":
            rimuResult = await rimuApi.titulo(cleanTerm);
            break;

          case "cns":
            rimuResult = await rimuApi.cns(cleanTerm);
            break;

          case "nis":
            rimuResult = await rimuApi.nis(cleanTerm);
            break;

          case "covid":
            rimuResult = await rimuApi.covid(cleanTerm);
            break;

          case "foto":
          case "fotos":
            rimuResult = await rimuApi.fotos(cleanTerm);
            break;

          case "telefone":
          case "celular":
          case "telefone_puxar":
          case "operadora":
            rimuResult = await rimuApi.telefone(cleanTerm);
            break;

          case "email":
          case "email_puxar":
            rimuResult = await rimuApi.email(cleanTerm);
            break;

          case "cep":
          case "endereco":
          case "logradouro":
            try {
              rimuResult = await rimuApi.cep(cleanTerm, param2);
            } catch (cepErr) {
              console.warn(`[RIMUAPI CEP FALLBACK] ${cepErr.message}. Alternando para multi-provider...`);
              rimuResult = await consultarEnderecoCep(cleanTerm, uf);
            }
            break;

          case "cep_avancado":
            rimuResult = await rimuApi.cepAvancado(
              params || { uf: uf || "SP", endereco: cleanTerm }
            );
            break;

          case "placa":
          case "veiculo":
            rimuResult = await rimuApi.placa(cleanTerm);
            break;

          case "placa_ghost":
            rimuResult = await rimuApi.placaGhost(cleanTerm);
            break;

          case "cnh":
            rimuResult = await rimuApi.cnh(cleanTerm);
            break;

          case "chassi":
            rimuResult = await rimuApi.chassi(cleanTerm);
            break;

          case "renavam":
            rimuResult = await rimuApi.renavam(cleanTerm);
            break;

          case "score":
            rimuResult = await rimuApi.score(cleanTerm);
            break;

          case "aposentado":
            rimuResult = await rimuApi.aposentado(cleanTerm);
            break;

          case "pis":
            rimuResult = await rimuApi.pis(cleanTerm);
            break;

          case "cnpj": {
            const cleanCnpj = cleanTerm.replace(/\D/g, "");
            if (cleanCnpj.length === 14) {
              try {
                rimuResult = await rimuApi.cnpj(cleanCnpj);
              } catch (cnpjErr) {
                console.warn(`[RIMUAPI CNPJ FALLBACK] ${cnpjErr.message}. Alternando para BrasilAPI...`);
                rimuResult = await consultarCnpjOficial(cleanCnpj);
              }
            } else {
              throw new Error("Informe um CNPJ válido com 14 dígitos.");
            }
            break;
          }

          case "cnpj2":
            rimuResult = await rimuApi.cnpj2(cleanTerm);
            break;

          case "razao_social":
            rimuResult = await rimuApi.razaoSocial(cleanTerm);
            break;

          case "socios":
            rimuResult = await rimuApi.socios(cleanTerm);
            break;

          case "socios2":
            rimuResult = await rimuApi.socios2(cleanTerm);
            break;

          case "funcionarios":
            rimuResult = await rimuApi.funcionarios(cleanTerm);
            break;

          case "empregos":
            rimuResult = await rimuApi.empregos(cleanTerm);
            break;

          case "oab":
            rimuResult = await rimuApi.oab(cleanTerm);
            break;

          case "mae":
            rimuResult = await rimuApi.mae(cleanTerm);
            break;

          case "pai":
            rimuResult = await rimuApi.pai(cleanTerm);
            break;

          case "parentes":
          case "vizinhos":
            rimuResult = await rimuApi.parentes(cleanTerm);
            break;

          case "arvore_familiar":
            rimuResult = await rimuApi.arvoreFamiliar(cleanTerm);
            break;

          case "desmascarador": {
            const cpfParcial = String(cleanTerm).replace(/\D/g, "");
            const nomeCompleto = param2 ? String(param2).trim() : "";
            rimuResult = await rimuApi.desmascarador(cpfParcial, nomeCompleto);
            break;
          }

          case "cloud_url":
            rimuResult = await rimuApi.cloudUrl(cleanTerm);
            break;

          case "cloud_usuario":
            rimuResult = await rimuApi.cloudUsuario(cleanTerm);
            break;

          case "senha":
            rimuResult = await rimuApi.senha(cleanTerm);
            break;

          case "dump_cpf":
            rimuResult = await rimuApi.dumpCpf(cleanTerm);
            break;

          case "dump_email":
            rimuResult = await rimuApi.dumpEmail(cleanTerm);
            break;

          case "dump_telefone":
            rimuResult = await rimuApi.dumpTelefone(cleanTerm);
            break;

          case "gerador_estado":
            rimuResult = await rimuApi.geradorEstado(cleanTerm);
            break;

          case "gerador_cbo":
            rimuResult = await rimuApi.geradorCbo(cleanTerm);
            break;

          default:
            // Suporte genérico a qualquer um dos 43 módulos da RimuAPI
            rimuResult = await consultarRimuApi({
              tipo: tipoNormalizado,
              chave: cleanTerm,
              param2: param2 || uf,
              params,
            });
            break;
        }
      } else {
        // Contingência para quando a RimuAPI não estiver configurada no .env
        if (tipoNormalizado === "cnpj") {
          const cleanCnpj = cleanTerm.replace(/\D/g, "");
          rimuResult = await consultarCnpjOficial(cleanCnpj);
        } else if (
          tipoNormalizado === "cep" ||
          tipoNormalizado === "endereco" ||
          tipoNormalizado === "logradouro"
        ) {
          rimuResult = await consultarEnderecoCep(cleanTerm, uf);
        } else {
          throw new Error("RimuAPI não configurada. Defina RIMUAPI_KEY no .env.");
        }
      }

      if (rimuResult) {
        const rawPayload = rimuResult.resultado !== undefined ? rimuResult.resultado : rimuResult;
        const payloadData = interpretRimuApi(tipoNormalizado, rawPayload, cleanTerm);

        // Grava no cache persistente com TTL inteligente:
        // 7 dias para documentos cadastrais (cpf, rg, titulo, foto, parentes, cnpj, cep)
        // 24 horas para dados dinâmicos de telecomunicações/localização
        try {
          const isDocEstatico = [
            "cpf",
            "cpf_completo",
            "rg",
            "titulo",
            "foto",
            "fotos",
            "parentes",
            "arvore_familiar",
            "cnpj",
            "cnpj2",
            "cep",
            "endereco",
            "oab",
          ].includes(tipoNormalizado);

          const ttlMs = isDocEstatico ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
          await cacheService.set(cacheKeyModulo, cleanTerm, payloadData, {
            ttlMs,
            metadata: { tipo: tipoNormalizado },
          });
        } catch (cacheSaveErr) {
          console.warn(`[RIMUAPI CACHE SAVE ERROR]: ${cacheSaveErr.message}`);
        }

        const defaultFonte =
          tipoNormalizado === "cnpj" && !rimuApi.isConfigured()
            ? "Receita Federal do Brasil / CNPJ"
            : (tipoNormalizado === "cep" || tipoNormalizado === "endereco") && !rimuApi.isConfigured()
              ? "DNE / Correios / IBGE Oficial"
              : "RimuAPI Intelligence Engine (Live)";

        return {
          tipo: tipoNormalizado,
          termo: cleanTerm,
          fonte: defaultFonte,
          timestamp: new Date().toISOString(),
          remainingCredits: null,
          dados: payloadData,
          raw: rimuResult,
        };
      } else {
        throw new Error("Nenhum dado retornado para a consulta informada.");
      }
    } catch (err) {
      console.warn(`[RIMUAPI ERRO] Falha ao comunicar com a API (${err.message}).`);

      if (
        err.code === "CONSULTA_NOT_FOUND" ||
        err.code === "NOT_FOUND" ||
        err.status === 404 ||
        err.message?.includes("Nenhum dado foi encontrado") ||
        err.message?.includes("Nenhum registro") ||
        err.message?.includes("não localizado")
      ) {
        throw new Error(err.message || "Nenhum registro localizado para o termo pesquisado na base oficial.");
      }

      if (err.status === 401 || err.code === "UNAUTHORIZED") {
        throw new Error("Acesso não autorizado na RimuAPI. Verifique sua chave RIMUAPI_KEY no arquivo .env.");
      }

      if (
        err.status === 504 ||
        err.code === "TIMEOUT" ||
        err.message?.includes("504") ||
        err.message?.includes("Gateway Timeout")
      ) {
        throw new Error("A API externa de consulta demorou para responder (HTTP 504 / Gateway Timeout). Tente novamente em instantes.");
      }

      throw new Error(err.message || "Falha na comunicação com o serviço oficial de consultas.");
    }
  }

  // 3. Simulação Mock: EXCLUSIVAMENTE quando MOCK_MODE for true no .env (testes locais)
  if (isMock) {
    const mockRes = gerarMockPorTipo(tipoNormalizado, cleanTerm);
    if (mockRes && mockRes.dados) {
      mockRes.dados = interpretRimuApi(tipoNormalizado, mockRes.dados, cleanTerm);
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
    case "cpf_completo":
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
    case "nome_similar":
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
    case "placa_ghost":
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
          chassi: "9BWAB41JXEP012345",
          renavam: "00123456789",
          status: "CIRCULAÇÃO LEGAL (Sem Queixa de Furto/Roubo)",
          municipio: "São Paulo / SP",
          proprietario: {
            nome: "CARLOS EDUARDO DA SILVA PEREIRA",
            documento: "123.456.789-00",
          },
        },
      };

    case "cnpj":
    case "razao_social":
      return {
        tipo: "cnpj",
        termo,
        fonte: "Receita Federal do Brasil / Mock",
        timestamp: baseTimestamp,
        dados: {
          cnpj: termo,
          razaoSocial: "EMPRESA MODELO TECNOLOGIA LTDA",
          nomeFantasia: "MODELO TECH",
          situacaoCadastral: "ATIVA",
          capitalSocial: "R$ 150.000,00",
          cnaePrincipal: "62.01-5-01 - Desenvolvimento de programas de computador sob encomenda",
          endereco: {
            logradouro: "Avenida Brigadeiro Faria Lima",
            numero: "3477",
            bairro: "Itaim Bibi",
            cidade: "São Paulo",
            uf: "SP",
            cep: "04538-133",
          },
          socios: [
            {
              nome: "CARLOS EDUARDO DA SILVA PEREIRA",
              qualificacao: "49 - Sócio-Administrador",
            },
          ],
        },
      };

    default:
      return {
        tipo,
        termo,
        fonte: "RimuAPI Mock Intelligence",
        timestamp: baseTimestamp,
        dados: {
          termo,
          status: "SIMULADO",
          descricao: `Mock de resposta de teste para o módulo '${tipo}'.`,
        },
      };
  }
}

export default puxarDados;
