import { STADIUMS } from '../stadiums.js';
import { duePublicPost } from './seo.mjs';
import { safeLink } from './document.mjs';
const characters=['ichika','hatsune','kiina'];
const names={ichika:'一果',hatsune:'初音',kiina:'キイナ'};
function themeDestinations({category,authors=[],document={}}) {
 const today={href:'/today',label:'今日のレースを見る'};
 if(category?.slug==='beginner') return [{href:'/guide',label:'3人で学ぶ初心者ガイド'},{href:'/how-to-use',label:'BoatStrikersの使い方'}];
 if(category?.slug==='stadiums') {
  const stadium=STADIUMS.find(s=>s.slug===document.seo?.stadium_slug);
  return [{href:stadium?`/library/stadium/${stadium.slug}`:'/library/stadiums',label:stadium?`${stadium.name}のデータブックを見る`:'24場のデータブックを見る'},today];
 }
 const thematic={'inside-course':'ichika',women:'hatsune',racers:'hatsune',longshot:'kiina'}[category?.slug];
 const author=authors.map(a=>a.character_key||a.slug).find(a=>characters.includes(a));
 const character=thematic||author;
 return character?[{href:`/${character}`,label:`${names[character]}の部屋を見る`},today]:[today];
}
// Preserve editor-configured ending CTA content, with a maximum of two links.
export function articleDestinations(article) {
 const manual=(article.document?.blocks||[]).filter(b=>b.type==='CTA'&&b.data?.placement==='ending'&&safeLink(b.data.href)&&!/^\/blog\/preview(?:\/|$)/.test(b.data.href)).sort((a,b)=>(a.position||0)-(b.position||0)).map(b=>({href:b.data.href,label:b.data.label||'BoatStrikersで詳しく見る',text:b.data.text}));
 const links=[...manual,...themeDestinations(article)];
 return links.filter((link,i)=>links.findIndex(l=>l.href===link.href)===i).slice(0,2);
}
export function readingDestination({character,stadium}={}) {
 if(characters.includes(character))return {href:`/blog/authors/${character}`,label:`${names[character]}の記事で、もっと詳しく学ぶ`};
 if(stadium)return {href:'/blog/categories/stadiums',label:'BLOGで24場の特徴を学ぶ'};
 return {href:'/blog',label:'BOATSTRIKERS BLOGで、レースの見方を学ぶ'};
}
export function relatedPublicPosts(index,{character,stadium}={},now=Date.now()) {
 return index.posts.filter(p=>{
  if(!duePublicPost(p,now)||p.revision?.id!==p.published_revision_id||p.revision?.post_id!==p.id)return false;
  const r=p.revision;
  if(stadium)return r.seo?.stadium_slug===stadium;
  if(character){const authorIds=index.authors.filter(a=>(a.character_key||a.slug)===character).map(a=>a.id);return (r.blog_post_authors||[]).some(a=>authorIds.includes(a.author_id));}
  const category=index.categories.find(c=>c.id===r.category_id);
  return ['beginner','data-lab','inside-course'].includes(category?.slug);
 }).slice(0,3);
}
export function blogFlowEvent({source,href,origin,placement='link'}) {
 try {
  const url=new URL(href,origin);if(url.origin!==origin||!href)return null;
  const destination=url.pathname;
  if(/^\/(?:admin|blog\/preview)(?:\/|$)/.test(source)||/^\/(?:admin|blog\/preview)(?:\/|$)/.test(destination))return null;
  const blog=p=>p==='/blog'||p.startsWith('/blog/');
  const char=destination.match(/^\/(ichika|hatsune|kiina)$/)?.[1];
  const race=p=>p==='/'||/^\/(?:today|races|ichika|hatsune|kiina|guide|how-to-use|library)(?:\/|$)/.test(p);
  const name=blog(source)&&char?'blog_to_character':blog(source)&&race(destination)?'blog_to_race':race(source)&&blog(destination)?'race_to_blog':null;
  return name?{name,params:{source_page:source,destination_page:destination,placement,source_kind:source.startsWith('/library/stadium/')?'stadium':/^\/(ichika|hatsune|kiina)$/.test(source)?'character':blog(source)?'blog':'race',...(char?{character:char}:{})}}:null;
 }catch{return null;}
}
