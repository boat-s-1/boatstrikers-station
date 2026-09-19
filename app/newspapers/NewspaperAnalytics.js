"use client";
import { useEffect } from "react";
import { trackBoatEvent } from "../lib/analytics";

export default function NewspaperAnalytics({ slug, character, edition }) {
  useEffect(() => { trackBoatEvent("newspaper_view", { newspaper_slug: slug, character, edition }); }, [slug, character, edition]);
  useEffect(() => {
    const handler = (event) => {
      const link = event.target.closest("a"); if (!link) return;
      if (link.dataset.newspaperNote === "1") trackBoatEvent("newspaper_note_click", { newspaper_slug: slug, character });
      if (link.dataset.newspaperMember === "1") trackBoatEvent("newspaper_member_cta_click", { newspaper_slug: slug, character });
    };
    document.addEventListener("click", handler); return () => document.removeEventListener("click", handler);
  }, [slug, character]);
  return null;
}
