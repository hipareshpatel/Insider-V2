-- Parser now understands REIT/InvIT distributions, trust debt service and misspelt rights; duplicate "not understood" items removed.
DELETE FROM review_item WHERE status='open' AND subject_db='market' AND (
  summary LIKE 'Corporate action not understood, no adjustment made:%'
  OR (summary LIKE 'Unparsed corporate action:%' AND (summary LIKE '%DISTRIB%' OR summary LIKE '%DISTRBUTN%' OR summary LIKE '%INT PAYMENT%' OR summary LIKE '%INTEREST/PART%' OR summary LIKE '%SP DIV%'))
  OR (summary LIKE 'Corporate action needs review:%' AND summary LIKE '%INTEREST/PART REDEMPTION%'));
