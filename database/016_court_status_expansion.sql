-- Remove the existing status check constraint if it exists
ALTER TABLE public.courts
DROP CONSTRAINT IF EXISTS courts_status_check;

-- Allow three court statuses
ALTER TABLE public.courts
ADD CONSTRAINT courts_status_check
CHECK (
  status IN (
    'available',
    'maintenance',
    'not_available'
  )
);