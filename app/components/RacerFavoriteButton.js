"use client";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import {
  getMemberAuthSnapshot,
  getServerMemberAuthSnapshot,
  subscribeMemberAuth,
} from "../lib/memberAuthState";

function normalizeRegistration(pathname) {
  const match = String(pathname || "").match(/^\/racers\/(\d{1,5})\/?$/);
  if (!match) return null;
  return match[1].padStart(5, "0");
}

function makeSupabase(accessToken) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !accessToken) return null;
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export default function RacerFavoriteButton() {
  const pathname = usePathname() || "";
  const registrationNo = normalizeRegistration(pathname);
  const memberAuth = useSyncExternalStore(
    subscribeMemberAuth,
    getMemberAuthSnapshot,
    getServerMemberAuthSnapshot,
  );
  const [mount, setMount] = useState(null);
  const [favorite, setFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const supabase = useMemo(
    () => makeSupabase(memberAuth.status === "signed_in" ? memberAuth.accessToken : ""),
    [memberAuth.status, memberAuth.accessToken],
  );

  useEffect(() => {
    if (!registrationNo) {
      setMount(null);
      return undefined;
    }

    let tries = 0;
    const ensureMount = () => {
      const hero = document.querySelector("main section");
      if (!hero) return false;
      const favoriteCell = hero.querySelector("[data-racer-favorite-cell]");
      const heading = hero.querySelector("h1");
      if (!favoriteCell && !heading) return false;

      let node = hero.querySelector("[data-racer-favorite-mount]");
      if (!node) {
        node = document.createElement("div");
        node.dataset.racerFavoriteMount = "true";
        if (favoriteCell) favoriteCell.appendChild(node);
        else heading.insertAdjacentElement("afterend", node);
      } else if (favoriteCell && node.parentElement !== favoriteCell) {
        favoriteCell.appendChild(node);
      }
      setMount(node);
      return true;
    };

    if (ensureMount()) return undefined;
    const timer = window.setInterval(() => {
      tries += 1;
      if (ensureMount() || tries >= 25) window.clearInterval(timer);
    }, 120);
    return () => window.clearInterval(timer);
  }, [registrationNo]);

  useEffect(() => {
    let active = true;
    setError("");

    if (!registrationNo || memberAuth.status !== "signed_in" || !memberAuth.user?.id || !supabase) {
      setFavorite(false);
      setLoading(memberAuth.status === "loading");
      return () => { active = false; };
    }

    setLoading(true);
    supabase
      .from("bs_member_favorite_racers")
      .select("racer_registration_no")
      .eq("user_id", memberAuth.user.id)
      .eq("racer_registration_no", registrationNo)
      .maybeSingle()
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) throw queryError;
        setFavorite(Boolean(data));
      })
      .catch((queryError) => {
        if (!active) return;
        console.error("[RacerFavoriteButton]", queryError);
        setError("お気に入り状態を確認できませんでした。");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [registrationNo, memberAuth.status, memberAuth.user?.id, supabase]);

  async function toggleFavorite() {
    if (busy || !supabase || !memberAuth.user?.id || !registrationNo) return;
    setBusy(true);
    setError("");
    try {
      if (favorite) {
        const { error: deleteError } = await supabase
          .from("bs_member_favorite_racers")
          .delete()
          .eq("user_id", memberAuth.user.id)
          .eq("racer_registration_no", registrationNo);
        if (deleteError) throw deleteError;
        setFavorite(false);
      } else {
        const { error: insertError } = await supabase
          .from("bs_member_favorite_racers")
          .insert({ user_id: memberAuth.user.id, racer_registration_no: registrationNo });
        if (insertError) throw insertError;
        setFavorite(true);
      }
    } catch (actionError) {
      console.error("[RacerFavoriteButton]", actionError);
      setError("お気に入りの更新に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  if (!mount || !registrationNo) return null;

  let content;
  if (memberAuth.status === "signed_in") {
    content = (
      <div className="racerFavoriteWrap" aria-live="polite">
        <button
          type="button"
          className={`racerFavoriteButton ${favorite ? "isFavorite" : ""}`}
          onClick={toggleFavorite}
          disabled={loading || busy}
          aria-pressed={favorite}
        >
          <span aria-hidden="true">{favorite ? "★" : "☆"}</span>
          {loading ? "確認中…" : busy ? "更新中…" : favorite ? "お気に入り済み" : "お気に入り"}
        </button>
        <small>会員限定</small>
        {error ? <span className="racerFavoriteError" role="alert">{error}</span> : null}
      </div>
    );
  } else if (memberAuth.status === "signed_out") {
    content = (
      <div className="racerFavoriteWrap">
        <Link href="/members?mode=login" prefetch={false} className="racerFavoriteLogin">
          <span aria-hidden="true">☆</span> お気に入り
        </Link>
        <small>無料会員限定</small>
      </div>
    );
  } else {
    content = (
      <div className="racerFavoriteWrap">
        <span className="racerFavoriteLoading">☆ お気に入り</span>
        <small>会員確認中</small>
      </div>
    );
  }

  return createPortal(content, mount);
}
