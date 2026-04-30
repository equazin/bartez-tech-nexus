import { Sparkles } from "lucide-react";
import type { UserProfile } from "@/lib/supabase";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 18) return "Buenas tardes";
  return "Buenas noches";
}

interface Props {
  profile: UserProfile;
}

export function HomeHero({ profile }: Props) {
  const name = profile.name?.split(" ")[0] ?? "Cliente";

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
        <Sparkles className="h-5 w-5" />
      </div>
      <div>
        <h1 className="text-lg font-bold leading-tight">
          {greeting()}, {name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {profile.company_name ?? "Portal B2B"}
        </p>
      </div>
    </div>
  );
}
