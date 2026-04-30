"""Daily Danish lesson generator.

Pipeline:
  1. Fetch RSS from DR / Politiken / Berlingske
  2. Pick one unused article (preferring substantial summaries)
  3. Try to extract the full article body via trafilatura; fall back to RSS description
  4. Call local Claude Code to produce a JSON dissection (vocab, grammar, summary)
  5. Write data/YYYY-MM-DD.json and record the URL as used

Run: python scripts/daily_lesson.py [--force]
"""
import sys
import json
import random
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from fetch_rss import fetch_all_feeds, fetch_url
from dissect import dissect_article
import telegram

ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / "docs" / "data"
USED_URLS_FILE = DATA_DIR / "_used_urls.json"
LATEST_FILE = DATA_DIR / "latest.json"
INDEX_FILE = DATA_DIR / "index.json"


def extract_article_body(url: str) -> str | None:
    """Fetch URL and extract main article text. Returns None on any failure."""
    try:
        import trafilatura
    except ImportError:
        print("  [warn] trafilatura not installed; can't extract full article body")
        return None
    try:
        html = fetch_url(url).decode("utf-8", errors="ignore")
        return trafilatura.extract(html)
    except Exception as e:
        print(f"  [warn] body extraction failed: {e}")
        return None


def load_used_urls() -> set:
    if USED_URLS_FILE.exists():
        return set(json.loads(USED_URLS_FILE.read_text(encoding="utf-8")))
    return set()


def save_used_url(url: str) -> None:
    used = load_used_urls()
    used.add(url)
    USED_URLS_FILE.parent.mkdir(parents=True, exist_ok=True)
    USED_URLS_FILE.write_text(json.dumps(sorted(used), indent=2), encoding="utf-8")


def pick_article(articles: list, used: set) -> dict | None:
    """Pick a fresh article. Prefer ones with longer descriptions; randomize among the top 5."""
    unused = [a for a in articles if a["link"] and a["link"] not in used]
    if not unused:
        return None
    unused.sort(key=lambda a: len(a["description"]), reverse=True)
    return random.choice(unused[:5])


def main() -> None:
    today = date.today().isoformat()
    out_path = DATA_DIR / f"{today}.json"

    if out_path.exists() and "--force" not in sys.argv:
        print(f"Lesson for {today} already exists at {out_path}.")
        print("Use --force to regenerate.")
        return

    print("Fetching Danish news feeds...")
    articles = fetch_all_feeds()

    used = load_used_urls()
    article = pick_article(articles, used)
    if not article:
        print("No suitable unused articles found.")
        sys.exit(1)

    print(f"\nPicked: [{article['source']}] {article['title']}")
    print(f"URL:    {article['link']}")

    body = extract_article_body(article["link"])
    if not body or len(body) < 200:
        print("  Falling back to RSS description (full article unavailable or too short).")
        body = article["description"] or article["title"]
    print(f"  Body length: {len(body)} chars")

    print("\nCalling Claude for dissection (this may take 30-60s)...")
    lesson = dissect_article(article["title"], article["link"], body)

    # Attach metadata
    lesson["date"] = today
    lesson["source"] = article["source"]
    lesson["title"] = article["title"]
    lesson["url"] = article["link"]
    lesson["pub_date"] = article["pub_date"]

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(lesson, ensure_ascii=False, indent=2)
    out_path.write_text(payload, encoding="utf-8")
    LATEST_FILE.write_text(payload, encoding="utf-8")
    save_used_url(article["link"])
    update_manifest()

    print(f"\nSaved lesson to {out_path}")
    print(f"  vocab:  {len(lesson.get('vocabulary', []))} words")
    print(f"  grammar: {len(lesson.get('grammar_notes', []))} notes")
    print(f"  difficulty: {lesson.get('difficulty', '?')}")

    # Optional: send Telegram notification (skips silently if .env not configured)
    if telegram.is_configured() and "--no-notify" not in sys.argv:
        try:
            telegram.send_lesson_notification(lesson)
            print("  Telegram notification sent.")
        except Exception as e:
            print(f"  [warn] Telegram notification failed: {e}")


def update_manifest() -> None:
    """Write docs/data/index.json with a sorted list of available lesson dates."""
    dates = sorted(
        (p.stem for p in DATA_DIR.glob("*.json")
         if p.stem not in {"latest", "index", "_used_urls"}),
        reverse=True,
    )
    INDEX_FILE.write_text(
        json.dumps({"latest": dates[0] if dates else None, "all": dates}, indent=2),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
