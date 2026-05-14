import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

export interface ClientBranch {
  id: number;
  name: string;
  address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  is_default: boolean;
  created_at: string;
}

export interface BranchInput {
  id?: number;
  name: string;
  address?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  contact_name?: string;
  contact_phone?: string;
  is_default?: boolean;
}

interface UseClientBranchesReturn {
  branches: ClientBranch[];
  loading: boolean;
  upsert: (branch: BranchInput) => Promise<boolean>;
  remove: (id: number) => Promise<boolean>;
  refresh: () => void;
}

export function useClientBranches(): UseClientBranchesReturn {
  const { toast } = useToast();
  const [branches, setBranches] = useState<ClientBranch[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_my_branches");
    if (!error) setBranches((data as ClientBranch[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const upsert = useCallback(async (branch: BranchInput) => {
    const { error } = await supabase.rpc("upsert_branch", {
      p_id:            branch.id ?? null,
      p_name:          branch.name,
      p_address:       branch.address ?? null,
      p_city:          branch.city ?? null,
      p_province:      branch.province ?? null,
      p_postal_code:   branch.postal_code ?? null,
      p_contact_name:  branch.contact_name ?? null,
      p_contact_phone: branch.contact_phone ?? null,
      p_is_default:    branch.is_default ?? false,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: branch.id ? "Sucursal actualizada" : "Sucursal creada" });
    await load();
    return true;
  }, [load, toast]);

  const remove = useCallback(async (id: number) => {
    const { error } = await supabase.rpc("delete_branch", { p_id: id });
    if (error) {
      toast({ title: "Error al eliminar", description: error.message, variant: "destructive" });
      return false;
    }
    setBranches((prev) => prev.filter((b) => b.id !== id));
    toast({ title: "Sucursal eliminada" });
    return true;
  }, [toast]);

  return { branches, loading, upsert, remove, refresh: load };
}
