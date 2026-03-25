export interface Product {
  id: number;
  name: string;
  description: string;
  image: string;
  cost_price: number;
  category: string;
  stock: number;
}

export const products: Product[] = [
  {
    id: 1,
    name: "Servidor Empresarial X100",
    description: "Servidor de rack 1U con 64GB RAM y 2TB SSD para cargas críticas.",
    image: "https://via.placeholder.com/320x200.png?text=Servidor+X100",
    cost_price: 12500,
    category: "Infraestructura",
    stock: 10,
  },
  {
    id: 2,
    name: "Switch PoE 24 Puertos",
    description: "Switch gestionado para redes con soporte PoE+ y monitoreo avanzado.",
    image: "https://via.placeholder.com/320x200.png?text=Switch+PoE",
    cost_price: 3200,
    category: "Redes",
    stock: 15,
  },
  {
    id: 3,
    name: "Laptop Corporativa 15",
    description: "Notebook empresarial con CPU i7, 16GB RAM y SSD 512GB.",
    image: "https://via.placeholder.com/320x200.png?text=Laptop+15",
    cost_price: 2800,
    category: "Equipamiento",
    stock: 8,
  },
  {
    id: 4,
    name: "Firewall UTM Avanzado",
    description: "Appliance de seguridad con IPS, VPN y filtrado de aplicaciones.",
    image: "https://via.placeholder.com/320x200.png?text=Firewall+UTM",
    cost_price: 7600,
    category: "Seguridad",
    stock: 5,
  },
  {
    id: 5,
    name: "Backup NAS 20TB",
    description: "Almacenamiento en red para copias de respaldo con RAID 6.",
    image: "https://via.placeholder.com/320x200.png?text=NAS+20TB",
    cost_price: 5900,
    category: "Infraestructura",
    stock: 12,
  },
  {
    id: 6,
    name: "Estación de Trabajo de Diseño",
    description: "PC de alto rendimiento para CAD y render con GPU profesional.",
    image: "https://via.placeholder.com/320x200.png?text=Workstation",
    cost_price: 14500,
    category: "Equipamiento",
    stock: 6,
  },
  {
    id: 7,
    name: "Punto de Acceso WiFi 6",
    description: "Acceso inalámbrico de alta velocidad para oficinas con cobertura extendida.",
    image: "https://via.placeholder.com/320x200.png?text=WiFi+6",
    cost_price: 1850,
    category: "Redes",
    stock: 20,
  },
];
