"use client";
import {useRouter} from "next/navigation";
import {useState} from "react";
import styles from "../ichika/IchikaBookshelf.module.css";

export default function CharacterBookshelf({character,title,banner,books}){
 const router=useRouter();const [openingHref,setOpeningHref]=useState(null);
 const openBook=(event,href)=>{event.preventDefault();if(openingHref)return;setOpeningHref(href);window.setTimeout(()=>router.push(href),1200)};
 return <section className={styles.section} aria-label={`${title}の本棚`}>
  <div className={styles.bannerCrop}><img src={banner} alt={title} className={styles.banner}/></div>
  <div className={styles.heading}><p>{character}の専門テーマを、本棚から選ぶように読めます。</p><small>横にスワイプ →</small></div>
  <div className={styles.shelfViewport}><div className={styles.shelfTrack}>{books.map(book=>{const isOpening=openingHref===book.href;return <a className={`${styles.book} ${isOpening?styles.openBook:""}`} href={book.href} onClick={e=>openBook(e,book.href)} aria-label={`${book.title}を開く`} aria-busy={isOpening} key={book.title}><div className={styles.openPage} aria-hidden="true"><span>📖</span><b>OPEN...</b></div><div className={styles.bookCover}><img src={book.cover} alt={book.title}/><span>{book.tag}</span></div><div className={styles.bookMeta}><strong>{book.title}</strong><small>{book.subtitle}</small></div></a>})}</div><div className={styles.woodShelf} aria-hidden="true"><div className={styles.shelfTop}/><div className={styles.shelfFront}/></div></div>
 </section>;
}
