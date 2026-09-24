import { notFound } from "next/navigation";
import BookIssueReader from "../../library/components/BookIssueReader";
import { getIchikaBookIssue, getIchikaBookSeries } from "../../../lib/ichikaBookSeries";
import { getPublishedIchikaBook } from "../../../lib/ichikaBookDb";

export const dynamic = "force-dynamic";
export default async function IchikaSenseiIssuePage({ params }) {
  const { issue: issueId } = await params;
  const series = getIchikaBookSeries("sensei");
  const managed = await getPublishedIchikaBook("sensei", issueId);
  const issue = managed || getIchikaBookIssue("sensei", issueId);
  if (!series || !issue) notFound();
  return <BookIssueReader series={series} issue={issue} />;
}
