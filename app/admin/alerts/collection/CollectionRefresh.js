'use client';
import { useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../alerts.module.css';

export default function CollectionRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden && !pending) startTransition(() => router.refresh());
    }, 30000);
    return () => clearInterval(timer);
  }, [router, pending]);
  return <button type="button" className={styles.button} disabled={pending} onClick={() => startTransition(() => router.refresh())}>
    {pending ? '読み込み中…' : '今すぐ再読込'}
  </button>;
}
