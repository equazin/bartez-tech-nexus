import { Suspense, lazy, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RouteLoading } from "@/components/RouteLoading";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ImpersonateProvider } from "@/context/ImpersonateContext";
import { CurrencyProvider } from "@/context/CurrencyContext";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { refreshUTMs, track, getOrCreateSession } from "@/lib/marketingTracker";

const Index = lazy(() => import("./pages/Index"));
const Products = lazy(() => import("./pages/Products"));
const CorporateSolutions = lazy(() => import("./pages/CorporateSolutions"));
const ITServices = lazy(() => import("./pages/ITServices"));
const B2BSolutions = lazy(() => import("./pages/B2BSolutions"));
const IndustrySolutions = lazy(() => import("./pages/IndustrySolutions"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const B2BPortal = lazy(() => import("./pages/B2BPortal"));
const CartPage = lazy(() => import("./pages/CartPage"));
const QuoteRequest = lazy(() => import("./pages/QuoteRequest"));
const Admin = lazy(() => import("./pages/Admin"));
const CustomerView = lazy(() => import("./pages/CustomerView"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

// ── Route Tracker ─────────────────────────────────────────────
// Registra page_view en cada cambio de ruta y actualiza UTMs activos.
// Debe vivir DENTRO de BrowserRouter para poder usar useLocation.
const EMPRESAS_PATHS = new Set(["/empresas", "/partnership", "/soluciones-corporativas"]);

function RouteTracker() {
  const location = useLocation();
  const { session } = useAuth();

  useEffect(() => {
    // Asegurar sesión activa y capturar UTMs para esta navegación
    getOrCreateSession();
    refreshUTMs();

    const userId = session?.user?.id ?? null;
    const path   = location.pathname;

    void track("page_view", { path }, userId);

    // Evento especial para páginas de conversión empresarial
    if (EMPRESAS_PATHS.has(path)) {
      void track("landing_empresas_view", { path }, userId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return null;
}

const RequireAuth = ({ children }: { children: JSX.Element }) => {
  const { session, profile, loading } = useAuth();
  if (loading && !session) return <RouteLoading />;
  if (!session) return <Navigate to="/login" replace />;
  if (profile && profile.active === false && profile.role !== "admin" && profile.role !== "vendedor") {
    return <Navigate to="/login" replace state={{ inactive: true }} />;
  }
  return children;
};

const RequireAdmin = ({ children }: { children: JSX.Element }) => {
  const { session, isAdmin, loading } = useAuth();
  if (loading && !session) return <RouteLoading />;
  if (!isAdmin) return <Navigate to="/login" replace />;
  return children;
};

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
                <Suspense fallback={<RouteLoading />}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/tecnologia" element={<Products />} />
                    <Route path="/productos" element={<Products />} />
                    <Route path="/soluciones-corporativas" element={<CorporateSolutions />} />
                    <Route path="/servicios-it" element={<ITServices />} />
                    <Route path="/partnership" element={<B2BSolutions />} />
                    <Route path="/empresas" element={<B2BSolutions />} />
                    <Route path="/soluciones-por-industria" element={<IndustrySolutions />} />
                    <Route path="/nosotros" element={<About />} />
                    <Route path="/contacto" element={<Contact />} />
                    <Route path="/evaluacion-tecnologica" element={<QuoteRequest />} />
                    <Route path="/cotizacion" element={<QuoteRequest />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/registrarse" element={<Register />} />
                    <Route path="/b2b-portal" element={<RequireAuth><B2BPortal /></RequireAuth>} />
                    <Route path="/cotizaciones" element={<Navigate to="/b2b-portal?tab=cuenta&section=quotes" replace />} />
                    <Route path="/cotizador" element={<Navigate to="/b2b-portal?tab=cuenta&section=express" replace />} />
                    <Route path="/pagos" element={<Navigate to="/b2b-portal?tab=cuenta&section=payments" replace />} />
                    <Route path="/cart" element={<RequireAuth><CartPage /></RequireAuth>} />
                    <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
                    <Route path="/clientes/:id" element={<RequireAdmin><CustomerView /></RequireAdmin>} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
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
