import { redirect } from "next/navigation";
import AdminTopBackLink from "./AdminTopBackLink";
import AdminHatsuneNewsShortcut from "./AdminHatsuneNewsShortcut";
import { isAdminAuthenticated } from "./sync/_lib/adminAuth";
import "./adminLayout.css";

export const metadata = {
  robots: { index: false, follow: false, noarchive: true },
};

export default async function AdminLayout({ children }) {
  const authenticated = await isAdminAuthenticated().catch(() => false);
  if (!authenticated) redirect("/admin-login");

  return (
    <>
      <AdminTopBackLink />
      <AdminHatsuneNewsShortcut />
      <form action="/api/admin/logout" method="post" style={{ position: "fixed", right: 12, top: 12, zIndex: 1000 }}>
        <button type="submit" style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #334155", background: "#0f172a", color: "#fff", cursor: "pointer" }}>
          ログアウト
        </button>
      </form>
      {children}
    </>
  );
}
