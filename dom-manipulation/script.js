// ---------- Storage Keys ----------
const LS_QUOTES_KEY = "dqg_quotes_v1";           // Local Storage: array of quotes
const SS_LAST_CATEGORY_KEY = "dqg_last_category"; // Session Storage: last selected category
const SS_LAST_QUOTE_KEY = "dqg_last_quote";       // Session Storage: last viewed quote (object)

// ---------- State ----------
/** @typedef {{ text: string, category: string }} Quote */
let quotes = []; // filled by loadQuotes()

// ---------- DOM ----------
const quoteDisplay = document.getElementById("quoteDisplay");
const newQuoteBtn = document.getElementById("newQuote");
const categorySelect = document.getElementById("categorySelect");
const exportBtn = document.getElementById("exportBtn");
const clearBtn = document.getElementById("clearBtn");

// ---------- Defaults (used when localStorage is empty) ----------
const DEFAULT_QUOTES = [
  { text: "The best way to predict the future is to invent it.", category: "Inspiration" },
  { text: "Life is what happens when you're busy making other plans.", category: "Life" },
  { text: "Simplicity is the ultimate sophistication.", category: "Wisdom" },
  { text: "Do not go where the path may lead; go instead where there is no path and leave a trail.", category: "Motivation" }
];

// ---------- Utilities ----------
const sanitize = s => String(s ?? "").trim();
const quoteKey = q => `${sanitize(q.category).toLowerCase()}||${sanitize(q.text).toLowerCase()}`;
function dedupeQuotes(arr) {
  const map = new Map();
  for (const q of arr) {
    const t = sanitize(q.text);
    const c = sanitize(q.category);
    if (!t || !c) continue;
    map.set(`${c.toLowerCase()}||${t.toLowerCase()}`, { text: t, category: c });
  }
  return [...map.values()];
}

// ---------- Local/Session Storage ----------
function saveQuotes() {
  localStorage.setItem(LS_QUOTES_KEY, JSON.stringify(quotes));
}

function loadQuotes() {
  const raw = localStorage.getItem(LS_QUOTES_KEY);
  if (!raw) {
    quotes = [...DEFAULT_QUOTES];
    saveQuotes(); // initialize localStorage
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      quotes = dedupeQuotes(parsed);
      // auto-fix bad data
      saveQuotes();
    } else {
      throw new Error("Invalid quotes data.");
    }
  } catch {
    // Corrupt or invalid JSON -> reset to defaults
    quotes = [...DEFAULT_QUOTES];
    saveQuotes();
  }
}

function saveLastCategoryToSession(cat) {
  sessionStorage.setItem(SS_LAST_CATEGORY_KEY, cat);
}

function loadLastCategoryFromSession() {
  return sessionStorage.getItem(SS_LAST_CATEGORY_KEY);
}

function saveLastQuoteToSession(quoteObj) {
  try {
    sessionStorage.setItem(SS_LAST_QUOTE_KEY, JSON.stringify(quoteObj));
  } catch {
    // ignore
  }
}

function loadLastQuoteFromSession() {
  try {
    const raw = sessionStorage.getItem(SS_LAST_QUOTE_KEY);
    if (!raw) return null;
    const q = JSON.parse(raw);
    if (q && typeof q.text === "string" && typeof q.category === "string") return q;
  } catch {}
  return null;
}

// ---------- UI: Categories ----------
function populateCategories() {
  const categories = [...new Set(quotes.map(q => q.category))].sort((a, b) => a.localeCompare(b));
  categorySelect.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "All";
  allOption.textContent = "All Categories";
  categorySelect.appendChild(allOption);

  for (const cat of categories) {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    categorySelect.appendChild(opt);
  }

  // Restore last selected category from session (if any)
  const lastCat = loadLastCategoryFromSession();
  if (lastCat) {
    const exists = lastCat === "All" || categories.includes(lastCat);
    categorySelect.value = exists ? lastCat : "All";
  } else {
    categorySelect.value = "All";
  }
}

// ---------- UI: Quote Form (Dynamic) ----------
function createAddQuoteForm() {
  const container = document.createElement("div");
  container.className = "form-container";

  const title = document.createElement("h3");
  title.textContent = "Add a New Quote";
  container.appendChild(title);

  const row = document.createElement("div");
  row.className = "stack";

  const inputText = document.createElement("input");
  inputText.type = "text";
  inputText.id = "newQuoteText";
  inputText.placeholder = "Enter a new quote";

  const inputCat = document.createElement("input");
  inputCat.type = "text";
  inputCat.id = "newQuoteCategory";
  inputCat.placeholder = "Enter quote category";

  const addBtn = document.createElement("button");
  addBtn.textContent = "Add Quote";
  addBtn.addEventListener("click", addQuote);

  row.appendChild(inputText);
  row.appendChild(inputCat);
  row.appendChild(addBtn);
  container.appendChild(row);

  document.body.appendChild(container);
}

// ---------- Actions ----------
function showRandomQuote() {
  const selectedCategory = categorySelect.value;
  const pool = selectedCategory === "All"
    ? quotes
    : quotes.filter(q => q.category === selectedCategory);

  if (!pool.length) {
    quoteDisplay.textContent = "No quotes available in this category ❗";
    return;
  }

  const random = pool[Math.floor(Math.random() * pool.length)];
  quoteDisplay.textContent = `"${random.text}" — ${random.category}`;
  saveLastQuoteToSession(random);
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
  // Prevent exact duplicate (by text+category)
  const exists = quotes.some(q => quoteKey(q) === quoteKey(newQ));
  if (exists) {
    alert("That exact quote already exists in this category.");
    return;
  }

  quotes.push(newQ);
  saveQuotes();
  populateCategories();

  // Keep current selection if it's the new category
  if (categorySelect.value === "All" || categorySelect.value === category) {
    // nothing needed; optional auto-show newest:
    quoteDisplay.textContent = `"${newQ.text}" — ${newQ.category}`;
    saveLastQuoteToSession(newQ);
  }

  textEl.value = "";
  catEl.value = "";
  alert("Quote added successfully ✔️");
}

function clearAllQuotes() {
  if (!confirm("This will remove ALL quotes from local storage. Continue?")) return;
  quotes = [];
  saveQuotes();
  populateCategories();
  quoteDisplay.textContent = "All quotes cleared. Add some new ones!";
  sessionStorage.removeItem(SS_LAST_QUOTE_KEY);
}

// ---------- Import / Export ----------
function exportToJsonFile() {
  const data = JSON.stringify(quotes, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  a.href = url;
  a.download = `quotes-${ts}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function validateImportedQuotes(arr) {
  return Array.isArray(arr) && arr.every(
    q => q && typeof q.text === "string" && typeof q.category === "string" && sanitize(q.text) && sanitize(q.category)
  );
}

// REQUIRED by the assignment (global, used by input onchange)
function importFromJsonFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const imported = JSON.parse(String(e.target?.result || "null"));
      if (!validateImportedQuotes(imported)) {
        alert("Invalid JSON format. Expect an array of {text, category}.");
        return;
      }
      // Merge + dedupe
      const merged = dedupeQuotes([...quotes, ...imported]);
      const addedCount = merged.length - quotes.length;

      quotes = merged;
      saveQuotes();
      populateCategories();

      alert(`Quotes imported successfully! ${addedCount >= 0 ? addedCount : 0} new quotes added ✔️`);
    } catch (err) {
      alert("Failed to import JSON. " + (err?.message || ""));
    } finally {
      // reset file input to allow re-importing same file if desired
      event.target.value = "";
    }
  };
  reader.onerror = () => {
    alert("Error reading the file.");
  };
  reader.readAsText(file);
}

// ---------- Event Listeners ----------
newQuoteBtn.addEventListener("click", showRandomQuote);
exportBtn.addEventListener("click", exportToJsonFile);
clearBtn.addEventListener("click", clearAllQuotes);
categorySelect.addEventListener("change", () => {
  saveLastCategoryToSession(categorySelect.value);
});

// ---------- Init ----------
(function init() {
  loadQuotes();
  populateCategories();
  createAddQuoteForm();

  // Restore last viewed quote from session (if available)
  const lastQuote = loadLastQuoteFromSession();
  if (lastQuote) {
    quoteDisplay.textContent = `"${lastQuote.text}" — ${lastQuote.category}`;
  }

  // If no last quote, optionally show one automatically (comment out to disable)
  // else showRandomQuote();
})();
