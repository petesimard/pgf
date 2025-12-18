import { useState, useEffect } from 'react';

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
    <form className="join-form" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Enter your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={20}
        autoFocus
        autoComplete="off"
      />
      <button
        type="submit"
        className="btn btn-primary"
        disabled={!name.trim() || isJoining}
      >
        {isJoining ? 'Joining...' : 'Join Game'}
      </button>
      {error && <div className="error-message">{error}</div>}
    </form>
  );
}

export default JoinForm;
