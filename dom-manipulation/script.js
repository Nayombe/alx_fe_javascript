// ---------- Storage Keys ----------
const LS_QUOTES_KEY = "dqg_quotes_v2";            // Local Storage: quotes
const LS_LAST_FILTER_KEY = "dqg_last_filter";     // Local Storage: last selected category filter
const SS_LAST_QUOTE_KEY = "dqg_last_quote";       // Session Storage: last viewed quote

// ---------- State ----------
let quotes = []; // populated by loadQuotes()

// ---------- DOM Elements ----------
const quoteDisplay = document.getElementById("quoteDisplay");
const newQuoteBtn = document.getElementById("newQuote");
const categoryFilter = document.getElementById("categoryFilter");
const exportBtn = document.getElementById("exportBtn");
const clearBtn = document.getElementById("clearBtn");

// ---------- Defaults ----------
const DEFAULT_QUOTES = [
  { text: "The best way to predict the future is to invent it.", category: "Inspiration" },
  { text: "Life is what happens when you're busy making other plans.", category: "Life" },
  { text: "Simplicity is the ultimate sophistication.", category: "Wisdom" },
  { text: "Do not go where the path may lead; go instead where there is no path and leave a trail.", category: "Motivation" }
];

// ---------- Helpers ----------
const sanitize = s => String(s ?? "").trim();
const quoteKey = q => `${sanitize(q.category).toLowerCase()}||${sanitize(q.text).toLowerCase()}`;
function dedupeQuotes(arr) {
  const map = new Map();
  for (const q of arr) {
    const t = sanitize(q.text);
    const c = sanitize(q.category);
    if (!t || !c) continue;
    map.set(quoteKey({ text: t, category: c }), { text: t, category: c });
  }
  return [...map.values()];
}

// ---------- Storage ----------
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
  quotes = [...DEFAULT_QUOTES];
  saveQuotes();
}
function saveLastFilter(cat) {
  localStorage.setItem(LS_LAST_FILTER_KEY, cat);
}
function loadLastFilter() {
  return localStorage.getItem(LS_LAST_FILTER_KEY) || "All";
}
function saveLastQuote(q) {
  sessionStorage.setItem(SS_LAST_QUOTE_KEY, JSON.stringify(q));
}
function loadLastQuote() {
  try {
    const raw = sessionStorage.getItem(SS_LAST_QUOTE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ---------- Categories + Filter ----------
function populateCategories() {
  const categories = [...new Set(quotes.map(q => q.category))].sort();
  categoryFilter.innerHTML = `<option value="All">All Categories</option>`;
  for (const cat of categories) {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    categoryFilter.appendChild(opt);
  }
  // Restore last filter from LS
  const lastFilter = loadLastFilter();
  categoryFilter.value = categories.includes(lastFilter) || lastFilter === "All" ? lastFilter : "All";
}
function filterQuotes() {
  saveLastFilter(categoryFilter.value);
  showRandomQuote();
}

// ---------- Quotes ----------
function showRandomQuote() {
  const filter = categoryFilter.value;
  const pool = filter === "All" ? quotes : quotes.filter(q => q.category === filter);
  if (!pool.length) {
    quoteDisplay.textContent = "No quotes available in this category ❗";
    return;
  }
  const random = pool[Math.floor(Math.random() * pool.length)];
  quoteDisplay.textContent = `"${random.text}" — ${random.category}`;
  saveLastQuote(random);
}
function addQuote() {
  const textEl = document.getElementById("newQuoteText");
  const catEl = document.getElementById("newQuoteCategory");
  const text = sanitize(textEl.value);
  const category = sanitize(catEl.value);

  if (!text || !category) {
    alert("Please enter both quote and category ❗");
    return;
  }
  const newQ = { text, category };
  if (quotes.some(q => quoteKey(q) === quoteKey(newQ))) {
    alert("That exact quote already exists.");
    return;
  }
  quotes.push(newQ);
  saveQuotes();
  populateCategories();
  textEl.value = "";
  catEl.value = "";
  alert("Quote added ✔️");
}

// ---------- Dynamic Add Quote Form ----------
function createAddQuoteForm() {
  const container = document.createElement("div");
  container.className = "form-container";
  const label = document.createElement("h3");
  label.textContent = "Add a New Quote";
  const row = document.createElement("div");
  row.className = "row";
  const inputText = document.createElement("input");
  inputText.id = "newQuoteText"; inputText.placeholder = "Enter a new quote";
  const inputCat = document.createElement("input");
  inputCat.id = "newQuoteCategory"; inputCat.placeholder = "Enter quote category";
  const btn = document.createElement("button");
  btn.textContent = "Add Quote";
  btn.addEventListener("click", addQuote);
  row.appendChild(inputText); row.appendChild(inputCat); row.appendChild(btn);
  container.appendChild(label); container.appendChild(row);
  document.body.appendChild(container);
}

// ---------- Import / Export ----------
function exportToJsonFile() {
  const blob = new Blob([JSON.stringify(quotes, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "quotes.json"; a.click();
  URL.revokeObjectURL(url);
}
function importFromJsonFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!Array.isArray(imported)) throw new Error("Invalid JSON");
      quotes = dedupeQuotes([...quotes, ...imported]);
      saveQuotes(); populateCategories();
      alert("Quotes imported ✔️");
    } catch { alert("Invalid JSON file ❌"); }
    event.target.value = "";
  };
  reader.readAsText(file);
}
function clearAllQuotes() {
  if (!confirm("Clear ALL quotes?")) return;
  quotes = [];
  saveQuotes();
  populateCategories();
  quoteDisplay.textContent = "All quotes cleared. Add some new ones!";
  sessionStorage.removeItem(SS_LAST_QUOTE_KEY);
}

// ---------- Init ----------
(function init() {
  loadQuotes();
  populateCategories();
  createAddQuoteForm();

  // restore last viewed quote if possible
  const lastQ = loadLastQuote();
  if (lastQ) quoteDisplay.textContent = `"${lastQ.text}" — ${lastQ.category}`;
})();
newQuoteBtn.addEventListener("click", showRandomQuote);
exportBtn.addEventListener("click", exportToJsonFile);
clearBtn.addEventListener("click", clearAllQuotes);
