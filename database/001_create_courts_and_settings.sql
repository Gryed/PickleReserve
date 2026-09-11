-- Courts table
create table courts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text,
  price_per_hour numeric not null,
  status text not null default 'available' check (status in ('available', 'maintenance')),
  created_at timestamptz default now()
);

-- Settings table (single row config)
create table settings (
  id int primary key default 1,
  show_court_type boolean not null default true,
  constraint single_row check (id = 1)
);

insert into settings (id, show_court_type) values (1, true);

-- Enable RLS
alter table courts enable row level security;
alter table settings enable row level security;

-- Allow everyone to read courts (customers need to see them)
create policy "Anyone can view courts" on courts for select using (true);

-- Only authenticated users (admins) can insert/update/delete
create policy "Authenticated users can manage courts" on courts for all using (auth.uid() is not null);

-- Same for settings
create policy "Anyone can view settings" on settings for select using (true);
create policy "Authenticated users can manage settings" on settings for all using (auth.uid() is not null);