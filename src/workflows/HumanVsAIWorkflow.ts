import {
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStep,
} from "cloudflare:workers";
import { SymbolType, PlayerType, AIPlayer } from "@/types";
import { BotPlayer } from "@/bots/BotPlayer";
import { createBot } from "@/bots/BotFactory";
import {
  GameWorkflowParams,
  MoveEvent,
  GameLoopState,
  GameWorkflowResult,
  MOVE_EVENT_TYPE,
  HUMAN_MOVE_TIMEOUT,
} from "./utils/types";
import {
  validateMove,
  applyMove,
  checkWinner,
  getNextTurn,
  createEmptyBoard,
} from "./utils/gameLogic";
import { createAgentHelper } from "./utils/agentUtils";

/**
 * HumanVsAIWorkflow orchestrates a tic-tac-toe game between a human player and an AI.
 */
export class HumanVsAIWorkflow extends WorkflowEntrypoint<
  Env,
  GameWorkflowParams
> {
  async run(
    event: WorkflowEvent<GameWorkflowParams>,
    step: WorkflowStep
  ): Promise<GameWorkflowResult> {
    const { gameSlug, players, startingTurn } = event.payload;
    const agent = createAgentHelper(this.env, gameSlug);

    // Determine which symbol is AI and which is human
    const aiSymbol =
      players.X.type === PlayerType.AI ? SymbolType.X : SymbolType.O;
    const humanSymbol = aiSymbol === SymbolType.X ? SymbolType.O : SymbolType.X;

    // Get AI player configuration and create appropriate bot
    const aiPlayer = players[aiSymbol] as AIPlayer;
    const bot = createBot(this.env, aiPlayer.level);

    // Initialize game loop state
    let state: GameLoopState = {
      board: createEmptyBoard(),
      currentTurn: startingTurn,
      moveCount: 0,
    };

    // Sync initial state to GameAgent
    await step.do("sync-initial-state", async () => {
      await agent.initializeGame(state.board, state.currentTurn);
    });

    // Game loop - max 9 moves possible
    while (state.moveCount < 9) {
      const isAITurn = state.currentTurn === aiSymbol;

      if (isAITurn) {
        state = await this.handleAIMove(step, state, aiSymbol, bot, agent);
      } else {
        const result = await this.handleHumanMove(
          step,
          state,
          humanSymbol,
          aiSymbol,
          agent
        );

        if (result.timeout) {
          return {
            winner: "Timeout",
            finalBoard: state.board,
            moves: state.moveCount,
            timedOutPlayer: humanSymbol,
          };
        }

        state = result.state;
      }

      // Check for game end
      const winner = checkWinner(state.board);
      if (winner) {
        // Schedule cleanup after delay
        await step.do("schedule-cleanup", async () => {
          await agent.endGame(winner);
        });
        return { winner, finalBoard: state.board, moves: state.moveCount };
      }
    }

    // Draw - schedule cleanup
    await step.do("schedule-cleanup", async () => {
      await agent.endGame("Draw");
    });
    return { winner: "Draw", finalBoard: state.board, moves: state.moveCount };
  }

  /**
   * Handles an AI player's turn.
   */
  private async handleAIMove(
    step: WorkflowStep,
    state: GameLoopState,
    aiSymbol: SymbolType,
    bot: BotPlayer,
    agent: ReturnType<typeof createAgentHelper>
  ): Promise<GameLoopState> {
    return step.do(`ai-move-${state.moveCount}`, async () => {
      const position = await bot.makeMove(state.board);

      const newBoard = applyMove(state.board, position, aiSymbol);
      const winner = checkWinner(newBoard);
      const nextTurn = getNextTurn(aiSymbol);

      await agent.updateBoard({
        board: newBoard,
        currentTurn: nextTurn,
        winner,
      });

      return {
        board: newBoard,
        currentTurn: nextTurn,
        moveCount: state.moveCount + 1,
      };
    });
  }

  /**
   * Handles a human player's turn with timeout.
   */
  private async handleHumanMove(
    step: WorkflowStep,
    state: GameLoopState,
    humanSymbol: SymbolType,
    opponentSymbol: SymbolType,
    agent: ReturnType<typeof createAgentHelper>
  ): Promise<{ state: GameLoopState; timeout: boolean }> {
    let moveEvent: { payload: MoveEvent };

    try {
      moveEvent = await step.waitForEvent<MoveEvent>(
        `wait-human-move-${state.moveCount}`,
        { type: MOVE_EVENT_TYPE, timeout: HUMAN_MOVE_TIMEOUT }
      );
    } catch {
      // Timeout - human player loses
      await step.do("handle-timeout", async () => {
        await agent.setTimeoutWinner(humanSymbol, opponentSymbol);
      });
      return { state, timeout: true };
    }

    const newState = await step.do(
      `apply-human-move-${state.moveCount}`,
      async () => {
        const { position, playerSymbol } = moveEvent.payload;

        // Validate correct player
        if (playerSymbol !== humanSymbol) {
          await agent.setError(`It's not ${playerSymbol}'s turn`, playerSymbol);
          return state;
        }

        // Validate move position
        if (!validateMove(state.board, position)) {
          await agent.setError(
            `Invalid move: position ${position} is not available`,
            playerSymbol
          );
          return state;
        }

        // Apply valid move
        const newBoard = applyMove(state.board, position, humanSymbol);
        const winner = checkWinner(newBoard);
        const nextTurn = getNextTurn(humanSymbol);

        await agent.updateBoard({
          board: newBoard,
          currentTurn: nextTurn,
          winner,
        });

        return {
          board: newBoard,
          currentTurn: nextTurn,
          moveCount: state.moveCount + 1,
        };
      }
    );

    return { state: newState, timeout: false };
  }
}
