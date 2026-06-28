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
    }, 700);
  };

  return (
    <a
      href={book.href}
      onClick={handleClick}
      className={`shelfBookSimple ${book.className} ${opening ? "openBook" : ""}`}
    >
      <div className="bookCoverSimple">
        <span>{book.icon}</span>
        <h2>{book.title}</h2>
        <p>{book.text}</p>
        <b>本を開く ›</b>
      </div>

      <div className="bookInsideSimple">
        <span>📖</span>
        <b>OPEN...</b>
      </div>
    </a>
  );
}
