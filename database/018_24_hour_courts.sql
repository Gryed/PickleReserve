ALTER TABLE public.courts
ADD COLUMN IF NOT EXISTS is_24_hours boolean
DEFAULT false
NOT NULL;