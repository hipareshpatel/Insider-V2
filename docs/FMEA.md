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
| A14 | Write allowance burned | Overage / stop | Repeated reloads | Daily write budget (D131) | Closed |

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
