import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { usarSeo } from "@/lib/tienda/seo";

export function NoEncontrado({ titulo = "No encontramos esta página", detalle }: { titulo?: string; detalle?: string }) {
  usarSeo(titulo);
  return (
    <div className="container mx-auto flex flex-col items-start gap-4 px-4 py-24">
      <h1 className="text-[28px] font-bold leading-[34px]">{titulo}</h1>
      <p className="max-w-prose text-muted-foreground">{detalle ?? "Puede que el enlace esté mal escrito o que el producto ya no esté en la tienda."}</p>
      <Button asChild>
        <Link to="/">Volver al inicio</Link>
      </Button>
    </div>
  );
}
