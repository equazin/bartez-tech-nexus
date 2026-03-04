import { MessageCircle } from "lucide-react";
import { motion } from "framer-motion";

const WhatsAppButton = () => {
  const message = encodeURIComponent("Hola, quiero hacer una consulta sobre soluciones tecnológicas para empresas.");

  return (
    <motion.a
      href={`https://wa.me/5493415104902?text=${message}`}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ delay: 1, type: "spring", bounce: 0.4 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg"
      style={{ backgroundColor: "hsl(142 70% 45%)", color: "hsl(0 0% 100%)" }}
      aria-label="Contactar por WhatsApp"
    >
      <MessageCircle size={26} />
    </motion.a>
  );
};

export default WhatsAppButton;
