export type Players = {
  X: Player;
  O: Player;
};

type BasePlayer = {
  name: string;
  symbol: SymbolType;
  pending: boolean;
};

export type HumanPlayer = BasePlayer & {
  type: PlayerType.HUMAN;
};

export type AIPlayer = BasePlayer & {
  type: PlayerType.AI;
  level: AILevel;
};

export type Player = HumanPlayer | AIPlayer;

export enum PlayerType {
  HUMAN = "human",
  AI = "ai",
}

export enum SymbolType {
  X = "X",
  O = "O",
}

export enum AILevel {
  BEGINNER = "beginner",
  INTERMEDIATE = "intermediate",
  EXPERT = "expert",
}

export type Board = (SymbolType | null)[];

export type Game = {
  players: Players;
  board: Board;
  currentTurn: SymbolType;
  winner?: SymbolType | "Draw" | null;
};

export type GameConfig = {
  opponentType: PlayerType;
  aiLevel?: AILevel;
};
