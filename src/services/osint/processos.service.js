import { httpRequest } from '../core/httpClient.js';
import { escavadorService } from './escavador.service.js';
import { buscaProcessosService } from './buscaprocessos.service.js';
import {
  decodificarEValidarCNJ,
  gerarLinksEDorksProcessuais,
  gerarDorksPorNome,
  normalizarDadosDataJud,
  gerarFichaAnaliticaCNJ,
} from '../../utils/processos.utils.js';

/**
 * ==============================================================================
 * RIMUBUSCA - MÓDULO DE PROCESSOS JUDICIAIS & INTELIGÊNCIA JURÍDICA
 * Arquitetura Híbrida Inteligente:
 * 1. BuscaProcessos.app.br API (Oficial com suporte ao Plano Free & Produção)
 *    - CPF, CNPJ, OAB, CNJ e busca textual de termos/nomes
 * 2. DataJud CNJ Oficial (Cluster elástico público do Conselho Nacional de Justiça)
 * 3. Scraper JavaScript Nativo (Vercel-proof com zero dependência de Python)
 * ==============================================================================
 */
export class ProcessosService {
  constructor() {
    this.apiKey =
      process.env.DATAJUD_API_KEY ||
      'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';
    this.baseUrl = 'https://api-publica.datajud.cnj.jus.br';
    this.buscaProcessos = buscaProcessosService;
  }

  /**
   * Dispara requisição direta e oficial para a API Pública do DataJud (CNJ)
   * @param {string} numeroLimpo - Número único com 20 dígitos numéricos
   * @param {string} aliasTribunal - Sigla minúscula do tribunal (ex: tjsp, tjes, trf2)
   * @returns {Promise<Object|null>}
   */
  async consultarDataJudApi(numeroLimpo, aliasTribunal) {
    const endpoint = `${this.baseUrl}/api_publica_${aliasTribunal}/_search`;
    const payload = {
      query: {
        match: {
          numeroProcesso: numeroLimpo,
        },
      },
    };

    console.log(`\n================================================================`);
    console.log(`[DATAJUD CNJ] 🔍 DISPARANDO REQUISIÇÃO OFICIAL PARA A API PÚBLICA`);
    console.log(`[DATAJUD CNJ] 🌐 Endpoint: ${endpoint}`);
    console.log(`[DATAJUD CNJ] 🏛️ Tribunal: ${aliasTribunal.toUpperCase()}`);
    console.log(`[DATAJUD CNJ] 🔢 Processo CNJ: ${numeroLimpo}`);
    console.log(`[DATAJUD CNJ] ⏳ Aguardando retorno dos servidores do CNJ...`);

    try {
      const res = await httpRequest(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `APIKey ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
        timeout: 25000,
      });

      console.log(`[DATAJUD CNJ] ✅ Status HTTP: ${res.status}`);
      const hits = res.data?.hits?.hits || [];
      console.log(`[DATAJUD CNJ] 📄 Registros encontrados: ${hits.length}`);

      if (res.ok && hits.length > 0) {
        return hits[0]._source;
      }
    } catch (err) {
      console.warn(`[DATAJUD CNJ] ⚠️ Aviso na requisição ao tribunal ${aliasTribunal.toUpperCase()}:`, err.message);
    } finally {
      console.log(`================================================================\n`);
    }

    return null;
  }

  /**
   * Executa extração de inteligência do Escavador em JavaScript nativo (sem Python)
   * @param {string} termo - Nome completo, OAB ou URL do perfil
   * @returns {Promise<Object>}
   */
  async consultarEscavadorBridge(termo) {
    try {
      return await escavadorService.coletarPerfilEscavador(termo);
    } catch (err) {
      console.warn('[ESCAVADOR JS SERVICE ERROR]:', err.message);
      return {
        sucesso: false,
        encontrado: false,
        mensagem: 'Não foi possível extrair dados estruturados do perfil neste momento.',
      };
    }
  }

  /**
   * Obtém detalhes aprofundados de um processo judicial específico
   * Prioriza BuscaProcessos API e usa DataJud / Scraper JS como contingência
   * @param {string} urlProcesso - URL ou CNJ da página do processo
   * @returns {Promise<Object>}
   */
  async obterDetalhesProcesso(urlProcesso) {
    const rawStr = String(urlProcesso || '').trim();

    // 1. Se for um CNJ ou contiver um CNJ, tenta via BuscaProcessos API
    const mCnj = rawStr.match(/(\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4})/);
    if (mCnj) {
      const cnjAlvo = mCnj[1];
      if (await this.buscaProcessos.hasKey()) {
        try {
          const bpRes = await this.buscaProcessos.consultarPorCnj(cnjAlvo);
          if (bpRes && bpRes.dados) {
            const d = bpRes.dados;
            return {
              sucesso: true,
              numeroCnj: d.numeroProcesso || cnjAlvo,
              numeroOriginal: d.numeroProcesso || cnjAlvo,
              desmascarado: true,
              tribunal: d.metadadosCnj?.tribunalSigla || 'TJ',
              forum: d.orgaoJulgador || d.comarca || '',
              comarca: d.comarca || '',
              classe: d.classe || 'Ação Judicial',
              dataCriacao: d.dataAjuizamento,
              valorCausa: d.valorCausa,
              resumoIa: d.resumoIa,
              partes: {
                poloAtivo: Array.isArray(d.polos?.poloAtivo) ? d.polos.poloAtivo.map((p) => p.nome).join(', ') : d.polos?.poloAtivo || null,
                poloPassivo: Array.isArray(d.polos?.poloPassivo) ? d.polos.poloPassivo.map((p) => p.nome).join(', ') : d.polos?.poloPassivo || null,
                advogados: d.polos?.poloAtivo?.flatMap((p) => p.advogados || []) || [],
              },
              ultimaMovimentacao: d.movimentacoes && d.movimentacoes.length > 0 ? {
                tipo: d.movimentacoes[0].nome,
                data: d.movimentacoes[0].data,
                textoIntegral: d.movimentacoes[0].descricao,
              } : null,
              movimentacoes: d.movimentacoes || [],
              url: urlProcesso,
              fonte: d.fonte || 'BuscaProcessos API (Oficial)',
            };
          }
        } catch (err) {
          console.warn('[BUSCAPROCESSOS DETALHES FALLBACK]:', err.message);
        }
      }

      // Tenta DataJud oficial caso BuscaProcessos falhe ou não tenha chave
      try {
        const djRes = await this.consultarPorNumero(cnjAlvo);
        if (djRes && djRes.dados) {
          const d = djRes.dados;
          return {
            sucesso: true,
            numeroCnj: d.numeroProcesso || cnjAlvo,
            numeroOriginal: d.numeroProcesso || cnjAlvo,
            desmascarado: true,
            tribunal: d.metadadosCnj?.tribunalSigla || 'TJ',
            forum: d.orgaoJulgador || d.comarca || '',
            comarca: d.comarca || '',
            classe: d.classe || 'Processo Judicial',
            dataCriacao: d.dataAjuizamento,
            valorCausa: d.valorCausa,
            resumoIa: null,
            partes: {
              poloAtivo: d.polos?.poloAtivo?.map((p) => p.nome).join(', ') || null,
              poloPassivo: d.polos?.poloPassivo?.map((p) => p.nome).join(', ') || null,
              advogados: [],
            },
            ultimaMovimentacao: d.movimentacoes && d.movimentacoes.length > 0 ? {
              tipo: d.movimentacoes[0].nome,
              data: d.movimentacoes[0].data,
              textoIntegral: d.movimentacoes[0].descricao,
            } : null,
            movimentacoes: d.movimentacoes || [],
            url: urlProcesso,
            fonte: 'DataJud CNJ Oficial',
          };
        }
      } catch (err) {
        console.warn('[DATAJUD DETALHES FALLBACK]:', err.message);
      }
    }

    // 2. Contingência via Scraper JS nativo do Escavador
    try {
      return await escavadorService.coletarDetalhesProcesso(urlProcesso);
    } catch (err) {
      console.warn('[ESCAVADOR DETALHES JS ERROR]:', err.message);
      return {
        sucesso: false,
        error: err.message || 'Não foi possível recuperar os autos públicos deste processo.',
      };
    }
  }

  /**
   * Consulta processo por número CNJ (20 dígitos)
   * @param {string} termoBusca
   * @returns {Promise<Object>}
   */
  async consultarPorNumero(termoBusca) {
    const decodificado = decodificarEValidarCNJ(termoBusca);

    if (!decodificado.valido && decodificado.limpo.length !== 20) {
      throw new Error(decodificado.motivo || 'Número CNJ inválido. O padrão CNJ deve possuir 20 dígitos numéricos.');
    }

    const alias = decodificado.partes?.tribunalAlias || 'tjsp';
    const rawDataJud = await this.consultarDataJudApi(decodificado.limpo, alias);

    let resultadoDados;
    if (rawDataJud) {
      resultadoDados = normalizarDadosDataJud(rawDataJud, decodificado);
    } else {
      resultadoDados = gerarFichaAnaliticaCNJ(
        decodificado,
        `Consulta realizada no cluster DataJud (${alias.toUpperCase()}). Servidores do CNJ em alta carga ou processo sem publicação pública indexada. Exibindo metadados analíticos e links de consulta processual direta.`
      );
    }

    const { linksDiretos, dorks } = gerarLinksEDorksProcessuais(decodificado.formatado, decodificado.limpo, decodificado);
    resultadoDados.linksDiretos = linksDiretos;
    resultadoDados.dorks = dorks;
    resultadoDados.validacaoCnj = {
      valido: decodificado.valido,
      motivo: decodificado.motivo,
    };

    return {
      success: true,
      tipoBusca: 'cnj',
      alvo: decodificado.formatado,
      dados: resultadoDados,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Consulta advogado, parte ou empresa por nome ou documento
   * @param {string} termo
   * @param {string} tipo
   * @returns {Promise<Object>}
   */
  async consultarPorNomeOuParte(termo, tipo = 'nome') {
    const termoLimpo = String(termo || '').trim();

    // 1. Invoca o scraper de inteligência oficial do Escavador com salvaguarda
    let escavadorData = null;
    try {
      escavadorData = await this.consultarEscavadorBridge(termoLimpo);
    } catch {
      escavadorData = null;
    }

    // Se o escavador for bloqueado (403), não encontrado ou instável, trata com elegância
    if (!escavadorData || !escavadorData.encontrado || escavadorData.mensagem?.includes('403') || escavadorData.mensagem?.includes('HTTP')) {
      escavadorData = {
        sucesso: true,
        encontrado: false,
        nome: termoLimpo,
        url: `https://www.escavador.com/busca?q=${encodeURIComponent(termoLimpo)}`,
        totalProcessos: 0,
        descricaoGeral: `Varredura jurídica realizada nos diários oficiais.`,
        resumo: `Nenhum processo ostensivo público indexado de forma aberta para "${termoLimpo}". Utilize os links oficiais de consulta e Dorks abaixo.`,
        polosAtuacao: [],
        estados: [],
        assuntos: [],
        processosRecentes: [],
      };
    }

    // 2. Gera os Google Dorks jurídicos especializados
    const dorks = gerarDorksPorNome(termoLimpo);

    const linksDiretos = {
      jusbrasil: `https://www.jusbrasil.com.br/busca?q=${encodeURIComponent(termoLimpo)}`,
      escavador: escavadorData?.url || `https://www.escavador.com/busca?q=${encodeURIComponent(termoLimpo)}`,
      djen: 'https://comunica.pje.jus.br/',
      datajud: 'https://comunica.pje.jus.br/',
    };

    return {
      success: true,
      tipoBusca: 'parte',
      alvo: termoLimpo,
      dados: {
        termo: termoLimpo,
        tipo: tipo === 'documento' ? 'CPF / CNPJ' : 'Nome de Parte / Advogado',
        escavador: escavadorData,
        dorks,
        linksDiretos,
        mensagem: escavadorData?.encontrado
          ? `Perfil processual e estatísticas localizadas com sucesso para "${termoLimpo}".`
          : `Varredura jurídica e rotas de monitoramento geradas para "${termoLimpo}".`,
        fonte: escavadorData?.encontrado ? escavadorData.fonte : 'Diários Oficiais, DJEN & Jusbrasil',
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Método principal e unificado para investigação processual
   * Roteamento com BuscaProcessos API (Plano Free/Pro) como prioridade e contingência DataJud/Escavador
   * @param {string} termoBusca
   * @param {string} tipoBusca - 'cnj', 'nome', 'documento', 'oab'
   * @returns {Promise<Object>}
   */
  async consultar(termoBusca, tipoBusca = 'cnj') {
    const termoLimpo = String(termoBusca || '').trim();

    if (!termoLimpo) {
      throw new Error('Informe um termo de busca válido.');
    }

    const digitsOnly = termoLimpo.replace(/\D/g, '');
    const isDoc = tipoBusca === 'documento' || digitsOnly.length === 11 || digitsOnly.length === 14;
    const isCnjFormat =
      tipoBusca === 'cnj' ||
      /^\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}$/.test(termoLimpo) ||
      (/^\d{20}$/.test(digitsOnly) && tipoBusca !== 'nome');
    const isOab = tipoBusca === 'oab' || /^(?:OAB\s*)?[A-Za-z]{2}\s*\d+|\d+\s*[/]\s*[A-Za-z]{2}$/i.test(termoLimpo);

    const hasBpKey = await this.buscaProcessos.hasKey();

    // 1. Rota de Documento (CPF ou CNPJ)
    if (isDoc && tipoBusca !== 'nome') {
      if (hasBpKey) {
        try {
          return await this.buscaProcessos.consultarPorCpfCnpj(digitsOnly);
        } catch (err) {
          console.warn('[BUSCAPROCESSOS CPF/CNPJ FALLBACK]:', err.message);
        }
      }
      return this.consultarPorNomeOuParte(termoLimpo, 'documento');
    }

    // 2. Rota de OAB
    if (isOab && hasBpKey) {
      try {
        return await this.buscaProcessos.consultarPorOab(termoLimpo);
      } catch (err) {
        console.warn('[BUSCAPROCESSOS OAB FALLBACK]:', err.message);
      }
    }

    // 3. Rota de Número de Processo CNJ
    if (isCnjFormat && tipoBusca !== 'nome') {
      if (hasBpKey) {
        try {
          const bpRes = await this.buscaProcessos.consultarPorCnj(termoLimpo);
          if (bpRes && bpRes.dados) {
            // Se BuscaProcessos não retornou movimentações, tenta complementar com a API oficial do DataJud
            if (!bpRes.dados.movimentacoes || bpRes.dados.movimentacoes.length === 0) {
              const decodificado = decodificarEValidarCNJ(termoLimpo);
              const alias = decodificado.partes?.tribunalAlias;
              if (alias) {
                try {
                  const rawDataJud = await this.consultarDataJudApi(decodificado.limpo, alias);
                  if (rawDataJud && rawDataJud.movimentos) {
                    const djNormalizado = normalizarDadosDataJud(rawDataJud, decodificado);
                    if (djNormalizado.movimentacoes?.length > 0) {
                      bpRes.dados.movimentacoes = djNormalizado.movimentacoes;
                      bpRes.dados.fonte = 'BuscaProcessos & DataJud CNJ Oficial';
                    }
                  }
                } catch {
                  // Mantém resultado do BuscaProcessos
                }
              }
            }
            return bpRes;
          }
        } catch (err) {
          console.warn('[BUSCAPROCESSOS CNJ FALLBACK]:', err.message);
        }
      }
      return this.consultarPorNumero(termoLimpo);
    }

    // 4. Rota de Nome de Parte / Advogado / Termo
    if (hasBpKey) {
      try {
        const bpRes = await this.buscaProcessos.consultarPorTermo(termoLimpo);
        if (bpRes && bpRes.dados) {
          return bpRes;
        }
      } catch (err) {
        console.warn('[BUSCAPROCESSOS NOME FALLBACK]:', err.message);
      }
    }

    return this.consultarPorNomeOuParte(termoLimpo, tipoBusca);
  }
}

// Instância padrão do serviço
const processosService = new ProcessosService();
export default processosService;
export { processosService };

// Função de compatibilidade com os controllers existentes
export const consultarProcessoJudicial = (termo, tipo) => processosService.consultar(termo, tipo);
export const obterDetalhesProcessoJudicial = (url) => processosService.obterDetalhesProcesso(url);
export { decodificarEValidarCNJ } from '../../utils/processos.utils.js';
export { buscaProcessosService };
