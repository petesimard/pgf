#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

interface GameConfig {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  varName: string;
}

function toPascalCase(str: string): string {
  return str
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function getGameConfig(): Promise<GameConfig> {
  console.log('\n🎮 Party Game Framework - Game Generator\n');

  const name = await askQuestion('Game name (e.g., "Buzz Race"): ');
  const id = toKebabCase(name);
  const description = await askQuestion('Description: ');
  const minPlayersStr = await askQuestion('Minimum players (default: 2): ');
  const maxPlayersStr = await askQuestion('Maximum players (default: 20): ');

  const minPlayers = minPlayersStr ? parseInt(minPlayersStr, 10) : 2;
  const maxPlayers = maxPlayersStr ? parseInt(maxPlayersStr, 10) : 20;
  const varName = toCamelCase(id) + 'Game';

  console.log(`\n✨ Generating game with ID: "${id}"\n`);

  return { id, name, description, minPlayers, maxPlayers, varName };
}

function generateServerHandler(config: GameConfig): string {
  return `import type { GameHandler, ServerGameSession, GameServer } from '../types.js';
import { broadcastSessionState } from './utils.js';

export interface ${toPascalCase(config.id)}State {
  // TODO: Define your game state here
  // Example:
  // currentPlayerId: string | null;
  // scores: Record<string, number>;
  // roundNumber: number;
}

function initializeScores(session: ServerGameSession): Record<string, number> {
  const scores: Record<string, number> = {};
  session.players.forEach((p) => {
    if (p.isActive) {
      scores[p.id] = 0;
    }
  });
  return scores;
}

export const ${config.varName}: GameHandler = {
  id: '${config.id}',
  name: '${config.name}',
  description: '${config.description}',
  minPlayers: ${config.minPlayers},
  maxPlayers: ${config.maxPlayers},

  onStart(session, _io) {
    const state: ${toPascalCase(config.id)}State = {
      // TODO: Initialize your game state
      // Example:
      // currentPlayerId: null,
      // scores: initializeScores(session),
      // roundNumber: 1,
    };
    session.gameState = state;
    console.log(\`${config.name} started!\`);
  },

  onEnd(session, _io) {
    console.log('${config.name} ended');
    session.gameState = null;
  },

  onAction(session, io, playerId, action) {
    const state = session.gameState as ${toPascalCase(config.id)}State;
    if (!state) return;

    // TODO: Handle game actions
    // Example:
    // if (action.type === 'your-action') {
    //   // Update state based on action
    //   session.gameState = state;
    //
    //   // Broadcast the updated state to all clients
    //   broadcastSessionState(session, io);
    // }

    console.log(\`Action received from player \${playerId}:\`, action);
  },

  onPlayerJoin(session, _io, player) {
    const state = session.gameState as ${toPascalCase(config.id)}State;
    if (state && player.isActive) {
      // TODO: Handle player joining during game
      // Example: Initialize score for new player
      // state.scores[player.id] = 0;
    }
  },

  onPlayerLeave(session, _io, player) {
    const state = session.gameState as ${toPascalCase(config.id)}State;
    if (!state) return;

    // TODO: Handle player leaving during game
    // Example: Select new current player if the leaving player was active
  },
};
`;
}

function generateTVView(config: GameConfig): string {
  return `import type { TVViewProps } from '../types';
import TVGameScene from '../../components/shared/GameScene';

interface ${toPascalCase(config.id)}State {
  // TODO: Define your game state (must match server state)
}

function TVView({ players, gameState }: TVViewProps) {
  const state = gameState as ${toPascalCase(config.id)}State;

  if (!state) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-background">
        <div className="text-center p-8 bg-card rounded-2xl border-3 shadow-playful">
          <div className="w-12 h-12 border-[4px] border-muted border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-muted-foreground font-extrabold">Loading game...</h2>
        </div>
      </div>
    );
  }

  return (
    <TVGameScene players={players} scores={{}}>
      {/* TODO: Implement your TV view */}
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="text-6xl font-extrabold bg-gradient-to-r from-primary via-[#a855f7] to-[#ec4899] bg-clip-text text-transparent text-center">
          ${config.name} TV View
        </div>
        <div className="text-2xl text-muted-foreground mt-4">
          Game content goes here
        </div>
      </div>
    </TVGameScene>
  );
}

export default TVView;
`;
}

function generateClientView(config: GameConfig): string {
  return `import ClientGameScene from '@/components/shared/ClientGameScene';
import type { ClientViewProps } from '../types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface ${toPascalCase(config.id)}State {
  // TODO: Define your game state (must match server state)
}

function ClientView({ player, players, gameState, sendAction }: ClientViewProps) {
  const state = gameState as ${toPascalCase(config.id)}State;

  if (!state) {
    return (
      <div className="flex-1 flex flex-col p-4">
        <div className="text-center p-8 bg-card rounded-2xl border-3 shadow-playful">
          <div className="w-12 h-12 border-[4px] border-muted border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-muted-foreground font-extrabold">Loading game...</h2>
        </div>
      </div>
    );
  }

  const handleAction = () => {
    // TODO: Send game actions to server
    sendAction({ type: 'your-action' });
  };

  return (
    <ClientGameScene players={players} scores={{}}>
      {/* TODO: Implement your client view */}
      <Card className="text-center p-4 bg-card rounded-xl mb-4">
        <div className="text-xl text-muted-foreground">Player Controls</div>
        <div className="text-3xl font-bold mt-1 text-primary">
          {player.name}
        </div>
      </Card>

      <div className="flex-1 flex items-center justify-center p-8">
        <Button
          onClick={handleAction}
          className="w-[200px] h-[200px] rounded-full text-3xl font-extrabold"
        >
          ACTION
        </Button>
      </div>
    </ClientGameScene>
  );
}

export default ClientView;
`;
}

function generateClientIndex(config: GameConfig): string {
  return `import type { GameRegistration } from '../types';
import TVView from './TVView';
import ClientView from './ClientView';

export const ${config.varName}: GameRegistration = {
  id: '${config.id}',
  TVView,
  ClientView,
};
`;
}

async function generateGame(config: GameConfig) {
  // Create directories
  const clientGameDir = path.join(rootDir, 'src', 'games', config.id);
  const serverGameFile = path.join(rootDir, 'server', 'games', `${config.id}.ts`);

  if (!fs.existsSync(clientGameDir)) {
    fs.mkdirSync(clientGameDir, { recursive: true });
  }

  // Generate client files
  fs.writeFileSync(
    path.join(clientGameDir, 'index.ts'),
    generateClientIndex(config)
  );
  fs.writeFileSync(
    path.join(clientGameDir, 'TVView.tsx'),
    generateTVView(config)
  );
  fs.writeFileSync(
    path.join(clientGameDir, 'ClientView.tsx'),
    generateClientView(config)
  );

  // Generate server handler
  fs.writeFileSync(serverGameFile, generateServerHandler(config));

  console.log('✅ Generated files:');
  console.log(`   📁 ${path.relative(rootDir, clientGameDir)}/`);
  console.log(`      - index.ts`);
  console.log(`      - TVView.tsx`);
  console.log(`      - ClientView.tsx`);
  console.log(`   📄 ${path.relative(rootDir, serverGameFile)}`);

  console.log('\n📝 Next steps:');
  console.log(`   1. Register server handler in server/index.ts:`);
  console.log(`      import { ${config.varName} } from './games/${config.id}.js';`);
  console.log(`      games.set(${config.varName}.id, ${config.varName});`);
  console.log(`\n   2. Register client game in src/games/index.ts:`);
  console.log(`      import { ${config.varName} } from './${config.id}';`);
  console.log(`      export const games: GameRegistration[] = [buzzRaceGame, ${config.varName}];`);
  console.log(`\n   3. Implement game logic in the generated files`);
  console.log(`\n🎮 Happy game building!\n`);
}

// Main execution
async function main() {
  try {
    const config = await getGameConfig();
    await generateGame(config);
  } catch (error) {
    console.error('❌ Error generating game:', error);
    process.exit(1);
  }
}

main();
