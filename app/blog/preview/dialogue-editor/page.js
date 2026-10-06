import { notFound } from 'next/navigation';
import { fixtureEnabled } from '../../../../lib/blog/articleModel.mjs';
import DialoguePlayground from './DialoguePlayground';
import BlogShell from '../../BlogShell';
export const dynamic='force-dynamic';
export const metadata={title:{absolute:'会話シーン編集の表示確認｜BOATSTRIKERS BLOG'},robots:{index:false,follow:false,nocache:true}};
export default function DialogueEditorPreview(){
 if(!fixtureEnabled({vercelEnv:process.env.VERCEL_ENV,nodeEnv:process.env.NODE_ENV}))notFound();
 return <BlogShell><DialoguePlayground/></BlogShell>;
}
