"use client";

import { useEffect, useState } from "react";

export default function TypeWriter({ text = "", speed = 35 }) {
  const [displayText, setDisplayText] = useState("");

  useEffect(() => {
    setDisplayText("");

    let index = 0;

    const timer = setInterval(() => {
      index += 1;
      setDisplayText(text.slice(0, index));

      if (index >= text.length) {
        clearInterval(timer);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed]);

  return (
    <span>
      {displayText}
      {displayText.length < text.length && <span className="typeCursor">|</span>}
    </span>
  );
}
