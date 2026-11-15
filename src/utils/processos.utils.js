/**
 * ==============================================================================
 * RIMUBUSCA - UTILITÁRIOS PROCESSUAIS & DATAJUD (PROCESSOS.UTILS.JS)
 * Tabelas oficiais do CNJ, validação matemática Módulo 97 (Res. 65/2008),
 * decodificador de numeração única, formatadores e gerador de Dorks jurídicos.
 * ==============================================================================
 */

/**
 * Tabela de Ramos do Poder Judiciário (Dígito J da numeração CNJ)
 */
export const RAMOS_JUSTICA = {
  '1': { nome: 'Supremo Tribunal Federal', sigla: 'STF' },
  '2': { nome: 'Conselho Nacional de Justiça', sigla: 'CNJ' },
  '3': { nome: 'Superior Tribunal de Justiça', sigla: 'STJ' },
  '4': { nome: 'Justiça Federal', sigla: 'JF' },
  '5': { nome: 'Justiça do Trabalho', sigla: 'JT' },
  '6': { nome: 'Justiça Eleitoral', sigla: 'JE' },
  '7': { nome: 'Justiça Militar da União', sigla: 'JMU' },
  '8': { nome: 'Justiça Estadual / DF', sigla: 'JE' },
  '9': { nome: 'Justiça Militar Estadual', sigla: 'JME' },
};

/**
 * Mapeamento dos Tribunais do Brasil (Dígito J.TR) com alias do DataJud
 */
export const TRIBUNAIS_MAP = {
  // Tribunais Superiores
  '1.00': { sigla: 'STF', nome: 'Supremo Tribunal Federal', alias: 'stf', uf: 'BR', portal: 'https://portal.stf.jus.br' },
  '2.00': { sigla: 'CNJ', nome: 'Conselho Nacional de Justiça', alias: 'cnj', uf: 'BR', portal: 'https://www.cnj.jus.br' },
  '3.00': { sigla: 'STJ', nome: 'Superior Tribunal de Justiça', alias: 'stj', uf: 'BR', portal: 'https://www.stj.jus.br' },

  // Justiça Federal (TRFs)
  '4.01': { sigla: 'TRF1', nome: 'Tribunal Regional Federal da 1ª Região (DF/GO/MT/BA/PA...)', alias: 'trf1', uf: 'DF', portal: 'https://portal.trf1.jus.br' },
  '4.02': { sigla: 'TRF2', nome: 'Tribunal Regional Federal da 2ª Região (RJ/ES)', alias: 'trf2', uf: 'RJ', portal: 'https://www.trf2.jus.br' },
  '4.03': { sigla: 'TRF3', nome: 'Tribunal Regional Federal da 3ª Região (SP/MS)', alias: 'trf3', uf: 'SP', portal: 'https://www.trf3.jus.br' },
  '4.04': { sigla: 'TRF4', nome: 'Tribunal Regional Federal da 4ª Região (RS/SC/PR)', alias: 'trf4', uf: 'RS', portal: 'https://www.trf4.jus.br' },
  '4.05': { sigla: 'TRF5', nome: 'Tribunal Regional Federal da 5ª Região (PE/CE/RN/PB/AL/SE)', alias: 'trf5', uf: 'PE', portal: 'https://www.trf5.jus.br' },
  '4.06': { sigla: 'TRF6', nome: 'Tribunal Regional Federal da 6ª Região (MG)', alias: 'trf6', uf: 'MG', portal: 'https://www.trf6.jus.br' },

  // Justiça do Trabalho (TST e TRTs)
  '5.00': { sigla: 'TST', nome: 'Tribunal Superior do Trabalho', alias: 'tst', uf: 'BR', portal: 'https://www.tst.jus.br' },
  '5.01': { sigla: 'TRT1', nome: 'TRT da 1ª Região (Rio de Janeiro)', alias: 'trt1', uf: 'RJ', portal: 'https://www.trt1.jus.br' },
  '5.02': { sigla: 'TRT2', nome: 'TRT da 2ª Região (São Paulo - Capital)', alias: 'trt2', uf: 'SP', portal: 'https://ww2.trtsp.jus.br' },
  '5.03': { sigla: 'TRT3', nome: 'TRT da 3ª Região (Minas Gerais)', alias: 'trt3', uf: 'MG', portal: 'https://portal.trt3.jus.br' },
  '5.04': { sigla: 'TRT4', nome: 'TRT da 4ª Região (Rio Grande do Sul)', alias: 'trt4', uf: 'RS', portal: 'https://www.trt4.jus.br' },
  '5.05': { sigla: 'TRT5', nome: 'TRT da 5ª Região (Bahia)', alias: 'trt5', uf: 'BA', portal: 'https://www.trt5.jus.br' },
  '5.06': { sigla: 'TRT6', nome: 'TRT da 6ª Região (Pernambuco)', alias: 'trt6', uf: 'PE', portal: 'https://www.trt6.jus.br' },
  '5.07': { sigla: 'TRT7', nome: 'TRT da 7ª Região (Ceará)', alias: 'trt7', uf: 'CE', portal: 'https://www.trt7.jus.br' },
  '5.08': { sigla: 'TRT8', nome: 'TRT da 8ª Região (Pará e Amapá)', alias: 'trt8', uf: 'PA', portal: 'https://www.trt8.jus.br' },
  '5.09': { sigla: 'TRT9', nome: 'TRT da 9ª Região (Paraná)', alias: 'trt9', uf: 'PR', portal: 'https://www.trt9.jus.br' },
  '5.10': { sigla: 'TRT10', nome: 'TRT da 10ª Região (DF e Tocantins)', alias: 'trt10', uf: 'DF', portal: 'https://www.trt10.jus.br' },
  '5.11': { sigla: 'TRT11', nome: 'TRT da 11ª Região (Amazonas e Roraima)', alias: 'trt11', uf: 'AM', portal: 'https://www.trt11.jus.br' },
  '5.12': { sigla: 'TRT12', nome: 'TRT da 12ª Região (Santa Catarina)', alias: 'trt12', uf: 'SC', portal: 'https://www.trt12.jus.br' },
  '5.13': { sigla: 'TRT13', nome: 'TRT da 13ª Região (Paraíba)', alias: 'trt13', uf: 'PB', portal: 'https://www.trt13.jus.br' },
  '5.14': { sigla: 'TRT14', nome: 'TRT da 14ª Região (Rondônia e Acre)', alias: 'trt14', uf: 'RO', portal: 'https://www.trt14.jus.br' },
  '5.15': { sigla: 'TRT15', nome: 'TRT da 15ª Região (Campinas / Interior SP)', alias: 'trt15', uf: 'SP', portal: 'https://trt15.jus.br' },
  '5.16': { sigla: 'TRT16', nome: 'TRT da 16ª Região (Maranhão)', alias: 'trt16', uf: 'MA', portal: 'https://www.trt16.jus.br' },
  '5.17': { sigla: 'TRT17', nome: 'TRT da 17ª Região (Espírito Santo)', alias: 'trt17', uf: 'ES', portal: 'https://www.trtes.jus.br' },
  '5.18': { sigla: 'TRT18', nome: 'TRT da 18ª Região (Goiás)', alias: 'trt18', uf: 'GO', portal: 'https://www.trt18.jus.br' },
  '5.19': { sigla: 'TRT19', nome: 'TRT da 19ª Região (Alagoas)', alias: 'trt19', uf: 'AL', portal: 'https://www.trt19.jus.br' },
  '5.20': { sigla: 'TRT20', nome: 'TRT da 20ª Região (Sergipe)', alias: 'trt20', uf: 'SE', portal: 'https://www.trt20.jus.br' },
  '5.21': { sigla: 'TRT21', nome: 'TRT da 21ª Região (Rio Grande do Norte)', alias: 'trt21', uf: 'RN', portal: 'https://www.trt21.jus.br' },
  '5.22': { sigla: 'TRT22', nome: 'TRT da 22ª Região (Piauí)', alias: 'trt22', uf: 'PI', portal: 'https://www.trt22.jus.br' },
  '5.23': { sigla: 'TRT23', nome: 'TRT da 23ª Região (Mato Grosso)', alias: 'trt23', uf: 'MT', portal: 'https://www.trt23.jus.br' },
  '5.24': { sigla: 'TRT24', nome: 'TRT da 24ª Região (Mato Grosso do Sul)', alias: 'trt24', uf: 'MS', portal: 'https://www.trt24.jus.br' },

  // Justiça Estadual (TJs de todos os 26 Estados + DF)
  '8.01': { sigla: 'TJAC', nome: 'Tribunal de Justiça do Acre', alias: 'tjac', uf: 'AC', portal: 'https://www.tjac.jus.br' },
  '8.02': { sigla: 'TJAL', nome: 'Tribunal de Justiça de Alagoas', alias: 'tjal', uf: 'AL', portal: 'https://www.tjal.jus.br' },
  '8.03': { sigla: 'TJAP', nome: 'Tribunal de Justiça do Amapá', alias: 'tjap', uf: 'AP', portal: 'https://www.tjap.jus.br' },
  '8.04': { sigla: 'TJAM', nome: 'Tribunal de Justiça do Amazonas', alias: 'tjam', uf: 'AM', portal: 'https://www.tjam.jus.br' },
  '8.05': { sigla: 'TJBA', nome: 'Tribunal de Justiça da Bahia', alias: 'tjba', uf: 'BA', portal: 'https://www.tjba.jus.br' },
  '8.06': { sigla: 'TJCE', nome: 'Tribunal de Justiça do Ceará', alias: 'tjce', uf: 'CE', portal: 'https://www.tjce.jus.br' },
  '8.07': { sigla: 'TJDFT', nome: 'TJ do Distrito Federal e dos Territórios', alias: 'tjdft', uf: 'DF', portal: 'https://www.tjdft.jus.br' },
  '8.08': { sigla: 'TJES', nome: 'Tribunal de Justiça do Espírito Santo', alias: 'tjes', uf: 'ES', portal: 'https://www.tjes.jus.br' },
  '8.09': { sigla: 'TJGO', nome: 'Tribunal de Justiça de Goiás', alias: 'tjgo', uf: 'GO', portal: 'https://www.tjgo.jus.br' },
  '8.10': { sigla: 'TJMA', nome: 'Tribunal de Justiça do Maranhão', alias: 'tjma', uf: 'MA', portal: 'https://www.tjma.jus.br' },
  '8.11': { sigla: 'TJMT', nome: 'Tribunal de Justiça de Mato Grosso', alias: 'tjmt', uf: 'MT', portal: 'https://www.tjmt.jus.br' },
  '8.12': { sigla: 'TJMS', nome: 'Tribunal de Justiça de Mato Grosso do Sul', alias: 'tjms', uf: 'MS', portal: 'https://www.tjms.jus.br' },
  '8.13': { sigla: 'TJMG', nome: 'Tribunal de Justiça de Minas Gerais', alias: 'tjmg', uf: 'MG', portal: 'https://www.tjmg.jus.br' },
  '8.14': { sigla: 'TJPA', nome: 'Tribunal de Justiça do Pará', alias: 'tjpa', uf: 'PA', portal: 'https://www.tjpa.jus.br' },
  '8.15': { sigla: 'TJPB', nome: 'Tribunal de Justiça da Paraíba', alias: 'tjpb', uf: 'PB', portal: 'https://www.tjpb.jus.br' },
  '8.16': { sigla: 'TJPR', nome: 'Tribunal de Justiça do Paraná', alias: 'tjpr', uf: 'PR', portal: 'https://www.tjpr.jus.br' },
  '8.17': { sigla: 'TJPE', nome: 'Tribunal de Justiça de Pernambuco', alias: 'tjpe', uf: 'PE', portal: 'https://www.tjpe.jus.br' },
  '8.18': { sigla: 'TJPI', nome: 'Tribunal de Justiça do Piauí', alias: 'tjpi', uf: 'PI', portal: 'https://www.tjpi.jus.br' },
  '8.19': { sigla: 'TJRJ', nome: 'Tribunal de Justiça do Rio de Janeiro', alias: 'tjrj', uf: 'RJ', portal: 'https://www.tjrj.jus.br' },
  '8.20': { sigla: 'TJRN', nome: 'Tribunal de Justiça do Rio Grande do Norte', alias: 'tjrn', uf: 'RN', portal: 'https://www.tjrn.jus.br' },
  '8.21': { sigla: 'TJRS', nome: 'Tribunal de Justiça do Rio Grande do Sul', alias: 'tjrs', uf: 'RS', portal: 'https://www.tjrs.jus.br' },
  '8.22': { sigla: 'TJRO', nome: 'Tribunal de Justiça de Rondônia', alias: 'tjro', uf: 'RO', portal: 'https://www.tjro.jus.br' },
  '8.23': { sigla: 'TJRR', nome: 'Tribunal de Justiça de Roraima', alias: 'tjrr', uf: 'RR', portal: 'https://www.tjrr.jus.br' },
  '8.24': { sigla: 'TJSC', nome: 'Tribunal de Justiça de Santa Catarina', alias: 'tjsc', uf: 'SC', portal: 'https://www.tjsc.jus.br' },
  '8.25': { sigla: 'TJSE', nome: 'Tribunal de Justiça de Sergipe', alias: 'tjse', uf: 'SE', portal: 'https://www.tjse.jus.br' },
  '8.26': { sigla: 'TJSP', nome: 'Tribunal de Justiça de São Paulo', alias: 'tjsp', uf: 'SP', portal: 'https://esaj.tjsp.jus.br' },
  '8.27': { sigla: 'TJTO', nome: 'Tribunal de Justiça do Tocantins', alias: 'tjto', uf: 'TO', portal: 'https://www.tjto.jus.br' },
};

/**
 * Validação do Dígito Verificador Módulo 97 na base 10 (Resolução CNJ nº 65/2008)
 * Formato: NNNNNNN-DD.AAAA.J.TR.OOOO
 * @param {string} rawCNJ
 * @returns {Object}
 */
export function decodificarEValidarCNJ(rawCNJ) {
  const limpo = String(rawCNJ || '').replace(/\D/g, '');

  if (limpo.length !== 20) {
    return {
      valido: false,
      motivo: `Número deve ter exatamente 20 dígitos numéricos (encontrados: ${limpo.length}).`,
      limpo,
      formatado: rawCNJ,
      partes: null,
    };
  }

  const NNNNNNN = limpo.substring(0, 7);
  const DD = limpo.substring(7, 9);
  const AAAA = limpo.substring(9, 13);
  const J = limpo.substring(13, 14);
  const TR = limpo.substring(14, 16);
  const OOOO = limpo.substring(16, 20);

  const formatado = `${NNNNNNN}-${DD}.${AAAA}.${J}.${TR}.${OOOO}`;
  const chaveTribunal = `${J}.${TR}`;

  // Cálculo Módulo 97 da Resolução CNJ nº 65/2008
  // resto = BigInt(NNNNNNNAAAAJTROOOO + "00") % 97
  const blocoNumerico = `${NNNNNNN}${AAAA}${J}${TR}${OOOO}00`;
  const resto = BigInt(blocoNumerico) % 97n;
  const dvCalculado = 98n - resto;
  const dvEsperado = BigInt(DD);

  const dvValido = dvCalculado === dvEsperado;

  const ramoJustica = RAMOS_JUSTICA[J] || { nome: 'Desconhecido', sigla: 'DESC' };
  const tribunal = TRIBUNAIS_MAP[chaveTribunal] || {
    sigla: `TR-${J}.${TR}`,
    nome: `Tribunal de Código ${J}.${TR}`,
    alias: `tr${TR}`,
    uf: 'BR',
    portal: 'https://www.cnj.jus.br',
  };

  return {
    valido: dvValido,
    motivo: dvValido ? 'Dígito verificador Módulo 97 autêntico' : `DV incorreto (informado: ${DD}, calculado: ${dvCalculado})`,
    limpo,
    formatado,
    partes: {
      sequencial: NNNNNNN,
      dv: DD,
      ano: Number(AAAA),
      ramoId: J,
      ramoNome: ramoJustica.nome,
      tribunalId: TR,
      tribunalSigla: tribunal.sigla,
      tribunalNome: tribunal.nome,
      tribunalAlias: tribunal.alias,
      tribunalUf: tribunal.uf,
      tribunalPortal: tribunal.portal,
      origemForo: OOOO,
    },
  };
}

/**
 * Formata data ISO para padrão brasileiro DD/MM/AAAA
 */
export function formatarDataIso(isoStr) {
  try {
    const d = new Date(isoStr);
    return isNaN(d.getTime()) ? isoStr : d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  } catch {
    return isoStr;
  }
}

/**
 * Mascara CPFs e CNPJs para proteção de privacidade
 */
export function mascararDocumento(doc) {
  const d = String(doc || '').replace(/\D/g, '');
  if (d.length === 11) {
    return `${d.slice(0, 3)}.***.***-${d.slice(-2)}`;
  }
  if (d.length === 14) {
    return `${d.slice(0, 2)}.***.***/****-${d.slice(-2)}`;
  }
  return doc;
}

/**
 * Gera links diretos e Google Dorks jurídicos para o processo
 */
export function gerarLinksEDorksProcessuais(numeroFormatado, numeroLimpo, decodificado) {
  const tribunal = decodificado?.partes;
  const sigla = tribunal?.tribunalSigla || 'TJ';
  const uf = tribunal?.tribunalUf || 'BR';

  // Links Diretos
  const linksDiretos = {
    tribunalOrigem: tribunal?.tribunalPortal || 'https://www.cnj.jus.br',
    jusbrasil: `https://www.jusbrasil.com.br/processos/numero/${numeroLimpo}`,
    escavador: `https://www.escavador.com/processos/${numeroLimpo}`,
    djen: 'https://comunica.pje.jus.br/',
    pjeConsulta: 'https://pje.jus.br/',
  };

  // Se for TJSP, gera o link exato do e-SAJ 1º grau
  if (sigla === 'TJSP') {
    linksDiretos.eSajConsulta = `https://esaj.tjsp.jus.br/cpopg/search.do?conversationId=&cbPesquisa=NUMPROC&dadosConsulta.valorConsultaNuUnificado=${numeroFormatado}&numeroDigitoAnoUnificado=${numeroFormatado.slice(0, 15)}&foroNumeroUnificado=${numeroFormatado.slice(-4)}`;
  }

  // Google Dorks Jurídicos Especializados
  const dorks = [
    {
      titulo: 'Processo no Jusbrasil',
      query: `site:jusbrasil.com.br "${numeroFormatado}"`,
      url: `https://www.google.com/search?q=${encodeURIComponent(`site:jusbrasil.com.br "${numeroFormatado}"`)}`,
    },
    {
      titulo: 'Diários de Justiça Eletrônicos (DJE / DJEN)',
      query: `site:dje.*.jus.br OR site:comunica.pje.jus.br "${numeroFormatado}"`,
      url: `https://www.google.com/search?q=${encodeURIComponent(`site:dje.*.jus.br OR site:comunica.pje.jus.br "${numeroFormatado}"`)}`,
    },
    {
      titulo: 'Portal Oficial do Tribunal de Origem',
      query: `site:${sigla.toLowerCase()}.jus.br "${numeroFormatado}"`,
      url: `https://www.google.com/search?q=${encodeURIComponent(`site:${sigla.toLowerCase()}.jus.br "${numeroFormatado}"`)}`,
    },
    {
      titulo: 'Publicações no Escavador',
      query: `site:escavador.com "${numeroFormatado}"`,
      url: `https://www.google.com/search?q=${encodeURIComponent(`site:escavador.com "${numeroFormatado}"`)}`,
    },
    {
      titulo: 'Diário Oficial da União (DOU)',
      query: `site:in.gov.br "${numeroFormatado}"`,
      url: `https://www.google.com/search?q=${encodeURIComponent(`site:in.gov.br "${numeroFormatado}"`)}`,
    },
    {
      titulo: 'Decisões e Acórdãos em PDF',
      query: `filetype:pdf "${numeroFormatado}" (sentença OR acórdão OR despacho)`,
      url: `https://www.google.com/search?q=${encodeURIComponent(`filetype:pdf "${numeroFormatado}" (sentença OR acórdão OR despacho)`)}`,
    },
  ];

  return { linksDiretos, dorks };
}

/**
 * Gera Dorks especializados para busca por nome de advogado ou parte
 */
export function gerarDorksPorNome(nome) {
  const n = String(nome || '').trim();
  return [
    {
      titulo: 'Processos no Jusbrasil por Nome',
      query: `site:jusbrasil.com.br/processos/nome "${n}"`,
      url: `https://www.google.com/search?q=${encodeURIComponent(`site:jusbrasil.com.br/processos/nome "${n}"`)}`,
    },
    {
      titulo: 'Perfil e Ações no Escavador',
      query: `site:escavador.com/nomes "${n}"`,
      url: `https://www.google.com/search?q=${encodeURIComponent(`site:escavador.com/nomes "${n}"`)}`,
    },
    {
      titulo: 'Citações e Intimações no DJEN (Comunicação Eletrônica)',
      query: `site:comunica.pje.jus.br "${n}"`,
      url: `https://www.google.com/search?q=${encodeURIComponent(`site:comunica.pje.jus.br "${n}"`)}`,
    },
    {
      titulo: 'Diários de Justiça Estaduais (DJE)',
      query: `site:dje.*.jus.br "${n}"`,
      url: `https://www.google.com/search?q=${encodeURIComponent(`site:dje.*.jus.br "${n}"`)}`,
    },
    {
      titulo: 'Diário Oficial da União (DOU)',
      query: `site:in.gov.br "${n}"`,
      url: `https://www.google.com/search?q=${encodeURIComponent(`site:in.gov.br "${n}"`)}`,
    },
  ];
}

/**
 * Normaliza os dados retornados do DataJud para a visualização no RimuBusca
 */
export function normalizarDadosDataJud(rawSource, decodificado) {
  const dadosBasicos = rawSource.dadosBasicos || {};
  const movimentosRaw = rawSource.movimentos || [];

  // Polos e Partes
  const poloAtivo = [];
  const poloPassivo = [];
  const outrosInteressados = [];

  const polos = dadosBasicos.polo || [];
  polos.forEach((polo) => {
    const poloTipo = (polo.polo || '').toUpperCase();
    const partes = polo.parte || [];

    partes.forEach((p) => {
      const pessoa = p.pessoa || {};
      const advogados = (p.advogado || []).map((adv) => ({
        nome: adv.nome || 'Advogado',
        oab: adv.numeroOAB ? `${adv.numeroOAB}/${adv.ufOAB || ''}` : null,
      }));

      const itemParte = {
        nome: pessoa.nome || 'Parte sob Segredo de Justiça / Não Informado',
        tipoPessoa: pessoa.tipoPessoa || 'Física',
        documento: pessoa.numeroDocumentoPrincipal ? mascararDocumento(pessoa.numeroDocumentoPrincipal) : null,
        advogados,
      };

      if (poloTipo === 'AT' || poloTipo === 'A' || poloTipo.includes('ATIVO')) {
        poloAtivo.push(itemParte);
      } else if (poloTipo === 'PA' || poloTipo === 'P' || poloTipo.includes('PASSIVO')) {
        poloPassivo.push(itemParte);
      } else {
        outrosInteressados.push(itemParte);
      }
    });
  });

  // Movimentações Processuais (Linha do Tempo)
  const movimentacoes = movimentosRaw.map((m) => {
    const complemento = (m.complementosTabelados || [])
      .map((c) => c.descricao || c.nome)
      .filter(Boolean)
      .join(' - ');

    return {
      codigo: m.codigo,
      nome: m.nome || 'Movimentação Processual',
      dataHora: m.dataHora || null,
      dataFormatada: m.dataHora ? formatarDataIso(m.dataHora) : 'Data não informada',
      complemento: complemento || null,
    };
  });

  // Ordena por data mais recente no topo
  movimentacoes.sort((a, b) => new Date(b.dataHora || 0) - new Date(a.dataHora || 0));

  // Situação do Processo
  let situacao = 'Em Andamento';
  const ultimaMov = movimentacoes[0]?.nome?.toLowerCase() || '';
  if (ultimaMov.includes('arquiva') || ultimaMov.includes('baixa')) {
    situacao = 'Arquivado';
  } else if (ultimaMov.includes('sentença') || ultimaMov.includes('julgado') || ultimaMov.includes('acórdão')) {
    situacao = 'Julgado';
  } else if (ultimaMov.includes('suspens') || ultimaMov.includes('sobrest')) {
    situacao = 'Suspenso';
  }

  // Valor da causa formatado
  const valorCausaNum = dadosBasicos.valorCausa;
  const valorCausaFormatado = valorCausaNum
    ? Number(valorCausaNum).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : 'Não informado';

  return {
    numeroProcesso: decodificado.formatado,
    numeroLimpo: decodificado.limpo,
    classe: dadosBasicos.classe?.nome || 'Procedimento Judicial',
    assuntos: (dadosBasicos.assunto || []).map((a) => a.nome || 'Assunto Geral'),
    orgaoJulgador: dadosBasicos.orgaoJulgador?.nome || `${decodificado.partes.tribunalSigla} - Vara de Origem ${decodificado.partes.origemForo}`,
    comarca: dadosBasicos.orgaoJulgador?.municipio || decodificado.partes.tribunalUf,
    grau: dadosBasicos.grau || 'G1 (1º Grau)',
    formato: dadosBasicos.formato?.nome || 'Processo Eletrônico (PJe/e-SAJ)',
    sistema: dadosBasicos.sistema?.nome || 'Sistema Eletrônico do Tribunal',
    dataAjuizamento: dadosBasicos.dataAjuizamento ? formatarDataIso(dadosBasicos.dataAjuizamento) : `${decodificado.partes.ano}`,
    valorCausa: valorCausaFormatado,
    situacao,
    polos: {
      poloAtivo,
      poloPassivo,
      outrosInteressados,
    },
    totalMovimentacoes: movimentacoes.length,
    movimentacoes,
    fonte: 'DataJud CNJ (Base Nacional Oficial do Poder Judiciário)',
    statusDataJud: 'Dados oficiais sincronizados diretamente com os servidores do CNJ.',
    metadadosCnj: decodificado.partes,
  };
}

/**
 * Cria a estrutura detalhada a partir da decodificação matemática do CNJ
 * quando o tribunal está sob sigilo ou a API pública DataJud está indisponível.
 */
export function gerarFichaAnaliticaCNJ(decodificado, statusMensagem = null) {
  const { partes, formatado, limpo } = decodificado;

  return {
    numeroProcesso: formatado,
    numeroLimpo: limpo,
    classe: 'Processo Judicial (Consulta por Metadados CNJ)',
    assuntos: ['Identificação e Rastreamento Processual'],
    orgaoJulgador: `${partes.tribunalSigla} - Foro de Código ${partes.origemForo}`,
    comarca: `Circunscrição / Comarca do Estado de ${partes.tribunalUf}`,
    grau: '1º Grau (Vara de Origem)',
    formato: 'Processo Judicial Eletrônico',
    sistema: partes.tribunalSigla === 'TJSP' ? 'e-SAJ (Tribunal de Justiça de SP)' : 'PJe / Eproc',
    dataAjuizamento: `Ano de Distribuição: ${partes.ano}`,
    valorCausa: 'Consulte o link do tribunal para valores pecuniários',
    situacao: 'Distribuído / Em Andamento',
    statusDataJud: statusMensagem || 'A API Pública do DataJud CNJ está temporariamente indisponível. Exibindo metadados analíticos e links diretos.',
    polos: {
      poloAtivo: [
        {
          nome: 'Consulte os links diretos dos Diários Oficiais e Jusbrasil',
          tipoPessoa: 'Identificação Externa',
          documento: null,
          advogados: [],
        },
      ],
      poloPassivo: [
        {
          nome: 'Consulte os links diretos dos Diários Oficiais e Jusbrasil',
          tipoPessoa: 'Identificação Externa',
          documento: null,
          advogados: [],
        },
      ],
      outrosInteressados: [],
    },
    totalMovimentacoes: 0,
    movimentacoes: [],
    fonte: 'Metadados Analíticos do Padrão CNJ & Resolução 65/2008',
    metadadosCnj: partes,
  };
}

