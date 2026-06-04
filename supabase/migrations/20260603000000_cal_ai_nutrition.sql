-- Cal AI-style nutrition domain
-- Adds food catalog, meal logging, daily goals, summaries, hydration, and weight progress.

-- Enums
DO $$ BEGIN
  CREATE TYPE meal_type AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE scan_source AS ENUM ('photo_ai', 'barcode', 'nutrition_label', 'manual');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- User-level goals and preferences
CREATE TABLE IF NOT EXISTS public.daily_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calories_target integer NOT NULL DEFAULT 2000 CHECK (calories_target > 0),
  protein_target_g numeric(8,2) NOT NULL DEFAULT 140,
  carbs_target_g numeric(8,2) NOT NULL DEFAULT 200,
  fat_target_g numeric(8,2) NOT NULL DEFAULT 70,
  water_target_ml integer NOT NULL DEFAULT 2500 CHECK (water_target_ml >= 0),
  steps_target integer NOT NULL DEFAULT 8000 CHECK (steps_target >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_goals_user_unique UNIQUE (user_id)
);

ALTER TABLE public.daily_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own goals" ON public.daily_goals;
CREATE POLICY "Users can read own goals"
  ON public.daily_goals FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own goals" ON public.daily_goals;
CREATE POLICY "Users can insert own goals"
  ON public.daily_goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own goals" ON public.daily_goals;
CREATE POLICY "Users can update own goals"
  ON public.daily_goals FOR UPDATE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_daily_goals_updated_at ON public.daily_goals;
CREATE TRIGGER set_daily_goals_updated_at
  BEFORE UPDATE ON public.daily_goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Food catalog (global rows by default; can include user-created foods)
CREATE TABLE IF NOT EXISTS public.foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  brand text,
  serving_size_g numeric(8,2),
  calories_per_100g numeric(8,2) NOT NULL DEFAULT 0,
  protein_per_100g numeric(8,2) NOT NULL DEFAULT 0,
  carbs_per_100g numeric(8,2) NOT NULL DEFAULT 0,
  fat_per_100g numeric(8,2) NOT NULL DEFAULT 0,
  barcode text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Foods are readable" ON public.foods;
CREATE POLICY "Foods are readable"
  ON public.foods FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert foods" ON public.foods;
CREATE POLICY "Users can insert foods"
  ON public.foods FOR INSERT
  WITH CHECK (auth.uid() = created_by_user_id OR created_by_user_id IS NULL);

DROP POLICY IF EXISTS "Users can update own foods" ON public.foods;
CREATE POLICY "Users can update own foods"
  ON public.foods FOR UPDATE
  USING (auth.uid() = created_by_user_id);

DROP TRIGGER IF EXISTS set_foods_updated_at ON public.foods;
CREATE TRIGGER set_foods_updated_at
  BEFORE UPDATE ON public.foods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS foods_name_idx ON public.foods USING gin (to_tsvector('simple', name));
CREATE INDEX IF NOT EXISTS foods_barcode_idx ON public.foods (barcode);

-- Meal logs
CREATE TABLE IF NOT EXISTS public.meal_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_type meal_type NOT NULL,
  eaten_at timestamptz NOT NULL DEFAULT now(),
  scan_source scan_source NOT NULL DEFAULT 'manual',
  total_calories numeric(10,2) NOT NULL DEFAULT 0,
  total_protein_g numeric(10,2) NOT NULL DEFAULT 0,
  total_carbs_g numeric(10,2) NOT NULL DEFAULT 0,
  total_fat_g numeric(10,2) NOT NULL DEFAULT 0,
  ai_confidence numeric(5,2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meal_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own meal logs" ON public.meal_logs;
CREATE POLICY "Users can read own meal logs"
  ON public.meal_logs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own meal logs" ON public.meal_logs;
CREATE POLICY "Users can insert own meal logs"
  ON public.meal_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own meal logs" ON public.meal_logs;
CREATE POLICY "Users can update own meal logs"
  ON public.meal_logs FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own meal logs" ON public.meal_logs;
CREATE POLICY "Users can delete own meal logs"
  ON public.meal_logs FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_meal_logs_updated_at ON public.meal_logs;
CREATE TRIGGER set_meal_logs_updated_at
  BEFORE UPDATE ON public.meal_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS meal_logs_user_eaten_idx ON public.meal_logs (user_id, eaten_at DESC);

-- Meal items snapshot (preserves history even if foods table changes)
CREATE TABLE IF NOT EXISTS public.meal_log_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_log_id uuid NOT NULL REFERENCES public.meal_logs(id) ON DELETE CASCADE,
  food_id uuid REFERENCES public.foods(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  serving_g numeric(10,2) NOT NULL DEFAULT 100,
  calories numeric(10,2) NOT NULL DEFAULT 0,
  protein_g numeric(10,2) NOT NULL DEFAULT 0,
  carbs_g numeric(10,2) NOT NULL DEFAULT 0,
  fat_g numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meal_log_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own meal items" ON public.meal_log_items;
CREATE POLICY "Users can read own meal items"
  ON public.meal_log_items FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own meal items" ON public.meal_log_items;
CREATE POLICY "Users can insert own meal items"
  ON public.meal_log_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own meal items" ON public.meal_log_items;
CREATE POLICY "Users can update own meal items"
  ON public.meal_log_items FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own meal items" ON public.meal_log_items;
CREATE POLICY "Users can delete own meal items"
  ON public.meal_log_items FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS meal_log_items_meal_idx ON public.meal_log_items (meal_log_id);

-- Daily rollups
CREATE TABLE IF NOT EXISTS public.daily_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_date date NOT NULL,
  calories_consumed numeric(10,2) NOT NULL DEFAULT 0,
  protein_consumed_g numeric(10,2) NOT NULL DEFAULT 0,
  carbs_consumed_g numeric(10,2) NOT NULL DEFAULT 0,
  fat_consumed_g numeric(10,2) NOT NULL DEFAULT 0,
  water_ml integer NOT NULL DEFAULT 0,
  steps integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_summaries_user_date_unique UNIQUE (user_id, summary_date)
);

ALTER TABLE public.daily_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own daily summaries" ON public.daily_summaries;
CREATE POLICY "Users can read own daily summaries"
  ON public.daily_summaries FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own daily summaries" ON public.daily_summaries;
CREATE POLICY "Users can insert own daily summaries"
  ON public.daily_summaries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own daily summaries" ON public.daily_summaries;
CREATE POLICY "Users can update own daily summaries"
  ON public.daily_summaries FOR UPDATE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_daily_summaries_updated_at ON public.daily_summaries;
CREATE TRIGGER set_daily_summaries_updated_at
  BEFORE UPDATE ON public.daily_summaries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS daily_summaries_user_date_idx ON public.daily_summaries (user_id, summary_date DESC);

-- Body weight log
CREATE TABLE IF NOT EXISTS public.weight_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  measured_at date NOT NULL DEFAULT current_date,
  weight_kg numeric(8,2) NOT NULL CHECK (weight_kg > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT weight_logs_user_date_unique UNIQUE (user_id, measured_at)
);

ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own weights" ON public.weight_logs;
CREATE POLICY "Users can read own weights"
  ON public.weight_logs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own weights" ON public.weight_logs;
CREATE POLICY "Users can insert own weights"
  ON public.weight_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own weights" ON public.weight_logs;
CREATE POLICY "Users can update own weights"
  ON public.weight_logs FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own weights" ON public.weight_logs;
CREATE POLICY "Users can delete own weights"
  ON public.weight_logs FOR DELETE
  USING (auth.uid() = user_id);
