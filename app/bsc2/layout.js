import "./bsc-theme.css";
import { AuthProvider } from "./context/AuthContext";

export default function Bsc2Layout({ children }) {
  return <AuthProvider>{children}</AuthProvider>;
}
