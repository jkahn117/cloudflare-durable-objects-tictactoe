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

export type GameState = {
  slug: string;
  waitingForPlayers: boolean;
  inProgress: boolean;
  createdAt: string;
  updatedAt: string;
  game?: Game;
};

export class GameAgent extends Agent<Env, GameState> {
  initialState: GameState = {
    slug: "",
    waitingForPlayers: true,
    inProgress: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

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
    board: new Array(9).fill(null),
    winner: undefined,
  };

  onStart(): void {
    // this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS moves (
    //     id INTEGER PRIMARY KEY AUTOINCREMENT,
    //     player TEXT NOT NULL,
    //     spaceTaken INTEGER NOT NULL,
    //     createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    // );`);
  }

  setup({ slug }: { slug: string }): void {
    this.setState({
      ...this.initialState,
      game: this.initialGame,
      slug,
    });
  }

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

  async delete(): Promise<void> {
    return this.destroy();
  }
}
