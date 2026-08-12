import { redirect } from "next/navigation";
import { isScheduleAdminAuthenticated } from "../schedule/_lib/scheduleAdminAuth";
import RealtimeAdminClient from "./RealtimeAdminClient";

export const dynamic = "force-dynamic";
export default async function RealtimeAdminPage(){
  if (!(await isScheduleAdminAuthenticated())) redirect("/admin/realtime/login");
  return <RealtimeAdminClient/>;
}
