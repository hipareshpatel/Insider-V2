// Archive fetcher (D124): 2 parallel (refusals seen at 4 from Cloudflare, Appendix B), no fixed pause; on 403/429/503 drop to 1 at a time with a 2 s pause;
// three refusals in a row stop the run (resume later). 404 is passed through (holiday / file not published).
import type { FetchResult, Fetcher } from "@disclo/core";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const REFUSAL = new Set([403, 429, 503]);

export class ArchiveStopped extends Error {}

export function archiveFetcher(base: typeof fetch = fetch, sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))) {
  let slow = false;
  let refusalsInRow = 0;
  let active = 0;
  const queue: (() => void)[] = [];
  const acquire = async () => {
    const limit = slow ? 1 : 2;
    if (active >= limit) await new Promise<void>((r) => queue.push(r));
    active++;
  };
  const release = () => { active--; queue.shift()?.(); };
  const f: Fetcher & { events: string[] } = Object.assign(
    async (url: string): Promise<FetchResult> => {
      if (refusalsInRow >= 3) throw new ArchiveStopped("archive refused 3 times in a row; stopping this run");
      await acquire();
      try {
        if (slow) await sleep(2000);
        const r = await base(url, { headers: { "User-Agent": UA, Accept: "*/*" } });
        const bytes = new Uint8Array(await r.arrayBuffer());
        if (REFUSAL.has(r.status)) {
          refusalsInRow++;
          slow = true;
          f.events.push(`refused ${r.status} ${url}`);
        } else refusalsInRow = 0;
        return { status: r.status, bytes, contentType: r.headers.get("content-type") };
      } finally {
        release();
      }
    },
    { events: [] as string[] },
  );
  return f;
}
