import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import type { ReactNode } from "react";

interface Props {
  sidebar: ReactNode;
  toolbar: ReactNode;
  content: ReactNode;
}

export function CatalogLayout({ sidebar, toolbar, content }: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Toolbar row — always visible */}
      <div className="flex shrink-0 items-center gap-2 border-b bg-background px-3 py-2 md:hidden">
        {/* Mobile: sidebar in a Drawer */}
        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Menu className="h-4 w-4" />
              Categorías
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Categorías</DrawerTitle>
            </DrawerHeader>
            <div className="h-[60vh] overflow-y-auto px-2 pb-6">{sidebar}</div>
          </DrawerContent>
        </Drawer>
      </div>

      {/* Desktop: 2-column grid */}
      <div className="flex min-h-0 flex-1">
        {/* Sidebar — desktop only */}
        <div className="hidden w-72 shrink-0 overflow-y-auto md:flex md:flex-col xl:w-80">
          {sidebar}
        </div>

        {/* Main area */}
        <div className="flex min-w-0 flex-1 flex-col">
          {toolbar}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {content}
          </div>
        </div>
      </div>
    </div>
  );
}
