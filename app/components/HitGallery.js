"use client";

import { useState } from "react";

export default function HitGallery({ hits = [] }) {
  const [selected, setSelected] = useState(null);

  if (!hits.length) return null;

  return (
    <>
      <div className="hitGallery">
        {hits.map((hit, index) => (
          <button
            type="button"
            className="hitGalleryCard"
            key={index}
            onClick={() => setSelected(hit)}
          >
            <img src={hit.image} alt={hit.title || "的中実績"} />
            <div>
              <strong>{hit.title || "🎯 的中"}</strong>
              <span>{hit.race}</span>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="hitModal" onClick={() => setSelected(null)}>
          <div className="hitModalBox" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="hitModalClose"
              onClick={() => setSelected(null)}
            >
              ×
            </button>

            <img src={selected.image} alt={selected.title || "的中実績"} />

            <div className="hitModalText">
              <h2>{selected.title || "🎯 的中"}</h2>
              <p>{selected.race}</p>

              {selected.note && (
                <a
                  href={selected.note}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  新聞を見る ›
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
