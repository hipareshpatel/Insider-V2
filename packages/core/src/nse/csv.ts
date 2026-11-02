// Minimal RFC 4180 CSV reader (quoted fields, CRLF, BOM). Values are trimmed: NSE pads fields with spaces.

export function parseCsv(text: string): string[][] {
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field.trim()); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field.trim()); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field.trim()); if (row.length > 1 || row[0] !== "") rows.push(row); }
  return rows;
}

/** Rows as objects keyed by trimmed header. Throws if required headers are missing (schema check, B4). */
export function csvRecords(text: string, required: readonly string[]): Record<string, string>[] {
  const rows = parseCsv(text);
  const header = (rows[0] ?? []).map((h) => h.trim());
  const missing = required.filter((r) => !header.includes(r));
  if (missing.length) throw new Error(`csv: missing columns ${missing.join(", ")} (have: ${header.join(", ")})`);
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}
