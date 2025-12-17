import type { GameSession, Player } from '../../types';
import { getGame } from '../../games';
import GameMasterControls from './GameMasterControls';

interface ClientGameContainerProps {
  session: GameSession & { showQRCode?: boolean };
  player: Player;
  sendAction: (action: { type: string; payload?: unknown }) => void;
  endGame: () => void;
  toggleQR: (show: boolean) => void;
}

function ClientGameContainer({ session, player, sendAction, endGame, toggleQR }: ClientGameContainerProps) {
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
      {/* Game Master Controls */}
      {player.isGameMaster && (
        <GameMasterControls
          showQRCode={session.showQRCode ?? false}
          onToggleQR={toggleQR}
          onEndGame={endGame}
        />
      )}

      {/* Game-specific view */}
      <ClientView
        session={session}
        player={player}
        players={session.players}
        isGameMaster={player.isGameMaster}
        gameState={session.gameState}
        sendAction={sendAction}
      />
    </div>
  );
}

export default ClientGameContainer;
