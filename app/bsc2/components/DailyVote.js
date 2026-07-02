"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const DEFAULT_EVENT = {
  id: "default-daily-event",
  title: "蒲郡12R ドリーム戦",
  deadline: "20:35",
  candidates: [
    {
      key: "ichika",
      name: "一果",
      icon: "🌸",
      label: "一果の本命",
      main: "1-2-3",
      subLabel: "一果の押さえ",
      sub: "1-2-56",
    },
    {
      key: "kiina",
      name: "キイナ",
      icon: "⚡",
      label: "キイナの穴",
      main: "5-1-4",
      subLabel: "",
      sub: "",
    },
    {
      key: "hatsune",
      name: "初音",
      icon: "💜",
      label: "初音の狙い",
      main: "2-1-3",
      subLabel: "",
      sub: "",
    },
  ],
};

const initialVotes = {
  ichika: 0,
  kiina: 0,
  hatsune: 0,
};

export default function DailyVote() {
  const [event, setEvent] = useState(DEFAULT_EVENT);
  const [votes, setVotes] = useState(initialVotes);
  const [voted, setVoted] = useState(false);
  const [choice, setChoice] = useState("");
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");
  const [isClosed, setIsClosed] = useState(false);

  const voteKey = useMemo(() => {
    return `dailyVote_${event.id}`;
  }, [event.id]);

  const totalVotes = Object.values(votes).reduce((sum, num) => sum + num, 0);

  const getPercent = (key) => {
    if (!totalVotes) return 0;
    return Math.round(((votes[key] || 0) / totalVotes) * 100);
  };

  const makeEventFromRow = (row) => {
    return {
      id: row.id,
      title: row.title,
      deadline: row.deadline,
      candidates: [
        {
          key: "ichika",
          name: "一果",
          icon: "🌸",
          label: "一果の本命",
          main: row.ichika_main || "-",
          subLabel: "一果の押さえ",
          sub: row.ichika_sub || "",
        },
        {
          key: "kiina",
          name: "キイナ",
          icon: "⚡",
          label: "キイナの穴",
          main: row.kiina_main || "-",
          subLabel: "",
          sub: "",
        },
        {
          key: "hatsune",
          name: "初音",
          icon: "💜",
          label: "初音の狙い",
          main: row.hatsune_main || "-",
          subLabel: "",
          sub: "",
        },
      ],
    };
  };

  const loadActiveEvent = async () => {
    if (!supabase) {
      setIsReady(false);
      setLoading(false);
      return DEFAULT_EVENT;
    }

    const { data, error } = await supabase
      .from("daily_events")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("イベント取得エラー:", error);
      setIsReady(false);
      setLoading(false);
      return DEFAULT_EVENT;
    }

    if (!data) {
      setIsReady(true);
      return DEFAULT_EVENT;
    }

    const activeEvent = makeEventFromRow(data);
    setEvent(activeEvent);
    setIsReady(true);
    return activeEvent;
  };

  const updateCountdown = (targetEvent = event) => {
    const now = new Date();
    const [hour, minute] = targetEvent.deadline.split(":").map(Number);

    const deadline = new Date();
    deadline.setHours(hour, minute, 0, 0);

    const diff = deadline.getTime() - now.getTime();

    if (diff <= 0) {
      setTimeLeft("00:00:00");
      setIsClosed(true);
      return;
    }

    const h = Math.floor(diff / 1000 / 60 / 60);
    const m = Math.floor((diff / 1000 / 60) % 60);
    const s = Math.floor((diff / 1000) % 60);

    setTimeLeft(
      `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(
        s
      ).padStart(2, "0")}`
    );

    setIsClosed(false);
  };

  const loadVotes = async (targetEvent = event) => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("daily_votes")
      .select("candidate_key")
      .eq("event_id", targetEvent.id);

    if (error) {
      console.error("投票取得エラー:", error);
      setLoading(false);
      return;
    }

    const counts = { ...initialVotes };

    (data || []).forEach((row) => {
      if (counts[row.candidate_key] !== undefined) {
        counts[row.candidate_key] += 1;
      }
    });

    setVotes(counts);
    setLoading(false);
  };

  useEffect(() => {
    let voteChannel;
    let eventChannel;
    let countdownTimer;

    const start = async () => {
      setLoading(true);

      const activeEvent = await loadActiveEvent();

      const savedVote = JSON.parse(
        localStorage.getItem(`dailyVote_${activeEvent.id}`) || "null"
      );

      if (savedVote) {
        setVoted(true);
        setChoice(savedVote.choice);
      } else {
        setVoted(false);
        setChoice("");
      }

      updateCountdown(activeEvent);
      countdownTimer = setInterval(() => {
        updateCountdown(activeEvent);
      }, 1000);

      await loadVotes(activeEvent);

      if (!supabase) return;

      voteChannel = supabase
        .channel(`daily-votes-${activeEvent.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "daily_votes",
            filter: `event_id=eq.${activeEvent.id}`,
          },
          () => {
            loadVotes(activeEvent);
          }
        )
        .subscribe();

      eventChannel = supabase
        .channel("daily-events-active")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "daily_events",
          },
          async () => {
            window.location.reload();
          }
        )
        .subscribe();
    };

    start();

    return () => {
      if (countdownTimer) clearInterval(countdownTimer);
      if (voteChannel) supabase?.removeChannel(voteChannel);
      if (eventChannel) supabase?.removeChannel(eventChannel);
    };
  }, []);

  const vote = async (candidate) => {
    if (!supabase) {
      alert("投票機能の準備中です。");
      return;
    }

    if (isClosed) {
      alert("投票は締め切りました。");
      return;
    }

    if (voted || voting) return;

    setVoting(true);

    const { error } = await supabase.from("daily_votes").insert({
      event_id: event.id,
      candidate_key: candidate.key,
      candidate_name: candidate.name,
    });

    if (error) {
      console.error("投票エラー:", error);
      alert("投票に失敗しました。もう一度お試しください。");
      setVoting(false);
      return;
    }

    localStorage.setItem(
      voteKey,
      JSON.stringify({
        eventId: event.id,
        choice: candidate.name,
        key: candidate.key,
      })
    );

    const point = Number(localStorage.getItem("bscPoint") || 0);
    localStorage.setItem("bscPoint", point + 2);

    setChoice(candidate.name);
    setVoted(true);
    setVoting(false);

    await loadVotes(event);
  };

  return (
    <section className="dailyVote">
      <div className="dailyVoteBanner">
        <img src="/bsc/IMG_6178.jpeg" alt="Today’s Event" />
      </div>

      <div className="dailyVoteInfo">
        <h2>{event.title}</h2>

        <div className={`dailyVoteDeadline ${isClosed ? "closed" : ""}`}>
          ⏰ {isClosed ? "投票締切済み" : `締切まで ${timeLeft}`}
        </div>
      </div>

      <div className="dailyVoteCards">
        {event.candidates.map((item) => (
          <div className="voteCard" key={item.key}>
            <h3>
              {item.icon} {item.name}
            </h3>

            <p>
              {item.label}
              <br />
              <b>{item.main}</b>
            </p>

            {item.sub && (
              <p>
                {item.subLabel}
                <br />
                <b>{item.sub}</b>
              </p>
            )}
          </div>
        ))}
      </div>

      {!isReady && (
        <div className="voteFinish">
          <h3>投票機能の準備中です</h3>
          <p>Supabase設定が反映されると投票できます。</p>
        </div>
      )}

      {isReady && !voted ? (
        <div className="voteButtons">
          <h3>どれが来ると思う？</h3>

          {event.candidates.map((item) => (
            <button
              type="button"
              key={item.key}
              onClick={() => vote(item)}
              disabled={voting || isClosed}
            >
              {isClosed
                ? "投票締切済み"
                : voting
                ? "投票中..."
                : `${item.icon} ${item.name}に投票`}
            </button>
          ))}
        </div>
      ) : null}

      {isReady && voted ? (
        <div className="voteFinish">
          <h3>投票ありがとう😊</h3>
          <p>+2pt GET!!</p>
          <p>
            あなたは <b>{choice}</b> に投票しました。
          </p>
        </div>
      ) : null}

      <div className="voteResultBox">
        <h3>📊 リアルタイム投票率</h3>

        {loading ? (
          <p className="voteTotal">投票数を読み込み中...</p>
        ) : (
          <>
            <p className="voteTotal">現在 {totalVotes}人が参加中</p>

            {event.candidates.map((item) => {
              const percent = getPercent(item.key);

              return (
                <div className="voteResultRow" key={item.key}>
                  <div className="voteResultTop">
                    <strong>
                      {item.icon} {item.name}
                    </strong>
                    <span>
                      {percent}% / {votes[item.key] || 0}票
                    </span>
                  </div>

                  <div className="voteBar">
                    <i style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </section>
  );
}
