-- Base locale avec les quatre migrations. La fixture de migration est facultative.
-- Les donnees de verification transactionnelles sont annulees en fin de fichier.
begin;
do $$
begin
  if exists(select 1 from public.profiles where id='66666666-0000-4000-8000-000000000001') then
    if (select count(*) from public.course_occurrences where user_id='66666666-0000-4000-8000-000000000001') <> 2
      or (select count(*) from public.study_sessions where user_id='66666666-0000-4000-8000-000000000001') <> 3
      or not exists(select 1 from public.course_occurrences where user_id='66666666-0000-4000-8000-000000000001'
        and source_course_date='2026-12-21' and is_obsolete)
      or not exists(select 1 from public.course_occurrences where user_id='66666666-0000-4000-8000-000000000001'
        and source_course_date='2026-09-14' and not is_obsolete and source_start_time='09:00') then
      raise exception 'test_failed: backfill or cleanup lost existing work';
    end if;
    raise notice 'Migration: 41 anciennes propositions supprimees, origines/terminee/manquee/legacy conservees: OK';
  end if;
end $$;
insert into auth.users(id, raw_user_meta_data) values
  ('88888888-0000-4000-8000-000000000001','{}'),('88888888-0000-4000-8000-000000000002','{}');
insert into public.courses(id,user_id,code,name) values
  ('88888888-0000-4000-8000-000000000003','88888888-0000-4000-8000-000000000001','CLEAN','Nettoyage');
insert into public.course_sessions(id,course_id,day_of_week,start_time,end_time) values
  ('88888888-0000-4000-8000-000000000004','88888888-0000-4000-8000-000000000003',1,'09:00','10:00');
insert into public.availabilities(user_id,day_of_week,start_time,end_time)
  select '88888888-0000-4000-8000-000000000001',d,'08:00'::time,'18:00'::time from generate_series(1,7)d;
set local role authenticated;
select set_config('request.jwt.claim.sub','88888888-0000-4000-8000-000000000001',true);
do $$
declare
  today date := (now() at time zone 'America/New_York')::date;
  past_date date := today - (extract(isodow from today)::integer - 1) - 7;
  next_monday date := today + (8 - extract(isodow from today))::integer;
  rows jsonb;
  future_rows jsonb;
  revision bigint;
  count_before bigint;
  completed_id uuid;
  fixed_id uuid;
  missed_id uuid;
begin
  rows := (select jsonb_agg(jsonb_build_object('course_id','88888888-0000-4000-8000-000000000003',
    'source_course_session_id','88888888-0000-4000-8000-000000000004','source_course_date',past_date,
    'scheduled_date',today+stage,'start_time','10:00','end_time','10:30','duration_minutes',30,
    'revision_stage',stage,'revision_interval_days',(array[1,3,7,14])[stage])) from generate_series(1,4)stage);
  select planning_revision into revision from public.profiles where id=auth.uid();
  perform public.replace_schedule(rows,15,past_date,past_date,today+1,today+10,revision,false);
  for i in 1..10 loop
    select planning_revision into revision from public.profiles where id=auth.uid();
    perform public.replace_schedule(rows,15,past_date,past_date,today+1,today+10,revision,false);
  end loop;
  if (select count(*) from public.study_sessions where user_id=auth.uid()) <> 4
    or (select count(*) from public.course_occurrences where user_id=auth.uid()) <> 1 then
    raise exception 'test_failed: repeated save accumulated cancelled rows/origins';
  end if;
  select id into completed_id from public.study_sessions where user_id=auth.uid() and revision_stage=1;
  update public.study_sessions set status='completed', completed_at=now() where id=completed_id;
  insert into public.study_sessions(user_id,course_id,source_course_session_id,source_course_session_key,source_course_date,
    source_start_time,source_end_time,scheduled_date,start_time,end_time,duration_minutes,revision_stage,status)
  values(auth.uid(),'88888888-0000-4000-8000-000000000003','88888888-0000-4000-8000-000000000004',
    '88888888-0000-4000-8000-000000000004',past_date,'09:00','10:00',today-1,'11:00','11:30',30,2,'missed') returning id into missed_id;
  insert into public.study_sessions(user_id,course_id,source_course_session_id,source_course_session_key,source_course_date,
    source_start_time,source_end_time,scheduled_date,start_time,end_time,duration_minutes,revision_stage)
  values(auth.uid(),'88888888-0000-4000-8000-000000000003','88888888-0000-4000-8000-000000000004',
    '88888888-0000-4000-8000-000000000004',past_date,'09:00','10:00',today+12,'11:00','11:30',30,5) returning id into fixed_id;
  rows := rows - 0;
  select planning_revision into revision from public.profiles where id=auth.uid();
  select count(*) into count_before from public.study_sessions where user_id=auth.uid();
  begin
    perform public.replace_schedule(rows || jsonb_build_array((rows->0)||jsonb_build_object('revision_stage',6)),
      15,past_date,past_date,today+1,today+10,revision,false);
    raise exception 'test_failed: conflicting save accepted';
  exception when others then if sqlerrm <> 'schedule_conflict' then raise; end if; end;
  if (select count(*) from public.study_sessions where user_id=auth.uid()) <> count_before
    or (select planning_revision from public.profiles where id=auth.uid()) <> revision then
    raise exception 'test_failed: rollback failed to restore removed proposals';
  end if;
  perform public.replace_schedule(rows,15,past_date,past_date,today+1,today+10,revision,false);
  if (select status from public.study_sessions where id=completed_id) <> 'completed'
    or (select status from public.study_sessions where id=missed_id) <> 'missed'
    or (select status from public.study_sessions where id=fixed_id) <> 'planned' then
    raise exception 'test_failed: completed/missed/outside window lost';
  end if;
  select planning_revision into revision from public.profiles where id=auth.uid();
  perform public.replace_schedule('[]',15,past_date,past_date,today+1,today+10,revision,false);
  if exists(select 1 from public.study_sessions where user_id=auth.uid() and status='cancelled')
    or (select count(*) from public.course_occurrences where user_id=auth.uid()) <> 1 then
    raise exception 'test_failed: empty save lost origin or left cancelled attempts';
  end if;
  -- Les origines permettent le rattrapage apres modification du jour et suppression de tous les anciens creneaux.
  update public.course_sessions set day_of_week=2,start_time='12:00',end_time='13:00'
    where id='88888888-0000-4000-8000-000000000004';
  select planning_revision into revision from public.profiles where id=auth.uid();
  perform public.replace_schedule(rows,15,past_date,past_date,today+1,today+10,revision,false);
  if exists(select 1 from public.study_sessions where user_id=auth.uid() and status='planned'
    and source_start_time is distinct from '09:00'::time) then raise exception 'test_failed: original duration lost'; end if;
  -- Origine future invalidee, puis sauvegarde vide : son ancienne date ne revient plus.
  future_rows := jsonb_build_array((rows->0)||jsonb_build_object('source_course_date',next_monday+1,'revision_stage',1,
    'revision_interval_days',1,'scheduled_date',next_monday+2));
  select planning_revision into revision from public.profiles where id=auth.uid();
  perform public.replace_schedule(future_rows,15,past_date,next_monday+7,today+1,next_monday+7,revision,false);
  update public.course_sessions set day_of_week=3 where id='88888888-0000-4000-8000-000000000004';
  select planning_revision into revision from public.profiles where id=auth.uid();
  perform public.replace_schedule('[]',15,past_date,next_monday+7,today+1,next_monday+7,revision,false);
  if not exists(select 1 from public.course_occurrences where user_id=auth.uid() and source_course_date=next_monday+1 and is_obsolete)
    then raise exception 'test_failed: future invalidation forgotten'; end if;
  update public.course_sessions set effective_from=next_monday+7 where id='88888888-0000-4000-8000-000000000004';
  select planning_revision into revision from public.profiles where id=auth.uid();
  begin
    perform public.replace_schedule(future_rows,15,past_date,next_monday+7,today+1,next_monday+7,revision,false);
    raise exception 'test_failed: obsolete origin returned';
  exception when others then if sqlerrm <> 'invalid_source' then raise; end if; end;
  perform set_config('request.jwt.claim.sub','88888888-0000-4000-8000-000000000002',true);
  if exists(select 1 from public.course_occurrences where user_id='88888888-0000-4000-8000-000000000001') then
    raise exception 'test_failed: foreign origins visible';
  end if;
  select planning_revision into revision from public.profiles where id=auth.uid();
  begin
    perform public.replace_schedule(rows,15,past_date,past_date,today+1,today+10,revision,false);
    raise exception 'test_failed: foreign source used';
  exception when others then if sqlerrm <> 'invalid_source' then raise; end if; end;
  perform set_config('request.jwt.claim.sub','88888888-0000-4000-8000-000000000001',true);
  perform public.archive_course('88888888-0000-4000-8000-000000000003');
  if (select status from public.study_sessions where id=completed_id) <> 'completed'
    or (select status from public.study_sessions where id=missed_id) <> 'missed'
    or exists(select 1 from public.study_sessions where user_id=auth.uid() and status in ('planned','cancelled')) then
    raise exception 'test_failed: archival lost progress or kept unused proposals';
  end if;
  delete from public.course_sessions where id='88888888-0000-4000-8000-000000000004';
  if not exists(select 1 from public.course_occurrences where user_id=auth.uid() and source_course_date=past_date) then
    raise exception 'test_failed: deleted source lost origin';
  end if;
  if has_table_privilege('anon','public.course_occurrences','SELECT') then raise exception 'test_failed: anonymous origins'; end if;
  raise notice 'Nettoyage: 11 sauvegardes stables, suivi, sauvegarde vide, rollback, RLS, horaires, archivage: OK';
end $$;
rollback;

-- La capture des origines ne doit pas bloquer la suppression en cascade d'un compte.
begin;
-- Une annulation explicite, sans raison de remplacement, reste valide et conserve son origine.
insert into public.study_sessions(user_id,course_id,source_course_session_id,source_course_session_key,source_course_date,
  scheduled_date,start_time,end_time,duration_minutes,revision_stage,status)
select user_id,id,'66666666-0000-4000-8000-000000000004','66666666-0000-4000-8000-000000000004',
  '2026-09-14','2026-09-21','12:00','12:30',30,3,'cancelled'
from public.courses where id='66666666-0000-4000-8000-000000000003';
delete from auth.users where id='66666666-0000-4000-8000-000000000001';
do $$
begin
  if exists(select 1 from public.course_occurrences where user_id='66666666-0000-4000-8000-000000000001') then
    raise exception 'test_failed: account cascade kept origins';
  end if;
end $$;
rollback;
