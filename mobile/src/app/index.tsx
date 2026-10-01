// Entry: send people to the right place for their session.
import { Redirect } from "expo-router";
import { useSession } from "../lib/session";
import { Loading } from "../components/ui";

export default function Index() {
  const { me, ready } = useSession();
  if (!ready || !me) return <Loading />;
  if (me.role === "parent") return <Redirect href="/parent" />;
  if (me.role === "child") return <Redirect href="/kid" />;
  return <Redirect href="/welcome" />;
}
