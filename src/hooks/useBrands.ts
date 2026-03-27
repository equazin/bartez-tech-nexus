import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Brand } from "@/models/brand";

export function useBrands(includeInactive = false) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBrands = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("brands").select("*").order("name");
    if (!includeInactive) query = query.eq("active", true);
    const { data } = await query;
    setBrands((data as Brand[]) ?? []);
    setLoading(false);
  }, [includeInactive]);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  return { brands, loading, refetch: fetchBrands };
}
