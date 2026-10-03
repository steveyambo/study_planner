-- Base locale avec les migrations jusqu'a 007 ; donnees de test annulees.
begin;
insert into auth.users(id,raw_user_meta_data) values ('cccccccc-0000-4000-8000-000000000001','{}');
insert into public.courses(id,user_id,code,name) values
 ('cccccccc-0000-4000-8000-000000000003','cccccccc-0000-4000-8000-000000000001','OPTIONAL','Disponibilites');
insert into public.course_sessions(id,course_id,day_of_week,start_time,end_time) values
 ('cccccccc-0000-4000-8000-000000000004','cccccccc-0000-4000-8000-000000000003',1,'18:00','19:00');
insert into public.availabilities(user_id,day_of_week,start_time,end_time)
 select 'cccccccc-0000-4000-8000-000000000001',d,'08:00'::time,'18:00'::time from generate_series(1,7)d;
set local role authenticated;
select set_config('request.jwt.claim.sub','cccccccc-0000-4000-8000-000000000001',true);
do $$
declare
 today date := (now() at time zone 'America/New_York')::date;
 origin date := today-extract(isodow from today)::integer-6;
 rows jsonb;
 revision bigint;
begin
 rows := (select jsonb_agg(jsonb_build_object('course_id','cccccccc-0000-4000-8000-000000000003',
   'source_course_session_id','cccccccc-0000-4000-8000-000000000004','source_course_date',origin-7*i,
   'scheduled_date',today+1,'start_time',('09:00'::time+make_interval(mins=>105*i)),
   'end_time',('10:30'::time+make_interval(mins=>105*i)),
   'duration_minutes',90,'revision_stage',1,'revision_interval_days',1)) from generate_series(0,2)i);
 select planning_revision into revision from public.profiles where id=auth.uid();
 -- Sans parametre : plus de plafond implicite a 240 minutes.
 if public.replace_schedule(rows,15,origin-14,today,today+1,today+10,revision,false) <> 3 then raise exception 'default_cap_not_disabled'; end if;
 if (select sum(duration_minutes) from public.study_sessions where user_id=auth.uid() and status='planned') <> 270
   or (select planning_preferences->>'maxDailyMinutes' from public.profiles where id=auth.uid()) is not null
   or (select (planning_preferences->>'dailyLimitEnabled')::boolean from public.profiles where id=auth.uid())
   then raise exception 'unlimited_preferences_failed'; end if;
 select planning_revision into revision from public.profiles where id=auth.uid();
 begin
   perform public.replace_schedule(rows,15,origin-14,today,today+1,today+10,revision,false,240);
   raise exception 'enabled_cap_ignored';
 exception when others then if sqlerrm <> 'daily_limit' then raise; end if; end;
 if (select planning_revision from public.profiles where id=auth.uid()) <> revision then raise exception 'cap_failure_not_atomic'; end if;
 perform public.replace_schedule(rows-2,15,origin-14,today,today+1,today+10,revision,false,240);
 if not (select (planning_preferences->>'dailyLimitEnabled')::boolean from public.profiles where id=auth.uid()) then raise exception 'enabled_preference_missing'; end if;
 select planning_revision into revision from public.profiles where id=auth.uid();
 -- Desactivation explicite, apres une sauvegarde avec plafond.
 perform public.replace_schedule(rows,15,origin-14,today,today+1,today+10,revision,false,null);
 if (select sum(duration_minutes) from public.study_sessions where user_id=auth.uid() and status='planned') <> 270
   or (select (planning_preferences->>'dailyLimitEnabled')::boolean from public.profiles where id=auth.uid())
   then raise exception 'explicit_disable_failed'; end if;
 raise notice 'Plafond facultatif : defaut sans limite, activation, rollback et desactivation sauvegardee : OK';
end $$;
reset role;
rollback;
