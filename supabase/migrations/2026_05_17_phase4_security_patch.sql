-- ============================================================
-- Phase 4: Final security patch
-- - migrate lis_one_users plaintext password to password_hash
-- - harden auth endpoints with rate limiting in app code
-- - ensure anon access is SELECT-only across lis_one_* tables
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.lis_one_users
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

ALTER TABLE public.lis_one_users
  ALTER COLUMN password DROP NOT NULL;

-- Backfill bcrypt hashes for any legacy plaintext users.
UPDATE public.lis_one_users
SET password_hash = COALESCE(password_hash, crypt(password, gen_salt('bf')))
WHERE password IS NOT NULL
  AND (password_hash IS NULL OR password_hash = '');

-- Once hashed, plaintext may be nulled safely.
UPDATE public.lis_one_users
SET password = NULL
WHERE password_hash IS NOT NULL
  AND password IS NOT NULL;

-- ============================================================
-- RLS hardening: remove any lingering anon mutation policies
-- ============================================================
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename LIKE 'lis_one_%'
      AND policyname LIKE 'lis_one_anon_all_%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename LIKE 'lis_one_%'
  LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO anon USING (true)',
      'lis_one_anon_read_' || t, t);
  END LOOP;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

COMMIT;
