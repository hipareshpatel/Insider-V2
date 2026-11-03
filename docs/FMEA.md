# FMEA — failure modes and effects (build phase)

Written 2026-11-03 06:58 IST (#263), before new work, from the failures of the first 24 hours plus the next steps.
Severity / Likelihood / Detection: H (high), M, L. Detection H = we would notice late. Work the rows with two or more H first.
Each mitigation is in code with a test unless marked *process*.

## A. Failures already seen (closed; keep the guard)
| # | Failure mode | Effect | Cause | Guard now | Status |
|---|---|---|---|---|---|
| A1 | Duplicate securities | Wrong identity, conflicts, wrong history | Earlier date retried after a later one loaded | `extend_back`; strict date order; conflict → review | Closed |
| A2 | Reset raced a running load | Mixed old/new data | Wipe migration while a cron run was writing | Pause → confirm idle → wipe → lift (two deploys) | Closed (process) |
| A3 | Review flood | Owner time wasted, real items hidden | Bond/REIT/dividend text not understood; issuance flagged | Series allow-list; parser patterns; D129 | Closed |
| A4 | Whole day blocked | Backfill stalls | Gate on a real event (127 new symbols); one bad row | D125 row tolerance + new-symbol extension | Closed |
| A5 | Wrong-date file | Market caps against the wrong day | NSE served `PR060424.zip` with 4-Jun files | Bundle date must match | Closed |
| A6 | Stall on missing files | Backfill stops for hours | Cloudflare gets 403 (not 404) for missing archive files | PR bundle first; R2 cache authoritative up to the prefetch date | Closed |
| A7 | Archive refuses Cloudflare | Slow/blocked loads | NSE/Akamai blocks Cloudflare egress IPs | GitHub prefetch → R2; R2-first reads | Closed |
| A8 | Public log leaked PII | Owner's email visible | `wrangler whoami` printed account name | Mask filter in every Cloudflare workflow | Closed |
| A9 | D1 limits | Job errors | >100 bound parameters; LIKE pattern > 50 bytes; FK order | Chunk ≤ 90; short patterns; children first | Closed |
| A10 | Cloudflare API rate limit (971) | Deploy fails | Parallel workflows | One concurrency group + retry | Closed |
| A11 | Upload blocked (1010) | Attachments not saved | Python default User-Agent | Explicit UA; token check before work | Closed |
| A12 | Deploy kills a running cron | Partial date | Worker replaced mid-run | Upserts converge; avoid deploys during long loads (*process*) | Accepted |
| A13 | Guessed factor applied | Wrong adjusted prices | Price-ratio estimate written for unknown text | Unknown → no factor; only `auto`/`confirmed` applied | Closed |
| A14 | Write allowance burned | Overage / stop | Repeated reloads | Monthly cap on billed writes, daily job exempt (D136) | Closed |

## B. Open risks for the next steps
| # | Area | Failure mode | Effect | S | L | D | Mitigation (before / while building) |
|---|---|---|---|---|---|---|---|
| B1 | Reload | Reload stops before catching up (budget, refusal, gate) | No current data; snapshot never runs | M | M | L | `/status` checked at 08:10; budget 8M today; R2 authoritative |
| B2 | Index snapshot | Runs with partial identity (ISINs not current) | Wrong membership/sector | H | L | M | Runs only when prices are within 5 days of today; exact row-count gate per index |
| B3 | Shareholding XBRL | Category totals double-counted (sub-categories inside totals) | Wrong promoter/FII % | H | M | M | Read only the documented total contexts; check categories sum to 100% ± 0.1; real-file tests (INFY, a pledged promoter, a bank) |
| B4 | Shareholding XBRL | Named holder ≥ 1% matched to the wrong row | Wrong tracked investor | M | M | H | Pair name and shares by the same context id only; test on a real file |
| B5 | Results loader | Standalone and consolidated mixed in one series | Wrong ratios (V1: half of WRONG cards) | H | M | M | Basis is part of the key; loader refuses a value without basis; test |
| B6 | Results loader | Period mislabelled (Q vs 9M vs FY; Dec year-end) | Wrong growth | H | M | M | Period from the context dates, not the label; `fiscalPeriod` throws on non-period ends; tests incl. a Dec-year-end company |
| B7 | Results loader | Scale slip (lakh read as crore) or company tagged at wrong scale | 100× errors | H | L | M | Identity checks against the file's own totals; 10×/100×/1000× jump vs own history → hold (D133) |
| B8 | Results loader | Restated vs original confused | Silent history change | M | M | H | Version key (original / restated); later filing never overwrites; D48 |
| B9 | Results loader | Unknown template (general insurer, others) parsed as industrial | Nonsense lines | H | M | L | Template detection; failed identity checks → review, value not loaded |
| B10 | R2 gzip | Reader treats gzip bytes as text | Parser failures | M | M | L | `enc: gzip` metadata; one reader for both; test |
| B11 | Attachments | Truncated or empty XML kept | Parse errors, missing facts | M | L | M | Check XML closes its root element and is non-empty before saving (D133) |
| B12 | D1 size/writes | Filings loader writes too much | Budget hit | M | L | L | Canonical lines only (D132); write budget per job |
| B13 | Deploy order | New code before its migration (or the reverse) | Errors for a few minutes | M | M | L | Deploy workflow applies migrations first; schema changes behind a pause (*process*) |
| B14 | Docs drift | Plan/log/to-do out of date | Wrong decisions next chat | M | M | M | Hourly doc update (*process*); consistency check each update |

## C. Found while building (2026-11-03 morning)
| # | Failure mode | Guard |
|---|---|---|
| C1 | Shareholding % on the wrong base (SCRR base excludes ADR/employee-trust shares; INFY promoters 13.9% filed vs 12.73% of all shares; HDFCBANK public 100% filed) | Store both; filed % is the display default, labelled |
| C2 | Promoter encumbrance % read as % of the company (VEDL: 100% of the *promoter holding* is encumbered) | Field named `pctOfPromoterHolding`; test on VEDL |
| C3 | Pledge confused with other encumbrances (VEDL: 0 pledged, NDU + other) | Pledge = encumbered − NDU − other unless tagged; three numbers kept |
| C4 | Results XBRL whose facts reference a context the file never defines (2021 in-bse-fin files) | Period taken from the filing's own reporting-period facts in that context id; identities still checked |
| C5 | Integrated Filing revision rows have no broadcast time | `creation_Date` (NSE receipt time) as `disclosed_at` |
| C6 | Scale guard cascade: after a real step change (ABREL post-divestment, −92%), every later quarter was compared with the stale pre-change figure and held | A held value anchors the next filing; only the first period of a lasting change is held |
| C7 | Filing's own expense breakdown doesn't add to its total (360ONE, ABSLAMC: an untagged expense line) | Held (correct); later refinement: load the lines whose checks pass, mark the breakdown "not in filing" |
| C8 | Splits held when the previous day's share count is missing → factor not applied → wrong adjusted prices | Bc ratio applied automatically when the price move agrees within 5%; otherwise review |
| C9 | Queued deploy cancelled by GitHub (one pending run per concurrency group) → new code not live | After every push, check each workflow's conclusion; re-dispatch anything cancelled (*process*) |
| C10 | A commit pushed although tests failed (shell chain ignored the test result) | Commit only when `npm run check` itself exits 0; CI blocks deploys on failure (it did) |
| C11 | A "for later" config change (write budget back to 3M) sat in a commit and the single pipeline deployed it with the next push, mid-reload; today's writes were already 5.0M, so the next cron run would have stopped the reload (the in-flight run kept the old 8M value) | Never commit a change meant for a later state; then replaced by the owner's monthly cap (D136, 45M billed rows; daily job exempt) |
| C12 | Write counter undercounted the bill: it summed table rows changed, but D1 bills index writes too | Count D1 `meta.rows_written` across every write in market + filings; baseline from Cloudflare analytics (D136) |
| C13 | Same file content stored under several URLs (3,229 contents × 13,013 URLs) | Ledger shows duplicates (`/status`); cause and fix by class — see #265/#266 follow-up |
| C14 | Row-count gate cascade: a lasting step (2026-08-17: +161 EQ symbols) passed on day 1 (new-symbol extension), then every later day failed against the old 20-session median (reload stuck at 2026-08-17) | A day also passes within ±5% of the previous accepted session; simulated on all 87 sessions Jul–Nov 2026: old rule 10 rejections, new rule 0 effective |
| C15 | Old-GAAP test by schema name was too broad (2,763 modern files labelled old GAAP; harmless only because their main tags were present) | Census of all 56,382 results files; test narrowed to the entry points seen on old-GAAP files |
| C16 | Decimals in exponent form ("1.83025364E+15") rejected | Exact exponent parsing (BigInt); 3 files retried |
| C17 | D1 rows read not watched: 1.76B in 1.5 days (bulk loads, every-minute ledger scans, status polling) could pass 25B/month included | Daily cost guard includes reads (fails above $4); next: top-query measurement and indexes |
| C18 | Missing index in the compact schema (D130): `shares_daily` had no date index, so the daily share-count lookup scanned the whole table (780M rows read in 1.5 days); also full scans from `/status` (count of price rows, 213M), the Jan-2024 back-fill check on every run (194M) and the prefetch empty-check every minute (21M) | Measured with Cloudflare per-query analytics (infra-check, top 30); `ix_shares_d`; back-fill marked done once; `/status` without full counts; `LIMIT 1` empty-check. Rule: every new table gets its access paths checked against the queries that use it, and the top-queries report is read weekly |
| C19 | Source omission: NSE Bc files miss some corporate actions (19 price-affecting since 2024, e.g. SHRIRAMFIN split) → wrong adjusted prices before the ex-date | Second official source (per-company lists), whole-population comparison, versioned repair (D138); Phase 1 test 2 catches it on index members |
| C20 | Claude assumed the per-company lists use Bc's wording; a test over all 72 texts showed 12 unreadable | Parser learned the long forms; regression over all 5,759 loaded Bc purposes: 0 changes |
| C21 | Rows loaded before a parser fix keep the old (wrong) type and no factor (19 stored types differ from the current parser, some rights/consolidations) | Same versioned repair re-reads every loaded action without a factor with the current parser |
| C22 | Adjusted-series audit only covered the 50 Nifty stocks (Phase 1 test 2) | `/jumps` over every security; class counts before and after each factor change (D134) |
