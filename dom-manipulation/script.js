// ---------------- Quotes Data ----------------
let quotes = JSON.parse(localStorage.getItem("quotes")) || [
  { text: "The best way to predict the future is to invent it.", category: "Inspiration" },
  { text: "Life is what happens when you're busy making other plans.", category: "Life" },
  { text: "Do not go where the path may lead, go instead where there is no path and leave a trail.", category: "Motivation" },
  { text: "Simplicity is the ultimate sophistication.", category: "Wisdom" }
];

const quoteDisplay = document.getElementById("quoteDisplay");
const newQuoteBtn = document.getElementById("newQuote");
const categoryFilter = document.getElementById("categoryFilter");

// ---------------- Save / Load Helpers ----------------
function saveQuotes() {
  localStorage.setItem("quotes", JSON.stringify(quotes));
}

function saveLastFilter(category) {
  localStorage.setItem("selectedCategory", category);
}

function loadLastFilter() {
  return localStorage.getItem("selectedCategory") || "All";
}

function saveLastQuote(quote) {
  sessionStorage.setItem("lastQuote", JSON.stringify(quote));
}

// ---------------- Categories ----------------
function populateCategories() {
  const categories = [...new Set(quotes.map(q => q.category))];
  categoryFilter.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "All";
  allOption.textContent = "All Categories";
  categoryFilter.appendChild(allOption);

  categories.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    categoryFilter.appendChild(option);
  });

  // ✅ Restore last saved filter
  const savedFilter = loadLastFilter();
  categoryFilter.value = savedFilter;
}

// ---------------- Show Random Quote ----------------
function showRandomQuote() {
  const selectedCategory = categoryFilter.value; // ✅ required variable
  let pool = quotes;

  if (selectedCategory !== "All") {
    pool = quotes.filter(q => q.category === selectedCategory);
  }

  if (!pool.length) {
    quoteDisplay.textContent = "No quotes available in this category ❗";
    return;
  }

  const random = pool[Math.floor(Math.random() * pool.length)];
  quoteDisplay.textContent = `"${random.text}" — ${random.category}`;

  saveLastQuote(random);
}

// ---------------- Filter Quotes ----------------
function filterQuotes() {
  const selectedCategory = categoryFilter.value; // ✅ required variable
  saveLastFilter(selectedCategory);
  showRandomQuote();
}

// ---------------- Add New Quote ----------------
function addQuote() {
  const text = document.getElementById("newQuoteText").value.trim();
  const category = document.getElementById("newQuoteCategory").value.trim();

  if (!text || !category) {
    alert("Please enter both quote and category ❗");
    return;
  }

  quotes.push({ text, category });
  saveQuotes();
  populateCategories();

  document.getElementById("newQuoteText").value = "";
  document.getElementById("newQuoteCategory").value = "";

  alert("Quote added successfully ✔️");
}

// ---------------- Create Add Quote Form ----------------
function createAddQuoteForm() {
  const formContainer = document.createElement("div");
  formContainer.className = "form-container";

  const title = document.createElement("h3");
  title.textContent = "Add a New Quote";
  formContainer.appendChild(title);

  const inputText = document.createElement("input");
  inputText.type = "text";
  inputText.id = "newQuoteText";
  inputText.placeholder = "Enter a new quote";
  formContainer.appendChild(inputText);

  const inputCategory = document.createElement("input");
  inputCategory.type = "text";
  inputCategory.id = "newQuoteCategory";
  inputCategory.placeholder = "Enter quote category";
  formContainer.appendChild(inputCategory);

  const addBtn = document.createElement("button");
  addBtn.textContent = "Add Quote";
  addBtn.onclick = addQuote;
  formContainer.appendChild(addBtn);

  // Export button
  const exportBtn = document.createElement("button");
  exportBtn.textContent = "Export Quotes (JSON)";
  exportBtn.onclick = exportToJsonFile;
  formContainer.appendChild(exportBtn);

  // Import file input
  const importInput = document.createElement("input");
  importInput.type = "file";
  importInput.id = "importFile";
  importInput.accept = ".json";
  importInput.onchange = importFromJsonFile;
  formContainer.appendChild(importInput);

  document.body.appendChild(formContainer);
}

// ---------------- Import / Export ----------------
function exportToJsonFile() {
  const blob = new Blob([JSON.stringify(quotes, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "quotes.json";
  a.click();

  URL.revokeObjectURL(url);
}

function importFromJsonFile(event) {
  const fileReader = new FileReader();
  fileReader.onload = function(e) {
    try {
      const importedQuotes = JSON.parse(e.target.result);
      if (Array.isArray(importedQuotes)) {
        quotes.push(...importedQuotes);
        saveQuotes();
        populateCategories();
        alert("Quotes imported successfully ✔️");
      } else {
        alert("Invalid file format ❌");
      }
    } catch (err) {
      alert("Error reading JSON file ❌");
    }
  };
  fileReader.readAsText(event.target.files[0]);
}

// ---------------- Event Listeners ----------------
newQuoteBtn.addEventListener("click", showRandomQuote);
categoryFilter.addEventListener("change", filterQuotes);

// ---------------- Initialize App ----------------
populateCategories();
createAddQuoteForm();

// Show last viewed quote if available
const lastQuote = sessionStorage.getItem("lastQuote");
if (lastQuote) {
  const parsed = JSON.parse(lastQuote);
  quoteDisplay.textContent = `"${parsed.text}" — ${parsed.category}`;
} else {
  showRandomQuote();
}
