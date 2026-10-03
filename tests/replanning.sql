-- Base de test uniquement, avec les trois migrations. Aucun changement ne reste apres le test.
begin;
-- Le runner local cree cette fixture avant la troisieme migration pour verifier le backfill.
do $$
begin
  if exists(select 1 from public.profiles where id='77777777-0000-4000-8000-000000000001') then
    if (select saved_planning_revision from public.profiles where id='77777777-0000-4000-8000-000000000001') <> -1
      or exists(select 1 from public.study_sessions where user_id='77777777-0000-4000-8000-000000000001'
        and (source_course_session_key is null or course_name_snapshot <> 'Avant migration'
          or source_start_time <> '09:00'::time or revision_interval_days <> 1)) then
      raise exception 'test_failed: legacy schedule backfill';
    end if;
    raise notice 'Legacy planning version and immutable snapshots backfill: OK';
  end if;
end $$;
insert into auth.users(id, raw_user_meta_data) values
  ('99999999-0000-4000-8000-000000000001', '{}'),
  ('99999999-0000-4000-8000-000000000002', '{}');
insert into public.courses(id, user_id, code, name, color) values
  ('99999999-0000-4000-8000-000000000003','99999999-0000-4000-8000-000000000001','TEST','Historique','#000000');
insert into public.course_sessions(id, course_id, day_of_week, start_time, end_time) values
  ('99999999-0000-4000-8000-000000000004','99999999-0000-4000-8000-000000000003',1,'09:00','10:00');
insert into public.availabilities(user_id, day_of_week, start_time, end_time)
  select '99999999-0000-4000-8000-000000000001', d, '08:00'::time, '18:00'::time from generate_series(1,7) d;
set local role authenticated;
select set_config('request.jwt.claim.sub','99999999-0000-4000-8000-000000000001',true);

do $$
declare
  today date := (now() at time zone 'America/New_York')::date;
  course_date date := today + (8 - extract(isodow from today))::integer;
  first_row jsonb;
  second_row jsonb;
  rows jsonb;
  revision bigint;
  before_revision bigint;
  saved integer;
  completed_id uuid;
  fixed_id uuid;
  replaced_id uuid;
  missed_id uuid;
  legacy_id uuid;
begin
  first_row := jsonb_build_object('course_id','99999999-0000-4000-8000-000000000003',
    'source_course_session_id','99999999-0000-4000-8000-000000000004','source_course_date',course_date,
    'scheduled_date',course_date+1,'start_time','10:00','end_time','11:00','duration_minutes',60,
    'revision_stage',1,'revision_interval_days',1);
  second_row := first_row || jsonb_build_object('scheduled_date',course_date+3,'revision_stage',2,'revision_interval_days',3);
  rows := jsonb_build_array(first_row,second_row);
  insert into public.study_sessions(user_id, course_id, source_course_session_id, source_course_session_key,
    source_course_date, course_code_snapshot, course_name_snapshot, source_start_time, source_end_time,
    scheduled_date, start_time, end_time, duration_minutes, revision_stage, revision_interval_days, status, completed_at)
  values(auth.uid(),'99999999-0000-4000-8000-000000000003','99999999-0000-4000-8000-000000000004',
    '99999999-0000-4000-8000-000000000004',course_date-14,'TEST','Historique','09:00','10:00',
    course_date-13,'10:00','11:00',60,1,1,'completed',now()) returning id into completed_id;
  insert into public.study_sessions(user_id, course_id, source_course_session_id, source_course_session_key,
    source_course_date, scheduled_date, start_time, end_time, duration_minutes, revision_stage, revision_interval_days)
  values(auth.uid(),'99999999-0000-4000-8000-000000000003','99999999-0000-4000-8000-000000000004',
    '99999999-0000-4000-8000-000000000004',course_date-14,course_date-11,'10:00','11:00',60,2,3) returning id into missed_id;
  insert into public.study_sessions(user_id, course_id, source_course_session_id, source_course_session_key,
    source_course_date, scheduled_date, start_time, end_time, duration_minutes, revision_stage, revision_interval_days)
  values(auth.uid(),'99999999-0000-4000-8000-000000000003','99999999-0000-4000-8000-000000000004',
    '99999999-0000-4000-8000-000000000004',course_date,course_date+2,'10:00','11:00',60,1,1) returning id into replaced_id;
  insert into public.study_sessions(user_id, course_id, source_course_session_id, source_course_session_key,
    source_course_date, scheduled_date, start_time, end_time, duration_minutes, revision_stage, revision_interval_days)
  values(auth.uid(),'99999999-0000-4000-8000-000000000003','99999999-0000-4000-8000-000000000004',
    '99999999-0000-4000-8000-000000000004',course_date+7,course_date+10,'10:00','11:00',60,3,7) returning id into fixed_id;
  insert into public.study_sessions(user_id,course_id,scheduled_date,start_time,end_time,duration_minutes,revision_stage)
    values(auth.uid(),'99999999-0000-4000-8000-000000000003',course_date+2,'15:00','16:00',60,1) returning id into legacy_id;
  -- Les anciennes tentatives manquees ou annulees ne reservent aucun temps.
  insert into public.study_sessions(user_id, course_id, source_course_session_id, source_course_session_key,
    source_course_date, scheduled_date, start_time, end_time, duration_minutes, revision_stage, revision_interval_days, status)
  select auth.uid(),'99999999-0000-4000-8000-000000000003','99999999-0000-4000-8000-000000000004',
    '99999999-0000-4000-8000-000000000004',course_date-14,course_date+1,'10:00','11:00',60,1,1,s
    from unnest(array['missed','cancelled']) s;
  select planning_revision into revision from public.profiles where id = auth.uid();
  begin
    perform public.replace_schedule(rows,15,course_date-14,course_date+7,course_date+1,course_date+7,revision-1,true);
    raise exception 'test_failed: stale preview accepted';
  exception when others then if sqlerrm <> 'stale_revision' then raise; end if; end;
  if (select status from public.study_sessions where id = replaced_id) <> 'planned' then raise exception 'test_failed: stale cancellation'; end if;
  begin
    perform public.replace_schedule(jsonb_build_array(first_row,second_row || jsonb_build_object('scheduled_date',course_date+1,'start_time','10:30','end_time','11:30')),
      15,course_date-14,course_date+7,course_date+1,course_date+7,revision,true);
    raise exception 'test_failed: overlap accepted';
  exception when others then if sqlerrm <> 'schedule_conflict' then raise; end if; end;
  if (select status from public.study_sessions where id = replaced_id) <> 'planned'
    or (select status from public.study_sessions where id = missed_id) <> 'planned'
    or (select planning_revision from public.profiles where id=auth.uid()) <> revision then
    raise exception 'test_failed: failed save not rolled back';
  end if;
  perform set_config('request.jwt.claim.sub','99999999-0000-4000-8000-000000000002',true);
  select planning_revision into before_revision from public.profiles where id = auth.uid();
  begin
    perform public.replace_schedule(rows,15,course_date-14,course_date+7,course_date+1,course_date+7,before_revision,true);
    raise exception 'test_failed: foreign source accepted';
  exception when others then if sqlerrm <> 'invalid_source' then raise; end if; end;
  if public.archive_course('99999999-0000-4000-8000-000000000003') then raise exception 'test_failed: foreign course archived'; end if;
  perform set_config('request.jwt.claim.sub','99999999-0000-4000-8000-000000000001',true);
  saved := public.replace_schedule(rows,15,course_date-14,course_date+7,course_date+1,course_date+7,revision,true);
  if saved <> 2 then raise exception 'test_failed: incorrect count'; end if;
  if (select status from public.study_sessions where id=completed_id) <> 'completed'
    or (select course_name_snapshot from public.study_sessions where id=completed_id) <> 'Historique'
    or (select status from public.study_sessions where id=fixed_id) <> 'planned'
    or (select status from public.study_sessions where id=legacy_id) <> 'planned'
    or (select status from public.study_sessions where id=missed_id) <> 'missed'
    or (select cancellation_reason from public.study_sessions where id=replaced_id) <> 'replanned' then
    raise exception 'test_failed: history/fixed preservation';
  end if;
  if exists(select 1 from public.profiles where id=auth.uid() and planning_revision <> saved_planning_revision)
    or (select planning_preferences->>'planningEnd' from public.profiles where id=auth.uid()) <> (course_date+7)::text then
    raise exception 'test_failed: saved version/preferences';
  end if;
  select planning_revision into revision from public.profiles where id=auth.uid();
  saved := public.replace_schedule(rows,15,course_date-14,course_date+7,course_date+1,course_date+7,revision,true);
  if saved <> 2 or (select count(*) from public.study_sessions where status='planned') <> 4 then raise exception 'test_failed: repeated generation duplicates'; end if;
  if exists(select 1 from public.study_sessions where status in ('planned','completed')
    group by user_id,source_course_session_key,source_course_date,revision_stage having count(*) > 1) then raise exception 'test_failed: duplicate identity'; end if;

  select planning_revision into revision from public.profiles where id=auth.uid();
  update public.availabilities set end_time='19:00' where user_id=auth.uid() and day_of_week=7;
  if (select planning_revision from public.profiles where id=auth.uid()) <= revision then raise exception 'test_failed: availability not dirty'; end if;
  select planning_revision into revision from public.profiles where id=auth.uid();
  update public.courses set name='Nouveau nom',revision_multiplier=3 where id='99999999-0000-4000-8000-000000000003';
  if (select planning_revision from public.profiles where id=auth.uid()) <= revision then raise exception 'test_failed: course not dirty'; end if;
  if (select course_name_snapshot from public.study_sessions where id=completed_id) <> 'Historique' then raise exception 'test_failed: snapshot lost'; end if;
  select planning_revision into revision from public.profiles where id=auth.uid();
  update public.course_sessions set day_of_week=2,start_time='11:00',end_time='12:00' where id='99999999-0000-4000-8000-000000000004';
  if (select effective_from from public.course_sessions where id='99999999-0000-4000-8000-000000000004') <> today
    or (select planning_revision from public.profiles where id=auth.uid()) <= revision then raise exception 'test_failed: schedule effective date'; end if;
  -- L'ancienne occurrence FUTURE du lundi ne doit pas survivre au changement vers mardi.
  select planning_revision into revision from public.profiles where id=auth.uid();
  begin
    perform public.replace_schedule(rows,15,course_date-14,course_date+7,course_date+1,course_date+7,revision,true);
    raise exception 'test_failed: obsolete future weekday accepted';
  exception when others then if sqlerrm <> 'invalid_source' then raise; end if; end;
  -- Une occurrence historique connue garde ses heures, meme apres changement de jour.
  rows := jsonb_build_array(first_row || jsonb_build_object('source_course_date',course_date-14,'revision_stage',2,'revision_interval_days',3),
    second_row || jsonb_build_object('source_course_date',course_date-14,'revision_stage',3,'revision_interval_days',7));
  select planning_revision into revision from public.profiles where id=auth.uid();
  saved := public.replace_schedule(rows,15,course_date-14,course_date+7,course_date+1,course_date+7,revision,true);
  if (select source_start_time from public.study_sessions where status='planned' and revision_stage=2 and source_course_session_key is not null) <> '09:00'::time then
    raise exception 'test_failed: historic source snapshot not reused';
  end if;
  if exists(select 1 from public.study_sessions where source_course_date=course_date and status='cancelled'
    and cancellation_reason is distinct from 'source_changed') then raise exception 'test_failed: older cancelled future source revived'; end if;
  -- Simule un second changement plus tard : le premier futur invalide ne devient pas historique.
  update public.course_sessions set effective_from=course_date+7 where id='99999999-0000-4000-8000-000000000004';
  select planning_revision into revision from public.profiles where id=auth.uid();
  begin
    perform public.replace_schedule(jsonb_build_array(first_row,second_row),15,course_date-14,course_date+7,course_date+1,course_date+7,revision,true);
    raise exception 'test_failed: cancelled future source returned after second change';
  exception when others then if sqlerrm <> 'invalid_source' then raise; end if; end;
  -- Sur une occurrence FUTURE au bon jour, les nouveaux horaires remplacent les anciens snapshots.
  update public.course_sessions set day_of_week=1 where id='99999999-0000-4000-8000-000000000004';
  rows := jsonb_build_array(first_row,second_row);
  select planning_revision into revision from public.profiles where id=auth.uid();
  saved := public.replace_schedule(rows,15,course_date-14,course_date+7,course_date+1,course_date+7,revision,true);
  if (select source_start_time from public.study_sessions where status='planned' and revision_stage=1 and source_course_date=course_date) <> '11:00'::time then
    raise exception 'test_failed: obsolete future source hours preserved';
  end if;
  select planning_revision into revision from public.profiles where id=auth.uid();
  update public.revision_rules set intervals=array[1,4,8,16] where user_id=auth.uid();
  if (select planning_revision from public.profiles where id=auth.uid()) <= revision then raise exception 'test_failed: rule not dirty'; end if;
  select planning_revision into revision from public.profiles where id=auth.uid();
  insert into public.exams(course_id,title,exam_date,start_time,end_time) values('99999999-0000-4000-8000-000000000003','Test',course_date+20,'09:00','10:00');
  if (select planning_revision from public.profiles where id=auth.uid()) <= revision then raise exception 'test_failed: exam not dirty'; end if;
  select planning_revision into revision from public.profiles where id=auth.uid();
  update public.profiles set timezone='Europe/Paris' where id=auth.uid();
  if (select planning_revision from public.profiles where id=auth.uid()) <= revision then raise exception 'test_failed: timezone not dirty'; end if;
  update public.profiles set timezone='America/New_York' where id=auth.uid();

  select planning_revision into revision from public.profiles where id=auth.uid();
  saved := public.replace_schedule('[]',15,course_date-14,course_date+7,course_date+1,course_date+7,revision,true);
  if saved <> 0 or exists(select 1 from public.study_sessions where status='planned' and scheduled_date between course_date+1 and course_date+7
      and source_course_session_key is not null and source_course_date is not null)
    or (select status from public.study_sessions where id=legacy_id) <> 'planned'
    or (select status from public.study_sessions where id=fixed_id) <> 'planned' then raise exception 'test_failed: empty replacement'; end if;
  begin
    delete from public.courses where id='99999999-0000-4000-8000-000000000003';
    raise exception 'test_failed: hard deletion lost history';
  exception when others then if sqlerrm <> 'course_has_history' then raise; end if; end;
  if not public.archive_course('99999999-0000-4000-8000-000000000003') then raise exception 'test_failed: archive failed'; end if;
  if (select status from public.study_sessions where id=completed_id) <> 'completed'
    or (select cancellation_reason from public.study_sessions where id=fixed_id) <> 'course_archived'
    or (select archived_at from public.courses where id='99999999-0000-4000-8000-000000000003') is null then
    raise exception 'test_failed: archive history/future';
  end if;
  begin
    insert into public.course_sessions(course_id,day_of_week,start_time,end_time)
      values('99999999-0000-4000-8000-000000000003',3,'09:00','10:00');
    raise exception 'test_failed: archived course new source accepted';
  exception when others then if sqlerrm <> 'course_archived' then raise; end if; end;
  begin
    update public.course_sessions set start_time='10:30' where id='99999999-0000-4000-8000-000000000004';
    raise exception 'test_failed: archived course source edit accepted';
  exception when others then if sqlerrm <> 'course_archived' then raise; end if; end;
  begin
    insert into public.exams(course_id,title,exam_date,start_time,end_time)
      values('99999999-0000-4000-8000-000000000003','Interdit',course_date+22,'09:00','10:00');
    raise exception 'test_failed: archived course exam accepted';
  exception when others then if sqlerrm <> 'course_archived' then raise; end if; end;
  delete from public.course_sessions where id='99999999-0000-4000-8000-000000000004';
  if (select source_course_session_id from public.study_sessions where id=completed_id) is not null
    or (select source_course_session_key from public.study_sessions where id=completed_id) <> '99999999-0000-4000-8000-000000000004'::uuid then
    raise exception 'test_failed: source identity lost after deletion';
  end if;
  if has_function_privilege('anon','public.replace_schedule(jsonb,integer,date,date,date,date,bigint,boolean)','EXECUTE')
    or has_function_privilege('authenticated','public.save_initial_schedule(jsonb,integer,date,date)','EXECUTE') then
    raise exception 'test_failed: old/anonymous RPC permission';
  end if;
  raise notice 'Replanning: stale/rollback/ownership/history/empty replacement/dirty/archive/snapshots: OK';
end $$;
rollback;
