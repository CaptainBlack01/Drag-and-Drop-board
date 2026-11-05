# 📋 TaskFlow - Drag & Drop Board

A modern, responsive Kanban Drag & Drop board built with **pure HTML5, CSS3, and Vanilla JavaScript (ES6+)**. 

This application runs **100% in the browser with no backend server**, using the browser's native **IndexedDB Web Page Database** for transactional, offline-capable persistent storage.

---

## ✨ Features

- **🎯 Fluid Drag & Drop**:
  - Reorder cards inside any column or drag between columns with real-time drop indicator placeholders.
  - Reorder entire columns horizontally by dragging column headers.
  - Powered by native HTML5 Drag and Drop API (`draggable`, `dragstart`, `dragover`, `drop`).
- **💾 Web Page Database (IndexedDB)**:
  - Enterprise-grade client-side transactional database storage (`DragAndDropBoardDB`).
  - Stores columns, cards, orders, and user preferences directly on the client.
  - Automatic fallback to `localStorage` if IndexedDB is unavailable or disabled.
  - **Database Inspector**: Live stats badge, JSON Backup Export, and JSON File Import / Restore.
- **🏷️ Rich Card Management**:
  - Create, view, edit, and delete task cards.
  - Priority levels with distinct color badges: **Urgent (Red)**, **High (Orange)**, **Medium (Blue)**, **Low (Green)**.
  - Tags / Labels (e.g. `#Design`, `#Frontend`, `#Bug`).
  - Due Dates with smart indicators (Overdue in red, Due Today in amber).
  - Inline quick-add in column footers for rapid task entry.
- **📑 Dynamic Columns**:
  - Add custom columns, reorder them, or delete them.
  - Double-click/click column title for inline renaming.
  - Live task counter badge per column.
- **🔍 Instant Search & Filtering**:
  - Real-time search across titles, descriptions, and tags.
  - Filter board cards by priority level.
- **🌓 Theme Support**:
  - Sleek modern dark mode (default) and clean light mode.
  - Theme preference persisted in the Web Page Database.
- **⚡ Zero Dependencies**:
  - Pure HTML, CSS, and Vanilla JavaScript.
  - No frameworks, no external CDN dependencies, and no npm build steps needed.
  - Works completely offline.

---

## 🚀 How to Run

No installations, build commands, or server configurations are needed.

1. Double-click **`index.html`** or right-click and choose **Open with > Chrome / Edge / Firefox / Safari / Brave**.
2. Alternatively, if you have a local server (like Live Server or Python `python -m http.server`), you can serve the directory:
   ```bash
   # Optional: run via simple local HTTP server
   npx serve .
   # or
   python -m http.server 8000
   ```
3. Your board is immediately ready to use! Any task you add, edit, or reorder is automatically saved to your browser's IndexedDB database.

---

## 🗄️ How the Web Page Database Works

Browser storage is managed by [`db.js`](file:///c:/Users/Kenny/OneDrive/Desktop/Codes/Codesistency%201/Drag%20and%20Drop%20board/db.js):

- **Database Name**: `DragAndDropBoardDB`
- **Object Stores**:
  - `columns`: Stores column definitions with index on `order`.
  - `cards`: Stores card items with indices on `columnId`, `order`, and `priority`.
  - `settings`: Key-value store for app settings like theme mode.
- **Atomic Transactions**:
  - When you drag cards or columns, reordering is executed inside a single read-write transaction (`batchUpdateCards` / `batchUpdateColumns`), guaranteeing data consistency.
- **JSON Export / Import**:
  - Click the **Database** button in the header to open the Database Inspector.
  - Click **Export DB (JSON)** to download a complete backup of your board.
  - Click **Import DB (JSON)** to restore data on another device or browser.

---

## 📁 File Structure

```text
Drag and Drop board/
├── index.html     # Semantic markup, modals, SVGs, and board structure
├── styles.css     # CSS custom properties, responsive layout, drag states
├── db.js          # Web Page Database engine (IndexedDB + fallback + backup)
├── app.js         # HTML5 Drag & Drop handlers, board state & UI controllers
└── README.md      # Documentation & quick start guide
```

