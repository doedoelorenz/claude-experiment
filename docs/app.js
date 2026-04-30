// Danish Daily — fetches a lesson JSON (latest or specific date) and renders it.

const $ = (sel, root = document) => root.querySelector(sel);

let lessonIndex = { all: [], latest: null }; // populated from data/index.json

// ---------- Data loading ----------

async function loadIndex() {
  try {
    const res = await fetch(`data/index.json?t=${Date.now()}`);
    if (!res.ok) return { all: [], latest: null };
    return res.json();
  } catch {
    return { all: [], latest: null };
  }
}

async function loadLesson(date) {
  const file = date ? `${date}.json` : "latest.json";
  const res = await fetch(`data/${file}?t=${Date.now()}`);
  if (!res.ok) throw new Error(`No lesson found for ${date || "latest"} (${res.status})`);
  return res.json();
}

function getDateFromHash() {
  const m = location.hash.match(/^#\/(\d{4}-\d{2}-\d{2})$/);
  return m ? m[1] : null;
}

// ---------- Navigation ----------

function updateNav(currentDate) {
  const dates = lessonIndex.all || []; // sorted descending (newest first)
  const idx = dates.indexOf(currentDate);
  const prevBtn = $("#prev-day");
  const nextBtn = $("#next-day");

  const olderDate = idx >= 0 && idx < dates.length - 1 ? dates[idx + 1] : null;
  const newerDate = idx > 0 ? dates[idx - 1] : null;

  prevBtn.disabled = !olderDate;
  prevBtn.dataset.date = olderDate || "";
  nextBtn.disabled = !newerDate;
  nextBtn.dataset.date = newerDate || "";
}

function navigateTo(date) {
  if (!date) return;
  // If clicking the latest, drop the hash so it still works after the next cron run.
  if (date === lessonIndex.latest) {
    history.replaceState(null, "", location.pathname);
    loadAndRender();
  } else {
    location.hash = `/${date}`;
  }
}

// ---------- Rendering ----------

function renderParagraphs(text, container) {
  container.innerHTML = "";
  (text || "")
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean)
    .forEach(para => {
      const p = document.createElement("p");
      p.textContent = para;
      container.appendChild(p);
    });
}

function renderVerbForms(v) {
  const rows = [
    ["Infinitive", v.infinitive],
    ["Present", v.present_tense],
    ["Past", v.past_tense],
    ["Past participle", v.past_participle],
  ].filter(([, val]) => val);
  if (!rows.length) return "";
  return `
    <dl class="forms forms-verb">
      ${rows.map(([k, val]) => `<dt>${k}</dt><dd>${escape(val)}</dd>`).join("")}
    </dl>`;
}

function renderNounForms(v) {
  if (!v.gender && !v.indefinite_singular && !v.definite_singular) return "";
  const rows = [
    ["Indef. sing.", v.indefinite_singular],
    ["Def. sing.",   v.definite_singular],
    ["Indef. plur.", v.indefinite_plural],
    ["Def. plur.",   v.definite_plural],
  ].filter(([, val]) => val);
  const genderBadge = v.gender ? `<span class="gender gender-${escape(v.gender)}">${escape(v.gender)}-word</span>` : "";
  return `
    ${genderBadge}
    <dl class="forms forms-noun">
      ${rows.map(([k, val]) => `<dt>${k}</dt><dd>${escape(val)}</dd>`).join("")}
    </dl>`;
}

function render(lesson) {
  window.__currentLesson = lesson; // accessed by anki.js for per-vocab Add buttons
  $("#meta").textContent = `${lesson.date} · ${lesson.source} · ${lesson.difficulty}`;

  const tpl = $("#lesson-template").content.cloneNode(true);

  $(".title", tpl).textContent = lesson.title;
  $(".source", tpl).textContent = lesson.source;
  $(".src-link", tpl).href = lesson.url;
  $(".difficulty", tpl).textContent = lesson.difficulty;

  renderParagraphs(lesson.danish_text_clean, $(".danish-text", tpl));
  renderParagraphs(lesson.english_translation || lesson.english_summary, $(".english-translation", tpl));

  const vocabUl = $(".vocab-list", tpl);
  (lesson.vocabulary || []).forEach((v, idx) => {
    const li = document.createElement("li");
    li.className = "vocab-item";
    const isVerb = v.pos === "verb";
    const isNoun = v.pos === "noun";
    li.innerHTML = `
      <div class="vocab-head">
        <span class="word">${escape(v.word)}</span>
        ${v.lemma && v.lemma !== v.word ? `<span class="lemma">(${escape(v.lemma)})</span>` : ""}
        <span class="pos">${escape(v.pos || "")}</span>
        <button class="add-to-anki" data-vocab-index="${idx}" aria-label="Add to Anki">+ Anki</button>
      </div>
      <div class="english">${escape(v.english || "")}</div>
      ${isVerb ? renderVerbForms(v) : ""}
      ${isNoun ? renderNounForms(v) : ""}
      ${v.example_from_article ? `<div class="example">"${escape(v.example_from_article)}"</div>` : ""}
      ${v.note ? `<div class="note">${escape(v.note)}</div>` : ""}
    `;
    vocabUl.appendChild(li);
  });

  const gramUl = $(".grammar-list", tpl);
  (lesson.grammar_notes || []).forEach(g => {
    const li = document.createElement("li");
    const cat = g.category ? `<span class="cat cat-${escape(g.category.replace(/\s+/g, "-"))}">${escape(g.category)}</span>` : "";
    li.innerHTML = `
      <div class="grammar-head">
        <strong>${escape(g.topic)}</strong>
        ${cat}
      </div>
      <p>${escape(g.explanation)}</p>`;
    gramUl.appendChild(li);
  });

  const discUl = $(".discussion-list", tpl);
  (lesson.discussion_questions || []).forEach(q => {
    const li = document.createElement("li");
    li.textContent = q;
    discUl.appendChild(li);
  });

  const app = $("#app");
  app.innerHTML = "";
  app.appendChild(tpl);
  window.scrollTo({ top: 0 });
}

function renderError(err) {
  $("#app").innerHTML = `
    <div class="error">
      <h2>No lesson available</h2>
      <p>${escape(err.message)}</p>
      <p>Run <code>python scripts/daily_lesson.py</code> to generate one.</p>
    </div>
  `;
}

function escape(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// ---------- Bootstrap ----------

async function loadAndRender() {
  const requested = getDateFromHash();
  try {
    const [idx, lesson] = await Promise.all([loadIndex(), loadLesson(requested)]);
    lessonIndex = idx;
    render(lesson);
    updateNav(lesson.date);
  } catch (e) {
    renderError(e);
  }
}

$("#prev-day").addEventListener("click", e => navigateTo(e.currentTarget.dataset.date));
$("#next-day").addEventListener("click", e => navigateTo(e.currentTarget.dataset.date));
window.addEventListener("hashchange", loadAndRender);

loadAndRender();
