import { Board, SymbolType } from "@/types";
import { BotPlayer } from "./BotPlayer";

/**
 * Adjacency map for the tic-tac-toe board.
 * Each position maps to its adjacent positions (orthogonal and diagonal neighbors).
 *
 *   0 | 1 | 2
 *   ---------
 *   3 | 4 | 5
 *   ---------
 *   6 | 7 | 8
 */
const ADJACENCY_MAP: Record<number, number[]> = {
  0: [1, 3, 4],
  1: [0, 2, 3, 4, 5],
  2: [1, 4, 5],
  3: [0, 1, 4, 6, 7],
  4: [0, 1, 2, 3, 5, 6, 7, 8], // Center is adjacent to all
  5: [1, 2, 4, 7, 8],
  6: [3, 4, 7],
  7: [3, 4, 5, 6, 8],
  8: [4, 5, 7],
};

/**
 * BotBeginner uses a simple strategy:
 * - If first move, pick a random empty position
 * - Otherwise, pick an adjacent space to the opponent's last move
 *
 * This creates a predictable, easy-to-beat opponent.
 */
export class BotBeginner implements BotPlayer {
  readonly systemPrompt = ""; // Not used - deterministic logic
  readonly userPrompt = "";

  constructor(protected env: Env) {}

  async makeMove(board: Board): Promise<number> {
    const emptyPositions = this.getEmptyPositions(board);

    if (emptyPositions.length === 0) {
      throw new Error("No valid moves available on the board");
    }

    // Find opponent's last move by comparing board state
    const opponentLastMove = this.findOpponentLastMove(board);

    // First move or can't determine opponent's move: pick random
    if (opponentLastMove === null) {
      return this.pickRandom(emptyPositions);
    }

    // Try to pick an adjacent position to opponent's last move
    const adjacentPositions = ADJACENCY_MAP[opponentLastMove];
    const emptyAdjacent = adjacentPositions.filter((pos) => board[pos] === null);

    if (emptyAdjacent.length > 0) {
      return this.pickRandom(emptyAdjacent);
    }

    // No adjacent positions available, fall back to random
    return this.pickRandom(emptyPositions);
  }

  /**
   * Finds the opponent's last move by looking for X positions.
   * Returns the most likely last move (highest index X if multiple).
   */
  private findOpponentLastMove(board: Board): number | null {
    // Find all opponent (X) positions
    const opponentPositions: number[] = [];
    for (let i = 0; i < board.length; i++) {
      if (board[i] === SymbolType.X) {
        opponentPositions.push(i);
      }
    }

    if (opponentPositions.length === 0) {
      return null; // Bot goes first
    }

    // Return the last X position found
    // Note: This is a simple heuristic. In a real implementation,
    // we might track the previous board state to know exactly which move was new.
    return opponentPositions[opponentPositions.length - 1];
  }

  private getEmptyPositions(board: Board): number[] {
    const empty: number[] = [];
    for (let i = 0; i < board.length; i++) {
      if (board[i] === null) {
        empty.push(i);
      }
    }
    return empty;
  }

  private pickRandom(positions: number[]): number {
    const index = Math.floor(Math.random() * positions.length);
    return positions[index];
  }
}
