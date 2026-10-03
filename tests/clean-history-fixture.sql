-- Base locale de test uniquement : executer apres les trois anciennes migrations,
-- puis appliquer 202610030003_clean_schedule_history.sql et lancer clean-schedule-history.sql.
insert into auth.users(id, raw_user_meta_data) values ('66666666-0000-4000-8000-000000000001','{}');
insert into public.courses(id,user_id,code,name) values
  ('66666666-0000-4000-8000-000000000003','66666666-0000-4000-8000-000000000001','OLD','Anciennes propositions');
insert into public.course_sessions(id,course_id,day_of_week,start_time,end_time) values
  ('66666666-0000-4000-8000-000000000004','66666666-0000-4000-8000-000000000003',1,'09:00','10:00');
insert into public.study_sessions(user_id,course_id,source_course_session_id,source_course_session_key,source_course_date,
  source_start_time,source_end_time,course_code_snapshot,course_name_snapshot,scheduled_date,start_time,end_time,duration_minutes,
  revision_stage,revision_interval_days,status,cancellation_reason)
select '66666666-0000-4000-8000-000000000001','66666666-0000-4000-8000-000000000003',
  '66666666-0000-4000-8000-000000000004','66666666-0000-4000-8000-000000000004','2026-09-14',
  '09:00','10:00','OLD','Anciennes propositions','2026-09-15','10:00','10:30',30,1,1,'cancelled','replanned'
from generate_series(1,40);
insert into public.study_sessions(user_id,course_id,source_course_session_id,source_course_session_key,source_course_date,
  source_start_time,source_end_time,scheduled_date,start_time,end_time,duration_minutes,revision_stage,status,cancellation_reason)
values('66666666-0000-4000-8000-000000000001','66666666-0000-4000-8000-000000000003',
  '66666666-0000-4000-8000-000000000004','66666666-0000-4000-8000-000000000004','2026-12-21',
  '09:00','10:00','2026-12-22','10:00','10:30',30,1,'cancelled','source_changed');
insert into public.study_sessions(user_id,course_id,source_course_session_id,source_course_session_key,source_course_date,
  source_start_time,source_end_time,scheduled_date,start_time,end_time,duration_minutes,revision_stage,status,completed_at)
values('66666666-0000-4000-8000-000000000001','66666666-0000-4000-8000-000000000003',
  '66666666-0000-4000-8000-000000000004','66666666-0000-4000-8000-000000000004','2026-09-14',
  '09:00','10:00','2026-09-17','10:00','10:30',30,2,'completed',now());
insert into public.study_sessions(user_id,course_id,source_course_session_id,source_course_session_key,source_course_date,
  scheduled_date,start_time,end_time,duration_minutes,revision_stage,status)
values('66666666-0000-4000-8000-000000000001','66666666-0000-4000-8000-000000000003',
  '66666666-0000-4000-8000-000000000004','66666666-0000-4000-8000-000000000004','2026-09-14',
  '2026-09-15','10:00','10:30',30,1,'missed');
-- Origine inconnue : la migration ne doit pas effacer cette ligne.
insert into public.study_sessions(user_id,course_id,scheduled_date,start_time,end_time,duration_minutes,revision_stage,status,cancellation_reason)
values('66666666-0000-4000-8000-000000000001','66666666-0000-4000-8000-000000000003',
  '2026-09-15','11:00','11:30',30,1,'cancelled','replanned');
