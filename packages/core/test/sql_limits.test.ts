// Root fix for a recurring failure (FMEA A9, C35; D134 rule 2): D1 rejects LIKE/GLOB patterns longer than 50 bytes
// ("LIKE or GLOB pattern too complex"), and only when a row is actually compared, so staging can pass while
// production fails. Every migration and every SQL string in the code is checked here, before any deploy.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..", "..", "..");
function files(dir: string, ext: RegExp, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (f === "node_modules" || f === "dist" || f.startsWith(".")) continue;
    if (statSync(p).isDirectory()) files(p, ext, out); else if (ext.test(f)) out.push(p);
  }
  return out;
}
describe("D1 LIKE/GLOB pattern length (≤ 50 bytes)", () => {
  it("no migration or source SQL uses a longer literal pattern", () => {
    const bad: string[] = [];
    for (const f of [...files(join(ROOT, "db"), /\.sql$/), ...files(join(ROOT, "workers"), /\.ts$/), ...files(join(ROOT, "packages"), /\.ts$/)]) {
      if (f.endsWith("sql_limits.test.ts")) continue;
      const text = readFileSync(f, "utf8");
      for (const m of text.matchAll(/\b(?:LIKE|GLOB)\s+'((?:[^']|'')*)'/gi)) {
        const pat = m[1]!.replace(/''/g, "'");
        if (Buffer.byteLength(pat, "utf8") > 50) bad.push(`${f.replace(ROOT, "")}: ${pat}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
