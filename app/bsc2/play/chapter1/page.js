import ChatEngine from "../../components/ChatEngine";
import chapter1 from "../../story/chapter1";

export default function Chapter1Page() {
  return (
    <ChatEngine
      storyId={chapter1.id}
      title="BOAT STRIKERS CHALLENGE"
      chapter={chapter1.title}
      subtitle={chapter1.subtitle}
      story={chapter1.steps}
      rewardPoint={chapter1.reward.point}
      badge={chapter1.reward.badge.name}
      reward={chapter1.reward}
    />
  );
}
