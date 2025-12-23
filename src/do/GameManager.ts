import { Agent, Connection, ConnectionContext, WSMessage } from "agents";
import {
  BoardType,
  Game,
  NewGameParams,
  SymbolType,
  UpdateGameParams,
} from "../types";

const initBoard: BoardType = new Array(9).fill(undefined);

/**
 * GAME_MANAGER: DURABLE OBJECT / AGENT
 *
 * Manages games between a player and the AI OR between two players. Utilizing `Agent`,
 * which is built on top of `DurableObject`, to simplify building my websocket implementation.
 */
export class GameManager extends Agent {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    // `blockConcurrencyWhile()` ensures no requests are delivered
    // until initialization is complete
    ctx.blockConcurrencyWhile(async () => {});
  }

  /**
   * Handle new connections to the web socket.
   * @param connection
   * @param ctx
   */
  override async onConnect(connection: Connection, ctx: ConnectionContext) {
    console.log("[GameManager] onConnect called");
    const url = new URL(ctx.request.url);
    const gameId = url.pathname
      .split("/api/agents/game-manager/")[1]
      .split("?")[0];

    console.log("[GameManager] Connection details:", {
      gameId,
      connectionId: connection.id,
      url: ctx.request.url,
    });

    await connection.setState({ id: gameId });
    connection.send(
      JSON.stringify({
        type: "player_connected",
        gameId,
        timestamp: Date.now(),
      })
    );
  }

  /**
   * Handle messages received by the web socket.
   * @param connection
   * @param message
   */
  override async onMessage(connection: Connection<Game>, message: WSMessage) {
    console.log("[GameManager] onMessage called! 🎉", {
      connectionId: connection.id,
      messageType: typeof message,
      message: message.toString(),
    });

    const data = JSON.parse(message.toString());
    const state = connection.state;

    const result = await (async () => {
      switch (data.type) {
        case "create_game":
          const newGame = await this.createGame(data.data);
          await connection.setState(newGame);
          return {
            type: "game_created",
            data: { ...newGame, timestamp: Date.now() },
          };
        case "update_game":
          if (!state || !state.id) {
            throw new Error("Game not found");
          }
          const update = await this.updateState(state.id, data.data);

          const gameToUpdate = await this.loadGame(state.id);
          if (gameToUpdate) {
            await connection.setState(gameToUpdate);
          }

          return {
            type: "game_updated",
            data: { ...update, timestamp: Date.now() },
          };
        case "end_game":
          if (!state || !state.id) {
            throw new Error("Game not found");
          }
          await this.deleteGame(state.id);
          return {
            type: "game_ended",
            data: { gameId: state.id, timestamp: Date.now() },
          };
        default:
          return { message: "Unknown operation" };
      }
    })();

    connection.send(JSON.stringify(result));
  }

  /**
   * Handle closed web sockets.
   * @param connection
   */
  override async onClose(connection: Connection<Game>) {
    console.log("[GameManager] onClose called:", {
      connectionId: connection.id,
    });
    const state = connection.state;

    connection.send(
      JSON.stringify({
        type: "player_disconnected",
        gameId: state?.id,
        timestamp: Date.now(),
      })
    );
  }

  ///// HELPER METHODS
  private gameKey(gameId: string): string {
    return `game:${gameId}`;
  }

  private async loadGame(gameId: string): Promise<Game | undefined> {
    const gameJson = await this.ctx.storage.get<string>(this.gameKey(gameId));
    if (!gameJson) return undefined;

    const game = JSON.parse(gameJson) as Game;
    game.updatedAt = new Date(game.updatedAt);
    return game;
  }

  private async saveGame(game: Game): Promise<void> {
    const serializable = {
      ...game,
      updatedAt: game.updatedAt.toISOString(),
    };

    await this.ctx.storage.put(
      this.gameKey(game.id),
      JSON.stringify(serializable)
    );
  }

  private async deleteGame(gameId: string): Promise<void> {
    await this.ctx.storage.delete(this.gameKey(gameId));
  }

  private async hasGame(gameId: string): Promise<boolean> {
    return (await this.loadGame(gameId)) !== undefined;
  }

  private async ensureGameExists(gameId: string): Promise<void> {
    if (!(await this.hasGame(gameId))) {
      throw new Error("Game not found");
    }
  }

  /**
   *
   * @param params
   * @returns
   */
  private async createGame(params: NewGameParams): Promise<Game> {
    const gameId = crypto.randomUUID();
    const now = new Date();

    const game: Game = {
      id: gameId,
      xPlayer: params.playerId,
      oPlayer: "ai",
      board: initBoard,
      isXNext: true,
      updatedAt: now,
    };

    await this.saveGame(game);
    return game;
  }

  private async updateState(
    gameId: string,
    params: UpdateGameParams
  ): Promise<Partial<Game>> {
    if (gameId !== params.gameId) {
      throw new Error("[GameManager] Game ID mismatch");
    }

    const game = await this.loadGame(gameId);
    if (!game) {
      throw new Error("[GameManager] Game not found");
    }

    const currentTurnSymbol: SymbolType = game.isXNext ? "X" : "O";

    if (game.isXNext && game.xPlayer !== params.playerId) {
      throw new Error("Not your turn");
    }

    const board = (await this.ctx.storage.get<BoardType>("board")) || initBoard;
    const newBoard = [...board];
    newBoard[params.spaceTaken] = currentTurnSymbol;

    game.board = newBoard;
    game.isXNext = !game.isXNext;
    game.updatedAt = new Date();

    const winner = await this.calculateWinner(game.board);
    if (winner) {
      game.winner = winner;
    }

    await this.saveGame(game);

    return {
      board: game.board,
      isXNext: game.isXNext,
      updatedAt: game.updatedAt,
      ...(winner && { winner }),
    };
  }

  private async calculateWinner(
    board: BoardType
  ): Promise<SymbolType | "Draw" | undefined> {
    const lines = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8], // Rows
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8], // Cols
      [0, 4, 8],
      [2, 4, 6], // Diagonals
    ];

    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i];
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a];
      }
    }
    if (board.every(Boolean)) return "Draw";
    return undefined;
  }
}
