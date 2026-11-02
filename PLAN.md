# Insider V2 — Plan (consolidated)

**Status:** Draft for owner review. Consolidated on 2026-11-02; design sections reflect decisions **D1–D86** (Appendix A).
No production code exists yet. The only code is `probe/`, a throwaway Worker for testing NSE reachability from Cloudflare.

**Working agreement:** this is a discussion phase. No production code is written until the owner says so. Claude asks for the owner's input wherever a decision is theirs, records every decision here, and flags anything it can't verify.

**Record-keeping:** `docs/discussion-log.md` logs **every owner statement** (not only decisions), mapped to where it's recorded here. It is updated in the same turn as each discussion message.

**How to read this:** §1–§15 describe the design as it stands. Appendix A is the decision log (each decision with its ID). Appendix B is the evidence from live NSE checks.
If the design text and Appendix A ever disagree, Appendix A wins and the design text gets fixed.

---

## 1. Product summary

**What:** an Indian equity research site built **only from primary sources** (NSE data and company filings), with every number traceable to its filing.
- **Market data:** prices, market cap, corporate actions, indices, delivery, breadth.
- **Filings intelligence:** announcements → verified facts → per-stock memory → cards, within ~15 minutes of filing.
- **Structured filings:** financial statements (XBRL), shareholding, insider/takeover disclosures, BRSR, governance, credit ratings.
- **Research tools:** dashboard, sector/industry pages, query builder, trackers, relationship graph, plant registry, forensic and timeliness panels.

**Who:** retail investors **and** institutions/family offices (D25). Layered depth: quick summary first, full sources one click away.

**Scope and phasing:**
- **Market data** covers the full EQ/BE/BZ universe from the start (no SME).
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

## 2. Principles & guardrails

1. **Every record has a stable ID, a source and a timestamp from day 1**, so links can be *added* later without rework. Links are *populated* only once the layer below them is accurate.
2. **Two dates on every fact:** `period` (what it's about) and `disclosed_at` (when the market learned it) (D32). Nothing is overwritten; corrections create versions. This enables the time machine (D69) and honest backtests (D53).
3. **Numbers come from code, never from the LLM's arithmetic.** XBRL is the primary numeric source. PDF tables pass accounting-identity checks (D48). Growth, margins and ratios are computed in code.
4. **Facts and opinions are stored separately.** LLM analysis is never an input to fact extraction (§7.3).
5. **Every fact quotes its source** (verbatim quote + page). Code verifies that the quote exists, or the fact is rejected.
6. **Period & unit discipline:** fiscal year is per company (most are Apr–Mar, but not all), quarters are normalised to Indian FY labels (Q1 FY26 = Apr–Jun 2025), and units (₹ crore/lakh/million) are normalised to ₹.
7. **Basis discipline:** consolidated/standalone is part of every value's identity. Mixing bases in a comparison is rejected by code (D50, D51).
8. **Never guess:** unnamed counterparties stay as text (D39); undefined ratios are null with a reason, never sentinel values (D52); estimates are labelled "estimate" (D72, D77).
9. **Explicit links only** in the relationship graph (D37). The single exception is labelled industry-default raw materials (D72).
10. **Cards and data are factual.** Judgement appears only in labelled AI write-ups (D80, legal blocker before public). Predictions, scenarios/estimates and pre-announcement trading timing are **owner-only** (D53, D68, D73, D69, D82).
11. **Nothing is lost silently.** Every announcement gets a timeline row. Triage misses are measured (D26, D27, D30).

---

## 2a. Building blocks & feature groups

**Purpose:** many features share the same machinery. Each building block below is built **once**, and every feature uses it, so nothing gets re-done when a feature is added.
**Rule for the build:** a feature may only be started once the blocks it depends on exist. New features should need *configuration* (fields, rules, templates), not new plumbing.

### Building blocks
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
| **B12** | **Feature table + query language** | One row per stock + compact series; one validated query language; parameterised SQL | D64, `docs/field-catalogue.md` |
| **B13** | **Diff engine** | Compare a thing with its previous version: filing vs prior equivalent, dossier vs last visit, screen vs last run, comparatives vs originals | D48, D64, D69 |
| **B14** | **Access tiers & caching** | Public / signed-in / owner-only routes; caching rules (owner data never cached publicly); rate limits | D53, D60, D63 |
| **B15** | **Estimate & scenario engine** | Owner-only, always labelled: scenario calculator, event impact, mix-drag, plant revenue share estimates, predictions | D53, D73, D77, D78 |
| **B16** | **Outcome ledger & backtest harness** | Point-in-time evaluation of signals vs actual results; naive-baseline comparison | D53 |
| **B17** | **Gold set & evaluation harness** | Labelled cases, metrics, staging regression gate | D20, D43 |

### Feature groups → blocks they depend on
| Group | Features | Depends on |
|---|---|---|
| **G1 Market data** | Prices, CA adjustment, market cap, delivery, indices, breadth, market structure, bulk/block deals, FII/DII | B1, B2, B4, B5, B11 |
| **G2 Financial statements** | Canonical P&L/BS/CF, restatements, basis, ratios, segments, geography, customers | B1–B5, B8, B9, B11 |
| **G3 Ownership & insiders** | Shareholding, pledges, PIT, SAST, tracked investors, promoter groups, trading-window flags | B1, B2, B4, B10, B11 |
| **G4 Announcements → cards** | Triage, extraction, verification, context, cards, memory-only items, concall audio, rated-facility amounts (D81), AI analysis write-ups (D80) | B2–B8, B9, B10 |
| **G5 Memory & credibility** | Dossier, guidance/commitments, credibility ledger, commentary map, disclosure regression, concall metrics | B2, B6, B9, B10, B13 |
| **G6 Business exposure** | NIC product mix, exports/geography, customers, raw materials, plants & capacity, location filters, commissioning watch (D82) | B9, B10, B11 |
| **G7 Governance & forensics** | Governance fields, disclosure timeliness, forensic panel, BRSR forensics, unexplained moves, ASM/GSM, red flags, bank-statement discrepancies (D83) | B2, B4, B11, B13 |
| **G8 Discovery tools** | Query builder, trackers, sector pages, dashboard, niche indices, baskets, peer comparison, returns vs indices, keyword scans, alerts, X-ray | B11, B12, B13, B14 |
| **G9 Owner-only analytics** | Signals, outcome ledger, predictions, scenarios, event impact, mix-drag, pre-announcement trading, research chat | B12, B14, B15, B16 |
| **G10 Platform & ops** | Accounts, staging, backups, alerts, freshness, correction screen, data health, cost dashboard, error detectors (D85), daily card audit (D86), launch gate (D84), availability policy (D79) | B5, B7, B14, B17 |

### Schema rules fixed on day 1 (expensive to add later)
Every stored value carries: `security_id`/`entity_id` · `period` · `disclosed_at` · `basis` (where applicable) · `version` + `supersedes` · `source` (filing id, page, quote or XBRL tag) · `origin` (reported / computed / extracted / industry_default / estimate) · `access` (public / signed_in / owner) · `extractor_version` / `model`.
Features built later should only *read* these fields, never require them to be added.

---

## 3. Architecture & stack

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
| Owner's machine | Sector classification job (D8) |

**Why not GitHub Actions + Python:**
- GitHub's Actions terms restrict non-build workloads.
- Schedules are delayed or dropped unpredictably.
- D1 is only reachable from outside Cloudflare via a slow, rate-limited REST API.

### Known downsides & plans
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

## 4. Data sources

All NSE. "Verified" = fetched successfully from a cloud IP on 2026-11-02 (Appendix B). **Every source must be re-verified from Cloudflare via `probe/`.**

### 4.1 Market data (archive host `nsearchives.nseindia.com`, daily 22:00 IST, D10)
| Dataset | Path | Status |
|---|---|---|
| UDiFF bhavcopy (OHLC, volume, ISIN, series) | `/content/cm/BhavCopy_NSE_CM_0_0_0_{YYYYMMDD}_F_0000.csv.zip` | Verified; history from **2024-01-01** (D2, D3) |
| PR bundle: `MCAP*` (issue size, market cap), `Bc*` (corporate actions) | `/archives/equities/bhavcopy/pr/PR{DDMMYY}.zip` | Verified; MCAP from **2024-02-01**; Bc earlier |
| Delivery (`sec_bhavdata_full`) | `/products/content/sec_bhavdata_full_{DDMMYYYY}.csv` | Verified (D65) |
| Equity master | `/content/equities/EQUITY_L.csv` | Verified |
| Index constituents | `/content/indices/ind_nifty50list.csv` (+ other index lists) | Verified (D9) |
| Index closes (~167 indices, OHLC, P/E, P/B, yield) | `/content/indices/ind_close_all_{DDMMYYYY}.csv` | Verified; from 2024-01-01 (D62) |
| Bulk & block deals | archive daily files | To verify (D67) |
| F&O participant-wise OI, F&O ban, ASM/GSM lists, short selling, price bands | archive daily files | To verify (D76) |
| FII/DII cash flows | `www.nseindia.com/api/fiidiiTradeReact` | Verified; **latest day only**, history builds from go-live |

### 4.2 Structured filings (`www.nseindia.com/api/...`, per company)
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
| Sector classification (4-level) | `quote-equity` | Quarterly + monthly for new listings | **Blocked from cloud → owner's machine** (D8) |

### 4.3 Announcements
| Dataset | Endpoint | Status |
|---|---|---|
| Corporate announcements (metadata + PDF link + XBRL flag), incl. by date range | `corporate-announcements` | Verified (no cookies needed from cloud) |
| RSS (backup source) | `nsearchives…/content/RSS/Online_announcements.xml` | Verified |
| Attachments (PDFs) | `nsearchives…/corporate/…` | Verified |

### 4.4 Non-NSE (minimal)
- **Government open PIN-code directory** (PIN → district/state) for plant locations (D77).
- Optional OpenStreetMap geocoding (cached).

---

## 5. Data model

Separate D1 databases by domain: `market`, `filings`, `announce`, `memory`, `graph`, `app`. Staging has its own copies (D43).

### 5.1 Identity (shared)
- Internal `security_id`. Symbol and ISIN are attributes with history (`security_identifier`), never keys. ISINs change on corporate actions (seen: Bajaj Finance split).
- Every listed security maps to a graph `entity` from day 1.
- **Lifecycle (D34):**
  - Demerger: memory is copied to the new company only for the business it took over, linked back, with human review.
  - Merger: linked, not merged.
  - Rename/symbol change: no change, since everything is keyed on `security_id`.

### 5.2 `market`
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
- **Adjusted price** = raw × product of later `adj_factor` values. It's computed, never stored. Volume adjusts inversely.
- **Market cap** is never adjusted (D5).
- **Corporate-action rules (D6):**
  - Split/bonus: factor = share-count ratio from MCAP, which must match the Bc text within 0.1%.
  - Rights: TERP.
  - Demerger / capital reduction: price-ratio estimate, always reviewed.
  - January 2024: Bc ratio only. Market cap derived from February's share count (`derived`).
- **Dividends** are recorded but not adjusted (D7).
- **`Bc*.csv` handling:** the same action appears once per series (EQ, BE…), so rows are deduped on (security, ex-date, purpose). Purpose text varies ("FVSPLT", "FV SPLT", "INT DIV", "RS"/"RE"…), so parsing uses tolerant patterns, and anything unparsed goes to the review queue; nothing is guessed.
- **Revised files:** NSE occasionally revises a day's files. The next run re-fetches the previous 5 sessions' files, compares SHA-256, and reprocesses a date if its file changed.
- **Classification history** exists only from our first fetch onward (NSE shows current classification only).
- **Market cap display:** ₹ crore, no decimals; stored exact in ₹ (D5).

### 5.3 `filings` (financial statements & structured disclosures)
- **Three layers (D47):**
  - **As filed:** every XBRL fact (tag, context, unit, decimals, filing id), lossless.
  - **Canonical:** our own line items with templates for industrial / bank / NBFC / insurance.
  - **Views:** Screener-like summary, statements, ratios, all computed.
- **Value key:** (security, statement, line, period, **basis**, **version**).
  - *Original* = that period's own XBRL.
  - *Restated* = a later filing's comparative column (from PDF, identity-checked).
  - Default series = latest restated, with a marker (D48).
- **Basis (D50):** primary basis per company — consolidated (most), **standalone (banks)**, both (holding companies). Basis switches create series breaks. Profit is split into attributable to owners vs NCI.
- **Conventions:** EBITDA excludes other income (company figure stored alongside) (D49). Adjusted metrics exclude exceptional items; TTM; average capital for ROE/ROCE; no sentinel values (D52).
- **Also stored:**
  - shareholding pattern (incl. pledges, named holders ≥ 1%)
  - insider (PIT) and Reg 29 transactions, promoter pledges/encumbrance (D28)
  - credit ratings
  - governance facts
  - **BRSR facts** (products by NIC code + % turnover, exports %, plants/offices, markets, employees/workers, energy/water, purchase/sales concentration; **standalone basis**) (D71)
  - segment data mapped to a canonical business-line taxonomy
  - geographic revenue on a canonical region/country list
  - major customers (≥ 10%) (D70)

### 5.4 `announce`
```
announcement   seq_id, security, category, subject, filed_at, pdf_url, sha256, size, xbrl flag, lane, status
page_text      per page (in R2, compressed), extraction route (text|vision)
event          groups related filings (intimation → outcome → results → presentation → concall)
```
- **PDFs are not kept long-term (D17).** URL + SHA-256 + per-page text are kept forever. High-value PDFs are kept 90 days.

### 5.5 `memory` (per stock; every row: source filing, page, quote, `period`, `disclosed_at`, confidence, claim type, model/prompt/extractor version)
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

### 5.6 `graph`
```
entity        kind: listed_company | unlisted_company | person | investor | promoter_group | plant | commodity | product(NIC) | govt_body
entity_alias  alias, source
relation      kind: supplier_of | customer_of | subsidiary_of | competitor_of | uses_material | produces | promoter_of | holds | operates_plant
              + source filing, quote, confidence, valid_from/to, origin[explicit | industry_default]
```
- **Explicit links only (D37).** Industry-default raw materials are allowed with `origin = industry_default`, always labelled (D72).
- **One hop (D38):** linked companies get a context line. *Provisional:* a separate card only if named and ≥ 2% of the linked company's TTM revenue/market cap.
- **Named** unlisted counterparties → entities; **unnamed** → text (D39, provisional).
- **Promoter groups** seeded from shareholding patterns (D40). **Tracked investors** = named holders ≥ 1% (D67).
- **Entity resolution:** exact alias → fuzzy → LLM suggestion → review queue. A wrong merge is worse than a missing link.
- **Plant registry (D77):**
  - Fields: name, address, PIN, city, district, state, country, products (NIC), capacity, utilisation, status, commissioning dates (→ commitments), regulatory status (company-disclosed USFDA outcomes).
  - Sources: annual-report plant locations cross-checked against BRSR plant counts.
  - Plant revenue share is factual only for single-plant companies or plant-wise disclosure; otherwise capacity share labelled "estimate".

### 5.7 `app`
Users (Google sign-in), watchlists, saved queries/trackers/baskets, on-site alerts, error reports, owner corrections log (D35), audit log, query cache, cost ledger.

### 5.8 Feature table
One row per stock, hundreds of precomputed fields + compact quarterly series (≤ 12 quarters), rebuilt nightly and after events. It powers the query builder, trackers, dashboard and sector pages.
Full list: `docs/field-catalogue.md`.

---

## 6. Pipelines

| Pipeline | Trigger | Notes |
|---|---|---|
| **Market daily** | Cron 22:00 IST, every day (weekend sessions exist) | 404 = no session (only if both bhavcopy and PR return 404). Missed dates retried every run. Raw files archived to R2 (~1 MB/day). Quality gates (§9.1) block bad dates. |
| **Structured filings** | Cron (frequency per source) | Integrated filings, shareholding, PIT/SAST, credit ratings, board meetings, corporate actions → parsed in code, **no LLM**. |
| **Announcements (real time)** | Cron every 2–5 min + RSS backup | Queue stages: triage → extract → verify → context → analyse → commit (§7). Target ≤ 15 min (D16). |
| **Annual** | On filing | BRSR XBRL (code). Annual-report sections (LLM, Flex): MD&A, segment note (geography + major customers), revenue disaggregation, capacity/capex, RPT, contingent liabilities, auditor qualifications, FX earnings & outgo, R&D, unhedged FX exposure, raw materials consumed, **plant locations** (D74, D77). Capacity/commissioning/utilisation facts from presentations, transcripts and MD&A (D83). Borrowings notes: sanctioned working-capital limits + whether quarterly statements filed with banks agree with the books (discrepancy = red flag, D83). |
| **Classification** | Owner's machine CLI, quarterly + monthly (new listings) | `quote-equity` ~1 request per 2–3 s with jitter. Resumable. Writes to D1 via API token (D8). |
| **Nightly derived** | After the market job | Adjusted series, feature table, dashboard snapshots, trackers, niche indices, outcome ledger. |
| **Backfill** | One-off | Market: ~700 dates × 2 files + Bc from 2022, ~1 req/s, on Workers Paid. Phase 2: last 4 quarters of Nifty 50 results, concalls and presentations on **Batch**, cost estimated first (D55). |

---

## 7. AI layer

### 7.1 Models & tiers (D15)
- Gemini paid tier only. **One pinned stable model per stage**, changed only after the gold set passes on staging.
- Prompt caching throughout (fixed instructions + dossier).
- **Standard:** triage + time-critical events (results, transcripts, orders, management changes).
- **Flex** (50% off, 1–15 min latency, may return 503 → client retries): everything else.
- **Batch:** backfill, weekly audit, gold-set runs.
- **On Flex, context is pre-fetched in one go** (no multi-round tool calls). *To verify:* whether cache discounts stack with Flex, and Flex availability for the chosen models.

### 7.2 Triage (D26, D27, D30)
| Lane | Content | Processing |
|---|---|---|
| **A** always full | Results, transcripts (detected by subject), presentations, acquisitions/disposals, orders, credit ratings, management/director changes, litigation, regulatory actions, schemes, fundraises, rumour/news verification, material-issue disclosures, commencement of production, monitoring-agency reports, **Reg 30 disruption disclosures** | Full extraction + card |
| **B** timeline/structured only (no LLM) | Depository certificates, trading window, newspaper copies, record dates, meeting schedules (→ calendar), recording links (→ audio summary, D69) | Timeline row + structured data |
| **C** decide per item | General Updates, Updates, Press Release, Shareholders meeting, unknown categories | Cheapest model on subject + page 1 → full / memory-only / timeline |
- Routing uses **category + subject text**, never category alone (evidence: a material JLR IT-security update sat under "General Updates").
- **Keyword escalators** (incident, cyber, fraud, resign, default, penalty, raid, fire, shutdown, downgrade, …; tuned in practice) and **size checks** (e.g. ESOP/allotment ≥ 1% of capital) lift items B → C/A.
- Dedupe by SHA-256. "Revised" supersedes. Related filings are grouped into one event.
- **Weekly audit:** ~300 items on Batch, weighted to Lane C skips, against a written definition of "material". Target: **zero** misses. Any miss fixes the rule that missed it. The owner spot-checks "not material" verdicts monthly.

### 7.3 Extraction & verification guardrails (enforced by code)
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

### 7.4 Context retrieval
- **Pre-fetch by event type** (results → last 8Q + open guidance + commitments due + last concall concerns; order → order book, run-rate, capacity, customer; capex → projects, debt, cash flow; management change → history, red flags; rating → history, debt).
- **Tool calls** only on Standard-tier events, ≤ 5 per item, logged.
- Vector search only via `search_commentary(stock, query, before_date)`.
- The context pack carries basis tags and only the primary basis unless the event concerns the other.

### 7.5 Card (one per event, versioned)
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

### 7.6 Other LLM uses
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

## 8. Product (website)

**Public, readable without an account** (D60; public after legal consult, owner routes behind Access, D13). Accounts via Google sign-in add watchlists, saved queries/trackers/baskets and on-site alerts (no email/Telegram alerts to users). Owner-only routes sit behind Cloudflare Access.

### 8.1 Public
- **Home = market & indices dashboard** (EOD, clearly labelled) (D59, D62, D67):
  - ~167 indices: levels, trends, P/E, P/B, yield vs own history (percentiles)
  - breadth: advances/declines, % above EMA 20/50/100/200, daily thrust (±4%), 52-week extremes
  - broad-index panel; sector/industry performance; FII/DII
  - market structure (F&O participant OI, ban list, ASM/GSM entries)
  - results-season tracker; latest important cards; calendar; search
  - "data updated HH:MM IST" (D46)
- **Card feed:** filters by stock, event type, materiality, confidence; "report an error" on every card (D42).
- **Stock page:** layout to be designed (next topic). Contents available: **AI analysis write-up** (D80, after legal consult), **rated bank-facility history** (D81), **commissioning watch** (facts: cost, date, guided utilisation, depreciation policy, debt share, **plus labelled estimate** of extra depreciation, interest and margin effect) (D82), dossier, financials (reported/adjusted, original/restated, basis), segments & mix, geography, customers, plants, guidance & commitment tracker, management credibility ledger, insider/pledge panel, shareholding, governance, forensic panel, disclosure timeliness, disclosure-regression flags, timeline, cards, linked companies, time-machine view.
- **Sector/industry page:** aggregated results trend, guidance raised vs cut, commentary map, valuation vs history, KPI-pack comparison, leaders/laggards, red flags, raw-material exposure, upcoming results (D70).
- **Query builder** (D61, D64): plain English (signed-in) + visual chips + text expression → one validated query language → precomputed feature table. Saved screens with "what changed since last run". If plain English can't be mapped to fields, the builder shows **"not understood: …"** instead of guessing. A `null` never matches a condition; every field has an as-of date.
- **Trackers** (D78): sector KPI trackers (company-reported vs computed), segment-margin trackers (where disclosed), export share vs margin, repeat orders (named customers, disclosed orders only).
- **Other tools:** keyword scans over announcement text (D67); bulk/block deals and tracked investors; custom baskets, returns vs indices, peer comparison; niche sector indices (e.g. NIC-based castings) (D75); exposure queries over the graph; unexplained-move panel (D69); "what changed since your last visit" (signed-in).
- **Data-health page:** last runs, review-queue sizes, freshness.

### 8.2 Owner-only (Cloudflare Access; never cached publicly or exposed via public API routes)
- Upcoming-results signals (incl. headcount growth as an expansion indicator) + outcome ledger; predictions only after a backtest beats the naive baseline (D53).
- Scenario calculator, incl. commodity shocks and inventory gain/loss (D73).
- Event-impact screen ("flood, Ahmedabad, 15 days" → plants → companies → % capacity → revenue at risk) (D77).
- Export mix-drag estimate (D78).
- Pre-announcement insider-trading timing (D69).
- Portfolio X-ray (aggregated geography, raw-material, customer, pledge exposure) (D75). *Note: also useful for signed-in users later.*
- Research chat (D68).
- Interpretation of rated-facility changes as signals (D81, D53).
- Correction screen (logged; shown publicly as "corrected") (D35). Review queues (CA, entity resolution, demergers, triage audit, error reports). Gold-set & cost dashboard.

### 8.3 Future paid tier (D23)
Not built now. Designed in: accounts, API keys, exports, per-plan limits. API design is an upcoming topic.

---

## 9. Quality & evaluation

### 9.1 Market-data gates (a date isn't written if any check fails)
- Row count within ±5% of 20-day median.
- Exact schema.
- `low ≤ open, close ≤ high`, all > 0.
- `|mcap − issue × close| / mcap < 0.5%`.
- ≥ 99% EQ rows join MCAP (from 2024-02-01).
- Unexplained adjusted move > ±35% → review.
- Unexplained share-count change > 2% → review.
- Index snapshot row counts exact.

### 9.2 Phase 1 acceptance tests
1. BAJFINANCE adjusted close 2025-06-13 = 933.10, continuous across 2025-06-16.
2. Nifty 50 adjusted series: zero unexplained jumps since 2024-01.
3. Market cap equals NSE MCAP to the rupee from 2024-02-01.
4. Re-running any date changes 0 rows.
5. A rebuild from R2 is identical.
6. CA review queue empty.

### 9.3 Gold set (D20)
- ~50 real Nifty 50 announcements covering: results, concalls (speaker attribution), scans, chart-heavy presentations, orders, management changes, restatements, consolidated/standalone traps, and **the owner's failure cases**.
- Drafted by Claude; **owner labels are ground truth**.
- **Metrics:** fact precision/recall, number accuracy (value + unit + period + basis), speaker attribution, triage miss rate, cost and latency per item.
- **Every prompt/model change** reruns the gold set on staging; a regression doesn't ship.

### 9.4 Ongoing
- **Daily random card audit** (D86): stronger model on Batch checks a daily sample against source pages; owner reviews flags; Claude reviews samples in sessions.
- **Automated error detectors on every write** (D85): units (100×/1000× jumps), company mix-up (PDF identity vs announcement), period, basis, quote verification, card-vs-store re-read, cross-source checks, schema.
- **Public launch gate** (D84): measured audit error rate below threshold for N consecutive days (values set in milestones); no fixed shadow run, the pre-public private period serves that purpose.
- Weekly triage audit (§7.2).
- Insider-feed completeness check.
- BRSR plant-count cross-check.
- Entity-resolution review.
- Outcome ledger each results season (D53).

---

## 10. Operations & security
- **Availability:** occasional downtime acceptable; no redundancy/on-call; queues catch up; freshness indicator shows staleness (D79).
- **Staging:** separate D1/R2/queues; gold set gates promotion (D43).
- **Backups:** D1 Time Travel (30 days) + weekly export to R2 kept 12 weeks; full rebuild from raw tested before launch (D44).
- **Alerts to owner (email):** pipeline stalled > 1 h, Gemini spend > 80% of daily cap, any dead-letter item, NSE error spike (D45).
- **Secrets:** in Cloudflare/GitHub secrets and local `.dev.vars` (git-ignored). The repo is public: **no data or secrets in git** (D11, D14).
- **Access control:** owner routes behind Cloudflare Access. Public API routes rate-limited, read-only, bot protection. Owner-only data never edge-cached publicly.
- **Prompt-injection defence:** §7.3.

---

## 11. Budget ($100/month total, D18)
| Item | Allocation (initial; tuned from measured cost per item) |
|---|---|
| Workers Paid (incl. base D1/Queues/R2 allowances) | $5 |
| D1/R2/Vectorize/Queues overage | ≤ $5 |
| Gemini, **hard daily cap in code** (≈ $85/month) | Announcements (triage + extraction + cards) ~50% · concall audio + annual reports ~20% · weekly triage audit + **daily card audit** + gold-set runs (Batch) ~10% · **AI analysis write-ups (Flex)** — taken from the reserve until measured · plain-English queries ~5% · owner research chat ~5% · reserve ~10% |
| Headroom | ~$5 |
- At 80% of the daily cap, only Lane A is processed. At 100%, items queue for the next day, and the data-health page says so.
- The Phase 2 backfill is a **one-off** on Batch, estimated before running (D55).
- **Not covered:** NSE EOD licence (≈ $113/month for the website alone, §16), a domain (~₹1,000/yr, not needed yet, D58), the legal consult.
- **Full universe ≈ 46× the announcement volume of Nifty 50; it doesn't fit in $100.** Expansion beyond Nifty 100 is a budget decision based on measured cost.

---

## 12. Legal & compliance
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
5. NSE data: unlicensed bhavcopy-derived prices (D24); NSE website terms vs automated API access; status of derived numbers.
6. Republishing quotes/numbers from company filings; linking vs hosting PDFs.
7. Paid tier: does charging institutions change status (RA vs IA)? Is an institutional API data redistribution?
8. Owner's own trading in covered stocks: disclosures/conflicts; owner-only signals.
9. DPDP Act obligations (accounts, emails, error reports).
10. Individual vs company; terms, liability, jurisdiction, disclaimers.
11. NSE **index** data (licensed by NSE Indices Ltd).
12. Name/brand near "insider" in a securities context.
13. **Paid, stock-specific AI judgement write-ups (D80):** does this require SEBI Research Analyst registration (individual or entity)? Obligations if registered (qualifications/NISM certification, disclosures, audit, conflict rules). Alternatives.
14. **Pre-results impact estimates** (D82): public, labelled estimates about named companies' upcoming results.

---

## 13. Risks
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

## 14. Build order (to be refined in the milestones discussion)
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

## 15. Repo layout
```
packages/core/        shared TS: types, NSE parsers, XBRL mapping, FY/unit/basis normalisers, validators, query language
workers/market/       market daily + nightly derived
workers/filings/      structured filings (integrated filings, shareholding, PIT/SAST, ratings, BRSR, board meetings)
workers/announce/     poller + queue consumers (triage, extract, verify, context, analyse, commit)
workers/api/          Hono API (public, signed-in, owner routes separated)
web/                  React + Vite
tools/classify/       owner-machine CLI (sector job)
tools/relay/          fallback fetch relay (only if needed)
db/migrations/{market,filings,announce,memory,graph,app}/
eval/gold/            gold set (metadata + expected outputs; no NSE PDFs committed)
docs/                 field catalogue (incl. KPI dictionary draft), this plan's companions
probe/                throwaway reachability check
.github/workflows/    ci.yml only
```

---

## 16. Open items

**Waiting on the owner:**
1. Run `probe/` from Cloudflare (3–4 times, incl. after 22:00 IST) and share the output.
2. Share 10–20 known failure cases for the gold set.
3. Review `docs/field-catalogue.md`, especially the sector packs.
4. Before backfill/go-live: Workers Paid, a paid Gemini API key, a Cloudflare API token for CI.

**Still to discuss:**
- performance targets (page-load and API latency) as part of milestones; the website must be fast, modern and expandable
- stock page layout
- API design for the future paid tier
- milestones and definition of done
- card sections, after real output (D25)

**Still to verify:**
- every source from Cloudflare
- bulk/block, F&O, ASM/GSM archive paths
- SAST Reg 31 endpoint
- RPT data location
- insider-feed completeness
- Flex + cache discount stacking
- employee-count fields in BRSR XBRL tables

**Proposed, awaiting owner decision: closed beta (D89 candidate).** To get testers and pitch material before open public launch: invite-only access via Cloudflare Access (free Zero Trust plan covers up to 50 users) for beta testers and prospective investors; free during beta; same product as public. Lower exposure than open public (limited, invited, unpaid), and it still gives real usage, feedback and a demo. Opens to the public when the launch gate (D84) passes.

**Licence funding options** (explained 2026-11-02): A) owner funds the licence from public launch; B) launch public without NSE prices until revenue; C) ask licensed vendors (e.g. CMOTS, Accord) for quotes; D) keep the calculated risk until the paid tier and license before charging. **Owner chose D** (D88): keep the calculated risk until the paid tier; license before charging. *Claude's recommendation remains:* also ask vendors for quotes (C) since it costs nothing; never charge users before a licence is in place.

**Unresolved:** funding for the NSE licence (EOD Capital Market ≈ ₹1,00,000 per display medium + GST ≈ $113/month for the website alone, above the $100 budget). No ads or sponsors (D22).

**Resolved (D80):** ~~Open question from the owner's original brief:~~ Gemini was described as being used for **stock analysis of different types (technical, fundamental, stock research)**, not only announcement processing. The plan currently covers this as computed technical/fundamental data + cards + owner-only research chat. Is a **per-stock AI analysis write-up** (fundamental/technical) wanted, and if so public (factual) or owner-only?
**Resolved (D81):** "credit increases" = rated bank-facility amount increases.

**Provisional decisions to confirm:** D38 (linked-company card threshold), D39 (unlisted counterparties).

---

## Appendix A — Decision log

| # | Topic | Decision |
|---|---|---|
| D1 | Market-data source | NSE archive (`nsearchives.nseindia.com`). No paid vendor for now; licence-ready adapter (D24). |
| D2 | History start | **2024-01-01** (first UDiFF bhavcopy). |
| D3 | Bhavcopy format | UDiFF only. |
| D4 | Universe | Series EQ, BE, BZ. No SME. AI processing starts with **Nifty 50**, then other indices, then the full universe. |
| D5 | Market cap | Full market cap as published by NSE (`MCAP*.csv` in the PR bundle). Never adjusted. Stored exact in ₹, displayed in ₹ crore with no decimals. |
| D6 | Corporate actions | Source: `Bc*.csv`. Split/bonus factor = **share-count ratio** from MCAP, cross-checked with the Bc text. Rights use TERP. Demergers and capital reductions use a price-ratio estimate, flagged for review. |
| D7 | Dividends | Not adjusted (price-only), but recorded. |
| D8 | Sector classification | NSE 4-level, from `quote-equity`, run **on the owner's machine** (blocked from cloud). Quarterly for all, monthly for new listings only. |
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
| D22 | Monetisation | No ads, no sponsors; a clean site. Expected to stay **free for roughly the first 5 years** (competition). Target: investors, family offices, institutions. **Licence funding open** (§16). |
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
| D38 | Graph impact reach | One hop; context line for linked company. *Provisional:* own card only if named **and** ≥ 2% of linked company's TTM revenue (or market cap for deals). |
| D39 | Unlisted counterparties | *Provisional:* named → entities with aliases; unnamed → text, never guessed. |
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
| D52 | Ratio conventions | Adjusted excludes exceptional items (reported alongside). TTM. ROE/ROCE on average capital; capital employed documented. No sentinel values. (Screener's "net of excise duty" adjustment is not needed: our history starts in the GST era.) |
| D53 | Upcoming-results signals | Factual leading indicators (guidance revisions, order book ÷ TTM revenue, quarter-end provisional business updates, monthly volumes, capacity vs commitments due, insider/promoter buying, pledge changes, margin trend, **headcount growth from BRSR as an expansion indicator**) + outcome ledger. "Good results" = growth above own 8-quarter trend **and** guidance met. Ranking/prediction only after a point-in-time backtest beats a naive baseline, **owner-only**, never cached publicly. |
| D54 | NSE-block fallback | Decide if it happens (owner-machine relay vs small VPS). |
| D55 | Phase 2 backfill | Last 4 quarters of Nifty 50 results, concalls, presentations; cost estimated first. |
| D56 | Shareholding pattern | Ingested quarterly for all covered stocks. |
| D57 | Next index | Nifty Next 50 after the Nifty 50 PoC (together = Nifty 100). |
| D58 | Domain | `*.workers.dev` for now. |
| D59 | Home page | Market & indices dashboard + latest important cards + calendar + search. |
| D60 | Accounts | Everything readable without an account. Accounts for watchlists, saved queries and on-site alerts. |
| D61 | Query builder | Required and must be easy (design: D64). |
| D62 | Dashboard contents | EOD. ~167 indices; index P/E, P/B, yield vs own history; breadth; sector performance; FII/DII (history from go-live); results-season tracker; cards; calendar; search. Precomputed nightly. |
| D63 | Login | Google sign-in only. |
| D64 | Query builder design | Plain English (Gemini → our query language as editable chips; **LLM never writes SQL**) + visual chips + text expression → one validated language → parameterised SQL over the feature table. Plain English: signed-in users, daily cap, cached. Saved screens + "what changed". Field catalogue in `docs/field-catalogue.md`. |
| D65 | Delivery data | `sec_bhavdata_full` added to daily sources. |
| D66 | Catalogue conventions | Rising trend = positive slope over n quarters **and** ≥ (n−2) positive QoQ changes. Large order = ≥ 2% of TTM revenue. |
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

## Appendix B — Verification evidence (live NSE checks, 2026-11-02, cloud container)
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
| NSE EOD licence | Tariff (Apr 2026): Capital Market EOD ₹1,00,000 (domestic) per display medium; website and app are separate mediums. |
