-- READ ONLY. Post-remediation assertions: expected TRUE for every pass_* column.
-- On current production these assertions WILL FAIL; do not mistake this for a production-safe migration.
WITH roles AS (
 SELECT 'anon'::text AS role_name UNION ALL SELECT 'authenticated'
), table_checks AS (
 SELECT role_name,
 NOT has_table_privilege(role_name,'public.bs_member_profiles','TRUNCATE') AS pass_no_truncate,
 NOT has_table_privilege(role_name,'public.bs_member_profiles','DELETE') AS pass_no_delete,
 NOT has_table_privilege(role_name,'public.bs_member_profiles','INSERT') AS pass_no_insert,
 NOT has_table_privilege(role_name,'public.bs_member_profiles','TRIGGER') AS pass_no_trigger,
 NOT has_table_privilege(role_name,'public.bs_member_profiles','REFERENCES') AS pass_no_references
 FROM roles
)
SELECT * FROM table_checks ORDER BY role_name;

SELECT
 NOT has_column_privilege('anon','public.bs_member_profiles','display_name','UPDATE') AS pass_anon_cannot_update,
 has_column_privilege('authenticated','public.bs_member_profiles','display_name','UPDATE') AS pass_member_can_update_display_name,
 NOT has_column_privilege('authenticated','public.bs_member_profiles','is_admin','UPDATE') AS pass_no_admin_update,
 NOT has_column_privilege('authenticated','public.bs_member_profiles','plan','UPDATE') AS pass_no_plan_update,
 NOT has_column_privilege('authenticated','public.bs_member_profiles','premium_until','UPDATE') AS pass_no_premium_update,
 NOT has_column_privilege('authenticated','public.bs_member_profiles','membership_status','UPDATE') AS pass_no_membership_status_update,
 NOT has_column_privilege('authenticated','public.bs_member_profiles','user_id','UPDATE') AS pass_no_user_id_update;
