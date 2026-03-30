import { describe, expect, it } from "vitest";
import { contactRequestSchema, createOrderSchema } from "../../api/_shared/schemas";

describe("api schemas", () => {
  it("accepts a valid contact payload", () => {
    const result = contactRequestSchema.safeParse({
      name: "Nicolas Perez",
      email: "nico@example.com",
      message: "Necesito una propuesta para renovar la infraestructura.",
      subject: "Consulta comercial",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an order payload without products", () => {
    const result = createOrderSchema.safeParse({
      client_id: "client-1",
      products: [],
      total: 1200,
    });

    expect(result.success).toBe(false);
  });
});
