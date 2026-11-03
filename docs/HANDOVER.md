# Handover — start of next chat (written 2026-11-02)

**Repo:** `hipareshpatel/Insider-V2`, branch **`ccr-eb822347-c3zp4b`** (only branch). All documents are in `docs/`.

## Build state — hourly update 2026-11-03 08:45 IST
| Area | State |
|---|---|
| Market history (compact, D130) | reloading from R2: 657 sessions to 2026-08-24, 1.82M price rows; was stuck 08:27–08:40 at 2026-08-17 (row-count gate cascade, FMEA C14, fixed + simulated on 87 sessions); reviews 204 open (36 bc_unparsed, 168 corp_action); finish ≈ 09:15 |
| Write cap (D136) | 45M billed D1 rows per month (owner #268); **24.6M used** (Cloudflare analytics baseline, D1 counts index writes); daily price job exempt |
| Download ledger (D135) | one row per URL, done only after the R2 write; market write-through to `cache/`; ledger keys repaired (2,608); failures: 875 final 404s, ~270 403s retrying; "duplicates" = identical empty API answers, not re-downloads |
| XBRL attachments (D128) | 164,091 downloaded (18.7 GB raw), 50,776 queued (GitHub job) |
| Results + shareholding (`disclo-filings`, M2) | 8,082 filings loaded (137,722 result values; 3,026 shareholding patterns), 50 held, 114 waiting for market identity |
| Old-GAAP aliases | gated to old-GAAP files (D135); `/census` over every results file running (41k+ done) |
| Tests | 168 pass; consistency check passes (136 decisions, 268 entries) |

**To-do (ordered):**
1. When the reload catches up (≈ 09:15): first index snapshot → Phase 1 test 2; `/acceptance`; D1 size (infra-check).
2. Census result → confirm aliases fire on 0 Ind AS / Integrated Filing files; failure classes of the results reader by count (D134), fix by class.
3. **Daily discovery of new filings** into the same ledger (D135 gap: nothing filed after 2026-11-03 is queued yet).
4. Scale-guard class: a single outlier anchor holds 8 later quarters (see `/status` review reasons) → compare with neighbouring quarters in the whole-series pass.
5. Read rule for M3: one value per period/basis/line (original), later uploads as versions.
6. Compress older R2 text objects (D131) — optional.
7. Remove the probe's 3×/day schedule (≈ 4 Nov).
8. Owner: trademark check for Disclo; email test (last).

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
1. `docs/PLAN.md`: the consolidated design. Decisions D1–D136 are in Appendix A; live NSE evidence is in Appendix B.
2. `docs/discussion-log.md`: every owner statement (#1–#227), mapped to where it's recorded, plus open items.
3. `docs/field-catalogue.md`: query fields (v1).
4. `docs/setup-guide.md`: owner's Cloudflare/GoDaddy/GitHub setup steps.

## Working rules (owner's instructions)
- **Build started 2026-11-03 (D122):** owner said "Build". M0 → M1 in §14 order. Overrides of owner decisions are allowed "for better" but always logged and reported; money/time/legal items are asked.
- **Clean-slate rule:** never use or reference V1 code, data, outputs or designs. *Single exception below.*
- Log **every** owner statement in `docs/discussion-log.md` **in the same turn**; record decisions in `PLAN.md` Appendix A **and** the design sections.
- Run the consistency check after every update (procedure at the end of the discussion log) and report the result.
- **Public CI logs:** this repo is public, so Actions logs are public. Never print `wrangler whoami`/account names/emails unmasked (see `infra-check.yml` mask).
- Ask the owner wherever a decision is theirs; stress-test ideas before agreeing; never put secrets or personal emails in the public repo.

## State of setup
- Domain **`disclo.in`** on Cloudflare (active; DNS cleaned). **Workers Paid active from 2026-11-03.** The public launch name may still change (D99).
- Email Routing: `info@`, `alerts@`, `paresh@disclo.in` → owner's Gmail. **Test email pending** (owner will verify later).
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
