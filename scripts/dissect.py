"""Call local Claude Code (`claude --print`) to dissect a Danish article into a study lesson."""
import os
import re
import json
import subprocess

CLAUDE_CMD = os.path.join(os.environ.get("APPDATA", ""), "npm", "claude.cmd")

DISSECTION_PROMPT = """You are a Danish language tutor for a learner at the A2-B1 level.

I will give you a Danish news article. Produce a JSON study lesson.

Output ONLY valid JSON, no markdown fences, no commentary before or after.

Required keys:

- "danish_text_clean": the article text in Danish, lightly cleaned (remove ads, navigation, footer cruft). Keep paragraph breaks as \\n\\n.

- "english_translation": A direct, sentence-by-sentence translation of the ENTIRE Danish text into natural English. NOT a summary — translate everything, preserving meaning and tone. Use \\n\\n for paragraph breaks matching the Danish.

- "vocabulary": array of 8-12 word entries. Choose useful, tricky, or educational words for an A2-B1 learner. Skip very basic words ('og', 'en', 'er', 'det'). Each entry has:
    - "word": Danish word as it appears in the article
    - "lemma": dictionary form
    - "pos": one of "noun", "verb", "adj", "adv", "prep", "conj", "pron"
    - "english": English meaning(s)
    - "example_from_article": the sentence where this word appears
    - "note": optional general note (false friends, irregular forms, register, etc.)

    For VERB entries, additionally include:
    - "infinitive": e.g. "at spise"
    - "present_tense": e.g. "spiser"
    - "past_tense": e.g. "spiste"
    - "past_participle": e.g. "spist"

    For NOUN entries, additionally include:
    - "gender": "en" or "et"
    - "indefinite_singular": e.g. "en bil"
    - "definite_singular": e.g. "bilen"
    - "indefinite_plural": e.g. "biler"
    - "definite_plural": e.g. "bilerne"

- "grammar_notes": array of 3-4 entries covering DIFFERENT categories. Try to include modal verbs, adverbs, and connectors/conjunctions when they appear in the article. Each entry has:
    - "topic": short title (e.g. "Modal verb 'kunne' (can)")
    - "category": one of "modal verb", "adverb", "connector", "syntax", "tense", "other"
    - "explanation": 1-3 sentences grounded in examples from the article

- "difficulty": "A2", "B1", or "B2"

- "discussion_questions": array of 1-3 simple questions in Danish the learner could answer in writing

ARTICLE TITLE: {title}
ARTICLE URL: {url}
ARTICLE TEXT:
{body}
"""


def _git_bash_path() -> str:
    """Locate git-bash.exe — required by Claude Code on Windows."""
    candidates = [
        os.environ.get("CLAUDE_CODE_GIT_BASH_PATH", ""),
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Git\usr\bin\bash.exe"),
        r"C:\Program Files\Git\bin\bash.exe",
        r"C:\Program Files (x86)\Git\bin\bash.exe",
    ]
    for c in candidates:
        if c and os.path.isfile(c):
            return c
    return ""


def call_claude(prompt: str, model: str = "claude-sonnet-4-6") -> str:
    """Run `claude --print` with the prompt on stdin. Returns stdout. Raises on failure."""
    env = {**os.environ, "PATH": os.environ.get("APPDATA", "") + r"\npm;" +
           r"C:\Program Files\nodejs;" + os.environ.get("PATH", "")}
    bash_path = _git_bash_path()
    if bash_path:
        env["CLAUDE_CODE_GIT_BASH_PATH"] = bash_path
    result = subprocess.run(
        [CLAUDE_CMD, "--print", "--model", model],
        input=prompt,
        text=True,
        capture_output=True,
        env=env,
        encoding="utf-8",
    )
    if result.returncode != 0:
        raise RuntimeError(f"claude --print failed (code {result.returncode}):\n{result.stderr}")
    return result.stdout


def parse_json_loose(text: str) -> dict:
    """Parse JSON from Claude output, tolerating markdown fences and surrounding prose."""
    text = text.strip()
    # Strip markdown fences if present
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    # Find outermost JSON object
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"No JSON object found in Claude output:\n{text[:500]}")
    return json.loads(text[start:end + 1])


def dissect_article(title: str, url: str, body: str) -> dict:
    """Dissect a Danish article. Returns a lesson dict matching the schema in DISSECTION_PROMPT."""
    prompt = DISSECTION_PROMPT.format(title=title, url=url, body=body)
    raw = call_claude(prompt)
    return parse_json_loose(raw)
