// A public page for every receipt: the PSI investigation page of an accession (the pattern is stated in
// data/manifest/web_check_2026-11-14.csv). Files under data/raw/ are not published, so the receipt links here instead.
export const PSI_PAGE = (accession: string) => `https://psi.nasa.gov/physci/repo/data/investigations/${encodeURIComponent(accession)}`;
/** The accession written in a source path such as "psi-data/PSI-69/Experimental table/...", or null. */
export const accessionOfPath = (path: string): string | null => /\b(PSI-\d+)\b/.exec(path)?.[1] ?? null;
