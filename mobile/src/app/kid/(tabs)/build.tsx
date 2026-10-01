import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { api } from "../../../lib/api";
import { useRewards, type Rewards } from "../../../components/Rewards";
import { Building, Button, C, Card, Chip, ErrorText, Field, H2, Muted, Row, Screen, s } from "../../../components/ui";
import { GAME_KIND_INFO, GAME_KINDS, type GameKind } from "../../../../../shared/game";

const KIND_TEXT: Record<GameKind, string> = {
  catcher: "Collect things (catch what falls, dodge dangers)",
  explorer: "Explore (move around and find treasures)",
  quiz: "Answer questions",
};

export default function BuildGame() {
  const params = useLocalSearchParams<{ idea?: string; kind?: string; notes?: string }>();
  const showRewards = useRewards();
  const [idea, setIdea] = useState(params.idea ?? "");
  const [step, setStep] = useState<"idea" | "kind">(params.idea ? "kind" : "idea");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    if (params.idea) {
      setIdea(params.idea);
      setStep("kind");
    }
  }, [params.idea]);
  const build = async (kind: GameKind) => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ project: { id: string }; rewards: Rewards; note?: string }>("/kid/games", { idea, kind, topicNotes: params.notes ?? "" });
      showRewards(r.rewards);
      setStep("idea");
      setIdea("");
      router.push({ pathname: "/kid/project/[id]", params: { id: r.project.id, tab: "play", note: r.note ?? "" } });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  if (busy) return <Building emoji="🎮" label="Building your game…" />;
  return (
    <Screen>
      {step === "idea" ? (
        <Card>
          <Field label="What's your game about?" value={idea} onChangeText={setIdea} placeholder="A game about Mars" maxLength={300} />
          <Row>
            {["A game about Mars", "Catch falling stars", "Dinosaur egg hunt", "Ocean treasure dive", "Robot factory"].map((i) => (
              <Chip key={i} tone="gray" label={i} onPress={() => setIdea(i)} />
            ))}
          </Row>
          <Button size="lg" title="Next →" disabled={idea.trim().length < 2} onPress={() => setStep("kind")} />
        </Card>
      ) : (
        <Card>
          <Muted>“{idea}”</Muted>
          <H2>What should the player do?</H2>
          {(params.kind && GAME_KINDS.includes(params.kind as GameKind) ? [params.kind as GameKind] : GAME_KINDS).map((k) => (
            <Pressable key={k} accessibilityRole="button" accessibilityLabel={GAME_KIND_INFO[k].label} onPress={() => build(k)} style={({ pressed }) => [s.toggle, pressed ? { borderColor: C.violet } : null]}>
              <Text style={{ fontSize: 32 }}>{GAME_KIND_INFO[k].emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "900", fontSize: 16 }}>{GAME_KIND_INFO[k].label}</Text>
                <Muted>{KIND_TEXT[k]}</Muted>
              </View>
            </Pressable>
          ))}
          <Button variant="ghost" title="← Change idea" onPress={() => setStep("idea")} />
          <ErrorText error={error} />
        </Card>
      )}
    </Screen>
  );
}
