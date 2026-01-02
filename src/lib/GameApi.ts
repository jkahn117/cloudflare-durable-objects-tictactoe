import { createServerFn } from "@tanstack/react-start";
import { getAgentByName } from "agents";
import { env } from "cloudflare:workers";
import { LobbyAgent, LobbyState } from "@/agents/Lobby";
import { GameAgent, GameState } from "@/agents/Game";
import {
  AILevel,
  Board,
  GameConfig,
  Players,
  PlayerType,
  SymbolType,
} from "@/types";

// Lobby operations
export const getLobbyState = createServerFn().handler(
  async (): Promise<LobbyState> => {
    const lobby = await getAgentByName<Env, LobbyAgent>(
      env.LobbyAgent,
      "lobby"
    );

    const lobbyState = await lobby.state;

    return {
      gamesSeekingPlayers: lobbyState.gamesSeekingPlayers,
      gamesInProgress: lobbyState.gamesInProgress,
    };
  }
);

export const createGame = createServerFn({ method: "POST" })
  .inputValidator((config: GameConfig) => config)
  .handler(
    async ({ data }): Promise<{ slug: string; creatorSymbol: SymbolType }> => {
      const lobby = await getAgentByName<Env, LobbyAgent>(
        env.LobbyAgent,
        "lobby"
      );
      const slug = await lobby.createGame();

      const game = await getAgentByName<Env, GameAgent>(env.GameAgent, slug);

      // Random symbol assignment (50/50 chance)
      const creatorSymbol = Math.random() < 0.5 ? SymbolType.X : SymbolType.O;
      const opponentSymbol =
        creatorSymbol === SymbolType.X ? SymbolType.O : SymbolType.X;

      // Configure based on opponent type
      if (data.opponentType === "ai") {
        // Set AI opponent immediately
        const currentState = await game.state;
        await game.setState({
          ...currentState,
          game: {
            ...currentState.game!,
            players: {
              [creatorSymbol]: {
                ...currentState.game!.players[creatorSymbol],
                pending: false,
              },
              [opponentSymbol]: {
                name: `AI (${data.aiLevel})`,
                symbol: opponentSymbol,
                type: PlayerType.AI,
                level: data.aiLevel!,
                pending: false,
              },
            } as Players,
          },
          waitingForPlayers: false,
          inProgress: true,
        });
      }

      return { slug, creatorSymbol };
    }
  );
// Game operations
export const getGameState = createServerFn()
  .inputValidator((data: { slug: string }) => data)
  .handler(async ({ data }): Promise<GameState> => {
    const game = await getAgentByName<Env, GameAgent>(env.GameAgent, data.slug);
    return serializeGameState(await game.state);
  });

export const makeMove = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { slug: string; position: number; playerSymbol: SymbolType }) => data
  )
  .handler(async ({ data }): Promise<GameState> => {
    const game = await getAgentByName<Env, GameAgent>(env.GameAgent, data.slug);
    const state = await game.state;

    if (!state.game) throw new Error("Game not found");
    if (state.game.board[data.position] !== null)
      throw new Error("Invalid move");

    // Apply move
    const newBoard = [...state.game.board];
    newBoard[data.position] = data.playerSymbol;

    const winner = calculateWinner(newBoard);

    await game.setState({
      ...state,
      game: { ...state.game, board: newBoard, winner },
      updatedAt: new Date().toISOString(),
    });

    // If AI opponent and not game over, make AI move
    const opponentSymbol =
      data.playerSymbol === SymbolType.X ? SymbolType.O : SymbolType.X;
    const opponent = state.game.players[opponentSymbol];

    if (opponent.type === PlayerType.AI && !winner) {
      const aiMove = await game.makeAIMove(opponentSymbol);
      const aiBoard = [...newBoard];
      aiBoard[aiMove] = opponentSymbol;
      const aiWinner = calculateWinner(aiBoard);

      const updatedState = await game.state;
      await game.setState({
        ...updatedState,
        game: { ...updatedState.game!, board: aiBoard, winner: aiWinner },
        updatedAt: new Date().toISOString(),
      });
    }

    return serializeGameState(await game.state);
  });

export const joinGame = createServerFn({ method: "POST" })
  .inputValidator((data: { slug: string }) => data)
  .handler(
    async ({
      data,
    }): Promise<{ state: GameState; playerSymbol: SymbolType }> => {
      const game = await getAgentByName<Env, GameAgent>(
        env.GameAgent,
        data.slug
      );
      const state = await game.state;

      if (!state.waitingForPlayers) throw new Error("Game full");

      // Find which symbol is pending
      const pendingSymbol = state.game!.players.X.pending
        ? SymbolType.X
        : SymbolType.O;

      await game.setState({
        ...state,
        game: {
          ...state.game!,
          players: {
            ...state.game!.players,
            [pendingSymbol]: {
              ...state.game!.players[pendingSymbol],
              pending: false,
            },
          } as Players,
        },
        waitingForPlayers: false,
        inProgress: true,
      });

      return {
        state: serializeGameState(await game.state),
        playerSymbol: pendingSymbol,
      };
    }
  );

export const switchToAI = createServerFn({ method: "POST" })
  .inputValidator((data: { slug: string; aiLevel: AILevel }) => data)
  .handler(async ({ data }): Promise<GameState> => {
    const game = await getAgentByName<Env, GameAgent>(env.GameAgent, data.slug);
    const state = await game.state;

    // Find pending player
    const pendingSymbol = state.game!.players.X.pending
      ? SymbolType.X
      : SymbolType.O;

    await game.setState({
      ...state,
      game: {
        ...state.game!,
        players: {
          ...state.game!.players,
          [pendingSymbol]: {
            name: `AI (${data.aiLevel})`,
            symbol: pendingSymbol,
            type: PlayerType.AI,
            level: data.aiLevel,
            pending: false,
          },
        } as Players,
      },
      waitingForPlayers: false,
      inProgress: true,
    });

    return serializeGameState(await game.state);
  });

// Helper function
function calculateWinner(board: Board): SymbolType | "Draw" | undefined {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8], // rows
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8], // cols
    [0, 4, 8],
    [2, 4, 6], // diagonals
  ];

  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a]!;
    }
  }

  if (board.every(Boolean)) return "Draw";
  return undefined;
}

function serializeGameState(state: GameState): GameState {
  return {
    slug: state.slug,
    waitingForPlayers: state.waitingForPlayers,
    inProgress: state.inProgress,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
    game: state.game,
  };
}
