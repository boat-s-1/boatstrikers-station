import ChatEngine from "./components/ChatEngine";
import chapter1 from "./story/chapter1";

export default function BSC2Page() {
  return (
    <ChatEngine
      storyId="chapter1-lesson1"
      title="BOAT STRIKERS CHALLENGE"
      chapter="Chapter 1"
      story={chapter1}
      rewardPoint={20}
      badge="競艇入門"
    />
  );
}
