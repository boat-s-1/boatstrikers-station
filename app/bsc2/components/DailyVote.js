"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const TODAY_EVENT = {
  id: "2026-07-01-gamagori-12",
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

export default function DailyVote() {
  const [votes, setVotes] = useState({
    ichika: 0,
    kiina: 0,
    hatsune: 0,
  });

  const [voted, setVoted] = useState(false);
  const [choice, setChoice] = useState("");
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);

  const voteKey = useMemo(() => {
    return `dailyVote_${TODAY_EVENT.id}`;
  }, []);

  const totalVotes = Object.values(votes).reduce((sum, num) => sum + num, 0);

  const getPercent = (key) => {
    if (!totalVotes) return 0;
    return Math.round((votes[key] / totalVotes) * 100);
  };

  const loadVotes = async () => {
    const { data, error } = await supabase
      .from("daily_votes")
      .select("candidate_key")
      .eq("event_id", TODAY_EVENT.id);

    if (error) {
      console.error("投票取得エラー:", error);
      setLoading(false);
      return;
    }

    const counts = {
      ichika: 0,
      kiina: 0,
      hatsune: 0,
    };

    data.forEach((row) => {
      if (counts[row.candidate_key] !== undefined) {
        counts[row.candidate_key] += 1;
      }
    });

    setVotes(counts);
    setLoading(false);
  };

  useEffect(() => {
    const savedVote = JSON.parse(localStorage.getItem(voteKey) || "null");

    if (savedVote) {
      setVoted(true);
      setChoice(savedVote.choice);
    }

    loadVotes();

    const channel = supabase
      .channel(`daily-votes-${TODAY_EVENT.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "daily_votes",
          filter: `event_id=eq.${TODAY_EVENT.id}`,
        },
        () => {
          loadVotes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [voteKey]);

  const vote = async (candidate) => {
    if (voted || voting) return;

    setVoting(true);

    const { error } = await supabase.from("daily_votes").insert({
      event_id: TODAY_EVENT.id,
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
        eventId: TODAY_EVENT.id,
        choice: candidate.name,
        key: candidate.key,
      })
    );

    const point = Number(localStorage.getItem("bscPoint") || 0);
    localStorage.setItem("bscPoint", point + 2);

    setChoice(candidate.name);
    setVoted(true);
    setVoting(false);

    await loadVotes();
  };
