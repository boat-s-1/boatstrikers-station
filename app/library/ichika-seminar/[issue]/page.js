import { notFound } from "next/navigation";
import MagazineSwipeViewer from "../../components/MagazineSwipeViewer";
import { seminarMagazines } from "../../../../lib/seminarMagazines";
import { getSeminarIssue } from "../../../../lib/seminarMagazineLibrary";
export const dynamic = "force-dynamic";
export default async function IssuePage({ params }) { const { issue: issueId }=await params; const issue=await getSeminarIssue("ichika",issueId); if(!issue)notFound(); return <MagazineSwipeViewer magazine={seminarMagazines.ichika} issue={issue}/>; }
