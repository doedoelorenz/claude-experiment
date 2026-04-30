"""Send the daily-lesson notification to Telegram."""
import json
import urllib.parse
import urllib.request
from html import escape

import config


API_BASE = "https://api.telegram.org"


def _post(method: str, token: str, payload: dict) -> dict:
    url = f"{API_BASE}/bot{token}/{method}"
    data = urllib.parse.urlencode(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))


def send_message(text: str, *, parse_mode: str = "HTML", disable_preview: bool = False) -> dict:
    """Send a message to the configured chat. Raises if config missing or API fails."""
    token = config.get("TELEGRAM_BOT_TOKEN")
    chat_id = config.get("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        raise RuntimeError("TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set in .env")
    result = _post("sendMessage", token, {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": parse_mode,
        "disable_web_page_preview": "true" if disable_preview else "false",
    })
    if not result.get("ok"):
        raise RuntimeError(f"Telegram API error: {result}")
    return result


def is_configured() -> bool:
    return bool(config.get("TELEGRAM_BOT_TOKEN") and config.get("TELEGRAM_CHAT_ID"))


def send_lesson_notification(lesson: dict) -> None:
    """Format and send the daily lesson notification."""
    site = config.get("SITE_URL", "")
    title = escape(lesson.get("title", "Today's lesson"))
    source = escape(lesson.get("source", ""))
    difficulty = escape(lesson.get("difficulty", ""))
    n_vocab = len(lesson.get("vocabulary", []))
    n_grammar = len(lesson.get("grammar_notes", []))

    text_lines = [
        "🇩🇰 <b>Today's Danish lesson is ready</b>",
        "",
        f"<b>{title}</b>",
        f"<i>{source} · {difficulty} · {n_vocab} vocab · {n_grammar} grammar notes</i>",
    ]
    if site:
        text_lines.append("")
        text_lines.append(f'👉 <a href="{escape(site)}">Open today\'s lesson</a>')

    send_message("\n".join(text_lines))


if __name__ == "__main__":
    # Smoke test: send a "hello" notification.
    import sys
    if "--test" in sys.argv:
        send_message("🇩🇰 <b>Test message</b> from Danish Daily setup ✅")
        print("Test message sent.")
    else:
        print("Usage: python scripts/telegram.py --test")
