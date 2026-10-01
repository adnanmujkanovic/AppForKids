import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { loadHome } from "../../../lib/kid";
import { useLoad } from "../../../lib/useLoad";
import { useRewards, type Rewards } from "../../../components/Rewards";
import { Building, Button, Card, Chip, ErrorText, Field, Loading, Muted, Row, Screen } from "../../../components/ui";

export default function Create() {
  const params = useLocalSearchParams<{ type?: string; prompt?: string }>();
  const { data } = useLoad(loadHome);
  const showRewards = useRewards();
  const [type, setType] = useState<"image" | "story">(params.type === "story" ? "story" : "image");
  const [prompt, setPrompt] = useState(params.prompt ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    if (params.prompt) setPrompt(params.prompt);
    if (params.type === "story" || params.type === "image") setType(params.type);
  }, [params.prompt, params.type]);
  if (!data) return <Loading />;
  if (busy) return <Building emoji={type === "image" ? "🎨" : "📖"} label={type === "image" ? "Making your picture…" : "Writing your story…"} />;
  const p = data.child.permissions;
  const allowed = type === "image" ? p.imageGeneration : p.storyCreation;
  const ideas =
    type === "image"
      ? ["Put me on Mars", "A futuristic Mars city", "A robot explorer in a cave", "A dragon reading books under the stars"]
      : ["A robot who is afraid of the dark", "A lion who wants to fly", "A tiny astronaut's first day on the Moon"];
  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ project: { id: string }; rewards: Rewards; note?: string }>(`/kid/create/${type}`, { prompt });
      showRewards(r.rewards);
      setPrompt("");
      router.push({ pathname: "/kid/project/[id]", params: { id: r.project.id, note: r.note ?? "" } });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <Row>
        <Chip label="🎨 Picture" selected={type === "image"} tone="gray" onPress={() => setType("image")} />
        <Chip label="📖 Story" selected={type === "story"} tone="gray" onPress={() => setType("story")} />
      </Row>
      {!allowed ? (
        <Card>
          <Muted>🔒 This is turned off in your family settings. Ask a parent if you'd like to try it!</Muted>
        </Card>
      ) : (
        <Card>
          <Field label={type === "image" ? "Describe your picture" : "What's your story about?"} value={prompt} onChangeText={setPrompt} placeholder={ideas[0]} multiline maxLength={type === "image" ? 300 : 400} />
          <Row>{ideas.map((i) => <Chip key={i} tone="gray" label={i} onPress={() => setPrompt(i)} />)}</Row>
          <Muted>💡 Tip: say who or what is in it, where it is, and how it should feel. {type === "image" ? "Say “me” to put yourself in the picture!" : ""}</Muted>
          <ErrorText error={error} />
          <Button size="lg" title={type === "image" ? "✨ Make my picture" : "✨ Write my story"} disabled={prompt.trim().length < 2} onPress={go} />
        </Card>
      )}
    </Screen>
  );
}
