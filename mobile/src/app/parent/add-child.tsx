import { router } from "expo-router";
import { useState } from "react";
import { api } from "../../lib/api";
import { Button, Card, Chip, ErrorText, Field, Muted, Row, Screen } from "../../components/ui";
import { H3 } from "../../components/ui";

const AVATARS = ["🧒", "👧", "👦", "🧑‍🚀", "🦊", "🐱", "🐼", "🦄", "🤖", "🐉", "🦁", "🐧"];
const INTERESTS = ["Space", "Animals", "Games", "Art", "Dinosaurs", "Ocean", "Robots", "Music", "Sports", "Science", "Stories", "Volcanoes"];

export default function AddChild() {
  const [f, setF] = useState({ name: "", age: 9, avatar: "🧒", experience: "beginner", interests: [] as string[] });
  const [error, setError] = useState<unknown>(null);
  return (
    <Screen>
      <Card>
        <Field label="First name (or nickname)" value={f.name} onChangeText={(name) => setF({ ...f, name })} maxLength={40} />
        <H3>Age: {f.age}</H3>
        <Row>
          {Array.from({ length: 15 }, (_, i) => i + 4).map((a) => (
            <Chip key={a} label={String(a)} selected={f.age === a} tone="gray" onPress={() => setF({ ...f, age: a })} />
          ))}
        </Row>
        <H3>Avatar</H3>
        <Row>{AVATARS.map((a) => <Chip key={a} label={a} selected={f.avatar === a} tone="gray" onPress={() => setF({ ...f, avatar: a })} />)}</Row>
        <H3>Experience</H3>
        <Row>
          {(["beginner", "some", "experienced"] as const).map((x) => (
            <Chip key={x} label={x === "some" ? "Some experience" : x[0].toUpperCase() + x.slice(1)} selected={f.experience === x} tone="gray" onPress={() => setF({ ...f, experience: x })} />
          ))}
        </Row>
        <H3>Interests</H3>
        <Row>
          {INTERESTS.map((i) => (
            <Chip key={i} label={i} tone="gray" selected={f.interests.includes(i)} onPress={() => setF({ ...f, interests: f.interests.includes(i) ? f.interests.filter((x) => x !== i) : [...f.interests, i] })} />
          ))}
        </Row>
        <Muted>Age changes how SparkForge explains things and sets safer defaults for younger kids — it never blocks a child from trying advanced projects.</Muted>
        <ErrorText error={error} />
        <Button
          size="lg"
          title="Add child"
          disabled={!f.name.trim()}
          onPress={async () => {
            try {
              await api.post("/parent/children", f);
              router.back();
            } catch (e) {
              setError(e);
            }
          }}
        />
      </Card>
    </Screen>
  );
}
