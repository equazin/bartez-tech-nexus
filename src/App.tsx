import { Suspense, lazy, useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RouteLoading } from "@/components/RouteLoading";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RouteSeo } from "@/components/RouteSeo";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ImpersonateProvider } from "@/context/ImpersonateContext";
import { CurrencyProvider } from "@/context/CurrencyContext";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { refreshUTMs, track, getOrCreateSession } from "@/lib/marketingTracker";

// La tienda (consumidor final, sin cuenta)
const Inicio = lazy(() => import("./pages/tienda/Inicio"));
const Categoria = lazy(() => import("./pages/tienda/Categoria"));
const Producto = lazy(() => import("./pages/tienda/Producto"));
const Buscar = lazy(() => import("./pages/tienda/Buscar"));
const Coleccion = lazy(() => import("./pages/tienda/Coleccion"));
const Marcas = lazy(() => import("./pages/tienda/Marcas"));
const Carrito = lazy(() => import("./pages/tienda/Carrito"));
const Checkout = lazy(() => import("./pages/tienda/Checkout"));
const Compra = lazy(() => import("./pages/tienda/Compra"));
const Seguimiento = lazy(() => import("./pages/tienda/Seguimiento"));
const Arrepentimiento = lazy(() => import("./pages/tienda/Arrepentimiento"));
const Ayuda = lazy(() => import("./pages/tienda/Ayuda"));
const TextoLegal = lazy(() => import("./pages/tienda/TextoLegal"));
const SistemaDeDiseno = lazy(() => import("./pages/SistemaDeDiseno"));
const NotFound = lazy(() => import("./pages/NotFound"));

// El panel
const Login = lazy(() => import("./pages/Login"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Admin = lazy(() => import("./pages/Admin"));
const CustomerView = lazy(() => import("./pages/CustomerView"));

// Direcciones del sitio corporativo y del portal mayorista de Bartez: van al inicio.
// vercel.json redirige las públicas con 301 antes de llegar acá.
const RUTAS_VIEJAS = [
  "/tecnologia", "/productos", "/soluciones-corporativas", "/servicios-it", "/partnership", "/empresas",
  "/soluciones-por-industria", "/puntos-de-venta", "/nosotros", "/contacto", "/evaluacion-tecnologica", "/cotizacion",
  "/registrarse", "/b2b-portal", "/catalogo", "/armador-pc", "/cotizaciones", "/cotizador", "/pagos", "/portal", "/portal/*",
];

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

// Registra page_view en cada cambio de ruta y actualiza las UTM activas. Vive dentro de BrowserRouter.
function RouteTracker() {
  const location = useLocation();
  const { session } = useAuth();

  useEffect(() => {
    getOrCreateSession();
    refreshUTMs();
    void track("page_view", { path: location.pathname }, session?.user?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return null;
}

const RequireAdmin = ({ children }: { children: JSX.Element }) => {
  const { session, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) return <RouteLoading />;
  if (!session || !isAdmin) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
};

function AdminRoutePlaceholder() {
  return null;
}

function PersistentAdminShell() {
  const location = useLocation();
  const { session, isAdmin } = useAuth();
  const isAdminRoute = location.pathname === "/admin";
  const [hasVisitedAdmin, setHasVisitedAdmin] = useState(false);

  useEffect(() => {
    if (isAdminRoute && session && isAdmin) setHasVisitedAdmin(true);
  }, [isAdmin, isAdminRoute, session]);

  if (!session || !isAdmin || (!isAdminRoute && !hasVisitedAdmin)) {
    return null;
  }

  return (
    <div aria-hidden={!isAdminRoute} className={isAdminRoute ? "block" : "hidden"}>
      <Suspense fallback={isAdminRoute ? <RouteLoading /> : null}>
        <Admin />
      </Suspense>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <ImpersonateProvider>
              <CurrencyProvider>
                <ErrorBoundary>
                  <RouteTracker />
                  <RouteSeo />
                  <Suspense fallback={<RouteLoading />}>
                    <Routes>
                      <Route path="/" element={<Inicio />} />
                      <Route path="/buscar" element={<Buscar />} />
                      <Route path="/ofertas" element={<Coleccion tipo="ofertas" />} />
                      <Route path="/nuevos-ingresos" element={<Coleccion tipo="nuevos" />} />
                      <Route path="/marcas" element={<Marcas />} />
                      <Route path="/marcas/:marca" element={<Coleccion key="marca" tipo="marca" />} />
                      <Route path="/carrito" element={<Carrito />} />
                      <Route path="/cart" element={<Navigate to="/carrito" replace />} />
                      <Route path="/checkout" element={<Checkout />} />
                      <Route path="/compra/:id" element={<Compra />} />
                      <Route path="/seguimiento" element={<Seguimiento />} />
                      <Route path="/arrepentimiento" element={<Arrepentimiento />} />
                      <Route path="/ayuda" element={<Ayuda />} />
                      <Route path="/terminos" element={<TextoLegal tipo="terminos" />} />
                      <Route path="/privacidad" element={<TextoLegal tipo="privacidad" />} />
                      <Route path="/garantias" element={<TextoLegal tipo="garantias" />} />
                      {RUTAS_VIEJAS.map((ruta) => (
                        <Route key={ruta} path={ruta} element={<Navigate to="/" replace />} />
                      ))}
                      <Route path="/login" element={<Login />} />
                      <Route path="/reset-password" element={<ResetPassword />} />
                      <Route path="/admin" element={<RequireAdmin><AdminRoutePlaceholder /></RequireAdmin>} />
                      <Route path="/clientes/:id" element={<RequireAdmin><CustomerView /></RequireAdmin>} />
                      <Route path="/sistema-de-diseno" element={<SistemaDeDiseno />} />
                      <Route path="/:categoria" element={<Categoria />} />
                      <Route path="/:categoria/:producto" element={<Producto />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                    <PersistentAdminShell />
                  </Suspense>
                </ErrorBoundary>
              </CurrencyProvider>
            </ImpersonateProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
