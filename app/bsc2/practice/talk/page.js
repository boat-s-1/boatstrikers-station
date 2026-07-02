"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import TalkGame from "./TalkGame";
import talkQuestions from "./questions";

function TalkPageContent() {
  const searchParams = useSearchParams();
  const character = searchParams.get("character") || "ichika";
  const characterData = talkQuestions[character] || talkQuestions.ichika;

  return (
    <>
      <header className="talkTopBar">
        <a href="/bsc2/practice">←</a>
        <div>
          <span>BSC TALK</span>
          <h1>会話問題</h1>
        </div>
        <b>{characterData.icon}</b>
      </header>

      <TalkGame characterData={characterData} />
    </>
  );
}

export default function TalkPage() {
  return (
    <main className="talkPage">
      <Suspense fallback={<div className="talkGameBox">読み込み中...</div>}>
        <TalkPageContent />
      </Suspense>
    </main>
  );
}
