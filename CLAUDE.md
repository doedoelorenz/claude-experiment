# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the script

```bash
python phone_news.py
```

No dependencies beyond the Python standard library. Requires the Claude CLI (`claude.cmd`) installed via npm at `%APPDATA%\npm\claude.cmd`.

## Architecture

`phone_news.py` is a single-file CLI tool that:

1. Prompts the user for a phone brand name
2. Fetches RSS/Atom feeds from 5 hardcoded tech news sources (The Verge, GSMArena, Android Authority, 9to5Mac, 9to5Google) using `urllib`
3. Filters articles whose titles mention the brand
4. Pipes up to 15 matching headlines into `claude --print --model claude-sonnet-4-6` via `subprocess.run` with the prompt fed through stdin
5. Prints the raw headlines after Claude's summary

The script handles both RSS (`<item>`) and Atom (`<atom:entry>`) feed formats in `parse_articles()`. The Claude CLI call uses a manually constructed `PATH` env var to ensure `claude.cmd` is found on Windows.
