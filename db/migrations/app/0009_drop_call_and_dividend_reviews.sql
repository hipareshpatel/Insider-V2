-- Parser now reads call money and more dividend spellings (patterns kept under D1's 50-byte LIKE limit).
DELETE FROM review_item WHERE status='open' AND subject_db='market' AND summary LIKE 'Unparsed corporate action:%' AND (
  summary LIKE '%FINCAL%' OR summary LIKE '%FSTFIN%' OR summary LIKE '%FIRSTCAL%' OR summary LIKE '%INTDV%'
  OR summary LIKE '%SP DIV%' OR summary LIKE '%SPLDIV%' OR summary LIKE '%DISTRIBUTION -%');
