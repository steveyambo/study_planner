-- Base locale avec les cinq migrations ; aucune donnee de test conservee.
begin;
insert into auth.users(id, raw_user_meta_data) values
  ('99999999-0000-4000-8000-000000000001','{}'),('99999999-0000-4000-8000-000000000002','{}');
insert into public.courses(id,user_id,code,name) values
  ('99999999-0000-4000-8000-000000000003','99999999-0000-4000-8000-000000000001','TRACK','Suivi');
insert into public.course_sessions(id,course_id,day_of_week,start_time,end_time) values
  ('99999999-0000-4000-8000-000000000004','99999999-0000-4000-8000-000000000003',1,'09:00','10:00');
set local role authenticated;
select set_config('request.jwt.claim.sub','99999999-0000-4000-8000-000000000001',true);
do $$
declare
  today date := (now() at time zone 'America/New_York')::date;
  study_id uuid;
  future_id uuid;
  missed_id uuid;
  cancelled_id uuid;
  revision bigint;
  after_revision bigint;
  first_completed timestamptz;
begin
  insert into public.study_sessions(user_id,course_id,source_course_session_id,source_course_session_key,
    source_course_date,scheduled_date,start_time,end_time,duration_minutes,revision_stage)
  values(auth.uid(),'99999999-0000-4000-8000-000000000003','99999999-0000-4000-8000-000000000004',
    '99999999-0000-4000-8000-000000000004',today-7,today,'10:00','10:30',30,1) returning id into study_id;
  select planning_revision into revision from public.profiles where id=auth.uid();
  if public.complete_study_session(study_id) <> 'completed' then raise exception 'completion_failed'; end if;
  select completed_at into first_completed from public.study_sessions where id=study_id and status='completed';
  select planning_revision into after_revision from public.profiles where id=auth.uid();
  if first_completed is null or after_revision <= revision then raise exception 'completion_metadata_missing'; end if;
  if public.complete_study_session(study_id) <> 'completed'
    or (select completed_at from public.study_sessions where id=study_id) <> first_completed
    or (select planning_revision from public.profiles where id=auth.uid()) <> after_revision
    then raise exception 'double_submit_changed_completion'; end if;
  begin
    perform public.replace_schedule('[]',15,today-7,today,today+1,today+10,revision,false);
    raise exception 'stale_preview_accepted';
  exception when others then
    if sqlerrm <> 'stale_revision' then raise; end if;
  end;
  perform public.replace_schedule('[]',15,today-7,today,today+1,today+10,after_revision,false);
  if not exists(select 1 from public.study_sessions where id=study_id and status='completed' and completed_at=first_completed)
    or not exists(select 1 from public.course_occurrences where user_id=auth.uid() and source_course_date=today-7)
    then raise exception 'replanning_lost_completed_work'; end if;
  insert into public.study_sessions(user_id,course_id,scheduled_date,start_time,end_time,duration_minutes,revision_stage,status)
  values(auth.uid(),'99999999-0000-4000-8000-000000000003',today+1,'10:00','10:30',30,2,'planned') returning id into future_id;
  insert into public.study_sessions(user_id,course_id,scheduled_date,start_time,end_time,duration_minutes,revision_stage,status)
  values(auth.uid(),'99999999-0000-4000-8000-000000000003',today-1,'10:00','10:30',30,3,'missed') returning id into missed_id;
  insert into public.study_sessions(user_id,course_id,scheduled_date,start_time,end_time,duration_minutes,revision_stage,status)
  values(auth.uid(),'99999999-0000-4000-8000-000000000003',today,'11:00','11:30',30,4,'cancelled') returning id into cancelled_id;
  select planning_revision into revision from public.profiles where id=auth.uid();
  if public.complete_study_session(future_id) <> 'future'
    or public.complete_study_session(missed_id) <> 'unavailable'
    or public.complete_study_session(cancelled_id) <> 'unavailable'
    or public.complete_study_session('99999999-0000-4000-8000-000000000099') <> 'missing'
    or (select planning_revision from public.profiles where id=auth.uid()) <> revision
    then raise exception 'rejected_completion_mutated_data'; end if;
  -- Un autre compte ne peut ni trouver ni valider la seance.
  perform set_config('request.jwt.claim.sub','99999999-0000-4000-8000-000000000002',true);
  if public.complete_study_session(study_id) <> 'missing' then raise exception 'foreign_completion_allowed'; end if;
  perform set_config('request.jwt.claim.sub','99999999-0000-4000-8000-000000000001',true);
  -- Une seance encore planifiee dans le passe reste validable.
  update public.study_sessions set scheduled_date=today-1 where id=future_id;
  if public.complete_study_session(future_id) <> 'completed' then raise exception 'past_completion_failed'; end if;
  raise notice 'Suivi : completion, double envoi, revision obsolete, replanification, refus et RLS : OK';
end $$;
reset role;
do $$ begin
  if has_function_privilege('anon','public.complete_study_session(uuid)','EXECUTE') then raise exception 'anon_allowed'; end if;
end $$;
rollback;
