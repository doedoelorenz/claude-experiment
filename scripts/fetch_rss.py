"""Fetch and parse RSS feeds from Danish news sources."""
import urllib.request
import xml.etree.ElementTree as ET

DANISH_FEEDS = [
    ("DR",         "https://www.dr.dk/nyheder/service/feeds/senestenyt"),
    ("Politiken",  "https://politiken.dk/rss/senestenyt.rss"),
    ("Berlingske", "https://www.berlingske.dk/content/rss"),
]


def fetch_url(url, timeout=10):
    """Fetch a URL and return raw bytes. Raises on failure."""
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def parse_rss(xml_bytes):
    """Parse RSS 2.0 feed bytes into a list of article dicts."""
    articles = []
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError:
        return articles
    for item in root.findall(".//item"):
        articles.append({
            "title":       (item.findtext("title") or "").strip(),
            "link":        (item.findtext("link") or "").strip(),
            "description": (item.findtext("description") or "").strip(),
            "pub_date":    (item.findtext("pubDate") or "").strip(),
        })
    return articles


def fetch_all_feeds():
    """Fetch all configured Danish feeds. Returns list of article dicts with 'source' added."""
    results = []
    for source, url in DANISH_FEEDS:
        try:
            data = fetch_url(url)
        except Exception as e:
            print(f"  [warn] Failed to fetch {source}: {e}")
            continue
        articles = parse_rss(data)
        for art in articles:
            art["source"] = source
        print(f"  {source}: {len(articles)} articles")
        results.extend(articles)
    return results


if __name__ == "__main__":
    arts = fetch_all_feeds()
    print(f"\nTotal: {len(arts)} articles")
    for a in arts[:5]:
        print(f"- [{a['source']}] {a['title']}")
