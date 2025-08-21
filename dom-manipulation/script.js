/* ==============================
   Dynamic Quote Generator — Sync + Conflict Resolution
   ============================== */

/** ---------- Storage Keys ---------- */
const LS_QUOTES_KEY = "dqg_quotes_sync_v1";
const LS_LAST_FILTER = "dqg_last_filter_sync_v1"; 
const SS_LAST_QUOTE = "dqg_last_quote_sync_v1";

/** ---------- Mock Server ---------- */
const SERVER_ENDPOINT = "https://jsonplaceholder.typicode.com/posts";
const SYNC_INTERVAL_MS = 30000;

/** ---------- State ---------- */
let quotes = [];
let conflicts = [];

/** ---------- DOM ---------- */
const noticeEl = document.getElementById("notice");
const quoteDisplay = document.getElementById("quoteDisplay");
const quoteList = document.getElementById("quoteList");
const categoryFilter = document.getElementById("categoryFilter");
const btnRandom = document.getElementById("btnRandom");
const btnSync = document.getElementById("btnSync");
const btnToggleConflicts = document.getElementById("btnToggleConflicts");
const btnClear = document.getElementById("btnClear");
const addFormMount = document.getElementById("addFormMount");
const conflictsPanel = document.getElementById("conflictsPanel");
const conflictsList = document.getElementById("conflictsList");

/** ---------- Defaults ---------- */
const DEFAULT_QUOTES = [
  { id: "seed-1", text: "The best way to predict the future is to invent it.", category: "Inspiration", source: "seed", updatedAt: new Date().toISOString(), synced: true },
  { id: "seed-2", text: "Life is what happens when you're busy making other plans.", category: "Life", source: "seed", updatedAt: new Date().toISOString(), synced: true },
  { id: "seed-3", text: "Simplicity is the ultimate sophistication.", category: "Wisdom", source: "seed", updatedAt: new Date().toISOString(), synced: true },
  { id: "seed-4", text: "Do not go where the path may lead; go instead where there is no path and leave a trail.", category: "Motivation", source: "seed", updatedAt: new Date().toISOString(), synced: true }
];

/** ---------- Utils ---------- */
const sanitize = (s) => String(s ?? "").trim();
const k = (q) => `${sanitize(q.category).toLowerCase()}||${sanitize(q.text).toLowerCase()}`;
function cryptoRandom() {
  try { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0].toString(36); }
  catch { return Math.floor(Math.random()*1e9).toString(36); }
}
function dedupeQuotes(arr) {
  const map = new Map();
  for (const q of arr) {
    const text = sanitize(q.text); const category = sanitize(q.category);
    if (!text || !category) continue;
    const norm = {
      id: q.id || `fix-${cryptoRandom()}`,
      text, category,
      source: q.source || "local",
      updatedAt: q.updatedAt || new Date().toISOString(),
      synced: !!q.synced,
      serverId: q.serverId ?? undefined
    };
    map.set(k(norm), norm);
  }
  return [...map.values()];
}

/** ---------- Storage ---------- */
function saveQuotes() { localStorage.setItem(LS_QUOTES_KEY, JSON.stringify(quotes)); }
function loadQuotes() {
  try {
    const raw = localStorage.getItem(LS_QUOTES_KEY);
    quotes = raw ? dedupeQuotes(JSON.parse(raw)) : dedupeQuotes(DEFAULT_QUOTES);
  } catch { quotes = dedupeQuotes(DEFAULT_QUOTES); }
  saveQuotes();
}
function saveLastFilter(cat) { localStorage.setItem(LS_LAST_FILTER, cat); }
function loadLastFilter() { return localStorage.getItem(LS_LAST_FILTER) || "all"; }
function saveLastQuote(q) { try { sessionStorage.setItem(SS_LAST_QUOTE, JSON.stringify(q)); } catch {} }
function loadLastQuote() { try { const r = sessionStorage.getItem(SS_LAST_QUOTE); return r ? JSON.parse(r) : null; } catch { return null; } }

/** ---------- UI Helpers ---------- */
function showNotice(message, type = "info", ms = 3000) {
  noticeEl.textContent = message;
  noticeEl.className = `notice ${type} card show`;
  if (ms > 0) setTimeout(() => noticeEl.classList.remove("show"), ms);
}

/** ---------- Categories + Filter ---------- */
function populateCategories() {
  const categories = [...new Set(quotes.map(q => q.category))].sort((a,b)=>a.localeCompare(b));
  categoryFilter.innerHTML = `<option value="all">All Categories</option>`;
  for (const cat of categories) {
    const opt = document.createElement("option");
    opt.value = cat; opt.textContent = cat;
    categoryFilter.appendChild(opt);
  }
  const saved = loadLastFilter();
  categoryFilter.value = (saved === "all" || categories.includes(saved)) ? saved : "all";
}

/** Filter function (uses selectedCategory variable explicitly) */
function filterQuotes() {
  const selectedCategory = categoryFilter.value;
  saveLastFilter(selectedCategory);
  renderQuoteList(selectedCategory);
  if (selectedCategory !== "all") {
    const pool = quotes.filter(q => q.category === selectedCategory);
    if (pool.length) {
      const random = pool[Math.floor(Math.random() * pool.length)];
      quoteDisplay.textContent = `“${random.text}” — ${random.category}`;
      saveLastQuote(random);
    } else {
      quoteDisplay.textContent = "No quotes available in this category ❗";
    }
  } else if (quotes.length) {
    const random = quotes[Math.floor(Math.random() * quotes.length)];
    quoteDisplay.textContent = `“${random.text}” — ${random.category}`;
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
    li.innerHTML = `<div class="quote-text">No quotes found for “${selectedCategory === "all" ? "All" : selectedCategory}”</div>`;
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
    del.className = "btn-danger"; del.textContent = "Remove";
    del.addEventListener("click", () => {
      quotes = quotes.filter(x => x.id !== q.id);
      saveQuotes(); populateCategories(); renderQuoteList(categoryFilter.value);
      showNotice("Quote removed.", "ok");
    });
    right.appendChild(del);
    li.append(left, right);
    quoteList.appendChild(li);
  }
}

/** ---------- Random Quote ---------- */
function showRandomQuote() {
  const selectedCategory = categoryFilter.value;
  const pool = selectedCategory === "all" ? quotes : quotes.filter(q => q.category === selectedCategory);
  if (!pool.length) { quoteDisplay.textContent = "No quotes available in this category ❗"; return; }
  const random = pool[Math.floor(Math.random() * pool.length)];
  quoteDisplay.textContent = `“${random.text}” — ${random.category}`;
  saveLastQuote(random);
}

/** ---------- Add Quote ---------- */
function addQuote() {
  const textEl = document.getElementById("newQuoteText");
  const catEl = document.getElementById("newQuoteCategory");
  const text = sanitize(textEl.value);
  const category = sanitize(catEl.value);
  if (!text || !category) { alert("Please enter both quote and category ❗"); return; }

  const newQ = {
    id: `local-${Date.now()}-${cryptoRandom()}`,
    text, category, source: "local",
    updatedAt: new Date().toISOString(),
    synced: false
  };
  if (quotes.some(q => k(q) === k(newQ))) { alert("That exact quote already exists."); return; }

  quotes.push(newQ); saveQuotes(); populateCategories(); renderQuoteList(categoryFilter.value);
  textEl.value = ""; catEl.value = ""; showNotice("Quote added ✔️", "ok");
}

/** ---------- Dynamic Add Quote Form ---------- */
function createAddQuoteForm() {
  const container = document.createElement("div");
  container.className = "card form-container";
  const title = document.createElement("h3"); title.textContent = "Add a New Quote";
  const row = document.createElement("div"); row.className = "row";
  const inputText = document.createElement("input");
  inputText.type = "text"; inputText.id = "newQuoteText"; inputText.placeholder = "Enter a new quote";
  const inputCat = document.createElement("input");
  inputCat.type = "text"; inputCat.id = "newQuoteCategory"; inputCat.placeholder = "Enter quote category";
  const btn = document.createElement("button");
  btn.textContent = "Add Quote"; btn.addEventListener("click", addQuote);
  row.append(inputText, inputCat, btn); container.append(title, row);
  addFormMount.innerHTML = ""; addFormMount.appendChild(container);
}

/** ---------- Server Sync & Conflict Resolution ---------- */
/** REQUIRED function name: fetchQuotesFromServer */
async function fetchQuotesFromServer() {
  const res = await fetch(SERVER_ENDPOINT);
  const posts = await res.json();
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
  const found = [];
  for (const s of serverArr) {
    const match = byId.get(s.id);
    if (match && (match.text !== s.text || match.category !== s.category)) {
      found.push({ id: s.id, local: match, server: s });
    }
  }
  return found;
}

function applyServerWins(localArr, serverArr) {
  const map = new Map(localArr.map(q => [q.id, q]));
  for (const s of serverArr) {
    map.set(s.id, { ...s }); // server wins
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
      <div style="margin-top:6px;"><b>Server:</b> “${c.server.text}” <i>(${c.server.category})</i></div>
      <div><b>Local:</b> “${c.local.text}” <i>(${c.local.category})</i></div>
