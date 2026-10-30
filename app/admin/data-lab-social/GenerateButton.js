"use client";

import { useFormStatus } from "react-dom";

// 送信中は押せないようにして、二重送信を防ぐ
export default function GenerateButton({ disabled, children }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={disabled || pending}>{pending ? "生成中…" : children}</button>;
}
