// Which SparkForge server the app talks to (useful for self-hosting and development).
import { router } from "expo-router";
import { useState } from "react";
import { api, serverUrl, setServerUrl } from "../lib/api";
import { useSession } from "../lib/session";
import { Button, Card, Field, Muted, Note, Screen } from "../components/ui";

export default function Server() {
  const { refresh } = useSession();
  const [url, setUrl] = useState(serverUrl());
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <Screen>
      <Card>
        <Muted>The address of your family's SparkForge server.</Muted>
        <Field label="Server URL" value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" />
        <Button
          title="Save & test"
          onPress={async () => {
            await setServerUrl(url);
            try {
              await api.get("/health");
              setMsg("✅ Connected!");
              await refresh();
              router.back();
            } catch (e) {
              setMsg(`❌ ${(e as Error).message}`);
            }
          }}
        />
        <Note>{msg}</Note>
      </Card>
    </Screen>
  );
}
