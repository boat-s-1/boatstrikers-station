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
    }, 750);
  };

  return (
    <a
      href={book.href}
      onClick={handleClick}
      className={`shelfBook ${book.className} ${opening ? "openBook" : ""}`}
    >
      <div className="bookSpine">
        <span className="bookIcon">{book.icon}</span>
        <h2>{book.title}</h2>
        <p>{book.text}</p>
      </div>

      <div className="bookInside">
        <span>📖</span>
        <b>OPEN...</b>
      </div>
    </a>
  );
}
