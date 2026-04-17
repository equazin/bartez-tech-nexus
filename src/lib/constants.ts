/** URL pública del proyecto Supabase — derivada del env var, nunca hardcodeada. */
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

/** Bucket de imágenes de productos en Supabase Storage. */
export const PRODUCTS_BUCKET = "products";

/** Bucket de imágenes de bundles en Supabase Storage. */
export const BUNDLES_BUCKET = "bundles";

/** Construye la URL pública de un archivo en Supabase Storage. */
export function storageUrl(bucket: string, path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}
