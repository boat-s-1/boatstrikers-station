'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import styles from './StadiumPremiumMemberArea.module.css';

const pct = value => value == null ? '—' : `${Number(value).toFixed(1)}%`;

function makeSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
}

export default function StadiumPremiumMemberArea() {
  const supabase = useMemo(() => makeSupabase(), []);
  const [target, setTarget] = useState(null);
  const [state, setState] = useState({ loading: true, loggedIn: false, data: null, error: '' });

  useEffect(() => {
    const main = document.querySelector('.stadiumUnified24 main');
    if (!main) return;
    const oldGate = Array.from(main.querySelectorAll('section')).find(section => section.textContent?.includes('BOATSTRIKERS PREMIUM'));
    if (oldGate) oldGate.style.display = 'none';
    const footer = main.querySelector('footer');
    const host = document.createElement('div');
    host.id = 'stadium-premium';
    if (footer) main.insertBefore(host, footer); else main.appendChild(host);
    setTarget(host);
    return () => host.remove();
  }, []);

  useEffect(() => {
    if (!supabase) {
      setState({ loading: false, loggedIn: false, data: null, error: '会員機能を確認できませんでした。' });
      return;
    }
    let alive = true;

    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session || null;
      if (!alive) return;
      if (!session) {
        setState({ loading: false, loggedIn: false, data: null, error: '' });
        return;
      }

      const parts = window.location.pathname.split('/').filter(Boolean);
      const place = parts[parts.length - 1];
      try {
        const response = await fetch(`/api/members/stadium-premium/${encodeURIComponent(place)}`, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(json?.error || 'Premiumデータを取得できませんでした。');
        if (alive) setState({ loading: false, loggedIn: true, data: json, error: '' });
      } catch (error) {
        if (alive) setState({ loading: false, loggedIn: true, data: null, error: error.message || 'Premiumデータを取得できませんでした。' });
      }
    }

    load();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => load());
    return () => { alive = false; subscription.unsubscribe(); };
  }, [supabase]);

  if (!target) return null;
  return createPortal(<PremiumContent state={state} />, target);
}

function PremiumContent({ state }) {
  if (state.loading) return <div className={styles.wrap}><div className={styles.loading}>会員情報を確認しています…</div></div>;

  if (!state.loggedIn) {
    return <div className={styles.wrap}>
      <section className={styles.gate}>
        <small>BOATSTRIKERS MEMBERS ONLY</small>
        <h2>ここから先は会員限定の24場攻略</h2>
        <p>イン攻略・穴攻略・展示攻略・当日レース攻略を、BoatStrikers会員限定で公開しています。2026年12月31日までは全プラン無料です。</p>
        <Link href="/members">無料で会員登録 / ログイン</Link>
      </section>
    </div>;
  }

  if (state.error || !state.data) {
    return <div className={styles.wrap}><div className={styles.error}>{state.error || 'Premiumデータを表示できませんでした。'}</div></div>;
  }

  const premium = state.data.premium || {};
  const inside = premium.insideStrategy || {};
  const upset = premium.upsetStrategy || {};
  const exhibition = premium.exhibitionReliability || {};
  const profile = premium.aiProfile || {};
  const todayRaces = state.data.today?.races || [];

  return <div className={styles.wrap}>
    <section className={styles.premiumHead}>
      <small>BOATSTRIKERS PREMIUM / MEMBERS ONLY</small>
      <h2>{state.data.stadium?.name || ''}・会員限定攻略</h2>
      <p>無料データを「どう狙うか」に変換した実戦向け攻略です。</p>
    </section>

    <div className={styles.grid}>
      <StrategyCard title="イン攻略" data={inside} />
      <StrategyCard title="穴攻略" data={upset} />
      <ExhibitionCard data={exhibition} />
      <section className={styles.card}>
        <span className={styles.grade}>攻略難易度 {profile.difficulty_label || '分析中'}</span>
        <h3>この場で重視する順番</h3>
        <ul className={styles.conditions}>{(profile.priority || []).map((item, index) => <li key={`${item}-${index}`}>{index + 1}. {item}</li>)}</ul>
        <p>{profile.premium_summary || profile.comment || '複数条件を組み合わせて判断してください。'}</p>
      </section>
    </div>

    <section className={styles.today}>
      <div className={styles.todayHead}>
        <div><h3>今日の直前攻略</h3><span>展示・風・進入が入ると当日評価へ更新</span></div>
        <span>{state.data.today?.raceDate || '本日開催データ確認中'}</span>
      </div>
      {todayRaces.length ? <div className={styles.raceList}>{todayRaces.map(race => <article className={styles.race} key={race.raceNo}><b>{race.raceNo}R</b><small>{race.phaseLabel || race.verdict || '分析中'}</small><strong>{race.verdict || '分析中'}</strong></article>)}</div> : <p>本日の開催データはまだありません。</p>}
    </section>

    <section className={styles.summary}>
      <small>MEMBERS CONCLUSION</small>
      <h3>この場の最終結論</h3>
      <p>{profile.premium_summary || profile.comment || 'イン・展示・風・穴条件を単独ではなく組み合わせて判断してください。'}</p>
    </section>
  </div>;
}

function StrategyCard({ title, data }) {
  const sample = Number(data?.sample_count || 0);
  return <section className={styles.card}>
    <span className={styles.grade}>{title} 評価 {data?.grade || '—'}</span>
    <h3>{data?.title || title}</h3>
    <p>{data?.description || '現在集計中です。'}</p>
    {data?.conditions?.length > 0 && <ul className={styles.conditions}>{data.conditions.map((item, index) => <li key={`${item}-${index}`}>✓ {item}</li>)}</ul>}
    <div className={styles.metric}><span>主要率</span><b>{pct(data?.primary_rate)}</b></div>
    <div className={styles.metric}><span>対象数</span><b>{sample.toLocaleString()}R</b></div>
  </section>;
}

function ExhibitionCard({ data }) {
  return <section className={styles.card}>
    <span className={styles.grade}>展示攻略 {data?.grade || '—'}</span>
    <h3>展示情報の信頼度</h3>
    <p>{data?.comment || '展示データを集計中です。'}</p>
    {(data?.metrics || []).slice(0, 3).map((item, index) => <div className={styles.metric} key={`${item.label}-${index}`}><span>{item.label}</span><b>{item.value_text || pct(item.value)}</b></div>)}
  </section>;
}
