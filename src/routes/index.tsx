import { createFileRoute } from "@tanstack/react-router";
import useWebSocket, { ReadyState } from "react-use-websocket";
import type { Game, GameMessage, SymbolType } from "../types";

import { useEffect, useState } from "react";
import {
  Users,
  RefreshCw,
  X,
  Circle,
  Trophy,
  Gamepad2,
  Search,
  ArrowRight,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: App,
  staticData: {
    title: "Tic Tac Toe",
  },
});

const baseUrl = "ws://localhost:3000/api/agents/game-manager";

type ViewType = "home" | "searching" | "playing";

interface Players {
  x: string;
  o: string;
}

interface WinnerStatus {
  winner: SymbolType | "Draw";
  line: number[];
}

interface SquareProps {
  value: SymbolType | null;
  onClick: () => void;
  isHighlight: boolean;
  disabled: boolean;
}

// const createNewGame = createServerFn().handler(async (): Promise<Game> => {
//   const gameId = crypto.randomUUID();
//   const objectId = env.GAME_MANAGER.idFromName(gameId);
//   const manager = env.GAME_MANAGER.get(objectId);

//   const game = await manager.createGame({
//     playerId: "You",
//     type: "vs-ai",
//   });

//   return game;
// });

function App() {
  // UI States: 'home', 'searching', 'playing', 'game-over'
  const [view, setView] = useState<ViewType>("home");
  const [board, setBoard] = useState<(SymbolType | null)[]>(
    Array(9).fill(null)
  );
  const [isXNext, setIsXNext] = useState<boolean>(true);
  const [players] = useState<Players>({
    x: "You",
    o: "TicTacToe Expert AI", //"Waiting...",
  });
  const [mySymbol] = useState<SymbolType>("X");
  const [winnerInfo, setWinnerInfo] = useState<WinnerStatus | null>(null);

  const [game, setGame] = useState<Game | null>(null);
  const { lastJsonMessage, readyState, sendJsonMessage } =
    useWebSocket<GameMessage>(`${baseUrl}/lobby`, {});

  useEffect(() => {
    if (lastJsonMessage) {
      const data = lastJsonMessage;
      switch (data.type) {
        case "game_created":
          setGame(data.data as Game);
          setView("playing");
          break;
        case "game_updated":
          if (game && data.data) {
            const updated = { ...game, ...data.data };
            setGame(updated);

            // Sync local UI state
            if (data.data.board) {
              setBoard(data.data.board as (SymbolType | null)[]);
            }
            if (data.data.isXNext !== undefined) {
              setIsXNext(data.data.isXNext);
            }
            if (data.data.winner) {
              setWinnerInfo({ winner: data.data.winner, line: [] });
            }
          }
          break;
        case "ai_thinking":
          console.log("AI is thinking...");

          break;
        case "game_ended":
          setGame(null);
          setView("home");
          break;
      }
    }
  }, [lastJsonMessage]);

  const connectionStatus = {
    [ReadyState.CONNECTING]: "Connecting",
    [ReadyState.OPEN]: "Open",
    [ReadyState.CLOSING]: "Closing",
    [ReadyState.CLOSED]: "Closed",
    [ReadyState.UNINSTANTIATED]: "Uninstantiated",
  }[readyState];

  // Simulate matchmaking
  const findGame = async (): Promise<void> => {
    setView("searching");
    sendJsonMessage({
      type: "create_game",
      data: { playerId: "You", type: "vs-ai" },
    });
    // setView("playing");
  };

  const isMyTurn =
    (isXNext && mySymbol === "X") || (!isXNext && mySymbol === "O");

  const handleSquareClick = (index: number): void => {
    if (board[index] || winnerInfo) return;

    const currentTurnSymbol: SymbolType = isXNext ? "X" : "O";
    if (currentTurnSymbol !== mySymbol) return;

    sendJsonMessage({
      type: "update_game",
      data: { spaceTaken: index, playerId: players.x, gameId: game?.id },
    });

    const newBoard = [...board];
    newBoard[index] = currentTurnSymbol;
    setBoard(newBoard);
    setIsXNext(!isXNext);

    // const winStatus = calculateWinner(newBoard);
    // if (winStatus) {
    //   setWinnerInfo(winStatus);
    // }
  };

  const resetGame = (): void => {
    setBoard(Array(9).fill(null));
    setIsXNext(true);
    setWinnerInfo(null);
    setView("home");
  };

  /**
   * Internal Square Component
   */
  const Square: React.FC<SquareProps> = ({
    value,
    onClick,
    isHighlight,
    disabled,
  }) => {
    const canInteract = !value && !winnerInfo && isMyTurn && !disabled;

    return (
      <button
        onClick={onClick}
        disabled={!canInteract}
        className={`h-24 w-24 sm:h-32 sm:w-32 flex items-center justify-center text-4xl font-bold transition-all duration-200 border border-slate-200 rounded-xl
          ${
            canInteract
              ? "hover:bg-indigo-50 hover:border-indigo-200 cursor-pointer"
              : "cursor-default"
          }
          ${
            isHighlight
              ? "bg-green-100 text-green-600 border-green-300"
              : "bg-white text-slate-800"
          }
          shadow-sm active:scale-95`}
      >
        {value === "X" && (
          <X className="w-12 h-12 text-blue-500 animate-in zoom-in" />
        )}
        {value === "O" && (
          <Circle className="w-10 h-10 text-rose-500 animate-in zoom-in" />
        )}
      </button>
    );
  };

  return (
    <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-500 rounded-lg shadow-inner">
            <Gamepad2 className="text-white w-5 h-5" />
          </div>
          <h1 className="font-bold text-xl tracking-tight">TicTacToe.io</h1>
        </div>
        <div className="flex items-center gap-2">
          {view === "playing" && (
            <button
              onClick={resetGame}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
              title="Leave Game"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          )}
          <div
            className={`w-3 h-3 rounded-full transition-colors ${
              connectionStatus === "Open" ? "bg-green-500" : "bg-gray-400"
            }`}
            title={`Connection: ${connectionStatus}`}
          />
        </div>
      </div>

      {/* Content Area */}
      <div className="p-6">
        {/* HOME VIEW */}
        {view === "home" && (
          <div className="text-center py-8 space-y-6">
            <div className="bg-indigo-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="text-indigo-600 w-10 h-10" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Ready to Play?</h2>
              <p className="text-slate-500 mt-2">
                Join the queue to find a random opponent.
              </p>
            </div>
            <button
              onClick={findGame}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-semibold shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 group"
            >
              Find a Match
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}

        {/* SEARCHING VIEW */}
        {view === "searching" && (
          <div className="text-center py-12 space-y-6 animate-pulse">
            <div className="relative w-24 h-24 mx-auto">
              <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
              <Search className="absolute inset-0 m-auto text-indigo-600 w-10 h-10" />
            </div>
            <div>
              <h2 className="text-xl font-bold italic">Finding Player...</h2>
              <p className="text-slate-400 text-sm mt-1">
                Connecting to global server
              </p>
            </div>
          </div>
        )}

        {/* PLAYING VIEW */}
        {view === "playing" && (
          <div className="space-y-8">
            {/* Scoreboard / Players */}
            <div className="grid grid-cols-2 gap-4">
              <div
                className={`p-4 rounded-2xl border-2 transition-all ${
                  isXNext
                    ? "bg-blue-50 border-blue-400 scale-105 shadow-md"
                    : "bg-slate-50 border-transparent opacity-60"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <X className="w-4 h-4 text-blue-500" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-600">
                    Player X
                  </span>
                </div>
                <p className="font-bold truncate">{players.x}</p>
              </div>
              <div
                className={`p-4 rounded-2xl border-2 transition-all ${
                  !isXNext
                    ? "bg-rose-50 border-rose-400 scale-105 shadow-md"
                    : "bg-slate-50 border-transparent opacity-60"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Circle className="w-3 h-3 text-rose-500" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-600">
                    Player O
                  </span>
                </div>
                <p className="font-bold truncate">{players.o}</p>
              </div>
            </div>

            {/* Game Board */}
            <div className="grid grid-cols-3 gap-3 mx-auto max-w-fit">
              {board.map((square, i) => (
                <Square
                  key={i}
                  value={square}
                  onClick={() => handleSquareClick(i)}
                  isHighlight={winnerInfo?.line.includes(i) ?? false}
                  disabled={!isMyTurn}
                />
              ))}
            </div>

            {/* Status Footer */}
            <div className="text-center h-12 flex items-center justify-center">
              {winnerInfo ? (
                <div className="flex items-center justify-center gap-2 text-green-600 font-bold animate-in fade-in slide-in-from-bottom-2">
                  <Trophy className="w-5 h-5" />
                  {winnerInfo.winner === "Draw"
                    ? "It's a Draw!"
                    : `${
                        winnerInfo.winner === "X" ? players.x : players.o
                      } Wins!`}
                </div>
              ) : (
                <div className="space-y-1">
                  {isMyTurn ? (
                    <p className="text-indigo-600 font-bold flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                      </span>
                      Your Turn
                    </p>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-400 font-medium">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Waiting for {isXNext ? players.x : players.o}...
                    </div>
                  )}
                </div>
              )}
            </div>

            {winnerInfo && (
              <button
                onClick={resetGame}
                className="w-full py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200"
              >
                Back to Lobby
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
