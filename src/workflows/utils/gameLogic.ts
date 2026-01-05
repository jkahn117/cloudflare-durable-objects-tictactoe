import { Board, SymbolType } from "@/types";

/**
 * All possible winning line combinations on a tic-tac-toe board.
 * Each array contains three indices that form a winning line.
 */
const WINNING_LINES = [
  [0, 1, 2], // top row
  [3, 4, 5], // middle row
  [6, 7, 8], // bottom row
  [0, 3, 6], // left column
  [1, 4, 7], // middle column
  [2, 5, 8], // right column
  [0, 4, 8], // diagonal top-left to bottom-right
  [2, 4, 6], // diagonal top-right to bottom-left
];

/**
 * Validates whether a move is legal on the current board.
 *
 * @param board - Current board state
 * @param position - Position (0-8) to validate
 * @returns true if the position is valid and empty
 */
export function validateMove(board: Board, position: number): boolean {
  return position >= 0 && position < 9 && board[position] === null;
}

/**
 * Applies a move to the board, returning a new board state.
 * Does not mutate the original board.
 *
 * @param board - Current board state
 * @param position - Position (0-8) to place the symbol
 * @param symbol - Symbol to place (X or O)
 * @returns New board with the move applied
 */
export function applyMove(
  board: Board,
  position: number,
  symbol: SymbolType
): Board {
  const newBoard = [...board];
  newBoard[position] = symbol;
  return newBoard;
}

/**
 * Checks the board for a winner or draw.
 *
 * @param board - Current board state
 * @returns The winning symbol (X or O), "Draw" if board is full with no winner, or null if game continues
 */
export function checkWinner(board: Board): SymbolType | "Draw" | null {
  // Check all winning lines
  for (const [a, b, c] of WINNING_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a]!;
    }
  }

  // Check for draw (all positions filled)
  if (board.every((cell) => cell !== null)) {
    return "Draw";
  }

  // Game continues
  return null;
}

/**
 * Gets the opposing symbol.
 *
 * @param current - Current symbol
 * @returns The opposite symbol
 */
export function getNextTurn(current: SymbolType): SymbolType {
  return current === SymbolType.X ? SymbolType.O : SymbolType.X;
}

/**
 * Counts the number of empty positions on the board.
 *
 * @param board - Current board state
 * @returns Number of empty (null) positions
 */
export function getEmptyPositions(board: Board): number[] {
  return board
    .map((cell, index) => (cell === null ? index : -1))
    .filter((index) => index !== -1);
}

/**
 * Creates an initial empty board.
 *
 * @returns A new board with all positions set to null
 */
export function createEmptyBoard(): Board {
  return new Array(9).fill(null);
}
