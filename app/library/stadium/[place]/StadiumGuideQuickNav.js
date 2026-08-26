'use client';

import { useEffect } from 'react';

const ITEMS = [
  { id: 'stadium-overview', label: '30秒で読む', match: '30秒で読む' },
  { id: 'stadium-basic', label: '基本成績', match: '直近1年の基本成績' },
  { id: 'stadium-course', label: 'コース別', match: 'コース別1着率' },
  { id: 'stadium-trifecta', label: '出目', match: '3連単・出目ランキング' },
  { id: 'stadium-season', label: '季節', match: '季節別データ' },
  { id: 'stadium-wind', label: '風', match: '風向き・風速データ' },
  { id: 'stadium-premium', label: '攻略', match: 'データによるイン逃げ攻略' },
];

export default function StadiumGuideQuickNav() {
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll('.stadiumUnified24 main section'));
    for (const item of ITEMS) {
      const target = sections.find((section) => {
        const h2 = section.querySelector('h2');
        return h2?.textContent?.includes(item.match);
      });
      if (target && !target.id) target.id = item.id;
    }

    const gate = sections.find((section) => section.textContent?.includes('BOATSTRIKERS PREMIUM'));
    if (gate && !document.getElementById('stadium-premium')) gate.id = 'stadium-premium';
  }, []);

  return (
    <nav className="stadiumUnifiedNav" aria-label="24場攻略ページ内メニュー">
      <div className="stadiumUnifiedNavInner">
        {ITEMS.map((item) => (
          <a key={item.id} href={`#${item.id}`}>{item.label}</a>
        ))}
      </div>
    </nav>
  );
}
