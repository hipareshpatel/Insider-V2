// B5 review-queue framework: one generic queue for everything the system must not guess (D6, D27, D35, D42, D77).

export type ReviewKind =
  | "corp_action"
  | "entity_merge"
  | "demerger"
  | "identity_conflict"
  | "triage_audit"
  | "brsr_plant_mismatch"
  | "unmatched_kpi"
  | "bc_unparsed"
  | "error_report"
  | "owner_correction"
  | "sector_map";

export interface ReviewItem {
  kind: ReviewKind;
  subjectDb: "market" | "filings" | "announce" | "memory" | "graph" | "app";
  subjectRef: string;     // stable key: re-raising the same problem updates, never duplicates
  summary: string;
  evidence?: unknown;
  proposed?: unknown;
}

/** SQL + params to upsert an open review item (app DB, table review_item). Decided items are left alone. */
export function reviewUpsert(item: ReviewItem, nowUtc: string): { sql: string; params: unknown[] } {
  return {
    sql: `INSERT INTO review_item (kind, subject_db, subject_ref, summary, evidence, proposed, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 'open', ?)
          ON CONFLICT (kind, subject_db, subject_ref) DO UPDATE SET
            summary = excluded.summary, evidence = excluded.evidence, proposed = excluded.proposed
          WHERE review_item.status = 'open'`,
    params: [
      item.kind,
      item.subjectDb,
      item.subjectRef,
      item.summary,
      item.evidence === undefined ? null : JSON.stringify(item.evidence),
      item.proposed === undefined ? null : JSON.stringify(item.proposed),
      nowUtc,
    ],
  };
}
