import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "./_lib/adminAuth";
import SyncDashboardClient from "./SyncDashboardClient";

export const dynamic = "force-dynamic";

export default async function SyncAdminPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/sync/login");
  return <SyncDashboardClient />;
}
