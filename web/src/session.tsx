import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";

export interface Me {
  role: "parent" | "child" | null;
  parent?: { id: string; name: string; email: string };
  child?: { id: string; name: string; avatar: string; age: number };
  family?: { id: string; name: string };
  ai: { provider: string; live: boolean };
}

const Ctx = createContext<{ me: Me | null; refresh: () => Promise<Me> }>({ me: null, refresh: async () => ({ role: null, ai: { provider: "", live: false } }) });
export const useSession = () => useContext(Ctx);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const refresh = useCallback(async () => {
    const m = await api.get<Me>("/me").catch(() => ({ role: null, ai: { provider: "offline", live: false } }) as Me);
    setMe(m);
    return m;
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return <Ctx.Provider value={{ me, refresh }}>{children}</Ctx.Provider>;
}
