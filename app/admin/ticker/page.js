import { redirect } from "next/navigation";
import { isScheduleAdminAuthenticated } from "../schedule/_lib/scheduleAdminAuth";
import TickerAdminClient from "./TickerAdminClient";
export const dynamic="force-dynamic";
export default async function Page(){if(!(await isScheduleAdminAuthenticated()))redirect("/admin/schedule/login");return <TickerAdminClient/>}
