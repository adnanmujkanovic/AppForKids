import { Linking, Text, View } from "react-native";
import { useState } from "react";
import { api } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { Button, C, Card, Chip, ErrorText, Field, H3, Muted, Row, Screen, timeAgo } from "../../components/ui";

interface Dash {
  contacts: { id: string; name: string; email: string }[];
  outbox: { id: string; childName: string; to: string; subject: string; body: string; status: string; createdAt: string }[];
}

export default function Connectors() {
  const { data, reload } = useLoad(() => api.get<Dash>("/parent/dashboard"));
  const { data: conn, reload: reloadConn } = useLoad(() => api.get<{ github: { account: string } | null; email: { smtp: boolean } }>("/parent/connectors"));
  const [contact, setContact] = useState({ name: "", email: "" });
  const [token, setToken] = useState("");
  const [err, setErr] = useState<unknown>(null);
  return (
    <Screen>
      <Card>
        <H3>✉️ Approved contacts</H3>
        <Muted>Kids can send share links only to these people (when “Send to approved contacts” is on).</Muted>
        {data?.contacts.map((c) => (
          <Row key={c.id} style={{ justifyContent: "space-between" }}>
            <Text style={{ fontWeight: "800", flex: 1 }}>{c.name} <Text style={{ color: C.ink3 }}>{c.email}</Text></Text>
            <Button size="sm" variant="danger" title="Remove" onPress={async () => { await api.del(`/parent/contacts/${c.id}`); reload(); }} />
          </Row>
        ))}
        <Field placeholder="Name (e.g. Dad)" value={contact.name} onChangeText={(name) => setContact({ ...contact, name })} />
        <Field placeholder="Email" value={contact.email} onChangeText={(email) => setContact({ ...contact, email })} autoCapitalize="none" keyboardType="email-address" />
        <Button title="Add contact" disabled={!contact.name || !contact.email} onPress={async () => {
          setErr(null);
          try {
            await api.post("/parent/contacts", contact);
            setContact({ name: "", email: "" });
            reload();
          } catch (e) {
            setErr(e);
          }
        }} />
      </Card>
      {data?.outbox.length ? (
        <Card>
          <H3>📤 Outbox</H3>
          <Muted>{conn?.email.smtp ? "Messages are emailed by the server." : "Email isn't set up on the server, so messages wait here for you to forward."}</Muted>
          {data.outbox.map((o) => (
            <View key={o.id} style={{ borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8, gap: 4 }}>
              <Row>
                <Text style={{ fontWeight: "900" }}>{o.childName} → {o.to}</Text>
                <Chip tone={o.status === "sent" ? "mint" : o.status === "failed" ? "coral" : "gray"} label={o.status === "kept" ? "to forward" : o.status} />
                <Muted>{timeAgo(o.createdAt)}</Muted>
              </Row>
              <Text selectable>{o.subject}</Text>
              <Muted>{o.body}</Muted>
            </View>
          ))}
        </Card>
      ) : null}
      <Card>
        <H3>🐙 GitHub</H3>
        <Muted>Lets children save projects as repositories in your GitHub account and (if public publishing is on) put them on the web. Use a fine-grained token with Administration, Contents and Pages read & write. It's stored encrypted on the server.</Muted>
        {conn?.github ? (
          <Row style={{ justifyContent: "space-between" }}>
            <Chip tone="mint" label={`Connected as @${conn.github.account}`} />
            <Button size="sm" variant="danger" title="Disconnect" onPress={async () => { await api.del("/parent/connectors/github"); reloadConn(); }} />
          </Row>
        ) : (
          <>
            <Field placeholder="github_pat_…" value={token} onChangeText={setToken} secureTextEntry autoCapitalize="none" />
            <Button title="Connect GitHub" disabled={token.length < 20} onPress={async () => {
              setErr(null);
              try {
                await api.post("/parent/connectors/github", { token });
                setToken("");
                reloadConn();
              } catch (e) {
                setErr(e);
              }
            }} />
            <Button size="sm" variant="ghost" title="Create a token on github.com" onPress={() => Linking.openURL("https://github.com/settings/personal-access-tokens/new")} />
          </>
        )}
      </Card>
      <ErrorText error={err} />
    </Screen>
  );
}
