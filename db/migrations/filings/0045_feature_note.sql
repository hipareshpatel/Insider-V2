-- Owner-approved (G2/G3 follow-up): the explanatory note a computed value carries ("computed: …", "loans on balance
-- sheet, not AUM", "taken as none …", the insurer solvency scale rule) is stored with it. Nullable; a schema change only
-- (no row is rewritten here). The next feature rebuild writes each row whose note changed once (the upsert's WHERE).
ALTER TABLE feature_value ADD COLUMN note TEXT;
