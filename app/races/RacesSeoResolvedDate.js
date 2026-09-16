"use client";

import { useSearchParams } from "next/navigation";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default function RacesSeoResolvedDate({ fallbackDate }) {
  const searchParams = useSearchParams();
  const requestedDate = searchParams.get("date");
  const raceDate = DATE_PATTERN.test(requestedDate || "")
    ? requestedDate
    : fallbackDate;

  return <>{String(raceDate || "").replaceAll("-", "/")}</>;
}
