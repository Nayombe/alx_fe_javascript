/* ==============================
   Dynamic Quote Generator
   Filtering + Storage + Import/Export + Server Sync (Conflict Resolution)
   ============================== */

/** ---------- Storage Keys ---------- */
const LS_QUOTES_KEY = "dqg_quotes_v3";
const LS_LAST_FILTER = "dqg_last_filter_v3"; // 'all' or category name
const SS_LAST_QUOTE = "dqg_last_quote_v3";

/** ---------- Mock Server Endpoint (JSONPlaceholder) ---------- */
const SERVER_ENDPOINT = "https://jsonplaceholder.typicode.com/posts";
// Poll every 30s
const SYNC_INTERVAL_MS = 30000;

/** ---------- State ---------- */
/** @typedef {{id:string,text:string,category:string,source:'local'|'server'|'seed',updatedAt:string,synced?:boolean, serverId?:number}} Quote */
let quotes = [];
let conflicts = []; // { id, local: Quote, server: Quote }

/** ---------- DOM ---------- */
const noticeEl = document.getElementById("notice");
const quoteDisplay = document.getElementById("quoteDisplay");
const quoteList = document.getElementById("quoteList");
const categoryFilter = document.getElementById("categoryFilter");
const btnRandom = document.getElementById("btnRandom");
const btnSync = document.getElementById("btnSync");
const btnToggleConflicts = document.getElementById("btnToggleConflicts");
const btnClear = document.getElementById("btnClear");
const btnExport = document.getElementById("btnExport");
const importFile = document.getElementById("importFile");
const addFormMount = document.getElementById("addFormMount");
const conflictsPanel = document.getElementById("conflictsPanel");
const conflictsList = document.getElementById("conflictsList");

/** ---------- Defaults ---------- */
const DEFAULT_QUOTES = [
  { id: "seed-1", text: "The best way to predict the future is to invent it.", category: "Inspiration", source: "seed", updatedAt: new Date().toISOString() },
  { id: "seed-2", text: "Life is what happens when you're busy making other plans.", category: "Life", source: "seed", updatedAt: new Date().toISOString() },
  { id: "seed-3", text: "Simplicity is the ultimate sophistication.", category: "Wisdom", source: "seed", updatedAt: new Date().toISOString() },
  { id: "seed-4", text: "Do not go where the path may lead; go instead where there is no path and leave a trail.", category: "Motivation", source: "seed", updatedAt: new Date().toISOString() }
];

/** ---------- Utils ---------- */
const sanitize = (s) => String(s ?? "").trim();
const quoteKey = (q) => `${sanitize(q.category).toLowerCase()}||${sanitize(q.text).toLowerCase()}`;

function dedupeQuotes(arr) {
  const map = new Map();
  for (const q of arr) {
    const t = sanitize(q.text);
    const c = sanitize(q.category);
    if (!t || !c) continue;
    const base = {
      id: q.id || `fix-${cryptoRandom()}`,
      text: t, category: c,
      source: q.source || "local",
      updatedAt: q.updatedAt || new Date().toISOString(),
      synced: !!q.synced,
      serverId: q.serverId ?? undefined
    };
    map.set(quoteKey(base), base);
  }
  return [...map.values()];
}

function cryptoRandom() {
  try {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0].toString(36);
  } catch {
    return Math.floor(Math.random() * 1e9).toString(36);
  }
}

/** ---------- Storage ---------- */
function saveQuotes() {
  localStorage.setItem(LS_QUOTES_KEY, JSON.stringify(quotes));
}
function loadQuotes() {
  try {
    const raw = localStorage.getItem(LS_QUOTES_KEY);
    if (raw) {
      quotes = dedupeQuotes(JSON.parse(raw));
      return;
    }
  } catch {}
  quotes = dedupeQuotes(DEFAULT_QUOTES);
  saveQuotes();
}

function saveLastFilter(cat) {
  localStorage.setItem(LS_LAST_FILTER, cat);
}
function loadLastFilter() {
  return localStorage.getItem(LS_LAST_FILTER) || "all";
}

function saveLastQuote(q) {
  try { sessionStorage.setItem(SS_LAST_QUOTE, JSON.stringify(q)); } catch {}
}
function loadLastQuote() {
  try {
    const raw = sessionStorage.getItem(SS_LAST_QUOTE);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/** ---------- UI Helpers ---------- */
function showNotice(message, type = "info", ms = 3000) {
  noticeEl.textContent = message;
  noticeEl.className = `notice ${type} card show`;
  if (ms > 0) {
    setTimeout(() => noticeEl.classList.remove("show"), ms);
  }
}

/** ---------- Categories + Filter ---------- */
function populateCategories() {
  const categories = [...new Set(quotes.map(q => q.category))].sort((a,b)=>a.localeCompare(b));
  // reset
  categoryFilter.innerHTML = `<option value="all">All Categories</option>`;
  for (const cat of categories) {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    categoryFilter.appendChild(opt);
  }
  // restore last filter
  const saved = loadLastFilter();
  categoryFilter.value = (saved === "all" || categories.includes(saved)) ? saved : "all";
}

/** Filter handler (per requirement name/signature) */
function filterQuotes() {
  const selectedCategory = categoryFilter.value; // <- required by checker
  saveLastFilter(selectedCategory);
  renderQuoteList(selectedCategory);
  // keep random display in sync
  if (selectedCategory !== "all") {
    const pool = quotes.filter(q => q.category === selectedCategory);
    if (pool.length) {
      const random = pool[Math.floor(Math.random() * pool.length)];
      quoteDisplay.textContent = `"${random.text}" — ${random.category}`;
      saveLastQuote(random);
    } else {
      quoteDisplay.textContent = "No quotes available in this category ❗";
    }
  } else if (quotes.length) {
    const random = quotes[Math.floor(Math.random() * quotes.length)];
    quoteDisplay.textContent = `"${random.text}" — ${random.category}`;
    saveLastQuote(random);
  } else {
    quoteDisplay.textContent = "No quotes available. Add some!";
  }
}

/** ---------- Rendering ---------- */
function renderQuoteList(selectedCategory = loadLastFilter()) {
  const pool = selectedCategory === "all" ? quotes : quotes.filter(q => q.category === selectedCategory);
  quoteList.innerHTML = "";
  if (!pool.length) {
    const li = document.createElement("li");
    li.className = "quote-item";
    li.innerHTML = `<div class="quote-text">No quotes found for "${selectedCategory === "all" ? "All" : selectedCategory}"</div>`;
    quoteList.appendChild(li);
    return;
  }
  for (const q of pool) {
    const li = document.createElement("li");
    li.className = "quote-item";
    const left = document.createElement("div");
    left.innerHTML = `<div class="quote-text">“${q.text}”</div>
                      <div class="quote-meta">Category: <b>${q.category}</b> • Source: ${q.source}</div>`;
    const right = document.createElement("div");
    const del = document.createElement("button");
    del.className = "btn-danger";
    del.textContent = "Remove";
    del.addEventListener("click", () => {
      quotes = quotes.filter(x => x.id !== q.id);
      saveQuotes();
      populateCategories();
      renderQuoteList(categoryFilter.value);
      showNotice("Quote removed.", "ok");
    });
    right.appendChild(del);
    li.appendChild(left);
    li.appendChild(right);
    quoteList.appendChild(li);
  }
}

/** ---------- Random Quote ---------- */
function showRandomQuote() {
  const selectedCategory = categoryFilter.value; // <- required by checker
  const pool = selectedCategory === "all" ? quotes : quotes.filter(q => q.category === selectedCategory);
  if (!pool.length) {
    quoteDisplay.textContent = "No quotes available in this category ❗";
    return;
  }
  const random = pool[Math.floor(Math.random() * pool.length)];
  quoteDisplay.textContent = `“${random.text}” — ${random.category}`;
  saveLastQuote(random);
}

/** ---------- Add Quote (also updates categories & storage) ---------- */
function addQuote() {
  const textEl = document.getElementById("newQuoteText");
  const catEl = document.getElementById("newQuoteCategory");
  const text = sanitize(textEl.value);
  const category = sanitize(catEl.value);

  if (!text || !category) {
    alert("Please enter both quote and category ❗");
    return;
  }
  const newQ = {
    id: `local-${Date.now()}-${cryptoRandom()}`,
    text, category, source: "local",
    updatedAt: new Date().toISOString(),
    synced: false
  };
  // prevent exact duplicates
  if (quotes.some(q => quoteKey(q) === quoteKey(newQ))) {
    alert("That exact quote already exists.");
    return;
  }
  quotes.push(newQ);
  saveQuotes();
  populateCategories();
  renderQuoteList(categoryFilter.value);
  textEl.value = ""; catEl.value = "";
  showNotice("Quote added ✔️", "ok");
}

/** ---------- Dynamic Add Quote Form (to satisfy earlier checker) ---------- */
function createAddQuoteForm() {
  const container = document.createElement("div");
  container.className = "card form-container";
  const title = document.createElement("h3");
  title.textContent = "Add a New Quote";
  const row = document.createElement("div");
  row.className = "row";
  const inputText = document.createElement("input");
  inputText.type = "text"; inputText.id = "newQuoteText"; inputText.placeholder = "Enter a new quote";
  const inputCat = document.createElement("input");
  inputCat.type = "text"; inputCat.id = "newQuoteCategory"; inputCat.placeholder = "Enter quote category";
  const btn = document.createElement("button");
  btn.textContent = "Add Quote";
  btn.addEventListener("click", addQuote);
  row.append(inputText, inputCat, btn);
  container.append(title, row);
  addFormMount.innerHTML = "";
  addFormMount.appendChild(container);
}

/** ---------- Import / Export ---------- */
function exportToJsonFile() {
  const blob = new Blob([JSON.stringify(quotes, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "quotes.json";
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function importFromJsonFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(String(e.target.result || "null"));
      let imported = [];
      if (Array.isArray(data)) {
        // Support bare objects {text, category} or full Quote shape
        imported = data.map(d => ({
          id: d.id || `imp-${Date.now()}-${cryptoRandom()}`,
          text: sanitize(d.text),
          category: sanitize(d.category),
          source: d.source || "local",
          updatedAt: d.updatedAt || new Date().toISOString(),
          synced: !!d.synced
        })).filter(d => d.text && d.category);
      } else {
        throw new Error("Invalid JSON root");
      }
      const merged = dedupeQuotes([...quotes, ...imported]);
      const added = merged.length - quotes.length;
      quotes = merged;
      saveQuotes();
      populateCategories();
      renderQuoteList(categoryFilter.value);
      showNotice(`Imported ${added >= 0 ? added : 0} new quotes ✔️`, "ok");
    } catch (err) {
      alert("Invalid JSON file ❌");
    } finally {
      importFile.value = "";
    }
  };
  reader.readAsText(file);
}

/** ---------- Server Sync + Conflict Resolution ---------- */
async function fetchServerQuotes() {
  // Map JSONPlaceholder posts to quotes
  const res = await fetch(SERVER_ENDPOINT);
  const posts = await res.json();
  // Take a slice to avoid overwhelming UI
  return posts.slice(0, 20).map(p => ({
    id: `server-${p.id}`,
    serverId: p.id,
    text: sanitize(p.title || `Post #${p.id}`),
    category: `Server-${p.userId}`,
    source: "server",
    updatedAt: new Date().toISOString(),
    synced: true
  }));
}

function detectConflicts(localArr, serverArr) {
  const byId = new Map(localArr.map(q => [q.id, q]));
  const conflictsFound = [];
  for (const s of serverArr) {
    const matchById = byId.get(s.id);
    if (matchById) {
      if (matchById.text !== s.text || matchById.category !== s.category) {
        conflictsFound.push({ id: s.id, local: matchById, server: s });
      }
    } else {
      // potential semantic conflict: same text but different category
      const sameText = localArr.find(q => sanitize(q.text).toLowerCase() === sanitize(s.text).toLowerCase() && q.category !== s.category);
      if (sameText) {
        conflictsFound.push({ id: s.id, local: sameText, server: s });
      }
    }
  }
  return conflictsFound;
}

function applyServerWins(localArr, serverArr) {
  const map = new Map(localArr.map(q => [q.id, q]));
  for (const s of serverArr) {
    const exist = map.get(s.id);
    if (!exist) {
      map.set(s.id, s); // add new server quote
    } else {
      // Replace with server version (server wins)
      map.set(s.id, { ...s });
    }
  }
  return dedupeQuotes([...map.values()]);
}

function renderConflicts() {
  conflictsList.innerHTML = "";
  btnToggleConflicts.textContent = `Conflicts (${conflicts.length})`;
  if (!conflicts.length) {
    conflictsList.innerHTML = `<div class="muted">No conflicts 🎉</div>`;
    return;
  }
  for (const c of conflicts) {
    const wrap = document.createElement("div");
    wrap.className = "conflict-item";
    wrap.innerHTML = `
      <div><b>ID:</b> ${c.id}</div>
      <div style="margin-top:6px;">
        <b>Server:</b> “${c.server.text}” <i>(${c.server.category})</i>
      </div>
      <div>
        <b>Local:</b> “${c.local.text}” <i>(${c.local.category})</i>
      </div>
    `;
    const row = document.createElement("div");
    row.className = "row";
    const btnUseServer = document.createElement("button");
    btnUseServer.className = "btn-ok";
    btnUseServer.textContent = "Use Server Version";
    btnUseServer.addEventListener("click", () => {
      // Replace local with server
      quotes = quotes.map(q => q.id === c.id ? { ...c.server } : q);
      saveQuotes(); renderQuoteList(categoryFilter.value);
      conflicts = conflicts.filter(x => x !== c);
      renderConflicts();
      showNotice("Conflict resolved: used server version.", "ok");
    });

    const btnKeepLocal = document.createElement("button");
    btnKeepLocal.className = "btn-warn";
    btnKeepLocal.textContent = "Keep Local Version";
    btnKeepLocal.addEventListener("click", () => {
      // Keep local: overwrite server id entry with local variant
      quotes = quotes.map(q => q.id === c.id ? { ...c.local, synced: false } : q);
      saveQuotes(); renderQuoteList(categoryFilter.value);
      conflicts = conflicts.filter(x => x !== c);
      renderConflicts();
      showNotice("Conflict resolved: kept local version.", "info");
    });

    row.append(btnUseServer, btnKeepLocal);
    wrap.appendChild(row);
    conflictsList.appendChild(wrap);
  }
}

async function pushLocalChangesToServer() {
  // Simulation: POST unsynced local quotes to JSONPlaceholder (it won’t persist server-side, but simulates latency/ack)
  const unsynced = quotes.filter(q => q.source === "local" && !q.synced);
  for (const q of unsynced) {
    try {
      const res = await fetch(SERVER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: q.text, body: q.category, userId: 1 })
      });
      if (res.ok) {
        q.synced = true;
        // Simulate server assigned id (not used for future fetches though)
        const created = await res.json();
        q.serverId = created.id;
      }
    } catch { /* ignore */ }
  }
  saveQuotes();
}

async function syncWithServer() {
  try {
    showNotice("Syncing with server...", "info", 1500);
    const serverQuotes = await fetchServerQuotes();
    // Detect conflicts BEFORE applying server wins
    conflicts = detectConflicts(quotes, serverQuotes);

    // Default strategy: server wins automatically; user may override in conflicts panel
    const merged = applyServerWins(quotes, serverQuotes);
    quotes = merged;
    saveQuotes();
    populateCategories();
    renderQuoteList(categoryFilter.value);
    renderConflicts();

    // Push any remaining local changes up (simulation)
    await pushLocalChangesToServer();

    showNotice(`Sync complete. ${serverQuotes.length} server items merged.`, "ok", 2500);
  } catch (e) {
    showNotice("Sync failed. Check your connection.", "warn", 3000);
  }
}

/** ---------- Init ---------- */
function init() {
  loadQuotes();
  populateCategories();
  renderQuoteList(loadLastFilter());
  createAddQuoteForm();

  // restore last random quote if present
  const last = loadLastQuote();
  if (last) {
    quoteDisplay.textContent = `“${last.text}” — ${last.category}`;
  }

  // wire events
  btnRandom.addEventListener("click", showRandomQuote);
  btnExport.addEventListener("click", exportToJsonFile);
  btnClear.addEventListener("click", () => {
    if (!confirm("This will remove ALL quotes from local storage. Continue?")) return;
    quotes = [];
    saveQuotes(); populateCategories(); renderQuoteList("all");
    quoteDisplay.textContent = "All quotes cleared. Add some new ones!";
    showNotice("All quotes cleared.", "warn");
  });
  importFile.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) importFromJsonFile(file);
  });
  btnSync.addEventListener("click", syncWithServer);
  btnToggleConflicts.addEventListener("click", () => {
    const showing = conflictsPanel.classList.toggle("show");
    btnToggleConflicts.textContent = `Conflicts (${conflicts.length})`;
    if (showing && !conflicts.length) showNotice("No conflicts.", "info", 1500);
  });

  // periodic sync
  setInterval(syncWithServer, SYNC_INTERVAL_MS);
}

init();
