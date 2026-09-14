"use client";

import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { trackBoatEvent, trackBoatEventOnce } from "../lib/analytics";

const SIGNUP_MARKER = "bs_ga_signup_started_at";
const LINE_MARKER = "bs_ga_line_link_started_at";
const DISCORD_MARKER = "bs_ga_discord_link_started_at";

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

export default function BoatAnalyticsTracker() {
  const pathname = usePathname();
  const supabase = useMemo(() => makeSupabase(), []);

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

      if (pathname === "/members" && hasRecentMarker(LINE_MARKER)) {
        const { data } = await supabase.from("bs_member_profiles").select("line_user_id,line_linked_at").eq("user_id", userId).maybeSingle();
        if (data?.line_user_id || data?.line_linked_at) {
          trackBoatEventOnce(`bs_ga_line_complete_${userId}`, "line_link_complete", { member_status: "linked" });
          clearMarker(LINE_MARKER);
        }
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

    const interval = pathname === "/members" && hasRecentMarker(LINE_MARKER)
      ? window.setInterval(() => supabase.auth.getSession().then(({ data }) => checkJourney(data.session || null)), 5000)
      : null;

    return () => {
      alive = false;
      subscription.unsubscribe();
      if (interval) window.clearInterval(interval);
    };
  }, [pathname, supabase]);

  return null;
}
