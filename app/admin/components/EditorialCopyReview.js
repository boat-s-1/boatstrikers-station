import { reviewFreeTextFields } from '../../../lib/editorial/reviewGeneratedCopy.mjs';

// Pure, transient presentation. Never rewrites text or changes publication status.
export default function EditorialCopyReview({ fields }) {
  const reviews = reviewFreeTextFields(fields);
  if (!reviews.length) return null;
  return <aside aria-label="生成文の表現確認" style={{ padding: 12, margin: '12px 0', border: '1px solid #b57920', borderRadius: 8, background: '#fff8eb', color: '#553300', fontSize: 14, lineHeight: 1.7 }}>
    <strong>公開・コピー前に文脈を確認してください</strong>
    <p>原典の引用・教育・統計として適切な表現は保持してください。本文は自動変更していません。</p>
    <ul>{reviews.map(item => <li key={item.field}><b>{item.field}</b>：{item.findings.map(f => f.match ? `「${f.match}」の文脈確認` : '呼称・配当・断定表現の文脈確認').join('、')}</li>)}</ul>
  </aside>;
}
