-- Counts, never unique players, conversion cohorts or retention.
SELECT day,event,SUM(hits) AS occurrences FROM daily_counts
WHERE day >= date('now','-6 days') GROUP BY day,event ORDER BY day,event;

SELECT json_extract(bucket,'$.mode') AS mode,
       json_extract(bucket,'$.tier') AS tier,
       json_extract(bucket,'$.stage') AS stage,
       json_extract(bucket,'$.result') AS result,
       json_extract(bucket,'$.wave') AS wave_band,
       SUM(hits) AS battles
FROM daily_counts WHERE event='battle_end' AND day >= date('now','-6 days')
GROUP BY mode,tier,stage,result,wave_band ORDER BY mode,tier,stage,result,wave_band;

SELECT json_extract(bucket,'$.step') AS step,
       json_extract(bucket,'$.status') AS status,SUM(hits) AS occurrences
FROM daily_counts WHERE event='tutorial_step' AND day >= date('now','-6 days')
GROUP BY step,status ORDER BY step,status;
