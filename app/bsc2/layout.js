import "./bsc-theme.css";
import { AuthProvider } from "./context/AuthContext";

export const metadata = {
  robots: {
    index: false,
    follow: true,
    nocache: true,
    googleBot: {
      index: false,
      follow: true,
      noimageindex: false,
    },
  },
};

export default function Bsc2Layout({ children }) {
  return <AuthProvider>{children}</AuthProvider>;
}
