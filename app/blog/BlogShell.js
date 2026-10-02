import Link from 'next/link';
import s from './blog.module.css';
export default function BlogShell({children,article=false}) {
  return <div className={s.shell}>
    <a className={s.skip} href={article?'#article-body':'#articles'}>{article?'記事本文へ移動':'記事一覧へ移動'}</a>
    <header className={s.header}>
      <div className={s.headerInner}><Link href="/blog" className={s.brand} aria-label="BOATSTRIKERS BLOG トップ">BOATSTRIKERS<span>BLOG</span></Link>
        <nav className={s.switch} aria-label="RACEとBLOG"><Link href="/today" prefetch={false}>RACE ↗</Link><Link href="/blog" aria-current="page">BLOG</Link></nav></div>
      <nav className={s.headerNav} aria-label="BLOGメニュー"><Link href="/blog#articles">記事を読む</Link><Link href="/blog#categories">テーマで探す</Link><Link href="/blog#authors">著者で探す</Link></nav>
    </header>
    {children}
    <footer className={s.footer}><Link href="/blog" className={s.footerBrand}>BOATSTRIKERS BLOG</Link><p>ボートレースを調べる・学ぶ・読む。</p><div><Link href="/" prefetch={false}>BoatStrikers</Link><a href={article?'#article-title':'#blog-title'}>ページ上部へ ↑</a></div><small>© BoatStrikers</small></footer>
  </div>;
}
