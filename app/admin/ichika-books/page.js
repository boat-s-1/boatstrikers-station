import Link from "next/link";
import IchikaBooksAdminClient from "./IchikaBooksAdminClient";
import styles from "../seminar-magazines/seminarMagazineAdmin.module.css";
export const dynamic="force-dynamic";
export default function Page(){return <main className={styles.page}><div style={{maxWidth:1180,margin:"0 auto 12px"}}><Link href="/admin">← 管理画面トップへ</Link></div><IchikaBooksAdminClient/></main>;}
