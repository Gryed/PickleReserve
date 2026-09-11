-- PHASE 10
-- Weekend pricing per court

alter table public.courts
add column if not exists weekend_pricing_enabled boolean
default false;

alter table public.courts
add column if not exists weekend_price_per_hour numeric
default null;