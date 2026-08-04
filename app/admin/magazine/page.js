import MagazineAdminClient from './MagazineAdminClient';
import styles from './magazineAdmin.module.css';

export const dynamic = 'force-dynamic';

export default function MagazineAdminPage(){
  return <main className={styles.page}><MagazineAdminClient/></main>;
}
