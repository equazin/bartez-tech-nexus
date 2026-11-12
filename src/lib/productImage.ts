import { codificarDireccionDeImagen } from "./direccionDeImagen";

const preloadedProductImages = new Set<string>();

export function resolveProductImageUrl(rawUrl: string | null | undefined): string {
  const value = String(rawUrl ?? "").trim();
  if (!value) return "/placeholder.png";

  if (value.includes("/storage/v1/object/products/")) {
    return value.replace("/storage/v1/object/products/", "/storage/v1/object/public/products/");
  }

  // Las fotos de los mayoristas pueden traer «?» o «%» en el nombre del archivo: sin codificar no cargan.
  return codificarDireccionDeImagen(value);
}

export function preloadProductImage(rawUrl: string | null | undefined): void {
  const resolvedUrl = resolveProductImageUrl(rawUrl);
  if (!resolvedUrl || resolvedUrl === "/placeholder.png" || preloadedProductImages.has(resolvedUrl)) {
    return;
  }

  const image = new Image();
  image.decoding = "async";
  image.src = resolvedUrl;
  preloadedProductImages.add(resolvedUrl);
}
