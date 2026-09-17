"use client";

import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { trackBoatEvent, trackBoatEventOnce } from "../lib/analytics";

const SIGNUP_MARKER = "bs_ga_signup_started_at";
const LINE_MARKER = "bs_ga_line_link_started_at";
const DISCORD_MARKER = "bs_ga_discord_link_started_at";
const FUNNEL_VIEW_MARKER = "bs_ga_funnel_last_path";

function makeSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
}

function mark(key) {
  try { window.localStorage.setItem(key, String(Date.now())); } catch {}
}

function hasRecentMarker(key, maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
  try {
    const raw = window.localStorage.getItem(key);
    const at = Number(raw || 0);
    return Number.isFinite(at) && at > 0 && Date.now() - at <= maxAgeMs;
  } catch { return false; }
}

function clearMarker(key) {
  try { window.localStorage.removeItem(key); } catch {}
}

function trackFunnelPageView(pathname) {
  if (pathname !== "/today" && pathname !== "/members") {
    try { window.sessionStorage.setItem(FUNNEL_VIEW_MARKER, pathname || ""); } catch {}
    return;
  }
  try {
    if (window.sessionStorage.getItem(FUNNEL_VIEW_MARKER) === pathname) return;
    window.sessionStorage.setItem(FUNNEL_VIEW_MARKER, pathname);
  } catch {}
  trackBoatEvent(pathname === "/today" ? "today_view" : "members_view", { source: pathname === "/today" ? "today" : "members" });
}

function parseRaceDetailHref(href) {
  try {
    const url = new URL(href, window.location.origin);
    const match = url.pathname.match(/^\/races\/(\d+)\/(\d+)$/);
    if (!match) return null;
    return {
      course_code: String(Number(match[1])),
      race_no: Number(match[2]),
      race_date: url.searchParams.get("date") || undefined,
    };
  } catch { return null; }
}

export default function BoatAnalyticsTracker() {
  const pathname = usePathname();
  const supabase = useMemo(() => makeSupabase(), []);

  useEffect(() => {
    trackFunnelPageView(pathname);
  }, [pathname]);

  useEffect(() => {
    const onSubmit = (event) => {
      if (pathname !== "/members") return;
      const submitter = event.submitter;
      const text = String(submitter?.textContent || "").trim();
      if (!text.includes("登録") || text.includes("ログイン")) return;
      mark(SIGNUP_MARKER);
      trackBoatEvent("sign_up_start", { method: "email", source_page: pathname });
    };

    const onClick = (event) => {
      const target = event.target?.closest?.("a,button");
      if (!target) return;
      const text = String(target.textContent || "").trim();
      const href = target.getAttribute?.("href") || "";

      if (text.includes("LINE連携コードを発行") || text.includes("新しいコードを発行")) {
        mark(LINE_MARKER);
        trackBoatEvent("line_link_start", { source_page: pathname });
      }

      if (text.includes("Discordを連携する")) {
        mark(DISCORD_MARKER);
        trackBoatEvent("discord_link_start", { source_page: pathname });
      }

      if (text.includes("PREMIUMを見る") || text.includes("PREMIUMに") || text.includes("β PREMIUM")) {
        trackBoatEvent("premium_cta_click", { source_page: pathname, cta_text: text.slice(0, 80) });
      }

      if (href === "/races" || href.startsWith("/races?")) {
        trackBoatEvent("race_entry_click", { source_page: pathname, cta_text: text.slice(0, 80) });
      }

      if (pathname === "/today") {
        const race = parseRaceDetailHref(href);
        if (race) {
          const params = { source: "today", course_code: race.course_code, race_no: race.race_no };
          if (race.race_date) params.race_date = race.race_date;
          trackBoatEvent("today_race_click", params);
        }
      }

      if (/^\/races\/\d+\/\d+$/.test(pathname) && href === "/members" && text.includes("無料会員")) {
        const match = pathname.match(/^\/races\/(\d+)\/(\d+)$/);
        trackBoatEvent("race_member_cta_click", {
          source: "race_detail",
          course_code: String(Number(match?.[1] || 0)),
          race_no: Number(match?.[2] || 0),
        });
      }

      if (pathname === "/members" && href === "/today") {
        trackBoatEvent("member_today_click", {
          source: text.includes("BoatStrikers TODAY") ? "registration_complete" : "member_page",
        });
      }
    };

    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("click", onClick, true);
    };
  }, [pathname]);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;

    async function checkJourney(session) {
      if (!alive || !session?.user?.id) return;
      const userId = session.user.id;

      if (hasRecentMarker(SIGNUP_MARKER)) {
        trackBoatEventOnce(`bs_ga_signup_complete_${userId}`, "sign_up", { method: "email" });
        clearMarker(SIGNUP_MARKER);
      }

      if (pathname === "/members/discord" && hasRecentMarker(DISCORD_MARKER)) {
        try {
          const response = await fetch("/api/members/discord/status", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
          const body = await response.json().catch(() => ({}));
          if (response.ok && body?.linked) {
            trackBoatEventOnce(`bs_ga_discord_complete_${userId}`, "discord_link_complete", { member_status: "linked" });
            clearMarker(DISCORD_MARKER);
          }
        } catch {}
      }
    }

    supabase.auth.getSession().then(({ data }) => checkJourney(data.session || null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextSession = session || null;
      window.setTimeout(() => {
        if (alive) void checkJourney(nextSession);
      }, 0);
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [pathname, supabase]);

  useEffect(() => {
    if (pathname !== "/members" || !hasRecentMarker(LINE_MARKER)) return;
    let sent = false;
    const detectLinkedState = () => {
      if (sent || !hasRecentMarker(LINE_MARKER)) return;
      const linked = Array.from(document.querySelectorAll("h2")).some((node) =>
        String(node.textContent || "").includes("公式LINEは連携済み")
      );
      if (!linked) return;
      sent = true;
      if (trackBoatEvent("line_link_complete", { member_status: "linked" })) clearMarker(LINE_MARKER);
    };
    detectLinkedState();
    const observer = new MutationObserver(detectLinkedState);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
