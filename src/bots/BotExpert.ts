import { BaseBotPlayer } from "./BotPlayer";
import { Board } from "../types";

export class BotExpert extends BaseBotPlayer {
  readonly systemPrompt = `You are an expert Tic-Tac-Toe player with perfect strategic knowledge. Your symbol is O, and your opponent plays X.
## Game Rules
- The board has 9 positions indexed 0-8 (left to right, top to bottom):
  0 | 1 | 2
  ---------
  3 | 4 | 5
  ---------
  6 | 7 | 8
- You play as O, your opponent plays as X
- You must select an empty position (undefined/null value in the array)
## Strategy Priority (in order)
1. **Win**: If you can win in one move, take it
2. **Block**: If opponent can win in one move, block them
3. **Fork Creation**: Create a position where you have two ways to win (forcing opponent to block one, allowing you to win with the other)
4. **Block Fork**: Prevent opponent from creating a fork
5. **Center Control**: Take position 4 (center) if available - it's the most strategic position
6. **Opposite Corner**: If opponent is in a corner, take the opposite corner
7. **Empty Corner**: Take any available corner (0, 2, 6, or 8)
8. **Empty Side**: Take any available side position (1, 3, 5, or 7)
## Winning Lines
There are 8 possible winning combinations:
- Rows: [0,1,2], [3,4,5], [6,7,8]
- Columns: [0,3,6], [1,4,7], [2,5,8]
- Diagonals: [0,4,8], [2,4,6]
## Input Format
You will receive a JSON object with the current board state:
{
  "board": [value0, value1, value2, value3, value4, value5, value6, value7, value8]
}
Where each value is:
- "X" - opponent's move
- "O" - your move
- undefined/null - empty space
## Output Requirements
You MUST respond with ONLY a single integer between 0 and 8, representing the position index of your move.
**CRITICAL CONSTRAINTS:**
- Output ONLY the integer (0-8). No explanation, no text, no JSON, no formatting.
- You MUST select an empty position (where the board value is undefined/null)
- You CANNOT select a position that contains "X" or "O"
- If you output anything other than a valid integer for an empty position, it is an error
## Examples
Example 1 - Winning Move:
Input: {"board": ["O", "O", undefined, "X", "X", undefined, undefined, undefined, undefined]}
Analysis: You have O at positions 0 and 1. Position 2 completes the winning row [0,1,2].
Output: 2
Example 2 - Blocking Move:
Input: {"board": ["X", "X", undefined, undefined, "O", undefined, undefined, undefined, undefined]}
Analysis: Opponent has X at positions 0 and 1. You must block position 2 to prevent them from winning.
Output: 2
Example 3 - Center Control:
Input: {"board": ["X", undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined]}
Analysis: Opponent took corner 0. Take center for strategic advantage.
Output: 4
Example 4 - Fork Creation:
Input: {"board": ["O", undefined, undefined, undefined, "X", undefined, undefined, undefined, "O"]}
Analysis: You have corners 0 and 8 with center occupied by X. Taking corner 2 creates a fork (threatening rows [0,1,2] and column [2,5,8]).
Output: 2
## Error Handling
If the board is invalid or all positions are filled, output the first available empty position. If no moves are possible, output: -1`;

  readonly userPrompt = "Here is the current game board: ";

  protected async generateMove(board: Board): Promise<number | null> {
    const result = await this.env.AI.run("@cf/openai/gpt-oss-20b", {
      instructions: this.systemPrompt,
      input: `${this.userPrompt}\n${JSON.stringify(board)}`,
      response_format: {
        type: "json_schema",
        json_schema: {
          type: "number",
        },
      },
    });

    return this.parseAIResponse(result, board);
  }

  private parseAIResponse(result: any, board: Board): number | null {
    if (result.output?.length) {
      for (const output of result.output) {
        if (output.status === "completed" && output.type === "message") {
          const content = (output as ResponseOutputMessage).content;
          for (const item of content) {
            if (item.type === "output_text") {
              const text = (item as ResponseOutputText).text.trim();
              const move = parseInt(text, 10);

              // Validate move is a number, in range, and position is empty
              if (
                !isNaN(move) &&
                move >= 0 &&
                move <= 8 &&
                board[move] === null
              ) {
                return move;
              }
            }
          }
        }
      }
    }

    return null;
  }
}
