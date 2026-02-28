-- Add missing DELETE policies for rc_threads and rc_comments.
-- Run this if you applied migrations 001–003 before delete support was added.
-- Uses DO blocks so the migration is safe to re-run on fresh deployments
-- where 001/002 already include these policies.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'rc_threads'
      AND policyname = 'Anyone can delete threads'
  ) THEN
    CREATE POLICY "Anyone can delete threads" ON rc_threads
      FOR DELETE USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'rc_comments'
      AND policyname = 'Anyone can delete comments'
  ) THEN
    CREATE POLICY "Anyone can delete comments" ON rc_comments
      FOR DELETE USING (true);
  END IF;
END $$;
