import test from 'node:test';
import assert from 'node:assert/strict';
import {articleDestinations,readingDestination,relatedPublicPosts,blogFlowEvent} from '../../lib/blog/navigation.mjs';
import {blankDocument,validateDocument} from '../../lib/blog/document.mjs';
test('theme CTAs have at most two real destinations, not identical mass links',()=>{
 for(const [slug,path] of [['inside-course','/ichika'],['women','/hatsune'],['longshot','/kiina'],['beginner','/guide']]){
  const links=articleDestinations({category:{slug}});assert.equal(links[0].href,path);assert.ok(links.length<=2);
 }
 assert.equal(articleDestinations({authors:[{slug:'kiina'}]})[0].href,'/kiina');
 assert.equal(articleDestinations({category:{slug:'news'}}).length,1);
});
test('stadium CTA uses explicit actual registry mapping, unknown data does not invent a path',()=>{
 assert.equal(articleDestinations({category:{slug:'stadiums'},document:{seo:{stadium_slug:'shimonoseki'}}})[0].href,'/library/stadium/shimonoseki');
 assert.equal(articleDestinations({category:{slug:'stadiums'},document:{seo:{stadium_slug:'invented'}}})[0].href,'/library/stadiums');
 const doc=blankDocument();doc.seo.stadium_slug='invented';assert.throws(()=>validateDocument(doc));doc.seo.stadium_slug='shimonoseki';assert.doesNotThrow(()=>validateDocument(doc));
});
const revision={id:'r',post_id:'p',seo:{stadium_slug:'shimonoseki'},category_id:'c',blog_post_authors:[{author_id:'a'}]};
const post={id:'p',slug:'real',state:'published',published_revision_id:'r',first_published_at:'2026-01-01T00:00:00Z',revision};
const index={posts:[post],authors:[{id:'a',slug:'ichika'}],categories:[{id:'c',slug:'beginner'}]};
test('reverse related shelf accepts only due public snapshot with exact author/stadium links',()=>{
 assert.equal(relatedPublicPosts(index,{character:'ichika'}).length,1);
 assert.equal(relatedPublicPosts(index,{character:'kiina'}).length,0);
 assert.equal(relatedPublicPosts(index,{stadium:'shimonoseki'}).length,1);
 assert.equal(relatedPublicPosts(index,{stadium:'omura'}).length,0);
 for(const override of [{state:'draft'},{state:'scheduled'},{published_revision_id:'edit'},{first_published_at:'2099-01-01'}])assert.equal(relatedPublicPosts({...index,posts:[{...post,...override}]},{}).length,0);
 assert.deepEqual(relatedPublicPosts({...index,posts:[]},{}),[]);
 assert.equal(readingDestination({character:'ichika'}).href,'/blog/authors/ichika');
});
test('GA navigation classification excludes Preview/admin/external, strips query data',()=>{
 const classify=(source,href)=>blogFlowEvent({source,href,origin:'https://www.boat-strike.online',placement:'test'});
 assert.equal(classify('/blog/articles/real','/today?date=2026-01-01').name,'blog_to_race');
 assert.equal(classify('/blog/articles/real','/ichika').name,'blog_to_character');
 for(const source of ['/races/19/1','/ichika','/library/stadium/shimonoseki'])assert.equal(classify(source,'/blog').name,'race_to_blog');
 assert.equal(classify('/library/stadium/shimonoseki','/blog').params.source_kind,'stadium');
 assert.equal(classify('/blog','/today?secret=x').params.destination_page,'/today');
 for(const [source,href] of [['/blog/preview/article','/today'],['/admin/blog','/blog'],['/blog','https://external.test/today'],['/races','/blog/preview/article'],['/blog','/blog/authors/ichika']])assert.equal(classify(source,href),null);
});
