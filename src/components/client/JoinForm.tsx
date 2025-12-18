import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';

interface JoinFormProps {
  onJoin: (name: string) => void;
  error: string | null;
}

const PLAYER_NAME_KEY = 'playerName';

function JoinForm({ onJoin, error }: JoinFormProps) {
  const [name, setName] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // Load saved name from localStorage on mount
  useEffect(() => {
    const savedName = localStorage.getItem(PLAYER_NAME_KEY);
    if (savedName) {
      setName(savedName);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isJoining) return;

    setIsJoining(true);
    const trimmedName = name.trim();

    // Save name to localStorage
    localStorage.setItem(PLAYER_NAME_KEY, trimmedName);

    await onJoin(trimmedName);
    setIsJoining(false);
  };

  return (
    <Card className="flex flex-col gap-4 p-8 mt-8 border-3 shadow-playful">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          type="text"
          placeholder="Enter your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          autoFocus
          autoComplete="off"
          className="px-6 py-6 text-xl font-bold text-center border-3 rounded-full"
        />
        <Button
          type="submit"
          disabled={!name.trim() || isJoining}
          size="lg"
          className="px-8 py-6 text-xl font-bold uppercase tracking-wide rounded-full border-3 shadow-playful hover:shadow-playful-lg hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-playful-sm"
        >
          {isJoining ? 'Joining...' : 'Join Game'}
        </Button>
      </form>
      {error && (
        <Alert variant="destructive" className="border-3 shadow-playful-sm">
          <AlertDescription className="font-bold text-center">{error}</AlertDescription>
        </Alert>
      )}
    </Card>
  );
}

export default JoinForm;
