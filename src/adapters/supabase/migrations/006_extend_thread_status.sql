-- Extend rc_threads.status with 'pending' (fixed, awaiting reporter verification)
-- and 'dismissed' (won't fix / by design / duplicate).
-- Safe to re-run.

ALTER TABLE rc_threads DROP CONSTRAINT IF EXISTS rc_threads_status_check;

ALTER TABLE rc_threads
  ADD CONSTRAINT rc_threads_status_check
  CHECK (status IN ('open', 'pending', 'resolved', 'dismissed'));
