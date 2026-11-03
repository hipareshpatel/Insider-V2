-- D141/D146 (owner #288): UEL — insolvency resolution plan (NCLT Indore, 13 Oct 2023), capital reduction before relisting
-- in Apr 2024, demerger record date 22 May 2024; price x3.7 across it with an unchanged share count = re-pricing on exit
-- from insolvency, not a demerger factor. Series break, no factor.
UPDATE review_item SET status='rejected', decided_at='2026-11-03T10:10:00Z',
  decision='{"decided_by":"claude (#288, D141/D146)","reason":"Series break, no factor: insolvency resolution plan (NCLT Indore order 13-Oct-2023; capital reduction and relisting Apr 2024; demerger record date 22-May-2024). Price 43.80 -> 160.95 with NSE share count unchanged (105,301,272).","sources":["insolvencytracker.in 2023-10-17","nsearchives CML62102 (record date 22-May-2024)","BSE filing: recommencement of trading post capital reduction"]}'
WHERE review_id=253 AND subject_ref LIKE '%|2024-05-22' AND status='open';
