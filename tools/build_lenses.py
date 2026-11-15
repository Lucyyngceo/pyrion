"""Build data/derived/lenses.json: safety-leg, phenomenon and strength tags for the 24 PSI investigations.

Every tag comes from the hand-written TABLE below: (accession, axis, tag, source, quote).
  source = a key of data/raw/psi-data/<PSI-n>/_investigation/<PSI-n>.json
           (title / objective / approach / hypothesis / researchImpacts), or "challenge:L<n>" for line n of the
           challenge statement copy (reto-oficial.md).
The script VERIFIES each row and exits with an error if:
  - the quote is not found word for word in that source field (only runs of whitespace are treated as
    one space, because the PSI JSON breaks lines inside sentences);
  - the quote does not contain one of the words listed for its tag in KEYWORDS (a guard against
    tagging from an unrelated sentence; the words are a PYRION convention, see KEYWORDS);
  - an investigation of data/manifest/investigations.csv has no strength row, or a row names an
    accession that is not in the manifest.
It also extracts the challenge numbers (Moon Base, suit, CFI-G burner) from verified challenge quotes,
by regular expression, so no number is typed by hand.

Python standard library only. Deterministic output (sorted keys).
Usage: python tools/build_lenses.py [--selftest]   (env PYRION_CHALLENGE overrides the challenge file path)
"""
from __future__ import annotations

import csv
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PSI = ROOT / "data" / "raw" / "psi-data"
OUT = ROOT / "data" / "derived" / "lenses.json"
CHALLENGE = Path(os.environ.get("PYRION_CHALLENGE", ROOT.parent / "Pyrion NASA" / ".claude" / "skills" / "pyrion-flame" / "references" / "reto-oficial.md"))
CHALLENGE_LABEL = "Challenge statement, Flame in Freefall (copy of https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/ in reto-oficial.md)"
PSI_KEYS = ("title", "objective", "approach", "hypothesis", "researchImpacts")

LEGS = ("prevention", "detection", "suppression")
PHENOMENA = ("ignition", "spread", "extinction", "smoke")
STRENGTHS = ("direct", "fundamental", "indirect")

# PYRION convention: a quote can carry a tag only if it contains one of these word stems (case-insensitive).
# "extinction limit" counts for prevention because the audit rule is: extinction limits are prevention,
# not automatically suppression. "grow" counts for spread because PSI's SAFFIRE text says "fire grows".
KEYWORDS: dict[str, tuple[str, ...]] = {
    "prevention": ("flammab", "material selection", "materials selection", "select the safest materials", "extinction limit"),
    "detection": ("detect",),
    "suppression": ("suppress", "extinguishing agent", "firefighting"),
    "ignition": ("ignit",),
    "spread": ("spread", "grow"),
    "extinction": ("extinc", "extingu", "quench"),
    "smoke": ("smoke",),
    "direct": ("bass", "saffire", "same", "flex", "daft", "burning rate emulator"),
    "fundamental": ("fundamental",),
    "indirect": ("not as strongly or directly", "was instead used to detect dust"),
    "detection context": ("measure", "sensor"),
}

STRENGTH_RULE = (
    "PYRION convention. direct: the investigation is named in the challenge's fire-safety text "
    "(Background, or the 'Other investigations in PSI' bullets). fundamental: not named there, and its own "
    "PSI record describes the work as fundamental. indirect: the rest; the challenge says such investigations "
    "are relevant 'just not as strongly or directly'. Exception: DAFT / DAFT-2 is named only because a SAME "
    "smoke-detection instrument 'was instead used to detect dust' there, so it is indirect."
)

L22 = "challenge:L22"
L24 = "challenge:L24"
L56 = "challenge:L56"
L57 = "challenge:L57"
L58 = "challenge:L58"
Q_L22 = "Flammability studies focus on solid materials such as fabrics and plastics, as studied in the Burning and Suppression of Solids (BASS and BASS-II) and Spacecraft Fire Safety Demonstration (Saffire-I, -II, and -III) investigations."
Q_L24_DET = "Fire detection was tested in microgravity through the Smoke and Aerosol Measurement Experiment studies (SAME and SAME-R)."
Q_L24_SUP = "Suppression was studied in the Flame Extinguishment Experiment (FLEX) through dilution of the chamber atmosphere with carbon dioxide and helium, both of which suppress fire."
Q_L56 = "One of the instruments used for smoke detection in the SAME and SAME-R studies was instead used to detect dust in the Dust and Aerosol Measurement Feasibility Test (DAFT and DAFT-2) studies."
Q_L57 = "While it burned gaseous fuels, the Burning Rate Emulator (BRE) experiment of the Advanced Combustion via Microgravity Experiments (ACME) project was a study of materials flammability in still atmospheres as a function of material properties."
Q_L58 = "Other combustion investigations within the PSI database (but not explicitly referenced above) are still relevant to fire safety, just not as strongly or directly."
SAFFIRE_DET = "Instruments on an unmanned cargo vessel measure oxygen, carbon dioxide, heat, pressure and flame growth"
SAFFIRE_FLAM = "investigate the low-g flammability limits compared to those obtained in NASA’s normal gravity material flammability screening test."
SAFFIRE_GROW = "determine how rapidly a large scale fire grows in low-gravity"

# (accession, axis, tag, source, quote)
TABLE: list[tuple[str, str, str, str, str]] = [
    # PSI-10 ACME Flame Design
    ("PSI-10", "leg", "prevention", "objective", "Evaluate whether pseudo-flammability limits can be obtained for these flames."),
    ("PSI-10", "phenomenon", "extinction", "objective", "Obtain extinction limits as functions of Zst, amount of N2, and pressure for normal and inverse spherical C2H4 and CH4 flames."),
    ("PSI-10", "strength", "indirect", L58, Q_L58),
    # PSI-20 ACME BRE
    ("PSI-20", "leg", "prevention", L57, Q_L57),
    ("PSI-20", "leg", "prevention", "researchImpacts", "they suggest that NASA may want to increase use of its alternative flammability Test 2, with the cone calorimeter"),
    ("PSI-20", "phenomenon", "extinction", "objective", "Consider the conditions of Objectives 1 – 2 for extinction limits."),
    ("PSI-20", "phenomenon", "extinction", "researchImpacts", "such flames in a normal atmosphere of 21% oxygen self-extinguished in a short time."),
    ("PSI-20", "strength", "direct", L57, Q_L57),
    # PSI-21 ACME CLD Flame
    ("PSI-21", "leg", "prevention", "objective", "through measurement of flame shape, lift-off heights, temperatures and extinction limits."),
    ("PSI-21", "leg", "suppression", "researchImpacts", "an understanding of those factors that affect flame extinction in diffusion flames is critical in the suppression of fires"),
    ("PSI-21", "phenomenon", "extinction", "objective", "through measurement of flame shape, lift-off heights, temperatures and extinction limits."),
    ("PSI-21", "strength", "indirect", L58, Q_L58),
    # PSI-22 ACME E-FIELD Flames
    ("PSI-22", "phenomenon", "extinction", "approach", "Dilution levels were varied to explore a range of combustion dynamics, from highly stable to near-extinction flames."),
    ("PSI-22", "strength", "indirect", L58, Q_L58),
    # PSI-23 ACME s-Flame
    ("PSI-23", "leg", "prevention", "objective", "Determine the quasi-steady convective/chemical-kinetic extinction limits (low system Damköhler numbers) and radiative/chemical-kinetic extinction limits (high system Damköhler numbers)"),
    ("PSI-23", "phenomenon", "extinction", "objective", "Determine the quasi-steady convective/chemical-kinetic extinction limits (low system Damköhler numbers) and radiative/chemical-kinetic extinction limits (high system Damköhler numbers)"),
    ("PSI-23", "strength", "fundamental", "researchImpacts", "Fundamentally, the unique buoyancy-free environment offered by microgravity affords simple aerodynamic flow fields to acquire diffusion flame data of high fidelity"),
    # PSI-25 BASS-II
    ("PSI-25", "leg", "prevention", "objective", "Study the ignition, flame growth, flame spread, and extinction limits for solid fuels burning in low-velocity forced flows in microgravity."),
    ("PSI-25", "leg", "prevention", "researchImpacts", "BASS-II helps engineers select the safest materials and improve firefighting methods on future space missions."),
    ("PSI-25", "leg", "prevention", L22, Q_L22),
    ("PSI-25", "leg", "detection", "objective", "BASS-II results contribute to the combustion computational models used in the design of fire detection and suppression systems in microgravity and on Earth."),
    ("PSI-25", "leg", "suppression", "objective", "BASS-II results contribute to the combustion computational models used in the design of fire detection and suppression systems in microgravity and on Earth."),
    ("PSI-25", "leg", "suppression", "title", "Burning and Suppression of Solids"),
    ("PSI-25", "leg", "suppression", "researchImpacts", "BASS-II helps engineers select the safest materials and improve firefighting methods on future space missions."),
    ("PSI-25", "phenomenon", "ignition", "objective", "Study the ignition, flame growth, flame spread, and extinction limits for solid fuels burning in low-velocity forced flows in microgravity."),
    ("PSI-25", "phenomenon", "spread", "objective", "Study the ignition, flame growth, flame spread, and extinction limits for solid fuels burning in low-velocity forced flows in microgravity."),
    ("PSI-25", "phenomenon", "extinction", "objective", "Study the ignition, flame growth, flame spread, and extinction limits for solid fuels burning in low-velocity forced flows in microgravity."),
    ("PSI-25", "strength", "direct", L22, Q_L22),
    # PSI-26 BASS
    ("PSI-26", "leg", "suppression", "objective", "Assess the effectiveness of an inert, gaseous extinguishing agent (similar to that used on ISS) in putting out flames over different materials, geometries, preheating, and flow."),
    ("PSI-26", "leg", "suppression", "title", "Burning and Suppression of Solids"),
    ("PSI-26", "leg", "suppression", "researchImpacts", "Using nitrogen as a flame suppressant in microgravity provides a direct link to current and planned extinguishment techniques."),
    ("PSI-26", "leg", "prevention", "researchImpacts", "Current NASA spacecraft materials selection is based on a standard test method (NASA–STD–6001 Test 1) that segregates material based on 1-g behavior without consideration of low gravity effects."),
    ("PSI-26", "leg", "prevention", L22, Q_L22),
    ("PSI-26", "phenomenon", "spread", "approach", "data was collected on flame size, shape, color, spread rate, and potential flame quenching."),
    ("PSI-26", "phenomenon", "extinction", "approach", "data was collected on flame size, shape, color, spread rate, and potential flame quenching."),
    ("PSI-26", "strength", "direct", L22, Q_L22),
    # PSI-39 CFI
    ("PSI-39", "phenomenon", "extinction", "objective", "Investigate the relationship between droplet size, pressure, and flame extinction"),
    ("PSI-39", "phenomenon", "ignition", "researchImpacts", "A basic understanding of cool flames is important for understanding ignition phenomena of practical fuels and fuel additives."),
    ("PSI-39", "strength", "indirect", L58, Q_L58),
    # PSI-47 DAFT / DAFT-2
    ("PSI-47", "leg", "detection", "researchImpacts", "This research will impact the development of novel fire and smoke detection systems for the International Space Station and future spacecrafts."),
    ("PSI-47", "leg", "detection", L56, Q_L56),
    ("PSI-47", "strength", "indirect", L56, Q_L56),
    # PSI-60 SPICE data, ground
    # No detection or suppression leg (Claude, 2026-11-15): the only candidate sentence, "the results support safer fire
    # detection, suppression, and cleaner combustion technologies", is a research-impact aspiration; the study measured smoke points.
    ("PSI-60", "phenomenon", "smoke", "objective", "identify key physical and chemical processes influencing smoke point development"),
    ("PSI-60", "strength", "indirect", L58, Q_L58),
    # PSI-62 BASS flame-spread modelling, ground
    ("PSI-62", "leg", "prevention", "researchImpacts", "This research provides predictive tools for screening new materials’ flammability limits, which can lead to the design of safer spacecrafts."),
    ("PSI-62", "phenomenon", "spread", "objective", "The objective of this research was to develop and validate new flamelet generated manifold (FGM) modeling techniques for concurrent flame spread in microgravity."),
    ("PSI-62", "strength", "indirect", L58, Q_L58),
    # PSI-68 FLEX-2
    ("PSI-68", "leg", "prevention", "objective", "Determine the influence of droplet interactions on the flammability limits and extinction behavior of droplet arrays."),
    ("PSI-68", "phenomenon", "extinction", "objective", "Study flame extinction mechanisms and their boundaries."),
    ("PSI-68", "strength", "fundamental", "hypothesis", "allowing for a clear observation of the fundamental combustion processes"),
    # PSI-69 FLEX
    ("PSI-69", "leg", "suppression", "objective", "measure the effectiveness of various gaseous fire suppressants such as CO2, He, and SF6"),
    ("PSI-69", "leg", "suppression", L24, Q_L24_SUP),
    ("PSI-69", "leg", "prevention", "objective", "The FLEX (Flame Extinguishment Experiment) investigation aims to map the flammability limits of liquid fuels in microgravity environments"),
    ("PSI-69", "phenomenon", "extinction", "objective", "Key flight experiment goals include obtaining high-resolution measurements of droplet burning rates, flame extinction behavior, heat radiation, soot levels, and temperature profiles"),
    ("PSI-69", "phenomenon", "ignition", "approach", "Continue step 7 to an ambient oxygen mole fraction where the droplet does not ignite."),
    ("PSI-69", "strength", "direct", L24, Q_L24_SUP),
    # PSI-98/99/100 SAFFIRE-I/-II/-III
    ("PSI-98", "leg", "prevention", "objective", SAFFIRE_FLAM),
    ("PSI-98", "leg", "prevention", L22, Q_L22),
    ("PSI-98", "phenomenon", "spread", "objective", SAFFIRE_GROW),
    ("PSI-98", "context", "detection context", "researchImpacts", SAFFIRE_DET),
    ("PSI-98", "strength", "direct", L22, Q_L22),
    ("PSI-99", "leg", "prevention", "objective", SAFFIRE_FLAM),
    ("PSI-99", "leg", "prevention", L22, Q_L22),
    ("PSI-99", "phenomenon", "spread", "objective", "determine how rapidly a large scale fire grows in low-gravity"),
    ("PSI-99", "context", "detection context", "researchImpacts", SAFFIRE_DET),
    ("PSI-99", "strength", "direct", L22, Q_L22),
    ("PSI-100", "leg", "prevention", "objective", SAFFIRE_FLAM),
    ("PSI-100", "leg", "prevention", L22, Q_L22),
    ("PSI-100", "phenomenon", "spread", "objective", SAFFIRE_GROW),
    ("PSI-100", "context", "detection context", "researchImpacts", SAFFIRE_DET),
    ("PSI-100", "strength", "direct", L22, Q_L22),
    # PSI-101 SAME-R
    ("PSI-101", "leg", "detection", "researchImpacts", "the results from SAME-R can lead to technology for an advanced fire detector for future spacecraft"),
    ("PSI-101", "leg", "detection", L24, Q_L24_DET),
    ("PSI-101", "phenomenon", "smoke", "objective", "the primary objective of the SAME-R investigation was to quantify the sizes that the liquid smoke particulate achieves in low gravity"),
    ("PSI-101", "strength", "direct", L24, Q_L24_DET),
    # PSI-102 SAME
    ("PSI-102", "leg", "detection", "researchImpacts", "The SAME experiment will provide technology for an advanced fire detector for future spacecraft"),
    ("PSI-102", "leg", "detection", L24, Q_L24_DET),
    ("PSI-102", "phenomenon", "smoke", "objective", "One of the major goals of this investigation was to quantify the sizes that the liquid smoke particulate achieves in low gravity"),
    ("PSI-102", "strength", "direct", L24, Q_L24_DET),
    # PSI-106 SLICE: no quote supports a leg or a phenomenon tag
    ("PSI-106", "strength", "indirect", L58, Q_L58),
    # PSI-107 SPICE
    ("PSI-107", "phenomenon", "smoke", "objective", "Identify the laminar smoke-point properties of non-buoyant jet diffusion flames under various co-flow conditions in microgravity."),
    ("PSI-107", "strength", "indirect", L58, Q_L58),
    # PSI-115 SAME data, ground
    ("PSI-115", "leg", "detection", "researchImpacts", "This would directly lead to better smoke detection devices"),
    ("PSI-115", "phenomenon", "smoke", "objective", "The objective of this investigation was to use numerical simulation to explore the influence of gravity on pyrolysis smoke growth from a fundamental perspective."),
    ("PSI-115", "strength", "fundamental", "objective", "The objective of this investigation was to use numerical simulation to explore the influence of gravity on pyrolysis smoke growth from a fundamental perspective."),
    # PSI-117 FLEX cool flames CFD, ground
    ("PSI-117", "phenomenon", "ignition", "objective", "the work mapped stability windows for ignition, sustained oscillation, transitions to hot ignition and warm-flame behavior, and extinction under microgravity."),
    ("PSI-117", "phenomenon", "extinction", "objective", "the work mapped stability windows for ignition, sustained oscillation, transitions to hot ignition and warm-flame behavior, and extinction under microgravity."),
    ("PSI-117", "strength", "indirect", L58, Q_L58),
    # PSI-142 FLEX cool flames counterflow, ground
    ("PSI-142", "leg", "prevention", "objective", "Develop a new diagram of the flammability limits of diffusional cool flames affected by radiation, diffusion, and convection."),
    ("PSI-142", "phenomenon", "extinction", "objective", "Obtain new, quantitative data of extinction limit, flame temperature, and species distribution for the validation of kinetic and radiation models involving cool flames."),
    ("PSI-142", "strength", "fundamental", "researchImpacts", "Obtaining a fundamental understanding of the warm diffusion flame is particularly relevant to combustion in highly turbulent flow fields and in microgravity environments"),
    # PSI-159 ACME CFI-G
    ("PSI-159", "phenomenon", "extinction", "hypothesis", "Cool diffusion flames for which a decrease in fluent flow rate will cause extinction"),
    ("PSI-159", "strength", "indirect", L58, Q_L58),
]

# Challenge facts used by the /lenses and /more pages. Each quote is verified; numbers are read from it.
CHALLENGE_FACTS = {
    "moon_base": (69, "The intermediate oxygen concentration used on the Moon will likely be 30% or greater, with a corresponding pressure of 10.2 psi or less."),
    "suit": (66, "To enable flexibility, spacesuits are filled with 100% oxygen to only 4.3 psi (pounds per square inch), where the Earth's pressure at sea level is 14.7 psi."),
    "cfig_burner": (70, "an oxygen-nitrogen mixture of up to 85% oxygen flowed from the spherical burner creating an inside-out flame."),
    "rockets": (40, "Fire safety involving rockets and propellants is generally beyond the scope of the research available in the PSI database. The high velocities within rocket engines render the combustion effectively independent of gravity — although a rocket's launch is of course strongly dependent on gravity."),
    "partial_gravity": (73, "there is currently no partial-gravity combustion data available in PSI"),
    "not_as_strongly": (58, Q_L58),
    "earth": (38, "Your dashboard could also address potential applications of the PSI data to fire safety on Earth."),
}


class BuildError(Exception):
    pass


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def load_manifest() -> dict[str, dict[str, str]]:
    with (ROOT / "data" / "manifest" / "investigations.csv").open(encoding="utf-8-sig", newline="") as f:
        return {r["accession"]: r for r in csv.DictReader(f)}


def load_psi(acc: str) -> dict:
    p = PSI / acc / "_investigation" / f"{acc}.json"
    if not p.exists():
        raise BuildError(f"{acc}: missing {p.relative_to(ROOT)}")
    d = json.loads(p.read_text(encoding="utf-8"))
    return d[0] if isinstance(d, list) else d


def challenge_lines() -> list[str]:
    if not CHALLENGE.exists():
        raise BuildError(f"challenge file not found: {CHALLENGE} (set PYRION_CHALLENGE)")
    return CHALLENGE.read_text(encoding="utf-8").splitlines()


def verify_source(acc: str, source: str, quote: str, psi: dict, lines: list[str]) -> dict:
    if source.startswith("challenge:L"):
        n = int(source.split(":L")[1])
        if n < 1 or n > len(lines):
            raise BuildError(f"{acc}: {source} is not a line of the challenge file")
        if norm(quote) not in norm(lines[n - 1]):
            raise BuildError(f"{acc}: quote not found word for word in challenge line {n}: {quote!r}")
        return {"kind": "challenge", "file": CHALLENGE_LABEL, "line": n}
    if source not in PSI_KEYS:
        raise BuildError(f"{acc}: unknown source key {source!r}")
    text = psi.get(source) or ""
    if norm(quote) not in norm(text):
        raise BuildError(f"{acc}: quote not found word for word in {source}: {quote!r}")
    return {"kind": "psi", "file": f"data/raw/psi-data/{acc}/_investigation/{acc}.json", "key": source}


def check_keyword(acc: str, tag: str, quote: str) -> None:
    q = quote.lower()
    if not any(k in q for k in KEYWORDS[tag]):
        raise BuildError(f"{acc}: quote for tag {tag!r} contains none of {KEYWORDS[tag]}: {quote!r}")


def numbers(quote: str, pattern: str, n: int) -> list[float]:
    m = re.search(pattern, quote)
    if not m:
        raise BuildError(f"pattern {pattern!r} not found in {quote!r}")
    return [float(m.group(i + 1)) for i in range(n)]


def build() -> dict:
    manifest = load_manifest()
    lines = challenge_lines()
    psi = {acc: load_psi(acc) for acc in manifest}
    rows: dict[str, dict] = {}
    for acc, m in manifest.items():
        rows[acc] = {
            "accession": acc,
            "acronym": m["acronym"],
            "title": m["title"],
            "doi": m["doi"],
            "project_type": m["project_type"],
            "legs": {k: [] for k in LEGS},
            "phenomena": {k: [] for k in PHENOMENA},
            "strength": None,
            "context": [],
        }
    seen = set()
    for acc, axis, tag, source, quote in TABLE:
        if acc not in rows:
            raise BuildError(f"{acc}: not in data/manifest/investigations.csv")
        key = (acc, axis, tag, source, quote)
        if key in seen:
            raise BuildError(f"duplicate row {key}")
        seen.add(key)
        allowed = {"leg": LEGS, "phenomenon": PHENOMENA, "strength": STRENGTHS, "context": ("detection context",)}[axis]
        if tag not in allowed:
            raise BuildError(f"{acc}: tag {tag!r} not allowed on axis {axis}")
        check_keyword(acc, tag, quote)
        src = verify_source(acc, source, quote, psi[acc], lines)
        entry = {"quote": quote, "source": src}
        r = rows[acc]
        if axis == "leg":
            r["legs"][tag].append(entry)
        elif axis == "phenomenon":
            r["phenomena"][tag].append(entry)
        elif axis == "context":
            r["context"].append({"label": tag, **entry})
        else:
            if r["strength"] is not None:
                raise BuildError(f"{acc}: more than one strength row")
            r["strength"] = {"value": tag, **entry}
    missing = [a for a, r in rows.items() if r["strength"] is None]
    if missing:
        raise BuildError(f"no strength row for {missing}")

    facts = {}
    for k, (n, q) in CHALLENGE_FACTS.items():
        src = verify_source("challenge", f"challenge:L{n}", q, {}, lines)
        facts[k] = {"quote": q, "source": src}
    mb = numbers(facts["moon_base"]["quote"], r"(\d+(?:\.\d+)?)% or greater, with a corresponding pressure of (\d+(?:\.\d+)?) psi or less", 2)
    facts["moon_base"].update({"o2_percent_min": mb[0], "pressure_psi_max": mb[1]})
    su = numbers(facts["suit"]["quote"], r"(\d+(?:\.\d+)?)% oxygen to only (\d+(?:\.\d+)?) psi", 2)
    facts["suit"].update({"o2_percent": su[0], "pressure_psi": su[1]})
    cf = numbers(facts["cfig_burner"]["quote"], r"up to (\d+(?:\.\d+)?)% oxygen", 1)
    facts["cfig_burner"].update({"o2_percent_max": cf[0]})

    invs = [rows[a] for a in sorted(rows, key=lambda a: int(a.split("-")[1]))]
    counts = {
        "investigations": len(invs),
        "tag_rows": len(TABLE),
        "legs": {k: sum(1 for r in invs if r["legs"][k]) for k in LEGS},
        "phenomena": {k: sum(1 for r in invs if r["phenomena"][k]) for k in PHENOMENA},
        "strength": {k: sum(1 for r in invs if r["strength"]["value"] == k) for k in STRENGTHS},
    }
    return {
        "about": "Safety-leg, phenomenon and strength tags for the PSI investigations. Each tag carries a verbatim quote checked by tools/build_lenses.py. No quote, no tag.",
        "generated_by": "tools/build_lenses.py",
        "axes": {"legs": list(LEGS), "phenomena": list(PHENOMENA), "strengths": list(STRENGTHS)},
        "rules": {
            "strength": STRENGTH_RULE,
            "keywords": {k: list(v) for k, v in KEYWORDS.items()},
            "keyword_note": "PYRION convention: a quote can carry a tag only if it contains one of these word stems. Extinction limits count as prevention, not automatically as suppression.",
            "matching": "Word for word; only runs of whitespace (line breaks in the PSI JSON) are read as one space.",
        },
        "challenge": facts,
        "counts": counts,
        "investigations": invs,
    }


def selftest() -> int:
    """The script must FAIL when a quote is not word for word in its source: alter one quote and check."""
    global TABLE
    original = TABLE
    acc, axis, tag, source, quote = original[0]
    try:
        TABLE = [(acc, axis, tag, source, quote.replace("flammability", "flammable"))] + original[1:]
        try:
            build()
        except BuildError as e:
            print(f"build_lenses selftest: altered quote rejected as expected ({e})")
        else:
            print("build_lenses selftest: FAILED, an altered quote was accepted", file=sys.stderr)
            return 1
    finally:
        TABLE = original
    return 0


def main() -> int:
    if "--selftest" in sys.argv:
        return selftest()
    try:
        out = build()
    except BuildError as e:
        print(f"build_lenses: FAILED: {e}", file=sys.stderr)
        return 1
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    c = out["counts"]
    print(f"build_lenses: {c['investigations']} investigations, {c['tag_rows']} verified rows; legs {c['legs']}; phenomena {c['phenomena']}; strength {c['strength']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
