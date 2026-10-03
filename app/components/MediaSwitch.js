import Link from 'next/link';
import s from './blogNavigation.module.css';
export default function MediaSwitch({active='race'}) {
 return <nav className={s.switch} aria-label="RACEとBLOG" data-blog-placement="header-switch"><Link href="/today" prefetch={false} aria-current={active==='race'?'page':undefined}>RACE ↗</Link><Link href="/blog" aria-current={active==='blog'?'page':undefined}>BLOG</Link></nav>;
}
