export const COMMUNITY_CHARACTERS = Object.freeze([
  { key: 'ichika', name: '一果', href: '/community/ichika', description: 'イン逃げ・1号艇研究' },
  { key: 'hatsune', name: '初音', href: '/community/hatsune', description: '女子戦・女子レーサー研究' },
  { key: 'kiina', name: 'キイナ', href: '/community/kiina', description: '5号艇・穴狙い研究' },
]);
export const COMMUNITY_PUBLIC_VISIBILITIES = Object.freeze(['public_all', 'public_post_members_replies']);
export function isPublicThread(thread) {
  return Boolean(thread && thread.status === 'published' &&
    COMMUNITY_PUBLIC_VISIBILITIES.includes(thread.visibility) &&
    thread.published_at && Date.parse(thread.published_at) <= Date.now());
}
export function filterPublicThreads(rows, characterKey = null, limit = 5) {
  return (Array.isArray(rows) ? rows : [])
    .filter(isPublicThread)
    .filter(row => !characterKey || row.character_key === characterKey)
    .sort((a, b) => Date.parse(b.last_official_activity_at || b.published_at) - Date.parse(a.last_official_activity_at || a.published_at))
    .slice(0, Math.max(0, Math.min(20, limit)));
}
