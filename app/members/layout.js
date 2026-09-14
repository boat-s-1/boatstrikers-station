import KiinaTheoryLabelBridge from "./KiinaTheoryLabelBridge";
import MemberChannelBridge from "./MemberChannelBridge";
import MemberUsageDashboard from "./MemberUsageDashboard";

export const metadata = {
  robots: { index: false, follow: false, noarchive: true },
};

export default function MembersLayout({children}){
  return <>{children}<MemberUsageDashboard /><KiinaTheoryLabelBridge /><MemberChannelBridge /></>;
}
