import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface BuilderSaveDraftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName: string;
  onSave: (name: string) => Promise<void> | void;
}

export function BuilderSaveDraftDialog({ open, onOpenChange, defaultName, onSave }: BuilderSaveDraftDialogProps) {
  const [name, setName] = useState(defaultName);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setName(defaultName);
  }, [open, defaultName]);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(name.trim() || defaultName);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Guardar borrador</DialogTitle>
          <DialogDescription>
            El armado se guarda para retomarlo después desde esta misma pantalla.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nombre del armado"
          className="mt-2"
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar borrador"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
