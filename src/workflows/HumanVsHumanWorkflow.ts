import {
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStep,
} from "cloudflare:workers";
import { SymbolType } from "@/types";
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
 * HumanVsHumanWorkflow orchestrates a tic-tac-toe game between two human players.
 *
 * Flow:
 * 1. Initialize game state
 * 2. Loop until winner or draw:
 *    a. Wait for current player's move event
 *    b. Validate the move (correct player, valid position)
 *    c. Apply move and check for winner
 *    d. Update GameAgent state for client sync
 *    e. Switch turns
 * 3. Return final game result
 *
 * Timeout handling: If a player doesn't move within the timeout period,
 * they forfeit and the opponent wins.
 */
export class HumanVsHumanWorkflow extends WorkflowEntrypoint<
  Env,
  GameWorkflowParams
> {
  async run(
    event: WorkflowEvent<GameWorkflowParams>,
    step: WorkflowStep
  ): Promise<GameWorkflowResult> {
    const { gameSlug, startingTurn } = event.payload;
    const agent = createAgentHelper(this.env, gameSlug);

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
      const currentPlayer = state.currentTurn;

      const result = await this.handleHumanMove(step, state, currentPlayer, agent);

      if (result.timeout) {
        return {
          winner: "Timeout",
          finalBoard: state.board,
          moves: state.moveCount,
          timedOutPlayer: currentPlayer,
        };
      }

      state = result.state;

      // Check for game end
      const winner = checkWinner(state.board);
      if (winner) {
        return { winner, finalBoard: state.board, moves: state.moveCount };
      }
    }

    // If we exit the loop without a winner, it's a draw
    return { winner: "Draw", finalBoard: state.board, moves: state.moveCount };
  }

  /**
   * Handles a human player's turn with timeout.
   */
  private async handleHumanMove(
    step: WorkflowStep,
    state: GameLoopState,
    currentPlayer: SymbolType,
    agent: ReturnType<typeof createAgentHelper>
  ): Promise<{ state: GameLoopState; timeout: boolean }> {
    let moveEvent: { payload: MoveEvent };

    try {
      moveEvent = await step.waitForEvent<MoveEvent>(
        `wait-${currentPlayer}-move-${state.moveCount}`,
        { type: MOVE_EVENT_TYPE, timeout: HUMAN_MOVE_TIMEOUT }
      );
    } catch {
      // Timeout - current player loses, opponent wins
      const opponent = getNextTurn(currentPlayer);
      await step.do("handle-timeout", async () => {
        await agent.setTimeoutWinner(currentPlayer, opponent);
      });
      return { state, timeout: true };
    }

    const newState = await step.do(`apply-move-${state.moveCount}`, async () => {
      const { position, playerSymbol } = moveEvent.payload;

      // Validate it's the correct player's turn
      if (playerSymbol !== currentPlayer) {
        await agent.setError(
          `It's ${currentPlayer}'s turn, not ${playerSymbol}'s`,
          playerSymbol
        );
        return state;
      }

      // Validate the move position
      if (!validateMove(state.board, position)) {
        await agent.setError(
          `Invalid move: position ${position} is not available`,
          playerSymbol
        );
        return state;
      }

      // Apply valid move
      const newBoard = applyMove(state.board, position, currentPlayer);
      const winner = checkWinner(newBoard);
      const nextTurn = getNextTurn(currentPlayer);

      await agent.updateBoard({ board: newBoard, currentTurn: nextTurn, winner });

      return {
        board: newBoard,
        currentTurn: nextTurn,
        moveCount: state.moveCount + 1,
      };
    });

    return { state: newState, timeout: false };
  }
}
