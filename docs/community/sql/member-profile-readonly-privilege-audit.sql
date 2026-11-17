-- READ ONLY: profile privilege audit. Do not add DML/DDL to this file.
-- Run only with a trusted read-only SQL connection; never print user rows or secrets.
select c.relrowsecurity as rls_enabled, c.relforcerowsecurity as force_rls
from pg_class c where c.oid = 'public.bs_member_profiles'::regclass;

select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname='public' and tablename='bs_member_profiles'
order by policyname;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema='public' and table_name='bs_member_profiles'
  and grantee in ('anon','authenticated')
order by grantee, privilege_type;

select a.attname as column_name,
       has_column_privilege('anon','public.bs_member_profiles',a.attname,'UPDATE') as anon_can_update,
       has_column_privilege('authenticated','public.bs_member_profiles',a.attname,'UPDATE') as authenticated_can_update,
       has_column_privilege('authenticated','public.bs_member_profiles',a.attname,'INSERT') as authenticated_can_insert
from pg_attribute a
where a.attrelid='public.bs_member_profiles'::regclass
  and a.attnum>0 and not a.attisdropped
order by a.attnum;

select role_name, has_table_privilege(role_name,'public.bs_member_profiles','TRUNCATE') as can_truncate
from (values ('anon'),('authenticated')) as roles(role_name);
