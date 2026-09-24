import SeminarMagazineShelf from "../library/components/SeminarMagazineShelf";
import { getIchikaBookSeries } from "../../lib/ichikaBookSeries";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "教えて！一果センセー｜BoatStrikers",
  description: "初心者の疑問をマンガ風スライドと文章解説で学ぶ、一果センセーのボートレース入門書。",
};

export default function IchikaSenseiPage() {
  const series = getIchikaBookSeries("sensei");
  return <SeminarMagazineShelf magazine={series} />;
}
