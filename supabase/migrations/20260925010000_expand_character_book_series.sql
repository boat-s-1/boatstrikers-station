alter table public.ichika_book_issues
  drop constraint if exists ichika_book_issues_series_check;

alter table public.ichika_book_issues
  add constraint ichika_book_issues_series_check check (series in (
    'sensei','meikan','data-lab',
    'hatsune-women','hatsune-sensei','hatsune-meikan','hatsune-data-lab',
    'kiina-hole','kiina-sensei','kiina-meikan','kiina-data-lab'
  ));
