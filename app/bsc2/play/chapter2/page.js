import ChatEngine from "../../components/ChatEngine";
import chapter2 from "../../story/chapter2";

export default function Chapter2Page() {
  return (
    <ChatEngine
      storyId="chapter2-start-tenji"
      title="BOAT STRIKERS CHALLENGE"
      chapter="Chapter 2"
      story={chapter2}
      rewardPoint={20}
      badge="スタート展示入門"
    />
  );
}
