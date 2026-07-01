"use client";

import { useEffect, useRef } from "react";
import TypeWriter from "./TypeWriter";
import BscStatus from "./BscStatus";
import ClearPanel from "./ClearPanel";

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

  nextHref = "/bsc2/play/chapter2",
  nextTitle = "Chapter2へ進む",
  reviewHref = "/library",
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, choices, effect, finished]);

  return (
    <main className="gamePage">
      {effect && <div className="gameEffect">{effect}</div>}

      <header className="gameTopBar">
        <a href="/bsc2" className="gameBack">
          ←
        </a>

        <div>
          <span>{chapter}</span>
          <h1>{title}</h1>
        </div>

        <div className="gameStatusMini">BSC</div>
      </header>

      <section className="gameCharacterArea">
        <img
          src={character.image}
          alt={character.name}
          className="gameMainCharacter"
        />

        <div className="gameCharacterName">{character.name}</div>
      </section>

      <BscStatus />

      <section className="gameChatArea">
        {messages.map((msg, index) => {
          const isUser = msg.from === "user";

          return (
            <div
              className={`gameMessageRow ${isUser ? "user" : "character"}`}
              key={index}
            >
              {!isUser && (
                <img
                  src={msg.image}
                  alt={msg.name}
                  className="gameMessageIcon"
                />
              )}

              <div
                className={`gameBubble ${
                  isUser ? "userBubble" : "characterBubble"
                }`}
              >
                {!isUser && <span className="gameBubbleName">{msg.name}</span>}

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

        <div ref={bottomRef} />
      </section>

      {finished && (
        <ClearPanel
          rewardPoint={rewardPoint}
          badge={badge}
          alreadyCleared={alreadyCleared}
          nextHref={nextHref}
          nextTitle={nextTitle}
          reviewHref={reviewHref}
        />
      )}

      {!finished && (
        <section className="gameBottomArea">
          {choices.length > 0 ? (
            <div className="gameChoices">
              {choices.map((choice, index) => (
                <button
                  type="button"
                  key={choice}
                  onClick={() => onChoice(index)}
                >
                  {choice}
                </button>
              ))}
            </div>
          ) : (
            showNext && (
              <button type="button" className="gameNextButton" onClick={onNext}>
                次へ ▶
              </button>
            )
          )}
        </section>
      )}
    </main>
  );
}
