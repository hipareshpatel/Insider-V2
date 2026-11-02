-- graph DB (§5.6). Explicit links only (D37); one hop (D38); unlisted counterparties per D39.

CREATE TABLE entity (
  entity_id     INTEGER PRIMARY KEY,
  kind          TEXT NOT NULL CHECK (kind IN ('listed_company','unlisted_company','person','investor','promoter_group','plant','commodity','product','govt_body')),
  name          TEXT NOT NULL,              -- as filed (D39)
  security_id   INTEGER,                    -- listed companies
  country       TEXT,
  listed_abroad INTEGER NOT NULL DEFAULT 0,
  cin           TEXT,                       -- later, with MCA data (D39)
  detail        TEXT,                       -- JSON (plant fields D77, NIC code, ...)
  created_at    TEXT NOT NULL
);

CREATE TABLE entity_alias (
  entity_id     INTEGER NOT NULL REFERENCES entity(entity_id),
  alias         TEXT NOT NULL,
  alias_norm    TEXT NOT NULL,              -- normalised for exact-match merge (D39)
  source        TEXT NOT NULL,
  PRIMARY KEY (entity_id, alias_norm)
);
CREATE INDEX ix_alias_norm ON entity_alias (alias_norm);

CREATE TABLE relation (
  relation_id   INTEGER PRIMARY KEY,
  kind          TEXT NOT NULL CHECK (kind IN ('supplier_of','customer_of','subsidiary_of','competitor_of','uses_material','produces','promoter_of','holds','operates_plant')),
  from_entity   INTEGER NOT NULL REFERENCES entity(entity_id),
  to_entity     INTEGER NOT NULL REFERENCES entity(entity_id),
  source_ref    TEXT NOT NULL,
  quote         TEXT,
  confidence    REAL NOT NULL,
  valid_from    TEXT,
  valid_to      TEXT,
  origin        TEXT NOT NULL CHECK (origin IN ('explicit','industry_default'))
);
CREATE INDEX ix_rel_from ON relation (from_entity, kind);
CREATE INDEX ix_rel_to ON relation (to_entity, kind);
