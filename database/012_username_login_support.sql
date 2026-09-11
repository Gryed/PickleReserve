alter table profiles add column username text unique;

-- Update the auto-create trigger to also save username from signup metadata

create or replace function public.handle_new_user()

returns trigger as $$

begin

  insert into public.profiles (id, role, username)

  values (new.id, 'customer', new.raw_user_meta_data->>'username');

  return new;

end;

$$ language plpgsql security definer;

-- Function to look up email by username (needed since Supabase Auth logs in via email)

create or replace function public.get_email_by_username(p_username text)

returns text as $$

  select email::text from auth.users

  where id = (select id from public.profiles where username = p_username)

  limit 1;

$$ language sql security definer;

grant execute on function public.get_email_by_username(text) to anon, authenticated;