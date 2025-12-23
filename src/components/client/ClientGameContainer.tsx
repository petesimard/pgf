import type { GameSession, Player } from '../../types';
import { getGame } from '../../games';
import GameMasterControls from './GameMasterControls';
import HamburgerMenu from './HamburgerMenu';
import ChangeNameDialog from './ChangeNameDialog';

interface ClientGameContainerProps {
  session: GameSession & { showQRCode?: boolean };
  player: Player;
  sendAction: (action: { type: string; payload?: unknown }) => void;
  endGame: () => void;
  toggleQR: (show: boolean) => void;
  setTVZoom: (zoom: number) => void;
  renamePlayer: (newName: string) => Promise<void>;
}

function ClientGameContainer({ session, player, sendAction, endGame, toggleQR, setTVZoom, renamePlayer }: ClientGameContainerProps) {
  const game = session.currentGameId ? getGame(session.currentGameId) : null;

  if (!game) {
    return (
      <div className="client-container">
        <div className="error-message">Game not found: {session.currentGameId}</div>
      </div>
    );
  }

  const ClientView = game.ClientView;

  return (
    <div className="client-container">
      {/* Hamburger Menu for all players */}
      <HamburgerMenu>
        {/* Game Master Controls (only for GM) */}
        {player.isGameMaster && (
          <GameMasterControls
            showQRCode={session.showQRCode ?? false}
            tvZoom={session.tvZoom}
            onToggleQR={toggleQR}
            onSetTVZoom={setTVZoom}
            onEndGame={endGame}
          />
        )}

        {/* Change Name option (for all players) */}
        <ChangeNameDialog currentName={player.name} onChangeName={renamePlayer} />
      </HamburgerMenu>

      {/* Game-specific view */}
      <ClientView
        session={session}
        player={player}
        players={session.players}
        isGameMaster={player.isGameMaster}
        gameState={session.gameState}
        sendAction={sendAction}
        endGame={endGame}
      />
    </div>
  );
}

export default ClientGameContainer;
