'use client';
import { usePathname } from 'next/navigation';
import { showResponsibleFooter } from '../../lib/editorial/noticeRoutes.mjs';
import ResponsiblePlayNotice from './ResponsiblePlayNotice';
import styles from './ResponsiblePlayNotice.module.css';
export default function PublicResponsibleFooter() {
  const path = usePathname() || '/';
  return showResponsibleFooter(path) ? <div className={styles.footer}><ResponsiblePlayNotice variant="full" /></div> : null;
}
