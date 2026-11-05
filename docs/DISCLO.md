# Disclo — the one document

**Everything about Insider V2 / Disclo is in this file** (owner #325: combine all documentation into one, grouped; D159). Before 2026-11-03 it was 12 files in `docs/`; each was moved here **whole and unedited** (only its headings moved down one level), between `BEGIN`/`END` markers. A check confirmed every line of every old file is here byte-for-byte; git keeps the old files' history. `docs/sector-map.json` stays as a data file (read by code).

## How to read and write this file
- **Next chat starts at Part 1** (current state), then Part 2 (work list). Decisions are in Part 3, Appendix A; owner's words in Part 8.
- **Old file names inside the text** (e.g. "`docs/website.md` §11", "PLAN §16", "HANDOVER") now mean the part shown in the table below; section numbers are unchanged.
- **One writer per part.** The build chat writes Parts 1–3 and 5–8; the website chat writes Part 4. Both may append rows at the **end of the log table in Part 8**, just above "Consistency check procedure" (pull right before writing, take the next free number, rebase and renumber only your own row).
- **Consistency check** (end of Part 8) still runs after every update.
- **No duplicates:** a new topic gets a section in the part it belongs to — never a new file.

| Old file | Now |
|---|---|
| `HANDOVER.md` | Part 1 — “Handover — start of next chat (written 2026-11-02)” |
| `worklist.md` | Part 2 — “Work list — full trace of the documents (owner #321, rebuilt #323)” |
| `PLAN.md` | Part 3 — “Insider V2 — Plan (consolidated)” |
| `website.md` | Part 4 — “Website — everything discussed, decided, built and pending” |
| `disclo-design-recovered.md` | Part 4 — “Disclo — design discussion recovered from the planning chat” |
| `field-catalogue.md` | Part 5 — “Field Catalogue — v1, approved by owner (D123)” |
| `statement-line-items.md` | Part 5 — “Financial-statement line items in NSE's files (census, D154)” |
| `sector-map.md` | Part 5 — “Sector map — draft for owner review (D121, #240, #290)” |
| `FMEA.md` | Part 6 — “FMEA — failure modes and effects (build phase)” |
| `setup-guide.md` | Part 7 — “Owner Setup Guide (step by step)” |
| `probe-usage.md` | Part 7 — “NSE reachability probe” |
| `discussion-log.md` | Part 8 — “Discussion Log — owner statements → where they are recorded” |

## Contents
- **Part 1 — Current state and how to continue**
  - Handover — start of next chat (written 2026-11-02) *(was `docs/HANDOVER.md`)*
- **Part 2 — Work list (what to do next, in order)**
  - Work list — full trace of the documents (owner #321, rebuilt #323) *(was `docs/worklist.md`)*
- **Part 3 — Plan: product, architecture, data, AI, quality, operations, budget, legal, milestones, decisions**
  - Insider V2 — Plan (consolidated) *(was `docs/PLAN.md`)*
- **Part 4 — Website**
  - Website — everything discussed, decided, built and pending *(was `docs/website.md`)*
  - Disclo — design discussion recovered from the planning chat *(was `docs/disclo-design-recovered.md`)*
- **Part 5 — Data reference**
  - Field Catalogue — v1, approved by owner (D123) *(was `docs/field-catalogue.md`)*
  - Financial-statement line items in NSE's files (census, D154) *(was `docs/statement-line-items.md`)*
  - Sector map — draft for owner review (D121, #240, #290) *(was `docs/sector-map.md`)*
- **Part 6 — Quality: failure modes (FMEA)**
  - FMEA — failure modes and effects (build phase) *(was `docs/FMEA.md`)*
- **Part 7 — Operations: setup and probe**
  - Owner Setup Guide (step by step) *(was `docs/setup-guide.md`)*
  - NSE reachability probe *(was `docs/probe-usage.md`)*
- **Part 8 — Discussion log (owner's words; append new rows at the very end)**
  - Discussion Log — owner statements → where they are recorded *(was `docs/discussion-log.md`)*

# Part 1 — Current state and how to continue

<!-- BEGIN docs/HANDOVER.md -->
## Handover — start of next chat (written 2026-11-02)

**Repo:** `hipareshpatel/Insider-V2`, branch **`ccr-eb822347-c3zp4b`** (only branch). All documents are in `docs/`.

### Build state — 2026-11-05 06:45 IST (item 2 closed: remaining gaps accepted, owner #354; item 3 moved last, owner #355)
| Area | State |
|---|---|
| **Item 2 — closed (owner #354: "accept the gap and move to next item")** | Active gaps from the 2024-01-01 floor: **39 in 16 companies → 25 in 10** (`/coverage-gaps`, 5 Nov 06:43 IST). Fixed on 4 Nov: COFORGE Q3 FY26 (filed with Symbol NUCLEUS, C61), COFORGE and BALKRISIND Mar 2025 (half-year-dated quarter, C62), BAJAJ-AUTO Mar 2026 (retry starvation, C63), HDFCLIFE and ICICILIFE Q3 FY26 (start-date typo, C64), SIEMENS Q2 FY25 (mis-dated contexts, C65 b), BAJAJHLDNG Sep 2025, BAJAJFINSV Sep 2025, ABCAPITAL Mar 2025 (scale guard released by the EPS check, C65 a); FY25 full-year figures for 3 half-year filers (D169) |
| **Accepted gaps (25, not chased further)** | **12** NSE answers 404 for the standalone XBRL, re-fetched once on 4 Nov and 404 again: ADANIENT Mar/Sep 2025, Mar/Sep 2026; ADANIGREEN Mar/Sep 2026; JSWENERGY Mar/Sep 2026; UPL Mar/Sep 2025, Mar/Sep 2026 (consolidated loaded). **9** no quarter in the filed XBRL: COFORGE Sep 2026 (both) and COALINDIA Sep 2026 (both) are genuine half-years; COFORGE Mar 2025 consolidated and MANKIND Mar 2025 (both) fail the C62 proof; CGPOWER Mar 2025 (both) — the linked file holds H1 FY25. **2** SIEMENS Q3 FY26 (both) — the file holds Apr–Jun 2025. **2** BAJAJFINSV standalone Jun and Sep 2026 — held: profit ÷ shares does not match the filed EPS within 2%. Possible later sources (not built): iXBRL files, the next quarter's comparative column, PDF extraction |
| **Item 3 — deals refill (owner #355: moved to the end, before the universe expansion)** | Checked 4 Nov 22:08 IST (market `/status`): bulk and block 0 days still marked "possibly truncated" over 706 sessions (bulk 71,190 rows, block 4,929; 5 days with no file each). Short selling has 304 days at the same 70-row cap and no CSV source — **added to the end of the list (owner #356)**: find an uncapped source. Both kept as the last items before the universe expansion |
| **Cost** | D1 writes this month 48.1M of 50M included (cap 54M; 15.9M on 4 Nov, mostly the morning's index build). One-off passes kept small |
| **Item 4 — 2.8 shareholding counts (5 Nov 07:41 IST, `/shp-coverage`, 5 read-only calls)** | **2,820 of 2,824** shareholding filings NSE lists for the 250 from 2024-01-01 are loaded (99.9%). Not loaded, noted and not chased (owner #357): **4** download 404 — VOLTAS Jun 2025, VMM Jun 2025, one non-quarter-end filing each of LTIM and BSE; **5** listed by NSE without an XBRL link — CANBK Dec 2025, TIINDIA Jun 2026, BSE Jun 2024 / Dec 2024 / Mar 2025; **3 companies with no shareholding list** — EMBASSY (REIT, expected), MCX and ABBOTINDIA (not investigated). Six 2022 filings (UNOMINDA ×3, PATANJALI, SHRIRAMFIN, MOTHERSON) show as missing only because they are not dated at a quarter end — correctly excluded by the loader (D168) |
| **Item 5 — D157 layouts (5 Nov, `/statement`, read-only)** | **Built:** industrial (Schedule III Div II), NBFC (Div III P&L), bank (Third Schedule P&L + 13-line balance sheet), life and general insurers (IRDAI P&L); layout picked from what was stored. Each statement states its period (a quarter's cash flow is filed year to date: 6 months at Sep), deducted lines carry `sign −1` (value as filed), zero rows hidden in balance sheet / cash flow, stored lines with no row are listed (`not_in_layout`). Derived operating profit only for industrial companies (BAJFINANCE showed a meaningless 71 %). **Checked live:** INFY (every head = filed sub-rows, both sides ₹1,63,480 cr), HDFCBANK (all stored under bank names), BAJFINANCE (expense lines = filed ₹16,042 cr). **NBFC balance sheet (Division III) added 08:29 IST:** loader reads financial / non-financial assets and liabilities (each group must equal its filed total); one-off `/maint/nbfc_bs` over the 30 focus NBFCs, 602 files from 2024 (inserts only, ≈ 0.25M rows read, ≈ 25k written); BAJFINANCE Sep 2026 now shows loans ₹5,74,174 cr, debt securities ₹2,44,831 cr, borrowings ₹1,86,672 cr, deposits ₹69,754 cr — financial liabilities add to the filed ₹5,10,253.11 cr exactly; nothing stored is left without a row. Quarter files without a full balance sheet are left as they were ("too few checks"). **Gaps, noted:** NBFC revenue lines other than interest and fees (₹244 cr of ₹24,546 cr for BAJFINANCE) not extracted; bank and insurer cash-flow detail not loaded (totals are); insurer balance sheet not checked yet |
| **Item 6 — computed views + feature table (5 Nov 09:19 IST, D171)** | `views.ts` (TTM, EBITDA D49, adjusted PBT/PAT D52, ROE/ROCE on average capital, D66 trend and large order) and `feature_value` (filings 0040, origin fixed to `computed`, inputs stored). **Built for all 250:** ≈ 92k values (2024-01-01 on, both bases), ≈ 1.2M rows read and 92k written once. **Checked:** INFY TTM revenue to Mar 2024 ₹1,53,671 cr and to Mar 2025 ₹1,62,990 cr equal its filed full-year figures (four filed quarters add to the filed year); standalone FY24 ₹1,28,932 cr likewise. **Kept current:** the filings cron rebuilds focus companies with new results filings (cursor over filing_id, ≤ 10 a run; a rebuild writes only changed values). **Valuations (added 5 Nov):** `pe_ttm_rep` (market cap ÷ TTM profit to owners), `earnings_yield`, `pb` (÷ equity to owners on the latest balance sheet), `mcap_to_sales_ttm`, `ev_ebitda_ttm` (industrial only; EV = market cap + borrowings − cash and other bank balances + non-controlling interest; investments not netted) on NSE's own market cap of the latest close (D5), stored under `latest`, refreshed once per trading day by the filings cron (50 companies a run). `pe_ttm` (adjusted) is stored as unavailable with the reason: the tax and minority share of exceptional items are not filed. A loss gives no P/E (reason stored). **Not in v1:** insurers have no revenue base yet (reason stored); valuation history (own-median P/E) is not kept; website reads are Part 4 |

### Build state — 2026-11-04 12:20 IST (owner #343: paused passes restarted behind a cost gate; work list item 1)
| Area | State |
|---|---|
| **Owner decisions (#343)** | **D167** cash flow with untagged adjustments: option (a) — a labelled "Other adjustments (not itemised in the filing)" line only when all three section totals reconcile; otherwise the file goes to review (to build with the D154 item, after its census, D134). Restart the deals CSV refill (1.8), remark pass and version pass now, focus companies only, **behind a first-batch cost gate** (rows read / written of the first call recorded; continue only if cheap and writes stay well below the 60M soft cap). `fin_value` key change stays deferred to a fresh billing cycle (D162) |
| **Built for the gate** | `/maint` calls are metered (rows read, billed rows written) — returned in each answer and charged to the read and write budgets (they were not charged before: a gap in P1); `ops` takes `max_calls` (1 = one batch) and always makes at least one call; version pass rewritten for the focus companies, company by company over `ix_filing_sec` (`version_backfill_focus`; the old pass grouped all of `filing` per call) |
| **Item 1 — freshness rule for every feed** | `feed_fresh` (filings 0036): one watermark per feed (newest disclosure, rows, when), written by the loaders (results, shareholding, insider trades, SAST, board meetings, credit ratings); market feeds from the newest loaded session / `ms_day` (primary-key lookups). `/fresh` now: per feed age vs its rule (`FEED_RULES`, e.g. results ≤ 4 days, SAST ≤ 5, ratings ≤ 10), the stale list, the insider count check (distinct appIds loaded vs XBRL files by status, failures recorded in `event_load`), the last two days' slots — no table scan |
| **Deploys** | PR #4 (`a456197`, deploy 125, 12:21 IST) and PR #5 (`127e71f`, deploy 126, 12:31 IST) — both green |
| **First-batch cost gate (one call each, metered)** | deals CSV refill: 1,415 rows read, 0 written, **nothing left to refill** (finished before the P1 pause); remark pass: 28,615 read, 1 written; version pass: 30,077 read, 7 written. Both passes cheap → continued. Found by the gate: the focus-list query read **~28.6k rows per call** (it started from every symbol identifier) — also on every 5-minute filings run (~8M rows/day); fixed with a CROSS JOIN from the index members (PR #5, query-plan test) |
| **Passes completed** | Version pass (focus, by company): 250 companies, 213 multi-filing periods, 10 calls, ≈ 122k rows read, ≈ 13.3k written (12:33–12:40 IST). Remark pass (focus): done, 7,053 updates issued (was 4,194), ~40 calls of 1.4–2k rows read, ≈ 3k written (12:43–12:50 IST). Deals refill: done (no capped day left) |
| **Item 1 verified (`/fresh`, 12:53 IST)** | **Insider count check passes: 3,298 new-system filings loaded = 3,298 XBRL files downloaded** (1 file failed for good), 7,036 trades, 0 load failures. Freshness: **no stale feed** — results 3 Nov 20:02 UTC, shareholding 3 Nov, insider trades 3 Nov 22:09, SAST 3 Nov, board meetings 3 Nov, ratings 3 Nov, prices / bulk / block / FII-DII 3 Nov. Still to see: the first daily-queued insider XBRL (kind `xbrl_pit_gg`) and SAST / board / ratings lists from tonight's 20:30 IST slot |

| ↳ | Item 1 ✅. Next: item 2, coverage gaps for the 250 |
| **Item 2 — after the 2024-01-01 floor (D168, 14:30 IST)** | **39 active gaps in 16 companies** (366 out of scope, 47 companies). Classes: **13** loaded under another period or basis — CGPOWER, COFORGE, COALINDIA, BALKRISIND, MANKIND; **12** HTTP 404, all standalone (ADANIENT, ADANIGREEN, JSWENERGY, UPL); **5** scale-guard holds (BAJAJHLDNG, BAJAJFINSV, ABCAPITAL); **5** no context (HDFCLIFE, ICICILIFE, SIEMENS Dec 2025); **2** BAJAJ-AUTO symbol (C59 retry); **2** SIEMENS Mar 2025 period length. SUNDARMFIN: all its gaps were before the floor |
| **Item 2 — "another period" class (15:15 IST)** | Per-file check (`/gap-detail`, `/contexts`): the files are **half-year files** (reporting period 6 months). COFORGE Mar 2025 has only H2 (Oct–Mar) and FY columns, so neither the quarter nor (since the FY reader ran for quarter files only) the full year was stored. **CGPOWER Mar 2025: the file NSE links is H1 FY25 content (Apr–Sep 2024) re-filed 8 May 2025** — no Q4 FY25 XBRL exists, not fixable from XBRL. Fix: D169 / C60 — quarter only from the file's own 3-month column, FY from year-end half-year files; loader + one-off `/maint/half_year_gaps`. **Owner #345: no quarter derived from a half-year** (the half-year minus previous quarter path shipped in deploy 130 was removed; filings 0038 deletes any row it wrote). `/gap-detail` now also shows where each file was stored (its `filing` row) — COFORGE Dec 2025 reads "Q3 FY26 loaded" yet no row is stored at 2025-12-31: checked after deploy |
| **Item 2 — coverage gaps classified (13:13 IST)** | Classifier (`/maint/coverage_classify`, 7 calls, ≈ 260k rows read, 413 written): **405 gaps in 62 of the 250 companies**. By class: **222** excluded old bank-format files without a reporting period (D145; 18 companies: CANBK, INDIANB …); **79** renamed companies — the file carries the pre-rename symbol (ADANITRANS→ADANIENSOL, LTI→LTIM, SRTRANSFIN→SHRIRAMFIN, IIFLWAM→360ONE, MOTHERSUMI→MOTHERSON, MINDAIND→UNOMINDA, CADILAHC→ZYDUSLIFE, RUCHI→PATANJALI, BAJAJAUTO→BAJAJ-AUTO; 9 companies) → **fixed** (C59: a file's company falls back to the company whose list linked it; the skipped files reload through the retry queue); **38** NSE file missing (HTTP 404, PSU banks 2021); **22** scale-guard holds (14 companies, re-checked by C45); **16** no XBRL link on NSE's list (mostly Dec 2021); **13** loaded under another period or basis (5 companies, per-file check next); **8** SUNDARMFIN core line PAT missing (NBFC layout); **7** unsupported layouts (Siemens 6-month year-end change, HDFCLIFE/ICICILIFE/SIEMENS Dec 2025 contexts). ~~Owner question (D145)~~ **decided #344 (D168): D145 stays; nothing before 2024-01-01 is chased** |

### Build state — 2026-11-04 11:40 IST (audit P1 "plan realignment" built; owner #341)
| Area | State |
|---|---|
| **Branch** | `ccr-eb822347-c3zp4b` stays the primary branch (deploys on push). PR #1 (P0) was merged by Claude on the owner's instruction (#341, merge `0393602`); Stage 2 goes the same way (PR from the session branch, merged when CI is green) |
| **One-offs out of the crons (D163)** | Prefetch: compression, full-history and structure-history seeds; filings: BS/CF + FY backfill, version pass, remark pass; market: deals CSV refill (1.8), 10-year index history + weekends, January-2024 derivation, versioned factor repair. Each runs only when started: **`ops` workflow** → `POST /maint/<name>`, one bounded batch per call, position saved inside the loop (version pass after every group; BS/CF every 10 files). **Deals CSV refill (1.8) therefore pauses until started** |
| **Filings robustness** | Every step guarded (events and insider XBRL were not); unreadable lists/XBRL recorded in `event_load` (was: 0 rows, cursor moved on); a storage error waits at the file ≤ 3 runs; run budget 210 s, lock 10 min (no overlap of 5-minute runs); loader cursor never passes a file it did not read |
| **Daily feeds** | SAST Reg 29, board meetings, credit ratings back in the daily slots (frozen since the 3 Nov history, C58): dated all-company calls, last 3 days; rows and XBRL kept for the 250 only (D161) |
| **Leaks** | Sector job reads new lists from the ledger (no R2 listing, no full `sector_file` read every 10 min; `kv_state` cursor); market structure checks progress before reading the calendar/symbols; daily "revised file" re-run removed (R2-first made it a no-op); 23:07 archive retry downloads only files not in R2; attachment job exits when its queue is empty; dead insider-bundle path deleted (`prefetch-pit.yml`, `tools/prefetch_pit_gg.py`) |
| **D160 headers** | Browser session in `packages/core/src/nse/session.ts` (prefetch Worker) and `tools/nse_session.py` (GitHub scripts): Chrome 142 headers (`CHROME_MAJOR`, update quarterly), API calls with NSE's filings page as Referer and same-origin/cors/empty Sec-Fetch; archive files same-site (another NSE host); homepage cookie jar per run, one re-warm + retry on 401/403. Market archive fetcher unchanged |
| **Status pages** | No standing secret (owner #341): the `ops` workflow sets a fresh random token per run and prints the page in its log. Filings `/status` reads cached counters (`stat_counter`, seeded by filings 0035, deltas per loader run) — no count over `fin_value` |
| **Budget + write caps (D166, owner #342)** | **November 2026 billing period only: $25 ceiling** ($5 plan + up to $20 usage), back to $10 from the next period. Writes: **soft cap 60M** (one-off passes, back-fills, optional steps stop; `/maint` refuses) and **hard cap 68M** (only the live daily filings + events loading and the market daily job continue). Both caps are 54M from December automatically (`WRITE_CAP_MONTH`); the daily cost guard alarms above $20 for this period, $4 after. Zero-mass-write rule stays; `fin_value` key change stays deferred (D162) |
| **Owner reference file** | `docs/ilide.info-prowessiq-data-dictionary-ind-as-pr_d63da78983199320d484dadc6c2582e2.pdf` — ProwessIQ data dictionary (Ind AS), added by the owner as the reference for statement preparation and mapping (D157). Approved; keep (owner #341) |
| **Deploy (verified)** | PR #2 merged by Claude (`443543e`) → `deploy.yml` run 124, 11:43–11:44 IST: tests 290 pass; migrations market 0029 + filings 0035 applied on staging and production; market (+staging), prefetch, filings uploaded with triggers |
| **Verified 11:46 IST (`ops` run 1: filings `/status`, one call)** | The ops workflow set a fresh token and read the page. Counters seeded 11:43 IST: results filings 40,694; shareholding filings 23,911; fin_load loaded 64,604 / review 220 / skipped 453 / excluded 283 / failed 2; fin_value **pl 1,242,684, bs 375,301, cf 345,617**; shareholding rows 995,209. First cron run after the deploy (11:45 IST) moved every cursor: events (job 307,944), insider XBRL (job 311,245; 7,036 trades), loader (job 75,074, focus 258 symbols), primary basis (88 companies). No new error rows. Paused by design: remark pass (4,767 / 4,194 updated), version pass (570 groups), deals CSV refill |
| **Correction (Claude)** | fin_value holds **≈ 1.96M rows**, not ~15M as reported at 11:14 IST. The 15.7M rows written by the 0034 index build are what D1 billed for that build (its per-query analytics), about 8× the table's rows; the charge to the write counter (market 0028) stands. D162's rebuild cost is therefore not "~30M+" by row count — expect roughly what the index build cost (~15M billed rows); measure before deciding |

### Build state — 2026-11-04 10:45 IST (cost audit, P0 "stop the bleeding" built; owner #338–#340)
| Area | State |
|---|---|
| **Audit (owner #338)** | Read-only audit of commit 0507473: the D1 read spike is **re-scanning, not re-downloading** (every NSE URL is fetched once: `fetch_job.url` UNIQUE, status checked before each call). Worst paths: the revision-remark pass (`UPDATE filing … WHERE source_url=?` scanned all of `filing` per row), `versionPeriod` (each of 6 statements read the company's whole `fin_value`), the loader's file selection (every `done` row of `fetch_job`, ~300k per run), `+kind` cursors (table tail every run), ~17 unauthenticated diagnostic pages. Report: claude.ai artifact (owner #339). FMEA C57 |
| **Owner decisions (#340)** | **D160** NSE browser-session compatibility (supersedes the "no disguised clients / faked headers" rule); **D161** new downloads only for the 250; **D162** `fin_value` key change deferred |
| **P0 built** | Remark and version passes **off** in the cron; indexes `filing(source_url)`, `fin_value(security_id, period_end, period_kind, basis, disclosed_at)`, `fetch_job(kind, job_id)`, partial `fetch_job` API-pending, `fin_load(retry_after)` (filings 0034; the fin_value index build wrote 15.7M rows); `versionPeriod` = one indexed read, writes only changes; restatement flags upserted only when different (C33); loader = (kind, job_id) cursor that waits at undownloaded files + retries with backoff 6 h → … at most 8 tries; primary basis only for companies with new filings; prefetch discovery/queue queries indexed, per-minute `count(*)` removed; daily XBRL born `discovered=1`; **insider XBRL from the daily `pit_gg` list now queued** (was never queued after the probe list — found in the audit); Sunday sweep, triggers and the GitHub attachment job limited to the 250 (D161); diagnostic pages behind `STATUS_TOKEN` (GitHub secret → Worker secret; not set = pages closed); staging market cron off; **read breaker** (`market.read_budget`, 150M rows/day: optional passes stop, 3× = essential only); EXPLAIN guard in `npm run check` (`db/test/query_plans.test.ts`). Tests 282 pass |
| **Deploy (verified)** | `deploy.yml` run 121 on `ccr-11d1544b-8ta9kf` (commit 2738dfd), 10:47 IST: tests 282 pass; migrations market 0027 + filings 0034 applied on staging and production; market (+staging), prefetch, filings uploaded with triggers; `STATUS_TOKEN` GitHub secret **not set** → diagnostic pages closed (403) until the owner adds it |
| **Verified 11:14 IST (Cloudflare per-query analytics, 27 min after deploy)** | The old hot queries stopped: remark UPDATE 4,020 → 4,020 calls; old loader selection 553 → 553; old primary-basis lists 234 → 234; old event cursor 732 → 732; old prefetch queue 1,410 → 1,411, discovery 1,441 → 1,444 (the last calls before the deploy). The new queries are not in the top 30. Period totals: reads 24.509 B (10:45) → 24.516 B (11:14); writes 37.3M → 39.7M. Analytics totals lag, so the hourly rate is re-measured after 24 h |
| **Cost of the fix (my estimate was wrong)** | The `fin_value` index build wrote **15.7M rows** (billed by D1 for the build; the table itself holds ≈ 1.96M rows — corrected 11:46 IST). Period writes ≈ 53–55M vs 50M included (≈ $1 per extra million). Migration writes bypass the Workers' meters, so market 0028 charges them to `write_budget` (the 54M cap now sees them). D162's table rebuild would cost ~30M+ writes, not 3–6M |

### Build state — 2026-11-04 09:15 IST (handover to the next assistant)
| Area | State |
|---|---|
| **Cost (read first)** | Charges this period $0.03 (storage). **D1 reads 24.2 of 25 B included used** — ≈ 20 B wasted by Claude's diagnostics (FMEA C56). Beyond 25 B: $1 per billion rows. Rules in C56: no polling loops, EXPLAIN every new query, full census only when a reader changes. Filings cron now every 5 min |
| Market | 705 sessions to 3 Nov; M1 clean sessions 1/10 (daily check 22:41 IST); index history 2016–2023 complete incl. 5 weekend sessions; DUMMY… symbols outside the universe |
| Insider trades (C53) | NSE moved to `/api/corporates-pit-gg` on 3 May 2026. List via Cloudflare (daily slots), XBRL via the GitHub attachment job, `parsePitXbrl` + `loadPitXbrl`; 2,250 of 3,298 filings loaded (09:14), ~1 h to finish at 150 files / 5 min. Then: count check (`/fresh` insider_new_system vs 3,298) |
| Bulk/block (1.8) | JSON capped at 70/day; `csv=true` is not (656 deals / 8 days). ~210 CSV windows queued (kind `hist_deals_csv`); `refillDealsCsv` replaces capped days. Check `ms_day` notes `complete (csv window)` |
| Statements (D154) | BS 99.58%, CF 95.81% of files (D167 decided #343: option a); totals vs Screener 189/255 (rest = Screener conventions/errors, verified on Union Bank PDFs); **owner a/b pending** on ~1,240 files with untagged adjustments |
| Restatements (C55) | No prior-year columns in any results XBRL; revised XBRL exists and is versioned/flagged on every line, statement and period kind; NSE submission type + revision remark stored (131 revisions, 87 remarks so far); one-off passes running (`/restatements`) |
| Primary basis (D50/D51) | 97 of the focus companies decided (both 6, consolidated 81, standalone 10); 31 basis breaks + 153 coverage gaps in 26 companies — breaks now ignore quarters NSE itself lists (a missing file is a coverage gap). Next: work the gap list |

### Handover prompt for the next assistant (owner #337, "write handover prompt")
Copy everything between the lines.

---
You are continuing the build of **Disclo** (disclo.in), an Indian-equities data site: NSE disclosures (financial results, shareholding, insider trades, SAST, board meetings, ratings, bulk/block deals, prices, indices) turned into checked, sourced data for retail investors. Owner: non-technical founder; reply in simple English, result first, IST times; stress-test his ideas and never agree by default; report only what you verified.

**Where everything is:** GitHub `hipareshpatel/Insider-V2`, branch `ccr-eb822347-c3zp4b` (the only branch). **One document holds everything: `docs/DISCLO.md`** — Part 1 state (read the latest build-state table first), Part 2 work list (do it in order), Part 3 plan + decisions D1–D159 (Appendix A), Part 4 website (owned by the website chat — do not edit), Part 5 data reference, Part 6 failure modes (FMEA C1–C56: read C53–C56), Part 7 operations, Part 8 the owner's words (append one row per owner message at the end of the log table, then run the consistency check at the end of Part 8).

**Stack:** Cloudflare Workers (`workers/market` cron 10 min, `workers/filings` cron 5 min, `workers/prefetch` cron 1 min, `workers/web` offline) + D1 + R2 (`disclo-raw`); shared readers in `packages/core`; migrations in `db/migrations/<db>/`; GitHub Actions: `deploy.yml` deploys on push (tests first), `prefetch-archive.yml` / `prefetch-attachments.yml` download NSE archive files to R2, `infra-check.yml` daily cost guard. `npm run check` = tests; `npx tsc -b` = types. Read-only status pages on `https://disclo-<worker>.financialengineer-in.workers.dev/` (`/status`, `/fresh`, `/restatements`, `/primary-basis`, `/index-check`) — call them once, never in a polling loop.

**Hard rules (owner's):** scope is the 250 focus companies (Nifty 50 + Next 50 + Midcap 150) until the freeze; nothing already downloaded is deleted; never put secrets, personal emails or PAN/DIN numbers in the repo, logs or public pages; NSE requests use the browser-session pattern of D160 (realistic browser headers, a warmed cookie jar, one re-warm on 401/403; no proxies, no IP rotation) — NSE refuses GitHub for its API host, so API lists come via Cloudflare and archive files via GitHub; new downloads only for the 250 (D161); budget $10/month ($25 for the November 2026 period only, D166): D1 writes soft cap 60M / hard cap 68M in November, 54M after (D166; 50M included, then $1 per million), **D1 reads are nearly at the 25 B included — EXPLAIN-check every new query, no full-table scans in cron paths, no polling** (C56); a reader change needs a whole-population census first (D134), at most once; confirm a deploy succeeded before reporting it; one item at a time from Part 2.

**Running now (check, don't restart):** insider trades from NSE's new system loading (count check vs 3,298 filings when done); bulk/block CSV windows downloading + capped days refilling; one-off version and revision-remark passes; daily primary basis + coverage gaps.

**Next, in order:** (1) insider count check and freshness rule for every feed (owner to-do: NSE inventory with daily evidence, Part 2); (2) coverage gaps for the 250 (`coverage_gap`), fix by class; (3) ~~verify bulk/block refill~~ moved to the end (owner #355); (4) ~~2.8 shareholding counts vs NSE~~ ✅ 2,820 / 2,824 (5 Nov); (5) D157 statement layout (Schedule III heads with sub-rows); (6) computed views D49/D52/D66 and the feature table; **parked until the site is live (owner #359):** (a) sign off the bulk/block refill (checked 4 Nov: 0 capped days); (b) short selling: 304 days at the API's 70-row cap — find an uncapped source (owner #356). Until (b) is done, any short-selling view must label those 304 days "partial — NSE's list stops at 70 rows" or leave them out (website Part 4). **Waiting on the owner:** a/b for cash-flow files with untagged adjustments (recommended a: labelled "Other adjustments (not itemised in the filing)" line when the three section totals check).
---

### Build state — 2026-11-04 05:40 IST (check-ins 7–10 closed; session was down 22:00–05:15 IST)
| Area | State |
|---|---|
| Market | sessions 2024-01-01 → **2026-11-03** (705); 3 Nov loaded by itself after 22:00 (2,613 rows) → **M1 clean sessions 1/10**; 6 failed runs all from the 3 Nov morning history load, resolved; writes 32.2M of the 54M cap |
| Index history (D156) | **complete 2016–2023**: 2,086 weekdays, 165,016 rows, 112 holidays, 0 unreadable, Nifty 50 on every day; closes match NSE (4 Jan 2016 7,791.30; 23 Mar 2020 7,610.25; 29 Dec 2023 21,731.40). Speed-up: 1,334 days in < 4 min. Weekend special sessions (C52) downloading |
| Filings (250 focus) | 64,576 loaded, 2 failed (broken XML); backfill **done** 23:27 IST; FY 2,105; BS 374,651 / CF 344,325 line values |
| Statement detail (D154) | BS 99.58%, **CF 95.81%** (was 55.87%), 0 newly failing; residual: ≈1,240 files with untagged adjustments (owner decision a/b), 17 direct-method |
| Daily freshness (item 2) | 2 Nov filings loaded (134); 3 Nov evening slot failed → C51 retry built; **insider trades stop May 2026 at NSE's list (C53, open)** |
| Docs | one document `docs/DISCLO.md` (D159) |

### Build state — hourly update 2026-11-03 08:52 IST
| Area | State |
|---|---|
| Market history (compact, D130) | reloading from R2: 680 sessions to 2026-09-25, 1.90M price rows; row-count gate cascade fixed (FMEA C14); reviews 212 open (37 bc_unparsed, 175 corp_action); finish ≈ 09:10 |
| Cost (D136, D137) | ceiling $10/month all Cloudflare ($5 plan + ≤ $5 usage); estimated usage charges this period **$0.03**; D1 written 25.1M of the 45M cap; daily cost guard 19:47 IST (fails above $4, GitHub emails the owner) |
| **Risk: D1 rows read** | 1.76B in 1.5 days (25B/month included, then $0.001/M). Mostly bulk loading, but the every-minute filings job likely rescans the download ledger even when idle → measure top queries, add indexes (to-do 1) |
| Download ledger (D135) | one row per URL; R2 write before "done"; market write-through; 875 final 404s, ~270 403s retrying; duplicates are identical empty API answers, not re-downloads |
| Results census (D134) | all 56,382 results files: old-GAAP aliases fire on 0 Ind AS / IF files; classes: 249 old bank-format files without period facts, 112 IF files with alias tag names (held), 3 exponent decimals (fixed), 4 odd periods (held) |
| Results + shareholding (M2) | 9,520 filings loaded (162,596 result values; 3,546 shareholding patterns), 51 held, 108 waiting for market identity |
| XBRL attachments (D128) | ≈ 164k downloaded, ≈ 50k queued (GitHub job) |
| Tests | 169 pass; consistency check passes (137 decisions, 270 entries) |

**Plan (D140, 2026-11-03 10:05 IST) — gate order, one item at a time:**
| # | Item | Gate it serves | Done when |
|---|---|---|---|
| 1 | ✅ **Review queue decided by Claude item by item** (owner #274, D141), 2 cycles, 10:15 IST: 203 of 240 decided (63 factors confirmed incl. TMPV demerger, 7 splits/consolidations; 124 closed as no adjustment); **37 open with reasons**: 9 ETF unit splits (price only, no second source), 9 Bc ratios contradicted by prices on the ex-date (moved/cancelled?), 13 without price/share data, 2 weak matches, QUINT (CCPS rights), 1 price-only move, 2 other. Phase 1: tests 1, 2, 3 pass; test 6 = these 37 | M1 tests 2 and 6 | Done for evidence available; the 37 need sources we don't hold |
| 2 | **Daily freshness** (built 10:45 IST): prefetch slots 20:30 + 07:30 IST — corporate actions date-range feed (verified complete: Sep 2026 485 = 485) → second source; shareholding date-range feed → XBRL queued; Integrated Filing feed is capped at 20 → dated per-company refresh (first live slot 10:15 IST: 69 actions, 4 shareholding XBRL, 130 companies refreshed, chain verified) for companies with a board-meeting outcome / results announcement; Sunday full sweep (misses shown in `/status`); attachments job scheduled 22:37 + 08:37 IST | M1 "10 sessions, no manual fix"; M2 | A filing / action published today is queued and loaded tomorrow without a hand step — verify on 4 Nov |
| 3 | **10 consecutive clean daily sessions** (from 2026-11-03): scheduled check weekdays 21:43 IST (also verifies item 2 live) — count: 1/10 (3 Nov) — check moved to 22:41 IST, after the 22:00 load | M1 | 10 sessions, no manual fix |
| 4 | Results reader classes — batch live 13:20 IST (deploy fixed after C35): quarter context explicit, no-period files excluded (103), alternative names only when the sums prove them, median-of-4 scale anchor. **Readable rate 99.66%** on 36.9k processed (36,747 loaded / 123 held / 1 failed; 103 excluded); BSE Ltd shareholding: 7 of 17 loaded, 10 pre-2024 held (no NSE share count before 2024 to confirm the sum); full population when the loader finishes | M2 (≥ 99.5% parse) | ≥ 99.5% on the whole population — re-measure when the backlog is loaded |
| 5 | M1 remainder: market-structure data (bulk/block deals, ASM/GSM) paths verified and loading | M1 | loading daily |
| 6 | M2 remainder: restatement/basis on known cases; PIT/SAST readers | M2 | tests on known cases pass |
| 7 | M3 site v0 | M3 | performance targets |

**Downloads for M0–M3 (D144) — status 2026-11-03 13:40 IST: all historical downloads done.**
| Download | State |
|---|---|
| XBRL attachments (results, Integrated Filing, shareholding, PIT, board meetings, governance, BRSR) | ✅ 214,858 done, 0 queued; 1,197 failed (mostly final 404s; 403s retried by the twice-daily job) |
| API lists for every company (results, IF, shareholding, PIT, SAST, board meetings, corporate actions, ratings, governance, annual reports, BRSR) | ✅ all done |
| Announcements (monthly 2024 → today) | ✅ done; daily from today |
| Market history (bhavcopy, PR bundle, delivery, index closes) | ✅ 2024 → 2 Nov; daily via the 19:07 IST archive run |
| Market structure: participant OI, F&O ban list, price bands (archive) | ✅ 2024 → today; daily |
| Bulk / block deals, short selling (API, 1 call/day, capped at 70 rows) | ✅ 2,226 days; complete bulk/block files daily from today |
| ASM, GSM, FII/DII (no history at NSE) | daily snapshots from today's evening slot |
| Corporate actions, second source (D138) | ✅ per-company lists + daily date-range feed |
| R2 compression (D147, never deletes) | running: 9,871 packed, 430 MB saved, 0 verify failures |
| **Full history for 20-row-capped lists (D149, C40)** — PIT, SAST, board meetings, corporate actions, credit ratings, governance, BRSR | queued 16:00 IST (≈ 8,200 calls) + their XBRL |
| Still to verify (no download yet): SAST Reg 31 endpoint; RPT data location; insider-feed completeness | open (§16) |

**Work list (D158, owner #321):** `docs/worklist.md` — M0–M3 line by line from the documents; Claude works it in order, owner reviews results.

**Two chats (owner #310):** this build chat may ask the planning chat (session "1.0 V2 planning and mechanism", holds the first-chat transcript) for inputs. Ownership: planning chat = `website.md`, `disclo-design-recovered.md`; build chat = code, migrations, deploys, PLAN data/build sections, HANDOVER, FMEA, field catalogue. Discussion log shared, append-only: pull right before writing, next free number, push at once; on a clash rebase and renumber only your own row.

**Focus (D155, owner #316):** filings load only for Nifty 50 + Next 50 + Midcap 150 (`FOCUS_INDICES` on disclo-filings; "ALL" widens); censuses still read every file.

**Widening checklist (D155, owner #318 — learnings first, then the wider universe):** (1) every M1/M2 gate verified on the 250; (2) re-run every census on all stored files (results/FY/BS-CF, line items, shareholding) — "0 newly failing" vs the last run; (3) each FMEA rule (C1–C49…) has its test and, where it applies, a census check; (4) widen in steps (`FOCUS_INDICES`: 250 → top 500 → ALL), repeating (2) and the count checks at each step; (5) write-budget projection before each step.

**Order now (D152, owner #300 — data first, website stopped):** (1) filings backlog speed + every downloaded file read; (2) FY figures (Q4 files carry them; reader takes the quarter only) + 5-year coverage per company vs NSE lists, top 1,000 (D90/D111); (3) ✅ event counts vs NSE: 29/29 match (3 Nov 20:25 IST; insider-trade date filters fall back to disclosure date); (4) ✅ M1 acceptance tests 4–5 **pass** (3 Nov 20:30 IST: staging re-run of 4 days 'unchanged', 0 data rows changed; staging rebuild from stored files identical to production on all 8 sessions × 5 tables, ≈ 78k rows; `/digest`, staging `POST /rerun`; C49 fixed on the way); left in this item: D138 corporate-action re-run, bulk-deal 70-cap; (5) held classes; (6) data-readiness map for every D91/D62/D67 element; then design mockups for owner approval (no UI code before).

**Pending by milestone (owner #284):**
- **M0 — signed off (D143).** Left: remove the probe's 3×/day schedule (≈ 4 Nov). Review screen (B5) moved to M3.
- **M1 — market data.** (1) 10 clean daily sessions: 0/10, checked weekdays 21:43 IST (non-blocking, D143). (2) **Load market-structure data into D1** (downloads done; readers not built): bulk/block/short (flag 70-row days), participant OI, ban list, price bands, ASM/GSM, FII/DII. (3) Phase 1 test 6: **queue empty** (UEL decided 15:40 IST as a series break, D146: insolvency resolution plan). Tests 1–3 pass. **Gap:** 480 of 704 bulk-deal history days hit the API's 70-row cap (flagged; complete daily files from 2026-11-03) — to test: splitting the history API by symbol. (2) loaders **built and live** (D148): history loading source by source (14:51 IST: F&O OI + ban complete, price bands 418/704; deals/short next; ≈ 1–2 h); progress in market `/status` → `market_structure` (days, missing, possibly-truncated).
- **M2 — filings & financials.** (1) Readable rate on the whole population (99.66% on 36.9k so far; loader finishing the backlog). (2) **Readers: PIT/SAST, credit ratings, board meetings** — built 16:30 IST (D149); loading as the full-history lists arrive (filings `/status` → `events`). (3) **Balance sheet + cash flow**: reader + loader live 15:50 IST (census of 74,571 files: balance sheet 99.79% pass after the held-for-sale fix, cash flow 99.94%); loader had stalled until 17:10 IST 3 Nov (C43, fixed); BS/CF values growing with the backlog, backfill of earlier filings starts when the backlog is cleared (filings `/status` → `bs_cf_values`, `bscf_backfill`). (4) **Restatement / basis rules on known cases — done 16:50 IST** (D48: earliest = original, later = restated, > 0.5% flagged, either load order; standalone vs consolidated stay separate series — real INFY Sep 2024 files). Existing 898 multi-filing periods relabelled by a one-off pass (filings `/status` → `restatements`). (5) **Sector map approved (#291, D150)**; classification job built: reads every stored announcement list (2024 →) from R2, records each ISIN × smIndustry, writes sector history (index CSV first); new values → `unmapped` on market `/sectors`. Finalise the map with the owner once the full value list is in. No V1 or BSE input (owner #294). (6) Held classes: ~40 scale-guard outliers (need a second source); ✅ "missing revenue+pat" = general insurers → template built (C44, 56/56 IRDAI files pass), 1 NBFC file left; **new class: Ind AS 117 insurer layout** (STARHEALTH Sep 2026, 5 files, more insurers likely to follow) — template to build when a second company files it; insurers' balance sheet not read yet; 10 pre-2024 BSE shareholding.
- **M3 — site v0 (building, D151 public unlisted).** `workers/web` (`disclo-web`): API `/api/v1/{dashboard,securities,stocks/:symbol,health}` with edge cache, per-IP rate limit (120/min), noindex on every response, robots disallow; React site: dashboard, stock page (adjusted chart, quarterly results with original vs restated and filing links, balance sheet, cash flow, shareholding, PIT, board meetings, ratings, corporate actions), data-health. **Taken offline 3 Nov evening (owner #301, D152):** workers.dev address + previews disabled, precompute stopped, SITE_OFFLINE=1 (503). Was live 18:16 IST at disclo-web.financialengineer-in.workers.dev. **Measured (from the cloud container, not India — network distance included):** stock API server time 290–560 ms uncached with a warm symbol map (≈ 1.2 s on a cold data centre), 0.19–0.41 s TTFB cached; dashboard 0.3 s (precomputed every 10 min into `app.site_cache`); emulated mid-range phone on 4G: largest content 0.75–0.82 s (one cold first load 2.08 s). Fixes on the way: shareholding index by company (every stock page scanned the table), one D1 batch per database per page, Smart Placement. Aligned with the agreed design 18:45 IST (#298): light theme (D100), chart logo off + credits notice (D105), restated default + Original/Restated switch, ISIN, 52-week range, section menu (D91), data-updated time in IST (D46/D114), legal pages as drafts (D115), EPS adjusted for later splits/bonuses, bank balance-sheet lines. **Left (agreed, not built):** dashboard EMA participation, 52-week extremes, results-season tracker, calendar (D62/D67; need precomputed history); stock page Key facts (valuation vs own history, growth vs trend, margins, ROE, net debt, pledge) and 5-year annual view (D91 §4, §6); collapsible sections on mobile (D91); source on hover/tap for every number (D91: period links only so far); measure from India; custom domain disclo.in (+ zone bot protection); owner review screen (B5). API Worker + public site: dashboard, stock page (market + financials sections), data-health page (incl. the review queue screen, B5); adjusted prices honour series breaks (D146); performance targets (TTFB ≤ 200 ms cached; stock page ≤ 2.0 s on 4G; API p95 ≤ 300/800 ms); noindex + rate limits.
- **Owner:** trademark check for Disclo (pending). ✅ email test working; ✅ Cloudflare budget alert $5 set (#285). ✅ sector map approved (#291).

**Storage (owner #278):** 0 PDFs; 24.4 GB raw XML/JSON, 11.7 GB in R2 (newer objects gzipped); keep originals and never delete them (owner #282); after compression ≈ 3 GB, ≈ +0.5 GB/year → ≈ 8 GB in 10 years (free tier 10 GB; beyond that ≈ $0.015/GB-month).
**V1 hints adopted later (D142, #276):** profit ÷ EPS implied share count as a split/bonus cross-check + no double adjustment when filings restate comparatives; owners vs minorities test; excise duty separate; filler zeros in annual-report XBRL. Stale-Bc rule (C28): multi-day and outside-window tests in place (3 Nov).
**Parked (counted, not chased, D140):** 16 stock jumps and ETF unit-split proposals → owner queue; scale-guard anchor class; R2 compression; probe schedule removal (≈ 4 Nov); Workers CPU check (≈ 5 Nov); D1 reads re-measure (≈ 5 Nov).
**Owner:** review-screen access choice (item 1); Budget Alert $5 (optional); trademark check; email test (last).

### Morning summary — 2026-11-03 06:00 IST
**Built and tested overnight (109 tests pass; CI green):**
- M0 foundations: npm-workspace monorepo, TypeScript, vitest, CI; 12 D1 databases (6 domains × production/staging) with migrations; building blocks B1–B5 (identity history, provenance, exact decimals, Indian FY labels, ₹ crore, ingestion framework, review queue).
- NSE readers: UDiFF bhavcopy, PR bundle (MCAP, Bc), corporate-action purposes (incl. dividends, REIT/InvIT distributions, debt service, misspellings), EQUITY_L, index lists, delivery, index closes.
- Market Worker on Cloudflare (`disclo-market`, `-staging`): gates, identity, prices, market cap, delivery, indices, corporate actions + factors (share-ratio vs Bc ±0.1%, Bc ratio pre-Feb-2024, TERP, demerger review), reviews, strict date order, maintenance pause, `/status`, `/acceptance`, `/reviews`.
- Prefetch (D128): archive history 2024→today in R2 (0 refusals from GitHub); NSE API lists for all 2,636 companies (31,656 jobs done); XBRL attachments: 76,500 downloaded (8.8 GB), ~28,000 still queued.
- M2 started: XBRL reader; canonical results for industrial, NBFC, bank and life-insurer templates with arithmetic checks (pass on INFY, TATASTEEL, RELIANCE, 20MICRONS, BAJFINANCE, HDFCBANK, SBILIFE).

**Data on Cloudflare now:** 569 sessions (2024-01-01 → 2026-04-17), 1.69M price rows, 375 automatic factors; Phase 1 tests 1 (BAJFINANCE 933.10) and 3 (MCAP to the rupee) **pass**; test 2 waits for the index snapshot; test 6 needs owner review (467 open items, being cleaned by parser fixes).

**Overrides of owner decisions (all logged):** D124 (2 parallel from Cloudflare), D125 (row-level gate tolerance + new-symbol extension), D129 (share-count review threshold).
**New owner decisions overnight:** D127 (store everything about stocks; clarified #257: no bonds), D128 (front-load downloads), D130 (compact storage).
**Incidents (fixed, no data lost, nothing public):** duplicate securities from out-of-order retries; review floods from bond purposes; PII in a public CI log (deleted in minutes); several Cloudflare/NSE quirks (Appendix B).

**Owner to do:** nothing blocking. Optional: free Gemini AI Studio key for later prompt trials (not needed yet); review queue once the review screen exists (M3); trademark check for Disclo; email test last.
**Decided (D132):** as-filed XBRL facts kept in R2 (gzip), canonical lines in D1.

**Plan for today:** (1) ✅ D130 compact storage + no bonds + gate extension deployed 06:40 IST; reload from R2 running; (2) first index snapshot → Phase 1 test 2; (3) market cron back to every 10 min; (4) shareholding reader; load canonical results from R2 into `filings`; (5) remove the probe schedule (≈ 4 Nov).

### Build state (updated 2026-11-03 03:55 IST)
**Running on Cloudflare (production unless noted):**
- `disclo-market` (cron every 2 min) + `disclo-market-staging` (every 10 min, recent dates only): daily market job. Status: `https://disclo-market.financialengineer-in.workers.dev/status`, `/acceptance` (Phase 1 checks), `/reviews`.
- `disclo-prefetch` (cron every minute): raw NSE API lists for every company → R2 `api/…`; discovers XBRL attachments; `/status`.
- GitHub `prefetch-archive` (done: 2,995 archive files 2024→today in R2 `cache/`), `prefetch-attachments` (running: XBRL → R2 `att/` via `/ingest`).
**Databases:** 12 D1 (6 domains × prod/staging), migrations in `db/migrations/<domain>`, applied by `db.yml` / `deploy-market.yml`.
**Key rules added tonight:** D125 (row-level gate tolerance), D126 (fund units out of universe), D127 (store everything), D128 (front-load downloads), D129 (share-count review threshold), D124 adjusted (2 parallel from Cloudflare).
**Known NSE quirks handled:** 403 for some missing files; PR bundle under the wrong date (PR060424 = 4 Jun files); ETFs in EQ series; bond purposes in Bc; truncated purpose text.
**Maintenance:** to reset market data, first apply a pause migration (`INSERT … job_lock 'paused'`), confirm `/status` shows no `running_lock`, then the wipe migration (which lifts the pause). Never deploy the market worker during a long backfill unless needed (a deploy interrupts the current run; it resumes safely).

### Read first, in this order
1. `docs/PLAN.md`: the consolidated design. Decisions D1–D137 are in Appendix A; live NSE evidence is in Appendix B.
2. `docs/discussion-log.md`: every owner statement (#1–#227), mapped to where it's recorded, plus open items.
3. `docs/field-catalogue.md`: query fields (v1).
4. `docs/setup-guide.md`: owner's Cloudflare/GoDaddy/GitHub setup steps.

### Working rules (owner's instructions)
- **Build started 2026-11-03 (D122):** owner said "Build". M0 → M1 in §14 order. Overrides of owner decisions are allowed "for better" but always logged and reported; money/time/legal items are asked.
- **Clean-slate rule:** never use or reference V1 code, data, outputs or designs. *Single exception below.*
- **Never delete anything already downloaded (D147, owner #282):** no expiry or pruning of R2 originals; compression only after a byte-exact verify.
- **Downloads always run ahead of need (D144, owner #278 — remember this):** whenever a source a later milestone needs is not downloading, verify its path and start it now, one at a time, in milestone order; keep the pending-downloads list below current at every hourly update.
- **When stuck, ask V1 (D142, owner #275 — remember this):** if an item reaches the D140 limit (two cycles) or ideas run out, write a short prompt for V1 (methods/sources, not code); the owner relays it and pastes the answer; Claude validates it on V2 data and adopts or rejects it, recording why. Full freedom on the decision.
- Log **every** owner statement in `docs/discussion-log.md` **in the same turn**; record decisions in `PLAN.md` Appendix A **and** the design sections.
- Run the consistency check after every update (procedure at the end of the discussion log) and report the result.
- **Public CI logs:** this repo is public, so Actions logs are public. Never print `wrangler whoami`/account names/emails unmasked (see `infra-check.yml` mask).
- Ask the owner wherever a decision is theirs; stress-test ideas before agreeing; never put secrets or personal emails in the public repo.

### State of setup
- Domain **`disclo.in`** on Cloudflare (active; DNS cleaned). **Workers Paid active from 2026-11-03.** The public launch name may still change (D99).
- Email Routing: `info@`, `alerts@`, `paresh@disclo.in` → owner's Gmail. **Test email working (owner #285).**
- Workers subdomain `financialengineer-in.workers.dev`. GitHub secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` set.
- `.github/workflows/probe.yml`: deploys, calls and deletes an NSE probe Worker (Cloudflare reachability only; quote-equity/BSE checks removed #240). Runs manually + 3×/day. **Turn the schedule off after ~2 days** of consistent results.
- **Probe result:** all pipeline NSE sources reachable from Cloudflare; only `quote-equity` (sector classification) is 403 → D8 (owner's machine) stands; the D54 relay isn't needed.

### Open items for next chat
1. ~~Sector classification~~ **Decided D121 (#239): NSE index CSV sector + announcement `smIndustry` fill (accepted #240).** *History:* quote-equity from GitHub: the owner says it worked in repo **`hipareshpatel/Insiders`** (V1). **Owner permits reading ONLY the code that fetches NSE `quote-equity`/sector classification, to learn the method (library/endpoint/headers). Do not read, use or reference anything else in that repo.** If it works, D8 can move to a GitHub scheduled job. **Done 2026-11-02 (#228):** method recorded in PLAN Appendix B; replicated from our runner (#230): **403**, homepage too (IP-range block). V1's own run was also 403 (#231). **Owner chose BSE `ComHeadernew` (D120, provisional)**; BSE also **403 from GitHub and Cloudflare** → owner's machine either way; owner to decide machine run, taxonomy, NSE-only fallback.
2. ~~Extend the probe to structured-filing endpoints~~ **Done (#234): all 200 from Cloudflare.** Rate limits at volume to measure in M0.
3. Review scheduled probe runs; then remove the schedule.
4. Field catalogue approved (D123). Owner: trademark check for **Disclo** (final name, #239); email test last.
5. ~~Provisional decisions D38, D39~~ **confirmed (#236)**; unlisted entities get no public pages at launch (#238). Unresolved: licence funding (D88 option D chosen; vendor quotes recommended).
6. Card sections after real output (D25). Then, on the owner's "build", start **M0**.
<!-- END docs/HANDOVER.md -->

# Part 2 — Work list (what to do next, in order)

<!-- BEGIN docs/worklist.md -->
## Work list — full trace of the documents (owner #321, rebuilt #323)

**Rule (D158):** Claude works this list in order without waiting for instructions; the owner is asked only for owner decisions (money, legal, design, trademark). Scope now: **freeze and prove** M0–M3 for the 250 focus companies (D155), no more stock history (D156/D158). **Rebuilt (owner #323: "D158 missing many items, check all the documentation"):** every decision D1–D158 has a row below (milestone, status, next action), plus §5.8, §6, §9.1, §10, §11, the field catalogue, `website.md` §10–§11 and open FMEA items, so an item can't drop out unnoticed (checked mechanically: every D-number appears).

Legend: ✅ done + verified · 🔶 in progress / partly · ⬜ not started · 👤 owner's decision · ⏭ later milestone (listed so it isn't lost)

### A. Active scope — M0–M3 (order: A1 ops gaps → A2 M1 → A3 M2 → A4 M3 data prerequisites)

#### A1. Foundations, operations, cost (M0 / §10 / §11)
| Ref | Item | Status | Next action |
|---|---|---|---|
| D11, D14, D97 | Storage split; public repo; docs only in `docs/`; no data or secrets in git | ✅ | — |
| D12 | TypeScript everywhere | ✅ (prefetch helpers are Python on GitHub runners) | — |
| D43 | Staging D1/R2 | ✅ (staging DBs + bucket; used by Phase 1 test 4) | — |
| **D44** | **Backups: D1 Time Travel 30 days + weekly export to R2 kept 12 weeks; full rebuild from raw tested** | 🔶 Built + tested 3 Nov (all 6 databases → R2 `backups/slot-NN/`, 12 rotating weekly slots); **schedule off until the data is frozen and OK** (owner #324). Note: an export briefly blocks other queries on that database (a census request failed during it) | Switch the Sunday schedule on at freeze |
| **D45** | **Owner alerts by email: pipeline stalled > 1 h, Gemini spend > 80%, dead-letter item, NSE error spike** | 🔶 only the daily cost guard (GitHub email); 15-minute check-ins cover it during the build | Build at freeze, with the backup schedule (owner #324 logic) |
| D79 | Occasional downtime acceptable; freshness shows staleness | ✅ | — |
| D96 | Owner review ≤ 30 min/day | ✅ (D141) | — |
| D116 | Email routing info@ / alerts@ / paresh@ | ✅ tested (#285) | — |
| §10 | Secrets in Cloudflare/GitHub, `.dev.vars` ignored | ✅ | — |
| D18, §11 | $100/month; hard Gemini daily cap in code | ⏭ M5 (no AI before freeze) | — |
| D136, D137, D154, D164, D166 | Write caps: Nov 2026 soft 60M / hard 68M, then 54M (D166); $10 ceiling ($25 for Nov 2026, D166); daily cost guard | ✅ | Projection at each check-in |
| D130, D131, D132, D135, D147 | Compact storage; gzip; as-filed XBRL in R2; one ledger; never delete | ✅ (compression: 0 verify failures) | — |
| D124, D128, D144 | Fast archive pace; downloads ahead of need | ✅ (index history 🔶) | — |
| D133, D134, D140, D142, D158 | V1 lessons as rules; census first; one item at a time; V1 when stuck; this list | ✅ in use | — |
| §16 | Remove the probe's 3×/day schedule | ✅ removed 4 Nov (prefetch slots prove reachability daily) | — |
| C18 | D1 rows-read re-measure; Workers CPU check | ⬜ ≈ 5 Nov | Measure |

#### A2. M1 — market data (§14 gate; §9.1; §9.2)
| Ref | Item | Status | Next action |
|---|---|---|---|
| D1, D2, D3, D10 | NSE archive; 2024 →; UDiFF; daily job | ✅ | — |
| D4, D126, D127 | Universe EQ/BE/BZ, no SME, no fund units; store everything | ✅ | — |
| D5 | Market cap as published (exact; shown ₹ cr, no decimals) | ✅ stored | Display rule → data map |
| D6, D138, D139 | Factors from share counts; second official source; rights entitlements / ETF splits | ✅ (test 2: 0 unexplained jumps) | — |
| D7 | Dividends recorded, not adjusted | ✅ | — |
| D9 | Index membership history from go-live | ✅ daily | — |
| D62 | FII/DII history from go-live | ✅ from 3 Nov | — |
| D65 | Delivery file | ✅ `/gaps` = 0 | — |
| D76, D148 | Market structure loaded from R2 with a day ledger | ✅ | — |
| 1.8 | Bulk/block history capped at 70 rows on 480 of 704 days | 🔶 csv=true uncapped; windows queued; refill live | Verify refilled days |
| D125, D129, §9.1 | Market gates | ✅ code + tests | — |
| D141 | Review queue decided with evidence | ✅ empty | — |
| **D146** | Series breaks | ⏭ all known cases are outside the 250 (SPENTEX, MELSTAR, Tata Coffee…) | At widening |
| §9.2 | Phase 1 tests 1–6 | ✅ all six | Re-run at freeze |
| §14 | 10 consecutive clean sessions | 🔶 counting | Daily |
| D156 | Index history 2016–2023 | ✅ 2,086 weekdays + 5 weekend sessions, 165k rows, Nifty 50 every day, closes = NSE (4 Jan 2016, 23 Mar 2020, 29 Dec 2023) | — |
| C28 | Stale-Bc multi-day test | ✅ 3 Nov: multi-day test existed (6 Jun stale factor removed when the 16 Jun split applies); added the negative case (a same-ratio factor 27 days earlier is left alone) | — |

#### A3. M2 — filings and financials (§14 gate; scope = the 250, D155)
| Ref | Item | Status | Next action |
|---|---|---|---|
| D28, D56, D149 | PIT, SAST Reg 29, pledges (shareholding), full history | ✅ 29/29 vs NSE | — |
| D32 | `period` + `disclosed_at` on every fact | ✅ | — |
| D47, D132 | As filed (R2) → canonical → computed views | ✅ first two; computed ⬜ (A4) | — |
| D48 | Restatements versioned, > 0.5% flagged | ✅ | — |
| **D50, D51** | **Primary basis per company** (consolidated most, standalone banks, both for holding cos); **basis switch → series break**; basis on every number | 🔶 built (`basis.ts`, daily, 25 companies/run): banks standalone, holding cos = standalone income < 20% of consolidated, breaks only where NSE lists no consolidated filing | Review the 'both' list (Eternal borderline); fix coverage gaps; then breaks are real |
| D76 | Integrated Filing primary; ratings structured | ✅ | — |
| D90, D168, D169 | Statements for the 250 — **required from 2024-01-01** (D168; was 5 years) | 🔶 405 gaps classified (4 Nov 13:13 IST); after the floor **39 active gaps in 16 companies** (366 out of scope); renamed-symbol class fixed (C59); half-year-only files (D169) built | fix the remaining classes from 2024-01-01: 404s, scale-guard holds, insurer / Siemens layouts, BAJAJ-AUTO retry |
| §14 | ≥ 99.5% parse + identity checks | 🔶 99.66% (part) | Measure on the 250 |
| D90 FY | Full-year figures | ✅ census 99.68% | Re-measure on the 250 |
| D154, D167 | Every reported line, three statements | 🔶 BS 99.58%, CF 95.81% (0 newly failing); untagged CF adjustments: option (a) decided (D167) — build after its census; totals vs Screener 189/255 (rest = Screener conventions/errors, #332) | owner a/b on untagged adjustments; 17 direct-method; bank/NBFC/insurer maps |
| **D157** | Heads with sub-rows (Schedule III layout per format) | 🔶 industrial, NBFC P&L, bank, life and general insurer P&L built 5 Nov (item 5 row in Part 1 has the checks and gaps); first built: `packages/core/src/layout.ts` — P&L, balance sheet and cash-flow trees of the stored lines, `layoutStatement` (filed values only; an unfiled head shows its filed sub-rows, no sum), `derivedPl` (operating profit, OPM % — computed when shown, labelled, never stored); read-only `/statement?symbol=&period=&basis=&kind=` to check on real data. ProwessIQ used only as a cross-check (CMIE's classification is theirs; the tree follows the public Schedule III format and the filers' tag names) | Next: bank / insurer cash-flow detail; insurer balance sheet; NBFC revenue lines other than interest and fees; website wiring is Part 4 (website chat) |
| D121, D150 | Sector | ✅ | Confirm all 250 have one |
| 2.8 | Shareholding coverage + counts vs NSE (250) | ✅ 2,820 of 2,824 from 2024-01-01 loaded (5 Nov); 9 missing + 3 companies without a list noted (Part 1) | — |
| 2.10 | Credit ratings vs NSE by month | ⬜ | Small endpoint + check |
| **D40** | **Promoter-group structures from shareholding** | ⬜ | Derive per company |
| D47 | Segment results | ⬜ | Census + reader (stock page "segments") |
| D145 | Old bank files without period excluded | ✅ | — |
| 2.12 | Held classes (Ind AS 117 insurers, insurer BS, BSE Ltd pre-2024 SHP, 58 FY failures, CONSOFINVT, scale-guard holds) | 🔶 | Class by class for the 250 |
| 16.3–16.6 | Reg 31, RPT, insider completeness, BRSR employees | ✅ located (readers ⏭ M9) | — |

#### A4. M3 — before any site work (D152): computed views + data map
| Ref | Item | Status | Next action |
|---|---|---|---|
| **D49** | EBITDA excludes other income; company EBITDA alongside | ⬜ | Computed views |
| **D52** | Ratio conventions (adjusted ex exceptional, TTM, ROE/ROCE on average capital) | ✅ 5 Nov: functions (`views.ts`) + stored in the feature table for the 250 (D171) | Valuation fields with market cap |
| D66 | Catalogue conventions (rising trend, large order ≥ 2% TTM revenue) | 🔶 functions built 5 Nov (`trend`, `isLargeOrder`); not yet stored (needs series fields and order events) | With the query builder (D64) |
| §5.8, §6 | **Feature table** + nightly derived job (adjusted series, dashboard snapshots, trackers) | 🔶 5 Nov: financial fields for the 250 (≈ 92k values, kept current by the filings cron) | Price, valuation, technical and event fields |
| D170, #350 | **TTM kept (owner #350)** as a computed view: TTM = sum of the four latest **filed** quarters (each from its own 3-month column), same basis, computed from filed quarters, **never stored in `fin_value`** (stored only in the feature table, D171, owner #358); if any of the four is missing (e.g. a half-year filer with no 3-month column) TTM is unavailable — no substitute (no FY + YTD − prior YTD, no estimate). Used by D38, D52, D66 and the feature columns `pe_ttm`, `ev_ebitda_ttm`, `revenue_ttm_yoy`, `pat_ttm_yoy`, `order_inflow_ttm_cr` | ⬜ | Build with the computed views (item 6) |
| D123, field catalogue | 114 fields (§2–§14 public, §15 owner-only ⏭) | ⬜ readiness per field unknown | **Data-readiness map**: field → source, computed?, verified |
| D59, D62, D67 | Dashboard (indices + valuation vs history, breadth, sectors, FII/DII, results season, calendar, search) | 🔶 v0 part (offline) | Data map; nightly precompute |
| D91, D92 | Stock page sections 0–13 | 🔶 v0 part | Data map (sections 1–2 need AI ⏭ M6) |
| D93, D94, D108, D110 | One API; milestones; aggregated cached endpoints; scale on Cloudflare | 🔶 v0 API (offline) | Redesign with the data map |
| D13, D58, D118 | Owner routes behind Access; `disclo.in` on the site | ⬜ | Site phase |
| D60, D63 | Accounts, Google sign-in | ⬜ | Site phase |
| D98 | Cloudflare Web Analytics | ⬜ | Site phase |
| D104 | Search (companies ✅ v0; people, investors, products, plants, full text ⏭) | 🔶 | — |
| D106, D107 | Exports owner-only; deletion/export on request | ⬜ | Site phase |
| D115 | Legal pages | 🔶 drafts (v0) | Legal consult |
| D117 | Security headers + secure cookies | 🔶 partial | HSTS, CSP, frame-ancestors, Permissions-Policy |
| D35, B5 | Owner correction / review screen | ⬜ | Site phase |
| D46, D114 | Freshness in IST; UTC stored | ✅ (v0) | — |
| D100–D103, D105 | Light theme; mobile-first; basic accessibility; English; charts with notice | ✅ (v0) | — |
| D95, D153 | UX standards; design brief for the audience | 👤 | After the data map |

### B. Later milestones (⏭, listed so nothing is lost)
| Ref | Item | Milestone |
|---|---|---|
| D15, D16, D26, D27, D30, D41 | Gemini pinned models; ≤ 15 min cards; triage lanes; zero misses; weekly triage audit; prompt-injection defence | M5–M6 |
| D17 | PDFs not stored long-term (URL + hash + page text) | M5 |
| D20, D84 | Gold set (owner labels); private period | M4 |
| D21, D22, D25, D29, D38, D42, D80, D82, D92 | Cards: no score, clean site, layered + shareable, insider thresholds, one-hop links, error reports; AI write-ups; commissioning estimates; latest quarter in brief | M6 |
| D24 | Prices public before a licence (owner's risk) | decided |
| D31 | KPI dictionary + sector packs (financial packs from day 1) | M6 |
| D33, D34, D39 | Commitment tracking; lifecycle; unlisted counterparties | M6 / M9 |
| D36 | Scope exclusions | decided |
| D37, D70, D72, D74, D75, D77, D78, D81, D83 | Graph; business mix; raw materials; annual-report scope; niche indices; plants; trackers; rated facilities; facility sources | M9 |
| D53, D68, D73 | Owner-only signals, research chat, scenarios | M10 |
| D55, D57, D111, D112, D113 | Phase 2 backfill; Nifty Next 50; coverage tiers; usefulness sample | M6–M11 |
| D61, D64 | Query builder | M8 |
| D69 | Differentiators | M8–M9 |
| D71 | BRSR ingestion | M9 |
| D85, D86 | Error detectors per class (unit detector partly live: scale guard); daily random card audit | M6 |
| D19 | Commodity prices | later |
| D23, D88 | Paid tier; licence before charging | later |

### C. Owner and legal
| Ref | Item | Status |
|---|---|---|
| D87, D88, D89, D151, D152 | Regulatory posture; licence funding; launch mode | 👤 decided; NSE data owner-managed |
| §12 | Legal consult questions 1–14 | 👤 before public launch |
| D99, D118, D119 | Name final; trademark check (IP India, classes 36/42) | 👤 trademark pending |
| D153 | Earlier design discussion — not in any record | 👤 restate at design time |
| D8, D54, D109, D120, D122, D143, D155, D156 | Superseded or one-time decisions (quote-equity sector, relay, hosting, BSE source, build start, M0 sign-off, focus, history windows) | ✅ recorded |

### D. Open failure modes (FMEA)
| Ref | Open part |
|---|---|
| C28 | ✅ closed 3 Nov (multi-day + outside-window tests) |
| C44 | Insurer balance sheets not read; Ind AS 117 layout |
| C45 | Remaining scale-guard holds (recheck at freeze) |
| C46 | EXPLAIN QUERY PLAN check for every new read path (site phase) |

### E. Website brief (`docs/website.md`, owned by the planning chat)
§10 (pending), §10b–§10c (accepted items), §11 (conflicts): design inputs, layering, card sections, coverage-depth display, launch checklist — folded into A4 and C; the brief stays the source.

### Added 2026-11-04 (owner #340: audit P0/P1)
| Item | Status | Next |
|---|---|---|
| P0 stop the bleeding (D163, C57) | ✅ deployed 10:47 IST, old hot queries stopped (11:14 IST analytics) | re-measure reads per hour after 24 h; owner: add GitHub secret `STATUS_TOKEN` |
| P1 realignment (D163, D165, D166): one-offs out of crons, checkpoints, failure isolation, run budget + lock, daily SAST/board/ratings, R2/script leaks, dead PIT path | ✅ deployed 11:44 IST, cursors moving (11:46 IST) | first daily slot with SAST/board/ratings: 20:30 IST |
| D160 browser-session headers + cookie re-warm (prefetch Worker + GitHub scripts) | 🔶 built (with P1) | watch refusals/re-warms in the prefetch log |
| Deals CSV refill (1.8) | ⏸ paused by P1 (one-off) | start with `ops` → market `/maint/deals_refill` |
| D162 `fin_value` key without `version` | ⏭ deferred | after reads are stable |
| Re-run the remark and version passes once, bounded (now indexed) | ⬜ | P1 |

### Added 2026-11-04 (owner #333)
| Item | Status | Next |
|---|---|---|
| NSE inventory + daily-workflow evidence: every dataset we take from NSE (endpoint/file, history range, daily workflow) and, per feed, proof the daily update ran and the newest row is recent | 🔶 freshness per feed ✅ (`feed_fresh` + `/fresh`, 4 Nov 12:53 IST: no stale feed) | inventory table (endpoint → history → daily workflow) |
| C53 insider trades from `corporates-pit-gg` (3 May 2026 →) | ✅ count check: 3,298 filings loaded = 3,298 files (4 Nov 12:53 IST); freshness rule live | first daily-queued XBRL after the 20:30 IST slot |
<!-- END docs/worklist.md -->

# Part 3 — Plan: product, architecture, data, AI, quality, operations, budget, legal, milestones, decisions

<!-- BEGIN docs/PLAN.md -->
## Insider V2 — Plan (consolidated)

**Status:** Draft for owner review. Consolidated on 2026-11-02; design sections reflect decisions **D1–D158** (Appendix A). All documents live in `docs/`: this plan, `discussion-log.md`, `field-catalogue.md`, `FMEA.md` (failure modes, #263), `probe-usage.md`, `setup-guide.md` (owner's step-by-step setup: Cloudflare, GoDaddy nameservers, email routing, probe). **Next chat starts with `docs/HANDOVER.md`; the work list is `docs/worklist.md` (D158).**
Build started 2026-11-03 (D122). `probe/` is a throwaway Worker for testing NSE reachability from Cloudflare.

**Working agreement:** this is a discussion phase. No production code is written until the owner says so. Claude asks for the owner's input wherever a decision is theirs, records every decision here, and flags anything it can't verify.

**Record-keeping:** `docs/discussion-log.md` logs **every owner statement** (not only decisions), mapped to where it's recorded here. It is updated in the same turn as each discussion message.

**How to read this:** §1–§15 describe the design as it stands. Appendix A is the decision log (each decision with its ID). Appendix B is the evidence from live NSE checks.
If the design text and Appendix A ever disagree, Appendix A wins and the design text gets fixed.

---

### 1. Product summary

**What:** an Indian equity research site built **only from primary sources** (NSE data and company filings), with every number traceable to its filing.
- **Market data:** prices, market cap, corporate actions, indices, delivery, breadth.
- **Filings intelligence:** announcements → verified facts → per-stock memory → cards, within ~15 minutes of filing.
- **Structured filings:** financial statements (XBRL), shareholding, insider/takeover disclosures, BRSR, governance, credit ratings.
- **Research tools:** dashboard, sector/industry pages, query builder, trackers, relationship graph, plant registry, forensic and timeliness panels.

**Platform & design:** web only, mobile-first, light theme, English only (D100, D101, D103); accessibility formal target later (D102); usage analytics (D98); name **Disclo**, `disclo.in` (D99).

**Bar:** best in class and a benchmark for others (D95), measured by the quality gate and performance targets (§14) and UX standards (§16).

**Who:** retail investors **and** institutions/family offices (D25). Layered depth: quick summary first, full sources one click away.

**Scope and phasing:**
- **Market data** covers the full EQ/BE/BZ universe from the start (no SME).
- **AI coverage universe (D111, D112):** Nifty 50 full depth first; then top 1,000 at light depth; then +100/month; > ₹500 cr in / < ₹300 cr out (3-month average). Market data: all stocks.
- **Hosting:** start on Cloudflare; migrate only on measured triggers (D110).
- **AI processing** starts with **Nifty 50** as the proof of concept, then Nifty Next 50, then other indices, then the full universe (D4, D57).
- Everything is designed for the full universe. Growth needs budget and configuration, not redesign.

**Hard constraints:**
- **$100/month** total running cost (D18).
- **Gemini paid tier only** (D15).
- **No score/rating/positive-negative labels on cards** (D21). Judgement appears only in clearly labelled AI analysis write-ups (D80), behind Access until the legal consult.
- Public launch only after a legal consult (§12).
- **Clean-slate rule:** V2 is designed from first principles. No code, data, outputs, schemas or designs from any earlier version are used or referenced.

**Not in scope:** consensus estimates (D36), intraday/live data, buy/sell recommendations, public predictions.
**Later:** commodity prices / raw-material price tracking (D19), news, rating rationales, BSE-only filings (D36), MCA charges, AMFI MF holdings, RBI data (D76), FDA databases (warning letters, import alerts), news-driven events (D77), macro indicators, social-media trends, CEO/media interview tracking, **Nifty 50 history before go-live rebuilt from NSE index-change announcements** (optional; until then, index analysis before go-live has survivorship bias).
**Rejected for now:** "result quality" / "management sentiment" scores (conflict with D21).

---

### 2. Principles & guardrails

1. **Every record has a stable ID, a source and a timestamp from day 1**, so links can be *added* later without rework. Links are *populated* only once the layer below them is accurate.
2. **Two dates on every fact:** `period` (what it's about) and `disclosed_at` (when the market learned it) (D32). Nothing is overwritten; corrections create versions. This enables the time machine (D69) and honest backtests (D53).
3. **Numbers come from code, never from the LLM's arithmetic.** XBRL is the primary numeric source. PDF tables pass accounting-identity checks (D48). Growth, margins and ratios are computed in code.
4. **Facts and opinions are stored separately.** LLM analysis is never an input to fact extraction (§7.3).
5. **Every fact quotes its source** (verbatim quote + page). Code verifies that the quote exists, or the fact is rejected.
6. **Period & unit discipline:** fiscal year is per company (most are Apr–Mar, but not all), quarters are normalised to Indian FY labels (Q1 FY26 = Apr–Jun 2025), and units (₹ crore/lakh/million) are normalised to ₹.
7. **Basis discipline:** consolidated/standalone is part of every value's identity. Mixing bases in a comparison is rejected by code (D50, D51).
8. **Never guess:** unnamed or only-hinted counterparties stay as text (D39); undefined ratios are null with a reason, never sentinel values (D52); estimates are labelled "estimate" (D72, D77).
9. **Explicit links only** in the relationship graph (D37). The single exception is labelled industry-default raw materials (D72).
10. **Cards and data are factual.** Judgement appears only in labelled AI write-ups (D80, legal blocker before public). Predictions, scenarios/estimates and pre-announcement trading timing are **owner-only** (D53, D68, D73, D69, D82).
11. **Nothing is lost silently.** Every announcement gets a timeline row. Triage misses are measured (D26, D27, D30).

---

### 2a. Building blocks & feature groups

**Purpose:** many features share the same machinery. Each building block below is built **once**, and every feature uses it, so nothing gets re-done when a feature is added.
**Rule for the build:** a feature may only be started once the blocks it depends on exist. New features should need *configuration* (fields, rules, templates), not new plumbing.

#### Building blocks
| ID | Block | What it provides | Decisions |
|---|---|---|---|
| **B1** | **Identity & lifecycle** | `security_id`, identifier history (symbol/ISIN), graph entity per security, demerger/merger/rename handling | D34, §5.1 |
| **B2** | **Provenance & time** | Every value: source filing, page, quote, `period`, `disclosed_at`, version (original/restated/corrected), extractor/model version | D32, D35, D48 |
| **B3** | **Normalisers** | Fiscal year per company, Indian FY quarter labels, units, **basis** (consolidated/standalone) tagging | D50, D51, §2 |
| **B4** | **Ingestion framework** | Fetch → raw to R2 → hash → schema check → parse → validate → idempotent load → run log → retry/catch-up → revised-file detection. One framework for **every** NSE source | D10, D17, §6 |
| **B5** | **Review-queue framework** | One generic queue + owner screen for: corporate actions, entity resolution, demergers, triage audit, BRSR plant-count mismatch, unmatched KPIs, Bc unparsed text, public error reports, owner corrections | D6, D27, D35, D42, D77 |
| **B6** | **Event & timeline model** | Announcement → event grouping (intimation → outcome → results → presentation → concall); timeline row for every item | D26, §5.4 |
| **B7** | **LLM gateway** | Gemini tiers (Standard/Flex/Batch), pinned models, prompt caching, cost ledger + daily caps, strict output schemas, injection defence | D15, D18, D41 |
| **B8** | **Verification library** | Quote check, accounting identities, XBRL cross-check, basis-mix rejection, restatement detection | D41, D48, D51 |
| **B9** | **Canonical models & taxonomies** | Canonical financial line items (4 templates), KPI dictionary + sector packs, **NIC** products, business-line taxonomy, region/country list, industry-default inputs (labelled), claim types, commitment states | D31, D33, D47, D70, D72 |
| **B10** | **Graph** | Entities (companies, persons, investors, promoter groups, plants, products, commodities, govt bodies), aliases, explicit relations with origin | D37–D40, D67, D77 |
| **B11** | **Derived-metrics engine** | TTM, adjusted vs reported, ratios, series functions, trend, margin recovery/erosion, per-employee and per-tonne metrics, adjusted prices | D49, D52, D66 |
| **B12** | **Feature table + query language** | One row per stock + compact series; one validated query language; parameterised SQL | D64, `docs/field-catalogue.md` (approved v1, D123) |
| **B13** | **Diff engine** | Compare a thing with its previous version: filing vs prior equivalent, dossier vs last visit, screen vs last run, comparatives vs originals | D48, D64, D69 |
| **B14** | **Access tiers & caching** | Public / signed-in / owner-only routes; caching rules (owner data never cached publicly); rate limits | D53, D60, D63 |
| **B15** | **Estimate & scenario engine** | Owner-only, always labelled: scenario calculator, event impact, mix-drag, plant revenue share estimates, predictions | D53, D73, D77, D78 |
| **B16** | **Outcome ledger & backtest harness** | Point-in-time evaluation of signals vs actual results; naive-baseline comparison | D53 |
| **B17** | **Gold set & evaluation harness** | Labelled cases, metrics, staging regression gate | D20, D43 |

#### Feature groups → blocks they depend on
| Group | Features | Depends on |
|---|---|---|
| **G1 Market data** | Prices, CA adjustment, market cap, delivery, indices, breadth, market structure, bulk/block deals, FII/DII | B1, B2, B4, B5, B11 |
| **G2 Financial statements** | Canonical P&L/BS/CF, restatements, basis, ratios, segments, geography, customers | B1–B5, B8, B9, B11 |
| **G3 Ownership & insiders** | Shareholding, pledges, PIT, SAST, tracked investors, promoter groups, trading-window flags | B1, B2, B4, B10, B11 |
| **G4 Announcements → cards** | Triage, extraction, verification, context, cards, memory-only items, concall audio, rated-facility amounts (D81), AI analysis write-ups (D80) | B2–B8, B9, B10 |
| **G5 Memory & credibility** | Dossier, guidance/commitments, credibility ledger, commentary map, disclosure regression, concall metrics | B2, B6, B9, B10, B13 |
| **G6 Business exposure** | NIC product mix, exports/geography, customers, raw materials, plants & capacity, location filters, commissioning watch (D82) | B9, B10, B11 |
| **G7 Governance & forensics** | Governance fields, disclosure timeliness, forensic panel, BRSR forensics, unexplained moves, ASM/GSM, red flags, bank-statement discrepancies (D83) | B2, B4, B11, B13 |
| **G8 Discovery tools** | Query builder, trackers, sector pages, dashboard, niche indices, baskets, peer comparison, returns vs indices, keyword scans, alerts, X-ray, **search incl. full-text of filings (D104)**, stock page (D91, D92) | B11, B12, B13, B14 |
| **G9 Owner-only analytics** | Signals, outcome ledger, predictions, scenarios, event impact, mix-drag, pre-announcement trading, research chat | B12, B14, B15, B16 |
| **G10 Platform & ops** | Accounts, staging, backups, alerts, freshness, correction screen, data health, cost dashboard, error detectors (D85), daily card audit (D86), launch gate (D84), availability policy (D79), analytics (D98), exports (D106), user-data requests (D107), owner review budget (D96) | B5, B7, B14, B17 |

#### Schema rules fixed on day 1 (expensive to add later)
Every stored value carries: `security_id`/`entity_id` · `period` · `disclosed_at` · `basis` (where applicable) · `version` + `supersedes` · `source` (filing id, page, quote or XBRL tag) · `origin` (reported / computed / extracted / industry_default / estimate) · `access` (public / signed_in / owner) · `extractor_version` / `model`.
Features built later should only *read* these fields, never require them to be added.

---

### 3. Architecture & stack

**All on Cloudflare, TypeScript** (D12). GitHub Actions is used for CI only.

| Piece | Product |
|---|---|
| Schedules (market data 22:00 IST daily; announcement poll every 2–5 min; structured-filing polls) | Workers **Cron Triggers** |
| Job pipeline (triage → extract → verify → context → analyse → commit), retries, dead-letter | **Queues** |
| Structured data | **D1**, split by domain (§5) |
| Raw files, per-page text, short-lived PDFs, backups | **R2** |
| Semantic search over unstructured commentary | **Vectorize** |
| API | Hono Worker, `/api/v1` (versioned) |
| Website | React + Vite on Workers static assets. Public pages, **Google sign-in** for accounts (D63), **owner-only routes behind Cloudflare Access** (D53) |
| LLM | Gemini (paid tier) behind a provider interface (D15) |

**VPS vs Cloudflare (D109):** Cloudflare for site and pipeline; VPS/owner machine only as engine fallback, feeding R2 or a batched ingestion Worker.

**Why not GitHub Actions + Python:**
- GitHub's Actions terms restrict non-build workloads.
- Schedules are delayed or dropped unpredictably.
- D1 is only reachable from outside Cloudflare via a slow, rate-limited REST API.

#### Known downsides & plans
| Downside | Plan |
|---|---|
| 128 MB memory per Worker (PDFs up to 41 MB seen) | Fetch/split only the pages needed (`pdf-lib`). Send large PDFs to Gemini's File API without local parsing. If a job type still doesn't fit, move that job only to Cloudflare Containers. |
| No page renderer in Workers | Send **single-page PDFs** to Gemini, which reads scans natively. |
| CPU limits (Paid: 30 s default, up to 5 min; 15 min for Cron) | Waiting on I/O doesn't count. Work is split into small queue messages. |
| Weak data-science tooling | Research via D1 export → local Python, read-only. |
| Lock-in | D1 = SQLite (exportable). Hono is portable. Thin adapters for Queues/Cron. LLM behind an interface. |
| D1: 10 GB per DB, billed by rows scanned | Databases split by domain; precomputed snapshot/feature tables; every query indexed. |
| **NSE may block Cloudflare IPs** | `probe/` first. If blocked: a fetch relay (owner's machine or small VPS, decided if it happens, D54) pushes raw files to R2. |
| Free plan (10 ms CPU, 100k D1 writes/day) | Development on Free; **Workers Paid ($5/month)** before backfill/go-live. |

**Alternatives considered:**
- **VPS + Python + Postgres:** kept only as the relay fallback.
- **Google Cloud Run:** splits the platform.
- **Cloudflare + Python Containers:** an escape hatch, used per job type only when measurement demands it.

---

### 4. Data sources

All NSE. "Verified" = fetched successfully from a cloud IP on 2026-11-02 (Appendix B). **Every source must be re-verified from Cloudflare via `probe/`.**

#### 4.1 Market data (archive host `nsearchives.nseindia.com`, daily 22:00 IST, D10)
| Dataset | Path | Status |
|---|---|---|
| UDiFF bhavcopy (OHLC, volume, ISIN, series; universe = EQ/BE/BZ minus `INF` fund units, D126) | `/content/cm/BhavCopy_NSE_CM_0_0_0_{YYYYMMDD}_F_0000.csv.zip` | Verified; history from **2024-01-01** (D2, D3) |
| PR bundle: `MCAP*` (issue size, market cap), `Bc*` (corporate actions) | `/archives/equities/bhavcopy/pr/PR{DDMMYY}.zip` | Verified; MCAP from **2024-02-01**; Bc earlier |
| Delivery (`sec_bhavdata_full`) | `/products/content/sec_bhavdata_full_{DDMMYYYY}.csv` | Verified (D65) |
| Equity master | `/content/equities/EQUITY_L.csv` | Verified |
| Index constituents (+ `Industry` = sector, D121) | `/content/indices/ind_nifty50list.csv`, `ind_niftytotalmarket_list.csv` (+ other index lists) | Verified (D9, D121) |
| Index closes (~167 indices, OHLC, P/E, P/B, yield) | `/content/indices/ind_close_all_{DDMMYYYY}.csv` | Verified; from 2024-01-01 (D62) |
| Bulk & block deals | archive daily files | To verify (D67) |
| F&O participant-wise OI, F&O ban, ASM/GSM lists, short selling, price bands | archive daily files | To verify (D76) |
| FII/DII cash flows | `www.nseindia.com/api/fiidiiTradeReact` | Verified; **latest day only**, history builds from go-live |

#### 4.2 Structured filings (`www.nseindia.com/api/...`, per company)
| Dataset | Endpoint | Frequency | Status |
|---|---|---|---|
| **Integrated Filing – Financials** (XBRL + iXBRL, consolidated + standalone) | `integrated-filing-results` | Quarterly | Verified; **primary financial source** (D76) |
| Integrated Filing – Governance (board, committees, complaints, auditors) | same list | Quarterly | Verified (D76) |
| Financial results XBRL (fallback) | `corporates-financial-results` | Quarterly | Verified. Current quarter + YTD only, **no comparatives** (D47) |
| Shareholding pattern | `corporate-share-holdings-master` | Quarterly | Verified (D56) |
| Insider trading (PIT) | `corporates-pit` | As filed | Verified; **completeness to verify** (D29) |
| Takeover Reg 29 | `corporate-sast-reg29` | As filed | Verified |
| Pledges (SAST Reg 31) | not found yet | As filed | **To find**; shareholding pattern is pledge truth meanwhile |
| Related-party transactions | possibly in half-yearly integrated filing | Half-yearly | **To verify** |
| Credit ratings (agency, instrument type, rating, action, outlook; **no amounts**) | `corporate-credit-rating` (+ XBRL per rating) | As filed | Verified (D76, D81) |
| Board meetings (results calendar) | `corporate-board-meetings` | As filed | Verified |
| Corporate actions | `corporates-corporateActions` | As filed | Verified |
| BRSR (XBRL) | `corporate-bussiness-sustainabilitiy` (NSE's spelling) | Annual | Verified (D71) |
| Annual reports (PDF list) | `annual-reports` | Annual | Verified (D74) |
| Sector classification | **NSE index CSV `Industry`** (§4.1, D121); per-company endpoints (`quote-equity`, BSE `ComHeadernew`) not used (403 from cloud); supersedes D8, D120 | With index snapshots | Verified |

#### 4.3 Announcements
| Dataset | Endpoint | Status |
|---|---|---|
| Corporate announcements (metadata + PDF link + XBRL flag), incl. by date range | `corporate-announcements` | Verified (no cookies needed from cloud) |
| RSS (backup source) | `nsearchives…/content/RSS/Online_announcements.xml` | Verified |
| Attachments (PDFs) | `nsearchives…/corporate/…` | Verified |

#### 4.4 Non-NSE (minimal)
- **Government open PIN-code directory** (PIN → district/state) for plant locations (D77).
- Optional OpenStreetMap geocoding (cached).

---

### 5. Data model

Separate D1 databases by domain: `market`, `filings`, `announce`, `memory`, `graph`, `app`. Staging has its own copies (D43).

#### 5.1 Identity (shared)
- Internal `security_id`. Symbol and ISIN are attributes with history (`security_identifier`), never keys. ISINs change on corporate actions (seen: Bajaj Finance split).
- Every listed security maps to a graph `entity` from day 1.
- **Lifecycle (D34):**
  - Demerger: memory is copied to the new company only for the business it took over, linked back, with human review.
  - Merger: linked, not merged.
  - Rename/symbol change: no change, since everything is keyed on `security_id`.

#### 5.2 `market`
```
security, security_identifier, classification(as_of), trading_calendar, pipeline_run
price_daily      raw OHLCV per series, never mutated
delivery_daily   delivery qty / %
shares_daily     issue_size, face_value, mcap, mcap_source[nse|derived]
corp_action      type, raw_purpose, ratios, rights_price, amount, status
adj_factor       factor, method[share_ratio|bc_ratio|terp|price_ratio|manual]
index_daily      OHLC, P/E, P/B, yield per index
index_snapshot / index_membership (valid_from/to)
market_structure F&O OI by participant, ban list, ASM/GSM, short selling, price bands, bulk/block deals, FII/DII
latest_snapshot  precomputed for the site
```
- **Storage discipline (D131):** R2 text objects gzip-compressed; site pages read precomputed snapshots, not history tables. **Write cap (D136):** no daily limit; bulk work stops when the month's billed D1 writes reach 45M (included: 50M); the daily price job (last 7 days) always runs. **Spending ceiling (D137):** at most $10/month for all Cloudflare ($5 plan + up to $5 usage); a daily cost-guard check fails above $4.
- **Storage (D130):** compact — integer dates (`YYYYMMDD`), prices and money in integer paise, `WITHOUT ROWID` tables keyed by (date, security, series); no per-row ISIN (identifier history holds it). Raw files in R2 are the lossless copy.
- **Adjusted price** = raw × product of later `adj_factor` values. It's computed, never stored. Volume adjusts inversely.
- **Market cap** is never adjusted (D5).
- **Corporate-action rules (D6):**
  - **Second source (D138):** NSE's per-company corporate-action lists fill actions the Bc files omit (whole-population check: 19 price-affecting of 6,084 since 2024, e.g. SHRIRAMFIN 1:5 split); same parser and factor rules; past gaps repaired from stored share counts, never by re-running old dates. Rights entitlements are kind `other`; ETF unit splits go to owner review (D139). Review items are decided by Claude with independent evidence, applied as migrations (D141). Insolvency capital reductions are series breaks, not factors (D146). Storage: originals gzip, never deleted (D147).
  - Split/bonus: factor = share-count ratio from MCAP, which must match the Bc text within 0.1%.
  - Rights: TERP.
  - Demerger / capital reduction: price-ratio estimate, always reviewed.
  - January 2024: Bc ratio only. Market cap derived from February's share count (`derived`).
- **Dividends** are recorded but not adjusted (D7).
- **`Bc*.csv` handling:** the same action appears once per series (EQ, BE…), so rows are deduped on (security, ex-date, purpose). Purpose text varies ("FVSPLT", "FV SPLT", "INT DIV", "RS"/"RE"…), so parsing uses tolerant patterns, and anything unparsed goes to the review queue; nothing is guessed.
- **Revised files:** NSE occasionally revises a day's files. The next run re-fetches the previous 5 sessions' files, compares SHA-256, and reprocesses a date if its file changed.
- **Classification history** exists only from our first fetch onward (NSE shows current classification only).
- **Market cap display:** ₹ crore, no decimals; stored exact in ₹ (D5).

#### 5.3 `filings` (financial statements & structured disclosures)
- **Scope and formats (D155, D157, D154):** filings are loaded into D1 for the 250 focus companies (Nifty 50 + Next 50 + Midcap 150, `FOCUS_INDICES`); readers are still proven on every stored file by census. Statements carry every reported line (D154) and follow the legal formats (Schedule III Div II/III/I; Banking Regulation Act Third Schedule; IRDAI), shown as heads with sub-rows (D157).
- **Three layers (D47; layer 1 in R2 per D132):**
  - **As filed:** every XBRL fact (tag, context, unit, decimals, filing id), lossless.
  - **Canonical:** our own line items with templates for industrial / bank / NBFC / insurance. A quarter filed only as a half-year file (D169) is loaded only from the file's own 3-month column; it is **never derived** from the half-year (owner #345). No stored figure is ever derived — no subtraction, no summed quarters (D170, enforced by filings 0039).
  - **Views:** Screener-like summary, statements, ratios, all computed.
- **Value key:** (security, statement, line, period, **basis**, **version**). `version` stays in the stored key for now (D162).
  - *Original* = that period's own XBRL.
  - *Restated* = a later filing's comparative column (from PDF, identity-checked).
  - Default series = latest restated, with a marker (D48).
- **Basis (D50):** primary basis per company — consolidated (most), **standalone (banks)**, both (holding companies). Basis switches create series breaks. Profit is split into attributable to owners vs NCI.
- **Conventions:** EBITDA excludes other income (company figure stored alongside) (D49). Adjusted metrics exclude exceptional items; TTM; average capital for ROE/ROCE; no sentinel values (D52). Computed values are stored in the feature table only, labelled with their inputs (D171).
- **Also stored:**
  - shareholding pattern (incl. pledges, named holders ≥ 1%). **Percent basis:** the filed % (SCRR 1957 base, excludes ADR custodian / employee-trust holdings) is the default; % of all shares is kept alongside. Promoter encumbrance % is of the *promoter holding*, not of the company.
  - insider (PIT) and Reg 29 transactions, promoter pledges/encumbrance (D28)
  - credit ratings
  - governance facts
  - **BRSR facts** (products by NIC code + % turnover, exports %, plants/offices, markets, employees/workers, energy/water, purchase/sales concentration; **standalone basis**) (D71)
  - segment data mapped to a canonical business-line taxonomy
  - geographic revenue on a canonical region/country list
  - major customers (≥ 10%) (D70)

#### 5.4 `announce`
```
announcement   seq_id, security, category, subject, filed_at, pdf_url, sha256, size, xbrl flag, lane, status
page_text      per page (in R2, compressed), extraction route (text|vision)
event          groups related filings (intimation → outcome → results → presentation → concall)
```
- **PDFs are not kept long-term (D17).** URL + SHA-256 + per-page text are kept forever. High-value PDFs are kept 90 days.

#### 5.5 `memory` (per stock; every row: source filing, page, quote, `period`, `disclosed_at`, confidence, claim type, model/prompt/extractor version)
```
fact               generic subject/predicate/value/unit/period/basis
guidance           metric (KPI dictionary key), target, period, status (D33)
commitment         text, due_by, status: open → met | missed | revised up/down | delayed | withdrawn | silently dropped
capex_project, order (supplier, customer entity?, value, segment), capacity, management_change,
litigation, market_concern (analyst questions), concall_metrics (D67), timeline (every announcement)
rated_facility      agency, instrument type (term loan / fund-based WC / non-fund-based BG-LC / NCD …), rated amount, rating, outlook, date (D81)
commissioning       plant/capacity, project cost, date, guided utilisation ramp, depreciation policy, debt-funded share (D82, D83)
dossier            computed current-state view per stock, rebuilt after each event
```
- **Claim types:** reported · guidance · target · aspiration · analyst question · third-party. Only reported + guidance count when comparing delivery against promises (D33).
- **"Silently dropped":** not mentioned in 2 consecutive *commentary* events where outlook was discussed. Annual-only guidance patterns are respected. "Commentary stopped" is a separate flag (D33).
- **KPI dictionary:** shared metrics + sector packs for the 15 Nifty 50 industries; unmatched → `other` + review (D31). Drafted in `docs/field-catalogue.md` §8.
- **Vectorize:** unstructured commentary with `{security_id, type, period, disclosed_at}`, always filtered by stock and time.

#### 5.6 `graph`
```
entity        kind: listed_company | unlisted_company | person | investor | promoter_group | plant | commodity | product(NIC) | govt_body
entity_alias  alias, source
relation      kind: supplier_of | customer_of | subsidiary_of | competitor_of | uses_material | produces | promoter_of | holds | operates_plant
              + source filing, quote, confidence, valid_from/to, origin[explicit | industry_default]
```
- **Explicit links only (D37).** Industry-default raw materials are allowed with `origin = industry_default`, always labelled (D72).
- **One hop (D38):** linked companies get a context line. A separate card only if named, amount disclosed, ≥ 2% of the linked company's TTM revenue (total income for banks/NBFCs/insurers; market cap for M&A/stake/fund-raise), and the linked company is in AI coverage (D111). Same event filed by both sides within 7 days → one merged card. Labelled "derived from <source company>'s filing".
- **Named** unlisted counterparties → entities, name stored as filed; cross-filing merges only on exact alias match, otherwise to the owner's review queue; foreign companies carry `country` + `listed_abroad`; government buyers → `govt_body`; hinted identities stay text; CIN added with MCA data later (D39). **No public pages for unlisted entities at launch** (owner, #238): they appear only inside listed-company cards and trackers; may be added later.
- **Promoter groups** seeded from shareholding patterns (D40). **Tracked investors** = named holders ≥ 1% (D67).
- **Entity resolution:** exact alias → fuzzy → LLM suggestion → review queue. A wrong merge is worse than a missing link.
- **Plant registry (D77):**
  - Fields: name, address, PIN, city, district, state, country, products (NIC), capacity, utilisation, status, commissioning dates (→ commitments), regulatory status (company-disclosed USFDA outcomes).
  - Sources: annual-report plant locations cross-checked against BRSR plant counts.
  - Plant revenue share is factual only for single-plant companies or plant-wise disclosure; otherwise capacity share labelled "estimate".

#### 5.7 `app`
Users (Google sign-in; deletion/export on request, D107), watchlists, saved queries/trackers/baskets, on-site alerts, error reports, owner corrections log (D35), audit log, query cache, cost ledger.

#### 5.8 Feature table
One row per stock, hundreds of precomputed fields + compact quarterly series (≤ 12 quarters), rebuilt nightly and after events. It powers the query builder, trackers, dashboard and sector pages. **Computed values live here only (D171, owner #358):** TTM, ratios and D66 fields are stored with origin `computed`, their inputs and computed time; never in `fin_value` (D170).
Full list: `docs/field-catalogue.md`.

---

### 6. Pipelines

**History and bulk loads (D156, #325):** no more stock-history downloads; indices get 10 years (2016–2023 from NSE's daily index file already in R2; 2024 onward with the daily job). One-off bulk loads read stored R2 files in parallel and write many days per D1 batch, one statement per day (#325).

| Pipeline | Trigger | Notes |
|---|---|---|
| **Market daily** | Cron 22:00 IST, every day (weekend sessions exist) | 404 = no session (only if both bhavcopy and PR return 404). Missed dates retried every run. Raw files archived to R2 (~1 MB/day). Quality gates (§9.1) block bad dates. |
| **Structured filings** | Cron (frequency per source) | Integrated filings, shareholding, PIT/SAST, credit ratings, board meetings, corporate actions → parsed in code, **no LLM**. |
| **Announcements (real time)** | Cron every 2–5 min + RSS backup | Queue stages: triage → extract → verify → context → analyse → commit (§7). Target ≤ 15 min (D16). |
| **Annual** | On filing | BRSR XBRL (code). Annual-report sections (LLM, Flex): MD&A, segment note (geography + major customers), revenue disaggregation, capacity/capex, RPT, contingent liabilities, auditor qualifications, FX earnings & outgo, R&D, unhedged FX exposure, raw materials consumed, **plant locations** (D74, D77). Capacity/commissioning/utilisation facts from presentations, transcripts and MD&A (D83). Borrowings notes: sanctioned working-capital limits + whether quarterly statements filed with banks agree with the books (discrepancy = red flag, D83). |
| **Classification** | With the index snapshot job (Cloudflare, D9) | Sector from the Total Market CSV `Industry` column, joined by ISIN; others filled from announcement `smIndustry` mapped to the 22 sectors (D121); changes kept as history. |
| **Nightly derived** | After the market job | Adjusted series, feature table, dashboard snapshots, trackers, niche indices, outcome ledger. |
| **Prefetch (D128)** | Now, one-off + catch-up | Archive history → R2 from GitHub Actions; NSE API raw responses for all companies → R2 from Cloudflare. Everything stored (D127); parsing reads R2. One ledger row per URL, never fetched twice (D135). |
| **Backfill** | One-off | Financial statements: **5 years** of quarterly + annual XBRL (D90). Market: ~700 dates × 2 files + Bc from 2022, archive at up to 4 parallel with back-off on refusal (D124), on Workers Paid. Phase 2: last 4 quarters of Nifty 50 results, concalls and presentations on **Batch**, cost estimated first (D55). |

---

### 7. AI layer

#### 7.1 Models & tiers (D15)
- Gemini paid tier only. **One pinned stable model per stage**, changed only after the gold set passes on staging.
- Prompt caching throughout (fixed instructions + dossier).
- **Standard:** triage + time-critical events (results, transcripts, orders, management changes).
- **Flex** (50% off, 1–15 min latency, may return 503 → client retries): everything else.
- **Batch:** backfill, weekly audit, gold-set runs.
- **On Flex, context is pre-fetched in one go** (no multi-round tool calls). *To verify:* whether cache discounts stack with Flex, and Flex availability for the chosen models.

#### 7.2 Triage (D26, D27, D30)
| Lane | Content | Processing |
|---|---|---|
| **A** always full | Results, transcripts (detected by subject), presentations, acquisitions/disposals, orders, credit ratings, management/director changes, litigation, regulatory actions, schemes, fundraises, rumour/news verification, material-issue disclosures, commencement of production, monitoring-agency reports, **Reg 30 disruption disclosures** | Full extraction + card |
| **B** timeline/structured only (no LLM) | Depository certificates, trading window, newspaper copies, record dates, meeting schedules (→ calendar), recording links (→ audio summary, D69) | Timeline row + structured data |
| **C** decide per item | General Updates, Updates, Press Release, Shareholders meeting, unknown categories | Cheapest model on subject + page 1 → full / memory-only / timeline |
- Sample evidence (D113): ~42% of tier-2 announcements useful, ~25% card-worthy, ~45% noise; useful items found inside "General Updates".
- Routing uses **category + subject text**, never category alone (evidence: a material JLR IT-security update sat under "General Updates").
- **Keyword escalators** (incident, cyber, fraud, resign, default, penalty, raid, fire, shutdown, downgrade, …; tuned in practice) and **size checks** (e.g. ESOP/allotment ≥ 1% of capital) lift items B → C/A.
- Dedupe by SHA-256. "Revised" supersedes. Related filings are grouped into one event.
- **Weekly audit:** ~300 items on Batch, weighted to Lane C skips, against a written definition of "material". Target: **zero** misses. Any miss fixes the rule that missed it. The owner spot-checks "not material" verdicts monthly.

#### 7.3 Extraction & verification guardrails (enforced by code)
*V1 lessons adopted as requirements: D133 (labels on every figure, scale guard, profit-line discipline, PDF-header proof, PDF-now-XBRL-later re-check, switches default off).*
| Failure mode | Guardrail |
|---|---|
| Scans/charts misread | Per-page routing: text layer → text; scan/chart → one-page PDF to Gemini vision. Chart-read numbers are `low_confidence` unless corroborated. |
| Analyst questions saved as management claims | Transcripts split into speaker turns by code (participant list). Claims come from management turns only. Questions → `market_concern`. |
| Wrong numbers / quarter / unit / basis | Numbers from **XBRL first** (Integrated Filing). Every extracted number carries period (Indian FY normalised), unit (normalised), basis (from table heading). PDF tables must pass **accounting identities** (Income = Revenue + Other income; PBT = Income − Expenses ± Exceptional; PAT = PBT − Tax; segments sum; Assets = Liabilities + Equity; cash-flow sections reconcile). Presentation numbers are cross-checked against XBRL. |
| Restatements missed | Later comparatives vs stored originals: > 0.5% difference → restatement flagged + reason; error corrections = red flag (D48). |
| Hallucinated facts | Verbatim quote + page; code checks the quote against page text. Failure → rejected. |
| Opinion becoming fact | Facts and analysis in separate tables; analysis never feeds extraction. |
| Mixed bases | Code rejects comparisons that mix consolidated/standalone (D51). |
| **Prompt injection** (D41) | Filing text passed as data only. Gemini has **read-only** tools. Strict output schema or reject. Instruction-like text in PDFs flagged. |
- Memory is **rebuildable** from kept page text when prompts improve.

#### 7.4 Context retrieval
- **Pre-fetch by event type** (results → last 8Q + open guidance + commitments due + last concall concerns; order → order book, run-rate, capacity, customer; capex → projects, debt, cash flow; management change → history, red flags; rating → history, debt).
- **Tool calls** only on Standard-tier events, ≤ 5 per item, logged.
- Vector search only via `search_commentary(stock, query, before_date)`.
- The context pack carries basis tags and only the primary basis unless the event concerns the other.

#### 7.5 Card (one per event, versioned)
```
headline, event_type
what_happened[]    facts with citation (filing, page, quote)
numbers[]          value, unit, period, basis, source; reported and adjusted; profit bridge where relevant
vs_past_context[]  confirms | contradicts | new (guidance, commitments, prior periods)
materiality        factual size only, computed (e.g. order = x% of TTM revenue) — no score (D21)
linked_impacts[]   one hop, explicit links
red_flags[]        shown separately, never netted
watch_items[]      commitments added/due
technical_context  computed from prices
provenance         model, prompt version, tool calls, cost, latency
confidence_gate    published | published_unverified (badge, never hidden)
```
- **Goal (owner's words):** an investor of any type should be able to **take a decision after reading the card**, so it must carry **full context**. Every section serves that.
- **Writing rules:** neutral, factual language (no hype words such as "fantastic" or "strongly positive"); reported and adjusted figures side by side; explain *why* (e.g. profit bridge when PAT and EBITDA diverge); label claim strength (guidance vs aspiration); one card per event, updated as filings arrive; a disclaimer on every card.
- **Card sections and their order are decided after seeing real output** (D25). A shareable image is generated from the web card.
- Insider activity gets cards only past thresholds (D29); otherwise it appears in the insider panel.

#### 7.6 Other LLM uses
| Use | Tier | Access |
|---|---|---|
| Plain-English → query language (never SQL) | Standard (cheap model), cached | Signed-in users, daily cap (D64) |
| Concall **audio** → provisional same-day summary, validated when the transcript arrives (speaker attribution from audio is weaker, so analyst-vs-management separation is provisional until the transcript) | Flex | Public (marked provisional) (D69) |
| Annual-report sections | Flex | — |
| Research chat | Standard/Flex | **Owner-only** (D68) |
| **Per-stock AI analysis write-up** (fundamental/technical/research, **with judgement**, labelled as AI analysis, not advice) | Flex, refreshed after each results/event | **Public after legal consult**; behind Access until then (D80) |
| Rated-facility amounts from credit-rating letters | Standard (Lane A) | Public facts; interpretation labelled (D81) |
| Upcoming-results signals, predictions (after backtest), scenarios, mix-drag estimate | — / Batch | **Owner-only** (D53, D73, D78) |

---

### 8. Product (website)

**Full website brief (everything discussed, decided, built and pending, with sources): `docs/website.md`.**
**Audience (D153):** youth / Gen Z investors, mutual-fund houses, family offices, PMS. Site v0 is offline (D152) until the data is frozen (D155, D158).

**Public, readable without an account** (D60; owner routes behind Access, D13). **Launch mode: open public, unlisted, no marketing, `noindex` until the owner decides (D89).** Accounts via Google sign-in add watchlists, saved queries/trackers/baskets and on-site alerts (no email/Telegram alerts to users). Owner-only routes sit behind Cloudflare Access.

#### 8.1 Public
- **Home = market & indices dashboard** (EOD, clearly labelled) (D59, D62, D67):
  - ~167 indices: levels, trends, P/E, P/B, yield vs own history (percentiles)
  - breadth: advances/declines, % above EMA 20/50/100/200, daily thrust (±4%), 52-week extremes
  - broad-index panel; sector/industry performance; FII/DII
  - market structure (F&O participant OI, ban list, ASM/GSM entries)
  - results-season tracker; latest important cards; calendar; search
  - "data updated HH:MM IST" (D46)
- **Card feed:** filters by stock, event type, materiality, confidence; "report an error" on every card (D42).
- **Stock page:** one long page, AI write-up first, then "latest quarter in brief" (D91, D92; full order in Appendix A). Contents: **AI analysis write-up** (D80, after legal consult), **rated bank-facility history** (D81), **commissioning watch** (facts: cost, date, guided utilisation, depreciation policy, debt share, **plus labelled estimate** of extra depreciation, interest and margin effect) (D82), dossier, financials (reported/adjusted, original/restated, basis), segments & mix, geography, customers, plants, guidance & commitment tracker, management credibility ledger, insider/pledge panel, shareholding, governance, forensic panel, disclosure timeliness, disclosure-regression flags, timeline, cards, linked companies, time-machine view.
- **Sector/industry page:** aggregated results trend, guidance raised vs cut, commentary map, valuation vs history, KPI-pack comparison, leaders/laggards, red flags, raw-material exposure, upcoming results (D70).
- **Query builder** (D61, D64): plain English (signed-in) + visual chips + text expression → one validated query language → precomputed feature table. Saved screens with "what changed since last run". If plain English can't be mapped to fields, the builder shows **"not understood: …"** instead of guessing. A `null` never matches a condition; every field has an as-of date.
- **Trackers** (D78): sector KPI trackers (company-reported vs computed), segment-margin trackers (where disclosed), export share vs margin, repeat orders (named customers, disclosed orders only).
- **Other tools:** keyword scans over announcement text (D67); bulk/block deals and tracked investors; custom baskets, returns vs indices, peer comparison; niche sector indices (e.g. NIC-based castings) (D75); exposure queries over the graph; unexplained-move panel (D69); "what changed since your last visit" (signed-in).
- **Data-health page:** last runs, review-queue sizes, freshness.
- **Legal pages:** terms, privacy, disclaimer, credits, contact (D115).
- **Search** across companies, people, investors, products, plants and **full text of filings** (D104). **Charts** via Lightweight Charts (D105). **Exports** owner-only until licence (D106).

#### 8.2 Owner-only (Cloudflare Access; never cached publicly or exposed via public API routes)
- Upcoming-results signals (incl. headcount growth as an expansion indicator) + outcome ledger; predictions only after a backtest beats the naive baseline (D53).
- Scenario calculator, incl. commodity shocks and inventory gain/loss (D73).
- Event-impact screen ("flood, Ahmedabad, 15 days" → plants → companies → % capacity → revenue at risk) (D77).
- Export mix-drag estimate (D78).
- Pre-announcement insider-trading timing (D69).
- Portfolio X-ray (aggregated geography, raw-material, customer, pledge exposure) (D75). *Note: also useful for signed-in users later.*
- Research chat (D68).
- Interpretation of rated-facility changes as signals (D81, D53).
- Correction screen (logged; shown publicly as "corrected") (D35). Review queues (CA, entity resolution, demergers, triage audit, error reports). Gold-set & cost dashboard.

#### 8.3 Future paid tier (D23) & API (D93)
Not built now. Designed in: accounts, API keys, exports, per-plan limits. The website runs on the same versioned API paid clients would use (D93). External keys/exports only after licence + legal consult.

---

### 9. Quality & evaluation

#### 9.1 Market-data gates (a date isn't written if any check fails; row-level failures go to review unless above the D125 tolerance)
- Row count within ±5% of 20-day median.
- Exact schema.
- `low ≤ open, close ≤ high`, all > 0.
- `|mcap − issue × close| / mcap < 0.5%`.
- ≥ 99% EQ rows join MCAP (from 2024-02-01).
- Unexplained adjusted move > ±35% → review.
- Unexplained share-count change > 2% → review (only when it looks like a missed split/bonus: ratio ≥ 1.25×/≤ 0.8× or price move > 20%, D129).
- Index snapshot row counts exact.

#### 9.2 Phase 1 acceptance tests
1. BAJFINANCE adjusted close 2025-06-13 = 933.10, continuous across 2025-06-16.
2. Nifty 50 adjusted series: zero unexplained jumps since 2024-01.
3. Market cap equals NSE MCAP to the rupee from 2024-02-01.
4. Re-running any date changes 0 rows.
5. A rebuild from R2 is identical.
6. CA review queue empty.

#### 9.3 Gold set (D20)
- ~50 real Nifty 50 announcements covering: results, concalls (speaker attribution), scans, chart-heavy presentations, orders, management changes, restatements, consolidated/standalone traps, and **the owner's failure cases**.
- Drafted by Claude; **owner labels are ground truth**.
- **Metrics:** fact precision/recall, number accuracy (value + unit + period + basis), speaker attribution, triage miss rate, cost and latency per item.
- **Every prompt/model change** reruns the gold set on staging; a regression doesn't ship.

#### 9.4 Ongoing
- **Daily random card audit** (D86): stronger model on Batch checks a daily sample against source pages; owner reviews flags; Claude reviews samples in sessions.
- **Automated error detectors on every write** (D85): units (100×/1000× jumps), company mix-up (PDF identity vs announcement), period, basis, quote verification, card-vs-store re-read, cross-source checks, schema.
- **Public launch gate** (D84): measured audit error rate below threshold for N consecutive days (values set in milestones); no fixed shadow run, the pre-public private period serves that purpose.
- Weekly triage audit (§7.2).
- Insider-feed completeness check.
- BRSR plant-count cross-check.
- Entity-resolution review.
- Outcome ledger each results season (D53).

---

### 10. Operations & security
- **Availability:** occasional downtime acceptable; no redundancy/on-call; queues catch up; freshness indicator shows staleness (D79).
- **Staging:** separate D1/R2/queues; gold set gates promotion (D43).
- **Backups:** D1 Time Travel (30 days) + weekly export to R2 kept 12 weeks; full rebuild from raw tested before launch (D44).
- **Alerts to owner (email):** pipeline stalled > 1 h, Gemini spend > 80% of daily cap, any dead-letter item, NSE error spike (D45).
- **Secrets:** in Cloudflare/GitHub secrets and local `.dev.vars` (git-ignored). The repo is public: **no data or secrets in git** (D11, D14).
- **Owner review budget:** 30 min/day; queues ranked by impact, safe auto-resolution, backlog visible (D96).
- **Repo:** public, no description/README, documents only in `docs/` (D97).
- **User data:** deletion/export on request; error reports kept 2 years (D107).
- **Scale design:** aggregated page endpoints, CDN-cached responses on a custom domain, < 50 ms public queries, separate feature-table database (D108).
- **Time:** stored UTC, shown IST (D114). **Security headers + secure cookies** (D117). **Email:** Cloudflare Email Routing forwards `@disclo.in` addresses to the owner and carries owner alerts (D116).
- **Access control:** owner routes behind Cloudflare Access. Public API routes rate-limited, read-only, bot protection. Owner-only data never edge-cached publicly. Pipeline diagnostic pages answer only with the `STATUS_TOKEN` bearer token (D163).
- **D1 cost rules (D163):** cron queries indexed and EXPLAIN-checked in CI; one-off passes outside the crons; daily rows-read breaker; capped retries. Write caps and the November budget: D166. Diagnostics and one-off passes through the `ops` workflow only (D165). **NSE requests:** browser-session pattern (D160). **Download scope:** the 250 focus companies for new downloads (D161).
- **Prompt-injection defence:** §7.3.

---

### 11. Budget ($100/month total, D18)
**First month (D154):** $10 ceiling (Workers Paid $5 + D1 writes beyond 50M at $1/M); `MONTHLY_WRITE_CAP` 54M as the guard.

| Item | Allocation (initial; tuned from measured cost per item) |
|---|---|
| Workers Paid (incl. base D1/Queues/R2 allowances) | $5 |
| D1/R2/Vectorize/Queues overage | ≤ $5 |
| Gemini, **hard daily cap in code** (≈ $85/month) | Announcements (triage + extraction + cards) ~50% · concall audio + annual reports ~20% · weekly triage audit + **daily card audit** + gold-set runs (Batch) ~10% · **AI analysis write-ups (Flex)** — taken from the reserve until measured · plain-English queries ~5% · owner research chat ~5% · reserve ~10% |
| Headroom | ~$5 |
- At 80% of the daily cap, only Lane A is processed. At 100%, items queue for the next day, and the data-health page says so.
- The Phase 2 backfill is a **one-off** on Batch, estimated before running (D55).
- **Not covered:** NSE EOD licence (≈ $113/month for the website alone, §16), a domain (~₹1,000/yr, not needed yet, D58), the legal consult.
- **Scale scenario (owner question, 2026-11-02): full universe, 1 lakh visitors/day × 5 pages = 15M page views/month** (prices checked 2026-11-02: Workers Paid $5 incl. 10M requests then $0.30/M; 30M CPU-ms then $0.02/M; D1 25B rows read included then $0.001/M; static assets reported free; no egress fees).
  | Design | Worker requests/month | Cloudflare cost/month |
  |---|---|---|
  | Naive (each page makes ~8 API calls, every call invokes a Worker) | ~120M | ≈ $5 + $33 requests + ~$7 CPU ≈ **$45** |
  | **Chosen (D108):** one aggregated API call per page section group, responses cached at Cloudflare's CDN so most hits never invoke a Worker | ~15–25M | ≈ **$8–15** |
  Hosting traffic is cheap on Cloudflare at this scale. **The expensive part is AI coverage, not visitors** (below). Plain-English queries (D64) scale with signed-in users, so the per-user daily cap matters at this traffic.
- **Full universe ≈ 46× the announcement volume of Nifty 50; it doesn't fit in $100.** Expansion beyond Nifty 100 is a budget decision based on measured cost.

---

### 12. Legal & compliance
**Design choices already made to reduce risk:**
- no scores or ratings (D21)
- predictions, scenarios and trading-timing analysis owner-only
- facts with sources
- judgement only in labelled AI write-ups, held back until the consult (D80)
- correction process and error reports
- disclaimers on cards
- licence-ready data adapter (D24)

**Owner's posture (D87):** launch first and comply when required ("Uber model"): SEBI RA registration if needed; data licence before charging (D88). The consult below is still recommended before open public launch; its answers decide what must change.

**Consult before going public. Questions:**
1. SEBI RA Regulations: do cards (facts, comparisons with own past, guidance tracking, red flags) count as research reports? Does the "statistical summaries" exclusion cover them?
2. Red flags naming individuals (e.g. trading during window closure): defamation exposure, wording.
3. SEBI Jan-2025 circular (recent prices with stock names): applicability; what changes with a regulated partner.
4. Liability for AI-generated errors; are corrections + disclaimers sufficient?
5. NSE data: unlicensed bhavcopy-derived prices (D24); NSE website terms vs automated API access; status of derived numbers. **Owner manages this with NSE (D152).**
6. Republishing quotes/numbers from company filings; linking vs hosting PDFs.
7. Paid tier: does charging institutions change status (RA vs IA)? Is an institutional API data redistribution?
8. Owner's own trading in covered stocks: disclosures/conflicts; owner-only signals.
9. DPDP Act obligations (accounts, emails, error reports).
10. Individual vs company; terms, liability, jurisdiction, disclaimers.
11. NSE **index** data (licensed by NSE Indices Ltd).
12. Name/brand: **Disclo** chosen and domain bought (D99); confirm no trademark conflict (classes 36/42). The internal project/repo name "Insider" isn't public-facing.
13. **Paid, stock-specific AI judgement write-ups (D80):** does this require SEBI Research Analyst registration (individual or entity)? Obligations if registered (qualifications/NISM certification, disclosures, audit, conflict rules). Alternatives.
14. **Pre-results impact estimates** (D82): public, labelled estimates about named companies' upcoming results.

---

### 13. Risks
| Risk | Mitigation |
|---|---|
| NSE blocks Cloudflare IPs | Probe first; relay fallback (D54). |
| NSE changes formats/APIs/endpoints | Strict schema checks; versioned parsers; RSS backup; endpoint health in alerts. |
| NSE/legal action over unlicensed data | Calculated risk (D24); licence-ready adapter; consult before public. |
| LLM errors compound in memory | Quote verification, XBRL first, identity checks, facts/opinions separated, rebuildable memory, gold set. |
| Triage misses | Measured weekly audit, zero tolerance, timeline rows for everything. |
| Wrong entity merges / bad graph links | Explicit-only links, review queue, prefer missing over wrong. |
| Basis mixing / restatement errors | Basis in every key; code rejects mixed comparisons; restatement detection. |
| Gemini cost overrun / Flex capacity / model retirement | Hard cap; tier split; stable pinned models; gold-set-gated migrations (~1–2 per year expected). |
| **Scope creep** (78 decisions) | Data foundations from day 1; screens phased after the Nifty 50 core passes acceptance (D69); milestones with definitions of done (next topic). |
| Owner-only data leak | Access-protected routes; no public caching; separate API routes. |
| Funding for licence | Open item (§16). |

---

### 14. Milestones (approved by owner, D94)

**Status:** build started 2026-11-03 (D122); **M0 signed off 2026-11-03 (D143)**; M1 and M2 in progress. Downloads run ahead of need (D144); old bank files without period excluded (D145).

**Build discipline (D134):** whole-population offline run before any reader deploys; root-cause fixes for recurring failures; one deploy pipeline; milestones judged by their gates. **Work protocol (D140):** current plan item only, one audit→fix→re-audit cycle per item (max two), findings outside the item go to the to-do. **When stuck (D142):** a prompt to V1 via the owner; answers validated on V2 data before use.
**Capped lists (D149):** per-company NSE lists can stop at 20 rows; complete history via monthly / dated calls.
**Market structure (D148):** loaded from R2 by source and date with a day ledger; bands/surveillance as intervals; API-capped days flagged.
**Download ledger (D135):** one row per downloaded URL with hash and status; R2 write before "done"; live market files written through to `cache/`; old-GAAP aliases gated to old-GAAP files and proven by `/census`.

**Definition of done for every milestone:** tests pass in CI on real-file fixtures; staging runs clean; gold set (once it exists) shows no regression; `docs/PLAN.md` + `docs/discussion-log.md` updated and the consistency check passes; owner sign-off.

| # | Milestone | Done when |
|---|---|---|
| **M0** | Foundations | `probe/` passes from Cloudflare (or the D54 relay decision is made); monorepo, CI, D1 migrations for all domains; building blocks B1–B5 (identity, provenance/time, normalisers, ingestion framework, review queue) with tests |
| **M1** | Market data, full universe | Phase 1 acceptance tests (§9.2) pass; backfill complete; daily job succeeds **10 consecutive sessions** with no manual fix; delivery, indices, market-structure data loading |
| **M2** | Structured filings & financials | 5-year XBRL backfill (D90) for Nifty 50, then full universe; ≥ 99.5% of filings parse and pass identity checks (rest in review queue); restatement and basis rules verified on known cases; shareholding, PIT/SAST, ratings, board meetings live; classification CLI run once |
| **M3** | Site v0 | Dashboard, stock page (market + financials sections), data-health page; **performance targets met** (below); noindex + rate limits in place |
| **M4** | Gold set v0 | ≥ 50 labelled Nifty 50 cases covering every known failure type; owner labels complete |
| **M5** | Announcements → timeline | Poller + triage + timeline for Nifty 50; first weekly triage audit run; latency measured |
| **M6** | Extraction, memory, cards (private) | Gold-set thresholds met (below); cards, "latest quarter in brief", AI write-ups generated; daily card audit running; cost per item measured and within budget |
| **M7** | **Quality gate → open public (unlisted)** | Gate thresholds met (below) |
| **M8** | Discovery tools | Feature table, query builder (3 modes), trackers, sector pages, alerts |
| **M9** | Depth | Graph links, plant registry, BRSR + annual-report jobs, Tier 1/2 differentiators (D69) in stages |
| **M10** | Owner analytics | Signals + outcome ledger + backtest harness; scenarios; research chat |
| **M11** | Nifty Next 50 | Same gates re-run on the new stocks |

**Gold-set thresholds (M6):**
- Number accuracy (value + unit + period + basis all correct) ≥ 99%.
- Fact precision ≥ 97%, recall ≥ 90%.
- Speaker attribution ≥ 98%.
- **Zero** company mix-ups and **zero** unit errors.

**Quality gate to open public (M7):**
- Daily card audit: ≤ 1% of audited cards with any material error for **14 consecutive days**.
- **Zero critical errors** in those 14 days. Critical = wrong company, wrong headline number, wrong unit or period, mixed basis.
- Zero material triage misses in the last 2 weekly audits.
- Lane A latency p90 ≤ 15 min during market hours.
- Gemini spend within the daily cap for 14 days.

**Performance targets (M3 onward):**
- Cached page or API from India: TTFB ≤ 200 ms.
- Stock page: largest content visible ≤ 2.0 s on mid-range mobile 4G.
- API p95 ≤ 300 ms cached, ≤ 800 ms uncached.
- Query builder results ≤ 2 s for Nifty 100, ≤ 5 s for the full universe.

#### Build order detail (unchanged sequence)
1. **Probe from Cloudflare** → confirm reachability or trigger the D54 decision.
2. Monorepo skeleton, D1 migrations (all domains), CI, shared parsers with real-file fixtures (BAJFINANCE 2025-06-13/16; Infosys/Sun Pharma XBRL; Sun Pharma BRSR).
3. Market pipeline + CA engine + identity → backfill → **Phase 1 acceptance tests**.
4. Structured filings pipelines (integrated filings, shareholding, PIT/SAST, ratings, board meetings) + canonical financial model + restatement/basis rules.
5. Classification CLI (owner's machine).
6. API + public site v0: dashboard, stock page (market + financials), data health.
7. **Gold set v0** (Claude draft → owner labels) **before** Phase 2 prompt work.
8. Announcement poller + triage + timeline (no LLM extraction yet) → measure Nifty 50 volumes.
9. Extraction + verification → gold set → memory + context → cards → **go live for Nifty 50**.
10. Feature table + query builder + trackers + sector pages.
11. Graph, plant registry, BRSR/annual-report jobs, Tier 1 differentiators (D69) in stages.
12. Owner-only tools; weekly audit; cost dashboard.
13. Nifty Next 50 (D57).

### 15. Repo layout
```
packages/core/        shared TS: types, NSE parsers, XBRL mapping, FY/unit/basis normalisers, validators, query language
workers/market/       market daily + nightly derived
workers/filings/      structured filings (integrated filings, shareholding, PIT/SAST, ratings, BRSR, board meetings)
workers/announce/     poller + queue consumers (triage, extract, verify, context, analyse, commit)
workers/web/          site v0 (M3, D151): Hono API `/api/v1` + React/Vite site served as Workers static assets (one Worker, one deploy)
tools/classify/       owner-machine CLI (sector job)
tools/relay/          fallback fetch relay (only if needed)
db/migrations/{market,filings,announce,memory,graph,app}/
eval/gold/            gold set (metadata + expected outputs; no NSE PDFs committed)
docs/                 DISCLO.md = the one document (D159; all former .md files merged) + sector-map.json; no README/description at the root (D97)
probe/                throwaway reachability check
.github/workflows/    ci.yml (CI) + probe.yml (temporary NSE reachability probe; deploys/deletes a test Worker)
```

---

### 16. Open items
*Rewritten 2026-11-02 (#237): done and superseded items removed.*

**Setup status (owner + Claude, 2026-11-02):**
- ✅ Cloudflare account; **Workers Paid ($5/month) active from 2026-11-03** (#243): D1 50M rows written + 25B read/month, 5 GB included; Queues 1M/month; Vectorize; Workers Logs.
- ✅ `disclo.in` **active on Cloudflare**; GoDaddy leftover DNS records cleaned.
- ✅ Email Routing: `info@`, `alerts@`, `paresh@disclo.in` → owner's Gmail. **Test email pending** (owner; send from a different account).
- ✅ Workers subdomain set (`financialengineer-in.workers.dev`).
- ✅ GitHub secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` added.
- ✅ Probe working from GitHub Actions → Cloudflare (`.github/workflows/probe.yml`); `quote-equity`/BSE checks removed (#240), Cloudflare reachability checks only. **Remove the 3×/day schedule after ~2 days** (≈ 4 Nov 2026) of consistent results.

✅ **Deploy access (#249):** API token has D1, R2, Queues, KV, Vectorize, Workers Scripts Edit + Workers Routes Edit; R2 enabled; buckets `disclo-raw`, `disclo-raw-staging` exist.

**Upgrades needed before backfill/go-live:** ~~Workers Paid~~ done (#243); a paid Gemini API key (M5/M6; free AI Studio key for trials, D122). (At M0, check the existing Cloudflare API token's permissions cover D1/R2/Queues deploys; widen if not.)

**Build status (2026-11-03 morning):**
- M0 foundations ✅ (monorepo, CI, 12 D1 databases with migrations, building blocks B1–B5 with tests, deploy workflows).
- M1 market data: history 2024-01-01 → today loading/loaded on Cloudflare (every instrument stored, D127); Phase 1 tests 1 and 3 pass on live data; test 2 needs the first index snapshot; test 6 (review queue empty) needs owner review; M1 "done" also needs 10 consecutive clean daily runs (≈ mid-November).
- D128 prefetch: archive history in R2; NSE API lists for every company in R2; XBRL attachments downloading. One download ledger, write-through for live market files (D135); monthly write cap 45M billed rows (D136).
- M2 in progress: XBRL reader; canonical results (industrial, NBFC, bank, life insurer) + shareholding readers; `disclo-filings` loading results and shareholding from R2 into the filings DB with FMEA guards (see HANDOVER for live numbers).

**Decided (D132):** as-filed XBRL facts live in R2 (gzip), D1 keeps canonical lines + checks.

**Next build steps (M0–M3 pending, owner #284; full list in HANDOVER):** M1 market-structure loaders; M2 readers for PIT/SAST, ratings, board meetings; balance sheet + cash flow; restatement/basis known-case tests; classification CLI; then M3 site v0. Done today: D1 reads cut (D137); results-reader classes (99.66%, D134); daily discovery of new filings into the ledger (D135); general-insurer template; owner review screen for the review queue (M3); remove the probe's 3×/day schedule (≈ 4 Nov).

**Waiting on the owner:**
1. ~~Email test~~ **working (owner #285).**
3. **Launch name: Disclo, `disclo.in` (final, D99, D118).** Trademark check resumes (D119): IP India search + filing (classes 36/42) before building the brand.
4. ~~Review Claude's one-time map of the 75 announcement `smIndustry` values → 22 sectors (D121), when drafted in M0~~ **Map v1 approved (D150, #291)**; finalised with the owner once the full value list is collected

**Still to discuss:** card sections, after real output (D25).

**Still to verify (during M0 unless noted):**
- sustained-volume NSE rate limits from Cloudflare (all pipeline sources verified at low volume: probe run #3 + #234)
- bulk/block, F&O, ASM/GSM archive paths
- SAST Reg 31 endpoint
- RPT data location
- insider-feed completeness
- Flex + cache discount stacking
- employee-count fields in BRSR XBRL tables

**Licence (decided, D88 option D):** keep the calculated risk until the paid tier; license before charging. Cost: EOD Capital Market ≈ ₹1,00,000 per display medium + GST ≈ $113/month for the website alone, above the $100 budget (D18); no ads or sponsors (D22). *Claude's recommendation stands:* ask licensed vendors (e.g. CMOTS, Accord) for quotes now, since it costs nothing.

---

### Appendix A — Decision log

| # | Topic | Decision |
|---|---|---|
| D1 | Market-data source | NSE archive (`nsearchives.nseindia.com`). No paid vendor for now; licence-ready adapter (D24). |
| D2 | History start | **2024-01-01** (first UDiFF bhavcopy). |
| D3 | Bhavcopy format | UDiFF only. |
| D4 | Universe | Series EQ, BE, BZ. No SME. AI processing starts with **Nifty 50**, then other indices, then the full universe. |
| D5 | Market cap | Full market cap as published by NSE (`MCAP*.csv` in the PR bundle). Never adjusted. Stored exact in ₹, displayed in ₹ crore with no decimals. |
| D6 | Corporate actions | Source: `Bc*.csv`. Split/bonus factor = **share-count ratio** from MCAP, cross-checked with the Bc text. Rights use TERP. Demergers and capital reductions use a price-ratio estimate, flagged for review. |
| D7 | Dividends | Not adjusted (price-only), but recorded. |
| D8 | Sector classification | NSE 4-level, from `quote-equity`, run **on the owner's machine** (blocked from cloud). Quarterly for all, monthly for new listings only. **Superseded by D121** (owner, #239). |
| D9 | Index history | Daily snapshot + diff of constituent CSVs, from go-live onward. |
| D10 | Market-data schedule | Every day at 22:00 IST. A 404 means "no session". Missed dates are retried. |
| D11 | Storage | D1 + R2 + Vectorize. Git = code + migrations + docs only, **no data**. |
| D12 | Language | TypeScript everywhere. |
| D13 | Website | Autonomous. **Public later** after legal consult; owner-only routes behind Cloudflare Access. Website only: no email/Telegram alerts to users (on-site alerts for signed-in users per D60; owner email alerts per D45). |
| D14 | Repo | Public. |
| D15 | LLM | **Gemini paid tier only**, no other providers, no vendor fallback. **One pinned stable model version per stage**, changed only after the gold set passes. Owner accepts model-change risk and **welcomes newer models when the gold set shows an improvement** (not only when Google retires a model). Prompt caching throughout. **Tiers:** Standard for triage and time-critical events; **Flex** (50% off, 1–15 min) for everything else; **Batch** for backfill, audits, gold-set runs. Behind a provider interface. |
| D16 | Announcement latency | Card within **15 minutes** of filing. |
| D17 | PDFs | **Not stored long-term.** URL + SHA-256 + per-page text kept forever. High-value PDFs kept 90 days. |
| D18 | Budget | **$100/month total.** Hard spending cap in code. |
| D19 | Commodity prices | Later phase. |
| D20 | Evaluation | Gold test set: drafted by Claude, **ground truth set by the owner**. |
| D21 | Score | **No score, rating or positive/negative label on cards.** Facts, comparisons with the company's own past, and context. |
| D22 | Monetisation | No ads, no sponsors; a clean site. Expected to stay **free for roughly the first 5 years** (competition). Target: investors, family offices, institutions; **audience extended by D153 (youth / Gen Z, MF houses, PMS)**. **Licence funding open** (§16). |
| D23 | Paid tier | Possible later (institutions). Not built now; accounts, API keys and exports designed in. Robustness first. |
| D24 | Prices on public site | Bhavcopy-derived prices shown publicly before a licence: **owner's calculated risk**. Licence-ready source adapter. |
| D25 | Audience | Retail **and** institutions; layered card; shareable image generated from the web card. Card sections decided after real output. |
| D26 | Triage | Route on **category + subject text**. Lanes A (always full) / B (timeline/structured, no LLM) / C (cheap LLM decides). Keyword escalators + size checks lift B → C/A. Every item gets a timeline row. Dedupe by hash; revisions supersede; filings grouped into events. Keywords tuned in practice. |
| D27 | Triage miss tolerance | **Zero** material misses in the weekly audit sample; any miss fixes the rule. |
| D28 | Insider & pledge data | In scope: PIT insider trading, SAST Reg 29, promoter pledges/encumbrance. Structured, parsed in code. |
| D29 | Insider display | Per-stock insider panel. Card only past thresholds (tunable): promoter/group net ≥ 0.25% of equity **or** ≥ ₹50 cr over 30 days; any pledge increase; any trade during trading-window closure; KMP/director open-market buy ≥ ₹1 cr. Pledge truth = shareholding pattern. Insider-feed completeness to verify. |
| D30 | Triage audit | ~300 items/week on Batch, weighted to Lane C skips, written "material" definition; owner spot-checks monthly. |
| D31 | KPI dictionary | Shared metrics + sector packs for the 15 Nifty 50 industries (financials from day 1). Unmatched → `other` + review. Claude drafts, owner approves. |
| D32 | Fact time model | `period` + `disclosed_at` on every fact. Corrections create versions; old ones kept as replaced. |
| D33 | Commitment tracking | States open → met / missed / revised up/down / delayed / withdrawn / silently dropped. Due-dated items resolve against results. Silently dropped = 2 consecutive commentary events where outlook was discussed without mention; bare results don't count; annual-only guidance patterns respected; "commentary stopped" flag. Claim types: reported · guidance · target · aspiration · analyst question · third-party; only reported + guidance count for delivery comparisons. |
| D34 | Lifecycle | Demerger → copy only the transferred business's memory, linked back, human review. Merger → linked, not merged. Rename → no change. |
| D35 | Owner correction screen | Yes. Private; edits logged and shown as "corrected". |
| D36 | Scope exclusions | Consensus estimates: out of scope. Non-NSE sources (news, rating rationales, BSE-only filings): later. |
| D37 | Graph link sources | Explicit statements in filings only. (Exception: labelled industry-default raw materials, D72.) |
| D38 | Graph impact reach | One hop; context line for linked company. **Confirmed by owner (#236):** own card only if named **and** ≥ 2% of linked company's TTM revenue (or market cap for deals), with: (a) base = linked company's TTM revenue (total income for banks/NBFCs/insurers); market cap for M&A, stake and fund-raising deals; (b) amount must be disclosed; never estimated (no amount → context line only); (c) linked company must be in AI coverage (D111), else context line; (d) if the linked company files its own disclosure of the same event within 7 days, the two merge into one card (no double card); (e) linked card labelled "derived from <source company>'s filing". |
| D39 | Unlisted counterparties | **Confirmed by owner (#236):** named → entities with aliases; unnamed → text, never guessed, with: (a) store the name exactly as stated + source filing; merge across filings only on exact alias match or owner review (wrong merge worse than missing link, §5.6); (b) foreign companies use the same entity kind with `country` (+ `listed_abroad` flag), no separate kind; government customers (NHAI, Railways, ministries) → `govt_body`; (c) descriptions that hint at an identity ("a leading US bank", "a Maharatna PSU") stay text even when the identity seems obvious; (d) MCA CIN added later when MCA data arrives (D36 "later"); (e) **no public pages for unlisted entities at launch** (owner, #238), only inside listed-company cards and trackers. |
| D40 | Group companies | Promoter-group structures from shareholding patterns from day 1. |
| D41 | Prompt-injection defence | Filing text as data only; read-only tools; strict schema; quote + XBRL/identity checks; instruction-like text flagged. |
| D42 | Public error reports | "Report an error" on every card → owner review queue. |
| D43 | Staging | Separate staging D1/R2/queues; gold set gates every prompt/model change. |
| D44 | Backups | D1 Time Travel (30 days) + weekly export to R2 kept 12 weeks; full rebuild tested before launch. |
| D45 | Owner alerts | Email: pipeline stalled > 1 h, Gemini spend > 80% of daily cap, any dead-letter item, NSE error spike. |
| D46 | Freshness indicator | Public "data updated HH:MM IST". |
| D47 | Financial statements storage | As filed (lossless XBRL) → canonical model (industrial/bank/NBFC/insurance) → computed views. No outside convention as storage. Results XBRL has current quarter + YTD only; half-year XBRL adds balance sheet + cash flow for the current period only. |
| D48 | Restatements | Versioned values (original vs restated); never overwritten. PDF tables identity-checked. > 0.5% difference → restatement flagged + reason (error correction = red flag). Default = latest restated with marker. |
| D49 | EBITDA definition | Excludes other income. Company-reported EBITDA stored and shown alongside. |
| D50 | Consolidated vs standalone | Both stored; basis in every key. Primary basis per company: consolidated (most), standalone (banks), both (holding cos). Basis switch → series break. Profit split owners vs NCI; EPS/valuation use attributable. |
| D51 | Basis in AI inputs | Basis-tagged numbers; primary basis only unless relevant; basis per PDF table; code rejects mixed comparisons; unclear commentary basis → unknown, not used numerically. |
| D52 | Ratio conventions | Adjusted excludes exceptional items (reported alongside). TTM (owner #350, D170: four filed quarters, unavailable if one is missing; stored only in the feature table, D171). ROE/ROCE on average capital; capital employed documented. No sentinel values. (Screener's "net of excise duty" adjustment is not needed: our history starts in the GST era.) |
| D53 | Upcoming-results signals | Factual leading indicators (guidance revisions, order book ÷ TTM revenue, quarter-end provisional business updates, monthly volumes, capacity vs commitments due, insider/promoter buying, pledge changes, margin trend, **headcount growth from BRSR as an expansion indicator**) + outcome ledger. "Good results" = growth above own 8-quarter trend **and** guidance met. Ranking/prediction only after a point-in-time backtest beats a naive baseline, **owner-only**, never cached publicly. |
| D54 | NSE-block fallback | Decide if it happens (owner-machine relay vs small VPS). **Probe 2026-11-02: not needed** (all pipeline sources reachable from Cloudflare; only `quote-equity` blocked, handled by D8). Kept as contingency. |
| D55 | Phase 2 backfill | Last 4 quarters of Nifty 50 results, concalls, presentations; cost estimated first. |
| D56 | Shareholding pattern | Ingested quarterly for all covered stocks. |
| D57 | Next index | Nifty Next 50 after the Nifty 50 PoC (together = Nifty 100). |
| D58 | Domain | **`disclo.in`** (bought, D99); `*.workers.dev` only until it's connected to Cloudflare. Needed for CDN caching (D108), Google sign-in URLs (D115) and email (D116). |
| D59 | Home page | Market & indices dashboard + latest important cards + calendar + search. |
| D60 | Accounts | Everything readable without an account. Accounts for watchlists, saved queries and on-site alerts. |
| D61 | Query builder | Required and must be easy (design: D64). |
| D62 | Dashboard contents | EOD. ~167 indices; index P/E, P/B, yield vs own history; breadth; sector performance; FII/DII (history from go-live); results-season tracker; cards; calendar; search. Precomputed nightly. |
| D63 | Login | Google sign-in only. |
| D64 | Query builder design | Plain English (Gemini → our query language as editable chips; **LLM never writes SQL**) + visual chips + text expression → one validated language → parameterised SQL over the feature table. Plain English: signed-in users, daily cap, cached. Saved screens + "what changed". Field catalogue in `docs/field-catalogue.md`. |
| D65 | Delivery data | `sec_bhavdata_full` added to daily sources. |
| D66 | Catalogue conventions | Rising trend = positive slope over n quarters **and** ≥ (n−2) positive QoQ changes. Large order = ≥ 2% of TTM revenue (owner #350, D170: four filed quarters, unavailable if one is missing). |
| D67 | Benchmark adoptions | Dashboard EMA participation, daily thrust, 52-week extremes, broad-index panel; bulk/block deals + tracked investors (≥ 1%); announcement keyword scans + on-site alerts; factual concall metrics (analysts, questions per theme, congratulatory remarks, Q&A share, unanswered questions); custom baskets, returns vs indices, peer comparison. |
| D68 | Research chat | Owner-only. |
| D69 | Differentiating features | Tier 1: time machine; disclosure regression detector; management credibility ledger; sector commentary map; "what changed since last visit"; disclosure timeliness; unexplained-move panel. Tier 2: concall audio provisional summary; forensic panel (no score). Owner-only: pre-announcement trading timing. Data from day 1; screens phased after Nifty 50 acceptance. |
| D70 | Business mix & exposure | Sector/industry page; segments → canonical business lines; product mix on **NIC codes**; segment margins; geographic exposure on canonical regions; customer concentration (≥ 10%); margin recovery/erosion fields. |
| D71 | BRSR | Annual XBRL ingestion: products (NIC + % turnover), exports %, plants/offices, markets, employees/workers, energy/water, purchase/sales concentration. Standalone basis. Forensic uses: cost per employee, headcount vs revenue, energy/water vs revenue. |
| D72 | Raw materials | RM cost % revenue (XBRL) + company-stated materials + **industry-default map, labelled** (D37 exception). Inventory days for gain/loss estimates. |
| D73 | Scenario calculator | Owner-only; user-entered shocks → estimated cost impact and inventory gain/loss, labelled as a scenario. |
| D74 | Annual-report scope | Adds: segment note (geography + major customers), revenue disaggregation, FX earnings & outgo, R&D, unhedged FX exposure, raw materials consumed. |
| D75 | Niche indices & portfolio X-ray | Adopted (NIC-based niche indices; aggregated exposure X-ray). |
| D76 | Structured NSE sources | Integrated Filing – Financials as primary quarterly source; structured credit ratings (agency, instrument type, rating, action, outlook; **no amounts**, see D81); market-structure data (F&O OI, ban, ASM/GSM, short selling, price bands); governance fields from Integrated Filing – Governance. Later (non-NSE): MCA charges, AMFI, RBI. |
| D77 | Plant registry & location impact | Plant entity with location (PIN → city/district/state), products, capacity, utilisation, status, regulatory status; annual-report plant locations cross-checked with BRSR counts; Reg 30 disruption disclosures linked to plants; city/state filtering, **no map view**; plant revenue share factual only when single-plant/disclosed, else labelled estimate; owner-entered event impact screen. News and FDA databases later. |
| D78 | Trackers | **Adopted:** sector KPI trackers (company-reported vs computed), segment-margin trackers (where disclosed), export share vs margin, repeat-order tracker (named customers, disclosed orders). **Export mix-drag estimate: owner-only, labelled.** |
| D79 | Availability | **Occasional downtime is acceptable** (owner, production discussion). No redundancy/failover/on-call; queues catch up after outages; freshness indicator (D46) shows staleness. |
| D80 | Per-stock AI analysis write-up | **Public, including judgement** (owner: "keep it, else why will people pay"). Fundamental/technical/research write-up per stock. **D21 still applies to cards** (no score/rating on cards). Judgement write-ups are clearly labelled as AI-generated analysis, not advice. **Blocking legal item before public launch** (§12 #13): paid, stock-specific opinion is the strongest case for SEBI Research Analyst registration. Until the consult, judgement write-ups stay behind Access. |
| D81 | Rated bank-facility tracking | Track the **rated amount** of bank facilities/instruments over time, not just the rating. E.g. rating unchanged at A, but rated facilities raised ₹100 cr → ₹600 cr = an early sign of capex, large orders or working-capital expansion. *Verified 2026-11-02:* NSE's structured credit-rating feed/XBRL has agency, instrument type, rating, action, outlook, dates, but **no amounts**. Amounts and the split come from the **credit-rating announcement PDF** (CRA letter/press release), extracted in Lane A. **Split matters:** long-term term loans (→ capex), fund-based working capital (→ growth *or* stress), non-fund-based limits like bank guarantees/LCs (→ order execution). Public: facts (amount change by type). Interpretation ("likely capex") is labelled as such, and owner-only signal per D53. CRA rationale reports (non-NSE) later (D36). |
| D82 | Capacity commissioning → P&L impact | **Resolved (owner): everything public, including the estimate** (legal item §12 #14). Estimates are always labelled "estimate" with method shown. **Before results (watch item):** when a plant/capacity is commissioned (D77), show facts together: project cost, commissioning date, management's guided utilisation ramp (e.g. 30% next quarter), depreciation policy (annual report), debt-funded share. Facts **and** the estimate are public: estimated incremental depreciation (cost ÷ useful life), finance cost no longer capitalised after commissioning (Ind AS 23), and estimated margin effect (B15, labelled estimate, method shown). **After results (card context):** explain changes with evidence from memory, e.g. depreciation +₹X cr and finance cost +₹Y cr QoQ, coinciding with commissioning of plant Z (₹W cr, CWIP → gross block in the half-yearly balance sheet), utilisation N% vs guidance. Stated as a factual link between disclosed numbers, not a judgement. |
| D83 | Sources for facility/capacity facts | Plant, capacity, utilisation, commissioning, project-cost and ramp-up facts come from **investor presentations, concall transcripts and annual-report MD&A** (plus plant locations in the corporate-governance section, BRSR counts, and commissioning/expansion announcements). Same guardrails: verbatim quote + page, period/unit normalised, management claims only from management turns. Annual-report extraction scope (D74) explicitly includes **MD&A capacity/capex/commissioning passages**. **Also from annual-report notes (forensic):** sanctioned working-capital limits and whether the **quarterly stock/receivable statements filed with banks agree with the books** (Schedule III disclosure; discrepancies = red flag). |
| D84 | Gold set & private period | Failure cases are found by running the system, not pre-collected. (1) Gold set v0 seeded by Claude from real Nifty 50 filings, owner labels; required before go-live as the regression gate. (2) **No fixed-length shadow run** (owner). The site is private anyway until the legal consult + licence decision (D13, §16), so that private period is used for **daily random card audits** (D86). (3) **Public launch gate** = measured quality, not a date: audit error rate below a threshold for N consecutive days (values set in milestones). (4) After launch, error reports (D42), review queues, daily audits and universe expansion keep feeding the gold set. Every error class found gets a detector where possible (D85). |
| D85 | Automated error detectors | One detector per error class, running on every write. **Units:** value vs the company's own history/peers; ~100× or ~1000× jumps flag lakh/crore/million mistakes. **Data mix-up:** company name/ISIN/symbol inside the PDF must match the announcement's security; a fact saved under the wrong company is rejected. **Wrong period:** period in the document vs filing date vs fiscal year. **Basis:** D51. **Hallucination:** quote verification (D41). **Card vs store:** every number on a card is re-read from the store and must match. **Cross-source:** XBRL vs presentation vs card. **Code/prompt regressions:** gold set + parser tests on real fixtures in CI. **Schema:** strict output schemas. Detector hits go to the review queue and the data-health page. |
| D86 | Daily random card audit | Every day a random sample of published cards (and memory-only items) is audited: (a) automatically by a stronger Gemini model on **Batch**, checking every number, quote, unit, period, basis and company against the source pages; (b) the owner reviews flagged items, and Claude reviews samples whenever the owner opens a session (Claude does not run continuously). Errors → correction (D35), gold case, detector. Daily error rate tracked on the data-health page; it feeds the launch gate (D84). |
| D87 | Regulatory posture | **Owner's decision ("Uber model"):** launch, then comply when required: register as a SEBI Research Analyst if needed; license data when required. Owner's reasoning: without real testing and beta testers there is nothing to pitch to users or investors. *Risks recorded (Claude):* NSE is a data owner, not a regulator; it can block access without asking for payment, which would stop the pipeline. SEBI enforcement against unregistered research can include fee disgorgement and market bans, not only fees. Investors' due diligence will check data rights and registration. Mitigations kept: licence-ready adapter (D24), legal consult list (§12), no charging before licence (D88). |
| D88 | Licence funding | **Option D:** keep the calculated risk (D24) until the paid tier; obtain the NSE (and index) licence **before charging users**. Vendor quotes (option C) recommended in parallel. |
| D89 | Launch mode | **Open public, unlisted** (owner): no closed beta, no marketing ("not going to tell everyone"). Because unlisted ≠ private, these apply from day 1: `noindex` + robots disallow + no sitemap (search engines don't list it until the owner decides); bot protection and rate limits on all routes; costly features (plain-English queries) signed-in only (D64); owner-only data behind Access (D53). **Confirmed (owner): opening waits for the quality gate (D84).** Legal consult still recommended (§12). Owner context: on a `workers.dev` address with no marketing, practical exposure at launch is very low; the protections above are kept mainly to stop scrapers and cost abuse, which find new hosts automatically. |
| D90 | Financial-statement history | **5 years** of quarterly + annual statements backfilled from XBRL (code only, no LLM). Market data still starts 2024-01-01 (D2). |
| D91 | Stock page layout | **One long page** with a sticky section menu (desktop) / collapsible sections (mobile); sections lazy-load. Global controls: time-machine date, basis (primary default), reported/adjusted (adjusted default), original/restated (restated default); source on hover/tap for every number. **Order:** 0 Header (name, symbol, ISIN, 4-level sector, indices, group, EOD price, mcap ₹ cr, 52-week range, as-of, watchlist) → 1 **AI analysis write-up first** (D80) → 2 **Latest quarter in brief** (D92) → 3 What changed (since last visit / 7 days) → 4 Key facts (valuation vs own history & industry, growth vs trend, margins, ROCE/ROE, net debt, promoter holding/pledge) → 5 Cards & timeline → 6 Financials (12Q + 5Y annual, profit bridge, segments, ratios) → 7 Business (segments/NIC mix, geography, customers, raw materials, plants/capacity, commissioning watch, repeat orders) → 8 Management & guidance (guidance tracker, commitments, credibility ledger, concall metrics, analyst concerns, management changes) → 9 Ownership (shareholding, pledges, insiders, SAST, bulk/block, tracked investors, group) → 10 Credit, governance & forensics (ratings + rated facilities, governance, auditors, complaints, timeliness, disclosure regression, forensic panel, red flags, ASM/GSM) → 11 Price & market (chart with CA/event markers, delivery, technicals, relative returns, unexplained moves) → 12 Peers & links → 13 Documents & CA history. Owner-only panel behind Access: signals, scenarios, research chat. |
| D92 | Latest quarter in brief | **Confirmed (owner): format OK, keep "declined to answer".** A short **factual** summary of the latest quarter's commentary sources: concall transcript (or provisional audio summary), investor presentation, press release, annual-report MD&A when new. 5–8 bullets, each with source and page: what management said (claim type labelled: reported / guidance / aspiration), what changed vs last quarter, guidance changes, top analyst concerns, and anything management declined to answer. No judgement (that's the write-up). Updated as each source arrives; shows which sources it covers. |
| D93 | API design | **Delegated to Claude by the owner.** (1) **One API for everything:** the website uses the same versioned REST API (`/api/v1`, JSON) that paid clients would later get, so it is tested by daily use. (2) **Three route families:** public read (`/api/v1/...`), signed-in (`/api/v1/me/...`: watchlists, saved queries, alerts), owner-only (`/api/owner/...`, behind Access, never cached, never in public docs). (3) **Every response carries provenance** (source filing/page or XBRL tag, `period`, `disclosed_at`, `basis`, `version`, `origin`) and supports `as_of=` (time machine), `basis=`, `adjusted=`, `restated=`. (4) Cursor pagination; stable `security_id` in all payloads; symbols accepted as lookup only. (5) **Rate limits per tier:** anonymous < signed-in < (future) API key. (6) **External API keys and bulk exports are not offered until the data licence and legal consult are done** (D88, §12 #7): redistributing NSE data to third parties is the clearest licence trigger. (7) OpenAPI spec generated from code; breaking changes only in a new version (`/api/v2`). |
| D94 | Milestones | **Approved** as in §14 (M0–M11, definition of done, gold-set thresholds, quality gate, performance targets). Building starts only when the owner says so; discussion continues for now. Claude leads the design and asks the owner for inputs. |
| D95 | Product bar | **"Best in class; a benchmark for all"** (owner). Made measurable through §14 (quality gate, performance targets) and the UX standards still to be agreed (§16: design system, accessibility, mobile, search, charts). |
| D96 | Owner review time | **30 minutes per day.** Review work is sized to fit: queues are ranked by impact (critical first), routine items auto-resolve by rule where safe, and the daily review list targets ≤ ~30 items. If the backlog grows beyond what 30 min clears, the data-health page shows it and automation thresholds are tightened. Nothing silently waits. |
| D97 | Repo visibility & docs | **Repo stays public** (owner). No repo description, no README at the root; all `.md` documents live in `docs/` only. *Claude's note:* this reduces casual discoverability only; code and `docs/` remain readable by anyone who opens the repo, and private repos are free on GitHub (CI minutes sufficient). Recommendation stands: consider private. |
| D98 | Usage analytics | **Cloudflare Web Analytics** (free, cookie-less) from day 1; usage numbers support pitching. |
| D99 | Name & domain | **Final (owner, #239): launch name Disclo, https://disclo.in/.** Trademark check should resume (D119). *Earlier update (superseded): the public launch name may be different; trademark work paused.* `disclo.in` is owned and remains the working domain until a launch name is chosen. *Previously:* Disclo, domain `disclo.in`, bought by the owner. `disclo.com` is registered by someone else (expect some `.com` typo traffic). Still do the IP India trademark search (classes 36/42) for "Disclo" before building the brand. *Earlier choice (superseded):* Quarterwise, `quarterwise.in`. Rechecked 2026-11-02: `quarterwise.in` and `quarterwise.co.in` unregistered; `quarterwise.com` registered by someone else. Before buying: IP India trademark search (classes 36/42). Optional defensive registration: `quarterwise.co.in` (cheap); `.ai` optional (pricier). **Round 3 (owner asked for Quarter-/Quarterly- variants; RDAP 2026-11-02):** both `.com` + `.in` free: **QuarterPulse**, **QuarterLedger**, QuarterRead; `.in` only: QuarterProof, QuarterLens, QuarterScope, QuarterIQ, QuarterWatch, QuarterLab, QuarterlyEdge (and Quarterwise). Taken: Quarterly.com/.in. (Superseded: owner switched to Disclo.) **Round 4 (owner wants short coined names like Zepto, Rapido, Zomato; RDAP 2026-11-02):** both `.com` + `.in` free: **Tathyo** (तथ्य *tathya* = fact; *Claude's pick*), Kwartro, Satyalo, Disclozo, Tathyx, Kwrtr. `.in` only: **Disclo** (disclosure), Satyo (truth), Tatvo (essence), Ankro (numbers), Kwarto/Quartro/Qwarto (quarter), Veriqo, Sootro, Kasso, Saarto, Filyo. Taken: Tathya, Tatva, Filo, Fylo, Factro, Verito, Ledgo, Numbro, Proofo. The domain is pointed to Cloudflare DNS (free plan) to enable CDN caching (D108) and replace `workers.dev` (D58). History: round 1 (Kasautee, Saarnama, Satyalekh, Pramaanam, AnkLens, Primafile, Paarkhi): **owner liked none.** **Landscape (owner asked):** global filings/transcript/research tools include AlphaSense (incl. Tegus, Sentieo, BamSEC), Fiscal.ai (formerly FinChat), Quartr, Koyfin, TIKR, Hudson Labs, Daloopa, Simply Wall St, Seeking Alpha, Stockopedia, OpenInsider, WhaleWisdom; in India Screener, Trendlyne, Tijori, Tickertape, StockEdge, StockScans, Finology Ticker, MarketsMojo, Equitymaster, Value Research. Naming patterns: plain English descriptive (Screener, Tickertape), short coined (Koyfin, Quartr, TIKR), one Indian word (Tijori). **Round 2 (RDAP 2026-11-02):** **Quarterwise** (`.in`, `.ai` free; `.com` taken), **Boardnote** (`.in`, `.ai` free; `.com` taken), **StockKunji** (`.com`, `.in` free; *kunji* = key / study guide). *Claude's pick:* Quarterwise (chosen). Short English words (Footnotes, Annexure, Firsthand, Disclosed, Kunji, Hundi, Tola) are all taken on `.com` and `.in`. `.ai` costs more than `.com`/`.in` (often a 2-year minimum). Trademark search still needed. |
| D100 | Visual design | **Light theme only.** Mobile-first web (D101). |
| D101 | Platforms | **Web only, mobile-first.** No app (an app would also be a separate NSE licence medium). |
| D102 | Accessibility | Formal WCAG target **later** (owner). Basic good practice from day 1 at no extra cost: readable contrast, keyboard-usable controls, alt text. |
| D103 | Language | **English only.** |
| D104 | Search scope | **Everything:** companies, symbols, aliases, people, investors, products (NIC), plants/locations, and **full-text search inside filings** (per-page text, D17). Full-text uses SQLite FTS5 in D1, sharded by period as volume grows (Nifty 50 page text is ~tens of MB/month); results link to filing + page. |
| D105 | Charts | TradingView **Lightweight Charts** (Apache-2.0). On-chart logo turned off (`attributionLogo: false`); the licence's required notice + link to tradingview.com is placed on a credits/about page, which is the allowed way to satisfy it. *Removing attribution entirely is not done (licence violation).* |
| D106 | Exports | Built **from day 1**. **Owner-only until the licence is in place** (testing needs, D88/D93); then enabled for signed-in users. |
| D107 | User data | Account deletion and data export on request (DPDP). **Error reports kept 2 years.** |
| D108 | Scale & hosting design | **Stay on Cloudflare** (no egress fees; cheapest at 15M page views/month). Designed for scale from day 1: (1) **page-level aggregated endpoints** (a stock page loads in 1–3 API calls, not ~10); (2) **responses cacheable at the CDN** with long TTLs, purged by the pipeline after each update, so cached hits don't invoke a Worker. This needs a **custom domain** with cache rules (`workers.dev` can't do this), so buying the domain (D99) becomes necessary before high traffic; (3) **D1 query-time budget:** every public query < 50 ms; D1 executes queries one at a time per database, so heavy query-builder work runs on a **separate feature-table database** (and D1 read replicas if needed), never on the ingestion databases; (4) static assets served free from Workers static assets. Cost estimate: ≈ $8–15/month for hosting at that traffic (§11). |
| D109 | Hosting choice (VPS vs Cloudflare review) | Owner shared a Cloudflare vs VPS comparison. **Decision stays: Cloudflare for both the site ("face") and the pipeline ("engine").** Reasons: (1) the pipeline needs no Python data-science stack or headless browser: NSE archive files, JSON APIs and Gemini calls run fine in Workers/Queues; (2) a VPS is also a datacenter IP, so it doesn't solve NSE blocking; (3) a VPS adds OS patching, security and monitoring that the owner's 30 min/day can't absorb, and is a single point of failure; (4) for 15M page views/month, Cloudflare's CDN serving is cheaper and sturdier than one box. **A VPS (e.g. Hetzner) or the owner's machine is used only as an engine fallback** if the probe shows NSE blocks Cloudflare (D54) or a measured job can't fit Workers/Containers. In that case it pushes raw files/JSON to **R2 or a batched ingestion Worker**, not row-by-row through D1's REST API (slow, rate-limited). The sector-classification job already runs on the owner's machine (D8). |
| D110 | Start on Cloudflare; migrate only on measured triggers | **Start on Cloudflare now; no separate hosting decision needed first.** Growth is handled inside Cloudflare (more D1 databases/shards, read replicas, R2, Containers for heavy jobs). **Exit triggers** (reviewed monthly on the cost dashboard): Cloudflare hosting cost > $100/month with a cheaper equivalent available; D1 write throughput or size limits that sharding can't fix; NSE blocking Cloudflare (→ D54 relay); a required job that neither Workers nor Containers can run. **Portability kept from day 1:** D1 = SQLite (exportable), Hono runs on Node/Bun, thin adapters for Cron/Queues/storage, no Cloudflare-only data formats. *Storage estimate at ~1,800 companies:* per-page text ≈ 4–5 GB/year in R2 (cents/month); full-text index ≈ 5–9 GB/year in D1, sharded by year (≈ a few $/month). |
| D111 | Coverage universe (AI) | **Decided (owner): option B (tiered depth, D112), market data for all stocks, Nifty 50 proof of concept first.** **Cut-off:** market cap > **₹500 cr** to enter; once in, kept and updated until it falls below **₹300 cr** (hysteresis avoids churn). Measured on a **3-month average** market cap, reviewed monthly. **Rollout:** start with the **top 1,000** by market cap, then **+100 per month** until all > ₹500 cr are covered. **Re-entry / new entry:** a catch-up backfill session (last 4 quarters + any gap since exit) on Batch; memory of exited stocks is kept, not deleted. *Data (NSE MCAP file, 2026-10-30):* 2,620 EQ/BE/BZ securities; **1,798 > ₹500 cr**; 1,983 > ₹300 cr; rank-1,000 cut ≈ ₹3,042 cr; top 1,000 = 97.3% of total market cap. *Volume (Oct 2025):* top 1,000 ≈ **270 announcements/day = 12× Nifty 50**; all > ₹500 cr ≈ 386/day = 17×. **Budget conflict:** Gemini for top 1,000 at full depth is roughly $500–900/month (unmeasured), well above D18's $100. **Market data covers all EQ/BE/BZ stocks** (cheap; needed for breadth/dashboard). |
| D112 | Tiered AI depth within ~$100 | Owner: $500/month is not affordable. **Order:** Nifty 50 full depth first (M6–M7 gate), then the rest of the top 1,000 at light depth, then +100/month. **Tier 1 = Nifty 50: full depth** (all lanes, cards, concalls, latest-quarter brief, AI write-ups). **Tier 2 = rest of coverage: light depth**: structured data in code (no AI cost); triage on the cheapest model; cards only for key events (results, orders, rating actions, management/auditor changes, Reg 30 disruptions), on Flex with cheaper models and numbers from XBRL; **no concalls**; AI write-up quarterly at most. Depth is raised per tier as budget allows. **Rough monthly Gemini estimate (unmeasured; Oct-2025 peak volumes; assumes ≈ $0.03–0.06 per full-depth announcement):** Tier 1 ≈ $40–70; Tier 2 (~950 companies, ~7,400 announcements/month) ≈ $25–45 (triage $2–4, key-event cards $15–30, quarterly write-ups $3–6, audit share ~$3); **total ≈ $65–115**, lower in non-results months. Each +100 companies ≈ +$3–5. **The hard daily cap (D18) enforces the budget:** when reached, Tier 2 work waits for the next day; Tier 1 is never starved. Real costs measured in M6 replace these estimates. |
| D113 | Usefulness sample (evidence for triage & cost) | Owner asked to check random filings (owner's guess: ≤ 4 of 10 useful). **60 random Oct-2025 announcements from tier-2 companies (top 1,000 excluding Nifty 50), judged by Claude on category + subject:** useful ≈ **25 (42%)**; low-value memory-only (dividend notices, commercial-paper listing/redemption, postal-ballot results, "no deviation" statements) ≈ 7 (12%); noise/timeline-only (depository certificates, newspaper copies, meeting schedules, recording links, ESOP grants, RTA/TDS notices) ≈ 27 (45%); 1 unclear without page 1. **Card-worthy key events ≈ 15 (25%)**, matching the D112 assumption. **Two useful items sat in "General Updates"** (Bank of Baroda's Q2 results; a CRISIL rating for Aether): further evidence that triage must read subject/page 1, not category (D26). Caveat: October is results season; Claude's judgement, not owner-labelled. |
| D114 | Time handling | All timestamps **stored in UTC**; **displayed in IST** everywhere on the site. Trading dates and fiscal periods are stored as dates (no time zone). NSE timestamps (IST) are converted on ingestion. *(Gap found in document review.)* |
| D115 | Site legal pages | Required before Google sign-in or any public use: **Terms of use, Privacy policy** (DPDP: what's collected, retention per D107, deletion/export requests), **Disclaimer** (AI-generated analysis, not advice; estimates labelled), **Credits** (TradingView notice + link, D105; data sources), **Contact**. Google's OAuth consent screen requires privacy-policy and terms URLs on our own domain. Wording to be checked in the legal consult (§12). *(Gap found in document review.)* |
| D116 | Email | **Cloudflare Email Routing (free):** unlimited custom addresses on `disclo.in` (e.g. `info@`, `support@`, `alerts@`) **forwarded to the owner's existing inbox**; it **receives only**, no mailbox and no sending from those addresses. **Owner alerts (D45)** are sent by Workers through Email Routing to the owner's verified address. Sending *as* `info@disclo.in` (replies to users) needs a mail provider later (e.g. Zoho Mail's free tier, terms to be checked at the time, or Google Workspace, paid); **only one service can own the domain's MX records**, so switching to a mailbox provider means owner alerts move to that provider's sending or an email API. |
| D117 | Security headers | HTTPS only (HSTS), Content-Security-Policy, X-Frame-Options/frame-ancestors, Referrer-Policy, Permissions-Policy on every response; secure, HTTP-only, SameSite session cookies for Google sign-in. *(Gap found in document review.)* |
| D118 | Domain timing | **Done: `disclo.in` bought by the owner (2026-11-02).** Optional: buy common misspellings as redirects (e.g. `disklo.in`, free when checked). Trademark search still pending. |
| D119 | Trademark check "Disclo" (preliminary, 2026-11-02) | **Pause no longer applies: Disclo is the launch name (#239); owner actions below are due before building the brand.** *(Was paused when a different launch name was being considered.)* **Official IP India search could not be run from Claude's environment** (public search behind captcha / unavailable). Web-indexed sources show **no Indian "Disclo" mark**. **Conflict found:** `disclo.com` is **Disclo, a US workplace-accommodations (HR) software company**, VC-backed (seed led by General Catalyst; Y Combinator S22), active since ~2022, says it holds a software patent; a US trademark is likely but not verified. **Assessment:** different industry (HR disability accommodations vs equity research), and trademark rights are territorial, so risk in India is **low–moderate**, mainly **class 42 (software/SaaS)** overlap; higher if Disclo ever expands to the US. Also expect search-engine confusion with their brand. **Owner actions:** (1) run IP India public search for wordmark DISCLO (and DISKLO), *phonetic* + *starts with*, classes **9, 36, 42**; (2) USPTO search for DISCLO; (3) if clear in India, **file our own trademark application** (classes 36 + 42; e-filing fee roughly ₹4,500 per class for individuals/startups/small enterprises, about double otherwise; confirm current fees). Final view belongs to the legal consult (§12 #12). |
| D120 | Sector classification source: BSE (provisional) | **Superseded by D121** (owner, #239). *Was:* Owner (#231): use BSE for classification. Source: BSE quote-header API `ComHeadernew` (public, per scrip code), 4 levels: Sector > Industry > Group > Sub-group. Same cadence as D8 (quarterly; monthly for new listings), ~1 request per 3 s. Join to NSE symbol by **ISIN**. **Amends D36** (non-NSE sources) for this one dataset. **Probe 2026-11-02 18:02 UTC: 403 from both GitHub runner and Cloudflare** (Akamai), so it would run on the owner's machine like D8; BSE no longer has a location advantage over NSE. **Still open:** (a) owner confirms a quarterly run on their machine is acceptable (cf. #206: probes not on the owner's computer); (b) owner chooses the taxonomy question (BSE labels vs NSE's 4 levels; peer/industry medians and sector pages follow it); (c) NSE-only listings (no BSE scrip) get a defined fallback. Storage: four raw level columns as received (no joining or de-duplication), plus source and as-of date. Until then D8 stands. |
| D121 | Sector classification: NSE index CSV | **Owner (#239): use the sector in the CSV downloaded from NSE.** Source: `Industry` column of NSE index constituent CSVs on `nsearchives` (`ind_niftytotalmarket_list.csv`, which includes Microcap 250; reachable from Cloudflare, no owner machine). Refreshed with the index snapshots (D9). **Measured 2026-11-02 (MCAP file 30 Oct):** one level, **22 broad sectors** (e.g. Capital Goods, Financial Services); Total Market list = 754 stocks; covers **731 of the top 1,000** and **747 of the 1,798** stocks > ₹500 cr (D111), so **1,051 have no sector** from this file (new listings and non-index stocks, e.g. MANIPALHOS, 3MINDIA, PGHH). **Fill for the rest — accepted by owner (#240):** the `smIndustry` field on NSE announcement rows (verified 2026-11-02: present on 5,381 of 14,042 October rows, 947 symbols, 75 finer values, e.g. Paints, Sugar), mapped once to the 22 sectors (owner-reviewed map), labelled `source = announcement`; still none → "Unclassified". **Consequences:** sector pages, `vs_industry_median`, `rank_in` use the 22 sectors; finer peer groups only where `smIndustry` exists. Replaces the owner-machine job (D8/D120); the conflict with #206 no longer arises. |
| D122 | Build start | **Owner said "Build" (#241, 2026-11-03 00:00 IST).** Discussion phase ends; M0 starts, then M1, in the §14 order. Owner: decisions are recorded and Claude may override them "for better". **Rule:** every override is logged (what, why, which decision) and reported in the next check-in; anything that costs the owner money, time or legal exposure is asked, not overridden. **Gemini:** not needed until M5/M6 (announcement extraction, cards); trials can start on the **free AI Studio key** (public filings only); paid key when volume testing starts. The API is pay-per-token with a spending cap, not a $20 plan. **Cloudflare Free-plan limits during the build:** D1 ≈ 100k row writes/day (the full market backfill needs Workers Paid), Queues need Workers Paid, R2 needs enabling in the dashboard. *Update (#243): Workers Paid bought 2026-11-03; R2 still needs enabling.* |
| D123 | Field catalogue | **Approved by owner (#242)** as v1. Claude keeps adding fields found during the build; each addition is noted in the catalogue's change list and logged. |
| D124 | Archive download pace | **Owner (#252): the NSE archive host (`nsearchives`) doesn't rate-limit and is meant for bulk download, so fetch fast.** Archive files: up to **4 in parallel, no fixed pause**. **Safety kept:** any 403/429/503 from the archive drops that run to 1 request at a time with a 2 s pause and logs it (one refusal ≠ stop; three in a row = stop the run and resume later). The `www.nseindia.com/api/*` endpoints keep a gentler pace (sequential, ~1 s), since the owner's statement covers the archive only. **Adjusted 2026-11-03 01:15 IST (Claude, per D122):** first Cloudflare runs got repeated 403s from the archive at 4 parallel (Appendix B), so the default is **2 parallel**; back-off unchanged. Raise again only if refusals stop. |
| D125 | Market gate tolerance (**Claude override of §9.1, per D122**) | §9.1 says a date isn't written if any check fails. Applied literally, one bad row in NSE's file would block a whole trading day for every stock. **Change:** row-level failures (bad OHLC, |mcap − issue × close| ≥ 0.5%) go to the review queue and are left out; the date is rejected only if > 0.1% of rows fail OHLC sanity or > 0.5% fail the market-cap check. Date-level gates (schema, ≥ 99% MCAP join, ±5% row count, file date) stay strict. *Extension (2026-11-03):* the ±5% row-count gate compares only symbols present the previous session; a jump explained by newly trading symbols passes, and they go to review as information (seen 2026-04-20: 127 symbols began trading on NSE, +5.4%). *Reason:* one bad row must not hold up 2,900 stocks; the bad rows are still never published and are reviewed. |
| D126 | Fund units excluded from the stock universe (clarifies D4) | ETFs trade in NSE's EQ series but carry `INF` ISINs (fund units) and have no MCAP row. Found on the first Cloudflare run: 355 of 2,703 EQ rows on 2026-10-30, all `INF`; **100% of company (`INE`) rows join MCAP.** The universe is EQ/BE/BZ **minus `INF` ISINs**. Cleanup migration removed the ETF rows loaded for Jan 2024. |
| D127 | Store everything from bulk files | **Owner (#253):** don't discard data for companies outside the current universe; the universe will grow, so process, clean and store every row of every bulk file (bhavcopy all series incl. SME and ETFs, MCAP, delivery, Bc, index lists). **The universe (D4, D111, D126) filters what is analysed and shown, not what is stored.** Gates (§9.1) are computed on the equity universe; other instruments are stored with their type. Raw files stay in R2 as before. *Supersedes the storage effect of D126 (ETFs are stored, not analysed).* **Clarified by owner (#257): "everything" means everything about stocks.** Stored: equities in every series (incl. SME), plus ETFs and REITs/InvITs (may be used later). **Not stored: bonds, debentures, government securities, SGBs, T-bills, state loans, preference shares**; their raw files stay in R2. Classified **by series** (company NCDs carry the company's `INE` ISIN, so ISIN alone misleads): equity = EQ/BE/BZ/BL/SM/ST/SZ + partly paid E1–E9/X1–X9; ETF = `INF` in those series or MF; REIT = RR; InvIT = IV. Applied in the D130 compact reload. |
| D128 | Front-load all downloads | **Owner (#253): start all downloading now, in parallel with other work.** (1) **Archive history** (bhavcopy, PR bundle, delivery, index closes from 2024-01-01) is prefetched by a GitHub Actions job straight into R2 (`cache/` keys); the market Worker reads R2 first and NSE only for what is missing. *Reason:* the archive refused Cloudflare often (Appendix B) but answers other clouds. (2) **NSE API data** for every listed company (results, integrated filings, shareholding, PIT, SAST, ratings, board meetings, corporate actions, annual reports, BRSR) is fetched raw into R2 from Cloudflare (the API answers Cloudflare, not GitHub runners), as fast as NSE allows with back-off; parsing follows in M2. API pace raised from ~1/s sequential (owner: the archive/API are for scraping). |
| D129 | Share-count review threshold (**Claude override of §9.1, per D122**) | §9.1: an unexplained share-count change > 2% goes to review. On the first months loaded this raised ~137 reviews, all ordinary issuance (QIP, preferential, ESOP: ratios 1.02–1.10) that needs no price adjustment. **Change:** review only if the change is > 2% **and** (ratio ≥ 1.25 or ≤ 0.8, or the price moved > 20% that day), i.e. what a missed split/bonus/consolidation looks like. Smaller issuance is still stored in `shares_daily`. *Reason:* the owner's review time (D96) goes to things that can corrupt adjusted prices. |
| D130 | Compact market storage (owner #256: "V1 stored more and stayed under ~100 MB, so we must be storing things the wrong way") | **Finding (measured on real files):** values are correct but stored wastefully — prices/dates as text, every row stored twice (rowid table + key index), ISIN and last price repeated per row, extra date index. A compact layout (integer dates `YYYYMMDD`, integer paise, `WITHOUT ROWID`, no per-row ISIN/last) takes **31% of the space for price rows (142 → 44 bytes)**. Market cap **can't** be derived: NSE's MCAP ≠ issue × close exactly for ~⅓ of rows (2026-10-30: 1,072 of 3,232), so it stays per day (D5), as integer paise. Delivery keeps quantity only (percentage = quantity ÷ volume). **Estimate:** market DB ≈ 486 MB → ≈ 150–190 MB for 2024→today with every instrument (D127 adds ~45% rows vs. equity-only). **Plan:** new compact tables, reload from the R2 cache (no NSE calls; ≈ 6M row writes, within limits), then drop the old tables. Raw files stay in R2 as the lossless copy. |
| D131 | Storage discipline (owner shared V1 practice, #258; taken selectively) | **Adopted:** (1) **gzip text objects in R2** (API lists, XBRL; ≈ 10× smaller; zips stay as they are); (2) ~~daily D1 write budget~~ **replaced by a monthly cap (D136, owner #266)**; (3) **site reads come from precomputed snapshots** (already D62/§5.8: `latest_snapshot`, per-stock series files in R2 regenerated nightly), so page views don't query history tables. **Not adopted:** keeping only the latest price in D1. V2 needs history (adjusted series, 52-week, DMA/EMA/RSI, returns vs indices, Phase 1 test 2, time machine D69, outcome ledger D53, feature table), so the compact history stays in D1 (D130, ≈ 150 MB). Note: D130's 31% is the size *remaining* (a 69% saving). |
| D132 | As-filed XBRL layer lives in R2 (amends D47 layer 1; owner delegated, #259) | **Decision (Claude):** every XBRL filing is kept **as filed, gzip-compressed, in R2** (`att/…`): that *is* the lossless layer. **D1 holds** the canonical lines (D47 layer 2) with their source tag + filing reference, the identity-check results, and a filing index (`filing`). A fact not yet mapped can always be re-read from R2 and added later, so nothing is lost. The `xbrl_fact` table stays empty (kept only for small targeted extracts). *Reason:* ≈ 200k filings × ≈ 500 facts ≈ 100M rows would exceed D1's size and write allowance, and the site never queries raw facts. |
| D133 | V1 lessons as requirements (owner shared, #261; V1 numbers are risk sizes, not targets — V2 measures its own) | **Added:** (1) audits report WRONG/MINOR separately with a 95% Wilson interval; reviewer blind to the writer model and never the fix author; card coverage graded FULL/PARTIAL/THIN (gold set + D86); (2) every figure carries basis, unit, period, period end and line from the moment it is read — code supplies figures, the LLM writes words (already D41/§7.3; now explicit); (3) scale guard: a 10×/100×/1000× jump vs the company's own history is held, never auto-corrected; check a file's figures against its own totals (identity checks, B8); (4) restated figures read from PDFs need an identity check *and* the same line label (V1: 24 of 59 were another line); (5) profit lines are never substituted (total vs owners vs pre-exceptional vs continuing; banks: line 14 vs group line); no EBITDA for banks; NBFC/insurer templates (done in M2); (6) PDF figures unproven until column + basis are proven from the page header; known layout traps go into the gold set; OCR only for failed files; (7) refiled/repeat filings make no new card; one results card per company per quarter; every event type defined; no-news filings dropped by rule, logged; segment figures never leak across lines; (8) "PDF now, XBRL later": a card made from the PDF is re-checked when the XBRL lands; (9) truncated downloads are never kept (PDF must start `%PDF` and end `%%EOF`); empty answers are marked empty, never treated as data; (10) rule changes to cards/memory ship behind a named switch, default off, byte-identical when off, replayed on/off over stored items and blind-judged before switching on; fixes are by class from counts, never per company; (11) LLM gateway paces by each provider's own limits and 429s, with a fixed fallback chain; writer models chosen by blind audit, not price. **Not adopted (conflicts with V2 decisions):** $0 cost (V2 budget $100, D18); 3–5 s NSE list pacing (V2 measured ≈0.3% refusals at 16 parallel from Cloudflare, Appendix B); "no time series in D1" (D131). **Owner decisions (#262):** Screener.in as a referee — **Later**; EPS — **kept** (from XBRL only, split/bonus-adjusted via adj_factor); card error bar — **V2's M7 gate stays** (≤ 1% material, zero critical, 14 days), measured with the blind-audit method above. |
| D134 | Build discipline: whole-population first (owner #264: "keep the end goal in mind so we don't keep coming back for small corrections") | **Problem (honest):** overnight, readers were built from sample files and production found the variants one stall at a time (purpose spellings ×6 rounds, gates ×3, missing-file handling ×2), and recurring tooling issues got one-off workarounds (queued deploys cancelled ×4). **Rules:** (1) before a reader is deployed, run it **offline over every file we hold** (R2 / archive) and report all failure classes with counts on one page; fix by class until unknowns are ≈ 0; only then deploy; (2) a recurring tooling failure is fixed at its root the second time it appears; (3) one deploy pipeline (no competing workflows); (4) each milestone is judged against its §14 acceptance gates, not against the last error. |
| D135 | One download ledger; readers change only on whole-population proof (owner #265) | **Owner (#265): the old-GAAP aliases must not change current results; keep track of what is downloaded so nothing is downloaded again and again or missed (a V1 mistake).** (1) **Aliases** are used only for old Indian GAAP files (`isOldGaap`: `in-bse-fin` schema that is not an Ind AS entry point); Ind AS and Integrated Filing files read exactly as before (test: identical output with aliases off); confirmed on every downloaded results file by the `/census` run (D134) before relying on it. (2) **Download ledger:** every file has one row keyed by URL (`fetch_job` for filings, `source_file` for market files) with status, attempts, HTTP code, bytes and SHA-256; a row is marked done only after the R2 write succeeds; failures retry up to 3 times except true 404s; `/status` shows failures by reason and any duplicate content. (3) **Write-through:** a market file fetched live is saved to R2 at the same `cache/` key the prefetch uses, before any gate, and the ledger points there (fixes: live files were kept under another key the reader never checks, and ledger keys for reloaded days pointed to objects never written). (4) **Not built yet:** queueing new filings after the one-time prefetch (daily discovery into the same ledger) — next M2 item; until then nothing filed after 2026-11-03 is queued. |
| D136 | Monthly write cap instead of a daily budget (owner #266: "Go free, no limits till we use 30M") | **No daily limit.** Bulk work (history reloads, filings loader) runs freely until the IST month's **billed** D1 rows written reach **45M** (owner #268; was 30M in #266) (Workers Paid includes 50M/month; beyond that $1 per million). **Counted as Cloudflare bills it:** D1 `meta.rows_written`, which includes index writes (the old counter used table rows only and undercounted), across market + filings, in `market.write_budget`; month-to-date baseline from Cloudflare GraphQL analytics (infra-check). **Claude's addition (logged, for the owner's check):** at the cap, the daily price job (dates within the last 7 days, ≈ 10k rows/day) keeps running so prices never go stale; worst case ≈ 45.3M/month, still inside the included 50M. Prefetch ledger writes are small and not counted. *Known gap:* Cloudflare's billing period runs from the 2nd (#267) while the counter resets on the 1st IST, so about one day per month is counted in both; small next to the 5M margin. |
| D137 | Cloudflare spending ceiling (owner #270: "Slight extra $ ok, max is $5 + $5 for this month for all Cloudflare usage") | **At most $10 a month in total: the $5 Workers Paid plan plus at most $5 of usage charges.** Cloudflare has no hard spending stop (budget alerts only notify), so the brakes are ours: D1 writes capped (D136, 45M < 50M included); a **daily scheduled infra-check** (19:47 IST) estimates this period's usage charges from Cloudflare analytics (D1 rows written/read, R2 Class A/B operations, R2 storage) and **fails above $4**, which makes GitHub email the owner; Workers CPU (about $0.02 per extra million ms) is read from the dashboard. Owner may add a Cloudflare Budget Alert at $5. Anything expected to exceed the ceiling is asked first. |
| D138 | Second official source for corporate actions (Claude, within D122; found by Phase 1 test 2) | NSE's Bc files omit some actions: the SHRIRAMFIN 1:5 split (ex 2025-01-10) is in no Bc file of 8–10 Jan 2025, so the adjusted series showed a −81% jump. Whole-population comparison with the prefetched per-company lists (`corporates-corporateActions`, 6,084 actions, 2,002 companies, since 2024): **19 price-affecting actions absent from Bc** (9 splits, 5 bonuses, 3 rights, 1 demerger, 1 capital reduction; 0 date mismatches) plus 53 dividends. **Rule:** per-company lists are a second official source, merged into the same parse → factor path (D6, D129, C8; no guessed factors, A13). Past gaps are fixed by a versioned one-time repair from stored share counts and prices (no re-run of old dates, A1); the same repair re-decides loaded actions that an older parser had misread. **Ongoing:** the daily refresh (plan item 2, `workers/prefetch/src/daily.ts`) loads the corporate-action date-range feed (ex-dates −7 … +90 days) into `corp_action_extra` twice a day. |
| D139 | Rights entitlements are not shares; ETF unit splits by owner review (Claude, within D122; found by the whole-universe jump audit) | Of 219 adjusted-series jumps > ±35% across all securities, **145 were rights entitlements** (92 instruments: company ISIN with security-type code 20, symbols "-RE"; rule exact on 107 sessions, 0 mismatches). They are kept (D127) as kind `other`, outside the trading universe (gates, review checks, equity statistics). **ETFs** have no share-count file, so a unit split shows only as a price move: a day move beyond ±35% raises a review with a proposed clean-ratio factor (status `review`, never applied without the owner, A13); before this, ETF moves raised nothing. |
| D140 | Work protocol against loops (owner #273: "It seems like you got into wrong loops or worm hole. Take a minute, think everything, plan a solution and work accordingly.") | **Diagnosis (honest):** each audit result triggered an immediate fix whose check revealed the next class (corporate actions: 4 rounds in 2 hours), plus 4 wrong claims by Claude, while gate items did not move. **Rules:** (1) work only on the current plan item, in milestone-gate order (§14); a finding outside it goes to the to-do with a count, not chased; (2) one cycle per item: whole-population audit → class table → one batch of fixes → one re-audit → done; at most two cycles, then report; (3) no claim without a check; (4) report at item completion and hourly, not per step; (5) items that by rule need the owner (D6 demergers, A13 price-only factors) go to the review queue and are not worked around in code. |
| D141 | Review queue decided by Claude, item by item (owner #274: "You do it manually one by one", replacing the review screen for now) | Claude decides each open review item with **independent evidence** (NSE per-company action list, share counts, announcement text, NSE special pre-open price for demergers), never on a price move alone (A13); without evidence the item stays open. Decisions are applied through migration files in git, one line per item with its evidence and `decided_by: claude (#274)`, so every decision is auditable and reversible; class counts are reported to the owner. Supersedes the owner-review part of D6/D129/D139 while in force; the review screen (B5) moves later. |
| D142 | V1 consultation when stuck (owner #275: "Anywhere you get stuck, we always get feedback from V1. Just give me a prompt… Approving or rejecting V1 feedback is your call… full freedom.") | **Trigger:** an item reaches the D140 limit (two cycles without closing) or Claude has no further evidence-based idea → Claude writes a short prompt (methods, sources, endpoints; not code), the owner relays it to V1 and pastes the answer. **Use:** V1 answers are hypotheses, not facts: validated on V2's own data (whole population, D134) before adoption; ideas, not code; each answer recorded as adopted / rejected with the reason. Amends the clean-slate rule only for owner-relayed answers. |
| D143 | M0 signed off; M1's 10 clean sessions non-blocking (owner #278) | **M0 approved by the owner** with the review screen (B5) moved later (D141). The 10 consecutive clean sessions (M1) are tracked by the daily check and do not block the next items. |
| D144 | Downloads always run ahead of need (owner #278: "any downloads when not running, we should have pending downloads running… so idle time can be utilised effectively") | Extends D128: every source a later milestone needs is downloaded **as soon as its path is verified**, in parallel with current work, one source at a time in milestone order; the list of pending downloads lives in HANDOVER and is checked at every hourly update. Nothing waits for its milestone to start downloading. |
| D145 | Old bank-format results files without any period context are excluded (owner #278: "if required don't use those 275 old format, stocks will have empty financial statements") | The ~275 `banking_entry_point` files whose period is not in the file (no period facts, no dimension-free contexts) are marked *excluded* (not review); the affected bank quarters stay empty until another source exists. Counted separately in the M2 parse rate. |
| D146 | Series break for insolvency capital reductions and merged-away shares (Claude, from the owner-requested web search #278) | Resolution-plan capital reductions (SPENTEX, SABTN, MELSTAR, SUMEETINDS, MBECL, ALPSINDUS, EASTSILK: 90–99% of public capital extinguished, suspension then relisting) cannot be bridged by an honest factor. **No factor; the price series is marked as broken at that date** and charts/returns (M3) do not join across it. A merged-away share (Tata Coffee) ends its series. |
| D147 | Storage policy after V1's answer (owner #279–#280; extends D132) | **Keep originals, compressed:** every ledger object (API lists, XBRL) gzip in R2; older plain objects compressed by a background step (~11.7 → ≈ 3 GB). **Never delete anything downloaded (owner #282):** no expiry, no lifecycle rule, no pruning of R2 originals — V1 expired raw XBRL after 180 days and lost data (1,414 files with no facts copy; text cut at 1,000 chars, also rejected by the owner as risky). The only rewrite allowed is compression, and only after the compressed copy is verified to unzip to the exact original bytes. **Not dropped before a reader exists** (governance, PIT, SAST, BRSR). **Prices: full history** (V1's last-260-closes rejected: adjusted series, returns, Phase 1). **Adopted from V1:** gzip everything; a second daily snapshot run for bulk/block (a missed day is lost). Already in V2: download ledger (no re-reads), value provenance, write-then-mark-done. **Tested and adopted after reading V1's full answer (owner: "test and decide"):** JSON-only API answers and complete-XML check at ingest (retry instead of a silent bad "done"); no-op upserts. **Not adopted:** deterministic gzip mtime (hash dedup suffices), 180-day expiry, last-260-closes prices. |
| D148 | Market-structure storage and loading (M1; Claude within D122) | Loaded from R2 only (no NSE calls), per source in date order, with a per-source day ledger `ms_day` (rows; −1 = file missing; notes such as *possibly truncated (API cap 70)*, *complete daily file*). Tables (compact, D130): `deal` (bulk/block, one row per deal), `short_sell`, `fo_oi_participant`, `fo_ban`, `fii_dii`; **price bands and ASM/GSM as intervals** (`price_band`, `surveillance`: valid_from → valid_to), since they change rarely. Bulk/block prefer the complete daily file (from 2026-11-03); history comes from the API (≤ 70 rows/call, so heavy days are flagged, never presented as complete). Short selling has the same cap. ASM/GSM/FII-DII have no NSE history: from 2026-11-03. |
| D149 | Complete history for the 20-row-capped NSE lists (found while starting the PIT/SAST readers, owner #289) | Per-company lists without dates return only the latest 20 rows (PIT, SAST, board meetings, corporate actions, governance; BRSR 1). Queued once into the same ledger: **all-company monthly feeds 2021 → today** for SAST, board meetings, corporate actions and credit ratings (≈ 280 calls; monthly counts checked uncapped), and **one dated call per company** for PIT, governance and BRSR (≈ 7,900 calls; the all-company PIT feed returns nothing). Their XBRL attachments are queued by the normal discovery. Readers are built on the complete lists; the D138 corporate-action comparison is re-run on the complete monthly feeds. **Rule:** every list endpoint is tested with and without a date range before relying on it. **Readers (built):** `insider_trade`, `sast_disclosure`, `board_meeting`, `credit_rating` (filings DB), one row per NSE row with a stable key — NSE's lists repeat identical rows (PIT) or re-post a rating with only a new timestamp; those collapse, distinct trades never do (tested). Loaded from R2 by a primary-key cursor that waits at an undownloaded list. Replaces the empty M0 placeholders. |
| D150 | Sector map v1 approved; built continuously (owner #291) | `docs/sector-map.json` (74 `smIndustry` values → 22 NSE sectors) approved with all 8 ⚑ rows as proposed; **provisional** until the full value list (all stored announcement lists 2024 →) is collected, then finalised with the owner. Recorded in D1: the map with a version, and each company's sector as history (`classification`: index CSV first, else announcement map, D121). A new `smIndustry` value not in the map is never guessed: the company stays Unclassified and the value is raised for review. **BSE:** the API refuses this container, GitHub and Cloudflare (403); not worked around. A BSE/NSE 4-level list is accepted only from a real exchange file (V1's stored copy, #292, or a one-time owner-machine run), matched by ISIN and checked against the index-CSV sector of the companies already classified before use — **not pursued (owner #294: V1 sector inputs not required)**. **Built (market worker, every 10 min, R2 only):** `sector_map`, `industry_seen`, `sector_file` (market/0024); `/sectors` shows companies by source and sector, unmapped values, and the map-vs-index agreement. |
| D151 | Site v0 public, unlisted (owner #297: "Keep public") | M3 site v0 (dashboard, stock page with market + financials, data-health) is served publicly at M3 instead of waiting for the M7 quality gate / legal consult (changes D13 and D89 for v0 content only). Facts only: prices, index levels, market structure, financials as filed, each with source and as-of; **no AI cards or write-ups until M7** (D84). Kept from D89: `noindex` + robots disallow + no sitemap, rate limits and bot protection on all routes, owner-only routes behind Access. Accepted risks (owner): open legal questions §12 Q3, Q5, Q11; numbers public before the M4 gold set. |
| D152 | Data first, then website; NSE data owner-managed (owner #299–#300) | Site work stops after v0 (rated −10/10, #299; D91 layout not followed). Order: **verify every M0–M2 gate on live data** (M1 tests 4–5, 10 sessions, market-structure gaps, D138 re-run; M2 full loading, FY figures, 5-year coverage per company vs NSE lists, event counts vs NSE, BS/CF backfill, held classes), then a **data-readiness map** of every D91 stock-page and D62/D67 dashboard element (source table, completeness, verified), then design mockups for owner approval, then build. **NSE data licence / pricing: managed by the owner** (§12 Q5, Q11 not a build blocker). |
| D153 | Audience for design (owner #302) | **Youth / Gen Z retail investors, mutual-fund houses, family offices, PMS** (extends D22/D25). A design that looks like an admin page is rejected on sight — by users and by funding investors. Design brief to be written from the owner's earlier design discussion (to be re-shared; not found in the log) before any mockup; the core problem is layering (D25): a visual, simple, shareable first screen for young retail, full sourced depth one tap away for professionals. Design work starts after the data-readiness map (D152). |
| D154 | Write cap 54M for the first month; complete financial statements (owner #315) | **Cap:** D1 rows written per month raised from 45M (D136) to **54M** — the most the $10 first-month budget (D137) allows: $5 plan + 50M included + $1 per million beyond. Kept as a guard, not removed. **Statements:** all three statements (P&L, balance sheet, cash flow) must carry every line item NSE's filings carry, at least what competitors show. Method: census of the line items present in real files by template → full maps with the filing's own sums as checks → gap list vs competitors, naming what NSE's files don't carry (e.g. annual-report notes, PDF only). |
| D155 | Load filings for 250 focus companies first (owner #316) | Filings (results, shareholding, BS/CF, FY backfill) load into D1 only for the current members of **Nifty 50 + Nifty Next 50 + Nifty Midcap 150** (all symbols each has had), set by `FOCUS_INDICES` on disclo-filings; "ALL" widens to everyone later, "slowly". Returns to the original plan (D90/D111: Nifty 50 first). Unchanged: **reader checks (census) still read every downloaded file** (no D1 writes); market data and events stay full-universe (cheap, needed for gates and breadth); nothing already loaded or downloaded is deleted (#282). Trade-off: sector aggregates and the results-season tracker need all companies — they wait for widening. **Widening gate (owner #317: "freeze everything first… no unnecessary Cloudflare or AI usage"):** widen only after the 250 are frozen — every M1/M2 gate verified on them (statement identities, 5-year coverage vs NSE lists, count checks), readers locked (a reader changes only after a full-population census), no AI usage before then. |
| D156 | Scope: whole site on 250 stocks; history windows (owner #320) | The site is built for everything; only the stock universe is limited to the 250 (D155). **No more stock-history downloads**: prices stay from 2024 (D2), financial statements from FY22 (D90). Gap stated: competitors (Screener) show 12 years of annual statements and longer price history. **Indices: 10 years** from NSE's daily index file (`ind_close_all_DDMMYYYY.csv`, checked back to 4 Jan 2016, same format as today's: OHLC, P/E, P/B, dividend yield for every index), downloaded once from GitHub (the archive refuses Cloudflare). yfinance (owner's suggestion) only as a fallback for gaps: it has no index P/E/P/B/yield, not all NSE indices, and Yahoo's terms don't allow republishing. |
| D157 | Financial statements follow the legal formats, shown as heads with sub-rows (owner #320) | Formats as filed: Companies Act **Schedule III Division II** (Ind AS companies), **Division III** (NBFCs), **Division I** (Indian GAAP), **Banking Regulation Act Third Schedule** (banks), **IRDAI** formats (insurers; Ind AS 117 for new filers). Storage: every reported line (D154 detail, checked against its own subtotals). Presentation: per-format layout tree (head → sub-head → line, Schedule III order); two levels on the page — summary heads like competitors (Sales, Expenses, Operating profit, Other income, Interest, Depreciation, PBT, Tax, Net profit, EPS; Equity capital, Reserves, Borrowings, Other liabilities, Fixed assets, CWIP, Investments, Other assets; CFO, CFI, CFF) expanding to the filed lines; derived rows (growth, OPM %, tax %, FCF, CFO/EBITDA, working-capital days, ROCE) computed from stored figures and labelled. Benchmarked on Screener's INFY page (3 Nov 2026). |
| D158 | Freeze and prove; Claude drives the work list (owner #321) | **No 10-year stock prices** (owner: "NO… freeze what we have, prove everything first"); prices stay from 2024. Claude works line by line through `docs/worklist.md` (built from §14 gates, §16, HANDOVER, website.md, FMEA) in order, without waiting for instructions; the owner is asked only for owner decisions (money, legal, design, trademark) and reviews results. |
| D159 | One document (owner #325) | All documentation lives in **`docs/DISCLO.md`**, grouped in 8 parts (state, work list, plan, website, data reference, FMEA, operations, discussion log). The 12 former files were moved whole and verified line-for-line, then deleted (git keeps history). New topics get a section in their part, never a new file. One writer per part: the website chat writes Part 4; both chats append log rows to Part 8. |
| D160 | NSE browser-session compatibility (owner #340; supersedes the request-header part of the earlier rule "no disguised browsers, faked headers", #331/C54) | NSE's site serves its public disclosure feeds reliably only to browser-like sessions. Every NSE request (Workers `prefetch` and `market`, GitHub archive/attachment scripts) uses a realistic, current Chrome `User-Agent`, a matching `Referer` (e.g. `https://www.nseindia.com/companies-listing/corporate-filings-announcements` for API calls), `Accept`, `Accept-Language`, `sec-ch-ua`, `sec-ch-ua-mobile`, `sec-ch-ua-platform`, `Sec-Fetch-Site: same-origin`, `Sec-Fetch-Mode: cors`, `Sec-Fetch-Dest: empty`. **Cookie lifecycle:** warm a cookie jar on the NSE homepage first, reuse it for the whole Worker run, and re-warm **once** if NSE answers 401/403 mid-batch. Still not allowed: proxies, IP rotation, CAPTCHA solving, request rates above the existing limits (D124). Claude's note at decision time: this is a terms-of-use question for the legal consult (§12) before public launch; the code change is scheduled after the P0 deploy (P1), not mixed into the cost fix |
| D161 | Universe lock for new downloads (owner #340) | Until the freeze, **new** daily downloads, sweeps and backfills are limited to the **250 focus companies** (current members of Nifty 50 + Next 50 + Midcap 150, every NSE symbol they have had): per-company list refreshes, the Sunday sweep, XBRL queued from daily lists, the GitHub attachment job. All-company daily feeds that are one call (corporate actions, shareholding list, announcements, insider list, market files) are still fetched whole; only their per-company follow-ups are limited. **Nothing already downloaded for the ~2,636 companies is deleted** (D147); queued files of other companies stay queued. Narrows D127/D128 for downloads |
| D162 | `fin_value` primary key keeps `version` for now (owner #340) | Removing `version` from the key (the cause of the twin-label trap, 4 Nov) needs a table rebuild — billed writes of the order of the 0034 index build (~15M; fin_value ≈ 1.96M rows, but D1 billed ~8× the rows for that build), not the 3–6M Claude first estimated; measure before deciding; deferred until P0 and P1 are deployed and D1 reads are verified stable. Meanwhile `versionPeriod` relabels or drops twins in one indexed pass |
| D163 | D1 cost architecture (audit #338, approved #340) | (1) Recurring (cron) queries read only what they return: indexed ranges or cursors, never a table scan; each is exported and EXPLAIN-checked in `npm run check`. (2) One-off passes never run inside recurring crons; they are started explicitly, bounded, checkpointed every N items, and migrations never delete completion markers to re-run them (P1). (3) Rows read are metered per IST day across all Workers (`market.read_budget`); above 150M/day the optional passes stop, above 3× only essential loads run. (4) Diagnostic pages answer only with `STATUS_TOKEN` and are read once, never polled (C56). (5) Retries back off (6 h doubling) and stop after 8 tries |
| D164 | Monthly write cap 62M (owner #341; replaces 54M of D154; **superseded by D166**, #342) | Raised so daily filings loading is not stopped after the 15.7M-row index build (P0) was charged to the counter. The market daily job stays exempt (D136). Claude's note at decision time: D1 includes 50M writes a month and bills $1 per extra million, so filling the cap costs up to $12 in writes — above the $5 usage part of the $10 ceiling (D137); the daily cost guard (fails above $4) keeps reporting it. **Zero-mass-write rule (owner #341):** no migration or backfill in P1 rewrites a large table or writes millions of rows |
| D165 | Explicit operations instead of standing secrets (owner #341) | Diagnostic pages and one-off passes are reached only through the `ops` workflow (manual): it sets a fresh random `STATUS_TOKEN` on the target Worker, calls the page once (or a `/maint/<name>` pass until it answers done, bounded by minutes) and prints the masked answer in the run log. No token is kept anywhere. The filings `/status` page reads cached counters (`stat_counter`) |
| D166 | Temporary $25 budget and two-tier write caps (owner #342; supersedes D164 and, for November 2026 only, D137's $10) | **November 2026 billing period only:** ceiling $25 ($5 plan + up to $20 of D1 overage); from the next period $10 again. Writes (billed rows, D136 counter, IST month): **soft cap 60M** — one-off passes, back-fills and optional steps stop; **hard cap 68M** — only the live daily filings + events loading continue (the market daily job is exempt as in D136). From December both caps are 54M automatically (`WRITE_CAP_MONTH=2026-11`); the cost guard's alarm is $20 for the 2 Nov period, $4 after. The raise is a safety buffer, not room for mass rewrites: the zero-mass-write rule (D164) stays and D162 stays deferred. Sec-Fetch-Site: same-origin for `www.nseindia.com` API calls, same-site for `nsearchives` downloads (approved, #342) |
| D167 | Cash flow with untagged adjustments: option (a) (owner #343) | For the ≈ 1,240 files whose cash-flow detail does not add up because adjustments are not tagged: when the three section totals (operating, investing, financing) reconcile with the net change in cash (and opening + change = closing), the detail is loaded with one labelled line **"Other adjustments (not itemised in the filing)"** carrying the difference; when the three totals do not reconcile, no line is plugged and the file goes to review. Census of the affected files before the reader changes (D134); reload through the indexed loader |
| D168 | Coverage floor 2024-01-01 for financial statements (owner #344; narrows D90's five years) | Missing financial statements are **not required before 1 Jan 2024**: no reader workarounds, censuses, back-fills or reads/writes to fill quarters ending before it. Nothing downloaded or already loaded is deleted (D147): pre-2024 files in R2 and rows loaded cleanly stay. In code: the loader excludes for good any file for a period before the floor that is not loaded yet (new or retried); coverage gaps are flagged only from the floor (older rows marked out of scope, kept as evidence); the classifier skips them. **D145 stays as decided** (old bank-format files without a reporting period remain excluded; not relaxed) |
| D169 | Half-year-only results files (work list item 2; owner #345) | Some filers submit the second or fourth quarter as a half-year file: reporting period 6 months (seen: COFORGE Mar 2025 has H2 Oct–Mar + FY only; also COFORGE Sep 2026, COALINDIA Sep 2026, BALKRISIND and MANKIND Mar 2025). The quarter is loaded **only** from the file's own dimension-free 3-month column when it exists (`reported`). **Owner #345: a 3-month figure is never generated from a half-year file** (half-year minus the previous quarter is not a filed figure) — without the column the quarter stays empty and the gap stays listed — unless the half-year-dated column is proven to hold the quarter (C62, owner #352: relabelled, values unchanged). **Owner #346: every stored period figure (Q, H, 9M, FY) comes only from the XBRL context for that exact period — never by subtracting or adding other periods' results** (no Q4 = FY − 9M, no FY = sum of quarters, no H = Q1 + Q2). Within-period checks (parts = total) stay as checks only; they never write a value. A year-end half-year file still gives the full year from its own year-to-date column (filed figures, D90; was Q files only). Nothing is written when a quarter for that period is already stored |
| D170 | Zero derivation of financial facts (owner #347) | Every number in `fin_value` is a cell the filer reported: an XBRL fact for that exact period and basis (`reported`) or a PDF cell (`extracted`), with its filing and source tag. **Never stored:** a quarter by subtraction (H − Q, 9M − H, FY − 9M), a full year by adding quarters (Q1 + Q2 + Q3 + Q4) or any other sum, difference or adjustment across periods or lines. Quarter = the file's own 3-month column; full year = the file's own full-year (year-ended) column. Missing column → gap or missing statement, never synthesised. Enforced in the database: filings 0039 triggers refuse any other origin on insert or update; filings 0038 deleted every `computed` row. Within-period identities (parts = total) are checks only. **TTM (owner #350, reverses #348):** TTM = sum of the four latest **filed** quarters (each from its own 3-month column), same basis, **never stored in `fin_value`** (the feature table may store it, D171, owner #358); if any of the four is missing (e.g. a half-year filer with no 3-month column) TTM is unavailable — no substitute (no FY + YTD − prior YTD, no estimate). Missing quarter or year files are fetched later, never filled by arithmetic |
| D171 | Computed values may be stored, in the feature table only (owner #358, changes #350 "never stored") | TTM and the other computed views (D49 EBITDA, D52 adjusted figures and ratios, D66 trend / large order) are **stored in the feature table** (§5.8), rebuilt from filed figures after each load and nightly, so a screener search reads one row per stock instead of every quarter (≈ 120k rows per search computed live; ≈ 120M a day at 1,000 searches against the 150M/day read breaker). Every stored computed value carries origin `computed`, its inputs (the four quarter ends for TTM; the periods for a ratio), the basis and the time it was computed; unavailable values are stored as null with the reason, never a sentinel. **Not changed:** `fin_value` holds only filed cells (D170; filings 0039 triggers stay) — a computed value is never written there and never used as an input to another filed figure. TTM itself is still four filed quarters on one basis, unavailable if one is missing |

### Appendix B — Verification evidence (live NSE checks, 2026-11-02, cloud container)
| Claim | Evidence |
|---|---|
| Archive reachable from cloud | `nsearchives` → 200 for bhavcopy, PR bundle, delivery, index CSVs, EQUITY_L, RSS, attachment PDFs. |
| `www.nseindia.com/api/*` | `corporate-announcements`, `corporates-pit`, `corporate-sast-reg29`, `integrated-filing-results`, `corporate-share-holdings-master`, `corporate-governance-master`, `corporate-credit-rating`, `corporate-board-meetings`, `corporates-corporateActions`, `annual-reports`, `corporate-bussiness-sustainabilitiy`, `corporates-financial-results`, `fiidiiTradeReact` → 200. **`quote-equity` → 403** with and without cookies. `corporate-sast-reg31`, `corporate-pledgedata` → 404/empty. |
| UDiFF start | 2024-01-01 → 200; 2023-12-29 and earlier → 404. |
| MCAP start | PR bundles up to 2024-01-31 lack MCAP; present from 2024-02-01. |
| Exact CA factor from share count | BAJFINANCE ex 2025-06-16: issue size 619,878,652 → 6,198,786,520 = 10.000× (price ratio 9.948×). |
| `PrvsClsgPric` not adjusted | BAJFINANCE prev close 2025-06-16 = 9331.00. |
| ISIN changes on CA | BAJFINANCE INE296A01024 → INE296A01032. |
| NSE 52-week values unadjusted | PD file 9788 / 925. |
| Weekend sessions | Bhavcopy for Sat 2024-01-20 and Sat 2025-02-01; Mon 2024-01-22 (holiday) → 404. |
| Weekend filings | Announcements on Sun 2026-11-02. |
| Announcement volume | 2025-10-01: 629 announcements, 50 categories, ~1.4 GB PDFs, max 41 MB. Oct 2025 (20 trading days): 9,437 total; **Nifty 50: 447 (~22/day), 760 MB, max 23.5 MB.** |
| Category ≠ importance | "General Updates" contained Tata Motors' JLR IT-security update; "Analysts/Investor Meet" (75) = 36 schedules, 10 recording links, 9 transcripts; "Press Release" included TCS's US acquisition. |
| Results XBRL scope | INFY Q3 FY25 consolidated (`in-bse-fin`): 81 contexts, all Oct–Dec 2024 or Apr–Dec 2024, **no comparatives**. Half-year (Sep-2024): 219 tags incl. balance sheet + cash flow, current period only. |
| Integrated Filing | Sun Pharma Q2 FY27: Financials XBRL (consolidated + standalone, 220 tags); Governance XBRL (104 tags incl. investor complaints). |
| BRSR | Sun Pharma FY26 XBRL ~2,000 facts: NIC product + % turnover, exports 72.3% (standalone), 17 national plants, 24 international offices, 90 countries, standalone revenue ₹20,755 cr. |
| Index closes | `ind_close_all_DDMMYYYY.csv`: ~167 indices with OHLC, P/E, P/B, yield; 2024-01-01 available. |
| FII/DII | `fiidiiTradeReact`: latest day only. |
| Insider feed | 88 PIT rows for 27–31 Oct 2025 across all equities (completeness to verify). |
| Nifty 50 composition | Current list: 12 financials (banks, NBFCs, insurers, BSE), 15 industries; **TMPV** = Tata Motors passenger-vehicle entity after the 2025 demerger. |
| **Reachability from Cloudflare (probe run #3, 2026-11-02 17:43 UTC, Cloudflare colo DFW)** | **200:** UDiFF bhavcopy, PR bundle, Nifty 50 list, EQUITY_L, announcements RSS, announcements API (with and without cookies, incl. date range), announcement PDF; homepage 200 (Akamai bot cookies set). **403:** `quote-equity` (with and without cookies), as from other clouds, so D8 (owner's machine) stands. **Conclusion: NSE does not block Cloudflare for every source the pipeline needs; the D54 relay fallback is not needed.** Further scheduled runs (3×/day for ~2 days) check consistency across times of day. |
| `quote-equity` directly from a GitHub Actions runner (owner reported it works there; run 2026-11-02 17:45 UTC) | Homepage **403**, quote page 302, `quote-equity` **403** (Akamai "Access Denied") with a browser-like cookie flow. Not reproduced; owner asked how it was done (library/endpoint/headers). D8 unchanged until then. |
| Method that reportedly worked from a GitHub runner (learned 2026-11-02 by reading only the owner-permitted quote-equity fetch code, #228) | Same endpoint `GET /api/quote-equity?symbol=X`, read `industryInfo`. **No special library:** Python `httpx` client, HTTP/1.1 (no HTTP/2), redirects followed. Session headers: Chrome-120 Windows User-Agent, `Accept: application/json, text/plain, */*`, `Accept-Language: en-US,en;q=0.9`, `Referer: https://www.nseindia.com/` (root, not the quote page). One best-effort homepage visit for cookies first (code comment: APIs answered even when that warm-up got 403). 3–5 s random pause between requests; 401/403/429 = stop the run, no retry. Plain GitHub `ubuntu-latest` runner, no proxy. **Differences from our failed curl test:** client/TLS stack (Python vs curl), HTTP/1.1 vs curl's HTTP/2, Accept header, Referer. **Not verified:** the code doesn't show whether its run succeeded, and that run predates ours (≈Oct 2026); runner IPs vary. Next: replicate this method from our runner (needs owner OK). D8 unchanged until a run returns `industryInfo`. |
| **Replication test** (#230; GitHub runner, 2026-11-02 17:56 UTC, run 41495737305) | **All 403 (Akamai "Access Denied").** httpx HTTP/1.1 with the learned headers: homepage 403 (only `AKA_A2` cookie), `quote-equity` ITC 403, INFY 403. Control, curl HTTP/1.1 same headers: homepage 403, ITC 403. Old curl job in the same run: 403. **Reading:** the homepage itself is refused, so the block is on the runner's IP range, not on request shape; client, HTTP version and headers don't change it. One run / one IP so far; the 3×/day schedule repeats both jobs on other runner IPs. **D8 stands** (owner's machine) unless a scheduled run returns `industryInfo`. |
| BSE `ComHeadernew` (D120) probe, 2026-11-02 18:02 UTC, run 41496746561 | **GitHub runner:** ITC, INFY, HIKAL all **403** (Akamai "Access Denied"). **Cloudflare (colo ATL):** ITC, INFY **403**. Same run, Cloudflare: all NSE pipeline sources 200, NSE `quote-equity` 403 (consistent with run #3). **Conclusion: neither exchange's per-company classification answers from cloud IPs; it runs from the owner's (Indian residential) connection.** |
| BSE `ComHeadernew` method, as described by owner (#232; not run in V2) | Per company, from a home connection: one cookie visit to a BSE web page, then `ComHeadernew?quotetype=EQ&scripcode=…` with browser-like `Origin`/`Referer` headers. Levels in fields `Sector`, `IndustryNew`, `IGroup`, `ISubGroup` (broad → narrow); BSE often repeats a name at two levels (e.g. ITC). 403 = network blocked (stop); 429/5xx = back off. Reported to have answered from a home connection on 16 Oct 2026. **Design note:** store the four raw levels as separate columns; joining them and dropping repeats loses which level a name belongs to. |
| **Structured filings from Cloudflare** (#234; 2026-11-02 18:11 UTC, colo SJC, run 41498012085) | **All 14 → 200 with JSON:** `corporates-pit`, `corporate-sast-reg29`, `integrated-filing-results` (Financials), `corporate-share-holdings-master` (INFY, HDFCBANK), `corporate-governance-master`, `corporate-credit-rating`, `corporate-board-meetings`, `corporates-corporateActions`, `annual-reports`, `corporate-bussiness-sustainabilitiy`, `corporates-financial-results` (INFY; HDFCBANK, bank template `bank:"B"`), `fiidiiTradeReact`. Params: `index=equities&symbol=X` (+`period=Quarterly`; integrated needs `type=Integrated%20Filing-%20Financials`). Sent with homepage cookies, one call at a time, 0.4 s apart. **Finding:** `corporate-credit-rating` **ignores `symbol`** and returns all companies' ratings (~560 KB): use it as one bulk feed, filter by ISIN. **Not yet tested:** sustained volume (≈10 calls × 1,000+ companies per refresh) → NSE rate limits; to measure in M0 with a paced backfill. |
| **First Cloudflare runs of the market Worker** (2026-11-03 00:50 IST) | Production loaded 2024-01-01, -03, -05 (≈2,130 stocks/day, delivery ≈2,600, ≈108 indices). **Archive refused (403) 2 of the first ~24 file requests at 4 parallel** from Cloudflare (2024-01-02 bhavcopy, 2024-01-04 PR bundle); back-off handled it, dates retried next run. So the archive does refuse some fast requests from Cloudflare (D124 back-off needed). Staging rejected 2026-10-21…30 on the MCAP-join gate → cause: ETFs (D126). |
| **Incident: duplicate securities (2026-11-03 01:00–01:30 IST)** | Dates retried after a later date had loaded (403 retries, gate rejections) created a second security for companies first seen on the later date; staging reached 4,352 securities (expected ≈2,630) and 6,870 identity-conflict reviews; production hit errors on BLSE/MAGNUM-RE. **Fixes:** identifier start date is extended back when an earlier date loads (`extend_back`); strict date order (a run stops at the first date that didn't load); conflicts go to review instead of failing the day; refused files retried in-run (3/6/12 s). **Data:** tonight's market data wiped in both environments (migration market/0004, app/0002) and reloaded; staging reload clean (9 sessions, 2,634 securities, 0 failures). No public impact (nothing is published yet). |
| **Archive prefetch from a GitHub runner (D128, 2026-11-03 02:00–02:38 IST)** | 4,152 requests (4 daily files × 1,038 dates, 2024-01-01 → 2026-11-03) at **8 parallel: 0 refusals**, 2,995 files / 800 MB stored in R2 `cache/`, 1,157 × 404 (weekends/holidays). **So the owner is right that the archive doesn't throttle bulk download; the refusals are specific to Cloudflare's egress IPs.** Also: for some missing files the archive answers 403, not 404 (2024-01-27/28), so 'no session' is decided by the PR bundle. |
| **API prefetch from Cloudflare (D128)** | 31,656 jobs (12 endpoints × ~2,635 companies + ratings + 35 announcement months). First 25 min: ~7,900 fetched, 450 MB; NSE refused ~20 (≈0.3%), each refusal pauses that batch; ~300–400 calls/min sustained. |
| **NSE serves a PR bundle under the wrong date** | `PR060424.zip` (6 Apr 2024, a Saturday with no bhavcopy) contains `MCAP04062024.csv`, `Bc040624.csv` … i.e. **4 June 2024** files. Guard added: the bundle's Bc file name and every MCAP trade date must match the requested date, else the bundle counts as missing (no session if the bhavcopy is also 404; otherwise the date is rejected for review). |
| **Cloudflare usage after the first night (2026-11-03 05:42 IST, #254)** | D1: market 486 MB, filings 55 MB, others < 1 MB each (limit 10 GB per database; 5 GB storage included). Rows written 24 h: market 13.9M, filings 0.8M, staging 1.2M (included 50M/month; ~30% used by tonight's repeated reloads, steady state ≈ 10k rows/day). Rows read 24 h ≈ 560M (included 25B/month); the main reader is the ±5% row-count gate scanning `price_daily` per date — to optimise. R2 `disclo-raw`: 7.83 GB, 86,454 objects (10 GB included; finishing attachments adds ≈ 2.7 GB → ≈ $0.02/month overage at $0.015/GB). |
| V1 evidence supplied by owner (#231) | V1's own GitHub probe (22 Oct 2026) also got **403** on `quote-equity`. So `quote-equity` was never shown to work from GitHub; the earlier recollection likely referred to BSE's quote header run from a home connection. |
| NSE EOD licence | Tariff (Apr 2026): Capital Market EOD ₹1,00,000 (domestic) per display medium; website and app are separate mediums. |
<!-- END docs/PLAN.md -->

# Part 4 — Website

<!-- BEGIN docs/website.md -->
## Website — everything discussed, decided, built and pending

**Compiled 2026-11-03** (accepted proposals: first chat §10b, build chat §10c) from: the full transcript of the first planning chat (**both sides**: owner statements #1–#227 and Claude's proposals they answered, read directly, not from summaries; §10b), `docs/discussion-log.md` (#228–#302, the build chat), `docs/PLAN.md` (D1–D153, §7.5, §8, §12, §14, §16), `docs/HANDOVER.md` and `docs/field-catalogue.md`.
**Rule used:** nothing assumed. Every line cites its decision (D…) or log entry (#…). Where something was proposed but never decided, it says so.

**Status marks:** ✅ decided · 🔨 built in site v0 (now offline) · 🔶 open / pending · ❌ rejected · ⚠ conflict or gap to resolve

---

### 0. Where the website stands today

- 🔨 **Site v0 was built and briefly live** (3 Nov 18:16 IST, `disclo-web`, public unlisted, D151): dashboard, stock page, data-health page (§9 of this document).
- **Owner rated v0 −10/10** (#299): it looked like an admin page, with tables first, no visual hierarchy and no Key facts, and the agreed stock-page layout (D91) wasn't followed (#300).
- ✅ **v0 taken offline** (#301, D152): public address and previews disabled; any request gets 503 + noindex.
- ✅ **Order now (D152):** data first (M0–M2 gates verified) → **data-readiness map** for every stock-page and dashboard element → **design mockups for owner approval** → only then UI code.
- ✅ **No site UI code until the owner approves a visual design** (proposed #299, adopted in D152).

---

### 1. Purpose, audience and bar

| Item | What was said / decided | Source |
|---|---|---|
| Purpose | Investors of any type should be able to **take a decision after reading a card**; it must carry **full context** | #68, §7.5 |
| Audience (first chat) | Investors, **family offices, institutions**; "clean website for investors, family office and other institutions if everything goes well" | #62, D22 |
| Audience | **Both** retail and institutions → layered depth (quick summary first, full sources one tap away) | #66, D25 |
| Audience (build chat) | **Youth / Gen Z retail, mutual-fund houses, family offices, PMS.** "Such a design will straightaway go to rejection… no chance of investors for funding or even free subscribers" | #302, D153 |
| Bar | **"Best in class; a benchmark for all"** | #170, D95 |
| Bar | "Website must be faster, modern and expandable, as this project is going to be huge" | #20 |
| Business | No ads, no sponsors; **free for about the first 5 years**; paid tier later for institutions, after the product is robust | #56, #62, #64, D22, D23 |
| Pitching | Owner needs a working product with testers to pitch users and investors ("without testing everything and a few beta testers, how am I going to pitch?") | #159, D87 |

⚠ **Gap: the Gen Z / MF houses / PMS audience and any visual direction are not in the first chat.** I read every owner message of the first planning chat (#1–#227). There's no mention of youth, Gen Z, mutual-fund houses, PMS, colours, typography, reference designs or a visual style. The only design inputs there are: light theme, mobile-first, English, "best in class", the two example cards from another site (#63), StockScans and Tijori as feature benchmarks (#112, #125), "card for social media sharing: yes" (#67), and "must be faster, modern and expandable" (#20). **If that design discussion happened, it was in a different chat (or with V1) and never reached these documents.** Please paste or restate it (also requested in #302).

---

### 2. Product principles that shape what the site may show

| Principle | Source |
|---|---|
| **Cards: no score, rating or positive/negative label**: facts, comparisons with the company's own past, context | D21 (owner #70) |
| Cards and data are factual; **judgement only in labelled AI write-ups** | §2 #10, D80 |
| Every number traceable to its filing and page; source on hover/tap | §2, D91 |
| Neutral language, no hype words ("fantastic", "strongly positive") | §7.5 (from the critique of the other site's cards, #63) |
| Estimates always labelled "estimate", with the method shown | D72, D77, D82 |
| Explicit links only in the relationship graph; never guess | §2, D37–D39 |
| Owner-only items never appear on public routes or caches | D53, D93 |
| Unlisted companies get **no public pages** at launch | #238, D39 (e) |
| ❌ Rejected: "result quality" / "management sentiment" scores (seen on StockScans) | D67 notes, §1 |

---

### 3. Platform, look and technical decisions

| Topic | Decision | Source |
|---|---|---|
| Name and domain | **Disclo, `disclo.in`** (bought; final per #239). `disclo.com` belongs to a US HR-software company | D99, #202, #239 |
| ⚠ Name history | In the first chat the owner said "thinking of a different name for launch" (#204); in the build chat "Disclo, https://disclo.in/" (#239) is recorded as final. Trademark check pending (owner) | #204, #239, D119 |
| Hosting | Cloudflare (Workers + static assets), React + Vite front end, Hono API Worker, D1/R2 | §3, D12, D108–D110 |
| Platforms | **Web only, mobile-first**; no app (an app is a separate NSE licence medium) | #177, D101 |
| Theme | **Light only** | #175, D100 |
| Language | **English only** | #178, D103 |
| Accessibility | Formal WCAG target **later**; basic contrast, keyboard use and alt text from day 1 | #176, D102 |
| Charts | TradingView **Lightweight Charts**; on-chart logo off, required notice + link on a credits page (removing attribution entirely is a licence violation, so not done) | #180, D105 |
| Time | Stored UTC, **shown IST** everywhere | D114 |
| Freshness | Public "data updated HH:MM IST" | D46 |
| Login | **Google sign-in only**, no magic links | #105, D63 |
| Accounts | Everything readable **without an account**; accounts add watchlists, saved queries/screens/baskets and **on-site alerts** | D60 |
| Alerts | No email/Telegram alerts to users; on-site only; owner gets email alerts | D13, D45, #49 |
| Analytics | Cloudflare Web Analytics (free, cookie-less) from day 1, for pitching numbers | #173, D98 |
| Security | HTTPS/HSTS, CSP, frame/referrer/permissions headers, secure session cookies | D117 |
| Abuse/cost | Rate limits + bot protection on all routes; costly features (plain-English queries) signed-in only, daily cap | D89, D64 |
| Search engines | `noindex` + robots disallow + no sitemap **until the owner decides** | D89 |
| Performance | Cached TTFB ≤ 200 ms (India); stock page main content ≤ 2.0 s on mid-range 4G; API p95 ≤ 300 ms cached / ≤ 800 ms uncached; query builder ≤ 2 s (Nifty 100), ≤ 5 s (all) | D94, §14 |
| Scale | Built for ~1 lakh visitors/day × 5 pages: page-level aggregated endpoints, CDN-cached responses on the custom domain, < 50 ms public queries, separate feature-table database; ≈ $8–15/month hosting | #183, D108 |
| API | One versioned API (`/api/v1`) for the site and future paid clients; public / signed-in / owner-only route families; provenance on every response; `as_of`, `basis`, `adjusted`, `restated` parameters | #168, D93 |
| Exports | Built from day 1, **owner-only until the data licence**, then signed-in users | #181, D106 |
| User data | Deletion/export on request (DPDP); error reports kept 2 years | #181, D107 |
| Legal pages | Terms, Privacy, Disclaimer, Credits, Contact; needed for Google sign-in | D115 |
| Email | `info@`, `alerts@`, `paresh@disclo.in` forwarded to the owner (receive-only) | D116, #285 |

---

### 4. Launch and access

| Step | Decision | Source |
|---|---|---|
| Launch mode | **Open public, unlisted**, no marketing; no closed beta | #162, #163, D89 |
| Gate | Opens only after the **quality gate** (daily-audit error rate low for 14 days, zero critical errors, etc.) | #164, D84, D89, §14 M7 |
| Site v0 | Facts-only v0 made public early (no AI cards/write-ups) | #297, D151 |
| Then | v0 offline; data first; mockups before code | #300, #301, D152 |
| Owner-only area | Behind Cloudflare Access | D13, D53, §8.2 |
| Legal | Consult recommended before open public; owner's stance: launch first, comply when required ("Uber model"); NSE data/licence now **owner-managed** | D87, D88, D152, §12 |
| AI judgement write-ups | Public **including judgement** ("else why will people pay"), **held behind Access until the legal consult** | #151, D80 |

---

### 5. Pages and their agreed contents

#### 5.1 Home = market & indices dashboard ✅ (D59, D62, D67; owner #102: "a best-in-class KPI dashboard plus what you mentioned")
- End-of-day, clearly labelled as EOD
- ~167 NSE indices: levels and trends; **index P/E, P/B, yield vs their own history** (percentiles)
- Breadth: advances/declines; **% of stocks above EMA 20/50/100/200**; **daily thrust** (stocks ±4%); **52-week highs/lows** (adjusted prices)
- Broad-index panel (Nifty 50, 500, Smallcap 250, Microcap 250)
- Sector and industry performance (our classification)
- FII/DII flows (history from go-live)
- Market structure: F&O participant OI, F&O ban list, ASM/GSM entries
- **Results-season tracker** (how many reported, % above own trend, guidance raised vs cut)
- Latest important cards; upcoming calendar (results, AGMs, concalls); search
- "Data updated HH:MM IST"
- Owner: "will add more later if required" (#108)

#### 5.2 Stock page ✅ (D91, D92; owner #165: "5 years ok, AI write-up first, one long page")
**Shape:** one long page; sticky section menu on desktop, **collapsible sections on mobile**; sections load lazily.
**Controls at the top:** time-machine date (D69) · consolidated/standalone (primary basis default, D50) · reported/adjusted (adjusted default, D52) · original/restated (latest restated default, D48) · **source on hover/tap for every number**.
**Order:**
0. **Header:** name, symbol, ISIN, sector, index memberships, promoter group, EOD price + change, market cap (₹ cr, no decimals), 52-week range (adjusted), data as-of, watchlist button
1. **AI analysis write-up first** (fundamental/technical/research, with judgement, labelled; D80)
2. **Latest quarter in brief** (D92): 5–8 factual bullets with source + page: what management said (reported / guidance / aspiration), what changed vs last quarter, guidance raised/cut/kept/dropped, top analyst concerns, **questions management declined to answer** (owner: keep it, #167); shows which sources it covers; updates through the day
3. **What changed** (since your last visit if signed in, else last 7 days)
4. **Key facts:** valuation vs own history and industry, growth vs own trend, margins, ROCE/ROE, net debt, promoter holding + pledge
5. **Cards and timeline** (including memory-only items)
6. **Financials:** up to 12 quarters + **5 years** annual (D90), profit bridge, segment results, ratios
7. **Business:** segments and product mix (NIC), exports/geography, major customers, raw materials (stated vs industry default), plants/capacity/utilisation, **commissioning watch** (facts **and** labelled estimate of extra depreciation, interest and margin effect, all public; D82), repeat orders
8. **Management and guidance:** guidance tracker, commitments (silently-dropped flag, D33), credibility ledger, concall metrics, analyst concerns, management changes
9. **Ownership:** shareholding trend, pledges, insider panel (cards only past thresholds, D29), SAST, bulk/block deals, tracked investors, group companies
10. **Credit, governance and forensics:** ratings + **rated bank-facility amounts** (D81), governance, auditors, complaints, disclosure timeliness, disclosure-regression flags, forensic panel (no score), red flags, ASM/GSM
11. **Price and market:** adjusted/raw chart with corporate-action and event markers, delivery %, technicals, returns vs index and sector, unexplained moves
12. **Peers and links:** industry peers, graph-linked companies
13. **Documents and corporate-action history**

Owner-only panel on the stock page (Access): signals, scenarios, research chat.

#### 5.3 Sector / industry page ✅ (owner idea #117, D70)
"One page that speaks for the whole sector": aggregated results trend, guidance raised vs cut, **sector commentary map** (what every company said this quarter, with quotes; D69), valuation vs own history, KPI-pack comparison, leaders/laggards, red flags, raw-material exposure, upcoming results.

#### 5.4 Card feed ✅ (§8.1, D42)
Filters by stock, event type, materiality, confidence; **"report an error"** on every card.

#### 5.5 Query builder ✅ (owner #104: "required and must be easy"; #109: all 3 modes; D61, D64)
- Three ways in: **plain English** (Gemini translates into our query language, shown as editable chips; **the LLM never writes SQL**; signed-in only, daily cap, cached), **visual chips**, **text expression**
- "Not understood: …" instead of guessing; a null never matches
- Saved screens + "what changed since last run"
- Fields: `docs/field-catalogue.md` (approved, D123)

#### 5.6 Trackers ✅ (owner #133, D78)
Sector KPI trackers (telecom ARPU, cement/steel EBITDA per tonne, etc.; company-reported vs computed), segment-margin trackers (only where disclosed, e.g. machining/castings), export share vs margin, repeat orders from **named** customers (disclosed orders only). Export "mix-drag" estimate is owner-only.

#### 5.7 Other public tools ✅
- Announcement keyword scans + on-site alerts (D67)
- Bulk/block deals and **tracked investors** (named holders ≥ 1%) (D67)
- Custom baskets, returns vs indices, peer comparison (D67)
- **Niche sector indices** (e.g. NIC-based castings) (D75)
- Exposure queries over the graph ("who has disclosed orders from Indian Railways") (D69)
- Unexplained-move panel (D69)
- **Time machine** (any page as of a past date) (D69)
- Disclosure timeliness, disclosure-regression detector, management credibility ledger (D69)
- City/state filtering of plants (no map view) (#132, D77)
- **Search everything:** companies, symbols, aliases, people, investors, products, plants, **full text of filings** (#179, D104)

#### 5.8 Data-health page ✅ (§8.1)
Last runs, review-queue sizes, freshness.

#### 5.9 Legal pages ✅ (D115)
Terms, Privacy, Disclaimer (AI analysis, not advice; estimates labelled), Credits (TradingView notice, data sources), Contact. Drafts only until the legal consult.

#### 5.10 Owner-only area (Cloudflare Access) ✅ (§8.2)
Upcoming-results signals + outcome ledger (predictions only after a backtest beats the baseline, D53); scenario calculator incl. commodity shocks (D73); event-impact screen (D77); export mix-drag (D78); pre-announcement insider-trade timing (D69); portfolio X-ray (D75); research chat (D68); rated-facility signal interpretation (D81); correction screen (D35); review queues (B5, moved later, D141); gold-set & cost dashboard.

#### 5.11 Future paid tier 🔶 (D23, D93)
Accounts, API keys, exports, per-plan limits designed in; not built. External keys/exports only after licence + legal consult.

---

### 6. Cards (the core content unit)

| Item | Decision | Source |
|---|---|---|
| Goal | Decision-ready with full context | #68 |
| Score | None (no score, rating or positive/negative label) | #70, D21 |
| Fields | headline, event type; what happened (cited facts); numbers (value, unit, period, basis, source; reported + adjusted; profit bridge); vs past context (confirms/contradicts/new); **materiality = factual size only** (e.g. order = x% of TTM revenue); linked impacts (one hop); red flags (separate, never netted); watch items; technical context; provenance; confidence gate (published / "unverified" badge) | §7.5 |
| Writing rules | Neutral language; reported and adjusted side by side; explain *why* (profit bridge); label claim strength; **one card per event, updated as filings arrive**; disclaimer on every card | §7.5 |
| Sharing | Shareable image generated from the web card | #67, D25 |
| Sections and their order | **Deferred until real output** (owner #72, #147) | D25 |
| Linked-company cards | Own card only if named **and** ≥ 2% of the linked company's TTM revenue/market cap | D38 (confirmed #236) |
| Insider cards | Only past thresholds (≥ 0.25% equity or ≥ ₹50 cr / 30 days, any pledge increase, trades in trading-window closure, KMP buy ≥ ₹1 cr) | D29 |
| When | No AI cards on the public site before the M7 quality gate | D84, D151 |

Claude's proposals in the first chat, **not decided** by the owner (recorded for the design brief): a 12-section decision-grade card; default view = summary, score drivers, numbers and what to watch, rest folded under "full context" (the score part was later dropped by D21). Owner: "will decide later based on content and quality of card" (#72).

---

### 7. Benchmarks and inspiration the owner shared

| Shared | Owner's words | What came of it |
|---|---|---|
| Two example cards from another site (Sun Pharma results, MTAR concall) | "Example but not exactly what I want. I am going to build is more useful" | Card writing rules (§6); critique: missing *why*, hype labels, no claim strength, no linked companies |
| StockScans | "See if we could benchmark anything for our side" | D67 adoptions; their scores rejected; noted they license data (CMOTS), Free + ₹500/month |
| Tijori (and its social media) | "May give you more glimpse" | Niche indices + portfolio X-ray adopted (D75); raw-material prices, macro indicators, social trends → later |
| Screener guide | One-off example | Ratio conventions (D52); Screener-style summary is one *view*, not the storage format (D47) |
| Name style | Short names like Zepto, Rapido, Zomato | Disclo chosen (#202, #239) |

⚠ **Not shared anywhere in the record: any reference site for the *visual* design.** Asked in the first chat (Q2: "Any sites whose look you like?"); the owner answered only "light" (#175).

---

### 8. Differentiators planned for the site ✅ (owner #116: "adopt all as recommended, phasing ok"; D69)
Time machine; disclosure regression detector; management credibility ledger (per company and named executive); sector commentary map; "what changed since your last visit"; disclosure timeliness; unexplained-move panel; concall audio → provisional same-day summary; forensic panel (no score). **Phasing:** data foundations from day 1, screens released after the Nifty 50 core passes acceptance.

---

### 9. What site v0 actually contained (built 3 Nov, now offline) 🔨
From HANDOVER / #297–#298:
- API `/api/v1/{dashboard, securities, stocks/:symbol, health}`; edge cache; per-IP rate limit (120/min); noindex on every response; robots disallow
- Dashboard (precomputed every 10 min); stock page (adjusted chart, quarterly results with original vs restated and filing links, balance sheet, cash flow, shareholding, PIT, board meetings, ratings, corporate actions); data-health
- After #298, aligned with: light theme, chart logo off + credits notice, restated default + switch, ISIN, 52-week range, section menu, "data updated" in IST, legal-page drafts, EPS adjusted for splits/bonuses
- Measured from a US container: stock API 290–560 ms uncached; cached TTFB 0.19–0.41 s; phone-on-4G main content 0.75–0.82 s (one cold load 2.08 s). **Not yet measured from India.**
- **Not built** (agreed): dashboard EMA participation, 52-week extremes, results-season tracker, calendar; stock page **Key facts** and **5-year annual view**; collapsible sections on mobile; source on hover/tap for every number (only period links); custom domain + zone bot protection; owner review screen

---

### 10. Pending — needs the owner or still to be discussed 🔶

**Design (blocking any UI work, D152, D153):**
1. **Your earlier design discussion** (Gen Z / MF houses / PMS, visual style). Not in any record I hold. Please paste or restate.
2. **Reference sites/apps whose look you like** (never given; Q2 got only "light").
3. **Design system and UX standards** ("still to be agreed", D95): typography, colour, density, components, number formatting, chart style.
4. **Layering for two audiences** (D25, D153): the core design problem. A visual, simple, shareable first screen for young retail, with dense, sourced, exportable depth one tap away for professionals.
5. **Card sections and order**, after real output (D25).
6. Mockups → owner approval → build (D152).

**Product decisions still open:**
7. Accessibility target (later, D102).
8. When to allow search engines (noindex stays until you decide, D89).
9. Paid-tier contents and pricing (later, D23).
10. Trademark check for "Disclo" (owner, D119).

**Prerequisites before the site returns (D152):**
11. Data-readiness map for every stock-page and dashboard element (source table, completeness, verified).
12. Custom domain `disclo.in` on the site + zone bot protection; measure performance from India.
13. Quality gate (M7) before AI cards/write-ups go public; legal consult for judgement write-ups (D80) and public estimates (D82).

---

### 10b. Claude's proposals you accepted ("ok", "yes", "agree", or no objection) — first chat
Source: **Claude's own messages** in the first planning chat, matched with your reply. "Recorded" = already in PLAN/website.md before this pass; **"added now"** = was missing and is recorded here for the first time.

| # | Claude proposed | Your reply | Status |
|---|---|---|---|
| 1 | Separate API Worker (Hono) + React/Vite front end; same API for site and future clients; responses edge-cached until the next data update | "Option 1" | Recorded (§3, D93) |
| 2 | Dashboard contents (167 indices, valuation percentiles vs own history, breadth, sector performance, FII/DII, results-season tracker, cards, calendar, search); **EOD, and the page must say so** (live needs a licensed real-time feed) | "Content as above, will add more later" | Recorded (D62). *Added now:* the EOD label is a requirement |
| 3 | Everything readable without an account; account only for watchlists, saved filters, on-site alerts | "You are right" | Recorded (D60) |
| 4 | Query builder: 3 modes, plain English → our language → editable chips, LLM never writes SQL, signed-in + daily cap, saved screens + "what changed", "not understood" instead of guessing | "All 3", "Gemini call needed and understand" | Recorded (D64) |
| 5 | **Factual materiality** (order = x% of revenue, deal = y% of market cap) instead of a score, so cards can still be sorted/filtered | No objection after "No score at all" | Recorded (§7.5 card field) |
| 6 | "More useful card" list: explain *why* (profit bridge); every number clickable to filing + page; claim-strength labels; commitment tracker; corrections replace earlier facts; connected numbers (order book ÷ revenue, OCF ÷ PAT, debt after capex); neutral language; "what changed since last quarter"; **layered depth: 30-second summary on top, full detail one click away** | Your answer: "A card where investors can take a decision… full context" | Recorded (§7.5 writing rules, D25). *Added now:* the full list is the card design brief |
| 7 | **12-section decision-grade card**: (1) one-line factual verdict, (2) [score + drivers, dropped by D21], (3) reported vs adjusted + profit bridge, (4) vs own past: 8-quarter trend, guidance tracker, commitments due, (5) quality of earnings, (6) management said (claim-labelled, speaker) + analysts asked, (7) what changed since last quarter, (8) red flags + missing disclosures, (9) linked companies, (10) market context from bhavcopy, (11) what to watch with dates, (12) every number linked to its source. Suggested default view: 1, 3 and 11, the rest folded under "full context" | "Will decide later based on content and quality of card" | *Added now* as the **starting proposal** for the card-section decision (D25 open) |
| 8 | Shareable image generated **from** the web card (web card = main format) | "Card for social media or sharing yes" | Recorded (D25) |
| 9 | Stock page = one long page because: Ctrl+F works, **a link can point to a section**, nothing hidden behind clicks (tabs tidier on mobile) | "One long page" | Recorded (D91). *Added now:* **shareable links to each section** (anchor per section) |
| 10 | AI write-up placement: considered "What changed → Key facts → write-up"; asked if write-up should be first because it's what people pay for | "AI write-up first" | Recorded (D91) |
| 11 | Latest-quarter brief: 5–8 bullets, sources listed, claim labels, guidance changes, analyst concerns, declined-to-answer, updates through the day | "Format ok, keep declined to answer" | Recorded (D92) |
| 12 | Freshness line "data updated HH:MM IST" | "Status yes" | Recorded (D46) |
| 13 | "Report an error" link on every card | "Report error link yes" | Recorded (D42) |
| 14 | Correction process: versioned cards, visible "corrected" note | "All ok" | Recorded (D35, D42) |
| 15 | Closed beta (invite-only, ~50 users via Access, free) for testers and pitching | Rejected: "Keep open public… not going to tell everyone" | Recorded (D89) |
| 16 | Unlisted ≠ private: noindex, robots, no sitemap; rate limits + bot protection mainly for **cost and scrapers**; costly features signed-in only | "Ok" / "Who uses workers.dev?" | Recorded (D89, #163) |
| 17 | Open public only after the quality gate | "Wait for quality gate" | Recorded (D89, §14 M7) |
| 18 | Accessibility: WCAG 2.1 AA recommended | "Later" | Recorded (D102: basic contrast/keyboard/alt text from day 1, Claude's addition, not objected) |
| 19 | Analytics: Cloudflare Web Analytics, free, **no cookies, so no consent banner needed** | "Analytics yes" | Recorded (D98). *Added now:* no cookie-consent banner required for analytics (sign-in cookies are essential cookies; the privacy page explains them, D115) |
| 20 | Charts: Lightweight Charts with on-chart logo off + notice on credits page (full removal = licence violation) | "Yes… hide it" | Recorded (D105) |
| 21 | Exports: built day 1, owner-only until licence, then signed-in users | No objection | Recorded (D106) |
| 22 | Search scope options; full-text inside filings = "most powerful, most work" | "Everything" | Recorded (D104) |
| 23 | No app; mobile-first web (app = separate NSE licence medium) | "Web only but mobile first" | Recorded (D101) |
| 24 | Plain-English queries cost a Gemini call each → signed-in only, per-user daily cap, cache identical questions | "Understand" | Recorded (D64) |
| 25 | Hosting at scale: page-level aggregated endpoints (1–3 calls per page), CDN caching on the **custom domain** (workers.dev can't), < 50 ms public queries, separate feature-table database | No objection; "stay on Cloudflare" | Recorded (D108) |
| 26 | Legal pages needed before Google sign-in (OAuth consent screen needs privacy + terms URLs on our domain) | "Update all documentation" (accepted as part of D114–D118) | Recorded (D115) |
| 27 | Security headers + secure session cookies | Same | Recorded (D117) |
| 28 | Cloudflare one-click toggles: Bot Fight Mode decide **at launch** with rate limiting (can block legitimate API callers on Free); leaked-credentials protection **not needed** (Google sign-in, no passwords); Client-side security + Speed optimizations **review at launch** | Owner proceeded ("Done") | Recorded in setup guide only. *Added now* as a **site launch checklist item** |
| 29 | `www.disclo.in` DNS record was deleted with GoDaddy's leftovers; **recreate it when the site deploys** | "Done" | Setup log only (#214). *Added now* as a launch checklist item |
| 30 | Owner-only data never cached publicly, separate API routes; owner panel on the stock page | No objection | Recorded (D53, D91, D93) |
| 31 | Portfolio X-ray owner-only now, "also useful for signed-in users later" | "Yes" (adopt 4–6) | Recorded (§8.2 note) |
| 32 | Licence: get vendor quotes first, **never charge users before a licence** | Chose option D (license before charging) | Recorded (D88) |
| 33 | Name tests before buying: say it on a phone call, buy a common misspelling as redirect | Not answered | Open, optional (if the launch name changes) |

**Site launch checklist (from rows 2, 16, 19, 25, 28, 29 + D89/D108/D115):** EOD label on dashboard · custom domain on the site + CDN cache rules · recreate `www` record · Bot Fight Mode / rate limits decided · noindex kept until owner decides · legal pages live · privacy page explains essential sign-in cookies · analytics on · measure performance from India · quality gate passed.

**Build chat (#228–#302):** Claude does not have that chat's transcript in this session. Its log records your words and what each answer led to (including where you answered "OK" / "Accepted" to the other chat's proposals, e.g. #236, #238, #274, #297), and those are reflected above. The other chat should confirm nothing it proposed and you accepted is missing from its log.

---

### 10c. Accepted in the build chat (#228–#305) and affecting the website
Source: the build chat's **log** (owner's words + what each answer led to; that chat's transcript isn't available to this session). Checked: all 30 entries where the owner accepted something ("ok", "yes", "accepted", "approved", "go ahead", "keep public"…). Every decision they cite exists and is in PLAN's design sections. Most are build/data approvals; the ones below change **what the website shows** and were missing from this document until now.

| # | Accepted | What it means on the site | Source |
|---|---|---|---|
| 1 | Store everything about stocks; **no bonds**; ETFs, REITs/InvITs stored for later | Pages and lists show the **equity universe** (EQ/BE/BZ, no SME, D4); ETFs/REITs stored but **not shown** until decided; bonds not stored | #253, #257, D126, D127 |
| 2 | Rights entitlements are not shares (Claude's finding, not objected) | `-RE` rights-entitlement instruments never appear as stocks | D139 |
| 3 | Unlisted entities get no public pages at launch | Graph links to unlisted companies show as text, no page | #238, D39 (e) |
| 4 | Sector from NSE index CSV, filled from announcement industry via the approved map | Sector shown is **one level** (22 sectors); filled ones carry a "from announcement industry" label (`source = announcement`); unknown → **"Unclassified"** (never guessed) | #239, #240, #291, #294, D121, D150 |
| 5 | Series breaks for insolvency capital reductions; merged-away shares end | **Charts and returns don't join across a series break**; the break is marked on the chart | #278, D146 |
| 6 | Exclude old bank-format files without a period ("stocks will have empty financial statements" accepted) | Those bank quarters show as **"not available"**, never blank-as-zero | #278, D145 |
| 7 | Bulk/block (and short-selling) history capped at 70 rows/day by NSE's API | Days that hit the cap are shown as **"possibly incomplete"**, never as complete | #288, D148 |
| 8 | Keep EPS | EPS from XBRL only, **adjusted for later splits/bonuses** (built in v0) | #262, D133 |
| 9 | Screener.in as a referee | **Later** (not used now) | #262, D133 |
| 10 | Keep V2's quality bar | Card error bar = M7 gate, measured blind; no AI cards public before it | #262, D133, §14 |
| 11 | Coverage: option B tiered depth; Nifty 50 first | **Nifty 50: full depth** (cards, concalls, latest-quarter brief, write-ups). **Rest of coverage (up to top 1,000, then +100/month, > ₹500 cr in / < ₹300 cr out): light depth**: cards only for key events, **no concall processing**, write-up quarterly at most. 🔶 *Design must show which sections exist for a light-depth stock (how to display coverage depth is not yet decided)* | #191, D111, D112 |
| 12 | Review screen moved later; Claude decides queue items with evidence meanwhile | Owner review screen (B5) is a later owner-only page | #274, #278, D141, D143 |
| 13 | Site reads come from precomputed snapshots (V1 practice adopted selectively) | Page views never query history tables; precomputed per page | #258, D131 |
| 14 | Site v0: protection choice Access / secret link / public → **"Keep public"** | Recorded (D151); now offline (D152) | #297 |
| 15 | Data first; mockups for approval before any UI code | Recorded (D152) | #299–#301 |
| 16 | Design-recovery prompt for another chat window | 🔶 Waiting for the owner to paste the earlier design discussion | #304, D153 |
| 17 | Field catalogue approved; keep adding fields | Query builder / trackers fields = `docs/field-catalogue.md` | #242, D123 |
| 18 | NSE price and licence managed by the owner | Prices may be shown; §12 Q5/Q11 not a build blocker | #300, D152 |

---

### 11. Conflicts and gaps found while compiling ⚠
| # | Finding | Suggested resolution |
|---|---|---|
| 1 | Audience: D153 (Gen Z, MF houses, PMS) is **not in the first chat's record** (checked every owner message #1–#227) | Owner to paste the original discussion; until then D153 stands as stated in #302 |
| 2 | D13/D89 ("public only after the quality gate") vs D151 (v0 public early) vs D152 (offline) | Current state is D152 (offline); when the site returns, D89's gate applies unless the owner says otherwise |
| 3 | D99 name: first chat "different launch name" (#204) vs build chat "final: Disclo" (#239) | #239 is later, so Disclo is final; trademark check still pending |
| 4 | D91 header lists "4-level sector", but D121 gives **one level** (22 NSE sectors + announcement fill) | Header shows the one-level sector; 4-level only if a source appears |
| 5 | D62 says index P/E/P/B "vs own history"; history starts 2024, so percentiles are thin at first | Label the history length on the chart |
| 6 | Dashboard "latest important cards" and stock page "cards", "AI write-up", "latest quarter in brief" can't be shown publicly before M7 | Design must handle "not yet available" states for these sections |
<!-- END docs/website.md -->

<!-- BEGIN docs/disclo-design-recovered.md -->
## Disclo — design discussion recovered from the planning chat

**Source:** this chat's full history (the first planning chat of Insider V2 / Disclo, continued here). Owner messages are quoted **verbatim, including original spelling**. Claude's proposals are summarised.
**Dates and times:** this chat has no per-message timestamps. Messages before the session's date change are dated **2026-11-02**; messages after it are **2026-11-03**. **Exact IST times are not available**, except where the owner's screenshots showed a phone clock: the Cloudflare/GoDaddy/email setup ran about **22:26–23:06 IST on 2026-11-02**. Each item gives the date only, plus an order number (*M-n* = the n-th owner message relevant here) so the sequence is clear.
**Not invented:** where a topic never came up, it says **"not discussed"**.

Legend: **(a)** owner decided · **(b)** Claude proposed, owner accepted · **(c)** rejected (with reason) · **(d)** open, never closed

---

### 1. Audience

**(a) Owner decided**
- 2026-11-02, M-1 (funding question): *"No sponcer or as, clean website for investors, family office and other institutions if everything goes well."*
- 2026-11-02, M-2 (asked: retail investors or institutions first?): *"3. Both"*
- 2026-11-02, M-3: *"4. A card where investors (any type) can take decision after reading it. Must be having full context"*
- 2026-11-02, M-4 (paid tier): *"In future Yes but first product required to be robust and it's on you."*
- 2026-11-02, M-5 (owner-only prediction feature): *"As a owner i should be able to search it, not for public"*

**(b) Proposed by Claude, accepted**
- Layered depth so one product serves both groups: a short summary on top, full sourced detail one click away (answer to M-2: "Both").
- Institutions check data sources, may pay, and expect reliability. Retail wants simplicity. Raised by Claude; the owner kept "Both" and a later paid tier for institutions.

**(c) Rejected**
- not discussed

**(d) Open / never closed**
- **Youth / Gen Z investors, mutual-fund houses, PMS, analysts: not discussed in this chat.** These words appear here for the first time in the owner's recovery request (2026-11-03). Nothing in this chat says what each group needs.

---

### 2. Positioning and business

**(a) Owner decided**
- 2026-11-02, M-6: *"2. Once it is in production, and see Good foot fall i will get licence, it is like what other website does, at start they don't buy else doesn't makes a business case at all"*
- 2026-11-02, M-7: *"2.  Next 5 years might be free as huge competition"*
- 2026-11-02, M-8: *"1. Open public in future"*
- 2026-11-02, M-9 (on AI write-ups with judgement): *"Keep it else why people will pay for website?"*
- 2026-11-02, M-10: *"Understand my view first, without testing everything and few beta tester , how am I going to pitch anything or get funding from anyone?"*
- 2026-11-02, M-11: *"I am going to run my website as Uber model, go there, start and if government ask pay them"*
- 2026-11-02, M-12 (SEBI registration). The owner pasted Claude's sentence, then added their own words: *"charging for stock-specific opinion is the clearest case for SEBI research-analyst registration **if needed we will get it**"* (owner's own words in bold)
- 2026-11-02, M-13 (licence funding options A–D): *"D"* (keep the risk until the paid tier; license before charging).
- 2026-11-02, M-14: *"What other differential features we should add which might be first time in India or futuretistics which are yet to come in India ?"*
- 2026-11-02, M-15: *"https://www.stockscans.in/ See if we could benchmark anything for our side."*
- 2026-11-02, M-16: *"Open for more ideas , may be Tijori, Tijori stake and their social media may give you more glimps as they have such features"*
- 2026-11-02, M-17 (financial statements): *"how are we going to store financials statements because everyone in industry have their own standard for example screener.in"*; later *"In fact screener.in have guide for it but not covering everything"*
- 2026-11-02, M-18 (name landscape): *"None of the name I liked, let me ask you, is globally such sites exist like what we are going to do ? What are their names? Any similar names for India ?"*

**(b) Proposed by Claude, accepted**
- From StockScans (owner: *"Adopt 1-5, research chat owner-only"* and *"We can stay factual and still offer more. Sure"*):
  - dashboard breadth items (EMA 20/50/100/200 participation, daily ±4% thrust, 52-week extremes, broad-index panel)
  - bulk/block deals + tracked investors (≥ 1%)
  - keyword scans over announcements with on-site alerts
  - factual concall metrics (incl. questions management declined to answer)
  - custom baskets, returns vs indices, peer comparison
- Differentiators (owner: *"Adopt all as recommended, phasing ok"*):
  - **Tier 1:** time machine; disclosure regression detector; management credibility ledger; sector commentary map; "what changed since your last visit"; disclosure timeliness; unexplained-move panel
  - **Tier 2:** concall audio same-day summary; forensic panel
  - **Owner-only:** pre-announcement insider-trade timing
- Positioning argument: "hard to copy" (source-linked, point-in-time memory) rather than "first in India". Claude stated it couldn't verify novelty.
- From Tijori: niche sector indices and portfolio X-ray (owner: *"4 5 6 yes"*).
- Screener's guide used as one reference; Screener-style summary is one view, not the storage format (owner: *"All three ok"*).

**(c) Rejected**
- Ads and sponsors: owner, M-1 (*"No sponcer or as"*).
- StockScans-style "result quality" / "management sentiment" scores: not adopted; they conflict with the owner's *"No score at all"*.
- Claude's closed-beta proposal (invite-only, ~50 testers) for pitching: owner chose *"Keep open public as not gona tell everyone or do marketing, promise"*.

**(d) Open / never closed**
- **Comparison with Trendlyne, Tickertape, Moneycontrol, Koyfin: not discussed by the owner.** Claude listed them only as names in the landscape answer to M-18.
- **Subscriber goals / numbers: not discussed.** The only traffic number is a hosting scenario: *"daily 1 lakh visitors , 5 pages per visitor etc"* (2026-11-02).
- Funding pitch content: not discussed beyond M-10.
- Paid-tier contents and price: not discussed.

---

### 3. Visual design

**(a) Owner decided**
- 2026-11-02, M-19: *"Python or any of your choice of language but website must be faster, modern and expandable as this project is going to be huge"*
- 2026-11-02, M-20: *"Note : Website we are going to make must be best in class and should be benchmark for all"*
- 2026-11-02, M-21: *"Q2 light"* (asked: light and dark themes? any sites whose look you like?)
- 2026-11-02, M-22: *"Q3 : later"* (accessibility standard)
- 2026-11-02, M-23 (two example cards from another site, Sun Pharma and MTAR): *"Example but not exactly what I want. I am going to build is more useful"*, and *"Those was from other site"*
- Brand / name:
  - *"Q1. Propose one unique, easy to remember, catchy and available at regular cost."*
  - *"I need short names like Zepto, Rapido, Zomato and so on, any better suggestions considering our website offering?"*
  - *"Any other and best varient for website starting with "Quater" or Quarterly?"*
  - *"Quarterwise.in"*
  - *"disclo.in Brought"*
  - finally *"Ignore trademark etc as I am thinking different name for launch."* (all 2026-11-02)

**(b) Proposed by Claude, accepted**
- Card writing tone (from Claude's critique of the example cards; owner's goal answer M-3):
  - neutral language, no hype words like "Fantastic" / "Strongly positive"
  - explain *why* (profit bridge)
  - reported and adjusted figures side by side
  - claim-strength labels (reported / guidance / target / aspiration)
  - every number linked to its filing and page
  - "what changed since last quarter"
  - 30-second summary on top, full detail one click away
- Charts: TradingView Lightweight Charts with the on-chart logo off and the licence notice on a credits page (owner: *"Q10 : yes and you can hide it with simple code so hide it."*). Claude kept the required notice on a credits page because removing it entirely breaks the licence.

**(c) Rejected**
- Dark theme: owner answered only *"Q2 light"*.
- Name round 1 (Kasautee, Saarnama, Satyalekh, Pramaanam, AnkLens, Primafile, Paarkhi): *"None of the name I liked"*.
- The example cards' style: *"not exactly what I want"*. The specific dislikes were identified by Claude's critique (no "why", hype labels, no claim strength, no linked companies), not stated by the owner.

**(d) Open / never closed**
- **Colours, typography, logo, brand identity: not discussed.**
- **Reference sites or apps for the look: not given.** Claude asked "Any sites whose look you like?"; the answer was only *"Q2 light"*.
- **"Premium" expectations: not discussed.** "Modern" appears only in M-19.
- Design system and UX standards: Claude noted they were "still to be agreed"; never discussed.
- Accessibility target: *"later"*.
- Launch name: *"thinking different name for launch"* (never closed in this chat).

---

### 4. Home page / dashboard

**(a) Owner decided**
- 2026-11-02, M-24: *"1. Market and indices trend etc a best in class KPI dashboard plus what you mentioned"*
- 2026-11-02, M-25: *"1. Content as above, wil add more later if required"*

**(b) Proposed by Claude, accepted** (M-24, M-25):
- first screen = market & indices dashboard + latest important cards + calendar + search
- ~167 NSE indices: levels and trends; index P/E, P/B, yield vs their own history (percentiles)
- breadth: advances/declines, % above 50/200-DMA (later EMA 20/50/100/200), 52-week highs/lows on adjusted prices, daily ±4% thrust, broad-index panel
- sector and industry performance; FII/DII flows (history from go-live)
- results-season tracker (reported so far, % above own trend, guidance raised vs cut)
- latest important cards; upcoming calendar; search
- end-of-day, and the page must say it isn't live; "data updated HH:MM IST" (owner: *"status yes"*)

**(c) Rejected**
- not discussed

**(d) Open / never closed**
- **Order of elements on the home page: not discussed.** Only the contents were agreed.

---

### 5. Stock page

**(a) Owner decided**
- 2026-11-02, M-26: *"5 years ok, AI write-up first, one long page"*
- 2026-11-02, M-27: *"Short summary from transcript etc ?"*
- 2026-11-02, M-28: *"Format ok, keep declined to answer"*
- 2026-11-02, M-29: *"1. No score at all"*, *"3. Will decide later based on content and quality of card"*
- 2026-11-02, M-30 (AI write-up): *"Let it be public"*, then *"Keep it else why people will pay for website?"*
- 2026-11-02, M-31 (plants): *"We should have theri plants , capacity, % utilisation etc also mapped and saved if available."*
- 2026-11-02, M-32 (pre-results commissioning warning): first *"Public: the facts above, without the computed impact. Owner-only: the estimated extra depreciation, interest and margin effect. Ok"*, later *"Public"* and *"everything public, including the estimate (which goes on the legal list)?"*. The last answer stands: everything public, including the labelled estimate.
- 2026-11-02, M-33 (prices): *"2. We will have Price and Market cap (take round numbers)"*

**(b) Proposed by Claude, accepted**
- One long page with a sticky section menu (desktop), collapsible sections (mobile), lazy-loaded sections; a link can point to any section (Claude's reason for one page).
- Controls at the top: time-machine date; consolidated/standalone (company's primary basis); reported/adjusted (adjusted default); original/restated (restated default); source on hover/tap for every number.
- Order:
  - **header:** name, symbol, ISIN, sector, indices, group, price, market cap ₹ crore, 52-week range, as-of, watchlist
  - **AI write-up** (first, per owner)
  - **latest quarter in brief:** 5–8 bullets with sources, claim labels, guidance changes, analyst concerns, questions management declined to answer
  - what changed; key facts; cards & timeline
  - financials: 12 quarters + 5 years, profit bridge, segments, ratios
  - business: segments/NIC mix, geography, customers, raw materials, plants/capacity, commissioning watch, repeat orders
  - management & guidance; ownership; credit, governance & forensics; price & market chart; peers & links; documents
- Owner-only panel on the stock page.
- Card content: factual materiality instead of a score (e.g. "order = 38% of TTM revenue"); red flags kept separate; "unverified" badge; one card per event, updated as filings arrive; disclaimer on every card.
- Claude's 12-section card proposal and default view (1 verdict line, 3 reported vs adjusted + profit bridge, 11 what to watch): the owner answered *"Will decide later based on content and quality of card"*. **Not decided** (see d).

**(c) Rejected**
- Any score, rating or positive/negative label on cards (Claude had proposed −10..+10, then −3..+3): owner, M-29 *"No score at all"*.
- Tabs instead of one long page: owner chose *"one long page"*.
- AI write-up factual-only (Claude's recommendation): owner chose judgement, *"Keep it else why people will pay"*.

**(d) Open / never closed**
- Card sections and their order: *"Will decide later based on content and quality of card"*.
- **Table design and chart styles beyond the library: not discussed.**

---

### 6. Other pages

**(a) Owner decided**
- **Sector page**, 2026-11-02, M-34: *"Just idea, A sector or Industry and their company, trend of results, what management guided etc so one page speaks a louder for entire sector or Industry."*
- **Query builder:**
  - M-35: *"3.  Queries builder required and must be easy"*
  - M-36: *"3. All 3 way"*
  - M-37: *"Yes, Gemini call needed and understand"*
  - M-38: *"Yes draft it"* (field catalogue)
  - M-39: *"Trend ok, 2% ok, add delivery file"*
- **Business-mix and exposure queries,** M-40: *"1. Business segments and mix 2. Export market, country wise exposure for example USA started tax on pharma, we should be able to queries pharma companies having highest exposure or any such similar features (you must help me here) A list of companies in casting segment and casting sales > xy % margin above Y% and so on"*
- **Forensics,** M-41: *"I saw sites where they keep even track of employees count for predicting any expansion, or credit increases, or for forensic e.g. total 1200 employees as per annual reports FY 26 , however Salary % sales is just 1.2 Cr and its red flag."*
- **Margins,** M-42: *"Margin recovery or margin going away."*
- **Raw-material shock,** M-43: *"A inputs from Tata steel that steel price increased by 40%, i should be able to search which companies have steel as biggest raw material and may have inventory gain or loss etc etc."*
- **Trackers,** M-44: *"One more suggestions, we should have different trackers generated from stock data only for example ARPU trend for telecom companies, EBITDA per ton other matrix for let's say cement or steel companies, companies in the machining segment shows their machining margin or let's say pharma with their % sales as export and margin % ... A repeated order from same customer to company and increasing trend year on year"*
- **Plants by location,** M-45: *"1 ok, 2 ok, FDA later, map not required, best is city, state level filtering"*
- **Owner-only prediction search,** M-46: *"Website must identify stocks which are going to give good results in upcoming quarters based on quarterly trend, management revised guidence and so on"*, then M-5 *"As a owner i should be able to search it, not for public"*
- **Search,** M-47: *"Q6 : everything"*
- **Alerts:**
  - M-48: *"E. Website only"* (no email/Telegram alerts)
  - later the owner accepted on-site alerts for signed-in users (*"2.  You are right"*)
- **Data-health / status and error reports,** M-49: *"All ok, report error link yes, status yes"*

**(b) Proposed by Claude, accepted**
- Sector page contents: aggregated results trend, guidance raised vs cut, commentary map, valuation vs own history, KPI comparison, leaders/laggards, red flags, raw-material exposure, upcoming results.
- Query builder:
  - three ways in: plain English → editable chips (the LLM never writes SQL), visual chips, text expression
  - signed-in only, daily cap, cached
  - saved screens + "what changed"
  - "not understood" instead of guessing
- Watchlists, saved screens, baskets and on-site alerts for signed-in users; everything readable without an account (*"2.  You are right"*).
- Comparison: peer comparison and returns vs indices (part of *"Adopt 1-5"*).
- Legal pages (terms, privacy, disclaimer, credits, contact): proposed by Claude as needed for Google sign-in, when the owner asked *"keep discussing, check documents for anything missed."*. The owner didn't object; never discussed further.
- Owner-only tools: scenario calculator (commodity shock), event impact (*"1 ok"* to owner-entered events), export mix-drag (*"2 owner-only"*), research chat (*"research chat owner-only"*).

**(c) Rejected**
- Map view for plants: *"map not required"*.
- Email/Telegram alerts to users: *"E. Website only"*.

**(d) Open / never closed**
- **Comparison page layout: not discussed.**
- **Legal page wording: not discussed.**

---

### 7. Mobile and app

**(a) Owner decided**
- 2026-11-02, M-50: *"Q4. Web only but mobile first"*
- 2026-11-02, M-51: *"Card for social media or sharing yes"*

**(b) Proposed by Claude, accepted**
- No app: an app would count as a second NSE licence medium.
- The shareable image is generated from the web card (the web card is the main format).
- Collapsible sections on mobile.

**(c) Rejected**
- An app: owner chose *"Web only"*.

**(d) Open / never closed**
- **Specific sharing channels (WhatsApp, X, Instagram), image formats and sizes: not discussed.**

---

### 8. Speed and quality bar

**(a) Owner decided**
- 2026-11-02, M-19: *"website must be faster, modern and expandable as this project is going to be huge"*
- 2026-11-02, M-20: *"Website we are going to make must be best in class and should be benchmark for all"*
- 2026-11-02, M-52 (milestones incl. performance targets): *"Approved, keep discussing for now if you need any specific inputs, check our documents, ask if I have missed anything, you will be my master here."*
- 2026-11-02, M-53: *"Wait for quality gate, then move to stock page"*
- 2026-11-02, M-54 (shadow run): *"Not required because when you are going to expand the universe, will get more feedback and also going to do daily random cards audit with your help which might be more useful vs shadow or my understanding is wrong?"*
- 2026-11-02, M-55 (triage misses): *"5. Zero"*
- 2026-11-02, M-56: *"Which hosting we choose, for example our full site is working, entire universe, daily 1 lakh visitors , 5 pages per visitor etc Will $5 plan is sufficient?"*
- 2026-11-02, M-22: *"Q3 : later"* (accessibility)

**(b) Proposed by Claude, accepted** (M-52):
- **Performance targets:** cached page/API from India ≤ 200 ms to first byte; stock page main content ≤ 2.0 s on a mid-range phone on 4G; API ≤ 300 ms cached / ≤ 800 ms uncached (95% of requests); query builder ≤ 2 s (Nifty 100) / ≤ 5 s (all stocks).
- **Quality gate before opening:** ≤ 1% of audited cards with any material error for 14 days in a row, zero critical errors, zero triage misses in 2 weekly audits, results cards within 15 minutes for 90% of filings, Gemini spend within cap.
- **Daily random card audit** (adopted from M-54).
- **Basic accessibility from day 1** (contrast, keyboard use, alt text), with the formal standard later.

**(c) Rejected**
- Fixed-length shadow run: owner, M-54.

**(d) Open / never closed**
- Formal accessibility standard: *"later"*.
- **A definition of "best in class" beyond these measures: not discussed.**

---

### 9. Anything else about the website or product

**(a) Owner decided**
- **Numbers:** *"2. We will have Price and Market cap (take round numbers)"* (2026-11-02). Claude stated "stored exact in ₹, shown in ₹ crore with no decimals" and the owner raised no objection.
  - **Lakh format: not discussed.**
- **Language:** *"Q5 only english, no other language"*
- **Theme:** *"Q2 light"*
- **Login:** *"No magic links required, google works"*, and *"2. Google"*
- **Exports:** *"Q11 : yes from day 1 else how would I test"*
- **User data:** *"Q12 : yes, 2 years"* (error reports kept 2 years; deletion/export on request)
- **Analytics:** *"analytics yes"*
- **Launch:**
  - *"Right now private, in future after all validation etc may think of having public."*
  - *"Keep open public as not gona tell everyone or do marketing, promise"*
  - *"Who is going to use worker.dev domain name for launch ? No one so try to understand my situation"*
- **Autonomous site:** *"6. Autonomous site"*
- **AI usage:** *"A Gemini AI API will be used for stock analysis (different types technical, fundamental, stock research, and so on)"*
- **Cards from announcements:** *"Output : whatever you mentioned+ any additional details, I am generating cards per required announcements, filtered goes directly to memory if any , appreciate your suggestions as I need your help here."*
- **Email:** *"Does cloudflare gives an email like info@quartewise.in etc for free? A single account?"*
- **Domain/name sequence:** as in §3 (Disclo bought; *"thinking different name for launch"*).

**(b) Proposed by Claude, accepted**
- Exports owner-only until the data licence, then for signed-in users.
- Times shown in IST.
- Cookie-less analytics, so no consent banner.
- `noindex` until the owner decides; rate limits and bot protection mainly for cost.
- "Report an error" on every card.
- Correction notes shown publicly.

**(c) Rejected**
- Magic-link email login: *"No magic links required"*.
- Other languages: *"only english"*.

**(d) Open / never closed**
- **Signup flow details: not discussed** (beyond "Google sign-in only").
- Launch name.

---

### 10 most important design requirements, in the owner's own words
1. *"Website we are going to make must be best in class and should be benchmark for all"*
2. *"website must be faster, modern and expandable as this project is going to be huge"*
3. *"A card where investors (any type) can take decision after reading it. Must be having full context"*
4. *"No score at all"*
5. *"Market and indices trend etc a best in class KPI dashboard plus what you mentioned"*
6. *"5 years ok, AI write-up first, one long page"*
7. *"Queries builder required and must be easy"*
8. *"Web only but mobile first"*, *"Q2 light"*, *"only english, no other language"*
9. *"clean website for investors, family office and other institutions if everything goes well"*, *"3. Both"*
10. *"A sector or Industry and their company, trend of results, what management guided etc so one page speaks a louder for entire sector or Industry."*

**Not found in this chat:** youth / Gen Z, mutual-fund houses, PMS, analysts as an audience; colours, typography, logo; reference sites for the look; "premium"; WhatsApp/X/Instagram specifics; lakh formatting; subscriber goals; comparisons with Trendlyne, Tickertape, Moneycontrol or Koyfin.
<!-- END docs/disclo-design-recovered.md -->

# Part 5 — Data reference

<!-- BEGIN docs/field-catalogue.md -->
## Field Catalogue — v1, approved by owner (D123)

This lists the fields the query builder, dashboard and dossiers can use. Each field is precomputed nightly, or after each event, into the per-stock feature table (D64).
Fields marked 🔒 are **owner-only** (D53) and never appear in public queries or APIs. Fields marked *est.* are labelled estimates (method shown).
**History available to series functions:** up to 12 quarters + 5 years annual for financials (D90); market data from 2024-01-01 (D2).

**Conventions (apply to every field):**
- **Basis:** the company's primary basis (D50) unless the field name ends in `_sa` (standalone) or `_cons` (consolidated).
- **Money:** ₹ crore. **Percentages:** in %, e.g. `15` = 15%. **Margin changes:** in basis points (`_bps`).
- **Adjusted vs reported:** "adjusted" excludes exceptional items (D52). Fields with `_rep` are as reported.
- **Prices:** corporate-action adjusted (D6) unless the name ends in `_raw`. Market cap is never adjusted.
- **Restated figures:** latest restated is the default (D48).
- **Missing data:** if a field can't be computed, it's `null` with a reason, never a sentinel value (D52). A `null` never matches a condition.
- **Origin:** every value records whether it is reported, computed, extracted (LLM, verified), industry_default, or estimate (§2a schema rules).
- **As-of date:** every field has one. Queries can require freshness, e.g. `as_of(pat_yoy_q) within 120d`.

---

### 1. Query language (what all three input modes compile to)

| Element | Examples |
|---|---|
| Comparison | `>`, `>=`, `<`, `<=`, `=`, `!=`, `between 10 and 20`, `in (…)` |
| Logic | `AND`, `OR`, `NOT`, parentheses |
| Text/category | `sector = "Capital Goods"`, `index in ("NIFTY50","NIFTYNEXT50")` |
| **Series functions** over the last *n* quarters (n ≤ 12) | `all(revenue_yoy_q > 15, last=4)` · `any(pat_yoy_q < 0, last=2)` · `count(guidance_revised_up, last=4) >= 2` · `avg(ebitda_margin_q, last=4)` · `trend(ebitda_margin_q, last=8) = "rising"` |
| **Relative** | `vs_own_median(pe_ttm, years=2) < 0` (below its own median) · `vs_industry_median(roce) > 0` · `rank_in(industry, roce) <= 3` |
| **Change** | `change(promoter_holding_pct, quarters=1) > 0` · `change_bps(ebitda_margin_q, yoy)` |
| **Events** | `has_event("credit_rating_upgrade", within=90d)` · `NOT has_red_flag(within=365d)` |

The plain-English mode only translates into this language. Anything that can't be expressed is shown as "not understood" instead of being guessed.

---

### 2. Identity & classification
| Field | Definition | Source |
|---|---|---|
| `symbol`, `name`, `isin` | Current identifiers | EQUITY_L, bhavcopy |
| `sector` | One of NSE's 22 broad sectors (D121) | NSE index CSV `Industry` (Total Market list); else announcement `smIndustry` mapped to the 22 sectors, labelled; else "Unclassified" |
| `industry_detail` | Finer NSE industry where available (75 values, e.g. Paints, Sugar), labelled | Announcement `smIndustry` (D121) |
| `index` | Current index memberships | Index snapshots (D9) |
| `group` | Promoter group (e.g. Tata, Adani) | Shareholding pattern (D40, D56) |
| `listing_age_years` | Years since listing | EQUITY_L |
| `statement_template` | industrial / bank / NBFC / insurance | Results metadata |
| `primary_basis` | consolidated / standalone / both | D50 |

### 3. Price, liquidity & technicals (EOD)
| Field | Definition |
|---|---|
| `close`, `close_raw` | Last close, adjusted / raw |
| `mcap_cr` | Full market cap (NSE MCAP file, D5) |
| `ret_1w`, `ret_1m`, `ret_3m`, `ret_6m`, `ret_1y`, `ret_ytd` | Price return on adjusted close |
| `ret_vs_nifty_3m`, `ret_vs_sector_3m` | Relative return |
| `pct_from_52w_high`, `pct_from_52w_low` | On adjusted prices (NSE's own 52w data is unadjusted, never used) |
| `dma_50`, `dma_200`, `above_dma_200` | Moving averages / flag |
| `rsi_14`, `volatility_1y` | Standard definitions, documented |
| `avg_turnover_20d_cr`, `volume_vs_20d` | Liquidity |
| `delivery_pct_20d` | Avg delivery % (`sec_bhavdata_full`, D65) |
| `ema_20`, `ema_50`, `ema_100`, `ema_200`, `above_ema_*` | EMAs / flags (dashboard participation, D67) |
| `in_asm`, `in_gsm`, `in_fo_ban`, `price_band` | Surveillance / F&O ban / price band (D76) |
| `bulk_block_deals_90d` | Count + net value of bulk/block deals (D67) |
| `unexplained_move_30d` | Moves beyond threshold with no disclosure in the window (D69) |

### 4. Valuation
| Field | Definition |
|---|---|
| `pe_ttm` | mcap ÷ adjusted TTM PAT attributable to owners |
| `pe_ttm_rep` | Same, on reported PAT |
| `pb` | mcap ÷ latest net worth attributable to owners |
| `ev_ebitda_ttm` | (mcap + net debt + NCI) ÷ TTM EBITDA (D49 definition) |
| `mcap_to_sales_ttm`, `earnings_yield`, `dividend_yield_ttm` | Standard |
| `pe_vs_own_median_2y` | % above/below own median P/E since 2024 |
| `pe_vs_industry_median` | % above/below industry median |
| `pb_bank` | For banks: P/B on standalone net worth |

### 5. Growth (quarterly series, last 12 quarters available to series functions)
| Field | Definition |
|---|---|
| `revenue_q`, `ebitda_q`, `pbt_q`, `pat_q` | Quarterly values (adjusted; `_rep` for reported) |
| `revenue_yoy_q`, `ebitda_yoy_q`, `pat_yoy_q`, `eps_yoy_q` | YoY growth |
| `revenue_qoq`, `pat_qoq` | QoQ growth |
| `revenue_ttm_yoy`, `pat_ttm_yoy` | TTM growth |
| `revenue_vs_trend_q` | Latest YoY growth minus the company's own 8-quarter average YoY growth (pp). The basis of "good results" (D53). |
| `pat_vs_trend_q` | Same for PAT |
| `segment_revenue_yoy[segment]` | Per reported segment |

### 6. Profitability & earnings quality
| Field | Definition |
|---|---|
| `ebitda_margin_q`, `ebitda_margin_ttm` | Operating EBITDA ÷ revenue (excludes other income, D49) |
| `ebitda_margin_change_yoy_bps` | Margin change |
| `ebitda_company_reported_q` | Company's own EBITDA figure, if given |
| `roce`, `roe`, `roa` | D52 conventions (average capital; capital-employed definition documented) |
| `other_income_share_pbt_ttm` | Other income ÷ PBT |
| `exceptional_items_ttm_cr` | Sum of exceptional items |
| `effective_tax_rate_ttm` | Tax ÷ PBT |
| `ocf_to_pat_ttm` | Operating cash flow ÷ PAT (half-yearly data) |
| `margin_recovery`, `margin_erosion` | Flags: margin rising ≥ 2 quarters after a trailing-4Q low / ≥ X bps below trailing-8Q peak or consecutive contraction (D70) |
| `employee_cost_per_employee_sa` | Standalone employee expense ÷ BRSR headcount, vs industry median (D71) |
| `headcount`, `headcount_growth_yoy`, `contract_worker_share` | BRSR, standalone (D71) |
| `energy_growth_vs_revenue`, `water_growth_vs_revenue` | BRSR activity proxies (D71) |
| `fcf_ttm_cr` | OCF − capex |

### 7. Balance sheet & working capital (half-yearly)
| Field | Definition |
|---|---|
| `net_debt_cr`, `net_debt_to_ebitda`, `debt_to_equity` | Leverage |
| `interest_coverage_ttm` | EBIT ÷ finance cost |
| `receivable_days`, `inventory_days`, `payable_days`, `working_capital_days`, `cash_conversion_cycle` | Standard, documented |
| `capex_ttm_cr`, `cwip_cr` | Investment |
| `contingent_liabilities_cr` | From annual-report sections (D74) |
| `msme_dues_cr`, `msme_dues_change` | Integrated Filing (D76) |
| `bank_statement_discrepancy` | Annual-report note: quarterly statements to banks vs books (D83, red flag) |
| `unhedged_fx_exposure_cr`, `fx_earnings_cr`, `fx_outgo_cr`, `rnd_pct_sales` | Annual report (D74) |
| `rm_cost_pct_revenue` | Materials consumed + stock-in-trade purchases ± inventory change, ÷ revenue (D72) |

### 8. Sector packs (KPI dictionary, D31)
Sourced from filings/presentations. LLM-extracted, verified (quotes + checks), and labelled `source = presentation/transcript` vs `xbrl`.
| Pack | Fields |
|---|---|
| Banks | `nim`, `gnpa_pct`, `nnpa_pct`, `pcr`, `credit_cost`, `casa_pct`, `loan_growth_yoy`, `deposit_growth_yoy`, `cost_to_income`, `car`, `slippage_ratio` |
| NBFCs | `aum_cr`, `aum_growth_yoy`, `nim`, `gs3_pct`, `ns3_pct`, `credit_cost`, `disbursement_growth_yoy` |
| Insurers | `vnb_cr`, `vnb_margin`, `ape_growth_yoy`, `solvency_ratio`, `persistency_13m` |
| IT services | `cc_revenue_growth_qoq` (constant currency), `deal_tcv_usd_mn`, `attrition_ltm`, `utilisation` |
| Autos | `volume_q`, `volume_yoy`, `asp`, monthly volumes (from monthly business updates) |
| Cement | `volume_mt`, `ebitda_per_tonne`, `capacity_mtpa`, `capacity_utilisation` |
| Metals | `production_mt`, `sales_mt`, `ebitda_per_tonne` |
| Telecom | `arpu`, `subscribers_mn`, `data_traffic` |
| Pharma | `us_sales`, `india_formulations_growth`, `rnd_pct_sales`, `usfda_observations_12m` |
| Power / utilities | `capacity_mw`, `plf`, `regulated_equity` |
| FMCG / consumer | `volume_growth`, `gross_margin` |
| Capital goods / construction | `order_book_cr`, `order_inflow_q`, `book_to_bill` |
| Oil & gas | `grm_usd_bbl`, `production_mmscmd` |
| Ports / airlines / services | `cargo_mt`, `passengers_mn`, `rask`/`yield` |

### 9. Guidance & commitments (memory, D33)
| Field | Definition |
|---|---|
| `guidance_open_count` | Open guidance items |
| `guidance_revised_up` / `guidance_revised_down` (series) | Per quarter, usable with `count(…, last=n)` |
| `guidance_met_rate_8q` | Share of guidance items resolved as met in the last 8 quarters |
| `last_guidance_change` | Date + direction |
| `commitments_due_next_2q` | Commitments with a due date in the next 2 quarters |
| `commitments_overdue`, `commitments_silently_dropped_12m` | Count |
| `commentary_stopped` | Flag (D33) |

### 10. Orders, capacity & business exposure
| Field | Definition |
|---|---|
| `order_book_cr`, `order_book_to_ttm_revenue` | Order book and coverage (years of revenue) |
| `order_inflow_ttm_cr`, `large_orders_90d` | Inflow; count of orders ≥ 2% of TTM revenue |
| `capacity_additions_due_next_2q` | From commitments |
| `repeat_customer_orders[customer]` | Count/value per year of orders from the same **named** customer, trend (D78) |
| `product_share[nic]` | % of turnover by NIC product code (BRSR, D70/D71), e.g. `product_share["243"] >= 30` for castings |
| `segment_margin[segment]` | Segment result ÷ segment revenue, where disclosed (D70, D78) |
| `export_share`, `geo_share[region]` | BRSR exports % (standalone) + geographic note/presentations (D70) |
| `top_customer_share`, `customers_ge_10pct` | Ind AS 108 major customers (D70) |
| `raw_materials[]` | Stated (graph) or industry default, labelled (D72) |
| `plants_count`, `plants_in[city/district/state]`, `capacity_share_in[area]` *est. when multi-plant* | Plant registry (D77) |
| `utilisation_latest`, `utilisation_guided_next_q` | Presentations/transcripts/MD&A (D83) |
| `commissioned_90d`, `commissioning_cost_cr`, `commissioning_est_dep_cr` *est.*, `commissioning_est_interest_cr` *est.*, `commissioning_est_margin_bps` *est.* | Commissioning watch; estimates public and labelled (D82) |

### 11. Ownership, insiders & pledges (D28, D29, D56)
| Field | Definition |
|---|---|
| `promoter_holding_pct`, `promoter_holding_change_qoq` | Shareholding pattern |
| `promoter_pledged_pct`, `pledge_change_qoq` | Pledge truth from shareholding pattern + events |
| `fii_holding_pct`, `dii_holding_pct`, `mf_holding_pct`, `public_holding_pct` (+ `_change_qoq`) | Shareholding pattern |
| `insider_net_buy_30d_cr`, `insider_net_buy_90d_pct_equity` | Insider-trading disclosures; ESOP exercise excluded |
| `promoter_group_net_buy_90d_cr` | Promoter + promoter group |
| `insider_trades_in_window_closure_12m` | Count (red flag) |
| `sast_crossings_90d` | Takeover Reg 29 disclosures |
| `tracked_investors[]` | Named holders ≥ 1% from shareholding patterns (D67) |

### 12. Events, red flags & governance
| Field | Definition |
|---|---|
| `red_flags_12m` | Count, with types |
| `auditor_change_12m`, `auditor_qualification_latest` | Governance |
| `kmp_resignations_12m`, `director_resignations_12m` | Management churn |
| `restatement_error_12m` | Error-type restatement (D48) |
| `credit_rating_latest`, `rating_action_12m` | Up / down / none (structured feed, D76) |
| `rated_facilities_cr`, `rated_facilities_change_cr` (+ by type: `term_loan`, `fund_based_wc`, `non_fund_based`, `ncd`) | From rating letters in announcements (D81) |
| `independent_director_share`, `board_attendance`, `auditor_tenure_years`, `investor_complaints_q` | Integrated Filing – Governance (D76) |
| `filing_delay_median_min`, `late_filings_12m`, `corrigenda_12m`, `results_filed_friday_late` | Disclosure timeliness (D69) |
| `disclosure_regression_flags` | KPIs/segments stopped, definitions changed, new risk language (D69) |
| `guidance_met_rate_by_exec[person]` | Management credibility ledger (D69) |
| `regulatory_actions_12m` | SEBI/RBI/other orders |
| `litigation_open_cr` | Disclosed exposure |
| `monitoring_agency_deviation` | Deviation in use of raised funds |

### 13. Corporate actions & results timing
| Field | Definition |
|---|---|
| `dividend_ttm`, `buyback_12m`, `last_split_bonus_date` | Corporate actions |
| `last_result_date`, `next_result_date`, `days_to_next_result` | From board-meeting intimations |
| `concall_scheduled_next` | Date, if intimated |
| `concall_analysts`, `concall_questions_by_theme`, `concall_congratulations`, `concall_qa_share`, `concall_declined_answers` | Factual concall metrics (D67) |

### 14. Data quality (always queryable)
| Field | Definition |
|---|---|
| `data_basis`, `basis_switch_date` | D50 |
| `restated_fields` | Which fields are restated |
| `mcap_source` | nse / derived (Jan 2024) |
| `as_of(field)` | Freshness of any field |

### 15. 🔒 Owner-only (D53)
| Field | Definition |
|---|---|
| `signal_*` | Leading-indicator flags (guidance up, order coverage, provisional business update strength, …) |
| `signal_outcome_hit_rate` | From the outcome ledger, per signal type |
| `predicted_*` | **Only after a backtest beats the naive baseline** |
| `scenario_*` | Scenario calculator outputs, e.g. commodity shock (D73) |
| `event_impact_*` | Owner-entered event → plants → capacity → revenue at risk (D77) |
| `export_mix_drag_est` | Margin vs export-share estimate (D78) |
| `rated_facility_signal` | Interpretation of facility changes (D81) |
| `headcount_expansion_signal` | Headcount growth as expansion indicator (D53) |

---

### Decided (owner, 2026-11-02)
- **Trend:** "rising" = positive linear-fit slope over *n* quarters **and** ≥ (n−2) positive quarter-on-quarter changes ("falling" mirrors this).
- **Large order:** ≥ 2% of TTM revenue (same as D38).
- **Delivery %:** `sec_bhavdata_full_DDMMYYYY.csv` added to daily market-data sources.

### Change list (additions after approval, D123)
- 2026-11-03: `sector` (22 NSE sectors) and `industry_detail` replace the 4-level classification fields (D121).
<!-- END docs/field-catalogue.md -->

<!-- BEGIN docs/statement-line-items.md -->
## Financial-statement line items in NSE's files (census, D154)

**Source:** every downloaded results XBRL file (74,571), 3 Nov 2026. Share = % of files of that format carrying the line with a value (balance sheet: % of files with a balance sheet; cash flow: % of files with a cash flow). Lines in ≥ 25% listed.

| Format | Files | With balance sheet | With cash flow |
|---|---|---|---|
| industrial / in-bse-fin | 45678 | 16057 | 21589 |
| industrial / in-capmkt | 27495 | 15047 | 14573 |
| bank / in-capmkt | 494 | 291 | 281 |
| bank / in-bse-fin | 451 | 231 | 231 |
| unknown / in-bse-fin | 312 | 1 | 151 |
| general_insurance / in-capmkt | 56 | 56 | 32 |
| life_insurance / in-capmkt | 55 | 55 | 35 |
| unknown / no prefix | 22 | 0 | 10 |
| unknown / in-capmkt | 8 | 6 | 3 |

### industrial / in-capmkt (27495 files)

**P&L (51):** OtherIncome 100%, CurrentTax 100%, DeferredTax 100%, BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations 100%, DilutedEarningsLossPerShareFromContinuingAndDiscontinuedOperations 100%, RevenueFromOperations 100%, Income 100%, CostOfMaterialsConsumed 100%, PurchasesOfStockInTrade 100%, ChangesInInventoriesOfFinishedGoodsWorkInProgressAndStockInTrade 100%, EmployeeBenefitExpense 100%, FinanceCosts 100%, Expenses 100%, ProfitBeforeTax 100%, TaxExpense 100%, PaidUpValueOfEquityShareCapital 100%, OtherExpenses 100%, ExceptionalItemsBeforeTax 99%, ProfitLossFromDiscontinuedOperationsBeforeTax 99%, TaxExpenseOfDiscontinuedOperations 99%, ProfitLossFromDiscontinuedOperationsAfterTax 99%, ProfitLossForPeriod 99%, ComprehensiveIncomeForThePeriod 99%, BasicEarningsLossPerShareFromContinuingOperations 99%, DilutedEarningsLossPerShareFromContinuingOperations 99%, BasicEarningsLossPerShareFromDiscontinuedOperations 99%, DilutedEarningsLossPerShareFromDiscontinuedOperations 99%, DepreciationDepletionAndAmortisationExpense 99%, ProfitBeforeExceptionalItemsAndTax 99%, ProfitLossForPeriodFromContinuingOperations 99%, ShareOfProfitLossOfAssociatesAndJointVenturesAccountedForUsingEquityMethod 99%, OtherComprehensiveIncomeNetOfTaxes 99%, DateOnWhichPriorIntimationOfTheMeetingForConsideringFinancialResultsWasInformedToTheExchange 99%, NetMovementInRegulatoryDeferralAccountBalancesRelatedToProfitOrLossAndTheRelatedDeferredTaxMovement 93%, OtherComprehensiveIncome 92%, IncomeTaxRelatingToItemsThatWillNotBeReclassifiedToProfitOrLoss 90%, IncomeTaxRelatingToItemsThatWillBeReclassifiedToProfitOrLoss 73%, AmountOfItemThatWillNotBeReclassifiedToProfitAndLoss 71%, ProfitOrLossAttributableToOwnersOfParent 35%, ComprehensiveIncomeForThePeriodAttributableToOwnersOfParent 35%, ProfitOrLossAttributableToNonControllingInterests 35%, ComprehensiveIncomeForThePeriodAttributableToOwnersOfParentNonControllingInterests 34%, SegmentRevenueFromOperations 33%, SegmentProfitBeforeTax 33%, SegmentRevenue 32%, SegmentProfitLossBeforeTaxAndFinanceCosts 32%, SegmentFinanceCosts 30%, OtherUnallocableExpenditureNetOffUnAllocableIncome 29%, AmountOfItemThatWillBeReclassifiedToProfitAndLoss 28%, DebtEquityRatio 26%, InterSegmentRevenue 25%

**Balance sheet (68):** PropertyPlantAndEquipment 100%, CashAndCashEquivalents 100%, Assets 100%, EquityAndLiabilities 100%, Inventories 100%, CashAndCashEquivalentsCashFlowStatement 100%, BankBalanceOtherThanCashAndCashEquivalents 100%, Goodwill 99%, OtherIntangibleAssets 99%, EquityShareCapital 99%, OtherEquity 99%, Equity 99%, Liabilities 99%, EquityAttributableToOwnersOfParent 99%, NoncurrentInvestments 93%, NoncurrentAssets 93%, CurrentInvestments 93%, CurrentAssets 93%, NoncurrentLiabilities 93%, CurrentLiabilities 93%, LoansNoncurrent 92%, NoncurrentFinancialAssets 92%, TradeReceivablesCurrent 92%, LoansCurrent 92%, CurrentFinancialAssets 92%, BorrowingsNoncurrent 92%, NoncurrentFinancialLiabilities 92%, ProvisionsNoncurrent 92%, BorrowingsCurrent 92%, TotalOutstandingDuesOfMicroEnterpriseAndSmallEnterpriseCurrent 92%, TotalOutstandingDuesOfCreditorsOtherThanMicroEnterpriseAndSmallEnterpriseCurrent 92%, TradePayablesCurrent 92%, CurrentFinancialLiabilities 92%, ProvisionsCurrent 92%, CapitalWorkInProgress 92%, OtherCurrentLiabilities 91%, OtherCurrentFinancialLiabilities 89%, OtherCurrentFinancialAssets 88%, OtherCurrentAssets 88%, OtherNoncurrentFinancialAssets 87%, DeferredTaxLiabilitiesNet 85%, OtherNoncurrentAssets 85%, DeferredTaxAssetsNet 83%, CurrentTaxLiabilities 82%, InvestmentProperty 81%, IntangibleAssetsUnderDevelopment 80%, OtherNoncurrentFinancialLiabilities 78%, BiologicalAssetsOtherThanBearerPlants 73%, InvestmentsAccountedForUsingEquityMethod 69%, TradeReceivablesNoncurrent 69%, CurrentTaxAssets 68%, TradePayablesNoncurrent 65%, TotalOutstandingDuesOfCreditorsOtherThanMicroEnterpriseAndSmallEnterpriseNoncurrent 65%, TotalOutstandingDuesOfMicroEnterpriseAndSmallEnterpriseNoncurrent 64%, NoncurrentAssetsClassifiedAsHeldForSale 61%, DeferredGovernmentGrantsNoncurrent 60%, OtherNoncurrentLiabilities 60%, UnAllocableAssets 60%, NetSegmentAssets 60%, UnAllocableLiabilities 60%, NetSegmentLiabilities 60%, SegmentAssets 59%, SegmentLiabilities 59%, RegulatoryDeferralAccountDebitBalancesAndRelatedDeferredTaxAssets 58%, DeferredGovernmentGrantsCurrent 57%, LiabilitiesDirectlyAssociatedWithAssetsInDisposalGroupClassifiedAsHeldForSale 54%, RegulatoryDeferralAccountCreditBalancesAndRelatedDeferredTaxLiability 53%, NonControllingInterest 32%

**Cash flow (95):** CashFlowsFromUsedInOperatingActivities 100%, ProceedsFromBorrowingsClassifiedAsFinancingActivities 100%, RepaymentsOfBorrowingsClassifiedAsFinancingActivities 100%, OtherInflowsOutflowsOfCashClassifiedAsFinancingActivities 100%, IncreaseDecreaseInCashAndCashEquivalents 100%, CashFlowsFromUsedInFinancingActivities 100%, CashFlowsFromUsedInOperations 100%, DividendsReceivedClassifiedAsOperatingActivities 100%, InterestPaidClassifiedAsOperatingActivities 100%, InterestReceivedClassifiedAsOperatingActivities 100%, IncomeTaxesPaidRefundClassifiedAsOperatingActivities 100%, OtherInflowsOutflowsOfCashClassifiedAsOperatingActivities 100%, CashFlowsFromLosingControlOfSubsidiariesOrOtherBusinessesClassifiedAsInvestingActivities 100%, CashFlowsUsedInObtainingControlOfSubsidiariesOrOtherBusinessesClassifiedAsInvestingActivities 100%, OtherCashReceiptsFromSalesOfEquityOrDebtInstrumentsOfOtherEntitiesClassifiedAsInvestingActivities 100%, OtherCashPaymentsToAcquireEquityOrDebtInstrumentsOfOtherEntitiesClassifiedAsInvestingActivities 100%, OtherCashReceiptsFromSalesOfInterestsInJointVenturesClassifiedAsInvestingActivities 100%, OtherCashPaymentsToAcquireInterestsInJointVenturesClassifiedAsInvestingActivities 100%, ProceedsFromSalesOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities 100%, PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities 100%, ProceedsFromSalesOfIntangibleAssetsClassifiedAsInvestingActivities 100%, PurchaseOfIntangibleAssetsClassifiedAsInvestingActivities 100%, ProceedsFromGovernmentGrantsClassifiedAsInvestingActivities 100%, CashAdvancesAndLoansMadeToOtherPartiesClassifiedAsInvestingActivities 100%, CashReceiptsFromRepaymentOfAdvancesAndLoansMadeToOtherPartiesClassifiedAsInvestingActivities 100%, CashPaymentsForFutureContractsForwardContractsOptionContractsAndSwapContractsClassifiedAsInvestingActivities 100%, CashReceiptsFromFutureContractsForwardContractsOptionContractsAndSwapContractsClassifiedAsInvestingActivities 100%, DividendsReceivedClassifiedAsInvestingActivities 100%, InterestReceivedClassifiedAsInvestingActivities 100%, IncomeTaxesPaidRefundClassifiedAsInvestingActivities 100%, OtherInflowsOutflowsOfCashClassifiedAsInvestingActivities 100%, CashFlowsFromUsedInInvestingActivities 100%, ProceedsFromIssuingOtherEquityInstruments 100%, ProceedsFromIssuingDebenturesNotesBondsEtc 100%, DividendsPaidClassifiedAsFinancingActivities 100%, InterestPaidClassifiedAsFinancingActivities 100%, IncomeTaxesPaidRefundClassifiedAsFinancingActivities 100%, EffectOfExchangeRateChangesOnCashAndCashEquivalents 100%, IncreaseDecreaseInCashAndCashEquivalentsBeforeEffectOfExchangeRateChanges 100%, AdjustmentsForFinanceCosts 100%, AdjustmentsForDecreaseIncreaseInInventories 100%, AdjustmentsForDecreaseIncreaseInOtherCurrentAssets 100%, AdjustmentsForIncreaseDecreaseInOtherCurrentLiabilities 100%, AdjustmentsForDepreciationAndAmortisationExpense 100%, AdjustmentsForImpairmentLossReversalOfImpairmentLossRecognisedInProfitOrLoss 100%, AdjustmentsForUnrealisedForeignExchangeLossesGains 100%, AdjustmentsForDividendIncome 100%, AdjustmentsForSharebasedPayments 100%, OtherAdjustmentsForWhichCashEffectsAreInvestingOrFinancingCashFlow 100%, OtherAdjustmentsToReconcileProfitLoss 100%, OtherAdjustmentsForNoncashItems 100%, ShareOfProfitAndLossFromPartnershipFirmOrAssociationOfPersonsOrLimitedLiabilityPartnerships 100%, AdjustmentsForReconcileProfitLoss 100%, CashReceiptsFromShareOfProfitsOfPartnershipFirmOrAssociationOfPersonsOrLimitedLiabilityPartnerships 100%, CashPaymentForInvestmentInPartnershipFirmOrAssociationOfPersonsOrLimitedLiabilityPartnerships 100%, ProceedsFromSalesOfInvestmentPropertyClassifiedAsInvestingActivities 99%, PurchaseOfInvestmentPropertyClassifiedAsInvestingActivities 99%, ProceedsFromSalesOfGoodwillClassifiedAsInvestingActivities 99%, PurchaseOfGoodwillClassifiedAsInvestingActivities 99%, ProceedsFromBiologicalAssetsOtherThanBearerPlantsClassifiedAsInvestingActivities 99%, PurchaseOfBiologicalAssetsOtherThanBearerPlantsClassifiedAsInvestingActivities 99%, ProceedsFromSalesOfOtherLongTermAssetsClassifiedAsInvestingActivities 99%, PurchaseOfOtherLongTermAssetsClassifiedAsInvestingActivities 99%, ProceedsFromChangesInOwnershipInterestsInSubsidiaries 99%, PaymentsFromChangesInOwnershipInterestsInSubsidiaries 99%, ProceedsFromIssuingSharesClassifiedAsFinancingActivities 99%, PaymentsToAcquireOrRedeemEntitysShares 99%, PaymentsOfOtherEquityInstruments 99%, ProceedsFromExerciseOfStockOptions 99%, PaymentsOfLeaseLiabilitiesClassifiedAsFinancingActivities 99%, AdjustmentsForDecreaseIncreaseInTradeReceivablesCurrent 99%, AdjustmentsForDecreaseIncreaseInTradeReceivablesNoncurrent 99%, AdjustmentsForDecreaseIncreaseInOtherNoncurrentAssets 99%, AdjustmentsForOtherFinancialAssetsNoncurrent 99%, AdjustmentsForOtherFinancialAssetsCurrent 99%, AdjustmentsForOtherBankBalances 99%, AdjustmentsForIncreaseDecreaseInTradePayablesCurrent 99%, AdjustmentsForIncreaseDecreaseInTradePayablesNoncurrent 99%, AdjustmentsForIncreaseDecreaseInOtherNoncurrentLiabilities 99%, AdjustmentsForProvisionsCurrent 99%, AdjustmentsForProvisionsNoncurrent 99%, AdjustmentsForOtherFinancialLiabilitiesCurrent 99%, AdjustmentsForOtherFinancialLiabilitiesNoncurrent 99%, AdjustmentsForInterestIncome 99%, AdjustmentsForFairValueGainsLosses 99%, AdjustmentsForUndistributedProfitsOfAssociates 99%, ProceedsFromSalesOfIntangibleAssetsUnderDevelopment 99%, PurchaseOfIntangibleAssetsUnderDevelopment 99%, ReserveExcludingRevaluationReserves 61%, OtherUnallocableExpenditureNetOffUnAllocableIncome 38%, AmountOfItemThatWillBeReclassifiedToProfitAndLoss 37%, DebtEquityRatio 33%, InterSegmentRevenue 32%, DebtServiceCoverageRatio 31%, InterestServiceCoverageRatio 31%

### industrial / in-bse-fin (45678 files)

**P&L (52):** DateOnWhichPriorIntimationOfTheMeetingForConsideringFinancialResultsWasInformedToTheExchange 100%, RevenueFromOperations 100%, EmployeeBenefitExpense 100%, FinanceCosts 100%, Expenses 100%, ProfitBeforeTax 100%, CurrentTax 100%, DeferredTax 100%, TaxExpense 100%, BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations 100%, DilutedEarningsLossPerShareFromContinuingAndDiscontinuedOperations 100%, OtherIncome 100%, CostOfMaterialsConsumed 100%, PurchasesOfStockInTrade 100%, ChangesInInventoriesOfFinishedGoodsWorkInProgressAndStockInTrade 100%, PaidUpValueOfEquityShareCapital 100%, OtherExpenses 100%, Income 100%, DepreciationDepletionAndAmortisationExpense 100%, ProfitBeforeExceptionalItemsAndTax 100%, ProfitLossForPeriodFromContinuingOperations 100%, ComprehensiveIncomeForThePeriod 100%, BasicEarningsLossPerShareFromContinuingOperations 100%, DilutedEarningsLossPerShareFromContinuingOperations 100%, BasicEarningsLossPerShareFromDiscontinuedOperations 100%, DilutedEarningsLossPerShareFromDiscontinuedOperations 100%, ProfitLossFromDiscontinuedOperationsBeforeTax 100%, TaxExpenseOfDiscontinuedOperations 100%, ProfitLossFromDiscontinuedOperationsAfterTax 100%, OtherComprehensiveIncomeNetOfTaxes 100%, ExceptionalItemsBeforeTax 100%, ProfitLossForPeriod 100%, ComprehensiveIncomeForThePeriodAttributableToOwnersOfParent 100%, ComprehensiveIncomeForThePeriodAttributableToOwnersOfParentNonControllingInterests 100%, ShareOfProfitLossOfAssociatesAndJointVenturesAccountedForUsingEquityMethod 99%, NetMovementInRegulatoryDeferralAccountBalancesRelatedToProfitOrLossAndTheRelatedDeferredTaxMovement 93%, IncomeTaxRelatingToItmesThatWillNotBeReclassifiedToProfitOrLoss 66%, IncomeTaxRelatingToItmesThatWillBeReclassifiedToProfitOrLoss 56%, AmountOfItemThatWillNotBeReclassifiedToProfitAndLoss 52%, ProfitOrLossAttributableToOwnersOfParent 36%, ProfitOrLossAttributableToNonControllingInterests 35%, SegmentRevenueFromOperations 35%, SegmentProfitBeforeTax 35%, SegmentRevenue 35%, SegmentProfitLossBeforeTaxAndFinanceCosts 35%, SegmentFinanceCosts 33%, OtherUnallocableExpenditureNetOffUnAllocableIncome 32%, SegmentAssets 30%, DebtEquityRatio 28%, InterSegmentRevenue 28%, DebtServiceCoverageRatio 27%, InterestServiceCoverageRatio 26%

**Balance sheet (62):** Inventories 100%, CashAndCashEquivalents 100%, Assets 100%, EquityAndLiabilities 100%, PropertyPlantAndEquipment 100%, Goodwill 100%, OtherIntangibleAssets 100%, EquityShareCapital 100%, OtherEquity 100%, Equity 100%, BankBalanceOtherThanCashAndCashEquivalents 100%, SegmentLiabilities 98%, EquityAttributableToOwnersOfParent 95%, Liabilities 95%, NoncurrentInvestments 93%, NoncurrentAssets 93%, CurrentInvestments 93%, CurrentAssets 93%, NoncurrentLiabilities 93%, CurrentLiabilities 93%, LoansNoncurrent 93%, NoncurrentFinancialAssets 93%, TradeReceivablesCurrent 93%, LoansCurrent 93%, CurrentFinancialAssets 93%, BorrowingsNoncurrent 93%, NoncurrentFinancialLiabilities 93%, ProvisionsNoncurrent 93%, BorrowingsCurrent 93%, TradePayablesCurrent 93%, CurrentFinancialLiabilities 93%, ProvisionsCurrent 93%, CapitalWorkInProgress 93%, OtherCurrentLiabilities 92%, OtherCurrentFinancialLiabilities 91%, OtherCurrentFinancialAssets 91%, OtherCurrentAssets 91%, OtherNoncurrentFinancialAssets 90%, OtherNoncurrentAssets 89%, DeferredTaxLiabilitiesNet 88%, DeferredTaxAssetsNet 87%, CurrentTaxLiabilities 86%, OtherNoncurrentFinancialLiabilities 85%, NetSegmentLiabilities 83%, UnAllocableLiabilities 83%, NetSegmentAssets 83%, UnAllocableAssets 83%, InvestmentProperty 83%, IntangibleAssetsUnderDevelopment 80%, OtherNoncurrentLiabilities 77%, CurrentTaxAssets 75%, BiologicalAssetsOtherThanBearerPlants 74%, InvestmentsAccountedForUsingEquityMethod 70%, TradeReceivablesNoncurrent 69%, NoncurrentAssetsClassifiedAsHeldForSale 69%, TradePayablesNoncurrent 69%, DeferredGovernmentGrantsNoncurrent 67%, DeferredGovernmentGrantsCurrent 66%, RegulatoryDeferralAccountDebitBalancesAndRelatedDeferredTaxAssets 65%, LiabilitiesDirectlyAssociatedWithAssetsInDisposalGroupClassifiedAsHeldForSale 62%, RegulatoryDeferralAccountCreditBalancesAndRelatedDeferredTaxLiability 61%, NonControllingInterest 31%

**Cash flow (96):** CashFlowsFromUsedInOperations 100%, CashFlowsFromUsedInOperatingActivities 100%, IncreaseDecreaseInCashAndCashEquivalentsBeforeEffectOfExchangeRateChanges 100%, IncreaseDecreaseInCashAndCashEquivalents 100%, DividendsReceivedClassifiedAsOperatingActivities 100%, InterestPaidClassifiedAsOperatingActivities 100%, InterestReceivedClassifiedAsOperatingActivities 100%, IncomeTaxesPaidRefundClassifiedAsOperatingActivities 100%, OtherInflowsOutflowsOfCashClassifiedAsOperatingActivities 100%, CashFlowsFromLosingControlOfSubsidiariesOrOtherBusinessesClassifiedAsInvestingActivities 100%, CashFlowsUsedInObtainingControlOfSubsidiariesOrOtherBusinessesClassifiedAsInvestingActivities 100%, OtherCashReceiptsFromSalesOfEquityOrDebtInstrumentsOfOtherEntitiesClassifiedAsInvestingActivities 100%, OtherCashPaymentsToAcquireEquityOrDebtInstrumentsOfOtherEntitiesClassifiedAsInvestingActivities 100%, OtherCashReceiptsFromSalesOfInterestsInJointVenturesClassifiedAsInvestingActivities 100%, OtherCashPaymentsToAcquireInterestsInJointVenturesClassifiedAsInvestingActivities 100%, ProceedsFromSalesOfIntangibleAssetsClassifiedAsInvestingActivities 100%, PurchaseOfIntangibleAssetsClassifiedAsInvestingActivities 100%, CashAdvancesAndLoansMadeToOtherPartiesClassifiedAsInvestingActivities 100%, CashReceiptsFromRepaymentOfAdvancesAndLoansMadeToOtherPartiesClassifiedAsInvestingActivities 100%, CashPaymentsForFutureContractsForwardContractsOptionContractsAndSwapContractsClassifiedAsInvestingActivities 100%, CashReceiptsFromFutureContractsForwardContractsOptionContractsAndSwapContractsClassifiedAsInvestingActivities 100%, DividendsReceivedClassifiedAsInvestingActivities 100%, InterestReceivedClassifiedAsInvestingActivities 100%, IncomeTaxesPaidRefundClassifiedAsInvestingActivities 100%, OtherInflowsOutflowsOfCashClassifiedAsInvestingActivities 100%, ProceedsFromGovernmentGrantsClassifiedAsInvestingActivities 100%, CashFlowsFromUsedInInvestingActivities 100%, ProceedsFromIssuingOtherEquityInstruments 100%, ProceedsFromIssuingDebenturesNotesBondsEtc 100%, ProceedsFromBorrowingsClassifiedAsFinancingActivities 100%, RepaymentsOfBorrowingsClassifiedAsFinancingActivities 100%, DividendsPaidClassifiedAsFinancingActivities 100%, InterestPaidClassifiedAsFinancingActivities 100%, IncomeTaxesPaidRefundClassifiedAsFinancingActivities 100%, OtherInflowsOutflowsOfCashClassifiedAsFinancingActivities 100%, CashFlowsFromUsedInFinancingActivities 100%, EffectOfExchangeRateChangesOnCashAndCashEquivalents 100%, ProceedsFromSalesOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities 100%, PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities 100%, ProceedsFromSalesOfInvestmentPropertyClassifiedAsInvestingActivities 100%, PurchaseOfInvestmentPropertyClassifiedAsInvestingActivities 100%, ProceedsFromSalesOfGoodwillClassifiedAsInvestingActivities 100%, PurchaseOfGoodwillClassifiedAsInvestingActivities 100%, ProceedsFromBiologicalAssetsOtherThanBearerPlantsClassifiedAsInvestingActivities 100%, PurchaseOfBiologicalAssetsOtherThanBearerPlantsClassifiedAsInvestingActivities 100%, ProceedsFromSalesOfOtherLongTermAssetsClassifiedAsInvestingActivities 100%, PurchaseOfOtherLongTermAssetsClassifiedAsInvestingActivities 100%, ProceedsFromIssuingSharesClassifiedAsFinancingActivities 100%, PaymentsToAcquireOrRedeemEntitysShares 100%, PaymentsOfOtherEquityInstruments 100%, ProceedsFromExerciseOfStockOptions 100%, PaymentsOfFinanceLeaseLiabilitiesClassifiedAsFinancingActivities 100%, PaymentsOfLeaseLiabilitiesClassifiedAsFinancingActivities 100%, AdjustmentsForFinanceCosts 100%, AdjustmentsForDecreaseIncreaseInInventories 100%, AdjustmentsForDecreaseIncreaseInOtherCurrentAssets 100%, AdjustmentsForIncreaseDecreaseInOtherCurrentLiabilities 100%, AdjustmentsForDepreciationAndAmortisationExpense 100%, AdjustmentsForImpairmentLossReversalOfImpairmentLossRecognisedInProfitOrLoss 100%, AdjustmentsForUnrealisedForeignExchangeLossesGains 100%, AdjustmentsForDividendIncome 100%, AdjustmentsForSharebasedPayments 100%, OtherAdjustmentsForWhichCashEffectsAreInvestingOrFinancingCashFlow 100%, OtherAdjustmentsToReconcileProfitLoss 100%, OtherAdjustmentsForNoncashItems 100%, ShareOfProfitAndLossFromPartnershipFirmOrAssociationOfPersonsOrLimitedLiabilityPartnerships 100%, AdjustmentsForReconcileProfitLoss 100%, CashReceiptsFromShareOfProfitsOfPartnershipFirmOrAssociationOfPersonsOrLimitedLiabilityPartnerships 100%, CashPaymentForInvestmentInPartnershipFirmOrAssociationOfPersonsOrLimitedLiabilityPartnerships 100%, AdjustmentsForDecreaseIncreaseInTradeReceivablesCurrent 100%, AdjustmentsForDecreaseIncreaseInTradeReceivablesNoncurrent 100%, AdjustmentsForDecreaseIncreaseInOtherNoncurrentAssets 100%, AdjustmentsForOtherFinancialAssetsNoncurrent 100%, AdjustmentsForOtherFinancialAssetsCurrent 100%, AdjustmentsForOtherBankBalances 100%, AdjustmentsForIncreaseDecreaseInTradePayablesCurrent 100%, AdjustmentsForIncreaseDecreaseInTradePayablesNoncurrent 100%, AdjustmentsForIncreaseDecreaseInOtherNoncurrentLiabilities 100%, AdjustmentsForProvisionsCurrent 100%, AdjustmentsForProvisionsNoncurrent 100%, AdjustmentsForOtherFinancialLiabilitiesCurrent 100%, AdjustmentsForOtherFinancialLiabilitiesNoncurrent 100%, AdjustmentsForInterestIncome 100%, AdjustmentsForFairValueGainsLosses 100%, AdjustmentsForUndistributedProfitsOfAssociates 100%, ProceedsFromSalesOfIntangibleAssetsUnderDevelopment 100%, PurchaseOfIntangibleAssetsUnderDevelopment 100%, ProceedsFromChangesInOwnershipInterestsInSubsidiaries 100%, PaymentsFromChangesInOwnershipInterestsInSubsidiaries 100%, CashAndCashEquivalentsCashFlowStatement 87%, DebtEquityRatio 45%, ReserveExcludingRevaluationReserves 44%, InterSegmentRevenue 43%, DebtServiceCoverageRatio 42%, InterestServiceCoverageRatio 41%, AmountOfItemThatWillBeReclassifiedToProfitAndLoss 32%

### bank / in-capmkt (494 files)

**P&L (44):** InterestOrDiscountOnAdvancesOrBills 100%, RevenueOnInvestments 100%, InterestOnBalancesWithReserveBankOfIndiaAndOtherInterBankFunds 100%, OtherInterest 100%, InterestEarned 100%, OtherIncome 100%, Income 100%, InterestExpended 100%, EmployeesCost 100%, OtherOperatingExpenses 100%, OperatingExpenses 100%, ExpenditureExcludingProvisionsAndContingencies 100%, OperatingProfitBeforeProvisionAndContingencies 100%, ProvisionsOtherThanTaxAndContingencies 100%, ExceptionalItems 100%, ProfitLossFromOrdinaryActivitiesBeforeTax 100%, TaxExpense 100%, ProfitLossFromOrdinaryActivitiesAfterTax 100%, ExtraordinaryItems 100%, ProfitLossForThePeriod 100%, ProfitLossAfterTaxesMinorityInterestAndShareOfProfitLossOfAssociates 100%, PaidUpValueOfEquityShareCapital 100%, PercentageOfShareHeldByGovernmentOfIndia 100%, CET1Ratio 100%, AdditionalTier1Ratio 100%, BasicEarningsPerShareBeforeExtraordinaryItems 100%, DilutedEarningsPerShareBeforeExtraordinaryItems 100%, BasicEarningsPerShareAfterExtraordinaryItems 100%, DilutedEarningsPerShareAfterExtraordinaryItems 100%, GrossNonPerformingAssets 100%, NonPerformingAssets 100%, PercentageOfGrossNpa 100%, PercentageOfNpa 100%, ReturnOnAssets 100%, SegmentRevenue 100%, SegmentRevenueFromOperations 100%, SegmentProfitLossBeforeTaxAndFinanceCosts 100%, SegmentProfitBeforeTax 100%, DateOnWhichPriorIntimationOfTheMeetingForConsideringFinancialResultsWasInformedToTheExchange 100%, OtherUnallocableExpenditureNetOffUnAllocableIncome 84%, SegmentFinanceCosts 79%, InterSegmentRevenue 74%, ShareOfProfitLossOfAssociates 36%, ProfitLossOfMinorityInterest 36%

**Balance sheet (25):** SegmentAssets 170%, UnAllocableAssets 170%, NetSegmentAssets 170%, SegmentLiabilities 170%, UnAllocableLiabilities 170%, NetSegmentLiabilities 170%, Capital 100%, ReservesAndSurplus 100%, Deposits 100%, Borrowings 100%, OtherLiabilitiesAndProvisions 100%, CapitalAndLiabilities 100%, CashAndBalancesWithReserveBankOfIndia 100%, BalancesWithBanksAndMoneyAtCallAndShortNotice 100%, Investments 100%, Advances 100%, FixedAssets 100%, OtherAssets 100%, Assets 100%, CashAndCashEquivalentsCashFlowStatement 100%, TotalOutstandingAmountOfLoansOrRevolvingFacilitiesAtTheEndOfPeriod 31%, AmountOfDefaultOutOfTotalOutstandingAmountOfLoansOrRevolvingFacilitiesAtTheEndOfPeriod 31%, TotalOutstandingAmountOfUnlistedDebtSecuritiesAtTheEndOfPeriod 31%, AmountOfDefaultOutOfTotalOutstandingAmountOfUnlistedDebtSecuritiesAtTheEndOfPeriod 31%, AmountOfTotalFinancialIndebtednessOfTheListedEntityIncludingShortTermAndLongTermDebtAtTheEndOfPeriod 31%

**Cash flow (72):** CashFlowsFromUsedInOperations 100%, DividendsReceivedClassifiedAsOperatingActivities 100%, InterestPaidClassifiedAsOperatingActivities 100%, InterestReceivedClassifiedAsOperatingActivities 100%, IncomeTaxesPaidRefundClassifiedAsOperatingActivities 100%, OtherInflowsOutflowsOfCashClassifiedAsOperatingActivities 100%, CashFlowsFromUsedInOperatingActivitiesBeforeExtraordinaryItems 100%, ProceedsFromExtraordinaryItemsClassifiedAsOperatingActivities 100%, PaymentForExtraordinaryItemsClassifiedAsOperatingActivities 100%, CashFlowsFromUsedInOperatingActivities 100%, CashFlowsFromLosingControlOfSubsidiariesOrOtherBusinessesClassifiedAsInvestingActivities 100%, CashFlowsUsedInObtainingControlOfSubsidiariesOrOtherBusinessesClassifiedAsInvestingActivities 100%, OtherCashReceiptsFromSalesOfEquityOrDebtInstrumentsOfOtherEntitiesClassifiedAsInvestingActivities 100%, OtherCashPaymentsToAcquireEquityOrDebtInstrumentsOfOtherEntitiesClassifiedAsInvestingActivities 100%, OtherCashReceiptsFromSalesOfInterestsInJointVenturesClassifiedAsInvestingActivities 100%, OtherCashPaymentsToAcquireInterestsInJointVenturesClassifiedAsInvestingActivities 100%, CashReceiptsFromShareOfProfitsOfPartnershipFirmOrAssociationOfPersonsOrLimitedLiabilityPartnerships 100%, CashPaymentForInvestmentInPartnershipFirmOrAssociationOfPersonsOrLimitedLiabilityPartnerships 100%, ProceedsFromSalesOfTangibleAssetsClassifiedAsInvestingActivities 100%, PurchaseOfTangibleAssetsClassifiedAsInvestingActivities 100%, ProceedsFromSalesOfIntangibleAssetsClassifiedAsInvestingActivities 100%, PurchaseOfIntangibleAssetsClassifiedAsInvestingActivities 100%, CashAdvancesAndLoansMadeToOtherPartiesClassifiedAsInvestingActivities 100%, CashReceiptsFromRepaymentOfAdvancesAndLoansMadeToOtherPartiesClassifiedAsInvestingActivities 100%, CashPaymentsForFutureContractsForwardContractsOptionContractsAndSwapContractsClassifiedAsInvestingActivities 100%, CashReceiptsFromFutureContractsForwardContractsOptionContractsAndSwapContractsClassifiedAsInvestingActivities 100%, DividendsReceivedClassifiedAsInvestingActivities 100%, InterestReceivedClassifiedAsInvestingActivities 100%, IncomeTaxesPaidRefundClassifiedAsInvestingActivities 100%, OtherInflowsOutflowsOfCashClassifiedAsInvestingActivities 100%, ProceedsFromGovernmentGrantsClassifiedAsInvestingActivities 100%, CashFlowsFromUsedInInvestingActivitiesBeforeExtraordinaryItems 100%, ProceedsFromExtraordinaryItemsClassifiedAsInvestingActivities 100%, PaymentForExtraordinaryItemsClassifiedAsInvestingActivities 100%, CashFlowsFromUsedInInvestingActivities 100%, ProceedsFromIssuingShares 100%, ProceedsFromIssuingOtherEquityInstruments 100%, ProceedsFromIssuingDebenturesNotesBondsEtc 100%, ProceedsFromBorrowingsClassifiedAsFinancingActivities 100%, RepaymentsOfBorrowingsClassifiedAsFinancingActivities 100%, DividendsPaidClassifiedAsFinancingActivities 100%, InterestPaidClassifiedAsFinancingActivities 100%, IncomeTaxesPaidRefundClassifiedAsFinancingActivities 100%, OtherInflowsOutflowsOfCashClassifiedAsFinancingActivities 100%, CashFlowsFromUsedInFinancingActivitiesBeforeExtraordinaryItems 100%, ProceedsFromExtraordinaryItemsClassifiedAsFinancingActivities 100%, PaymentForExtraordinaryItemsClassifiedAsFinancingActivities 100%, CashFlowsFromUsedInFinancingActivities 100%, IncreaseDecreaseInCashAndCashEquivalentsBeforeEffectOfExchangeRateChanges 100%, EffectOfExchangeRateChangesOnCashAndCashEquivalents 100%, IncreaseDecreaseInCashAndCashEquivalents 100%, ProfitBeforeExtraordinaryItemsAndTax 96%, AdjustmentsForFinanceCosts 96%, AdjustmentsForDepreciationAndAmortisationExpense 96%, AdjustmentsForImpairmentLossReversalOfImpairmentLossRecognisedInProfitOrLoss 96%, AdjustmentsForUnrealisedForeignExchangeLossesGains 96%, AdjustmentsForDividendIncome 96%, AdjustmentsForSharebasedPayments 96%, OtherAdjustmentsForWhichCashEffectsAreInvestingOrFinancingCashFlow 96%, OtherAdjustmentsToReconcileProfitLoss 96%, OtherAdjustmentsForNoncashItems 96%, ShareOfProfitAndLossFromPartnershipFirmOrAssociationOfPersonsOrLimitedLiabilityPartnerships 96%, AdjustmentsToProfitLoss 96%, AdjustmentsForDecreaseIncreaseInInventories 96%, AdjustmentsForDecreaseIncreaseInTradeReceivables 96%, AdjustmentsForDecreaseIncreaseInOtherCurrentAssets 96%, AdjustmentsForIncreaseDecreaseInTradePayables 96%, AdjustmentsForIncreaseDecreaseInOtherCurrentLiabilities 96%, AdjustmentsForProvisions 96%, AdjustmentsForWorkingCapital 96%, AdjustmentsForReconcileProfitLoss 96%, ReserveExcludingRevaluationReserves 53%

### bank / in-bse-fin (451 files)

**P&L (45):** DateOnWhichPriorIntimationOfTheMeetingForConsideringFinancialResultsWasInformedToTheExchange 100%, InterestOrDiscountOnAdvancesOrBills 100%, RevenueOnInvestments 100%, InterestOnBalancesWithReserveBankOfIndiaAndOtherInterBankFunds 100%, OtherInterest 100%, InterestEarned 100%, OtherIncome 100%, Income 100%, InterestExpended 100%, EmployeesCost 100%, OtherOperatingExpenses 100%, OperatingExpenses 100%, ExpenditureExcludingProvisionsAndContingencies 100%, OperatingProfitBeforeProvisionAndContingencies 100%, ProvisionsOtherThanTaxAndContingencies 100%, ExceptionalItems 100%, ProfitLossFromOrdinaryActivitiesBeforeTax 100%, TaxExpense 100%, ProfitLossFromOrdinaryActivitiesAfterTax 100%, ExtraordinaryItems 100%, ProfitLossForThePeriod 100%, ProfitLossAfterTaxesMinorityInterestAndShareOfProfitLossOfAssociates 100%, PaidUpValueOfEquityShareCapital 100%, PercentageOfShareHeldByGovernmentOfIndia 100%, CET1Ratio 100%, AdditionalTier1Ratio 100%, BasicEarningsPerShareBeforeExtraordinaryItems 100%, DilutedEarningsPerShareBeforeExtraordinaryItems 100%, BasicEarningsPerShareAfterExtraordinaryItems 100%, DilutedEarningsPerShareAfterExtraordinaryItems 100%, GrossNonPerformingAssets 100%, NonPerformingAssets 100%, PercentageOfGrossNpa 100%, PercentageOfNpa 100%, ReturnOnAssets 100%, SegmentRevenue 100%, SegmentRevenueFromOperations 100%, SegmentProfitLossBeforeTaxAndFinanceCosts 100%, SegmentProfitBeforeTax 100%, SegmentFinanceCosts 90%, OtherUnallocableExpenditureNetOffUnAllocableIncome 88%, SegmentAssets 84%, InterSegmentRevenue 74%, ShareOfProfitLossOfAssociates 38%, ProfitLossOfMinorityInterest 38%

**Balance sheet (19):** SegmentLiabilities 195%, NetSegmentLiabilities 168%, NetSegmentAssets 162%, UnAllocableLiabilities 160%, UnAllocableAssets 155%, Capital 100%, ReservesAndSurplus 100%, Deposits 100%, Borrowings 100%, OtherLiabilitiesAndProvisions 100%, CapitalAndLiabilities 100%, CashAndBalancesWithReserveBankOfIndia 100%, BalancesWithBanksAndMoneyAtCallAndShortNotice 100%, Investments 100%, Advances 100%, FixedAssets 100%, OtherAssets 100%, Assets 100%, SegmentAssets 31%

**Cash flow (72):** CashFlowsFromUsedInOperations 100%, DividendsReceivedClassifiedAsOperatingActivities 100%, InterestPaidClassifiedAsOperatingActivities 100%, InterestReceivedClassifiedAsOperatingActivities 100%, IncomeTaxesPaidRefundClassifiedAsOperatingActivities 100%, OtherInflowsOutflowsOfCashClassifiedAsOperatingActivities 100%, CashFlowsFromUsedInOperatingActivitiesBeforeExtraordinaryItems 100%, ProceedsFromExtraordinaryItemsClassifiedAsOperatingActivities 100%, PaymentForExtraordinaryItemsClassifiedAsOperatingActivities 100%, CashFlowsFromUsedInOperatingActivities 100%, CashFlowsFromLosingControlOfSubsidiariesOrOtherBusinessesClassifiedAsInvestingActivities 100%, CashFlowsUsedInObtainingControlOfSubsidiariesOrOtherBusinessesClassifiedAsInvestingActivities 100%, OtherCashReceiptsFromSalesOfEquityOrDebtInstrumentsOfOtherEntitiesClassifiedAsInvestingActivities 100%, OtherCashPaymentsToAcquireEquityOrDebtInstrumentsOfOtherEntitiesClassifiedAsInvestingActivities 100%, OtherCashReceiptsFromSalesOfInterestsInJointVenturesClassifiedAsInvestingActivities 100%, OtherCashPaymentsToAcquireInterestsInJointVenturesClassifiedAsInvestingActivities 100%, CashReceiptsFromShareOfProfitsOfPartnershipFirmOrAssociationOfPersonsOrLimitedLiabilityPartnerships 100%, CashPaymentForInvestmentInPartnershipFirmOrAssociationOfPersonsOrLimitedLiabilityPartnerships 100%, ProceedsFromSalesOfTangibleAssetsClassifiedAsInvestingActivities 100%, PurchaseOfTangibleAssetsClassifiedAsInvestingActivities 100%, ProceedsFromSalesOfIntangibleAssetsClassifiedAsInvestingActivities 100%, PurchaseOfIntangibleAssetsClassifiedAsInvestingActivities 100%, CashAdvancesAndLoansMadeToOtherPartiesClassifiedAsInvestingActivities 100%, CashReceiptsFromRepaymentOfAdvancesAndLoansMadeToOtherPartiesClassifiedAsInvestingActivities 100%, CashPaymentsForFutureContractsForwardContractsOptionContractsAndSwapContractsClassifiedAsInvestingActivities 100%, CashReceiptsFromFutureContractsForwardContractsOptionContractsAndSwapContractsClassifiedAsInvestingActivities 100%, DividendsReceivedClassifiedAsInvestingActivities 100%, InterestReceivedClassifiedAsInvestingActivities 100%, IncomeTaxesPaidRefundClassifiedAsInvestingActivities 100%, OtherInflowsOutflowsOfCashClassifiedAsInvestingActivities 100%, ProceedsFromGovernmentGrantsClassifiedAsInvestingActivities 100%, CashFlowsFromUsedInInvestingActivitiesBeforeExtraordinaryItems 100%, ProceedsFromExtraordinaryItemsClassifiedAsInvestingActivities 100%, PaymentForExtraordinaryItemsClassifiedAsInvestingActivities 100%, CashFlowsFromUsedInInvestingActivities 100%, ProceedsFromIssuingShares 100%, ProceedsFromIssuingOtherEquityInstruments 100%, ProceedsFromIssuingDebenturesNotesBondsEtc 100%, ProceedsFromBorrowingsClassifiedAsFinancingActivities 100%, RepaymentsOfBorrowingsClassifiedAsFinancingActivities 100%, DividendsPaidClassifiedAsFinancingActivities 100%, InterestPaidClassifiedAsFinancingActivities 100%, IncomeTaxesPaidRefundClassifiedAsFinancingActivities 100%, OtherInflowsOutflowsOfCashClassifiedAsFinancingActivities 100%, CashFlowsFromUsedInFinancingActivitiesBeforeExtraordinaryItems 100%, ProceedsFromExtraordinaryItemsClassifiedAsFinancingActivities 100%, PaymentForExtraordinaryItemsClassifiedAsFinancingActivities 100%, CashFlowsFromUsedInFinancingActivities 100%, IncreaseDecreaseInCashAndCashEquivalentsBeforeEffectOfExchangeRateChanges 100%, EffectOfExchangeRateChangesOnCashAndCashEquivalents 100%, IncreaseDecreaseInCashAndCashEquivalents 100%, AdjustmentsForFinanceCosts 97%, AdjustmentsForDepreciationAndAmortisationExpense 97%, AdjustmentsForImpairmentLossReversalOfImpairmentLossRecognisedInProfitOrLoss 97%, AdjustmentsForUnrealisedForeignExchangeLossesGains 97%, AdjustmentsForDividendIncome 97%, AdjustmentsForSharebasedPayments 97%, OtherAdjustmentsForWhichCashEffectsAreInvestingOrFinancingCashFlow 97%, OtherAdjustmentsToReconcileProfitLoss 97%, OtherAdjustmentsForNoncashItems 97%, ShareOfProfitAndLossFromPartnershipFirmOrAssociationOfPersonsOrLimitedLiabilityPartnerships 97%, AdjustmentsToProfitLoss 97%, AdjustmentsForDecreaseIncreaseInInventories 97%, AdjustmentsForDecreaseIncreaseInTradeReceivables 97%, AdjustmentsForDecreaseIncreaseInOtherCurrentAssets 97%, AdjustmentsForIncreaseDecreaseInTradePayables 97%, AdjustmentsForIncreaseDecreaseInOtherCurrentLiabilities 97%, AdjustmentsForProvisions 97%, AdjustmentsForWorkingCapital 97%, AdjustmentsForReconcileProfitLoss 97%, CashAndCashEquivalentsCashFlowStatement 80%, ReserveExcludingRevaluationReserves 29%

### life_insurance / in-capmkt (55 files)

**P&L (105):** DateOnWhichPriorIntimationOfTheMeetingForConsideringFinancialResultsWasInformedToTheExchange 100%, IncomeFirstYearPremium 100%, IncomeRenewalPremium 100%, IncomeSinglePremium 100%, GrossPremiumIncome 100%, NetPremiumIncome 100%, IncomeFromInvestmentsNet 100%, PolicyholdersAccountOtherIncome 100%, TransferOfFundsFromShareholdersAccount 100%, Income 100%, CommissionFirstYearPremium 100%, CommissionRenewalPremium 100%, CommissionSinglePremium 100%, Commission 100%, NetCommission 100%, EmployeesRemunerationAndWelfareExpenses 100%, AdministrationExpenses 100%, AdvertisementAndPublicity 100%, OtherOperatingExpenses 100%, OperatingExpensesRelatedToInsuranceBusiness 100%, ExpensesOfManagement 100%, ProvisionsForDoubtfulDebtsIncludingBadDebtsWrittenOff 100%, ProvisionsForDiminutionInValueOfInvestments 100%, GoodsAndServiceTaxChargeOnLinkedCharges 100%, CurrentTax 100%, DefferedTax 100%, ProvisionForTax 100%, BenefitsPaidNet 100%, ChangeInActuarialLiability 100%, Expenses 100%, NetSurplusDeficit 100%, TransferredToShareholdersAccount 100%, FundsForFutureAppropriation 100%, InterimBonusPaid 100%, AllocationOfBonusToPolicyholders 100%, SurplusShownInTheRevenueAccount 100%, TerminalBonusPaid 100%, SurplusDeficit 100%, TransferFromPolicyholdersAccount 100%, InvestmentIncome 100%, IncomeUnderShareholdersAccount 100%, ShareholdersAccountIncome 100%, ExpensesOtherThanThoseRelatedToInsuranceBusiness 100%, TransferOfFundsToPolicyholdersAccount 100%, ProvisionsForDoubtfulDebtsIncludingWriteOff 100%, ShareholdersAccountProvisionsForDiminutionInValueOfInvestments 100%, ShareholdersAccountExpenses 100%, ProfitLossBeforeTax 100%, ProvisionsForTaxes 100%, CurrentTaxes 100%, DefferedTaxes 100%, ProfitLossAfterTaxBeforeExtraordinaryItems 100%, ExtraordinaryItemsNetOfTaxExpenses 100%, ProfitLossAfterTaxAndExtraordinaryItems 100%, InterimDividend 100%, FinalDividend 100%, ProfitLossCarriedToBalanceSheet 100%, ReservesAndSurplusExcludingRevaluationReserve 100%, SolvencyRatio 100%, ExpensesOfManagementRatio 100%, PolicyholdersLiabilitiesToShareholdersFund 100%, BasicAndDilutedEPSBeforeExtraordinaryItemsNetOfTaxExpenseForThePeriodNotToBeAnnualized 100%, BasicAndDilutedEPSAfterExtraordinaryItemsNetOfTaxExpenseForThePeriodNotToBeAnnualized 100%, NonLinkedParticipatingPolicyholdersFundGrossNPAs 100%, NonLinkedNonParticipatingPolicyholdersFundGrossNPAs 100%, LinkedParticipatingPolicyholdersFundGrossNPAs 100%, LinkedNonParticipatingPolicyholdersFundGrossNPAs 100%, NonLinkedParticipatingPolicyholdersFundNetNPAs 100%, NonLinkedNonParticipatingPolicyholdersFundNetNPAs 100%, LinkedParticipatingPolicyholdersFundNetNPAs 100%, LinkedNonParticipatingPolicyholdersFundNetNPAs 100%, NonLinkedParticipatingPolicyholdersFundPercentageOfGrossNPAs 100%, NonLinkedNonParticipatingPolicyholdersFundPercentageOfGrossNPAs 100%, LinkedParticipatingPolicyholdersFundPercentageOfGrossNPAs 100%, LinkedNonParticipatingPolicyholdersFundPercentageOfGrossNPAs 100%, NonLinkedParticipatingPolicyholdersFundPercentageOfNetNPAs 100%, NonLinkedNonParticipatingPolicyholdersFundPercentageOfNetNPAs 100%, LinkedParticipatingPolicyholdersFundPercentageOfNetNPAs 100%, LinkedNonParticipatingPolicyholdersFundPercentageOfNetNPAs 100%, NonLinkedParticipatingPolicyholdersFundWithoutUnrealisedGains 100%, NonLinkedNonParticipatingPolicyholdersFundWithoutUnrealisedGains 100%, LinkedParticipatingPolicyholdersFundWithoutUnrealisedGains 100%, LinkedNonParticipatingPolicyholdersFundWithoutUnrealisedGains 100%, NonLinkedParticipatingPolicyholdersFundWithUnrealisedGains 100%, NonLinkedNonParticipatingPolicyholdersFundWithUnrealisedGains 100%, LinkedParticipatingPolicyholdersFundWithUnrealisedGains 100%, LinkedNonParticipatingPolicyholdersFundWithUnrealisedGains 100%, GrossNPAsShareholdersFund 100%, NetNPAsShareholdersFund 100%, PercentageOfGrossNPAsShareholdersFund 100%, PercentageOfNetNPAsShareholdersFund 100%, ShareholdersFundWithoutUnrealisedGains 100%, ShareholdersFundWithUnrealisedGains 100%, PersistencyRatio13ThMonth 100%, PersistencyRatio25ThMonth 100%, PersistencyRatio37ThMonth 100%, PersistencyRatio49ThMonth 100%, PersistencyRatio61ThMonth 100%, ConservationRatio 100%, PercentageOfSharesHeldByGovernmentOfIndiaInCaseOfPublicSectorInsuranceCompanies 100%, NoOfInvestorComplaintsReceivedDuringThePeriod 100%, NoOfInvestorComplaintsDisposedOffDuringThePeriod 100%, NoOfInvestorComplaintsDuringThePeriod 100%, ShareholdersAccountOtherIncome 93%, DisclosureOfNotesOnFinancialResultsExplanatoryTextBlock 62%

**Balance sheet (48):** PaidUpEquityShareCapital 100%, FairValueChangeAccountAndRevaluationReserveShareholders 100%, InvestmentsShareholdersFund 100%, InvestmentsPolicyholdersFundExcludingLinkedAssets 100%, AssetsHeldToCoverLinkedLiabilities 100%, Investments 100%, OtherAssetsNetOfCurrentLiabilitiesAndProvisions 100%, Assets 100%, NoOfInvestorComplaints 100%, ShareCapital 64%, ReservesAndSurplus 64%, ShareApplicationMoneyReceivedPendingAllotmentOfShares 64%, CreditDebitFairValueChangeAccount 64%, ShareholdersFunds 64%, Borrowings 64%, CreditDebitFairValueChangeAccountPolicyholdersFunds 64%, PolicyLiabilities 64%, InsuranceReserve 64%, RevaluationReserveInvestmentProperty 64%, ProvisionForLinkedLiabilities 64%, ChangeInFairvalueAccount 64%, DiscontinuedOnAccountOfNonPaymentOfPremium 64%, CreditDebitFairValueChangeAccountFundsForDiscontinuedPolicies 64%, OthersDiscontinuance 64%, LinkedLiabilities 64%, PolicyholdersFunds 64%, FundsForFutureAppropriations 64%, SourcesOfFunds 64%, InvestmentsShareholders 64%, InvestmentsPolicyholders 64%, AssetsHeldToCoverLinkLiabilities 64%, Loans 64%, FixedAssets 64%, DeferredTaxAsset 64%, CashAndBankBalances 64%, AdvancesAndOtherAssets 64%, CurrentAssets 64%, CurrentLiabilities 64%, Provisions 64%, CurrentLiabilitiesAndProvisions 64%, NetCurrentAssets 64%, MiscellaneousExpenditureToTheExtentNotWrittenOffOrAdjusted 64%, DebitBalanceInProfitAndLossAccountShareholdersAccount 64%, ApplicationOfFunds 64%, ContigentLiabilities 64%, CashAndCashEquivalentsCashFlowStatement 64%, DisclosureOfNotesOnSegmentSurplusDeficitExplanatoryTextBlock 29%, DisclosureOfNotesOnSegmentLiabilitiesExplanatoryTextBlock 27%

**Cash flow (66):** ReceiptsFromSalesOfGoodsAndRenderingOfServices 100%, ReceiptsFromRoyaltiesFeesCommissionsAndOtherRevenue 100%, ReceiptsFromContractsHeldForDealingOrTradingPurpose 100%, ReceiptsFromPremiumsAndClaimsAnnuitiesAndOtherPolicyBenefits 100%, ReceiptsFromRentsAndSubsequentSalesOfAssetsHeldForRentalToOthersAndSubsequentlyHeldForSale 100%, OtherCashReceiptsFromOperatingActivities 100%, PaymentsToSuppliersForGoodsAndServices 100%, PaymentsFromContractsHeldForDealingOrTradingPurpose 100%, PaymentsToAndOnBehalfOfEmployees 100%, PaymentsForPremiumsAndClaimsAnnuitiesAndOtherPolicyBenefits 100%, PaymentsToManufactureOrAcquireAssetsHeldForRentalToOthersAndSubsequentlyHeldForSale 100%, OtherCashPaymentsFromOperatingActivities 100%, CashFlowsFromUsedInOperations 100%, DividendsReceivedClassifiedAsOperatingActivities 100%, InterestPaidClassifiedAsOperatingActivities 100%, InterestReceivedClassifiedAsOperatingActivities 100%, IncomeTaxesPaidRefundClassifiedAsOperatingActivities 100%, OtherInflowsOutflowsOfCashClassifiedAsOperatingActivities 100%, CashFlowsFromUsedInOperatingActivities 100%, CashFlowsFromLosingControlOfSubsidiariesOrOtherBusinessesClassifiedAsInvestingActivities 100%, CashFlowsUsedInObtainingControlOfSubsidiariesOrOtherBusinessesClassifiedAsInvestingActivities 100%, OtherCashReceiptsFromSalesOfEquityOrDebtInstrumentsOfOtherEntitiesClassifiedAsInvestingActivities 100%, OtherCashPaymentsToAcquireEquityOrDebtInstrumentsOfOtherEntitiesClassifiedAsInvestingActivities 100%, OtherCashReceiptsFromSalesOfInterestsInJointVenturesClassifiedAsInvestingActivities 100%, OtherCashPaymentsToAcquireInterestsInJointVenturesClassifiedAsInvestingActivities 100%, ProceedsFromSalesOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities 100%, PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities 100%, ProceedsFromSalesOfInvestmentPropertyClassifiedAsInvestingActivities 100%, PurchaseOfInvestmentPropertyClassifiedAsInvestingActivities 100%, ProceedsFromSalesOfGoodwillClassifiedAsInvestingActivities 100%, PurchaseOfGoodwillClassifiedAsInvestingActivities 100%, ProceedsFromSalesOfIntangibleAssetsClassifiedAsInvestingActivities 100%, PurchaseOfIntangibleAssetsClassifiedAsInvestingActivities 100%, ProceedsFromBiologicalAssetsOtherThanBearerPlantsClassifiedAsInvestingActivities 100%, PurchaseOfBiologicalAssetsOtherThanBearerPlantsClassifiedAsInvestingActivities 100%, ProceedsFromSalesOfOtherLongTermAssetsClassifiedAsInvestingActivities 100%, PurchaseOfOtherLongTermAssetsClassifiedAsInvestingActivities 100%, CashAdvancesAndLoansMadeToOtherPartiesClassifiedAsInvestingActivities 100%, CashReceiptsFromRepaymentOfAdvancesAndLoansMadeToOtherPartiesClassifiedAsInvestingActivities 100%, CashPaymentsForFutureContractsForwardContractsOptionContractsAndSwapContractsClassifiedAsInvestingActivities 100%, CashReceiptsFromFutureContractsForwardContractsOptionContractsAndSwapContractsClassifiedAsInvestingActivities 100%, DividendsReceivedClassifiedAsInvestingActivities 100%, InterestReceivedClassifiedAsInvestingActivities 100%, IncomeTaxesPaidRefundClassifiedAsInvestingActivities 100%, OtherInflowsOutflowsOfCashClassifiedAsInvestingActivities 100%, ProceedsFromGovernmentGrantsClassifiedAsInvestingActivities 100%, CashFlowsFromUsedInInvestingActivities 100%, ProceedsFromChangesInOwnershipInterestsInSubsidiaries 100%, PaymentsFromChangesInOwnershipInterestsInSubsidiaries 100%, ProceedsFromIssuingSharesClassifiedAsFinancingActivities 100%, ProceedsFromIssuingOtherEquityInstruments 100%, PaymentsToAcquireOrRedeemEntitysShares 100%, PaymentsOfOtherEquityInstruments 100%, ProceedsFromExerciseOfStockOptions 100%, ProceedsFromIssuingDebenturesNotesBondsEtc 100%, ProceedsFromBorrowingsClassifiedAsFinancingActivities 100%, RepaymentsOfBorrowingsClassifiedAsFinancingActivities 100%, PaymentsOfLeaseLiabilitiesClassifiedAsFinancingActivities 100%, DividendsPaidClassifiedAsFinancingActivities 100%, InterestPaidClassifiedAsFinancingActivities 100%, IncomeTaxesPaidRefundClassifiedAsFinancingActivities 100%, OtherInflowsOutflowsOfCashClassifiedAsFinancingActivities 100%, CashFlowsFromUsedInFinancingActivities 100%, IncreaseDecreaseInCashAndCashEquivalentsBeforeEffectOfExchangeRateChanges 100%, EffectOfExchangeRateChangesOnCashAndCashEquivalents 100%, IncreaseDecreaseInCashAndCashEquivalents 100%

### general_insurance / in-capmkt (56 files)

**P&L (59):** DateOnWhichPriorIntimationOfTheMeetingForConsideringFinancialResultsWasInformedToTheExchange 100%, GrossPremiumsWritten 100%, NetPremiumWritten 100%, PremiumEarned 100%, IncomeFromInvestmentsNet 100%, OtherIncome 100%, OperatingIncome 100%, CommissionsAndBrokerageNet 100%, NetCommission 100%, EmployeesRemunerationAndWelfareExpenses 100%, OtherOperatingExpenses 100%, OperatingExpensesRelatedToInsuranceBusiness 100%, PremiumDeficiency 100%, ClaimsPaid 100%, ChangeInOutstandingClaims 100%, IncurredClaims 100%, OperatingExpenses 100%, UnderwritingProfitOrLoss 100%, ProvisionsForDoubtfulDebtsIncludingBadDebtsWrittenOff 100%, ProvisionsForDiminutionInValueOfInvestments 100%, OperatingProfitOrLoss 100%, TransferToProfitAndLossAccount 100%, TransferToReserves 100%, ShareholdersAccountTransferFromPolicyholdersFund 100%, ShareholdersAccountIncomeFromInvestments 100%, ShareholdersAccountOtherIncome 100%, IncomeInShareholdersAccount 100%, NonOperatingExpensesOtherThanThoseRelatedToInsuranceBusiness 100%, NonOperatingProvisionsForDoubtfulDebtsIncludingBadDebtsWrittenOff 100%, NonOperatingProvisionsForDiminutionInValueOfInvestments 100%, NonOperatingExpense 100%, ProfitOrLossBeforeExtraordinaryItems 100%, ExtraordinaryItems 100%, ProfitOrLossBeforeTax 100%, ProvisionForTax 100%, ProfitLossAfterTax 100%, InterimDividend 100%, FinalDividend 100%, ProfitLossCarriedToBalanceSheet 100%, ReservesAndSurplusExcludingRevaluationReserve 100%, SolvencyRatio 100%, ExpensesOfManagementRatio 100%, IncurredClaimRatio 100%, NetRetentionRatio 100%, CombinedRatio 100%, BasicAndDilutedEPSBeforeExtraordinaryItemsNetOfTaxExpenseForThePeriodNotToBeAnnualized 100%, BasicAndDilutedEPSAfterExtraordinaryItemsNetOfTaxExpenseForThePeriodNotToBeAnnualized 100%, GrossNPAsPolicyholdersFund 100%, NetNPAsPolicyholdersFund 100%, PercentageOfGrossNPAsPolicyholdersFund 100%, PercentageOfNetNPAsPolicyholdersFund 100%, WithoutUnrealizedGains 100%, WithUnrealisedGains 100%, PercentageOfShareholding 100%, PercentageOfGovernmentHolding 100%, NoOfInvestorComplaintsReceivedDuringThePeriod 100%, NoOfInvestorComplaintsDisposedOffDuringThePeriod 100%, NoOfInvestorComplaintsDuringThePeriod 100%, DisclosureOfNotesOnFinancialResultsExplanatoryTextBlock 64%

**Balance sheet (39):** PaidUpEquityCapital 100%, FairValueChangeAccountAndRevaluationReserve 100%, InvestmentsShareholderFund 100%, InvestmentsPolicyholdersFund 100%, Investments 100%, OtherAssetsNetOfCurrentLiabilitiesAndProvisions 100%, Assets 100%, NoOfInvestorComplaints 100%, ShareCapital 57%, ReservesAndSurplus 57%, ShareApplicationMoneyReceivedPendingAllotmentOfShares 57%, PolicyholdersFunds 57%, ShareholdersFunds 57%, Borrowings 57%, MinorityInterest 57%, SourcesOfFunds 57%, InvestmentsShareholders 57%, InvestmentsPolicyholders 57%, Loans 57%, FixedAssets 57%, DeferredTaxAsset 57%, CashAndBankBalances 57%, AdvancesAndOtherAssets 57%, CurrentAssets 57%, CurrentLiabilities 57%, Provisions 57%, CurrentLiabilitiesAndProvisions 57%, NetCurrentAssets 57%, MiscellaneousExpenditureToTheExtentNotWrittenOffOrAdjusted 57%, DebitBalanceInProfitAndLossAccountShareholdersAccount 57%, ApplicationOfFunds 57%, ContigentLiabilities 57%, DisclosureOfNotesOnSegmentTechnicalLiabilitiesUnexpiredClaimsReservesIncludingIBNRAndIBNERExplanatoryTextBlock 46%, CashAndCashEquivalentsCashFlowStatement 41%, DisclosureOfNotesOnSegmentIncomeExplanatoryTextBlock 39%, DisclosureOfNotesOnSegmentUnderwritingProfitOrLossExplanatoryTextBlock 39%, DisclosureOfNotesOnSegmentOperatingProfitOrLossExplanatoryTextBlock 39%, DisclosureOfNotesOnSegmentTechnicalLiabilitiesUnexpiredRiskReserveNetExplanatoryTextBlock 39%, DisclosureOfNotesOnSegmentPremiumDeficiencyExplanatoryTextBlock 30%

**Cash flow (66):** ReceiptsFromSalesOfGoodsAndRenderingOfServices 100%, ReceiptsFromRoyaltiesFeesCommissionsAndOtherRevenue 100%, ReceiptsFromContractsHeldForDealingOrTradingPurpose 100%, ReceiptsFromPremiumsAndClaimsAnnuitiesAndOtherPolicyBenefits 100%, ReceiptsFromRentsAndSubsequentSalesOfAssetsHeldForRentalToOthersAndSubsequentlyHeldForSale 100%, OtherCashReceiptsFromOperatingActivities 100%, PaymentsToSuppliersForGoodsAndServices 100%, PaymentsFromContractsHeldForDealingOrTradingPurpose 100%, PaymentsToAndOnBehalfOfEmployees 100%, PaymentsForPremiumsAndClaimsAnnuitiesAndOtherPolicyBenefits 100%, PaymentsToManufactureOrAcquireAssetsHeldForRentalToOthersAndSubsequentlyHeldForSale 100%, OtherCashPaymentsFromOperatingActivities 100%, CashFlowsFromUsedInOperations 100%, DividendsReceivedClassifiedAsOperatingActivities 100%, InterestPaidClassifiedAsOperatingActivities 100%, InterestReceivedClassifiedAsOperatingActivities 100%, IncomeTaxesPaidRefundClassifiedAsOperatingActivities 100%, OtherInflowsOutflowsOfCashClassifiedAsOperatingActivities 100%, CashFlowsFromUsedInOperatingActivities 100%, CashFlowsFromLosingControlOfSubsidiariesOrOtherBusinessesClassifiedAsInvestingActivities 100%, CashFlowsUsedInObtainingControlOfSubsidiariesOrOtherBusinessesClassifiedAsInvestingActivities 100%, OtherCashReceiptsFromSalesOfEquityOrDebtInstrumentsOfOtherEntitiesClassifiedAsInvestingActivities 100%, OtherCashPaymentsToAcquireEquityOrDebtInstrumentsOfOtherEntitiesClassifiedAsInvestingActivities 100%, OtherCashReceiptsFromSalesOfInterestsInJointVenturesClassifiedAsInvestingActivities 100%, OtherCashPaymentsToAcquireInterestsInJointVenturesClassifiedAsInvestingActivities 100%, ProceedsFromSalesOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities 100%, PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities 100%, ProceedsFromSalesOfInvestmentPropertyClassifiedAsInvestingActivities 100%, PurchaseOfInvestmentPropertyClassifiedAsInvestingActivities 100%, ProceedsFromSalesOfGoodwillClassifiedAsInvestingActivities 100%, PurchaseOfGoodwillClassifiedAsInvestingActivities 100%, ProceedsFromSalesOfIntangibleAssetsClassifiedAsInvestingActivities 100%, PurchaseOfIntangibleAssetsClassifiedAsInvestingActivities 100%, ProceedsFromBiologicalAssetsOtherThanBearerPlantsClassifiedAsInvestingActivities 100%, PurchaseOfBiologicalAssetsOtherThanBearerPlantsClassifiedAsInvestingActivities 100%, ProceedsFromSalesOfOtherLongTermAssetsClassifiedAsInvestingActivities 100%, PurchaseOfOtherLongTermAssetsClassifiedAsInvestingActivities 100%, CashAdvancesAndLoansMadeToOtherPartiesClassifiedAsInvestingActivities 100%, CashReceiptsFromRepaymentOfAdvancesAndLoansMadeToOtherPartiesClassifiedAsInvestingActivities 100%, CashPaymentsForFutureContractsForwardContractsOptionContractsAndSwapContractsClassifiedAsInvestingActivities 100%, CashReceiptsFromFutureContractsForwardContractsOptionContractsAndSwapContractsClassifiedAsInvestingActivities 100%, DividendsReceivedClassifiedAsInvestingActivities 100%, InterestReceivedClassifiedAsInvestingActivities 100%, IncomeTaxesPaidRefundClassifiedAsInvestingActivities 100%, OtherInflowsOutflowsOfCashClassifiedAsInvestingActivities 100%, ProceedsFromGovernmentGrantsClassifiedAsInvestingActivities 100%, CashFlowsFromUsedInInvestingActivities 100%, ProceedsFromChangesInOwnershipInterestsInSubsidiaries 100%, PaymentsFromChangesInOwnershipInterestsInSubsidiaries 100%, ProceedsFromIssuingSharesClassifiedAsFinancingActivities 100%, ProceedsFromIssuingOtherEquityInstruments 100%, PaymentsToAcquireOrRedeemEntitysShares 100%, PaymentsOfOtherEquityInstruments 100%, ProceedsFromExerciseOfStockOptions 100%, ProceedsFromIssuingDebenturesNotesBondsEtc 100%, ProceedsFromBorrowingsClassifiedAsFinancingActivities 100%, RepaymentsOfBorrowingsClassifiedAsFinancingActivities 100%, PaymentsOfLeaseLiabilitiesClassifiedAsFinancingActivities 100%, DividendsPaidClassifiedAsFinancingActivities 100%, InterestPaidClassifiedAsFinancingActivities 100%, IncomeTaxesPaidRefundClassifiedAsFinancingActivities 100%, OtherInflowsOutflowsOfCashClassifiedAsFinancingActivities 100%, CashFlowsFromUsedInFinancingActivities 100%, IncreaseDecreaseInCashAndCashEquivalentsBeforeEffectOfExchangeRateChanges 100%, EffectOfExchangeRateChangesOnCashAndCashEquivalents 100%, IncreaseDecreaseInCashAndCashEquivalents 100%
<!-- END docs/statement-line-items.md -->

<!-- BEGIN docs/sector-map.md -->
## Sector map — draft for owner review (D121, #240, #290)

**Approved by the owner 2026-11-03 (#291, D150): v1 with all 8 ⚑ rows as proposed; provisional until the full value list is collected.** Live in D1 as `sector_map` (market/0024); new values appear as `unmapped` on `/sectors`.

Drafted 2026-11-03 from NSE data. **Primary source:** the `Industry` column of NSE's Total Market index list (754 stocks, 22 sectors). **Fill:** the `smIndustry` value on NSE announcements (Aug–Oct 2026: 934 companies, 74 values), mapped to the 22 sectors below.
**How each row was decided:** for companies in both sources, the share whose NSE sector matches the proposed one (`evidence`). *high* = at least 80% agree across 3 or more companies (taken from the data); *judgement* = mixed or thin evidence, decided by Claude (reason given); *no overlap* = no company in both, mapped by NSE's published industry hierarchy.
**Coverage:** 1344 companies get a sector from either source; 19 of them stay Unclassified. Companies in neither source stay Unclassified until they appear in one.

**Please check the rows marked ⚑** (the calls that could reasonably go either way). Reply with any row to change; everything else is applied as drafted.

| smIndustry value | Companies | Proposed sector | Evidence | Basis | Note |
|---|---|---|---|---|---|
| ⚑ Construction | 68 | Construction | 11 of 17 agree | judgement | Mixed in NSE's list (Realty 11, Construction 6): the value covers both property developers and contractors. Proposed default Construction; developers inside the Total Market list keep NSE's Realty. |
| Pharmaceuticals | 56 | Healthcare | 23 of 23 agree | high |  |
| Finance | 54 | Financial Services | 14 of 15 agree | high |  |
| Computers - Software | 49 | Information Technology | 15 of 18 agree | high |  |
| Auto Ancillaries | 41 | Automobile and Auto Components | 11 of 12 agree | high |  |
| ⚑ Steel And Steel Products | 36 | Metals & Mining | 10 of 17 agree | judgement | Mixed (Capital Goods 10, Metals & Mining 7): NSE puts steel pipes/tubes makers under Capital Goods. Default Metals & Mining. |
| Textile Products | 33 | Textiles | 7 of 7 agree | high |  |
| Banks | 26 | Financial Services | 24 of 24 agree | high |  |
| Electrical Equipment | 25 | Capital Goods | 12 of 13 agree | high |  |
| ⚑ Miscellaneous | 25 | Unclassified | 3 of 6 agree | judgement | Too vague to map honestly (Consumer Services 3, Healthcare 2, Capital Goods 1). |
| Power | 23 | Power | 12 of 12 agree | high |  |
| Textiles - Cotton | 22 | Textiles | 2 of 2 agree | judgement |  |
| Cement And Cement Products | 22 | Construction Materials | 8 of 8 agree | high |  |
| Media & Entertainment | 21 | Media Entertainment & Publication | 4 of 4 agree | high |  |
| Engineering | 20 | Capital Goods | 4 of 8 agree | judgement |  |
| Sugar | 20 | Fast Moving Consumer Goods | 3 of 3 agree | high |  |
| Textiles - Synthetic | 18 | Textiles | 1 of 1 agree | judgement | One overlap says Chemicals (a synthetic-fibre maker); Textiles is the natural home. |
| Food And Food Processing | 17 | Fast Moving Consumer Goods | 6 of 7 agree | high |  |
| Plastic And Plastic Products | 17 | Capital Goods | 4 of 6 agree | judgement | Mixed (Capital Goods 4, Consumer Durables 2). |
| Trading | 16 | Services | 2 of 3 agree | judgement |  |
| Hotels | 14 | Consumer Services | 2 of 2 agree | judgement |  |
| ⚑ Packaging | 13 | Capital Goods | — | no overlap | No overlap; NSE's industry hierarchy places packaging under Capital Goods (industrial products). |
| Chemicals - Speciality | 12 | Chemicals | 5 of 5 agree | high |  |
| Chemicals - Inorganic | 12 | Chemicals | 5 of 6 agree | high |  |
| Paper And Paper Products | 12 | Forest Materials | 1 of 1 agree | judgement |  |
| Fertilisers | 11 | Chemicals | 7 of 7 agree | high |  |
| Printing And Publishing | 11 | Media Entertainment & Publication | — | no overlap | No overlap. |
| Gems Jewellery And Watches | 10 | Consumer Durables | 5 of 5 agree | high |  |
| ⚑ Travel And Transport | 10 | Services | 1 of 2 agree | judgement | Split (Consumer Services 1, Services 1): logistics/transport = Services; pure travel agencies would be Consumer Services. |
| Metals | 10 | Metals & Mining | 4 of 5 agree | high |  |
| Telecommunication - Services | 9 | Telecommunication | 4 of 4 agree | high |  |
| Consumer Durables | 9 | Consumer Durables | 4 of 4 agree | high |  |
| Personal Care | 9 | Fast Moving Consumer Goods | 7 of 7 agree | high |  |
| Electronics - Industrial | 9 | Capital Goods | 5 of 6 agree | high |  |
| Pesticides And Agrochemicals | 8 | Chemicals | 2 of 2 agree | judgement |  |
| Tyres | 8 | Automobile and Auto Components | 5 of 5 agree | high |  |
| Ceramics And Sanitaryware | 8 | Consumer Durables | 2 of 2 agree | judgement |  |
| Automobiles - 4 Wheelers | 7 | Automobile and Auto Components | 3 of 5 agree | judgement | 2 of 5 overlaps are Capital Goods (commercial-vehicle makers). |
| Shipping | 7 | Services | 4 of 4 agree | high |  |
| Tea And Coffee | 7 | Fast Moving Consumer Goods | 1 of 1 agree | judgement |  |
| ⚑ Castings/Forgings | 7 | Automobile and Auto Components | 2 of 3 agree | judgement | Mixed (Auto 2, Capital Goods 1): most forgers supply the auto industry. |
| Brew/Distilleries | 7 | Fast Moving Consumer Goods | 3 of 3 agree | high |  |
| Mining | 6 | Metals & Mining | 4 of 5 agree | high |  |
| Chemicals - Organic | 6 | Chemicals | 1 of 2 agree | judgement |  |
| Gas | 6 | Oil Gas & Consumable Fuels | 3 of 5 agree | judgement | City-gas distributors are in Utilities in one case. |
| Refineries | 6 | Oil Gas & Consumable Fuels | 6 of 6 agree | high |  |
| Oil Exploration/Production | 6 | Oil Gas & Consumable Fuels | 2 of 2 agree | judgement |  |
| Computers - Hardware | 6 | Information Technology | — | no overlap | No overlap. |
| Leather And Leather Products | 5 | Consumer Durables | 2 of 2 agree | judgement | NSE files footwear under Consumer Durables. |
| Diesel Engines | 4 | Capital Goods | 3 of 3 agree | high |  |
| Telecommunication - Equipment | 4 | Telecommunication | 2 of 3 agree | judgement |  |
| Petrochemicals | 4 | Chemicals | — | no overlap | No overlap; NSE's hierarchy places petrochemicals under Chemicals. |
| Dyes And Pigments | 4 | Chemicals | 1 of 1 agree | judgement |  |
| Financial Institution | 4 | Financial Services | 3 of 3 agree | high |  |
| Aluminium | 4 | Metals & Mining | 2 of 2 agree | judgement |  |
| Finance - Housing | 4 | Financial Services | 2 of 2 agree | judgement |  |
| Cables - Power | 4 | Capital Goods | 1 of 1 agree | judgement |  |
| Compressors / Pumps | 4 | Capital Goods | 3 of 3 agree | high |  |
| Cigarettes | 4 | Fast Moving Consumer Goods | 2 of 2 agree | judgement |  |
| Bearings | 4 | Capital Goods | 1 of 1 agree | judgement |  |
| Paints | 4 | Consumer Durables | 3 of 3 agree | high |  |
| Abrasives | 3 | Capital Goods | 2 of 2 agree | judgement |  |
| ⚑ Lubricants | 3 | Oil Gas & Consumable Fuels | 1 of 1 agree | judgement | The one overlap says Capital Goods; NSE's hierarchy places lubricants under Oil, Gas & Consumable Fuels. |
| Solvent Extraction | 3 | Fast Moving Consumer Goods | 1 of 1 agree | judgement | Edible-oil makers. |
| Automobiles - 2 And 3 Wheelers | 3 | Automobile and Auto Components | 3 of 3 agree | high |  |
| Cables - Telecom | 3 | Telecommunication | — | no overlap | No overlap. |
| Transmission Towers | 2 | Construction | 1 of 1 agree | judgement |  |
| Electrodes | 2 | Capital Goods | 1 of 1 agree | judgement |  |
| Fastners | 2 | Automobile and Auto Components | 1 of 1 agree | judgement | Single overlap. |
| Leisure Facilities | 1 | Consumer Services | — | no overlap | No overlap. |
| Airconditioners | 1 | Consumer Durables | 1 of 1 agree | judgement |  |
| Refractories | 1 | Capital Goods | 1 of 1 agree | judgement |  |
| ⚑ Cycles | 1 | Automobile and Auto Components | — | no overlap | No overlap; could also be Consumer Durables. |
| Diversified | 1 | Diversified | 1 of 1 agree | judgement | The one overlap says FMCG; kept as Diversified. |

**The 22 sectors (NSE):** Automobile and Auto Components, Capital Goods, Chemicals, Construction, Construction Materials, Consumer Durables, Consumer Services, Diversified, Fast Moving Consumer Goods, Financial Services, Forest Materials, Healthcare, Information Technology, Media Entertainment & Publication, Metals & Mining, Oil Gas & Consumable Fuels, Power, Realty, Services, Telecommunication, Textiles, Utilities.
<!-- END docs/sector-map.md -->

# Part 6 — Quality: failure modes (FMEA)

<!-- BEGIN docs/FMEA.md -->
## FMEA — failure modes and effects (build phase)

Written 2026-11-03 06:58 IST (#263), before new work, from the failures of the first 24 hours plus the next steps.
Severity / Likelihood / Detection: H (high), M, L. Detection H = we would notice late. Work the rows with two or more H first.
Each mitigation is in code with a test unless marked *process*.

### A. Failures already seen (closed; keep the guard)
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

### B. Open risks for the next steps
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

### C. Found while building (2026-11-03 morning)
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
| C23 | Rights entitlements (ISIN type 20) stored and treated as equity → 145 false jumps, wrong universe | Kind `other`, outside the universe (D139); rule verified on 107 sessions |
| C24 | ETF price moves never reviewed (review checks covered the equity universe only) → 9 unit splits with no record | ETF move > ±35% → review with proposed factor (D139) |
| C25 | Claude's audit read prices by id range, so it included securities it meant to exclude (caused a wrong "ETFs stored as equity" claim) | Rows outside the selected set are skipped |
| C26 | Claude assumed the bhavcopy previous close is NSE-adjusted on ex-dates; checked on SHRIRAMFIN/TMPV: it is the plain previous close | Not used as evidence; decisions use official text + price agreement, NSE discovered open for demergers |
| C27 | NSE date-range feeds can be silently capped (Integrated Filing: always 20 rows) | Each feed checked for a cap before use (one day vs one month; corporate actions compared with per-company lists: 485 = 485); capped feed replaced by a triggered per-company refresh + weekly sweep that counts misses |
| C28 | Stale Bc ex-dates: the same bonus/split listed days before its true ex-date (INOXWIND, VSTIND, POWERMECH, RPPL, AJMERA, USASEEDS) left review factors; confirming them would double-adjust (V1 hint #276) | Decided by the per-company list's date (true-date factors already auto); daily job removes a same-ratio review factor of the previous 15 days when the true-date factor is applied. tested (BAJFINANCE fixture: stale same-ratio review factor removed, item superseded) |
| C29 | Year-to-date context (FourD) carrying the quarter's dates in 20,437 results files (V1 hint) — the reader picks OneD only because it is first in the file | Measured: OneD chosen in 20,437 of 20,437 (values correct); now explicit (OneD preferred), tested with FourD first in the file |
| C30 | Bulk/block/short history API caps at 70 rows per call even for one day (2 Nov 2026: bulk.csv 87 vs API 70) | One call per day; days at exactly 70 flagged as possibly truncated; complete bulk.csv/block.csv kept daily from today |
| C31 | prefetch-archive re-ran the whole 2024→today download whenever its script changed (push trigger) and its docstring claimed a skip it didn't do | Push trigger removed; daily schedule fetches today only; docstring corrected |
| C32 | An NSE error page (HTML, HTTP 200) or a cut-off XML could be recorded as "done" and never retried (V1 lessons #280) | API answers must be JSON; ingested XML must close its root; otherwise failed → retried; audit of identical large answers in `/status` |
| C33 | Upserts rewrote unchanged rows (billed writes) | Rewrite only when a value differs (`WHERE … IS NOT excluded…`); identical files were already skipped by hash, so the saving is for revised files |
| C34 | Scale guard anchored on the single nearest earlier value; files load in download order, so one odd quarter held several later ones (×312 vs 264,000) | Median of the 4 nearest periods on either side (V1 hint), tested; held items retried |
| C35 | A9 again: a migration used a 63-byte LIKE pattern; staging passed (no matching rows, the check runs only on comparison), production failed, two deploys did not go live — and Claude reported the batch as pushed without checking the deploy | Root fix (second occurrence, D134): a test scans every migration and SQL string for LIKE/GLOB patterns > 50 bytes; long matches use instr(); deploy conclusion checked after every push before reporting work as live (C9) |
| C36 | BSE Ltd's shareholding: filed total wrong (9.34M vs 135.38M real) or missing, and from 2025 filed in the Integrated Filing taxonomy (in-capmkt) → 17 filings held | Reader takes the taxonomy prefix from the file; the category sum replaces the filed total only when NSE's issued share count on that date agrees within 0.5% (tested both ways on the real files) |
| C37 | Decision migrations inserting rows by a fixed production security id: on staging (different ids) they would attach a factor to another company; caught by the migration test (foreign key) | Every insert is guarded by the expected symbol on that id (`WHERE EXISTS … value='SYMBOL'`) |
| C38 | Balance sheet: assets/liabilities held for sale and regulatory deferral balances sit outside current/non-current (census: 3,862 + 996 files failed) | Counted as optional components; real-file test |
| C39 | `git stash` before a partial commit also stashed the fix, so the commit carried only a fixture (caught by checking the commit's file list) | Partial commits add named files only (`git add <files>`); check `git show --stat` after each commit |
| C40 | Several NSE per-company lists return only the latest 20 rows without a date range (PIT: INFY 20 vs 835 dated for 2024→; SAST, board meetings, corporate actions, governance; BRSR only 1) — the prefetch (D128) and the D138 comparison used them; Claude didn't test for this cap when downloading | Full history queued once (D149): all-company monthly feeds where supported (checked uncapped), dated per-company calls otherwise; any new list endpoint is tested with and without a date range before use |
| C41 | Revised filings (898 periods with 2–6 filings) were all stored as version 'original' (D48 says later = restated) | Earliest disclosure = original, later = restated, labels corrected in either load order; > 0.5% core-line change → `restatement_flag`; one-off pass over existing groups; known-case tests |
| C42 | Sector job (D150) joined announcements to securities by ISIN only; NSE announcement rows can carry a stale ISIN (before a split / ISIN change) → 256 ISINs matched nothing (live check, 3 Nov), those companies silently unclassified | Fallback to the NSE symbol valid on the last sighting; `/sectors` reports ISINs still unmatched by both (sample listed); test with an older ISIN |
| C43 | Filings loader re-selected every 'skipped' job (symbol not in market identity) on every run; with 299 skipped and a batch of 300, new files and the BS/CF backfill (runs only when the batch is not full) stopped — loaded count flat at 40,004, BS/CF backfill never started, while HANDOVER said 'running' | Skipped jobs retried at most every 6 h, new jobs first; test; live check that loaded and bs_cf_values grow after deploy. Lesson: 'running' is reported only from a moving counter, not from a deploy |
| C44 | General insurers' Integrated Filings (IRDAI IFGI layout: ICICIGI, NIACL, GICRE, STARHEALTH, GODIGIT, NIVABUPA — 61 files) were read with the industrial template → revenue and PAT missing → held (23 so far; the rest not yet reached by the loader). Census also found a second insurer layout (Ind AS 117, STARHEALTH Sep 2026, 5 files) | General-insurer template (30 lines, 9 identity checks from the filing's own sums; provisions inside or outside operating profit both accepted — NIACL files them outside, ICICIGI Mar 2026 files 39,247 m outside); 56 of 56 IFGI files pass; Ind AS 117 layout held and counted (separate class). Balance sheet for insurers not read yet (checks fail → not loaded) |
| C45 | Scale-guard holds were judged once, in download order and 8 in parallel, before the neighbouring periods were on record, and never re-checked: lasting real changes stayed held (ABCAPITAL: 5 post-merger standalone quarters held against pre-merger values; also holding companies BAJAJFINSV, BAJAJHLDNG, CHOLAHLDNG) | Holds re-checked every 6 h with the full neighbourhood (median of 4 nearest, loaded or held); a released period drops its hold row; an isolated outlier (COROMANDEL Mar 2026 ÷100, three revisions) stays held; lasting ×10 jumps still flagged by the series audit. Tested hypothesis rejected: Integrated Filing XBRL has no prior-year comparative context, so it cannot serve as the second source |
| C46 | Site v0 first deploy: stock page read the whole shareholding table per uncached view (no index by company) and made ~15 sequential D1 round trips → ≈ 5 s per page and a D1 rows-read cost per visitor | Index `shareholding(security_id, as_of)`; reads batched per database (one round trip each); symbol map cached in memory + edge cache; financial lines by keyed lookups; dashboard precomputed every 10 min; Server-Timing header on every uncached answer so regressions are visible. Rule: every new read path gets an EXPLAIN QUERY PLAN check before deploy |
| C47 | Event loader ran last in each filings run; once the results backlog filled every run again (after C43), it never ran: cursor stuck at job 250168, INFY 20 of NSE's 2,199 distinct insider trades | Events run first with a fixed 150 lists per run; verified moving (250168 → 250385, rows +148k). Rule: each step in a shared run gets its own budget, and a status counter is checked to move after every reorder |
| C48 | (a) Backfill (BS/CF + FY) saved its position only after a whole batch: a run cut off by its time limit redid the same files every run (stuck at job 32,136). (b) A burst of Cloudflare storage read errors ("Error: get: … cloudflarestatus", 14 consecutive shareholding files) was recorded as a permanent failure, never retried | Backfill: time budget, position saved every 10 files, a read error pauses at that file (retried next run) and is skipped + listed after 3 runs (test). Loader: storage read errors retried on the 6-hour cycle like skipped jobs |
| C49 | A trading day loaded without its delivery or index-close file stayed "unchanged" forever: the idempotency check compared only the price file and PR bundle, so a delivery file that arrived later was never read (found by Phase 1 test 5: staging 0 delivery rows on 21 and 27 Oct vs production ≈ 3,190) | "Unchanged" now requires all four files to match the ledger (incl. still-missing); a weekly gap pass re-runs loaded days with no delivery/index-close file from stored files (4 per run, only when caught up); `/gaps` shows the queue; test with a real delivery sample |
| C50 | The D44 backup test exported the databases while the loader ran; D1 refused queries during the export ("D1_ERROR: Currently processing a long-running export") and 209 filings were recorded as permanent failures (the retry list knew only storage and network errors). Also the line-item census got HTTP 500 | Every infrastructure error (detail "Error: …") is retried on the 6-hour cycle; the 209 re-queued by migration; backups only on a quiet, frozen system (owner #324: schedule off until then) |
| C51 | 3 Nov evening slot (20:30 IST): the corporate-action, shareholding and announcement API calls answered "fetch failed", yet the slot was recorded as done and never retried (the overlapping morning ranges limited the loss). Found by the daily check | A slot counts as done only when its fetches succeed; otherwise it is retried every 10 minutes up to 6 times, the tries visible on `/status` as `<slot>:retry` (test). Also: `/status` listed daily slots below the one-off jobs ("once" sorts above every date), now separate |
| C52 | Index history read weekdays only — and so did its download — so weekend special sessions (Diwali muhurat, Budget-day Saturdays) are missing from 2016–2023; found by the D156 `/index-check` | Download set `indices` includes weekends; the loader picks up any stored weekend file it has not recorded (no file on a weekend is not recorded) |
| C53 | **Insider trades stop at 2 May 2026 for every company.** NSE's PIT list (`corporates-pit`) — both the default 20-row list (fetched 2 Nov) and the dated 2021→today list — carries nothing newer (INFY ends 6 Apr 2026). Our rows equal NSE's answer, so the count check (#314) passed: it compared totals with the same list and never asked "is the newest row recent?". SAST and board meetings are current (3 Nov) | **Found (owner #330): NSE moved insider filings to `/api/corporates-pit-gg` on 3 May 2026** (list + one PIT XBRL per filing). Loaded: the list (3,299 filings, 3 May → 3 Nov) via Cloudflare, the XBRL via the GitHub attachment job, read by `parsePitXbrl` (identification numbers never read); daily list in the prefetch slots. Open: freshness rule for every feed (owner #333) |
| C54 | NSE refuses GitHub's runners for the API host (`www.nseindia.com/api/…`: 7 of 7 list calls refused, 4 Nov) while the archive host (`nsearchives`) works from GitHub | Split by host: API lists from Cloudflare (prefetch), archive files (XBRL, PDFs) from GitHub; the GitHub insider-list job is manual-only. No proxies. Request headers: superseded by **D160** (owner #340: browser-session pattern, one cookie re-warm on 401/403) |
| C55 | Restatements (owner #334): NSE's results XBRL carries **only the filing's own periods** — no prior-year P&L, cash flow or balance sheet (all 74,571 files; `PY_I` holds only the opening cash, added on BSE's request — Union Bank revision remark 29 Sep 2026). Regrouped prior-year figures printed in the next year's PDF (Union Bank FY25 CFO +17,479 cr filed → −20,387 cr in the FY26 PDF) exist in no XBRL. Revised XBRL does exist (BSE FAQ Nov 2025 Q11) and is downloaded | Revision check on every line of every statement and every period kind (H/9M/FY too; was 4 P&L lines, quarter only, run before BS/CF rows existed); NSE's submission type + revision remark stored; prior-year regrouping from PDFs = later step; site labels figures "as originally filed" |
| C56 | **Claude's diagnostics wasted D1 reads** (owner #336): 24.2 of the 25 billion rows read included this period (2–4 Nov), ≈ 20 billion from read-only checks — `/index-check` (a NOT EXISTS lookup per day without an index, polled every 30 s: 16.2 B in 139 calls), census scans using the status index instead of the job_id range (3.2 B), lookups by r2_key without an index (0.56 B). Charges stayed $0.03 (storage) | Queries fixed (`+status`/`+kind` force the key range — EXPLAIN checked; indexes on fetch_job r2_key and symbol+kind; index check reads ms_day only). Rules: no polling loops against read-only pages; every new query EXPLAIN-checked; a full census only when a reader changes (D134), never as a progress check; the daily cost guard also reports rows read vs the 25 B included. Recurring reads cut too: attachment files no longer look undiscovered to the every-minute discovery query (~325M rows/day), filings run every 5 minutes instead of every minute (its loader query reads ~300k rows per run) |
| C57 | **Cost audit (owner #338, 4 Nov 10:15 IST): recurring D1 reads came from re-scanning, not re-downloading.** (1) The revision-remark pass updated `filing` by `source_url`, which had no index of its own: every UPDATE read all ~70k filings (≈ 30–140M rows a run). (2) `versionPeriod` claimed "PK prefix, no scans": the key serves only `security_id`, so each of its 6 statements read the company's whole `fin_value` (≈ 250–300k rows per loaded file). (3) The loader's file selection read every `done` row of `fetch_job` (~300k) every run, idle or not. (4) `+kind` cursors read the table tail every run. (5) ~17 diagnostic pages were public (addresses in this repo) and scan millions of rows per call. (6) Daily shareholding XBRL were born `discovered=0` (C56 regression). (7) Found on the way: the daily insider list (`pit_gg`) was kept with `discovered=1`, so its XBRL were never queued after the one-off probe list | P0 (D163): remark and version passes off in the cron; indexes (filings 0034); `versionPeriod` one indexed read; loader (kind, job_id) cursor + capped backoff retries; incremental primary basis; daily XBRL `discovered=1`; insider XBRL queued from the daily list; diagnostic pages behind `STATUS_TOKEN`; read breaker (`read_budget`); **EXPLAIN guard in CI** (`db/test/query_plans.test.ts`: any table SCAN or the bare status index fails `npm run check`). Not caught by EXPLAIN: a primary-key range from a cursor that never advances — use (kind, job_id) ranges |
| C58 | **Found in P1 (owner #341):** (1) SAST, board-meeting and credit-rating lists were fetched only by the one-off history of 3 Nov — no daily refresh, so those feeds stopped on 3 Nov (the C53 pattern again: a passing count check never asked "is the newest row recent?"). (2) The event and insider loaders turned an unreadable file into 0 rows and moved on, unrecorded. (3) Events and insider XBRL ran unguarded before the loader: one storage error stopped the whole filings run. (4) A filings run had no time limit while its lock lasted exactly the cron interval: two runs could overlap. (5) The daily "revised file" re-run read our own R2 copies (R2-first) and could never see a revision. (6) The sector job listed R2 and read all of `sector_file` every 10 minutes | Daily dated feeds for the three kinds (focus companies); `event_load` failure records + 3-run wait on storage errors; every step guarded; 210 s budget + 10 min lock; revisit removed (late files: C49 gap pass); sector job from the download ledger. Tests for each |
| C59 | Renamed companies lost their pre-rename filings (work list item 2): the loader identified a file by the symbol written in it; files filed before a rename carry the old symbol (LTI, ADANITRANS, SRTRANSFIN, MOTHERSUMI …), which the market identity (built from 2024) never saw → "skipped: not in market identity" for 79 listed quarters of 9 focus companies | The file's own symbol first, else the company whose NSE list linked the file (lists are per company); test with a renamed file; the skipped files reload through the retry queue |
| C60 | Half-year-only files left the full year empty at the year end (the FY reader ran for quarter files only) and the quarter empty even when the file had its own 3-month column (13 active gaps "loaded, but under another period or basis") | D169: quarter from the file's own 3-month column only (never derived, owner #345; the derivation shipped in deploy 130 was removed and its rows deleted by filings 0038); FY from year-end half-year files; one-off `/maint/half_year_gaps`, then the coverage check of those companies. Not fixable from XBRL: **CGPOWER Mar 2025** — NSE's list links a file whose content is H1 FY25 (Apr–Sep 2024, filed again 8 May 2025); no Q4 FY25 file exists. Half-year files without a quarter column stay as gaps |
| C61 | A results file filed with another company's symbol was stored under that company: COFORGE Q3 FY26 (both bases) carries Symbol NUCLEUS with COFORGE's own ISIN INE591G01025 and BSE code 532541, so the quarter sat under Nucleus Software and COFORGE showed a gap | Loader picks the company by (1) the file's ISIN, (2) the company whose NSE list linked the file, (3) the file's symbol last (was: file symbol first). One-off `/maint/misattributed` (read-only, `?fix=1` moves the filing and its rows to the linking company unless that company already has the period) for the focus lists, then the coverage check of the companies moved to. **Run 4 Nov 15:39 IST:** report found 2 filings in the 250 (COFORGE Q3 FY26, both bases; 72k rows read); fix moved both (169 rows written, **4.0M rows read** — the `fin_value` move by filing id had no index; now bounded by the old company, query-plan guard added) |
| C62 | Half-year-dated columns holding a quarter: filers tagged a quarter's results with half-year dates (COFORGE Mar 2025: "Half Yearly", 1 Oct 2024–31 Mar 2025, revenue ₹3,410 cr = Q4 FY25), so the quarter was stored as H and its gap stayed | Relabel, never recompute (owner #352): the column becomes the quarter (`period_kind` Q, extractor `results-q-mistag-v1`, values unchanged) only when the filer's own numbers prove it — earlier filed quarters of the year (original, reported) + this column = the file's year-to-date column, for the core line and PAT, within ₹1 lakh. The sum is a check only. Live loader and `/maint/half_year_gaps` |
| C63 | Focus retries starved: the retry query takes the earliest-due `fin_load` rows; rows outside the focus were skipped without being rescheduled, so they filled every run's slots and focus retries behind them never ran (BAJAJ-AUTO Mar 2026, due 05:31 UTC 4 Nov, still tries 1 at 17:00 IST) | Out-of-focus due rows leave the queue (`retry_after` NULL; universe lock — never loaded; nothing deleted). PR #19 |
| C64 | Mistyped reporting-start date: HDFCLIFE and ICICILIFE Q3 FY26 files say `DateOfStartOfReportingPeriod` 2025-01-10 (for 2025-10-01), so no context matched and the quarter stayed in review | Reader uses the current-period context's own dates (OneD, no dimensions) only when it ends on the reporting end date; a file whose content is another period still fails. `/maint/reload?jobs=…` puts named focus files left in review back on the retry queue. **Loaded 4 Nov 17:20 IST:** HDFCLIFE and ICICILIFE Q3 FY26 (3 gaps). **SIEMENS Q2 FY25** (Mar 2025): start typed 2024-01-01 and the year-to-date context dated the same, so a 15-month context was picked — a period of no 3/6/9/12 months now falls back to OneD when it ends on the date (PR #21). **Still open after PR #21 (4 Nov 20:33 IST):** in SIEMENS Q2 FY25 the OneD context itself is dated 2024-01-01..2025-03-31 (FourD 2024-10-01..2025-03-31 = H1 of its Oct–Sep year), so no context carries the quarter's dates; only the file's "Quarterly / Second quarter" labels and the C62-style proof (filed Q1 + this column = the file's YTD) could place it — owner decision. **Not fixable from XBRL:** SIEMENS Dec 2025 (both bases) — file says Oct–Dec 2025 but holds Apr–Jun 2025 (already stored), like CGPOWER Mar 2025 |
| C65 | (a) Scale-guard holds of real step changes: holding companies' standalone revenue jumps ×12–37 in dividend quarters (BAJAJHLDNG Sep 2025: dividends ≈ ₹2,200 cr of ₹2,501 cr), held as if a unit error; (b) a quarterly file whose own contexts carry mis-typed dates (SIEMENS Q2 FY25: OneD 2024-01-01..2025-03-31) | Owner #353: (a) a hold stands only when the file's own profit ÷ shares (paid-up capital ÷ face value) misses its filed basic EPS by more than 2% — EPS is filed per share, so an amount in the wrong unit misses by ×100+ (BAJAJHLDNG: ₹195.95 vs ₹195.9 filed); (b) a file saying "Quarterly" that ends on a quarter end is read as that quarter (OneD's figures, values unchanged) only when the C62 proof passes (earlier filed quarters + this column = the file's year to date, core line and PAT, ₹1 lakh), else review. Checks only; nothing computed is stored |
<!-- END docs/FMEA.md -->

# Part 7 — Operations: setup and probe

<!-- BEGIN docs/setup-guide.md -->
## Owner Setup Guide (step by step)

Written for the owner. Do the parts in order. Each part says **how you know it worked**.
If anything looks different from what's described (screens change over time), stop and send Claude a screenshot or the exact text you see.

Working domain: `disclo.in` (bought at GoDaddy).

**Progress:** Part A ✅ · Part B ✅ (2026-11-02: nameservers `raegan.ns.cloudflare.com`, `thaddeus.ns.cloudflare.com`; registry confirmed; DNSSEC not set) · **Cloudflare Active (Free plan) confirmed 2026-11-02** · DNS cleaned (0 records; `www` also removed, fine until a site exists) · Part C ✅ (routing rules created 2026-11-02) · Part D ✅ · **Part E ✅ (first successful probe 2026-11-02)**. (Cloudflare's "Set up Zero Trust" is for later, when owner-only pages exist.) If the launch name changes later, repeat Part A–B for the new domain.

---

### Part A — Add the domain to Cloudflare (10 minutes)

1. Sign in at **dash.cloudflare.com**.
2. On the account home page, click **"Add a domain"** (may be labelled "Onboard a domain" or "+ Add").
3. Type `disclo.in` and continue. Leave the default option to scan for existing DNS records.
4. Choose the **Free** plan and continue.
5. Cloudflare shows the DNS records it found from GoDaddy. For `disclo.in` these were (seen 2026-11-02): two **A** records for `disclo.in` → `15.197.148.33` and `3.33.130.190` (GoDaddy's parking page), **CNAME** `_domainconnect` → `_domainconnect.gd.domaincontrol.com` (GoDaddy-only), **CNAME** `www` → `disclo.in`, **TXT** `_dmarc` → GoDaddy's email reporting. **None of these are needed** (we have no site or email yet). You can delete them now (pencil icon → Delete) or later; either is safe. The red "not covered by a certificate" notes are normal before activation: Cloudflare issues the certificate after Part B.
   Then tap **"Continue to activation"** at the bottom; that's the page that shows the two nameservers.
6. Cloudflare now shows **two nameservers**, e.g. `xxx.ns.cloudflare.com` and `yyy.ns.cloudflare.com`. **Keep this page open**, because you'll copy both into GoDaddy in Part B.

**Worked when:** the domain appears in your Cloudflare account with status **"Pending"** (it becomes "Active" after Part B).

---

### Part B — Point GoDaddy to Cloudflare (10 minutes + waiting)

1. Sign in at **godaddy.com** → profile/menu → **My Products**.
2. Find `disclo.in` → click **DNS** (or **Manage DNS**).
3. **Check DNSSEC first:** on the domain's settings page look for **DNSSEC**. If it is **On**, turn it **Off** and save. (If left on, the site and email may stop resolving after the switch.)
4. Find **Nameservers** → **Change Nameservers**. *GoDaddy's 2026 layout:* on the domain's **DNS** tab there's a second row of tabs (DNS Records · Forwarding · **Nameservers** · Hostnames · **DNSSEC** · Advanced). On a phone only part of it is visible, so use the **‹ ›** arrows in that row to reach **Nameservers**. **Don't** edit the two `NS` rows in the record list (they're locked), and **don't** use "Connect Domain" / Airo.
5. Choose **"I'll use my own nameservers"** (wording may be "Enter my own nameservers (advanced)").
6. Delete GoDaddy's nameservers and paste **the two Cloudflare nameservers** from Part A step 6, exactly as shown.
7. Save. GoDaddy may warn that its DNS settings will no longer apply. That's expected; confirm.
8. Back in Cloudflare (the page from Part A), click **"Check nameservers"** / **"Done, check nameservers"**.

**Waiting:** usually 15 minutes to a few hours; for `.in` it can take up to 24–48 hours. Cloudflare emails you when it's done.

**Worked when:** Cloudflare shows `disclo.in` as **Active**.

---

### After activation: clean up DNS **in Cloudflare (not GoDaddy)**
Once nameservers point to Cloudflare, **GoDaddy's DNS page no longer does anything**. It still lists the old records (Parked A, NS ns29/ns30, SOA, www, _domainconnect, _dmarc), but nobody reads them. **Don't change anything there.** Do the cleanup in **Cloudflare → disclo.in → DNS → Records**: delete the two A records (15.197.148.33, 3.33.130.190), CNAME `_domainconnect`, TXT `_dmarc`; keep `www`.

### After activation: one-click toggles on the overview page
Cloudflare's overview shows optional switches (Client-side security, Bot Fight Mode, Leaked credentials mitigation, Speed optimizations). **Leave them all off for now.** There's no site yet, and turning features on before there is one makes later problems harder to trace. They're decided when the site goes live:
- **Bot Fight Mode:** decide at launch together with rate limiting (D108/D117); on the Free plan it can't be fine-tuned and can block legitimate API callers.
- **Leaked credentials mitigation:** not needed; login is Google sign-in only, with no passwords (D63).
- **Client-side security** and **Speed optimizations:** review at launch.

### Part C — Free email forwarding: `info@disclo.in` → your inbox (10 minutes, after Part B is Active)

1. Cloudflare dashboard → click `disclo.in` → left menu **Email** → **Email Routing** → **Get started** / **Enable**. *Newer layout (seen 2026-11-02):* the account-level **Email Routing** page shows **"Onboard Domain"** → tap it → choose `disclo.in` → continue; it then asks for the first custom address.
2. Create a custom address: `info` → destination: **your personal email** (e.g. your Gmail).
3. Cloudflare sends a **verification email** to that inbox → open it → click **Verify**.
4. Cloudflare asks to add the needed DNS records (MX, TXT) → click **Add records automatically**.
5. Repeat step 2 for `alerts` (pipeline alerts will go here later) and optionally `support`.
6. **Test:** from a different email account, send a message to `info@disclo.in`. It should arrive in your inbox within a minute.

**Worked when:** the test email arrives. *Note:* this is **receive-only**; replying *as* `info@disclo.in` needs a mail provider later (D116).

---

### Part D — Set up Workers (2 minutes)

1. Cloudflare dashboard → left menu **Workers & Pages**.
2. If asked, choose your **workers.dev subdomain** (any short name, e.g. your name). This gives addresses like `something.yourname.workers.dev`.
3. Stay on the **Free** plan for now (Workers Paid comes before backfill/go-live).

**Worked when:** the Workers & Pages page opens without asking for anything else.

---

### Part E — Run the NSE probe from the cloud (10 minutes, no computer setup)

The probe is a tiny test that checks whether NSE answers requests from Cloudflare's network. **This decides whether our pipeline can run fully on Cloudflare.** It runs from **GitHub**: GitHub deploys it to your Cloudflare account, calls it, prints the result, and deletes it again. **Claude reads the results directly from GitHub**, so you don't need to copy anything.

You only give GitHub permission once, by adding two secrets.

#### E1. Create a Cloudflare API token
1. Cloudflare dashboard → top-right **profile icon** → **My Profile** → **API Tokens** → **Create Token**.
2. Find the template **"Edit Cloudflare Workers"** → **Use template**.
3. **Account Resources:** Include → *your account*. **Zone Resources:** Include → *All zones* (the template asks for it).
4. **Continue to summary** → **Create Token**.
5. **Copy the token now**; Cloudflare shows it only once. Don't paste it into chat or anywhere else except step E3.

#### E2. Copy your Cloudflare Account ID
Cloudflare dashboard → **Workers & Pages** → on the right side under account details, **Account ID** → copy.

#### E3. Add both as GitHub secrets
1. Open **github.com/hipareshpatel/Insider-V2** → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
2. Name: `CLOUDFLARE_API_TOKEN` → paste the token from E1 → **Add secret**.
3. **New repository secret** again → Name: `CLOUDFLARE_ACCOUNT_ID` → paste the ID from E2 → **Add secret**.

Secrets are encrypted; they never appear in logs or in the public repo.

#### E4. Start the first run
1. Repo → **Actions** tab → workflow **probe** → **Run workflow** → keep the branch shown → **Run workflow**.
2. Tell Claude "probe started". Claude reads the result.

After that it also runs automatically **3 times a day** (10:00, 15:00 and 22:30 IST), and each run cleans up after itself. Claude switches the schedule off once there are enough results (about 2 days).

**Worked when:** the run shows a green tick and Claude confirms it has the results.

*(Alternative if ever needed: run the probe from your own computer with Node.js + `npx wrangler deploy`, see `docs/probe-usage.md`.)*

---

### Troubleshooting
| Problem | What to do |
|---|---|
| Cloudflare still "Pending" after 48 h | Re-check the two nameservers in GoDaddy (exact spelling, no extra nameservers); check DNSSEC is off. |
| Test email bounces with "550 5.1.1 Address does not exist" | Mail is reaching Cloudflare correctly; there's just no routing rule for that exact address yet. Create one (Routing rules → Create routing rule). Every address needs its own rule unless Catch-all is on (keep it off). |
| Routing rule says "Allowed characters: a-z 0-9 _ - . +" | The address has a capital letter (phones auto-capitalise). Type it in lowercase, e.g. `info`. |
| Verification email not received | Check spam; resend from Cloudflare Email Routing → Destination addresses. |
| Probe run fails with an authentication error | Recreate the API token with the "Edit Cloudflare Workers" template and update the `CLOUDFLARE_API_TOKEN` secret. |
| Probe run says "Secrets … not set yet" | Check the two secret names are exactly `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. |
| Probe deploy says no workers.dev subdomain | Do Part D first. |
| Anything else | Send Claude a screenshot or the exact error text. |
<!-- END docs/setup-guide.md -->

<!-- BEGIN docs/probe-usage.md -->
## NSE reachability probe

**Normal way to run it:** from GitHub Actions (`.github/workflows/probe.yml`), see `docs/setup-guide.md` Part E. The steps below are the manual alternative from a computer.

One-off Worker that checks which NSE endpoints answer requests coming from
Cloudflare's network. It decides whether the Phase 1/2 pipeline can poll NSE
directly from Workers (see docs/PLAN.md §3 and §16).

```
cd probe
npm install
npx wrangler login
npx wrangler deploy
curl https://insider-probe.<your-subdomain>.workers.dev        # JSON report
```

Run it 3–4 times at different times of day (incl. once after 22:00 IST) and
paste the output back. Then remove it: `npx wrangler delete`.

Works on the Workers Free plan: ~12 subrequests (limit 50), bodies are not
fully read, so CPU stays within the 10 ms budget.
<!-- END docs/probe-usage.md -->

# Part 8 — Discussion log (owner's words; append new rows at the very end)

<!-- BEGIN docs/discussion-log.md -->
## Discussion Log — owner statements → where they are recorded

**Purpose:** nothing the owner says is lost. Every owner statement is logged here, close to the owner's own words, and mapped to where it's recorded in `docs/PLAN.md` (decision ID or section) or marked **OPEN**.
**Rule (from 2026-11-02):** this file is updated **in the same turn** as every discussion message, before replying. `docs/PLAN.md` Appendix A holds decisions; this file holds *everything said*, including context, preferences and examples.
**Clean-slate rule:** references to any earlier version's code, data, outputs or site are not recorded (owner instruction). Failure modes the owner described from experience are recorded as requirements.

Status: ✅ recorded · 🔶 recorded, partly open · ❓ OPEN (needs owner answer)

| # | Owner said (paraphrased closely) | Recorded in | Status |
|---|---|---|---|
| 1 | Start V2 fresh, no past baggage. | Clean-slate rule (§1) | ✅ |
| 2 | First make a detailed plan: mechanism, moving parts, output quality. | Whole plan | ✅ |
| 3 | Start simple and move forward; mechanisms are for a sample now but must work for mass. | §1 scope, §2 principles | ✅ |
| 4 | First pull NSE bhavcopy and the Nifty 50 constituent list. | §4.1 | ✅ |
| 5 | Have stocks with sector, industry, sub-sector etc. (NSE has this for all listed stocks beyond the index CSV). | D8, §4.2 | ✅ |
| 6 | Have price and market cap ("take round numbers"). | D5 (exact storage, ₹ crore no decimals) | ✅ |
| 7 | Take the last 3 years of corporate actions so everything can be adjusted. | D6; CA loaded from 2022 (§6 backfill); price history from 2024-01 (D2) | ✅ |
| 8 | Discuss issues first; work only when everything is closed. | Working agreement (top of PLAN) | ✅ |
| 9 | Personal project; no daily need for sector data; use archive site; make the universe/classification update quarterly and automated. | D8 | ✅ |
| 10 | All equity; use latest UDiFF only for history. | D3, D4 | ✅ |
| 11 | Market cap: the zip has a market-cap file, check it. | D5 (MCAP in PR bundle), Appendix B | ✅ |
| 12 | Free-float vs full: follow what NSE does, else industry practice. | D5 (full mcap, as NSE publishes) | ✅ |
| 13 | Corporate actions: based on % change on the effective day. | D6 (share-count ratio primary; price ratio kept for demergers/capital reductions) | ✅ |
| 14 | Market cap does not need adjusting. | D5 | ✅ |
| 15 | Nifty 50 3-year history could be built from NSE announcements (not required now), but all future index changes must be recorded automatically. | D9; optional backfill in §1 "Later" | ✅ |
| 16 | NSE pipeline runs after 10 PM daily, except weekends. | D10 (changed to every day because weekend sessions exist; owner accepted) | ✅ |
| 17 | History starts Jan 2024; sector job on owner's machine; no dividend adjustment. | D2, D8, D7 | ✅ |
| 18 | No SME. | D4 | ✅ |
| 19 | GitHub Actions; SQLite in git. | Superseded: Cloudflare (D12, §3); no data in git (D11) | ✅ |
| 20 | Python or any language, but the website must be fast, modern and expandable; the project will be huge. | D12; performance targets in §16 "still to discuss" | 🔶 |
| 21 | Will use Cloudflare D1 and storage. | D11, §3 | ✅ |
| 22 | Site private now; may go public after validation. | D13 | ✅ |
| 23 | Repo public. | D14 | ✅ |
| 24 | No Cloudflare account yet → later: free account created. | §16 owner actions | ✅ |
| 25 | The project will have an external API for persistent memory; plan for it. | §5.5 memory, §7 | ✅ |
| 26 | Gemini API will be used for stock analysis of different types (technical, fundamental, stock research, and so on). | D80 (public factual overview; judgement owner-only) | ✅ |
| 27 | Gemini reads all NSE announcements, collects required info per stock, saves it in memory. | §5.5, §7 | ✅ |
| 28 | On a new announcement: read it, read the stock's memory, pick the needed context from a huge memory, process the announcement with past inputs. | §7.4 | ✅ |
| 29 | "I may not explain well; ask more questions." | Working agreement | ✅ |
| 30 | Can't save PDFs (size, full universe later). | D17 | ✅ |
| 31 | Filtering is mandatory, but strict mechanical rules drop important information. | D26, D27, D30 | ✅ |
| 32 | Known failures from experience: improper reading of scanned pages and PDF charts; analyst questions saved as management claims; wrong numbers for a quarter. | §7.3 guardrails | ✅ |
| 33 | Retrieval by announcement type or content: Gemini asks "give me capex and balance sheet", our code fetches it, so output has full context. | §7.4 | ✅ |
| 34 | Output: everything Claude proposed + more; cards per required announcement; filtered items go directly to memory. | §7.5, memory-only items (§7.2) | ✅ |
| 35 | "I need your help with card suggestions." | §7.5; sections decided after real output (D25) | 🔶 |
| 36 | Latency at least within 15 minutes. | D16 | ✅ |
| 37 | Nifty 50 proof of concept first; then other indices slowly; eventually full universe. | D4, D57 | ✅ |
| 38 | Backfill: limited items to start. | D55 | ✅ |
| 39 | $100/month max for everything incl. Cloudflare. | D18, §11 | ✅ |
| 40 | Autonomous site. | D13 | ✅ |
| 41 | Link materials, finished products, material price changes, suppliers, customers, if listed and information available. | §5.6 graph, D37, D72; commodity prices later (D19) | ✅ |
| 42 | Concalls yes; annual report only important sections. | §6 annual, D74 | ✅ |
| 43 | Gold set: first labelled by Claude, then by owner. | D20 | ✅ |
| 44 | It's going to be a very large project; link whatever possible from day 1. | §2 principle 1, §2a schema rules | ✅ |
| 45 | GitHub delay is acceptable for now. | Superseded by Cloudflare stack (§3) | ✅ |
| 46 | Explain stack options with examples. | Discussed; §3 | ✅ |
| 47 | Commodity prices later. | D19 | ✅ |
| 48 | Annual-report section list OK. | §6 annual | ✅ |
| 49 | Website only (no alerts). | D13 (on-site alerts for signed-in users per D60; owner email alerts D45) | ✅ |
| 50 | Option 1 (Cloudflare); write probe; asked whether it has more disadvantages and if there are better solutions. | §3 downsides & alternatives; `probe/` | ✅ |
| 51 | This will be a production site; evaluate everything. | §10, §12, §13 | ✅ |
| 52 | SEBI: "I don't think it applies to a public site." | §12 (consult before public) | ✅ |
| 53 | Licence: will buy once there's footfall, like other sites; otherwise no business case. | D22, D24, §16 funding | 🔶 |
| 54 | Open to public in future. | D13 | ✅ |
| 55 | Impact = positive/negative news score of the update; no buy/sell. | Superseded by D21 (no score) | ✅ |
| 56 | Free for the next ~5 years (heavy competition). | D22 | ✅ |
| 57 | $100/month max. | D18 | ✅ |
| 58 | Uptime: occasional downtime acceptable. | D79 | ✅ |
| 59 | "Lots of such websites exist; please check." | Benchmarks done (D67, Tijori notes in D75/§1) | ✅ |
| 60 | Next few days: discussion only; no code files except Claude's own test needs. | Working agreement | ✅ |
| 61 | Score defined as announcement vs company's own past: OK. | Superseded by D21 (no score) | ✅ |
| 62 | No sponsors or ads; clean website for investors, family offices and institutions if all goes well. | D22 | ✅ |
| 63 | Showed two example cards from another site: "not exactly what I want; mine will be more useful." | Card writing rules (§7.5) | ✅ |
| 64 | Paid tier: yes in future, but the product must be robust first, "and that's on you". | D23 | ✅ |
| 65 | Prices on public site: will use bhavcopy as a calculated risk. | D24 | ✅ |
| 66 | Audience: both retail and institutions. | D25 | ✅ |
| 67 | Cards for social media/sharing: yes. | D25 (shareable image) | ✅ |
| 68 | A card where investors of any type can take a decision after reading it; must have full context. | §7.5 goal | ✅ |
| 69 | Don't use or save anything from the earlier version; Claude must not be biased by it. | Clean-slate rule | ✅ |
| 70 | No score at all. | D21 | ✅ |
| 71 | Gemini paid only. | D15 | ✅ |
| 72 | Card sections: decide later based on content and quality. | D25 | ✅ |
| 73 | Will share failure cases separately. | §16 waiting on owner | 🔶 |
| 74 | Will use Gemini Flex (half price) + prompt cache. | D15 | ✅ |
| 75 | Model change is a risk, but future models may improve things. | D15 (welcomes improvements via gold set) | ✅ |
| 76 | Recreate the branch or clearly state not to reference the earlier version, so memory stays clean. | Branch squashed; clean-slate rule | ✅ |
| 77 | Mixed Gemini tier split OK. | D15 | ✅ |
| 78 | Insider and pledge disclosures in scope. | D28 | ✅ |
| 79 | Escalation keywords: will see practically. | D26 (tuned in practice) | ✅ |
| 80 | Triage miss tolerance: zero. | D27 | ✅ |
| 81 | Insider panel + thresholds agreed; 300-item weekly audit OK. | D29, D30 | ✅ |
| 82 | "Hope you are taking notes of everything." | This log + PLAN | ✅ |
| 83 | KPI dictionary: yes. | D31 | ✅ |
| 84 | "Silently dropped" N=2 is OK only conditionally: sometimes management gives only results first, and commentary comes later. | D33 (bare results don't count) | ✅ |
| 85 | Correction screen: yes. | D35 | ✅ |
| 86 | Consensus estimates: not in scope. | D36 | ✅ |
| 87 | Non-NSE sources: later. | D36 | ✅ |
| 88 | Demerger human review: OK. | D34 | ✅ |
| 89 | Annual-only guidance handling (a): OK. Graph: explicit only, one hop, group companies yes. | D33, D37, D38, D40 | ✅ |
| 90 | Security/ops proposals all OK; report-error link yes; status indicator yes. | D41–D46 | ✅ |
| 91 | Remembered issue: restated results, where no XBRL is filed and numbers come out wrong. | D48 | ✅ |
| 92 | How will financial statements be stored? Everyone in the industry has their own standard, e.g. Screener. | D47 | ✅ |
| 93 | Screener has a guide, but it doesn't cover everything. | D47, D52 | ✅ |
| 94 | Remembered issue: consolidated vs standalone storage and inputs to the AI. | D50, D51 | ✅ |
| 95 | EBITDA definition, restated default, primary basis: all three OK. | D48, D49, D50 | ✅ |
| 96 | Shared Screener "optimizations" guide as a one-off example. | D52 | ✅ |
| 97 | Ask the owner wherever inputs are needed on things already discussed; settle everything before moving on. | Working agreement; §16 | ✅ |
| 98 | Website must identify stocks likely to give good results in upcoming quarters, based on quarterly trend, management's revised guidance, etc. | D53 | ✅ |
| 99 | That prediction is for the owner to search, not public. | D53 | ✅ |
| 100 | "Good" = better than trend; and both (trend and guidance met). | D53 | ✅ |
| 101 | Ratio conventions yes; prediction only after backtest; NSE-block fallback decide if it happens; backfill confirmed; shareholding quarterly; next index yes; give the legal list; workers.dev for now. | D52–D58, §12 | ✅ |
| 102 | Home: market and indices trend etc., a best-in-class KPI dashboard + what Claude mentioned. | D59, D62 | ✅ |
| 103 | Accounts proposal right. | D60 | ✅ |
| 104 | Query builder required and must be easy. | D61, D64 | ✅ |
| 105 | No magic links; Google works. | D63 | ✅ |
| 106 | "Yes, draft it" (field catalogue). | `docs/field-catalogue.md` | ✅ |
| 107 | Understands Gemini calls are needed for plain-English queries. | D64 | ✅ |
| 108 | Dashboard contents OK; will add more later if required. | D62 | ✅ |
| 109 | All three query-builder modes. | D64 | ✅ |
| 110 | Trend definition OK; 2% OK; add delivery file. | D65, D66 | ✅ |
| 111 | "Identifying small details is a real win for me." | (feedback) | ✅ |
| 112 | Benchmark stockscans.in. | D67 | ✅ |
| 113 | "What catalogue?" | Field catalogue link given | ✅ |
| 114 | Adopt benchmark items 1–5; research chat owner-only. | D67, D68 | ✅ |
| 115 | What other differentiating features (first in India or futuristic)? | D69 | ✅ |
| 116 | Adopt all as recommended; phasing OK. | D69 | ✅ |
| 117 | Idea: a sector/industry page with its companies, results trend, what management guided, etc. One page that speaks for the whole sector. | D70 | ✅ |
| 118 | Business segments and mix. | D70 | ✅ |
| 119 | Export market / country-wise exposure (e.g. US tax on pharma); query pharma companies with highest exposure or similar; "Claude must help here". | D70, D71 | ✅ |
| 120 | Companies in the castings segment with castings sales > X% and margin above Y%, and so on. | D70 (NIC + segment margins) | ✅ |
| 121 | "What other such ideas should we add?" | D70–D75 | ✅ |
| 122 | Employee count tracking, seen on other sites, for predicting expansion or "credit increases", or forensics (e.g. 1,200 employees per FY26 annual report but salaries only ₹1.2 cr = red flag). | D71 (forensic), D53 (expansion indicator), D81 ("credit increases" = rated facility amounts) | ✅ |
| 123 | Margin recovery or margin going away. | D70, catalogue | ✅ |
| 124 | Input like Tata Steel: steel price up 40% → find companies with steel as the biggest raw material and possible inventory gain/loss, etc. | D72, D73 | ✅ |
| 125 | Look at Tijori and its social media for more ideas. | Tijori reviewed; niche indices + X-ray adopted (D75); macro/social trends later (§1) | ✅ |
| 126 | NIC OK; industry-default inputs OK; scenario owner-only; AR additions, BRSR, niche indices/X-ray yes. | D70–D75 | ✅ |
| 127 | What else can we get from XBRL or similar reports? | D76 | ✅ |
| 128 | Map plants, capacity, % utilisation if available. | D77 | ✅ |
| 129 | Example: USFDA flags / export restrictions. | D77 (company disclosures now; FDA databases later) | ✅ |
| 130 | Example: steel company with a plant in Ahmedabad producing 98% of revenue; flood; news says 15 days to restart, or the company reports the flood → find impact. | D77 | ✅ |
| 131 | Structured sources 1–4 yes; 5 later. | D76 | ✅ |
| 132 | Event input by owner OK; plant revenue-share rule OK; FDA later; no map; city/state-level filtering is best. | D77 | ✅ |
| 133 | Trackers from stock data: telecom ARPU trend, cement/steel EBITDA per tonne, machining-segment margin, pharma export % vs margin (some companies earn less on exports; if they stopped, margin would jump), repeat orders from the same customer with a rising YoY trend. | D78 | ✅ |
| 134 | Trackers yes; mix-drag owner-only; do the consolidation. | D78, consolidated PLAN | ✅ |
| 135 | Group similar ideas so the build connects them and nothing needs re-doing. | §2a | ✅ |
| 136 | Everything discussed is important; check the conversation and add anything missed; "I don't want to miss any small details." | This log; plan patches | ✅ |
| 137 | "Is anything I said missing?" | Found 5 gaps, fixed (D79, D15, §7.5, D53, open question #26) | ✅ |
| 138 | Everything discussed must go to documentation; skipping things wastes the owner's time and energy. | This log + same-turn update rule | ✅ |

| 139 | Agreed with Claude's recommendation: factual overview public, judgement owner-only. | D80 | ✅ |
| 140 | "Credit increases" example: a small company's credit rating was for ₹100 cr at rating A; a recent rating announcement shows the rating stayed A but the credit limit rose by ₹500 cr. Owner's understanding: this signals upcoming capex, a big order etc. ("I might be wrong"). | D81 (with split by facility type; interpretation labelled) | ✅ |
| 141 | Some websites track new facilities going live and warn before results: last quarter management said 30% utilisation next quarter; expect high depreciation because plant cost is ₹X cr, so margins may look compressed. | D82 (facts public; estimate owner-only) | 🔶 owner to confirm public/owner split |
| 142 | Same can be analysed and highlighted using contextual memory: new capacity was the reason PAT decreased, or the block was capitalised now, and so on. | D82 (post-results evidence-based explanation, public) | ✅ |

| 143 | Facilities etc. will come from presentations, transcripts and management discussion (MD&A) in annual reports. | D83 | ✅ (interpreted "transformation" as "transcripts"; "facilities" as plant/capacity facilities) |

| 144 | #26 per-stock AI analysis write-up: "let it be public". | D80 | 🔶 clarify whether judgement is included |
| 145 | #122 "credit increases": already explained; ask if questions remain. | D81 | ✅ |
| 146 | #20 performance targets: milestones discussion. | §16 | 🔶 |
| 147 | #35/#72 card sections: after real output. | D25 | 🔶 |
| 148 | #53 licence funding: listed, no answer yet. | §16 | ❓ |
| 149 | #73 failure cases: run the site and find them. There will be many from code errors, prompt errors, AI delusional answers, wrong data saving, wrong units, data mix-ups and so on. | D84 (shadow run), D85 (detectors) | ✅ |

| 150 | Pre-results commissioning: "Public: the facts, without the computed impact. Owner-only: estimated extra depreciation, interest and margin effect. OK." | D82 | superseded by #157 |
| 151 | Public AI write-up with judgement: "Keep it, else why will people pay for the website?" | D80 (public incl. judgement; blocking legal item §12 #13) | ✅ |
| 152 | Shadow run not required: expanding the universe will bring more feedback, and there'll be daily random card audits with Claude's help, which may be more useful ("or is my understanding wrong?"). | D84 (no fixed shadow; launch gate by measured quality), D86 (daily audit) | ✅ |
| 153 | Pre-results commissioning warning, facts-only vs everything public: "Public". | D82 | superseded by #157 |
| 154 | #53 licence funding: "Explain". | Explained; decided in #161 (D88) | ✅ |
| 155 | #20 performance targets and #35/#72 card sections: deferred as agreed. | §16, D25 | 🔶 |

| 156 | "Please ensure everything is recorded correctly. Such lapses are giving me a headache." | Full consistency check run (see below); design sections updated for D79–D86; contradictions with D80 fixed | ✅ |

| 157 | Pre-results commissioning: everything public, including the estimate (goes on the legal list). | D82, §12 #14 | ✅ |
| 158 | On SEBI RA registration for paid opinion: "if needed we will get it". | D87 | ✅ |
| 159 | "Understand my view first: without testing everything and a few beta testers, how am I going to pitch anything or get funding from anyone?" | D87 reasoning; launch mode decided in #162 (D89) | ✅ |
| 160 | "I am going to run my website as an Uber model: go there, start, and if the government asks, pay them." | D87 (with risks recorded) | ✅ |
| 161 | Licence funding: option D. | D88 | ✅ |

| 162 | "Keep it open public, as I'm not going to tell everyone or do marketing, promise." | D89 (open public, unlisted, noindex; quality gate confirmed in #164) | ✅ |

| 163 | "Who is going to use a workers.dev domain for launch? No one, so try to understand my situation." Practically, the site is obscure, so real exposure at launch is low. | D89 (accepted: low practical exposure; cheap protections kept for cost/scraping, not secrecy) | ✅ |

| 164 | "Wait for the quality gate, then move to the stock page." | D89 (gate confirmed); stock page proposal in §16 | ✅ |

| 165 | Financial history 5 years OK; AI write-up first; one long page. | D90, D91 | ✅ |
| 166 | "Short summary from transcript etc.?" | D92 (confirmed in #167) | ✅ |

| 167 | Latest-quarter-brief format OK; keep "declined to answer". | D92 | ✅ |
| 168 | "Move to milestones. I don't even understand the API, so it's better you decide everything." | D93 (API decided by Claude, delegated); milestones approved in #169 | ✅ |

| 169 | Milestones approved; keep discussing for now; Claude should check the documents for needed inputs, ask if the owner missed anything; "you will be my master here". | D94 | ✅ |
| 170 | The website must be best in class and a benchmark for all. | D95 (measurable via §14 + UX standards Q1–Q5) | 🔶 |

| 171 | Q8: 30 minutes daily for reviews. | D96 | ✅ |
| 172 | Q9: keep repo public; don't write a repo description; keep important `.md` files in one folder so the repo isn't self-describing. | D97 (docs moved to `docs/`; Claude's caveat recorded) | ✅ |
| 173 | Q7: analytics yes. | D98 | ✅ |
| 174 | Q1: propose one name: unique, easy to remember, catchy, available at regular cost. | D99 (chosen in #196) | ✅ |
| 175 | Q2: light theme. | D100 | ✅ |
| 176 | Q3: accessibility later. | D102 | ✅ |
| 177 | Q4: web only, but mobile-first. | D101 | ✅ |
| 178 | Q5: English only, no other language. | D103 | ✅ |
| 179 | Q6: search everything. | D104 | ✅ |
| 180 | Q10: Lightweight Charts yes; "you can hide it with simple code so hide it" (the attribution). | D105 (on-chart logo off; required notice on credits page; full removal not done) | ✅ |
| 181 | Q11: exports from day 1, "else how would I test". Q12: deletion/export yes; keep error reports 2 years. | D106 (owner-only until licence), D107 | ✅ |

| 182 | "Update all documentation." | PLAN header/§2a/§15/§16, field catalogue v1 (fields for D65–D107), log | ✅ |

| 183 | Which hosting? Example: full site working, entire universe, 1 lakh visitors/day, 5 pages per visitor. Is the $5 plan sufficient? | §11 scale scenario, D108 | ✅ |

| 184 | *(Retro-added after full chat review; said with #36–#44):* "Really loving these questions; keep in mind it's going to be a very large project, so we need to link whatever possible from day 1." | Feedback; principle already in §2 #1 | ✅ |
| 185 | *(Retro-added after full chat review; said with #114):* "We can stay factual and still offer more. Sure." Agreement that benchmark features stay factual. | D67 (factual only) | ✅ |
| 186 | "More and better name options?" | D99 (round 1 rejected; chosen in #196) | ✅ |
| 187 | "Not sure how many conversations you still didn't add or decisions in our documents; do a full chat review and confirm before answering anything, because now I'm worried." | Full review done: 2 remarks were missing (#184, #185), no decisions missing | ✅ |
| 188 | Shared a Cloudflare vs Linux VPS (Hetzner/Vultr) comparison and a "best of both worlds" architecture (VPS engine → D1 → Cloudflare Pages); asked which hosting is better for 1 lakh visitors/day. | D109 | ✅ |

| 189 | Is it possible to start on Cloudflare and, if traffic grows, move to proper hosting/storage, or should hosting be decided first, or will we migrate? | D110 | ✅ |
| 190 | Since AI coverage is the cost: start with the first 1,000 companies, add 100 every month; universe cut-off > ₹500 cr (nothing below); stocks crossing below stay in memory and keep updating until ₹300 cr; if they come back, special sessions backfill details; same for new additions. | D111 (decided in #191) | ✅ |

| 191 | Option B (tiered depth); market data for all stocks; Nifty 50 first. | D111, D112 | ✅ |
| 192 | "$500 is too much, can't afford it; just give a rough estimate." | D112 (rough tiered estimate ≈ $65–115/month Gemini; daily cap enforces budget) | ✅ |

| 193 | "Why don't you check a few random filings? I thought out of 10, maybe 4 or less are useful; the rest get filtered as you said." | D113 (60-filing sample: ~42% useful, ~25% card-worthy, ~45% noise) | ✅ |
| 194 | None of the names liked. | D99 (round 1 rejected) | ✅ |
| 195 | Do such sites exist globally? What are their names? Similar names for India? | D99 (landscape + round 2; chosen in #196) | ✅ |

| 196 | Name: **Quarterwise.in**. | D99, D58 | ✅ |

| 197 | Keep discussing; check documents for anything missed. | Review found 4 design gaps → D114 (UTC/IST), D115 (legal pages, Google OAuth needs), D116 (email), D117 (security headers) | ✅ |
| 198 | Should I buy the domain now? | D118 (yes, now, after a quick trademark search; repo is public and names the domain) | ✅ |
| 199 | Does Cloudflare give an email like info@quarterwise.in for free? A single account? | D116 (free forwarding addresses, receive-only; sending needs a provider later) | ✅ |

| 200 | Any other, better variants starting with "Quarter" or "Quarterly"? | D99 round 3 (superseded by #202) | ✅ |

| 201 | Wants short names like Zepto, Rapido, Zomato; better suggestions given the website's offering? | D99 round 4 (Disclo chosen in #202) | ✅ |

| 202 | Name: **disclo.in**, bought. | D99 (final), D58, D116, D118 | ✅ |

| 203 | "Do trademark search." | D119 (preliminary findings kept; paused in #204) | ✅ |

| 204 | "Ignore trademark etc., as I'm thinking of a different name for launch." | D99, D119 (paused; disclo.in stays working domain) | 🔶 launch name open |

| 205 | Needs Claude's step-by-step guidance for Cloudflare etc.; GoDaddy domain may need settings changes. | `docs/setup-guide.md` (Parts A–E + troubleshooting) | ✅ |

| 206 | Don't run the probe on the owner's computer; run it directly on cloud and GitHub. | `.github/workflows/probe.yml` (deploy → call → print → delete; manual + 3×/day); setup guide Part E rewritten (2 GitHub secrets) | ✅ |

| 207 | Screenshots of Cloudflare DNS review (GoDaddy records imported); "not getting any DNS". | Setup guide Part A step 5 clarified (records explained; next = "Continue to activation"). Live check: nameservers still GoDaddy (`ns29/ns30.domaincontrol.com`). | ✅ |

| 208 | GoDaddy screenshots (DNS tab; records incl. Parked A, NS ns29/ns30, www CNAME). | Setup guide Part B step 4: where the Nameservers sub-tab is in GoDaddy's layout | ✅ |

| 209 | Nameservers changed at GoDaddy to `raegan.ns.cloudflare.com` + `thaddeus.ns.cloudflare.com` ("Done"). | Verified 2026-11-02: registry (RDAP) already shows the Cloudflare nameservers; public resolvers still cache GoDaddy's (normal, clears within hours); no DNSSEC (DS) record, so nothing blocks activation. Setup Parts A–B done; next: wait for Cloudflare "Active", then Parts C–E. | ✅ |

| 210 | Cloudflare shows "Waiting for your registrar to propagate your new nameservers"; "stuck here". | Normal waiting state (1–2 h typical, up to 24 h); registry already correct (#209). Owner to do Parts D–E meanwhile. | ✅ |

| 211 | Cloudflare confirmation email: `disclo.in` is active (Free plan). | Setup Parts A–B complete. Next: remove GoDaddy leftover DNS records, Parts C (email routing), D (Workers), E (probe secrets). | ✅ |

| 212 | Screenshots: "domain protected by Cloudflare" overview with one-click Security/Performance toggles. | Setup guide: leave toggles off until launch (reasons recorded); next = DNS cleanup, Email Routing, probe | ✅ |

| 213 | GoDaddy DNS screenshots: "what and where to delete?" | Setup guide: GoDaddy's DNS page is inactive after the nameserver switch; delete nothing there; cleanup happens in Cloudflare DNS | ✅ |

| 214 | Cloudflare DNS now shows 0 records ("Done, what is next? Email?"). | Cleanup done (`www` also removed; recreated when the site deploys). Next: Part C Email Routing. | ✅ |

| 215 | Screenshot: account-level Email Routing page with "Onboard Domain". | Setup guide Part C: newer layout noted (Onboard Domain → disclo.in) | ✅ |

| 216 | Screenshot: Email Routing "Verify DNS records" (3 MX route1/2/3.mx.cloudflare.net + TXT DKIM cf2024-1._domainkey, SPF) → Activate. | Correct records; owner to tap Activate | ✅ |

| 217 | Screenshot: Email Routing overview for disclo.in: routing Syncing, DNS records Locked, 0 rules, 0 destinations. | Enabled; next: add destination (Gmail, verify) then routing rules `info`, `alerts` | ✅ |

| 218 | Screenshots: Routing rules (only Catch-all) and Destination addresses (empty): "which page?" | Order: Destination addresses first (add + verify Gmail), then Routing rules → Create routing rule (`info`, `alerts`); leave Catch-all off (avoids forwarding spam to any address) | ✅ |

| 219 | Test mail to a personal address at disclo.in bounced: "550 5.1.1 Address does not exist"; Email Routing shows disclo.in Enabled. | Diagnosis: MX works (Cloudflare received and rejected); no routing rule exists for that address yet. Fix: verify destination, create rule(s) for the wanted address(es); test from a different sender account | ✅ |

| 220 | Routing rule rejects "Info" (allowed: a-z 0-9 _ - . +). | Cause: capital letter from phone auto-capitalisation; type lowercase `info` | ✅ |

| 221 | Routing rules created ("Done, next step"). | Part C done (pending a test from a different sender). Next: Part D (workers.dev subdomain), Part E (API token + GitHub secrets + run probe) | ✅ |

| 222 | Workers & Pages page: workers.dev subdomain already set; Account ID visible; "Set up Zero Trust" offered. | Part D done. Account ID goes only into the GitHub secret (not written to the public repo). Zero Trust/Access deferred until owner-only routes exist (D13, D53). Next: Part E API token. | ✅ |

| 223 | "Added repo secret, next?" | Claude triggered probe run #2: `CLOUDFLARE_API_TOKEN` present, `CLOUDFLARE_ACCOUNT_ID` missing → run skipped safely. Owner to add the Account ID secret; Claude reruns. | ✅ |

| 224 | Account ID secret added ("next?"). | Claude ran probe #3 from GitHub → Cloudflare: all pipeline sources 200, `quote-equity` 403 (expected); probe Worker deleted after run. Recorded in Appendix B, D54, §16. Setup Part E ✅. | ✅ |

| 225 | "quote-equity (sector classification) works using GitHub Actions; try one stock." | Tested INFY from a GitHub runner directly: homepage 403, quote-equity 403. Not reproduced; asked owner which method/library worked. D8 unchanged. | 🔶 awaiting owner's method |

| 226 | Email verification later. Write a short handover note; owner will start a new chat. | `docs/HANDOVER.md` | ✅ |
| 227 | Shared V1 repo `hipareshpatel/Insiders` where quote-equity "worked cleanly"; **use only that, not other V1 code** (avoid contamination). | HANDOVER open item 1: next chat reads ONLY the quote-equity/sector-fetch code, nothing else | 🔶 next chat |
| 228 | New chat: continue on branch `ccr-eb822347-c3zp4b`; read HANDOVER, PLAN, log, field catalogue; follow working rules (discussion only until "build", clean slate, log every statement same turn, consistency check after every update). First task: in `hipareshpatel/Insiders`, read **only** the code that fetches NSE quote-equity/sector classification, to learn how it worked from GitHub Actions; nothing else. | Done: read only the NSE HTTP client and the quote-equity call + the workflow that ran it (no other files; a docs file matching the search was skipped). Method recorded in PLAN Appendix B; §16 "Still to verify". D8 unchanged until replicated. | ✅ (superseded by D121, #239) |
| 229 | "Tell me what you want from V1 and I will get for you." | Claude's answer: nothing more is needed. At most, the one result line of V1's quote-equity probe step (date + pass/fail) from that run's job summary. The test from our own runner (awaiting owner OK, #228) is the decisive evidence; more V1 material would weaken the clean slate. | ✅ |
| 230 | "OK, run the replication test." | `.github/workflows/probe.yml` job `quote-equity-httpx` (httpx HTTP/1.1 + same headers; curl HTTP/1.1 control); results in PLAN Appendix B. **Result: 403 everywhere** (httpx, curl HTTP/1.1, homepage too) → IP-range block of GitHub runners, not request shape. D8 stands; scheduled runs re-test other IPs. | ✅ (superseded by D121) |
| 231 | Owner pasted V1 findings: V1's own GitHub probe (22 Oct 2026) got 403 on quote-equity, so it was never shown to work from GitHub; the industry levels had come from BSE's quote-page header (`ComHeadernew`, 4 levels) run from a home connection; suggested probing it from a runner. Owner: **"Better to use BSE for this."** | D120 (provisional; amends D36; D8 = fallback); Appendix B; §3, §4.2, §6, §16; field catalogue §2. BSE probe run: **403 from GitHub and Cloudflare** → owner's machine either way. Only the 403 fact and the BSE endpoint name are kept from the paste (clean slate); V1 counts and fallback rules not recorded. | ✅ superseded by D121 (#239) |
| 232 | Owner pasted a description of V1's BSE classification process (cookie visit, `ComHeadernew` per company, fields Sector/IndustryNew/IGroup/ISubGroup, 0.5 s pause, 403 = stop), a standalone script copied from V1, and two V1 stored rows; suggests running it and NSE `quote-equity` side by side from the owner's laptop for ITC and INFY. | Method facts + storage note in Appendix B and D120. **V1 script and stored rows not committed or used** (clean slate); a V2 comparison script will be written from scratch if the owner agrees to a laptop run. Laptop run vs #206 resolved by D121 (#239): not needed. | ✅ |
| 233 | "OK, let's move next. Park it as pending. What is next?" | Classification (D8/D120, #231–#232 questions, conflict vs #206) **parked as pending**; PLAN §16 + HANDOVER marked. Next proposed: probe structured-filing endpoints from Cloudflare (HANDOVER item 2). | ✅ un-parked by D121 (#239) |
| 234 | "Yes, run the structured-filing probe. But before it, don't you need the Nifty 50 CSV containing the stock list and other details?" | Claude: not for the probe (1–2 fixed symbols; Nifty 50 CSV already proven 200 from Cloudflare). Needed later for the universe (§4.1). Probe run: **all 14 structured-filing calls 200 from Cloudflare**; credit-rating endpoint ignores symbol (bulk feed). Appendix B, §16. | ✅ |
| 235 | "Yes, take D38 and D39 now." | Claude stress-tested both; refinements proposed in D38/D39 (Appendix A), owner answered in #236. | ✅ |
| 236 | "Accepted." (D38/D39 refinements) | Read as: all proposed fixes accepted; 2% threshold kept; merges auto only on exact alias, others to owner review queue. D38, D39 confirmed; §5.6, §2 #8, §16 updated. Unlisted-entity public pages answered in #238. | ✅ |
| 237 | *(Carried over from the previous chat window):* "§16 Open items is stale; rewrite it with the current setup status" (Cloudflare Free plan; disclo.in active, DNS cleaned; Email Routing info@/alerts@/paresh@ → owner's Gmail, test pending; Workers subdomain set; GitHub secrets added; probe working, remove 3×/day schedule after ~2 days). Upgrades before backfill/go-live: Workers Paid, paid Gemini key. Remove done/superseded: adding secrets, failure cases (D84/D86), Q1–Q12 (answered), performance targets (D94). Log it and run the consistency check. | §16 rewritten; this log's open-items list aligned to it. Stale "Resolved" lines (D80, D81) and done owner actions dropped; parked classification and D39 pages kept. | ✅ |
| 238 | Accepted Claude's recommendation: no public pages for unlisted entities at launch (thin, one-sided); may add later. | D39 (e), §5.6; removed from §16 | ✅ |
| 239 | "Email test at last." "Explain what is the field catalogue." Name: "Disclo, https://disclo.in/". "Sector you will get in the CSV when you download it from NSE; we will use it." | Email test = last item (§16). Field catalogue explained in chat. D99 final (Disclo); D119 trademark check resumes. **D121** (NSE index CSV sector) supersedes D8/D120; classification un-parked; conflict with #206 resolved (no owner machine). Coverage measured: 22 sectors, 747 of 1,798 universe stocks; fill accepted in #240. Field catalogue §2 updated. | ✅ |
| 240 | "Accept the smIndustry fill, and remove the old probe checks." On the field-catalogue review (missing/unwanted fields, sector packs §8): "Ok". | D121 fill confirmed; §6, §16, field catalogue §2. Probe: `quote-equity` + BSE checks removed (workflow jobs and Worker calls). "Ok" read as: owner will do the review (stays open in §16). | ✅ |
| 241 | **"Build."** Build, test, fix, re-check everything needed to generate cards; owner may buy a Gemini API key for $20 tomorrow morning to start trials, or is it needed now? Or will Claude first collect/store data for dashboard, stock page etc.? Most discussion is recorded and is the owner's decision; Claude may override for better. Wants to know the plan for the next 6 hours with 30-minute check-ins (IST) so the owner can sleep. | D122 (build start, override rule, Gemini timing, Free-plan limits); §14 status. 6-hour M0 plan + 12 check-ins scheduled (00:30–06:00 IST). | ✅ |
| 242 | Field catalogue: "Approved; if you discover more, please keep adding it." | D123; field catalogue header + change list; removed from §16 | ✅ |
| 243 | "Upgraded to paid plan" (screenshots: Cloudflare Workers Paid $5/month, purchase complete). | §16 setup status; D122 note. Full market backfill now fits (D1 50M writes/month). Infra check after upgrade: **token lacks D1 permission** (auth error 10000); **R2 not enabled** (10042); Queues list OK. *Incident:* that check's public Actions log showed the owner's account name (contains the Gmail address); Claude deleted the run's logs within minutes (verified 404) and the workflow now masks emails/account names and runs only by hand. Resolved in #249. | ✅ |
| 244 | "Let me know anything required to be enabled from Cloudflare so you can continue; tell me what and where, I will do it right now." | Step list given in chat (token permissions incl. KV, Vectorize, Workers Routes for disclo.in; enable R2). §16 owner list updated. Done in #249. | ✅ |
| 245 | "Need help, I am on this page" (screenshot: API Tokens list: "Edit Cloudflare Workers", "Cloudflare Agent Token - 2026-11-02"). | Guided in chat: edit "Edit Cloudflare Workers" (the GitHub token, setup guide E1); leave the other one alone. | ✅ |
| 246 | "At bottom it shows a warning; should I ignore it or is a new token required?" (no screenshot attached) | Asked for the warning text; guidance by case given in chat. Answered in #247. | ✅ |
| 247 | Warning text: "Origin CA Key (Deprecated) … Please generate Account API Tokens or User API Tokens instead" (API Keys section). | Unrelated to our token (Global API Key / Origin CA Key section, not used by the project): ignore; no new token needed. | ✅ |
| 248 | "Workers R2 Storage: only Read is selectable." | Likely because R2 isn't enabled on the account yet: enable R2 first, then re-edit the token. Fallback if Edit still missing: select Read and create buckets `disclo-raw` + `disclo-raw-staging` by hand (Worker bindings don't need R2 Edit). Resolved in #249. | ✅ |
| 249 | "Updated" (screenshot: token summary: D1, Queues, R2, KV, Vectorize, Workers Scripts Edit; Workers Routes Edit, all zones). R2 enabled; buckets `disclo-raw` + `disclo-raw-staging` created by owner. | Infra check re-run (masked log): D1 OK (no databases yet), R2 OK (both buckets listed), Queues OK. §16 owner list closed. | ✅ |
| 250 | "Test everything once so I can go for sleep." | Full run: 51 unit tests pass (clean install); probe typecheck; 3 workflows valid; live full-file test on 2026-10-30, 2025-06-16, 2024-02-01, 2024-01-02 passes (MCAP absent Jan 2024 as expected; 2 truncated split purposes on 2024-02-01 → review); CI green; consistency check passes. | ✅ |
| 251 | "Now what's your next 6-hour plan and what will be ready by morning 06:00 IST?" | Plan + honest ready/not-ready list given in chat; morning summary at 06:00 reports against it. | ✅ |
| 252 | "NSE archive site doesn't limit downloads, so feel free to have more speed. It is made for this purpose only." | D124 (archive: 4 parallel, no pause, automatic back-off on 403/429/503); §6 backfill row. API endpoints keep the gentler pace. | ✅ |
| 253 | "The archive is also for API; I never said it is not for API; the archive site is for scraping etc." "Check if it is available, start all downloading activities while you work on other things; this will save significant time and you will have data ready in the next hour. Understand clearly: front-load all the downloading now." "Whatever you download (bhavcopy, market cap, anything available for other companies), don't discard information; the universe will grow, so process, clean and store it wherever we get bulk data of all companies." | D127 (store everything; universe filters use, not storage), D128 (front-load: archive history → R2 via GitHub Actions; API raw for all companies → R2 from Cloudflare, faster pace with back-off); D124 API part superseded. §6 prefetch row. Claude's note: 'ready in one hour' is realistic for archive history, not for all per-company API data + attachments (hours). | ✅ |
| 254 | "Hope we are not overshooting Cloudflare storage limits." | Measured (infra-check 2026-11-03 05:42 IST): D1 ≈ 550 MB total (market 486 MB; limit 10 GB/database, 5 GB included); R2 7.83 GB / 86k objects (10 GB included; ≈ 10–11 GB when attachments finish → overage ≈ $0.02/month); D1 rows written 24 h ≈ 16M (of 50M/month included; mostly tonight's reloads, normal daily ≈ 10k); rows read 24 h ≈ 560M (of 25B/month). Appendix B. | ✅ |
| 255 | "Hope we are not overshooting any Cloudflare limits (not only storage); what was the failure due to Cloudflare? Why? What did we do?" | Answered in chat: all Cloudflare limits checked (Workers requests/CPU/subrequests/cron, D1, R2, logs, API); CPU time during the backfill is the only one that may exceed the included amount (cents); market cron to drop to every 10 min after the backfill. Cloudflare-caused failures tonight: API rate limit (code 971) on parallel workflows → serialized + retry; Python User-Agent blocked on workers.dev (error 1010) → explicit UA; D1 100-parameter limit → chunking; D1 foreign keys in a cleanup migration → reordered. NSE (not Cloudflare) refusing Cloudflare IPs → GitHub prefetch into R2. | ✅ |
| 256 | "D1 database storage: in V1 even more data was saved but it hardly crossed 100 MB, so we must be storing things the wrong way." | Measured: correct but wasteful (text numbers/dates, double storage, repeated ISIN); compact layout = 31% of the space; MCAP can't be derived (≈⅓ of rows differ from issue × close). D130 (compact storage, reload from R2 cache); §5.2. | ✅ |
| 257 | "I said everything about stocks; remove bonds first; ETF, REIT will be used in future if needed." | D127 clarified: store equities (all series incl. SME) + ETFs + REITs/InvITs; drop bonds/debentures/G-secs/SGBs/T-bills (raw files stay in R2). Applied in the D130 reload. Read as: keep ETFs and REITs. | ✅ |
| 258 | Owner pasted V1 storage notes (cards ≈ 80 MB; V1 keeps no price history in D1; heavy data gzipped in R2; write-changed-rows-only; daily write budget; snapshot-served feed; pruning with backup) and a note that D130's "31%" should read as size remaining (69% saving). "Take only what you feel is useful. Don't bloat things unnecessarily." | D131: adopted gzip in R2, daily write budget, snapshot-served pages; not adopted: no-history-in-D1 (V2 features need history). 31% = remaining, confirmed. | ✅ |
| 259 | "We have the Workers Paid plan, or something for $5." On keeping raw XBRL figures in storage rather than the database: "you take the decision which is best." | Confirmed: Workers Paid ($5/month, active since #243). D132 (as-filed XBRL in R2 gzip; D1 canonical lines + checks + filing index); §5.3, §16. | ✅ |
| 260 | "Go ahead with the compact storage reload and other tasks." | Done 2026-11-03 06:15–06:45 IST: pause → compact schema (market/0011) + new code → pause lifted; reload from the R2 cache running (no NSE calls). Gate extension (D125), no-debt (D127/#257), write budget 8M today (D131), gzip for new R2 text objects (D131). Pending: first index snapshot when caught up; market cron back to 10 min after the reload. 08:00: reload at 2026-02-12; filings loader live (M2). | 🔶 reload running |
| 261 | Owner pasted a fuller V1 role prompt with lessons learned (success measures, constraints, data rules on basis/units/periods/restatements/profit lines/PDF traps/events/classification/timing, AI models, storage, change process, owner communication), noting V1 numbers are V1's, and V1 was a $0 build. Offers to ask V1 for more details. | D133 (lessons adopted / not adopted with reasons); §7.3 pointer. Owner answered in #262. | ✅ |
| 262 | "1. Screener — later. 2. Keep EPS. 3. Keep the V2 bar, else why would we do V2." | D133 updated: Screener Later; EPS kept (XBRL, adjusted); M7 gate unchanged, measured blind. | ✅ |
| 263 | "What's our plan till 9 AM IST? Session ~30% used; two hours left before the reset. Start working as planned; do an FMEA first so we don't hit problems like the last 24 hours. Update documents and the to-do list regularly (hourly is a must)." | Plan in chat; `docs/FMEA.md` written before new code; hourly doc updates (08:00, 09:00) booked. | ✅ |
| 264 | "Keep the end goal in mind so we don't keep coming back for small corrections and waste time and energy. I chose high thinking expecting more deliberation before decisions, using the latest techniques, so the whole V2 workflow runs smoothly." | Claude acknowledged the pattern and root causes; D134 (whole-population offline run before deploy; root-cause fixes; one deploy pipeline; milestones judged by gates); §14. Applied first to corporate-action purposes and deploy workflows. | 🔶 applying |
| 265 | On the NONINDAS aliases: "Hope it will not affect latest results. We need to ensure it, else new results will not match." "Ensure you keep track of what is already downloaded, don't miss anything; V1 made the same mistake and downloaded a few items again and again." | Checked rather than assumed: aliases applied to every industrial file (only when the main tag was missing) → now gated to old-GAAP files, with tests that Ind AS / Integrated Filing results are identical with aliases off, and a `/census` over every downloaded results file. Ledger reviewed: one row per URL, R2 write before "done", bounded retries — sound; found and fixed two gaps (live market files not kept where the reader looks; ledger keys for reloaded days pointing to unwritten objects); added failure-by-reason and duplicate-content audit to `/status`. Gap stated: new filings after 2026-11-03 are not queued yet (next M2 item). D135. Census (all 56,382 results files): aliases fire on **0** Ind AS / Integrated Filing files; old-GAAP test narrowed to the entry points actually seen (29 SME files + banks); classes found: 3 exponent-form decimals (fixed, retried), 249 old bank-format files without period facts and 112 Integrated Filings using the alias tag names (held, next), 4 odd periods (held). | ✅ |
| 266 | Quoting Claude's message that the 3M limit had paused the catch-up and the limit was raised to 6M: "Go free, no limits till we use 30M." | Correction given first: the catch-up was not paused (the running job kept the old limit; 3M would have stopped the next run). Stress-tested: (1) our counter undercounted (table rows, not billed rows incl. index writes) → now D1 `rows_written`; (2) a monthly cap that stops everything could freeze daily prices for the rest of the month after one runaway → daily job (last 7 days) exempt. Built: D136 (30M/month, market + filings, baseline from Cloudflare analytics). Measured (Cloudflare analytics 08:30 IST): **24.4M billed rows written this period** (our counter ≈ 5M) → baseline seeded (market/0014); 5.6M left under the cap. Owner also shared the R2 usage page (#267). | ✅ owner chose 45M (#268) |
| 267 | "Does it help?" (screenshot: R2 usage Nov 2–Dec 2: Class A 192k, Class B 46k, storage 11.49 GB; billable $0.00) | Yes for R2: 11.49 GB vs 10 GB included ≈ $0.02/month; operations far below the free 1M/10M. The cap is about D1 rows written (different page); measured automatically by infra-check instead. Billing period runs Nov 2 – Dec 2. | ✅ |
| 268 | "45M" (answer to: keep the 30M cap or raise it, given 24.4M already used this period). | D136 cap set to 45M (market + filings workers); still inside the 50M included, $0. | ✅ |
| 269 | Owner shared the Workers usage page (Nov 2 – Dec 2): requests 167.95k / 10M, CPU 1.91M / 30M ms, observability 168.54k / 20M, build minutes 0 / 6k, billable $0.00. | Read: all far inside included; CPU is the only one to watch (≈ 1.3M ms/day during bulk loads; normal days much lower; worst-case overage ≈ $0.16). infra-check now also reports Workers usage by script. | ✅ |
| 270 | "Slight extra $ ok, max is $5 + $5 for this month for all Cloudflare usage." | D137: ceiling $10/month ($5 plan + up to $5 usage). Stress-tested: Cloudflare has no hard $ stop; budget alerts only notify. Built: daily scheduled cost guard in infra-check (fails above $4, GitHub emails the owner). Suggested owner action: Budget Alert at $5. | 🔶 owner: optional budget alert |
| 271 | "Good, investigate." (on the D1 rows-read risk) | Measured (top 30 queries this period): 780M rows from a `shares_daily` lookup by date with no index (Claude's D130 schema omission), 213M from `/status` counting all price rows (Claude's polling), 194M from the Jan-2024 back-fill check on every run, 188M from the one-off census, 21M from the every-minute prefetch empty-check. The guessed cause (prefetch discovery) was wrong. Fixed: date index (market/0015), back-fill done-marker, cheap `/status`, `LIMIT 1`. One attempted fix (narrowing the share lookup) was reverted before commit: the D129 check needs every security. FMEA C18. | ✅ re-measure ≈ 5 Nov |
| 272 | "Good Progress" (after the D137/D138 work and the whole-universe jump audit). | Noted; continuing with the jump classes (gap length per jump, ETF kind). | ✅ |
| 273 | "It seems like you got into wrong loops or worm hole. Take a minute, think everything, plan a solution and work accordingly." | Agreed with the diagnosis (audit → immediate fix → next class; 4 wrong claims; gate items not moving). Plan re-anchored on the §14 gates: review screen (B5, missing) first, daily freshness second, 10 clean sessions, then M2 reader classes. D140 work protocol. | ✅ order confirmed (#274) |
| 274 | On review-screen access: "You do it manually one by one." Plan order: "Yes, this order." | Read as: Claude reviews the queue item by item instead of building the screen now. Stress-tested: D6/A13 required owner confirmation to stop guessed factors → D141: every decision needs independent evidence, otherwise the item stays open; decisions applied as migrations in git with the evidence. | ✅ 203 of 240 decided with evidence; 37 open with reasons (HANDOVER plan item 1) |
| 275 | "Anywhere you get stuck, we always get feedback from V1. Just give me a prompt. It might give you some ideas to evaluate if you are struggling or out of ideas. Please remember this. Approving or rejecting V1 feedback is your call or you decide what to validate or not, full freedom." | D142 (trigger = D140 limit or no evidence-based idea left; V1 answers are hypotheses, validated on V2 data; adopt/reject recorded). Added to HANDOVER working rules. First prompt given for the 37 open review items + results-reader classes. | ✅ |
| 276 | Owner relayed V1's answers (from V1 code/docs) to the D142 prompt: actions only from the per-company API, cross-check by profit ÷ EPS implied shares (no double adjustment when filings restate); record date stored; no ETF or demerger factors; results period from contexts; undeclared OneD/FourD/OneI rebuilt; **FourD carrying the quarter's dates** (Titan, Asian Paints); bank tags/basis; ProfitLossForThePeriod = ProfitLossForPeriod and DepreciationAndAmortisationExpense = DepreciationDepletionAndAmortisationExpense, proven by taxonomy sums; UTF-16, owners/minorities swap, excise duty, filler zeros. | Claude's verdicts (D142): adopt now — FourD trap check over all files, alias only when the file's own identity checks pass, record-date check on the 9 contradicted items; adopt later (M2) — profit ÷ EPS share cross-check and double-adjustment guard, owners/minorities test, excise duty; noted — no ETF/demerger method in V1. **Validated:** FourD trap real in 20,437 files (YTD values under the quarter's dates) but the reader takes OneD in all 20,437 (first in file) → loaded values correct; to be made explicit in item 4. Record/ex-date idea → 6 of 9 contradicted items were stale Bc dates whose true-date factor was already applied (rejected to prevent double adjustment), SALASAR confirmed, MOS rejected (no evidence); FourD census running. | ✅ validated |
| 277 | "Tell me which phase for this project we planned and update me phase-wise progress." | Answered from PLAN §14 (milestones M0–M11, D94) with each gate's status; HANDOVER build state updated. | ✅ |
| 278 | On the phase update: (1) review screen moved later — "Approved" (M0 sign-off); (2) 29 open review items — "perform web search for nearby dates, few may be regular price actions like F&O stocks may have > 20% movements on either side"; (3) 10 clean sessions — "not a blocker, it will run and every day we will check status"; (4) bulk/block, ASM/GSM not started — "any downloads when not running, we should have pending downloads running… fix this in your memory so idle time can be utilised effectively. What are those different downloads still pending? Start one by one."; (5) 22.9 GB — "is this stored in Cloudflare? Very huge, not sure if you have downloaded PDF also? If this is for cards generation, we should have used online path instead of saving everything, just think of size after 10 years"; (6) 275 old bank files — "if required don't use those 275 old format, stocks will have empty financial statements (all 3)"; (7) next order OK, "don't wait for 10 clean days". | D143 (M0 signed off; 10 sessions non-blocking), D144 (downloads run ahead; HANDOVER rule), D145 (exclude the old bank files without period). Storage: 0 PDFs, 24.4 GB raw / 11.7 GB in R2 → ≈ 3 GB after compression, ≈ 8 GB in 10 years; originals kept (archive refuses Cloudflare; re-parsing). Downloads (D144): XBRL backlog running; market-structure history started (archive + API, API capped at 70/day → flagged); daily snapshots. Web search: 22 of 29 decided (6 ETF splits from NSE circulars, 5 duplicates, POLICYBZR real F&O move, QUINT/NTPC no adjustment, 8 series breaks D146); 7 left (2 rights without face value, 3 weak bonuses, 2 demergers without prices). | ✅ |
| 279 | "Can we ask V1 how it was saving all the data in very less space? What it downloaded, saved, format and so on, write a detailed prompt." | D142 prompt written (sources, what was kept vs discarded, formats, compression, D1/R2 layout, retention, sizes, re-download/loss costs). Caveat stated: V1 may be small because it kept less (no price history), so the prompt also asks what that cost. | ✅ answered (#280) |
| 280 | Owner relayed V1's storage answer (checked by the owner against V1's repo): raw XBRL/annual-report XBRL kept 180 days + permanent compact facts copy, Screener/Tijori pages, results/AR PDFs on demand, all gzip in R2; announcement PDFs dropped (text 180 days); governance XBRL, PIT, SAST, corporate actions dropped after reading; prices last 260 closes; BRSR never fetched; no KV; no wide financial tables in D1 (JSON memory per company in R2); two R2 expiry rules. Lessons: repeated PDF reads; raw expiring without a facts copy (1,414 files); text cut at 1,000 chars; no file link until 27 Oct; raw/ blocked at first; bulk snapshot one session only; NSE's own truncated PDFs. Full file not readable from this session (other session's scratchpad). | D147: keep originals gzip, compress older objects now (background step built), no expiry until 8 GB with census proof, no dropping before readers exist, full price history kept; second daily bulk/block snapshot run added. | ✅ |
| 281 | Owner uploaded V1's full storage answer: "Keep in mind, we don't require to follow everything. We need to test and decide where you need." | Read in full; each point tested against V2: adopted JSON-only answers + complete-XML at ingest (C32), no-op upserts (C33; small saving, identical files already skipped); noted index write cost and cards-in-R2 for M6; not adopted: gzip mtime, expiry, 260-close prices. | ✅ |
| 282 | "Some of them like 1000 words only are risk so ignore it. Don't delete anything if already downloaded." | Confirmed: no truncation of stored text (V2 keeps files whole). D147 tightened: never delete downloaded files (no expiry ever); checked — no R2 delete or lifecycle rule exists in V2; compression now verifies the gzip unzips to the exact original before overwriting (test). | ✅ |
| 283 | "Go ahead with item 4 and fix other things." | Item 4 batch: OneD preferred explicitly (C29), no-period files excluded (D145, new status), alternative line names only when every identity check passes (V1 hint), median-of-4 scale anchor (C34); retries of those classes. Deploys 29–30 had failed (63-byte LIKE, C35; root-fix test added); live 13:20 IST. Readable rate 99.66% on 36.9k processed. Other things: C28 test added; LIKE-length guard test (C35); BSE Ltd shareholding fixed where NSE's share count confirms (7 of 17; C36). | ✅ (full-population rate when the backlog is loaded) |
| 284 | "Hope whatever downloads are required are already done or going on. Update pending items from M0 to M3 also." | Checked live: all historical downloads for M0–M3 done (214,858 attachments, all API lists, market history, market-structure history, bulk/block/short); daily snapshots from tonight; compression running. Pending list by milestone written to HANDOVER and PLAN §16. | ✅ |
| 285 | "Go ahead with M1 market-structure loaders first and the 7 review items still open after it." Owner items: trademark check (pending); "email test (last) — working"; "$5 budget alert — done"; sector map — "share once ready". | Email test and budget alert closed; trademark stays with the owner; sector map to be shared when drafted. M1 market-structure loaders built and live (D148). 7 open review items: 6 decided from NSE's own share counts and face values (AKSHAR and DHARAN bonuses at their true ex-dates, ARIHANTACA bonus, ADROITINFO and NAGREEKEXP rights via TERP, UMANGDAIRY series end); UEL left open (price ×3.7 across a demerger; needs official terms). | ✅ |
| 286 | "History is loading now and will finish overnight — what history is this?" Next (M2 readers: balance sheet + cash flow first, then PIT, SAST, ratings, board meetings): "OK". | Explained: market-structure data 2024 → today, already stored in R2, being loaded into D1 tables day by day (not a download). Claude's "overnight" estimate was wrong (from one partial run): measured 14:51 IST — F&O OI and ban list complete (704 days), price bands 418/704; ≈ 1–2 h left. Starting balance sheet + cash flow. | ✅ |
| 287 | "Ignore code in previous AI generated response." (sent twice, around a session restart) | Ambiguous; asked. Owner: "Code was in AI generated stock specific answer it contain code which I asked to ignore, not your code" — i.e. the code remarks in V1's pasted answer (excise fix, Hindalco/Novelis card) are ignored; none of it was used. V2 work continues. | ✅ |
| 288 | Quoting Claude's estimate note: "One task is pending from M1 and you are moving to M2, is it automated already running?" Plus a pasted AI analysis of UEL (insolvency resolution plan mislabelled as demerger; claimed 666:1 capital reduction; prices ₹6.95 → ₹25.55) and a ledger restating the other six decisions, with a code block. | Yes: market-structure history loads automatically (F&O OI, ban, price bands, bulk done; block in progress; short next) and the 10-session count runs from the scheduled check. Found and reported: 480 of 704 bulk-deal history days hit the API cap (flagged). UEL: code ignored (#287); claims tested — core claim (NCLT resolution plan) confirmed by independent sources; the paste's prices and capital-reduction timing contradict NSE data (₹43.80 → ₹160.95; reduction before the April 2024 relisting) → decided as a series break (D146). Test 6 queue now empty. | ✅ |
| 289 | "Go ahead with the PIT and SAST readers" … "readers for insider trading, takeover disclosures (SAST), credit ratings and board meetings … Go ahead." | Format check found the per-company PIT/SAST/board-meeting/corporate-action/governance lists capped at the latest 20 rows (BRSR 1): history mostly missing (C40). Full history queued first (D149; 8,189 calls), readers built and deployed (insider trades, SAST, board meetings, credit ratings; real-file tests incl. NSE's duplicate rows). | ✅ (loading) |
| 290 | "Go ahead with the checks and sector map" (counts vs NSE, restatement + basis rules on known cases, sector map for review). | Sector map drafted (`docs/sector-map.md`, 8 ⚑ for the owner). Restatement + basis rules built and tested on known cases (D48: 4,440 values relabelled restated, 19 changes > 0.5% flagged so far). Count check vs NSE booked for 18:04 IST, when the full PIT lists are loaded (INFY not loaded yet). | ✅ count check passed (#314) |
| 291 | "Sector map approved, go ahead with all 8 as proposed, let sector map get built continuously as you mentioned, hope you have done provision to record it. We will finalize it once we have the full list ready. My suggestion is let's download from BSE also, it's a one-time job and together we can build a better one." | D150: map v1 approved with all 8 ⚑ rows as proposed; stays provisional until the full value list is collected. Checked the provision: sector history from the index CSV is already recorded daily (`classification`, D121), but the announcement-map fill, the map table and the new-value review were **not built yet** — built now: `sector_map` (approved v1), `industry_seen` (every ISIN × smIndustry with first/last sighting from all stored announcement lists, 2024 →), daily classification rows (index CSV first; announcement map for the rest and for the time before the first index snapshot), new values → `unmapped` and listed on `/sectors` with the map-vs-index agreement. BSE: API answers 403 Access Denied from this container (as from GitHub and Cloudflare, D120); not worked around → BSE only via V1's stored files (#292) or a one-time owner-machine run. | ✅ built (BSE via #292) |
| 292 | "Ok can I ask V1 to make a list and share one .md file etc? Give me a prompt." | Yes, with conditions (stress-tested): only rows from a file V1 actually downloaded (an AI-written list from memory would be invented data); CSV per source + short .md (a 5,000-row md table gets truncated); also ask for NSE's 4-level per-company classification if V1 stored it. Prompt given. Validation before use: match by ISIN; agreement with the NSE index-CSV sector on the 754 known companies. | ✅ closed (#294) |
| 293 | Owner relayed V1's answer to the #292 prompt: no stored BSE file (scrip list + `ComHeadernew` read on the laptop ~16 Oct; raw answers saved only from 30 Oct; BSE not fetched after 19 Oct); what survives is V1's D1 `companies` table — a derived joined string of BSE's four levels, some industries later filled from NSE; no face value or status. No NSE `industryInfo` (403). No 22-sector map (V1's `sectors.toml` maps to its own prompt groups, all AI-decided). Only raw industry data: announcement answers (one level) from 30 Oct. V1 offers a CSV built from those. Its .md sits in V1's session scratchpad (not readable from this session). | Verdicts (D142): **decline the announcement CSV** — V2 already holds the same NSE announcement lists from 2024 → (longer than V1's 30 Oct →) and reads them (D150). **Conditionally useful:** V1's `companies` table BSE levels, only if each row can be told apart as BSE-sourced vs NSE-filled; otherwise rejected (no provenance). If exported: match by ISIN, measure BSE sector vs NSE index sector on the companies already classified, use only as a second opinion for review items, never as the sector source. A raw BSE file remains possible only from a one-time owner-machine run. Follow-up prompt given. | ✅ closed (#294) |
| 294 | "V1 inputs for sector not required." | Closed: no V1 export (#292/#293 prompts withdrawn); BSE not pursued. Trade-off stated: the map is checked only against the NSE index-CSV sector on companies that have both (228 so far); the ~500 companies filled by the map alone have no second source — their sectors are labelled "from announcement industry" (D121) and the map is finalised on the measured disagreements (Construction → Realty, Steel → Capital Goods). | ✅ |
| 295 | "Good, go ahead with next item." | Next = M2 loader backlog → full-population readable rate. Found first: the filings loader had **stalled** (loaded flat at 40,004; BS/CF backfill never started though HANDOVER said "running") — 299 skipped jobs refilled every 300-job batch (C43). Fixed (skipped retried every 6 h); live 17:10 IST: loaded 40,895 (+891 in ~10 min), balance-sheet values 182 → 6,430, cash-flow 50 → 1,726. Sector stale-ISIN fix (C42) also confirmed: 207 of 256 recovered by symbol; 1,342 companies classified (750 index CSV + 592 map); the 49 left are suspended/delisted names (e.g. BALLARPUR, PUNJLLOYD). | ✅ (rate measured when the backlog is loaded) |
| 296 | "Good, go ahead." | M2 held classes. "Missing revenue+pat" (23) was all general insurers (GICRE, GODIGIT) — and the census showed every general insurer's Integrated Filing (61 files, 6 companies) has the same problem. Built the general-insurer template (C44): 56 of 56 IRDAI-layout files pass all 9 sums; the held ones reloaded (17:25 IST). Found a second insurer layout (Ind AS 117, STARHEALTH Sep 2026, 5 files): held and counted. Whole-population census re-run to prove no other file changes template (D134). Left in the class: 1 NBFC file (CONSOFINVT, PAT missing). Scale-guard class (60+): holds were judged once before their neighbouring quarters existed (C45) — ABCAPITAL's merger step held 5 quarters; now re-checked every 6 h; isolated unit errors (COROMANDEL ÷100) stay held. Census (D134, all 74,571 results files): exactly 56 changed template, all industrial → general insurance; no other file affected. | ✅ (scale-guard re-checks run as holds reach 6 h) |
| 297 | "Good, go ahead with next item." Then, asked how site v0 should be protected (Access / secret link / public): "Keep public". | Next item = M3 site v0 (M2 gate items wait for the backlog, ≈ 8 h). D151: site v0 public, unlisted. Stress-tested: overrides D13/D89 "public only after the quality gate and legal consult" for v0 content; open legal questions §12 Q3 (recent prices with stock names), Q5 (NSE data terms), Q11 (index data licence); figures public before the M4 gold set. Kept from D89: noindex + robots disallow + no sitemap, rate limits, bot protection; AI cards stay behind M7; owner-only data behind Access. Built and live 18:16 IST (`disclo-web`): dashboard, stock page, data-health; noindex/robots/rate limit verified on the live site. Performance (from the US container): stock API 290–560 ms uncached (cold data centre ≈ 1.2 s), dashboard 0.3 s, 4G phone LCP 0.75–0.82 s (one cold load 2.08 s); India measurement pending. | ✅ v0 live (perf from India pending) |
| 298 | "Hope you are designing website as we discussed." | Checked v0 against the agreed design instead of assuming: base follows D59/D62/D101/D105 (dashboard home, mobile-first, Lightweight Charts, sources on figures), but **6 agreed points were missed or wrong** and are fixed: light theme only (D100 — v0 had auto light/dark), chart logo off + credits page with the licence notice (D105), restated figures by default with an Original/Restated switch (D91 — v0 showed original), stock header with ISIN, 52-week range and as-of + sticky section menu (D91), "Data updated HH:MM IST" (D46/D114), legal pages: disclaimer, terms, privacy, credits, contact (D115, drafts until the consult). Still to build (need precomputed history): EMA participation, 52-week extremes, results-season tracker, calendar (D62/D67); stock page Key facts and 5-year annual view (D91 sections 4 and 6); 4-level sector (D8/D121: NSE one level only). | ✅ fixes deployed; rest listed |
| 299 | "Whatever I see as your v0 for website, I will rate it (-10)/10." | Accepted without arguing the score; Claude's own critique: v0 is a data check that looks like an admin page (tables first, no visual hierarchy, no Key facts, raw ₹ crore figures in long tables, one chart), and the process was wrong — D95 says UX standards and a design system were "still to be agreed" (§16) and Claude built before showing a design. Proposed D152: no more site UI code until the owner approves a visual design (mockups first); v0 stays only as the API/data check. Asked the owner for the worst thing and reference sites. Count check (trigger #290): not possible yet — event loader starved (C47, fixed: events now run first); INFY 20 of NSE's 2,199 distinct insider trades loaded; retry booked 21:10 IST. | 🔶 waiting for owner |
| 300 | "Don't worry about NSE price. I will manage it. NSE gives support to such start-ups in the early period… NSE is clear." "Before we move to website, is phase 0, 1 and 2 all items finished? Verified everything?" "Stock page is also not as we decided." "Work on Phase 0 to 3 first… so you can decide what, where, how before you put anything on website. Let's have all the data first." | NSE data/licence: owner-managed (D152; §12 Q5/Q11 no longer a build risk). Honest status given: **M0 done; M1 and M2 not done** — M1 tests 4 and 5 never verified, 10 sessions 0/10, bulk-deal cap gap, D138 re-run pending; M2: ≈ 60% of downloaded filings not loaded yet (RELIANCE, TCS, ITC have no financials), **no annual (FY) figures for any company**, 5-year coverage (D90) never measured (HDFCBANK starts 2022), event counts fail vs NSE (INFY 20 of 2,199; C47), BS/CF backfill not started, held classes open, 49,680 attachments queued. Agreed stock page (D91) not followed. D152: website work stops; data first — M0–M2 gates verified, then a data-readiness map for every D91/D62 element before any site design. | 🔶 working (order in HANDOVER) |
| 301 | "Take v0 offline, data first." | Done (D152): disclo-web's public address and preview links disabled, the 10-minute dashboard precompute stopped (no D1 writes), and an offline switch answers 503 + noindex to anything that still reaches it. Code kept and tested; not deployed publicly again until the data is complete and a design is approved. | ✅ |
| 302 | "Website is targeted to Youth, Gen Z population, MF houses, Family Offices, PMS etc.; such a design will straightaway go to rejection… no chance of investors for funding or even free subscribers. We discussed a lot on it, why don't you check everything once? Seems like lots of discussion is not saved in plan or to-do or any other documents." | Checked: all 74 owner messages of this chat (from 2 Nov 17:50) are in the log (#233–#301). Earlier chats' transcripts are not in this container; their log entries (#1–#232) record only: audience retail + institutions / investors, family offices, institutions (#62, #66, D22, D25), light theme, mobile-first, "best in class" (D95, D100, D101), design system + UX standards "still to be agreed" (§16). **Not recorded anywhere:** youth / Gen Z, MF houses, PMS, or any visual direction — either a log gap in an earlier chat (Claude's failure) or discussed elsewhere (V1 / another chat). Asked the owner to paste those discussions or restate them. D153 records the audience now; stress-test given: Gen Z (visual, simple, shareable, mobile) and professionals (dense, exportable, sourced, fast) pull opposite ways → layered design (D25) is the core design problem. | 🔶 owner to share earlier design discussion |
| 303 | "Check each and every discussion and make a separate document related to the website: everything we discussed, decided, planned, pending; give me a link to review. Check everything, don't assume anything." | `docs/website.md` compiled from the **full first-chat transcript** (#1–#227, read directly), this log (#228–#302), PLAN (D1–D153, §7.5, §8, §12, §14, §16) and HANDOVER; all 48 cited log entries verified against the log. **Finding: no mention of youth / Gen Z, MF houses, PMS or any visual style anywhere in the first chat** (confirms #302's gap). 6 conflicts/gaps listed in website.md §11. Consistency check also found D150 (sector map) missing from the design sections (pre-existing); §16 item updated. | 🔶 owner to review; design discussion to be re-shared |
| 304 | "Give me a detailed prompt, I will get it from a different chat window. Did you check all the documentation?" | Checked all 9 documents in `docs/` (10 with `website.md`): no youth / Gen Z, MF houses, PMS or visual direction anywhere — consistent with #303 (first-chat transcript). Recovery prompt given for the other chat window (audience, positioning, visual design, home, stock page, other pages, mobile/sharing, quality bar, anything else; verbatim quotes with dates; decided / accepted / rejected / open; output `disclo-design-recovered.md`). Data work continued: FY census done (15,282 of 18,169 March-quarter files pass, 84.1%; 2,812 FY22 old-format files lack a year-to-date context — next class) → FY loader deployed (D90). | 🔶 owner relays |
| 305 | "Don't only check my messages; your messages are also important. Many times you answered something and I replied ok, yes or anything; that must be recorded." | Re-read Claude's own messages in the first chat: 33 website proposals matched with the owner's reply → `docs/website.md` §10b. 27 were already recorded; **added now:** EOD label requirement, full card-design brief, 12-section card as starting proposal, shareable section links, no cookie banner for analytics, Cloudflare zone toggles + `www` record as launch-checklist items; name tests open. Build-chat transcript not available in this session (log only). | ✅ |
| 306 | "Check the build chat log for accepted proposals too." | Checked all 30 build-chat entries where the owner accepted something: every cited decision exists and is in PLAN's design sections (mechanical check). **18 accepted items that affect what the website shows** listed in `docs/website.md` §10c; 13 were missing from website.md (instrument scope, rights entitlements, one-level sector + labels, series breaks on charts, "not available" bank quarters, possibly-incomplete deal days, EPS rule, Screener later, coverage tiers, review screen later, snapshot reads, field catalogue, NSE licence owner-managed). Open: how to show coverage depth (tier 1 vs light) in the design. | ✅ |
| 307 | Owner relayed the other chat's report on accepted proposals (it can check only the first chat and this chat's log; "only that chat can confirm" the build chat). | Build chat checked from its own transcript: all **25 owner acceptances** here ("OK", "Yes", "Accepted", "Approved", "Go ahead", "Good", "Build", AskUserQuestion answers) paired with Claude's preceding message; every proposal in them is recorded (log #228–#306, D120–D153, HANDOVER, FMEA). Recorded outside the log only: Gemini advice (free AI Studio key for trials; the $20 consumer plan has no API key — PLAN/HANDOVER); site-v0 performance techniques (HANDOVER, FMEA C46). **Correction:** #290 quoted "Infosys's 835 insider trades" as the target for the count check — no source; NSE's dated list gives **2,199 distinct** INFY PIT rows since 2021, which the count check now uses. | ✅ |
| 308 | Design-recovery request (from the other chat's prompt): search this chat's full history for audience, positioning, visual design, dashboard, stock page, other pages, mobile, speed/quality, other website asks; quote verbatim with date/time; separate decided / accepted / rejected / open; no invention; output `disclo-design-recovered.md` + top-10 requirements. | `docs/disclo-design-recovered.md` written from the first planning chat's full history (owner quotes verbatim; per-message times not available, dates from the session, setup screenshots ≈ 22:26–23:06 IST 2 Nov). **Not found in this chat:** Gen Z / youth, MF houses, PMS, analysts; colours, typography, logo; visual reference sites; 'premium'; WhatsApp/X/Instagram specifics; lakh format; subscriber goals; Trendlyne/Tickertape/Moneycontrol/Koyfin comparisons. | ✅ |
| 309 | Owner shared `disclo-design-recovered.md` (from the other chat: the planning chat's full history, owner quotes verbatim, decided / accepted / rejected / open per topic; also committed as `docs/disclo-design-recovered.md`). | Verified here: repo copy identical to the upload; log intact after the other chat's merge-conflict fix (308 entries, each number once, no conflict markers). **Conclusion: youth / Gen Z, MF houses, PMS, analysts, colours, typography, logo, reference sites for the look, "premium", sharing channels, lakh format and subscriber goals were never discussed in any recorded chat** — the design brief needs the owner's input directly (design phase comes after data, D152). Two recovered items v0 broke: market cap "take round numbers" (₹ crore without decimals; v0 showed decimals) and "the page must say it isn't live" (EOD label). | ✅ |
| 310 | "You can discuss with other chat whenever you need any other inputs also." | Working rule added (HANDOVER). Other chat identified (session "1.0 V2 planning and mechanism"); coordination message sent: it owns `website.md` + `disclo-design-recovered.md`, the build chat owns code, migrations, deploys, PLAN data/build sections, HANDOVER, FMEA, field catalogue; the discussion log is shared and append-only (pull right before writing, next free number, push at once, rebase and renumber only one's own row on a clash). | ✅ |
| 311 | "Good, go ahead with next item." | Next per D152 order: verify the FY loader on live data; then the FY22 old-format class (2,812 March-quarter files without a year-to-date context); then 5-year coverage per company vs NSE lists (D90/D111). | 🔶 working |
| 312 | "Schedule every 15 minutes task and check for next 150 minutes." | 10 one-off check-ins booked (recurring schedules can't run more often than hourly): 20:00–22:15 IST every 15 min; each checks the filings rate, full-year loading + backfill, events cursor, the FY22 census and the write budget, then continues the D152 data order; the 10th summarises the 150 minutes and the overnight plan. Work since #311: FY loader verified live (307 filings with full year), backfill unstuck and storage read errors made temporary (C48), FY22 class found (contexts referenced but undefined, C4 for the year) — fix behind a switch, census running. | 🔶 running |
| 313 | *(Check-in work, owner #312)* | **FY22 full years** switched on after census (99.68% of 18,169 March-quarter files, 2,829 newly passing, 0 newly failing; backfill restarted, nothing deleted). **M1 Phase 1 tests 4 and 5 pass** (never verified before, #300): re-running dates changes 0 data rows; a rebuild from stored files is identical to production (8 sessions × 5 tables). Found and fixed C49 (day loaded without its delivery file never picked it up); production has 0 such days. | ✅ |
| 314 | *(Check-in 2, owner #312; closes the #290 count check)* | **Event counts vs NSE: 29 of 29 match** (INFY, RELIANCE, HDFCBANK, BAJFINANCE, POLYCAB, CDSL, KPITTECH, GRAPHITE, ANANTRAJ × insider trades, SAST, board meetings; NSE dated lists from 01-01-2021, identical duplicate rows collapsed — INFY 2,213 rows → 2,199 distinct = ours). Two one-row differences were the count's date filter, not data: POLYCAB trade 31-Dec-2020 disclosed Jan 2021; BAJFINANCE row with no trade date ("-"); over all dates 666 and 105 = NSE. Rule for the data map: insider-trade date filters fall back to the disclosure date. Event loader fully caught up (no event list after its cursor). | ✅ |
| 315 | "If you are worried about Cloudflare limits, go free as we have $10 budget for first month only. Ensure everything is done correctly, all line items even for financial statements (all three) are there like my other competitors giving." | D154: write cap 45M → 54M (the most $10 allows: $5 plan + 50M included + $1/M beyond; kept as a guard). Statements: stress-tested the source — results XBRL carries SEBI's results format (full P&L each quarter; balance sheet and cash flow only in half-year and annual results); V2 maps only ~30 P&L, ~25 BS and 6 CF lines today. Plan: census of line items in real files by template, full maps with identity checks, gap list vs competitors (Screener summary + breakdowns; Trendlyne/Tijori near-full statements), naming what NSE's files can't give (annual-report notes are PDF). | 🔶 working |
| 316 | "If we are worried about cap, why don't we start with Nifty 50, which was the original plan? Slowly we will add more stocks and stay under Cloudflare limits. If you need more stocks as sample take Nifty Next 50 and Nifty Midcap 150: 250 stocks, enough sample size." | Agreed (D155), with one refinement: D1 loading limited to the 250, but reader checks keep reading every stored file (census writes nothing, so readers stay proven on all ≈ 75k files); market data and events stay full-universe; nothing deleted. Trade-off stated: sector pages and the results-season tracker wait for widening. Built: `FOCUS_INDICES` filter on the filings loader and backfill (test). | ✅ |
| 317 | "But it will ensure output quality, we will be able to freeze everything first, so no unnecessary Cloudflare or even AI usage." | Agreed; "frozen" defined as the D155 widening gate: every M1/M2 gate verified on the 250, readers locked (changed only after a full-population census), no AI usage before then. Focus live: 258 symbols (250 companies + former symbols). | ✅ |
| 318 | "This will ensure our learnings are applied to the wider universe once we are ready, else we will be digging holes and unable to finish everything." | Agreed; made concrete: every fix leaves an FMEA rule, a real-file test and (where it applies) a full-population census check, so fixes made on the 250 are already proven on every stored file. Widening checklist added to HANDOVER (gates on the 250 → re-run all censuses, 0 newly failing → widen in steps 250 → top 500 → ALL with the same checks → budget projection each step). | ✅ |
| 319 | "Good, other items like market statistics, index etc will be done with 250 stocks. Just Q, how many years of history we downloaded? Our starting point vs what is mentioned in docs?" | Measured: downloads match the plan — prices/MCAP/delivery/index closes from 2 Jan 2024 (D2; MCAP Feb 2024, D6); market structure Jan 2024 → (bulk/block 70-row cap on 480 days); ASM/GSM, FII/DII from 3 Nov 2026 (no NSE history); results + shareholding XBRL for periods from Apr 2021 (D90 5 years ≈ 5.6 y); PIT/SAST/board meetings/corporate actions/ratings Jan 2021 → (D149); announcements Jan 2024 →. NSE has more: XBRL from ≈ Sep 2018 (INFY results list back to 2005 without XBRL), older-format price files back to the 1990s. Gap flagged: prices < 3 years vs "valuation vs own history" (D62/D91) and competitors' 10+ years. Recommended: prices to 10 years (2016 →) for the 250 (≈ 625k rows), statements stay 5 years. Market statistics on the 250 will be labelled "focus 250"; index levels/P/E come from NSE's files unchanged. Asked the owner. | ❓ owner: extend prices? |
| 320 | "Basically the entire website will be ready for everything except the stock universe will be 250 stocks. No more historical data download related to stocks. For indices etc you can download 10 years history; use yfinance if NSE takes more time or requests. Financial statements: are we following Ind AS or something standard? In financial statements there is one head or row and sub-rows under it. If needed visit any stock page on screener.in or other websites." | D156: site for everything on 250 stocks; no more stock history (gap vs Screener's 12 years stated); indices 10 years from NSE's daily index file (checked back to Jan 2016, includes P/E, P/B, yield) instead of yfinance (no valuation fields, not all indices, Yahoo terms) — yfinance fallback only. D157: statements follow Schedule III Div II/III/I, Banking Regulation Act Third Schedule, IRDAI; shown as heads with sub-rows (Screener INFY page checked: Sales+, Expenses+, Borrowings+, Other assets+, CFO+… plus derived OPM %, tax %, FCF, CFO/EBITDA, days, ROCE). | ✅ |
| 321 | On extending stock prices to 10 years: "NO. Let's freeze it what we have, prove everything first. It's hardly a few hours' job to download more data and I am ready to skip it now. I would suggest go line by line from docs and decide what to do instead I give instructions." | D158: no 10-year stock prices; `docs/worklist.md` built line by line from §14 (M0–M3 gates), §16 still-to-verify, HANDOVER, website.md and FMEA — each line with source, status and next action; Claude works it in order and asks only for owner decisions. Index history (D156) stays unless the owner says the freeze covers indices too. | ✅ |
| 322 | *(Work list, D158)* | Closed: 1.9 (no price-affecting corporate action missing for the 250), 1.11 (scale-guard re-check works), 2.13, 16.3 (no Reg 31 API; pledges from SHP), 16.4 (RPT in standalone IF financials XBRL; PAN never shown), 16.6 (BRSR headcount fields). D154 deployed 21:01: P&L +17 lines, every reported BS line (census 99.58%), CF detail where all sums pass (first census 55.9%: fair-value adjustments are reported signed — fixed; re-census running), backfill restarted. | ✅ |
| 323 | "Your new D158 missing many items, check all the documentation, plan etc." | Agreed: the first list came mainly from §14, §16 and HANDOVER. Rebuilt `docs/worklist.md` as a full trace: every decision D1–D158 has a row (milestone, status, next action; checked mechanically — none missing), plus §5.8 feature table, §6 pipelines, §9.1 gates, §10 operations, §11 budget, the field catalogue (114 fields), website.md §10–§11 and open FMEA items. Newly surfaced in scope: D44 weekly D1 backup export (not built), D45 owner alert emails (only the cost guard exists), D50/D51 primary basis + basis-switch series breaks, D40 promoter groups, D47 segments, D49/D52/D66 computed views, §5.8 feature table, D146 series-break table, D117 security headers. | ✅ |
| 324 | "Backup is applicable when you have everything ready and OK." | Agreed: D44 backup job built and tested once (all 6 databases exported to R2, 12 rotating weekly slots); weekly schedule switched off until the freeze. The test run showed an export briefly blocks other queries (the detail census got HTTP 500 during it) — another reason to back up only a quiet, frozen system. Census re-run with more retries. | ✅ |
| 325 | "All these activities are being code only running, doesn't need download, why it is slow? Because of Cloudflare (GitHub)? Can it be done faster on GitHub (Cloudflare) or any way to speed it up? It seems dead slow. How about we combine all the documentation? It seems lots of different documents creating issues? Let's have one only covering everything without missing anything, group items if you want for your ease in reading next time." | **Slow:** the owner is right that it is not downloads; it is how processing was built — short Cloudflare cron runs (minutes, 60 s CPU), ~10 small D1 writes per file, several jobs sharing one run (index history gets leftover time: 17 days in hours). Proposed first: bulk loads on GitHub Actions with a one-step D1 import. Stress-tested before building: GitHub has no fast R2 access here (no S3 keys; one wrangler call per file), so it would be slower to build and run. Built instead in Cloudflare: index history reads 25 stored files in parallel and writes each 25 days in one D1 batch with one statement per day (the day's rows as one JSON value: ~26 queries instead of ~300), and runs before the sector job instead of after it (it had been getting seconds per run). Prefetch finished 21:15 IST, so it was never waiting on downloads. **Docs:** D159 — all 12 files merged into `docs/DISCLO.md` (8 parts), moved whole, every file verified byte-for-byte, old files deleted; the website chat told to write only Part 4. Consistency check found a real miss: check 4 had been reported as passing, but D153–D157 were in Appendix A only; they are now placed in §5.3, §6, §8 and §11. | ✅ docs · 🔶 index history speed-up deployed, measuring |
| 326 | *(Check-in 7, owner #312; 21:33 IST)* | **Cash-flow detail census after the sign fix: 94.0% of 31,207 files pass** (was 55.87%); BS 99.58%. Residual classes from the 1,873 failing files (read through a new read-only `/census?mode=cfgap`): A — older layout with undivided receivables/payables/provisions and extraordinary-item lines (590), B — tangible-asset capex spellings (504), C — direct-method cash flows (17), D — adjustments the company did not tag at all (≈1,240; the filed total exceeds its tagged parts, often by < 5%). A and B added (an undivided tag counts only when its split is absent, so never twice); offline replay: 565 more pass, investing failures 496 → 0, financing 339 → 5; full census re-running (D134). Index history 2016 → Nov 2018 (752 of 2,086 weekdays). Filings 64,573 loaded (+750 in 10 min), backfill at job 58,789, FY 2,104, BS 235,459 / CF 141,795 values; writes 31.3M of 54M. | 🔶 census running |
| 327 | *(Check-ins 8–10 + daily check; session down 22:00–05:15 IST, run 05:40 IST)* | Index history complete and verified (see Part 1). CF detail census 95.81%, 0 newly failing (D134). Daily check: M1 count 1/10; found C51 (failed slot never retried → fixed), C52 (weekend index sessions missing → download + loader), **C53 (NSE's insider-trade list has nothing after May 2026 → source to find)**; check moved to 22:41 IST (it ran before the 22:00 load). New read-only checks: `/index-check`, `/fresh`, `/pit-files`, `failed_runs`. | 🔶 C53 open |
| 328 | "Why don't you check and compare a couple of them with screener.in?" (on the cash-flow residual a/b choice) | Agreed: a comparison against a second source is stronger than our own arithmetic. Screener's public page shows only the four cash-flow totals; sub-rows open on demand. Picking full-year failing files of large companies and comparing totals and sub-rows before choosing a/b. | 🔶 |
| 329 | Shared NSE's insider-trading page; then "https://github.com/Pareshking/NSE-BSE-Insider-Tracker — check how they got insider trade data, repo is public." | NSE's page answers 503 to non-browser requests (not worked around). The public repo (read only, no code taken, #287): since **3 May 2026 NSE publishes insider filings on `/api/corporates-pit-gg`** (list of filings + one PIT XBRL per filing; the old `corporates-pit` answers an empty 28-byte list — exactly what our June/October all-company test returned). The list takes no date range (latest ≈2,000 filings), so history is built nightly; BSE's insider CSV is its other source, but it is reached through a disguised headless browser (bot-check circumvention) — not adopted. Probing `pit-gg` (latest + May date range) through our normal queue. | 🔶 C53 |
| 330 | "Run every new thing on GitHub and save the required data to Cloudflare, as GitHub is way faster. E.g. download insider data on GitHub and pass one file to Cloudflare?" | Agreed with one limit: downloads and parsing on GitHub, bundled into **one file per run** in R2 (one upload, not thousands — per-file uploads are what make GitHub→R2 slow), loaded by the Worker in batched writes; the same readers on both sides (Node runs our TypeScript readers on GitHub). Limits: NSE may refuse GitHub's addresses for some pages (the archive host works; the repo notes the API does too), and the D1 write cap still applies. First use: insider filings (pit-gg list + XBRL). | 🔶 |
| 331 | Pasted advice on NSE insider data (endpoint `corporates-pit`; proxies, cookie warm-up with a disguised browser, browser-header spoofing, self-hosted runner; BSE fallback). | Corrections: `corporates-pit` is the dead endpoint (proved: empty for June and October 2026); the live one is `corporates-pit-gg`, which our own fetcher already read (3,299 filings, 3 May → 3 Nov 2026). Not adopted: proxies to mask origin, disguised browsers, spoofed headers (bot-check circumvention). Acceptable if GitHub is refused: a self-hosted runner on the owner's own connection. | ✅ |
| 332 | Shared 30 Screener exports (Tata Motors PV, Union Bank, Mankind, Vedanta, Ambuja, Paradeep, Tata Power, NHPC, Bajaj Holdings, ABCAP, BEL, Hindalco, Power Grid, M&M, UltraTech, IOC, JSW Steel, Adani Ports, Adani Green, NTPC, Coal India, Grasim, ONGC, LIC, Bajaj Finance, Infosys, SBI, ICICI Bank, Bharti, Reliance): "may be helpful". | Compared full-year consolidated cash-flow totals FY24–FY26 with ours (NSE filings): **163 of 255 match to ₹1 crore as filed; 189 once Screener's convention is applied** (Screener adds the exchange-rate effect on cash to investing — INFY FY26: filed +1,946 cr + FX 1,600 = Screener's 3,546). Remaining differences: equal-and-opposite moves between sections (classification / later annual-report figures: Ambuja, Coal India, NTPC, Bajaj Finance, Bajaj Holdings), banks and LIC (Screener's Union Bank FY25–26 values are off by ~100× — Screener's error, not ours), Paradeep not in our 250. Screener's export has no sub-rows, so it cannot check the adjustment breakdown. Rule for the site: show NSE's filed sections; label any Screener-style view. | ✅ |
| 333 | "Add in to do: make a list of things we got from NSE and check that every daily update workflow is working, with evidence." | Added to the work list (Part 2): NSE inventory (dataset → endpoint/file → history range → daily workflow) + evidence per feed (last run, newest row date within N days — the check that would have caught C53). | ⬜ |
| 334 | "How on earth is it possible that companies file PDF but no XBRL … NSE itself uses XBRL for their data services, so it's impossible not to have revised XBRL." (+ "Coming to restated, did you compare two results and verify the PDF?") | Partly right, checked on evidence: revised XBRL exists (BSE FAQ Nov 2025 Q11; Union Bank Q4 FY26 revised 29 Sep 2026, remark stored) and is downloaded; but no results XBRL carries prior-year columns (74,571 files; Union Bank's 45), and Union Bank filed no revised FY25 XBRL although its FY26 PDF shows regrouped FY25 cash flows. FMEA C55; revision check widened to every line, statement and period kind. | ✅ |
| 335 | "Keep in mind we are going live with 250 stocks; remove stocks whose name starts with DUMMY, they are for corporate actions. Let's focus our energy on finishing the tasks we decided in the unified document." | DUMMY… symbols taken out of the universe and marked 'other' (stored rows kept, #282). Working the Part 2 list in order for the 250: probe schedule removed, D156 closed, insider load (C53) and revision checks finishing; next 1.8 bulk/block split, D146 series-break table, D50/D51 primary basis, 2.8 shareholding counts, D157 layout. | 🔶 |
| 336 | (Angry) Claude used the owner's Cloudflare unnecessarily. | Correct: measured by the cost guard — charges $0.03, but 24.2 of 25 billion included D1 reads used, ≈ 20 billion by Claude's own diagnostics and polling (FMEA C56). Fixed the queries, added indexes, stopped polling; rules recorded in C56. | ✅ |
| 337 | "Update documentation and write a handover prompt, I will get it done from ChatGPT." | Part 1 build state 09:15 IST, work-list statuses and a copy-ready handover prompt written in Part 1. Corrected the quoted status: the revision pass failed on a duplicate-key conflict (figures stored under both labels), now fixed and moving. | ✅ |
| 338 | Asked for a read-only, file-by-file audit (D1/R2 cost, plan drift, re-download bug, idempotency, robustness) with a phased plan, no code changes. | Audit delivered 10:15 IST: reads come from re-scans, not re-downloads (FMEA C57); hotspot table, drift list, P0/P1/P2 roadmap. Pushed back: the "re-download" framing is wrong, R2 is not the leak, the header rule and the universe scope conflicted with the live code |
| 339 | "Share report link so I can download it directly." | Report published as a private claude.ai page and sent as an HTML file |
| 340 | Approved the audit; locked three decisions (browser-session headers with cookie re-warm; new downloads only for the 250; `fin_value` key change deferred) and ordered P0 then P1, each tested, deployed and verified. | D160, D161, D162, D163 recorded; P0 built (Part 1 10:45 IST). Claude's note on D160: a terms-of-use point for the legal consult (§12); its code change goes in P1, not in the cost deploy |
| 341 | Approved Stage 1; ordered Stage 2 with five directives: merge PR #1 yourself; no manual STATUS_TOKEN (reuse the ingest token or keep pages closed; cached counters for /status); keep the ProwessIQ PDF in docs/ as a reference for D157; raise the write cap to 62M with a zero-mass-write rule; implement the D160 browser session fully. | PR #1 merged; D164 (62M, with the cost note: up to $12 of writes above 50M), D165 (ops workflow, no standing token — the ingest token is rotated per run and cannot serve as a status key); PDF recorded as an approved owner reference; P1 built (Part 1 11:40 IST), FMEA C58 |
| 342 | Approved the three catches; $25 ceiling for the November billing cycle only (back to $10 next cycle); two-tier write caps (soft 60M: optional passes stop; hard 68M: live daily filings + events continue); zero-mass-write rule and D162 deferral stay; ops workflow and counter-based /status approved; same-origin for the API host, same-site for nsearchives approved; merge, deploy, report. | D166 (replaces D164): caps in code, revert automatic from December, cost-guard alarm $20 for this period only. PR #1 was already merged (#341) |
| 343 | Restart the deals CSV refill and the remark and version passes now via ops (focus companies only), with a first-batch cost gate (record rows read/written of the first call; continue only if cheap and below the 60M soft cap); cash flow untagged adjustments: option (a), review when the three totals do not reconcile; fin_value key change stays deferred; keep the 20:30 IST and 24 h checks tracked without blocking; then Part 2 items 1–6 in order, one at a time, verified and reported. | D167; metering on /maint (also charged to the budgets), ops max_calls, focus version pass; item 1 built (feed_fresh, /fresh without scans, insider count check). Gate results and item 1 numbers in Part 1 |
| 344 | Coverage floor 2024-01-01: missing statements before it are not required or chased (nothing deleted; clean pre-2024 rows kept); D145 not relaxed for the 222 old bank files; merge PR #8 with reloads only from 2024-01-01; apply the floor to coverage_gap, report the post-2024 gap count, fix those classes; then Part 2 items 3–6. | D168; loader excludes pre-floor files not yet loaded (so the C59 retries reload only ≥ 2024 files); coverage_gap floor (filings 0037 marks older rows out of scope); `/coverage-gaps` reports active vs out-of-scope; PR #8 carries both |
| 345 | "Don't take half yearly files to generate 3 month report. It's wrong." | D169 narrowed: a quarter is loaded only from a file's own 3-month column, never derived from a half-year; derivation removed from the loader and the one-off; filings 0038 deletes rows written by it since deploy 130; half-year files without a quarter column stay listed as gaps | ✅ |
| 346 | "We only use XBRL for correct period, not doing by substraction or additions from other quarter results." | D169 widened to every stored period figure: only the XBRL context for that exact period; no subtraction or addition across periods. Code checked: no such path remains after PR #12 (parts-equal-total checks never write values). Open question for computed views (item 6): TTM (D38, D52, D66) is a sum of four quarters — shown as a labelled metric, never stored as a period, pending owner → **resolved by #348: blanket ban** | ✅ |
| 347 | "Zero derivation of financial facts": quarters only from a filed 3-month column, full years only from a filed full-year column; never Q1+Q2+Q3+Q4; missing → gap; schema, loaders and passes must forbid derivation; every `fin_value` number has direct XBRL/PDF evidence. | D170. Audit: every loader insert stores one XBRL fact for that exact period (`reported`); the only derived path ever written was H − Q (q-from-h-v1, removed in PR #12). Full year from Q4 and year-end half-year files reads their own year-ended column; no code sums quarters. filings 0038 now deletes every `computed` row; filings 0039 adds insert/update triggers refusing any origin other than `reported`/`extracted`; test added | ✅ |
| 348 | "blanket ban. We already have XBRL for quarter and year, if those are missing we will download it later" | TTM (sum of four quarters) banned outright, stored or shown (D170). D38, D52, D66 and the feature-table `*_ttm` columns lose their TTM base; proposed replacement = latest filed full-year column, pending owner. Missing quarter/year files stay gaps until fetched; nothing is filled by arithmetic; moved to the to-do list as pending, later (#349) | ✅ |
| 349 | "TTM : add it as pending items for later in to do" | Part 2 row "TTM — pending, later" (⏭): TTM stays banned; the TTM-based rules and feature columns are not built until the owner decides | ✅ |
| 350 | "Ok, Keep TTM. As it is being used multiple places as you mentioned" | Reverses #348/#349: TTM kept for D38, D52, D66 and the feature columns, as a computed view only — four filed quarters, same basis, never stored in `fin_value`; unavailable when any quarter is missing (no substitute). D170 stored-fact rule unchanged | ✅ |
| 351 | "go ahead, fix COFORGE and continue with the gaps, download only missing XBRL if needed." + all four half-year filers released quarterly results | COFORGE Q3 FY26 moved from Nucleus Software (C61). Checked COFORGE Mar 2025 "half-year" file: its 6-month-dated column holds Q4 FY25 figures (revenue ₹3,410 cr) — filer mis-tagged the dates; relabelling proposal put to the owner (C62, not built). 404 class: 16 standalone XBRL files failed once with 404 and were never retried; `/maint/requeue_404?jobs=…` re-queues named failed-404 focus jobs once for the next attachment run | ✅ |
| 352 | "Ok" (to relabelling proven mis-tagged half-year columns as quarters) | C62 built: relabel only on proof (earlier filed quarters + this column = the file's year to date, core line and PAT, ₹1 lakh); values untouched; D169/D170 unchanged — nothing is computed into `fin_value`. 404 class: the 18 re-queued files 404 again (NSE does not serve them) — those 12 standalone gaps stay | ✅ |
| 353 | "Ok, do both" — (1) release scale-guard holds that pass the in-file EPS check; (2) place SIEMENS Q2 FY25 as the Jan–Mar 2025 quarter when its "Quarterly" label and the C62 proof agree | C65 built; the 5 holds and the 2 SIEMENS files re-read | ✅ |
| 354 | "After this let's accept the gap and move to next item" | Item 2 closed: 25 remaining gaps (10 companies) accepted with reasons (Part 1, 5 Nov) | ✅ |
| 355 | "Item 3, bulk/block deals … Ignore it and keep it at last before we expand universe" | Item 3 moved to the end of the work list, before the universe expansion (checked 4 Nov: 0 capped days); next item 4 | ✅ |
| 356 | "Short selling has 304 days at the same 70-row cap … Add it also in last" | Added to the end of the work list with the bulk/block sign-off, before the universe expansion: find an uncapped short-selling source for the 304 capped days | ✅ |
| 357 | "Anything missing will be noted and we will move forward" | Item 4 run on all 250 (5 read-only calls): 2,820 of 2,824 loaded; the 9 missing and 3 companies without a list noted in Part 1, not chased; next item 5 | ✅ |
| 358 | (asked: the nightly feature table stores P/E TTM, ROE, EBITDA margin; #350 said TTM is never stored; computing live costs ≈ 120k rows per search) "Keep TTM stored" | D171: computed values (TTM, ratios, D66) are stored in the feature table only, labelled `computed` with their inputs, rebuilt after each load and nightly; `fin_value` stays filed cells only (D170 and its database triggers unchanged). Item 5 closed with its gaps noted (bank / insurer cash-flow detail, insurer balance sheet, NBFC revenue lines other than interest and fees); item 6 started: computed views as tested functions (`packages/core/src/views.ts`) | 🔶 |
| 359 | (on the next five tasks) "Last-before-expansion item (a) … item (b) … will be parked for longer, will come back once site is live." | Bulk/block sign-off and the uncapped short-selling source parked until the site is live. Raised: the 304 capped short-selling days must be labelled partial (or left out) on the site meanwhile. Next: verify INFY P/E after the standalone fix (PR #34), then item 6 gaps (insurer revenue base, P/E history), then item 5 leftovers (bank/insurer cash-flow detail, insurer balance sheet, NBFC revenue lines) | ✅ |

### Consistency check procedure (run after every update)
1. Every decision ID D1…Dn appears exactly once in Appendix A, in order, with no gaps.
2. Every log entry 1…n is numbered once, with no gaps.
3. Every D-reference in the log and the plan points to an existing decision.
4. Every decision is reflected (by ID) in the design sections §1–§16, not only in Appendix A.
5. Open items in this log match §16 of the plan.
6. Conflicting owner answers are flagged ⚠ in both documents until resolved.
*Last run 2026-11-05 after entry #359: all checks pass (171 decisions, 359 entries); owner reference files in `docs/` (not part of this document, not checked): the ProwessIQ data dictionary PDF (owner #341); no open ⚠ in the decision log (website conflicts listed in `docs/website.md` §11).*

### Open items from this log
*(Mirrors PLAN §16; aligned 2026-11-02, #237.)*
- **#241** Build: M0 done; M1 history loading; M2 loading (see PLAN §16 build status).
- **#284** M1: market-structure loaders; M2: PIT/SAST, ratings, board-meeting readers, balance sheet + cash flow, known-case tests, classification CLI; M3: site v0 (see HANDOVER).
- **#240** Owner reviews the `smIndustry` → 22-sector map when drafted (M0).
- **#239** Trademark check for Disclo (IP India search + filing), owner.
- **#35/#72** Card sections after real output (D25).
- **#206/#224** Remove the probe's 3×/day schedule after ~2 days.
<!-- END docs/discussion-log.md -->

