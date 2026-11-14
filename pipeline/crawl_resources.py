"""Follow the links of the official challenge resource pages, two levels deep.

Level 1: links in the main content of each saved `challenge-*` page.
Level 2: from level-1 web pages, documents only (pdf, epub, docx, xlsx, csv, zip) and
NTRS records.

Rules, written as code so the crawl can be repeated and audited:
- hosts: *.nasa.gov, govinfo.gov, doi.org (other agencies' and third-party sites are listed, not followed)
- skipped: share buttons, feeds, search pages, images, video
- spinoff.nasa.gov pages: documents only (their content links are "related stories" on other topics)

Adds the results to data/manifest/external_sources.json (ids `crawl-…`, field `found_on`),
then `python -I pipeline/fetch.py --priority P2` downloads them.

Usage:  python -I pipeline/crawl_resources.py
"""
import json
import re
import sys
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import psi_client  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
SOURCES = ROOT / "data" / "manifest" / "external_sources.json"

DOC = re.compile(r"\.(pdf|epub|docx?|xlsx?|pptx?|csv|zip)$", re.I)
SKIP = re.compile(r"(sharer|shareArticle|intent/tweet|/feed/?$|/search|\.(jpe?g|png|gif|svg|mp4|mov)$)", re.I)
ALLOWED = re.compile(r"(^|\.)(nasa\.gov|govinfo\.gov|doi\.org)$", re.I)


class ContentLinks(HTMLParser):
    """Links inside <main> or a known article body, outside nav/footer/aside."""

    def __init__(self):
        super().__init__()
        self.inside, self.skip, self.links = 0, 0, []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = a.get("class") or ""
        if tag == "main" or re.search(r"entry-content|article-body|field--name-body|node__content|region-content", cls):
            self.inside += 1
        if self.inside and tag in ("nav", "footer", "aside"):
            self.skip += 1
        if tag == "a" and self.inside and not self.skip and a.get("href"):
            self.links.append(a["href"])

    def handle_endtag(self, tag):
        if self.inside and tag in ("nav", "footer", "aside") and self.skip:
            self.skip -= 1


def clean(url, base):
    u = urllib.parse.urljoin(base, url.strip())
    parts = urllib.parse.urlsplit(u)
    query = "&".join(q for q in parts.query.split("&") if q and not q.startswith("emrc="))
    return urllib.parse.urlunsplit((parts.scheme, parts.netloc, parts.path, query, ""))


def links_of(html, base):
    p = ContentLinks()
    p.feed(html)
    out = []
    for href in dict.fromkeys(p.links):
        if href.startswith(("mailto:", "#", "javascript:")):
            continue
        u = clean(href, base)
        host = urllib.parse.urlsplit(u).hostname or ""
        if SKIP.search(u) or not ALLOWED.search(host):
            continue
        out.append(u)
    return out


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": psi_client.USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", "replace")


def slug(url):
    """Readable and unique: a truncated path plus a short hash of the full URL."""
    import hashlib
    p = urllib.parse.urlsplit(url)
    s = re.sub(r"[^a-z0-9]+", "-", (p.hostname or "").split(".")[0] + "-" + p.path.lower()).strip("-")
    return f"crawl-{s[-60:].strip('-')}-{hashlib.sha1(url.encode()).hexdigest()[:8]}"


def main():
    data = json.loads(SOURCES.read_text(encoding="utf-8"))
    known = {clean(s["url"], s["url"]) for s in data["sources"]}
    seeds = [s for s in data["sources"] if s["id"].startswith("challenge-") and s.get("filename") == "page.html"]

    added = []

    def add(url, found_on, level, is_page):
        if url in known:
            return
        known.add(url)
        entry = {"id": slug(url), "priority": "P2",
                 "role": f"linked from an official challenge resource (level {level})",
                 "title": url, "url": url, "found_on": found_on}
        if is_page:
            entry["filename"] = "page.html"
        added.append(entry)

    level1_pages = []
    for s in seeds:
        html = (RAW / "nasa" / s["id"] / "page.html").read_text(encoding="utf-8", errors="replace")
        docs_only = "spinoff.nasa.gov" in s["url"]
        for u in links_of(html, s["url"]):
            if DOC.search(urllib.parse.urlsplit(u).path):
                add(u, s["url"], 1, False)
            elif not docs_only:
                add(u, s["url"], 1, True)
                level1_pages.append(u)

    for page in level1_pages:
        try:
            html = get(page)
        except Exception as exc:
            print(f"level 2 skipped, {page}: {type(exc).__name__}")
            continue
        for u in links_of(html, page):
            path = urllib.parse.urlsplit(u).path
            if DOC.search(path) or "ntrs.nasa.gov/citations/" in u:
                add(u, page, 2, not DOC.search(path))

    data["sources"].extend(added)
    SOURCES.write_text(json.dumps(data, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"added {len(added)} entries ({sum(1 for a in added if 'filename' in a)} pages, "
          f"{sum(1 for a in added if 'filename' not in a)} documents)")
    for a in added:
        print(f"  {a['role'][-9:]} {a['url']}")


if __name__ == "__main__":
    main()
