-- Base de test locale uniquement, migrations jusqu'a 007. Toutes les donnees sont annulees.
begin;
insert into auth.users(id,raw_user_meta_data) values
 ('eeeeeeee-0000-4000-8000-000000000001','{}'),('eeeeeeee-0000-4000-8000-000000000002','{}');
insert into public.courses(id,user_id,code,name) values
 ('eeeeeeee-0000-4000-8000-000000000011','eeeeeeee-0000-4000-8000-000000000001','SAFE_A','Compte A'),
 ('eeeeeeee-0000-4000-8000-000000000012','eeeeeeee-0000-4000-8000-000000000002','SAFE_B','Compte B');
insert into public.course_sessions(id,course_id,day_of_week,start_time,end_time) values
 ('eeeeeeee-0000-4000-8000-000000000021','eeeeeeee-0000-4000-8000-000000000011',1,'18:00','19:00'),
 ('eeeeeeee-0000-4000-8000-000000000022','eeeeeeee-0000-4000-8000-000000000012',1,'18:00','19:00');
insert into public.exams(id,course_id,title,exam_date,start_time,end_time) values
 ('eeeeeeee-0000-4000-8000-000000000031','eeeeeeee-0000-4000-8000-000000000011','A',current_date+20,'09:00','10:00'),
 ('eeeeeeee-0000-4000-8000-000000000032','eeeeeeee-0000-4000-8000-000000000012','B',current_date+20,'09:00','10:00');
insert into public.availabilities(id,user_id,day_of_week,start_time,end_time) values
 ('eeeeeeee-0000-4000-8000-000000000041','eeeeeeee-0000-4000-8000-000000000001',1,'08:00','17:00'),
 ('eeeeeeee-0000-4000-8000-000000000042','eeeeeeee-0000-4000-8000-000000000002',1,'08:00','17:00');
insert into public.study_sessions(id,user_id,course_id,source_course_session_id,source_course_session_key,
 source_course_date,scheduled_date,start_time,end_time,duration_minutes,revision_stage) values
 ('eeeeeeee-0000-4000-8000-000000000051','eeeeeeee-0000-4000-8000-000000000001','eeeeeeee-0000-4000-8000-000000000011',
  'eeeeeeee-0000-4000-8000-000000000021','eeeeeeee-0000-4000-8000-000000000021',current_date-7,current_date-1,'10:00','11:00',60,1),
 ('eeeeeeee-0000-4000-8000-000000000052','eeeeeeee-0000-4000-8000-000000000002','eeeeeeee-0000-4000-8000-000000000012',
  'eeeeeeee-0000-4000-8000-000000000022','eeeeeeee-0000-4000-8000-000000000022',current_date-7,current_date-1,'10:00','11:00',60,1);

-- Assertions de configuration effectives, pas seulement une lecture des fichiers de migration.
do $$
declare item record; signature text;
begin
 for item in select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname in ('profiles','courses','course_sessions','exams','availabilities','revision_rules','study_sessions','course_occurrences') loop
   if not item.relrowsecurity then raise exception 'RLS disabled on %',item.relname; end if;
   if has_table_privilege('anon','public.'||item.relname,'SELECT,INSERT,UPDATE,DELETE') then raise exception 'anonymous table access on %',item.relname; end if;
 end loop;
 foreach signature in array array['archive_course(uuid)','complete_study_session(uuid)','mark_study_missed(uuid)',
   'replace_schedule(jsonb,integer,date,date,date,date,bigint,boolean,integer)'] loop
   if has_function_privilege('anon','public.'||signature,'EXECUTE') then raise exception 'anonymous RPC access on %',signature; end if;
   if not has_function_privilege('authenticated','public.'||signature,'EXECUTE') then raise exception 'missing RPC privilege on %',signature; end if;
 end loop;
 if has_function_privilege('authenticated','public.save_initial_schedule(jsonb,integer,date,date)','EXECUTE') then raise exception 'obsolete save RPC accessible'; end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
   and p.proname in ('archive_course','complete_study_session','mark_study_missed','replace_schedule')
   and (p.prosecdef or not ('search_path=""'=any(p.proconfig)))) then raise exception 'unsafe RPC execution context'; end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','eeeeeeee-0000-4000-8000-000000000001',true);
do $$
declare item record; visible integer; affected integer; command text; blocked boolean;
 own_user uuid := 'eeeeeeee-0000-4000-8000-000000000001';
 other_user uuid := 'eeeeeeee-0000-4000-8000-000000000002';
begin
 -- Le compte A ne peut lire, modifier ou supprimer aucune ligne appartenant au compte B.
 for item in select * from (values
  ('profiles','id',other_user),('courses','id','eeeeeeee-0000-4000-8000-000000000012'::uuid),
  ('course_sessions','id','eeeeeeee-0000-4000-8000-000000000022'::uuid),('exams','id','eeeeeeee-0000-4000-8000-000000000032'::uuid),
  ('availabilities','id','eeeeeeee-0000-4000-8000-000000000042'::uuid),('revision_rules','user_id',other_user),
  ('study_sessions','id','eeeeeeee-0000-4000-8000-000000000052'::uuid),('course_occurrences','user_id',other_user)
 ) as entries(table_name,key_name,foreign_id) loop
   execute format('select count(*) from public.%I where %I=$1',item.table_name,item.key_name) into visible using item.foreign_id;
   if visible<>0 then raise exception 'foreign read on %',item.table_name; end if;
   execute format('update public.%I set %I=%I where %I=$1',item.table_name,item.key_name,item.key_name,item.key_name) using item.foreign_id;
   get diagnostics affected=row_count; if affected<>0 then raise exception 'foreign update on %',item.table_name; end if;
   execute format('delete from public.%I where %I=$1',item.table_name,item.key_name) using item.foreign_id;
   get diagnostics affected=row_count; if affected<>0 then raise exception 'foreign delete on %',item.table_name; end if;
 end loop;
 -- WITH CHECK et les parents proteges refusent un proprietaire ou un cours etranger a l'insertion.
 foreach command in array array[
  'insert into public.profiles(id) values('''||other_user||''')',
  'insert into public.courses(user_id,code,name) values('''||other_user||''',''FORGED'',''Forbidden'')',
  'insert into public.course_sessions(course_id,day_of_week,start_time,end_time) values(''eeeeeeee-0000-4000-8000-000000000012'',2,''08:00'',''09:00'')',
  'insert into public.exams(course_id,title,exam_date,start_time,end_time) values(''eeeeeeee-0000-4000-8000-000000000012'',''Forged'',current_date,''08:00'',''09:00'')',
  'insert into public.availabilities(user_id,day_of_week,start_time,end_time) values('''||other_user||''',2,''08:00'',''09:00'')',
  'insert into public.revision_rules(user_id) values('''||other_user||''')',
  'insert into public.study_sessions(user_id,course_id,scheduled_date,start_time,end_time,duration_minutes,revision_stage) values('''||other_user||''',''eeeeeeee-0000-4000-8000-000000000012'',current_date,''08:00'',''09:00'',60,9)',
  'insert into public.course_occurrences(user_id,course_id,source_course_session_key,source_course_date) values('''||other_user||''',''eeeeeeee-0000-4000-8000-000000000012'',''eeeeeeee-0000-4000-8000-000000000022'',current_date)'
 ] loop
   blocked:=false;
   begin execute command;
   exception when insufficient_privilege then blocked:=true;
     when raise_exception then if sqlerrm='invalid_source' then blocked:=true; else raise; end if;
   end;
   if not blocked then raise exception 'foreign insert accepted: %',command; end if;
 end loop;
 -- Une origine du compte A ne peut pointer vers un cours du compte B (FK composite).
 blocked:=false;
 begin
   insert into public.course_occurrences(user_id,course_id,source_course_session_key,source_course_date)
   values(own_user,'eeeeeeee-0000-4000-8000-000000000012','eeeeeeee-0000-4000-8000-000000000022',current_date);
 exception when foreign_key_violation then blocked:=true; end;
 if not blocked then raise exception 'cross-account origin accepted'; end if;
 blocked:=false;
 begin
   update public.course_sessions set course_id='eeeeeeee-0000-4000-8000-000000000012'
     where id='eeeeeeee-0000-4000-8000-000000000021';
 exception when insufficient_privilege then blocked:=true;
   when raise_exception then if sqlerrm='invalid_source' then blocked:=true; else raise; end if;
 end;
 if not blocked then raise exception 'cross-account parent update accepted'; end if;
 -- Les RPC ne retournent aucune information sur une seance ou un cours etranger.
 if public.archive_course('eeeeeeee-0000-4000-8000-000000000012') then raise exception 'foreign archival'; end if;
 if public.complete_study_session('eeeeeeee-0000-4000-8000-000000000052')<>'missing' then raise exception 'foreign completion'; end if;
 if public.mark_study_missed('eeeeeeee-0000-4000-8000-000000000052')<>'missing' then raise exception 'foreign missed'; end if;
 -- Sans identite authentifiee, meme le role SQL authenticated ne peut lire les donnees.
 perform set_config('request.jwt.claim.sub','',true);
 if exists(select 1 from public.profiles) or exists(select 1 from public.study_sessions) then raise exception 'missing identity readable'; end if;
 blocked:=false;
 begin perform public.archive_course('eeeeeeee-0000-4000-8000-000000000011');
 exception when raise_exception then if sqlerrm='authentication_required' then blocked:=true; else raise; end if; end;
 if not blocked then raise exception 'missing identity RPC accepted'; end if;
 perform set_config('request.jwt.claim.sub',own_user::text,true);
 -- Le compte legitime garde son acces ; un succes de refus ne vient pas d'un blocage total.
 if (select count(*) from public.courses)<>1 or (select count(*) from public.course_occurrences)<>1 then raise exception 'own data unavailable'; end if;
 insert into public.availabilities(user_id,day_of_week,start_time,end_time) values(own_user,3,'08:00','09:00');
 update public.profiles set full_name='Compte A verifie' where id=own_user;
 if not exists(select 1 from public.profiles where id=own_user and full_name='Compte A verifie') then raise exception 'own update refused'; end if;
 raise notice 'Isolation : 8 tables, lectures/ecritures etrangeres, parents, RPC, identite absente et acces legitime : OK';
end $$;
reset role;
do $$ begin
 if not exists(select 1 from public.study_sessions where id='eeeeeeee-0000-4000-8000-000000000052' and status='planned')
   or not exists(select 1 from public.courses where id='eeeeeeee-0000-4000-8000-000000000012' and archived_at is null)
   then raise exception 'foreign data changed'; end if;
end $$;
rollback;
