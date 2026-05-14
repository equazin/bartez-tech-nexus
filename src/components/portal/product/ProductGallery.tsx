import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveProductImageUrl } from "@/lib/productImage";
import type { Product } from "@/models/products";

interface Props {
  product: Product;
}

function getImages(product: Product): string[] {
  const raw = (product.specs?.images ?? product.specs?.gallery) as unknown;
  if (Array.isArray(raw) && raw.length > 0) return raw.map(String);
  const main = resolveProductImageUrl(product.image ?? null);
  return main ? [main] : [];
}

export function ProductGallery({ product }: Props) {
  const images = getImages(product);
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-xl bg-muted text-muted-foreground/30 text-5xl">
        □
      </div>
    );
  }

  function prev() { setActive((i) => (i - 1 + images.length) % images.length); }
  function next() { setActive((i) => (i + 1) % images.length); }

  return (
    <div className="flex flex-col gap-3">
      {/* Main image */}
      <div className="relative aspect-square overflow-hidden rounded-xl bg-muted">
        <img
          src={images[active]}
          alt={product.name}
          className="h-full w-full object-contain p-4"
        />
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1 shadow hover:bg-background"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1 shadow hover:bg-background"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                "h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-muted transition-colors",
                i === active ? "border-brand-500" : "border-transparent hover:border-muted-foreground/30"
              )}
            >
              <img src={src} alt="" className="h-full w-full object-contain p-1" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
