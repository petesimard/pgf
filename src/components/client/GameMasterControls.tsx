interface GameMasterControlsProps {
  showQRCode: boolean;
  onToggleQR: (show: boolean) => void;
  onEndGame: () => void;
}

function GameMasterControls({ showQRCode, onToggleQR, onEndGame }: GameMasterControlsProps) {
  return (
    <div className="gm-controls">
      <h3>Game Master Controls</h3>

      <div className="toggle-row">
        <span className="toggle-label">Show QR Code for new players</span>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={showQRCode}
            onChange={(e) => onToggleQR(e.target.checked)}
          />
          <span className="toggle-slider"></span>
        </label>
      </div>

      <div className="btn-row">
        <button className="btn btn-danger" onClick={onEndGame}>
          End Game
        </button>
      </div>
    </div>
  );
}

export default GameMasterControls;
