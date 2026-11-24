// Read-only R2 census: stored bytes and object counts per key prefix, split by gzip vs plain (enc metadata).
// Answers "where is the space, and what is still uncompressed?" without touching any object (owner #282: nothing is
// deleted or rewritten here). Only list() calls (Class A, ~1 per 1,000 objects); no D1 reads or writes (C56).
export type PrefixRow = { prefix: string; objects: number; bytes: number; gzObjects: number; gzBytes: number; plainObjects: number; plainBytes: number };

export async function r2PrefixSizes(bucket: R2Bucket, opts: { depth?: number; maxPages?: number; top?: number } = {}) {
  const depth = opts.depth ?? 2, maxPages = opts.maxPages ?? 600, top = opts.top ?? 40;
  const groups = new Map<string, PrefixRow>();
  let cursor: string | undefined, pages = 0, truncated = false;
  do {
    const l = await bucket.list({ cursor, limit: 1000, include: ["customMetadata"] });
    pages++;
    for (const o of l.objects) {
      const parts = o.key.split("/");
      const prefix = parts.length <= depth ? parts.slice(0, -1).join("/") + "/" : parts.slice(0, depth).join("/") + "/";
      const g = groups.get(prefix) ?? { prefix, objects: 0, bytes: 0, gzObjects: 0, gzBytes: 0, plainObjects: 0, plainBytes: 0 };
      g.objects++; g.bytes += o.size;
      if (o.customMetadata?.enc === "gzip") { g.gzObjects++; g.gzBytes += o.size; } else { g.plainObjects++; g.plainBytes += o.size; }
      groups.set(prefix, g);
    }
    cursor = l.truncated ? l.cursor : undefined;
    if (cursor && pages >= maxPages) { truncated = true; break; }
  } while (cursor);
  const rows = [...groups.values()].sort((a, b) => b.bytes - a.bytes);
  const sum = (f: (r: PrefixRow) => number) => rows.reduce((n, r) => n + f(r), 0);
  const topLevel = new Map<string, { objects: number; bytes: number; plainBytes: number }>();
  for (const r of rows) {
    const k = r.prefix.split("/")[0] + "/";
    const t = topLevel.get(k) ?? { objects: 0, bytes: 0, plainBytes: 0 };
    t.objects += r.objects; t.bytes += r.bytes; t.plainBytes += r.plainBytes; topLevel.set(k, t);
  }
  const gb = (n: number) => Math.round(n / 1e7) / 100;
  return {
    pages, truncated, ...(truncated ? { cursor } : {}),
    total: { objects: sum((r) => r.objects), bytes: sum((r) => r.bytes), gb: gb(sum((r) => r.bytes)), plainBytes: sum((r) => r.plainBytes), plainGb: gb(sum((r) => r.plainBytes)) },
    topLevel: Object.fromEntries([...topLevel].sort((a, b) => b[1].bytes - a[1].bytes)),
    largest: rows.slice(0, top).map((r) => ({ ...r, mb: Math.round(r.bytes / 1e4) / 100, plainMb: Math.round(r.plainBytes / 1e4) / 100 })),
    groups: rows.length,
    done: true,
  };
}
