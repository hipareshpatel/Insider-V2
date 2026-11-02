# Field Catalogue — Draft v0 (for owner review)

This lists the fields the query builder, dashboard and dossiers can use. Each field is precomputed nightly, or after each event, into the per-stock feature table (D64).
Fields marked 🔒 are **owner-only** (D53) and never appear in public queries or APIs.

**Conventions (apply to every field):**
- **Basis:** the company's primary basis (D50) unless the field name ends in `_sa` (standalone) or `_cons` (consolidated).
- **Money:** ₹ crore. **Percentages:** in %, e.g. `15` = 15%. **Margin changes:** in basis points (`_bps`).
- **Adjusted vs reported:** "adjusted" excludes exceptional items (D52). Fields with `_rep` are as reported.
- **Prices:** corporate-action adjusted (D6) unless the name ends in `_raw`. Market cap is never adjusted.
- **Restated figures:** latest restated is the default (D48).
- **Missing data:** if a field can't be computed, it's `null` with a reason, never a sentinel value (D52). A `null` never matches a condition.
- **As-of date:** every field has one. Queries can require freshness, e.g. `as_of(pat_yoy_q) within 120d`.

---

## 1. Query language (what all three input modes compile to)

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

## 2. Identity & classification
| Field | Definition | Source |
|---|---|---|
| `symbol`, `name`, `isin` | Current identifiers | EQUITY_L, bhavcopy |
| `macro_sector`, `sector`, `industry`, `basic_industry` | NSE 4-level classification | quote-equity (owner's machine, D8) |
| `index` | Current index memberships | Index snapshots (D9) |
| `group` | Promoter group (e.g. Tata, Adani) | Shareholding pattern (D40, D56) |
| `listing_age_years` | Years since listing | EQUITY_L |
| `statement_template` | industrial / bank / NBFC / insurance | Results metadata |
| `primary_basis` | consolidated / standalone / both | D50 |

## 3. Price, liquidity & technicals (EOD)
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
| `delivery_pct_20d` | Avg delivery % (needs `sec_bhavdata_full`, archive; to be added to D1 sources) |

## 4. Valuation
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

## 5. Growth (quarterly series, last 12 quarters available to series functions)
| Field | Definition |
|---|---|
| `revenue_q`, `ebitda_q`, `pbt_q`, `pat_q` | Quarterly values (adjusted; `_rep` for reported) |
| `revenue_yoy_q`, `ebitda_yoy_q`, `pat_yoy_q`, `eps_yoy_q` | YoY growth |
| `revenue_qoq`, `pat_qoq` | QoQ growth |
| `revenue_ttm_yoy`, `pat_ttm_yoy` | TTM growth |
| `revenue_vs_trend_q` | Latest YoY growth minus the company's own 8-quarter average YoY growth (pp). The basis of "good results" (D53). |
| `pat_vs_trend_q` | Same for PAT |
| `segment_revenue_yoy[segment]` | Per reported segment |

## 6. Profitability & earnings quality
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
| `fcf_ttm_cr` | OCF − capex |

## 7. Balance sheet & working capital (half-yearly)
| Field | Definition |
|---|---|
| `net_debt_cr`, `net_debt_to_ebitda`, `debt_to_equity` | Leverage |
| `interest_coverage_ttm` | EBIT ÷ finance cost |
| `receivable_days`, `inventory_days`, `payable_days`, `working_capital_days`, `cash_conversion_cycle` | Standard, documented |
| `capex_ttm_cr`, `cwip_cr` | Investment |
| `contingent_liabilities_cr` | From annual report sections (D, §4.9) |

## 8. Sector packs (KPI dictionary, D31)
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

## 9. Guidance & commitments (memory, D33)
| Field | Definition |
|---|---|
| `guidance_open_count` | Open guidance items |
| `guidance_revised_up` / `guidance_revised_down` (series) | Per quarter, usable with `count(…, last=n)` |
| `guidance_met_rate_8q` | Share of guidance items resolved as met in the last 8 quarters |
| `last_guidance_change` | Date + direction |
| `commitments_due_next_2q` | Commitments with a due date in the next 2 quarters |
| `commitments_overdue`, `commitments_silently_dropped_12m` | Count |
| `commentary_stopped` | Flag (D33) |

## 10. Orders & capacity
| Field | Definition |
|---|---|
| `order_book_cr`, `order_book_to_ttm_revenue` | Order book and coverage (years of revenue) |
| `order_inflow_ttm_cr`, `large_orders_90d` | Inflow; count of orders ≥ 2% of TTM revenue |
| `capacity_additions_due_next_2q` | From commitments |

## 11. Ownership, insiders & pledges (D28, D29, D56)
| Field | Definition |
|---|---|
| `promoter_holding_pct`, `promoter_holding_change_qoq` | Shareholding pattern |
| `promoter_pledged_pct`, `pledge_change_qoq` | Pledge truth from shareholding pattern + events |
| `fii_holding_pct`, `dii_holding_pct`, `mf_holding_pct`, `public_holding_pct` (+ `_change_qoq`) | Shareholding pattern |
| `insider_net_buy_30d_cr`, `insider_net_buy_90d_pct_equity` | Insider-trading disclosures; ESOP exercise excluded |
| `promoter_group_net_buy_90d_cr` | Promoter + promoter group |
| `insider_trades_in_window_closure_12m` | Count (red flag) |
| `sast_crossings_90d` | Takeover Reg 29 disclosures |

## 12. Events, red flags & governance
| Field | Definition |
|---|---|
| `red_flags_12m` | Count, with types |
| `auditor_change_12m`, `auditor_qualification_latest` | Governance |
| `kmp_resignations_12m`, `director_resignations_12m` | Management churn |
| `restatement_error_12m` | Error-type restatement (D48) |
| `credit_rating_latest`, `rating_action_12m` | Up / down / none |
| `regulatory_actions_12m` | SEBI/RBI/other orders |
| `litigation_open_cr` | Disclosed exposure |
| `monitoring_agency_deviation` | Deviation in use of raised funds |

## 13. Corporate actions & results timing
| Field | Definition |
|---|---|
| `dividend_ttm`, `buyback_12m`, `last_split_bonus_date` | Corporate actions |
| `last_result_date`, `next_result_date`, `days_to_next_result` | From board-meeting intimations |
| `concall_scheduled_next` | Date, if intimated |

## 14. Data quality (always queryable)
| Field | Definition |
|---|---|
| `data_basis`, `basis_switch_date` | D50 |
| `restated_fields` | Which fields are restated |
| `mcap_source` | nse / derived (Jan 2024) |
| `as_of(field)` | Freshness of any field |

## 15. 🔒 Owner-only (D53)
| Field | Definition |
|---|---|
| `signal_*` | Leading-indicator flags (guidance up, order coverage, provisional business update strength, …) |
| `signal_outcome_hit_rate` | From the outcome ledger, per signal type |
| `predicted_*` | **Only after a backtest beats the naive baseline** |

---

## Open questions on this draft
1. **Missing or unwanted fields?** Especially sector packs, which come from your own analysis habits.
2. **Trend definition for `trend(…)`:** proposed = slope of a linear fit over *n* quarters, "rising" if slope > 0 and ≥ (n−2) of the quarter-on-quarter changes are positive. OK?
3. **"Large order" threshold:** 2% of TTM revenue (same as the graph rule D38)?
4. **Delivery %** needs one more daily archive file (`sec_bhavdata_full`). Add it to the market-data sources?
