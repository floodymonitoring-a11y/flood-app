-- SMS alert state tracking for hysteresis (no repeat SMS on same level).
-- Run in Supabase SQL Editor.

create table if not exists public.sms_alert_state (
  id int primary key default 1,
  state jsonb not null default '{"water_level":"Normal","rain_rate":"Normal","wind_speed":"Normal","last_reading_id":null}'::jsonb,
  updated_at timestamptz default now()
);

insert into public.sms_alert_state (id, state)
values (1, '{"water_level":"Normal","rain_rate":"Normal","wind_speed":"Normal","last_reading_id":null}'::jsonb)
on conflict (id) do nothing;

alter table public.sms_alert_state enable row level security;

-- Only service role (edge function) should write; authenticated users can read.
drop policy if exists "sms_state_select_auth" on public.sms_alert_state;
create policy "sms_state_select_auth"
  on public.sms_alert_state for select
  using (auth.role() = 'authenticated');

-- (Optional) sms alert log for audit
create table if not exists public.sms_alert_log (
  id bigserial primary key,
  created_at timestamptz default now(),
  recipient text,
  content text,
  status text,
  reference_id text,
  reading_id bigint,
  levels jsonb
);

alter table public.sms_alert_log enable row level security;

drop policy if exists "sms_log_select_admin" on public.sms_alert_log;
create policy "sms_log_select_admin"
  on public.sms_alert_log for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
