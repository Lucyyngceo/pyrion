"""Open-source embedding baseline: which PSI investigations would a standard text-embedding search retrieve?

    python -I models/build_text_similarity.py

CLASS B result ("evaluated model"), never evidence. It ranks investigations by cosine similarity between the text of a target
preset and the text of each investigation. It does not look at gravity, fuel phase, oxygen or pressure, and it never touches a
verdict. The web app's TF-IDF panel answers the same question with the same query text.

Model: BAAI/bge-small-en-v1.5 (MIT), the ONNX build that fastembed ships for that name. Documents and queries are embedded with the
same call (no query instruction prefix), so the comparison with TF-IDF stays symmetric.
"""
from __future__ import annotations

import csv
import hashlib
import json
import re
import sys
from pathlib import Path

sys.dont_write_bytecode = True
REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "data" / "derived" / "text_similarity.json"
MODEL = "BAAI/bge-small-en-v1.5"

# The web app builds each query as `${preset.description} ${targetRegimeName(regime)}` (web/components/Explorer.tsx:299). The
# starting target of the app is fuel_phase=liquid, diluent=N2 (Explorer.tsx INITIAL), and a preset adds its own gravity regime.
# targetRegimeName orders gravity, fuel phase, diluent and prints "<label>", "<label> fuel", "<label> diluent" (web/lib/layers.ts:67)
# with the labels of web/lib/units.ts VALUE_LABEL. Those few facts are asserted against the source files below.
REGIME_SUFFIX = "liquid fuel, N₂ diluent"
GRAVITY_LABEL = {"microgravity": "microgravity", "partial_gravity": "partial gravity"}


def preset_descriptions():
    """{id: (description, gravity_regime)} read from the two source files the app uses."""
    out = {}
    web = (REPO / "web" / "lib" / "presets.ts").read_text(encoding="utf-8")
    m = re.search(r'id: "iss-cabin-air",\s*label: "[^"]*",\s*description: "([^"]+)"', web)
    if not m:
        raise SystemExit("web/lib/presets.ts: ISS preset description not found")
    if 'value: "microgravity"' not in web:
        raise SystemExit("web/lib/presets.ts: ISS gravity regime changed")
    out["iss-cabin-air"] = (m.group(1), "microgravity")
    eng = (REPO / "engine" / "src" / "presets.ts").read_text(encoding="utf-8")
    if "value: 'partial_gravity'" not in eng:
        raise SystemExit("engine/src/presets.ts: lunar regime changed")
    for m in re.finditer(r"id: '(challenge-lunar-base|nesc-[^']+)',\s*label: '[^']*',\s*description:\s*'((?:[^'\\]|\\.)*)'", eng):
        out[m.group(1)] = (m.group(2).replace("\\'", "'"), "partial_gravity")
    if len(out) != 4:
        raise SystemExit(f"expected 4 presets, found {sorted(out)}")
    explorer = (REPO / "web" / "components" / "Explorer.tsx").read_text(encoding="utf-8")
    if "${view ? view.preset.description : \"Custom target.\"} ${targetRegimeName(target.regime)}" not in explorer:
        raise SystemExit("Explorer.tsx: the query construction changed; update this script")
    if 'regime: { fuel_phase: "liquid", diluent: "N2" }' not in explorer:
        raise SystemExit("Explorer.tsx: the starting regime changed; update this script")
    return out


def investigation_texts():
    inv = {}
    with (REPO / "data" / "manifest" / "investigations.csv").open(encoding="utf-8", newline="") as fh:
        for r in csv.DictReader(fh):
            inv[r["accession"]] = {"acronym": r["acronym"], "title": r["title"]}
    pubs = {}
    with (REPO / "data" / "manifest" / "publications.csv").open(encoding="utf-8", newline="") as fh:
        for r in csv.DictReader(fh):
            pubs.setdefault(r["accession"], []).append(r["title"])
    texts = {}
    for acc, meta in inv.items():
        rec = json.loads((REPO / "data" / "raw" / "psi-data" / acc / "_investigation" / f"{acc}.json").read_text(encoding="utf-8"))
        parts = [meta["acronym"], rec.get("title") or meta["title"], rec.get("objective") or "", rec.get("approach") or ""]
        parts += pubs.get(acc, [])
        texts[acc] = " ".join(" ".join(p.split()) for p in parts if p)
    return inv, texts


def main():
    from fastembed import TextEmbedding
    import numpy as np

    presets = preset_descriptions()
    inv, texts = investigation_texts()
    try:
        model = TextEmbedding(model_name=MODEL, local_files_only=True)
    except TypeError:
        model = TextEmbedding(model_name=MODEL)
    desc = next(m for m in TextEmbedding.list_supported_models() if m["model"] == MODEL)
    cache = Path(model.model._model_dir) if hasattr(model.model, "_model_dir") else None
    onnx = None
    if cache is not None:
        for p in sorted(cache.rglob("*.onnx")):
            onnx = p
            break
    if onnx is None:
        raise SystemExit("ONNX file not found in the fastembed cache")
    sha = hashlib.sha256(onnx.read_bytes()).hexdigest()

    accs = sorted(texts, key=lambda a: int(a.split("-")[1]))
    d_emb = np.array(list(model.embed([texts[a] for a in accs])), dtype=np.float64)
    queries = {pid: f"{d} {GRAVITY_LABEL[g]}, {REGIME_SUFFIX}" for pid, (d, g) in presets.items()}
    q_emb = np.array(list(model.embed(list(queries.values()))), dtype=np.float64)
    d_emb /= np.linalg.norm(d_emb, axis=1, keepdims=True)
    q_emb /= np.linalg.norm(q_emb, axis=1, keepdims=True)

    result = {
        "result_class": "B (evaluated model). Never evidence, never a verdict: it ranks text, not physical applicability.",
        "what_it_is": "What a standard open-source embedding search would retrieve for the same question as the web app's TF-IDF panel.",
        "model": {"name": MODEL, "license": "MIT", "dimension": int(d_emb.shape[1]), "onnx_file": onnx.name,
                  "onnx_sha256": sha, "onnx_source": "Hugging Face repo " + str(desc.get("sources", {}).get("hf", "")) + " (int8-quantized ONNX build of the model, as fastembed ships it)",
                  "runtime": "fastembed (ONNX); documents and queries embedded with the same call, no query instruction prefix",
                  "max_sequence_tokens": 512, "note": "Texts longer than the model's limit are truncated by the tokenizer."},
        "documents": {"count": len(accs), "text": "acronym + title + objective + approach from the PSI record JSON + titles of the publications PSI lists (data/manifest/publications.csv)",
                      "characters": {a: len(texts[a]) for a in accs}},
        "queries": queries,
        "query_source": "web/components/Explorer.tsx:299: `${preset.description} ${targetRegimeName(regime)}` with the app's starting regime (liquid fuel, N2 diluent) and the preset's gravity regime.",
        "rankings": {},
    }
    for i, pid in enumerate(queries):
        scores = d_emb @ q_emb[i]
        order = sorted(range(len(accs)), key=lambda k: (-scores[k], accs[k]))
        result["rankings"][pid] = [{"rank": r + 1, "accession": accs[k], "acronym": inv[accs[k]]["acronym"], "title": inv[accs[k]]["title"],
                                    "cosine": round(float(scores[k]), 6)} for r, k in enumerate(order)]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    for pid, rows in result["rankings"].items():
        print(pid, [(r["accession"], r["cosine"]) for r in rows[:3]])
    print("onnx", onnx.name, sha[:16], "dim", d_emb.shape[1])


if __name__ == "__main__":
    main()
