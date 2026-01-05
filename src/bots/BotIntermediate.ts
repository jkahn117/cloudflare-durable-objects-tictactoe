import { Board, SymbolType } from "@/types";
import { BotPlayer } from "./BotPlayer";

/**
 * All possible winning lines in tic-tac-toe.
 */
const WINNING_LINES: number[][] = [
  [0, 1, 2], // Top row
  [3, 4, 5], // Middle row
  [6, 7, 8], // Bottom row
  [0, 3, 6], // Left column
  [1, 4, 7], // Middle column
  [2, 5, 8], // Right column
  [0, 4, 8], // Diagonal top-left to bottom-right
  [2, 4, 6], // Diagonal top-right to bottom-left
];

/**
 * BotIntermediate uses a defensive/opportunistic strategy:
 * 1. Take a winning move if available
 * 2. Block opponent's winning move if they have one
 * 3. Take center if available
 * 4. Take a corner if available
 * 5. Take any available position
 *
 * Does NOT understand forks or advanced strategy.
 */
export class BotIntermediate implements BotPlayer {
  readonly systemPrompt = ""; // Not used - deterministic logic
  readonly userPrompt = "";

  constructor(protected env: Env) {}

  async makeMove(board: Board): Promise<number> {
    const botSymbol = SymbolType.O;
    const opponentSymbol = SymbolType.X;

    // 1. Check for winning move
    const winningMove = this.findWinningMove(board, botSymbol);
    if (winningMove !== null) {
      return winningMove;
    }

    // 2. Block opponent's winning move
    const blockingMove = this.findWinningMove(board, opponentSymbol);
    if (blockingMove !== null) {
      return blockingMove;
    }

    // 3. Take center if available
    if (board[4] === null) {
      return 4;
    }

    // 4. Take a corner if available
    const corners = [0, 2, 6, 8];
    const availableCorner = corners.find((pos) => board[pos] === null);
    if (availableCorner !== undefined) {
      return availableCorner;
    }

    // 5. Take any available side
    const sides = [1, 3, 5, 7];
    const availableSide = sides.find((pos) => board[pos] === null);
    if (availableSide !== undefined) {
      return availableSide;
    }

    // No moves available (shouldn't happen in normal gameplay)
    throw new Error("No valid moves available on the board");
  }

  /**
   * Finds a move that would complete a winning line for the given symbol.
   * Returns null if no winning move exists.
   */
  private findWinningMove(board: Board, symbol: SymbolType): number | null {
    for (const line of WINNING_LINES) {
      const [a, b, c] = line;
      const values = [board[a], board[b], board[c]];

      // Count how many of this symbol and how many empty in this line
      const symbolCount = values.filter((v) => v === symbol).length;
      const emptyCount = values.filter((v) => v === null).length;

      // If we have 2 of our symbol and 1 empty, that's a winning move
      if (symbolCount === 2 && emptyCount === 1) {
        // Return the empty position
        if (board[a] === null) return a;
        if (board[b] === null) return b;
        if (board[c] === null) return c;
      }
    }

    return null;
  }
}
