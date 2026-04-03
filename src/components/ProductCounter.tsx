import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

function useCount(target: number, duration = 1800) {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef   = useRef<number>(0);

  useEffect(() => {
    if (target === 0) return;
    startRef.current = null;
    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(ease * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

export default function ProductCounter() {
  const [total, setTotal] = useState(0);
  const animated = useCount(total);

  useEffect(() => {
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("active", true)
      .then(({ count }) => { if (count) setTotal(count); });
  }, []);

  if (total === 0) return null;

  return (
    <span className="tabular-nums">
      {animated.toLocaleString("es-AR")}+
    </span>
  );
}
