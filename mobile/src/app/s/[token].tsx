// A shared creation: play it, see what the creator learned, react (friends) or remix.
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Text } from "react-native";
import { api, errorText } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { useSession } from "../../lib/session";
import { AppView } from "../../components/AppView";
import { CodeView, GameView } from "../../components/GameView";
import { SceneView } from "../../components/SceneView";
import { StoryView } from "../../components/StoryView";
import { Button, Card, Chip, ErrorText, H1, H3, Loading, Muted, Note, Row, Screen, TYPE_INFO } from "../../components/ui";
import type { GameSpec } from "../../../../shared/game";
import type { AppSpec } from "../../../../shared/app";
import type { CodeSpec, SceneSpec, StorySpec } from "../../../../shared/creations";

interface Shared {
  token: string; type: "game" | "app" | "image" | "story" | "code"; title: string; emoji: string; idea: string; description: string; spec: unknown;
  creator: string; learned: string[]; aiHelped: string[]; changed: string[]; allowRemix: boolean; preview?: boolean;
}
interface Social { emojis: string[]; comments: string[]; canReact: boolean; canComment: boolean; mine: { kind: string; value: string }[]; options: { emojis: string[]; comments: string[] } }

export default function SharedCreation() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { me } = useSession();
  const { data, error } = useLoad(() => api.get<Shared>(`/share/${token}`), [token]);
  const { data: social, reload } = useLoad(() => api.get<Social>(`/share/${token}/social`), [token]);
  const [msg, setMsg] = useState<string | null>(null);
  const counted = useRef(false);
  useEffect(() => {
    if (data && !data.preview && !counted.current) {
      counted.current = true;
      api.post(`/share/${data.token}/played`).catch(() => {});
    }
  }, [data]);
  if (error) return <Screen><ErrorText error={error} /></Screen>;
  if (!data) return <Loading />;
  const mine = new Set(social?.mine.map((m) => `${m.kind}:${m.value}`));
  const react = async (kind: string, value: string) => {
    try {
      await api.post(`/kid/react/${data.token}`, { kind, value });
      reload();
    } catch (e) {
      setMsg(errorText(e));
    }
  };
  return (
    <Screen>
      <Stack.Screen options={{ title: data.title }} />
      <Chip tone="gray" label={`${TYPE_INFO[data.type].emoji} ${TYPE_INFO[data.type].label}${data.preview ? " · parent preview" : ""}`} />
      <H1>{data.emoji} {data.title}</H1>
      <Muted>Made by {data.creator} with SparkForge</Muted>
      {data.type === "game" ? <GameView spec={data.spec as GameSpec} /> : null}
      {data.type === "code" ? <CodeView spec={data.spec as CodeSpec} runId={0} /> : null}
      {data.type === "app" ? <AppView spec={data.spec as AppSpec} /> : null}
      {data.type === "image" ? <Card style={{ padding: 10 }}><SceneView scene={data.spec as SceneSpec} /></Card> : null}
      {data.type === "story" ? <StoryView story={data.spec as StorySpec} /> : null}
      {social && (social.emojis.length || social.comments.length || social.canReact || social.canComment) ? (
        <Card>
          <H3>💬 Friends say</H3>
          <Row>
            {social.emojis.map((e) => <Chip key={e} tone="sun" label={e} />)}
            {social.comments.map((c) => <Chip key={c} tone="sky" label={c} />)}
          </Row>
          {social.canReact ? <Row>{social.options.emojis.map((e) => <Chip key={e} tone="gray" selected={mine.has(`emoji:${e}`)} label={e} onPress={() => react("emoji", e)} />)}</Row> : null}
          {social.canComment ? <Row>{social.options.comments.map((c) => <Chip key={c} tone="gray" selected={mine.has(`comment:${c}`)} label={c} onPress={() => react("comment", c)} />)}</Row> : null}
        </Card>
      ) : null}
      <Card><H3>What is it?</H3><Text>{data.description || data.idea}</Text></Card>
      {data.learned.length ? <Card><H3>💡 What I learned</H3><Row>{data.learned.map((l) => <Chip key={l} tone="sky" label={l} />)}</Row></Card> : null}
      {data.aiHelped.length ? <Card><H3>🤖 AI helped me</H3>{data.aiHelped.map((l, i) => <Text key={i}>• {l}</Text>)}</Card> : null}
      {data.allowRemix && me?.role === "child" ? (
        <Button size="lg" variant="coral" title="🔄 Remix it — make my own version" onPress={async () => {
          try {
            const r = await api.post<{ project: { id: string } }>(`/kid/remix/${data.token}`);
            router.replace({ pathname: "/kid/project/[id]", params: { id: r.project.id, tab: "build" } });
          } catch (e) {
            setMsg(errorText(e));
          }
        }} />
      ) : null}
      <Note>{msg}</Note>
    </Screen>
  );
}
