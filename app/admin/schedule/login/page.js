import { redirect } from "next/navigation";
import { isScheduleAdminAuthenticated } from "../_lib/scheduleAdminAuth";
import ScheduleLoginClient from "./ScheduleLoginClient";

export const dynamic = "force-dynamic";

export default async function ScheduleLoginPage() {
  if (await isScheduleAdminAuthenticated()) {
    redirect("/admin/schedule");
  }

  return <ScheduleLoginClient />;
}
