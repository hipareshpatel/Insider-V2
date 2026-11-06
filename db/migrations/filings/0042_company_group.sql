-- D40 (owner yes, 6 Nov): each focus company's promoter group, from the exact promoter flags of its latest shareholding
-- filing. group_name NULL = not in a group of the 250 (row kept when a company leaves a group; nothing deleted).
CREATE TABLE company_group (
  security_id  INTEGER PRIMARY KEY,
  group_name   TEXT,                 -- the promoter entity shared by most of the group's companies
  members      TEXT NOT NULL,        -- JSON: the group's NSE symbols
  entities     TEXT NOT NULL,        -- JSON: the linking promoter entities (first 8)
  computed_at  TEXT NOT NULL
);
