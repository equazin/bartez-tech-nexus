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

export function ImpersonateProvider({ children }: { children: ReactNode }) {
  const { profile, isAdmin, isSeller } = useAuth();
  const [impersonatedProfile, setImpersonatedProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);

  const canImpersonate = isAdmin || isSeller;

  async function fetchImpersonated(id: string) {
    setLoading(true);
    const { data } = await supabase.from("profiles").select("*").eq("id", id).single();
    if (data) setImpersonatedProfile(data as UserProfile);
    setLoading(false);
  }

  useEffect(() => {
    const saved = localStorage.getItem(IMPERSONATE_KEY);
    if (saved && canImpersonate) {
      fetchImpersonated(saved);
    } else {
      setImpersonatedProfile(null);
    }
  }, [isAdmin, isSeller]);

  const startImpersonation = async (clientId: string) => {
    if (!canImpersonate) return;
    localStorage.setItem(IMPERSONATE_KEY, clientId);
    await fetchImpersonated(clientId);
  };

  const stopImpersonation = () => {
    localStorage.removeItem(IMPERSONATE_KEY);
    setImpersonatedProfile(null);
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
