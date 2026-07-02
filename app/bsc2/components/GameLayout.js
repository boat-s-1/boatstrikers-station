"use client";

import { useEffect, useRef } from "react";
import BscStatus from "./BscStatus";
import ClearPanel from "./ClearPanel";
import TypeWriter from "./TypeWriter";

export default function GameLayout({
  title,
  chapter,
  character,
  messages,
  choices,
  onChoice,
  onNext,
  showNext,
  effect,
  finished,
  rewardPoint = 20,
  badge = "BSC認定",
  alreadyCleared = false,
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, choices, effect, finished]);

  return (
    <main className="bscPlayPage">
      {effect && <div className="gameEffect">{effect}</div>}

      <header className="bscPlayHeader">
        <a href="/bsc2" className="bscPlayBack">←</a>

        <div className="bscPlayTitle">
          <span>{chapter}</span>
          <h1>{title}</h1>
        </div>

        <div className="bscPlayMini">BSC</div>
      </header>

      <BscStatus />

      <section className="bscPlayCharacter">
        <div className="bscPlayCharacterAura" />

        <img
          src={character.image}
          alt={character.name}
          className="bscPlayCharacterImg"
        />

        <div className="bscPlayCharacterName">
          {character.name}
        </div>
      </section>

      <section className="bscTalkPanel">
        <div className="bscTalkHeader">
          <span>STORY MODE</span>
          <b>{chapter}</b>
        </div>

        <div className="bscChatScroll">
          {messages.map((msg, index) => {
            const isUser = msg.from === "user";

            return (
              <div
                className={`bscMessageLine ${isUser ? "user" : "character"}`}
                key={index}
              >
                {!isUser && (
                  <img
                    src={msg.image || character.image}
                    alt={msg.name || character.name}
                    className="bscMessageIcon"
                  />
                )}

                <div className={`bscMessageBubble ${isUser ? "user" : ""}`}>
                  {!isUser && (
                    <div className="bscMessageName">
                      {msg.name || character.name}
                    </div>
                  )}

                  <p>
                    {msg.typing ? (
                      <TypeWriter text={msg.text} speed={msg.speed || 35} />
                    ) : (
                      msg.text
                    )}
                  </p>
                </div>
              </div>
            );
          })}

          {finished && (
            <ClearPanel
              rewardPoint={rewardPoint}
              badge={badge}
              alreadyCleared={alreadyCleared}
            />
          )}

          {choices.length > 0 && (
            <div className="bscChoiceInline">
              <div className="bscChoiceTitle">答えを選んでね</div>

              {choices.map((choice, index) => (
                <button
                  type="button"
                  key={`${choice}-${index}`}
                  onClick={() => onChoice(index)}
                >
                  {choice}
                </button>
              ))}
            </div>
          )}

          {showNext && !finished && choices.length === 0 && (
            <div className="bscNextInline">
              <button type="button" onClick={onNext}>
                次へ ▶
              </button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </section>
    </main>
  );
}
