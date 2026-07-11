"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/* =========================
   基本設定
========================= */

const STORAGE_BUCKET = "bsc-hit-images";

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

const initialEditResult = {
  race_date: "",
  place: "",
  race_no: 1,
  category: "一果",
  bet_text: "",
  invest: 0,
  payout: 0,
  memo: "",
  hit_image_url: "",
  hit_title: "",
  hit_note: "",
};

/* =========================
   日本時間の日付
========================= */

function getJapanDateString(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/* =========================
   日本時間基準の今月範囲
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
   ファイル名用カテゴリ
========================= */

function getCategorySlug(category) {
  if (category === "一果") return "ichika";
  if (category === "初音") return "hatsune";
  if (category === "キイナ") return "kiina";
  return "bsc";
}

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
  const [updatingResult, setUpdatingResult] = useState(false);

  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingRows, setLoadingRows] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [resultRows, setResultRows] = useState([]);
  const [editingId, setEditingId] = useState(null);

  /* 新規登録用画像 */
  const [hitImageFile, setHitImageFile] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageInputKey, setImageInputKey] = useState(0);

  /* 編集用画像 */
  const [editHitImageFile, setEditHitImageFile] = useState(null);
  const [uploadingEditImage, setUploadingEditImage] = useState(false);
  const [editImageInputKey, setEditImageInputKey] = useState(0);

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
    hit_image_url: "",
    hit_title: "",
    hit_note: "",
  });

  const [editResult, setEditResult] = useState(
    initialEditResult
  );

  const [stats, setStats] = useState(initialStats);

  /* =========================
     画像プレビューURL
  ========================= */

  const newImagePreview = useMemo(() => {
    if (!hitImageFile) return "";
    return URL.createObjectURL(hitImageFile);
  }, [hitImageFile]);

  const editImagePreview = useMemo(() => {
    if (!editHitImageFile) return "";
    return URL.createObjectURL(editHitImageFile);
  }, [editHitImageFile]);

  useEffect(() => {
    return () => {
      if (newImagePreview) {
        URL.revokeObjectURL(newImagePreview);
      }
    };
  }, [newImagePreview]);

  useEffect(() => {
    return () => {
      if (editImagePreview) {
        URL.revokeObjectURL(editImagePreview);
      }
    };
  }, [editImagePreview]);

  /* =========================
     エラー表示
  ========================= */

  const getErrorMessage = (error) => {
    return (
      `message: ${error?.message || "不明なエラー"}\n` +
      `code: ${error?.code || "なし"}\n` +
      `details: ${error?.details || "なし"}`
    );
  };

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
     画像アップロード
  ========================= */

  const uploadHitImage = async ({
    file,
    category,
    raceDate,
    setUploading,
  }) => {
    if (!file) {
      return "";
    }

    if (!supabase) {
      throw new Error("Supabase未接続です");
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      throw new Error(
        "JPEG・PNG・WebP画像を選択してください"
      );
    }

    const maxSize = 8 * 1024 * 1024;

    if (file.size > maxSize) {
      throw new Error(
        "画像サイズは8MB以下にしてください"
      );
    }

    setUploading(true);

    try {
      const originalExtension =
        file.name.split(".").pop()?.toLowerCase();

      const extension =
        originalExtension === "jpeg"
          ? "jpg"
          : originalExtension || "jpg";

      const categorySlug = getCategorySlug(category);

      const uniqueId =
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()
              .toString(36)
              .slice(2)}`;

      const filePath =
        `${categorySlug}/` +
        `${raceDate || today}/` +
        `${Date.now()}-${uniqueId}.${extension}`;

      const { error: uploadError } =
        await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type,
          });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filePath);

      if (!data?.publicUrl) {
        throw new Error(
          "画像の公開URLを取得できませんでした"
        );
      }

      return data.publicUrl;
    } finally {
      setUploading(false);
    }
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
      const { error: deactivateError } =
        await supabase
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
          getErrorMessage(error)
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
        .select(`
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
        `)
        .gte("race_date", monthStart)
        .lt("race_date", nextMonthStart);

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
          getErrorMessage(error)
      );
    } finally {
      setLoadingStats(false);
    }
  };

  /* =========================
     新規成績保存
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
      let hitImageUrl =
        result.hit_image_url?.trim() || "";

      if (hitImageFile) {
        hitImageUrl = await uploadHitImage({
          file: hitImageFile,
          category: result.category,
          raceDate: result.race_date,
          setUploading: setUploadingImage,
        });
      }

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
        hit_image_url: hitImageUrl,
        hit_title: result.hit_title.trim(),
        hit_note: result.hit_note.trim(),
      };

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
        hit_image_url: "",
        hit_title: "",
        hit_note: "",
      }));

      setHitImageFile(null);
      setImageInputKey((previous) => previous + 1);

      await loadStats();
    } catch (error) {
      console.error("収支保存エラー", error);

      alert(
        `保存に失敗しました\n\n` +
          getErrorMessage(error)
      );
    } finally {
      setSavingResult(false);
    }
  };

  /* =========================
     成績一覧取得
  ========================= */

  const loadResultRows = async () => {
    if (!supabase) {
      alert("Supabase未接続です");
      return;
    }

    setLoadingRows(true);

    try {
      const { monthStart, nextMonthStart } =
        getCurrentMonthRange();

      const { data, error } = await supabase
        .from("bsc_results")
        .select(`
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
          hit_image_url,
          hit_title,
          hit_note,
          created_at
        `)
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

      setResultRows(
        Array.isArray(data) ? data : []
      );
    } catch (error) {
      console.error("成績一覧取得エラー", error);

      alert(
        `成績一覧を取得できませんでした\n\n` +
          getErrorMessage(error)
      );
    } finally {
      setLoadingRows(false);
    }
  };

  /* =========================
     編集開始
  ========================= */

  const startEditResult = (row) => {
    setEditingId(row.id);
    setEditHitImageFile(null);
    setEditImageInputKey((previous) => previous + 1);

    setEditResult({
      race_date: row.race_date || "",
      place: row.place || "",
      race_no: Number(row.race_no || 1),
      category: row.category || "一果",
      bet_text: row.bet_text || "",
      invest: Number(row.invest || 0),
      payout: Number(row.payout || 0),
      memo: row.memo || "",
      hit_image_url: row.hit_image_url || "",
      hit_title: row.hit_title || "",
      hit_note: row.hit_note || "",
    });
  };

  /* =========================
     編集キャンセル
  ========================= */

  const cancelEditResult = () => {
    setEditingId(null);
    setEditResult(initialEditResult);
    setEditHitImageFile(null);
    setEditImageInputKey((previous) => previous + 1);
  };

  /* =========================
     成績修正保存
  ========================= */

  const updateResult = async () => {
    if (!supabase) {
      alert("Supabase未接続です");
      return;
    }

    if (!editingId) {
      alert("編集対象がありません");
      return;
    }

    if (!editResult.race_date) {
      alert("日付を入力してください");
      return;
    }

    if (!editResult.place.trim()) {
      alert("場名を入力してください");
      return;
    }

    const raceNumber = Number(editResult.race_no);
    const investAmount = Number(
      editResult.invest || 0
    );
    const payoutAmount = Number(
      editResult.payout || 0
    );

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

    setUpdatingResult(true);

    try {
      let hitImageUrl =
        editResult.hit_image_url?.trim() || "";

      if (editHitImageFile) {
        hitImageUrl = await uploadHitImage({
          file: editHitImageFile,
          category: editResult.category,
          raceDate: editResult.race_date,
          setUploading: setUploadingEditImage,
        });
      }

      const updateData = {
        race_date: editResult.race_date,
        place: editResult.place.trim(),
        race_no: raceNumber,
        category: editResult.category,
        bet_text: editResult.bet_text.trim(),
        invest: investAmount,
        payout: payoutAmount,
        hit: payoutAmount > 0,
        memo: editResult.memo.trim(),
        hit_image_url: hitImageUrl,
        hit_title: editResult.hit_title.trim(),
        hit_note: editResult.hit_note.trim(),
      };

      const { error } = await supabase
        .from("bsc_results")
        .update(updateData)
        .eq("id", editingId);

      if (error) {
        throw error;
      }

      alert("成績を修正しました！");

      cancelEditResult();

      await Promise.all([
        loadResultRows(),
        loadStats(),
      ]);
    } catch (error) {
      console.error("成績修正エラー", error);

      alert(
        `成績の修正に失敗しました\n\n` +
          getErrorMessage(error)
      );
    } finally {
      setUpdatingResult(false);
    }
  };

  /* =========================
     成績削除
  ========================= */

  const deleteResult = async (id) => {
  const confirmed = window.confirm(
    "この成績を削除しますか？\n削除後は元に戻せません。"
  );

  if (!confirmed) return;

  if (!supabase) {
    alert("Supabase未接続です");
    return;
  }

  setDeletingId(id);

  try {
    const { error } = await supabase
      .from("bsc_results")
      .delete()
      .eq("id", id);

    if (error) {
      throw error;
    }

    setResultRows((previousRows) =>
      previousRows.filter(
        (row) => String(row.id) !== String(id)
      )
    );

    if (String(editingId) === String(id)) {
      cancelEditResult();
    }

    await loadStats();

    alert("成績を削除しました");
  } catch (error) {
    console.error("成績削除エラー", error);

    alert(
      `成績の削除に失敗しました\n\n` +
        `message: ${error?.message || "不明なエラー"}\n` +
        `code: ${error?.code || "なし"}\n` +
        `details: ${error?.details || "なし"}`
    );
  } finally {
    setDeletingId(null);
  }
};

  /* =========================
     ログイン後の初期取得
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
            収支・的中画像入力
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

          <button
            type="button"
            onClick={async () => {
              cancelEditResult();
              setMenu("edit");
              await loadResultRows();
            }}
          >
            成績修正・削除
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

      {/* 新規収支・画像入力 */}

      {menu === "result" && (
  <section className="bscAdminBox bscResultInputBox">
         <button
  type="button"
  className="bscAdminBackButton"
  onClick={() => setMenu("top")}
>
  ← 管理画面トップへ
</button>

          <h2>収支・的中画像入力</h2>

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

          <hr />

          <h3>的中画像</h3>

          <p>
            画像を登録しない場合は、そのまま空欄で保存できます。
          </p>

          <label>
            <span>画像ファイル</span>
            <input
              key={imageInputKey}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const file =
                  event.target.files?.[0] || null;

                setHitImageFile(file);
              }}
            />
          </label>

          {newImagePreview && (
            <div className="bscImagePreview">
              <img
                src={newImagePreview}
                alt="的中画像プレビュー"
                style={{
                  width: "100%",
                  maxHeight: "360px",
                  objectFit: "contain",
                  borderRadius: "16px",
                }}
              />

              <p>{hitImageFile?.name}</p>

              <button
                type="button"
                onClick={() => {
                  setHitImageFile(null);
                  setImageInputKey(
                    (previous) => previous + 1
                  );
                }}
              >
                選択画像を取り消す
              </button>
            </div>
          )}

          <label>
            <span>画像タイトル</span>
            <input
              value={result.hit_title}
              placeholder="例：住之江11R 的中！"
              onChange={(event) =>
                setResult((previous) => ({
                  ...previous,
                  hit_title: event.target.value,
                }))
              }
            />
          </label>

          <label>
            <span>画像コメント</span>
            <textarea
              rows={2}
              value={result.hit_note}
              placeholder="例：イン逃げ本線で的中しました！"
              onChange={(event) =>
                setResult((previous) => ({
                  ...previous,
                  hit_note: event.target.value,
                }))
              }
            />
          </label>

          <button
            type="button"
            onClick={saveResult}
            disabled={
              savingResult || uploadingImage
            }
          >
            {uploadingImage
              ? "画像アップロード中..."
              : savingResult
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

      {/* 成績修正・削除 */}

      {menu === "edit" && (
        <section className="bscAdminBox">
          <button
            type="button"
            onClick={() => {
              cancelEditResult();
              setMenu("top");
            }}
          >
            ← 管理画面トップへ
          </button>

          <h2>成績修正・削除</h2>

          {loadingRows ? (
            <p>成績を読み込み中...</p>
          ) : resultRows.length === 0 ? (
            <p>今月の成績はまだありません。</p>
          ) : (
            <div className="bscResultList">
              {resultRows.map((row) => {
                const rowProfit =
                  Number(row.payout || 0) -
                  Number(row.invest || 0);

                const isEditing =
                  editingId === row.id;

                return (
                  <article
                    key={row.id}
                    className="bscResultCard"
                  >
                    {isEditing ? (
                      <>
                        <h3>成績を編集</h3>

                        <label>
                          <span>日付</span>
                          <input
                            type="date"
                            value={
                              editResult.race_date
                            }
                            onChange={(event) =>
                              setEditResult(
                                (previous) => ({
                                  ...previous,
                                  race_date:
                                    event.target.value,
                                })
                              )
                            }
                          />
                        </label>

                        <label>
                          <span>場名</span>
                          <input
                            value={editResult.place}
                            onChange={(event) =>
                              setEditResult(
                                (previous) => ({
                                  ...previous,
                                  place:
                                    event.target.value,
                                })
                              )
                            }
                          />
                        </label>

                        <label>
                          <span>レース番号</span>
                          <input
                            type="number"
                            min="1"
                            max="12"
                            value={editResult.race_no}
                            onChange={(event) =>
                              setEditResult(
                                (previous) => ({
                                  ...previous,
                                  race_no:
                                    event.target.value,
                                })
                              )
                            }
                          />
                        </label>

                        <label>
                          <span>カテゴリ</span>
                          <select
                            value={
                              editResult.category
                            }
                            onChange={(event) =>
                              setEditResult(
                                (previous) => ({
                                  ...previous,
                                  category:
                                    event.target.value,
                                })
                              )
                            }
                          >
                            <option value="一果">
                              一果
                            </option>
                            <option value="初音">
                              初音
                            </option>
                            <option value="キイナ">
                              キイナ
                            </option>
                            <option value="BSC">
                              BSC
                            </option>
                          </select>
                        </label>

                        <label>
                          <span>買い目</span>
                          <input
                            value={
                              editResult.bet_text
                            }
                            onChange={(event) =>
                              setEditResult(
                                (previous) => ({
                                  ...previous,
                                  bet_text:
                                    event.target.value,
                                })
                              )
                            }
                          />
                        </label>

                        <label>
                          <span>投資金額</span>
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={editResult.invest}
                            onChange={(event) =>
                              setEditResult(
                                (previous) => ({
                                  ...previous,
                                  invest:
                                    event.target.value,
                                })
                              )
                            }
                          />
                        </label>

                        <label>
                          <span>払戻金額</span>
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={editResult.payout}
                            onChange={(event) =>
                              setEditResult(
                                (previous) => ({
                                  ...previous,
                                  payout:
                                    event.target.value,
                                })
                              )
                            }
                          />
                        </label>

                        <label>
                          <span>メモ</span>
                          <textarea
                            rows={3}
                            value={editResult.memo}
                            onChange={(event) =>
                              setEditResult(
                                (previous) => ({
                                  ...previous,
                                  memo:
                                    event.target.value,
                                })
                              )
                            }
                          />
                        </label>

                        <hr />

                        <h3>的中画像を編集</h3>

                        {editResult.hit_image_url &&
                          !editImagePreview && (
                            <div className="bscImagePreview">
                              <p>現在の画像</p>

                              <img
                                src={
                                  editResult.hit_image_url
                                }
                                alt={
                                  editResult.hit_title ||
                                  "登録済み的中画像"
                                }
                                style={{
                                  width: "100%",
                                  maxHeight: "360px",
                                  objectFit: "contain",
                                  borderRadius: "16px",
                                }}
                              />

                              <button
                                type="button"
                                onClick={() =>
                                  setEditResult(
                                    (previous) => ({
                                      ...previous,
                                      hit_image_url: "",
                                    })
                                  )
                                }
                              >
                                現在の画像を外す
                              </button>
                            </div>
                          )}

                        <label>
                          <span>
                            新しい画像に変更
                          </span>

                          <input
                            key={editImageInputKey}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(event) => {
                              const file =
                                event.target.files?.[0] ||
                                null;

                              setEditHitImageFile(file);
                            }}
                          />
                        </label>

                        {editImagePreview && (
                          <div className="bscImagePreview">
                            <p>新しい画像</p>

                            <img
                              src={editImagePreview}
                              alt="新しい画像プレビュー"
                              style={{
                                width: "100%",
                                maxHeight: "360px",
                                objectFit: "contain",
                                borderRadius: "16px",
                              }}
                            />

                            <button
                              type="button"
                              onClick={() => {
                                setEditHitImageFile(
                                  null
                                );

                                setEditImageInputKey(
                                  (previous) =>
                                    previous + 1
                                );
                              }}
                            >
                              新しい画像を取り消す
                            </button>
                          </div>
                        )}

                        <label>
                          <span>画像タイトル</span>
                          <input
                            value={
                              editResult.hit_title
                            }
                            placeholder="例：住之江11R 的中！"
                            onChange={(event) =>
                              setEditResult(
                                (previous) => ({
                                  ...previous,
                                  hit_title:
                                    event.target.value,
                                })
                              )
                            }
                          />
                        </label>

                        <label>
                          <span>画像コメント</span>
                          <textarea
                            rows={2}
                            value={
                              editResult.hit_note
                            }
                            placeholder="画像コメント"
                            onChange={(event) =>
                              setEditResult(
                                (previous) => ({
                                  ...previous,
                                  hit_note:
                                    event.target.value,
                                })
                              )
                            }
                          />
                        </label>

                        <div className="bscResultActions">
                          <button
                            type="button"
                            onClick={updateResult}
                            disabled={
                              updatingResult ||
                              uploadingEditImage
                            }
                          >
                            {uploadingEditImage
                              ? "画像アップロード中..."
                              : updatingResult
                              ? "修正中..."
                              : "修正を保存"}
                          </button>

                          <button
                            type="button"
                            onClick={
                              cancelEditResult
                            }
                            disabled={
                              updatingResult ||
                              uploadingEditImage
                            }
                          >
                            キャンセル
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <h3>
                          {row.race_date}　
                          {row.place}
                          {row.race_no}R
                        </h3>

                        <p>
                          カテゴリ：
                          {row.category || "未設定"}
                        </p>

                        <p>
                          買い目：
                          {row.bet_text || "なし"}
                        </p>

                        <p>
                          投資：
                          {Number(
                            row.invest || 0
                          ).toLocaleString()}
                          円
                        </p>

                        <p>
                          払戻：
                          {Number(
                            row.payout || 0
                          ).toLocaleString()}
                          円
                        </p>

                        <p>
                          的中：
                          {Number(row.payout || 0) >
                          0
                            ? "的中"
                            : "不的中"}
                        </p>

                        <p>
                          収支：
                          {rowProfit > 0 ? "+" : ""}
                          {rowProfit.toLocaleString()}
                          円
                        </p>

                        {row.memo && (
                          <p>メモ：{row.memo}</p>
                        )}

                        {row.hit_image_url && (
                          <div className="bscImagePreview">
                            <img
                              src={row.hit_image_url}
                              alt={
                                row.hit_title ||
                                `${row.place}${row.race_no}R`
                              }
                              style={{
                                width: "100%",
                                maxHeight: "300px",
                                objectFit: "contain",
                                borderRadius: "16px",
                              }}
                            />

                            {row.hit_title && (
                              <p>
                                タイトル：
                                {row.hit_title}
                              </p>
                            )}

                            {row.hit_note && (
                              <p>
                                コメント：
                                {row.hit_note}
                              </p>
                            )}
                          </div>
                        )}

                        <div className="bscResultActions">
                          <button
                            type="button"
                            onClick={() =>
                              startEditResult(row)
                            }
                          >
                            編集
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              deleteResult(row.id)
                            }
                            disabled={
                              deletingId === row.id
                            }
                          >
                            {deletingId === row.id
                              ? "削除中..."
                              : "削除"}
                          </button>
                        </div>
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={loadResultRows}
            disabled={loadingRows}
          >
            {loadingRows
              ? "読み込み中..."
              : "一覧を再読み込み"}
          </button>
        </section>
      )}
    </main>
  );
}
