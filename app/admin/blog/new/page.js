import { adminCatalogue,blogAdminReady,blogWritesReady } from '../../../../lib/blog/adminData';
import BlogEditor from '../BlogEditor';
export const dynamic='force-dynamic';
export const metadata={title:'新しい記事 | BOATSTRIKERS BLOG',robots:{index:false,follow:false}};
export default async function NewBlogPost(){let catalogue={authors:[],categories:[],tags:[],media:[]};if(blogAdminReady()) try{catalogue=await adminCatalogue();}catch{}return <BlogEditor catalogue={catalogue} writable={blogWritesReady()}/>;}
