# Party Game Framework (PGF)

A web-based multiplayer party game system where a TV displays a central hub with QR code, and players connect via their phones.

## Features

- **TV Hub Display**: Shows QR code for players to join, player list, and game display
- **Phone Client**: Players join via QR scan, first player becomes Game Master
- **Game Master Controls**: Select games, start/end games, toggle QR for mid-game joins
- **Modular Game System**: Easy to add new games with a common interface
- **Real-time Communication**: Socket.IO for instant updates
- **Hot Reload**: Fast development with Vite

## Quick Start

```bash
# Install dependencies
npm install

# Start development servers (client + server with hot reload)
npm run dev
```

Then:
1. Open `http://localhost:5173/tv` on your TV/large screen
2. Scan the QR code with your phone to join
3. First player becomes Game Master and can select/start games

## URLs

- **TV Hub**: `http://localhost:5173/tv`
- **Client Join**: `http://localhost:5173/join/[SESSION_ID]`

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both client and server with hot reload |
| `npm run dev:server` | Start server only (port 3000) |
| `npm run dev:client` | Start client only (port 5173) |
| `npm run build` | Build for production |
| `npm start` | Run production server |
| `npm test` | Run E2E tests with Playwright |
| `npm run test:ui` | Run tests in interactive UI mode |
| `npm run test:headed` | Run tests with visible browser |
| `npm run test:debug` | Run tests in debug mode |

## Testing

The project includes automated E2E tests using Playwright that simulate the full multi-device experience:

- **Automated Testing**: Tests automatically start dev servers, create sessions, and simulate multiple clients
- **Multi-Client Testing**: Tests verify TV display, multiple phone clients, and Game Master controls
- **Auto-Join Testing**: Verifies localStorage persistence and automatic rejoin functionality
- **Smart Server Detection**: Tests detect if dev servers are already running and reuse them for faster testing

Run tests with:
```bash
npm test                # Run all tests headlessly
npm run test:headed     # Watch tests run in browser
npm run test:ui         # Interactive test UI
```

**Tip**: If you already have `npm run dev` running, tests will use those servers and run faster (no startup/shutdown overhead).

Tests are located in `tests/` directory and automatically manage server lifecycle.

## Project Structure

```
pgf/
├── server/               # Express + Socket.IO backend
│   ├── index.ts         # Main server entry
│   ├── types.ts         # Server types
│   └── games/           # Server-side game logic
│       └── buzz-race.ts
├── src/                  # React frontend
│   ├── main.tsx         # Entry point
│   ├── App.tsx          # Router setup
│   ├── types.ts         # Shared types
│   ├── hooks/           # React hooks
│   │   └── useSocket.ts # Socket.IO connection
│   ├── components/
│   │   ├── tv/          # TV display components
│   │   ├── client/      # Phone client components
│   │   └── shared/      # Shared components
│   └── games/           # Game UI components
│       ├── types.ts     # Game interface
│       ├── index.ts     # Game registry
│       └── buzz-race/   # Test game
└── package.json
```

## Creating a New Game

1. Create server-side game handler in `server/games/your-game.ts`:

```typescript
import type { GameHandler } from '../types.js';

export const yourGame: GameHandler = {
  id: 'your-game',
  name: 'Your Game',
  description: 'Description of your game',
  minPlayers: 2,
  maxPlayers: 10,

  onStart(session, io) {
    session.gameState = { /* initial state */ };
  },

  onEnd(session, io) {
    session.gameState = null;
  },

  onAction(session, io, playerId, action) {
    // Handle player actions
  },
};
```

2. Register it in `server/index.ts`:

```typescript
import { yourGame } from './games/your-game.js';
games.set(yourGame.id, yourGame);
```

3. Create client-side components in `src/games/your-game/`:
   - `TVView.tsx` - What displays on the TV
   - `ClientView.tsx` - What displays on player phones
   - `index.ts` - Export the game registration

4. Register in `src/games/index.ts`:

```typescript
import { yourGame } from './your-game';
const games: GameRegistration[] = [yourGame, /* other games */];
```

## Included Test Game: Buzz Race

A simple reflex game to test the system:
- TV shows a random player's name
- All players have a "BUZZ" button
- Correct player buzzes = +1 point, new round
- Wrong player buzzes = -1 point

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Backend**: Node.js, Express, Socket.IO
- **Real-time**: WebSockets via Socket.IO
- **QR Codes**: qrcode.react
