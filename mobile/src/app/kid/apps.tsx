import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { api } from "../../lib/api";
import { useRewards, type Rewards } from "../../components/Rewards";
import { Building, Button, Card, Chip, ErrorText, Field, H2, Muted, Note, Row, Screen } from "../../components/ui";

interface Plan { title: string; emoji: string; pieces: { name: string; why: string; emoji: string }[]; question: string }

export default function MakeApp() {
  const params = useLocalSearchParams<{ idea?: string }>();
  const showRewards = useRewards();
  const [idea, setIdea] = useState(params.idea ?? "");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [note, setNote] = useState<string | null>(null);
  if (busy) return <Building emoji="🛠️" label={busy} />;
  return (
    <Screen>
      {!plan ? (
        <Card>
          <Field label="What app do you want to build?" value={idea} onChangeText={setIdea} placeholder="An app about African animals" maxLength={300} />
          <Row>
            {["An app about African animals", "A solar system explorer", "A Mars explorer with an AI guide", "A dinosaur encyclopedia"].map((i) => (
              <Chip key={i} tone="gray" label={i} onPress={() => setIdea(i)} />
            ))}
          </Row>
          <ErrorText error={error} />
          <Button size="lg" title="Plan it with AI →" disabled={idea.trim().length < 2} onPress={async () => {
            setBusy("Planning your app…");
            setError(null);
            try {
              const r = await api.post<{ plan: Plan; note?: string }>("/kid/apps/plan", { idea });
              setPlan(r.plan);
              setNote(r.note ?? null);
            } catch (e) {
              setError(e);
            } finally {
              setBusy(null);
            }
          }} />
        </Card>
      ) : (
        <Card>
          <H2>{plan.emoji} {plan.title}</H2>
          <Muted>Engineers plan before they build. Here's what our app needs:</Muted>
          {plan.pieces.map((pc, i) => (
            <Row key={i} wrap={false} style={{ justifyContent: "space-between" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "900" }}>{pc.emoji} {pc.name}</Text>
                <Muted>{pc.why}</Muted>
              </View>
              <Button size="sm" variant="danger" title="✕" onPress={() => setPlan({ ...plan, pieces: plan.pieces.filter((_, j) => j !== i) })} />
            </Row>
          ))}
          <Field placeholder="Add your own piece (e.g. Quiz screen)" value={extra} onChangeText={setExtra} />
          <Button size="sm" variant="ghost" title="+ Add piece" disabled={!extra.trim()} onPress={() => { setPlan({ ...plan, pieces: [...plan.pieces, { name: extra.trim(), why: "My idea!", emoji: "💡" }] }); setExtra(""); }} />
          <Muted>💬 {plan.question}</Muted>
          <Note>{note}</Note>
          <ErrorText error={error} />
          <Button size="lg" title="✅ Looks good — build it!" disabled={!plan.pieces.length} onPress={async () => {
            setBusy("Building your app…");
            setError(null);
            try {
              const r = await api.post<{ project: { id: string }; rewards: Rewards; note?: string }>("/kid/apps", { idea, plan });
              showRewards(r.rewards);
              router.replace({ pathname: "/kid/project/[id]", params: { id: r.project.id, tab: "play", note: r.note ?? "" } });
            } catch (e) {
              setError(e);
              setBusy(null);
            }
          }} />
          <Button variant="ghost" title="← Change idea" onPress={() => setPlan(null)} />
        </Card>
      )}
    </Screen>
  );
}
