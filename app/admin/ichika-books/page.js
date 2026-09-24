import IchikaBooksAdminClient from "./IchikaBooksAdminClient";
import styles from "../seminar-magazines/seminarMagazineAdmin.module.css";
export const dynamic="force-dynamic";
export default function Page(){return <main className={styles.page}><IchikaBooksAdminClient/></main>;}
