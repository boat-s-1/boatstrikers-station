"use client";

import { useSearchParams } from "next/navigation";
import TalkGame from "./TalkGame";
import talkQuestions from "./questions";

export default function TalkPage() {
  const searchParams = useSearchParams();
  const character = searchParams.get("character") || "ichika";

  const characterData = talkQuestions[character] || talkQuestions.ichika;

  return (
    <main className="talkPage">
      <style>{`
        .talkPage {
          min-height: 100vh;
          padding: 14px 14px 90px;
          background:
            linear-gradient(180deg, rgba(8, 20, 58, .88), rgba(0, 0, 0, .55)),
            url("/bsc/practice-base.png");
          background-size: cover;
          background-position: center;
        }

        .talkTopBar {
          height: 62px;
          display: grid;
          grid-template-columns: 42px 1fr 58px;
          align-items: center;
          padding: 8px 10px;
          margin-bottom: 14px;
          border-radius: 22px;
          background: rgba(255,255,255,.94);
          box-shadow: 0 8px 22px rgba(0,0,0,.22);
        }

        .talkTopBar a {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #17345c;
          color: #fff;
          text-decoration: none;
          font-size: 22px;
          font-weight: 900;
        }

        .talkTopBar div {
          text-align: center;
        }

        .talkTopBar span {
          display: block;
          color: #ff4f93;
          font-size: 11px;
          font-weight: 900;
        }

        .talkTopBar h1 {
          margin: 2px 0 0;
          color: #17345c;
          font-size: 18px;
          font-weight: 900;
        }

        .talkTopBar b {
          text-align: center;
          color: #ff4f93;
          font-size: 13px;
          font-weight: 900;
        }

        .talkGameBox,
        .talkResult {
          max-width: 560px;
          margin: 0 auto;
          padding: 18px;
          border-radius: 28px;
          background: rgba(255,255,255,.94);
          border: 3px solid #ffd768;
          box-shadow: 0 16px 38px rgba(0,0,0,.38);
          color: #17345c;
        }

        .talkGameHeader {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 16px;
        }

        .talkGameHeader img {
          width: 72px;
          height: 72px;
          object-fit: cover;
          border-radius: 22px;
          border: 3px solid #ffd768;
          background: #fff;
        }

        .talkGameHeader span {
          display: inline-block;
          padding: 5px 12px;
          border-radius: 999px;
          background: linear-gradient(135deg, #ff4f93, #f6a800);
          color: #fff;
          font-size: 12px;
          font-weight: 900;
        }

        .talkGameHeader h2 {
          margin: 7px 0 3px;
          font-size: 20px;
        }

        .talkGameHeader p {
          margin: 0;
          font-size: 12px;
          font-weight: 900;
          color: #80603a;
        }

        .talkBubble {
          padding: 16px;
          border-radius: 22px;
          background: #fff7df;
          border: 2px solid #ffd768;
          margin-bottom: 16px;
        }

        .talkBubble strong {
          display: block;
          color: #ff4f93;
          margin-bottom: 6px;
        }

        .talkBubble p {
          margin: 0;
          font-weight: 900;
          line-height: 1.7;
        }

        .talkQuestion {
          padding: 16px;
          border-radius: 22px;
          background: #17345c;
          color: #fff;
          margin-bottom: 14px;
        }

        .talkQuestion span {
          color: #ffd768;
          font-size: 12px;
          font-weight: 900;
        }

        .talkQuestion h3 {
          margin: 8px 0 0;
          font-size: 20px;
          line-height: 1.5;
        }

        .talkChoices {
          display: grid;
          gap: 10px;
        }

        .talkChoices button {
          border: 0;
          border-radius: 18px;
          padding: 15px;
          background: #eef5ff;
          color: #17345c;
          font-size: 16px;
          font-weight: 900;
          text-align: left;
        }

        .talkChoices button.correct {
          background: #06c755;
          color: #fff;
        }

        .talkChoices button.wrong {
          background: #ff4f93;
          color: #fff;
        }

        .talkAnswerBox {
          margin-top: 16px;
          padding: 16px;
          border-radius: 22px;
          background: #fff;
          border: 2px solid #ffb6d3;
        }

        .talkAnswerBox h3 {
          margin: 0 0 8px;
          color: #ff2f86;
        }

        .talkAnswerBox p {
          margin: 0;
          font-weight: 900;
          line-height: 1.7;
        }

        .talkRewardMini {
          display: inline-block;
          margin-top: 12px;
          padding: 7px 14px;
          border-radius: 999px;
          background: #ffd768;
          color: #17345c;
          font-weight: 900;
        }

        .talkAnswerBox button {
          width: 100%;
          margin-top: 14px;
          border: 0;
          border-radius: 16px;
          padding: 14px;
          background: linear-gradient(135deg, #ff4f93, #f6a800);
          color: #fff;
          font-size: 16px;
          font-weight: 900;
        }

        .talkResult {
          text-align: center;
        }

        .talkResult > span {
          display: inline-block;
          padding: 6px 14px;
          border-radius: 999px;
          background: #17345c;
          color: #fff;
          font-size: 12px;
          font-weight: 900;
        }

        .talkResult h2 {
          margin: 12px 0;
          font-size: 40px;
          color: #ff2f86;
        }

        .talkResultScore strong {
          display: block;
          font-size: 42px;
          color: #17345c;
        }

        .talkResultScore p {
          margin: 0;
          font-weight: 900;
        }

        .talkResultReward {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin: 18px 0;
        }

        .talkResultReward div {
          padding: 14px 8px;
          border-radius: 18px;
          background: #fff7df;
          border: 2px solid #ffd768;
        }

        .talkResultReward b {
          display: block;
          color: #ff2f86;
          font-size: 18px;
        }

        .talkResultReward p {
          margin: 4px 0 0;
          font-size: 11px;
          font-weight: 900;
        }

        .talkResultMessage {
          padding: 12px;
          border-radius: 16px;
          background: #eef5ff;
          font-weight: 900;
          line-height: 1.7;
        }

        .talkResultButtons {
          display: grid;
          gap: 10px;
          margin-top: 16px;
        }

        .talkResultButtons a,
        .talkResultButtons button,
        .talkGameBox > a {
          display: block;
          border: 0;
          border-radius: 16px;
          padding: 14px;
          background: #fff;
          color: #17345c;
          text-decoration: none;
          font-size: 15px;
          font-weight: 900;
        }

        .talkResultButtons button {
          background: linear-gradient(135deg, #ff4f93, #f6a800);
          color: #fff;
        }
      `}</style>

      <header className="talkTopBar">
        <a href="/bsc2/practice">←</a>
        <div>
          <span>BSC TALK</span>
          <h1>会話問題</h1>
        </div>
        <b>{characterData.icon}</b>
      </header>

      <TalkGame characterData={characterData} />
    </main>
  );
}
