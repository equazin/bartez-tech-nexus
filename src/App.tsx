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

const Index = lazy(() => import("./pages/Index"));
const Products = lazy(() => import("./pages/Products"));
const PointOfSale = lazy(() => import("./pages/PointOfSale"));
const CorporateSolutions = lazy(() => import("./pages/CorporateSolutions"));
const ITServices = lazy(() => import("./pages/ITServices"));
const B2BSolutions = lazy(() => import("./pages/B2BSolutions"));
const IndustrySolutions = lazy(() => import("./pages/IndustrySolutions"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const CartPage = lazy(() => import("./pages/CartPage"));
const QuoteRequest = lazy(() => import("./pages/QuoteRequest"));
const Admin = lazy(() => import("./pages/Admin"));
const CustomerView = lazy(() => import("./pages/CustomerView"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));
const StyleguidePage = lazy(() => import("./pages/portal/StyleguidePage"));
const PortalRoot = lazy(() => import("./pages/portal/PortalRoot"));
const PortalHomePage = lazy(() => import("./pages/portal/HomePage"));
const PortalCatalogPage = lazy(() => import("./pages/portal/CatalogPage"));
const PortalBundlesPage = lazy(() => import("./pages/portal/BundlesPage"));
const PortalConfiguratorPage = lazy(() => import("./pages/portal/ConfiguratorPage"));
const PortalOrdersPage = lazy(() => import("./pages/portal/OrdersPage"));
const PortalQuotesPage = lazy(() => import("./pages/portal/QuotesPage"));
const PortalProjectsPage = lazy(() => import("./pages/portal/ProjectsPage"));
const PortalRmaPage = lazy(() => import("./pages/portal/RmaPage"));
const PortalBulkImportPage = lazy(() => import("./pages/portal/BulkImportPage"));
const PortalExpressQuotePage = lazy(() => import("./pages/portal/ExpressQuotePage"));
const PortalProductDetailPage = lazy(() => import("./pages/portal/ProductDetailPage"));
const PortalCompareProductsPage = lazy(() => import("./pages/portal/CompareProductsPage"));
const PortalAccountSummaryPage = lazy(() => import("./pages/portal/account/AccountSummaryPage"));
const PortalDocumentsPage = lazy(() => import("./pages/portal/account/DocumentsPage"));
const PortalReportsPage = lazy(() => import("./pages/portal/account/ReportsPage"));
const PortalCreditPage = lazy(() => import("./pages/portal/account/CreditPage"));
const PortalListsPage = lazy(() => import("./pages/portal/account/ListsPage"));
const PortalRecurringPage = lazy(() => import("./pages/portal/account/RecurringOrdersPage"));
const PortalCompanyPage = lazy(() => import("./pages/portal/account/CompanyPage"));
const PortalAccountSupportPage = lazy(() => import("./pages/portal/account/SupportPage"));
const PortalApprovalsPageV2 = lazy(() => import("./pages/portal/ApprovalsPageV2"));

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
  const { session, isAdmin, loading } = useAuth();
  const isAdminRoute = location.pathname === "/admin";
  const [hasVisitedAdmin, setHasVisitedAdmin] = useState(false);

  useEffect(() => {
    if (isAdminRoute && session && isAdmin) setHasVisitedAdmin(true);
  }, [isAdmin, isAdminRoute, session]);

  if (loading || !session || !isAdmin || (!isAdminRoute && !hasVisitedAdmin)) {
    return null;
  }

  return (
    <div
      aria-hidden={!isAdminRoute}
      className={isAdminRoute ? "block" : "hidden"}
    >
      <Suspense fallback={isAdminRoute ? <RouteLoading /> : null}>
        <Admin />
      </Suspense>
    </div>
  );
}

// Maps legacy /b2b-portal?tab=... URLs to the new /portal/* routes.
// Anything we don't explicitly map falls through to /portal (Home).
const LEGACY_TAB_TO_PATH: Record<string, string> = {
  home: "/portal",
  catalog: "/portal/catalogo",
  bundles: "/portal/catalogo/bundles",
  configurator: "/portal/catalogo/configurador",
  builder: "/portal/catalogo/configurador",
  orders: "/portal/pedidos",
  approvals: "/portal/pedidos/aprobar",
  bulk: "/portal/pedidos/bulk",
  quotes: "/portal/cotizaciones",
  express: "/portal/cotizaciones/express",
  invoices: "/portal/cuenta/documentos",
  rma: "/portal/pedidos/rma",
  projects: "/portal/pedidos/proyectos",
  cuenta: "/portal/cuenta",
  support: "/portal/cuenta/soporte",
};

function LegacyPortalRedirect() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const tab = params.get("tab");

  // /catalogo (no query) → /portal/catalogo
  if (location.pathname === "/catalogo") {
    return <Navigate to={`/portal/catalogo${location.search}`} replace />;
  }

  // /b2b-portal?tab=… → mapped path; preserve other query params (category, product, etc.)
  const target = (tab && LEGACY_TAB_TO_PATH[tab]) ?? "/portal";
  // Keep search params except `tab` so deep-links like ?category=cpu still work in the new pages.
  params.delete("tab");
  const search = params.toString();
  return <Navigate to={search ? `${target}?${search}` : target} replace />;
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
                    <Route path="/" element={<Index />} />
                    <Route path="/tecnologia" element={<Products />} />
                    <Route path="/productos" element={<Products />} />
                    <Route path="/soluciones-corporativas" element={<CorporateSolutions />} />
                    <Route path="/servicios-it" element={<ITServices />} />
                    <Route path="/partnership" element={<B2BSolutions />} />
                    <Route path="/empresas" element={<B2BSolutions />} />
                    <Route path="/soluciones-por-industria" element={<IndustrySolutions />} />
                    <Route path="/puntos-de-venta" element={<PointOfSale />} />
                    <Route path="/nosotros" element={<About />} />
                    <Route path="/contacto" element={<Contact />} />
                    <Route path="/evaluacion-tecnologica" element={<QuoteRequest />} />
                    <Route path="/cotizacion" element={<QuoteRequest />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/registrarse" element={<Register />} />
                    <Route path="/b2b-portal" element={<RequireAuth><LegacyPortalRedirect /></RequireAuth>} />
                    <Route path="/catalogo" element={<RequireAuth><LegacyPortalRedirect /></RequireAuth>} />
                    <Route path="/armador-pc" element={<Navigate to="/portal/catalogo/configurador" replace />} />
                    <Route path="/cotizaciones" element={<Navigate to="/portal/cotizaciones" replace />} />
                    <Route path="/cotizador" element={<Navigate to="/portal/cotizaciones/express" replace />} />
                    <Route path="/pagos" element={<Navigate to="/portal/cuenta/documentos" replace />} />
                    <Route path="/portal/__styleguide" element={<RequireAuth><StyleguidePage /></RequireAuth>} />
                    <Route path="/portal" element={<RequireAuth><PortalRoot /></RequireAuth>}>
                      <Route index element={<PortalHomePage />} />
                      <Route path="catalogo" element={<PortalCatalogPage />} />
                      <Route path="catalogo/bundles" element={<PortalBundlesPage />} />
                      <Route path="catalogo/configurador" element={<PortalConfiguratorPage />} />
                      <Route path="pedidos" element={<PortalOrdersPage />} />
                      <Route path="pedidos/aprobar" element={<PortalApprovalsPageV2 />} />
                      <Route path="pedidos/bulk" element={<PortalBulkImportPage />} />
                      <Route path="pedidos/rma" element={<PortalRmaPage />} />
                      <Route path="pedidos/proyectos" element={<PortalProjectsPage />} />
                      <Route path="cotizaciones" element={<PortalQuotesPage />} />
                      <Route path="cotizaciones/express" element={<PortalExpressQuotePage />} />
                      <Route path="cuenta" element={<PortalAccountSummaryPage />} />
                      <Route path="cuenta/documentos" element={<PortalDocumentsPage />} />
                      <Route path="cuenta/credito" element={<PortalCreditPage />} />
                      <Route path="cuenta/listas" element={<PortalListsPage />} />
                      <Route path="cuenta/reposicion" element={<PortalRecurringPage />} />
                      <Route path="cuenta/reportes" element={<PortalReportsPage />} />
                      <Route path="cuenta/empresa" element={<PortalCompanyPage />} />
                      <Route path="cuenta/soporte" element={<PortalAccountSupportPage />} />
                      {/* Legacy redirects to new structure */}
                      <Route path="cuenta/usuarios" element={<Navigate to="/portal/cuenta/empresa?tab=usuarios" replace />} />
                      <Route path="cuenta/sucursales" element={<Navigate to="/portal/cuenta/empresa?tab=sucursales" replace />} />
                      <Route path="cuenta/rma" element={<Navigate to="/portal/pedidos/rma" replace />} />
                      <Route path="cuenta/proyectos" element={<Navigate to="/portal/pedidos/proyectos" replace />} />
                      <Route path="cuenta/lealtad" element={<Navigate to="/portal/cuenta" replace />} />
                      <Route path="cuenta/notificaciones" element={<Navigate to="/portal/cuenta/empresa?tab=perfil" replace />} />
                      <Route path="soporte" element={<Navigate to="/portal/cuenta/soporte" replace />} />
                      <Route path="p/:slug" element={<PortalProductDetailPage />} />
                      <Route path="comparar" element={<PortalCompareProductsPage />} />
                    </Route>
                    <Route path="/cart" element={<RequireAuth><CartPage /></RequireAuth>} />
                    <Route path="/admin" element={<RequireAdmin><AdminRoutePlaceholder /></RequireAdmin>} />
                    <Route path="/clientes/:id" element={<RequireAdmin><CustomerView /></RequireAdmin>} />
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
