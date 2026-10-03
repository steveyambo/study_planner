-- Base locale avec les migrations jusqu'a 005. Donnees annulees en fin de test.
begin;
insert into auth.users(id,raw_user_meta_data) values
 ('aaaaaaaa-0000-4000-8000-000000000001','{}'),('aaaaaaaa-0000-4000-8000-000000000002','{}');
insert into public.courses(id,user_id,code,name) values
 ('aaaaaaaa-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-000000000001','ENG','Anglais');
insert into public.course_sessions(id,course_id,day_of_week,start_time,end_time) values
 ('aaaaaaaa-0000-4000-8000-000000000004','aaaaaaaa-0000-4000-8000-000000000003',1,'09:00','10:00');
insert into public.availabilities(user_id,day_of_week,start_time,end_time)
 select 'aaaaaaaa-0000-4000-8000-000000000001',d,'09:00'::time,'18:00'::time from generate_series(1,7)d;
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000001',true);
do $$
declare
 today date := (now() at time zone 'America/New_York')::date;
 first_class date := today + (8 - extract(isodow from today))::integer;
 course uuid := 'aaaaaaaa-0000-4000-8000-000000000003';
 source uuid := 'aaaaaaaa-0000-4000-8000-000000000004';
 rows jsonb;
 revision bigint;
 saved_id uuid;
 completed_id uuid;
begin
 update public.courses set starts_on=first_class,ends_on=first_class where id=course;
 begin
   update public.courses set ends_on=first_class-1 where id=course;
   raise exception 'reversed_period_allowed';
 exception when check_violation then null; end;
 insert into public.exams(course_id,title,exam_date,start_time,end_time)
 values(course,'Examen',first_class+10,'15:00','16:00');
 -- Revision apres la fin du cours dans l'ancien horaire hebdomadaire : il est libre.
 rows := jsonb_build_array(jsonb_build_object('course_id',course,'source_course_session_id',source,
   'source_course_date',first_class,'scheduled_date',first_class+7,'start_time','09:00','end_time','10:00',
   'duration_minutes',60,'revision_stage',1,'revision_interval_days',1));
 select planning_revision into revision from public.profiles where id=auth.uid();
 if public.replace_schedule(rows,15,first_class-7,first_class+14,today+1,first_class+14,revision,false) <> 1
   then raise exception 'after_course_revision_failed'; end if;
 select id into saved_id from public.study_sessions where user_id=auth.uid() and status='planned';
 -- Les sources avant le debut ou apres la fin sont refusees, sans perte de la proposition.
 for i in 1..2 loop
   select planning_revision into revision from public.profiles where id=auth.uid();
   begin
     perform public.replace_schedule(jsonb_set(jsonb_set(rows,'{0,scheduled_date}',to_jsonb(first_class+8)),
       '{0,source_course_date}',to_jsonb(first_class + case when i=1 then -7 else 7 end)),
       15,first_class-7,first_class+14,today+1,first_class+14,revision,false);
     raise exception 'source_outside_period_allowed';
   exception when others then if sqlerrm <> 'invalid_source' then raise; end if; end;
   if not exists(select 1 from public.study_sessions where id=saved_id and status='planned') then raise exception 'invalid_save_lost_proposal'; end if;
 end loop;
 -- L'examen reste une limite distincte, meme apres la fin du cours.
 select planning_revision into revision from public.profiles where id=auth.uid();
 begin
   perform public.replace_schedule(jsonb_set(rows,'{0,scheduled_date}',to_jsonb(first_class+11)),
     15,first_class-7,first_class+14,today+1,first_class+14,revision,false);
   raise exception 'exam_limit_ignored';
 exception when others then if sqlerrm <> 'schedule_conflict' then raise; end if; end;
 -- Historique reel conserve lors d'une reduction de periode.
 insert into public.study_sessions(user_id,course_id,source_course_session_id,source_course_session_key,source_course_date,
   scheduled_date,start_time,end_time,duration_minutes,revision_stage,status,completed_at)
 values(auth.uid(),course,source,source,today-7,today-1,'10:00','11:00',60,1,'completed',now()) returning id into completed_id;
 select planning_revision into revision from public.profiles where id=auth.uid();
 update public.courses set starts_on=null, ends_on=first_class-1 where id=course;
 if exists(select 1 from public.study_sessions where id=saved_id)
   or not exists(select 1 from public.course_occurrences where user_id=auth.uid() and source_course_date=first_class and is_obsolete)
   or not exists(select 1 from public.study_sessions where id=completed_id and status='completed')
   then raise exception 'period_change_cleanup_or_history_failed'; end if;
 begin
   perform public.replace_schedule('[]',15,first_class-7,first_class+14,today+1,first_class+14,revision,false);
   raise exception 'stale_period_preview_allowed';
 exception when others then if sqlerrm <> 'stale_revision' then raise; end if; end;
 -- Prolonger la periode permet de recréer une proposition valide et son origine.
 update public.courses set starts_on=first_class, ends_on=first_class+7 where id=course;
 rows := jsonb_set(rows,'{0,scheduled_date}',to_jsonb(first_class+8));
 select planning_revision into revision from public.profiles where id=auth.uid();
 perform public.replace_schedule(rows,15,first_class-7,first_class+14,today+1,first_class+14,revision,false);
 if not exists(select 1 from public.course_occurrences where user_id=auth.uid() and source_course_date=first_class and not is_obsolete)
   then raise exception 'extended_period_origin_not_reactivated'; end if;
 -- Revenir aux dates globales en effacant les limites reste possible.
 update public.courses set starts_on=null,ends_on=null where id=course;
 if not exists(select 1 from public.study_sessions where id=completed_id and status='completed') then raise exception 'clearing_period_lost_history'; end if;
 perform set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000002',true);
 update public.courses set ends_on=today where id=course;
 if found then raise exception 'foreign_period_edit_allowed'; end if;
 raise notice 'Periodes : bornes, revisions apres dernier cours, source refusee, rollback, nettoyage, historique, prolongation, RLS : OK';
end $$;
reset role;
rollback;
