import StadiumGuideQuickNav from './StadiumGuideQuickNav';
import './unifiedStadiumGuide.css';

// Shared shell for all 24 BoatStrikers stadium strategy pages.
// Production refresh: unified navigation and mobile layout.
export default function StadiumGuideLayout({ children }) {
  return (
    <div className="stadiumUnified24">
      <StadiumGuideQuickNav />
      {children}
    </div>
  );
}
