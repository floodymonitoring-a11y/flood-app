-- Admin & settings schema for Flood Monitoring System
-- Run this in your Supabase SQL editor.

-- 1. Profiles table (one row per auth user)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create a profile when a new user signs up
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for existing users
insert into public.profiles (id, email, full_name, phone, role)
select u.id, u.email, coalesce(u.raw_user_meta_data->>'full_name', ''), coalesce(u.raw_user_meta_data->>'cp_number', ''), 'user'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- Helper function to check admin status without RLS recursion
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- RLS for profiles
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
  on public.profiles for select
  using (public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
  on public.profiles for update
  using (public.is_admin());

drop policy if exists "profiles_delete_admin" on public.profiles;
create policy "profiles_delete_admin"
  on public.profiles for delete
  using (public.is_admin());

-- 2. App settings table (SMS thresholds, etc.)
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id)
);

alter table public.app_settings enable row level security;

drop policy if exists "settings_select_auth" on public.app_settings;
create policy "settings_select_auth"
  on public.app_settings for select
  using (auth.role() = 'authenticated');

drop policy if exists "settings_upsert_admin" on public.app_settings;
create policy "settings_upsert_admin"
  on public.app_settings for all
  using (public.is_admin())
  with check (public.is_admin());

-- Seed default SMS thresholds (not yet wired to actual SMS)
insert into public.app_settings (key, value)
values (
  'sms_thresholds',
  '{
    "water_level_alert_cm": 50,
    "water_level_warning_cm": 70,
    "water_level_critical_cm": 90,
    "rain_rate_yellow_mmhr": 2.5,
    "rain_rate_orange_mmhr": 7.5,
    "rain_rate_red_mmhr": 15,
    "wind_speed_elevated_kmh": 30,
    "water_level_alert_enabled": true,
    "water_level_warning_enabled": true,
    "water_level_critical_enabled": true,
    "rain_rate_yellow_enabled": true,
    "rain_rate_orange_enabled": true,
    "rain_rate_red_enabled": true,
    "wind_speed_elevated_enabled": true
  }'::jsonb
)
on conflict (key) do nothing;

-- 3. Make your first admin: run this after creating the account via the app, replacing the email.
-- update public.profiles set role = 'admin' where email = 'your-admin@email.com';
