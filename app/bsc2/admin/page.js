"use client";

import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function BscAdminPage() {
  const [pin, setPin] = useState("");
  const [ok, setOk] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    id: new Date().toISOString().slice(0, 10) + "-daily",
    title: "蒲郡12R ドリーム戦",
    deadline: "20:35",
    ichika_main: "1-2-3",
    ichika_sub: "1-2-56",
    kiina_main: "5-1-4",
    hatsune_main: "2-1-3",
  });

  const login = () => {
    if (pin === "bsc1234") {
      setOk(true);
    } else {
      alert("PINが違います");
    }
  };

  const saveEvent = async () => {
    if (!supabase) {
      alert("Supabase未接続です");
      return;
    }

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
      alert("保存に失敗しました");
      console.error(error);
      return;
    }

    alert("今日のイベントを保存しました！");
  };

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

      <section className="bscAdminBox">
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
    </main>
  );
}
