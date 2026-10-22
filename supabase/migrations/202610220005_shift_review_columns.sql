ALTER TABLE public.daily_shift_plans ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'rascunho';
ALTER TABLE public.daily_shift_plans ADD COLUMN IF NOT EXISTS reviewed_by uuid;
ALTER TABLE public.daily_shift_plans ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE public.daily_shift_plans ADD CONSTRAINT daily_shift_review_allowed CHECK(review_status IN ('rascunho','revisado'));