-- Executer apres 202610030001_save_schedule.sql. Historique conserve, remplacement atomique.
begin;

alter table public.courses add column archived_at timestamptz;
alter table public.course_sessions add column effective_from date;
alter table public.profiles
  add column planning_revision bigint not null default 0,
  add column saved_planning_revision bigint,
  add column planning_preferences jsonb;
alter table public.study_sessions
  add column source_course_session_key uuid,
  add column course_code_snapshot text,
  add column course_name_snapshot text,
  add column source_start_time time,
  add column source_end_time time,
  add column revision_interval_days integer check (revision_interval_days > 0),
  add column cancellation_reason text;

update public.study_sessions s set
  source_course_session_key = s.source_course_session_id,
  course_code_snapshot = c.code,
  course_name_snapshot = c.name,
  source_start_time = (select x.start_time from public.course_sessions x where x.id = s.source_course_session_id),
  source_end_time = (select x.end_time from public.course_sessions x where x.id = s.source_course_session_id),
  revision_interval_days = (select (array(select unnest(r.intervals) order by 1))[s.revision_stage]
    from public.revision_rules r where r.user_id = s.user_id)
from public.courses c where c.id = s.course_id;

-- Les anciens plannings n'avaient pas de version de donnees ni de preferences sauvegardees.
update public.profiles p set saved_planning_revision = -1
  where exists(select 1 from public.study_sessions s where s.user_id = p.id);

drop index public.study_sessions_occurrence_stage_idx;
create unique index study_sessions_active_occurrence_stage_idx
  on public.study_sessions(user_id, source_course_session_key, source_course_date, revision_stage)
  where status in ('planned', 'completed');

-- Une modification de donnees et une sauvegarde prennent le meme verrou de profil.
-- Security invoker : ces fonctions ne contournent jamais les politiques du compte.
create function public.mark_planning_dirty()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid;
  row_data jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  if tg_op = 'UPDATE' and to_jsonb(new) = to_jsonb(old) then return null; end if;
  if tg_table_name in ('courses', 'availabilities', 'revision_rules', 'study_sessions') then
    owner_id := (row_data ->> 'user_id')::uuid;
  else
    select user_id into owner_id from public.courses where id = (row_data ->> 'course_id')::uuid;
  end if;
  update public.profiles set planning_revision = planning_revision + 1 where id = owner_id;
  return null;
end;
$$;
revoke all on function public.mark_planning_dirty() from public, anon, authenticated;
create trigger courses_planning_dirty after insert or update or delete on public.courses for each row execute function public.mark_planning_dirty();
create trigger course_sessions_planning_dirty after insert or update or delete on public.course_sessions for each row execute function public.mark_planning_dirty();
create trigger exams_planning_dirty after insert or update or delete on public.exams for each row execute function public.mark_planning_dirty();
create trigger availabilities_planning_dirty after insert or update or delete on public.availabilities for each row execute function public.mark_planning_dirty();
create trigger revision_rules_planning_dirty after insert or update or delete on public.revision_rules for each row execute function public.mark_planning_dirty();
create trigger study_sessions_planning_dirty after insert or update or delete on public.study_sessions for each row execute function public.mark_planning_dirty();

-- Un nouvel horaire apres la premiere sauvegarde ne recree pas des cours dans le passe.
create function public.date_course_session_change()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  first_saved bigint;
  today date;
begin
  if tg_op = 'INSERT' or row(new.day_of_week, new.start_time, new.end_time)
    is distinct from row(old.day_of_week, old.start_time, old.end_time) then
    select p.saved_planning_revision, (now() at time zone p.timezone)::date into first_saved, today
      from public.profiles p join public.courses c on c.user_id = p.id where c.id = new.course_id for update of p;
    if first_saved is not null then new.effective_from := today; end if;
  end if;
  return new;
end;
$$;
revoke all on function public.date_course_session_change() from public, anon, authenticated;
create trigger date_course_session_change before insert or update of day_of_week, start_time, end_time
  on public.course_sessions for each row execute function public.date_course_session_change();

-- L'archivage et les modifications d'horaires/examens sont serialises sur le profil.
create function public.require_active_parent_course()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  archived timestamptz;
begin
  perform p.id from public.profiles p join public.courses c on c.user_id = p.id
    where c.id = new.course_id for update of p;
  if not found then raise exception 'invalid_source'; end if;
  select archived_at into archived from public.courses where id = new.course_id for update;
  if not found then raise exception 'invalid_source'; end if;
  if archived is not null then raise exception 'course_archived'; end if;
  return new;
end;
$$;
revoke all on function public.require_active_parent_course() from public, anon, authenticated;
create trigger active_parent_course before insert or update on public.course_sessions for each row execute function public.require_active_parent_course();
create trigger active_parent_course before insert or update on public.exams for each row execute function public.require_active_parent_course();

create function public.profile_timezone_planning_dirty()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.planning_revision := old.planning_revision + 1;
  return new;
end;
$$;
revoke all on function public.profile_timezone_planning_dirty() from public, anon, authenticated;
create trigger timezone_planning_dirty before update of timezone on public.profiles for each row
  when (old.timezone is distinct from new.timezone) execute function public.profile_timezone_planning_dirty();

-- Le lien FK peut devenir NULL si un horaire est supprime. Son identite reste dans la cle.
create function public.preserve_study_identity()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if row(new.user_id, new.course_id, new.source_course_session_key, new.source_course_date,
      new.revision_stage, new.course_code_snapshot, new.course_name_snapshot,
      new.source_start_time, new.source_end_time, new.revision_interval_days)
    is distinct from row(old.user_id, old.course_id, old.source_course_session_key, old.source_course_date,
      old.revision_stage, old.course_code_snapshot, old.course_name_snapshot,
      old.source_start_time, old.source_end_time, old.revision_interval_days) then
    raise exception 'immutable_study_identity';
  end if;
  if new.source_course_session_id is not null
    and new.source_course_session_id is distinct from old.source_course_session_id then
    raise exception 'immutable_study_identity';
  end if;
  return new;
end;
$$;
revoke all on function public.preserve_study_identity() from public, anon, authenticated;
create trigger preserve_study_identity before update on public.study_sessions for each row execute function public.preserve_study_identity();

create function public.protect_course_history()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  -- La suppression complete du compte reste possible ; un cours avec historique est archive.
  if exists(select 1 from public.profiles where id = old.user_id)
    and exists(select 1 from public.study_sessions where course_id = old.id) then
    raise exception 'course_has_history';
  end if;
  return old;
end;
$$;
revoke all on function public.protect_course_history() from public, anon, authenticated;
create trigger protect_course_history before delete on public.courses for each row execute function public.protect_course_history();

create function public.archive_course(p_course_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  account_id uuid := auth.uid();
  today date;
begin
  if account_id is null then raise exception 'authentication_required'; end if;
  select (now() at time zone timezone)::date into today from public.profiles where id = account_id for update;
  if not found then raise exception 'profile_missing'; end if;
  update public.courses set archived_at = coalesce(archived_at, now()) where id = p_course_id and user_id = account_id;
  if not found then return false; end if;
  update public.study_sessions set status = 'cancelled', cancellation_reason = 'course_archived'
    where user_id = account_id and course_id = p_course_id and status = 'planned' and scheduled_date >= today;
  return true;
end;
$$;
revoke all on function public.archive_course(uuid) from public, anon;
grant execute on function public.archive_course(uuid) to authenticated;

create function public.replace_schedule(
  p_sessions jsonb, p_break_minutes integer, p_course_start date, p_course_end date,
  p_planning_start date, p_planning_end date, p_expected_revision bigint, p_include_overdue boolean
)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  account_id uuid := auth.uid();
  today date;
  revision bigint;
  item record;
  source record;
  rules integer[];
  count_saved integer := 0;
begin
  if account_id is null then raise exception 'authentication_required'; end if;
  select (now() at time zone timezone)::date, planning_revision into today, revision
    from public.profiles where id = account_id for update;
  if not found then raise exception 'profile_missing'; end if;
  if p_expected_revision is null or p_expected_revision <> revision then raise exception 'stale_revision'; end if;
  if p_sessions is null or jsonb_typeof(p_sessions) <> 'array' then raise exception 'invalid_schedule'; end if;
  if jsonb_array_length(p_sessions) > 5000 or p_break_minutes is null or p_break_minutes not between 0 and 60
    or p_course_start is null or p_course_end is null or p_course_end < p_course_start or p_course_end - p_course_start > 365
    or p_planning_start is null or p_planning_end is null or p_planning_start <= today
    or p_planning_end < p_planning_start or p_planning_end - p_planning_start > 90
    or p_include_overdue is null then raise exception 'invalid_schedule'; end if;
  select array(select unnest(intervals) order by 1) into rules from public.revision_rules where user_id = account_id;
  if not found then raise exception 'revision_rules_missing'; end if;

  update public.study_sessions set status = 'missed'
    where user_id = account_id and status = 'planned' and scheduled_date < today;
  -- Les anciennes generations annulees ne prouvent pas qu'un ancien cours FUTUR a eu lieu.
  update public.study_sessions h set cancellation_reason = 'source_changed'
    where h.user_id = account_id and h.status = 'cancelled' and h.source_course_date is not null
      and exists(select 1 from public.course_sessions s join public.courses c on c.id = s.course_id
        where s.id = h.source_course_session_key and c.archived_at is null and c.user_id = account_id
          and s.effective_from is not null and h.source_course_date >= s.effective_from
          and (s.day_of_week <> extract(isodow from h.source_course_date)
            or (h.source_start_time is not null and h.source_start_time <> s.start_time)
            or (h.source_end_time is not null and h.source_end_time <> s.end_time)));
  update public.study_sessions h set status = 'cancelled', cancellation_reason = case when
      exists(select 1 from public.course_sessions s join public.courses c on c.id = s.course_id
        where s.id = h.source_course_session_key and c.archived_at is null and c.user_id = account_id
          and s.effective_from is not null and h.source_course_date >= s.effective_from
          and (s.day_of_week <> extract(isodow from h.source_course_date)
            or (h.source_start_time is not null and h.source_start_time <> s.start_time)
            or (h.source_end_time is not null and h.source_end_time <> s.end_time)))
      then 'source_changed' else 'replanned' end
    where h.user_id = account_id and h.status = 'planned' and h.scheduled_date between p_planning_start and p_planning_end
      and h.source_course_session_key is not null and h.source_course_date is not null;
  update public.study_sessions s set status = 'cancelled', cancellation_reason = 'course_archived'
    where s.user_id = account_id and s.status = 'planned' and s.scheduled_date >= today
      and exists(select 1 from public.courses c where c.id = s.course_id and c.archived_at is not null);

  for item in select * from jsonb_to_recordset(p_sessions) as r(
    course_id uuid, source_course_session_id uuid, source_course_date date,
    scheduled_date date, start_time time, end_time time, duration_minutes integer,
    revision_stage integer, revision_interval_days integer
  ) order by scheduled_date, start_time, revision_stage loop
    if item.course_id is null or item.source_course_session_id is null or item.source_course_date is null
      or item.scheduled_date is null or item.start_time is null or item.end_time is null
      or item.duration_minutes is null or item.revision_stage is null or item.revision_interval_days is null
      or item.scheduled_date not between p_planning_start and p_planning_end
      or item.scheduled_date <= item.source_course_date or item.source_course_date not between p_course_start and p_course_end
      or item.duration_minutes <= 0 or item.end_time <= item.start_time
      or extract(epoch from (item.end_time - item.start_time)) <> item.duration_minutes * 60
      or item.revision_stage < 1 or item.revision_interval_days <= 0
      or not (item.revision_interval_days = any(rules)) then raise exception 'invalid_schedule'; end if;
    select coalesce(history.source_start_time, s.start_time) as start_time,
      coalesce(history.source_end_time, s.end_time) as end_time, c.code, c.name into source
      from public.course_sessions s join public.courses c on c.id = s.course_id
      left join lateral (select h.source_start_time, h.source_end_time from public.study_sessions h
        where h.user_id = account_id and h.source_course_session_key = s.id
          and h.source_course_date = item.source_course_date and h.source_start_time is not null
          and h.source_end_time is not null and (s.effective_from is null or item.source_course_date < s.effective_from)
          and (h.status <> 'cancelled' or h.cancellation_reason is distinct from 'source_changed')
          order by h.created_at, h.id limit 1) history on true
      where s.id = item.source_course_session_id and c.id = item.course_id and c.user_id = account_id
        and c.archived_at is null and ((s.day_of_week = extract(isodow from item.source_course_date)
          and (s.effective_from is null or item.source_course_date >= s.effective_from))
          or ((s.effective_from is null or item.source_course_date < s.effective_from)
            and exists(select 1 from public.study_sessions h where h.user_id = account_id
            and h.source_course_session_key = s.id and h.source_course_date = item.source_course_date
            and (h.status <> 'cancelled' or h.cancellation_reason is distinct from 'source_changed'))));
    if not found then raise exception 'invalid_source'; end if;
    if not coalesce((select range_agg(tsrange(item.scheduled_date + a.start_time, item.scheduled_date + a.end_time, '[)'))
      @> tsrange(item.scheduled_date + item.start_time, item.scheduled_date + item.end_time, '[)')
      from public.availabilities a where a.user_id = account_id and a.day_of_week = extract(isodow from item.scheduled_date)), false)
      then raise exception 'schedule_conflict'; end if;
    if exists(select 1 from public.course_sessions s join public.courses c on c.id = s.course_id
      where c.user_id = account_id and c.archived_at is null and item.scheduled_date between p_course_start and p_course_end
        and (s.effective_from is null or item.scheduled_date >= s.effective_from)
        and s.day_of_week = extract(isodow from item.scheduled_date)
        and s.start_time < item.end_time and s.end_time > item.start_time) then raise exception 'schedule_conflict'; end if;
    if exists(select 1 from public.exams e join public.courses c on c.id = e.course_id
      where c.user_id = account_id and c.archived_at is null and e.exam_date = item.scheduled_date
        and e.start_time < item.end_time and e.end_time > item.start_time) then raise exception 'schedule_conflict'; end if;
    if exists(select 1 from public.exams e where e.course_id = item.course_id
      and e.exam_date >= item.source_course_date and e.exam_date <= item.scheduled_date) then raise exception 'schedule_conflict'; end if;
    if exists(select 1 from public.study_sessions s where s.user_id = account_id and s.status in ('planned','completed')
      and (s.scheduled_date + s.start_time) < (item.scheduled_date + item.end_time) + make_interval(mins => p_break_minutes)
      and (s.scheduled_date + s.end_time) + make_interval(mins => p_break_minutes) > (item.scheduled_date + item.start_time))
      then raise exception 'schedule_conflict'; end if;
    if exists(select 1 from public.study_sessions s where s.user_id = account_id
      and s.source_course_session_key = item.source_course_session_id and s.source_course_date = item.source_course_date
      and s.status in ('planned','completed')
      and (s.revision_stage = item.revision_stage
        or (s.revision_stage < item.revision_stage and s.scheduled_date >= item.scheduled_date)
        or (s.revision_stage > item.revision_stage and s.scheduled_date <= item.scheduled_date)))
      then raise exception 'invalid_revision_order'; end if;
    insert into public.study_sessions(user_id, course_id, source_course_session_id, source_course_session_key,
      source_course_date, course_code_snapshot, course_name_snapshot, source_start_time, source_end_time,
      scheduled_date, start_time, end_time, duration_minutes, revision_stage, revision_interval_days, status)
    values(account_id, item.course_id, item.source_course_session_id, item.source_course_session_id,
      item.source_course_date, source.code, source.name, source.start_time, source.end_time,
      item.scheduled_date, item.start_time, item.end_time, item.duration_minutes, item.revision_stage,
      item.revision_interval_days, 'planned');
    count_saved := count_saved + 1;
  end loop;
  update public.profiles set saved_planning_revision = planning_revision,
    planning_preferences = jsonb_build_object('courseStart', p_course_start, 'courseEnd', p_course_end,
      'planningStart', p_planning_start, 'planningEnd', p_planning_end,
      'breakMinutes', p_break_minutes, 'includeOverdue', p_include_overdue)
    where id = account_id;
  return count_saved;
end;
$$;
revoke all on function public.replace_schedule(jsonb, integer, date, date, date, date, bigint, boolean) from public, anon;
grant execute on function public.replace_schedule(jsonb, integer, date, date, date, date, bigint, boolean) to authenticated;
revoke all on function public.save_initial_schedule(jsonb, integer, date, date) from authenticated;

commit;
