import StadiumGuideQuickNav from './StadiumGuideQuickNav';
import './unifiedStadiumGuide.css';

export default function StadiumGuideLayout({ children }) {
  return (
    <div className="stadiumUnified24">
      <StadiumGuideQuickNav />
      {children}
    </div>
  );
}
