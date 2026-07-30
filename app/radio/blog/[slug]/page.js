import Link from "next/link";
import { notFound } from "next/navigation";
import { getRadioBlog, radioBlogs } from "../../blogData";
import styles from "../../radio.module.css";

export function generateStaticParams() {
  return radioBlogs.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = getRadioBlog(slug);
  return post
    ? { title: `${post.title}｜ボート・ナイト・ニッポン` }
    : { title: "放送ブログ" };
}

export default async function RadioBlogPage({ params }) {
  const { slug } = await params;
  const post = getRadioBlog(slug);
  if (!post) notFound();

  return (
    <main className={styles.page}>
      <article className={styles.article}>
        <Link href="/radio#blog" className={styles.backLink}>
          ← 放送ブログへ戻る
        </Link>

        <div className={styles.articleMeta}>
          <span>{post.number}</span>
          <time>{post.date}</time>
          <span>担当：{post.host}</span>
        </div>

        <h1>{post.title}</h1>
        <img className={styles.articleImage} src={post.image} alt={post.title} />

        <p className={styles.articleLead}>{post.summary}</p>

        <div className={styles.articleText}>
          {post.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>

        <div className={styles.articleFooter}>
          <Link href="/radio#archive">過去の放送を聴く</Link>
          <Link href="/radio#blog">ほかの放送後記を見る</Link>
        </div>
      </article>
    </main>
  );
}
