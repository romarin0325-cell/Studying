-- Only aggregate counters: no IP, ID, per-request time, payload or save data.
CREATE TABLE daily_counts (
  day TEXT NOT NULL,
  event TEXT NOT NULL,
  bucket TEXT NOT NULL,
  hits INTEGER NOT NULL CHECK(hits > 0),
  PRIMARY KEY(day,event,bucket)
) WITHOUT ROWID;
CREATE TABLE daily_budget (
  day TEXT PRIMARY KEY,
  used INTEGER NOT NULL CHECK(used >= 0 AND used <= 10000),
  admitted INTEGER NOT NULL CHECK(admitted IN (0,1))
) WITHOUT ROWID;
