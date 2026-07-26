import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "../sync/_lib/adminAuth";
import NoteFeatureAdmin from "./NoteFeatureAdmin";
import styles from "./note.module.css";

export const dynamic = "force-dynamic";
export default async function NoteAdminPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/sync/login");
  return <main className={styles.page}><NoteFeatureAdmin /></main>;
}
