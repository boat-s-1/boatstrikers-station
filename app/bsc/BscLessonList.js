"use client";

import { useEffect, useState } from "react";

export default function BscLessonList({ lessons }) {
  const [cleared, setCleared] = useState([]);

  useEffect(() => {
    setCleared(JSON.parse(localStorage.getItem("bscMission") || "[]"));
  }, []);

  return (
    <div className="bscLessonList">
      {lessons.map((lesson) => {
        const isCleared = cleared.includes(lesson.id);

        return (
          <a
            href={`/bsc/lesson/${lesson.id}`}
            className={`bscLessonCard ${isCleared ? "isCleared" : ""}`}
            key={lesson.id}
          >
            <span>{isCleared ? "✅ CLEAR" : `Mission ${lesson.id}`}</span>
            <h3>{lesson.title}</h3>
            <p>クリア報酬：🏅{lesson.badge}</p>
            <b>{isCleared ? "復習する ›" : "挑戦する ›"}</b>
          </a>
        );
      })}
    </div>
  );
}
