import { notFound } from 'next/navigation';
// Deliberately not linked from public navigation. Even if guessed, no admin
// form is rendered until a trusted server-side operator auth check exists.
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
export default function CommunityAdminPage() { notFound(); }
