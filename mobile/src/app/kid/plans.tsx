import { useState } from "react";
import { TextInput, View } from "react-native";
import { api, errorText } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { Button, C, Card, Chip, Field, Muted, Note, Row, Screen, s } from "../../components/ui";

interface Plan { id: string; title: string; steps: { text: string; when: string; done: boolean }[]; tip?: string }

export default function Planner() {
  const { data, reload, setData } = useLoad(() => api.get<Plan[]>("/kid/plans"));
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const save = async (p: Plan) => {
    setData((data ?? []).map((x) => (x.id === p.id ? p : x)));
    try {
      await api.put(`/kid/plans/${p.id}`, { title: p.title, steps: p.steps });
    } catch (e) {
      setMsg(errorText(e));
      reload();
    }
  };
  return (
    <Screen>
      <Muted>Turn a big thing into small steps. AI suggests a plan — you're the boss of it.</Muted>
      <Card>
        <Field value={goal} onChangeText={setGoal} placeholder="Get ready for my science test on Friday" />
        <Button title={busy ? "…" : "Make a plan"} disabled={busy || goal.trim().length < 3} onPress={async () => {
          setBusy(true);
          setMsg(null);
          try {
            const r = await api.post<{ plan: Plan }>("/kid/plans", { goal });
            setMsg(r.plan.tip ?? null);
            setGoal("");
            await reload();
          } catch (e) {
            setMsg(errorText(e));
          } finally {
            setBusy(false);
          }
        }} />
      </Card>
      <Note>{msg}</Note>
      {data?.map((p) => {
        const done = p.steps.filter((x) => x.done).length;
        return (
          <Card key={p.id}>
            <Row wrap={false}>
              <TextInput style={[s.input, { flex: 1, fontWeight: "900" }]} value={p.title} onChangeText={(title) => setData(data.map((x) => (x.id === p.id ? { ...x, title } : x)))} onBlur={() => save(p)} />
              <Chip tone="mint" label={`${done}/${p.steps.length}`} />
            </Row>
            <View style={{ height: 8, backgroundColor: C.line, borderRadius: 4, overflow: "hidden" }}>
              <View style={{ width: `${p.steps.length ? (done / p.steps.length) * 100 : 0}%`, height: "100%", backgroundColor: C.violet }} />
            </View>
            {p.steps.map((x, i) => (
              <Row key={i} wrap={false}>
                <Chip tone="gray" selected={x.done} label={x.done ? "✓" : "○"} onPress={() => save({ ...p, steps: p.steps.map((y, j) => (j === i ? { ...y, done: !y.done } : y)) })} />
                <TextInput
                  style={[s.input, { flex: 1, paddingVertical: 8, textDecorationLine: x.done ? "line-through" : "none" }]}
                  value={x.text}
                  onChangeText={(text) => setData(data.map((pl) => (pl.id === p.id ? { ...pl, steps: pl.steps.map((y, j) => (j === i ? { ...y, text } : y)) } : pl)))}
                  onBlur={() => save(data.find((pl) => pl.id === p.id)!)}
                />
                {x.when ? <Chip tone="gray" label={x.when} /> : null}
              </Row>
            ))}
            <Row>
              <Button size="sm" variant="ghost" title="+ Step" onPress={() => save({ ...p, steps: [...p.steps, { text: "New step", when: "", done: false }] })} />
              <Button size="sm" variant="danger" title="Delete plan" onPress={async () => { await api.del(`/kid/plans/${p.id}`); reload(); }} />
            </Row>
          </Card>
        );
      })}
    </Screen>
  );
}
