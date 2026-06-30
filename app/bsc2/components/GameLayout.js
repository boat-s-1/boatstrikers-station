"use client";

export default function GameLayout({
  title = "BSC",
  chapter = "Chapter 1",
  characterName = "一果",
  characterImage = "/characters/ichika-talk.png",
  messages = [],
  choices = [],
  onChoice,
  onNext,
  nextLabel = "次へ ▶",
  showNext = true,
  effect = "",
  status = null,
}) {
  return (
    <main className="gamePage">
      {effect && <div className="gameEffect">{effect}</div>}

      <header className="gameTopBar">
        <a href="/bsc" className="gameBack">
          ←
        </a>

        <div>
          <span>{chapter}</span>
          <h1>{title}</h1>
        </div>

        <div className="gameStatusMini">
          {status ? `Lv.${status.level}` : "BSC"}
        </div>
      </header>

      <section className="gameCharacterArea">
        <img
          src={characterImage}
          alt={characterName}
          className="gameMainCharacter"
        />

        <div className="gameCharacterName">
          {characterName}
        </div>
      </section>

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
                  src={msg.image || characterImage}
                  alt={msg.name || characterName}
                  className="gameMessageIcon"
                />
              )}

              <div
                className={`gameBubble ${isUser ? "userBubble" : "characterBubble"}`}
              >
                {msg.name && !isUser && (
                  <span className="gameBubbleName">{msg.name}</span>
                )}

                <p>{msg.text}</p>
              </div>
            </div>
          );
        })}
      </section>

      {(choices.length > 0 || showNext) && (
        <section className="gameBottomArea">
          {choices.length > 0 && (
            <div className="gameChoices">
              {choices.map((choice, index) => (
                <button
                  type="button"
                  key={choice}
                  onClick={() => onChoice?.(index)}
                >
                  {choice}
                </button>
              ))}
            </div>
          )}

          {showNext && choices.length === 0 && (
            <button
              type="button"
              className="gameNextButton"
              onClick={onNext}
            >
              {nextLabel}
            </button>
          )}
        </section>
      )}
    </main>
  );
}
