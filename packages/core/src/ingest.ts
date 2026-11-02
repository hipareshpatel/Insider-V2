// B4 ingestion framework (D10, D17, §6): fetch -> raw store -> hash -> schema check -> parse -> validate -> idempotent load -> run log.
// One framework for every NSE source. Storage and DB are injected, so the same code runs in Workers, tests and CLIs.

export interface FetchResult {
  status: number;
  bytes: Uint8Array;
  contentType: string | null;
}
export type Fetcher = (url: string) => Promise<FetchResult>;

export interface RawStore {
  put(key: string, bytes: Uint8Array, contentType: string | null): Promise<void>;
}

export interface SourceFileRecord {
  source: string;
  fileDate: string | null;
  url: string;
  sha256: string;
  bytes: number;
  fetchedAt: string;
  rawKey: string;
}

export interface Ledger {
  /** sha256 already loaded for (source, fileDate)? */
  loadedHash(source: string, fileDate: string | null): Promise<string | null>;
  recordFile(rec: SourceFileRecord): Promise<number>; // returns file_id
  runStart(pipeline: string, runKey: string, at: string): Promise<number>;
  runEnd(runId: number, status: "ok" | "failed" | "skipped", at: string, detail: unknown): Promise<void>;
}

export interface SourceSpec<Row> {
  name: string;                                   // e.g. 'udiff_bhavcopy'
  url(fileDate: string | null): string;
  /** 404 is a normal "no file" (holiday) for dated sources. */
  missingIsNormal: boolean;
  parse(bytes: Uint8Array): Row[] | Promise<Row[]>;
  /** Gate checks (§9.1); any message = the date is not written. */
  validate(rows: Row[], fileDate: string | null): string[];
}

export type IngestOutcome<Row> =
  | { status: "loaded"; fileId: number; rows: Row[]; sha256: string; revised: boolean }
  | { status: "unchanged"; sha256: string }
  | { status: "missing"; httpStatus: number }
  | { status: "rejected"; reasons: string[]; sha256: string }
  | { status: "failed"; error: string };

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Fetch one file and, if it is new or revised, parse + validate it and hand the rows to `load`.
 * Idempotent: the same bytes for the same (source, date) are never loaded twice; changed bytes are a revision.
 */
export async function ingest<Row>(
  spec: SourceSpec<Row>,
  fileDate: string | null,
  deps: { fetch: Fetcher; raw: RawStore; ledger: Ledger; now: () => string },
  load: (rows: Row[], fileId: number) => Promise<void>,
): Promise<IngestOutcome<Row>> {
  const url = spec.url(fileDate);
  let res: FetchResult;
  try {
    res = await deps.fetch(url);
  } catch (e) {
    return { status: "failed", error: `fetch ${url}: ${String(e)}` };
  }
  if (res.status === 404 && spec.missingIsNormal) return { status: "missing", httpStatus: 404 };
  if (res.status !== 200) return { status: "failed", error: `fetch ${url}: HTTP ${res.status}` };

  const sha = await sha256Hex(res.bytes);
  const prior = await deps.ledger.loadedHash(spec.name, fileDate);
  if (prior === sha) return { status: "unchanged", sha256: sha };

  let rows: Row[];
  try {
    rows = await spec.parse(res.bytes);
  } catch (e) {
    return { status: "failed", error: `parse ${spec.name} ${fileDate}: ${String(e)}` };
  }
  const reasons = spec.validate(rows, fileDate);
  if (reasons.length) return { status: "rejected", reasons, sha256: sha };

  const rawKey = `raw/${spec.name}/${fileDate ?? "current"}/${sha}`;
  await deps.raw.put(rawKey, res.bytes, res.contentType);
  const fileId = await deps.ledger.recordFile({
    source: spec.name, fileDate, url, sha256: sha, bytes: res.bytes.length, fetchedAt: deps.now(), rawKey,
  });
  await load(rows, fileId);
  return { status: "loaded", fileId, rows, sha256: sha, revised: prior !== null };
}
