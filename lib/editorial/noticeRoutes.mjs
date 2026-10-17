const subtree = (path, root) => path === root || path.startsWith(root + '/');
export function showResponsibleFooter(pathname = '/') {
  const path = pathname.replace(/\/$/, '') || '/';
  if (['/admin', '/api', '/members', '/blog', '/blog-preview', '/bsc2/admin', '/bsc2/login', '/bsc2/auth-debug'].some(root => subtree(path, root))) return false;
  return ['/ichika', '/hatsune', '/kiina', '/today', '/ai-results', '/newspapers', '/library/stadiums'].includes(path)
    || ['/races', '/news', '/library/stadium'].some(root => subtree(path, root));
}
