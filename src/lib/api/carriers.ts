/**
 * Logistics & Carrier Integration Module (Mocked/Structure)
 * Handles rate calculation for Andreani, OCA, and Correo Argentino.
 */

export type CarrierId = "andreani" | "oca" | "correo_arg";

export interface RateRequest {
  zipCode: string;
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  declaredValue: number;
}

export interface RateResponse {
  carrierId: CarrierId;
  name: string;
  service: string;
  cost: number;
  estimatedDays: number;
  active: boolean;
}

/**
 * Mock carrier rates based on ZIP code and weight.
 * In production: fetch(`/api/shipping/rates?zip=${zip}&weight=${weight}`)
 */
export async function fetchShippingRates(req: RateRequest): Promise<RateResponse[]> {
  console.log(`[Carriers] Fetching rates for ZIP ${req.zipCode}, Weight ${req.weightKg}kg`);

  // Basic mock logic: cost increases with weight and distance
  // (Assuming distant ZIP codes start with numbers other than 1)
  const isCabaOrGba = req.zipCode.startsWith("1") || req.zipCode.startsWith("B1");
  const basePrice = isCabaOrGba ? 3500 : 7500;
  const weightFactor = req.weightKg * 800;

  return [
    {
      carrierId: "andreani",
      name: "Andreani",
      service: "E-commerce Estándar (Domicilio)",
      cost: basePrice + weightFactor,
      estimatedDays: isCabaOrGba ? 2 : 4,
      active: true,
    },
    {
      carrierId: "oca",
      name: "OCA",
      service: "Estándar a Sucursal",
      cost: (basePrice + weightFactor) * 0.9,
      estimatedDays: isCabaOrGba ? 3 : 5,
      active: true,
    },
    {
      carrierId: "correo_arg",
      name: "Correo Argentino",
      service: "Paq.ar Clásico",
      cost: (basePrice + weightFactor) * 0.85,
      estimatedDays: isCabaOrGba ? 4 : 7,
      active: true,
    }
  ];
}

/**
 * Creates a shipping label / tracking number (Mock).
 */
export async function createShippingLabel(carrierId: CarrierId, orderId: string): Promise<string> {
  console.log(`[Carriers] Creating ${carrierId} label for Order ${orderId}`);
  // In reality: call carrier API
  const prefix = carrierId === "andreani" ? "AM" : (carrierId === "oca" ? "OC" : "CA");
  return `${prefix}${Math.floor(Math.random() * 1000000000).toString()}`;
}
