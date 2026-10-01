import { router } from "expo-router";
import { useState } from "react";
import { api, errorText } from "../../lib/api";
import { useRewards, type Rewards } from "../../components/Rewards";
import { Building, Button, Card, Field, Muted, Note, P, Screen } from "../../components/ui";

export default function NewCode() {
  const showRewards = useRewards();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (busy) return <Building emoji="⌨️" label="Setting up your code…" />;
  return (
    <Screen>
      <Card tint="violet">
        <P>Write a game in real JavaScript — the language that runs the web. You'll start with a working game, then change the code and press ▶ Run.</P>
        <Muted>🔒 Your code runs in a sandbox: it can't use the internet or see anything personal.</Muted>
      </Card>
      <Card>
        <Field label="Name your project" value={title} onChangeText={setTitle} placeholder="Star Coder" maxLength={60} />
        <Button size="lg" title="Start coding →" onPress={async () => {
          setBusy(true);
          try {
            const r = await api.post<{ project: { id: string }; rewards: Rewards }>("/kid/code", { title });
            showRewards(r.rewards);
            router.replace({ pathname: "/kid/project/[id]", params: { id: r.project.id, tab: "build" } });
          } catch (e) {
            setErr(errorText(e));
            setBusy(false);
          }
        }} />
        <Muted>Tip: you can also open any game you built in Code Mode from its {"</>"} CODE tab.</Muted>
        <Note>{err}</Note>
      </Card>
    </Screen>
  );
}
