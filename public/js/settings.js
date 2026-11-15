/**
 * ==============================================================================
 * RIMUBUSCA - SISTEMA UNIFICADO DE PREFERÊNCIAS & CACHE (SETTINGS.JS)
 * Gerenciador de configurações persistidas no LocalStorage sob a chave única:
 * "rimubuscas_settings"
 *
 * Padrão Orientado a Objetos (OOP) com Singleton: window.rimuSettings
 * Suporte a migração automática de chaves legadas e despacho de eventos reativos.
 * ==============================================================================
 */

class RimuSettingsManager {
  static STORAGE_KEY = 'rimubuscas_settings';

  static DEFAULTS = {
    showRawJson: false,        // Padrão: desativado (gaveta de JSON técnico oculta)
    showGoogleDorks: false,    // Padrão: desativado (cards de Google Dorks ocultos)
    darkModeReports: true,     // Padrão: ativado (exportação de dossiês em dark mode)
    theme: 'dark',             // Tema oficial (dark)
    autoRefreshWallet: true,   // Sincronização em tempo real de saldo compartilhado
    lastUpdated: null,
  };

  constructor() {
    this.storageKey = RimuSettingsManager.STORAGE_KEY;
    this.defaults = { ...RimuSettingsManager.DEFAULTS };
    this.state = this.load();
    this.migrateLegacyKeys();
  }

  /**
   * Carrega as configurações do LocalStorage mesclando com os valores padrão
   */
  load() {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(this.storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            return { ...this.defaults, ...parsed };
          }
        }
      }
    } catch (err) {
      console.warn('[SETTINGS MANAGER] Falha ao carregar rimubuscas_settings:', err.message);
    }
    return { ...this.defaults };
  }

  /**
   * Salva o estado atual no LocalStorage em uma única chave JSON
   */
  save() {
    try {
      if (typeof localStorage !== 'undefined') {
        this.state.lastUpdated = new Date().toISOString();
        localStorage.setItem(this.storageKey, JSON.stringify(this.state));
      }
    } catch (err) {
      console.error('[SETTINGS MANAGER] Erro ao gravar rimubuscas_settings:', err.message);
    }
  }

  /**
   * Migração transparente de chaves legadas dispersas no LocalStorage
   */
  migrateLegacyKeys() {
    if (typeof localStorage === 'undefined') return;

    let hasMigrated = false;

    // 1. JSON Bruto legado
    const legacyJson = localStorage.getItem('rimu_pref_show_raw_json');
    if (legacyJson !== null) {
      this.state.showRawJson = legacyJson === 'true';
      localStorage.removeItem('rimu_pref_show_raw_json');
      hasMigrated = true;
    }

    // 2. Google Dorks legado
    const legacyDorks = localStorage.getItem('rimu_pref_show_google_dorks');
    if (legacyDorks !== null) {
      this.state.showGoogleDorks = legacyDorks === 'true';
      localStorage.removeItem('rimu_pref_show_google_dorks');
      hasMigrated = true;
    }

    // 3. Relatórios Dark Mode legado
    const legacyDarkReports = localStorage.getItem('rimu_pref_dark_reports');
    if (legacyDarkReports !== null) {
      this.state.darkModeReports = legacyDarkReports !== 'false';
      localStorage.removeItem('rimu_pref_dark_reports');
      hasMigrated = true;
    }

    // 4. Tema visual legado
    const legacyTheme = localStorage.getItem('rimu_theme');
    if (legacyTheme !== null) {
      this.state.theme = legacyTheme;
      hasMigrated = true;
    }

    if (hasMigrated) {
      this.save();
      console.log('[SETTINGS MANAGER] Chaves legadas migradas com sucesso para "rimubuscas_settings".');
    }
  }

  /**
   * Obtém o valor de uma configuração específica
   * @param {string} key
   * @param {*} fallback
   */
  get(key, fallback = undefined) {
    if (key in this.state) {
      return this.state[key];
    }
    if (fallback !== undefined) {
      return fallback;
    }
    return this.defaults[key];
  }

  /**
   * Define e persiste uma configuração imediatamente
   * @param {string} key
   * @param {*} value
   */
  set(key, value) {
    this.state[key] = value;
    this.save();
    this.dispatchChangeEvent(key, value);
    return value;
  }

  /**
   * Atualiza várias configurações em lote
   * @param {Object} partialSettings
   */
  update(partialSettings) {
    if (partialSettings && typeof partialSettings === 'object') {
      this.state = { ...this.state, ...partialSettings };
      this.save();
      Object.entries(partialSettings).forEach(([k, v]) => {
        this.dispatchChangeEvent(k, v);
      });
    }
    return this.getAll();
  }

  /**
   * Retorna clone de todas as preferências atuais
   */
  getAll() {
    return { ...this.state };
  }

  /**
   * Restaura os valores padrão de fábrica
   */
  reset() {
    this.state = { ...this.defaults };
    this.save();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('rimu:settings-reset', { detail: this.getAll() })
      );
    }
    return this.getAll();
  }

  /**
   * Dispara evento customizado para permitir reatividade instantânea na interface
   */
  dispatchChangeEvent(key, value) {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(
        new CustomEvent('rimu:settings-changed', {
          detail: { key, value, settings: this.getAll() },
        })
      );
    }
  }

  // Getters convenientes
  get showRawJson() {
    return Boolean(this.get('showRawJson', false));
  }

  get showGoogleDorks() {
    return Boolean(this.get('showGoogleDorks', false));
  }

  get darkModeReports() {
    return Boolean(this.get('darkModeReports', true));
  }

  get theme() {
    return this.get('theme', 'dark');
  }
}

const rimuSettings = new RimuSettingsManager();

if (typeof window !== 'undefined') {
  window.RimuSettingsManager = RimuSettingsManager;
  window.rimuSettings = rimuSettings;
  window.RimuSettings = rimuSettings;
}

if (typeof globalThis !== 'undefined') {
  globalThis.RimuSettingsManager = RimuSettingsManager;
  globalThis.rimuSettings = rimuSettings;
  globalThis.RimuSettings = rimuSettings;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RimuSettingsManager, rimuSettings };
}
