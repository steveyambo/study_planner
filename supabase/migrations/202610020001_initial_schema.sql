-- Phase 6 du guide. Executer une seule fois dans le SQL Editor Supabase.
-- La transaction annule toute cette migration en cas d'erreur.
begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  timezone text not null default 'America/New_York',
  created_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  code text not null check (length(trim(code)) > 0),
  name text not null check (length(trim(name)) > 0),
  color text not null default '#4f46e5' check (color ~ '^#[0-9a-fA-F]{6}$'),
  revision_multiplier numeric(4,2) not null default 2 check (revision_multiplier > 0),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, code)
);

-- Jours ISO : lundi = 1, dimanche = 7. Les horaires restent en heure locale.
create table public.course_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  start_time time not null,
  end_time time not null,
  check (end_time > start_time),
  unique (id, course_id),
  unique (course_id, day_of_week, start_time, end_time)
);

create table public.exams (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  exam_date date not null,
  start_time time not null,
  end_time time not null,
  importance smallint not null default 2 check (importance between 1 and 3),
  notes text not null default '',
  check (end_time > start_time)
);

create table public.availabilities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  start_time time not null,
  end_time time not null,
  check (end_time > start_time),
  unique (user_id, day_of_week, start_time, end_time)
);

create table public.revision_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references public.profiles(id) on delete cascade,
  intervals integer[] not null default array[1,3,7,14],
  check (
    array_ndims(intervals) = 1 and cardinality(intervals) > 0
    and array_position(intervals, null) is null
    and 0 < all(intervals)
  )
);

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  course_id uuid not null,
  source_course_session_id uuid,
  scheduled_date date not null,
  start_time time not null,
  end_time time not null,
  duration_minutes integer not null check (duration_minutes > 0),
  revision_stage integer not null check (revision_stage > 0),
  status text not null default 'planned' check (status in ('planned','completed','missed','cancelled')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key (course_id, user_id) references public.courses(id, user_id) on delete cascade,
  foreign key (source_course_session_id, course_id)
    references public.course_sessions(id, course_id)
    on delete set null (source_course_session_id),
  check (end_time > start_time),
  check (extract(epoch from (end_time - start_time)) = duration_minutes * 60),
  check ((status = 'completed') = (completed_at is not null))
);

create index course_sessions_course_idx on public.course_sessions(course_id);
create index exams_course_date_idx on public.exams(course_id, exam_date);
create index availabilities_user_day_idx on public.availabilities(user_id, day_of_week);
create index study_sessions_user_date_idx on public.study_sessions(user_id, scheduled_date);
create index study_sessions_course_idx on public.study_sessions(course_id, user_id);
create index study_sessions_source_idx on public.study_sessions(source_course_session_id, course_id);

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.course_sessions enable row level security;
alter table public.exams enable row level security;
alter table public.availabilities enable row level security;
alter table public.revision_rules enable row level security;
alter table public.study_sessions enable row level security;

create policy own_profile on public.profiles for all to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy own_courses on public.courses for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_course_sessions on public.course_sessions for all to authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and c.user_id = (select auth.uid())))
  with check (exists (select 1 from public.courses c where c.id = course_id and c.user_id = (select auth.uid())));
create policy own_exams on public.exams for all to authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and c.user_id = (select auth.uid())))
  with check (exists (select 1 from public.courses c where c.id = course_id and c.user_id = (select auth.uid())));
create policy own_availabilities on public.availabilities for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_revision_rules on public.revision_rules for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_study_sessions on public.study_sessions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.profiles, public.courses, public.course_sessions,
  public.exams, public.availabilities, public.revision_rules, public.study_sessions from anon;
grant select, insert, update, delete on public.profiles, public.courses, public.course_sessions,
  public.exams, public.availabilities, public.revision_rules, public.study_sessions to authenticated;

-- Initialisation automatique des nouveaux comptes, avec chemin de recherche fixe.
create function public.initialize_study_planner_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, full_name)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  insert into public.revision_rules(user_id) values (new.id);
  return new;
end;
$$;
revoke all on function public.initialize_study_planner_user() from public, anon, authenticated;
create trigger study_planner_user_created after insert on auth.users
  for each row execute function public.initialize_study_planner_user();

-- Couvre aussi les comptes deja crees avant cette migration.
insert into public.profiles(id, full_name)
  select id, coalesce(raw_user_meta_data ->> 'full_name', '') from auth.users
  on conflict (id) do nothing;
insert into public.revision_rules(user_id)
  select id from public.profiles on conflict (user_id) do nothing;

commit;
