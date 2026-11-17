select cron.schedule(
  'hatsune-womens-inner-break-line',
  '*/2 * * * *',
  replace(
    (select command from cron.job where jobname = 'ichika-hidden-escape-line' limit 1),
    '/api/cron/ichika-hidden-escape',
    '/api/cron/hatsune-womens-inner-break'
  )
);