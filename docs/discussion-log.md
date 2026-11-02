# Discussion Log — owner statements → where they are recorded

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

## Consistency check procedure (run after every update)
1. Every decision ID D1…Dn appears exactly once in Appendix A, in order, with no gaps.
2. Every log entry 1…n is numbered once, with no gaps.
3. Every D-reference in the log and the plan points to an existing decision.
4. Every decision is reflected (by ID) in the design sections §1–§16, not only in Appendix A.
5. Open items in this log match §16 of the plan.
6. Conflicting owner answers are flagged ⚠ in both documents until resolved.
*Last run 2026-11-02 after entry #202: all checks pass (118 decisions, 202 entries).*

## Open items from this log
- **#202** Owner actions: trademark search for "Disclo"; add `disclo.in` to Cloudflare; enable Email Routing.
**Claude's questions Q1–Q12:** answered in #171–#181; Q1 name choice pending (D99).
- **#20** Performance targets: approved (§14, D94).
- **#35/#72** Card sections after real output.
- **#53** Licence funding: decided, option D (D88).
- **#73** Failure cases: found via daily audits and the private period (D84, D86).
