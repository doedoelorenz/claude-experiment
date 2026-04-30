"""Call local Claude Code (`claude --print`) to dissect a Danish article into a study lesson."""
import os
import re
import json
import subprocess

CLAUDE_CMD = os.path.join(os.environ.get("APPDATA", ""), "npm", "claude.cmd")

DISSECTION_PROMPT = """You are a Danish language tutor for a learner at the A2-B1 level.

I will give you a Danish news article. Produce a JSON study lesson for it.

Output ONLY valid JSON, no markdown fences, no commentary before or after.

Schema (all keys required):
{{
  "english_summary": "2-3 sentence summary of the article in English",
  "danish_text_clean": "the article text in Danish, lightly cleaned (remove ads, navigation, footer cruft). Keep paragraph breaks as \\n\\n.",
  "vocabulary": [
    {{
      "word": "Danish word as it appears in the article",
      "lemma": "dictionary form",
      "pos": "noun|verb|adj|adv|prep|conj|pron",
      "english": "English meaning(s)",
      "example_from_article": "the sentence from the article where this word appears",
      "note": "optional grammar note (e.g. 'en-word', 'irregular plural', 'separable verb', 'false friend with English')"
    }}
  ],
  "grammar_notes": [
    {{
      "topic": "short title (e.g. 'Definite article -en/-et')",
      "explanation": "1-3 sentence explanation of how this grammar point appears in the article"
    }}
  ],
  "difficulty": "A2 | B1 | B2",
  "discussion_questions": [
    "1-3 simple questions in Danish the learner could try to answer in writing"
  ]
}}

Pick 8-12 vocabulary words that are useful, common-but-tricky, or otherwise educational for an A2-B1 learner. Skip very basic words ('og', 'en', 'er'). Prefer words that appear in the article.

Pick 2-3 grammar notes from things visible in the article — pick interesting, relevant points.

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
