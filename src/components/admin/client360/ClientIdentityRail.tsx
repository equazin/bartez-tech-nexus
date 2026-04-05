import { Building2, Mail, MapPin, Phone, Tags, User2, UserRoundCheck } from "lucide-react";

import type { Client360Tag } from "@/components/admin/client360/types";
import { Badge } from "@/components/ui/badge";
import { SurfaceCard } from "@/components/ui/surface-card";

interface IdentityField {
  label: string;
  value: string;
}

interface ClientIdentityRailProps {
  accountName: string;
  contactName: string;
  executiveName: string;
  tags: Client360Tag[];
  email?: string;
  phone?: string;
  location?: string;
  fields: IdentityField[];
}

export function ClientIdentityRail({
  accountName,
  contactName,
  executiveName,
  tags,
  email,
  phone,
  location,
  fields,
}: ClientIdentityRailProps) {
  const initials = (accountName || contactName || "?").slice(0, 2).toUpperCase();

  return (
    <div className="space-y-2">
      <SurfaceCard padding="sm" className="space-y-3 rounded-[18px]">
        <div className="flex items-start gap-2.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-primary/10 text-sm font-bold text-primary">
            {initials}
          </div>
          <div className="min-w-0 space-y-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Cuenta comercial</p>
            <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">{accountName}</h3>
            <p className="text-[12px] text-muted-foreground">{contactName || "Sin contacto principal"}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Badge key={tag.label} variant={tag.tone}>
              {tag.label}
            </Badge>
          ))}
        </div>

        <div className="space-y-2 text-[12px]">
          <IdentityLine icon={UserRoundCheck} label="Ejecutivo" value={executiveName} />
          {email ? <IdentityLine icon={Mail} label="Email" value={email} /> : null}
          {phone ? <IdentityLine icon={Phone} label="Telefono" value={phone} /> : null}
          {location ? <IdentityLine icon={MapPin} label="Ubicacion" value={location} /> : null}
        </div>
      </SurfaceCard>

      <SurfaceCard tone="subtle" padding="sm" className="space-y-2 rounded-[18px]">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          <Building2 className="h-3 w-3" />
          Identidad y datos base
        </div>
        <div className="grid gap-2">
          {fields.map((field) => (
            <div key={field.label} className="rounded-[14px] border border-border/60 bg-card px-2.5 py-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{field.label}</p>
              <p className="mt-0.5 text-[12px] text-foreground">{field.value}</p>
            </div>
          ))}
        </div>
      </SurfaceCard>

      <SurfaceCard tone="subtle" padding="sm" className="space-y-1 rounded-[18px]">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          <Tags className="h-3 w-3" />
          Lectura rapida
        </div>
        <p className="text-[12px] leading-5 text-muted-foreground">
          La columna izquierda consolida identidad, responsable y contexto base. La operacion comercial vive en la columna central.
        </p>
      </SurfaceCard>
    </div>
  );
}

interface IdentityLineProps {
  icon: typeof User2;
  label: string;
  value: string;
}

function IdentityLine({ icon: Icon, label, value }: IdentityLineProps) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-[14px] bg-secondary text-foreground">
        <Icon className="h-3 w-3" />
      </div>
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <p className="text-[12px] text-foreground">{value}</p>
      </div>
    </div>
  );
}
