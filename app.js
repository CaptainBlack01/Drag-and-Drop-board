/**
 * app.js - Drag and Drop Board Application Logic
 * Pure Vanilla JavaScript & HTML5 Drag and Drop API
 * Powered by client-side Web Page Database (IndexedDB)
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Ensure DB instance is ready
  await window.db.readyPromise;

  // State
  let columns = [];
  let cards = [];
  let searchQuery = '';
  let priorityFilter = 'all';
  let draggedCardId = null;
  let draggedColumnId = null;

  // Placeholder element for visual drop indicator
  const dropPlaceholder = document.createElement('div');
  dropPlaceholder.className = 'drop-placeholder';

  // DOM Elements
  const boardContainer = document.getElementById('boardContainer');
  const dbStatusBadge = document.getElementById('dbStatusBadge');
  const dbStatusText = document.getElementById('dbStatusText');
  const searchInput = document.getElementById('searchInput');
  const priorityFilterSelect = document.getElementById('priorityFilter');
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const toastContainer = document.getElementById('toastContainer');

  // Modals
  const cardModal = document.getElementById('cardModal');
  const cardForm = document.getElementById('cardForm');
  const cardModalTitle = document.getElementById('cardModalTitle');
  const cardIdInput = document.getElementById('cardId');
  const cardTitleInput = document.getElementById('cardTitleInput');
  const cardColumnSelect = document.getElementById('cardColumnSelect');
  const cardDueDateInput = document.getElementById('cardDueDateInput');
  const cardTagsInput = document.getElementById('cardTagsInput');
  const cardDescInput = document.getElementById('cardDescInput');
  const deleteCardModalBtn = document.getElementById('deleteCardModalBtn');

  const columnModal = document.getElementById('columnModal');
  const columnForm = document.getElementById('columnForm');
  const columnTitleInput = document.getElementById('columnTitleInput');

  const dbModal = document.getElementById('dbModal');
  const dbInspectorBtn = document.getElementById('dbInspectorBtn');
  const dbEngineVal = document.getElementById('dbEngineVal');
  const dbColCountVal = document.getElementById('dbColCountVal');
  const dbCardCountVal = document.getElementById('dbCardCountVal');
  const exportDbBtn = document.getElementById('exportDbBtn');
  const importDbInput = document.getElementById('importDbInput');
  const resetDbBtn = document.getElementById('resetDbBtn');
  const clearDbBtn = document.getElementById('clearDbBtn');

  const confirmModal = document.getElementById('confirmModal');
  const confirmModalTitle = document.getElementById('confirmModalTitle');
  const confirmModalMessage = document.getElementById('confirmModalMessage');
  const acceptConfirmBtn = document.getElementById('acceptConfirmBtn');
  const cancelConfirmBtn = document.getElementById('cancelConfirmBtn');
  let confirmCallback = null;

  // ========================================================================
  // Initialization
  // ========================================================================
  async function initApp() {
    // Apply saved theme
    const savedTheme = await window.db.getSetting('theme', 'dark');
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    // Update DB status badge
    dbStatusText.textContent = window.db.engine;

    // Load and render data
    await refreshBoard();

    // Event listeners
    setupEventListeners();
  }

  // ========================================================================
  // Board Data & Rendering
  // ========================================================================
  async function refreshBoard() {
    columns = await window.db.getAllColumns();
    cards = await window.db.getAllCards();
    renderBoard();
  }

  function renderBoard() {
    boardContainer.innerHTML = '';

    // Render each column
    columns.forEach(col => {
      const colElement = createColumnElement(col);
      boardContainer.appendChild(colElement);
    });

    // Render "Add Column" card button at the end
    const addColCard = document.createElement('div');
    addColCard.className = 'add-column-card';
    addColCard.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
      <span style="font-weight: 600; font-size: 0.95rem;">Add New Column</span>
    `;
    addColCard.addEventListener('click', () => openColumnModal());
    boardContainer.appendChild(addColCard);
  }

  function createColumnElement(col) {
    const colDiv = document.createElement('div');
    colDiv.className = 'column';
    colDiv.dataset.columnId = col.id;

    // Cards belonging to this column
    const colCards = cards.filter(c => c.columnId === col.id);

    // Column Header
    const header = document.createElement('div');
    header.className = 'column-header';
    header.setAttribute('draggable', 'true');
    header.innerHTML = `
      <div class="column-header-left">
        <span class="column-drag-handle" title="Drag to reorder column">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="9" cy="12" r="1"></circle>
            <circle cx="9" cy="5" r="1"></circle>
            <circle cx="9" cy="19" r="1"></circle>
            <circle cx="15" cy="12" r="1"></circle>
            <circle cx="15" cy="5" r="1"></circle>
            <circle cx="15" cy="19" r="1"></circle>
          </svg>
        </span>
        <span class="column-title" title="Click to rename column">${escapeHtml(col.title)}</span>
        <span class="column-counter" id="counter-${col.id}">${colCards.length}</span>
      </div>
      <div class="column-actions">
        <button class="column-action-btn add-card-col-btn" title="Add task to this column">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
        <button class="column-action-btn btn-delete delete-col-btn" title="Delete column">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `;

    // Column inline rename handler
    const titleSpan = header.querySelector('.column-title');
    titleSpan.addEventListener('click', (e) => {
      e.stopPropagation();
      titleSpan.contentEditable = 'true';
      titleSpan.focus();
      // Select all text
      const range = document.createRange();
      range.selectNodeContents(titleSpan);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });

    const finishRename = async () => {
      titleSpan.contentEditable = 'false';
      const newTitle = titleSpan.textContent.trim();
      if (newTitle && newTitle !== col.title) {
        col.title = newTitle;
        await window.db.saveColumn(col);
        showToast(`Column renamed to "${newTitle}"`, 'success');
      } else {
        titleSpan.textContent = col.title;
      }
    };

    titleSpan.addEventListener('blur', finishRename);
    titleSpan.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        titleSpan.blur();
      } else if (e.key === 'Escape') {
        titleSpan.textContent = col.title;
        titleSpan.contentEditable = 'false';
      }
    });

    // Column Drag and Drop (reordering columns)
    header.addEventListener('dragstart', (e) => {
      // Don't drag if user was clicking title to edit
      if (titleSpan.contentEditable === 'true') {
        e.preventDefault();
        return;
      }
      draggedColumnId = col.id;
      colDiv.classList.add('column-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/column-id', col.id);
    });

    header.addEventListener('dragend', () => {
      draggedColumnId = null;
      colDiv.classList.remove('column-dragging');
      document.querySelectorAll('.column').forEach(c => c.classList.remove('column-drag-over'));
    });

    colDiv.addEventListener('dragover', (e) => {
      if (!draggedColumnId || draggedColumnId === col.id) return;
      e.preventDefault();
      colDiv.classList.add('column-drag-over');
    });

    colDiv.addEventListener('dragleave', () => {
      colDiv.classList.remove('column-drag-over');
    });

    colDiv.addEventListener('drop', async (e) => {
      if (!draggedColumnId || draggedColumnId === col.id) return;
      e.preventDefault();
      colDiv.classList.remove('column-drag-over');

      const sourceIdx = columns.findIndex(c => c.id === draggedColumnId);
      const targetIdx = columns.findIndex(c => c.id === col.id);
      if (sourceIdx >= 0 && targetIdx >= 0) {
        const [movedCol] = columns.splice(sourceIdx, 1);
        columns.splice(targetIdx, 0, movedCol);
        // Re-assign order numbers
        columns.forEach((c, idx) => c.order = idx);
        await window.db.batchUpdateColumns(columns);
        showToast('Columns reordered', 'info');
        renderBoard();
      }
    });

    // Header buttons
    const addCardBtn = header.querySelector('.add-card-col-btn');
    addCardBtn.addEventListener('click', () => openCardModal(null, col.id));

    const deleteColBtn = header.querySelector('.delete-col-btn');
    deleteColBtn.addEventListener('click', () => {
      openConfirmModal(
        'Delete Column',
        `Are you sure you want to delete "${col.title}" and its ${colCards.length} tasks? This cannot be undone.`,
        async () => {
          await window.db.deleteColumn(col.id);
          showToast(`Column "${col.title}" deleted`, 'info');
          await refreshBoard();
        }
      );
    });

    // Cards list container
    const cardsList = document.createElement('div');
    cardsList.className = 'cards-list';
    cardsList.dataset.columnId = col.id;

    // Filter and append cards
    let visibleCardsCount = 0;
    colCards.forEach(card => {
      const isVisible = checkCardVisibility(card);
      const cardEl = createCardElement(card);
      if (!isVisible) {
        cardEl.style.display = 'none';
      } else {
        visibleCardsCount++;
      }
      cardsList.appendChild(cardEl);
    });

    // Empty state placeholder
    if (colCards.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'empty-column-state';
      emptyDiv.textContent = 'No tasks in this column';
      cardsList.appendChild(emptyDiv);
    }

    // Card Drag & Drop onto this column
    setupCardsListDropEvents(cardsList, col.id);

    // Column Footer with Quick Add Input
    const footer = document.createElement('div');
    footer.className = 'column-footer';
    footer.innerHTML = `
      <button class="quick-add-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        <span>Add a task</span>
      </button>
      <div class="quick-add-form">
        <textarea class="quick-add-input" rows="2" placeholder="Task title..."></textarea>
        <div class="quick-add-actions">
          <button class="btn btn-primary btn-save-quick" style="padding: 0.35rem 0.65rem; font-size: 0.8rem;">Add</button>
          <button class="btn btn-secondary btn-cancel-quick" style="padding: 0.35rem 0.65rem; font-size: 0.8rem;">Cancel</button>
        </div>
      </div>
    `;

    const quickBtn = footer.querySelector('.quick-add-btn');
    const quickForm = footer.querySelector('.quick-add-form');
    const quickInput = footer.querySelector('.quick-add-input');
    const saveQuickBtn = footer.querySelector('.btn-save-quick');
    const cancelQuickBtn = footer.querySelector('.btn-cancel-quick');

    quickBtn.addEventListener('click', () => {
      quickBtn.style.display = 'none';
      quickForm.classList.add('active');
      quickInput.focus();
    });

    const closeQuick = () => {
      quickInput.value = '';
      quickForm.classList.remove('active');
      quickBtn.style.display = 'flex';
    };

    cancelQuickBtn.addEventListener('click', closeQuick);

    const submitQuickCard = async () => {
      const title = quickInput.value.trim();
      if (!title) return;
      const colCardsNow = cards.filter(c => c.columnId === col.id);
      const newCard = {
        id: 'card-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        columnId: col.id,
        title,
        description: '',
        priority: 'medium',
        tags: [],
        dueDate: '',
        order: colCardsNow.length,
        createdAt: Date.now()
      };
      await window.db.saveCard(newCard);
      showToast('Task created', 'success');
      closeQuick();
      await refreshBoard();
    };

    saveQuickBtn.addEventListener('click', submitQuickCard);
    quickInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitQuickCard();
      } else if (e.key === 'Escape') {
        closeQuick();
      }
    });

    colDiv.appendChild(header);
    colDiv.appendChild(cardsList);
    colDiv.appendChild(footer);

    return colDiv;
  }

  // ========================================================================
  // Card Component & HTML5 Drag and Drop
  // ========================================================================
  function createCardElement(card) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.setAttribute('draggable', 'true');
    cardEl.dataset.cardId = card.id;

    // Format Due Date
    let dueDateHtml = '';
    if (card.dueDate) {
      const today = new Date().toISOString().split('T')[0];
      let dueClass = '';
      if (card.dueDate < today) {
        dueClass = 'overdue';
      } else if (card.dueDate === today) {
        dueClass = 'today';
      }
      const dateFormatted = formatDisplayDate(card.dueDate);
      dueDateHtml = `
        <span class="due-badge ${dueClass}" title="Due: ${card.dueDate}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span>${dateFormatted}</span>
        </span>
      `;
    }

    // Format Tags
    let tagsHtml = '';
    if (card.tags && card.tags.length > 0) {
      tagsHtml = `
        <div class="card-tags">
          ${card.tags.map(t => `<span class="tag-badge">#${escapeHtml(t)}</span>`).join('')}
        </div>
      `;
    }

    cardEl.innerHTML = `
      <div class="card-top-row">
        <span class="priority-pill priority-${card.priority || 'medium'}">
          ${card.priority || 'medium'}
        </span>
        <div class="card-quick-actions">
          <button class="card-action-icon action-edit" title="Edit task">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
          </button>
          <button class="card-action-icon action-delete" title="Delete task">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
      <h3 class="card-title">${escapeHtml(card.title)}</h3>
      ${card.description ? `<p class="card-desc">${escapeHtml(card.description)}</p>` : ''}
      <div class="card-footer">
        ${tagsHtml}
        ${dueDateHtml}
      </div>
    `;

    // Card drag events
    cardEl.addEventListener('dragstart', (e) => {
      draggedCardId = card.id;
      cardEl.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', card.id);
    });

    cardEl.addEventListener('dragend', () => {
      draggedCardId = null;
      cardEl.classList.remove('is-dragging');
      if (dropPlaceholder.parentNode) {
        dropPlaceholder.parentNode.removeChild(dropPlaceholder);
      }
      document.querySelectorAll('.cards-list').forEach(l => l.classList.remove('drag-target-active'));
    });

    // Card edit & delete click
    cardEl.addEventListener('click', (e) => {
      // Ignore if clicking action buttons or dragging
      if (e.target.closest('.card-quick-actions')) return;
      openCardModal(card.id);
    });

    const editBtn = cardEl.querySelector('.action-edit');
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openCardModal(card.id);
    });

    const delBtn = cardEl.querySelector('.action-delete');
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openConfirmModal(
        'Delete Task',
        `Are you sure you want to delete "${card.title}"?`,
        async () => {
          await window.db.deleteCard(card.id);
          showToast('Task deleted from IndexedDB', 'info');
          await refreshBoard();
        }
      );
    });

    return cardEl;
  }

  /**
   * Sets up dragover, dragleave, and drop event listeners on a column's cards container.
   */
  function setupCardsListDropEvents(cardsList, columnId) {
    cardsList.addEventListener('dragover', (e) => {
      if (!draggedCardId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      cardsList.classList.add('drag-target-active');

      const afterElement = getDragAfterElement(cardsList, e.clientY);
      if (afterElement == null) {
        cardsList.appendChild(dropPlaceholder);
      } else {
        cardsList.insertBefore(dropPlaceholder, afterElement);
      }
    });

    cardsList.addEventListener('dragleave', (e) => {
      if (!cardsList.contains(e.relatedTarget)) {
        cardsList.classList.remove('drag-target-active');
      }
    });

    cardsList.addEventListener('drop', async (e) => {
      if (!draggedCardId) return;
      e.preventDefault();
      cardsList.classList.remove('drag-target-active');

      const card = cards.find(c => c.id === draggedCardId);
      if (!card) return;

      const oldColumnId = card.columnId;
      const targetColumnId = columnId;

      // Determine new order index
      const cardElements = [...cardsList.querySelectorAll('.card:not(.is-dragging)')];
      const placeholderIdx = [...cardsList.children].indexOf(dropPlaceholder);

      // Remove placeholder
      if (dropPlaceholder.parentNode) {
        dropPlaceholder.parentNode.removeChild(dropPlaceholder);
      }

      // Update card's column
      card.columnId = targetColumnId;

      // Re-order cards in destination column
      let destCards = cards
        .filter(c => c.columnId === targetColumnId && c.id !== card.id)
        .sort((a, b) => a.order - b.order);

      // Insert moved card at right position
      if (placeholderIdx <= 0) {
        destCards.unshift(card);
      } else if (placeholderIdx >= destCards.length) {
        destCards.push(card);
      } else {
        destCards.splice(placeholderIdx, 0, card);
      }

      destCards.forEach((c, idx) => c.order = idx);

      // If moved across columns, also re-index old column
      let cardsToUpdate = [...destCards];
      if (oldColumnId !== targetColumnId) {
        let sourceCards = cards
          .filter(c => c.columnId === oldColumnId && c.id !== card.id)
          .sort((a, b) => a.order - b.order);
        sourceCards.forEach((c, idx) => c.order = idx);
        cardsToUpdate = cardsToUpdate.concat(sourceCards);
      }

      // Commit atomically to IndexedDB
      await window.db.batchUpdateCards(cardsToUpdate);

      const targetCol = columns.find(col => col.id === targetColumnId);
      showToast(`Moved to "${targetCol ? targetCol.title : 'Column'}" (saved to IndexedDB)`, 'info');

      await refreshBoard();
    });
  }

  /**
   * Calculates which sibling element the dragged card is placed before based on cursor Y.
   */
  function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.card:not(.is-dragging)')];

    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  // ========================================================================
  // Card Modal Handlers
  // ========================================================================
  function populateColumnSelect(selectedColId) {
    cardColumnSelect.innerHTML = '';
    columns.forEach(col => {
      const opt = document.createElement('option');
      opt.value = col.id;
      opt.textContent = col.title;
      if (col.id === selectedColId) {
        opt.selected = true;
      }
      cardColumnSelect.appendChild(opt);
    });
  }

  function openCardModal(cardId = null, preselectedColId = null) {
    cardForm.reset();

    const targetColId = preselectedColId || (columns[0] ? columns[0].id : '');
    populateColumnSelect(targetColId);

    if (cardId) {
      const card = cards.find(c => c.id === cardId);
      if (!card) return;

      cardModalTitle.textContent = 'Edit Task Card';
      cardIdInput.value = card.id;
      cardTitleInput.value = card.title;
      cardColumnSelect.value = card.columnId;
      cardDueDateInput.value = card.dueDate || '';
      cardTagsInput.value = (card.tags || []).join(', ');
      cardDescInput.value = card.description || '';

      const priorityRadio = cardForm.querySelector(`input[name="cardPriority"][value="${card.priority || 'medium'}"]`);
      if (priorityRadio) priorityRadio.checked = true;

      deleteCardModalBtn.style.display = 'inline-flex';
    } else {
      cardModalTitle.textContent = 'New Task Card';
      cardIdInput.value = '';
      deleteCardModalBtn.style.display = 'none';
      const defaultRadio = cardForm.querySelector('input[name="cardPriority"][value="medium"]');
      if (defaultRadio) defaultRadio.checked = true;
    }

    cardModal.classList.add('active');
    setTimeout(() => cardTitleInput.focus(), 50);
  }

  function closeCardModal() {
    cardModal.classList.remove('active');
  }

  cardForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = cardTitleInput.value.trim();
    if (!title) return;

    const id = cardIdInput.value;
    const columnId = cardColumnSelect.value;
    const dueDate = cardDueDateInput.value;
    const priority = cardForm.querySelector('input[name="cardPriority"]:checked')?.value || 'medium';
    const tags = cardTagsInput.value
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);
    const description = cardDescInput.value.trim();

    if (id) {
      // Update existing
      const existing = cards.find(c => c.id === id);
      if (existing) {
        existing.title = title;
        existing.columnId = columnId;
        existing.dueDate = dueDate;
        existing.priority = priority;
        existing.tags = tags;
        existing.description = description;
        await window.db.saveCard(existing);
        showToast('Card updated in IndexedDB', 'success');
      }
    } else {
      // Create new
      const colCards = cards.filter(c => c.columnId === columnId);
      const newCard = {
        id: 'card-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        columnId,
        title,
        description,
        priority,
        tags,
        dueDate,
        order: colCards.length,
        createdAt: Date.now()
      };
      await window.db.saveCard(newCard);
      showToast('Card created in IndexedDB', 'success');
    }

    closeCardModal();
    await refreshBoard();
  });

  deleteCardModalBtn.addEventListener('click', () => {
    const cardId = cardIdInput.value;
    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    openConfirmModal(
      'Delete Task',
      `Are you sure you want to delete "${card.title}"?`,
      async () => {
        closeCardModal();
        await window.db.deleteCard(card.id);
        showToast('Task deleted from IndexedDB', 'info');
        await refreshBoard();
      }
    );
  });

  document.getElementById('addCardBtn').addEventListener('click', () => openCardModal());
  document.getElementById('closeCardModalBtn').addEventListener('click', closeCardModal);
  document.getElementById('cancelCardModalBtn').addEventListener('click', closeCardModal);

  // ========================================================================
  // Column Modal Handlers
  // ========================================================================
  function openColumnModal() {
    columnForm.reset();
    columnModal.classList.add('active');
    setTimeout(() => columnTitleInput.focus(), 50);
  }

  function closeColumnModal() {
    columnModal.classList.remove('active');
  }

  columnForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = columnTitleInput.value.trim();
    if (!title) return;

    const newColumn = {
      id: 'col-' + Date.now(),
      title,
      order: columns.length,
      createdAt: Date.now()
    };

    await window.db.saveColumn(newColumn);
    showToast(`Column "${title}" created`, 'success');
    closeColumnModal();
    await refreshBoard();
  });

  document.getElementById('addColumnBtn').addEventListener('click', openColumnModal);
  document.getElementById('closeColumnModalBtn').addEventListener('click', closeColumnModal);
  document.getElementById('cancelColumnModalBtn').addEventListener('click', closeColumnModal);

  // ========================================================================
  // Search & Filter
  // ========================================================================
  function checkCardVisibility(card) {
    // Priority filter check
    if (priorityFilter !== 'all' && card.priority !== priorityFilter) {
      return false;
    }

    // Search query check
    if (!searchQuery) return true;

    const q = searchQuery.toLowerCase();
    const matchTitle = card.title.toLowerCase().includes(q);
    const matchDesc = (card.description || '').toLowerCase().includes(q);
    const matchTags = (card.tags || []).some(t => t.toLowerCase().includes(q));

    return matchTitle || matchDesc || matchTags;
  }

  function applyFilters() {
    columns.forEach(col => {
      const colEl = boardContainer.querySelector(`.column[data-column-id="${col.id}"]`);
      if (!colEl) return;

      const colCards = cards.filter(c => c.columnId === col.id);
      let visibleCount = 0;

      colCards.forEach(card => {
        const cardEl = colEl.querySelector(`.card[data-card-id="${card.id}"]`);
        if (!cardEl) return;
        const visible = checkCardVisibility(card);
        cardEl.style.display = visible ? '' : 'none';
        if (visible) visibleCount++;
      });

      // Update counter badge
      const counterEl = colEl.querySelector('.column-counter');
      if (counterEl) {
        counterEl.textContent = visibleCount;
      }
    });
  }

  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim();
    applyFilters();
  });

  priorityFilterSelect.addEventListener('change', (e) => {
    priorityFilter = e.target.value;
    applyFilters();
  });

  // ========================================================================
  // Database Inspector Modal & Tools
  // ========================================================================
  async function openDbModal() {
    const stats = await window.db.getDatabaseStats();
    dbEngineVal.textContent = stats.engine;
    dbColCountVal.textContent = stats.columnsCount;
    dbCardCountVal.textContent = stats.cardsCount;
    dbModal.classList.add('active');
  }

  function closeDbModal() {
    dbModal.classList.remove('active');
  }

  dbInspectorBtn.addEventListener('click', openDbModal);
  dbStatusBadge.addEventListener('click', openDbModal);
  document.getElementById('closeDbModalBtn').addEventListener('click', closeDbModal);
  document.getElementById('closeDbModalFooterBtn').addEventListener('click', closeDbModal);

  // Export Database
  exportDbBtn.addEventListener('click', async () => {
    const jsonStr = await window.db.exportDatabaseJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kanban-board-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Database exported to JSON file', 'success');
  });

  // Import Database
  importDbInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = await window.db.importDatabaseJSON(event.target.result);
      if (result.success) {
        showToast(`Imported ${result.columns} columns and ${result.cards} cards!`, 'success');
        closeDbModal();
        await refreshBoard();
      } else {
        showToast(`Import failed: ${result.error}`, 'error');
      }
      importDbInput.value = '';
    };
    reader.readAsText(file);
  });

  // Reset to Defaults
  resetDbBtn.addEventListener('click', () => {
    openConfirmModal(
      'Reset Database to Defaults',
      'This will replace your current board with default sample columns and tasks. Proceed?',
      async () => {
        await window.db.resetToDefaults();
        showToast('Database reset to default sample data', 'info');
        closeDbModal();
        await refreshBoard();
      }
    );
  });

  // Clear All Data
  clearDbBtn.addEventListener('click', () => {
    openConfirmModal(
      'Clear All Database Data',
      'This will completely wipe all columns and cards from your browser IndexedDB storage. Proceed?',
      async () => {
        await window.db.clearAllData();
        showToast('Database cleared', 'info');
        closeDbModal();
        await refreshBoard();
      }
    );
  });

  // ========================================================================
  // Confirm Dialog Modal
  // ========================================================================
  function openConfirmModal(title, message, onConfirm) {
    confirmModalTitle.textContent = title;
    confirmModalMessage.textContent = message;
    confirmCallback = onConfirm;
    confirmModal.classList.add('active');
  }

  function closeConfirmModal() {
    confirmModal.classList.remove('active');
    confirmCallback = null;
  }

  acceptConfirmBtn.addEventListener('click', () => {
    if (confirmCallback) confirmCallback();
    closeConfirmModal();
  });

  cancelConfirmBtn.addEventListener('click', closeConfirmModal);

  // Close modals on overlay backdrop click or Escape key
  [cardModal, columnModal, dbModal, confirmModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      [cardModal, columnModal, dbModal, confirmModal].forEach(m => m.classList.remove('active'));
    }
  });

  // ========================================================================
  // Theme Switching
  // ========================================================================
  function updateThemeIcon(theme) {
    if (theme === 'dark') {
      themeToggleBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
      `;
    } else {
      themeToggleBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      `;
    }
  }

  themeToggleBtn.addEventListener('click', async () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    updateThemeIcon(newTheme);
    await window.db.setSetting('theme', newTheme);
  });

  // ========================================================================
  // Toast Notifications
  // ========================================================================
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 2500);
  }

  // ========================================================================
  // Helpers
  // ========================================================================
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDisplayDate(dateStr) {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const date = new Date(parts[0], parts[1] - 1, parts[2]);
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  }

  // Prevent unwanted browser drag-and-drop navigation
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());

  // Start the application
  await initApp();
});
