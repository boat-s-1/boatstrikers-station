import { notFound } from 'next/navigation';
import ArticleDetail from '../../../../../blog/ArticleDetail';
import {draftPreviewData,blogAdminReady} from '../../../../../../lib/blog/adminData';
export const dynamic='force-dynamic';
export const metadata={title:'編集版プレビュー | BOATSTRIKERS BLOG',robots:{index:false,follow:false,nocache:true}};
export default async function DraftPreview({params}){if(!blogAdminReady())notFound();let article;try{article=await draftPreviewData((await params).id);}catch(e){if(e.code==='P0002'||e.status===404)notFound();throw e;}return <ArticleDetail article={article} preview="draft"/>;}
