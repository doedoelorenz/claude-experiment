// Danish Daily — fetches the latest lesson JSON and renders it.

const $ = (sel, root = document) => root.querySelector(sel);

async function loadLesson() {
  const url = `data/latest.json?t=${Date.now()}`; // cache-bust
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No lesson available (${res.status})`);
  return res.json();
}

function renderParagraphs(text, container) {
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
  // Header meta
  $("#meta").textContent = `${lesson.date} · ${lesson.source} · ${lesson.difficulty}`;

  const tpl = $("#lesson-template").content.cloneNode(true);

  $(".title", tpl).textContent = lesson.title;
  $(".source", tpl).textContent = lesson.source;
  $(".src-link", tpl).href = lesson.url;
  $(".difficulty", tpl).textContent = lesson.difficulty;

  // Danish article
  renderParagraphs(lesson.danish_text_clean, $(".danish-text", tpl));

  // English translation
  renderParagraphs(lesson.english_translation || lesson.english_summary, $(".english-translation", tpl));

  // Vocabulary
  const vocabUl = $(".vocab-list", tpl);
  (lesson.vocabulary || []).forEach(v => {
    const li = document.createElement("li");
    li.className = "vocab-item";

    const isVerb = v.pos === "verb";
    const isNoun = v.pos === "noun";

    li.innerHTML = `
      <div class="vocab-head">
        <span class="word">${escape(v.word)}</span>
        ${v.lemma && v.lemma !== v.word ? `<span class="lemma">(${escape(v.lemma)})</span>` : ""}
        <span class="pos">${escape(v.pos || "")}</span>
      </div>
      <div class="english">${escape(v.english || "")}</div>
      ${isVerb ? renderVerbForms(v) : ""}
      ${isNoun ? renderNounForms(v) : ""}
      ${v.example_from_article ? `<div class="example">"${escape(v.example_from_article)}"</div>` : ""}
      ${v.note ? `<div class="note">${escape(v.note)}</div>` : ""}
    `;
    vocabUl.appendChild(li);
  });

  // Grammar
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
