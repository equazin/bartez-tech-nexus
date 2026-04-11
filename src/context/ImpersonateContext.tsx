import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { UserProfile, supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { backend } from "@/lib/api/backendClient";

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

export function ImpersonateProvider({ children }: { children: ReactNode }) {
  const { profile, isAdmin, isSeller } = useAuth();
  const [impersonatedProfile, setImpersonatedProfile] = useState<UserProfile | null>(null);

  const canImpersonate = isAdmin || isSeller;

  // On mount, restore from localStorage — re-fetch via RLS-safe direct query for fresh data
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

    const data = await backend.post<UserProfile>("/v1/admin/impersonations", { client_id: clientId });
    localStorage.setItem(IMPERSONATE_KEY, clientId);
    setImpersonatedProfile(data);
  };

  const stopImpersonation = (): void => {
    const clientId = localStorage.getItem(IMPERSONATE_KEY);
    localStorage.removeItem(IMPERSONATE_KEY);
    setImpersonatedProfile(null);

    // Fire-and-forget audit log for stop
    void backend.delete("/v1/admin/impersonations/current", { client_id: clientId ?? undefined });
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
