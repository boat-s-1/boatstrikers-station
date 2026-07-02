"use client";

import { useEffect, useState } from "react";

export default function TypeWriter({ text = "", speed = 28 }) {
  const [display, setDisplay] = useState("");

  useEffect(() => {
    setDisplay("");
    let i = 0;

    const timer = setInterval(() => {
      setDisplay(text.slice(0, i + 1));
      i += 1;

      if (i >= text.length) clearInterval(timer);
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed]);

  return <>{display}</>;
}
