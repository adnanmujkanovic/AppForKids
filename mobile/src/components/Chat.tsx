// A conversation with Spark, the AI mentor. Used by Explore, Learn and project help.
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, errorText } from "../lib/api";
import { useRewards, type Rewards } from "./Rewards";
import { Button, C, Certainty, Chip, Muted, Note, Row, s } from "./ui";

interface Meta {
  topic?: string;
  certainty?: "sure" | "mostly" | "unsure";
  checkTip?: string;
  followUp?: string;
  suggestions?: string[];
  sources?: string[];
  note?: string;
  privacyTip?: string | null;
  safety?: boolean;
}
interface Msg {
  role: "user" | "assistant";
  content: string;
  meta?: Meta | null;
}

const ACTIONS: Record<string, string> = {
  learn_more: "🔍 Learn more",
  picture: "🎨 Make a picture",
  quiz: "❓ Quiz me",
  game: "🎮 Make a game",
  app: "📱 Build an app",
  story: "📖 Write a story",
  mission: "🚀 Start a mission",
};

export function Chat({ thread, placeholder, initial, allowImage, empty }: { thread: string; placeholder: string; initial?: string; allowImage?: boolean; empty?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const showRewards = useRewards();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [image, setImage] = useState<{ mediaType: string; data: string } | null>(null);
  const scroll = useRef<ScrollView>(null);
  const sentInitial = useRef(false);

  useEffect(() => {
    api.get<Msg[]>(`/kid/chat/${thread}`).then((m) => {
      setMsgs(m);
      if (initial && !sentInitial.current) {
        sentInitial.current = true;
        send(initial);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread]);

  async function send(message: string) {
    if ((!message.trim() && !image) || busy) return;
    setBusy(true);
    setError(null);
    setMsgs((m) => [...m, { role: "user", content: image ? `📷 ${message}` : message }]);
    setText("");
    const img = image;
    setImage(null);
    try {
      const r = await api.post<{ message: Msg; rewards: Rewards | null }>("/kid/chat", { thread, message, ...(img ? { image: img } : {}) });
      setMsgs((m) => [...m, r.message]);
      showRewards(r.rewards);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const act = (action: string, topic: string, context: string) => {
    const t = topic || "this";
    switch (action) {
      case "learn_more":
        return send(`Tell me more about ${t}!`);
      case "picture":
        return router.push({ pathname: "/kid/create", params: { type: "image", prompt: `Me exploring ${t}` } });
      case "story":
        return router.push({ pathname: "/kid/create", params: { type: "story", prompt: `A story about ${t}` } });
      case "game":
        return router.push({ pathname: "/kid/build", params: { idea: `A game about ${t}`, notes: context.slice(0, 500) } });
      case "quiz":
        return router.push({ pathname: "/kid/build", params: { idea: `A ${t} quiz`, kind: "quiz", notes: context.slice(0, 500) } });
      case "app":
        return router.push({ pathname: "/kid/apps", params: { idea: `An app about ${t}` } });
      case "mission":
        return router.push("/kid/missions");
    }
  };

  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], base64: true, quality: 0.6 });
    const a = r.assets?.[0];
    if (!r.canceled && a?.base64) setImage({ mediaType: a.mimeType ?? "image/jpeg", data: a.base64 });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <ScrollView ref={scroll} contentContainerStyle={{ padding: 16, gap: 12 }} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
        {msgs.length === 0 && !busy ? empty : null}
        {msgs.map((m, i) =>
          m.role === "user" ? (
            <View key={i} style={{ alignSelf: "flex-end", maxWidth: "86%", backgroundColor: C.violet, borderRadius: 20, borderBottomRightRadius: 6, padding: 14 }}>
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>{m.content}</Text>
            </View>
          ) : (
            <View key={i} style={[s.card, { alignSelf: "flex-start", maxWidth: "92%", borderBottomLeftRadius: 6 }]}>
              <Text style={{ color: C.ink, fontWeight: "600", fontSize: 15, lineHeight: 22 }}>{m.content}</Text>
              {m.meta && !m.meta.safety ? (
                <>
                  <Row>
                    {m.meta.certainty ? <Certainty value={m.meta.certainty} /> : null}
                    {m.meta.checkTip ? <Chip tone="gray" label={`🔎 ${m.meta.checkTip}`} /> : null}
                  </Row>
                  {m.meta.sources?.length ? (
                    <Row>
                      <Muted style={{ fontSize: 12 }}>📚 Sources:</Muted>
                      {m.meta.sources.map((u) => (
                        <Chip key={u} tone="gray" label={u.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]} onPress={() => Linking.openURL(u)} />
                      ))}
                    </Row>
                  ) : null}
                  {m.meta.followUp ? <Text style={{ fontStyle: "italic", color: C.ink2 }}>💭 {m.meta.followUp}</Text> : null}
                  {i === msgs.length - 1 && m.meta.suggestions?.length ? (
                    <Row>
                      {m.meta.suggestions.filter((x) => ACTIONS[x]).map((x) => (
                        <Chip key={x} label={ACTIONS[x]} onPress={() => act(x, m.meta?.topic ?? "", m.content)} />
                      ))}
                    </Row>
                  ) : null}
                  <Note>{m.meta.privacyTip ?? m.meta.note}</Note>
                </>
              ) : null}
            </View>
          ),
        )}
        {busy ? <ActivityIndicator color={C.violet} style={{ alignSelf: "flex-start", margin: 8 }} /> : null}
        {error ? <Note>{error}</Note> : null}
      </ScrollView>
      <View style={{ flexDirection: "row", gap: 8, padding: 10, paddingBottom: 10 + insets.bottom, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: C.line }}>
        {allowImage ? <Button size="sm" variant="ghost" title={image ? "📷✓" : "📷"} onPress={pick} /> : null}
        <TextInput
          style={[s.input, { flex: 1, borderWidth: 0, backgroundColor: C.bg }]}
          value={text}
          onChangeText={setText}
          placeholder={image ? "Add a question about your photo" : placeholder}
          placeholderTextColor={C.ink3}
          onSubmitEditing={() => send(text)}
          returnKeyType="send"
          maxLength={2000}
          accessibilityLabel="Message"
        />
        <Button title="Send" disabled={busy || (!text.trim() && !image)} onPress={() => send(text)} />
      </View>
    </KeyboardAvoidingView>
  );
}
