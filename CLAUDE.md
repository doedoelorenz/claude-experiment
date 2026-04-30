# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: Danish Daily

A daily Danish news habit tool. Fetches one article from DR / Politiken / Berlingske, dissects it with local Claude Code into a study lesson (vocab, grammar notes, English summary, discussion questions), saves it as JSON. Future phases: web UI on GitHub Pages, Telegram daily notification, Windows Task Scheduler automation.

## Workflow rule

Always follow **explore → plan → code → commit** for non-trivial tasks. (See memory.)

## Run

```bash
python scripts/daily_lesson.py            # generates today's lesson if not already present
python scripts/daily_lesson.py --force    # regenerate today's lesson
python scripts/daily_lesson.py --no-notify  # skip Telegram message
python scripts/fetch_rss.py               # smoke-test the RSS feeds
python scripts/telegram.py --test         # send a hello-world Telegram message
scripts/run_daily.bat                     # end-to-end: lesson + commit + push (Task Scheduler entry point)
```

Dependencies: `pip install -r requirements.txt` (just `trafilatura`).

Secrets in `.env` (gitignored): `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `SITE_URL`. See `.env.example`.

## Daily automation (Windows Task Scheduler)

Register the included task once via:
```bash
schtasks /create /xml "scripts\danish_daily_task.xml" /tn "Danish Daily"
```
Runs `run_daily.bat` daily at 07:00. `StartWhenAvailable=true` so missed runs catch up the next time the laptop wakes. Logs append to `logs/daily.log` (gitignored).

## Architecture

```
scripts/fetch_rss.py    Pure stdlib (urllib + ET) RSS reader for the 3 Danish sources.
scripts/dissect.py      Calls `claude --print` via subprocess with a structured Danish-tutor
                        prompt. Parses JSON loosely (tolerates fences/prose around the object).
scripts/daily_lesson.py Orchestrator: fetch → pick unused article → trafilatura body extract
                        (falls back to RSS description) → dissect → write data/YYYY-MM-DD.json.
                        Tracks used URLs in data/_used_urls.json to avoid repeats.
```

Key Windows-specific detail: Claude Code requires `CLAUDE_CODE_GIT_BASH_PATH` pointing at a git-bash. `dissect.py::_git_bash_path()` discovers it automatically from common install locations.

## JSON lesson schema

`docs/data/YYYY-MM-DD.json` contains:

- `danish_text_clean` — cleaned Danish article text (paragraphs separated by `\n\n`)
- `english_translation` — direct sentence-by-sentence translation (NOT a summary)
- `vocabulary[]` — each entry has `word`, `lemma`, `pos`, `english`, `example_from_article`, `note`, plus:
  - **Verbs:** `infinitive`, `present_tense`, `past_tense`, `past_participle`
  - **Nouns:** `gender` (`en`/`et`), `indefinite_singular`, `definite_singular`, `indefinite_plural`, `definite_plural`
- `grammar_notes[]` — each has `topic`, `category` (`modal verb` / `adverb` / `connector` / `syntax` / `tense` / `other`), `explanation`. Prompt aims for 3-4 covering different categories.
- `difficulty` — `A2`, `B1`, or `B2`
- `discussion_questions[]` — 1-3 questions in Danish
- Metadata: `date`, `source`, `title`, `url`, `pub_date`

Web UI section order: **Danish article → Vocabulary → English translation → Grammar notes → Discussion**.

## GitHub

Repo: github.com/doedoelorenz/claude-experiment (private). Authenticated via Git Credential Manager — `git push` works without further setup.
