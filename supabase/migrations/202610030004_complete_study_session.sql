-- Executer une fois apres 202610030003_clean_schedule_history.sql.
begin;
create function public.complete_study_session(p_session_id uuid)
returns text language plpgsql security invoker set search_path = '' as $$
declare
  account_id uuid := auth.uid();
  today date;
  study public.study_sessions%rowtype;
begin
  if account_id is null then raise exception 'authentication_required'; end if;
  -- Meme ordre de verrouillage que replace_schedule : profil puis seance.
  select (now() at time zone timezone)::date into today
    from public.profiles where id = account_id for update;
  if not found then raise exception 'profile_missing'; end if;
  select * into study from public.study_sessions
    where id = p_session_id and user_id = account_id for update;
  if not found then return 'missing'; end if;
  if study.status = 'completed' then return 'completed'; end if;
  if study.status <> 'planned' then return 'unavailable'; end if;
  if study.scheduled_date > today then return 'future'; end if;
  update public.study_sessions set status = 'completed', completed_at = now()
    where id = study.id and user_id = account_id;
  -- Les triggers existants conservent l'origine et invalident les anciens apercus.
  return 'completed';
end;
$$;
revoke all on function public.complete_study_session(uuid) from public, anon;
grant execute on function public.complete_study_session(uuid) to authenticated;
commit;
