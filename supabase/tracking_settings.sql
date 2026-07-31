-- Run this once in Supabase → SQL Editor.
-- Stores the Google tracking codes set from the Admin Dashboard → Tracking Codes page.

create table if not exists tracking_settings (
  id int primary key default 1,
  landing_code text default '',
  thankyou_code text default '',
  updated_at timestamptz default now()
);

insert into tracking_settings (id) values (1)
  on conflict (id) do nothing;

alter table tracking_settings enable row level security;

-- Matches the permission model already used by form_settings / app_settings:
-- the admin dashboard writes directly with the anon key (no Supabase Auth session).
create policy "tracking_settings_select" on tracking_settings
  for select using (true);

create policy "tracking_settings_upsert" on tracking_settings
  for insert with check (true);

create policy "tracking_settings_update" on tracking_settings
  for update using (true) with check (true);
