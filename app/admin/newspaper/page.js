import NewspaperAdminClient from "./NewspaperAdminClient";
import NewspaperPromptAssistant from "./NewspaperPromptAssistant";
import StreamlitCompatPanel from "./StreamlitCompatPanel";

export const metadata = {
  title: "新聞作成 | BoatStrikers CMS",
};

export default function NewspaperAdminPage() {
  return (
    <>
      <NewspaperAdminClient />
      <NewspaperPromptAssistant />
      <StreamlitCompatPanel />
    </>
  );
}
