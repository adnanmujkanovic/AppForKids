import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, loadConnection, setToken } from "./api";

export interface Me {
  role: "parent" | "child" | null;
  parent?: { id: string; name: string; email: string };
  child?: { id: string; name: string; avatar: string; age: number };
  ai: { provider: string; live: boolean };
}

interface Ctx {
  me: Me | null;
  ready: boolean;
  refresh: () => Promise<Me>;
  /** Store a new session token from login / register / entering kid mode. */
  signIn: (token: string) => Promise<Me>;
  signOut: () => Promise<void>;
}

const SessionCtx = createContext<Ctx>(null as unknown as Ctx);
export const useSession = () => useContext(SessionCtx);

const OFFLINE: Me = { role: null, ai: { provider: "offline", live: false } };

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const refresh = useCallback(async () => {
    const m = await api.get<Me>("/me").catch(() => OFFLINE);
    setMe(m);
    return m;
  }, []);
  useEffect(() => {
    loadConnection()
      .then(refresh)
      .finally(() => setReady(true));
  }, [refresh]);
  const signIn = useCallback(
    async (token: string) => {
      await setToken(token);
      return refresh();
    },
    [refresh],
  );
  const signOut = useCallback(async () => {
    await api.post("/auth/logout").catch(() => {});
    await setToken(null);
    setMe(OFFLINE);
  }, []);
  return <SessionCtx.Provider value={{ me, ready, refresh, signIn, signOut }}>{children}</SessionCtx.Provider>;
}
