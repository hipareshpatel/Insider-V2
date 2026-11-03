# Work list — M0–M3, line by line from the documents (owner #321)

**Rule (owner #321):** Claude works through this list in order without waiting for instructions; the owner is asked only for decisions that are the owner's (money, legal, design, trademark). Scope: **freeze and prove what we have** — 250 focus companies (D155), no more stock history (D156, owner "NO" to 10-year prices). Each line: source → status → next action. Updated as items close.

Legend: ✅ done and verified (how) · 🔶 in progress · ⬜ not started · 👤 owner's decision

## M0 — Foundations (§14; signed off D143)
| # | Item (source) | Status | Next action |
|---|---|---|---|
| 0.1 | Probe from Cloudflare / D54 (§14) | ✅ probe runs, all Cloudflare checks 200 | Remove the 3×/day schedule (§16, due ≈ 4 Nov) |
| 0.2 | Monorepo, CI, D1 migrations, B1–B5 (§14) | ✅ (B5 review screen moved to M3, D141) | — |

## M1 — Market data (§14 gate: Phase 1 tests, backfill, 10 clean sessions, delivery/indices/market structure)
| # | Item (source) | Status | Next action |
|---|---|---|---|
| 1.1 | Phase 1 tests 1, 2, 3, 6 (§9.2) | ✅ live `/acceptance` | Re-run at freeze |
| 1.2 | Phase 1 test 4 (re-run changes 0 rows) | ✅ 3 Nov, staging re-run, 0 data rows changed | — |
| 1.3 | Phase 1 test 5 (rebuild from R2 identical) | ✅ 3 Nov, 8 sessions × 5 tables identical (C49 fixed) | — |
| 1.4 | Backfill complete (§14) | ✅ prices 2024 → for every instrument (D127) | — |
| 1.5 | 10 consecutive clean daily sessions (§14, D143 non-blocking) | 🔶 0/10, counted weekdays 21:43 IST | Daily check |
| 1.6 | Delivery loading | ✅ `/gaps` = 0 days missing | — |
| 1.7 | Indices loading | ✅ 2024 →; 🔶 10-year history (D156) downloading | Load 2016–2023 after the download, verify counts |
| 1.8 | Market structure (D148) | ✅ loading; gaps known: bulk/block days capped at 70 rows (480 of 704), ASM/GSM + FII/DII from 3 Nov only (no NSE history) | Test splitting the bulk/block history call by symbol (focus 250) |
| 1.9 | Corporate actions vs complete monthly lists (D138 re-run, D149) | ⬜ | Re-run the comparison for the 250 |
| 1.10 | Stale-Bc rule multi-day test (C28 test gap) | ⬜ | Add the test |
| 1.11 | Scale-guard re-check released lasting changes (C45, ABCAPITAL) | ✅ 3 Nov 21:00: ABCAPITAL holds 7 → 3 (lasting change released); COROMANDEL's 3 one-off ÷100 files still held (correct) | Recheck the remaining 3 at the freeze |

## M2 — Filings & financials (§14 gate; scope = 250, D155)
| # | Item (source) | Status | Next action |
|---|---|---|---|
| 2.1 | 5-year statements (D90) for the 250 | 🔶 loading | Coverage per company vs NSE's lists (quarters, FY, BS/CF half-years) |
| 2.2 | ≥ 99.5% of filings parse + identity checks (§14) | 🔶 99.66% on the part loaded | Measure on the 250 when loaded |
| 2.3 | Full-year figures (D90) | ✅ census 99.68%, loader live | Re-measure on the 250 |
| 2.4 | Balance sheet + cash flow totals | 🔶 backfill running (250 only) | Verify per company (2.1) |
| 2.5 | Every reported line, three statements (D154) | 🔶 detail census running; P&L +17 lines built | Deploy if the census passes; restart backfill; banks/NBFC/insurer detail maps |
| 2.6 | Heads with sub-rows layout (D157) | ⬜ | Layout tree per format (Schedule III order) |
| 2.7 | Restatement + basis rules on known cases (§14) | ✅ tests (INFY standalone vs consolidated, either load order) | — |
| 2.8 | Shareholding live (§14) | ✅ loading | Coverage + count check vs NSE for the 250 |
| 2.9 | PIT / SAST / board meetings live (§14) | ✅ 29/29 counts match NSE (3 Nov) | — |
| 2.10 | Credit ratings live (§14) | ✅ loading | Count check by month (NSE's ratings list ignores the symbol: all-company feed) — needs a small endpoint, next deploy |
| 2.11 | Classification run once (§14, D150) | ✅ 1,342 classified; the 250 are all index members (index-CSV sector) | Confirm all 250 have a sector |
| 2.12 | Held classes | 🔶 Ind AS 117 insurers (5), insurer balance sheets, BSE Ltd pre-2024 shareholding (10), 58 FY failures (49 expense breakdown, 9 Dec/Sep year ends), CONSOFINVT | Work class by class for the 250 |
| 2.13 | Temporary-error retry list (C48) | 🔶 "Network connection lost" not yet on it | Add with the next deploy |

## §16 "Still to verify"
| # | Item | Status | Next action |
|---|---|---|---|
| 16.1 | Sustained-volume NSE rate limits | ✅ measured during the backfill (≈ 0.3% refusals at 16 parallel) | — |
| 16.2 | Bulk/block, F&O, ASM/GSM archive paths | ✅ loading (D148) | — |
| 16.3 | SAST Reg 31 endpoint | ✅ 3 Nov: no Reg 31 list API (`corporate-sast-reg31` 404). Pledge facts come from the shareholding-pattern XBRL (loaded quarterly, `promoter_encumbrance`); Reg 31 disclosures themselves are announcement PDFs (M5). `corporate-pledgedata` exists (latest quarter only, 1,558 companies) — duplicates the SHP data, not downloaded (freeze) | — |
| 16.4 | RPT (related-party transactions) data location | ✅ 3 Nov: in the **standalone Integrated Filing – Financials XBRL**, half-yearly (INFY Sep 2026: 513 transactions — counterparty, relationship, type, amount, audit-committee-approved value); not in the governance XBRL. Already downloaded. ⚠ rows carry counterparty PAN — never shown publicly | RPT reader (later, with the graph, D37) |
| 16.5 | Insider-feed completeness | ✅ 29/29 vs NSE dated lists | — |
| 16.6 | Employee-count fields in BRSR XBRL | ✅ 3 Nov: present (INFY FY26 BRSR: employees/workers by permanent/other, male/female, differently abled; training, wellbeing, minimum-wage counts) — input for D53 headcount growth | BRSR reader (later, M9) |
| 16.7 | Gemini Flex + cache discount stacking | ⬜ M5/M6 (no AI before freeze, D155) | Later |

## M3 — before any site work (D152)
| # | Item | Status | Next action |
|---|---|---|---|
| 3.1 | Data-readiness map: every D91 stock-page and D62/D67 dashboard element → source table, completeness, verified | ⬜ | After M2 items above |
| 3.2 | Design brief questions (audience, references, first screen) | 👤 | Ask when 3.1 is done |
| 3.3 | Mockups → owner approval → build | 👤 | After 3.2 |

## Owner items
| # | Item | Status |
|---|---|---|
| O.1 | Trademark check for Disclo (D119) | 👤 pending |
| O.2 | Earlier design discussion (Gen Z / MF houses / PMS, visual style) — not in any record | 👤 restate when design starts |

## Operations
| # | Item | Due |
|---|---|---|
| X.1 | D1 rows-read re-measure (C18) | ≈ 5 Nov |
| X.2 | Workers CPU check | ≈ 5 Nov |
| X.3 | Write budget projection before widening (D155 checklist) | at widening |
