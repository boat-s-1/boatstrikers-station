"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

const STORAGE_KEY = "bsc-ichika-zenjitsu-draft";

const places = [
  "桐生",
  "戸田",
  "江戸川",
  "平和島",
  "多摩川",
  "浜名湖",
  "蒲郡",
  "常滑",
  "津",
  "三国",
  "びわこ",
  "住之江",
  "尼崎",
  "鳴門",
  "丸亀",
  "児島",
  "宮島",
  "徳山",
  "下関",
  "若松",
  "芦屋",
  "福岡",
  "唐津",
  "大村",
];

const boats = ["1", "2", "3", "4", "5", "6"];

const boatColors = {
  1: "#f5f5f5",
  2: "#222222",
  3: "#ed3b3b",
  4: "#2875e8",
  5: "#f1c232",
  6: "#2aa65a",
};

function getJapanDateString() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function createInitialForm() {
  return {
    raceDate: getJapanDateString(),
    place: "丸亀",
    raceNo: "1",

    honmei: "1",
    stamp: "本命",
    nigeRate: 84,
    upRate: 11,

    selectedBoats: ["1", "2", "3"],

    boatScores: {
      1: 80,
      2: 65,
      3: 60,
      4: 45,
      5: 40,
      6: 35,
    },

    boatComments: {
      1: "インから先マイ。スタートが揃えば逃げ中心。",
      2: "差し残りに注意。1号艇のターン次第で連争い。",
      3: "センターから握って攻める展開に注目。",
      4: "",
      5: "",
      6: "",
    },

    mainComment:
      "1号艇中心だが、2号艇の差し残りに注意！",

    wave: 28,
    dangerBoat: "なし",

    motorEval:
      "1号艇は出足型。3号艇の伸びにも注目。",

    characterImage: "",
    backgroundImage: "",
  };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(reader.result);
    };

    reader.onerror = () => {
      reject(
        new Error("画像ファイルを読み込めませんでした")
      );
    };

    reader.readAsDataURL(file);
  });
}

export default function IchikaZennjitsuPage() {
  const [form, setForm] = useState(createInitialForm);
  const [loaded, setLoaded] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  /* =========================
     下書き読み込み
  ========================= */

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved);

        setForm((previous) => ({
          ...previous,
          ...parsed,
          boatScores: {
            ...previous.boatScores,
            ...(parsed.boatScores || {}),
          },
          boatComments: {
            ...previous.boatComments,
            ...(parsed.boatComments || {}),
          },
        }));
      }
    } catch (error) {
      console.error("下書き読み込みエラー", error);
    } finally {
      setLoaded(true);
    }
  }, []);

  /* =========================
     自動保存
  ========================= */

  useEffect(() => {
    if (!loaded) return;

    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(form)
        );

        setSaveMessage("下書きを自動保存しました");

        window.setTimeout(() => {
          setSaveMessage("");
        }, 1800);
      } catch (error) {
        console.error("自動保存エラー", error);
      }
    }, 600);

    return () => {
      window.clearTimeout(timer);
    };
  }, [form, loaded]);

  /* =========================
     入力更新
  ========================= */

  const updateField = (name, value) => {
    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const updateBoatScore = (boat, value) => {
    setForm((previous) => ({
      ...previous,
      boatScores: {
        ...previous.boatScores,
        [boat]: Number(value),
      },
    }));
  };

  const updateBoatComment = (boat, value) => {
    setForm((previous) => ({
      ...previous,
      boatComments: {
        ...previous.boatComments,
        [boat]: value,
      },
    }));
  };

  const toggleSelectedBoat = (boat) => {
    setForm((previous) => {
      const selected = previous.selectedBoats.includes(boat);

      return {
        ...previous,
        selectedBoats: selected
          ? previous.selectedBoats.filter(
              (item) => item !== boat
            )
          : [...previous.selectedBoats, boat],
      };
    });
  };

  /* =========================
     画像入力
  ========================= */

  const handleImageChange = async (
    event,
    fieldName
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      alert(
        "JPEG・PNG・WebP画像を選択してください"
      );
      return;
    }

    const maxSize = 8 * 1024 * 1024;

    if (file.size > maxSize) {
      alert("画像は8MB以下にしてください");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);

      updateField(fieldName, dataUrl);
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  };

  /* =========================
     チェック
  ========================= */

  const validationError = useMemo(() => {
    if (!form.raceDate) {
      return "日付を入力してください";
    }

    if (!form.place) {
      return "レース場を選択してください";
    }

    const raceNumber = Number(form.raceNo);

    if (
      !Number.isInteger(raceNumber) ||
      raceNumber < 1 ||
      raceNumber > 12
    ) {
      return "レース番号を選択してください";
    }

    if (form.selectedBoats.length === 0) {
      return "注目艇を1艇以上選択してください";
    }

    return "";
  }, [form]);

  /* =========================
     プレビュー表示
  ========================= */

  const openPreview = () => {
    if (validationError) {
      alert(validationError);
      return;
    }

    setShowPreview(true);

    window.setTimeout(() => {
      document
        .getElementById("ichika-preview")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 100);
  };

  /* =========================
     下書き削除
  ========================= */

  const resetForm = () => {
    const confirmed = window.confirm(
      "入力内容をすべて削除しますか？"
    );

    if (!confirmed) return;

    localStorage.removeItem(STORAGE_KEY);
    setForm(createInitialForm());
    setShowPreview(false);
  };

  if (!loaded) {
    return (
      <main className={styles.page}>
        <p className={styles.loading}>
          入力画面を読み込み中...
        </p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      {/* ヘッダー */}

      <header className={styles.header}>
        <Link
          href="/bsc2/admin"
          className={styles.backButton}
          aria-label="管理画面トップへ戻る"
        >
          ←
        </Link>

        <div className={styles.headerTitle}>
          <span>🌸 一果</span>
          <strong>前日版</strong>
        </div>

        <div className={styles.adminBadge}>
          管理
        </div>
      </header>

      {/* ヒーロー */}

      <section className={styles.hero}>
        <span>BOAT STRIKE NEWSPAPER</span>

        <h1>一果・前日新聞</h1>

        <p>
          レース情報と予想内容を入力してください
        </p>
      </section>

      {saveMessage && (
        <div className={styles.saveMessage}>
          {saveMessage}
        </div>
      )}

      {/* 入力フォーム */}

      <section className={styles.formCard}>
        <h2>レース基本情報</h2>

        <div className={styles.field}>
          <label htmlFor="raceDate">
            日付
          </label>

          <input
            id="raceDate"
            type="date"
            value={form.raceDate}
            onChange={(event) =>
              updateField(
                "raceDate",
                event.target.value
              )
            }
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="place">
            レース場
          </label>

          <select
            id="place"
            value={form.place}
            onChange={(event) =>
              updateField(
                "place",
                event.target.value
              )
            }
          >
            {places.map((place) => (
              <option
                value={place}
                key={place}
              >
                {place}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="raceNo">
            レース番号
          </label>

          <select
            id="raceNo"
            value={form.raceNo}
            onChange={(event) =>
              updateField(
                "raceNo",
                event.target.value
              )
            }
          >
            {Array.from(
              { length: 12 },
              (_, index) => {
                const number = String(index + 1);

                return (
                  <option
                    value={number}
                    key={number}
                  >
                    {number}R
                  </option>
                );
              }
            )}
          </select>
        </div>
      </section>

      {/* 本命設定 */}

      <section className={styles.formCard}>
        <h2>本命候補</h2>

        <div className={styles.field}>
          <label>本命艇</label>

          <div className={styles.boatGrid}>
            {boats.map((boat) => (
              <button
                type="button"
                key={boat}
                className={`${styles.boatButton} ${
                  form.honmei === boat
                    ? styles.boatButtonActive
                    : ""
                }`}
                onClick={() =>
                  updateField("honmei", boat)
                }
              >
                <span
                  className={styles.boatColor}
                  style={{
                    backgroundColor:
                      boatColors[boat],
                    color:
                      boat === "1" ||
                      boat === "5"
                        ? "#111"
                        : "#fff",
                  }}
                >
                  {boat}
                </span>

                {boat}号艇
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="stamp">
            スタンプ
          </label>

          <select
            id="stamp"
            value={form.stamp}
            onChange={(event) =>
              updateField(
                "stamp",
                event.target.value
              )
            }
          >
            <option value="なし">なし</option>
            <option value="本命">本命</option>
            <option value="激アツ">
              激アツ
            </option>
            <option value="鉄板">鉄板</option>
            <option value="穴狙い">
              穴狙い
            </option>
            <option value="見">見</option>
            <option value="危険">危険</option>
          </select>
        </div>

        <div className={styles.field}>
          <div className={styles.rangeHeading}>
            <label htmlFor="nigeRate">
              イン逃げ期待度
            </label>

            <strong>
              {form.nigeRate}%
            </strong>
          </div>

          <input
            id="nigeRate"
            type="range"
            min="0"
            max="100"
            step="1"
            value={form.nigeRate}
            onChange={(event) =>
              updateField(
                "nigeRate",
                Number(event.target.value)
              )
            }
          />
        </div>

        <div className={styles.field}>
          <div className={styles.rangeHeading}>
            <label htmlFor="upRate">
              場平均との差
            </label>

            <strong>
              {Number(form.upRate) > 0
                ? "+"
                : ""}
              {form.upRate}%
            </strong>
          </div>

          <input
            id="upRate"
            type="range"
            min="-30"
            max="30"
            step="1"
            value={form.upRate}
            onChange={(event) =>
              updateField(
                "upRate",
                Number(event.target.value)
              )
            }
          />
        </div>
      </section>

      {/* 展開評価 */}

      <section className={styles.formCard}>
        <h2>展開評価</h2>

        <div className={styles.field}>
          <label>注目艇を選択</label>

          <div className={styles.boatGrid}>
            {boats.map((boat) => {
              const selected =
                form.selectedBoats.includes(boat);

              return (
                <button
                  type="button"
                  key={boat}
                  className={`${styles.boatButton} ${
                    selected
                      ? styles.boatButtonActive
                      : ""
                  }`}
                  onClick={() =>
                    toggleSelectedBoat(boat)
                  }
                >
                  <span
                    className={styles.boatColor}
                    style={{
                      backgroundColor:
                        boatColors[boat],
                      color:
                        boat === "1" ||
                        boat === "5"
                          ? "#111"
                          : "#fff",
                    }}
                  >
                    {boat}
                  </span>

                  {selected
                    ? "選択中"
                    : `${boat}号艇`}
                </button>
              );
            })}
          </div>
        </div>

        {form.selectedBoats
          .slice()
          .sort((a, b) => Number(a) - Number(b))
          .map((boat) => (
            <article
              className={styles.boatDetail}
              key={boat}
            >
              <div className={styles.boatDetailTitle}>
                <span
                  style={{
                    backgroundColor:
                      boatColors[boat],
                    color:
                      boat === "1" ||
                      boat === "5"
                        ? "#111"
                        : "#fff",
                  }}
                >
                  {boat}
                </span>

                <strong>{boat}号艇</strong>
              </div>

              <div className={styles.field}>
                <div
                  className={styles.rangeHeading}
                >
                  <label
                    htmlFor={`score-${boat}`}
                  >
                    評価指数
                  </label>

                  <strong>
                    {
                      form.boatScores[
                        boat
                      ]
                    }
                  </strong>
                </div>

                <input
                  id={`score-${boat}`}
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={
                    form.boatScores[boat]
                  }
                  onChange={(event) =>
                    updateBoatScore(
                      boat,
                      event.target.value
                    )
                  }
                />
              </div>

              <div className={styles.field}>
                <label
                  htmlFor={`comment-${boat}`}
                >
                  展開コメント
                </label>

                <textarea
                  id={`comment-${boat}`}
                  rows={3}
                  value={
                    form.boatComments[
                      boat
                    ]
                  }
                  placeholder={`${boat}号艇の展開解説`}
                  onChange={(event) =>
                    updateBoatComment(
                      boat,
                      event.target.value
                    )
                  }
                />
              </div>
            </article>
          ))}
      </section>

      {/* 総合コメント */}

      <section className={styles.formCard}>
        <h2>一果の総合評価</h2>

        <div className={styles.field}>
          <label htmlFor="mainComment">
            一果のひとこと
          </label>

          <textarea
            id="mainComment"
            rows={4}
            value={form.mainComment}
            onChange={(event) =>
              updateField(
                "mainComment",
                event.target.value
              )
            }
          />
        </div>

        <div className={styles.field}>
          <div className={styles.rangeHeading}>
            <label htmlFor="wave">
              波乱指数
            </label>

            <strong>{form.wave}</strong>
          </div>

          <input
            id="wave"
            type="range"
            min="0"
            max="100"
            step="1"
            value={form.wave}
            onChange={(event) =>
              updateField(
                "wave",
                Number(event.target.value)
              )
            }
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="dangerBoat">
            危険艇
          </label>

          <select
            id="dangerBoat"
            value={form.dangerBoat}
            onChange={(event) =>
              updateField(
                "dangerBoat",
                event.target.value
              )
            }
          >
            <option value="なし">
              なし
            </option>

            {boats.map((boat) => (
              <option
                value={boat}
                key={boat}
              >
                {boat}号艇
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="motorEval">
            機力チェック
          </label>

          <textarea
            id="motorEval"
            rows={4}
            value={form.motorEval}
            onChange={(event) =>
              updateField(
                "motorEval",
                event.target.value
              )
            }
          />
        </div>
      </section>

      {/* 画像設定 */}

      <section className={styles.formCard}>
        <h2>画像設定</h2>

        <div className={styles.field}>
          <label htmlFor="characterImage">
            一果のキャラクター画像
          </label>

          <input
            id="characterImage"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) =>
              handleImageChange(
                event,
                "characterImage"
              )
            }
          />

          {form.characterImage && (
            <div className={styles.imagePreview}>
              <img
                src={form.characterImage}
                alt="キャラクター画像"
              />

              <button
                type="button"
                onClick={() =>
                  updateField(
                    "characterImage",
                    ""
                  )
                }
              >
                画像を外す
              </button>
            </div>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="backgroundImage">
            背景画像
          </label>

          <input
            id="backgroundImage"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) =>
              handleImageChange(
                event,
                "backgroundImage"
              )
            }
          />

          {form.backgroundImage && (
            <div className={styles.imagePreview}>
              <img
                src={form.backgroundImage}
                alt="背景画像"
              />

              <button
                type="button"
                onClick={() =>
                  updateField(
                    "backgroundImage",
                    ""
                  )
                }
              >
                画像を外す
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ボタン */}

      <section className={styles.actionArea}>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={openPreview}
        >
          入力内容を確認する
        </button>

        <button
          type="button"
          className={styles.resetButton}
          onClick={resetForm}
        >
          入力内容をリセット
        </button>
      </section>

      {/* 確認プレビュー */}

      {showPreview && (
        <section
          id="ichika-preview"
          className={styles.confirmCard}
        >
          <div className={styles.confirmHeader}>
            <span>🌸 一果・前日版</span>

            <strong>
              {form.place}
              {form.raceNo}R
            </strong>
          </div>

          <dl className={styles.confirmList}>
            <div>
              <dt>日付</dt>
              <dd>{form.raceDate}</dd>
            </div>

            <div>
              <dt>本命</dt>
              <dd>{form.honmei}号艇</dd>
            </div>

            <div>
              <dt>期待度</dt>
              <dd>{form.nigeRate}%</dd>
            </div>

            <div>
              <dt>場平均との差</dt>
              <dd>
                {Number(form.upRate) > 0
                  ? "+"
                  : ""}
                {form.upRate}%
              </dd>
            </div>

            <div>
              <dt>注目艇</dt>
              <dd>
                {form.selectedBoats
                  .slice()
                  .sort(
                    (a, b) =>
                      Number(a) -
                      Number(b)
                  )
                  .map(
                    (boat) =>
                      `${boat}号艇`
                  )
                  .join("・")}
              </dd>
            </div>

            <div>
              <dt>危険艇</dt>
              <dd>
                {form.dangerBoat ===
                "なし"
                  ? "なし"
                  : `${form.dangerBoat}号艇`}
              </dd>
            </div>
          </dl>

          <div className={styles.confirmComment}>
            <h3>一果のひとこと</h3>
            <p>{form.mainComment}</p>
          </div>

          <button
            type="button"
            className={styles.generateButton}
            onClick={() => {
              alert(
                "入力画面は完成しています。次にPython画像生成APIと接続します。"
              );
            }}
          >
            一果前日新聞を生成する
          </button>
        </section>
      )}
    </main>
  );
}
