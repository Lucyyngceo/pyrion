"""One adapter per PSI experimental table.

Each adapter module defines ACCESSION, SOURCES (paths relative to data/raw/) and
build(skips) -> list of condition records (method=table). Adapters only map columns
to schema variables and convert units explicitly; they never infer a value that the
table does not state.
"""
from importlib import import_module

MODULES = [
    "psi069_flex", "psi068_flex2", "psi039_cfi", "psi159_cfig", "psi010_flame_design",
    "psi025_bass2", "psi026_bass", "psi098_saffire1", "psi099_saffire2", "psi100_saffire3",
    "psi107_spice", "psi106_slice", "psi102_same", "psi101_samer",
    "psi020_bre", "psi021_cld", "psi022_efield", "psi023_sflame", "psi047_daft", "psi142_summary",
]


def adapters():
    out = []
    for name in MODULES:
        try:
            out.append(import_module(f"tables.{name}"))
        except ModuleNotFoundError as e:
            if e.name != f"tables.{name}":
                raise
    return out
