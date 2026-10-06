import { notFound } from 'next/navigation';
import { loadPublicBlogArticle } from '../../../../lib/blog/publicServer';
import { articleMetadata } from '../../../../lib/blog/articleModel.mjs';
import ArticleDetail from '../../ArticleDetail';
export const dynamic='force-dynamic';
export async function generateMetadata({params}) {
  const {slug}=await params;
  const article=await loadPublicBlogArticle(slug);
  return article?articleMetadata(article,{env:process.env.VERCEL_ENV}):{title:{absolute:'記事が見つかりません｜BOATSTRIKERS BLOG'},robots:{index:false,follow:false}};
}
export default async function ArticlePage({params}) {
  const {slug}=await params;
  const article=await loadPublicBlogArticle(slug);
  if(!article) notFound();
  return <ArticleDetail article={article}/>;
}
