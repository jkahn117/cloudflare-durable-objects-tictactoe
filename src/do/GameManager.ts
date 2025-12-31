import { Agent, Connection, ConnectionContext, WSMessage } from "agents";
import {
  BoardType,
  Game,
  NewGameParams,
  SymbolType,
  UpdateGameParams,
} from "@/types";
import { makeAIMove } from "./TicTacToeExpert";

const initBoard: BoardType = new Array(9).fill(null);

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
    // console.log("[GameManager] onConnect called");
    const url = new URL(ctx.request.url);
    const gameId = url.pathname
      .split("/api/agents/game-manager/")[1]
      .split("?")[0];

    // console.log("[GameManager] Connection details:", {
    //   gameId,
    //   connectionId: connection.id,
    //   url: ctx.request.url,
    // });

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
    // console.log("[GameManager] onMessage called! 🎉", {
    //   connectionId: connection.id,
    //   messageType: typeof message,
    //   message: message.toString(),
    // });

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
          let game = await this.updateState(state.id, data.data);

          await connection.setState(game);

          this.broadcastGameUpdate(state.id, game);

          if (game.oPlayer === "ai" && !game.isXNext && !game.winner) {
            // don't block while AI is making its move
            this.ctx.waitUntil(
              (async () => {
                this.broadcast(
                  JSON.stringify({
                    type: "ai_thinking",
                    data: { gameId: state.id },
                  })
                );
                // Small delay for UX
                await new Promise((resolve) => setTimeout(resolve, 500));

                const updatedGame = await this.makeAIPlay(state.id);
                if (updatedGame) {
                  this.broadcastGameUpdate(state.id, updatedGame);
                }
              })()
            );
          }

          return {
            type: "move_processed",
            data: { success: true },
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

    this.broadcast(JSON.stringify(result));
  }

  /**
   * Handle closed web sockets.
   * @param connection
   */
  override async onClose(connection: Connection<Game>) {
    // console.log("[GameManager] onClose called:", {
    //   connectionId: connection.id,
    // });
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
  private async makeAIPlay(gameId: string): Promise<Game | undefined> {
    const game = await this.loadGame(gameId);

    if (!game || game.oPlayer !== "ai" || game.isXNext) return undefined;

    if (game.winner) {
      return undefined; // game is over
    }

    console.log("[GameManager] Making AI move");

    try {
      const aiMove = await makeAIMove(game);

      if (aiMove < 0 || aiMove > 8 || game.board[aiMove] != null) {
        console.error("[GameManager] Invalid AI move:", aiMove);
        const fallbackMove = game.board.findIndex((square) => square === null);
        if (fallbackMove < 0) {
          throw new Error("[GameManager] No more moves available");
        }
        console.log("[GameManager] Fallback move:", fallbackMove);
        return await this.applyMove(gameId, fallbackMove, "ai");
      }

      const updatedGame = await this.applyMove(gameId, aiMove, "ai");
      return updatedGame;
    } catch (error) {
      console.error("[GameManager] Error making AI move:", error);
      return undefined;
    }
  }

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

  // private async hasGame(gameId: string): Promise<boolean> {
  //   return (await this.loadGame(gameId)) !== undefined;
  // }

  // private async ensureGameExists(gameId: string): Promise<void> {
  //   if (!(await this.hasGame(gameId))) {
  //     throw new Error("Game not found");
  //   }
  // }

  /**
   *
   * @param params
   * @returns
   */
  private async createGame(params: NewGameParams): Promise<Game> {
    const game: Game = {
      id: crypto.randomUUID(),
      xPlayer: params.playerId,
      oPlayer: "ai",
      board: initBoard,
      isXNext: true,
      updatedAt: new Date(),
    };

    await this.saveGame(game);
    return game;
  }

  private async updateState(
    gameId: string,
    params: UpdateGameParams
  ): Promise<Game> {
    // Validate request matches the game
    if (gameId !== params.gameId) {
      throw new Error("[GameManager] Game ID mismatch");
    }
    // Apply the player's move
    const game = await this.applyMove(
      gameId,
      params.spaceTaken,
      params.playerId
    );
    return game;
  }

  /**
   * Apply a move to the game (works for both human and AI)
   * @param gameId Game to update
   * @param move Position (0-8) to place the piece
   * @param playerId Who is making the move ("You", "ai", etc)
   * @returns Updated game state
   */
  private async applyMove(
    gameId: string,
    move: number,
    playerId: string
  ): Promise<Game> {
    const game = await this.loadGame(gameId);
    if (!game) {
      throw new Error("[GameManager] Game not found");
    }

    const currentTurnSymbol: SymbolType = game.isXNext ? "X" : "O";

    const isXPlayer = game.xPlayer === playerId;
    const isOPlayer = game.oPlayer === playerId;

    if (game.isXNext && !isXPlayer) {
      throw new Error("[GameManager] Not X player's turn");
    }
    if (!game.isXNext && !isOPlayer) {
      throw new Error("[GameManager] Not O player's turn");
    }

    // Validate move is valid
    if (move < 0 || move > 8) {
      throw new Error(`[GameManager] Invalid move position: ${move}`);
    }
    if (game.board[move] !== null) {
      console.log(game.board[move]);
      throw new Error(`[GameManager] Position ${move} is already occupied`);
    }

    // Apply the move
    game.board[move] = currentTurnSymbol;
    game.isXNext = !game.isXNext;
    game.updatedAt = new Date();

    const winner = await this.calculateWinner(game.board);
    if (winner) {
      game.winner = winner;
    }

    await this.saveGame(game);
    console.log(
      `[GameManager] Move applied: ${playerId} placed ${currentTurnSymbol} at ${move}`
    );

    return game;
  }

  /**
   * Broadcast a game update to all connections watching this game
   * @param gameId The game that was updated
   * @param game The updated game state
   */
  private broadcastGameUpdate(gameId: string, game: Game): void {
    const updateMessage = {
      type: "game_updated",
      data: {
        id: game.id,
        board: game.board,
        isXNext: game.isXNext,
        winner: game.winner,
        updatedAt: game.updatedAt,
        timestamp: Date.now(),
      },
    };
    // Send to all active connections
    // The Agent/PartyKit base class has a broadcast() method
    this.broadcast(JSON.stringify(updateMessage));
    console.log(`[GameManager] Broadcasted update for game ${gameId}`);
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
