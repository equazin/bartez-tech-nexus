export interface AirProduct {
  product_id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category_id: string;
  category_name: string;
}

interface AirApiConfig {
  baseUrl: string;
  apiKey: string;
}

interface AirProductsResponse {
  products: AirProduct[];
  total: number;
  page: number;
  per_page: number;
}

export class AirApiClient {
  private readonly config: AirApiConfig;

  constructor(config: AirApiConfig) {
    this.config = config;
  }

  async fetchProducts(page = 1, perPage = 100): Promise<AirProductsResponse> {
    const url = new URL(`${this.config.baseUrl}/products`);
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", String(perPage));

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `AIR API error ${response.status}: ${await response.text()}`
      );
    }

    return response.json() as Promise<AirProductsResponse>;
  }

  async *fetchAllProducts(perPage = 100): AsyncGenerator<AirProduct> {
    let page = 1;
    let fetched = 0;

    while (true) {
      const result = await this.fetchProducts(page, perPage);
      for (const product of result.products) {
        yield product;
        fetched++;
      }
      if (fetched >= result.total || result.products.length === 0) break;
      page++;
    }
  }
}

export function createAirClient(): AirApiClient {
  const baseUrl = process.env.AIR_API_URL;
  const apiKey = process.env.AIR_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error("Missing AIR_API_URL or AIR_API_KEY environment variables");
  }

  return new AirApiClient({ baseUrl, apiKey });
}
