import { blogResponse,requireBlogAdmin } from '../../../../../lib/blog/server';
export async function GET(request){return blogResponse(async()=>{await requireBlogAdmin(request);const {adminCatalogue}=await import('../../../../../lib/blog/adminData');return adminCatalogue();});}
