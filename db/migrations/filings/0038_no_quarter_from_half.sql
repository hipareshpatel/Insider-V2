-- Owner #345/#347: no financial figure is ever derived. Removes every row stored with origin 'computed' — the only
-- writer ever was the half-year-minus-quarter path (extractor q-from-h-v1, deploy 130 until this fix); filed rows are
-- untouched. One read of fin_value (~2M rows read, a few writes at most).
DELETE FROM fin_value WHERE origin = 'computed';
