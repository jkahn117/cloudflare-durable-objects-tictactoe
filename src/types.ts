export interface GameMessage {
  type: GameStatus;
  data: Game | Partial<Game>;
}

export type GameStatus = "game_created" | "game_updated" | "game_ended";

export interface Game {
  id: string;
  xPlayer: string;
  oPlayer: string;
  board: BoardType;
  isXNext: boolean;
  winner?: SymbolType | "Draw" | undefined;
  updatedAt: Date;
}

export interface NewGameParams {
  type: "head-to-head" | "vs-ai";
  playerId: string;
}

export interface UpdateGameParams {
  gameId: string;
  playerId: string;
  spaceTaken: number;
}

export type SymbolType = "X" | "O";
export type BoardType = (SymbolType | undefined)[];
