// Danish Daily — fetches the latest lesson JSON and renders it.

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

async function loadLesson() {
  const url = `data/latest.json?t=${Date.now()}`; // cache-bust
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No lesson available (${res.status})`);
  return res.json();
}

function render(lesson) {
  // Header meta
  $("#meta").textContent = `${lesson.date} · ${lesson.source} · ${lesson.difficulty}`;

  // Clone template
  const tpl = $("#lesson-template").content.cloneNode(true);

  $(".title", tpl).textContent = lesson.title;
  $(".source", tpl).textContent = lesson.source;
  $(".src-link", tpl).href = lesson.url;
  $(".difficulty", tpl).textContent = lesson.difficulty;
  $(".english-summary", tpl).textContent = lesson.english_summary;

  // Danish text — split on double newlines into paragraphs
  const danishEl = $(".danish-text", tpl);
  (lesson.danish_text_clean || "")
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean)
    .forEach(para => {
      const p = document.createElement("p");
      p.textContent = para;
      danishEl.appendChild(p);
    });

  // Vocabulary
  const vocabUl = $(".vocab-list", tpl);
  (lesson.vocabulary || []).forEach(v => {
    const li = document.createElement("li");
    li.className = "vocab-item";
    li.innerHTML = `
      <div class="vocab-head">
        <span class="word">${escape(v.word)}</span>
        <span class="lemma">${v.lemma && v.lemma !== v.word ? `(${escape(v.lemma)})` : ""}</span>
        <span class="pos">${escape(v.pos || "")}</span>
      </div>
      <div class="english">${escape(v.english || "")}</div>
      ${v.example_from_article ? `<div class="example">"${escape(v.example_from_article)}"</div>` : ""}
      ${v.note ? `<div class="note">${escape(v.note)}</div>` : ""}
    `;
    vocabUl.appendChild(li);
  });

  // Grammar
  const gramUl = $(".grammar-list", tpl);
  (lesson.grammar_notes || []).forEach(g => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${escape(g.topic)}</strong><p>${escape(g.explanation)}</p>`;
    gramUl.appendChild(li);
  });

  // Discussion
  const discUl = $(".discussion-list", tpl);
  (lesson.discussion_questions || []).forEach(q => {
    const li = document.createElement("li");
    li.textContent = q;
    discUl.appendChild(li);
  });

  const app = $("#app");
  app.innerHTML = "";
  app.appendChild(tpl);
}

function renderError(err) {
  $("#app").innerHTML = `
    <div class="error">
      <h2>No lesson today (yet)</h2>
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

loadLesson().then(render).catch(renderError);
