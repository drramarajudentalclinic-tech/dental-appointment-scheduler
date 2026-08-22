-- Dental Appointment Scheduler
-- Run this entire file in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'receptionist'
    check (role in ('doctor', 'receptionist')),
  created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mobile text not null,
  appointment_date date not null,
  appointment_time time not null,
  doctor_name text not null,
  age integer,
  treatment text,
  case_no text,
  status text not null default 'SCHEDULED'
    check (status in ('SCHEDULED', 'COMPLETED', 'CANCELLED')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_age_check check (age is null or (age >= 0 and age <= 120))
);

-- Allow the same date/time for different doctors.
-- Prevent only duplicate ACTIVE/SCHEDULED or COMPLETED appointments
-- for the same doctor at the exact same date and time.
create unique index if not exists appointments_active_doctor_slot_unique
on public.appointments (appointment_date, appointment_time, lower(trim(doctor_name)))
where status in ('SCHEDULED', 'COMPLETED');

create index if not exists appointments_date_time_idx
on public.appointments (appointment_date, appointment_time);

create index if not exists appointments_mobile_idx
on public.appointments (mobile);

create index if not exists appointments_case_no_idx
on public.appointments (case_no);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists appointments_set_updated_at on public.appointments;

create trigger appointments_set_updated_at
before update on public.appointments
for each row
execute function public.set_updated_at();

-- Automatically create a profile when a Supabase Auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'receptionist')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- Enable Row Level Security.
alter table public.profiles enable row level security;
alter table public.appointments enable row level security;

-- Profiles: authenticated staff can read profiles.
drop policy if exists "authenticated users can read profiles" on public.profiles;
create policy "authenticated users can read profiles"
on public.profiles
for select
to authenticated
using (true);

-- Profiles: a user may update their own profile.
drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Appointments: authenticated clinic users can read.
drop policy if exists "authenticated users can read appointments" on public.appointments;
create policy "authenticated users can read appointments"
on public.appointments
for select
to authenticated
using (true);

-- Appointments: authenticated clinic users can create.
drop policy if exists "authenticated users can insert appointments" on public.appointments;
create policy "authenticated users can insert appointments"
on public.appointments
for insert
to authenticated
with check (created_by = auth.uid());

-- Appointments: authenticated clinic users can update.
drop policy if exists "authenticated users can update appointments" on public.appointments;
create policy "authenticated users can update appointments"
on public.appointments
for update
to authenticated
using (true)
with check (true);

-- Appointments: authenticated clinic users can permanently delete.
drop policy if exists "authenticated users can delete appointments" on public.appointments;
create policy "authenticated users can delete appointments"
on public.appointments
for delete
to authenticated
using (true);

-- Enable realtime for the appointment table.
do $$
begin
  alter publication supabase_realtime add table public.appointments;
exception
  when duplicate_object then null;
end $$;

-- IMPORTANT:
-- The unique index allows:
-- 24 Aug 10:30 Dr. Rama Raju -> Patient A   ✅
-- 24 Aug 10:30 Dr. Suresh    -> Patient B   ✅
-- but prevents:
-- 24 Aug 10:30 Dr. Rama Raju -> Patient C   ❌
-- while the original appointment is active/completed.
--
-- CANCELLED appointments do not occupy the slot, so it can be reused.