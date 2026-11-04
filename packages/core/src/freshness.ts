// Owner #333 / #343 (work list item 1): a freshness rule for every feed. Each loader keeps one watermark row per feed
// (newest disclosure it wrote, rows written, when) — reading freshness never scans a table. A feed is stale when its
// newest row is older than the rule's maximum age (calendar days, IST), which allows for weekends and holidays.
import type { Sql } from "./sql.js";

export const FEED_RULES: Record<string, { maxAgeDays: number; what: string }> = {
  results: { maxAgeDays: 4, what: "financial results / Integrated Filing XBRL (focus companies)" },
  shareholding: { maxAgeDays: 10, what: "shareholding patterns (quarterly, filed in waves)" },
  insider_trades: { maxAgeDays: 4, what: "insider trades, NSE's system since 3 May 2026 (pit-gg XBRL)" },
  sast29: { maxAgeDays: 5, what: "SAST Reg 29 disclosures" },
  board_meetings: { maxAgeDays: 4, what: "board meeting intimations / outcomes" },
  credit_rating: { maxAgeDays: 10, what: "credit ratings" },
  prices: { maxAgeDays: 4, what: "daily prices (latest loaded session)" },
  bulk: { maxAgeDays: 4, what: "bulk deals (latest loaded session)" },
  block: { maxAgeDays: 4, what: "block deals (latest loaded session)" },
  fii_dii: { maxAgeDays: 4, what: "FII/DII daily snapshot" },
};

/** Record what one run wrote for a feed: newest disclosure (ISO date/time), rows. One primary-key upsert. */
export async function markFresh(db: Sql, feed: string, newest: string | null, rows: number, now = new Date()): Promise<void> {
  if (!rows || !newest) return;
  await db.run(`INSERT INTO feed_fresh (feed, newest, rows, at) VALUES (?, ?, ?, ?) ON CONFLICT (feed) DO UPDATE SET
    newest = CASE WHEN feed_fresh.newest IS NULL OR excluded.newest > feed_fresh.newest THEN excluded.newest ELSE feed_fresh.newest END,
    rows = feed_fresh.rows + excluded.rows, at = excluded.at`, [feed, newest, rows, now.toISOString()]);
}

/** Age in whole days between an ISO date/time and today (IST), and whether the feed is stale under its rule. */
export function staleness(feed: string, newest: string | null, now = new Date()): { age_days: number | null; stale: boolean; max_age_days: number } {
  const rule = FEED_RULES[feed] ?? { maxAgeDays: 4, what: "" };
  if (!newest) return { age_days: null, stale: true, max_age_days: rule.maxAgeDays };
  const ist = (d: Date) => new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 10);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(newest) ? newest : ist(new Date(newest));
  const age = Math.round((Date.parse(ist(now)) - Date.parse(day)) / 86_400_000);
  return { age_days: age, stale: age > rule.maxAgeDays, max_age_days: rule.maxAgeDays };
}
