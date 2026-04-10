import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { UserProfile, supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

interface ImpersonateContextType {
  impersonatedProfile: UserProfile | null;
  isImpersonating: boolean;
  startImpersonation: (clientId: string) => Promise<void>;
  stopImpersonation: () => void;
  /** Returns the actual user profile if no impersonation, otherwise the impersonated one */
  activeProfile: UserProfile | null;
}

const ImpersonateContext = createContext<ImpersonateContextType>({
  impersonatedProfile: null,
  isImpersonating: false,
  startImpersonation: async () => {},
  stopImpersonation: () => {},
  activeProfile: null,
});

const IMPERSONATE_KEY = "bartez_impersonated_id";

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

export function ImpersonateProvider({ children }: { children: ReactNode }) {
  const { profile, isAdmin, isSeller } = useAuth();
  const [impersonatedProfile, setImpersonatedProfile] = useState<UserProfile | null>(null);

  const canImpersonate = isAdmin || isSeller;

  // On mount, restore from localStorage — re-fetch via API for fresh data
  useEffect(() => {
    const saved = localStorage.getItem(IMPERSONATE_KEY);
    if (saved && canImpersonate) {
      // Restore silently without re-logging the audit (session resume, not a new impersonation)
      supabase
        .from("profiles")
        .select("*")
        .eq("id", saved)
        .single()
        .then(({ data }) => { if (data) setImpersonatedProfile(data as UserProfile); });
    } else {
      setImpersonatedProfile(null);
    }
  }, [isAdmin, isSeller]);

  const startImpersonation = async (clientId: string): Promise<void> => {
    if (!canImpersonate) return;

    const authHeader = await getAuthHeader();
    const res = await fetch("/api/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ client_id: clientId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error((err as { error?: string }).error ?? "No se pudo iniciar la impersonación");
    }

    const json = await res.json() as { data: UserProfile };
    localStorage.setItem(IMPERSONATE_KEY, clientId);
    setImpersonatedProfile(json.data);
  };

  const stopImpersonation = (): void => {
    const clientId = localStorage.getItem(IMPERSONATE_KEY);
    localStorage.removeItem(IMPERSONATE_KEY);
    setImpersonatedProfile(null);

    // Fire-and-forget audit log for stop
    getAuthHeader().then((authHeader) => {
      void fetch("/api/impersonate", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ client_id: clientId }),
      });
    });
  };

  return (
    <ImpersonateContext.Provider
      value={{
        impersonatedProfile,
        isImpersonating: !!impersonatedProfile,
        startImpersonation,
        stopImpersonation,
        activeProfile: (canImpersonate && impersonatedProfile) ? impersonatedProfile : profile,
      }}
    >
      {children}
    </ImpersonateContext.Provider>
  );
}

export const useImpersonate = () => useContext(ImpersonateContext);
