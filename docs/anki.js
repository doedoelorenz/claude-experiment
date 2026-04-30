// Anki integration via AnkiConnect (https://github.com/FooSoft/anki-connect)
// Talks to localhost:8765 directly from the browser.
// Requires Anki Desktop running with the AnkiConnect addon installed and
// "https://doedoelorenz.github.io" added to webCorsOriginList in its config.

const ANKI_URL = "http://localhost:8765";
const ANKI_VERSION = 6;
const DECK_NAME = "Danish Daily";
const MODEL_NAME = "Danish Daily Vocab";

const MODEL_FIELDS = ["Word", "Lemma", "POS", "English", "Example", "Forms", "Note", "Source", "URL"];

const MODEL_TEMPLATES = [
  {
    Name: "Recognition (Da→En)",
    Front: '<div class="word">{{Word}}</div><div class="forms">{{Forms}}</div>',
    Back: '{{FrontSide}}<hr id="answer"><div class="english">{{English}}</div>'
        + '<div class="example">{{Example}}</div>'
        + '{{#Note}}<div class="note">{{Note}}</div>{{/Note}}'
        + '<div class="source">{{Source}}</div>',
  },
  {
    Name: "Production (En→Da)",
    Front: '<div class="english">{{English}}</div><div class="example">{{Example}}</div>',
    Back: '{{FrontSide}}<hr id="answer"><div class="word">{{Word}}</div><div class="forms">{{Forms}}</div>'
        + '{{#Note}}<div class="note">{{Note}}</div>{{/Note}}'
        + '<div class="source">{{Source}}</div>',
  },
];

const MODEL_CSS = `
.card { font-family: -apple-system, "Segoe UI", sans-serif; font-size: 18px; line-height: 1.5; padding: 16px; }
.word { font-size: 1.6em; font-weight: 700; }
.english { color: #444; }
.example { font-style: italic; color: #555; border-left: 3px solid #ddd; padding-left: 10px; margin: 10px 0; }
.note { background: #fff8e6; padding: 8px; border-radius: 6px; font-size: 0.92em; margin: 8px 0; }
.source { font-size: 0.78em; color: #999; margin-top: 12px; }
.forms { font-size: 0.95em; color: #555; }
.forms table { border-collapse: collapse; margin: 6px 0; }
.forms td { padding: 2px 8px 2px 0; }
.nightMode .card { color: #ddd; }
.nightMode .english { color: #bbb; }
.nightMode .example { color: #aaa; border-left-color: #444; }
.nightMode .note { background: #2a230f; }
.nightMode .source { color: #777; }
.nightMode .forms { color: #aaa; }
`;

// ---------- Low-level: invoke any AnkiConnect action ----------

async function ankiInvoke(action, params = {}) {
  let res;
  try {
    res = await fetch(ANKI_URL, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, version: ANKI_VERSION, params }),
    });
  } catch (e) {
    throw new Error("Anki Desktop not reachable. Is it running with AnkiConnect installed?");
  }
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

// ---------- Setup: deck + model ensured once ----------

let modelEnsured = false;
let deckEnsured = false;

async function ensureDeck() {
  if (deckEnsured) return;
  await ankiInvoke("createDeck", { deck: DECK_NAME });
  deckEnsured = true;
}

async function ensureModel() {
  if (modelEnsured) return;
  const existing = await ankiInvoke("modelNames");
  if (!existing.includes(MODEL_NAME)) {
    await ankiInvoke("createModel", {
      modelName: MODEL_NAME,
      inOrderFields: MODEL_FIELDS,
      css: MODEL_CSS,
      isCloze: false,
      cardTemplates: MODEL_TEMPLATES,
    });
  }
  modelEnsured = true;
}

// ---------- Build note from vocab data ----------

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function bold(text, word) {
  if (!text || !word) return escapeHtml(text || "");
  // Case-insensitive replace, preserves original casing
  const safe = escapeHtml(text);
  const re = new RegExp("(" + word.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&") + ")", "ig");
  return safe.replace(re, "<b>$1</b>");
}

function blankWord(text, word) {
  if (!text || !word) return escapeHtml(text || "");
  const safe = escapeHtml(text);
  const re = new RegExp(word.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), "ig");
  return safe.replace(re, "_____");
}

function buildFormsHtml(v) {
  if (v.pos === "verb") {
    const rows = [
      ["Infinitive", v.infinitive],
      ["Present", v.present_tense],
      ["Past", v.past_tense],
      ["Past part.", v.past_participle],
    ].filter(([, val]) => val);
    if (!rows.length) return "";
    return "<table>" + rows.map(([k, val]) =>
      `<tr><td>${escapeHtml(k)}</td><td><b>${escapeHtml(val)}</b></td></tr>`
    ).join("") + "</table>";
  }
  if (v.pos === "noun") {
    const parts = [];
    if (v.gender) parts.push(`<b>${escapeHtml(v.gender)}</b>-word`);
    const rows = [
      ["Indef. sing.", v.indefinite_singular],
      ["Def. sing.", v.definite_singular],
      ["Indef. plur.", v.indefinite_plural],
      ["Def. plur.", v.definite_plural],
    ].filter(([, val]) => val);
    let html = parts.join(" ");
    if (rows.length) {
      html += "<table>" + rows.map(([k, val]) =>
        `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(val)}</td></tr>`
      ).join("") + "</table>";
    }
    return html;
  }
  return "";
}

// SHA-1 → first 10 hex chars (stable GUID for dedup across re-adds)
async function stableGuid(date, word) {
  const buf = new TextEncoder().encode(`${date}::${word}`);
  const hash = await crypto.subtle.digest("SHA-1", buf);
  return Array.from(new Uint8Array(hash))
    .slice(0, 5)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function buildNote(v, lesson) {
  const sourceLabel = `${lesson.source} · ${lesson.date}`;
  const example = bold(v.example_from_article, v.word);

  return {
    deckName: DECK_NAME,
    modelName: MODEL_NAME,
    fields: {
      Word: v.word || "",
      Lemma: v.lemma || "",
      POS: v.pos || "",
      English: v.english || "",
      Example: example,
      Forms: buildFormsHtml(v),
      Note: v.note || "",
      Source: sourceLabel,
      URL: lesson.url || "",
    },
    tags: [
      "danish-daily",
      `date::${lesson.date}`,
      `source::${(lesson.source || "").toLowerCase()}`,
      v.pos ? `pos::${v.pos}` : null,
    ].filter(Boolean),
    options: { allowDuplicate: false, duplicateScope: "deck" },
    // GUID is set after note is added via updateNoteFields if needed; addNote
    // doesn't accept guid directly. We fall back to AnkiConnect's built-in
    // duplicate check (first field + deck) — same Word in the same deck won't
    // re-add. Date is encoded in the Source field so different days are
    // distinguishable in browser even when Word collides.
  };
}

// ---------- Public: add a single vocab entry ----------

async function addVocabToAnki(vocab, lesson) {
  await ensureDeck();
  await ensureModel();
  const note = await buildNote(vocab, lesson);
  // canAddNotes returns false if it's a duplicate (per first-field + deck)
  const canAdd = await ankiInvoke("canAddNotes", { notes: [note] });
  if (!canAdd[0]) {
    return { status: "duplicate" };
  }
  const id = await ankiInvoke("addNote", { note });
  return { status: "added", noteId: id };
}

// ---------- Button click handler ----------

window.addEventListener("click", async (ev) => {
  const btn = ev.target.closest(".add-to-anki");
  if (!btn || btn.disabled) return;
  ev.preventDefault();

  const lesson = window.__currentLesson;
  if (!lesson) return;
  const idx = Number(btn.dataset.vocabIndex);
  const vocab = lesson.vocabulary?.[idx];
  if (!vocab) return;

  setBtnState(btn, "loading");
  try {
    const res = await addVocabToAnki(vocab, lesson);
    setBtnState(btn, res.status === "duplicate" ? "duplicate" : "success");
  } catch (e) {
    setBtnState(btn, "error", e.message);
  }
});

function setBtnState(btn, state, msg) {
  btn.classList.remove("is-loading", "is-success", "is-error", "is-duplicate");
  btn.removeAttribute("title");
  switch (state) {
    case "loading":
      btn.classList.add("is-loading");
      btn.textContent = "…";
      btn.disabled = true;
      break;
    case "success":
      btn.classList.add("is-success");
      btn.textContent = "✓ Added";
      btn.disabled = true;
      break;
    case "duplicate":
      btn.classList.add("is-duplicate");
      btn.textContent = "✓ Already added";
      btn.disabled = true;
      break;
    case "error":
      btn.classList.add("is-error");
      btn.textContent = "× Error";
      btn.disabled = false;
      if (msg) btn.title = msg;
      break;
    default:
      btn.textContent = "+ Anki";
      btn.disabled = false;
  }
}
