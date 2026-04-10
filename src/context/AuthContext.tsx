import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase, UserProfile } from "@/lib/supabase";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isSeller: boolean;
  /** Can view orders, clients, and approve/reject orders */
  canManageOrders: boolean;
  /** Can create/edit/delete products, pricing rules, suppliers */
  canManageProducts: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null; inactive?: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isSeller: false,
  canManageOrders: false,
  canManageProducts: false,
  signIn: async () => ({ error: null, inactive: false }),
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(userId: string) {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (!error && data) setProfile(data as UserProfile);
    } catch {
      // silencioso - perfil no encontrado
    }
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // TOKEN_REFRESHED fires on every tab focus - ignore it to avoid
      // resetting loading state and re-fetching the profile unnecessarily.
      if (event === "TOKEN_REFRESHED") return;

      setSession(session);
      if (session?.user) {
        setLoading(true);
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: string | null; inactive?: boolean }> => {
    if (!isSupabaseConfigured) {
      return {
        error: "Supabase no esta configurado en local. Copia .env.example a .env y completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.",
      };
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };

    // Check if the account is inactive before allowing access
    const userId = data.user?.id;
    if (userId) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("active, role")
        .eq("id", userId)
        .single();

      const role = String(profileData?.role ?? "client").toLowerCase();
      const isPrivileged = role === "admin" || role === "vendedor" || role === "sales";

      if (profileData?.active === false && !isPrivileged) {
        // Sign them out immediately so the session isn't kept
        await supabase.auth.signOut();
        return { error: null, inactive: true };
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const role = profile?.role ?? "client";
  const normalizedRole = role === "cliente" ? "client" : role;
  const isAdmin = normalizedRole === "admin";
  const isSeller = normalizedRole === "vendedor" || normalizedRole === "sales";

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        isAdmin,
        isSeller,
        canManageOrders: isAdmin || isSeller,
        canManageProducts: isAdmin,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

