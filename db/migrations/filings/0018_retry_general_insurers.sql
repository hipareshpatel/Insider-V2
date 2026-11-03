-- General-insurer template (IRDAI IFGI layout): the held files ("industrial: core lines missing revenue,pat") load again.
-- The Ind AS 117 insurance layout (STARHEALTH, IF_INS_COM_IND_AS) is a separate class and stays held.
DELETE FROM fin_load WHERE status = 'review' AND instr(detail, 'core lines missing') > 0
  AND job_id IN (SELECT job_id FROM fetch_job WHERE instr(url, 'INTEGRATED_FILING_GI_') > 0);
