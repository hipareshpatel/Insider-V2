# Website — everything discussed, decided, built and pending

**Compiled 2026-11-03** from: the full transcript of the first planning chat (owner statements #1–#227, read directly, not from summaries), `docs/discussion-log.md` (#228–#302, the build chat), `docs/PLAN.md` (D1–D153, §7.5, §8, §12, §14, §16), `docs/HANDOVER.md` and `docs/field-catalogue.md`.
**Rule used:** nothing assumed. Every line cites its decision (D…) or log entry (#…). Where something was proposed but never decided, it says so.

**Status marks:** ✅ decided · 🔨 built in site v0 (now offline) · 🔶 open / pending · ❌ rejected · ⚠ conflict or gap to resolve

---

## 0. Where the website stands today

- 🔨 **Site v0 was built and briefly live** (3 Nov 18:16 IST, `disclo-web`, public unlisted, D151): dashboard, stock page, data-health page (§9 of this document).
- **Owner rated v0 −10/10** (#299): it looked like an admin page, with tables first, no visual hierarchy and no Key facts, and the agreed stock-page layout (D91) wasn't followed (#300).
- ✅ **v0 taken offline** (#301, D152): public address and previews disabled; any request gets 503 + noindex.
- ✅ **Order now (D152):** data first (M0–M2 gates verified) → **data-readiness map** for every stock-page and dashboard element → **design mockups for owner approval** → only then UI code.
- ✅ **No site UI code until the owner approves a visual design** (proposed #299, adopted in D152).

---

## 1. Purpose, audience and bar

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

## 2. Product principles that shape what the site may show

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

## 3. Platform, look and technical decisions

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

## 4. Launch and access

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

## 5. Pages and their agreed contents

### 5.1 Home = market & indices dashboard ✅ (D59, D62, D67; owner #102: "a best-in-class KPI dashboard plus what you mentioned")
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

### 5.2 Stock page ✅ (D91, D92; owner #165: "5 years ok, AI write-up first, one long page")
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

### 5.3 Sector / industry page ✅ (owner idea #117, D70)
"One page that speaks for the whole sector": aggregated results trend, guidance raised vs cut, **sector commentary map** (what every company said this quarter, with quotes; D69), valuation vs own history, KPI-pack comparison, leaders/laggards, red flags, raw-material exposure, upcoming results.

### 5.4 Card feed ✅ (§8.1, D42)
Filters by stock, event type, materiality, confidence; **"report an error"** on every card.

### 5.5 Query builder ✅ (owner #104: "required and must be easy"; #109: all 3 modes; D61, D64)
- Three ways in: **plain English** (Gemini translates into our query language, shown as editable chips; **the LLM never writes SQL**; signed-in only, daily cap, cached), **visual chips**, **text expression**
- "Not understood: …" instead of guessing; a null never matches
- Saved screens + "what changed since last run"
- Fields: `docs/field-catalogue.md` (approved, D123)

### 5.6 Trackers ✅ (owner #133, D78)
Sector KPI trackers (telecom ARPU, cement/steel EBITDA per tonne, etc.; company-reported vs computed), segment-margin trackers (only where disclosed, e.g. machining/castings), export share vs margin, repeat orders from **named** customers (disclosed orders only). Export "mix-drag" estimate is owner-only.

### 5.7 Other public tools ✅
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

### 5.8 Data-health page ✅ (§8.1)
Last runs, review-queue sizes, freshness.

### 5.9 Legal pages ✅ (D115)
Terms, Privacy, Disclaimer (AI analysis, not advice; estimates labelled), Credits (TradingView notice, data sources), Contact. Drafts only until the legal consult.

### 5.10 Owner-only area (Cloudflare Access) ✅ (§8.2)
Upcoming-results signals + outcome ledger (predictions only after a backtest beats the baseline, D53); scenario calculator incl. commodity shocks (D73); event-impact screen (D77); export mix-drag (D78); pre-announcement insider-trade timing (D69); portfolio X-ray (D75); research chat (D68); rated-facility signal interpretation (D81); correction screen (D35); review queues (B5, moved later, D141); gold-set & cost dashboard.

### 5.11 Future paid tier 🔶 (D23, D93)
Accounts, API keys, exports, per-plan limits designed in; not built. External keys/exports only after licence + legal consult.

---

## 6. Cards (the core content unit)

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

## 7. Benchmarks and inspiration the owner shared

| Shared | Owner's words | What came of it |
|---|---|---|
| Two example cards from another site (Sun Pharma results, MTAR concall) | "Example but not exactly what I want. I am going to build is more useful" | Card writing rules (§6); critique: missing *why*, hype labels, no claim strength, no linked companies |
| StockScans | "See if we could benchmark anything for our side" | D67 adoptions; their scores rejected; noted they license data (CMOTS), Free + ₹500/month |
| Tijori (and its social media) | "May give you more glimpse" | Niche indices + portfolio X-ray adopted (D75); raw-material prices, macro indicators, social trends → later |
| Screener guide | One-off example | Ratio conventions (D52); Screener-style summary is one *view*, not the storage format (D47) |
| Name style | Short names like Zepto, Rapido, Zomato | Disclo chosen (#202, #239) |

⚠ **Not shared anywhere in the record: any reference site for the *visual* design.** Asked in the first chat (Q2: "Any sites whose look you like?"); the owner answered only "light" (#175).

---

## 8. Differentiators planned for the site ✅ (owner #116: "adopt all as recommended, phasing ok"; D69)
Time machine; disclosure regression detector; management credibility ledger (per company and named executive); sector commentary map; "what changed since your last visit"; disclosure timeliness; unexplained-move panel; concall audio → provisional same-day summary; forensic panel (no score). **Phasing:** data foundations from day 1, screens released after the Nifty 50 core passes acceptance.

---

## 9. What site v0 actually contained (built 3 Nov, now offline) 🔨
From HANDOVER / #297–#298:
- API `/api/v1/{dashboard, securities, stocks/:symbol, health}`; edge cache; per-IP rate limit (120/min); noindex on every response; robots disallow
- Dashboard (precomputed every 10 min); stock page (adjusted chart, quarterly results with original vs restated and filing links, balance sheet, cash flow, shareholding, PIT, board meetings, ratings, corporate actions); data-health
- After #298, aligned with: light theme, chart logo off + credits notice, restated default + switch, ISIN, 52-week range, section menu, "data updated" in IST, legal-page drafts, EPS adjusted for splits/bonuses
- Measured from a US container: stock API 290–560 ms uncached; cached TTFB 0.19–0.41 s; phone-on-4G main content 0.75–0.82 s (one cold load 2.08 s). **Not yet measured from India.**
- **Not built** (agreed): dashboard EMA participation, 52-week extremes, results-season tracker, calendar; stock page **Key facts** and **5-year annual view**; collapsible sections on mobile; source on hover/tap for every number (only period links); custom domain + zone bot protection; owner review screen

---

## 10. Pending — needs the owner or still to be discussed 🔶

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

## 11. Conflicts and gaps found while compiling ⚠
| # | Finding | Suggested resolution |
|---|---|---|
| 1 | Audience: D153 (Gen Z, MF houses, PMS) is **not in the first chat's record** (checked every owner message #1–#227) | Owner to paste the original discussion; until then D153 stands as stated in #302 |
| 2 | D13/D89 ("public only after the quality gate") vs D151 (v0 public early) vs D152 (offline) | Current state is D152 (offline); when the site returns, D89's gate applies unless the owner says otherwise |
| 3 | D99 name: first chat "different launch name" (#204) vs build chat "final: Disclo" (#239) | #239 is later, so Disclo is final; trademark check still pending |
| 4 | D91 header lists "4-level sector", but D121 gives **one level** (22 NSE sectors + announcement fill) | Header shows the one-level sector; 4-level only if a source appears |
| 5 | D62 says index P/E/P/B "vs own history"; history starts 2024, so percentiles are thin at first | Label the history length on the chart |
| 6 | Dashboard "latest important cards" and stock page "cards", "AI write-up", "latest quarter in brief" can't be shown publicly before M7 | Design must handle "not yet available" states for these sections |
