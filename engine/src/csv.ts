// Minimal RFC 4180 CSV reader: quoted fields, doubled quotes, commas and newlines inside quotes,
// LF or CRLF line ends, optional UTF-8 BOM. No dependencies, no type guessing: every cell is a string.

export interface CsvRow {
  /** 1-based line where the row starts (header = line 1). */
  line: number;
  cells: string[];
}

export function parseCsv(text: string): CsvRow[] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: CsvRow[] = [];
  let cells: string[] = [];
  let cell = '';
  let inQuotes = false;
  let line = 1;
  let rowStart = 1;
  let cellWasQuoted = false;
  let i = 0;
  const pushCell = () => {
    cells.push(cell);
    cell = '';
    cellWasQuoted = false;
  };
  const pushRow = () => {
    pushCell();
    // Skip fully empty lines.
    if (!(cells.length === 1 && cells[0] === '')) rows.push({ line: rowStart, cells });
    cells = [];
  };
  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      if (ch === '\n') line += 1;
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"' && cell === '' && !cellWasQuoted) {
      inQuotes = true;
      cellWasQuoted = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      pushCell();
      i += 1;
      continue;
    }
    if (ch === '\r' && src[i + 1] === '\n') {
      i += 1;
      continue;
    }
    if (ch === '\n') {
      pushRow();
      line += 1;
      rowStart = line;
      i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  if (inQuotes) throw new Error(`CSV: unterminated quoted field starting on line ${rowStart}`);
  if (cell !== '' || cells.length > 0) pushRow();
  return rows;
}
