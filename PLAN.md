# Multiplayer Game TV Hub - Implementation Plan

## Overview
A web-based multiplayer party game system where:
- A TV displays a central hub with QR code for players to join
- Players connect via their phones by scanning the QR code
- First player becomes Game Master with special controls
- Games are modular and follow a common interface

## Architecture

### Technology Stack
- **Frontend**: React 18 with TypeScript
- **Backend**: Node.js with Express
- **Real-time Communication**: Socket.IO (WebSockets)
- **Build Tool**: Vite (for hot reload on both client and server)
- **QR Code**: qrcode.react library
- **Styling**: CSS Modules or Tailwind CSS

### Project Structure
```
pgf/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── server/
│   ├── index.ts              # Express + Socket.IO server
│   ├── GameSession.ts        # Session management
│   └── types.ts              # Shared types
├── src/
│   ├── main.tsx              # React entry point
│   ├── App.tsx               # Main app with routing
│   ├── contexts/
│   │   └── GameContext.tsx   # Shared game state context
│   ├── components/
│   │   ├── tv/
│   │   │   ├── TVApp.tsx         # TV hub main component
│   │   │   ├── Lobby.tsx         # QR code + player list
│   │   │   └── GameContainer.tsx # Game wrapper
│   │   ├── client/
│   │   │   ├── ClientApp.tsx     # Phone client main
│   │   │   ├── ClientLobby.tsx   # Waiting room
│   │   │   └── GameMasterControls.tsx
│   │   └── shared/
│   │       └── PlayerList.tsx
│   ├── games/
│   │   ├── index.ts          # Game registry
│   │   ├── types.ts          # Game interface definitions
│   │   └── buzz-race/        # Test game
│   │       ├── index.ts      # Game definition
│   │       ├── TVView.tsx    # TV display
│   │       ├── ClientView.tsx # Phone view
│   │       └── logic.ts      # Game logic
│   └── hooks/
│       └── useSocket.ts      # Socket.IO hook
└── public/
    └── index.html
```

## Core Interfaces

### Game Interface
```typescript
interface GameDefinition {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;

  // React components
  TVView: React.ComponentType<TVViewProps>;
  ClientView: React.ComponentType<ClientViewProps>;

  // Lifecycle hooks
  onGameStart?: (session: GameSession) => void;
  onGameEnd?: (session: GameSession) => void;
  onPlayerJoin?: (session: GameSession, player: Player) => void;
  onPlayerLeave?: (session: GameSession, player: Player) => void;
}

interface TVViewProps {
  players: Player[];
  gameState: any;
  emit: (event: string, data: any) => void;
}

interface ClientViewProps {
  player: Player;
  isGameMaster: boolean;
  gameState: any;
  emit: (event: string, data: any) => void;
}

interface Player {
  id: string;
  name: string;
  isGameMaster: boolean;
  score: number;
}
```

## Implementation Steps

### Phase 1: Project Setup
1. Initialize npm project with TypeScript
2. Configure Vite for React with hot reload
3. Set up Express server with Socket.IO
4. Configure concurrent dev script for client + server

### Phase 2: Core Infrastructure
1. Create Socket.IO connection management
2. Implement session creation and joining
3. Build player management (join, leave, game master assignment)
4. Create game registry system

### Phase 3: TV Hub (Server Display)
1. Build QR code generation with session URL
2. Create player list display
3. Implement lobby view with game selection (for Game Master)
4. Build game container for loading game-specific TV views

### Phase 4: Phone Client
1. Create join flow via QR code URL
2. Build player name entry
3. Implement Game Master controls (game selection, start, end)
4. Create game container for loading game-specific client views

### Phase 5: Test Game (Buzz Race)
1. Implement TV view showing:
   - Player scores at top
   - Currently selected player name (large, center)
2. Implement client view with:
   - Large "BUZZ" button
   - Current player indicator
3. Game logic:
   - Random player selection
   - Score tracking (+1 correct, -1 wrong)
   - Auto-advance on correct buzz

### Phase 6: Additional Features
1. QR code toggle for mid-game joining
2. End game / return to lobby functionality
3. Game Master transfer (if original leaves)

## Socket Events

### Server → All Clients
- `session:state` - Full session state update
- `player:joined` - New player joined
- `player:left` - Player disconnected
- `game:started` - Game has begun
- `game:ended` - Back to lobby
- `game:state` - Game-specific state update

### Client → Server
- `player:join` - Join session with name
- `game:select` - Game Master selects game
- `game:start` - Game Master starts game
- `game:end` - Game Master ends game
- `game:action` - Game-specific action

## URL Structure
- TV Hub: `http://[host]:3000/tv`
- Client: `http://[host]:3000/join/[sessionId]`
- QR Code encodes the client URL

## Development Commands
```bash
npm run dev        # Start both client and server with hot reload
npm run dev:server # Server only
npm run dev:client # Client only
npm run build      # Production build
npm start          # Production server
```

## Test Game: Buzz Race

### Rules
1. Game displays a random player's name on TV
2. All players see a "BUZZ" button on their phone
3. If the named player buzzes: +1 point, new player chosen
4. If wrong player buzzes: -1 point for them
5. Game continues until Game Master ends it

### State
```typescript
interface BuzzRaceState {
  currentPlayer: string | null;  // Player ID who should buzz
  scores: Record<string, number>;
  roundNumber: number;
}
```

## Security Considerations
- Session IDs are random UUIDs
- Basic rate limiting on buzz actions
- Sanitize player names
- Validate Game Master actions server-side
