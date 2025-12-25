# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Party Game Framework (PGF) is a web-based multiplayer party game system with two distinct client types:
- **TV Hub**: Large screen display showing QR codes, player lists, and game content
- **Phone Clients**: Players join by scanning QR code, first player becomes Game Master

## Development Commands

```bash
npm run dev           # Start both client (port 5173) and server (port 3000) with hot reload
npm run dev:server    # Server only
npm run dev:client    # Client only (Vite)
npm run build         # TypeScript compilation + Vite build
npm start             # Production server
npm run generate:game # Interactive CLI to generate new game files
```

## Testing

### Interactive Testing with Claude Chrome Extension

The Claude Chrome extension is an excellent tool for testing the multi-device experience during development. Claude can navigate to the TV view, open additional tabs for phone clients, and interact with the UI to verify functionality. Assume the dev server is already running.

**Setup**:
1. User already started dev server
2. User asks Claude to navigate to `http://localhost:5173/tv`
3. Claude can then open additional tabs simulating phone clients joining the session
4. Claude can interact with the UI, take screenshots, read console logs, and verify functionality

**Capabilities**:
- Navigate to TV and client views in separate tabs
- Take screenshots to show current state
- Click buttons and interact with game controls
- Read console logs for debugging Socket.IO events
- Monitor network requests and WebSocket connections
- Verify DOM state and element visibility
- Simulate multiple concurrent players in different tabs

**Example workflow**:
1. User: "Navigate to localhost:5173/tv"
2. Claude: Takes screenshot showing QR code and session ID
3. User: "Open a new tab and join as player 'Alice'"
4. Claude: Opens new tab, joins session, shows both TV and client views
5. User: "Select Buzz Race and start the game"
6. Claude: Clicks game option, starts game, verifies game state

## Network Configuration

The app supports local network connections for phones:

- Server binds to `0.0.0.0` to accept network connections
- Vite dev server also binds to `0.0.0.0` with `allowedHosts` configured
- Environment variables in `.env`:
  - `PORT`: Server port (default 3000)
  - `HOSTNAME`: Hostname for QR code URL (defaults to machine hostname from `os.hostname()`)
- The QR code URL points to Vite dev server (port 5173) in development, Express server in production
- Socket.IO connections use `window.location.origin` to work from any device
- CORS is configured to allow all origins for phone connectivity

## Architecture: Dual Client System

This is NOT a traditional single-page app. There are two completely different UIs:

### TV Client (`/tv` route)
- **Purpose**: Display on large screen/TV
- **Components**: `src/components/tv/`
- **Cannot**: Join as player, send game actions
- **Can**: Create/join sessions, display QR codes, show game state
- **Entry**: Opens a session and displays its ID as a QR code

### Phone Client (`/join/:sessionId` route)
- **Purpose**: Player controllers on mobile devices
- **Components**: `src/components/client/`
- **Cannot**: Display game visuals (TV does this)
- **Can**: Join session, become Game Master, send actions, control games
- **Entry**: Scans QR code to get session ID
- **Persistence**: Player names stored in localStorage and auto-join on subsequent visits

### Game Master Role
- First player to join becomes Game Master
- Only Game Master can: select games, start games, end games, toggle QR
- If Game Master disconnects, role transfers to next connected player
- Game Master is just a player with extra permissions, not a separate entity

## Socket.IO Communication

All real-time communication flows through Socket.IO (defined in `src/types.ts`):

### Key Events
- `session:create` / `session:join`: TV creates/rejoins sessions
- `player:join`: Phone joins session with name
- `session:state`: Broadcasts full session state to all clients
- `game:select` / `game:start` / `game:end`: Game Master controls
- `game:action`: Players send game-specific actions
- `qr:toggle`: Game Master controls QR visibility during games

### Session Management
- Sessions stored in `Map<string, ServerGameSession>` in server memory
- Session IDs are 8-character uppercase UUIDs
- Sessions cleanup 60s after all players disconnect and TV disconnects
- Socket-to-session mapping tracks TV vs player connections

## Game System Architecture

Games have **two independent implementations**:

### Server-Side (`server/games/*.ts`)
Implements `GameHandler` interface:
- `onStart()`: Initialize game state
- `onEnd()`: Clean up
- `onAction()`: Process player actions
- `onPlayerJoin()` / `onPlayerLeave()`: Optional lifecycle hooks
- Registered in `server/index.ts` via `games.set(gameHandler.id, gameHandler)`

### Client-Side (`src/games/*/`)
Implements `GameRegistration` interface:
- `TVView` component: What displays on TV
- `ClientView` component: What displays on phone
- Registered in `src/games/index.ts`

**Important**: Game IDs must match between server and client registrations.

### Game State Flow
1. Server stores game state in `session.gameState`
2. Server broadcasts via `session:state` event
3. TV and phone components receive state and render independently
4. Players send actions via `game:action` events
5. Server validates and updates state
6. Loop continues

## Type System

Three key type files define the contract:

1. **`src/types.ts`**: Shared client/server types
   - `Player`, `GameSession`, `GameDefinition`
   - `ServerToClientEvents`, `ClientToServerEvents`

2. **`server/types.ts`**: Server-only extensions
   - `ServerGameSession` extends `GameSession` with socket mappings
   - `GameHandler` interface for server-side game logic

3. **`src/games/types.ts`**: Client-side game component props
   - `TVViewProps`, `ClientViewProps`
   - `GameRegistration` interface

## Common Development Scenarios

### Adding a New Game

**Quick Start**: Use the game generator to scaffold all necessary files:

```bash
npm run generate:game
```

This creates all the boilerplate files with TODOs marking where to add your game logic. See [scripts/README.md](scripts/README.md) for details.

**Manual Setup** (if not using the generator):

1. Create server handler in `server/games/your-game.ts`:
   ```typescript
   import type { GameHandler } from '../types.js';

   export const yourGame: GameHandler = {
     id: 'your-game',
     name: 'Your Game',
     description: 'Description',
     minPlayers: 2,
     maxPlayers: 10,

     onStart(session, io) {
       session.gameState = { /* initial state */ };
     },

     onEnd(session, io) {
       session.gameState = null;
     },

     onAction(session, io, playerId, action) {
       // Handle action.type and action.payload
     },
   };
   ```

2. Register in `server/index.ts`:
   ```typescript
   import { yourGame } from './games/your-game.js';
   games.set(yourGame.id, yourGame);
   ```

3. Create client components in `src/games/your-game/`:
   - `TVView.tsx`: Displays game on TV
   - `ClientView.tsx`: Player controls on phone
   - `index.ts`: Export registration

4. Register in `src/games/index.ts`:
   ```typescript
   import { yourGame } from './your-game';
   export const games: GameRegistration[] = [buzzRaceGame, yourGame];
   ```

**Testing**
Assume the dev server is already running. Do not try to start or restart it

**Testing With Claude Chrome Extension** (recommended for development):
1. Ask Claude to navigate to `http://localhost:5173/tv`
2. Ask Claude to open additional tabs to simulate phone clients
3. Claude can interact with the UI, test flows, and provide visual feedback

### Debugging Socket Issues

- Server logs all connections/disconnections with socket IDs
- Check `socketToSession` mapping to see which sockets are in which sessions
- Session state is always source of truth, broadcasted via `session:state`
- If state is out of sync, check that `broadcastSessionState()` is called after mutations

## File Imports

- Server files use `.js` extensions in imports (TypeScript outputs to `.js`)
- Client files use standard TypeScript imports (no extension)
- Shared types in `src/types.ts` imported as `'../src/types.js'` from server
