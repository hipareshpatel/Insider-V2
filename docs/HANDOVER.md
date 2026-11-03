# Handover — start of next chat (written 2026-11-02)

**Repo:** `hipareshpatel/Insider-V2`, branch **`ccr-eb822347-c3zp4b`** (only branch). All documents are in `docs/`.

## Build state — hourly update 2026-11-03 08:52 IST
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
| 3 | **10 consecutive clean daily sessions** (from 2026-11-03): scheduled check weekdays 21:43 IST (also verifies item 2 live) — count: 0/10 | M1 | 10 sessions, no manual fix |
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
| Still to verify (no download yet): SAST Reg 31 endpoint; RPT data location; insider-feed completeness | open (§16) |

**Pending by milestone (owner #284):**
- **M0 — signed off (D143).** Left: remove the probe's 3×/day schedule (≈ 4 Nov). Review screen (B5) moved to M3.
- **M1 — market data.** (1) 10 clean daily sessions: 0/10, checked weekdays 21:43 IST (non-blocking, D143). (2) **Load market-structure data into D1** (downloads done; readers not built): bulk/block/short (flag 70-row days), participant OI, ban list, price bands, ASM/GSM, FII/DII. (3) Phase 1 test 6: **queue empty** (UEL decided 15:40 IST as a series break, D146: insolvency resolution plan). Tests 1–3 pass. **Gap:** 480 of 704 bulk-deal history days hit the API's 70-row cap (flagged; complete daily files from 2026-11-03) — to test: splitting the history API by symbol. (2) loaders **built and live** (D148): history loading source by source (14:51 IST: F&O OI + ban complete, price bands 418/704; deals/short next; ≈ 1–2 h); progress in market `/status` → `market_structure` (days, missing, possibly-truncated).
- **M2 — filings & financials.** (1) Readable rate on the whole population (99.66% on 36.9k so far; loader finishing the backlog). (2) **Readers: PIT/SAST, credit ratings, board meetings** (data downloaded). (3) **Balance sheet + cash flow** lines (canonical model; today only P&L is loaded). (4) Restatement / basis rules tested on known cases. (5) Classification CLI once + `smIndustry` → 22-sector map for owner review (D121, #240). (6) Held classes: ~40 scale-guard outliers (need a second source), 14 "missing revenue+pat", 10 pre-2024 BSE shareholding.
- **M3 — site v0 (not started).** API Worker + public site: dashboard, stock page (market + financials sections), data-health page (incl. the review queue screen, B5); adjusted prices honour series breaks (D146); performance targets (TTFB ≤ 200 ms cached; stock page ≤ 2.0 s on 4G; API p95 ≤ 300/800 ms); noindex + rate limits.
- **Owner:** trademark check for Disclo (pending). ✅ email test working; ✅ Cloudflare budget alert $5 set (#285). Claude shares the `smIndustry` sector map when drafted.

**Storage (owner #278):** 0 PDFs; 24.4 GB raw XML/JSON, 11.7 GB in R2 (newer objects gzipped); keep originals and never delete them (owner #282); after compression ≈ 3 GB, ≈ +0.5 GB/year → ≈ 8 GB in 10 years (free tier 10 GB; beyond that ≈ $0.015/GB-month).
**V1 hints adopted later (D142, #276):** profit ÷ EPS implied share count as a split/bonus cross-check + no double adjustment when filings restate comparatives; owners vs minorities test; excise duty separate; filler zeros in annual-report XBRL. **Test gap:** stale-Bc rule (C28) needs a multi-day test.
**Parked (counted, not chased, D140):** 16 stock jumps and ETF unit-split proposals → owner queue; scale-guard anchor class; R2 compression; probe schedule removal (≈ 4 Nov); Workers CPU check (≈ 5 Nov); D1 reads re-measure (≈ 5 Nov).
**Owner:** review-screen access choice (item 1); Budget Alert $5 (optional); trademark check; email test (last).

## Morning summary — 2026-11-03 06:00 IST
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

## Build state (updated 2026-11-03 03:55 IST)
**Running on Cloudflare (production unless noted):**
- `disclo-market` (cron every 2 min) + `disclo-market-staging` (every 10 min, recent dates only): daily market job. Status: `https://disclo-market.financialengineer-in.workers.dev/status`, `/acceptance` (Phase 1 checks), `/reviews`.
- `disclo-prefetch` (cron every minute): raw NSE API lists for every company → R2 `api/…`; discovers XBRL attachments; `/status`.
- GitHub `prefetch-archive` (done: 2,995 archive files 2024→today in R2 `cache/`), `prefetch-attachments` (running: XBRL → R2 `att/` via `/ingest`).
**Databases:** 12 D1 (6 domains × prod/staging), migrations in `db/migrations/<domain>`, applied by `db.yml` / `deploy-market.yml`.
**Key rules added tonight:** D125 (row-level gate tolerance), D126 (fund units out of universe), D127 (store everything), D128 (front-load downloads), D129 (share-count review threshold), D124 adjusted (2 parallel from Cloudflare).
**Known NSE quirks handled:** 403 for some missing files; PR bundle under the wrong date (PR060424 = 4 Jun files); ETFs in EQ series; bond purposes in Bc; truncated purpose text.
**Maintenance:** to reset market data, first apply a pause migration (`INSERT … job_lock 'paused'`), confirm `/status` shows no `running_lock`, then the wipe migration (which lifts the pause). Never deploy the market worker during a long backfill unless needed (a deploy interrupts the current run; it resumes safely).

## Read first, in this order
1. `docs/PLAN.md`: the consolidated design. Decisions D1–D137 are in Appendix A; live NSE evidence is in Appendix B.
2. `docs/discussion-log.md`: every owner statement (#1–#227), mapped to where it's recorded, plus open items.
3. `docs/field-catalogue.md`: query fields (v1).
4. `docs/setup-guide.md`: owner's Cloudflare/GoDaddy/GitHub setup steps.

## Working rules (owner's instructions)
- **Build started 2026-11-03 (D122):** owner said "Build". M0 → M1 in §14 order. Overrides of owner decisions are allowed "for better" but always logged and reported; money/time/legal items are asked.
- **Clean-slate rule:** never use or reference V1 code, data, outputs or designs. *Single exception below.*
- **Never delete anything already downloaded (D147, owner #282):** no expiry or pruning of R2 originals; compression only after a byte-exact verify.
- **Downloads always run ahead of need (D144, owner #278 — remember this):** whenever a source a later milestone needs is not downloading, verify its path and start it now, one at a time, in milestone order; keep the pending-downloads list below current at every hourly update.
- **When stuck, ask V1 (D142, owner #275 — remember this):** if an item reaches the D140 limit (two cycles) or ideas run out, write a short prompt for V1 (methods/sources, not code); the owner relays it and pastes the answer; Claude validates it on V2 data and adopts or rejects it, recording why. Full freedom on the decision.
- Log **every** owner statement in `docs/discussion-log.md` **in the same turn**; record decisions in `PLAN.md` Appendix A **and** the design sections.
- Run the consistency check after every update (procedure at the end of the discussion log) and report the result.
- **Public CI logs:** this repo is public, so Actions logs are public. Never print `wrangler whoami`/account names/emails unmasked (see `infra-check.yml` mask).
- Ask the owner wherever a decision is theirs; stress-test ideas before agreeing; never put secrets or personal emails in the public repo.

## State of setup
- Domain **`disclo.in`** on Cloudflare (active; DNS cleaned). **Workers Paid active from 2026-11-03.** The public launch name may still change (D99).
- Email Routing: `info@`, `alerts@`, `paresh@disclo.in` → owner's Gmail. **Test email working (owner #285).**
- Workers subdomain `financialengineer-in.workers.dev`. GitHub secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` set.
- `.github/workflows/probe.yml`: deploys, calls and deletes an NSE probe Worker (Cloudflare reachability only; quote-equity/BSE checks removed #240). Runs manually + 3×/day. **Turn the schedule off after ~2 days** of consistent results.
- **Probe result:** all pipeline NSE sources reachable from Cloudflare; only `quote-equity` (sector classification) is 403 → D8 (owner's machine) stands; the D54 relay isn't needed.

## Open items for next chat
1. ~~Sector classification~~ **Decided D121 (#239): NSE index CSV sector + announcement `smIndustry` fill (accepted #240).** *History:* quote-equity from GitHub: the owner says it worked in repo **`hipareshpatel/Insiders`** (V1). **Owner permits reading ONLY the code that fetches NSE `quote-equity`/sector classification, to learn the method (library/endpoint/headers). Do not read, use or reference anything else in that repo.** If it works, D8 can move to a GitHub scheduled job. **Done 2026-11-02 (#228):** method recorded in PLAN Appendix B; replicated from our runner (#230): **403**, homepage too (IP-range block). V1's own run was also 403 (#231). **Owner chose BSE `ComHeadernew` (D120, provisional)**; BSE also **403 from GitHub and Cloudflare** → owner's machine either way; owner to decide machine run, taxonomy, NSE-only fallback.
2. ~~Extend the probe to structured-filing endpoints~~ **Done (#234): all 200 from Cloudflare.** Rate limits at volume to measure in M0.
3. Review scheduled probe runs; then remove the schedule.
4. Field catalogue approved (D123). Owner: trademark check for **Disclo** (final name, #239); email test last.
5. ~~Provisional decisions D38, D39~~ **confirmed (#236)**; unlisted entities get no public pages at launch (#238). Unresolved: licence funding (D88 option D chosen; vendor quotes recommended).
6. Card sections after real output (D25). Then, on the owner's "build", start **M0**.
