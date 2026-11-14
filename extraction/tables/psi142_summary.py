"""PSI-142: the experimental table lists figures of a published paper (data id, description,
DOI, figure number), not test conditions. This adapter deliberately returns no record."""

ACCESSION = "PSI-142"
SOURCES = ["psi-data/PSI-142/Experimental table/PSI-142_Experimental table_Data Summary Table.csv"]


def build(skips):
    return []
