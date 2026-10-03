-- Exécuter uniquement dans une base de test contenant les deux migrations.
-- Toutes les données de ce test sont annulées en fin de transaction.
begin;
insert into auth.users(id, raw_user_meta_data) values
  ('88888888-0000-4000-8000-000000000001', '{}'),
  ('88888888-0000-4000-8000-000000000002', '{}');
insert into public.courses(id, user_id, code, name, color) values
  ('88888888-0000-4000-8000-000000000003','88888888-0000-4000-8000-000000000001','TEST','Test','#000000');
insert into public.course_sessions(id, course_id, day_of_week, start_time, end_time) values
  ('88888888-0000-4000-8000-000000000004','88888888-0000-4000-8000-000000000003',1,'09:00','10:00');
insert into public.availabilities(user_id, day_of_week, start_time, end_time) values
  ('88888888-0000-4000-8000-000000000001',2,'10:00','10:30'),
  ('88888888-0000-4000-8000-000000000001',2,'10:30','12:00'),
  ('88888888-0000-4000-8000-000000000001',4,'10:00','12:00');
set local role authenticated;
select set_config('request.jwt.claim.sub','88888888-0000-4000-8000-000000000001',true);
do $$
declare
  course_date date := current_date + (8 - extract(isodow from current_date))::integer;
  first_row jsonb;
  second_row jsonb;
  rows jsonb;
  saved integer;
begin
  first_row := jsonb_build_object('course_id','88888888-0000-4000-8000-000000000003',
    'source_course_session_id','88888888-0000-4000-8000-000000000004','source_course_date',course_date,
    'scheduled_date',course_date+1,'start_time','10:00','end_time','11:00','duration_minutes',60,'revision_stage',1);
  second_row := first_row || jsonb_build_object('scheduled_date',course_date+3,'revision_stage',2);
  rows := jsonb_build_array(first_row,second_row);
  begin
    perform public.save_initial_schedule(jsonb_build_array(first_row, second_row || jsonb_build_object('scheduled_date',course_date+1,'start_time','10:30','end_time','11:30')),15,course_date,course_date);
    raise exception 'test_failed: overlapping transaction accepted';
  exception when others then
    if sqlerrm <> 'schedule_conflict' then raise; end if;
  end;
  if exists(select 1 from public.study_sessions) then raise exception 'test_failed: partial insertion'; end if;
  perform set_config('request.jwt.claim.sub','88888888-0000-4000-8000-000000000002',true);
  begin
    perform public.save_initial_schedule(rows,15,course_date,course_date);
    raise exception 'test_failed: foreign source accepted';
  exception when others then
    if sqlerrm <> 'invalid_source' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub','88888888-0000-4000-8000-000000000001',true);
  saved := public.save_initial_schedule(rows,15,course_date,course_date);
  if saved <> 2 then raise exception 'test_failed: incorrect count'; end if;
  begin
    perform public.save_initial_schedule(rows,15,course_date,course_date);
    raise exception 'test_failed: duplicate generation accepted';
  exception when others then
    if sqlerrm <> 'schedule_exists' then raise; end if;
  end;
  if (select count(*) from public.study_sessions where user_id=auth.uid()) <> 2 then raise exception 'test_failed: duplicate rows'; end if;
  if has_function_privilege('anon','public.save_initial_schedule(jsonb,integer,date,date)','EXECUTE') then raise exception 'test_failed: anonymous execution allowed'; end if;
  raise notice 'Atomic rollback, ownership, saving, duplicate prevention and anonymous denial: OK';
end $$;
rollback;
