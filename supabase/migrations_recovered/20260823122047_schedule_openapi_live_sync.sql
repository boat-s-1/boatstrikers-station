select cron.schedule(
  'boatstrikers-openapi-live-3m',
  '*/3 * * * *',
  $$select public.bs_sync_openapi_today();$$
);