-- READ-ONLY. Run BEFORE and AFTER applying the AI drafting migrations and compare the two results.
-- Per existing article: identifiers and publication state only (no titles, body text or images).
-- Expected after applying: every row identical (the migrations do not touch existing articles).
select p.slug,
       p.state,
       p.edit_version,
       p.editing_revision_id is not null   as has_editing_revision,
       p.scheduled_revision_id is not null as has_scheduled_revision,
       p.published_revision_id is not null as has_published_revision,
       c.slug                              as category_slug,
       (select count(*) from public.blog_publication_events e where e.post_id = p.id) as publication_events,
       (select count(*) from public.blog_post_revisions r where r.post_id = p.id)     as revisions
from public.blog_posts p
left join public.blog_post_revisions cur on cur.id = coalesce(p.editing_revision_id, p.scheduled_revision_id, p.published_revision_id)
left join public.blog_categories c on c.id = cur.category_id
order by p.slug;
