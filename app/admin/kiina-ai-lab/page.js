import { loadCharacterAiAnalysis } from "../../../lib/hatsuneKiinaAiAnalysis";
import SpecialistAiLab from "../_components/SpecialistAiLab";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function KiinaAiLabPage() {
  const data = await loadCharacterAiAnalysis("kiina");
  return <SpecialistAiLab character="kiina" {...data} />;
}
