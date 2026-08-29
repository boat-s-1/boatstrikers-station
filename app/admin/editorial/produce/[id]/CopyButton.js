"use client";

import { useState } from "react";

export default function CopyButton({ text, label = "コピー" }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text || "");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return <button type="button" onClick={copy}>{copied ? "✓ コピーしました" : label}</button>;
}
