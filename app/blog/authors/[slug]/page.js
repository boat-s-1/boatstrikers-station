import ArchivePage, { archiveMetadata } from '../../ArchivePage';
export const dynamic='force-dynamic';
export async function generateMetadata({params,searchParams}) {
 const {slug}=await params; return archiveMetadata('authors',slug,await searchParams||{});
}
export default async function Page({params,searchParams}) {
 const {slug}=await params; return <ArchivePage kind="authors" slug={slug} params={await searchParams||{}}/>;
}
