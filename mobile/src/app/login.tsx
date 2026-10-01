import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { Button, Card, ErrorText, Field, H2, Muted, Screen } from "../components/ui";

export default function Login() {
  const { grownup } = useLocalSearchParams<{ grownup?: string }>();
  const { signIn } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ token: string }>("/auth/login", { email, password });
      await signIn(r.token);
      router.replace("/parent");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <Card>
        <H2>{grownup ? "👪 Grown-ups only" : "Welcome back"}</H2>
        {grownup ? <Muted>Enter the parent password to open the parent area.</Muted> : null}
        <Field label="Parent email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" onSubmitEditing={submit} />
        <ErrorText error={error} />
        <Button size="lg" title={busy ? "Signing in…" : "Sign in"} disabled={busy || !email || !password} onPress={submit} />
        {grownup ? <Button variant="ghost" title="← Back to creating" onPress={() => router.back()} /> : null}
      </Card>
    </Screen>
  );
}
