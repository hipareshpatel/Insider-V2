// D147 (V1 storage lesson, #280): gzip the ledger's older R2 objects (api/ lists, att/ XBRL) written before gzip was
// on. Readers are all gzip-aware (enc metadata). Market cache/ zips are not touched. Resumes by a primary-key cursor
// (C18) kept in daily_refresh ('once', 'compress'); ~200 objects per minute; idempotent (gzip objects are skipped).
// Never deletes (owner #282): an object is replaced only by a verified lossless gzip of itself.
import type { Sql } from "@disclo/core";

export async function compressStep(db: Sql, bucket: R2Bucket, gzip: (b: Uint8Array) => Promise<Uint8Array>, gunzip: (b: Uint8Array) => Promise<Uint8Array>, perRun = 200) {
  const [st] = await db.all<{ detail: string }>("SELECT detail FROM daily_refresh WHERE day='once' AND slot='compress'");
  const cur = st ? JSON.parse(st.detail) as { after: number; done?: boolean; packed: number; saved: number; failedVerify?: number } : { after: 0, packed: 0, saved: 0 } as { after: number; done?: boolean; packed: number; saved: number; failedVerify?: number };
  if (cur.done) return null;
  const rows = await db.all<{ job_id: number; r2_key: string }>(
    "SELECT job_id, r2_key FROM fetch_job WHERE job_id > ? AND status='done' ORDER BY job_id LIMIT ?", [cur.after, perRun]);
  let i = 0;
  const work = async () => {
    while (i < rows.length) {
      const r = rows[i++]!;
      if (!r.r2_key.startsWith("api/") && !r.r2_key.startsWith("att/")) continue;
      const head = await bucket.head(r.r2_key);
      if (!head || head.customMetadata?.enc === "gzip") continue;
      const obj = await bucket.get(r.r2_key);
      if (!obj) continue;
      const raw = new Uint8Array(await obj.arrayBuffer());
      const gz = await gzip(raw);
      if (gz.length >= raw.length) continue; // nothing to gain
      // Owner #282: nothing downloaded is ever lost. Overwrite only after the compressed copy is proven to unzip to
      // exactly the original bytes.
      const back = await gunzip(gz);
      if (back.length !== raw.length || !back.every((b, k) => b === raw[k])) { cur.failedVerify = (cur.failedVerify ?? 0) + 1; continue; }
      await bucket.put(r.r2_key, gz, { httpMetadata: obj.httpMetadata, customMetadata: { ...(obj.customMetadata ?? {}), enc: "gzip" } });
      cur.packed++; cur.saved += raw.length - gz.length;
    }
  };
  await Promise.all(Array.from({ length: 8 }, work));
  const next = { after: rows.length ? rows[rows.length - 1]!.job_id : cur.after, packed: cur.packed, saved: cur.saved, failedVerify: cur.failedVerify ?? 0, done: rows.length < perRun };
  await db.run("INSERT INTO daily_refresh (day, slot, at, detail) VALUES ('once', 'compress', ?, ?) ON CONFLICT (day, slot) DO UPDATE SET at=excluded.at, detail=excluded.detail",
    [new Date().toISOString(), JSON.stringify(next)]);
  return next;
}
