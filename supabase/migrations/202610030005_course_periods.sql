-- Executer une fois apres 202610030004_complete_study_session.sql.
begin;
alter table public.courses
  add column starts_on date,
  add column ends_on date,
  add constraint courses_period_order check (starts_on is null or ends_on is null or ends_on >= starts_on);
alter table public.profiles add column course_period_version smallint not null default 1;

-- Une modification de periode retire les propositions pour les cours futurs exclus.
-- Les occurrences passees, terminees et manquees restent dans l'historique.
create function public.invalidate_course_period()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  today date;
begin
  if row(new.starts_on,new.ends_on) is not distinct from row(old.starts_on,old.ends_on) then return null; end if;
  select (now() at time zone timezone)::date into today
    from public.profiles where id = new.user_id for update;
  update public.course_occurrences o set is_obsolete = true
    where o.user_id = new.user_id and o.course_id = new.id and o.source_course_date >= today
      and ((new.starts_on is not null and o.source_course_date < new.starts_on)
        or (new.ends_on is not null and o.source_course_date > new.ends_on))
      and not exists(select 1 from public.study_sessions h where h.user_id = new.user_id
        and h.source_course_session_key = o.source_course_session_key and h.source_course_date = o.source_course_date
        and h.status in ('completed','missed'));
  update public.study_sessions h set status = 'cancelled', cancellation_reason = 'source_changed'
    where h.user_id = new.user_id and h.course_id = new.id and h.status = 'planned'
      and h.source_course_date >= today and h.scheduled_date >= today
      and ((new.starts_on is not null and h.source_course_date < new.starts_on)
        or (new.ends_on is not null and h.source_course_date > new.ends_on));
  return null;
end;
$$;
revoke all on function public.invalidate_course_period() from public, anon, authenticated;
create trigger courses_period_changed after update of starts_on,ends_on on public.courses
  for each row execute function public.invalidate_course_period();

create or replace function public.replace_schedule(
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
  -- Conserver les tombstones des anciennes occurrences futures invalidees, meme sans revisions.
  update public.course_occurrences o set is_obsolete = true
    where o.user_id = account_id and not o.is_obsolete
      and exists(select 1 from public.course_sessions s where s.id = o.source_course_session_key
        and s.effective_from is not null and o.source_course_date >= s.effective_from
        and (s.day_of_week <> extract(isodow from o.source_course_date)
          or (o.source_start_time is not null and o.source_start_time <> s.start_time)
          or (o.source_end_time is not null and o.source_end_time <> s.end_time)))
      and not exists(select 1 from public.study_sessions h where h.user_id = account_id
        and h.source_course_session_key = o.source_course_session_key and h.source_course_date = o.source_course_date
        and h.status in ('completed','missed'));
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
      left join lateral (select o.source_start_time, o.source_end_time from public.course_occurrences o
        where o.user_id = account_id and o.source_course_session_key = s.id
          and o.source_course_date = item.source_course_date and not o.is_obsolete
          and (s.effective_from is null or item.source_course_date < s.effective_from)) history on true
      where s.id = item.source_course_session_id and c.id = item.course_id and c.user_id = account_id
        and c.archived_at is null
        and (c.starts_on is null or item.source_course_date >= c.starts_on)
        and (c.ends_on is null or item.source_course_date <= c.ends_on)
        and ((s.day_of_week = extract(isodow from item.source_course_date)
          and (s.effective_from is null or item.source_course_date >= s.effective_from))
          or ((s.effective_from is null or item.source_course_date < s.effective_from)
            and exists(select 1 from public.course_occurrences o where o.user_id = account_id
              and o.source_course_session_key = s.id and o.source_course_date = item.source_course_date and not o.is_obsolete)));
    if not found then raise exception 'invalid_source'; end if;
    if not coalesce((select range_agg(tsrange(item.scheduled_date + a.start_time, item.scheduled_date + a.end_time, '[)'))
      @> tsrange(item.scheduled_date + item.start_time, item.scheduled_date + item.end_time, '[)')
      from public.availabilities a where a.user_id = account_id and a.day_of_week = extract(isodow from item.scheduled_date)), false)
      then raise exception 'schedule_conflict'; end if;
    if exists(select 1 from public.course_sessions s join public.courses c on c.id = s.course_id
      where c.user_id = account_id and c.archived_at is null and item.scheduled_date between p_course_start and p_course_end
        and (c.starts_on is null or item.scheduled_date >= c.starts_on)
        and (c.ends_on is null or item.scheduled_date <= c.ends_on)
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

commit;
