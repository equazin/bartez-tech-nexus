

export interface InvidAuthResponse {
  status: number;
  access_token: string;
  token_type: string;
  expiration_time: number;
  username: string;
}

export interface InvidArticle {
  ID: string;
  TITLE: string;
  PRICE: string;
  CURRENCY: string;
  PART_NUMBER: string;
  BRAND: string;
  DESCRIPTION: string;
  LONG_DESCRIPTION: string;
  STOCK_STATUS: string;
  IMAGE_URL: string;
  CATEGORY_ID: string;
  CATEGORY: string;
  TAGS: Record<string, string[]>;
  HEIGHT: number;
  WIDTH: number;
  LENGTH: number;
  VOLUME: number;
  WEIGHT: number;
  DIMENSIONS_UNIT: string;
  WEIGHT_UNIT: string;
}

export interface InvidArticleResponse {
  status: number;
  data: InvidArticle[];
  next_page_url?: string;
}

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

export async function getInvidToken(): Promise<string | null> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const username = import.meta.env.VITE_INVID_USER || "bandres";
  const password = import.meta.env.VITE_INVID_PASSWORD || "Benitez_a";

  try {
    const res = await fetch("https://www.invidcomputers.com/api/v1/auth.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      console.error("INVID auth error:", res.status, await res.text());
      return null;
    }

    const data = await res.json() as InvidAuthResponse;
    if (data.status === 1 && data.access_token) {
      cachedToken = data.access_token;
      tokenExpiresAt = Date.now() + ((data.expiration_time || 3600) * 1000) - 60000;
      return cachedToken;
    }
    return null;
  } catch (err) {
    console.error("Failed to fetch INVID token", err);
    return null;
  }
}

export async function fetchInvidArticlesPage(offset = 0): Promise<InvidArticleResponse | null> {
  const token = await getInvidToken();
  if (!token) return null;

  try {
    const res = await fetch(`https://www.invidcomputers.com/api/v1/articulo.php?offset=${offset}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      console.error("INVID articles error:", res.status, await res.text());
      return null;
    }

    return await res.json() as InvidArticleResponse;
  } catch (err) {
    console.error("Failed to fetch INVID articles", err);
    return null;
  }
}
