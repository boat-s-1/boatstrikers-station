import Link from 'next/link';
import MediaSwitch from '../components/MediaSwitch';
import s from './blog.module.css';
export default function BlogShell({children,article=false}) {
  return <div className={s.shell}>
    <a className={s.skip} href={article?'#article-body':'#articles'}>{article?'記事本文へ移動':'記事一覧へ移動'}</a>
    <header className={s.header}>
      <div className={s.headerInner}><Link href="/blog" className={s.brand} aria-label="BOATSTRIKERS BLOG トップ">BOATSTRIKERS<span>BLOG</span></Link>
        <MediaSwitch active="blog"/></div>
      <nav className={s.headerNav} aria-label="BLOGメニュー"><Link href="/blog#articles">記事を読む</Link><Link href="/blog#categories">テーマで探す</Link><Link href="/blog#authors">著者で探す</Link></nav>
    </header>
    {children}
    <footer className={s.footer}><Link href="/blog" className={s.footerBrand}>BOATSTRIKERS BLOG</Link><p>ボートレースを調べる・学ぶ・読む。</p><div><Link href="/" prefetch={false}>BoatStrikers</Link><Link href="/library" prefetch={false}>図書館・既存の読み物</Link><a href={article?'#article-title':'#blog-title'}>ページ上部へ ↑</a></div><aside className={s.rankingBanner} aria-label="ブログランキング"><span>にほんブログ村に参加しています</span><a href="https://gambling.blogmura.com/kyotei/ranking/in?p_cid=11218747" target="_blank" rel="noopener noreferrer" aria-label="にほんブログ村 競艇ランキング（新しいタブで開く）"><img src="https://b.blogmura.com/gambling/kyotei/88_31.gif" width="88" height="31" alt="にほんブログ村 公営ギャンブルブログ 競艇へ" loading="lazy" /><span>にほんブログ村 ↗</span></a></aside><small>© BoatStrikers</small></footer>
  </div>;
}
