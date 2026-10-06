import { notFound } from 'next/navigation';
import Image from 'next/image';
import ArticleDetail from '../../ArticleDetail';
import { fixtureEnabled } from '../../../../lib/blog/articleModel.mjs';
import { BLOG_CHARACTERS, characterImage, poseLabel } from '../../../../lib/blog/characterAssets.mjs';
import s from '../../article.module.css';
export const dynamic='force-dynamic';
export const metadata={title:{absolute:'記事詳細の表示確認｜BOATSTRIKERS BLOG'},description:'Preview専用の構造化ブロック表示確認。公開記事ではありません。',robots:{index:false,follow:false,nocache:true}};
export default async function PreviewArticlePage() {
  if(!fixtureEnabled({vercelEnv:process.env.VERCEL_ENV,nodeEnv:process.env.NODE_ENV})) notFound();
  const { BLOG_ARTICLE_FIXTURE }=await import('../../../../lib/blog/previewFixture.mjs');
  return <ArticleDetail article={BLOG_ARTICLE_FIXTURE} preview>
    <details className={s.fixtureQa}><summary>Preview専用 · 3人の5ポーズを確認する</summary><p>管理エディタではなく、既存画像の表示確認です。</p>{['ichika','hatsune','kiina'].map(character=><section key={character}><h3>{BLOG_CHARACTERS[character].name}</h3><div className={s.poseRow}>{Object.keys(BLOG_CHARACTERS[character].poses).map(pose=><div key={pose}><Image src={characterImage(character,pose)} alt={`${BLOG_CHARACTERS[character].name} ${poseLabel(character,pose)}`} width={64} height={85} sizes="64px"/><span>{poseLabel(character,pose)}</span></div>)}</div></section>)}</details>
  </ArticleDetail>;
}
