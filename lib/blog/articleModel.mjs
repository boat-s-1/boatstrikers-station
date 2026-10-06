import { safeLink } from './document.mjs';
import { BLOG_CHARACTERS } from './characterAssets.mjs';

export const articleHref = slug => `/blog/articles/${encodeURIComponent(slug)}`;
export function fixtureEnabled({ vercelEnv, nodeEnv }) {
  return vercelEnv === 'preview' || (!vercelEnv && nodeEnv === 'development');
}
export function safeArticleLink(href) {
  if (!safeLink(href)) return false;
  const path = href.startsWith('/') ? href : new URL(href).pathname;
  return !/^\/(?:blog\/preview|blog-preview)(?:\/|$)/.test(path);
}
export function articleSections(blocks) {
  const takeaways = [], body = [], ending = [], related = [], ctas = [];
  for (const block of [...blocks].sort((a,b) => (a.position ?? 0) - (b.position ?? 0))) {
    if (block.type === 'RELATED_ARTICLES') related.push(block);
    else if (block.type === 'CTA' && block.data.placement === 'ending') ctas.push(block);
    else if (block.data.placement === 'takeaways') takeaways.push(block);
    else if (['summary','notes','sources'].includes(block.data.placement)) ending.push(block);
    else body.push(block);
  }
  const toc = body.filter(b=>b.type === 'HEADING').map(b=>({id:`section-${b.id}`,text:b.data.text,level:b.data.level}));
  return { takeaways, body, ending, related, ctas, toc };
}
export function speechPresentation(turn, previous) {
  const character = BLOG_CHARACTERS[turn.character];
  if (!character || !character.poses[turn.pose]) return null;
  const alignment = turn.alignment === 'right' ? 'right' : 'left';
  return {name:character.name,kind:character.kind,alignment,
    compact:Boolean(previous && previous.character === turn.character && (previous.alignment === 'right' ? 'right' : 'left') === alignment)};
}
export function themeCta(categorySlug) {
  if (categorySlug === 'inside-course') return {label:'一果のイン逃げ研究を見る',href:'/ichika',text:'学んだ見方を、一果の見解や今日の出走表と合わせてみましょう。',accent:'ichika'};
  if (['women','racers'].includes(categorySlug)) return {label:'初音の女子戦研究を見る',href:'/hatsune',text:'選手を見る視点を、初音の見解と合わせて確かめてみましょう。',accent:'hatsune'};
  if (categorySlug === 'longshot') return {label:'キイナの穴・展開研究を見る',href:'/kiina',text:'展開の見方を、キイナの見解や今日の出走表と合わせてみましょう。',accent:'kiina'};
  return {label:'今日のレースを見る',href:'/today',text:'学んだ視点を、出走表や3人の見解と合わせてみましょう。',accent:'ichika'};
}
export const EXISTING_READING_LINKS = {
  '/guide/race-card':'出走表の見方', '/guide/exhibition':'展示航走の見方',
  '/guide/average-st':'平均STの見方', '/guide/series-performance':'今節成績の見方',
  '/guide/odds-payout':'オッズと払戻金の見方',
  '/data-lab/women-vs-mixed':'女子戦と混合戦は何が違う？',
  '/data-lab/boat5-win':'5号艇が1着になるレースには何がある？',
  '/guide':'3人で学ぶ初心者ガイド', '/how-to-use':'BoatStrikersの使い方',
  '/guide/inside-course':'イン逃げの基本', '/guide/course-entry':'進入とコースの見方',
  '/guide/start-exhibition':'スタート展示の見方', '/library/stadiums':'24場攻略ノート',
};
export function resolveRelated(data, relatedPosts) {
  const result = (data.post_ids || []).map(id=>relatedPosts.find(p=>p.id===id)).filter(Boolean);
  for (const path of data.paths || []) if (safeArticleLink(path)) result.push({href:path,title:EXISTING_READING_LINKS[path] || '関連ページを読む',existing:true});
  return result;
}
export { articleMetadata } from './seo.mjs';
