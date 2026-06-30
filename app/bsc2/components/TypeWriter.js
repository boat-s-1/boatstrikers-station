"use client";

import { useEffect, useState } from "react";

export default function TypeWriter({ text = "", speed = 35, onDone }) {
  const [displayText, setDisplayText] = useState("");

  useEffect(() => {
    setDisplayText("");

    if (!text) return;

    let index = 0;

    const timer = setInterval(() => {
      index += 1;
      setDisplayText(text.slice(0, index));

      if (index >= text.length) {
        clearInterval(timer);
        if (onDone) onDone();
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed, onDone]);

  return (
    <span>
      {displayText}
      {displayText.length < text.length && (
        <span className="typeCursor">|</span>
      )}
    </span>
  );
}
