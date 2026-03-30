import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RouteLoading } from "@/components/RouteLoading";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { CurrencyProvider } from "@/context/CurrencyContext";

const Index = lazy(() => import("./pages/Index"));
const Products = lazy(() => import("./pages/Products"));
const CorporateSolutions = lazy(() => import("./pages/CorporateSolutions"));
const ITServices = lazy(() => import("./pages/ITServices"));
const B2BSolutions = lazy(() => import("./pages/B2BSolutions"));
const IndustrySolutions = lazy(() => import("./pages/IndustrySolutions"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Login = lazy(() => import("./pages/Login"));
const B2BPortal = lazy(() => import("./pages/B2BPortal"));
const CartPage = lazy(() => import("./pages/CartPage"));
const QuoteRequest = lazy(() => import("./pages/QuoteRequest"));
const Admin = lazy(() => import("./pages/Admin"));
const CustomerView = lazy(() => import("./pages/CustomerView"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

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
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CurrencyProvider>
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
                <Route path="/b2b-portal" element={<RequireAuth><B2BPortal /></RequireAuth>} />
                <Route path="/cart" element={<RequireAuth><CartPage /></RequireAuth>} />
                <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
                <Route path="/clientes/:id" element={<RequireAdmin><CustomerView /></RequireAdmin>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </CurrencyProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
