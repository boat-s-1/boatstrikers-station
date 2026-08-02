import { redirect } from "next/navigation";
import { isScheduleAdminAuthenticated } from "../schedule/_lib/scheduleAdminAuth";
import ResultsAdminClient from "./ResultsAdminClient";

export const dynamic = "force-dynamic";

export default async function ResultsAdminPage() {
  if (!(await isScheduleAdminAuthenticated())) {
    redirect("/admin/schedule/login?next=/admin/results");
  }
  return <ResultsAdminClient />;
}
