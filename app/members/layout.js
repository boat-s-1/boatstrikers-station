import KiinaTheoryLabelBridge from "./KiinaTheoryLabelBridge";

export const metadata = {
  robots: { index: false, follow: false, noarchive: true },
};

export default function MembersLayout({children}){
  return <>{children}<KiinaTheoryLabelBridge /></>;
}
