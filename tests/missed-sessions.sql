-- Base locale avec les migrations jusqu'a 006 ; tests transactionnels.
begin;
insert into auth.users(id,raw_user_meta_data) values
 ('bbbbbbbb-0000-4000-8000-000000000001','{}'),('bbbbbbbb-0000-4000-8000-000000000002','{}');
insert into public.courses(id,user_id,code,name) values
 ('bbbbbbbb-0000-4000-8000-000000000003','bbbbbbbb-0000-4000-8000-000000000001','MISSED','Rattrapage');
insert into public.course_sessions(id,course_id,day_of_week,start_time,end_time) values
 ('bbbbbbbb-0000-4000-8000-000000000004','bbbbbbbb-0000-4000-8000-000000000003',1,'18:00','19:00');
insert into public.availabilities(user_id,day_of_week,start_time,end_time)
 select 'bbbbbbbb-0000-4000-8000-000000000001',d,'08:00'::time,'18:00'::time from generate_series(1,7)d;
set local role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-0000-4000-8000-000000000001',true);
do $$
declare
 today date := (now() at time zone 'America/New_York')::date;
 origin date := today - extract(isodow from today)::integer - 6;
 course uuid := 'bbbbbbbb-0000-4000-8000-000000000003';
 source uuid := 'bbbbbbbb-0000-4000-8000-000000000004';
 missed_id uuid;
 future_id uuid;
 fixed_id uuid;
 revision bigint;
 after_revision bigint;
 rows jsonb;
begin
 insert into public.study_sessions(user_id,course_id,source_course_session_id,source_course_session_key,source_course_date,
   scheduled_date,start_time,end_time,duration_minutes,revision_stage)
 values(auth.uid(),course,source,source,origin,today-1,'10:00','11:30',90,1) returning id into missed_id;
 select planning_revision into revision from public.profiles where id=auth.uid();
 if public.mark_study_missed(missed_id) <> 'missed' then raise exception 'missed_action_failed'; end if;
 if not exists(select 1 from public.study_sessions where id=missed_id and status='missed' and completed_at is null)
   or not exists(select 1 from public.course_occurrences where user_id=auth.uid() and source_course_date=origin and not is_obsolete)
   then raise exception 'missed_tracking_failed'; end if;
 select planning_revision into after_revision from public.profiles where id=auth.uid();
 if after_revision <= revision then raise exception 'missed_did_not_invalidate_preview'; end if;
 perform public.mark_study_missed(missed_id);
 if (select planning_revision from public.profiles where id=auth.uid()) <> after_revision then raise exception 'missed_double_submit_mutated'; end if;
 insert into public.study_sessions(user_id,course_id,source_course_session_id,source_course_session_key,source_course_date,
   scheduled_date,start_time,end_time,duration_minutes,revision_stage)
 values(auth.uid(),course,source,source,origin-7,today+1,'16:00','16:30',30,1) returning id into future_id;
 if public.mark_study_missed(future_id) <> 'future' then raise exception 'future_session_marked_missed'; end if;
 perform set_config('request.jwt.claim.sub','bbbbbbbb-0000-4000-8000-000000000002',true);
 if public.mark_study_missed(missed_id) <> 'missing' then raise exception 'foreign_session_marked_missed'; end if;
 perform set_config('request.jwt.claim.sub','bbbbbbbb-0000-4000-8000-000000000001',true);
 -- Une seance ancienne sans origine reste preservee, sans promesse de rattrapage automatique.
 insert into public.study_sessions(user_id,course_id,scheduled_date,start_time,end_time,duration_minutes,revision_stage)
 values(auth.uid(),course,today-1,'12:00','12:30',30,1) returning id into fixed_id;
 if public.mark_study_missed(fixed_id) <> 'unavailable' then raise exception 'legacy_origin_invented'; end if;
 -- 3 occurrences differentes, 90 min chacune sur le meme jour : 270 > 240.
 rows := jsonb_build_array(
   jsonb_build_object('course_id',course,'source_course_session_id',source,'source_course_date',origin,
     'scheduled_date',today+1,'start_time','10:00','end_time','11:30','duration_minutes',90,'revision_stage',1,'revision_interval_days',1),
   jsonb_build_object('course_id',course,'source_course_session_id',source,'source_course_date',origin-7,
     'scheduled_date',today+1,'start_time','11:45','end_time','13:15','duration_minutes',90,'revision_stage',1,'revision_interval_days',1),
   jsonb_build_object('course_id',course,'source_course_session_id',source,'source_course_date',origin-14,
     'scheduled_date',today+1,'start_time','13:30','end_time','15:00','duration_minutes',90,'revision_stage',1,'revision_interval_days',1));
 select planning_revision into revision from public.profiles where id=auth.uid();
 begin
   perform public.replace_schedule(rows,15,origin-14,today,today+1,today+10,revision,false,240);
   raise exception 'daily_cap_ignored';
 exception when others then if sqlerrm <> 'daily_limit' then raise; end if; end;
 if not exists(select 1 from public.study_sessions where id=future_id and status='planned')
   or (select planning_revision from public.profiles where id=auth.uid()) <> revision
   then raise exception 'failed_cap_save_not_atomic'; end if;
 -- Rattrapage de deux occurrences, historique manque conserve, preference sauvegardee.
 if public.replace_schedule(rows-2,15,origin-14,today,today+1,today+10,revision,false,240) <> 2 then raise exception 'catchup_failed'; end if;
 if not exists(select 1 from public.study_sessions where id=missed_id and status='missed')
   or (select (planning_preferences->>'maxDailyMinutes')::integer from public.profiles where id=auth.uid()) <> 240
   then raise exception 'catchup_lost_history_or_limit'; end if;
 select planning_revision into revision from public.profiles where id=auth.uid();
 -- Une limite reduite ne doit pas effacer l'ancien planning en cas de refus.
 begin
   perform public.replace_schedule(rows-2,15,origin-14,today,today+1,today+10,revision,false,120);
   raise exception 'lowered_cap_ignored';
 exception when others then if sqlerrm <> 'daily_limit' then raise; end if; end;
 if (select count(*) from public.study_sessions where user_id=auth.uid() and status='planned' and scheduled_date=today+1) <> 2 then raise exception 'lowered_cap_lost_schedule'; end if;
 raise notice 'Seances manquees et plafond : statut, origine, double envoi, futur, RLS, legacy, rollback, rattrapage et preference : OK';
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.mark_study_missed(uuid)','EXECUTE') then raise exception 'anon_allowed'; end if;
end $$;
rollback;
