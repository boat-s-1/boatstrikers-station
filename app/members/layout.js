import SurgeNotificationBridge from "./SurgeNotificationBridge";

export default function MembersLayout({children}){
  return <>{children}<SurgeNotificationBridge /></>;
}
