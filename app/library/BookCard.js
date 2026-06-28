"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function BookCard({ book }) {
  const router = useRouter();
  const [opening, setOpening] = useState(false);

  const handleClick = (e) => {
    e.preventDefault();
    setOpening(true);

    setTimeout(() => {
      router.push(book.href);
    }, 850);
  };

  return (
    <a
      href={book.href}
      onClick={handleClick}
      className={`shelfBookWithSpine ${book.className} ${
        opening ? "openBook" : ""
      }`}
    >
      <div className="bookBody">
        <div className="bookSpineSide">
          <span>{book.icon}</span>
          <b>{book.title}</b>
        </div>

        <div className="bookFrontCover">
          {book.cover ? (
            <img src={book.cover} alt={book.title} />
          ) : (
            <div className="fallbackCover">
              <span>{book.icon}</span>
              <h2>{book.title}</h2>
              <p>{book.text}</p>
            </div>
          )}
        </div>
      </div>

      <div className="bookInsidePage">
        <span>📖</span>
        <b>OPEN...</b>
      </div>
    </a>
  );
}
