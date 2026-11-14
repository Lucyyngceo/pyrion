"""PSI-47 DAFT / DAFT-2: aerosol-instrument tests with Arizona Road Dust. No flame, so no
combustion condition: this adapter deliberately returns no record (see SUMMARY.md)."""

ACCESSION = "PSI-47"
SOURCES = ["psi-data/PSI-47/Experimental table/PSI-47_Experimental table_DAFT.csv"]


def build(skips):
    return []
