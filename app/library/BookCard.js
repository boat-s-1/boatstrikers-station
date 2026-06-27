"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function BookCard({ book }) {
  const router = useRouter();
  const [opening, setOpening] = useState(false);

  const openBook = (e) => {
    e.preventDefault();
    setOpening(true);

    setTimeout(() => {
      router.push(book.href);
    }, 700);
  };

  return (
    <a
      href={book.href}
      onClick={openBook}
      className={`bookCard3d ${book.className} ${opening ? "isOpening" : ""}`}
    >
      <div className="bookCover">
        <div className="bookIcon">{book.icon}</div>
        <h2>{book.title}</h2>
        <p>{book.text}</p>
        <b>本を開く ›</b>
      </div>

      <div className="bookPages">
        <span>📖</span>
        <p>Loading...</p>
      </div>
    </a>
  );
}
