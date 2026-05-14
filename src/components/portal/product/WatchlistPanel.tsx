import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useWatchlist } from "@/hooks/useWatchlist";

interface Props {
  productId: number;
  profileId: string | undefined;
}

export function WatchlistPanel({ productId, profileId }: Props) {
  const { watchedIds, toggle, loading } = useWatchlist(profileId);
  const watched = watchedIds.has(productId);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={watched ? "secondary" : "outline"}
            size="sm"
            disabled={loading || !profileId}
            onClick={() => toggle(productId)}
            className="gap-1.5"
          >
            {watched ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
            {watched ? "En watchlist" : "Vigilar"}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {watched
            ? "Quitar de watchlist — ya no recibirás alertas de este producto"
            : "Agregar a watchlist — te avisamos cuando vuelva a tener stock"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
