# TicTacToe with Cloudflare Durable Objects

A real-time multiplayer Tic-Tac-Toe game that showcases the power of Cloudflare Durable Objects, Workers AI, and modern React tooling. Play against an AI expert powered by OpenAI's GPT-OSS 20B model via Cloudflare Workers AI for superior strategic reasoning.

**Repository:** https://github.com/jkahn117/cloudflare-durable-objects-tictactoe

## Features

- **Real-time Multiplayer**: WebSocket-based gameplay using Durable Objects
- **AI Opponent**: Play against an AI expert powered by Cloudflare Workers AI
- **Modern UI**: Built with React 19, TanStack Router, and Tailwind CSS
- **Edge Deployment**: Runs on Cloudflare Workers with global low-latency
- **Stateful Game Logic**: Durable Objects provide consistent game state management

## Architecture

### Tech Stack

- **Frontend**: React 19, TanStack Router, TanStack Start
- **Styling**: Tailwind CSS v4
- **Backend**: Cloudflare Workers + Durable Objects
- **AI**: Cloudflare Workers AI (OpenAI GPT-OSS 20B for enhanced reasoning)
- **WebSockets**: Agents library (built on Durable Objects)
- **Build Tool**: Vite

### Key Components

#### Durable Objects

**GameManager** (`src/do/GameManager.ts`)

- Extends the `Agent` class (built on `DurableObject`)
- Manages game state for each Tic-Tac-Toe match
- Handles WebSocket connections for real-time updates
- Persists game state in Durable Object storage
- Coordinates moves between players and AI
- Broadcasts game updates to all connected clients

**TicTacToeExpert** (`src/do/TicTacToeExpert.ts`)

- AI opponent powered by Cloudflare Workers AI
- Uses OpenAI GPT-OSS 20B model for enhanced strategic reasoning and move generation
- Implements classic Tic-Tac-Toe strategy (win, block, fork, center control)
- Returns optimal moves based on current board state with intelligent validation and fallback logic

#### WebSocket Flow

1. Client connects to WebSocket endpoint: `/api/agents/game-manager/{gameId}`
2. Server routes WebSocket upgrades to appropriate GameManager instance
3. GameManager handles messages:
   - `create_game`: Initialize new game
   - `update_game`: Process player moves
   - `end_game`: Clean up game state
4. Game state changes broadcast to all connected clients
5. AI moves triggered automatically after player moves

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
- Durable Objects are simulated locally using Miniflare

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

- Configure Durable Object bindings
- Set up Workers AI binding
- Define environment variables (e.g., `VITE_SERVER_URL`)
- Configure compatibility flags and dates

**Required Bindings:**

- `GAME_MANAGER`: Durable Object binding for GameManager class
- `AI`: Workers AI binding for OpenAI GPT-OSS 20B model

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
├── do/                       # Durable Objects
│   ├── GameManager.ts        # Main game logic and WebSocket handler
│   └── TicTacToeExpert.ts    # AI opponent implementation
├── routes/                   # TanStack Router routes
│   ├── __root.tsx           # Root layout
│   └── index.tsx            # Main game UI
├── server.ts                # Cloudflare Workers entry point
├── types.ts                 # TypeScript type definitions
└── styles.css               # Global styles

wrangler.jsonc               # Cloudflare Workers configuration
vite.config.ts               # Vite build configuration
```

## How It Works

1. **Game Creation**: Player clicks "Find a Match" to create a new game
2. **WebSocket Connection**: Client establishes WebSocket connection to GameManager Durable Object
3. **Player Move**: Player clicks a square, sends `update_game` message
4. **State Update**: GameManager validates move, updates board, and broadcasts to clients
5. **AI Turn**: If playing against AI, GameManager triggers AI move calculation
6. **AI Move**: TicTacToeExpert uses Workers AI to calculate optimal move
7. **Game End**: Winner is calculated, game state is updated, and clients are notified

## Testing

```bash
pnpm test
```

Tests use [Vitest](https://vitest.dev/) with React Testing Library.

## Technologies Used

- [Cloudflare Workers](https://workers.cloudflare.com/) - Edge compute platform
- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/) - Stateful serverless objects
- [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/) - AI inference at the edge
- [TanStack Router](https://tanstack.com/router) - Type-safe routing
- [TanStack Start](https://tanstack.com/start) - Full-stack React framework
- [Agents](https://github.com/cloudflare/agents) - WebSocket utilities for Durable Objects
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [Vite](https://vitejs.dev/) - Next-generation frontend tooling

## License

MIT

## Author

Josh Kahn - [GitHub](https://github.com/jkahn117)
