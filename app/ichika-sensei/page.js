import SeminarMagazineShelf from "../library/components/SeminarMagazineShelf";
import { getIchikaBookSeries } from "../../lib/ichikaBookSeries";
import { listPublishedIchikaBooks } from "../../lib/ichikaBookDb";

export const dynamic = "force-dynamic";
export const metadata = { title: "教えて！一果センセー｜BoatStrikers", description: "初心者の疑問をマンガ風スライドと文章解説で学ぶ、一果センセーのボートレース入門書。" };

export default async function IchikaSenseiPage() {
  const base = getIchikaBookSeries("sensei");
  const managed = await listPublishedIchikaBooks("sensei");
  const magazine = { ...base, issues: managed.length ? managed : base.issues };
  return <SeminarMagazineShelf magazine={magazine} />;
}
