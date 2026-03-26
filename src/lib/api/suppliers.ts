import { supabase } from "@/lib/supabase";
import type { Supplier, SupplierInsert, SupplierUpdate } from "@/models/supplier";

const TABLE = "suppliers";

export async function fetchSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as Supplier[];
}

export async function createSupplier(input: SupplierInsert): Promise<Supplier> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Supplier;
}

export async function updateSupplier(id: string, input: SupplierUpdate): Promise<Supplier> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Supplier;
}

export async function deleteSupplier(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}
