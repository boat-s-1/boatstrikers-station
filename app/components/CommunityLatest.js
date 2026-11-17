import Link from 'next/link';
import { loadPublicCommunityThreads } from '../../lib/community/publicServer';

// Public-only feed. Never fetch member or paid content into an anonymous page.
export default async function CommunityLatest({ characterKey = null, heading = '公式掲示板の最新投稿' }) {
  const { threads } = await loadPublicCommunityThreads({ characterKey, limit: 3 });
  return <section aria-label={heading} style={{maxWidth:960,margin:'24px auto',padding:'20px',border:'1px solid #9994',borderRadius:16}}>
    <h2 style={{margin:'0 0 12px'}}>{heading}</h2>
    {threads.length ? <ul style={{margin:'0 0 14px',paddingLeft:20}}>
      {threads.map(thread => <li key={thread.id} style={{marginBottom:10}}>
        <Link href={`/community/t/${encodeURIComponent(thread.slug)}`}>{thread.title}</Link>
      </li>)}
    </ul> : <p>公式掲示板は準備中です。</p>}
    <Link href={characterKey ? `/community/${characterKey}` : '/community'}>掲示板を見る</Link>
  </section>;
}
