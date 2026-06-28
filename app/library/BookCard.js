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
    }, 1100);
  };

  return (
    <a
      href={book.href}
      onClick={handleClick}
      className={`magazineBook ${opening ? "openBook" : ""}`}
    >
      <div className="magazineCoverWrap">
        {book.cover ? (
          <img src={book.cover} alt={book.title} />
        ) : (
          <div className={`magazineFallback ${book.className}`}>
            <span>{book.icon}</span>
            <h3>{book.title}</h3>
            <p>{book.text}</p>
          </div>
        )}
      </div>

      <div className="magazineOpen">
        {book.inside ? (
          <img
            src={book.inside}
            alt={`${book.title}の中ページ`}
            className="insideImage"
          />
        ) : (
          <>
            <span>📖</span>
            <b>OPEN...</b>
          </>
        )}
      </div>
    </a>
  );
}
