/**
 * Banners diseñados para la portada del inicio (public/banners): cada uno con su versión para computadora
 * (2400 × 830) y para celular (1080 × 1080). El panel los ofrece en Marketing › Portada del inicio.
 */

export interface DisenoDeBanner {
  id: string;
  nombre: string;
  grupo: "Teqo" | "Eventos" | "Marcas";
  escritorio: string;
  movil: string;
  enlace: string;
}

const disenio = (id: string, nombre: string, grupo: DisenoDeBanner["grupo"], enlace: string): DisenoDeBanner => ({
  id,
  nombre,
  grupo,
  escritorio: `/banners/${id}.jpg`,
  movil: `/banners/${id}-movil.jpg`,
  enlace,
});

export const DISENOS_DE_BANNERS: DisenoDeBanner[] = [
  disenio("apertura", "Abrimos Teqo", "Teqo", "/notebooks"),
  disenio("subitumundo", "Subí tu mundo", "Teqo", "/notebooks"),
  disenio("transferencia", "Con transferencia pagás menos", "Teqo", "/ofertas"),
  disenio("armador", "Armá tu PC", "Teqo", "/arma-tu-pc"),
  disenio("gaming", "Más FPS. Menos excusas.", "Teqo", "/gaming"),
  disenio("notebooks", "Notebooks para estudiar y trabajar", "Teqo", "/notebooks"),
  disenio("perifericos", "Armá tu setup", "Teqo", "/perifericos"),
  disenio("monitores", "Más pantalla para jugar", "Teqo", "/monitores"),
  disenio("envios", "El mismo envío a todo el país", "Teqo", "/ofertas"),
  disenio("cyber", "Cyber Monday", "Eventos", "/ofertas"),
  disenio("cyberpodio", "Cyber Monday, ofertas en tecnología", "Eventos", "/ofertas"),
  disenio("hotsale", "Hot Sale", "Eventos", "/ofertas"),
  disenio("clases", "Vuelta a clases", "Eventos", "/notebooks"),
  disenio("fiestas", "Regalos de tecnología", "Eventos", "/perifericos"),
  disenio("padre", "Día del Padre", "Eventos", "/monitores"),
  disenio("marca-logitech", "Logitech G", "Marcas", "/buscar?q=Logitech"),
  disenio("marca-nvidia", "NVIDIA GeForce RTX", "Marcas", "/buscar?q=GeForce"),
  disenio("marca-amd", "AMD Ryzen y Radeon", "Marcas", "/buscar?q=AMD"),
  disenio("marca-intel", "Intel Core", "Marcas", "/buscar?q=Intel"),
  disenio("marca-kingston", "Kingston", "Marcas", "/buscar?q=Kingston"),
  disenio("marca-corsair", "Corsair", "Marcas", "/buscar?q=Corsair"),
  disenio("marca-asus", "ASUS", "Marcas", "/buscar?q=ASUS"),
  disenio("marca-lenovo", "Lenovo LOQ", "Marcas", "/buscar?q=Lenovo"),
  disenio("marca-msi", "MSI", "Marcas", "/buscar?q=MSI"),
  disenio("marca-gigabyte", "Gigabyte", "Marcas", "/buscar?q=Gigabyte"),
  disenio("marca-hp", "HP", "Marcas", "/buscar?q=HP"),
];
