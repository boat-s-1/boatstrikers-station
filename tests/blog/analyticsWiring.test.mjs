import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {blogFlowEvent} from '../../lib/blog/navigation.mjs';
const source=readFileSync(new URL('../../app/components/BoatAnalyticsTracker.js',import.meta.url),'utf8');
const handler=source.slice(source.indexOf('const onClick = ')+16,source.indexOf('    document.addEventListener("submit"')).trim().replace(/;$/,'');
function click(pathname,href,hostname='www.boat-strike.online'){
 const sent=[];
 const onClick=new Function('pathname','window','blogFlowEvent','trackBoatEvent','parseRaceDetailHref',`return (${handler});`)(pathname,{location:{origin:`https://${hostname}`,hostname}},blogFlowEvent,(name,params)=>sent.push({name,params}),()=>null);
 const target={textContent:'読む',getAttribute:()=>href,closest(selector){return selector==='a,button'?this:selector==='[data-blog-placement]'?{getAttribute:()=> 'article-theme-cta'}:null;}};
 onClick({target});return sent;
}
test('actual delegated click handler dispatches BLOG/RACE events with placement via existing GA wrapper',()=>{
 assert.match(source,/document\.addEventListener\("click", onClick, true\)/);
 assert.equal(click('/blog/articles/article','/today')[0].name,'blog_to_race');
 for(const actor of ['ichika','hatsune','kiina']){
  const result=click('/blog/articles/article',`/${actor}`);assert.equal(result[0].name,'blog_to_character');assert.equal(result[0].params.placement,'article-theme-cta');
 }
 for(const path of ['/ichika','/races/19/1','/library/stadium/shimonoseki'])assert.equal(click(path,'/blog')[0].name,'race_to_blog');
});
test('actual handler excludes Preview host/routes, admin and outbound sites from production BLOG telemetry',()=>{
 assert.deepEqual(click('/blog/articles/article','/today','example.vercel.app'),[]);
 for(const path of ['/blog/preview/trials/article','/admin/blog'])assert.deepEqual(click(path,'/ichika'),[]);
 assert.deepEqual(click('/blog/articles/article','https://another.test/today'),[]);
});
