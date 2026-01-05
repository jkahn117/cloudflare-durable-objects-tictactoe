import { Board, SymbolType, Players } from "@/types";

// ============================================================================
// WORKFLOW PARAMETERS - passed when workflow is created
// ============================================================================

/**
 * Parameters passed when creating a game workflow instance.
 * Contains all information needed to initialize and run a game.
 */
export interface GameWorkflowParams {
  /** Unique game identifier (also used as workflow instance ID) */
  gameSlug: string;
  /** Player configuration for both X and O */
  players: Players;
  /** Which symbol takes the first turn */
  startingTurn: SymbolType;
}

// ============================================================================
// WORKFLOW EVENTS - sent to running workflows via sendEvent
// ============================================================================

/**
 * Event sent when a human player makes a move.
 * Received by workflow via step.waitForEvent().
 */
export interface MoveEvent {
  /** Board position (0-8) where the player wants to place their symbol */
  position: number;
  /** Symbol of the player making the move */
  playerSymbol: SymbolType;
}

// ============================================================================
// WORKFLOW INTERNAL STATE - passed between steps
// ============================================================================

/**
 * State maintained and passed between workflow steps.
 * Represents the current game state within the workflow.
 */
export interface GameLoopState {
  /** Current board state */
  board: Board;
  /** Which symbol's turn it is */
  currentTurn: SymbolType;
  /** Number of moves made so far */
  moveCount: number;
}

/**
 * Result returned when workflow completes.
 */
export interface GameWorkflowResult {
  /** Winner symbol, "Draw", or "Timeout" if a player didn't move in time */
  winner: SymbolType | "Draw" | "Timeout";
  /** Final board state */
  finalBoard: Board;
  /** Total moves made */
  moves: number;
  /** Symbol of player who timed out (if applicable) */
  timedOutPlayer?: SymbolType;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Event type for player moves - must match between waitForEvent and sendEvent */
export const MOVE_EVENT_TYPE = "player-move";

/** How long to wait for a human player to make a move before timeout */
export const HUMAN_MOVE_TIMEOUT = "5 minutes";

/** Game end reasons for error messages */
export enum GameEndReason {
  WIN = "win",
  DRAW = "draw",
  TIMEOUT = "timeout",
  ERROR = "error",
}
