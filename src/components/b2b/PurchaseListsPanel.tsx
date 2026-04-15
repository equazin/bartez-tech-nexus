import { useEffect, useMemo, useState } from "react";
import { ListChecks, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import type { PurchaseList, PurchaseListItem } from "@/hooks/usePurchaseLists";
import type { Product } from "@/models/products";

export interface PurchaseListsPanelProps {
  lists: PurchaseList[];
  loading: boolean;
  products: Product[];
  onCreateList: (name: string, items?: PurchaseListItem[]) => Promise<PurchaseList | null>;
  onUpdateList: (
    id: number,
    patch: Partial<Pick<PurchaseList, "name" | "items" | "shared_with">>,
  ) => Promise<PurchaseList | null>;
  onDeleteList: (id: number) => Promise<void>;
  onLoadListToCart: (list: PurchaseList) => void;
  onCreateOrderFromList: (list: PurchaseList) => void;
}

function resolveProductLabel(item: PurchaseListItem, productsMap: Map<number, Product>) {
  const product = productsMap.get(item.product_id);
  return {
    name: item.name ?? product?.name ?? `Producto #${item.product_id}`,
    sku: item.sku ?? product?.sku ?? null,
  };
}

export function PurchaseListsPanel({
  lists,
  loading,
  products,
  onCreateList,
  onUpdateList,
  onDeleteList,
  onLoadListToCart,
  onCreateOrderFromList,
}: PurchaseListsPanelProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [newListName, setNewListName] = useState("");
  const [editorName, setEditorName] = useState("");
  const [editorItems, setEditorItems] = useState<PurchaseListItem[]>([]);
  const [productToAdd, setProductToAdd] = useState<number>(products[0]?.id ?? 0);
  const [quantityToAdd, setQuantityToAdd] = useState(1);

  const productsMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  const selectedList = useMemo(
    () => lists.find((list) => list.id === selectedId) ?? null,
    [lists, selectedId],
  );

  useEffect(() => {
    if (!selectedId && lists.length > 0) {
      setSelectedId(lists[0].id);
    }
  }, [lists, selectedId]);

  useEffect(() => {
    if (!selectedList) return;
    setEditorName(selectedList.name);
    setEditorItems(selectedList.items);
  }, [selectedList]);

  async function handleCreateList() {
    if (!newListName.trim()) {
      toast.error("Defini un nombre para la lista.");
      return;
    }

    const created = await onCreateList(newListName.trim(), []);
    if (!created) {
      toast.error("No se pudo crear la lista.");
      return;
    }

    setNewListName("");
    setSelectedId(created.id);
    toast.success("Lista creada.");
  }

  async function handleSaveList() {
    if (!selectedList) return;
    const updated = await onUpdateList(selectedList.id, {
      name: editorName.trim(),
      items: editorItems,
    });

    if (!updated) {
      toast.error("No se pudo guardar la lista.");
      return;
    }

    toast.success("Lista actualizada.");
  }

  async function handleDeleteSelected() {
    if (!selectedList) return;
    await onDeleteList(selectedList.id);
    setSelectedId((current) => (current === selectedList.id ? null : current));
    toast.success("Lista eliminada.");
  }

  function handleAddEditorItem() {
    if (!productToAdd) return;

    const existing = editorItems.find((item) => item.product_id === productToAdd);
    if (existing) {
      setEditorItems((current) =>
        current.map((item) =>
          item.product_id === productToAdd
            ? { ...item, quantity: item.quantity + Math.max(1, quantityToAdd) }
            : item,
        ),
      );
      return;
    }

    const product = productsMap.get(productToAdd);
    setEditorItems((current) => [
      ...current,
      {
        product_id: productToAdd,
        quantity: Math.max(1, quantityToAdd),
        name: product?.name,
        sku: product?.sku ?? null,
        note: null,
      },
    ]);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Sprint 3"
        title="Mis listas"
        description="Guardalas con nombre, cargalas al carrito activo o manda una lista completa directo al checkout."
      />

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <SurfaceCard padding="md" className="space-y-4 rounded-[24px] border-border/70">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Listas persistentes
              </p>
              <h3 className="mt-1 text-lg font-semibold text-foreground">Listas de compra</h3>
            </div>
            <Badge variant="outline">{lists.length}</Badge>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={newListName}
              onChange={(event) => setNewListName(event.target.value)}
              className="h-10 flex-1 rounded-xl border border-border/70 bg-card px-3 text-sm outline-none"
              placeholder="Ej: Insumos sucursal norte"
            />
            <Button onClick={() => void handleCreateList()}>Crear lista</Button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-2xl border border-border/70 bg-surface/60" />
              ))}
            </div>
          ) : lists.length === 0 ? (
            <EmptyState
              className="rounded-[22px]"
              title="Sin listas creadas"
              description="Crea tu primera lista o agrega productos desde el catalogo para acelerar compras repetitivas."
            />
          ) : (
            <div className="space-y-3">
              {lists.map((list) => (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => setSelectedId(list.id)}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                    list.id === selectedId
                      ? "border-primary/30 bg-primary/5"
                      : "border-border/70 bg-card hover:bg-surface/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{list.name}</p>
                        {list.is_shared ? <Badge variant="outline">Compartida</Badge> : null}
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{list.items.length} items</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Actualizada {new Date(list.updated_at).toLocaleString("es-AR")}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard padding="md" className="space-y-4 rounded-[24px] border-border/70">
          {!selectedList ? (
            <EmptyState
              className="rounded-[22px]"
              title="Selecciona una lista"
              description="Desde aca podes editar cantidades, notas y convertir la lista en una compra real."
              icon={<ListChecks size={22} />}
            />
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Editor
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-foreground">{selectedList.name}</h3>
                </div>
                {selectedList.is_shared ? <Badge variant="outline">Solo lectura</Badge> : null}
              </div>

              <label className="space-y-1.5">
                <span className="text-xs text-muted-foreground">Nombre</span>
                <input
                  value={editorName}
                  onChange={(event) => setEditorName(event.target.value)}
                  disabled={selectedList.is_shared}
                  className="h-10 w-full rounded-xl border border-border/70 bg-card px-3 text-sm outline-none disabled:opacity-60"
                />
              </label>

              <div className="grid gap-2 rounded-2xl border border-border/70 bg-surface/40 p-3 md:grid-cols-[minmax(0,1fr)_100px_auto]">
                <select
                  value={productToAdd}
                  onChange={(event) => setProductToAdd(Number(event.target.value))}
                  disabled={selectedList.is_shared}
                  className="h-10 rounded-xl border border-border/70 bg-card px-3 text-sm outline-none"
                >
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.sku || product.category})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={quantityToAdd}
                  onChange={(event) => setQuantityToAdd(Math.max(1, Number(event.target.value) || 1))}
                  disabled={selectedList.is_shared}
                  className="h-10 rounded-xl border border-border/70 bg-card px-3 text-sm outline-none"
                />
                <Button disabled={selectedList.is_shared} onClick={handleAddEditorItem}>
                  Agregar item
                </Button>
              </div>

              {editorItems.length === 0 ? (
                <EmptyState
                  className="rounded-[22px]"
                  title="Lista vacia"
                  description="Agrega items desde el catalogo o usa el selector de arriba para completarla."
                />
              ) : (
                <div className="space-y-3">
                  {editorItems.map((item, index) => {
                    const label = resolveProductLabel(item, productsMap);
                    return (
                      <div
                        key={`${item.product_id}-${index}`}
                        className="grid gap-3 rounded-2xl border border-border/70 bg-card p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{label.name}</p>
                            <p className="text-xs text-muted-foreground">{label.sku || `SKU ${item.product_id}`}</p>
                          </div>
                          {!selectedList.is_shared ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() =>
                                setEditorItems((current) => current.filter((_, itemIndex) => itemIndex !== index))
                              }
                            >
                              <Trash2 size={14} />
                            </Button>
                          ) : null}
                        </div>

                        <div className="grid gap-3 md:grid-cols-[120px_minmax(0,1fr)]">
                          <label className="space-y-1.5">
                            <span className="text-xs text-muted-foreground">Cantidad</span>
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              disabled={selectedList.is_shared}
                              onChange={(event) =>
                                setEditorItems((current) =>
                                  current.map((entry, itemIndex) =>
                                    itemIndex === index
                                      ? { ...entry, quantity: Math.max(1, Number(event.target.value) || 1) }
                                      : entry,
                                  ),
                                )
                              }
                              className="h-10 w-full rounded-xl border border-border/70 bg-card px-3 text-sm outline-none disabled:opacity-60"
                            />
                          </label>

                          <label className="space-y-1.5">
                            <span className="text-xs text-muted-foreground">Nota</span>
                            <input
                              value={item.note ?? ""}
                              disabled={selectedList.is_shared}
                              onChange={(event) =>
                                setEditorItems((current) =>
                                  current.map((entry, itemIndex) =>
                                    itemIndex === index
                                      ? { ...entry, note: event.target.value || null }
                                      : entry,
                                  ),
                                )
                              }
                              className="h-10 w-full rounded-xl border border-border/70 bg-card px-3 text-sm outline-none disabled:opacity-60"
                              placeholder="Comentario interno para esta lista"
                            />
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-wrap justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => onLoadListToCart({ ...selectedList, name: editorName, items: editorItems })}
                  >
                    <ShoppingCart size={14} />
                    Cargar lista al carrito
                  </Button>
                  <Button
                    onClick={() => onCreateOrderFromList({ ...selectedList, name: editorName, items: editorItems })}
                  >
                    Crear pedido desde lista
                  </Button>
                </div>

                {!selectedList.is_shared ? (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => void handleSaveList()}>
                      Guardar cambios
                    </Button>
                    <Button variant="ghost" onClick={() => void handleDeleteSelected()}>
                      <Trash2 size={14} />
                      Eliminar
                    </Button>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </SurfaceCard>
      </div>
    </div>
  );
}
