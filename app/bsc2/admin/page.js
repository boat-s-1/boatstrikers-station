"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/* =========================
   日本時間の日付を取得
========================= */

function getJapanDateString() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/* =========================
   日本時間基準で今月の範囲を取得
========================= */

function getCurrentMonthRange() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
  });

  const parts = formatter.formatToParts(new Date());

  const year = Number(
    parts.find((part) => part.type === "year")?.value
  );

  const month = Number(
    parts.find((part) => part.type === "month")?.value
  );

  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;

  let nextYear = year;
  let nextMonth = month + 1;

  if (nextMonth === 13) {
    nextYear += 1;
    nextMonth = 1;
  }

  const nextMonthStart =
    `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

  return {
    monthStart,
    nextMonthStart,
  };
}

/* =========================
   初期成績
========================= */

const initialStats = {
  totalRace: 0,
  hitRace: 0,
  hitRate: 0,
  invest: 0,
  payout: 0,
  profit: 0,
  recovery: 0,
  maxPayout: 0,
};

/* =========================
   管理画面
========================= */

export default function BscAdminPage() {
  const today = getJapanDateString();

  const [pin, setPin] = useState("");
  const [ok, setOk] = useState(false);
  const [menu, setMenu] = useState("top");

  const [savingEvent, setSavingEvent] = useState(false);
  const [savingResult, setSavingResult] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);

  const [form, setForm] = useState({
    id: `${today}-daily`,
    title: "蒲郡12R ドリーム戦",
    deadline: "20:35",
    ichika_main: "1-2-3",
    ichika_sub: "1-2-56",
    kiina_main: "5-1-4",
    hatsune_main: "2-1-3",
  });

  const [result, setResult] = useState({
    race_date: today,
    place: "住之江",
    race_no: 11,
    category: "一果",
    bet_text: "1-2-3",
    invest: 1000,
    payout: 0,
    memo: "",
  });

  const [stats, setStats] = useState(initialStats);

  /* =========================
     PINログイン
  ========================= */

  const login = () => {
    if (pin === "bsc1234") {
      setOk(true);
      return;
    }

    alert("PINが違います");
  };

  /* =========================
     今日のイベント保存
  ========================= */

  const saveEvent = async () => {
    if (!supabase) {
      alert("Supabase未接続です");
      return;
    }

    if (!form.id.trim()) {
      alert("IDを入力してください");
      return;
    }

    if (!form.title.trim()) {
      alert("タイトルを入力してください");
      return;
    }

    setSavingEvent(true);

    try {
      const { error: deactivateError } = await supabase
        .from("daily_events")
        .update({
          is_active: false,
        })
        .eq("is_active", true);

      if (deactivateError) {
        throw deactivateError;
      }

      const saveData = {
        id: form.id.trim(),
        title: form.title.trim(),
        deadline: form.deadline.trim(),
        ichika_main: form.ichika_main.trim(),
        ichika_sub: form.ichika_sub.trim(),
        kiina_main: form.kiina_main.trim(),
        hatsune_main: form.hatsune_main.trim(),
        is_active: true,
      };

      const { error } = await supabase
        .from("daily_events")
        .upsert(saveData);

      if (error) {
        throw error;
      }

      alert("今日のイベントを保存しました！");
    } catch (error) {
      console.error("イベント保存エラー", error);

      alert(
        `イベントの保存に失敗しました\n\n` +
          `message: ${error?.message || "不明なエラー"}\n` +
          `code: ${error?.code || "なし"}\n` +
          `details: ${error?.details || "なし"}`
      );
    } finally {
      setSavingEvent(false);
    }
  };

  /* =========================
     今月の成績取得
  ========================= */

  const loadStats = async () => {
    if (!supabase) {
      alert("Supabase未接続です");
      return;
    }

    setLoadingStats(true);

    try {
      const { monthStart, nextMonthStart } =
        getCurrentMonthRange();

      const { data, error } = await supabase
        .from("bsc_results")
        .select(
          `
            id,
            race_date,
            place,
            race_no,
            category,
            bet_text,
            invest,
            payout,
            hit,
            memo,
            created_at
          `
        )
        .gte("race_date", monthStart)
        .lt("race_date", nextMonthStart)
        .order("race_date", {
          ascending: false,
        })
        .order("race_no", {
          ascending: false,
        });

      if (error) {
        throw error;
      }

      const rows = Array.isArray(data) ? data : [];

      const totalRace = rows.length;

      const hitRace = rows.filter((row) => {
        return (
          row.hit === true ||
          Number(row.payout || 0) > 0
        );
      }).length;

      const totalInvest = rows.reduce((sum, row) => {
        return sum + Number(row.invest || 0);
      }, 0);

      const totalPayout = rows.reduce((sum, row) => {
        return sum + Number(row.payout || 0);
      }, 0);

      const maxPayout = rows.reduce((max, row) => {
        return Math.max(
          max,
          Number(row.payout || 0)
        );
      }, 0);

      const hitRate =
        totalRace > 0
          ? Math.round((hitRace / totalRace) * 100)
          : 0;

      const recovery =
        totalInvest > 0
          ? Math.round(
              (totalPayout / totalInvest) * 100
            )
          : 0;

      setStats({
        totalRace,
        hitRace,
        hitRate,
        invest: totalInvest,
        payout: totalPayout,
        profit: totalPayout - totalInvest,
        recovery,
        maxPayout,
      });
    } catch (error) {
      console.error("成績取得エラー", error);

      setStats(initialStats);

      alert(
        `今月の成績を取得できませんでした\n\n` +
          `message: ${error?.message || "不明なエラー"}\n` +
          `code: ${error?.code || "なし"}\n` +
          `details: ${error?.details || "なし"}`
      );
    } finally {
      setLoadingStats(false);
    }
  };

  /* =========================
     収支データ保存
  ========================= */

  const saveResult = async () => {
    if (!supabase) {
      alert("Supabase未接続です");
      return;
    }

    if (!result.race_date) {
      alert("日付を入力してください");
      return;
    }

    if (!result.place.trim()) {
      alert("場名を入力してください");
      return;
    }

    const raceNumber = Number(result.race_no);
    const investAmount = Number(result.invest || 0);
    const payoutAmount = Number(result.payout || 0);

    if (
      !Number.isInteger(raceNumber) ||
      raceNumber < 1 ||
      raceNumber > 12
    ) {
      alert("レース番号は1〜12で入力してください");
      return;
    }

    if (
      !Number.isFinite(investAmount) ||
      investAmount < 0
    ) {
      alert("投資金額を正しく入力してください");
      return;
    }

    if (
      !Number.isFinite(payoutAmount) ||
      payoutAmount < 0
    ) {
      alert("払戻金額を正しく入力してください");
      return;
    }

    setSavingResult(true);

    try {
      const insertData = {
        race_date: result.race_date,
        place: result.place.trim(),
        race_no: raceNumber,
        category: result.category,
        bet_text: result.bet_text.trim(),
        invest: investAmount,
        payout: payoutAmount,
        hit: payoutAmount > 0,
        memo: result.memo.trim(),
      };

      console.log("保存データ", insertData);

      const { error } = await supabase
        .from("bsc_results")
        .insert([insertData]);

      if (error) {
        throw error;
      }

      alert("レース結果を保存しました！");

      setResult((previous) => ({
        ...previous,
        bet_text: "",
        invest: 0,
        payout: 0,
        memo: "",
      }));

      await loadStats();
    } catch (error) {
      console.error("収支保存エラー", error);

      alert(
        `保存に失敗しました\n\n` +
          `message: ${error?.message || "不明なエラー"}\n` +
          `code: ${error?.code || "なし"}\n` +
          `details: ${error?.details || "なし"}`
      );
    } finally {
      setSavingResult(false);
    }
  };

  /* =========================
     ログイン後に成績を取得
  ========================= */

  useEffect(() => {
    if (ok) {
      loadStats();
    }
  }, [ok]);

  /* =========================
     ログイン画面
  ========================= */

  if (!ok) {
    return (
      <main className="gamePage">
        <section className="bscAdminBox">
          <h1>BSC Admin</h1>

          <label>
            <span>管理PIN</span>

            <input
              type="password"
              value={pin}
              placeholder="PINを入力"
              autoComplete="current-password"
              onChange={(event) =>
                setPin(event.target.value)
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  login();
                }
              }}
            />
          </label>

          <button
            type="button"
            onClick={login}
          >
            ログイン
          </button>
        </section>
      </main>
    );
  }

  /* =========================
     管理画面本体
  ========================= */

  return (
    <main className="gamePage">
      <header className="gameTopBar">
        <a
          href="/bsc2"
          className="gameBack"
          aria-label="BSCトップへ戻る"
        >
          ←
        </a>

        <div>
          <span>BSC</span>
          <h1>ADMIN</h1>
        </div>

        <div className="gameStatusMini">
          管理
        </div>
      </header>

      {/* 管理画面トップ */}

      {menu === "top" && (
        <section className="bscAdminBox">
          <h2>管理画面トップ</h2>

          <button
            type="button"
            onClick={() => setMenu("event")}
          >
            BSCレース入力
          </button>

          <button
            type="button"
            onClick={() => setMenu("result")}
          >
            収支管理
          </button>

          <button
            type="button"
            onClick={async () => {
              setMenu("stats");
              await loadStats();
            }}
          >
            今月の成績
          </button>
        </section>
      )}

      {/* 今日の予想イベント */}

      {menu === "event" && (
        <section className="bscAdminBox">
          <button
            type="button"
            onClick={() => setMenu("top")}
          >
            ← 管理画面トップへ
          </button>

          <h2>今日の予想イベント</h2>

          <label>
            <span>ID</span>

            <input
              value={form.id}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  id: event.target.value,
                }))
              }
            />
          </label>

          <label>
            <span>タイトル</span>

            <input
              value={form.title}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  title: event.target.value,
                }))
              }
            />
          </label>

          <label>
            <span>締切時刻</span>

            <input
              type="time"
              value={form.deadline}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  deadline: event.target.value,
                }))
              }
            />
          </label>

          <label>
            <span>一果・本命</span>

            <input
              value={form.ichika_main}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  ichika_main: event.target.value,
                }))
              }
            />
          </label>

          <label>
            <span>一果・押さえ</span>

            <input
              value={form.ichika_sub}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  ichika_sub: event.target.value,
                }))
              }
            />
          </label>

          <label>
            <span>キイナ・本命</span>

            <input
              value={form.kiina_main}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  kiina_main: event.target.value,
                }))
              }
            />
          </label>

          <label>
            <span>初音・本命</span>

            <input
              value={form.hatsune_main}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  hatsune_main: event.target.value,
                }))
              }
            />
          </label>

          <button
            type="button"
            onClick={saveEvent}
            disabled={savingEvent}
          >
            {savingEvent
              ? "保存中..."
              : "今日の予想を保存"}
          </button>
        </section>
      )}

      {/* 収支管理 */}

      {menu === "result" && (
        <section className="bscAdminBox">
          <button
            type="button"
            onClick={() => setMenu("top")}
          >
            ← 管理画面トップへ
          </button>

          <h2>収支管理</h2>

          <label>
            <span>日付</span>

            <input
              type="date"
              value={result.race_date}
              onChange={(event) =>
                setResult((previous) => ({
                  ...previous,
                  race_date: event.target.value,
                }))
              }
            />
          </label>

          <label>
            <span>場名</span>

            <input
              value={result.place}
              placeholder="例：住之江"
              onChange={(event) =>
                setResult((previous) => ({
                  ...previous,
                  place: event.target.value,
                }))
              }
            />
          </label>

          <label>
            <span>レース番号</span>

            <input
              type="number"
              min="1"
              max="12"
              value={result.race_no}
              onChange={(event) =>
                setResult((previous) => ({
                  ...previous,
                  race_no: event.target.value,
                }))
              }
            />
          </label>

          <label>
            <span>カテゴリ</span>

            <select
              value={result.category}
              onChange={(event) =>
                setResult((previous) => ({
                  ...previous,
                  category: event.target.value,
                }))
              }
            >
              <option value="一果">一果</option>
              <option value="初音">初音</option>
              <option value="キイナ">キイナ</option>
              <option value="BSC">BSC</option>
            </select>
          </label>

          <label>
            <span>買い目</span>

            <input
              value={result.bet_text}
              placeholder="例：1-245-245"
              onChange={(event) =>
                setResult((previous) => ({
                  ...previous,
                  bet_text: event.target.value,
                }))
              }
            />
          </label>

          <label>
            <span>投資金額</span>

            <input
              type="number"
              min="0"
              step="100"
              value={result.invest}
              onChange={(event) =>
                setResult((previous) => ({
                  ...previous,
                  invest: event.target.value,
                }))
              }
            />
          </label>

          <label>
            <span>払戻金額</span>

            <input
              type="number"
              min="0"
              step="100"
              value={result.payout}
              onChange={(event) =>
                setResult((previous) => ({
                  ...previous,
                  payout: event.target.value,
                }))
              }
            />
          </label>

          <label>
            <span>メモ</span>

            <textarea
              value={result.memo}
              rows={3}
              placeholder="任意入力"
              onChange={(event) =>
                setResult((previous) => ({
                  ...previous,
                  memo: event.target.value,
                }))
              }
            />
          </label>

          <button
            type="button"
            onClick={saveResult}
            disabled={savingResult}
          >
            {savingResult
              ? "保存中..."
              : "レース結果を保存"}
          </button>
        </section>
      )}

      {/* 今月の成績 */}

      {menu === "stats" && (
        <section className="bscAdminBox">
          <button
            type="button"
            onClick={() => setMenu("top")}
          >
            ← 管理画面トップへ
          </button>

          <h2>今月の成績</h2>

          {loadingStats ? (
            <p>成績を読み込み中...</p>
          ) : (
            <div className="bscStatsGrid">
              <div>
                <span>予想レース数</span>
                <strong>
                  {Number(stats.totalRace || 0)}R
                </strong>
              </div>

              <div>
                <span>的中数</span>
                <strong>
                  {Number(stats.hitRace || 0)}R
                </strong>
              </div>

              <div>
                <span>的中率</span>
                <strong>
                  {Number(stats.hitRate || 0)}%
                </strong>
              </div>

              <div>
                <span>投資金額</span>
                <strong>
                  {Number(
                    stats.invest || 0
                  ).toLocaleString()}
                  円
                </strong>
              </div>

              <div>
                <span>払戻金額</span>
                <strong>
                  {Number(
                    stats.payout || 0
                  ).toLocaleString()}
                  円
                </strong>
              </div>

              <div>
                <span>収支</span>
                <strong>
                  {Number(stats.profit || 0) > 0
                    ? "+"
                    : ""}
                  {Number(
                    stats.profit || 0
                  ).toLocaleString()}
                  円
                </strong>
              </div>

              <div>
                <span>回収率</span>
                <strong>
                  {Number(stats.recovery || 0)}%
                </strong>
              </div>

              <div>
                <span>最高払戻</span>
                <strong>
                  {Number(
                    stats.maxPayout || 0
                  ).toLocaleString()}
                  円
                </strong>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={loadStats}
            disabled={loadingStats}
          >
            {loadingStats
              ? "読み込み中..."
              : "成績を再読み込み"}
          </button>
        </section>
      )}
    </main>
  );
}
