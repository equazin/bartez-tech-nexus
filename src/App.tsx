import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { CurrencyProvider } from "@/context/CurrencyContext";
import Index from "./pages/Index";
import Products from "./pages/Products";
import CorporateSolutions from "./pages/CorporateSolutions";
import ITServices from "./pages/ITServices";
import B2BSolutions from "./pages/B2BSolutions";
import IndustrySolutions from "./pages/IndustrySolutions";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Login from "./pages/Login";
import B2BPortal from "./pages/B2BPortal";
import Cart from "./pages/Cart";
import QuoteRequest from "./pages/QuoteRequest";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const LoadingScreen = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
  </div>
);

const RequireAuth = ({ children }: { children: JSX.Element }) => {
  const { session, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!session) return <Navigate to="/login" replace />;
  return children;
};

const RequireAdmin = ({ children }: { children: JSX.Element }) => {
  const { isAdmin, loading } = useAuth();
  if (loading) return <LoadingScreen />;
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
            <Route path="/cart" element={<RequireAuth><Cart /></RequireAuth>} />
            <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </CurrencyProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
