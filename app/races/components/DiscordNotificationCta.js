"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { trackBoatEvent } from "../../lib/analytics";
import {
  getMemberAuthSnapshot,
  getServerMemberAuthSnapshot,
  subscribeMemberAuth,
} from "../../lib/memberAuthState";
import styles from "./DiscordNotificationCta.module.css";

const SIGNUP_SOURCE_KEY = "bs_ga_discord_signup_source";

function rememberSource(source) {
  try { window.localStorage.setItem(SIGNUP_SOURCE_KEY, source); } catch {}
}

export default function DiscordNotificationCta({ source = "race", tone = "ai" }) {
  const memberAuth = useSyncExternalStore(
    subscribeMemberAuth,
    getMemberAuthSnapshot,
    getServerMemberAuthSnapshot,
  );
  const [discord, setDiscord] = useState({ loading: true, linked: false, eligible: true });

  useEffect(() => {
    if (memberAuth.status !== "signed_in" || !memberAuth.accessToken) {
      setDiscord({ loading: false, linked: false, eligible: true });
      return;
    }
    let alive = true;
    setDiscord((current) => ({ ...current, loading: true }));
    fetch("/api/members/discord/status", {
      headers: { Authorization: `Bearer ${memberAuth.accessToken}` },
      cache: "no-store",
    })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.error || "Discord状態を確認できませんでした。");
        if (alive) setDiscord({ loading: false, linked: Boolean(body.linked), eligible: Boolean(body.eligible) });
      })
      .catch(() => {
        if (alive) setDiscord({ loading: false, linked: false, eligible: true });
      });
    return () => { alive = false; };
  }, [memberAuth.status, memberAuth.accessToken]);

  function trackClick(action) {
    rememberSource(source);
    trackBoatEvent("discord_cta_click", {
      source_page: "races",
      placement: source,
      member_state: memberAuth.status,
      action,
    });
  }

  const signedIn = memberAuth.status === "signed_in";
  const href = signedIn
    ? "/members/discord"
    : `/members?mode=signup&next=discord&source=${encodeURIComponent(source)}`;
  const action = discord.linked ? "settings" : signedIn ? "connect" : "signup";
  const label = discord.linked
    ? "Discord通知設定を変更する →"
    : signedIn
      ? "Discordを連携する →"
      : "無料会員登録してDiscord通知を受け取る →";

  return (
    <aside className={`${styles.card} ${tone === "theory" ? styles.theory : styles.ai}`} aria-label="Discordリアルタイム通知">
      <div className={styles.icon} aria-hidden="true">🔔</div>
      <div className={styles.copy}>
        <span>REAL-TIME ALERTS</span>
        <strong>{discord.linked ? "通知はDiscordへ連携済みです" : "このあとの注目レースを見逃さない"}</strong>
        <small>
          {discord.linked
            ? "受け取るキャラクター通知をいつでも変更できます。"
            : "AI注目・理論成立・新聞公開をDiscordでリアルタイムにお知らせします。"}
        </small>
      </div>
      {memberAuth.status === "loading" || (signedIn && discord.loading) ? (
        <span className={styles.loading}>通知状態を確認中…</span>
      ) : !discord.eligible ? (
        <Link className={styles.button} href="/membership" onClick={() => trackClick("membership")}>利用条件を見る →</Link>
      ) : (
        <Link className={styles.button} href={href} onClick={() => trackClick(action)}>{label}</Link>
      )}
    </aside>
  );
}
