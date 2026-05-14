import { useEffect, useState, useRef } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useProducts } from "@/hooks/useProducts";
import type { Product } from "@/models/products";
import { displayName } from "@/models/products";

interface Props {
  value: string;
  onChange: (search: string) => void;
  placeholder?: string;
}

export function SearchAutocomplete({ value, onChange, placeholder = "Buscar productos, SKU…" }: Props) {
  const [inputValue, setInputValue] = useState(value);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const debounced = useDebouncedValue(inputValue, 200);

  const { products } = useProducts({
    search: debounced.length >= 2 ? debounced : null,
    pageSize: 10,
  });

  const showSuggestions = open && debounced.length >= 2 && products.length > 0;

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  function commit(term: string) {
    onChange(term);
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      commit(inputValue);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function handleSelect(product: Product) {
    const name = displayName(product);
    setInputValue(name);
    commit(name);
  }

  return (
    <Popover open={showSuggestions} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => { setInputValue(e.target.value); setOpen(true); }}
            onKeyDown={handleKeyDown}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="pl-8"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-1"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {products.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => handleSelect(p)}
            className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
          >
            {p.image && (
              <img src={p.image} alt="" className="h-8 w-8 shrink-0 rounded object-contain" />
            )}
            <div className="min-w-0 text-left">
              <p className="truncate font-medium">{displayName(p)}</p>
              {p.sku && <p className="text-xs text-muted-foreground">{p.sku}</p>}
            </div>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
