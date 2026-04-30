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
python scripts/fetch_rss.py               # smoke-test the RSS feeds
```

Dependencies: `pip install -r requirements.txt` (just `trafilatura`).

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

`data/YYYY-MM-DD.json` contains: `english_summary`, `danish_text_clean`, `vocabulary[]` (word/lemma/pos/english/example/note), `grammar_notes[]`, `difficulty` (A2/B1/B2), `discussion_questions[]`, plus metadata (`date`, `source`, `title`, `url`, `pub_date`).

## GitHub

Repo: github.com/doedoelorenz/claude-experiment (private). Authenticated via Git Credential Manager — `git push` works without further setup.
