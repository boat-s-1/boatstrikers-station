import { notFound } from 'next/navigation';
import { editorData,blogAdminReady,blogWritesReady } from '../../../../../lib/blog/adminData';
import BlogEditor from '../../BlogEditor';
export const dynamic='force-dynamic';
export const metadata={title:'記事編集 | BOATSTRIKERS BLOG',robots:{index:false,follow:false}};
export default async function EditBlogPost({params}){if(!blogAdminReady())notFound();const {id}=await params;let result;try{result=await editorData(id);}catch(e){if(e.code==='P0002'||e.status===404)notFound();throw e;}return <BlogEditor key={id} {...result} writable={blogWritesReady()}/>;}
