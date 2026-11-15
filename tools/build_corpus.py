"""Build the TARS library: a page-level text corpus of every NASA document in data/raw, a chunk file and a BM25 index.

    python -I tools/build_corpus.py                      # build everything into web/.data/corpus/
    python -I tools/build_corpus.py --search "limiting oxygen concentration BASS-II"
    python -I tools/build_corpus.py --search "..." --top 10

Text comes from code, never from a model: PyMuPDF `page.get_text()` for PDF (the call the validator uses),
the XML text of DOCX / PPTX / XLSX, the standard-library HTML parser for web pages and EPUB, the csv module for CSV.
Nothing is OCR'd or summarised. A page with no text layer is skipped and listed in no_text_pages.json.

Outputs (git-ignored, regenerable from data/raw):
  pages.jsonl          one line per page: doc_id, accession, ntrs_id, source_id, title, source_file, page, printed_page,
                       locator, url, file_url, doi, license, sha256, text
  chunks.jsonl         ~320-word chunks, 50-word overlap, each pointing to its pages
  bm25.json            BM25 inverted index over the chunks (no model, no network)
  no_text_pages.json   pages without a text layer, per document
  skipped.json         files not read, with the reason (binary formats, data, media, duplicates)
  corpus_manifest.json counts, sizes, build time and the SHA-256 of pages.jsonl (same input -> same hash)
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import os
import re
import sys
import time
import unicodedata
import zipfile
from collections import Counter, defaultdict
from html.parser import HTMLParser
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
MANIFEST = ROOT / "data" / "manifest"
OUT = ROOT / "web" / ".data" / "corpus"

CHUNK_WORDS, CHUNK_STEP = 320, 270            # 320-word windows, 50-word overlap
BLOCK_WORDS = 350                              # pseudo-pages for formats without pages (DOCX, TXT)
TABLE_ROWS = 25                                # tables: header + first rows only (the data are in data/conditions)
MIN_CHARS = 20                                 # fewer non-space characters than this = no text layer
STOP = set("a an and are as at be by for from in is it of on or that the this to was were with".split())

TEXT_EXT = {".pdf", ".docx", ".pptx", ".html", ".epub", ".txt", ".csv", ".xlsx", ".json"}


def lp(p: Path) -> str:
    """Path usable by open() / fitz on Windows even beyond 260 characters."""
    s = str(p)
    if os.name == "nt" and not s.startswith("\\\\?\\"):
        s = "\\\\?\\" + os.path.abspath(s)
    return s


# ------------------------------------------------------------------ manifests
def load_manifests():
    checks = {}
    for f in sorted(MANIFEST.glob("checksums_*.csv")):
        with open(f, encoding="utf-8", newline="") as fh:
            rows = [r for r in fh if not r.startswith("#")]
        for r in csv.DictReader(rows):
            checks[r["path"]] = r
    ext = {s["id"]: s for s in json.loads((MANIFEST / "external_sources.json").read_text(encoding="utf-8"))["sources"]}
    inv = {}
    with open(MANIFEST / "investigations.csv", encoding="utf-8", newline="") as fh:
        for r in csv.DictReader(fh):
            inv[r["accession"]] = r
    return checks, ext, inv


def describe(rel: str, checks, ext, inv):
    """Identity and citation fields of one file from the manifests."""
    parts = rel.split("/")
    d = {"accession": "", "ntrs_id": "", "source_id": "", "title": "", "url": "", "file_url": "", "doi": "", "license": ""}
    chk = checks.get(rel)
    if chk and chk.get("source", "").startswith("http"):
        d["file_url"] = chk["source"]
    stem = Path(parts[-1]).stem
    if parts[0] == "psi-data":
        acc = parts[1]
        d["accession"] = acc
        i = inv.get(acc, {})
        d["doi"] = i.get("doi", "")
        d["license"] = i.get("license", "")
        d["url"] = f"https://doi.org/{d['doi']}" if d["doi"] else f"https://psi.nasa.gov/geode-py/ws/repo/investigations/{acc}"
        cat = parts[2] if len(parts) > 3 else ""
        short = re.sub(rf"^{re.escape(acc)}_{re.escape(cat)}_", "", stem) if cat else stem
        d["title"] = f"{acc} {i.get('acronym', '')} - {cat}: {short}".replace("  ", " ")
    else:
        sid = parts[1]
        d["source_id"] = sid
        s = ext.get(sid, {})
        m = re.match(r"ntrs-(\d+)$", sid)
        if m:
            d["ntrs_id"] = m.group(1)
            d["url"] = f"https://ntrs.nasa.gov/citations/{m.group(1)}"
        else:
            d["url"] = s.get("url", "") or d["file_url"]
        d["title"] = (s.get("title") or stem).replace("�", "").strip()
    return d


# ------------------------------------------------------------------ extractors
class _Html(HTMLParser):
    SKIP = {"script", "style", "noscript", "svg", "nav", "header", "footer", "aside", "form", "iframe", "button", "template"}
    BLOCK = {"p", "div", "br", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6", "section", "article", "main", "table", "ul", "ol", "dd", "dt"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.skip = 0
        self.main = 0
        self.title = ""
        self._in_title = False
        self.all, self.inside = [], []

    def handle_starttag(self, tag, attrs):
        if tag == "title":
            self._in_title = True
        if tag in self.SKIP:
            self.skip += 1
        if tag in ("main", "article"):
            self.main += 1
        if tag in self.BLOCK:
            self.all.append("\n")
            self.inside.append("\n") if self.main else None

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
        if tag in self.SKIP and self.skip:
            self.skip -= 1
        if tag in ("main", "article") and self.main:
            self.main -= 1
        if tag in self.BLOCK:
            self.all.append("\n")
            self.inside.append("\n") if self.main else None

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        if self.skip:
            return
        self.all.append(data)
        if self.main:
            self.inside.append(data)


def html_text(raw: bytes) -> tuple[str, str]:
    s = raw.decode("utf-8", "replace")
    p = _Html()
    p.feed(s)
    main = "".join(p.inside)
    text = main if len(main.split()) > 80 else "".join(p.all)
    text = "\n".join(re.sub(r"[ \t ]+", " ", ln).strip() for ln in text.splitlines())
    return re.sub(r"\n{3,}", "\n\n", text).strip(), p.title.strip()


def blocks(lines: list[str], tag: str):
    """Group paragraphs/lines into pseudo-pages of about BLOCK_WORDS words: (text, locator)."""
    out, cur, n, start = [], [], 0, 1
    for i, ln in enumerate(lines, start=1):
        w = len(ln.split())
        if cur and n + w > BLOCK_WORDS:
            out.append(("\n".join(cur), f"{tag}={start}-{i - 1}"))
            cur, n, start = [], 0, i
        cur.append(ln)
        n += w
    if cur:
        out.append(("\n".join(cur), f"{tag}={start}-{start + len(cur) - 1}"))
    return out


def pdf_pages(path: Path):
    import fitz  # PyMuPDF, the library the validator uses
    with fitz.open(lp(path)) as doc:
        for i, page in enumerate(doc, start=1):
            yield page.get_text(), f"page={i}"


def docx_pages(path: Path):
    with zipfile.ZipFile(lp(path)) as z:
        xml = z.read("word/document.xml").decode("utf-8", "replace")
    paras = []
    for p in re.findall(r"<w:p[ >].*?</w:p>", xml, flags=re.S):
        t = "".join(re.findall(r"<w:t[^>]*>([^<]*)</w:t>", p))
        t = t.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"').replace("&apos;", "'")
        paras.append(t.strip())
    return _numbered_blocks(paras)


def _numbered_blocks(paras: list[str]):
    """Pseudo-pages keyed by the paragraph numbers of the whole document (empty paragraphs count, as in the validator dumps)."""
    out, cur, n, start = [], [], 0, 1
    for i, t in enumerate(paras, start=1):
        if not t:
            continue
        w = len(t.split())
        if cur and n + w > BLOCK_WORDS:
            out.append(("\n".join(cur), f"paragraph={start}-{i - 1}"))
            cur, n, start = [], 0, i
        cur.append(t)
        n += w
    if cur:
        out.append(("\n".join(cur), f"paragraph={start}-{len(paras)}"))
    return out


def pptx_pages(path: Path):
    with zipfile.ZipFile(lp(path)) as z:
        names = sorted((n for n in z.namelist() if re.match(r"ppt/slides/slide\d+\.xml$", n)),
                       key=lambda n: int(re.findall(r"\d+", n)[-1]))
        for n in names:
            xml = z.read(n).decode("utf-8", "replace")
            paras = ["".join(re.findall(r"<a:t>([^<]*)</a:t>", p)) for p in re.findall(r"<a:p>.*?</a:p>", xml, flags=re.S)]
            t = "\n".join(x for x in paras if x.strip())
            t = t.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"').replace("&apos;", "'")
            yield t, f"slide={re.findall(r'\d+', n)[-1]}"


def epub_pages(path: Path):
    with zipfile.ZipFile(lp(path)) as z:
        for n in sorted(x for x in z.namelist() if x.lower().endswith((".xhtml", ".html", ".htm"))):
            yield html_text(z.read(n))[0], f"file={n}"


def html_pages(path: Path):
    text, title = html_text(Path(lp(path)).read_bytes())
    yield text, "page=1"


def txt_pages(path: Path):
    raw = Path(lp(path)).read_bytes()
    try:
        s = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        s = raw.decode("cp1252", "replace")
    return [(t, loc) for t, loc in _numbered_blocks(s.splitlines())]


def csv_pages(path: Path):
    raw = Path(lp(path)).read_bytes().decode("utf-8-sig", "replace")
    rows = list(csv.reader(raw.splitlines()))
    head = "\n".join("\t".join(r) for r in rows[:TABLE_ROWS])
    yield f"[table: first {min(TABLE_ROWS, len(rows))} of {len(rows)} rows]\n{head}", f"row=1-{min(TABLE_ROWS, len(rows))}"


def xlsx_pages(path: Path):
    import openpyxl
    wb = openpyxl.load_workbook(lp(path), read_only=True, data_only=True)
    try:
        for ws in wb.worksheets:
            rows = []
            for i, r in enumerate(ws.iter_rows(values_only=True)):
                if i >= TABLE_ROWS:
                    break
                rows.append("\t".join("" if c is None else str(c) for c in r))
            yield f"[sheet {ws.title}: first {len(rows)} rows]\n" + "\n".join(rows), f"sheet={ws.title}"
    finally:
        wb.close()


def investigation_pages(path: Path):
    """PSI investigation record: the long text fields (objective, hypothesis, approach...), named as in the file."""
    e = json.loads(Path(lp(path)).read_bytes().decode("utf-8-sig", "replace"))
    parts = []
    for k, v in e.items():
        if isinstance(v, str) and len(v.strip()) >= 30 and not v.startswith("http"):
            parts.append(f"{k}: {v.strip()}")
    return [("\n".join(parts), "section=*")] if parts else []


def pages_of(path: Path, rel: str):
    ext = path.suffix.lower()
    if ext == ".pdf":
        return pdf_pages(path)
    if ext == ".docx":
        return docx_pages(path)
    if ext == ".pptx":
        return pptx_pages(path)
    if ext == ".html":
        return html_pages(path)
    if ext == ".epub":
        return epub_pages(path)
    if ext == ".txt":
        return txt_pages(path)
    if ext == ".csv":
        return csv_pages(path)
    if ext == ".xlsx":
        return xlsx_pages(path)
    if ext == ".json" and "/_investigation/" in rel:
        return investigation_pages(path)
    return None


PRINTED = re.compile(r"^\s*(?:page\s+)?(\d{1,4}|[ivxlc]{1,6})(?:\s+of\s+\d+)?\s*$", re.I)


def printed_page(text: str) -> str:
    """A bare page number on the first or last non-empty line of the page, when there is one."""
    lines = [ln for ln in text.splitlines() if ln.strip()]
    for ln in (lines[-3:][::-1] + lines[:2]):
        m = PRINTED.match(ln)
        if m:
            return m.group(1)
    return ""


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(lp(path), "rb") as fh:
        for b in iter(lambda: fh.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


# ------------------------------------------------------------------ tokens and BM25
TOKEN = re.compile(r"[a-z0-9]+(?:[.\-][a-z0-9]+)*")


def tokens(text: str) -> list[str]:
    """Lower-case terms; hyphenated terms also index their parts ('bass-ii' -> bass-ii, bass, ii)."""
    out = []
    for t in TOKEN.findall(unicodedata.normalize("NFKC", text).lower()):
        if t in STOP:
            continue
        out.append(t)
        if "-" in t:
            out += [p for p in t.split("-") if p and p not in STOP]
    return out


def build(args):
    t0 = time.time()
    OUT.mkdir(parents=True, exist_ok=True)
    checks, ext, inv = load_manifests()
    files = []
    for dirpath, _, names in os.walk(lp(RAW)):
        for n in names:
            full = Path(dirpath) / n
            rel = Path(str(full).replace("\\\\?\\", "")).relative_to(RAW).as_posix()
            files.append((rel, full))
    files.sort()
    skipped, no_text, failed = [], defaultdict(list), []
    seen_sha, docs_out = {}, []
    stats = Counter()
    pages_path = OUT / "pages.jsonl"
    with open(pages_path, "w", encoding="utf-8", newline="\n") as pf:
        for rel, full in files:
            ext_ = full.suffix.lower()
            if pages_of(full, rel) is None:
                skipped.append({"file": rel, "reason": f"format {ext_ or '(none)'} not read as text"})
                continue
            sha = sha256_of(full)
            if sha in seen_sha:
                skipped.append({"file": rel, "reason": f"identical to {seen_sha[sha]} (same SHA-256)"})
                continue
            seen_sha[sha] = rel
            meta = describe(rel, checks, ext, inv)
            try:
                pages = list(pages_of(full, rel))
            except Exception as err:  # corrupt or encrypted file: listed, not fatal
                failed.append({"file": rel, "error": f"{type(err).__name__}: {err}"[:200]})
                continue
            if ext_ in (".html", ".epub"):
                try:
                    if ext_ == ".html":
                        meta["title"] = html_text(Path(lp(full)).read_bytes())[1] or meta["title"]
                except Exception:
                    pass
            kept = 0
            for i, (text, locator) in enumerate(pages, start=1):
                text = text.replace("\x00", "")
                if len(re.sub(r"\s+", "", text)) < MIN_CHARS:
                    no_text[rel].append(i)
                    stats["pages_no_text"] += 1
                    continue
                rec = {"doc_id": rel, "accession": meta["accession"], "ntrs_id": meta["ntrs_id"], "source_id": meta["source_id"],
                       "title": meta["title"], "source_file": rel, "page": i, "printed_page": printed_page(text),
                       "locator": locator, "url": meta["url"], "file_url": meta["file_url"], "doi": meta["doi"],
                       "license": meta["license"], "sha256": sha, "text": text}
                pf.write(json.dumps(rec, ensure_ascii=False, sort_keys=True) + "\n")
                kept += 1
                stats["pages"] += 1
                stats["words"] += len(text.split())
            stats["documents"] += 1
            stats["pages_total"] += len(pages)
            docs_out.append(rel)
            if args.verbose:
                print(f"{stats['documents']:4d} {rel[:90]} pages={len(pages)} kept={kept}", flush=True)
    t_pages = time.time() - t0

    # ---- chunks + BM25, streamed document by document
    chunk_path = OUT / "chunks.jsonl"
    postings: dict[str, list[int]] = defaultdict(list)
    chunk_meta: list[list] = []                 # [chunk_id, byte offset, byte length, term count]
    total_terms = 0
    n_chunks = 0

    def flush(doc_pages, fh, offset):
        nonlocal n_chunks, total_terms
        if not doc_pages:
            return offset
        words, wpage = [], []
        for p in doc_pages:
            ws = p["text"].split()
            words += ws
            wpage += [p["page"]] * len(ws)
        head = doc_pages[0]
        k, start = 0, 0
        while start < len(words):
            end = min(start + CHUNK_WORDS, len(words))
            if len(words) - end < 80:               # no tiny tail chunk
                end = len(words)
            body = " ".join(words[start:end])
            pgs = sorted(set(wpage[start:end]))
            chunk_id = f"{head['doc_id']}#{k}"
            rec = {"chunk_id": chunk_id, "doc_id": head["doc_id"], "accession": head["accession"], "ntrs_id": head["ntrs_id"],
                   "source_id": head["source_id"], "title": head["title"], "pages": pgs, "page_start": pgs[0], "page_end": pgs[-1],
                   "url": head["url"], "doi": head["doi"], "sha256": head["sha256"], "words": end - start, "text": body}
            line = (json.dumps(rec, ensure_ascii=False, sort_keys=True) + "\n").encode("utf-8")
            fh.write(line)
            terms = tokens(body + " " + head["title"])
            tf = Counter(terms)
            idx = len(chunk_meta)
            chunk_meta.append([chunk_id, offset, len(line), len(terms)])
            for term, c in tf.items():
                postings[term] += [idx, c]
            total_terms += len(terms)
            offset += len(line)
            n_chunks += 1
            k += 1
            if end >= len(words):
                break
            start += CHUNK_STEP
        return offset

    with open(pages_path, encoding="utf-8") as pf, open(chunk_path, "wb") as cf:
        offset, cur_doc, buf = 0, None, []
        for line in pf:
            p = json.loads(line)
            if p["doc_id"] != cur_doc:
                offset = flush(buf, cf, offset)
                cur_doc, buf = p["doc_id"], []
            buf.append(p)
        offset = flush(buf, cf, offset)

    N = len(chunk_meta)
    avgdl = total_terms / max(N, 1)
    index = {"type": "bm25", "k1": 1.5, "b": 0.75, "N": N, "avgdl": round(avgdl, 3),
             "chunks": chunk_meta, "postings": {t: v for t, v in sorted(postings.items())}}
    with open(OUT / "bm25.json", "w", encoding="utf-8", newline="\n") as fh:
        json.dump(index, fh, ensure_ascii=False, separators=(",", ":"))

    (OUT / "no_text_pages.json").write_text(json.dumps(dict(sorted(no_text.items())), indent=1), encoding="utf-8")
    (OUT / "skipped.json").write_text(json.dumps({"skipped": skipped, "failed": failed}, indent=1, ensure_ascii=False), encoding="utf-8")
    sizes = {n: (OUT / n).stat().st_size for n in ("pages.jsonl", "chunks.jsonl", "bm25.json")}
    man = {"documents": stats["documents"], "pages_total": stats["pages_total"], "pages_with_text": stats["pages"],
           "pages_without_text": stats["pages_no_text"], "words": stats["words"], "chunks": n_chunks,
           "terms": len(postings), "files_skipped": len(skipped), "files_failed": len(failed),
           "bytes": sizes, "pages_jsonl_sha256": hashlib.sha256((OUT / "pages.jsonl").read_bytes()).hexdigest(),
           "build_seconds": {"pages": round(t_pages, 1), "total": round(time.time() - t0, 1)},
           "note": "text extracted by code (PyMuPDF, XML, html.parser, csv); no model involved"}
    (OUT / "corpus_manifest.json").write_text(json.dumps(man, indent=1), encoding="utf-8")
    print(json.dumps(man, indent=1))


# ------------------------------------------------------------------ search
def load_index():
    idx = json.loads((OUT / "bm25.json").read_text(encoding="utf-8"))
    return idx


def search(query: str, top: int = 5, idx=None):
    idx = idx or load_index()
    N, avgdl, k1, b = idx["N"], idx["avgdl"], idx["k1"], idx["b"]
    scores: dict[int, float] = defaultdict(float)
    for term in dict.fromkeys(tokens(query)):
        post = idx["postings"].get(term)
        if not post:
            continue
        df = len(post) // 2
        idf = math.log(1 + (N - df + 0.5) / (df + 0.5))
        for j in range(0, len(post), 2):
            d, tf = post[j], post[j + 1]
            dl = idx["chunks"][d][3]
            scores[d] += idf * tf * (k1 + 1) / (tf + k1 * (1 - b + b * dl / avgdl))
    ranked = sorted(scores.items(), key=lambda kv: (-kv[1], kv[0]))[:top]
    out = []
    with open(OUT / "chunks.jsonl", "rb") as fh:
        for d, sc in ranked:
            _, off, ln, _ = idx["chunks"][d]
            fh.seek(off)
            rec = json.loads(fh.read(ln).decode("utf-8"))
            rec["score"] = round(sc, 3)
            out.append(rec)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--search", help="query the existing BM25 index and print the top results")
    ap.add_argument("--top", type=int, default=5)
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if args.search:
        if not (OUT / "bm25.json").exists():
            raise SystemExit("no index yet: run  python -I tools/build_corpus.py  first")
        for i, r in enumerate(search(args.search, args.top), start=1):
            pg = r["page_start"] if r["page_start"] == r["page_end"] else f"{r['page_start']}-{r['page_end']}"
            ident = r["accession"] or (f"NTRS-{r['ntrs_id']}" if r["ntrs_id"] else r["source_id"])
            snippet = re.sub(r"\s+", " ", r["text"])[:220]
            print(f"{i}. [{r['score']}] {ident}  {r['doc_id']}  page {pg}\n   {r['title'][:110]}\n   {snippet}...\n")
        return
    if not RAW.exists():
        raise SystemExit("data/raw/ is not present: the corpus is rebuilt from the downloaded NASA files (see data/manifest/)")
    build(args)


if __name__ == "__main__":
    main()
