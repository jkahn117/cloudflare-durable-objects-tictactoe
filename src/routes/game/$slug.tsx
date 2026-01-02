import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { RefreshCw, Trophy, Loader2 } from "lucide-react";
import { AILevel, PlayerType, SymbolType } from "@/types";
import { GameBoard } from "@/components/GameBoard";
import { PlayerCard } from "@/components/PlayerCard";
import { getGameState, makeMove, switchToAI } from "@/lib/GameApi";

export const Route = createFileRoute("/game/$slug")({
  component: Game,
  loader: async ({ params }) => {
    try {
      const state = await getGameState({ data: { slug: params.slug } });
      return { state, slug: params.slug };
    } catch (error) {
      throw redirect({ to: "/lobby" });
    }
  },
});
function Game() {
  const navigate = useNavigate();
  const { state: initialState, slug } = Route.useLoaderData();
  const [gameState, setGameState] = useState(initialState);
  const [showSwitchPrompt, setShowSwitchPrompt] = useState(false);
  const [timeWaiting, setTimeWaiting] = useState(0);

  const getGameStateFn = useServerFn(getGameState);
  const makeMoveFn = useServerFn(makeMove);
  const switchToAIFn = useServerFn(switchToAI);

  // Get player's symbol from session
  const mySymbol = sessionStorage.getItem(
    `game_${slug}_symbol`
  ) as SymbolType | null;

  // Redirect if invalid (3+ players or missing symbol)
  useEffect(() => {
    if (!mySymbol) {
      navigate({ to: "/lobby" });
    }
  }, [mySymbol, navigate]);

  // Poll for game updates every 2 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      const state = await getGameStateFn({ data: { slug } });
      setGameState(state);

      // Remove from lobby if game is complete
      if (state.game?.winner) {
        // Could trigger lobby state update here
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [slug]);

  // 10-second timeout for human opponent
  useEffect(() => {
    if (
      gameState.waitingForPlayers &&
      gameState.game?.players.O.type === PlayerType.HUMAN
    ) {
      const timer = setInterval(() => {
        setTimeWaiting((prev) => {
          if (prev >= 10) {
            setShowSwitchPrompt(true);
            return prev;
          }
          return prev + 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [gameState.waitingForPlayers]);

  const handleSwitchToAI = async (level: AILevel) => {
    await switchToAIFn({ data: { slug, aiLevel: level } });
    setShowSwitchPrompt(false);
    const state = await getGameStateFn({ data: { slug } });
    setGameState(state);
  };

  const handleSquareClick = async (index: number) => {
    if (!mySymbol || !gameState.game) return;
    if (gameState.game.board[index] !== null) return;
    if (gameState.game.winner) return;

    // Determine whose turn it is
    const moveCount = gameState.game.board.filter(Boolean).length;
    const currentTurn = moveCount % 2 === 0 ? SymbolType.X : SymbolType.O;

    if (currentTurn !== mySymbol) return;

    try {
      const state = await makeMoveFn({
        data: {
          slug,
          position: index,
          playerSymbol: mySymbol,
        },
      });
      setGameState(state);
    } catch (error) {
      console.error("Move failed:", error);
    }
  };

  if (!mySymbol || !gameState.game) {
    return <div>Loading...</div>;
  }

  const moveCount = gameState.game.board.filter(Boolean).length;
  const currentTurn = moveCount % 2 === 0 ? SymbolType.X : SymbolType.O;
  const isMyTurn = currentTurn === mySymbol;

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-xl">Game: {slug}</h1>
            <p className="text-xs text-slate-500">You are {mySymbol}</p>
          </div>
          <button
            onClick={() => navigate({ to: "/lobby" })}
            className="p-2 hover:bg-slate-100 rounded-full transition"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* Game Content */}
        <div className="p-6 space-y-6">
          {/* Player Cards */}
          <div className="grid grid-cols-2 gap-4">
            <PlayerCard
              player={gameState.game.players.X}
              isActive={currentTurn === SymbolType.X}
            />
            <PlayerCard
              player={gameState.game.players.O}
              isActive={currentTurn === SymbolType.O}
            />
          </div>

          {/* Waiting Message */}
          {gameState.waitingForPlayers && (
            <div className="text-center py-4 bg-yellow-50 rounded-lg">
              <p className="font-semibold text-yellow-800">
                Waiting for opponent...
              </p>
              <p className="text-sm text-yellow-600">{timeWaiting}s</p>
            </div>
          )}

          {/* Game Board */}
          {!gameState.waitingForPlayers && (
            <GameBoard
              board={gameState.game.board}
              onSquareClick={handleSquareClick}
              disabled={!!gameState.game.winner}
              myTurn={isMyTurn}
            />
          )}

          {/* Status */}
          <div className="text-center h-12 flex items-center justify-center">
            {gameState.game.winner ? (
              <div className="flex items-center gap-2 text-green-600 font-bold">
                <Trophy className="w-5 h-5" />
                {gameState.game.winner === "Draw"
                  ? "It's a Draw!"
                  : `${gameState.game.winner} Wins!`}
              </div>
            ) : isMyTurn ? (
              <p className="text-indigo-600 font-bold">Your Turn</p>
            ) : (
              <div className="flex items-center gap-2 text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Waiting for opponent...
              </div>
            )}
          </div>

          {/* Back to Lobby */}
          {gameState.game.winner && (
            <button
              onClick={() => navigate({ to: "/lobby" })}
              className="w-full py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition"
            >
              Back to Lobby
            </button>
          )}
        </div>
      </div>

      {/* Switch to AI Prompt */}
      {showSwitchPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm space-y-4">
            <h3 className="text-xl font-bold">No opponent found</h3>
            <p className="text-slate-600">
              Would you like to play against AI instead?
            </p>
            <div className="space-y-2">
              <button
                onClick={() => handleSwitchToAI(AILevel.BEGINNER)}
                className="w-full py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                Beginner AI
              </button>
              <button
                onClick={() => handleSwitchToAI(AILevel.INTERMEDIATE)}
                className="w-full py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
              >
                Intermediate AI
              </button>
              <button
                onClick={() => handleSwitchToAI(AILevel.EXPERT)}
                className="w-full py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Expert AI
              </button>
              <button
                onClick={() => setShowSwitchPrompt(false)}
                className="w-full py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
              >
                Keep Waiting
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
