// Plain citation labels for source files: "NTRS 20260001966", never a folder id.

/** "ntrs-20260001966/x.pdf" -> "NTRS 20260001966"; "web:nssdc.gsfc.nasa.gov/..." -> "NASA NSSDC Mars Fact Sheet". */
export function citeSource(file: string): string {
  const head = file.split("/")[0];
  const ntrs = /^ntrs-(\d+)$/i.exec(head);
  if (ntrs) return `NTRS ${ntrs[1]}`;
  if (/^web:nssdc\.gsfc\.nasa\.gov/i.test(file)) return "NASA NSSDC Mars Fact Sheet";
  const psi = /^(PSI-\d+)/i.exec(head);
  if (psi) return psi[1].toUpperCase();
  return head.replace(/^web:/, "");
}
