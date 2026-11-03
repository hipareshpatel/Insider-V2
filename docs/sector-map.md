# Sector map — draft for owner review (D121, #240, #290)

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
