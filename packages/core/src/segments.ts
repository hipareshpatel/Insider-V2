// D47 segment results (work list A3): the reportable segments a results file reports (Ind AS 108) — name, revenue,
// result (profit before tax and finance costs), assets, liabilities — for the reported period (the current-period
// context's dates) and, separately, year to date. Read from contexts whose only dimension is ReportableSegmentsAxis;
// the segment's name is its DescriptionOfReportableSegment. Checks: segment revenues add up to the filed total segment
// revenue, and segment results to the filed total result (±₹1 lakh). Filed values only (D170).
import { type Dec, add, cmp, dec, sub, toText } from "./decimal.js";
import type { XbrlInstance } from "./xbrl.js";

export interface Segment { key: string; name: string; revenue?: string; result?: string; assets?: string; liabilities?: string }
export interface SegmentPeriod { start: string; end: string; segments: Segment[]; totals: { revenue?: string; result?: string }; checks: { name: string; ok: boolean; detail: string }[] }
export interface SegmentResult { multi: boolean | null; periods: SegmentPeriod[] }

const AXIS = /:ReportableSegment\w*Axis$/; // revenue, result (…FinanceCostsAxis), assets, liabilities: one axis each, same members
const TOL = dec("100000");
const within = (a: Dec, b: Dec) => { const d = sub(a, b); return cmp(d.units < 0n ? { units: -d.units, scale: d.scale } : d, TOL) <= 0; };
/** A stable key for a segment across periods: its name reduced to lower-case letters and digits. */
export const segmentKey = (name: string) => name.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();

export function segmentResults(inst: XbrlInstance): SegmentResult {
  const pf = inst.facts.find((x) => /:DateOfEndOfReportingPeriod$/.test(x.tag))?.tag.split(":")[0] ?? "in-capmkt";
  const meta = (t: string) => inst.facts.find((x) => x.tag === `${pf}:${t}`)?.value ?? null;
  const flag = meta("IsCompanyReportingMultisegmentOrSingleSegment");
  const multi = flag ? /multi/i.test(flag) : null;
  const end = meta("DateOfEndOfReportingPeriod"), start = meta("DateOfStartOfReportingPeriod"), fyStart = meta("DateOfStartOfFinancialYear");
  const val = (ctx: string, t: string) => { const f = inst.facts.find((x) => x.contextRef === ctx && x.tag === `${pf}:${t}` && !x.nil && x.value); return f?.value && /^-?\d/.test(f.value) ? toText(dec(f.value)) : undefined; };
  const nameOf = (ctx: string) => inst.facts.find((x) => x.contextRef === ctx && x.tag === `${pf}:DescriptionOfReportableSegment`)?.value?.trim();
  // segment contexts: one dimension, a reportable-segment axis; the member (ReportableSegmentsNMember) is the segment
  const segCtx = [...inst.contexts.values()].filter((c) => { const d = Object.keys(c.dims); return d.length === 1 && AXIS.test(d[0]!); });
  const member = (c: { dims: Record<string, string> }) => Object.values(c.dims)[0]!;
  const names = new Map<string, string>();
  for (const c of segCtx) { const n = nameOf(c.id); if (n && !names.has(member(c))) names.set(member(c), n); }
  // total context of a period: no dimension, same dates
  const totalCtx = (s: string | null, e: string | null) => [...inst.contexts.values()].find((c) => c.start === s && c.end === e && !Object.keys(c.dims).length)?.id;
  const periods: SegmentPeriod[] = [];
  for (const [s, e] of [[start, end], [fyStart, end]] as const) {
    if (!s || !e || periods.some((p) => p.start === s)) continue;
    const dur = segCtx.filter((c) => c.start === s && c.end === e), inst_ = segCtx.filter((c) => c.instant === e);
    if (!dur.length) continue;
    const bySeg = new Map<string, Segment>();
    const put = (m: string, k: "revenue" | "result" | "assets" | "liabilities", v: string | undefined) => {
      const n = names.get(m); if (!n || v === undefined) return;
      const sg = bySeg.get(m) ?? bySeg.set(m, { key: segmentKey(n), name: n }).get(m)!;
      sg[k] ??= v;
    };
    for (const c of dur) { put(member(c), "revenue", val(c.id, "SegmentRevenue")); put(member(c), "result", val(c.id, "SegmentProfitLossBeforeTaxAndFinanceCosts")); }
    for (const c of inst_) { put(member(c), "assets", val(c.id, "SegmentAssets")); put(member(c), "liabilities", val(c.id, "SegmentLiabilities")); }
    const segments: Segment[] = [];
    for (const sg of bySeg.values()) if (!segments.some((x) => x.key === sg.key)) segments.push(sg);
    const tc = totalCtx(s, e);
    const totals = { revenue: tc ? val(tc, "SegmentRevenue") : undefined, result: tc ? val(tc, "SegmentProfitLossBeforeTaxAndFinanceCosts") : undefined };
    const checks: SegmentPeriod["checks"] = [];
    for (const [k, label] of [["revenue", "segment revenues = total segment revenue"], ["result", "segment results = total segment result"]] as const) {
      const t = totals[k]; const parts = segments.filter((x) => x[k] !== undefined);
      if (!t || !parts.length) continue;
      const sum = parts.reduce((a, x) => add(a, dec(x[k]!)), dec("0"));
      checks.push({ name: label, ok: within(sum, dec(t)), detail: `${toText(sum)} vs ${t}` });
    }
    periods.push({ start: s, end: e, segments, totals: Object.fromEntries(Object.entries(totals).filter(([, v]) => v !== undefined)) as SegmentPeriod["totals"], checks });
  }
  return { multi, periods };
}
