import ArchivePage, { archiveMetadata } from '../../ArchivePage';
export const dynamic='force-dynamic';
export async function generateMetadata({params,searchParams}) {
 const {slug}=await params; return archiveMetadata('categories',slug,await searchParams||{});
}
export default async function Page({params,searchParams}) {
 const {slug}=await params; return <ArchivePage kind="categories" slug={slug} params={await searchParams||{}}/>;
}
