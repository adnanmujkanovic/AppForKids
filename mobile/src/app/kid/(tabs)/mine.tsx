import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { api } from "../../../lib/api";
import { useLoad } from "../../../lib/useLoad";
import { ProjectList } from "../../../components/ProjectList";
import { Button, Card, Chip, ErrorText, H3, Loading, Row, Screen } from "../../../components/ui";
import type { ProjectSummary, ProjectType } from "../../../../../shared/types";

export default function Mine() {
  const { data, error, reload } = useLoad(() => api.get<ProjectSummary[]>("/kid/projects"));
  useFocusEffect(useCallback(() => void reload(), [reload]));
  const [filter, setFilter] = useState<ProjectType | "all">("all");
  if (!data) return error ? <Screen><ErrorText error={error} /></Screen> : <Loading />;
  const shown = data.filter((p) => filter === "all" || p.type === filter);
  return (
    <Screen>
      <Row>
        {(["all", "game", "app", "image", "story", "code"] as const).map((f) => (
          <Chip key={f} tone="gray" selected={filter === f} onPress={() => setFilter(f)} label={{ all: "Everything", game: "🎮 Games", app: "📱 Apps", image: "🎨 Pictures", story: "📖 Stories", code: "⌨️ Code" }[f]} />
        ))}
      </Row>
      {shown.length ? (
        <ProjectList projects={shown} />
      ) : (
        <Card style={{ alignItems: "center" }}>
          <H3>✨ Nothing here yet</H3>
          <Button title="🎨 Make a picture" onPress={() => router.push("/kid/create")} />
          <Button variant="coral" title="🎮 Build a game" onPress={() => router.push("/kid/build")} />
        </Card>
      )}
    </Screen>
  );
}
