-- D129 + dividend-only parsing: these open items were raised under the old rules and need no owner action.
DELETE FROM review_item WHERE status='open' AND subject_db='market' AND (
  summary LIKE 'Share count changed%'
  OR (summary LIKE 'Unparsed corporate action:%' AND (summary LIKE '%DIV%' OR summary LIKE '%DV%') AND summary NOT LIKE '%BONUS%' AND summary NOT LIKE '%SPLT%' AND summary NOT LIKE '%RIGHTS%')
  OR (summary LIKE 'Corporate action needs review:%' AND summary LIKE '%DIV%' AND summary LIKE '%demerger/capital reduction%' AND summary NOT LIKE '%DEMERGER%'));
