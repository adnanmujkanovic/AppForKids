import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { api, errorText } from "../../lib/api";
import { useRewards, type Rewards } from "../../components/Rewards";
import { Button, C, Card, Field, H3, Muted, Note, P, Screen } from "../../components/ui";

export default function Detective() {
  const showRewards = useRewards();
  const [topic, setTopic] = useState("");
  const [c, setC] = useState<{ id: string; topic: string; statements: string[] } | null>(null);
  const [answer, setAnswer] = useState<{ picked: number; correct: boolean; wrong: number; correction: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Screen>
      <Card tint="sun"><P>AI can sound confident and still be wrong. One of these three statements has a mistake hiding in it. Can you find it?</P></Card>
      <Card>
        <Field value={topic} onChangeText={setTopic} placeholder="Topic (e.g. Mars, dinosaurs, oceans)" />
        <Button title={busy ? "…" : c ? "New case" : "Open a case"} disabled={busy} onPress={async () => {
          setBusy(true);
          setErr(null);
          setAnswer(null);
          try {
            setC(await api.post("/kid/detective", { topic }));
          } catch (e) {
            setErr(errorText(e));
          } finally {
            setBusy(false);
          }
        }} />
        {err ? <Note>{err}</Note> : null}
      </Card>
      {c ? (
        <Card>
          <H3>Case file: {c.topic}</H3>
          {c.statements.map((st, i) => {
            const wrong = answer && i === answer.wrong;
            return (
              <Pressable
                key={i}
                accessibilityRole="button"
                disabled={!!answer}
                onPress={async () => {
                  const r = await api.post<{ correct: boolean; wrong: number; correction: string; rewards: Rewards }>(`/kid/detective/${c.id}/answer`, { index: i });
                  setAnswer({ picked: i, ...r });
                  showRewards(r.rewards);
                }}
                style={{ flexDirection: "row", gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: wrong ? C.coralSoft : answer && i === answer.picked ? C.sunSoft : "#fff" }}
              >
                <Text style={{ fontSize: 20 }}>{wrong ? "🚨" : answer ? "✅" : "🔎"}</Text>
                <Text style={{ flex: 1, fontWeight: "700" }}>{st}</Text>
              </Pressable>
            );
          })}
          {answer ? (
            <View style={{ backgroundColor: answer.correct ? C.mintSoft : C.sunSoft, borderRadius: 14, padding: 12, gap: 4 }}>
              <Text style={{ fontWeight: "900" }}>{answer.correct ? "🎉 You caught the mistake!" : "Not quite — the mistake was the red one."}</Text>
              <P>{answer.correction}</P>
            </View>
          ) : null}
          <Muted>Detective tip: when something surprises you, check it with a trusted source.</Muted>
        </Card>
      ) : null}
    </Screen>
  );
}
