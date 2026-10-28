-- Fix infinite recursion in profiles RLS policies.
-- Run this in your Supabase SQL Editor.

-- 1. Create a security-definer helper that checks admin status WITHOUT triggering RLS recursion.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- 2. Drop the recursive policies.
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_admin" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;
drop policy if exists "profiles_delete_admin" on public.profiles;

-- 3. Recreate policies using the helper (no recursion).
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_select_admin"
  on public.profiles for select
  using (public.is_admin());

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles_update_admin"
  on public.profiles for update
  using (public.is_admin());

create policy "profiles_delete_admin"
  on public.profiles for delete
  using (public.is_admin());

-- 4. Fix app_settings policies too (they also queried profiles recursively).
drop policy if exists "settings_select_auth" on public.app_settings;
drop policy if exists "settings_upsert_admin" on public.app_settings;

create policy "settings_select_auth"
  on public.app_settings for select
  using (auth.role() = 'authenticated');

create policy "settings_upsert_admin"
  on public.app_settings for all
  using (public.is_admin())
  with check (public.is_admin());

-- 5. Backfill profile row for this user (if missing) and promote to admin.
insert into public.profiles (id, email, full_name, role)
select u.id, u.email, coalesce(u.raw_user_meta_data->>'full_name', ''), 'user'
from auth.users u
where u.id = '07daaa93-ecdc-4df4-8cba-8f91f93ac8f7'
  and not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

update public.profiles set role = 'admin' where id = '07daaa93-ecdc-4df4-8cba-8f91f93ac8f7';
