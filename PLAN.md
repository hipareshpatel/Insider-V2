# Insider V2 — Plan

Status: **Draft for review.** No production code is written until this plan is signed off.
(The only code so far is `probe/`, a throwaway Worker for checking which NSE endpoints Cloudflare can reach.)

- **Phase 1 — Market data foundation:** universe, classification, daily prices, market cap, corporate actions, Nifty 50 membership.
- **Phase 2 — Announcement intelligence:** NSE announcements → verified facts → per-stock memory → analysis cards, within ~15 minutes of filing.

Proof of concept is **Nifty 50**. Every mechanism is designed for the full NSE universe, and growing to it should need configuration and budget, not a redesign.

**Clean-slate rule:** V2 is designed from first principles. No code, data, outputs, schemas or designs from any earlier version are used or referenced, in this plan or in implementation.

**Principle for a large project:** from day 1, every record has a stable ID, a source and a timestamp, so links can be **added** later without rework.
Links are **populated** only once the layer below them is accurate.

---

## 0. Platform & stack (decided)

**All on Cloudflare, TypeScript.** GitHub Actions is used for CI only.

| Piece | Cloudflare product |
|---|---|
| Schedules (bhavcopy 22:00 IST, announcement poll every 2–5 min) | Workers **Cron Triggers** |
| Job pipeline (triage → extract → analyse), retries, dead-letter | **Queues** |
| Structured data, memory tables | **D1** (several databases, split by domain) |
| Raw files, page text, short-lived PDFs | **R2** |
| Semantic search over unstructured memory | **Vectorize** |
| API | Hono Worker, `/api/v1` |
| Website | React + Vite, served from Workers static assets, private behind **Cloudflare Access** |
| LLM | Gemini API (paid tier), behind a provider interface |

### Why not GitHub Actions + Python
- GitHub's Actions terms restrict workloads that aren't about building, testing or deploying the repo's software. A production pipeline that polls NSE and calls Gemini risks being disabled.
- Scheduled runs are delayed or dropped unpredictably.
- D1 can only be reached over the REST API from outside Cloudflare, which is slow and rate-limited.

### Known downsides of this choice, and the plan for each
| Downside | Impact | Plan |
|---|---|---|
| Worker memory is 128 MB per isolate | Large PDFs (seen: 41 MB) are risky to parse in-process | Fetch only the pages we need; split with `pdf-lib`. Send whole large PDFs straight to Gemini's File API without parsing locally. If a job type still doesn't fit, move **that job only** to Cloudflare Containers. |
| No page renderer (no canvas) in Workers | Can't turn PDF pages into images for vision | Not needed: send **single-page PDFs** (split with `pdf-lib`) to Gemini, which reads PDF pages natively, including scans. |
| CPU limit (Paid: 30 s default, up to 5 min; 15 min for Cron) | Heavy parsing could time out | Time spent waiting on fetch, D1 or Gemini doesn't count as CPU. Work is split into small queue messages (one document or page group each). |
| Weaker data-science tooling than Python | Ad-hoc research and backtests are painful | Production doesn't need it. For research, export D1 → SQLite file → local Python/notebooks, read-only. |
| Vendor lock-in | Hard to leave Cloudflare | D1 is SQLite (exportable). Hono runs on Node/Bun. Queue and Cron code sits behind thin adapters. Gemini sits behind an interface. |
| D1 caps (10 GB per DB; billed by rows **scanned**) | Growth and cost | Split databases by domain (market, announcements, memory, graph). Precomputed snapshot tables. Every query uses an index. |
| **NSE may block Cloudflare's IP addresses** | **The whole design depends on it** | Run `probe/` from Cloudflare. If blocked: a tiny **fetch relay** on the owner's machine (or a €4 VPS) pushes raw files to R2, and everything else stays on Cloudflare. |
| Free plan: 10 ms CPU, 100k D1 row writes per day | Can't run the real pipeline | Development and probing happen on Free. **Workers Paid ($5/month)** before the backfill and go-live. |

### Alternatives considered
- **A VPS (Python + cron + Postgres)** for everything: no platform limits, but you maintain a server, it's a single point of failure, and it moves away from D1/R2. Kept only as the fetch-relay fallback.
- **Google Cloud Run + Scheduler:** close to Gemini and free tier is generous, but it splits the platform away from Cloudflare.
- **Hybrid: Cloudflare + Containers with Python for heavy jobs:** this is the escape hatch above. It's adopted per job type **only when measurement shows a Worker can't handle that job**, not upfront.

---

## 1. Decisions (locked)

| # | Topic | Decision |
|---|---|---|
| D1 | Market-data source | NSE archive (`nsearchives.nseindia.com`). Personal project, so no paid vendor. |
| D2 | History start | **2024-01-01** (first UDiFF bhavcopy). |
| D3 | Bhavcopy format | UDiFF only. |
| D4 | Universe | Series EQ, BE, BZ. No SME. AI processing starts with **Nifty 50**, then other indices, then the full universe. |
| D5 | Market cap | Full market cap as published by NSE (`MCAP*.csv` in the PR bundle). Never adjusted. Stored exact in ₹, displayed in ₹ crore. |
| D6 | Corporate actions | Source: `Bc*.csv`. Split/bonus factor = **share-count ratio** from MCAP, cross-checked with the Bc text. Rights use TERP. Demergers and capital reductions use a price-ratio estimate, flagged for review. |
| D7 | Dividends | Not adjusted (price-only), but recorded. |
| D8 | Sector classification | NSE 4-level, from `quote-equity`, run **on the owner's machine** (it's blocked from cloud). Quarterly for all, monthly for new listings only. |
| D9 | Index history | Daily snapshot + diff of the constituent CSV, from go-live onward. |
| D10 | Market-data schedule | Every day at 22:00 IST. A 404 means "no session". Missed dates are retried. |
| D11 | Storage | D1 + R2 + Vectorize. Git = code + migrations only, **no data**. |
| D12 | Language | TypeScript everywhere. |
| D13 | Website | Private (Cloudflare Access) and autonomous. NSE licensing must be reviewed before going public. Website only, no alerts. |
| D14 | Repo | Public. |
| D15 | LLM | **Gemini paid tier only**, no other providers and no fallback to other vendors. **One pinned model version per stage** (stable/GA versions only), changed only after the gold set passes. Prompt caching is used throughout. **Tier split:** Standard for triage and time-critical events (results, transcripts, orders, management changes); **Flex** (50% off, 1–15 min latency) for everything else; **Batch** for backfill, audits and gold-set runs. Behind a provider interface. |
| D16 | Announcement latency | Card within **15 minutes** of filing. |
| D17 | PDFs | **Not stored long-term.** Keep URL + SHA-256 + per-page text forever. Keep PDFs of high-value types for 90 days only. |
| D18 | Budget | **$100/month total** (Cloudflare + Gemini + everything). Hard spending cap in code. |
| D19 | Commodity prices | Later phase. |
| D20 | Evaluation | Gold test set: drafted by Claude, **ground truth set by the owner**. |
| D21 | Score | **No score, rating or positive/negative label on cards.** Cards present facts, comparisons with the company's own past, and context. |
| D22 | Monetisation | No ads, no sponsors. Target audience: investors, family offices, institutions. **Funding for the NSE licence is open** (§10). |
| D23 | Paid tier | Possible later (institutions). Not built now, but accounts, API keys and exports are designed in from day 1. Product robustness comes first. |
| D24 | Prices on public site | Bhavcopy-derived prices are shown publicly before a licence: **owner's calculated risk**. The source adapter allows a switch to a licensed feed. |
| D25 | Audience | Retail **and** institutions: a layered card (summary → full context with sources). Shareable image generated from the web card. Card sections are decided later, based on content and quality. |
| D26 | Triage | Route on **category + subject text**, never category alone. Lanes: A = always full, B = timeline/structured only (no LLM), C = cheap LLM decides. Keyword escalators and size checks lift items from B → C/A. Every item gets a timeline row. Dedupe by PDF hash; revisions supersede; filings linked into one event. Keywords to be tuned in practice. |
| D27 | Triage miss tolerance | **Zero** material misses in the weekly audit sample. Any miss → the rule that missed it is fixed. |
| D28 | Insider & pledge data | **In scope:** insider-trading disclosures (SEBI PIT), takeover disclosures (SAST Reg 29), promoter pledges/encumbrance. These are structured feeds, parsed in code with no LLM. |
| D29 | Insider activity display | A **per-stock insider panel**, always current. A **card only past a threshold** (starting values, tuned in practice): promoter or promoter-group net buy/sell ≥ 0.25% of equity **or** ≥ ₹50 cr over 30 days; any increase in pledged shares; any insider trade during the company's trading-window closure; KMP/director open-market **buy** ≥ ₹1 cr. Pledge truth = quarterly shareholding pattern; events keep it current between quarters. Insider-feed completeness to be verified against the announcements feed. |
| D30 | Triage audit | About **300 items/week** on the Batch API, weighted toward Lane C skips, against a written definition of "material". The owner spot-checks some "not material" verdicts monthly. |
| D31 | KPI dictionary | Shared metrics + sector packs for the 15 Nifty 50 industries (financials supported from day 1). Unmatched items → `other` + review queue. **Claude drafts, owner approves.** |
| D32 | Fact time model | Every fact has `period` (what it's about) and `disclosed_at` (when the market learned it). Restatements/corrections create a new version; the old one is kept and marked replaced. |
| D33 | Commitment tracking | States: open → met / missed / revised up/down / delayed / withdrawn / silently dropped. Items with a due date resolve against reported results at the due date. **Silently dropped** = not mentioned in **2 consecutive commentary events** (concall, presentation, leadership commentary) where outlook was discussed. Bare results filings don't count. For companies whose guidance has only ever appeared at one point in the year (e.g., Q4 only), the clock runs only on those commentary events. A company that stops giving commentary gets a separate "commentary stopped" flag, not drops. Claim types: reported · guidance · target · aspiration · analyst question · third-party; only reported + guidance count when comparing delivery against promises. |
| D34 | Lifecycle | Demerger → memory copied to the new company only for the business it took over, linked back to the original, **human review every time**. Merger → linked, not merged. Rename/symbol change → no change (`security_id`). |
| D35 | Owner correction screen | Yes. Private; every edit logged and shown publicly as "corrected". |
| D36 | Scope exclusions | Consensus estimates: **out of scope**. Non-NSE sources (news, rating rationales, BSE-only filings): **later**. |
| D37 | Graph: link sources | **Explicit statements in filings only** (named counterparty + relation). No LLM-inferred links. |
| D38 | Graph: impact reach | **One hop.** The linked company gets a context line in its dossier/timeline. *Provisional:* it gets its own card only if the filing names it **and** the amount is ≥ 2% of the linked company's TTM revenue (or market cap for deals). |
| D39 | Graph: unlisted counterparties | *Provisional:* named counterparties → entities (with aliases); unnamed ("a leading European OEM") → kept as text, never guessed. |
| D40 | Group companies | **Yes:** promoter-group structures seeded from shareholding-pattern disclosures, so group-level pledges, related-party deals and red flags show across group companies from day 1. |
| D41 | Prompt-injection defence | Filing text is passed to Gemini as data, never as instructions. Gemini has **read-only** context tools only. Strict output schema, or rejected. Quote verification + XBRL/identity checks block invented numbers. Instruction-like text in PDFs is flagged for review. |
| D42 | Public error reports | "Report an error" link on every card → owner review queue. |
| D43 | Staging | Separate staging D1/R2/queues. Every prompt/model change runs on staging against the gold set before production. |
| D44 | Backups | D1 Time Travel (30 days) + weekly full export to R2 kept 12 weeks. Full rebuild from raw files tested before launch. |
| D45 | Alerts | Email to owner: pipeline stalled > 1 h, daily Gemini spend > 80% of cap, any dead-letter item, NSE error spike. |
| D46 | Freshness indicator | Public "data updated HH:MM IST" status on the site. |

---

## 2. What I checked against live NSE (2026-11-02, from a cloud container)

| Claim | Evidence |
|---|---|
| Archive host reachable from cloud | `nsearchives` → 200 for bhavcopy, PR bundle, index CSV, EQUITY_L, RSS, attachment PDFs. |
| Announcements API reachable from cloud | `www.nseindia.com/api/corporate-announcements` → 200, with or without cookies, including by date range. |
| `quote-equity` blocked from cloud | 403, with and without cookies. Hence D8. |
| UDiFF history starts 2024-01-01 | 2024-01-01 → 200; 2023-12-29 and earlier → 404. |
| MCAP file starts 2024-02-01 | Every PR bundle up to 2024-01-31 lacks it. |
| Share count gives exact CA factor | BAJFINANCE ex 2025-06-16: issue size 619,878,652 → 6,198,786,520 = 10.000×. The price ratio says 9.948×. |
| `PrvsClsgPric` is not CA-adjusted | BAJFINANCE prev close on 2025-06-16 = 9331.00. |
| ISIN changes on CA | BAJFINANCE INE296A01024 → INE296A01032. |
| NSE 52-week high/low is unadjusted | PD file: 9788 / 925. |
| Weekend sessions exist | Bhavcopy exists for Sat 2024-01-20 and Sat 2025-02-01. Mon 2024-01-22 (holiday) → 404. |
| Weekend **filings** exist | Announcements were filed on Sun 2026-11-02. |
| Announcement volume | 2025-10-01: **629 announcements, 50 categories, all with PDFs, ~1.4 GB, largest 41 MB, all flagged `hasXbrl`.** |
| Category ≠ importance | Top categories that day: Shareholders meeting 173, General Updates 97, Updates 61, Press Release 24, Trading Window 23… |

**Still to verify: the same endpoints from Cloudflare's network** (run `probe/`, §13).

---

## 3. Phase 1 — Market data

### 3.1 Sources
| Dataset | URL pattern | Frequency |
|---|---|---|
| UDiFF bhavcopy | `nsearchives…/content/cm/BhavCopy_NSE_CM_0_0_0_{YYYYMMDD}_F_0000.csv.zip` | Daily |
| PR bundle (`MCAP*`, `Bc*`) | `nsearchives…/archives/equities/bhavcopy/pr/PR{DDMMYY}.zip` | Daily |
| Equity master | `nsearchives…/content/equities/EQUITY_L.csv` | Daily |
| Nifty 50 list | `nsearchives…/content/indices/ind_nifty50list.csv` | Daily |
| Classification | `www.nseindia.com/api/quote-equity?symbol=…` (owner's machine) | Quarterly / monthly for new listings |

Raw market files are small (about 1 MB/day), so they're kept in R2 under `raw/{dataset}/{YYYY}/{MM}/…`. That allows a full rebuild without contacting NSE.

### 3.2 Data model (D1 `market`)
Identity is an internal `security_id`. Symbol and ISIN are attributes with history.
```
security            (security_id PK, entity_id FK→graph.entity, company_name, listing_date, status)
security_identifier (security_id, kind[symbol|isin], value, valid_from, valid_to)
classification      (security_id, macro_sector, sector, industry, basic_industry, as_of_date)
price_daily         (security_id, trade_date, series, o,h,l,c, prev_close_nse, volume, value, trades)  -- raw, never mutated
shares_daily        (security_id, trade_date, issue_size, face_value, mcap, mcap_source[nse|derived])
corp_action         (ca_id, security_id, ex_date, type, raw_purpose, ratio_num, ratio_den, rights_price, amount, status)
adj_factor          (security_id, ex_date, factor, method[share_ratio|bc_ratio|terp|price_ratio|manual], ca_id)
index_membership    (index_code, security_id, valid_from, valid_to)
index_snapshot      (index_code, snapshot_date, security_id)
trading_calendar    (trade_date, had_session)
pipeline_run        (run_id, job, file_date, status, rows, error, started_at, finished_at)
latest_snapshot     (security_id PK, …)    -- precomputed for the site
```
- Adjusted price = raw × product of `adj_factor` over later ex-dates. It's computed, not stored. Volume adjusts inversely.
- Market cap is never adjusted.
- January 2024 market cap is derived from February share count and marked `mcap_source = derived`.

### 3.3 Adjustment rules
| Type | Factor applied before ex-date | Check |
|---|---|---|
| Split / Bonus | `issue_size(ex-1) / issue_size(ex)` | Must match the Bc ratio within 0.1%, else review |
| Rights `a:b @ P` | `TERP / close(ex-1)`, `TERP = (b·close + a·P)/(a+b)` | |
| Demerger / Capital reduction | Price-ratio estimate | Always review |
| Jan 2024 (no MCAP file) | Bc ratio only | `method = bc_ratio` |
| Dividend | none | Recorded |

### 3.4 Quality gates (a date is not written if any check fails)
- Row count within ±5% of the 20-day median.
- Schema is exact.
- `low ≤ open, close ≤ high`, and all prices > 0.
- `|mcap − issue × close| / mcap < 0.5%`.
- ≥ 99% of EQ rows join to MCAP.
- Unexplained adjusted jumps beyond ±35% → review queue.
- Unexplained share-count change > 2% → review.
- Nifty snapshot has exactly 50 rows.

### 3.5 Acceptance tests
1. BAJFINANCE adjusted close on 2025-06-13 = 933.10, and the series is continuous across 2025-06-16.
2. Nifty 50 adjusted series has zero unexplained jumps from Jan 2024 to today.
3. Our market cap = NSE's MCAP to the rupee from 2024-02-01.
4. Re-running any date changes 0 rows.
5. A rebuild from R2 is identical.
6. The corporate-action review queue is empty.

### 3.6 Backfill
- About 700 dates × 2 files, plus `Bc*` from 2022 onward.
- Throttled to about 1 request per second.
- Runs on Workers Paid (Free allows 100k D1 writes per day; the backfill is about 3.5 M).

---

## 4. Phase 2 — Announcement intelligence

### 4.1 End-to-end flow (target: under 15 minutes, typically about 5)
```
Cron (every 2–5 min) ─ poll corporate-announcements API (+ RSS as backup source)
  └─ new seq_id → D1 announcement row (metadata) ─────────────► queue: triage
triage  ─ Tier 0 rules + Tier 1 cheap LLM on subject + page 1 ─► skip | memory-only | card
extract ─ fetch PDF/XBRL → split pages → route (text | vision) → facts with verbatim quotes
verify  ─ code checks quotes, units, periods, XBRL cross-check ─► accepted | rejected | low_confidence
context ─ pre-fetch by event type + Gemini tool calls (bounded) ─► context pack
analyse ─ Gemini writes the card from verified facts + context only
commit  ─ card + facts + dossier updates + graph links → D1; embeddings → Vectorize; purge cache
```
Each stage is a separate queue, so failures retry per stage and a bad document goes to a dead-letter queue without blocking the rest.

### 4.2 Raw layer (no long-term PDF storage, D17)
- **Kept forever:** NSE metadata (seq_id, symbol, ISIN, category, subject, timestamps, attachment URL, file size) + SHA-256 of the PDF + **per-page extracted text** (compressed, in R2) + XBRL.
- **PDFs** of results, concalls, presentations and annual-report sections are kept for **90 days** (for reprocessing while prompts are tuned), then deleted.
- If NSE later moves a file, the per-page text plus the hash still support every citation.

### 4.3 Triage: nothing is lost silently
| Tier | Cost | Rule |
|---|---|---|
| 0 | free | Drop by rule only for **proven boilerplate** categories (Trading Window, Newspaper Publication, Loss of Share Certificate, …) **and** only if the subject passes a keyword check (no "results", "order", "acquisition", "resign", "fraud", …). |
| 1 | ~cents/day | Cheapest Gemini model reads subject + page 1 → `skip` / `memory_only` / `card`. |
| 2 | main cost | Full extraction and analysis. |
- **Every announcement, even skipped ones, gets a timeline row** in the stock's memory.
- **Weekly audit:** a random sample of skipped and memory-only items is re-checked by a stronger model. This gives a measured **miss rate**, and Tier 0/1 rules are tuned from evidence, not guesses.
- Grouping: one real event filed several times (intimation → outcome → results → press release → presentation → concall) becomes **one event** with a single evolving card (§4.7).

### 4.4 Extraction guardrails (known failure modes)
| Failure mode | Guardrail (enforced by code, not by prompt) |
|---|---|
| Scanned pages and charts misread | Route **each page**: text layer → text; scan/chart → that single page sent to Gemini as a one-page PDF. Numbers read from charts are `low_confidence` unless confirmed by text or XBRL. |
| Analyst questions saved as management claims | A transcript is split into **speaker turns by code**, using the participant list. Each speaker is tagged management/analyst/moderator. Claims come **only from management turns**. Analyst questions are stored separately as `market_concerns`. |
| Wrong numbers / wrong quarter | Results numbers come **only from XBRL**. Every LLM-extracted number must carry `period` (Indian FY normalised), `unit` (₹ crore/lakh/million, normalised to ₹), `basis` (consolidated/standalone). Presentation numbers are cross-checked against XBRL, and mismatches are flagged. |
| Hallucinated facts | Every fact needs a **verbatim quote + page number**. Code checks the quote exists in the page text (normalised fuzzy match). Failure → rejected. |
| Opinion becoming "fact" | Facts (from filings) and analysis (Gemini's views) live in **separate tables**. Analysis is **never** an input to extraction. Later analysis can read earlier analysis only as clearly labelled opinion. |
- Each fact stores `model`, `prompt_version` and `extractor_version`. Because raw page text is kept, memory can be **rebuilt** when prompts improve.

### 4.5 Memory: structured first
D1 `memory` (per stock, keyed by `security_id`; every row has `source_announcement_id`, `page`, `quote`, `known_at`, `confidence`):
```
fact                 (generic: subject, predicate, value, unit, period, basis)
financials_quarterly (from XBRL only)
guidance             (metric, target, period, said_at, status[open|met|missed|revised|withdrawn])
capex_project        (name, amount, capacity, location, expected_completion, status)
order_book           (customer_entity_id?, value, duration, segment, announced_at)
capacity             (product_entity_id, capacity, unit, location, as_of)
management_change    (person, role, change, effective)
litigation           (counterparty, amount, forum, status)
credit_rating        (agency, rating, outlook, instrument, date)
commitment           (text, due_by, status)       -- "plant commissioning by Q3 FY26"
market_concern       (question theme, asked_by_firm, concall_date)
timeline             (every announcement incl. skipped, one line each)
```
- **Point in time:** every row has `known_at`. Any analysis "as of date T" sees only rows with `known_at ≤ T`, so there's no look-ahead.
- **Unstructured text** (management commentary, MD&A passages) is embedded in **Vectorize** with metadata `{security_id, type, period, known_at}`, so searches are always filtered to a stock and a time.

### 4.6 Context retrieval (answering "Gemini asks, our code fetches")
1. **Pre-fetch by event type** (deterministic, 1 round trip):
   - results → last 8Q financials + open guidance + commitments due + last concall concerns
   - order win → order book + revenue run-rate + capacity + customer entity
   - capex → existing capex projects + debt + cash flow
   - management change → management history + recent red flags
   - credit rating → rating history + debt
2. **Tool calls** (Gemini function calling), for example `get_financials(stock, metric, periods)`, `get_guidance(stock)`, `get_capex(stock)`, `get_balance_sheet(stock, periods)`, `get_order_book(stock)`, `get_linked_entities(stock, relation)`, `search_commentary(stock, query, before_date)`, `get_price_context(stock, window)`.
   **Capped at 5 calls per announcement.** Every call and its answer is logged with the card.
3. **Vector search** only through `search_commentary`.
4. Numbers in the context pack come from our tables. **Gemini never does arithmetic**: growth, margins and ratios are computed in code and passed in.

### 4.7 Card (output of one event)
```
card (card_id, event_id, security_id, created_at, updated_at, version)
  headline, event_type
  what_happened[]       facts with citation (announcement, page, quote)
  numbers[]             metric, value, unit, period, basis, source, vs prior period
  vs_past_context[]     confirms | contradicts | new — e.g. "guided ₹500 cr capex (Q1 concall), now ₹700 cr"
  materiality           factual size only, computed in code (e.g. order value as % of TTM revenue, deal value as % of market cap) — no score (D21)
  linked_impacts[]      entity, relation, why affected
  red_flags[]           auditor resignation, pledge increase, delay, related-party, qualification
  watch_items[]         new commitments added to the dossier
  technical_context     computed in code from price data (trend, 52w position on adjusted prices, volume vs 20d avg)
  provenance            model, prompt_version, tool calls, cost, processing time
  confidence_gate       published | published_unverified
```
- **Event grouping:** later filings for the same event update the card (new version) instead of creating a new one.
- **Memory-only items** update the dossier and timeline with no card.
- **Autonomous site:** below the confidence threshold a card is shown with an **"unverified"** badge, never hidden and never shown as authoritative.

### 4.8 Relationship graph (D1 `graph`)
```
entity        (entity_id, kind[listed_company|unlisted_company|commodity|product|govt_body|person], name)
entity_alias  (entity_id, alias, source)                 -- "L&T", "Larsen & Toubro", "LT"
relation      (from_entity, to_entity, kind[supplier_of|customer_of|subsidiary_of|competitor_of|uses_material|produces|promoter_of],
               source_announcement_id, quote, confidence, valid_from, valid_to)
```
- Every listed security maps to an `entity` from day 1. Unlisted companies, products and materials are created when extraction finds them.
- **Name matching (entity resolution)** is the hard part: exact alias → fuzzy match → LLM suggestion → **review queue** when unsure. A wrong merge is worse than a missing link.
- **Linked impact** is shown on the card. A separate card for a linked stock is created only at high confidence.
- Commodity price data comes later (D19). The `commodity` entities and `uses_material` relations are built now, so prices just plug in.

### 4.9 Sources in scope
| Source | Scope |
|---|---|
| Announcements (all categories) | Triage per §4.3 |
| Financial results | **XBRL** for numbers. PDF only for notes and commentary. |
| Investor presentations | Yes, page-routed |
| Concall transcripts | Yes, with speaker-turn parsing |
| Annual report | Only these sections: MD&A, segment results, capacity/capex, related-party transactions, contingent liabilities, auditor's report qualifications, top customers/suppliers if disclosed |
| Backfill | Limited: Nifty 50 results, concalls and presentations for the last 4 quarters, so dossiers aren't empty at launch |

### 4.10 Budget ($100/month total, D18)
| Item | Estimate |
|---|---|
| Workers Paid (includes D1/Queues/R2 base allowances) | $5 |
| R2 / Vectorize overage at Nifty 50 scale | ~$0–3 |
| Gemini (triage on cheapest model, extraction/analysis on mid-tier, stronger model only for concalls and weekly audit) | **cap ~$85** |
| Headroom | ~$7 |
- **A hard daily cap in code**, since Gemini has no hard cap that I know of. Token cost is tracked per call. At 80% of the daily cap, only `card`-tier items are processed. At 100%, items are queued for the next day, and the data-health page shows why.
- **Full universe is about 46× the volume and won't fit in $100.** Expanding will be a budget decision, made with measured cost per announcement from the Nifty 50 phase.

### 4.11 Evaluation (output quality)
- **Gold set v0:** about 50 real Nifty 50 announcements, chosen to cover results, concalls (speaker attribution), scanned PDFs, chart-heavy presentations, order wins, management changes, and **failure cases supplied by the owner**. Expected facts, numbers and impact are drafted by Claude, then **corrected by the owner** (the owner's labels are the ground truth).
- **Metrics:** fact precision/recall, number accuracy (value + unit + period + basis must all match), speaker-attribution accuracy, triage miss rate, cost and latency per item.
- **Every prompt or model change re-runs the gold set.** If it gets worse, it doesn't ship.

---

## 5. Website (initial)
- Hono API (`/api/v1`) ↔ D1, and a React + Vite SPA. Edge-cached, with the cache purged by the pipeline.
- **Phase 1 screens:** universe table (filter by sector, index, market cap), stock page (adjusted/raw chart, market cap history, corporate actions, classification history), Nifty 50 membership history, data-health page.
- **Phase 2 screens:** card feed (filter by stock, event type, impact, confidence), stock dossier (guidance tracker, capex, orders, commitments, concerns, timeline), entity/relationship view, review queues, gold-set and cost dashboard.

## 6. Repo layout
```
packages/core/        shared TS: schema types, NSE parsers, FY/period/unit normalisers, validators
workers/market/       cron: bhavcopy, PR bundle, EQUITY_L, index snapshot, CA engine
workers/announce/     cron poller + queue consumers (triage, extract, verify, context, analyse)
workers/api/          Hono API
web/                  React + Vite
tools/classify/       CLI run on the owner's machine (sector job)
tools/relay/          fallback fetch relay (only if NSE blocks Cloudflare)
db/migrations/{market,announce,memory,graph}/
eval/gold/            gold set (metadata + expected outputs; no NSE PDFs committed)
probe/                throwaway Cloudflare reachability check
.github/workflows/    ci.yml only
```

## 7. Risks
| Risk | Mitigation |
|---|---|
| NSE blocks Cloudflare IPs | `probe/` first. Fallback is a relay on the owner's machine or a VPS (§0). |
| NSE changes formats or APIs | Strict schema checks fail loudly. Parsers are versioned. RSS backup source for announcements. |
| LLM errors compound in memory | Quote verification, XBRL as numeric truth, facts and opinions separated, rebuildable memory. |
| Triage drops important items | Weekly measured miss-rate audit. Every item gets a timeline row. |
| Wrong entity merges | Review queue. Prefer a missing link over a wrong one. |
| Gemini cost overrun | Hard daily cap + tiered models + cost per item on the dashboard. |
| Gemini model deprecation or behaviour change | Provider interface + gold-set regression on every change. |
| Public repo leaks secrets | Secrets in Cloudflare/GitHub secrets and local `.dev.vars` (git-ignored). No data in git. |
| Publishing NSE data publicly | Licensing review before switching off Cloudflare Access. |

## 8. Build order
1. **Probe from Cloudflare** (owner runs `probe/`) → confirm or switch to the relay fallback.
2. Monorepo skeleton, D1 migrations, CI, shared parsers with real-file fixtures (BAJFINANCE 2025-06-13/16).
3. Market worker: fetch → validate → load. CA engine + identity resolution.
4. Backfill (on Workers Paid) → Phase 1 acceptance tests on Nifty 50 → full universe for market data.
5. Classification CLI (owner's machine).
6. API + minimal private website (Phase 1 screens).
7. Gold set v0 (Claude draft → owner review) **before** any Phase 2 prompt work.
8. Announcement poller + triage + timeline (no LLM extraction yet) → measure volume and categories for Nifty 50.
9. Extraction + verification guardrails → score against the gold set.
10. Memory tables + context retrieval + cards → score again → go live for Nifty 50.
11. Graph links, weekly triage audit, cost dashboard.

## 9. Owner actions
1. ✅ Cloudflare account (Free).
2. **Run `probe/`** (see `probe/README.md`) 3–4 times, including once after 22:00 IST, and share the JSON output.
3. **Share 10–20 known failure cases** (announcement link + what went wrong) for the gold set.
4. Before backfill/go-live: upgrade to **Workers Paid**, create a Gemini API key on a **paid** tier, and create a Cloudflare API token for CI deploys.

## 9b. Proposed, awaiting owner decision — Financial statements & restatements (2026-11-02)
**Verified:** NSE results XBRL (INFY Q3 FY25, consolidated, `in-bse-fin` taxonomy) has **only the current quarter and year-to-date**; there are **no comparative-period columns**. Restated prior-period figures therefore appear **only in the PDF**. NSE results metadata also distinguishes Ind-AS old/new formats and a separate bank format.
1. **Three storage layers:**
   - **As filed:** every XBRL fact (tag, context, value, unit, decimals, filing id), lossless and versioned per filing.
   - **Canonical model:** our own standard line items, mapped from XBRL tags, with **four templates**: industrial (Schedule III), bank, NBFC, insurance.
   - **Views:** any presentation (Screener-like summary, detailed statements) is computed from the canonical model. **No outside convention is the storage format.**
2. **Versioned values:** key = (security, statement, line, period, consolidated/standalone, version). Versions: *original* (that period's own XBRL) and *restated* (comparative column in a later filing's PDF). Nothing is ever overwritten.
3. **PDF table extraction with accounting identity checks in code:** e.g. Income = Revenue + Other income; PBT = Income − Expenses ± Exceptional; PAT = PBT − Tax; segment revenues sum to total. If an identity fails → rejected/review.
4. **Restatement detection:** a later filing's comparative differs from our stored original by > 0.5% → restatement flagged, reason classified (merger/demerger, discontinued operations, accounting policy change, **error correction = red flag**).
5. **Consolidated vs standalone:**
   - Both are always stored; **basis is part of every value's key**, and nothing is ever stored without it.
   - Each company has a **primary basis**, set per company, not globally: consolidated for most corporates; **standalone for banks** (the bank is the standalone entity; subsidiaries are insurance/AMC etc.); **both** for holding companies (e.g. Bajaj Finserv, Grasim, where standalone income is largely dividends from subsidiaries).
   - Basis changes are detected (e.g. a company starts consolidating after acquiring its first subsidiary) → series break marker, never silently joined.
   - Consolidated profit always splits **attributable to owners** vs non-controlling interest. EPS/valuation use attributable profit.
   - **AI inputs:** every number in a context pack carries its basis. The pack contains the primary basis only, unless the event is about the other one. PDF extraction records basis per table (from the table heading). **Code rejects any card comparison that mixes bases.** Management commentary is tagged with the basis it refers to when stated; when unclear it's marked unknown and never used in a numeric comparison.
6. *Open:* EBITDA definition (proposed: excludes other income; the company's own reported EBITDA is stored separately). Default series (proposed: latest restated, with a marker; original always available). Default basis (proposed: consolidated where available, standalone also stored).

## 10. Open questions
- **Funding gap:** NSE EOD licence ≈ ₹1.18 lakh/yr incl. GST per display medium (≈ $113/month for the website alone) > the $100/month budget. No ads or sponsors (D22).

To revisit: index backfill from NSE announcements, more indices, commodity price source, and the licensing review before going public.
