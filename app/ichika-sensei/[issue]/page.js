import { notFound } from "next/navigation";
import BookIssueReader from "../../library/components/BookIssueReader";
import { getIchikaBookIssue, getIchikaBookSeries } from "../../../lib/ichikaBookSeries";

export const dynamic = "force-dynamic";

export default async function IchikaSenseiIssuePage({ params }) {
  const { issue: issueId } = await params;
  const series = getIchikaBookSeries("sensei");
  const issue = getIchikaBookIssue("sensei", issueId);
  if (!series || !issue) notFound();
  return <BookIssueReader series={series} issue={issue} />;
}
