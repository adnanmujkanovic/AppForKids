import { useLocalSearchParams } from "expo-router";
import { Chat } from "../../../components/Chat";
import { Card, H3, Muted, P } from "../../../components/ui";

export default function Explore() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  return (
    <Chat
      thread="explore"
      initial={q}
      placeholder="Ask me anything…"
      empty={
        <Card tint="violet">
          <H3>👋 I'm Spark, your AI mentor.</H3>
          <P>Ask me about anything you wonder about. After we explore, we can turn it into a picture, a game or an app!</P>
          <Muted>I'm an AI, so I can make mistakes. For important facts, double-check with a grown-up or a trusted website.</Muted>
        </Card>
      }
    />
  );
}
