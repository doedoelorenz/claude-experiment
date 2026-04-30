import sys
import os
import subprocess
import urllib.request
import xml.etree.ElementTree as ET

RSS_FEEDS = [
    ("The Verge",         "https://www.theverge.com/rss/index.xml"),
    ("GSMArena",          "https://www.gsmarena.com/rss-news-reviews.php3"),
    ("Android Authority", "https://www.androidauthority.com/feed/"),
    ("9to5Mac",           "https://9to5mac.com/feed/"),
    ("9to5Google",        "https://9to5google.com/feed/"),
]

CLAUDE_CMD = os.path.join(os.environ.get("APPDATA", ""), "npm", "claude.cmd")

def fetch_feed(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            return resp.read()
    except Exception:
        return None

def parse_articles(xml_data):
    articles = []
    try:
        root = ET.fromstring(xml_data)
        ns = {"atom": "http://www.w3.org/2005/Atom"}
        for item in root.findall(".//item"):
            title = item.findtext("title", "").strip()
            link  = item.findtext("link", "").strip()
            date  = item.findtext("pubDate", "").strip()
            articles.append((title, link, date))
        for entry in root.findall(".//atom:entry", ns):
            title = entry.findtext("atom:title", "", ns).strip()
            link_el = entry.find("atom:link", ns)
            link  = link_el.get("href", "") if link_el is not None else ""
            date  = entry.findtext("atom:updated", "", ns).strip()
            articles.append((title, link, date))
    except ET.ParseError:
        pass
    return articles

def matches(text, brand):
    return brand.lower() in text.lower()

def summarize_with_claude(brand, articles):
    headlines = "\n".join(
        f"- [{src}] {title} ({date})"
        for src, title, _, date in articles
    )
    prompt = (
        f"You are a tech news analyst. Here are recent headlines about {brand} phones:\n\n"
        f"{headlines}\n\n"
        f"Give me a concise briefing with:\n"
        f"1. The 3-4 most important stories and why they matter\n"
        f"2. Overall sentiment — is {brand} having a good or bad moment?\n"
        f"3. One-line verdict: buy, wait, or avoid right now?"
    )
    print("\nAsking Claude to summarize...\n")
    print("=" * 45)
    env = {**os.environ, "PATH": os.environ.get("APPDATA", "") + r"\npm;" +
           r"C:\Program Files\nodejs;" + os.environ.get("PATH", "")}
    result = subprocess.run(
        [CLAUDE_CMD, "--print", "--model", "claude-sonnet-4-6"],
        input=prompt,
        text=True,
        capture_output=False,
        env=env
    )
    if result.returncode != 0:
        print("Claude summarization failed. Showing raw headlines instead.")

def main():
    print("=" * 45)
    print("       Phone News Briefing")
    print("=" * 45)
    print("\nWhich phone brand would you like news on?")
    print("(e.g. Apple, Samsung, Google, OnePlus, Sony)\n")
    brand = input("> ").strip()

    if not brand:
        print("No brand entered. Exiting.")
        sys.exit(1)

    print(f"\nSearching {len(RSS_FEEDS)} sources for '{brand}' news...")

    found = []
    for source_name, url in RSS_FEEDS:
        data = fetch_feed(url)
        if not data:
            continue
        for title, link, date in parse_articles(data):
            if matches(title, brand):
                found.append((source_name, title, link, date))

    if not found:
        print(f"\nNo recent articles found for '{brand}'.")
        print("Try a different spelling, e.g. 'Samsung' not 'samsung galaxy'.")
        sys.exit(0)

    print(f"Found {len(found)} article(s). Feeding to news agent...\n")

    summarize_with_claude(brand, found[:15])

    print("=" * 45)
    print("\nRaw headlines:")
    print("-" * 45)
    for i, (source, title, link, date) in enumerate(found[:15], 1):
        print(f"{i}. [{source}] {title}")
        if link:
            print(f"   {link}")
    print()

if __name__ == "__main__":
    main()
