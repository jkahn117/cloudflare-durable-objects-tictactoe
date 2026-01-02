import { Agent, callable } from "agents";
import {
  AILevel,
  AIPlayer,
  Game,
  HumanPlayer,
  PlayerType,
  SymbolType,
} from "@/types";
import { BotPlayer } from "../bots/BotPlayer";
import { BotExpert } from "../bots/BotExpert";

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
  game?: Game;
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
   * Default state for a new game before setup() is called.
   * Games start in "waiting for players" mode.
   */
  initialState: GameState = {
    slug: "",
    waitingForPlayers: true,
    inProgress: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

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
   * If the AI has the first turn (X), automatically triggers the AI move.
   * 
   * @param {Object} params - Setup parameters
   * @param {string} params.slug - Unique identifier for this game
   */
  setup({ slug }: { slug: string }): void {
    this.setState({
      ...this.initialState,
      game: this.initialGame,
      slug,
    });

    if (this.isAIMove()) {
      this.makeAIMove(this.aiPlayer()!);
    }
  }

  /**
   * Determines which symbol (if any) is controlled by the AI player.
   *
   * @returns {SymbolType | null} The AI player's symbol (X or O), or null if no AI player exists
   */
  aiPlayer(): SymbolType | null {
    const game = this.state.game;
    if (!game) return null;

    if (game.players.X.type === PlayerType.AI) {
      return SymbolType.X;
    }
    if (game.players.O.type === PlayerType.AI) {
      return SymbolType.O;
    }

    return null;
  }

  /**
   * Checks if it's currently the AI player's turn to move.
   *
   * @returns {boolean} True if the current turn belongs to an AI player
   */
  isAIMove(): boolean {
    const game = this.state.game;

    if (!game || game.winner) return false;

    return game.currentTurn === this.aiPlayer();
  }

  /**
   * Executes an AI move for the specified player symbol.
   * This method is callable from the client via RPC.
   * 
   * @param {SymbolType} playerSymbol - The symbol (X or O) of the AI player to move
   * @returns {Promise<number>} The board position (0-8) where the AI chose to move
   * @throws {Error} If the specified player is not an AI player
   */
  @callable()
  async makeAIMove(playerSymbol: SymbolType): Promise<number> {
    const player = this.state.game!.players[playerSymbol];

    if (player.type !== PlayerType.AI) {
      throw new Error("Cannot make AI move for human player");
    }

    // TypeScript knows player is AIPlayer here
    const bot = this.getBotForLevel(player.level);
    return await bot.makeMove(this.state.game!.board);
  }

  /**
   * Creates and returns the appropriate bot implementation based on AI difficulty level.
   * 
   * @param {AILevel} level - The difficulty level (BEGINNER, INTERMEDIATE, or EXPERT)
   * @returns {BotPlayer} Instance of the bot implementation for the specified level
   * 
   * @note Currently only EXPERT is fully implemented. BEGINNER and INTERMEDIATE
   *       fall through to EXPERT as placeholders.
   */
  private getBotForLevel(level: AILevel): BotPlayer {
    switch (level) {
      case AILevel.BEGINNER:
      // return new BotBeginner(this.env);
      case AILevel.INTERMEDIATE:
      // return new BotIntermediate(this.env);
      case AILevel.EXPERT:
        return new BotExpert(this.env);
    }
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
