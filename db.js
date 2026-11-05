/**
 * db.js — TaskFlow Web Page Database
 * Client-side IndexedDB engine with localStorage fallback.
 * No backend required — all data lives in the browser.
 */

'use strict';

/* ─── Schema ───────────────────────────────────────────────────────────────── */
const DB_NAME    = 'TaskFlowDB';
const DB_VERSION = 1;
const STORE = { COLUMNS: 'columns', CARDS: 'cards', SETTINGS: 'settings' };

/* ─── Seed Data (shown on first visit) ─────────────────────────────────────── */
const SEED_COLUMNS = [
  { id: 'col-backlog',    title: 'Backlog',      order: 0, createdAt: 1000 },
  { id: 'col-todo',      title: 'To Do',        order: 1, createdAt: 1001 },
  { id: 'col-progress',  title: 'In Progress',  order: 2, createdAt: 1002 },
  { id: 'col-done',      title: 'Done',         order: 3, createdAt: 1003 },
];

const SEED_CARDS = [
  {
    id: 'card-s1', columnId: 'col-backlog', order: 0,
    title: 'Set up project structure',
    description: 'Create folder layout, initialize Git repo, and configure linting rules.',
    priority: 'low', tags: ['Setup', 'DevOps'],
    dueDate: '2026-11-20', createdAt: 2000,
  },
  {
    id: 'card-s2', columnId: 'col-backlog', order: 1,
    title: 'Write technical specification',
    description: 'Document API contracts, data models, and component hierarchy.',
    priority: 'medium', tags: ['Docs'],
    dueDate: '2026-11-25', createdAt: 2001,
  },
  {
    id: 'card-s3', columnId: 'col-todo', order: 0,
    title: 'Design color system & tokens',
    description: 'Define CSS custom properties for dark and light themes.',
    priority: 'high', tags: ['Design', 'CSS'],
    dueDate: '2026-11-10', createdAt: 2002,
  },
  {
    id: 'card-s4', columnId: 'col-todo', order: 1,
    title: 'Implement IndexedDB schema',
    description: 'Create object stores for columns, cards, and settings with indices.',
    priority: 'urgent', tags: ['Database', 'Core'],
    dueDate: '2026-11-08', createdAt: 2003,
  },
  {
    id: 'card-s5', columnId: 'col-todo', order: 2,
    title: 'Build card component',
    description: 'Priority badge, tags, due-date badge, hover actions (edit / delete).',
    priority: 'high', tags: ['UI', 'JavaScript'],
    dueDate: '2026-11-12', createdAt: 2004,
  },
  {
    id: 'card-s6', columnId: 'col-progress', order: 0,
    title: 'HTML5 drag & drop engine',
    description: 'Handle dragstart, dragover, dragleave, drop events. Show drop placeholder.',
    priority: 'urgent', tags: ['Core', 'DnD'],
    dueDate: '2026-11-07', createdAt: 2005,
  },
  {
    id: 'card-s7', columnId: 'col-progress', order: 1,
    title: 'Real-time search & filter',
    description: 'Filter cards across all columns by title, description, tag, and priority.',
    priority: 'medium', tags: ['Feature', 'UX'],
    dueDate: '', createdAt: 2006,
  },
  {
    id: 'card-s8', columnId: 'col-progress', order: 2,
    title: 'Column reorder via drag',
    description: 'Allow dragging column headers to swap column positions on the board.',
    priority: 'low', tags: ['DnD', 'UX'],
    dueDate: '2026-11-15', createdAt: 2007,
  },
  {
    id: 'card-s9', columnId: 'col-done', order: 0,
    title: 'Responsive layout scaffolding',
    description: 'Horizontal scroll for desktop, vertical stacking for mobile viewports.',
    priority: 'medium', tags: ['CSS', 'Responsive'],
    dueDate: '2026-11-01', createdAt: 2008,
  },
  {
    id: 'card-s10', columnId: 'col-done', order: 1,
    title: 'Dark / light theme toggle',
    description: 'Persist theme preference in IndexedDB settings store.',
    priority: 'low', tags: ['UI', 'Accessibility'],
    dueDate: '2026-11-02', createdAt: 2009,
  },
];

/* ─── Database Class ────────────────────────────────────────────────────────── */
class TaskFlowDB {
  constructor() {
    this.idb    = null;                    // IDBDatabase reference
    this.engine = 'IndexedDB';             // reported to UI
    this.ready  = this._open();            // Promise that resolves when DB is usable
  }

  /* ── Open / Upgrade ───────────────────────────────────────────────────────── */
  _open() {
    return new Promise((resolve) => {
      if (!window.indexedDB) {
        this.engine = 'localStorage';
        this._seedLS();
        resolve();
        return;
      }

      const req = window.indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = ({ target: { result: db } }) => {
        if (!db.objectStoreNames.contains(STORE.COLUMNS)) {
          const cs = db.createObjectStore(STORE.COLUMNS, { keyPath: 'id' });
          cs.createIndex('order', 'order');
        }
        if (!db.objectStoreNames.contains(STORE.CARDS)) {
          const ks = db.createObjectStore(STORE.CARDS, { keyPath: 'id' });
          ks.createIndex('columnId', 'columnId');
          ks.createIndex('order',    'order');
          ks.createIndex('priority', 'priority');
        }
        if (!db.objectStoreNames.contains(STORE.SETTINGS)) {
          db.createObjectStore(STORE.SETTINGS, { keyPath: 'key' });
        }
      };

      req.onsuccess = async ({ target: { result: db } }) => {
        this.idb = db;
        await this._seedIDB();
        resolve();
      };

      req.onerror = () => {
        console.warn('IndexedDB open failed — falling back to localStorage');
        this.engine = 'localStorage';
        this._seedLS();
        resolve();
      };
    });
  }

  /* ── Seeding ──────────────────────────────────────────────────────────────── */
  async _seedIDB() {
    // Only seed if columns store is empty
    const cols = await this._idbGetAll(STORE.COLUMNS);
    if (cols.length > 0) return;

    const tx = this.idb.transaction([STORE.COLUMNS, STORE.CARDS, STORE.SETTINGS], 'readwrite');
    SEED_COLUMNS.forEach(c   => tx.objectStore(STORE.COLUMNS).put(c));
    SEED_CARDS.forEach(c     => tx.objectStore(STORE.CARDS).put(c));
    tx.objectStore(STORE.SETTINGS).put({ key: 'theme', value: 'dark' });
    await this._txDone(tx);
  }

  _seedLS() {
    if (!localStorage.getItem('tf_columns')) {
      localStorage.setItem('tf_columns',  JSON.stringify(SEED_COLUMNS));
      localStorage.setItem('tf_cards',    JSON.stringify(SEED_CARDS));
      localStorage.setItem('tf_settings', JSON.stringify({ theme: 'dark' }));
    }
  }

  /* ── Low-level IDB helpers ──────────────────────────────────────────────── */
  _idbGetAll(storeName) {
    return new Promise((resolve, reject) => {
      const tx  = this.idb.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror   = () => reject(req.error);
    });
  }

  _idbPut(storeName, record) {
    return new Promise((resolve, reject) => {
      const tx  = this.idb.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).put(record);
      req.onsuccess = () => resolve(record);
      req.onerror   = () => reject(req.error);
    });
  }

  _idbDelete(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx  = this.idb.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).delete(key);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }

  _txDone(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror    = () => reject(tx.error);
      tx.onabort    = () => reject(tx.error);
    });
  }

  /* ── localStorage helpers ───────────────────────────────────────────────── */
  _lsGet(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
  }
  _lsSet(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

  /* ── Columns ────────────────────────────────────────────────────────────── */
  async getColumns() {
    await this.ready;
    let cols;
    if (this.idb) {
      cols = await this._idbGetAll(STORE.COLUMNS);
    } else {
      cols = this._lsGet('tf_columns') || [];
    }
    return cols.sort((a, b) => a.order - b.order);
  }

  async saveColumn(col) {
    await this.ready;
    if (this.idb) return this._idbPut(STORE.COLUMNS, col);
    const all = this._lsGet('tf_columns') || [];
    const idx = all.findIndex(c => c.id === col.id);
    if (idx >= 0) all[idx] = col; else all.push(col);
    this._lsSet('tf_columns', all);
  }

  async deleteColumn(colId) {
    await this.ready;
    if (this.idb) {
      // Delete all cards in that column first
      const cards = await this._idbGetAll(STORE.CARDS);
      const tx = this.idb.transaction([STORE.COLUMNS, STORE.CARDS], 'readwrite');
      tx.objectStore(STORE.COLUMNS).delete(colId);
      cards.filter(c => c.columnId === colId).forEach(c => tx.objectStore(STORE.CARDS).delete(c.id));
      return this._txDone(tx);
    }
    const cols  = (this._lsGet('tf_columns') || []).filter(c => c.id !== colId);
    const cards = (this._lsGet('tf_cards')   || []).filter(c => c.columnId !== colId);
    this._lsSet('tf_columns', cols);
    this._lsSet('tf_cards',   cards);
  }

  async batchSaveColumns(columns) {
    await this.ready;
    if (this.idb) {
      const tx = this.idb.transaction(STORE.COLUMNS, 'readwrite');
      columns.forEach(c => tx.objectStore(STORE.COLUMNS).put(c));
      return this._txDone(tx);
    }
    this._lsSet('tf_columns', columns);
  }

  /* ── Cards ──────────────────────────────────────────────────────────────── */
  async getCards() {
    await this.ready;
    let cards;
    if (this.idb) {
      cards = await this._idbGetAll(STORE.CARDS);
    } else {
      cards = this._lsGet('tf_cards') || [];
    }
    return cards.sort((a, b) => a.order - b.order);
  }

  async saveCard(card) {
    await this.ready;
    card.updatedAt = Date.now();
    if (this.idb) return this._idbPut(STORE.CARDS, card);
    const all = this._lsGet('tf_cards') || [];
    const idx = all.findIndex(c => c.id === card.id);
    if (idx >= 0) all[idx] = card; else all.push(card);
    this._lsSet('tf_cards', all);
  }

  async deleteCard(cardId) {
    await this.ready;
    if (this.idb) return this._idbDelete(STORE.CARDS, cardId);
    const all = (this._lsGet('tf_cards') || []).filter(c => c.id !== cardId);
    this._lsSet('tf_cards', all);
  }

  async batchSaveCards(cards) {
    await this.ready;
    if (this.idb) {
      const tx = this.idb.transaction(STORE.CARDS, 'readwrite');
      const now = Date.now();
      cards.forEach(c => { c.updatedAt = now; tx.objectStore(STORE.CARDS).put(c); });
      return this._txDone(tx);
    }
    const all = this._lsGet('tf_cards') || [];
    cards.forEach(card => {
      card.updatedAt = Date.now();
      const idx = all.findIndex(c => c.id === card.id);
      if (idx >= 0) all[idx] = card; else all.push(card);
    });
    this._lsSet('tf_cards', all);
  }

  /* ── Settings ───────────────────────────────────────────────────────────── */
  async getSetting(key, fallback = null) {
    await this.ready;
    if (this.idb) {
      return new Promise(resolve => {
        const tx  = this.idb.transaction(STORE.SETTINGS, 'readonly');
        const req = tx.objectStore(STORE.SETTINGS).get(key);
        req.onsuccess = () => resolve(req.result ? req.result.value : fallback);
        req.onerror   = () => resolve(fallback);
      });
    }
    const s = this._lsGet('tf_settings') || {};
    return s[key] !== undefined ? s[key] : fallback;
  }

  async setSetting(key, value) {
    await this.ready;
    if (this.idb) return this._idbPut(STORE.SETTINGS, { key, value });
    const s = this._lsGet('tf_settings') || {};
    s[key] = value;
    this._lsSet('tf_settings', s);
  }

  /* ── Maintenance ────────────────────────────────────────────────────────── */
  async getStats() {
    const [columns, cards] = await Promise.all([this.getColumns(), this.getCards()]);
    return { engine: this.engine, dbName: DB_NAME, columns: columns.length, cards: cards.length };
  }

  async exportJSON() {
    const [columns, cards] = await Promise.all([this.getColumns(), this.getCards()]);
    return JSON.stringify({ version: DB_VERSION, exportedAt: new Date().toISOString(), columns, cards }, null, 2);
  }

  async importJSON(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      if (!Array.isArray(data.columns) || !Array.isArray(data.cards)) throw new Error('Invalid file structure');
      await this.clearAll();
      await this.batchSaveColumns(data.columns);
      await this.batchSaveCards(data.cards);
      return { ok: true, columns: data.columns.length, cards: data.cards.length };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async clearAll() {
    await this.ready;
    if (this.idb) {
      const tx = this.idb.transaction([STORE.COLUMNS, STORE.CARDS, STORE.SETTINGS], 'readwrite');
      tx.objectStore(STORE.COLUMNS).clear();
      tx.objectStore(STORE.CARDS).clear();
      tx.objectStore(STORE.SETTINGS).clear();
      return this._txDone(tx);
    }
    localStorage.removeItem('tf_columns');
    localStorage.removeItem('tf_cards');
    localStorage.removeItem('tf_settings');
  }

  async resetToDefaults() {
    await this.clearAll();
    if (this.idb) {
      await this._seedIDB();
    } else {
      this._seedLS();
    }
  }
}

/* ─── Singleton ─────────────────────────────────────────────────────────────── */
window.db = new TaskFlowDB();
