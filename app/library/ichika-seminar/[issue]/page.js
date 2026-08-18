import { notFound } from "next/navigation";
import MagazineSwipeViewer from "../../components/MagazineSwipeViewer";
import { seminarMagazines } from "../../../../lib/seminarMagazines";

export default async function IssuePage({ params }) {
  const { issue: issueId } = await params;
  const magazine = seminarMagazines.ichika;
  const issue = magazine.issues.find((item) => item.id === issueId);
  if (!issue) notFound();
  return <MagazineSwipeViewer magazine={magazine} issue={issue} />;
}
