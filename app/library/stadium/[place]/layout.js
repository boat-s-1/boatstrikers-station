import StadiumGuideQuickNav from './StadiumGuideQuickNav';
import StadiumPremiumMemberArea from './StadiumPremiumMemberArea';
import './unifiedStadiumGuide.css';

// Shared shell for all 24 BoatStrikers stadium strategy pages.
export default function StadiumGuideLayout({ children }) {
  return (
    <div className="stadiumUnified24">
      <StadiumGuideQuickNav />
      {children}
      <StadiumPremiumMemberArea />
    </div>
  );
}
