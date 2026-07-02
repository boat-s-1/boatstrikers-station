"use client";

import { useEffect, useState } from "react";
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
      image: "/bsc/vote-ichika.jpg",
    },
    {
      key: "kiina",
      name: "キイナ",
      icon: "⚡",
      label: "キイナの穴",
      main: "5-1-4",
      subLabel: "",
      sub: "",
      image: "/bsc/vote-kiina.jpg",
    },
    {
      key: "hatsune",
      name: "初音",
      icon: "💜",
      label: "初音の狙い",
      main: "2-1-3",
      subLabel: "",
      sub: "",
      image: "/bsc/vote-hatsune.jpg",
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

  const totalVotes = Object.values(votes).reduce((sum, num) => sum + num, 0);

  const getPercent = (key) => {
    if (!totalVotes) return 0;
    return Math.round(((votes[key] || 0) / totalVotes) * 100);
  };

  const makeEventFromRow = (row) => ({
    id: row.id,
    title: row.title,
    deadline: row.deadline,
    candidates: [
      {
        key: "ichika",
      
    
        label: "一果の本命",
        main: row.ichika_main || "-",
        subLabel: "一果の押さえ",
        sub: row.ichika_sub || "",
        image: "/bsc/DDE679B0-6671-4154-84DE-980C1A45B089.png",
      },
      {
        key: "kiina",
        
        label: "キイナの穴",
        main: row.kiina_main || "-",
        subLabel: "",
        sub: "",
        image: "/bsc/DE819073-38BC-4B82-AC8A-F74376A1DDFC.png",
      },
      {
        key: "hatsune",
        
        label: "初音の狙い",
        main: row.hatsune_main || "-",
        subLabel: "",
        sub: "",
        image: "/bsc/7E1B02E0-748D-4BB1-A0E8-A203C30DA492.png",
      },
    ],
  });

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

    if (error || !data) {
      setIsReady(true);
      return DEFAULT_EVENT;
    }

    const activeEvent = makeEventFromRow(data);
    setEvent(activeEvent);
    setIsReady(true);
    return activeEvent;
  };

  const updateCountdown = (targetEvent) => {
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

  const loadVotes = async (targetEvent) => {
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
    let timer;

    const start = async () => {
      setLoading(true);

      const activeEvent = await loadActiveEvent();

      const savedVote = JSON.parse(
        localStorage.getItem(`dailyVote_${activeEvent.id}`) || "null"
      );

      if (savedVote) {
        setVoted(true);
        setChoice(savedVote.choice);
      }

      updateCountdown(activeEvent);
      timer = setInterval(() => updateCountdown(activeEvent), 1000);

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
          () => loadVotes(activeEvent)
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
          () => window.location.reload()
        )
        .subscribe();
    };

    start();

    return () => {
      if (timer) clearInterval(timer);
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
      `dailyVote_${event.id}`,
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

      {!isReady && (
        <div className="voteFinish">
          <h3>投票機能の準備中です</h3>
          <p>Supabase設定が反映されると投票できます。</p>
        </div>
      )}

      {isReady && (
        <div className="voteImageGrid">
          {event.candidates.map((item) => {
            const percent = getPercent(item.key);
            const selected = choice === item.name;

            return (
              <button
                type="button"
                key={item.key}
                className={`voteImageButton ${selected ? "selected" : ""}`}
                onClick={() => vote(item)}
                disabled={voting || voted || isClosed}
              >
                <img src={item.image} alt={`${item.name}に投票`} />

                <div className="voteImageMeta">
                  <strong>
                    {item.icon} {item.name}
                  </strong>

                  <span>{item.main}</span>

                  {item.sub && <em>押さえ {item.sub}</em>}

                  <div className="voteImagePercent">
                    {loading ? "--" : `${percent}%`}
                  </div>

                  <div className="voteImageBar">
                    <i style={{ width: `${percent}%` }} />
                  </div>
                </div>

                {selected && <div className="voteSelectedMark">投票済み</div>}
              </button>
            );
          })}
        </div>
      )}

      {isReady && !voted && !isClosed && (
        <p className="voteTapGuide">画像をタップして投票できます</p>
      )}

      {isReady && voted && (
        <div className="voteFinish">
          <h3>投票ありがとう😊</h3>
          <p>+2pt GET!!</p>
          <p>
            あなたは <b>{choice}</b> に投票しました。
          </p>
        </div>
      )}

      <div className="voteResultBox compact">
        <h3>📊 リアルタイム投票率</h3>

        {loading ? (
          <p className="voteTotal">投票数を読み込み中...</p>
        ) : (
          <p className="voteTotal">現在 {totalVotes}人が参加中</p>
        )}
      </div>
    </section>
  );
}
