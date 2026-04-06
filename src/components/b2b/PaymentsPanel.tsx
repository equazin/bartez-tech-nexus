import { useState, useEffect } from "react";
import {
  Upload,
  History,
  FileText,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Plus,
  Loader2,
  Search,
  Check,
  ChevronRight,
  ArrowRight,
  Receipt,
  ClipboardList
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { SurfaceCard } from "@/components/ui/surface-card";
import { MetricCard } from "@/components/ui/metric-card";
import { useToast } from "@/components/ui/use-toast";
import { fetchMyPayments, uploadPaymentProof, submitPayment, type PaymentRecord } from "@/lib/api/payments";
import { formatMoneyAmount } from "@/lib/money";
import type { PortalOrder } from "@/hooks/useOrders";
import type { Invoice } from "@/lib/api/invoices";
import type { UserProfile } from "@/lib/supabase";

interface PaymentsPanelProps {
  profile: UserProfile;
  orders: PortalOrder[];
  invoices: Invoice[];
  isDark: boolean;
}

export function PaymentsPanel({ profile, orders, invoices, isDark }: PaymentsPanelProps) {
  const [activeTab, setActiveTab] = useState("nuevo");
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    amount: "",
    currency: "USD" as "ARS" | "USD",
    payment_date: new Date().toISOString().split("T")[0],
    payment_method: "transferencia" as "transferencia" | "deposito" | "efectivo" | "echeq" | "otro",
    reference: "",
    order_id: "",
    invoice_id: "",
    notes: "",
    echeq_count: "1",
    echeq_dates: [new Date().toISOString().split("T")[0]] as string[],
  });
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    loadPayments();
  }, []);

  async function loadPayments() {
    try {
      setIsLoading(true);
      const data = await fetchMyPayments();
      setPayments(data);
    } catch (err) {
      console.error("Error loading payments:", err);
    } finally {
      setIsLoading(false);
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > 5 * 1024 * 1024) {
        toast({
          title: "Archivo demasiado grande",
          description: "Mínimo 5MB. Por favor, subí una versión más liviana.",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile.id) return;
    if (!file) {
      toast({
        title: "Falta el comprobante",
        description: "Por favor, adjuntá la imagen o PDF del pago.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      
      // 1. Upload proof
      const fileUrl = await uploadPaymentProof(file, profile.id);

      // 2. Submit payment
      await submitPayment({
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        payment_date: formData.payment_date,
        payment_method: formData.payment_method,
        reference: formData.reference,
        order_id: formData.order_id ? parseInt(formData.order_id) : null,
        invoice_id: formData.invoice_id || null,
        notes: formData.notes,
        file_url: fileUrl,
        echeq_details: formData.payment_method === "echeq" ? {
          count: parseInt(formData.echeq_count),
          dates: formData.echeq_dates,
        } : null,
      }, {
        id: profile.id,
        name: profile.company_name || profile.contact_name || "Cliente"
      });

      toast({
        title: "¡Comprobante enviado!",
        description: "Ventas revisará la información en breve.",
      });

      // Clear form
      setFormData({
        amount: "",
        currency: "USD",
        payment_date: new Date().toISOString().split("T")[0],
        payment_method: "transferencia",
        reference: "",
        order_id: "",
        invoice_id: "",
        notes: "",
        echeq_count: "1",
        echeq_dates: [new Date().toISOString().split("T")[0]],
      });
      setFile(null);
      
      // Refresh history & switch tab
      await loadPayments();
      setActiveTab("historial");

    } catch (err) {
      console.error("Submit error:", err);
      toast({
        title: "Error al cargar pago",
        description: err instanceof Error ? err.message : "Intentalo de nuevo",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pendiente":
        return <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-amber-500">Pendiente</Badge>;
      case "validado":
        return <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-500">Validado</Badge>;
      case "rechazado":
        return <Badge variant="outline" className="border-destructive/20 bg-destructive/10 text-destructive">Rechazado</Badge>;
      default:
        return null;
    }
  };

  const pendingAmount = payments
    .filter(p => p.status === "pendiente")
    .reduce((sum, p) => sum + (p.currency === "ARS" ? p.amount / 1000 : p.amount), 0); // Simplified for metric

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid gap-3 sm:grid-cols-2">
        <MetricCard
          label="Pagos en proceso"
          value={String(payments.filter(p => p.status === "pendiente").length)}
          detail="Esperando validación"
          icon={<Loader2 className="h-4 w-4" />}
        />
        <MetricCard
          label="Último pago registrado"
          value={payments.length > 0 ? formatMoneyAmount(payments[0].amount, payments[0].currency, 0) : "—"}
          detail={payments.length > 0 ? new Date(payments[0].payment_date).toLocaleDateString("es-AR") : "Sin movimientos"}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="nuevo" className="gap-2">
            <Plus size={14} /> Subir comprobante
          </TabsTrigger>
          <TabsTrigger value="historial" className="gap-2">
            <History size={14} /> Historial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="nuevo">
          <SurfaceCard padding="lg">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="amount">Monto</Label>
                  <div className="flex gap-2">
                    <Select 
                      value={formData.currency} 
                      onValueChange={(v: "ARS" | "USD") => setFormData({...formData, currency: v})}
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue placeholder="USD" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="ARS">ARS</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={formData.amount}
                      onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Fecha de pago</Label>
                  <Input
                    id="date"
                    type="date"
                    required
                    value={formData.payment_date}
                    onChange={(e) => setFormData({...formData, payment_date: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="method">Medio de pago</Label>
                  <Select 
                    value={formData.payment_method} 
                    onValueChange={(v: any) => setFormData({...formData, payment_method: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Transferencia" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="transferencia">Transferencia Bancaria</SelectItem>
                      <SelectItem value="deposito">Depósito</SelectItem>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="echeq">Echeck (Cheque Electrónico)</SelectItem>
                      <SelectItem value="otro">Otro medio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.payment_method === "echeq" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="echeq_count">Cantidad de Echecks</Label>
                      <Select 
                        value={formData.echeq_count} 
                        onValueChange={(v) => {
                          const count = parseInt(v);
                          const newDates = [...formData.echeq_dates];
                          if (count > newDates.length) {
                            for (let i = newDates.length; i < count; i++) {
                              newDates.push(new Date().toISOString().split("T")[0]);
                            }
                          } else {
                            newDates.splice(count);
                          }
                          setFormData({...formData, echeq_count: v, echeq_dates: newDates});
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="1" />
                        </SelectTrigger>
                        <SelectContent>
                          {[1,2,3,4,5,6,7,8,9,10].map(n => (
                            <SelectItem key={n} value={String(n)}>{n} {n === 1 ? 'Echeq' : 'Echeqs'}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="sm:col-span-2 space-y-3 p-4 border rounded-xl bg-muted/30">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Fechas de cobro por cada Echeck</Label>
                      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                        {formData.echeq_dates.map((date, idx) => (
                          <div key={idx} className="space-y-1">
                            <Label htmlFor={`echeq-date-${idx}`} className="text-[10px]">Fecha Echeq {idx + 1}</Label>
                            <Input
                              id={`echeq-date-${idx}`}
                              type="date"
                              required
                              value={date}
                              onChange={(e) => {
                                const newDates = [...formData.echeq_dates];
                                newDates[idx] = e.target.value;
                                setFormData({...formData, echeq_dates: newDates});
                              }}
                              className="h-8 text-xs"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="reference">Número de referencia / operación</Label>
                  <Input
                    id="reference"
                    placeholder="Ej: 49583020"
                    value={formData.reference}
                    onChange={(e) => setFormData({...formData, reference: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="order">Vincular a pedido (Opcional)</Label>
                  <Select 
                    value={formData.order_id} 
                    onValueChange={(v) => setFormData({...formData, order_id: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar pedido" />
                    </SelectTrigger>
                    <SelectContent>
                      {orders.map(o => (
                        <SelectItem key={o.id} value={String(o.id)}>
                          Pedido {o.order_number || `#${String(o.id).slice(-6)}`} — {formatMoneyAmount(o.total, "USD", 0)}
                        </SelectItem>
                      ))}
                      {orders.length === 0 && <SelectItem value="_" disabled>No tenés pedidos recientes</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invoice">Vincular a factura (Opcional)</Label>
                  <Select 
                    value={formData.invoice_id} 
                    onValueChange={(v) => setFormData({...formData, invoice_id: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar factura" />
                    </SelectTrigger>
                    <SelectContent>
                      {invoices.map(i => (
                        <SelectItem key={i.id} value={i.id}>
                          Factura {i.invoice_number} — {formatMoneyAmount(i.total, i.currency, 0)}
                        </SelectItem>
                      ))}
                      {invoices.length === 0 && <SelectItem value="_" disabled>No hay facturas pendientes</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Observaciones adicionales</Label>
                <Textarea
                  id="notes"
                  placeholder="Información extra para administración..."
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label>Comprobante (Imagen o PDF)</Label>
                <div className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-2xl transition-colors ${file ? 'border-primary/50 bg-primary/5' : 'border-border/70 hover:border-primary/30'}`}>
                  <div className="space-y-1 text-center">
                    <Upload className={`mx-auto h-12 w-12 ${file ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div className="flex text-sm text-muted-foreground">
                      <label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-medium text-primary hover:underline">
                        <span>{file ? file.name : "Subí un archivo"}</span>
                        <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/*,application/pdf" onChange={handleFileChange} />
                      </label>
                      {!file && <p className="pl-1">o arrastrá y soltá</p>}
                    </div>
                    <p className="text-xs text-muted-foreground">PNG, JPG, PDF hasta 5MB</p>
                  </div>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full gap-2 py-6 rounded-2xl text-base shadow-lg shadow-primary/20"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <><Loader2 className="animate-spin h-5 w-5" /> Enviando...</>
                ) : (
                  <><CheckCircle2 className="h-5 w-5" /> Enviar comprobante de pago</>
                )}
              </Button>
            </form>
          </SurfaceCard>
        </TabsContent>

        <TabsContent value="historial">
          <SurfaceCard padding="none">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Referencia</TableHead>
                    <TableHead>Vínculo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Comprobante</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{new Date(p.payment_date).toLocaleDateString("es-AR")}</TableCell>
                      <TableCell>{formatMoneyAmount(p.amount, p.currency, 0)}</TableCell>
                      <TableCell className="text-muted-foreground">{p.reference || "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {p.order_id && (
                            <span className="text-xs flex items-center gap-1 text-muted-foreground">
                              <ClipboardList size={10} /> Pedido #{String(p.order_id).slice(-4)}
                            </span>
                          )}
                          {p.invoice_id && (
                            <span className="text-xs flex items-center gap-1 text-muted-foreground">
                              <Receipt size={10} /> Factura vinculada
                            </span>
                          )}
                          {!p.order_id && !p.invoice_id && <span className="text-xs text-muted-foreground italic">Manual</span>}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(p.status)}</TableCell>
                      <TableCell className="text-right">
                        {p.file_url ? (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={p.file_url} target="_blank" rel="noopener noreferrer" className="gap-1.5 h-8">
                              Ver <ExternalLink size={12} />
                            </a>
                          </Button>
                        ) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && payments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                        <History className="h-8 w-8 mx-auto mb-2 opacity-20" />
                        No tenés pagos registrados
                      </TableCell>
                    </TableRow>
                  )}
                  {isLoading && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center">
                        <Loader2 className="animate-spin h-6 w-6 mx-auto" />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </SurfaceCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
