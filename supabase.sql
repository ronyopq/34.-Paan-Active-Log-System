-- 1. Create the app_state table
CREATE TABLE IF NOT EXISTS public.app_state (
  state_key TEXT PRIMARY KEY,
  state_json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Turn on RLS for safety, but allow anon access for now
ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to app_state for anon"
  ON public.app_state FOR ALL
  USING (true)
  WITH CHECK (true);

-- 2. Create the activities storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('activities', 'activities', true)
ON CONFLICT (id) DO NOTHING;

-- Allowed operations for anon users to the activities bucket
CREATE POLICY "Allow public read access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'activities');

CREATE POLICY "Allow public insert access"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'activities');

CREATE POLICY "Allow public update access"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'activities');
