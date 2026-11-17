select cron.schedule(
  'ichika-hidden-escape-line',
  '*/2 * * * *',
  replace(
    (select command from cron.job where jobid = 3),
    '/api/cron/exhibition-alerts',
    '/api/cron/ichika-hidden-escape'
  )
);