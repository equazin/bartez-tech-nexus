import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { PcBuildDraft, PcBuildItemDraft, SavePcBuildDraftInput } from "@/models/pcBuilder";

type PcBuildRow = {
  id: string;
  client_id: string;
  name: string;
  mode: "guided" | "manual";
  goal: "office" | "gaming" | "workstation" | null;
  budget_min: number | null;
  budget_max: number | null;
  currency: "ARS" | "USD";
  priority: "price" | "balanced" | "performance" | null;
  status: "draft" | "quoted" | "ordered";
  created_at: string;
  updated_at: string;
};

type PcBuildItemRow = {
  build_id: string;
  slot_key: PcBuildItemDraft["slotKey"];
  product_id: number;
  quantity: number;
  locked: boolean;
  compatibility_state: PcBuildItemDraft["compatibilityState"];
  notes: string | null;
};

function mapRowsToDrafts(buildRows: PcBuildRow[], itemRows: PcBuildItemRow[]): PcBuildDraft[] {
  const itemsByBuild = new Map<string, PcBuildItemDraft[]>();
  for (const row of itemRows) {
    const mapped: PcBuildItemDraft = {
      slotKey: row.slot_key,
      productId: row.product_id,
      quantity: row.quantity,
      locked: row.locked,
      compatibilityState: row.compatibility_state,
      notes: row.notes ?? undefined,
    };
    const current = itemsByBuild.get(row.build_id) ?? [];
    current.push(mapped);
    itemsByBuild.set(row.build_id, current);
  }

  return buildRows.map((row) => ({
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    mode: row.mode,
    goal: row.goal ?? undefined,
    budgetMin: row.budget_min ?? undefined,
    budgetMax: row.budget_max ?? undefined,
    currency: row.currency,
    priority: row.priority ?? undefined,
    status: row.status,
    items: itemsByBuild.get(row.id) ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function usePcBuilds(clientId: string | undefined) {
  const [drafts, setDrafts] = useState<PcBuildDraft[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!clientId) {
      setDrafts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data: buildData, error: buildError } = await supabase
      .from("pc_builds")
      .select("*")
      .eq("client_id", clientId)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (buildError || !buildData) {
      setDrafts([]);
      setLoading(false);
      return;
    }

    const buildRows = buildData as PcBuildRow[];
    if (buildRows.length === 0) {
      setDrafts([]);
      setLoading(false);
      return;
    }

    const { data: itemData } = await supabase
      .from("pc_build_items")
      .select("*")
      .in(
        "build_id",
        buildRows.map((row) => row.id),
      );

    const itemRows = (itemData ?? []) as PcBuildItemRow[];
    setDrafts(mapRowsToDrafts(buildRows, itemRows));
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const saveDraft = useCallback(
    async (input: SavePcBuildDraftInput): Promise<PcBuildDraft | null> => {
      if (!clientId) return null;

      const payload = {
        client_id: clientId,
        name: input.name.trim() || `Armado ${new Date().toLocaleDateString("es-AR")}`,
        mode: input.mode,
        goal: input.goal ?? null,
        budget_min: input.budgetMin ?? null,
        budget_max: input.budgetMax ?? null,
        currency: input.currency,
        priority: input.priority ?? null,
        status: input.status ?? "draft",
      };

      let buildId = input.id;
      if (buildId) {
        const { error } = await supabase.from("pc_builds").update(payload).eq("id", buildId).eq("client_id", clientId);
        if (error) return null;
      } else {
        const { data, error } = await supabase.from("pc_builds").insert(payload).select("id").single();
        if (error || !data) return null;
        buildId = (data as { id: string }).id;
      }

      const resolvedBuildId = buildId as string;

      const { error: deleteError } = await supabase.from("pc_build_items").delete().eq("build_id", resolvedBuildId);
      if (deleteError) return null;

      if (input.items.length > 0) {
        const rows = input.items.map((item) => ({
          build_id: resolvedBuildId,
          slot_key: item.slotKey,
          product_id: item.productId,
          quantity: item.quantity,
          locked: item.locked,
          compatibility_state: item.compatibilityState,
          notes: item.notes ?? null,
        }));

        const { error: insertItemsError } = await supabase.from("pc_build_items").insert(rows);
        if (insertItemsError) return null;
      }

      await refetch();
      return (
        drafts.find((draft) => draft.id === resolvedBuildId) ?? {
          id: resolvedBuildId,
          clientId,
          name: payload.name,
          mode: payload.mode,
          goal: payload.goal ?? undefined,
          budgetMin: payload.budget_min ?? undefined,
          budgetMax: payload.budget_max ?? undefined,
          currency: payload.currency,
          priority: payload.priority ?? undefined,
          status: payload.status,
          items: input.items,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      );
    },
    [clientId, drafts, refetch],
  );

  const deleteDraft = useCallback(
    async (buildId: string): Promise<boolean> => {
      if (!clientId) return false;
      const { error } = await supabase.from("pc_builds").delete().eq("id", buildId).eq("client_id", clientId);
      if (error) return false;
      setDrafts((prev) => prev.filter((draft) => draft.id !== buildId));
      return true;
    },
    [clientId],
  );

  const getDraft = useCallback(
    (buildId: string): PcBuildDraft | null => drafts.find((draft) => draft.id === buildId) ?? null,
    [drafts],
  );

  return {
    drafts,
    loading,
    refetch,
    saveDraft,
    deleteDraft,
    getDraft,
  };
}
