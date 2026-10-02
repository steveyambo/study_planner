-- Test reserve a une base locale jetable avec le schema auth simule.
-- Ne pas executer dans Supabase : les comptes ci-dessous sont fictifs.
begin;
insert into auth.users(id) values
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002');
insert into public.courses(id,user_id,code,name) values
  ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','A','Cours A'),
  ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','B','Cours B');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
do $$
begin
  if (select count(*) from public.courses) <> 1 then
    raise exception 'RLS : lecture des cours incorrecte';
  end if;
  if (select count(*) from public.profiles) <> 1 then
    raise exception 'RLS : lecture des profils incorrecte';
  end if;
  if not exists (select 1 from public.revision_rules where intervals = array[1,3,7,14]) then
    raise exception 'Intervalles initiaux absents';
  end if;
  update public.courses set name = 'Intrusion' where code = 'B';
  if found then raise exception 'Modification du cours B autorisee'; end if;
  begin
    insert into public.course_sessions(course_id,day_of_week,start_time,end_time)
      values ('10000000-0000-0000-0000-000000000002',1,'14:00','17:00');
    raise exception 'Ajout dans le cours B autorise';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.study_sessions(course_id,scheduled_date,start_time,end_time,duration_minutes,revision_stage)
      values ('10000000-0000-0000-0000-000000000002','2026-10-05','18:00','19:30',90,1);
    raise exception 'Reference au cours B autorisee';
  exception when foreign_key_violation then null;
  end;
  insert into public.course_sessions(course_id,day_of_week,start_time,end_time)
    values ('10000000-0000-0000-0000-000000000001',1,'14:00','17:00');
  begin
    insert into public.availabilities(day_of_week,start_time,end_time) values (1,'20:00','18:00');
    raise exception 'Horaire inverse autorise';
  exception when check_violation then null;
  end;
  begin
    update public.revision_rules set intervals = array[0,3];
    raise exception 'Intervalle nul autorise';
  exception when check_violation then null;
  end;
end;
$$;
rollback;
