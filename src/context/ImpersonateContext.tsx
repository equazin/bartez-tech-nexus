import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/api/backendClient";
import { type UserProfile, supabase } from "@/lib/supabase";

interface ImpersonateContextType {
  impersonatedProfile: UserProfile | null;
  isImpersonating: boolean;
  startImpersonation: (clientId: string) => Promise<void>;
  stopImpersonation: () => void;
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

  useEffect(() => {
    const saved = localStorage.getItem(IMPERSONATE_KEY);
    if (saved && canImpersonate) {
      void supabase
        .from("profiles")
        .select("*")
        .eq("id", saved)
        .single()
        .then(({ data }) => {
          if (data) {
            setImpersonatedProfile(data as UserProfile);
          }
        });
    } else {
      setImpersonatedProfile(null);
    }
  }, [canImpersonate]);

  const startImpersonation = async (clientId: string): Promise<void> => {
    if (!canImpersonate) return;

    const { response, result } = await apiRequest<UserProfile>("/v1/admin/impersonations", {
      method: "POST",
      auth: "required",
      json: { client_id: clientId },
    });

    if (!response.ok || !result.ok || !result.data) {
      throw new Error(result.error ?? "No se pudo iniciar la impersonacion");
    }

    localStorage.setItem(IMPERSONATE_KEY, clientId);
    setImpersonatedProfile(result.data);
  };

  const stopImpersonation = (): void => {
    const clientId = localStorage.getItem(IMPERSONATE_KEY);
    localStorage.removeItem(IMPERSONATE_KEY);
    setImpersonatedProfile(null);

    void apiRequest("/v1/admin/impersonations/current", {
      method: "DELETE",
      auth: "required",
      json: { client_id: clientId },
    });
  };

  return (
    <ImpersonateContext.Provider
      value={{
        impersonatedProfile,
        isImpersonating: !!impersonatedProfile,
        startImpersonation,
        stopImpersonation,
        activeProfile: canImpersonate && impersonatedProfile ? impersonatedProfile : profile,
      }}
    >
      {children}
    </ImpersonateContext.Provider>
  );
}

export const useImpersonate = () => useContext(ImpersonateContext);
