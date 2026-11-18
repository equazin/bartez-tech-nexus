import { useState, type ImgHTMLAttributes } from "react";
import { fotoLiviana, type UsoDeFoto } from "@/lib/tienda/fotos";

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src: string;
  /** "miniatura" para listados, carritos y secciones; "ficha" para la foto grande de un producto. */
  uso?: UsoDeFoto;
}

/**
 * La foto de un producto en su versión liviana (src/lib/tienda/fotos.ts). Si esa versión no carga —el mayorista
 * no tiene ese tamaño, o el servicio de imágenes no responde— vuelve sola a la foto original.
 */
export function FotoDeProducto({ src, uso = "miniatura", alt = "", onError, ...resto }: Props) {
  const [fallida, setFallida] = useState<string | null>(null);
  const liviana = fotoLiviana(src, uso);
  const usarOriginal = liviana === src || fallida === src;
  return <img decoding="async" {...resto} alt={alt} src={usarOriginal ? src : liviana} onError={usarOriginal ? onError : () => setFallida(src)} />;
}
