# TicTacToe with Cloudflare Durable Objects & Workflows

A real-time multiplayer Tic-Tac-Toe game that showcases the power of Cloudflare Durable Objects, Workflows, Workers AI, and modern React tooling. Play against AI opponents at three difficulty levels, or challenge another human player.

**Repository:** https://github.com/jkahn117/cloudflare-durable-objects-tictactoe

## Features

- **Real-time Multiplayer**: WebSocket-based gameplay using Durable Objects and the Agents SDK
- **AI Opponents**: Three difficulty levels (Beginner, Intermediate, Expert)
- **Human vs Human**: Play against friends with turn-based gameplay
- **Workflow Orchestration**: Game logic managed by Cloudflare Workflows for reliable state transitions
- **Modern UI**: Built with React 19, TanStack Router, and Tailwind CSS
- **Edge Deployment**: Runs on Cloudflare Workers with global low-latency
- **Automatic Cleanup**: Games are automatically removed 60 seconds after completion

## Architecture

### Tech Stack

- **Frontend**: React 19, TanStack Router, TanStack Start
- **Styling**: Tailwind CSS v4
- **Backend**: Cloudflare Workers + Durable Objects + Workflows
- **AI**: Cloudflare Workers AI (OpenAI GPT-OSS 20B for Expert level)
- **Real-time Sync**: Agents SDK (WebSocket abstraction over Durable Objects)
- **Build Tool**: Vite

### Key Components

#### Durable Objects

**GameAgent** (`src/agents/Game.ts`)

- Extends the `Agent` class from the Agents SDK
- Acts as a **state container** that syncs game state to connected clients via WebSocket
- Detects player moves by comparing board states in `onStateUpdate`
- Forwards move events to the appropriate Workflow for validation
- Schedules cleanup alarms after game completion
- Does NOT contain game logic (delegated to Workflows)

**LobbyAgent** (`src/agents/Lobby.ts`)

- Singleton Durable Object managing the game lobby
- Tracks games seeking players and games in progress
- Generates unique game slugs
- Handles game creation and cleanup

#### Workflows

**HumanVsAIWorkflow** (`src/workflows/HumanVsAIWorkflow.ts`)

- Orchestrates games between a human player and AI
- Manages turn alternation between human and AI
- Handles move validation, win detection, and timeouts
- Instantiates appropriate bot based on selected difficulty level

**HumanVsHumanWorkflow** (`src/workflows/HumanVsHumanWorkflow.ts`)

- Orchestrates games between two human players
- Waits for move events from either player
- Validates moves and checks for game completion
- 5-minute timeout per move (forfeit if exceeded)

#### AI Bots

**BotBeginner** (`src/bots/BotBeginner.ts`)

- Picks adjacent spaces to opponent's last move
- Random selection on first move
- Easy to beat, predictable behavior

**BotIntermediate** (`src/bots/BotIntermediate.ts`)

- Takes winning moves when available
- Blocks opponent's winning moves
- Prefers center, then corners, then sides
- Does NOT understand forks or advanced strategy

**BotExpert** (`src/bots/BotExpert.ts`)

- Powered by Cloudflare Workers AI (OpenAI GPT-OSS 20B)
- Full strategic reasoning: wins, blocks, forks, center control
- Includes fallback logic for invalid AI responses

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  useAgent() hook                                                     │   │
│  │  - Connects via WebSocket to GameAgent                               │   │
│  │  - Receives real-time state updates                                  │   │
│  │  - Calls setState() to make moves (optimistic update)                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ WebSocket
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GAMEAGENT (Durable Object)                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  onStateUpdate(state, source)                                        │   │
│  │  - If source is client: detect new move via board diff               │   │
│  │  - Forward move event to Workflow via sendEvent()                    │   │
│  │  - If source is "server" (workflow): sync lastKnownBoard             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  scheduleCleanup() / cleanup()                                       │   │
│  │  - Called when game ends                                             │   │
│  │  - Sets 60-second alarm, then notifies LobbyAgent and self-destructs │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ sendEvent()
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WORKFLOW (Orchestration)                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Game Loop                                                           │   │
│  │  1. Wait for move event (step.waitForEvent)                          │   │
│  │  2. Validate move (correct player, valid position)                   │   │
│  │  3. Apply move to board                                              │   │
│  │  4. Check for winner/draw                                            │   │
│  │  5. Update GameAgent state (syncs to all clients)                    │   │
│  │  6. If AI turn: generate AI move via Bot                             │   │
│  │  7. Repeat until game ends                                           │   │
│  │  8. Schedule cleanup                                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ setState()
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GAMEAGENT (Durable Object)                        │
│  - Receives validated state from Workflow                                   │
│  - Broadcasts to all connected clients via WebSocket                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ WebSocket
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT                                         │
│  - Receives updated game state                                              │
│  - Re-renders UI with new board, turn, winner                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Why This Architecture?

**Durable Objects as State Containers**
- GameAgent holds authoritative game state
- Syncs state to all connected clients automatically via Agents SDK
- Handles WebSocket connection management

**Workflows for Game Logic**
- Reliable, durable execution of game turns
- Built-in timeout handling with `waitForEvent`
- Automatic retries on failure
- Clear separation of orchestration from state storage

**Benefits**
- Game logic is testable independently of WebSocket handling
- Workflows survive Worker restarts
- Timeouts are handled reliably (no need for manual alarm management for turns)
- Clean separation of concerns

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)
- Cloudflare account (for deployment)

### Installation

```bash
pnpm install
```

### Running Locally

```bash
pnpm dev
```

The application will start at `http://localhost:3000`.

**Local Development Notes:**

- WebSocket connections use `ws://` protocol for localhost
- Cloudflare Workers AI requires Wrangler's local environment
- Durable Objects and Workflows are simulated locally using Miniflare

### Building for Production

```bash
pnpm build
```

This compiles the application for deployment to Cloudflare Workers.

## Deployment

### Deploy to Cloudflare Workers

```bash
pnpm deploy
```

This command:

1. Sets `CLOUDFLARE_ENV=production`
2. Builds the production bundle
3. Deploys to Cloudflare Workers using `wrangler deploy -e production`

### Configuration

**wrangler.jsonc**

- Configure Durable Object bindings (GameAgent, LobbyAgent)
- Configure Workflow bindings (HumanVsAIWorkflow, HumanVsHumanWorkflow)
- Set up Workers AI binding
- Define environment variables (e.g., `VITE_SERVER_URL`)
- Configure compatibility flags and dates

**Required Bindings:**

- `GameAgent`: Durable Object for individual game instances
- `LobbyAgent`: Durable Object for lobby management
- `HUMAN_VS_AI_WORKFLOW`: Workflow for human vs AI games
- `HUMAN_VS_HUMAN_WORKFLOW`: Workflow for human vs human games
- `AI`: Workers AI binding for Expert bot

### Environment Variables

For production, set in `wrangler.jsonc`:

```jsonc
"env": {
  "production": {
    "vars": {
      "VITE_SERVER_URL": "your-worker.your-subdomain.workers.dev"
    }
  }
}
```

## Project Structure

```
src/
├── agents/                   # Durable Objects (Agents SDK)
│   ├── Game.ts              # GameAgent - state container for each game
│   └── Lobby.ts             # LobbyAgent - singleton lobby manager
├── bots/                    # AI bot implementations
│   ├── BotPlayer.ts         # Interface + factory function
│   ├── BotBeginner.ts       # Adjacent move strategy
│   ├── BotIntermediate.ts   # Block/win strategy
│   └── BotExpert.ts         # AI-powered optimal play
├── workflows/               # Cloudflare Workflows
│   ├── HumanVsAIWorkflow.ts    # Orchestrates human vs AI
│   ├── HumanVsHumanWorkflow.ts # Orchestrates human vs human
│   └── utils/
│       ├── types.ts         # Workflow types and constants
│       ├── gameLogic.ts     # Move validation, win detection
│       └── agentUtils.ts    # Helper for GameAgent interactions
├── components/              # React components
│   ├── GameBoard.tsx        # Tic-tac-toe board UI
│   ├── GameList.tsx         # Lobby game list
│   └── PlayerCard.tsx       # Player info display
├── lib/                     # Utilities
│   ├── GameApi.ts           # Server functions for game operations
│   └── PlayerSession.ts     # Client-side session management
├── routes/                  # TanStack Router routes
│   ├── __root.tsx           # Root layout
│   ├── index.tsx            # Home/lobby page
│   ├── lobby.tsx            # Lobby page
│   └── game/$slug.tsx       # Individual game page
├── server.ts                # Cloudflare Workers entry point
├── types.ts                 # TypeScript type definitions
└── styles.css               # Global styles

wrangler.jsonc               # Cloudflare Workers configuration
vite.config.ts               # Vite build configuration
```

## How It Works

1. **Game Creation**: Player selects opponent type (AI with difficulty, or Human) and creates a game
2. **Workflow Starts**: Server function creates GameAgent and starts appropriate Workflow
3. **WebSocket Connection**: Client connects to GameAgent via `useAgent()` hook
4. **Player Move**: Client calls `setState()` to update board (optimistic update)
5. **Move Detection**: GameAgent detects board change in `onStateUpdate`, forwards to Workflow
6. **Validation**: Workflow validates move, applies it, checks for winner
7. **State Sync**: Workflow updates GameAgent state, which broadcasts to all clients
8. **AI Turn**: If AI game, Workflow generates AI move and updates state
9. **Game End**: Workflow schedules cleanup; after 60 seconds, GameAgent notifies LobbyAgent and self-destructs

## Testing

```bash
pnpm test
```

Tests use [Vitest](https://vitest.dev/) with React Testing Library.

## Technologies Used

- [Cloudflare Workers](https://workers.cloudflare.com/) - Edge compute platform
- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/) - Stateful serverless objects
- [Cloudflare Workflows](https://developers.cloudflare.com/workflows/) - Durable execution for multi-step processes
- [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/) - AI inference at the edge
- [Agents SDK](https://github.com/cloudflare/agents) - WebSocket abstraction over Durable Objects
- [TanStack Router](https://tanstack.com/router) - Type-safe routing
- [TanStack Start](https://tanstack.com/start) - Full-stack React framework
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [Vite](https://vitejs.dev/) - Next-generation frontend tooling

## License

MIT

## Author

Josh Kahn - [GitHub](https://github.com/jkahn117)
