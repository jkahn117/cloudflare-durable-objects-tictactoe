import { AILevel } from "@/types";
import { BotPlayer } from "./BotPlayer";
import { BotBeginner } from "./BotBeginner";
import { BotIntermediate } from "./BotIntermediate";
import { BotExpert } from "./BotExpert";

/**
 * Factory function to create a bot instance based on AI difficulty level.
 */
export function createBot(env: Env, level: AILevel): BotPlayer {
  switch (level) {
    case AILevel.BEGINNER:
      return new BotBeginner(env);
    case AILevel.INTERMEDIATE:
      return new BotIntermediate(env);
    case AILevel.EXPERT:
      return new BotExpert(env);
    default:
      throw new Error(`Unknown AI level: ${level}`);
  }
}
