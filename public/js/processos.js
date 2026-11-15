/**
 * ==============================================================================
 * RIMUBUSCA - PROCESSOS JUDICIAIS & MONITORAMENTO (PROCESSOS.JS)
 * Controlador de frontend para busca no DataJud (CNJ), raspador de inteligência
 * do Escavador para advogados/partes, decodificação CNJ, Dorks e autos completos.
 * ==============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('formProcessos');
  const inputTermo = document.getElementById('inputTermoProcesso');
  const btnSubmit = document.getElementById('btnSubmitProcesso');
  const lblInputBusca = document.getElementById('lblInputBusca');
  const skeleton = document.getElementById('processoSkeleton');
  const containerResultados = document.getElementById('containerResultadosProcesso');
  const tipoTabs = document.querySelectorAll('.tipo-tab-btn');
  const demoChips = document.querySelectorAll('.demo-chip-btn');

  // Containers de Visualização
  const topCardProcessoCnj = document.getElementById('topCardProcessoCnj');
  const topCardPerfilParte = document.getElementById('topCardPerfilParte');
  const secaoProcessoCnj = document.getElementById('secaoProcessoCnj');
  const secaoPerfilParte = document.getElementById('secaoPerfilParte');

  // Estado atual
  let tipoAtual = 'cnj';
  let ultimoResultado = null;

  // Sanitizador HTML
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // 1. Alternador de Abas de Tipo de Busca
  tipoTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tipoTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      tipoAtual = tab.dataset.tipo || 'cnj';

      if (tipoAtual === 'cnj') {
        lblInputBusca.textContent = 'Número Único do Processo no Padrão CNJ';
        inputTermo.placeholder = '0001234-08.2023.8.26.0100';
      } else if (tipoAtual === 'nome') {
        lblInputBusca.textContent = 'Nome Completo da Parte, Empresa ou Advogado';
        inputTermo.placeholder = 'Ex: Rafael Toniato Rodrigues ou Razão Social';
      } else if (tipoAtual === 'documento') {
        lblInputBusca.textContent = 'Número de CPF ou CNPJ do Envolvido';
        inputTermo.placeholder = '000.000.000-00 ou 00.000.000/0001-00';
      } else if (tipoAtual === 'oab') {
        lblInputBusca.textContent = 'Número de Inscrição da OAB com Estado (UF)';
        inputTermo.placeholder = 'Ex: 123456/SP ou SP123456';
      }

      inputTermo.value = '';
      inputTermo.focus();
    });
  });

  // 2. Máscara dinâmica inteligente para CNJ / CPF / CNPJ / OAB
  inputTermo.addEventListener('input', (e) => {
    if (tipoAtual === 'cnj') {
      let v = e.target.value.replace(/\D/g, '').slice(0, 20);
      if (v.length > 7 && v.length <= 9) {
        v = `${v.slice(0, 7)}-${v.slice(7)}`;
      } else if (v.length > 9 && v.length <= 13) {
        v = `${v.slice(0, 7)}-${v.slice(7, 9)}.${v.slice(9)}`;
      } else if (v.length > 13 && v.length <= 14) {
        v = `${v.slice(0, 7)}-${v.slice(7, 9)}.${v.slice(9, 13)}.${v.slice(13)}`;
      } else if (v.length > 14 && v.length <= 16) {
        v = `${v.slice(0, 7)}-${v.slice(7, 9)}.${v.slice(9, 13)}.${v.slice(13, 14)}.${v.slice(14)}`;
      } else if (v.length > 16) {
        v = `${v.slice(0, 7)}-${v.slice(7, 9)}.${v.slice(9, 13)}.${v.slice(13, 14)}.${v.slice(14, 16)}.${v.slice(16, 20)}`;
      }
      e.target.value = v;
    } else if (tipoAtual === 'documento') {
      let v = e.target.value.replace(/\D/g, '').slice(0, 14);
      if (v.length <= 11) {
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
      } else {
        v = v.replace(/^(\d{2})(\d)/, '$1.$2');
        v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
        v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
        v = v.replace(/(\d{4})(\d)/, '$1-$2');
      }
      e.target.value = v;
    } else if (tipoAtual === 'oab') {
      let v = e.target.value.toUpperCase().replace(/[^0-9A-Z\/]/g, '').slice(0, 12);
      e.target.value = v;
    }
  });

  // 3. Chips de Exemplo Rápido
  demoChips.forEach((btn) => {
    btn.addEventListener('click', () => {
      const termo = btn.dataset.termo;
      const tipo = btn.dataset.tipo;

      const targetTab = Array.from(tipoTabs).find((t) => t.dataset.tipo === tipo);
      if (targetTab) targetTab.click();

      inputTermo.value = termo;
      form.dispatchEvent(new Event('submit'));
    });
  });

  // 4. Envio do Formulário e Chamada à API
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const termo = inputTermo.value.trim();
    if (!termo || termo.length < 2) {
      window.toast?.error('Por favor, informe um termo de busca válido.');
      inputTermo.focus();
      return;
    }

    btnSubmit.disabled = true;
    skeleton.style.display = 'block';
    containerResultados.style.display = 'none';

    try {
      const response = await window.api.post('/api/processos/consultar', {
        termo,
        tipo: tipoAtual,
      });

      if (response && response.success && response.data) {
        ultimoResultado = response.data;
        renderizarResultadosProcesso(response.data);
        containerResultados.style.display = 'block';
        window.toast?.success('Dados processuais recuperados com sucesso!');
        containerResultados.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.toast?.error(response.error || 'Nenhum registro localizado para o termo informado.');
      }
    } catch (err) {
      console.error('[ERRO CLIENTE PROCESSOS]:', err);
      window.toast?.error(err.message || 'Falha ao consultar a base processual.');
    } finally {
      btnSubmit.disabled = false;
      skeleton.style.display = 'none';
    }
  });

  // 5. Roteamento de Renderização (CNJ vs Parte/Advogado)
  function renderizarResultadosProcesso(data) {
    const isParte = data.escavador || data.tipo === 'Nome de Parte / Advogado' || !data.numeroProcesso;

    if (isParte) {
      if (topCardProcessoCnj) topCardProcessoCnj.style.display = 'none';
      if (topCardPerfilParte) topCardPerfilParte.style.display = 'block';
      if (secaoProcessoCnj) secaoProcessoCnj.style.display = 'none';
      if (secaoPerfilParte) secaoPerfilParte.style.display = 'block';

      renderizarPerfilParte(data);
    } else {
      if (topCardProcessoCnj) topCardProcessoCnj.style.display = 'block';
      if (topCardPerfilParte) topCardPerfilParte.style.display = 'none';
      if (secaoProcessoCnj) secaoProcessoCnj.style.display = 'block';
      if (secaoPerfilParte) secaoPerfilParte.style.display = 'none';

      renderizarDetalhesCnj(data);
    }

    // Renderiza os Dorks Jurídicos (Comum a ambos)
    renderizarDorks(data.dorks || []);

    // Recria ícones Lucide
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  // 5.1 Renderização do Perfil de Advogado / Parte (Escavador & Acervo)
  function renderizarPerfilParte(data) {
    const esc = data.escavador || {};
    const nome = esc.nome || data.termo || 'Advogado / Parte';

    // Top Card Perfil
    document.getElementById('resNomeParte').textContent = nome;
    document.getElementById('badgeTotalProcessosParte').textContent = `${esc.totalProcessos || 0} Processos`;

    const linkEsc = document.getElementById('linkPerfilEscavador');
    const linkJus = document.getElementById('linkPerfilJusbrasil');
    if (linkEsc) linkEsc.href = esc.url || data.linksDiretos?.escavador || `https://www.escavador.com/busca?q=${encodeURIComponent(nome)}`;
    if (linkJus) linkJus.href = data.linksDiretos?.jusbrasil || `https://www.jusbrasil.com.br/busca?q=${encodeURIComponent(nome)}`;

    // KPI 1: Total de Processos
    document.getElementById('kpiTotalProcessos').textContent = esc.totalProcessos || '0';

    // KPI 2: Atuação Predominante
    const kpiAtuacao = document.getElementById('kpiAtuacaoPredominante');
    const kpiAtuacaoSub = document.getElementById('kpiAtuacaoSub');
    if (esc.polosAtuacao && esc.polosAtuacao.length > 0) {
      kpiAtuacao.textContent = esc.polosAtuacao.map((p) => `${p.papel} (${p.percentual}%)`).join(' • ');
      kpiAtuacaoSub.textContent = 'Distribuição percentual de atuação';
    } else {
      kpiAtuacao.textContent = 'Geral';
      kpiAtuacaoSub.textContent = 'Acervo em Diários Oficiais';
    }

    // KPI 3: Pessoa Mais Representada
    const kpiRep = document.getElementById('kpiPessoaRepresentada');
    kpiRep.textContent = esc.pessoaMaisRepresentada || 'Não informada';

    // KPI 4: Estados
    const kpiEst = document.getElementById('kpiEstadosAtuacao');
    if (esc.estados && esc.estados.length > 0) {
      kpiEst.textContent = esc.estados.map((e) => `${e.estado} (${e.total})`).join(', ');
    } else {
      kpiEst.textContent = 'Nacional';
    }

    // Resumo Oficial
    const elResumo = document.getElementById('resResumoParteTexto');
    if (esc.resumo || esc.descricaoGeral) {
      elResumo.textContent = esc.resumo || esc.descricaoGeral;
    } else {
      elResumo.textContent = `Apontamentos judiciais localizados nos Diários Oficiais para ${nome}. Consulte os links oficiais e dorks abaixo para investigações complementares.`;
    }

    // Principais Assuntos
    const containerAssuntos = document.getElementById('resAssuntosParteContainer');
    const wrapperAssuntos = document.getElementById('containerAssuntosParteWrapper');
    if (esc.assuntos && esc.assuntos.length > 0) {
      wrapperAssuntos.style.display = 'block';
      containerAssuntos.innerHTML = esc.assuntos
        .map(
          (a) => `
          <span class="assunto-pill">
            <i data-lucide="tag" style="width: 12px; height: 12px; color: var(--color-primary);"></i>
            <span>${escapeHtml(a)}</span>
          </span>
        `
        )
        .join('');
    } else {
      wrapperAssuntos.style.display = 'none';
    }

    // Processos Recentes com Detalhes Ricos
    const containerProcessos = document.getElementById('resProcessosRecentesContainer');
    const badgeQtdProc = document.getElementById('badgeQtdProcessosRecentes');
    const procs = esc.processosRecentes || [];
    badgeQtdProc.textContent = `${procs.length} Registros`;

    if (procs.length > 0) {
      containerProcessos.innerHTML = procs
        .map((p, index) => {
          const cnjExibicao = p.cnjReal || p.cnj || 'Processo em Diário Oficial';
          const envolvidosTexto = p.envolvidos && p.envolvidos.length > 0 ? p.envolvidos.join(' • ') : '';
          const foroInfo = p.detalhes?.forum ? `${p.detalhes.forum} (${p.detalhes.comarca || ''})` : '';

          return `
            <div class="processo-recent-card" data-index="${index}">
              <div style="flex: 1; min-width: 280px;">
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px;">
                  <span class="badge ${p.status && p.status.toLowerCase().includes('ativo') ? 'badge-purple' : 'badge-dark'}">
                    ${escapeHtml(p.status || 'Processo Ativo')}
                  </span>
                  <span class="badge badge-red">${escapeHtml(p.origem || 'DJ')}</span>
                  <span class="badge badge-dark">${escapeHtml(p.instancia || '1º Grau')}</span>
                  ${p.cnjReal ? `<span class="badge badge-purple" style="color: var(--color-success); border-color: rgba(34, 197, 94, 0.3);">CNJ Revelado</span>` : ''}
                </div>

                <div style="font-weight: 700; color: var(--color-text); font-size: 1.05rem; font-family: var(--font-mono); display: flex; align-items: center; gap: 8px;">
                  <span>${escapeHtml(cnjExibicao)}</span>
                  <button type="button" class="btn btn-secondary btn-sm btn-copiar-cnj-item" data-cnj="${escapeHtml(cnjExibicao)}" title="Copiar CNJ" style="padding: 2px 6px;">
                    <i data-lucide="copy" style="width: 12px; height: 12px;"></i>
                  </button>
                </div>

                <div style="font-size: 0.8rem; color: var(--color-text-dim); margin-top: 4px; display: flex; flex-direction: column; gap: 2px;">
                  <div>
                    <strong>Papel:</strong> <span style="color: var(--color-primary);">${escapeHtml(p.papel || 'Advogado')}</span>
                    ${p.dataInicio ? `• Iniciado em ${escapeHtml(p.dataInicio)}` : ''}
                    ${p.ultimaMovimentacao ? `• Última movimentação: ${escapeHtml(p.ultimaMovimentacao)}` : ''}
                  </div>
                  ${foroInfo ? `<div><strong>Fórum:</strong> ${escapeHtml(foroInfo)}</div>` : ''}
                  ${envolvidosTexto ? `<div><strong>Partes:</strong> ${escapeHtml(envolvidosTexto)}</div>` : ''}
                </div>
              </div>

              <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                <button type="button" class="btn btn-primary btn-sm btn-ver-detalhes-processo" data-index="${index}" style="font-size: 0.75rem;">
                  <i data-lucide="file-text" style="width: 13px; height: 13px;"></i>
                  Ver Andamentos & Autos
                </button>
                ${
                  p.cnjReal || (p.cnj && !p.cnj.includes('XXXX'))
                    ? `
                  <button type="button" class="btn btn-secondary btn-sm btn-pesquisar-cnj-recent" data-cnj="${escapeHtml(p.cnjReal || p.cnj)}" title="Consultar na API Oficial do DataJud">
                    <i data-lucide="search" style="width: 13px; height: 13px;"></i>
                    DataJud
                  </button>
                `
                    : ''
                }
                ${
                  p.url
                    ? `
                  <a href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" title="Abrir publicação original">
                    <i data-lucide="external-link" style="width: 13px; height: 13px;"></i>
                  </a>
                `
                    : ''
                }
              </div>
            </div>
          `;
        })
        .join('');

      // Clique em "Ver Andamentos & Autos"
      document.querySelectorAll('.btn-ver-detalhes-processo').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const idx = Number(btn.dataset.index);
          const proc = procs[idx];
          if (proc) {
            await abrirModalDetalhesProcesso(proc);
          }
        });
      });

      // Clique em "DataJud" (Pesquisa pelo número real)
      document.querySelectorAll('.btn-pesquisar-cnj-recent').forEach((btn) => {
        btn.addEventListener('click', () => {
          const cnj = btn.dataset.cnj;
          if (cnj) {
            const targetTab = Array.from(tipoTabs).find((t) => t.dataset.tipo === 'cnj');
            if (targetTab) targetTab.click();
            inputTermo.value = cnj;
            form.dispatchEvent(new Event('submit'));
          }
        });
      });

      // Copiar CNJ individual
      document.querySelectorAll('.btn-copiar-cnj-item').forEach((btn) => {
        btn.addEventListener('click', () => {
          const c = btn.dataset.cnj;
          if (c) window.copyToClipboard(c, 'Número de processo copiado!');
        });
      });
    } else {
      containerProcessos.innerHTML = `
        <div style="background: var(--color-surface-2); border: 1px dashed var(--color-border); border-radius: var(--radius-md); padding: var(--space-4); text-align: center;">
          <p style="font-size: 0.85rem; color: var(--color-text-muted); margin: 0;">
            Ações individuais sob segredo de justiça ou não detalhadas publicamente no acervo simplificado.
          </p>
          <p style="font-size: 0.75rem; color: var(--color-text-dim); margin-top: 4px;">
            Execute os Dorks jurídicos abaixo para buscar publicações nos Diários de Justiça Estaduais (DJE) e Federal (DOU).
          </p>
        </div>
      `;
    }
  }

  // 5.1.1 Abertura do Modal de Detalhes do Processo Judicial
  async function abrirModalDetalhesProcesso(proc) {
    const modal = document.getElementById('modalDetalhesProcesso');
    if (!modal) return;

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Se os detalhes já vieram pré-carregados do backend
    if (proc.detalhes && proc.detalhes.sucesso) {
      preencherModalDetalhes(proc.detalhes, proc);
      return;
    }

    // Caso contrário, mostra loading e consulta via endpoint /api/processos/detalhes
    document.getElementById('modalProcessoNumeroCnj').textContent = proc.cnj || 'Carregando...';
    document.getElementById('modalProcessoClasse').textContent = 'Buscando publicação e andamentos judiciais...';
    document.getElementById('modalProcessoVara').textContent = 'Carregando...';
    document.getElementById('modalProcessoComarca').textContent = 'Carregando...';
    document.getElementById('modalProcessoJuiz').textContent = 'Carregando...';
    document.getElementById('modalProcessoData').textContent = proc.ultimaMovimentacao || '-';
    document.getElementById('modalProcessoPoloAtivo').textContent = 'Carregando...';
    document.getElementById('modalProcessoPoloPassivo').textContent = 'Carregando...';
    document.getElementById('modalProcessoAdvogado').textContent = 'Carregando...';
    document.getElementById('modalProcessoTextoDecisao').textContent = 'Carregando publicação judicial oficial...';

    try {
      const res = await window.api.post('/api/processos/detalhes', { url: proc.url });
      if (res && res.success && res.data) {
        proc.detalhes = res.data;
        proc.detalhesCarregados = true;
        if (res.data.desmascarado && res.data.numeroCnj) {
          proc.cnjReal = res.data.numeroCnj;
        }
        preencherModalDetalhes(res.data, proc);
      } else {
        document.getElementById('modalProcessoTextoDecisao').textContent = res.error || 'Detalhes do processo indisponíveis no momento.';
      }
    } catch (err) {
      document.getElementById('modalProcessoTextoDecisao').textContent = `Falha ao carregar detalhes: ${err.message}`;
    }
  }

  function preencherModalDetalhes(det, proc) {
    const cnj = det.numeroCnj || proc.cnj || 'Processo Judicial';
    document.getElementById('modalProcessoNumeroCnj').textContent = cnj;
    document.getElementById('modalProcessoClasse').textContent = det.classe || proc.titulo || 'Processo Judicial';
    document.getElementById('modalProcessoBadgeStatus').textContent = proc.status || 'Processo Ativo';
    document.getElementById('modalProcessoBadgeTribunal').textContent = det.tribunal || proc.origem || 'DJ';

    const badgeDesm = document.getElementById('modalProcessoBadgeDesmascarado');
    if (det.desmascarado) {
      badgeDesm.style.display = 'inline-flex';
    } else {
      badgeDesm.style.display = 'none';
    }

    document.getElementById('modalProcessoVara').textContent = det.vara || proc.instancia || '-';
    document.getElementById('modalProcessoComarca').textContent = det.comarca ? `${det.forum || ''} (${det.comarca})` : det.forum || '-';
    document.getElementById('modalProcessoJuiz').textContent = det.partes?.magistrado || 'Não informado na publicação';
    document.getElementById('modalProcessoData').textContent = det.ultimaMovimentacao?.data || det.dataCriacao || proc.ultimaMovimentacao || '-';

    document.getElementById('modalProcessoPoloAtivo').textContent = det.partes?.poloAtivo || (proc.envolvidos ? proc.envolvidos[0] : 'Consultar autos');
    document.getElementById('modalProcessoPoloPassivo').textContent = det.partes?.poloPassivo || (proc.envolvidos && proc.envolvidos.length > 1 ? proc.envolvidos[1] : 'Consultar autos');
    document.getElementById('modalProcessoAdvogado').textContent = det.partes?.advogados && det.partes.advogados.length > 0 ? det.partes.advogados.join(', ') : proc.papel === 'Advogado' ? proc.nome || 'Advogado constituído' : '-';

    const textoDecisao = det.ultimaMovimentacao?.textoIntegral || 'Nenhum texto de despacho ou sentença publicado no recorte.';
    document.getElementById('modalProcessoTextoDecisao').textContent = textoDecisao;

    // Resumo IA BuscaProcessos no Modal
    const modalResumoBox = document.getElementById('modalProcessoResumoIaBox');
    const modalResumoTexto = document.getElementById('modalProcessoResumoIaTexto');
    const resumoIa = det.resumoIa || proc.resumoIa || proc.detalhes?.resumoIa;
    if (modalResumoBox && modalResumoTexto) {
      if (resumoIa) {
        modalResumoBox.style.display = 'block';
        modalResumoTexto.textContent = resumoIa;
      } else {
        modalResumoBox.style.display = 'none';
      }
    }

    // Link do Tribunal
    const linkEsc = document.getElementById('linkModalProcessoEscavador');
    if (linkEsc) linkEsc.href = det.url || proc.url || '#';

    // Botão de Consultar no DataJud dentro do modal
    const btnCnjDatajud = document.getElementById('btnConsultarCnjModalNoDataJud');
    if (btnCnjDatajud) {
      btnCnjDatajud.onclick = () => {
        fecharModalDetalhes();
        const targetTab = Array.from(tipoTabs).find((t) => t.dataset.tipo === 'cnj');
        if (targetTab) targetTab.click();
        inputTermo.value = cnj;
        form.dispatchEvent(new Event('submit'));
      };
    }

    // Botão de Copiar CNJ no Modal
    document.getElementById('btnCopiarCnjModalDetalhes').onclick = () => {
      window.copyToClipboard(cnj, 'Número CNJ copiado!');
    };

    // Botão de Copiar Decisão
    document.getElementById('btnCopiarTextoDecisaoModal').onclick = () => {
      window.copyToClipboard(textoDecisao, 'Decisão judicial copiada!');
    };

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  // 5.2 Renderização Detalhada do Processo CNJ (DataJud)
  function renderizarDetalhesCnj(data) {
    document.getElementById('resNumeroCnj').textContent = data.numeroProcesso || data.termo;
    document.getElementById('resClasseAssunto').textContent = `${data.classe || 'Processo Judicial'} • ${Array.isArray(data.assuntos) ? data.assuntos.join(', ') : data.assuntos || 'Assunto Geral'}`;

    // Aviso do Status DataJud
    const elAvisoDataJud = document.getElementById('resDataJudAviso');
    const elAvisoDataJudTexto = document.getElementById('resDataJudAvisoTexto');
    if (elAvisoDataJud && elAvisoDataJudTexto) {
      if (data.statusDataJud) {
        elAvisoDataJud.style.display = 'block';
        elAvisoDataJudTexto.textContent = data.statusDataJud;
      } else {
        elAvisoDataJud.style.display = 'none';
      }
    }

    // Resumo IA Executivo (BuscaProcessos)
    const boxResumoIa = document.getElementById('resumoIaBox');
    const textoResumoIa = document.getElementById('resumoIaTexto');
    if (boxResumoIa && textoResumoIa) {
      if (data.resumoIa) {
        boxResumoIa.style.display = 'block';
        textoResumoIa.textContent = data.resumoIa;
      } else {
        boxResumoIa.style.display = 'none';
      }
    }

    const badgeSituacao = document.getElementById('badgeSituacaoProcesso');
    badgeSituacao.textContent = data.situacao || 'Em Andamento';
    if (data.situacao === 'Arquivado') {
      badgeSituacao.className = 'badge badge-dark';
    } else if (data.situacao === 'Julgado') {
      badgeSituacao.className = 'badge badge-red';
    } else {
      badgeSituacao.className = 'badge badge-purple';
    }

    document.getElementById('badgeTribunalSigla').textContent = data.metadadosCnj?.tribunalSigla || 'TRIBUNAL';
    document.getElementById('badgeRamoJustica').textContent = data.metadadosCnj?.ramoNome || 'Poder Judiciário';

    // Badge DV Validação Módulo 97
    const badgeDv = document.getElementById('badgeDvValido');
    if (data.validacaoCnj) {
      badgeDv.style.display = 'inline-flex';
      if (data.validacaoCnj.valido) {
        badgeDv.textContent = 'CNJ Módulo 97 Autêntico';
        badgeDv.style.color = 'var(--color-success)';
        badgeDv.style.borderColor = 'rgba(34, 197, 94, 0.3)';
      } else {
        badgeDv.textContent = data.validacaoCnj.motivo || 'DV Alerta';
        badgeDv.style.color = 'var(--color-secondary)';
        badgeDv.style.borderColor = 'rgba(239, 68, 68, 0.3)';
      }
    } else {
      badgeDv.style.display = 'none';
    }

    // Links Oficiais
    const linkPortal = document.getElementById('linkPortalTribunal');
    const linkJusbrasil = document.getElementById('linkJusbrasil');
    const linkEscavador = document.getElementById('linkEscavador');

    linkPortal.href = data.linksDiretos?.eSajConsulta || data.linksDiretos?.tribunalOrigem || '#';
    linkJusbrasil.href = data.linksDiretos?.jusbrasil || '#';
    linkEscavador.href = data.linksDiretos?.escavador || '#';

    // Ficha Técnica
    document.getElementById('resOrgaoJulgador').textContent = data.orgaoJulgador || '-';
    document.getElementById('resComarca').textContent = data.comarca || '-';
    document.getElementById('resDataDistribuicao').textContent = data.dataAjuizamento || '-';
    document.getElementById('resValorCausa').textContent = data.valorCausa || 'Não informado';
    document.getElementById('resGrau').textContent = data.grau || '1º Grau';
    document.getElementById('resSistema').textContent = data.sistema || 'Processo Eletrônico';

    // Partes (Polo Ativo & Passivo)
    const containerAtivo = document.getElementById('resPoloAtivoContainer');
    const containerPassivo = document.getElementById('resPoloPassivoContainer');

    const poloAtivo = data.polos?.poloAtivo || [];
    if (poloAtivo.length > 0) {
      containerAtivo.innerHTML = poloAtivo.map((p) => renderParteItem(p, 'Autor / Requerente')).join('');
    } else {
      containerAtivo.innerHTML = '<div style="font-size: 0.8rem; color: var(--color-text-dim); padding: 4px 0;">Nenhuma parte ativa especificada</div>';
    }

    const poloPassivo = data.polos?.poloPassivo || [];
    if (poloPassivo.length > 0) {
      containerPassivo.innerHTML = poloPassivo.map((p) => renderParteItem(p, 'Réu / Requerido')).join('');
    } else {
      containerPassivo.innerHTML = '<div style="font-size: 0.8rem; color: var(--color-text-dim); padding: 4px 0;">Nenhuma parte passiva especificada</div>';
    }

    // Linha do Tempo (Movimentações)
    const containerTimeline = document.getElementById('resMovimentacoesTimeline');
    const badgeTotalMovs = document.getElementById('badgeTotalMovs');
    const movs = data.movimentacoes || [];

    badgeTotalMovs.textContent = `${movs.length} Registros`;

    if (movs.length > 0) {
      containerTimeline.innerHTML = movs
        .map(
          (m) => `
          <div class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <div class="timeline-date">${escapeHtml(m.dataFormatada)}</div>
              <div class="timeline-title">${escapeHtml(m.nome)}</div>
              ${m.complemento ? `<div class="timeline-desc">${escapeHtml(m.complemento)}</div>` : ''}
            </div>
          </div>
        `
        )
        .join('');
    } else {
      containerTimeline.innerHTML = `
        <div style="background: var(--color-surface-2); border: 1px dashed var(--color-border); border-radius: var(--radius-md); padding: var(--space-4); text-align: center;">
          <i data-lucide="info" style="width: 24px; height: 24px; color: var(--color-primary); margin-bottom: 8px;"></i>
          <p style="font-size: 0.85rem; color: var(--color-text-muted); margin: 0;">
            Movimentações detalhadas não indexadas nesta requisição.
          </p>
          <p style="font-size: 0.75rem; color: var(--color-text-dim); margin-top: 4px;">
            Clique nos botões acima para consultar o histórico completo em tempo real no <strong>Portal do Tribunal</strong> ou no <strong>Jusbrasil</strong>.
          </p>
        </div>
      `;
    }
  }

  // 5.3 Renderização de Dorks Jurídicos (Padrão: Oculto se não ativado nas configurações)
  function renderizarDorks(dorks) {
    const dorksContainer = document.getElementById('resDorksProcessosContainer');
    if (!dorksContainer) return;

    const cardDorks = document.getElementById('cardDorksProcessos') || dorksContainer.closest('.card');
    const showDorksPref = window.rimuSettings ? window.rimuSettings.showGoogleDorks : (localStorage.getItem('rimu_pref_show_google_dorks') === 'true');

    if (cardDorks) {
      cardDorks.style.display = showDorksPref ? 'block' : 'none';
    }

    if (!showDorksPref) return;

    if (dorks.length > 0) {
      dorksContainer.innerHTML = dorks
        .map(
          (d) => `
          <div class="dork-item">
            <div class="dork-title">
              <span>${escapeHtml(d.titulo)}</span>
            </div>
            <div class="dork-query" title="${escapeHtml(d.query)}">${escapeHtml(d.query)}</div>
            <div class="dork-actions">
              <a href="${escapeHtml(d.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="flex: 1; justify-content: center; font-size: 0.75rem;">
                <i data-lucide="external-link" style="width: 12px; height: 12px;"></i>
                Executar Dork
              </a>
              <button type="button" class="btn btn-secondary btn-sm btn-copiar-dork-proc" data-query="${encodeURIComponent(d.query)}" title="Copiar query">
                <i data-lucide="copy" style="width: 12px; height: 12px;"></i>
              </button>
            </div>
          </div>
        `
        )
        .join('');

      document.querySelectorAll('.btn-copiar-dork-proc').forEach((btn) => {
        btn.addEventListener('click', () => {
          const q = decodeURIComponent(btn.dataset.query || '');
          window.copyToClipboard(q, 'Dork jurídica copiada para a área de transferência!');
        });
      });
    } else {
      dorksContainer.innerHTML = '<div style="color: var(--color-text-muted); font-size: 0.8rem;">Nenhuma dork gerada.</div>';
    }
  }

  function renderParteItem(parte, papelPadrao) {
    const advs = (parte.advogados || []).map((a) => `${escapeHtml(a.nome)}${a.oab ? ` (${escapeHtml(a.oab)})` : ''}`).join(', ');

    return `
      <div class="parte-item">
        <div class="parte-nome">${escapeHtml(parte.nome)}</div>
        <div class="parte-sub">
          <span>${parte.documento ? `Doc: ${escapeHtml(parte.documento)} • ` : ''}Tipo: ${escapeHtml(parte.tipoPessoa || 'Física')}</span>
          ${advs ? `<div style="color: var(--color-primary); margin-top: 2px;">Adv: ${advs}</div>` : ''}
        </div>
      </div>
    `;
  }

  // 6. Botões de Copiar (CNJ e Nome)
  document.getElementById('btnCopiarCnj')?.addEventListener('click', () => {
    if (ultimoResultado?.numeroProcesso) {
      window.copyToClipboard(ultimoResultado.numeroProcesso, 'Número CNJ copiado!');
    }
  });

  document.getElementById('btnCopiarNomeParte')?.addEventListener('click', () => {
    const nome = document.getElementById('resNomeParte')?.textContent;
    if (nome && nome !== '-') {
      window.copyToClipboard(nome, 'Nome copiado!');
    }
  });

  // 7. Modais (Fechamento, ESC e Ações)
  const modalDetalhes = document.getElementById('modalDetalhesProcesso');
  const modalJson = document.getElementById('modalJsonProcesso');

  function fecharModalDetalhes() {
    if (modalDetalhes) {
      modalDetalhes.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  function fecharModalJson() {
    if (modalJson) {
      modalJson.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  // Fechar Modal Detalhes no X e no Rodapé
  document.getElementById('btnFecharModalProcessoX')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    fecharModalDetalhes();
  });

  document.getElementById('btnFecharModalProcessoFooter')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    fecharModalDetalhes();
  });

  // Fechar Modal Detalhes ao clicar fora (no backdrop escuro)
  modalDetalhes?.addEventListener('click', (e) => {
    if (e.target === modalDetalhes) {
      fecharModalDetalhes();
    }
  });

  // Fechar Modal JSON no X e no Rodapé
  document.getElementById('btnFecharModalJsonX')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    fecharModalJson();
  });

  document.getElementById('btnFecharModalJsonFooter')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    fecharModalJson();
  });

  // Fechar Modal JSON ao clicar fora
  modalJson?.addEventListener('click', (e) => {
    if (e.target === modalJson) {
      fecharModalJson();
    }
  });

  // Fechar qualquer modal com a tecla ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'Esc') {
      if (modalDetalhes && modalDetalhes.style.display === 'flex') {
        fecharModalDetalhes();
      }
      if (modalJson && modalJson.style.display === 'flex') {
        fecharModalJson();
      }
    }
  });

  // Abrir Modal JSON Bruto
  document.getElementById('btnVerJsonProcesso')?.addEventListener('click', () => {
    if (ultimoResultado) {
      document.getElementById('preModalJsonProcesso').textContent = JSON.stringify(ultimoResultado, null, 2);
      modalJson.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
  });

  document.getElementById('btnCopiarJsonProcessoModal')?.addEventListener('click', () => {
    if (ultimoResultado) {
      window.copyToClipboard(JSON.stringify(ultimoResultado, null, 2), 'JSON completo copiado!');
    }
  });

  // Pivô direto via QueryString (?tipo=documento&termo=...)
  const procParams = new URLSearchParams(window.location.search);
  const paramTipo = procParams.get('tipo');
  const paramTermo = procParams.get('termo');
  if (paramTipo) {
    const targetTab = Array.from(tipoTabs).find((t) => t.dataset.tipo === paramTipo.toLowerCase());
    if (targetTab) targetTab.click();
  }
  if (paramTermo && inputTermo) {
    inputTermo.value = paramTermo.trim();
    inputTermo.dispatchEvent(new Event('input'));
    if (procParams.get('auto') === '1' && form) {
      setTimeout(() => {
        if (typeof form.requestSubmit === 'function') {
          form.requestSubmit();
        } else {
          form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
      }, 80);
    }
  }
});
