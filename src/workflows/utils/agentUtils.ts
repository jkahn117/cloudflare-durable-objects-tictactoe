import { getAgentByName } from "agents";
import { GameAgent, GameState } from "@/agents/Game";
import { Board, SymbolType } from "@/types";

/** Type for the agent stub returned by getAgentByName */
type GameAgentStub = Awaited<ReturnType<typeof getAgentByName<Env, GameAgent>>>;

/**
 * Helper class for workflow interactions with GameAgent.
 * Reduces boilerplate for getting agent state and updating it.
 */
export class GameAgentHelper {
  constructor(
    private env: Env,
    private gameSlug: string
  ) {}

  /**
   * Gets the GameAgent stub for this game.
   */
  private async getAgent(): Promise<GameAgentStub> {
    return getAgentByName<Env, GameAgent>(this.env.GameAgent, this.gameSlug);
  }

  /**
   * Gets the current game state from the agent.
   */
  async getState(): Promise<GameState> {
    const agent = await this.getAgent();
    return agent.state;
  }

  /**
   * Updates the game board and turn state.
   */
  async updateBoard(params: {
    board: Board;
    currentTurn: SymbolType;
    winner?: SymbolType | "Draw" | "Timeout" | null;
  }): Promise<void> {
    const agent = await this.getAgent();
    const currentState = await agent.state;

    await agent.setState({
      ...currentState,
      game: {
        ...currentState.game!,
        board: params.board,
        currentTurn: params.currentTurn,
        winner: params.winner ?? undefined,
        errorMessage: null,
        errorPlayer: null,
      },
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Sets an error message on the game state.
   */
  async setError(message: string, player: SymbolType): Promise<void> {
    const agent = await this.getAgent();
    const currentState = await agent.state;

    await agent.setState({
      ...currentState,
      game: {
        ...currentState.game!,
        errorMessage: message,
        errorPlayer: player,
      },
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Sets the game as ended due to timeout.
   */
  async setTimeoutWinner(
    timedOutPlayer: SymbolType,
    winnerSymbol: SymbolType
  ): Promise<void> {
    const agent = await this.getAgent();
    const currentState = await agent.state;

    await agent.setState({
      ...currentState,
      game: {
        ...currentState.game!,
        winner: "Timeout",
        errorMessage: `Player ${timedOutPlayer} timed out. ${winnerSymbol} wins!`,
        errorPlayer: timedOutPlayer,
      },
      inProgress: false,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Initializes the game state at workflow start.
   */
  async initializeGame(board: Board, currentTurn: SymbolType): Promise<void> {
    await this.updateBoard({
      board,
      currentTurn,
      winner: null,
    });
  }
}

/**
 * Creates a GameAgentHelper instance for use in workflows.
 */
export function createAgentHelper(env: Env, gameSlug: string): GameAgentHelper {
  return new GameAgentHelper(env, gameSlug);
}
