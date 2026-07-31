import { redirect } from "next/navigation";
import { isRadioBlogAdmin } from "../../../lib/radioBlogAdminAuth";
import RadioBlogAdminClient from "./RadioBlogAdminClient";

export const dynamic = "force-dynamic";

export default async function RadioBlogAdminPage() {
  if (!(await isRadioBlogAdmin())) {
    redirect("/admin/radio-blog/login");
  }

  return <RadioBlogAdminClient />;
}
