"""Minimal client for the NASA Physical Sciences Informatics (PSI) public API.

Standard library only. Endpoints used:
  GET  /repo/search                      catalog search (all investigations)
  GET  /repo/investigations/<accession>  full investigation record (DOI, license, version)
  POST /files/v2                         file listing of one investigation version
  GET  /studies/<accession>/download     returns a pre-signed S3 URL for one file
"""
import json
import time
import urllib.parse
import urllib.request

API = "https://psi.nasa.gov/geode-py/ws"
USER_AGENT = "pyrion-pipeline/0.1 (NASA Space Apps Challenge 2026)"


def _open(req, timeout):
    req.add_header("User-Agent", USER_AGENT)
    return urllib.request.urlopen(req, timeout=timeout)


def get_json(url, timeout=60, retries=3):
    for attempt in range(retries):
        try:
            with _open(urllib.request.Request(url), timeout) as r:
                return json.loads(r.read())
        except Exception:
            if attempt == retries - 1:
                raise
            time.sleep(2 ** attempt)


def post_json(url, body, timeout=120, retries=3):
    data = json.dumps(body).encode()
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, data=data, method="POST",
                                         headers={"Content-Type": "application/json"})
            with _open(req, timeout) as r:
                return json.loads(r.read())
        except Exception:
            if attempt == retries - 1:
                raise
            time.sleep(2 ** attempt)


def search_investigations():
    """All PSI investigations, as the `_source` records of the catalog search."""
    j = get_json(f"{API}/repo/search?term=&source=psi&type=investigation&from=0&size=500")
    return [h["_source"] for h in j["hits"]["hits"]]


def investigation(accession):
    return get_json(f"{API}/repo/investigations/{accession}")


def list_files(accession, version):
    """Leaf files of one investigation version (folders are skipped)."""
    j = post_json(f"{API}/files/v2", {"folder": "", "fileType": "study", "studyId": accession,
                                      "version": version, "obfuscationcode": ""})
    leaves = []

    def walk(node):
        if isinstance(node, list):
            for x in node:
                walk(x)
        elif isinstance(node, dict):
            if "key" in node and not node["key"].endswith("/") and "bytes_size" in node:
                leaves.append(node)
            for v in node.values():
                if isinstance(v, (list, dict)):
                    walk(v)

    walk(j.get("files"))
    return leaves


def presigned_url(accession, file_name, file_version, timeout=60, retries=3):
    q = urllib.parse.urlencode({"file": file_name, "version": file_version, "redirect": "false"})
    url = f"{API}/studies/{accession}/download?{q}"
    for attempt in range(retries):
        try:
            with _open(urllib.request.Request(url), timeout) as r:
                text = r.read().decode("utf-8").strip()
            if text.startswith("{"):
                text = json.loads(text).get("url", "")
            if not text.startswith("https://"):
                raise ValueError(f"unexpected download response for {file_name}")
            return text
        except Exception:
            if attempt == retries - 1:
                raise
            time.sleep(2 ** attempt)
