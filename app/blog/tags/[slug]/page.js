import ArchivePage, { archiveMetadata } from '../../ArchivePage';
export const dynamic='force-dynamic';
export async function generateMetadata({params,searchParams}) {
 const {slug}=await params; return archiveMetadata('tags',slug,await searchParams||{});
}
export default async function Page({params,searchParams}) {
 const {slug}=await params; return <ArchivePage kind="tags" slug={slug} params={await searchParams||{}}/>;
}
