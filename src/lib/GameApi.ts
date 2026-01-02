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

// ============================================================================
// LOBBY OPERATIONS
// ============================================================================

/**
 * Retrieves the current lobby state with all active games.
 *
 * @returns {Promise<LobbyState>} Object containing:
 *   - gamesSeekingPlayers: Array of games waiting for a second player
 *   - gamesInProgress: Array of active games
 *
 * Input: None (no parameters required)
 */
export const getLobbyState = createServerFn().handler(
  async (): Promise<LobbyState> => {
    const lobby = await getAgentByName<Env, LobbyAgent>(
      env.LobbyAgent,
      "lobby"
    );

    console.log("getting lobby state");

    const lobbyState = await lobby.state;

    return {
      gamesSeekingPlayers: lobbyState.gamesSeekingPlayers,
      gamesInProgress: lobbyState.gamesInProgress,
    };
  }
);

/**
 * Creates a new game with the specified configuration.
 * Randomly assigns X or O to the creator. If opponent is AI, sets up AI player immediately.
 *
 * @param {GameConfig} data - Game configuration object:
 *   - opponentType: "human" | "ai" - Type of opponent
 *   - aiLevel?: AILevel - Required if opponentType is "ai" (BEGINNER | INTERMEDIATE | EXPERT)
 *
 * @returns {Promise<{slug: string, creatorSymbol: SymbolType}>} Object containing:
 *   - slug: Unique game identifier
 *   - creatorSymbol: Symbol assigned to the game creator (X or O)
 *   - waitingForPlayer: boolean - Whether the game is waiting for a second player
 */
export const createGame = createServerFn({ method: "POST" })
  .inputValidator((config: GameConfig) => config)
  .handler(
    async ({
      data,
    }): Promise<{
      slug: string;
      creatorSymbol: SymbolType;
      waitingForPlayer: boolean;
    }> => {
      const lobby = await getAgentByName<Env, LobbyAgent>(
        env.LobbyAgent,
        "lobby"
      );
      const slug = await lobby.createGame(data.opponentType);

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
      } else {
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
                name: "pending",
                symbol: opponentSymbol,
                type: PlayerType.HUMAN,
                pending: true,
              },
            } as Players,
          },
          waitingForPlayers: false,
          inProgress: true,
        });
      }

      return {
        slug,
        creatorSymbol,
        waitingForPlayer: data.opponentType === "human",
      };
    }
  );

// ============================================================================
// GAME OPERATIONS
// ============================================================================

/**
 * Retrieves the current state of a specific game.
 *
 * @param {Object} data - Request payload:
 *   - slug: string - Unique game identifier
 *
 * @returns {Promise<GameState>} Current game state including:
 *   - slug: Game identifier
 *   - waitingForPlayers: boolean - Whether game is waiting for a second player
 *   - inProgress: boolean - Whether game is active
 *   - game: Game data (board, players, winner)
 *   - createdAt/updatedAt: Timestamps
 */
export const getGameState = createServerFn()
  .inputValidator((data: { slug: string }) => data)
  .handler(async ({ data }): Promise<GameState> => {
    const game = await getAgentByName<Env, GameAgent>(env.GameAgent, data.slug);
    return serializeGameState(await game.state);
  });

/**
 * Makes a move on the board for the specified player.
 * If the opponent is AI and the game continues, automatically triggers AI's move.
 *
 * @param {Object} data - Request payload:
 *   - slug: string - Unique game identifier
 *   - position: number - Board position (0-8) to place symbol
 *   - playerSymbol: SymbolType - Symbol of the player making the move (X or O)
 *
 * @returns {Promise<GameState>} Updated game state after move(s)
 *
 * @throws {Error} If position is invalid or already occupied
 */
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

/**
 * Allows a second player to join an existing game that is waiting for players.
 * Assigns the pending symbol to the joining player and starts the game.
 *
 * @param {Object} data - Request payload:
 *   - slug: string - Unique game identifier
 *
 * @returns {Promise<{state: GameState, playerSymbol: SymbolType}>} Object containing:
 *   - state: Updated game state
 *   - playerSymbol: Symbol assigned to the joining player (X or O)
 *
 * @throws {Error} If game is already full or not waiting for players
 */
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

/**
 * Switches a pending player slot to an AI opponent.
 * Used when a human opponent doesn't join in time.
 *
 * @param {Object} data - Request payload:
 *   - slug: string - Unique game identifier
 *   - aiLevel: AILevel - Difficulty level for AI (BEGINNER | INTERMEDIATE | EXPERT)
 *
 * @returns {Promise<GameState>} Updated game state with AI opponent configured
 */
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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculates the winner of the game based on the current board state.
 * Checks all possible winning combinations (rows, columns, diagonals).
 *
 * @param {Board} board - Array of 9 positions representing the game board
 *
 * @returns {SymbolType | "Draw" | undefined}
 *   - SymbolType (X or O) if there's a winner
 *   - "Draw" if all positions are filled with no winner
 *   - undefined if game is still in progress
 */
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

/**
 * Serializes game state for client transmission.
 * Creates a clean copy of the game state with only necessary fields.
 *
 * @param {GameState} state - Raw game state from the agent
 *
 * @returns {GameState} Serialized game state safe for client consumption
 */
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
