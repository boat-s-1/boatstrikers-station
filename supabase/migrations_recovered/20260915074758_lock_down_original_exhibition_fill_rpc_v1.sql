revoke execute on function public.bs_fill_original_exhibition_v1(jsonb) from public;
revoke execute on function public.bs_fill_original_exhibition_v1(jsonb) from anon;
revoke execute on function public.bs_fill_original_exhibition_v1(jsonb) from authenticated;
grant execute on function public.bs_fill_original_exhibition_v1(jsonb) to service_role;