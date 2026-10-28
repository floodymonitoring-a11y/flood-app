-- Add CP (cellphone) number support to profiles.
-- Run in Supabase SQL Editor.

-- 1. Add phone column
alter table public.profiles add column if not exists phone text;

-- 2. Update signup trigger to store cp_number from user metadata
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'cp_number', ''),
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 3. Backfill phone for existing users from auth metadata
update public.profiles p
set phone = coalesce(u.raw_user_meta_data->>'cp_number', p.phone, '')
from auth.users u
where p.id = u.id
  and (p.phone is null or p.phone = '');

-- 4. (Optional) allow users to update their own phone
-- Already covered by profiles_update_own policy.
