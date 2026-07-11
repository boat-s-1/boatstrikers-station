"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function BscAdminPage() {
  const [pin, setPin] = useState("");
  const [ok, setOk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [menu, setMenu] = useState("top");

  const [form, setForm] = useState({
    id: new Date().toISOString().slice(0, 10) + "-daily",
    title: "蒲郡12R ドリーム戦",
    deadline: "20:35",
    ichika_main: "1-2-3",
    ichika_sub: "1-2-56",
    kiina_main: "5-1-4",
    hatsune_main: "2-1-3",
  });

  const [result, setResult] = useState({
    race_date: new Date().toISOString().slice(0, 10),
    place: "住之江",
    race_no: 11,
    category: "一果",
    bet_text: "1-2-3",
    invest: 1000,
    payout: 0,
    hit: false,
    memo: "",
  });

  const [stats, setStats] = useState({
    totalRace: 0,
    hitRace: 0,
    hitRate: 0,
    invest: 0,
    payout: 0,
    profit: 0,
    recovery: 0,
    maxPayout: 0,
  });

  const login = () => {
    if (pin === "bsc1234") setOk(true);
    else alert("PINが違います");
  };

  const saveEvent = async () => {
    if (!supabase) return alert("Supabase未接続です");

    setSaving(true);

    await supabase
      .from("daily_events")
      .update({ is_active: false })
      .eq("is_active", true);

    const { error } = await supabase.from("daily_events").upsert({
      ...form,
      is_active: true,
    });

    setSaving(false);

    if (error) {
      console.error(error);
      alert("保存に失敗しました");
      return;
    }

    alert("今日のイベントを保存しました！");
  };

  const saveResult = async () => {
    if (!supabase) return alert("Supabase未接続です");

    setSaving(true);

    const { error } = await supabase.from("bsc_results").insert({
      ...result,
      invest: Number(result.invest),
      payout: Number(result.payout),
      race_no: Number(result.race_no),
      hit: Number(result.payout) > 0,
    });

    setSaving(false);

    if (error) {
      console.error(error);
      alert("保存に失敗しました");
      return;
    }

    alert("レース結果を保存しました！");
    loadStats();
  };

  const loadStats = async () => {
    if (!supabase) return;

    const start = new Date();
    start.setDate(1);
    const monthStart = start.toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("bsc_results")
      .select("*")
      .gte("race_date", monthStart);

    if (error) {
      console.error(error);
      return;
    }

    const totalRace = data.length;
    const hitRace = data.filter((r) => r.hit).length;
    const invest = data.reduce((sum, r) => sum + Number(r.invest || 0), 0);
    const payout = data.reduce((sum, r) => sum + Number(r.payout || 0), 0);
    const maxPayout = data.reduce(
      (max, r) => Math.max(max, Number(r.payout || 0)),
      0
    );

    setStats({
      totalRace,
      hitRace,
      hitRate: totalRace ? Math.round((hitRace / totalRace) * 100) : 0,
      invest,
      payout,
      profit: payout - invest,
      recovery: invest ? Math.round((payout / invest) * 100) : 0,
      maxPayout,
    });
  };

  useEffect(() => {
    if (ok) loadStats();
  }, [ok]);

  if (!ok) {
    return (
      <main className="gamePage">
        <section className="bscAdminBox">
          <h1>BSC Admin</h1>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN"
            type="password"
          />
          <button onClick={login}>ログイン</button>
        </section>
      </main>
    );
  }

  return (
    <main className="gamePage">
      <header className="gameTopBar">
        <a href="/bsc2" className="gameBack">←</a>
        <div>
          <span>BSC</span>
          <h1>ADMIN</h1>
        </div>
        <div className="gameStatusMini">管理</div>
      </header>

      {menu === "top" && (
        <section className="bscAdminBox">
          <h2>管理画面トップ</h2>

          <button onClick={() => setMenu("event")}>
            BSCレース入力
          </button>

          <button onClick={() => setMenu("result")}>
            収支管理
          </button>

          <button onClick={() => setMenu("stats")}>
            今月の成績
          </button>
        </section>
      )}

      {menu === "event" && (
        <section className="bscAdminBox">
          <button onClick={() => setMenu("top")}>← 戻る</button>
          <h2>今日の予想イベント</h2>

          {Object.keys(form).map((key) => (
            <label key={key}>
              <span>{key}</span>
              <input
                value={form[key]}
                onChange={(e) =>
                  setForm({
                    ...form,
                    [key]: e.target.value,
                  })
                }
              />
            </label>
          ))}

          <button onClick={saveEvent} disabled={saving}>
            {saving ? "保存中..." : "保存する"}
          </button>
        </section>
      )}

      {menu === "result" && (
        <section className="bscAdminBox">
          <button onClick={() => setMenu("top")}>← 戻る</button>
          <h2>収支管理</h2>

          <label>
            <span>日付</span>
            <input
              type="date"
              value={result.race_date}
              onChange={(e) =>
                setResult({ ...result, race_date: e.target.value })
              }
            />
          </label>

          <label>
            <span>場名</span>
            <input
              value={result.place}
              onChange={(e) =>
                setResult({ ...result, place: e.target.value })
              }
            />
          </label>

          <label>
            <span>レース番号</span>
            <input
              type="number"
              value={result.race_no}
              onChange={(e) =>
                setResult({ ...result, race_no: e.target.value })
              }
            />
          </label>

          <label>
            <span>カテゴリ</span>
            <select
              value={result.category}
              onChange={(e) =>
                setResult({ ...result, category: e.target.value })
              }
            >
              <option>一果</option>
              <option>初音</option>
              <option>キイナ</option>
              <option>BSC</option>
            </select>
          </label>

          <label>
            <span>買い目</span>
            <input
              value={result.bet_text}
              onChange={(e) =>
                setResult({ ...result, bet_text: e.target.value })
              }
            />
          </label>

          <label>
            <span>投資金額</span>
            <input
              type="number"
              value={result.invest}
              onChange={(e) =>
                setResult({ ...result, invest: e.target.value })
              }
            />
          </label>

          <label>
            <span>払戻金額</span>
            <input
              type="number"
              value={result.payout}
              onChange={(e) =>
                setResult({ ...result, payout: e.target.value })
              }
            />
          </label>

          <label>
            <span>メモ</span>
            <input
              value={result.memo}
              onChange={(e) =>
                setResult({ ...result, memo: e.target.value })
              }
            />
          </label>

          <button onClick={saveResult} disabled={saving}>
            {saving ? "保存中..." : "レース結果を保存"}
          </button>
        </section>
      )}

      {menu === "stats" && (
        <section className="bscAdminBox">
          <button onClick={() => setMenu("top")}>← 戻る</button>
          <h2>今月の成績</h2>

          <div className="bscStatsGrid">
            <div>予想数：{stats.totalRace}R</div>
            <div>的中数：{stats.hitRace}R</div>
            <div>的中率：{stats.hitRate}%</div>
            <div>投資：{stats.invest.toLocaleString()}円</div>
            <div>払戻：{stats.payout.toLocaleString()}円</div>
            <div>収支：{stats.profit.toLocaleString()}円</div>
            <div>回収率：{stats.recovery}%</div>
            <div>最高払戻：{stats.maxPayout.toLocaleString()}円</div>
          </div>

          <button onClick={loadStats}>再読み込み</button>
        </section>
      )}
    </main>
  );
}
