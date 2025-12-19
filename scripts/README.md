# Game Generator Scripts

## Generate a New Game

To create a new game with all the necessary files and boilerplate code, run:

```bash
npm run generate:game
```

This will start an interactive prompt asking for:
- **Game name**: Display name (e.g., "Buzz Race", "Trivia Time")
- **Description**: Short description of the game
- **Minimum players**: Minimum number of players required (default: 2)
- **Maximum players**: Maximum number of players allowed (default: 20)

### What Gets Generated

The generator creates:

**Client-side files** (in `src/games/<game-id>/`):
- `index.ts` - Game registration
- `TVView.tsx` - What displays on the TV screen
- `ClientView.tsx` - Player controls on phone

**Server-side files**:
- `server/games/<game-id>.ts` - Server game logic handler

### Example

```bash
$ npm run generate:game

🎮 Party Game Framework - Game Generator

Game name (e.g., "Buzz Race"): Memory Match
Description: Test your memory by matching cards
Minimum players (default: 2): 2
Maximum players (default: 20): 8

✨ Generating game with ID: "memory-match"

✅ Generated files:
   📁 src/games/memory-match/
      - index.ts
      - TVView.tsx
      - ClientView.tsx
   📄 server/games/memory-match.ts
```

### After Generation

The generator will display instructions for:

1. **Registering the server handler** in `server/index.ts`
2. **Registering the client game** in `src/games/index.ts`
3. **Implementing game logic** in the generated template files

### Generated Code Structure

All generated files include:
- ✅ TypeScript types matching server/client architecture
- ✅ TODO comments indicating where to add game logic
- ✅ Basic UI scaffolding using existing components
- ✅ Example patterns from Buzz Race
- ✅ Proper imports and exports

### Template Features

**Server Handler** (`server/games/<game-id>.ts`):
- State type definition
- `onStart()` - Initialize game
- `onEnd()` - Clean up
- `onAction()` - Handle player actions
- `onPlayerJoin()` - Handle mid-game joins
- `onPlayerLeave()` - Handle disconnections

**TV View** (`src/games/<game-id>/TVView.tsx`):
- Loading state handling
- `TVGameScene` wrapper with scoreboard
- TODO markers for game content

**Client View** (`src/games/<game-id>/ClientView.tsx`):
- Loading state handling
- `ClientGameScene` wrapper
- Example action button
- TODO markers for controls

### Next Steps After Generation

1. **Define your game state** in both server and client type definitions
2. **Implement game logic** in the server handler's `onAction()` method
3. **Build the TV display** in `TVView.tsx` to show game state
4. **Build player controls** in `ClientView.tsx` to send actions
5. **Register the game** in both `server/index.ts` and `src/games/index.ts`
6. **Test your game** by running `npm run dev` and navigating to `/tv`

### Tips

- Keep the game ID in kebab-case (auto-generated from name)
- Match state types between server and client exactly
- Use the existing `TVGameScene` and `ClientGameScene` components for consistent UI
- Look at `buzz-race` implementation for a complete example
- Test with multiple browser tabs to simulate multiple players
