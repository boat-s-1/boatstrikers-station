import { redirect } from "next/navigation";
import { isScheduleAdminAuthenticated } from "./_lib/scheduleAdminAuth";
import ScheduleAdminClient from "./ScheduleAdminClient";

export const dynamic = "force-dynamic";

export default async function ScheduleAdminPage() {
  if (!(await isScheduleAdminAuthenticated())) {
    redirect("/admin/schedule/login");
  }

  return <ScheduleAdminClient />;
}
