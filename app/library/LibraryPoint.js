"use client";

import { useEffect, useState } from "react";

export default function LibraryPoint() {
  const [point, setPoint] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem("libraryPoint");
    if (saved) setPoint(Number(saved));
  }, []);

  const level = Math.floor(point / 50) + 1;
  const next = level * 50;
  const progress = Math.min((point % 50) * 2, 100);

  return (
    <section className="libraryPointCard">
      <h2>🎓 図書館レベル</h2>
      <strong>Lv.{level}</strong>
      <p>{point}pt / 次のレベルまであと {next - point}pt</p>

      <div className="pointBar">
        <span style={{ width: `${progress}%` }} />
      </div>
    </section>
  );
}
