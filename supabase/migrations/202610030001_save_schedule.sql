begin;

alter table public.study_sessions add column source_course_date date;
create unique index study_sessions_occurrence_stage_idx
  on public.study_sessions(user_id, source_course_session_id, source_course_date, revision_stage)
  where status <> 'cancelled';

-- Une première sauvegarde complète, atomique, sérialisée par compte.
create or replace function public.save_initial_schedule(p_sessions jsonb, p_break_minutes integer, p_course_start date, p_course_end date)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  account_id uuid := auth.uid();
  item record;
  today date;
  count_saved integer := 0;
begin
  if account_id is null then raise exception 'authentication_required'; end if;
  select (now() at time zone timezone)::date into today
    from public.profiles where id = account_id for update;
  if not found then raise exception 'profile_missing'; end if;
  if exists(select 1 from public.study_sessions where user_id = account_id and status <> 'cancelled') then
    raise exception 'schedule_exists';
  end if;
  if p_sessions is null or jsonb_typeof(p_sessions) <> 'array' then raise exception 'invalid_schedule'; end if;
  if jsonb_array_length(p_sessions) not between 1 and 5000 or p_break_minutes is null or p_break_minutes not between 0 and 60
    or p_course_start is null or p_course_end is null or p_course_end < p_course_start then
    raise exception 'invalid_schedule';
  end if;
  for item in select * from jsonb_to_recordset(p_sessions) as r(
    course_id uuid, source_course_session_id uuid, source_course_date date,
    scheduled_date date, start_time time, end_time time, duration_minutes integer, revision_stage integer
  ) loop
    if item.scheduled_date <= today or item.scheduled_date <= item.source_course_date
      or item.source_course_date not between p_course_start and p_course_end then raise exception 'invalid_schedule'; end if;
    if not exists(select 1 from public.course_sessions s join public.courses c on c.id = s.course_id
      where s.id = item.source_course_session_id and c.id = item.course_id and c.user_id = account_id
        and s.day_of_week = extract(isodow from item.source_course_date)) then raise exception 'invalid_source'; end if;
    if not coalesce((select range_agg(tsrange(item.scheduled_date + a.start_time, item.scheduled_date + a.end_time, '[)'))
      @> tsrange(item.scheduled_date + item.start_time, item.scheduled_date + item.end_time, '[)')
      from public.availabilities a where a.user_id = account_id
        and a.day_of_week = extract(isodow from item.scheduled_date)), false) then raise exception 'schedule_conflict'; end if;
    if exists(select 1 from public.course_sessions s join public.courses c on c.id = s.course_id
      where c.user_id = account_id and item.scheduled_date between p_course_start and p_course_end
        and s.day_of_week = extract(isodow from item.scheduled_date)
        and s.start_time < item.end_time and s.end_time > item.start_time) then raise exception 'schedule_conflict'; end if;
    if exists(select 1 from public.exams e join public.courses c on c.id = e.course_id
      where c.user_id = account_id and e.exam_date = item.scheduled_date
        and e.start_time < item.end_time and e.end_time > item.start_time) then raise exception 'schedule_conflict'; end if;
    if exists(select 1 from public.exams e where e.course_id = item.course_id
      and e.exam_date >= item.source_course_date and e.exam_date <= item.scheduled_date) then raise exception 'schedule_conflict'; end if;
    -- Comparaison en timestamp : respecte aussi les pauses autour de minuit.
    if exists(select 1 from public.study_sessions s where s.user_id = account_id and s.status <> 'cancelled'
      and (s.scheduled_date + s.start_time) < (item.scheduled_date + item.end_time) + make_interval(mins => p_break_minutes)
      and (s.scheduled_date + s.end_time) + make_interval(mins => p_break_minutes) > (item.scheduled_date + item.start_time)) then raise exception 'schedule_conflict'; end if;
    if exists(select 1 from public.study_sessions s where s.user_id = account_id
      and s.source_course_session_id = item.source_course_session_id and s.source_course_date = item.source_course_date
      and s.status <> 'cancelled' and (s.revision_stage >= item.revision_stage or s.scheduled_date >= item.scheduled_date)) then
      raise exception 'invalid_revision_order';
    end if;
    insert into public.study_sessions(user_id, course_id, source_course_session_id, source_course_date,
      scheduled_date, start_time, end_time, duration_minutes, revision_stage, status)
    values(account_id, item.course_id, item.source_course_session_id, item.source_course_date,
      item.scheduled_date, item.start_time, item.end_time, item.duration_minutes, item.revision_stage, 'planned');
    count_saved := count_saved + 1;
  end loop;
  return count_saved;
end;
$$;
revoke all on function public.save_initial_schedule(jsonb, integer, date, date) from public, anon;
grant execute on function public.save_initial_schedule(jsonb, integer, date, date) to authenticated;
commit;
