import { createServerFn } from "@tanstack/react-start";
import { getAgentByName } from "agents";
import { env } from "cloudflare:workers";
import { LobbyAgent, LobbyState } from "@/agents/Lobby";
import { GameAgent, GameState } from "@/agents/Game";
import { GameConfig, Players, PlayerType, SymbolType } from "@/types";
import { GameWorkflowParams } from "@/workflows/utils/types";

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
 * Randomly assigns X or O to the creator.
 * For AI games: starts the HumanVsAI workflow immediately.
 * For human games: waits for second player to join before starting workflow.
 *
 * @param {GameConfig} data - Game configuration object:
 *   - opponentType: "human" | "ai" - Type of opponent
 *   - aiLevel?: AILevel - Required if opponentType is "ai" (BEGINNER | INTERMEDIATE | EXPERT)
 *
 * @returns {Promise<{slug: string, creatorSymbol: SymbolType, waitingForPlayer: boolean}>}
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

      // Configure players based on opponent type
      const players: Players =
        data.opponentType === "ai"
          ? ({
              [creatorSymbol]: {
                name: "Player",
                symbol: creatorSymbol,
                type: PlayerType.HUMAN,
                pending: false,
              },
              [opponentSymbol]: {
                name: `AI (${data.aiLevel})`,
                symbol: opponentSymbol,
                type: PlayerType.AI,
                level: data.aiLevel!,
                pending: false,
              },
            } as Players)
          : ({
              [creatorSymbol]: {
                name: "Player 1",
                symbol: creatorSymbol,
                type: PlayerType.HUMAN,
                pending: false,
              },
              [opponentSymbol]: {
                name: "Waiting...",
                symbol: opponentSymbol,
                type: PlayerType.HUMAN,
                pending: true,
              },
            } as Players);

      // For AI games, start the workflow immediately
      if (data.opponentType === "ai") {
        const workflowParams: GameWorkflowParams = {
          gameSlug: slug,
          players,
          startingTurn: SymbolType.X,
        };

        // Create workflow instance with game slug as ID
        const instance = await env.HUMAN_VS_AI_WORKFLOW.create({
          id: slug,
          params: workflowParams,
        });

        // Update game state with workflow ID
        const currentState = await game.state;
        await game.setState({
          ...currentState,
          game: {
            ...currentState.game!,
            players,
            currentTurn: SymbolType.X,
          },
          waitingForPlayers: false,
          inProgress: true,
          workflowInstanceId: instance.id,
        });
      } else {
        // Human vs Human - wait for second player before starting workflow
        const currentState = await game.state;
        await game.setState({
          ...currentState,
          game: {
            ...currentState.game!,
            players,
            currentTurn: SymbolType.X,
          },
          waitingForPlayers: true,
          inProgress: false,
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
 * @returns {Promise<GameState>} Current game state
 */
export const getGameState = createServerFn()
  .inputValidator((data: { slug: string }) => data)
  .handler(async ({ data }): Promise<GameState> => {
    const game = await getAgentByName<Env, GameAgent>(env.GameAgent, data.slug);
    return serializeGameState(await game.state);
  });

// NOTE: makeMove server function removed - client uses useAgent.setState() directly
// GameAgent.onStateUpdate detects moves and forwards them to the workflow

/**
 * Allows a second player to join an existing game that is waiting for players.
 * Assigns the pending symbol to the joining player and starts the HumanVsHuman workflow.
 *
 * @param {Object} data - Request payload:
 *   - slug: string - Unique game identifier
 *
 * @returns {Promise<{state: GameState, playerSymbol: SymbolType}>}
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
      if (!state.game) throw new Error("Game not initialized");

      // Find which symbol is pending
      const pendingSymbol = state.game.players.X.pending
        ? SymbolType.X
        : SymbolType.O;

      // Update player to not pending
      const updatedPlayers: Players = {
        ...state.game.players,
        [pendingSymbol]: {
          ...state.game.players[pendingSymbol],
          name: "Player 2",
          pending: false,
        },
      } as Players;

      // Start the HumanVsHuman workflow now that both players are ready
      const workflowParams: GameWorkflowParams = {
        gameSlug: data.slug,
        players: updatedPlayers,
        startingTurn: SymbolType.X,
      };

      const instance = await env.HUMAN_VS_HUMAN_WORKFLOW.create({
        id: data.slug,
        params: workflowParams,
      });

      // Update game state
      await game.setState({
        ...state,
        game: {
          ...state.game,
          players: updatedPlayers,
          currentTurn: SymbolType.X,
        },
        waitingForPlayers: false,
        inProgress: true,
        workflowInstanceId: instance.id,
      });

      return {
        state: serializeGameState(await game.state),
        playerSymbol: pendingSymbol,
      };
    }
  );

/**
 * Gets the status of the workflow managing a game.
 * Useful for debugging and monitoring.
 *
 * @param {Object} data - Request payload:
 *   - slug: string - Unique game identifier
 *
 * @returns {Promise<{status: string, workflowId?: string}>}
 */
export const getWorkflowStatus = createServerFn()
  .inputValidator((data: { slug: string }) => data)
  .handler(
    async ({ data }): Promise<{ status: string; workflowId?: string }> => {
      const game = await getAgentByName<Env, GameAgent>(
        env.GameAgent,
        data.slug
      );
      const state = await game.state;

      if (!state.workflowInstanceId) {
        return { status: "not_started" };
      }

      try {
        // Try AI workflow first
        const hasAI =
          state.game?.players.X.type === PlayerType.AI ||
          state.game?.players.O.type === PlayerType.AI;

        const workflow = hasAI
          ? await env.HUMAN_VS_AI_WORKFLOW.get(state.workflowInstanceId)
          : await env.HUMAN_VS_HUMAN_WORKFLOW.get(state.workflowInstanceId);

        const status = await workflow.status();
        return {
          status: status.status,
          workflowId: state.workflowInstanceId,
        };
      } catch (error) {
        return {
          status: "error",
          workflowId: state.workflowInstanceId,
        };
      }
    }
  );

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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
    workflowInstanceId: state.workflowInstanceId,
  };
}
