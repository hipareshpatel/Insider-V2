# Work list — full trace of the documents (owner #321, rebuilt #323)

**Rule (D158):** Claude works this list in order without waiting for instructions; the owner is asked only for owner decisions (money, legal, design, trademark). Scope now: **freeze and prove** M0–M3 for the 250 focus companies (D155), no more stock history (D156/D158). **Rebuilt (owner #323: "D158 missing many items, check all the documentation"):** every decision D1–D158 has a row below (milestone, status, next action), plus §5.8, §6, §9.1, §10, §11, the field catalogue, `website.md` §10–§11 and open FMEA items, so an item can't drop out unnoticed (checked mechanically: every D-number appears).

Legend: ✅ done + verified · 🔶 in progress / partly · ⬜ not started · 👤 owner's decision · ⏭ later milestone (listed so it isn't lost)

## A. Active scope — M0–M3 (order: A1 ops gaps → A2 M1 → A3 M2 → A4 M3 data prerequisites)

### A1. Foundations, operations, cost (M0 / §10 / §11)
| Ref | Item | Status | Next action |
|---|---|---|---|
| D11, D14, D97 | Storage split; public repo; docs only in `docs/`; no data or secrets in git | ✅ | — |
| D12 | TypeScript everywhere | ✅ (prefetch helpers are Python on GitHub runners) | — |
| D43 | Staging D1/R2 | ✅ (staging DBs + bucket; used by Phase 1 test 4) | — |
| **D44** | **Backups: D1 Time Travel 30 days + weekly export to R2 kept 12 weeks; full rebuild from raw tested** | 🔶 Built + tested 3 Nov (all 6 databases → R2 `backups/slot-NN/`, 12 rotating weekly slots); **schedule off until the data is frozen and OK** (owner #324). Note: an export briefly blocks other queries on that database (a census request failed during it) | Switch the Sunday schedule on at freeze |
| **D45** | **Owner alerts by email: pipeline stalled > 1 h, Gemini spend > 80%, dead-letter item, NSE error spike** | 🔶 only the daily cost guard (GitHub email) | Stall + NSE-error-spike alerts to `alerts@` |
| D79 | Occasional downtime acceptable; freshness shows staleness | ✅ | — |
| D96 | Owner review ≤ 30 min/day | ✅ (D141) | — |
| D116 | Email routing info@ / alerts@ / paresh@ | ✅ tested (#285) | — |
| §10 | Secrets in Cloudflare/GitHub, `.dev.vars` ignored | ✅ | — |
| D18, §11 | $100/month; hard Gemini daily cap in code | ⏭ M5 (no AI before freeze) | — |
| D136, D137, D154 | Write cap 54M; $10 ceiling; daily cost guard | ✅ | Projection at each check-in |
| D130, D131, D132, D135, D147 | Compact storage; gzip; as-filed XBRL in R2; one ledger; never delete | ✅ (compression: 0 verify failures) | — |
| D124, D128, D144 | Fast archive pace; downloads ahead of need | ✅ (index history 🔶) | — |
| D133, D134, D140, D142, D158 | V1 lessons as rules; census first; one item at a time; V1 when stuck; this list | ✅ in use | — |
| §16 | Remove the probe's 3×/day schedule | ⬜ due ≈ 4 Nov | Remove |
| C18 | D1 rows-read re-measure; Workers CPU check | ⬜ ≈ 5 Nov | Measure |

### A2. M1 — market data (§14 gate; §9.1; §9.2)
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
| 1.8 | Bulk/block history capped at 70 rows on 480 of 704 days | ⬜ | Test the history call split by symbol (250) |
| D125, D129, §9.1 | Market gates | ✅ code + tests | — |
| D141 | Review queue decided with evidence | ✅ empty | — |
| **D146** | Series breaks | 🔶 recorded only as review decisions | Own table for the site/API |
| §9.2 | Phase 1 tests 1–6 | ✅ all six | Re-run at freeze |
| §14 | 10 consecutive clean sessions | 🔶 counting | Daily |
| D156 | Index history 2016–2023 | 🔶 download running; loader deployed | Load, verify days and index counts |
| C28 | Stale-Bc multi-day test | ⬜ | Add the test |

### A3. M2 — filings and financials (§14 gate; scope = the 250, D155)
| Ref | Item | Status | Next action |
|---|---|---|---|
| D28, D56, D149 | PIT, SAST Reg 29, pledges (shareholding), full history | ✅ 29/29 vs NSE | — |
| D32 | `period` + `disclosed_at` on every fact | ✅ | — |
| D47, D132 | As filed (R2) → canonical → computed views | ✅ first two; computed ⬜ (A4) | — |
| D48 | Restatements versioned, > 0.5% flagged | ✅ | — |
| **D50, D51** | **Primary basis per company** (consolidated most, standalone banks, both for holding cos); **basis switch → series break**; basis on every number | 🔶 both bases stored + tagged; primary basis and switch detection ⬜ | Derive and detect |
| D76 | Integrated Filing primary; ratings structured | ✅ | — |
| D90 | 5 years of statements for the 250 | 🔶 loading | Coverage per company vs NSE's lists |
| §14 | ≥ 99.5% parse + identity checks | 🔶 99.66% (part) | Measure on the 250 |
| D90 FY | Full-year figures | ✅ census 99.68% | Re-measure on the 250 |
| D154 | Every reported line, three statements | 🔶 deployed; BS 99.58%; CF re-census running | CF residual classes; bank/NBFC/insurer maps |
| **D157** | Heads with sub-rows (Schedule III layout per format) | ⬜ | Build the layout trees |
| D121, D150 | Sector | ✅ | Confirm all 250 have one |
| 2.8 | Shareholding coverage + counts vs NSE (250) | ⬜ | Check |
| 2.10 | Credit ratings vs NSE by month | ⬜ | Small endpoint + check |
| **D40** | **Promoter-group structures from shareholding** | ⬜ | Derive per company |
| D47 | Segment results | ⬜ | Census + reader (stock page "segments") |
| D145 | Old bank files without period excluded | ✅ | — |
| 2.12 | Held classes (Ind AS 117 insurers, insurer BS, BSE Ltd pre-2024 SHP, 58 FY failures, CONSOFINVT, scale-guard holds) | 🔶 | Class by class for the 250 |
| 16.3–16.6 | Reg 31, RPT, insider completeness, BRSR employees | ✅ located (readers ⏭ M9) | — |

### A4. M3 — before any site work (D152): computed views + data map
| Ref | Item | Status | Next action |
|---|---|---|---|
| **D49** | EBITDA excludes other income; company EBITDA alongside | ⬜ | Computed views |
| **D52** | Ratio conventions (adjusted ex exceptional, TTM, ROE/ROCE on average capital) | ⬜ | Computed views |
| D66 | Catalogue conventions (rising trend, large order ≥ 2% TTM revenue) | ⬜ | Computed views |
| §5.8, §6 | **Feature table** + nightly derived job (adjusted series, dashboard snapshots, trackers) | ⬜ | Build for the 250 |
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

## B. Later milestones (⏭, listed so nothing is lost)
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

## C. Owner and legal
| Ref | Item | Status |
|---|---|---|
| D87, D88, D89, D151, D152 | Regulatory posture; licence funding; launch mode | 👤 decided; NSE data owner-managed |
| §12 | Legal consult questions 1–14 | 👤 before public launch |
| D99, D118, D119 | Name final; trademark check (IP India, classes 36/42) | 👤 trademark pending |
| D153 | Earlier design discussion — not in any record | 👤 restate at design time |
| D8, D54, D109, D120, D122, D143, D155, D156 | Superseded or one-time decisions (quote-equity sector, relay, hosting, BSE source, build start, M0 sign-off, focus, history windows) | ✅ recorded |

## D. Open failure modes (FMEA)
| Ref | Open part |
|---|---|
| C28 | Multi-day test for the stale-Bc rule |
| C44 | Insurer balance sheets not read; Ind AS 117 layout |
| C45 | Remaining scale-guard holds (recheck at freeze) |
| C46 | EXPLAIN QUERY PLAN check for every new read path (site phase) |

## E. Website brief (`docs/website.md`, owned by the planning chat)
§10 (pending), §10b–§10c (accepted items), §11 (conflicts): design inputs, layering, card sections, coverage-depth display, launch checklist — folded into A4 and C; the brief stays the source.
