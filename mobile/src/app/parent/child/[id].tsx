import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { api } from "../../../lib/api";
import { useLoad } from "../../../lib/useLoad";
import { Button, C, Card, Chip, ErrorText, Field, H2, H3, Loading, Muted, Note, Row, Screen, Toggle } from "../../../components/ui";
import { PERMISSION_INFO, type ChildProfile, type Permissions } from "../../../../../shared/types";

function FriendCodes({ childId, name }: { childId: string; name: string }) {
  const { data: friends, reload } = useLoad(() => api.get<{ id: string; name: string; avatar: string }[]>(`/parent/children/${childId}/friends`), [childId]);
  const [code, setCode] = useState<string | null>(null);
  const [enter, setEnter] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<unknown>(null);
  return (
    <Card>
      <H3>🤝 {name}'s friends</H3>
      <Muted>Friends are connected by parents only. Make a code and give it to the other child's parent — or enter the code they gave you. Codes work once, for 7 days.</Muted>
      {friends?.map((f) => (
        <Row key={f.id} style={{ justifyContent: "space-between" }}>
          <Text style={{ fontWeight: "800" }}>{f.avatar} {f.name}</Text>
          <Button size="sm" variant="danger" title="Remove" onPress={async () => { await api.del(`/parent/children/${childId}/friends/${f.id}`); reload(); }} />
        </Row>
      ))}
      <Button variant="ghost" title="Make a friend code" onPress={async () => {
        setErr(null);
        try {
          setCode((await api.post<{ code: string }>(`/parent/children/${childId}/friend-code`)).code);
        } catch (e) {
          setErr(e);
        }
      }} />
      {code ? <Text selectable style={{ fontSize: 22, fontWeight: "900", textAlign: "center", color: C.violet }}>{code}</Text> : null}
      <Field placeholder="Enter a friend code, e.g. STAR-1234-56" value={enter} onChangeText={setEnter} autoCapitalize="characters" />
      <Button title="Add friend" disabled={enter.length < 6} onPress={async () => {
        setErr(null);
        try {
          const r = await api.post<{ friend: { name: string } }>(`/parent/children/${childId}/friend-code/redeem`, { code: enter });
          setMsg(`🎉 ${name} and ${r.friend.name} are now friends.`);
          setEnter("");
          reload();
        } catch (e) {
          setErr(e);
        }
      }} />
      <Note>{msg}</Note>
      <ErrorText error={err} />
    </Card>
  );
}

export default function ChildSettings() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error } = useLoad(async () => (await api.get<{ children: ChildProfile[] }>("/parent/dashboard")).children.find((c) => c.id === id) ?? null, [id]);
  const [c, setC] = useState<ChildProfile | null>(null);
  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState<unknown>(null);
  useEffect(() => setC(data), [data]);
  if (!c) return error ? <Screen><ErrorText error={error} /></Screen> : <Loading />;
  const setPerm = (k: keyof Permissions, v: unknown) => {
    setSaved(false);
    setC({ ...c, permissions: { ...c.permissions, [k]: v } });
  };
  const groups = [...new Set(PERMISSION_INFO.map((p) => p.group))];
  const save = async () => {
    try {
      await api.patch(`/parent/children/${c.id}`, { name: c.name, age: c.age, experience: c.experience, interests: c.interests, permissions: c.permissions });
      setSaved(true);
      setSaveErr(null);
    } catch (e) {
      setSaveErr(e);
    }
  };
  return (
    <Screen>
      <Row>
        <Text style={{ fontSize: 40 }}>{c.avatar}</Text>
        <H2>{c.name}</H2>
      </Row>
      <Card>
        <Field label="Name" value={c.name} onChangeText={(name) => setC({ ...c, name })} />
        <H3>Age: {c.age}</H3>
        <Row>
          {Array.from({ length: 15 }, (_, i) => i + 4).map((a) => (
            <Chip key={a} label={String(a)} tone="gray" selected={c.age === a} onPress={() => setC({ ...c, age: a })} />
          ))}
        </Row>
        <Field label="Interests (comma separated)" value={c.interests.join(", ")} onChangeText={(v) => setC({ ...c, interests: v.split(",").map((x) => x.trim()).filter(Boolean) })} />
      </Card>
      <FriendCodes childId={c.id} name={c.name} />
      {groups.map((g) => (
        <Card key={g}>
          <H3>{g}</H3>
          {PERMISSION_INFO.filter((p) => p.group === g).map((p) => (
            <Toggle key={p.key} label={p.label} help={p.help} value={!!c.permissions[p.key]} onChange={(v) => setPerm(p.key, v)} disabled={p.future} />
          ))}
          {g === "Learn" ? (
            <View style={{ gap: 6 }}>
              <Text style={{ fontWeight: "800" }}>Homework help</Text>
              <Row>
                {([
                  ["teach", "Teach — no final answers"],
                  ["hints", "Hints only"],
                  ["answers", "Answers with reasoning"],
                ] as const).map(([k, l]) => (
                  <Chip key={k} label={l} tone="gray" selected={c.permissions.homeworkMode === k} onPress={() => setPerm("homeworkMode", k)} />
                ))}
              </Row>
            </View>
          ) : null}
          {g === "AI" ? (
            <View style={{ gap: 6 }}>
              <Text style={{ fontWeight: "800" }}>Daily AI requests: {c.permissions.dailyAiLimit}</Text>
              <Row>
                {[0, 30, 60, 120, 200, 300].map((n) => (
                  <Chip key={n} label={String(n)} tone="gray" selected={c.permissions.dailyAiLimit === n} onPress={() => setPerm("dailyAiLimit", n)} />
                ))}
              </Row>
            </View>
          ) : null}
        </Card>
      ))}
      <ErrorText error={saveErr} />
      {saved ? <Note>✅ Saved</Note> : null}
      <Button size="lg" title="Save settings" onPress={save} />
    </Screen>
  );
}
