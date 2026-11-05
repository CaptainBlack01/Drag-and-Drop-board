/**
 * app.js — TaskFlow Board Logic
 * Pure Vanilla JavaScript + HTML5 Drag & Drop API
 * Data powered by TaskFlowDB (IndexedDB · no backend)
 */

'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════════════════ */
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;');
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/* ═══════════════════════════════════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════════════════════════════════ */
const toastContainer = document.getElementById('toasts');

function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast t-${type}`;
  el.textContent = msg;
  toastContainer.appendChild(el);

  setTimeout(() => {
    el.classList.add('hiding');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
  }, 2600);
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODAL HELPERS
═══════════════════════════════════════════════════════════════════════════ */
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

// Close on backdrop click
document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) backdrop.classList.remove('open');
  });
});

// Close on Escape key
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-backdrop.open').forEach(m => m.classList.remove('open'));
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   CONFIRM DIALOG
═══════════════════════════════════════════════════════════════════════════ */
let confirmResolve = null;

function confirm(title, msg) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMsg').textContent   = msg;
  openModal('confirmModal');
  return new Promise(resolve => { confirmResolve = resolve; });
}

document.getElementById('confirmOK').addEventListener('click', () => {
  closeModal('confirmModal');
  if (confirmResolve) { confirmResolve(true); confirmResolve = null; }
});
document.getElementById('confirmCancel').addEventListener('click', () => {
  closeModal('confirmModal');
  if (confirmResolve) { confirmResolve(false); confirmResolve = null; }
});

/* ═══════════════════════════════════════════════════════════════════════════
   APP STATE
═══════════════════════════════════════════════════════════════════════════ */
let columns  = [];
let cards    = [];
let filter   = { query: '', priority: '' };

// Active drag info
let drag = {
  type:      null,  // 'card' | 'column'
  id:        null,
  sourceCol: null,
};

// Reusable drop placeholder element
const placeholder = document.createElement('div');
placeholder.className = 'drop-placeholder';

/* ═══════════════════════════════════════════════════════════════════════════
   BOARD RENDER
═══════════════════════════════════════════════════════════════════════════ */
const board = document.getElementById('board');

async function loadBoard() {
  [columns, cards] = await Promise.all([db.getColumns(), db.getCards()]);
  renderBoard();
}

function renderBoard() {
  board.innerHTML = '';

  columns.forEach(col => board.appendChild(buildColumn(col)));

  // "Add column" tile
  const tile = document.createElement('div');
  tile.className = 'add-col-tile';
  tile.innerHTML = `
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
    <span>Add Column</span>
  `;
  tile.addEventListener('click', () => openColModal());
  board.appendChild(tile);
}

/* ─── Column element ─────────────────────────────────────────────────────── */
function buildColumn(col) {
  const colCards = cards.filter(c => c.columnId === col.id);

  const el = document.createElement('div');
  el.className = 'column';
  el.dataset.colId = col.id;

  // ── Header ──
  const header = document.createElement('div');
  header.className = 'col-header';
  header.draggable = true;
  header.innerHTML = `
    <div class="col-header-left">
      <span class="col-grip" title="Drag to reorder column">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <circle cx="9" cy="5"  r="1.2"/><circle cx="15" cy="5"  r="1.2"/>
          <circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/>
          <circle cx="9" cy="19" r="1.2"/><circle cx="15" cy="19" r="1.2"/>
        </svg>
      </span>
      <span class="col-title" data-col-id="${col.id}"
            contenteditable="false"
            title="Click to rename">${esc(col.title)}</span>
      <span class="col-count" id="count-${col.id}">${colCards.length}</span>
    </div>
    <div class="col-actions">
      <button class="col-btn add-card-btn" title="Add card to this column">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
      <button class="col-btn del" title="Delete column">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
    </div>
  `;

  // Inline rename ──────────────────────────────────────
  const titleSpan = header.querySelector('.col-title');

  titleSpan.addEventListener('click', e => {
    e.stopPropagation();
    // Don't start edit if we're dragging
    if (drag.type === 'column') return;
    titleSpan.contentEditable = 'true';
    titleSpan.focus();
    // Select all
    const range = document.createRange();
    range.selectNodeContents(titleSpan);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  });

  const finishRename = async () => {
    titleSpan.contentEditable = 'false';
    const newTitle = titleSpan.textContent.trim();
    if (newTitle && newTitle !== col.title) {
      col.title = newTitle;
      await db.saveColumn(col);
      toast(`Renamed to "${newTitle}"`, 'success');
    } else {
      titleSpan.textContent = esc(col.title);
    }
  };

  titleSpan.addEventListener('blur', finishRename);
  titleSpan.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); titleSpan.blur(); }
    if (e.key === 'Escape') { titleSpan.textContent = esc(col.title); titleSpan.contentEditable = 'false'; }
  });

  // Column drag (reorder) ──────────────────────────────
  header.addEventListener('dragstart', e => {
    if (titleSpan.contentEditable === 'true') { e.preventDefault(); return; }
    drag.type = 'column';
    drag.id   = col.id;
    el.classList.add('col-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', col.id);
  });

  header.addEventListener('dragend', () => {
    drag.type = null; drag.id = null;
    el.classList.remove('col-dragging');
    document.querySelectorAll('.col-drag-over').forEach(c => c.classList.remove('col-drag-over'));
  });

  el.addEventListener('dragover', e => {
    if (drag.type !== 'column' || drag.id === col.id) return;
    e.preventDefault();
    el.classList.add('col-drag-over');
  });

  el.addEventListener('dragleave', e => {
    if (!el.contains(e.relatedTarget)) el.classList.remove('col-drag-over');
  });

  el.addEventListener('drop', async e => {
    if (drag.type !== 'column' || drag.id === col.id) return;
    e.preventDefault();
    el.classList.remove('col-drag-over');

    const srcIdx = columns.findIndex(c => c.id === drag.id);
    const dstIdx = columns.findIndex(c => c.id === col.id);
    if (srcIdx < 0 || dstIdx < 0) return;

    const [moved] = columns.splice(srcIdx, 1);
    columns.splice(dstIdx, 0, moved);
    columns.forEach((c, i) => c.order = i);
    await db.batchSaveColumns(columns);
    toast('Column reordered', 'info');
    renderBoard();
  });

  // Add card button ──────────────────────────────────────
  header.querySelector('.add-card-btn').addEventListener('click', () => openCardModal(null, col.id));

  // Delete column button ─────────────────────────────────
  header.querySelector('.col-btn.del').addEventListener('click', async () => {
    const ok = await confirm(
      'Delete Column',
      `Delete "${col.title}" and its ${colCards.length} card(s)? This cannot be undone.`
    );
    if (!ok) return;
    await db.deleteColumn(col.id);
    toast(`"${col.title}" deleted`, 'info');
    await loadBoard();
  });

  // ── Cards list ──
  const list = document.createElement('div');
  list.className = 'cards-list';
  list.dataset.colId = col.id;

  const visibleCards = colCards.filter(c => isVisible(c));
  const allHidden    = colCards.length > 0 && visibleCards.length === 0;

  if (colCards.length === 0) {
    list.appendChild(emptyState('Drop cards here'));
  } else if (allHidden) {
    list.appendChild(emptyState('No cards match the filter'));
  } else {
    colCards.forEach(card => {
      const cardEl = buildCard(card);
      if (!isVisible(card)) cardEl.style.display = 'none';
      list.appendChild(cardEl);
    });
  }

  // Card drop zone ───────────────────────────────────────
  list.addEventListener('dragover', e => {
    if (drag.type !== 'card') return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    list.classList.add('drop-active');

    const after = getAfterElement(list, e.clientY);
    if (after == null) {
      list.appendChild(placeholder);
    } else {
      list.insertBefore(placeholder, after);
    }
  });

  list.addEventListener('dragleave', e => {
    if (!list.contains(e.relatedTarget)) {
      list.classList.remove('drop-active');
    }
  });

  list.addEventListener('drop', async e => {
    if (drag.type !== 'card') return;
    e.preventDefault();
    e.stopPropagation();
    list.classList.remove('drop-active');

    const movedCard = cards.find(c => c.id === drag.id);
    if (!movedCard) return;

    const oldColId = movedCard.columnId;
    const newColId = col.id;

    // Calculate new order from placeholder position (excluding hidden/placeholder nodes)
    const cardNodes = [...list.querySelectorAll('.card')]; // visible .card elements before drop
    const phIdx     = [...list.children].indexOf(placeholder);

    // Remove placeholder
    if (placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);

    // Build the new ordered list for destination column
    movedCard.columnId = newColId;

    let destCards = cards
      .filter(c => c.columnId === newColId && c.id !== movedCard.id)
      .sort((a, b) => a.order - b.order);

    // Count how many actual card DOM nodes are before placeholder
    const nodesBeforePh = [...list.children].slice(0, phIdx).filter(n => n.classList.contains('card'));
    const insertAt = nodesBeforePh.length;

    destCards.splice(Math.max(0, insertAt), 0, movedCard);
    destCards.forEach((c, i) => c.order = i);

    let toUpdate = [...destCards];

    if (oldColId !== newColId) {
      const srcCards = cards
        .filter(c => c.columnId === oldColId && c.id !== movedCard.id)
        .sort((a, b) => a.order - b.order);
      srcCards.forEach((c, i) => c.order = i);
      toUpdate = toUpdate.concat(srcCards);
    }

    await db.batchSaveCards(toUpdate);

    const targetCol = columns.find(c => c.id === newColId);
    toast(`Moved to "${targetCol ? targetCol.title : 'column'}"`, 'info');
    await loadBoard();
  });

  // ── Footer quick-add ──
  const footer = document.createElement('div');
  footer.className = 'col-footer';
  footer.innerHTML = `
    <button class="quick-btn" aria-label="Quick add card">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      Add a card
    </button>
    <div class="quick-form">
      <textarea class="quick-textarea" rows="2" placeholder="Card title (Enter to add)…"></textarea>
      <div class="quick-row">
        <button type="button" class="btn btn-green quick-save" style="font-size:.78rem;padding:.32rem .6rem">Add</button>
        <button type="button" class="btn btn-ghost quick-cancel" style="font-size:.78rem;padding:.32rem .6rem">Cancel</button>
      </div>
    </div>
  `;

  const qBtn    = footer.querySelector('.quick-btn');
  const qForm   = footer.querySelector('.quick-form');
  const qTA     = footer.querySelector('.quick-textarea');
  const qSave   = footer.querySelector('.quick-save');
  const qCancel = footer.querySelector('.quick-cancel');

  const openQuick  = ()    => { qBtn.style.display = 'none'; qForm.classList.add('open'); qTA.focus(); };
  const closeQuick = ()    => { qTA.value = ''; qForm.classList.remove('open'); qBtn.style.display = ''; };

  qBtn.addEventListener('click', openQuick);
  qCancel.addEventListener('click', closeQuick);

  const submitQuick = async () => {
    const title = qTA.value.trim();
    if (!title) return;
    const colCards = cards.filter(c => c.columnId === col.id);
    const newCard = {
      id: 'card-' + uid(),
      columnId: col.id,
      title,
      description: '',
      priority: 'medium',
      tags: [],
      dueDate: '',
      order: colCards.length,
      createdAt: Date.now(),
    };
    await db.saveCard(newCard);
    toast('Card added', 'success');
    closeQuick();
    await loadBoard();
  };

  qSave.addEventListener('click', submitQuick);
  qTA.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitQuick(); }
    if (e.key === 'Escape') closeQuick();
  });

  el.appendChild(header);
  el.appendChild(list);
  el.appendChild(footer);
  return el;
}

/* ─── Card element ───────────────────────────────────────────────────────── */
function buildCard(card) {
  const el = document.createElement('div');
  el.className = 'card';
  el.draggable  = true;
  el.dataset.cardId = card.id;

  // Due date status
  let dueHtml = '';
  if (card.dueDate) {
    const today = todayISO();
    let cls = '';
    if (card.dueDate < today)      cls = 'overdue';
    else if (card.dueDate === today) cls = 'today';
    dueHtml = `
      <span class="due ${cls}" title="Due: ${card.dueDate}">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        ${fmtDate(card.dueDate)}
      </span>`;
  }

  // Tags
  const tagsHtml = (card.tags || []).length
    ? `<div style="display:flex;flex-wrap:wrap;gap:.25rem">${card.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>`
    : '';

  el.innerHTML = `
    <div class="card-top">
      <span class="priority-badge pb-${card.priority || 'medium'}">${card.priority || 'medium'}</span>
      <div class="card-actions">
        <button class="card-act-btn edit" title="Edit card">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>
          </svg>
        </button>
        <button class="card-act-btn del" title="Delete card">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="card-title">${esc(card.title)}</div>
    ${card.description ? `<div class="card-desc">${esc(card.description)}</div>` : ''}
    ${(tagsHtml || dueHtml) ? `<div class="card-footer">${tagsHtml}${dueHtml}</div>` : ''}
  `;

  // Click to open edit (but not on action buttons)
  el.addEventListener('click', e => {
    if (e.target.closest('.card-actions')) return;
    openCardModal(card.id);
  });

  el.querySelector('.edit').addEventListener('click', e => {
    e.stopPropagation();
    openCardModal(card.id);
  });

  el.querySelector('.del').addEventListener('click', async e => {
    e.stopPropagation();
    const ok = await confirm('Delete Card', `Delete "${card.title}"? This cannot be undone.`);
    if (!ok) return;
    await db.deleteCard(card.id);
    toast('Card deleted', 'info');
    await loadBoard();
  });

  // Drag events
  el.addEventListener('dragstart', e => {
    drag.type      = 'card';
    drag.id        = card.id;
    drag.sourceCol = card.columnId;
    el.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.id);
  });

  el.addEventListener('dragend', () => {
    drag.type = null; drag.id = null; drag.sourceCol = null;
    el.classList.remove('dragging');
    if (placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
    document.querySelectorAll('.drop-active').forEach(l => l.classList.remove('drop-active'));
  });

  return el;
}

/* ─── Drop position helper ───────────────────────────────────────────────── */
function getAfterElement(container, y) {
  const els = [...container.querySelectorAll('.card:not(.dragging)')];
  let best = { offset: Number.NEGATIVE_INFINITY, el: null };
  for (const el of els) {
    const box    = el.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > best.offset) {
      best = { offset, el };
    }
  }
  return best.el;
}

/* ─── Visibility filter ──────────────────────────────────────────────────── */
function isVisible(card) {
  if (filter.priority && card.priority !== filter.priority) return false;
  if (!filter.query) return true;
  const q = filter.query.toLowerCase();
  return (
    card.title.toLowerCase().includes(q) ||
    (card.description || '').toLowerCase().includes(q) ||
    (card.tags || []).some(t => t.toLowerCase().includes(q))
  );
}

function emptyState(text) {
  const el = document.createElement('div');
  el.className = 'empty-state';
  el.textContent = text;
  return el;
}

function applyFilter() {
  columns.forEach(col => {
    const colEl = board.querySelector(`.column[data-col-id="${col.id}"]`);
    if (!colEl) return;

    const colCards = cards.filter(c => c.columnId === col.id);
    let visible = 0;

    colCards.forEach(card => {
      const cardEl = colEl.querySelector(`.card[data-card-id="${card.id}"]`);
      if (!cardEl) return;
      const show = isVisible(card);
      cardEl.style.display = show ? '' : 'none';
      if (show) visible++;
    });

    const count = colEl.querySelector('.col-count');
    if (count) count.textContent = visible;
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   CARD MODAL
═══════════════════════════════════════════════════════════════════════════ */
const cardModal    = document.getElementById('cardModal');
const cardForm     = document.getElementById('cardForm');
const cardIdInp    = document.getElementById('cardId');
const fCardTitle   = document.getElementById('fCardTitle');
const fCardColumn  = document.getElementById('fCardColumn');
const fCardDue     = document.getElementById('fCardDue');
const fCardTags    = document.getElementById('fCardTags');
const fCardDesc    = document.getElementById('fCardDesc');
const cardDeleteBtn = document.getElementById('cardDeleteBtn');

function populateColumnSelect(selectedId) {
  fCardColumn.innerHTML = '';
  columns.forEach(col => {
    const opt = document.createElement('option');
    opt.value       = col.id;
    opt.textContent = col.title;
    if (col.id === selectedId) opt.selected = true;
    fCardColumn.appendChild(opt);
  });
}

function openCardModal(cardId = null, preColId = null) {
  cardForm.reset();

  const defaultColId = preColId || (columns[0] ? columns[0].id : '');
  populateColumnSelect(defaultColId);
  cardDeleteBtn.style.display = 'none';

  if (cardId) {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;
    document.getElementById('cardModalTitle').textContent = 'Edit Card';
    cardIdInp.value      = card.id;
    fCardTitle.value     = card.title;
    fCardColumn.value    = card.columnId;
    fCardDue.value       = card.dueDate || '';
    fCardTags.value      = (card.tags || []).join(', ');
    fCardDesc.value      = card.description || '';
    const pRadio = cardForm.querySelector(`input[name="cardPriority"][value="${card.priority || 'medium'}"]`);
    if (pRadio) pRadio.checked = true;
    cardDeleteBtn.style.display = 'inline-flex';
  } else {
    document.getElementById('cardModalTitle').textContent = 'New Card';
    cardIdInp.value = '';
    const med = cardForm.querySelector('input[name="cardPriority"][value="medium"]');
    if (med) med.checked = true;
  }

  openModal('cardModal');
  setTimeout(() => fCardTitle.focus(), 60);
}

cardForm.addEventListener('submit', async e => {
  e.preventDefault();
  const title = fCardTitle.value.trim();
  if (!title) { fCardTitle.focus(); return; }

  const id       = cardIdInp.value;
  const columnId = fCardColumn.value;
  const dueDate  = fCardDue.value;
  const priority = (cardForm.querySelector('input[name="cardPriority"]:checked') || {}).value || 'medium';
  const tags     = fCardTags.value.split(',').map(t => t.trim()).filter(Boolean);
  const description = fCardDesc.value.trim();

  if (id) {
    // Update
    const card = cards.find(c => c.id === id);
    if (card) {
      Object.assign(card, { title, columnId, dueDate, priority, tags, description });
      await db.saveCard(card);
      toast('Card updated', 'success');
    }
  } else {
    // Create
    const colCards = cards.filter(c => c.columnId === columnId);
    await db.saveCard({
      id: 'card-' + uid(),
      columnId, title, description, priority, tags, dueDate,
      order: colCards.length,
      createdAt: Date.now(),
    });
    toast('Card created', 'success');
  }

  closeModal('cardModal');
  await loadBoard();
});

cardDeleteBtn.addEventListener('click', async () => {
  const id = cardIdInp.value;
  const card = cards.find(c => c.id === id);
  if (!card) return;
  const ok = await confirm('Delete Card', `Delete "${card.title}"? This cannot be undone.`);
  if (!ok) return;
  closeModal('cardModal');
  await db.deleteCard(id);
  toast('Card deleted', 'info');
  await loadBoard();
});

document.getElementById('cardModalClose').addEventListener('click', () => closeModal('cardModal'));
document.getElementById('cardCancelBtn').addEventListener('click',  () => closeModal('cardModal'));

/* ═══════════════════════════════════════════════════════════════════════════
   COLUMN MODAL
═══════════════════════════════════════════════════════════════════════════ */
const colForm  = document.getElementById('colForm');
const fColName = document.getElementById('fColName');

function openColModal() {
  colForm.reset();
  openModal('colModal');
  setTimeout(() => fColName.focus(), 60);
}

colForm.addEventListener('submit', async e => {
  e.preventDefault();
  const title = fColName.value.trim();
  if (!title) { fColName.focus(); return; }
  await db.saveColumn({ id: 'col-' + uid(), title, order: columns.length, createdAt: Date.now() });
  toast(`Column "${title}" created`, 'success');
  closeModal('colModal');
  await loadBoard();
});

document.getElementById('colModalClose').addEventListener('click', () => closeModal('colModal'));
document.getElementById('colCancelBtn').addEventListener('click',  () => closeModal('colModal'));

/* ═══════════════════════════════════════════════════════════════════════════
   DB INSPECTOR MODAL
═══════════════════════════════════════════════════════════════════════════ */
async function openDBModal() {
  const stats = await db.getStats();
  document.getElementById('dbEngine').textContent   = stats.engine;
  document.getElementById('dbColCount').textContent  = stats.columns;
  document.getElementById('dbCardCount').textContent = stats.cards;
  openModal('dbModal');
}

document.getElementById('dbPill').addEventListener('click', openDBModal);
document.getElementById('btnDB').addEventListener('click',  openDBModal);
document.getElementById('dbModalClose').addEventListener('click',  () => closeModal('dbModal'));
document.getElementById('dbModalClose2').addEventListener('click', () => closeModal('dbModal'));

// Export
document.getElementById('btnExport').addEventListener('click', async () => {
  const json = await db.exportJSON();
  const a    = Object.assign(document.createElement('a'), {
    href:     URL.createObjectURL(new Blob([json], { type: 'application/json' })),
    download: `taskflow-backup-${todayISO()}.json`,
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  toast('Database exported', 'success');
});

// Import
document.getElementById('importFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  const text   = await file.text();
  const result = await db.importJSON(text);
  e.target.value = '';
  if (result.ok) {
    toast(`Imported ${result.columns} columns, ${result.cards} cards`, 'success');
    closeModal('dbModal');
    await loadBoard();
  } else {
    toast(`Import failed: ${result.error}`, 'error');
  }
});

// Reset
document.getElementById('btnResetDB').addEventListener('click', async () => {
  const ok = await confirm('Reset to Defaults', 'Replace current board with sample data? All current data will be lost.');
  if (!ok) return;
  await db.resetToDefaults();
  toast('Reset to default data', 'info');
  closeModal('dbModal');
  await loadBoard();
});

// Clear
document.getElementById('btnClearDB').addEventListener('click', async () => {
  const ok = await confirm('Clear All Data', 'This will delete everything from the database. Continue?');
  if (!ok) return;
  await db.clearAll();
  toast('All data cleared', 'info');
  closeModal('dbModal');
  await loadBoard();
});

/* ═══════════════════════════════════════════════════════════════════════════
   HEADER CONTROLS
═══════════════════════════════════════════════════════════════════════════ */
document.getElementById('btnAddCard').addEventListener('click',   () => openCardModal());
document.getElementById('btnAddColumn').addEventListener('click', () => openColModal());

// Search
document.getElementById('searchInput').addEventListener('input', e => {
  filter.query = e.target.value.trim();
  applyFilter();
});

// Priority filter
document.getElementById('priorityFilter').addEventListener('change', e => {
  filter.priority = e.target.value;
  applyFilter();
});

/* ═══════════════════════════════════════════════════════════════════════════
   THEME TOGGLE
═══════════════════════════════════════════════════════════════════════════ */
const SUN_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="5"/>
  <line x1="12" y1="1"  x2="12" y2="3"/>  <line x1="12" y1="21" x2="12" y2="23"/>
  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
  <line x1="1"  y1="12" x2="3"  y2="12"/>  <line x1="21" y1="12" x2="23" y2="12"/>
  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
</svg>`;

const MOON_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
</svg>`;

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('btnTheme').innerHTML = theme === 'dark' ? SUN_SVG : MOON_SVG;
}

document.getElementById('btnTheme').addEventListener('click', async () => {
  const current  = document.documentElement.getAttribute('data-theme') || 'dark';
  const next     = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  await db.setSetting('theme', next);
});

/* ═══════════════════════════════════════════════════════════════════════════
   BOOT
═══════════════════════════════════════════════════════════════════════════ */
(async () => {
  // Wait for DB to be ready
  await db.ready;

  // Apply saved theme
  const theme = await db.getSetting('theme', 'dark');
  applyTheme(theme);

  // Update DB pill label
  document.getElementById('dbPillLabel').textContent = db.engine;

  // Load board
  await loadBoard();

  // Prevent browser navigation on stray drops
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop',     e => e.preventDefault());
})();
