import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8 relative overflow-hidden">
      <div className="max-w-3xl w-full text-center">
        <div className="mb-8">
          <div className="mb-8">
            <h1 className="text-9xl font-black leading-none tracking-tight uppercase m-0 flex flex-col items-center">
              <span className="text-foreground text-shadow-playful">PHONE</span>
              <span className="text-foreground text-shadow-playful">PARTY</span>
            </h1>
          </div>

          <div className="flex justify-center items-end gap-6 mt-4 flex-wrap">
            <div className="text-6xl animate-float" style={{ animationDelay: '0s', filter: 'drop-shadow(3px 3px 0px rgba(0, 0, 0, 0.2))' }}>🍌</div>
            <div className="text-6xl animate-float" style={{ animationDelay: '0.3s', filter: 'drop-shadow(3px 3px 0px rgba(0, 0, 0, 0.2))' }}>🧃</div>
            <div className="text-6xl animate-float" style={{ animationDelay: '0.6s', filter: 'drop-shadow(3px 3px 0px rgba(0, 0, 0, 0.2))' }}>🎨</div>
            <div className="text-6xl animate-float" style={{ animationDelay: '0.9s', filter: 'drop-shadow(3px 3px 0px rgba(0, 0, 0, 0.2))' }}>🦐</div>
            <div className="text-6xl animate-float" style={{ animationDelay: '1.2s', filter: 'drop-shadow(3px 3px 0px rgba(0, 0, 0, 0.2))' }}>🔪</div>
            <div className="text-6xl animate-float" style={{ animationDelay: '1.5s', filter: 'drop-shadow(3px 3px 0px rgba(0, 0, 0, 0.2))' }}>🤖</div>
          </div>
        </div>

        <p className="text-4xl font-extrabold text-foreground my-12 text-shadow-sm tracking-tight">
          Drawn Together. Polled Apart.
        </p>

        <div className="flex flex-col gap-4 my-12 max-w-md mx-auto">
          <Button
            size="lg"
            variant="secondary"
            onClick={() => navigate('/tv')}
            className="px-12 py-6 text-2xl font-bold border-[4px] rounded-full uppercase tracking-wider shadow-playful hover:shadow-playful-lg hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-playful-sm bg-gradient-to-b from-[#ff6b9d] to-[#ff4081] text-white border-foreground"
          >
            Host Game
          </Button>
          <Button
            size="lg"
            onClick={() => {
              const sessionId = prompt('Enter session code:');
              if (sessionId) {
                navigate(`/join/${sessionId}`);
              }
            }}
            className="px-12 py-6 text-2xl font-bold border-[4px] rounded-full uppercase tracking-wider shadow-playful hover:shadow-playful-lg hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-playful-sm"
          >
            Play
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => alert('Options coming soon!')}
            className="px-12 py-6 text-2xl font-bold border-[4px] rounded-full uppercase tracking-wider shadow-playful hover:shadow-playful-lg hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-playful-sm bg-gradient-to-b from-white to-[#e8e8e8] text-foreground border-foreground"
          >
            Options
          </Button>
        </div>

        <div className="absolute top-8 left-8">
          <span className="text-2xl font-black text-foreground tracking-wider" style={{ textShadow: '2px 2px 0px rgba(255, 255, 255, 0.5)' }}>
            PHONE PARTY
          </span>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;
