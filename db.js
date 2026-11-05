/**
 * db.js - Web Page Database (IndexedDB Wrapper)
 * 
 * Provides persistent, client-side transactional database storage using
 * the browser's native IndexedDB API, with transparent fallback to localStorage
 * if IndexedDB is blocked or disabled.
 */

const DB_CONFIG = {
  name: 'DragAndDropBoardDB',
  version: 1,
  stores: {
    columns: 'columns',
    cards: 'cards',
    settings: 'settings'
  }
};

// Initial default seed data for first-time launch
const DEFAULT_COLUMNS = [
  { id: 'col-todo', title: 'To Do', order: 0, createdAt: Date.now() },
  { id: 'col-progress', title: 'In Progress', order: 1, createdAt: Date.now() + 1 },
  { id: 'col-review', title: 'In Review', order: 2, createdAt: Date.now() + 2 },
  { id: 'col-done', title: 'Done', order: 3, createdAt: Date.now() + 3 }
];

const DEFAULT_CARDS = [
  {
    id: 'card-1',
    columnId: 'col-todo',
    title: 'Research UI drag-and-drop interactions',
    description: 'Explore HTML5 drag and drop events, ghost image styling, and drop placeholder indicators.',
    priority: 'medium',
    tags: ['Research', 'UI/UX'],
    dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    order: 0,
    createdAt: Date.now() - 100000
  },
  {
    id: 'card-2',
    columnId: 'col-todo',
    title: 'Design database schema for IndexedDB',
    description: 'Setup object stores for columns, cards, and user preferences with proper indices.',
    priority: 'high',
    tags: ['Database', 'Architecture'],
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    order: 1,
    createdAt: Date.now() - 80000
  },
  {
    id: 'card-3',
    columnId: 'col-progress',
    title: 'Implement smooth drag & drop handlers',
    description: 'Listen to dragstart, dragover, dragleave, and drop events. Ensure cards reorder correctly.',
    priority: 'urgent',
    tags: ['Core', 'JavaScript'],
    dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    order: 0,
    createdAt: Date.now() - 60000
  },
  {
    id: 'card-4',
    columnId: 'col-progress',
    title: 'Add tag filtering & instant search',
    description: 'Filter board cards in real-time as users type or select priority filters.',
    priority: 'low',
    tags: ['Feature'],
    dueDate: '',
    order: 1,
    createdAt: Date.now() - 40000
  },
  {
    id: 'card-5',
    columnId: 'col-review',
    title: 'Verify offline persistence',
    description: 'Test reloading the browser page to ensure changes remain stored in the browser database.',
    priority: 'medium',
    tags: ['Testing', 'QA'],
    dueDate: new Date(Date.now() + 86400000 * 4).toISOString().split('T')[0],
    order: 0,
    createdAt: Date.now() - 20000
  },
  {
    id: 'card-6',
    columnId: 'col-done',
    title: 'Project kick-off & environment setup',
    description: 'Configured pure HTML5, CSS3, and modern Vanilla ES6+ without external frameworks.',
    priority: 'low',
    tags: ['Setup'],
    dueDate: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    order: 0,
    createdAt: Date.now() - 10000
  }
];

class WebPageDatabase {
  constructor() {
    this.db = null;
    this.engine = 'IndexedDB'; // 'IndexedDB' or 'localStorage (Fallback)'
    this.readyPromise = this.init();
  }

  /**
   * Initializes the database connection and creates stores/indices if needed.
   */
  async init() {
    if (!('indexedDB' in window)) {
      console.warn('IndexedDB not supported by this browser. Falling back to localStorage.');
      this.engine = 'localStorage (Fallback)';
      this.initLocalStorageFallback();
      return;
    }

    try {
      this.db = await new Promise((resolve, reject) => {
        const request = window.indexedDB.open(DB_CONFIG.name, DB_CONFIG.version);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;

          // Columns store
          if (!db.objectStoreNames.contains(DB_CONFIG.stores.columns)) {
            const colStore = db.createObjectStore(DB_CONFIG.stores.columns, { keyPath: 'id' });
            colStore.createIndex('order', 'order', { unique: false });
          }

          // Cards store
          if (!db.objectStoreNames.contains(DB_CONFIG.stores.cards)) {
            const cardStore = db.createObjectStore(DB_CONFIG.stores.cards, { keyPath: 'id' });
            cardStore.createIndex('columnId', 'columnId', { unique: false });
            cardStore.createIndex('order', 'order', { unique: false });
            cardStore.createIndex('priority', 'priority', { unique: false });
          }

          // Settings store
          if (!db.objectStoreNames.contains(DB_CONFIG.stores.settings)) {
            db.createObjectStore(DB_CONFIG.stores.settings, { keyPath: 'key' });
          }
        };

        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
      });

      // Verify if database needs initial seeding
      await this.seedInitialDataIfNeeded();
    } catch (err) {
      console.warn('Failed to open IndexedDB. Falling back to localStorage:', err);
      this.engine = 'localStorage (Fallback)';
      this.initLocalStorageFallback();
    }
  }

  /**
   * Seeds default columns and cards if database is empty on first visit.
   */
  async seedInitialDataIfNeeded() {
    const existingColumns = await this.getAllColumns();
    if (!existingColumns || existingColumns.length === 0) {
      console.info('Seeding default columns and sample cards to IndexedDB...');
      for (const col of DEFAULT_COLUMNS) {
        await this.putRecord(DB_CONFIG.stores.columns, col);
      }
      for (const card of DEFAULT_CARDS) {
        await this.putRecord(DB_CONFIG.stores.cards, card);
      }
      await this.setSetting('theme', 'dark');
      await this.setSetting('initializedAt', Date.now());
    }
  }

  initLocalStorageFallback() {
    if (!localStorage.getItem('board_columns')) {
      localStorage.setItem('board_columns', JSON.stringify(DEFAULT_COLUMNS));
    }
    if (!localStorage.getItem('board_cards')) {
      localStorage.setItem('board_cards', JSON.stringify(DEFAULT_CARDS));
    }
    if (!localStorage.getItem('board_settings')) {
      localStorage.setItem('board_settings', JSON.stringify({ theme: 'dark' }));
    }
  }

  // --- Generic Transaction Helpers ---

  async getTransaction(storeName, mode = 'readonly') {
    await this.readyPromise;
    if (this.engine !== 'IndexedDB' || !this.db) {
      return null;
    }
    return this.db.transaction(storeName, mode);
  }

  async putRecord(storeName, record) {
    await this.readyPromise;
    if (this.engine !== 'IndexedDB' || !this.db) {
      const data = JSON.parse(localStorage.getItem(`board_${storeName}`) || '[]');
      const index = data.findIndex(item => item.id === record.id || item.key === record.key);
      if (index >= 0) {
        data[index] = record;
      } else {
        data.push(record);
      }
      localStorage.setItem(`board_${storeName}`, JSON.stringify(data));
      return record;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(record);
      req.onsuccess = () => resolve(record);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteRecord(storeName, key) {
    await this.readyPromise;
    if (this.engine !== 'IndexedDB' || !this.db) {
      let data = JSON.parse(localStorage.getItem(`board_${storeName}`) || '[]');
      data = data.filter(item => (item.id || item.key) !== key);
      localStorage.setItem(`board_${storeName}`, JSON.stringify(data));
      return true;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllRecords(storeName) {
    await this.readyPromise;
    if (this.engine !== 'IndexedDB' || !this.db) {
      return JSON.parse(localStorage.getItem(`board_${storeName}`) || '[]');
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  // --- Columns API ---

  async getAllColumns() {
    const cols = await this.getAllRecords(DB_CONFIG.stores.columns);
    return cols.sort((a, b) => a.order - b.order);
  }

  async saveColumn(col) {
    return this.putRecord(DB_CONFIG.stores.columns, col);
  }

  async deleteColumn(colId) {
    // Delete column and all associated cards
    await this.deleteRecord(DB_CONFIG.stores.columns, colId);
    const cards = await this.getAllCards();
    const cardsToDelete = cards.filter(c => c.columnId === colId);
    for (const card of cardsToDelete) {
      await this.deleteCard(card.id);
    }
  }

  async batchUpdateColumns(columns) {
    for (const col of columns) {
      await this.saveColumn(col);
    }
  }

  // --- Cards API ---

  async getAllCards() {
    const cards = await this.getAllRecords(DB_CONFIG.stores.cards);
    return cards.sort((a, b) => a.order - b.order);
  }

  async getCardsByColumn(columnId) {
    const cards = await this.getAllCards();
    return cards
      .filter(card => card.columnId === columnId)
      .sort((a, b) => a.order - b.order);
  }

  async saveCard(card) {
    if (!card.updatedAt) {
      card.updatedAt = Date.now();
    }
    return this.putRecord(DB_CONFIG.stores.cards, card);
  }

  async deleteCard(cardId) {
    return this.deleteRecord(DB_CONFIG.stores.cards, cardId);
  }

  async batchUpdateCards(cards) {
    await this.readyPromise;
    if (this.engine !== 'IndexedDB' || !this.db) {
      for (const card of cards) {
        await this.saveCard(card);
      }
      return;
    }

    // Atomic transaction for reordering cards
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(DB_CONFIG.stores.cards, 'readwrite');
      const store = tx.objectStore(DB_CONFIG.stores.cards);
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);

      cards.forEach(card => {
        card.updatedAt = Date.now();
        store.put(card);
      });
    });
  }

  // --- Settings API ---

  async getSetting(key, defaultValue = null) {
    await this.readyPromise;
    if (this.engine !== 'IndexedDB' || !this.db) {
      const settings = JSON.parse(localStorage.getItem('board_settings') || '{}');
      return settings[key] !== undefined ? settings[key] : defaultValue;
    }

    return new Promise((resolve) => {
      const tx = this.db.transaction(DB_CONFIG.stores.settings, 'readonly');
      const store = tx.objectStore(DB_CONFIG.stores.settings);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : defaultValue);
      req.onerror = () => resolve(defaultValue);
    });
  }

  async setSetting(key, value) {
    await this.readyPromise;
    if (this.engine !== 'IndexedDB' || !this.db) {
      const settings = JSON.parse(localStorage.getItem('board_settings') || '{}');
      settings[key] = value;
      localStorage.setItem('board_settings', JSON.stringify(settings));
      return;
    }

    return this.putRecord(DB_CONFIG.stores.settings, { key, value });
  }

  // --- Database Stats & Maintenance API ---

  async getDatabaseStats() {
    const columns = await this.getAllColumns();
    const cards = await this.getAllCards();
    return {
      engine: this.engine,
      databaseName: DB_CONFIG.name,
      version: DB_CONFIG.version,
      columnsCount: columns.length,
      cardsCount: cards.length,
      storageType: 'Client-Side Web Page Database (In-Browser)'
    };
  }

  async exportDatabaseJSON() {
    const columns = await this.getAllColumns();
    const cards = await this.getAllCards();
    const settings = await this.getAllRecords(DB_CONFIG.stores.settings);

    return JSON.stringify({
      version: DB_CONFIG.version,
      exportedAt: new Date().toISOString(),
      columns,
      cards,
      settings
    }, null, 2);
  }

  async importDatabaseJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (!Array.isArray(data.columns) || !Array.isArray(data.cards)) {
        throw new Error('Invalid backup file structure.');
      }

      // Clear existing records
      await this.clearAllData();

      // Restore columns
      for (const col of data.columns) {
        await this.saveColumn(col);
      }

      // Restore cards
      for (const card of data.cards) {
        await this.saveCard(card);
      }

      if (Array.isArray(data.settings)) {
        for (const s of data.settings) {
          if (s.key && s.value !== undefined) {
            await this.setSetting(s.key, s.value);
          }
        }
      }

      return { success: true, columns: data.columns.length, cards: data.cards.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async clearAllData() {
    await this.readyPromise;
    if (this.engine !== 'IndexedDB' || !this.db) {
      localStorage.removeItem('board_columns');
      localStorage.removeItem('board_cards');
      localStorage.removeItem('board_settings');
      return;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([
        DB_CONFIG.stores.columns,
        DB_CONFIG.stores.cards,
        DB_CONFIG.stores.settings
      ], 'readwrite');

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);

      tx.objectStore(DB_CONFIG.stores.columns).clear();
      tx.objectStore(DB_CONFIG.stores.cards).clear();
      tx.objectStore(DB_CONFIG.stores.settings).clear();
    });
  }

  async resetToDefaults() {
    await this.clearAllData();
    for (const col of DEFAULT_COLUMNS) {
      await this.saveColumn(col);
    }
    for (const card of DEFAULT_CARDS) {
      await this.saveCard(card);
    }
    await this.setSetting('theme', 'dark');
    return true;
  }
}

// Global instance exposed to window
window.db = new WebPageDatabase();

