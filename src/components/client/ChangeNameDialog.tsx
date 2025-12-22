import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ChangeNameDialogProps {
  currentName: string;
  onChangeName: (newName: string) => Promise<void>;
}

function ChangeNameDialog({ currentName, onChangeName }: ChangeNameDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newName, setNewName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newName.trim();

    if (!trimmedName) {
      setError('Name cannot be empty');
      return;
    }

    if (trimmedName === currentName) {
      setIsOpen(false);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onChangeName(trimmedName);
      setIsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change name');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setNewName(currentName);
      setError(null);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start text-left px-4 py-6 text-base font-bold rounded-xl border-3 shadow-playful hover:shadow-playful-lg hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-playful-sm"
        >
          Change Name
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="bg-background border-t-[4px] border-foreground p-0"
      >
        <SheetHeader className="px-6 py-6 border-b-3 border-foreground bg-background">
          <SheetTitle className="text-2xl font-black text-foreground text-shadow-sm uppercase m-0">
            Change Name
          </SheetTitle>
        </SheetHeader>
        <div className="p-6 bg-background">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <p className="text-sm font-bold text-muted-foreground mb-2">
                Current name: <span className="text-foreground">{currentName}</span>
              </p>
              <Input
                type="text"
                placeholder="Enter new name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={20}
                autoFocus
                autoComplete="off"
                className="px-6 py-6 text-xl font-bold text-center border-3 rounded-full"
              />
            </div>
            {error && (
              <Alert variant="destructive" className="border-3 shadow-playful-sm">
                <AlertDescription className="font-bold text-center">{error}</AlertDescription>
              </Alert>
            )}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={isSubmitting}
                className="flex-1 px-6 py-6 text-base font-bold rounded-full border-3 shadow-playful hover:shadow-playful-lg hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-playful-sm"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!newName.trim() || isSubmitting}
                className="flex-1 px-6 py-6 text-base font-bold rounded-full border-3 shadow-playful hover:shadow-playful-lg hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-playful-sm"
              >
                {isSubmitting ? 'Changing...' : 'Change Name'}
              </Button>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default ChangeNameDialog;
