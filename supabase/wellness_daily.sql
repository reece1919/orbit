-- ORBIT Wellness baseline (already applied to Supabase on 2026-10-14).
-- Keep only dated, source-attributed, minimal wellness summaries in this table.
-- No client writes; authorized owner reads require MFA AAL2.
CREATE TABLE IF NOT EXISTS public.wellness_daily (
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_date date NOT NULL,
  steps integer CHECK (steps IS NULL OR steps BETWEEN 0 AND 150000),
  resting_heart_rate_bpm numeric(5,1) CHECK (resting_heart_rate_bpm IS NULL OR resting_heart_rate_bpm BETWEEN 20 AND 260),
  weight_lb numeric(6,2) CHECK (weight_lb IS NULL OR weight_lb BETWEEN 25 AND 1200),
  body_fat_percent numeric(5,2) CHECK (body_fat_percent IS NULL OR body_fat_percent BETWEEN 0 AND 100),
  sleep_minutes integer CHECK (sleep_minutes IS NULL OR sleep_minutes BETWEEN 0 AND 1440),
  source text NOT NULL DEFAULT 'Apple Health via ChatGPT Health' CHECK (char_length(source)<=90),
  synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(owner_id,metric_date)
);
ALTER TABLE public.wellness_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wellness_daily FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.wellness_daily TO authenticated;
DROP POLICY IF EXISTS wellness_read_verified_owner ON public.wellness_daily;
CREATE POLICY wellness_read_verified_owner ON public.wellness_daily FOR SELECT TO authenticated
USING ((SELECT auth.uid())=owner_id AND (SELECT auth.jwt()->>'aal')='aal2');
