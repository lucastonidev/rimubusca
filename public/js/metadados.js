/**
 * ==============================================================================
 * RIMUBUSCA - MÓDULO DE METADADOS 100% CLIENT-SIDE (METADADOS.JS)
 * Extração de EXIF, GPS, Áudio, PDF, DOCX e Hashes Criptográficos no Navegador
 * ZERO bytes enviados ao servidor. Total privacidade e conformidade técnica.
 * ==============================================================================
 */

class MetadataEngine {
  constructor() {
    this.currentFile = null;
    this.currentData = null;
    this.currentHashes = {};
    this.currentGps = null;
    this.init();
  }

  init() {
    this.bindDropzone();
    this.bindPaste();
    this.bindTabs();
    this.bindActions();
    this.configurePdfJs();
  }

  configurePdfJs() {
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    }
  }

  // 1. GERENCIAMENTO DE DROPZONE (DRAG & DROP + INPUT FILE)
  bindDropzone() {
    const dropzone = document.getElementById('metaDropzone');
    const fileInput = document.getElementById('metaFileInput');
    const selectBtn = document.getElementById('metaSelectBtn');
    const demoBtn = document.getElementById('metaDemoBtn');

    if (!dropzone || !fileInput) return;

    if (selectBtn) {
      selectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
      });
    }

    if (demoBtn) {
      demoBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          window.toast?.info('Carregando amostra forense de demonstração...');
          const resp = await fetch('/samples/amostra_forense_gps.jpg');
          const blob = await resp.blob();
          const demoFile = new File([blob], 'amostra_forense_gps.jpg', { type: 'image/jpeg' });
          this.processFile(demoFile);
        } catch (err) {
          console.error(err);
          window.toast?.error('Não foi possível carregar a amostra de demonstração.');
        }
      });
    }

    dropzone.addEventListener('click', () => fileInput.click());

    ['dragenter', 'dragover'].forEach((eventName) => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('drag-active');
      });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('drag-active');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        this.processFile(files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        this.processFile(e.target.files[0]);
      }
    });
  }

  // Permite colar imagens diretamente com Ctrl+V
  bindPaste() {
    window.addEventListener('paste', (e) => {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (const item of items) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            window.toast?.info('Arquivo capturado da área de transferência.');
            this.processFile(file);
            break;
          }
        }
      }
    });
  }

  // 2. PROCESSAMENTO E PIPELINE DE EXTRAÇÃO LOCAL
  async processFile(file) {
    this.currentFile = file;
    this.currentData = {};
    this.currentHashes = {};
    this.currentGps = null;

    this.showState('loading');
    this.updateProgressStep('Lendo arquivo na memória local...');

    try {
      // 1. Leitura do ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      // 2. Assinatura de Bytes (Magic Bytes)
      const magicBytes = this.getMagicBytes(arrayBuffer);

      // 3. Cálculo de Hashes Criptográficos
      this.updateProgressStep('Calculando hashes SHA-256 e MD5...');
      const [sha256, md5] = await Promise.all([
        this.calculateSha256(arrayBuffer),
        this.calculateMd5(arrayBuffer),
      ]);

      this.currentHashes = { sha256, md5 };

      // 4. Metadados Básicos do Arquivo
      const fileSummary = {
        'Nome do Arquivo': file.name,
        'Tamanho': this.formatBytes(file.size),
        'Tamanho em Bytes': `${file.size.toLocaleString()} bytes`,
        'Tipo MIME Informado': file.type || 'Desconhecido',
        'Última Modificação': new Date(file.lastModified).toLocaleString('pt-BR'),
        'Assinatura (Magic Bytes)': magicBytes.hex,
        'Formato Detectado': magicBytes.format,
        'Hash SHA-256': sha256,
        'Hash MD5': md5,
      };

      let extractedMeta = {};

      // 5. Extração Específica por Formato
      const mime = file.type.toLowerCase();
      const ext = file.name.split('.').pop()?.toLowerCase();

      // IMAGENS (EXIF, GPS, IPTC, XMP via exifr)
      if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'tiff', 'heic', 'avif'].includes(ext)) {
        this.updateProgressStep('Extraindo tags EXIF, XMP, IPTC e coordenadas GPS...');
        extractedMeta = await this.extractImageMetadata(file);
      }
      // DOCUMENTOS PDF (pdfjs-dist)
      else if (mime === 'application/pdf' || ext === 'pdf') {
        this.updateProgressStep('Analisando cabeçalhos e propriedades do documento PDF...');
        extractedMeta = await this.extractPdfMetadata(arrayBuffer);
      }
      // ÁUDIO (music-metadata-browser)
      else if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'].includes(ext)) {
        this.updateProgressStep('Decodificando tags ID3/Vorbis e propriedades de áudio...');
        extractedMeta = await this.extractAudioMetadata(file);
      }
      // DOCUMENTOS DOCX (mammoth)
      else if (ext === 'docx' || mime.includes('wordprocessingml')) {
        this.updateProgressStep('Inspecionando estrutura XML do documento Word...');
        extractedMeta = await this.extractDocxMetadata(arrayBuffer);
      } else {
        extractedMeta = {
          'Aviso': 'Metadados estruturados profundos não suportados para este formato. Hashes e assinaturas calculados.',
        };
      }

      this.currentData = {
        arquivo: fileSummary,
        metadados: extractedMeta,
      };

      // 6. Renderização na Tela
      this.renderResults();
      this.showState('results');

      if (window.toast) {
        window.toast.success(`Metadados de "${file.name}" extraídos com sucesso!`);
      }
    } catch (err) {
      console.error('[ERRO NA EXTRAÇÃO DE METADADOS]:', err);
      this.showState('error', err.message || 'Falha ao processar o arquivo no navegador.');
      if (window.toast) {
        window.toast.error('Não foi possível ler os metadados do arquivo selecionado.');
      }
    }
  }

  // 3. ALGORITMOS CRIPTOGRÁFICOS CLIENT-SIDE
  async calculateSha256(buffer) {
    if (crypto.subtle) {
      const digest = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(digest));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    return 'Web Crypto não suportado neste navegador';
  }

  calculateMd5(buffer) {
    if (window.SparkMD5) {
      return window.SparkMD5.ArrayBuffer.hash(buffer);
    }
    return 'SparkMD5 não carregado';
  }

  getMagicBytes(buffer) {
    const uint = new Uint8Array(buffer.slice(0, 8));
    let hex = '';
    for (let i = 0; i < uint.length; i++) {
      hex += uint[i].toString(16).padStart(2, '0').toUpperCase() + ' ';
    }
    hex = hex.trim();

    let format = 'Desconhecido / Binário Geral';
    if (hex.startsWith('89 50 4E 47')) format = 'PNG Image';
    else if (hex.startsWith('FF D8 FF')) format = 'JPEG Image';
    else if (hex.startsWith('25 50 44 46')) format = 'PDF Document';
    else if (hex.startsWith('50 4B 03 04')) format = 'ZIP Archive / Office Open XML (DOCX/XLSX)';
    else if (hex.startsWith('49 44 33')) format = 'MP3 Audio (ID3v2)';
    else if (hex.startsWith('52 49 46 46')) format = 'RIFF Container (WAV / AVI / WebP)';
    else if (hex.startsWith('1A 45 DF A3')) format = 'Matroska / WebM Video/Audio';
    else if (hex.startsWith('4F 67 67 53')) format = 'Ogg Container';

    return { hex, format };
  }

  // 4. PARSERS ESPECÍFICOS POR FORMATO
  async extractImageMetadata(file) {
    const meta = {};

    if (!window.exifr) {
      meta['Erro'] = 'Biblioteca exifr não carregada via CDN.';
      return meta;
    }

    try {
      // Parse completo: EXIF, IPTC, XMP, ICC
      const parsed = await window.exifr.parse(file, {
        tiff: true,
        xmp: true,
        icc: true,
        iptc: true,
        jfif: true,
        ihdr: true,
      });

      if (parsed) {
        Object.entries(parsed).forEach(([key, val]) => {
          if (val instanceof Date) {
            meta[key] = val.toLocaleString('pt-BR');
          } else if (typeof val === 'object' && val !== null) {
            meta[key] = JSON.stringify(val);
          } else {
            meta[key] = String(val);
          }
        });
      }

      // Extração de Coordenadas GPS
      const gps = await window.exifr.gps(file);
      if (gps && gps.latitude && gps.longitude) {
        this.currentGps = {
          latitude: gps.latitude,
          longitude: gps.longitude,
          altitude: gps.altitude || null,
        };
        meta['[GPS] Latitude'] = gps.latitude.toFixed(6);
        meta['[GPS] Longitude'] = gps.longitude.toFixed(6);
        if (gps.altitude) meta['[GPS] Altitude'] = `${gps.altitude.toFixed(1)} metros`;
      }
    } catch (e) {
      meta['Aviso EXIF'] = `Nenhum bloco EXIF padrão identificado: ${e.message}`;
    }

    return meta;
  }

  async extractPdfMetadata(buffer) {
    const meta = {};

    if (!window.pdfjsLib) {
      meta['Erro'] = 'Biblioteca pdfjs-dist não disponível.';
      return meta;
    }

    try {
      const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
      meta['Total de Páginas'] = pdf.numPages;

      const pdfMeta = await pdf.getMetadata();
      if (pdfMeta && pdfMeta.info) {
        const info = pdfMeta.info;
        if (info.Title) meta['Título'] = info.Title;
        if (info.Author) meta['Autor'] = info.Author;
        if (info.Subject) meta['Assunto'] = info.Subject;
        if (info.Creator) meta['Software Criador (Creator)'] = info.Creator;
        if (info.Producer) meta['Produtor PDF (Producer)'] = info.Producer;
        if (info.CreationDate) meta['Data de Criação'] = info.CreationDate;
        if (info.ModDate) meta['Data de Modificação'] = info.ModDate;
        if (info.PDFFormatVersion) meta['Versão do Formato PDF'] = info.PDFFormatVersion;
        if (info.IsAcroFormPresent) meta['Possui Formulário AcroForm'] = info.IsAcroFormPresent ? 'Sim' : 'Não';
      }
    } catch (e) {
      meta['Erro PDF'] = `Falha na leitura do PDF: ${e.message}`;
    }

    return meta;
  }

  async extractAudioMetadata(file) {
    const meta = {};
    const mm = window.musicMetadata || window.mmb;

    if (!mm) {
      meta['Erro'] = 'Biblioteca music-metadata-browser não carregada.';
      return meta;
    }

    try {
      const parsed = await mm.parseBlob(file);
      if (parsed) {
        const { common, format } = parsed;

        if (format.duration) meta['Duração'] = `${Math.floor(format.duration / 60)}m ${Math.floor(format.duration % 60)}s (${format.duration.toFixed(2)}s)`;
        if (format.bitrate) meta['Taxa de Bits (Bitrate)'] = `${Math.round(format.bitrate / 1000)} kbps`;
        if (format.sampleRate) meta['Frequência de Amostragem'] = `${format.sampleRate} Hz`;
        if (format.numberOfChannels) meta['Canais'] = format.numberOfChannels === 2 ? 'Stereo (2)' : format.numberOfChannels === 1 ? 'Mono (1)' : `${format.numberOfChannels} canais`;
        if (format.codec) meta['Codec'] = format.codec;
        if (format.container) meta['Container'] = format.container;

        if (common.title) meta['Título da Faixa'] = common.title;
        if (common.artist) meta['Artista'] = common.artist;
        if (common.album) meta['Álbum'] = common.album;
        if (common.year) meta['Ano de Lançamento'] = common.year;
        if (common.genre) meta['Gênero'] = Array.isArray(common.genre) ? common.genre.join(', ') : common.genre;
        if (common.comment) meta['Comentários'] = Array.isArray(common.comment) ? common.comment.join(' | ') : common.comment;
        if (common.encoder) meta['Software Codificador'] = common.encoder;
      }
    } catch (e) {
      meta['Aviso Áudio'] = `Não foi possível extrair tags ID3 completas: ${e.message}`;
    }

    return meta;
  }

  async extractDocxMetadata(buffer) {
    const meta = {
      'Formato': 'Office Open XML (DOCX)',
      'Estrutura': 'Arquivo comprimido baseado em ZIP/XML',
    };

    if (window.mammoth) {
      try {
        const result = await window.mammoth.extractRawText({ arrayBuffer: buffer });
        const text = result.value || '';
        meta['Contagem Estimada de Palavras'] = text.trim() ? text.trim().split(/\s+/).length : 0;
        meta['Caracteres de Texto Extraível'] = text.length;
      } catch (e) {
        meta['Aviso DOCX'] = 'Documento protegido ou não legível via extrator.';
      }
    }

    return meta;
  }

  // 5. RENDERIZAÇÃO DE RESULTADOS E VISUALIZAÇÕES
  renderResults() {
    if (!this.currentFile || !this.currentData) return;

    // 1. Resumo do Arquivo e Hashes
    document.getElementById('resFileName').textContent = this.currentFile.name;
    document.getElementById('resFileSize').textContent = this.formatBytes(this.currentFile.size);
    document.getElementById('resFileType').textContent = this.currentFile.type || 'Desconhecido';
    document.getElementById('resSha256').textContent = this.currentHashes.sha256 || 'N/A';
    document.getElementById('resMd5').textContent = this.currentHashes.md5 || 'N/A';

    // 2. Preview de Miniatura
    this.renderPreview();

    // 3. Card de Geolocalização GPS (Se houver)
    this.renderGps();

    // 4. Preenchimento da Tabela de Metadados
    this.renderTable();

    // 5. Visualizador JSON Bruto
    document.getElementById('rawJsonCode').textContent = JSON.stringify(this.currentData, null, 2);
  }

  renderPreview() {
    const previewContainer = document.getElementById('metaFilePreview');
    if (!previewContainer) return;

    const file = this.currentFile;
    const mime = file.type.toLowerCase();

    if (mime.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      previewContainer.innerHTML = `<img src="${url}" alt="Preview" style="max-height: 140px; border-radius: var(--radius-md); border: 1px solid var(--color-border); object-fit: contain;">`;
    } else if (mime.startsWith('audio/')) {
      const url = URL.createObjectURL(file);
      previewContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 8px; align-items: center;">
          <i data-lucide="music" style="width: 36px; height: 36px; color: var(--color-primary);"></i>
          <audio controls src="${url}" style="height: 32px; width: 220px;"></audio>
        </div>
      `;
    } else if (mime === 'application/pdf') {
      previewContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 6px; align-items: center; color: var(--color-error);">
          <i data-lucide="file-text" style="width: 48px; height: 48px;"></i>
          <span style="font-size: 0.75rem; font-family: var(--font-mono); color: var(--color-text-muted);">PDF Document</span>
        </div>
      `;
    } else {
      previewContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 6px; align-items: center; color: var(--color-primary);">
          <i data-lucide="file" style="width: 48px; height: 48px;"></i>
          <span style="font-size: 0.75rem; font-family: var(--font-mono); color: var(--color-text-muted);">${file.name.split('.').pop()?.toUpperCase()}</span>
        </div>
      `;
    }

    if (window.lucide) window.lucide.createIcons({ root: previewContainer });
  }

  renderGps() {
    const gpsCard = document.getElementById('metaGpsCard');
    if (!gpsCard) return;

    if (this.currentGps) {
      gpsCard.style.display = 'block';
      const lat = this.currentGps.latitude;
      const lon = this.currentGps.longitude;
      const alt = this.currentGps.altitude;

      document.getElementById('gpsDecimal').textContent = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
      document.getElementById('gpsDms').textContent = `${this.toDms(lat, 'lat')}, ${this.toDms(lon, 'lon')}`;
      document.getElementById('gpsAltitude').textContent = alt ? `${alt.toFixed(1)} metros` : 'Não informada';

      // Links externos para navegação
      const gmapsLink = `https://www.google.com/maps?q=${lat},${lon}`;
      const osmLink = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`;
      document.getElementById('linkGoogleMaps').setAttribute('href', gmapsLink);
      document.getElementById('linkOsm').setAttribute('href', osmLink);

      // OpenStreetMap Embed Seguro
      const osmIframe = document.getElementById('osmEmbedIframe');
      if (osmIframe) {
        const bbox = `${lon - 0.005}%2C${lat - 0.004}%2C${lon + 0.005}%2C${lat + 0.004}`;
        osmIframe.src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lon}`;
      }
    } else {
      gpsCard.style.display = 'none';
    }
  }

  renderTable() {
    const tbody = document.getElementById('metadataTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    const allTags = {
      ...this.currentData.arquivo,
      ...this.currentData.metadados,
    };

    const count = Object.keys(allTags).length;
    document.getElementById('metaTotalCount').textContent = `${count} tags identificadas`;

    Object.entries(allTags).forEach(([key, value]) => {
      const row = document.createElement('tr');
      const isGps = key.startsWith('[GPS]');
      const isHash = key.startsWith('Hash');

      row.innerHTML = `
        <td style="font-weight: 500; color: ${isGps ? 'var(--color-warning)' : 'var(--color-text)'}; width: 35%;">
          ${this.escapeHtml(key)}
        </td>
        <td style="font-family: ${isHash || isGps ? 'var(--font-mono)' : 'inherit'}; font-size: ${isHash ? '0.75rem' : '0.875rem'}; word-break: break-all;">
          ${this.escapeHtml(String(value))}
        </td>
        <td style="text-align: right; width: 60px;">
          <button 
            class="btn btn-ghost btn-sm" 
            onclick="window.copyToClipboard('${this.escapeHtml(String(value))}', this)" 
            title="Copiar Valor"
          >
            <i data-lucide="copy" style="width: 14px; height: 14px;"></i>
          </button>
        </td>
      `;

      tbody.appendChild(row);
    });

    if (window.lucide) window.lucide.createIcons({ root: tbody });

    // Habilita busca em tempo real na tabela
    this.bindTableSearch();
  }

  bindTableSearch() {
    const searchInput = document.getElementById('metaTableSearch');
    if (!searchInput) return;

    searchInput.value = '';
    searchInput.oninput = (e) => {
      const term = e.target.value.toLowerCase().trim();
      const rows = document.querySelectorAll('#metadataTableBody tr');

      rows.forEach((row) => {
        const text = row.textContent.toLowerCase();
        row.style.display = !term || text.includes(term) ? '' : 'none';
      });
    };
  }

  // 6. BOTÕES DE AÇÃO E EXPORTAÇÃO
  bindActions() {
    // Reset / Analisar Outro Arquivo
    const resetBtn = document.getElementById('btnResetMeta');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.currentFile = null;
        this.currentData = null;
        this.currentGps = null;
        const fileInput = document.getElementById('metaFileInput');
        if (fileInput) fileInput.value = '';
        this.showState('dropzone');
      });
    }

    // Baixar JSON Completo
    const downloadBtn = document.getElementById('btnDownloadJson');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        if (!this.currentData) return;
        const blob = new Blob([JSON.stringify(this.currentData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `metadados_${this.currentFile.name.replace(/\.[^/.]+$/, '')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        window.toast?.success('Arquivo de relatório JSON gerado e baixado.');
      });
    }

    // Salvar no Histórico Supabase (Persistência segura sem envio de binário)
    const saveBtn = document.getElementById('btnSaveHistory');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        if (!this.currentData || !this.currentFile) return;

        saveBtn.disabled = true;
        const originalHTML = saveBtn.innerHTML;
        saveBtn.innerHTML = `
          <i data-lucide="loader-2" style="width: 14px; height: 14px; animation: spin 1s linear infinite;"></i>
          <span>Salvando...</span>
        `;
        if (window.lucide) window.lucide.createIcons({ root: saveBtn });

        try {
          const payload = {
            nomeArquivo: this.currentFile.name,
            tipoMime: this.currentFile.type,
            tamanhoFormatado: this.formatBytes(this.currentFile.size),
            hashes: this.currentHashes,
            resumo: this.currentData.metadados || {},
          };

          const res = await window.api.post('/api/metadados/salvar-historico', payload);
          window.toast?.success(res.message || 'Metadados persistidos no seu histórico.');

          saveBtn.innerHTML = `
            <i data-lucide="check" style="width: 14px; height: 14px; color: var(--color-success);"></i>
            <span>Salvo no Histórico</span>
          `;
          if (window.lucide) window.lucide.createIcons({ root: saveBtn });
        } catch (err) {
          console.error('Erro ao salvar histórico de metadados:', err);
          saveBtn.disabled = false;
          saveBtn.innerHTML = originalHTML;
          if (window.lucide) window.lucide.createIcons({ root: saveBtn });
        }
      });
    }
  }

  // Alternância de Abas
  bindTabs() {
    const tabBtns = document.querySelectorAll('.meta-tab-btn');
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        tabBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.meta-tab-panel').forEach((panel) => {
          panel.style.display = panel.id === target ? 'block' : 'none';
        });
      });
    });
  }

  // 7. MUDANÇAS DE ESTADO DA UI
  showState(state, errorMsg = '') {
    const dropzoneSection = document.getElementById('metaDropzoneSection');
    const loadingSection = document.getElementById('metaLoadingSection');
    const resultsSection = document.getElementById('metaResultsSection');
    const errorSection = document.getElementById('metaErrorSection');

    if (dropzoneSection) dropzoneSection.style.display = state === 'dropzone' ? 'block' : 'none';
    if (loadingSection) loadingSection.style.display = state === 'loading' ? 'block' : 'none';
    if (resultsSection) resultsSection.style.display = state === 'results' ? 'block' : 'none';
    if (errorSection) {
      errorSection.style.display = state === 'error' ? 'block' : 'none';
      if (state === 'error') {
        document.getElementById('metaErrorMessage').textContent = errorMsg;
      }
    }
  }

  updateProgressStep(text) {
    const el = document.getElementById('metaProgressStep');
    if (el) el.textContent = text;
  }

  // 8. HELPERS UTILITÁRIOS
  formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  toDms(deg, type) {
    const absolute = Math.abs(deg);
    const degrees = Math.floor(absolute);
    const minutesNotTruncated = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesNotTruncated);
    const seconds = Math.floor((minutesNotTruncated - minutes) * 60);

    let direction = '';
    if (type === 'lat') direction = deg >= 0 ? 'N' : 'S';
    if (type === 'lon') direction = deg >= 0 ? 'E' : 'W';

    return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
  }

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Inicializa o motor de metadados assim que o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  window.metadataEngine = new MetadataEngine();
});

