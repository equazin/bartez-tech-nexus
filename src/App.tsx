import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Products from "./pages/Products";
import CorporateSolutions from "./pages/CorporateSolutions";
import ITServices from "./pages/ITServices";
import B2BSolutions from "./pages/B2BSolutions";
import About from "./pages/About";
import Contact from "./pages/Contact";
import QuoteRequest from "./pages/QuoteRequest";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/productos" element={<Products />} />
          <Route path="/soluciones-corporativas" element={<CorporateSolutions />} />
          <Route path="/servicios-it" element={<ITServices />} />
          <Route path="/empresas" element={<B2BSolutions />} />
          <Route path="/nosotros" element={<About />} />
          <Route path="/contacto" element={<Contact />} />
          <Route path="/cotizacion" element={<QuoteRequest />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
