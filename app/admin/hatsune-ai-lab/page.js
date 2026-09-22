import { loadCharacterAiAnalysis } from "../../../lib/hatsuneKiinaAiAnalysis";
import SpecialistAiLab from "../_components/SpecialistAiLab";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HatsuneAiLabPage() {
  const data = await loadCharacterAiAnalysis("hatsune");
  return <SpecialistAiLab character="hatsune" {...data} />;
}
