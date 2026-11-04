import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tienda } from "@/components/tienda/Tienda";
import { ResumenDeCompra } from "@/components/tienda/ResumenDeCompra";
import { buscarPedido, type PedidoPublico } from "@/lib/tienda/pedidos";
import { usarSeo } from "@/lib/tienda/seo";

export default function Seguimiento() {
  usarSeo("Seguir mi compra");
  const [email, setEmail] = useState("");
  const [numero, setNumero] = useState("");
  const [pedido, setPedido] = useState<PedidoPublico | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function buscar(evento: FormEvent) {
    evento.preventDefault();
    if (!email.trim() || !numero.trim()) {
      setMensaje("Completá el email y el número de pedido.");
      return;
    }
    setBuscando(true);
    setMensaje(null);
    setPedido(null);
    try {
      const encontrado = await buscarPedido(email, numero);
      if (!encontrado) setMensaje("No encontramos una compra con esos datos. Revisá el número (empieza con ORD) y el email que usaste.");
      setPedido(encontrado);
    } catch (e: unknown) {
      setMensaje(e instanceof Error ? e.message : "No se pudo buscar la compra.");
    } finally {
      setBuscando(false);
    }
  }

  return (
    <Tienda>
      <div className="container mx-auto space-y-8 px-4 py-8">
        <div className="space-y-2">
          <h1 className="text-[28px] font-bold leading-[34px] tracking-[-0.5px]">Seguir mi compra</h1>
          <p className="text-muted-foreground">Sin cuenta: con el email que usaste y el número de pedido que te mandamos.</p>
        </div>
        <form onSubmit={buscar} className="grid grid-cols-1 max-w-xl gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Email</span>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Número de pedido</span>
            <Input value={numero} onChange={(e) => setNumero(e.target.value.toUpperCase())} placeholder="ORD-0001" />
          </label>
          <Button type="submit" disabled={buscando}>
            {buscando ? "Buscando" : "Buscar"}
          </Button>
        </form>
        {mensaje && <p className="max-w-xl rounded-xl bg-secondary p-4 text-sm">{mensaje}</p>}
        {pedido && <ResumenDeCompra pedido={pedido} />}
      </div>
    </Tienda>
  );
}
