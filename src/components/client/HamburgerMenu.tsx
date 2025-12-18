import { useState, ReactNode } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface HamburgerMenuProps {
  children: ReactNode;
}

function HamburgerMenu({ children }: HamburgerMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="fixed top-4 right-4 z-[1000] w-[54px] h-[54px] bg-card border-3 rounded-2xl p-0 shadow-playful hover:shadow-playful-lg hover:-translate-y-0.5 hover:border-primary active:translate-y-0 active:shadow-playful-sm"
          aria-label="Menu"
        >
          <div className="w-6 h-[18px] relative flex flex-col justify-between">
            <span className={cn("block h-[3px] w-full bg-foreground rounded-sm transition-all", isOpen && "rotate-45 translate-y-[7.5px]")}></span>
            <span className={cn("block h-[3px] w-full bg-foreground rounded-sm transition-all", isOpen && "opacity-0")}></span>
            <span className={cn("block h-[3px] w-full bg-foreground rounded-sm transition-all", isOpen && "-rotate-45 -translate-y-[7.5px]")}></span>
          </div>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[380px] max-w-[90vw] bg-background border-l-[4px] border-foreground p-0 overflow-y-auto"
      >
        <SheetHeader className="px-6 py-6 border-b-3 border-foreground bg-background">
          <SheetTitle className="text-2xl font-black text-foreground text-shadow-sm uppercase m-0">
            Menu
          </SheetTitle>
        </SheetHeader>
        <div className="p-6 bg-background">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default HamburgerMenu;
