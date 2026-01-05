import { Agent, getAgentByName } from "agents";
import {
  AILevel,
  AIPlayer,
  Board,
  Game,
  HumanPlayer,
  PlayerType,
  SymbolType,
} from "@/types";
import { MOVE_EVENT_TYPE, MoveEvent } from "@/workflows/utils/types";
import { LobbyAgent } from "./Lobby";

/** Delay before cleaning up a finished game (in seconds) */
const CLEANUP_DELAY_SECONDS = 60;

/**
 * GameState represents the complete state of a tic-tac-toe game.
 * This is the primary data structure stored in the Durable Object.
 */
export type GameState = {
  slug: string;
  waitingForPlayers: boolean;
  inProgress: boolean;
  createdAt: string;
  updatedAt: string;
  /** Game data - optional during initial setup before workflow starts */
  game?: Game;
  /** ID of the workflow instance managing this game */
  workflowInstanceId?: string;
};

/**
 * GameAgent is a Cloudflare Durable Object that manages the state and logic
 * for individual tic-tac-toe games. Each game gets its own isolated instance.
 *
 * Responsibilities:
 * - Maintain game state (board, players, turn, winner)
 * - Execute AI moves when appropriate
 * - Track move history in SQL storage
 * - Handle game lifecycle (setup, play, deletion)
 */
export class GameAgent extends Agent<Env, GameState> {
  /**
   * Tracks the last known board state to detect new moves.
   * Stored as instance property (not in state) to avoid recursive setState calls.
   */
  private lastKnownBoard: Board | null = null;

  /**
   * Template for a fresh game board and player configuration.
   * By default, X is human and O is AI (Expert level), both pending.
   */
  initialGame: Game = {
    players: {
      X: {
        name: "pending",
        symbol: SymbolType.X,
        type: PlayerType.HUMAN,
        pending: true,
      } as HumanPlayer,
      O: {
        name: "pending",
        symbol: SymbolType.O,
        type: PlayerType.AI,
        pending: true,
        level: AILevel.EXPERT,
      } as AIPlayer,
    },
    currentTurn: SymbolType.X,
    board: new Array(9).fill(null),
    winner: undefined,
  };

  /**
   * Default state for a new game before setup() is called.
   * Games start in "waiting for players" mode.
   */
  initialState: GameState = {
    slug: "",
    waitingForPlayers: true,
    inProgress: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    game: this.initialGame,
  };

  /**
   * Lifecycle hook called when the Durable Object is first created.
   * Sets up the SQL database schema for storing move history.
   */
  onStart(): void {
    this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS moves (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player TEXT NOT NULL,
        spaceTaken INTEGER NOT NULL,
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );`);
  }

  /**
   * Initializes a new game with the given slug identifier.
   * The workflow will handle game initialization and AI moves.
   *
   * @param {Object} params - Setup parameters
   * @param {string} params.slug - Unique identifier for this game
   * @param {string} [params.workflowInstanceId] - ID of the workflow managing this game
   */
  setup({
    slug,
    workflowInstanceId,
  }: {
    slug: string;
    workflowInstanceId?: string;
  }): void {
    this.setState({
      ...this.initialState,
      game: this.initialGame,
      slug,
      workflowInstanceId,
    });
  }

  /**
   * Called when state is updated (by workflow or client via useAgent).
   * Detects new moves from client and forwards them to the workflow.
   *
   * @param state - New state
   * @param source - "server" if from workflow, Connection if from client
   */
  async onStateUpdate(
    state: GameState | undefined,
    source: "server" | unknown
  ): Promise<void> {
    if (!state || !state.game || !state.workflowInstanceId) return;

    // Only process client-initiated updates (not workflow updates)
    if (source === "server") {
      console.log(`[GameAgent:${state.slug}] Workflow updated state`);
      // Update lastKnownBoard to match workflow state (no setState to avoid recursion)
      this.lastKnownBoard = [...state.game.board];
      return;
    }

    // Detect if client made a new move by comparing boards
    const newMove = this.detectNewMove(this.lastKnownBoard, state.game.board);

    if (newMove) {
      console.log(
        `[GameAgent:${state.slug}] Client move detected: position ${newMove.position} by ${newMove.playerSymbol}`
      );

      // Update lastKnownBoard before sending to workflow (no setState to avoid recursion)
      this.lastKnownBoard = [...state.game.board];

      // Forward the move to the workflow
      await this.sendMoveToWorkflow(state, newMove);
    }
  }

  /**
   * Detects a new move by comparing previous and current board states.
   *
   * @returns MoveEvent if a new move is detected, null otherwise
   */
  private detectNewMove(
    previousBoard: Board | null,
    currentBoard: Board
  ): MoveEvent | null {
    if (!previousBoard) {
      // First move - find the single occupied position
      const position = currentBoard.findIndex((cell) => cell !== null);
      if (position === -1) return null;
      return {
        position,
        playerSymbol: currentBoard[position]!,
      };
    }

    // Find the position that changed from null to a symbol
    for (let i = 0; i < 9; i++) {
      if (previousBoard[i] === null && currentBoard[i] !== null) {
        return {
          position: i,
          playerSymbol: currentBoard[i]!,
        };
      }
    }

    return null;
  }

  /**
   * Sends a move event to the appropriate workflow.
   */
  private async sendMoveToWorkflow(
    state: GameState,
    move: MoveEvent
  ): Promise<void> {
    if (!state.workflowInstanceId || !state.game) return;

    try {
      const hasAI =
        state.game.players.X.type === PlayerType.AI ||
        state.game.players.O.type === PlayerType.AI;

      const workflow = hasAI
        ? await this.env.HUMAN_VS_AI_WORKFLOW.get(state.workflowInstanceId)
        : await this.env.HUMAN_VS_HUMAN_WORKFLOW.get(state.workflowInstanceId);

      await workflow.sendEvent({
        type: MOVE_EVENT_TYPE,
        payload: move,
      });

      console.log(`[GameAgent:${state.slug}] Move sent to workflow`);
    } catch (error) {
      console.error(
        `[GameAgent:${state.slug}] Failed to send move to workflow:`,
        error
      );
      // Set error message on state so client knows something went wrong
      this.setState({
        ...state,
        game: {
          ...state.game!,
          errorMessage: "Failed to process move. Please try again.",
          errorPlayer: move.playerSymbol,
        },
      });
    }
  }

  /**
   * Schedules cleanup of this game after a delay.
   * Called by the workflow when the game ends (win, draw, or timeout).
   * Gives players time to see the final result before the game is removed.
   */
  async scheduleCleanup(): Promise<void> {
    const slug = this.state.slug;
    console.log(
      `[GameAgent:${slug}] Scheduling cleanup in ${CLEANUP_DELAY_SECONDS} seconds`
    );

    // Use the Agents SDK schedule method (wraps Durable Object alarms)
    await this.schedule(CLEANUP_DELAY_SECONDS, "cleanup", { slug });
  }

  /**
   * Cleanup handler called by the scheduled alarm.
   * Removes the game from the lobby and destroys this Durable Object.
   */
  async cleanup({ slug }: { slug: string }): Promise<void> {
    console.log(`[GameAgent:${slug}] Running cleanup`);

    try {
      // Notify LobbyAgent to remove this game from its state
      const lobby = await getAgentByName<Env, LobbyAgent>(
        this.env.LobbyAgent,
        "lobby"
      );
      lobby.removeGame(slug);
      console.log(`[GameAgent:${slug}] Removed from lobby`);
    } catch (error) {
      console.error(`[GameAgent:${slug}] Failed to notify lobby:`, error);
      // Continue with destruction even if lobby notification fails
    }

    // Destroy this Durable Object
    await this.destroy();
    console.log(`[GameAgent:${slug}] Destroyed`);
  }

  /**
   * Deletes this game and destroys the Durable Object instance.
   * Cleans up all associated storage and resources.
   *
   * @returns {Promise<void>}
   */
  async delete(): Promise<void> {
    return this.destroy();
  }
}
