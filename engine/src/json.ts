// Canonical JSON: object keys sorted, two-space indent, trailing newline.
// Used to prove determinism (same input -> byte-identical output) and to hash results.

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value), null, 2) + '\n';
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v !== null && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) {
      const x = (v as Record<string, unknown>)[k];
      if (x !== undefined) out[k] = sortKeys(x);
    }
    return out;
  }
  if (typeof v === 'number' && !Number.isFinite(v)) {
    // Infinity is never written as a number: undefined distances are null by contract.
    throw new TypeError('canonicalJson: non-finite number in output');
  }
  return v;
}
