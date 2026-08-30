import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isAdminAuthenticated } from "../../sync/_lib/adminAuth";
import { getOfficialYoutubeUpdates, formatMediaDate } from "../../../news/media/mediaData";
import { generateMediaEditorial } from "../../../../lib/mediaEditorialAi";
import { getMediaEditorialMap, saveMediaEditorial } from "../../../../lib/mediaEditorialData";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

async function generateOne(formData) {
  "use server";
  if (!(await isAdminAuthenticated())) redirect("/admin/sync/login");
  const videoId = String(formData.get("videoId") || "");
  const updates = await getOfficialYoutubeUpdates({ limit: 24 });
  const item = updates.find((x) => x.videoId === videoId);
  if (!item) redirect("/admin/editorial/media?error=not_found");
  try {
    const editorial = await generateMediaEditorial(item);
    await saveMediaEditorial(item, editorial);
  } catch (error) {
    redirect(`/admin/editorial/media?error=${encodeURIComponent(error?.message || "generate_failed")}`);
  }
  revalidatePath("/admin/editorial/media");
  revalidatePath("/news/media");
  revalidatePath(`/news/media/${videoId}`);
  revalidatePath("/hatsune");
  redirect(`/admin/editorial/media?generated=${encodeURIComponent(videoId)}`);
}

export default async function MediaEditorialPage({ searchParams }) {
  if (!(await isAdminAuthenticated())) redirect("/admin/sync/login");
  const params = await searchParams;
  const updates = await getOfficialYoutubeUpdates({ limit: 24 });
  const editorialMap = await getMediaEditorialMap(updates.map((x) => x.videoId));

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div><span>BOATSTRIKERS AI EDITORIAL DESK</span><h1>MEDIA AI編集</h1><p>各場公式YouTubeから、短見出し・独自紹介・見どころ3点・編集部メモを生成します。</p></div>
          <Link href="/admin/editorial">← AI編集部</Link>
        </header>

        {params?.generated && <div className={styles.success}>✓ MEDIA用の独自素材を生成して公開ページへ反映しました。</div>}
        {params?.error && <div className={styles.error}>エラー：{decodeURIComponent(String(params.error))}</div>}

        <section className={styles.list}>
          {updates.map((item) => {
            const editorial = editorialMap[item.videoId];
            return (
              <article className={styles.card} key={item.id}>
                {item.thumbnailUrl && <img src={item.thumbnailUrl} alt="" />}
                <div className={styles.body}>
                  <div className={styles.meta}><b>{item.place}公式</b><time>{formatMediaDate(item.publishedAt)}</time>{item.womenRelated && <span>女子</span>}{editorial && <span className={styles.done}>AI制作済み</span>}</div>
                  <h2>{editorial?.short_headline || item.title}</h2>
                  <p className={styles.official}>正式タイトル：{item.title}</p>
                  {editorial?.intro && <p>{editorial.intro}</p>}
                  {editorial?.highlights?.length > 0 && <ul>{editorial.highlights.map((x, i) => <li key={i}>{x}</li>)}</ul>}
                  {editorial?.editor_note && <div className={styles.note}><strong>編集部メモ</strong>{editorial.editor_note}</div>}
                  <div className={styles.actions}>
                    <form action={generateOne}><input type="hidden" name="videoId" value={item.videoId} /><button type="submit">{editorial ? "AIで作り直す" : "AI素材を作る"}</button></form>
                    <Link href={`/news/media/${item.videoId}`} target="_blank">公開ページを見る ↗</Link>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
