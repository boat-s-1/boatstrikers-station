"use client";

export default function CharacterStage({
  characterData,
  characterImage,
  mood = "idle",
}) {
  return (
    <div className={`talkCharacterStage ${mood}`}>
      <div className="talkCharacterAura" />

      <div className={`talkCharacterFace ${mood}`}>
        <img src={characterImage} alt={characterData.name} />
        <span className="talkBlink" />
        <span className="talkSparkle">✨</span>
      </div>

      <div className="talkCharacterName">
        {characterData.icon} {characterData.name}
      </div>
    </div>
  );
}
