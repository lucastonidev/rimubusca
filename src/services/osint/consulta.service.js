import { rimuApi, consultarRimuApi, limparTelefoneBr } from "./rimuapi.service.js";
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

function isStaleCachedResult(tipo, data) {
  if (!data || typeof data !== "object") return false;
  if (data.raw !== undefined) return true;
  if (tipo === "cep" || tipo === "cep_avancado" || tipo === "endereco") {
    if (Array.isArray(data.residentes) || data.resultado !== undefined) return true;
    const lista = Array.isArray(data.moradores) ? data.moradores : [];
    if (lista.some((m) => !m || !m.endereco || !m.dados || m.endereco.numero === undefined)) return true;
    const compl = String(data.complemento || "").toUpperCase();
    if (compl.includes("SEM RESULTADO")) return true;
    if (data.uf === "N/" || data.uf === "N/I") return true;
  }
  if (tipo === "oab") {
    if (!Array.isArray(data.advogados) && !data.CNA_ADVOGADOS) return true;
    if (Array.isArray(data.advogados) && data.advogados.length === 0) return true;
    if (data.resultado !== undefined || data.fotoUrl !== undefined) return true;
    if (String(data.nomeSocial || "").toUpperCase().includes("SEM RESULTADO")) return true;
  }
  if (["cloud_url", "cloud_usuario", "dump_cpf", "dump_email", "dump_telefone"].includes(tipo)) {
    if (data.resultado !== undefined) return true;
  }
  if (tipo === "telefone" || tipo === "celular" || tipo === "telefone_puxar" || tipo === "operadora") {
    if (data.notFound || data.isNotFound) return true;
    if (!data.cpf && !data.nome && !data.name && data.operadora === "Telefonia Móvel" && Array.isArray(data.telefones) && data.telefones.length === 0) {
      return true;
    }
  }
  if (tipo === "email" || tipo === "email_puxar") {
    if (
      !data.notFound &&
      !data.isNotFound &&
      (!data.nome || data.nome === "NOME NÃO INFORMADO") &&
      !data.cpf_raw &&
      !data.perfil_google &&
      (!Array.isArray(data.vinculos) || data.vinculos.length === 0)
    ) {
      return true;
    }
  }
  if (tipo === "mae" || tipo === "pai") {
    if (data.resultado !== undefined || !Array.isArray(data.filhos)) return true;
    if (!data.notFound && data.filhos.length === 0) return true;
    if (data.filhos.some((f) => f && f.regiaoFiscal === undefined)) return true;
  }
  if (tipo === "arvore_familiar") {
    if (!data.url && !data.link && !data.notFound) return true;
  }
  if (tipo === "funcionarios" || tipo === "empregos") {
    if (data.notFound || data.isNotFound) return true;
    const list = Array.isArray(data[tipo]) ? data[tipo] : [];
    if (list.length === 0) return true;
    // Reprocessa caches legados que descartavam dados reais (CPF/Razão Social/Situação)
    if (tipo === "empregos" && list.some((item) => item && item.cpf === undefined && item.situacao === undefined)) {
      return true;
    }
    if (tipo === "funcionarios" && (!data.razaoSocial || list.some((item) => item && item.situacao === undefined))) {
      return true;
    }
  }
  if (tipo === "razao_social" || tipo === "socios" || tipo === "socios2" || tipo === "cnpj2") {
    if (data.notFound || data.isNotFound) return true;
  }
  return false;
}

function isNotFoundConsultaError(err) {
  if (!err) return false;
  return (
    err.code === "NOT_FOUND" ||
    err.code === "CONSULTA_NOT_FOUND" ||
    err.status === 404 ||
    /nenhum|n[aã]o\s+encontrad|n[aã]o\s+localizad|not\s+found|sem\s+resultado/i.test(String(err.message || ""))
  );
}

async function executarComNotFoundSuave(fn, termo) {
  try {
    return await fn();
  } catch (err) {
    if (isNotFoundConsultaError(err)) {
      return { __notFound: true, termo };
    }
    throw err;
  }
}

function temAdvogadosOab(raw) {
  if (!raw) return false;
  const checkArr = (arr) =>
    Array.isArray(arr) &&
    arr.some((a) => a && typeof a === "object" && (a.NOME || a.nome || a.INSCRICAO || a.inscricao));

  if (checkArr(raw)) return true;
  const candidates = [
    raw.CNA_ADVOGADOS,
    raw.ADVOGADOS,
    raw.advogados,
    raw.response?.CNA_ADVOGADOS,
    raw.response?.ADVOGADOS,
    raw.conteudo?.CNA_ADVOGADOS,
    raw.conteudo?.ADVOGADOS,
    raw.data?.response?.CNA_ADVOGADOS,
    raw.data?.conteudo?.CNA_ADVOGADOS,
    raw.data?.CNA_ADVOGADOS,
  ];
  return candidates.some(checkArr);
}

export async function puxarDados({
  tipo = "cpf",
  termo = "",
  uf = "",
  param2 = null,
  params = null,
}) {
  const isMock = process.env.MOCK_MODE === "true";
  const tipoNormalizado = String(tipo || "cpf").toLowerCase().trim();
  const isTelefoneModulo = ["telefone", "celular", "telefone_puxar", "operadora"].includes(tipoNormalizado);
  const isCnpjModulo = ["cnpj", "cnpj2", "socios", "socios2", "funcionarios"].includes(tipoNormalizado);
  const isCpfEmpregoModulo = tipoNormalizado === "empregos";
  const cleanTerm = isTelefoneModulo
    ? limparTelefoneBr(termo)
    : isCnpjModulo || isCpfEmpregoModulo
      ? String(termo || "").replace(/\D/g, "")
      : String(termo || "").trim();

  if (isCnpjModulo && cleanTerm.length !== 14) {
    throw new Error("Informe um CNPJ válido com 14 dígitos (00.000.000/0000-00).");
  }
  if (isCpfEmpregoModulo && cleanTerm.length !== 11) {
    throw new Error("Informe um CPF válido com 11 dígitos (000.000.000-00) para consultar o histórico trabalhista.");
  }

  const cacheKeyModulo = `consulta_${tipoNormalizado}`;
  const oabUfCache = tipoNormalizado === "oab" ? String(param2 || uf || "").trim().toUpperCase() : "";
  const cacheTerm = oabUfCache && !cleanTerm.toUpperCase().includes(oabUfCache) ? `${cleanTerm}:${oabUfCache}` : cleanTerm;

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
    const cached = await cacheService.get(cacheKeyModulo, cacheTerm);
    if (cached && cached.data && !isStaleCachedResult(tipoNormalizado, cached.data)) {
      console.log(`[RIMUAPI CACHE HIT] Tipo: ${tipoNormalizado} (${cacheTerm}) via ${cached.source}`);
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
    if (cached && cached.data) {
      console.log(`[RIMUAPI CACHE STALE] Ignorando cache legado para ${tipoNormalizado} (${cacheTerm}).`);
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
            rimuResult = await executarComNotFoundSuave(() => rimuApi.nome(cleanTerm), cleanTerm);
            break;

          case "nome_similar":
            rimuResult = await executarComNotFoundSuave(() => rimuApi.nomeSimilar(cleanTerm), cleanTerm);
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
            rimuResult = await executarComNotFoundSuave(() => rimuApi.telefone(cleanTerm), cleanTerm);
            break;

          case "email":
          case "email_puxar":
            rimuResult = await executarComNotFoundSuave(() => rimuApi.email(cleanTerm), cleanTerm);
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
                const cnpjArr = Array.isArray(rimuResult) ? rimuResult : [rimuResult];
                const hasCnpjData = cnpjArr.some((item) => {
                  if (!item || typeof item !== "object") return false;
                  const emp = Array.isArray(item.EMPRESA) ? item.EMPRESA[0] : item.EMPRESA;
                  const est = Array.isArray(item.ESTABELECIMENTO) ? item.ESTABELECIMENTO[0] : item.ESTABELECIMENTO;
                  return Boolean(
                    emp?.CNPJ ||
                    emp?.RAZAO_SOCIAL ||
                    est?.CNPJ ||
                    est?.NOME_FANTASIA ||
                    item.CNPJ ||
                    item.cnpj ||
                    item.razaoSocial
                  );
                });
                if (!hasCnpjData) {
                  throw new Error("RimuAPI retornou registro CNPJ vazio.");
                }
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
            rimuResult = await executarComNotFoundSuave(() => rimuApi.cnpj2(cleanTerm), cleanTerm);
            break;

          case "razao_social":
            rimuResult = await executarComNotFoundSuave(() => rimuApi.razaoSocial(cleanTerm), cleanTerm);
            break;

          case "socios":
            rimuResult = await executarComNotFoundSuave(() => rimuApi.socios(cleanTerm), cleanTerm);
            break;

          case "socios2":
            rimuResult = await executarComNotFoundSuave(() => rimuApi.socios2(cleanTerm), cleanTerm);
            break;

          case "funcionarios":
            rimuResult = await executarComNotFoundSuave(() => rimuApi.funcionarios(cleanTerm), cleanTerm);
            break;

          case "empregos":
            rimuResult = await executarComNotFoundSuave(() => rimuApi.empregos(cleanTerm), cleanTerm);
            break;

          case "oab": {
            let numOab = String(cleanTerm || "").replace(/^oab[\s\/-]*/i, "").trim();
            let ufOab = String(param2 || uf || "").trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);

            // Se o usuário digitou tudo no primeiro campo (ex: "18442 ES" ou "18442/ES" ou "18442-ES")
            if (!ufOab && /\s+|\/|-/.test(numOab)) {
              const parts = numOab.split(/[\s\/\-]+/).filter(Boolean);
              const ufPart = parts.find((p) => /^[a-zA-Z]{2}$/.test(p));
              const numPart = parts.find((p) => /^\d+$/.test(p));
              if (ufPart && numPart) {
                numOab = numPart;
                ufOab = ufPart.toUpperCase();
              }
            }

            const isNotFoundErr = (e) =>
              e.code === "NOT_FOUND" ||
              e.status === 404 ||
              /nenhum|n[aã]o\s+encontrad|n[aã]o\s+localizad|not\s+found|sem\s+resultado/i.test(String(e.message || ""));

            // Tenta formato canônico separado (chave: número OAB, param2: UF)
            try {
              rimuResult = await rimuApi.oab(numOab, ufOab || null);
            } catch (oabErr1) {
              if (!ufOab || !isNotFoundErr(oabErr1)) throw oabErr1;
              rimuResult = null;
            }

            // Fallback caso a instância RimuAPI espere "NUM UF" concatenado em chave
            if (!temAdvogadosOab(rimuResult) && ufOab) {
              try {
                const altResult = await rimuApi.oab(`${numOab} ${ufOab}`, null);
                if (temAdvogadosOab(altResult) || !rimuResult) {
                  rimuResult = altResult;
                }
              } catch (oabErr2) {
                if (!rimuResult && !isNotFoundErr(oabErr2)) throw oabErr2;
              }
            }

            if (!rimuResult) {
              rimuResult = { CNA_ADVOGADOS: [], CNA_FOTOS: [], CNA_SOCIEDADES: [] };
            }
            break;
          }

          case "mae":
            rimuResult = await executarComNotFoundSuave(() => rimuApi.mae(cleanTerm), cleanTerm);
            break;

          case "pai":
            rimuResult = await executarComNotFoundSuave(() => rimuApi.pai(cleanTerm), cleanTerm);
            break;

          case "parentes":
          case "vizinhos":
            rimuResult = await rimuApi.parentes(cleanTerm);
            break;

          case "arvore_familiar":
            rimuResult = await executarComNotFoundSuave(() => rimuApi.arvoreFamiliar(cleanTerm), cleanTerm);
            break;

          case "desmascarador": {
            let cpfParcial = "";
            let nomeCompleto = "";
            const t1 = String(cleanTerm || "").trim();
            const t2 = String(param2 || "").trim();

            // Suporta tanto Nome no input 1 e 6 dígitos no input 2 quanto o inverso
            if (/^\d{6}$/.test(t1.replace(/\D/g, ""))) {
              cpfParcial = t1.replace(/\D/g, "");
              nomeCompleto = t2;
            } else if (/^\d{6}$/.test(t2.replace(/\D/g, ""))) {
              cpfParcial = t2.replace(/\D/g, "");
              nomeCompleto = t1;
            } else {
              cpfParcial = t1.replace(/\D/g, "");
              nomeCompleto = t2;
            }

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

        const deveEvitarCache =
          Boolean(payloadData?.notFound || payloadData?.isNotFound) ||
          (tipoNormalizado === "oab" && (!Array.isArray(payloadData?.advogados) || payloadData.advogados.length === 0));

        // Grava no cache persistente com TTL inteligente (evitando cachear resultados vazios/notFound)
        if (!deveEvitarCache) {
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
              "cep_avancado",
              "endereco",
              "oab",
            ].includes(tipoNormalizado);

            const ttlMs = isDocEstatico ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
            await cacheService.set(cacheKeyModulo, cacheTerm, payloadData, {
              ttlMs,
              metadata: { tipo: tipoNormalizado },
            });
          } catch (cacheSaveErr) {
            console.warn(`[RIMUAPI CACHE SAVE ERROR]: ${cacheSaveErr.message}`);
          }
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
          ...(payloadData?.notFound || payloadData?.isNotFound ? { notFound: true } : {}),
          dados: payloadData,
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
        throw new Error(
          "Acesso não autorizado na RimuAPI (HTTP 401). Verifique se a variável RIMUAPI_KEY está configurada corretamente na Vercel."
        );
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

  throw new Error("Serviço de consulta não configurado. Certifique-se de configurar a variável RIMUAPI_KEY na Vercel e realizar um Redeploy.");
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
      return {
        tipo: "nome",
        termo,
        fonte: "Simulação Cadastral Nominal / Adapter Mock",
        timestamp: baseTimestamp,
        dados: [
          {
            nome: termo.toUpperCase(),
            cpf: "193.663.371-04",
            nascimento: "14/08/1986",
            nomeMae: "MARIA APARECIDA DA SILVA PEREIRA",
            cidade: "São Paulo - SP",
          },
          {
            nome: termo.toUpperCase(),
            cpf: "726.672.069-91",
            nascimento: "22/03/1992",
            nomeMae: "LUCIA HELENA SANTOS",
            cidade: "Curitiba - PR",
          },
        ],
      };

    case "nome_similar":
      return {
        tipo: "nome_similar",
        termo,
        fonte: "Simulação Nome Similar / Adapter Mock",
        timestamp: baseTimestamp,
        dados: [
          { NOME: `${termo.toUpperCase()} BITTENCOURT`, CPF: "19366337104" },
          { NOME: `${termo.toUpperCase()} BADLUK`, CPF: "72667206991" },
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
