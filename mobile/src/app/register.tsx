import { router } from "expo-router";
import { useState } from "react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { Button, Card, ErrorText, Field, H2, Muted, Screen } from "../components/ui";

export default function Register() {
  const { signIn } = useSession();
  const [f, setF] = useState({ name: "", familyName: "", email: "", password: "" });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ token: string }>("/auth/register", f);
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
        <H2>Create your family</H2>
        <Muted>Parents set up SparkForge. You'll add your child's profile and choose what they can do next.</Muted>
        <Field label="Your name" value={f.name} onChangeText={(name) => setF({ ...f, name })} autoComplete="name" />
        <Field label="Family name (optional)" value={f.familyName} placeholder="The Rivera family" onChangeText={(familyName) => setF({ ...f, familyName })} />
        <Field label="Email" value={f.email} onChangeText={(email) => setF({ ...f, email })} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <Field label="Password (8+ characters)" value={f.password} onChangeText={(password) => setF({ ...f, password })} secureTextEntry autoComplete="new-password" />
        <ErrorText error={error} />
        <Button size="lg" title={busy ? "Creating…" : "Create family account"} disabled={busy || f.password.length < 8 || !f.email || !f.name} onPress={submit} />
      </Card>
    </Screen>
  );
}
