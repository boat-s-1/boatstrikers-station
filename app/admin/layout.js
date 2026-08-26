import AdminTopBackLink from "./AdminTopBackLink";
import "./adminLayout.css";

export default function AdminLayout({ children }) {
  return (
    <>
      <AdminTopBackLink />
      {children}
    </>
  );
}
