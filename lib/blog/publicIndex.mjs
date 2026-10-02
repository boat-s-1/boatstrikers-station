// Public list reader: anon + RLS, explicit columns, selected immutable snapshot only.
export async function readPublicIndex(client, now = new Date().toISOString()) {
  async function rows(query) { const { data, error } = await query; if (error) throw error; return data || []; }
  const [categories, authors, tags] = await Promise.all([
    rows(client.from('blog_categories').select('id,slug,name,description,position').eq('active', true).order('position')),
    rows(client.from('blog_authors').select('id,slug,name,role,bio,character_key,image_path').eq('active', true).order('slug')),
    rows(client.from('blog_tags').select('id,slug,name').eq('active', true).order('name')),
  ]);
  const posts = [];
  for (let start = 0; ; start += 200) {
    const page = await rows(client.from('blog_posts').select('id,slug,published_revision_id,first_published_at,last_published_at')
      .eq('state', 'published').not('published_revision_id', 'is', null).lte('first_published_at', now)
      .order('first_published_at', { ascending: false }).order('id').range(start, start + 199));
    if (page.length) {
      const revisions = await rows(client.from('blog_post_revisions')
        .select('id,post_id,title,excerpt,category_id,cover,blog_post_authors(author_id,position),blog_post_tags(tag_id)')
        .eq('state', 'sealed').in('id', page.map(p => p.published_revision_id)));
      for (const post of page) {
        const revision = revisions.find(r => r.id === post.published_revision_id && r.post_id === post.id);
        if (revision) posts.push({ ...post, revision });
      }
    }
    if (page.length < 200) break;
  }
  return { posts, categories, authors, tags };
}
export function indexFilters(params = {}) {
  const value = key => typeof params[key] === 'string' ? params[key].trim().slice(0, 100) : '';
  return { q: value('q'), category: value('category'), author: value('author'), tag: value('tag'), page: Math.max(1, Math.min(10000, Number.parseInt(value('page'), 10) || 1)) };
}
export function selectIndex(index, filters, featuredSlugs = []) {
  const category = index.categories.find(c => c.slug === filters.category);
  const author = index.authors.find(a => a.slug === filters.author);
  const tag = index.tags.find(t => t.slug === filters.tag);
  const filtered = index.posts.filter(p => {
    const r = p.revision;
    return (!filters.q || `${r.title} ${r.excerpt}`.normalize('NFKC').toLocaleLowerCase('ja').includes(filters.q.normalize('NFKC').toLocaleLowerCase('ja')))
      && (!filters.category || (category && r.category_id === category.id))
      && (!filters.author || (author && r.blog_post_authors.some(a => a.author_id === author.id)))
      && (!filters.tag || (tag && r.blog_post_tags.some(t => t.tag_id === tag.id)));
  }).sort((a, b) => Date.parse(b.first_published_at) - Date.parse(a.first_published_at) || a.id.localeCompare(b.id));
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  const page = Math.min(filters.page, pages);
  return { filtered, page, pages, latest: filtered.slice((page - 1) * 12, page * 12),
    featured: featuredSlugs.map(slug => filtered.find(p => p.slug === slug)).filter(Boolean).slice(0, 3),
    updated: filtered.filter(p => Date.parse(p.last_published_at) > Date.parse(p.first_published_at))
      .sort((a,b) => Date.parse(b.last_published_at) - Date.parse(a.last_published_at)).slice(0, 4),
    tags: index.tags.filter(t => index.posts.some(p => p.revision.blog_post_tags.some(x => x.tag_id === t.id))),
  };
}
