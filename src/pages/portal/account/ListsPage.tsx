import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ListChecks, ShoppingCart, Pencil, Trash2, Search, Share2 } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { useImpersonate } from "@/context/ImpersonateContext";
import { usePurchaseLists, type PurchaseList } from "@/hooks/usePurchaseLists";
import { useSharedCartState } from "@/hooks/useSharedCartState";

import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

function formatRelativeDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ListsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile: authProfile } = useAuth();
  const { activeProfile } = useImpersonate();
  const profile = activeProfile ?? authProfile;
  const userId = profile?.id ?? "";

  const { lists, loading, createList, updateList, deleteList } = usePurchaseLists({ userId });
  const { setCart } = useSharedCartState(userId);

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [renaming, setRenaming] = useState<PurchaseList | null>(null);
  const [renameName, setRenameName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const filteredLists = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return lists;
    return lists.filter((l) => l.name.toLowerCase().includes(q));
  }, [lists, search]);

  async function handleCreate() {
    if (!createName.trim()) return;
    setSubmitting(true);
    const result = await createList(createName);
    setSubmitting(false);
    if (!result) {
      toast({ title: "No se pudo crear la lista", variant: "destructive" });
      return;
    }
    setCreateName("");
    setCreateOpen(false);
    toast({ title: "Lista creada" });
  }

  async function handleRename() {
    if (!renaming || !renameName.trim()) return;
    setSubmitting(true);
    const result = await updateList(renaming.id, { name: renameName });
    setSubmitting(false);
    if (!result) {
      toast({ title: "No se pudo renombrar", variant: "destructive" });
      return;
    }
    setRenaming(null);
    toast({ title: "Lista actualizada" });
  }

  async function handleDelete(list: PurchaseList) {
    if (!window.confirm(`¿Eliminar la lista "${list.name}"?`)) return;
    await deleteList(list.id);
    toast({ title: "Lista eliminada" });
  }

  function handleLoadToCart(list: PurchaseList) {
    if (list.items.length === 0) {
      toast({ title: "La lista no tiene productos", variant: "destructive" });
      return;
    }
    setCart((prev) => {
      const next = { ...prev };
      list.items.forEach((item) => {
        next[item.product_id] = (next[item.product_id] ?? 0) + Math.max(1, item.quantity);
      });
      return next;
    });
    toast({ title: `Cargados ${list.items.length} productos al carrito` });
    navigate("/cart");
  }

  return (
    <div className="mx-auto w-full max-w-5xl p-4 md:p-6">
      <PageHeader
        eyebrow="Mi cuenta"
        title="Mis listas"
        description="Listas guardadas para repetir compras frecuentes."
        actions={
          <Button onClick={() => { setCreateName(""); setCreateOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" />
            Nueva lista
          </Button>
        }
      />

      <div className="mt-5 flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar lista..."
            className="pl-8"
          />
        </div>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
          </div>
        ) : filteredLists.length === 0 ? (
          <EmptyState
            icon={<ListChecks className="h-8 w-8" />}
            title={search ? "Sin resultados" : "Aún no tenés listas"}
            description={
              search
                ? "Probá con otro nombre o limpiá el filtro."
                : "Las listas te permiten guardar productos frecuentes y repetir pedidos en un click."
            }
            actionLabel={search ? "Limpiar búsqueda" : "Crear primera lista"}
            onAction={() => (search ? setSearch("") : setCreateOpen(true))}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredLists.map((list) => (
              <ListCard
                key={list.id}
                list={list}
                onLoad={() => handleLoadToCart(list)}
                onRename={() => { setRenameName(list.name); setRenaming(list); }}
                onDelete={() => handleDelete(list)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Crear */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva lista</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="list-name">Nombre</Label>
            <Input
              id="list-name"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Ej. Reposición mensual"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Después podés agregar productos desde el catálogo o cargando un pedido existente.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={submitting || !createName.trim()}>
              Crear lista
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Renombrar */}
      <Dialog open={!!renaming} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renombrar lista</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-name">Nombre</Label>
            <Input
              id="rename-name"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleRename} disabled={submitting || !renameName.trim()}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ListCardProps {
  list: PurchaseList;
  onLoad: () => void;
  onRename: () => void;
  onDelete: () => void;
}

function ListCard({ list, onLoad, onRename, onDelete }: ListCardProps) {
  const itemCount = list.items.length;
  const totalUnits = list.items.reduce((sum, item) => sum + (item.quantity ?? 0), 0);

  return (
    <div className="flex flex-col rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{list.name}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Actualizada {formatRelativeDate(list.updated_at)}
          </p>
        </div>
        {list.is_shared && (
          <Badge variant="outline" className="gap-1 border-info text-info">
            <Share2 className="h-3 w-3" />
            Compartida
          </Badge>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs">
        <div>
          <p className="text-muted-foreground">Productos</p>
          <p className="portal-tabular font-semibold text-foreground">{itemCount}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Unidades</p>
          <p className="portal-tabular font-semibold text-foreground">{totalUnits}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        <Button size="sm" className="flex-1 gap-1.5" onClick={onLoad} disabled={itemCount === 0}>
          <ShoppingCart className="h-4 w-4" />
          Cargar
        </Button>
        {!list.is_shared && (
          <>
            <Button size="icon" variant="ghost" onClick={onRename} aria-label="Renombrar">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Eliminar">
              <Trash2 className="h-4 w-4 text-danger" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
