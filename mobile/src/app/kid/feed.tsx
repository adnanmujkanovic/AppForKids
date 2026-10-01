import { router } from "expo-router";
import { Text } from "react-native";
import { api } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { Button, Card, ErrorText, Loading, Muted, P, Row, Screen, TYPE_INFO, timeAgo } from "../../components/ui";

interface FeedItem { token: string; title: string; emoji: string; type: string; description: string; creator: string; createdAt: string }

export default function Feed() {
  const { data, error } = useLoad(() => api.get<FeedItem[]>("/kid/feed"));
  if (error) return <Screen><ErrorText error={error} /></Screen>;
  if (!data) return <Loading />;
  return (
    <Screen>
      <Muted>Things other kids made and published. Newest first — no likes, no rankings, just creations.</Muted>
      {data.length === 0 ? <Card><P>Nothing published yet. Be the first!</P></Card> : null}
      {data.map((f) => (
        <Card key={f.token}>
          <Text style={{ fontSize: 34 }}>{f.emoji}</Text>
          <Text style={{ fontWeight: "900", fontSize: 17 }}>{f.title}</Text>
          <Muted>{TYPE_INFO[f.type]?.emoji} by {f.creator} · {timeAgo(f.createdAt)}</Muted>
          {f.description ? <P>{f.description}</P> : null}
          <Row>
            <Button size="sm" title="▶ Play" onPress={() => router.push({ pathname: "/s/[token]", params: { token: f.token } })} />
            <Button size="sm" variant="ghost" title="✨ Make my own" onPress={() => router.push({ pathname: "/kid/build", params: { idea: `My own version of ${f.title}` } })} />
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
