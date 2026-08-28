import AdminTopBackLink from "./AdminTopBackLink";
import AdminHatsuneNewsShortcut from "./AdminHatsuneNewsShortcut";
import "./adminLayout.css";

export default function AdminLayout({ children }) {
  return (
    <>
      <AdminTopBackLink />
      <AdminHatsuneNewsShortcut />
      {children}
    </>
  );
}
