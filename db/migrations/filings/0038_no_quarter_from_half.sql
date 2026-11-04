-- Owner #345: a quarter is never derived from a half-year file (half-year minus the previous quarter is not a filed
-- figure). Removes the rows the live loader computed that way between deploy 130 and this fix (extractor q-from-h-v1,
-- origin 'computed' only; filed rows are untouched). One read of fin_value (~2M rows read, a few writes at most).
DELETE FROM fin_value WHERE extractor_version = 'q-from-h-v1' AND origin = 'computed';
