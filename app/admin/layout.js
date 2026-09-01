import AdminTopBackLink from "./AdminTopBackLink";
import AdminHatsuneNewsShortcut from "./AdminHatsuneNewsShortcut";
import "./adminLayout.css";

export const metadata = {
  robots: { index: false, follow: false, noarchive: true },
};

export default function AdminLayout({ children }) {
  return (
    <>
      <AdminTopBackLink />
      <AdminHatsuneNewsShortcut />
      {children}
    </>
  );
}
