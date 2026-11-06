-- D40 (owner yes, 6 Nov): named holders carry whether they are in the promoter tables (1) or public (0). NULL = not
-- read yet (rows loaded before this column); the one-off /maint/shp_promoter pass fills it from the stored files.
ALTER TABLE shareholding ADD COLUMN promoter INTEGER;
