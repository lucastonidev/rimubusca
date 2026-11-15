/**
 * ==============================================================================
 * RIMUBUSCA - REGISTRO CENTRAL DE HUBS DE APIS (HUBREGISTRY.JS)
 * Gerenciador singleton para registro, descoberta e injeção de novos Hubs.
 *
 * Exemplo de uso:
 *   import { hubRegistry } from './HubRegistry.js';
 *   hubRegistry.register('meuhub', meuHubInstance);
 *   const hub = hubRegistry.get('meuhub');
 * ==============================================================================
 */

export class HubRegistry {
  constructor() {
    this.hubs = new Map();
  }

  /**
   * Registra uma instância de Hub no catálogo global
   * @param {string} id
   * @param {BaseHubService} hubInstance
   */
  register(id, hubInstance) {
    if (!id || !hubInstance) {
      throw new Error("ID e instância do Hub são obrigatórios para registro.");
    }
    this.hubs.set(String(id).toLowerCase(), hubInstance);
    return hubInstance;
  }

  /**
   * Recupera um Hub registrado pelo seu identificador
   * @param {string} [id='main']
   * @returns {BaseHubService|null}
   */
  get(id = "main") {
    const key = String(id).toLowerCase();
    if (this.hubs.has(key)) {
      return this.hubs.get(key);
    }
    // Fallback para o primeiro hub cadastrado
    const first = this.hubs.values().next().value;
    return first || null;
  }

  /**
   * Lista todos os hubs cadastrados
   * @returns {Array<{ id: string, name: string, hub: BaseHubService }>}
   */
  list() {
    return Array.from(this.hubs.entries()).map(([id, hub]) => ({
      id,
      name: hub.name,
      modulesCount: hub.modules?.length || 0,
      hub,
    }));
  }

  /**
   * Retorna apenas a lista de IDs registrados
   * @returns {string[]}
   */
  listHubIds() {
    return Array.from(this.hubs.keys());
  }

  /**
   * Verifica se um hub existe
   * @param {string} id
   */
  has(id) {
    return this.hubs.has(String(id).toLowerCase());
  }
}

export const hubRegistry = new HubRegistry();
