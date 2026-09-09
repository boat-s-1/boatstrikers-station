import KiinaTheoryLabelBridge from "./KiinaTheoryLabelBridge";
import MemberChannelBridge from "./MemberChannelBridge";

export const metadata = {
  robots: { index: false, follow: false, noarchive: true },
};

export default function MembersLayout({children}){
  return <>{children}<KiinaTheoryLabelBridge /><MemberChannelBridge /></>;
}
