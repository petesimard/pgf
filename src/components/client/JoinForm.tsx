import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface JoinFormProps {
  onJoin: (name: string, avatar: string) => void;
  error: string | null;
}

const PLAYER_NAME_KEY = 'playerName';
const PLAYER_AVATAR_KEY = 'playerAvatar';

const AVATARS = [
  '/avatars/avatar1.svg',
  '/avatars/avatar2.svg',
  '/avatars/avatar3.svg',
  '/avatars/avatar4.svg',
  '/avatars/avatar5.svg',
  '/avatars/avatar6.svg',
  '/avatars/avatar7.svg',
  '/avatars/avatar8.svg',
];

function JoinForm({ onJoin, error }: JoinFormProps) {
  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);
  const [isJoining, setIsJoining] = useState(false);

  // Load saved name and avatar from localStorage on mount
  useEffect(() => {
    const savedName = localStorage.getItem(PLAYER_NAME_KEY);
    const savedAvatar = localStorage.getItem(PLAYER_AVATAR_KEY);
    if (savedName) {
      setName(savedName);
    }
    if (savedAvatar && AVATARS.includes(savedAvatar)) {
      setSelectedAvatar(savedAvatar);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isJoining) return;

    setIsJoining(true);
    const trimmedName = name.trim();

    // Save name and avatar to localStorage
    localStorage.setItem(PLAYER_NAME_KEY, trimmedName);
    localStorage.setItem(PLAYER_AVATAR_KEY, selectedAvatar);

    await onJoin(trimmedName, selectedAvatar);
    setIsJoining(false);
  };

  return (
    <Card className="flex flex-col gap-4 p-8 mt-8 border-3 shadow-playful">
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-muted-foreground text-center">
            Choose Your Avatar
          </label>
          <div className="grid grid-cols-4 gap-3 justify-items-center">
            {AVATARS.map((avatar) => (
              <button
                key={avatar}
                type="button"
                onClick={() => setSelectedAvatar(avatar)}
                className={cn(
                  "w-16 h-16 rounded-full border-3 transition-all hover:scale-110",
                  selectedAvatar === avatar
                    ? "border-primary shadow-playful-lg scale-110 ring-4 ring-primary/30"
                    : "border-muted hover:border-foreground"
                )}
              >
                <img
                  src={avatar}
                  alt={`Avatar ${avatar}`}
                  className="w-full h-full rounded-full"
                />
              </button>
            ))}
          </div>
        </div>

        <Input
          type="text"
          placeholder="Enter your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
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
