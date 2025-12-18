import { useNavigate } from 'react-router-dom';

function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      <div className="landing-container">
        <div className="logo-section">
          <div className="logo-text-container">
            <h1 className="logo-text">
              <span className="logo-phone">PHONE</span>
              <span className="logo-party">PARTY</span>
            </h1>
          </div>

          <div className="character-row">
            <div className="character char-1">🍌</div>
            <div className="character char-2">🧃</div>
            <div className="character char-3">🎨</div>
            <div className="character char-4">🦐</div>
            <div className="character char-5">🔪</div>
            <div className="character char-6">🤖</div>
          </div>
        </div>

        <p className="tagline">Drawn Together. Polled Apart.</p>

        <div className="button-group">
          <button
            className="landing-btn landing-btn-host"
            onClick={() => navigate('/tv')}
          >
            Host Game
          </button>
          <button
            className="landing-btn landing-btn-play"
            onClick={() => {
              const sessionId = prompt('Enter session code:');
              if (sessionId) {
                navigate(`/join/${sessionId}`);
              }
            }}
          >
            Play
          </button>
          <button
            className="landing-btn landing-btn-options"
            onClick={() => alert('Options coming soon!')}
          >
            Options
          </button>
        </div>

        <div className="branding-footer">
          <span className="brand-name">PHONE PARTY</span>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;
