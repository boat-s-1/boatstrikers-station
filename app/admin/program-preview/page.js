import { notFound } from "next/navigation";
import { isAdminAuthenticated } from "../sync/_lib/adminAuth";
import { loadPrivateProgram } from "../../../scripts/cloud-sync-offline/site-private-program-gate.mjs";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false } };

// This route deliberately contains no BRDB data or network/database reads.
// An actual feed must be gated on the server before any private data is fetched.
const demoEntries = Array.from({ length: 6 }, (_, index) => ({
  boat: index + 1,
  registration: String(9001 + index),
  name: `検証用選手${index + 1}`,
}));

export default async function PrivateProgramPreviewPage() {
  const privateProgram = await loadPrivateProgram({
    enabled: process.env.BS_ADMIN_PROGRAM_PREVIEW_ENABLED === "true",
    authenticate: isAdminAuthenticated,
    load: () => demoEntries,
  });
  if (!privateProgram.allowed) notFound();

  return (
    <main style={{ maxWidth: 780, margin: "2rem auto", padding: "1rem", fontFamily: "sans-serif" }}>
      <h1>管理者限定・出走表表示検証</h1>
      <p>模擬データです。実レース・実選手・BRDB-APIの情報は含みません。</p>
      <p>取得元：模擬入力 ／ 公開状態：非公開検証 ／ 展示：未取得</p>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <caption>検証用1R（実開催ではありません）</caption>
        <thead><tr><th scope="col">艇番</th><th scope="col">登録番号</th><th scope="col">選手</th><th scope="col">展示タイム</th></tr></thead>
        <tbody>{privateProgram.data.map((entry) => (
          <tr key={entry.boat}>
            <th scope="row">{entry.boat}</th>
            <td>{entry.registration}</td>
            <td>{entry.name}</td>
            <td>未取得</td>
          </tr>
        ))}</tbody>
      </table>
    </main>
  );
}
