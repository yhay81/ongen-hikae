SELECT
  COUNT(DISTINCT CASE WHEN name = 'visited' THEN session_hash END) AS visitors,
  COUNT(DISTINCT CASE WHEN name = 'record_added' THEN session_hash END) AS record_users,
  SUM(CASE WHEN name = 'record_added' THEN 1 ELSE 0 END) AS records_added,
  COUNT(DISTINCT CASE WHEN name = 'credits_copied' THEN session_hash END) AS credit_users,
  SUM(CASE WHEN name = 'credits_copied' THEN 1 ELSE 0 END) AS credits_copied,
  COUNT(DISTINCT CASE WHEN name = 'csv_exported' THEN session_hash END) AS csv_users,
  SUM(CASE WHEN name = 'csv_exported' THEN 1 ELSE 0 END) AS csv_exports,
  COUNT(DISTINCT CASE WHEN name = 'json_exported' THEN session_hash END) AS backup_users,
  SUM(CASE WHEN name = 'json_exported' THEN 1 ELSE 0 END) AS backups,
  COUNT(DISTINCT CASE WHEN name = 'source_opened' THEN session_hash END) AS source_users,
  SUM(CASE WHEN name = 'source_opened' THEN 1 ELSE 0 END) AS source_opens,
  COUNT(DISTINCT CASE WHEN name = 'returned' THEN session_hash END) AS returned,
  COUNT(DISTINCT CASE WHEN name = 'visited' AND day >= date('now', '-6 days') THEN session_hash END) AS visitors_7d,
  (SELECT COUNT(*) FROM product_events WHERE is_qa = 1) AS qa_rows
FROM product_events
WHERE is_qa = 0;
