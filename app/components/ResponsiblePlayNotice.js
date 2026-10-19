import { PURCHASE_AGE_NOTICE, PREDICTION_NOTICE, REGISTRATION_NOTICE, BUDGET_NOTICE } from '../../lib/editorial/copyPolicy.mjs';
import styles from './ResponsiblePlayNotice.module.css';

export default function ResponsiblePlayNotice({ variant = 'short', tone = 'neutral' }) {
  const full = variant === 'full';
  return <aside className={`${styles.notice} ${styles[tone] || ''}`} aria-label="舟券購入に関するご案内" data-responsible-notice={variant}>
    <strong>{full ? 'ボートレースを無理なく楽しむために' : PURCHASE_AGE_NOTICE}</strong>
    {full ? <><p>{PURCHASE_AGE_NOTICE}{BUDGET_NOTICE}</p><p>予想・データは的中や利益を保証するものではありません。</p></>
      : <p>{variant === 'registration' ? REGISTRATION_NOTICE : PREDICTION_NOTICE}</p>}
    {variant !== 'registration' ? <a href="/terms#terms-4">{full ? '利用上の注意・相談先 →' : '無理のない楽しみ方・相談先 →'}</a> : null}
  </aside>;
}
