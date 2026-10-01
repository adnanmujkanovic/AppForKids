// Celebrations for meaningful achievements: medals, new concepts and level-ups.
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Modal, Text, View } from "react-native";
import { Button, Chip, H2, Muted } from "./ui";

export interface Rewards {
  medals: { id: string; emoji: string; title: string; about: string; hidden?: boolean }[];
  concepts: { name: string; emoji: string; text: string }[];
  levelUp: { id: string; emoji: string; label: string } | null;
}

interface Item {
  badge: string;
  emoji: string;
  title: string;
  text: string;
}

const Ctx = createContext<(r: Rewards | null | undefined) => void>(() => {});
export const useRewards = () => useContext(Ctx);

export function RewardsProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Item[]>([]);
  const show = useCallback((r: Rewards | null | undefined) => {
    if (!r) return;
    const items: Item[] = [
      ...r.medals.map((m) => ({ badge: m.hidden ? "🎁 Surprise medal!" : "🏅 New medal!", emoji: m.emoji, title: m.title, text: m.about })),
      ...(r.levelUp ? [{ badge: "⬆️ Level up!", emoji: r.levelUp.emoji, title: r.levelUp.label, text: "You reached a new creator level!" }] : []),
      ...r.concepts.slice(0, 2).map((c) => ({ badge: "💡 New concept", emoji: c.emoji, title: c.name, text: c.text })),
    ];
    if (items.length) setQueue((q) => [...q, ...items]);
  }, []);
  const cur = queue[0];
  return (
    <Ctx.Provider value={show}>
      {children}
      <Modal visible={!!cur} transparent animationType="fade" onRequestClose={() => setQueue((q) => q.slice(1))}>
        <View style={{ flex: 1, backgroundColor: "rgba(15,12,40,0.55)", justifyContent: "center", padding: 24 }}>
          {cur && (
            <View style={{ backgroundColor: "#fff", borderRadius: 28, padding: 24, alignItems: "center", gap: 10 }}>
              <Chip tone="sun" label={cur.badge} />
              <Text style={{ fontSize: 72 }}>{cur.emoji}</Text>
              <H2 style={{ textAlign: "center" }}>{cur.title}</H2>
              <Muted style={{ textAlign: "center" }}>{cur.text}</Muted>
              <Button size="lg" title={queue.length > 1 ? "Next ✨" : "Awesome!"} onPress={() => setQueue((q) => q.slice(1))} style={{ alignSelf: "stretch" }} />
            </View>
          )}
        </View>
      </Modal>
    </Ctx.Provider>
  );
}

