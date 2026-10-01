import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import type { ProjectSummary } from "../../../shared/types";
import { C, s, TYPE_INFO, timeAgo } from "./ui";

export function ProjectList({ projects }: { projects: ProjectSummary[] }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {projects.map((p) => (
        <Pressable
          key={p.id}
          accessibilityRole="button"
          accessibilityLabel={p.title}
          onPress={() => router.push({ pathname: "/kid/project/[id]", params: { id: p.id } })}
          style={({ pressed }) => [s.tile, pressed ? { transform: [{ scale: 0.98 }] } : null]}
        >
          <Text style={{ fontSize: 32 }}>{p.emoji}</Text>
          <Text style={{ fontWeight: "900", fontSize: 15, color: C.ink }} numberOfLines={2}>{p.title}</Text>
          <Text style={{ color: C.ink2, fontSize: 12, fontWeight: "600" }}>
            {TYPE_INFO[p.type]?.emoji} {TYPE_INFO[p.type]?.label} · v{p.version} · {timeAgo(p.updatedAt)}
            {p.remixedFrom ? " · 🔄" : ""}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
