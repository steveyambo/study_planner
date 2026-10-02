-- A executer apres la migration dans le SQL Editor.
-- Resultat attendu : 7 tables, RLS = true, 1 politique pour chacune.
select c.relname as table_name, c.relrowsecurity as rls_enabled,
  (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policy_count
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and c.relname in ('profiles','courses','course_sessions','exams','availabilities','revision_rules','study_sessions')
order by c.relname;

-- Resultat attendu : study_planner_user_created.
select tgname from pg_trigger
where tgrelid = 'auth.users'::regclass and tgname = 'study_planner_user_created';
