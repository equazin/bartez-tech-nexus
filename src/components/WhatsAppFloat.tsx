import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X } from "lucide-react";
import { useState } from "react";

const WA_URL = "https://wa.me/5493415104902?text=Hola%2C%20quiero%20hacer%20una%20consulta%20sobre%20soluciones%20tecnol%C3%B3gicas.";

export default function WhatsAppFloat() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="rounded-2xl border border-border/30 bg-card/95 backdrop-blur-sm shadow-2xl shadow-black/30 p-5 w-72"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                  <MessageCircle size={16} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground leading-tight">Bartez Tecnología</p>
                  <p className="text-[10px] text-green-500 font-medium">● En línea</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                <X size={14} />
              </button>
            </div>
            <div className="rounded-xl bg-muted/40 px-4 py-3 mb-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                👋 ¡Hola! ¿En qué podemos ayudarte hoy? Respondemos en minutos en horario hábil.
              </p>
            </div>
            <a href={WA_URL} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
              <button className="w-full rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-semibold py-2.5 transition-colors">
                Iniciar conversación
              </button>
            </a>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setOpen(o => !o)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className="h-14 w-14 rounded-full bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/30 flex items-center justify-center transition-colors"
        aria-label="Abrir chat de WhatsApp"
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <X size={22} className="text-white" />
            </motion.div>
          ) : (
            <motion.div key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <MessageCircle size={24} className="text-white" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
