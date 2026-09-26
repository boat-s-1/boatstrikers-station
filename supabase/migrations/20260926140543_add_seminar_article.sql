alter table public.seminar_magazine_issues
  add column if not exists article jsonb;

-- This six-page lesson was entered through the beginner-book form by mistake.
-- Keep the original as a draft so its contents remain available in the admin.
insert into public.seminar_magazine_issues
  (series, issue_no, number_label, title, summary, page_paths,
   premium_start_page, article, status, published_at)
select 'ichika', '002', '第1話', title, summary, page_paths,
       7, article, status, published_at
from public.ichika_book_issues
where series = 'sensei' and issue_no = '001'
  and title = 'イン逃げってなに？' and status = 'published'
on conflict (series, issue_no) do nothing;

update public.ichika_book_issues b
set status = 'draft', updated_at = now()
where b.series = 'sensei' and b.issue_no = '001'
  and b.title = 'イン逃げってなに？'
  and exists (
    select 1 from public.seminar_magazine_issues s
    where s.series = 'ichika' and s.issue_no = '002'
      and s.title = b.title and s.article = b.article
      and s.page_paths = b.page_paths and s.status = 'published'
  );
