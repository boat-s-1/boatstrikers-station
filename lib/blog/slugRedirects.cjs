// Exceptional slug migrations require review + an explicit old -> new entry.
// Published slugs remain immutable in the database. No editor rename API exists.
// Never use external destinations or change an established article URL silently.
const BLOG_SLUG_REDIRECTS = Object.freeze({});
function slugRedirects(map = BLOG_SLUG_REDIRECTS) {
  const valid = slug => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 150;
  return Object.entries(map).map(([from,to]) => {
    if (!valid(from) || !valid(to) || from === to || Object.hasOwn(map,to)) throw new Error('Invalid BLOG slug redirect or redirect chain');
    return {source:`/blog/articles/${from}`,destination:`/blog/articles/${to}`,permanent:true};
  });
}
module.exports = { BLOG_SLUG_REDIRECTS, slugRedirects };
