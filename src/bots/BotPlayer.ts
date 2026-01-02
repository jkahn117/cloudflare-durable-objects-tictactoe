import { Board } from "@/types";
/**
 * Interface for AI bot players
 * Implementations should provide different difficulty levels via system prompts
 */
export interface BotPlayer {
  /**
   * Internal AI instructions defining bot behavior and strategy
   */
  readonly systemPrompt: string;
  /**
   * User-facing prompt template for current board state
   */
  readonly userPrompt: string;
  /**
   * Makes a move on the given board
   * @param board - Current game board state
   * @returns Promise resolving to the position index (0-8) to play
   * @throws Error if no valid move is available or AI fails
   */
  makeMove(board: Board): Promise<number>;
}

export abstract class BaseBotPlayer implements BotPlayer {
  abstract readonly systemPrompt: string;
  abstract readonly userPrompt: string;

  constructor(protected env: Env) {}

  /**
   * Template method: subclasses implement AI-specific move logic
   */
  protected abstract generateMove(board: Board): Promise<number | null>;

  /**
   * Public interface with built-in fallback logic
   */
  async makeMove(board: Board): Promise<number> {
    try {
      // Try AI-generated move
      const move = await this.generateMove(board);

      // Validate the move
      if (this.isValidMove(move, board)) {
        return move;
      }

      // AI returned invalid move, use fallback
      return this.getFallbackMove(board);
    } catch (error) {
      console.error("Bot move generation failed:", error);
      // Use fallback on any error
      return this.getFallbackMove(board);
    }
  }

  /**
   * Validates if a move is legal
   */
  protected isValidMove(move: number | null, board: Board): move is number {
    return (
      move !== null &&
      !isNaN(move) &&
      move >= 0 &&
      move <= 8 &&
      board[move] === null
    );
  }
  /**
   * Fallback strategy when AI fails or returns invalid move
   */
  protected getFallbackMove(board: Board): number {
    // Strategy 1: Find first empty position
    const emptyPosition = board.findIndex((pos) => pos === null);

    if (emptyPosition !== -1) {
      return emptyPosition;
    }

    // Strategy 2: No valid moves (board full or invalid)
    throw new Error("No valid moves available on the board");
  }
}
