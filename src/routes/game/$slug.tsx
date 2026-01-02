import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { RefreshCw, Trophy, Loader2, X, Circle } from "lucide-react";
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
      <div className="bg-card rounded-lg shadow-sm border overflow-hidden">
        {/* Header with prominent player symbol */}
        <div className="px-6 py-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-semibold text-base text-muted-foreground">Game: {slug}</h1>
            <button
              onClick={() => navigate({ to: "/lobby" })}
              className="p-2 hover:bg-accent rounded-md transition"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          {/* Prominent "You are" indicator */}
          <div className="flex items-center gap-3 bg-primary/10 border-2 border-primary rounded-md px-4 py-3">
            <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-md">
              {mySymbol === SymbolType.X ? (
                <X className="w-6 h-6 text-primary-foreground" strokeWidth={3} />
              ) : (
                <Circle className="w-5 h-5 text-primary-foreground" strokeWidth={3} />
              )}
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-muted-foreground">You are playing as</p>
              <p className="text-base font-bold text-foreground">{mySymbol}</p>
            </div>
          </div>
        </div>

        {/* Game Content */}
        <div className="p-6 space-y-5">
          {/* Player Cards */}
          <div className="grid grid-cols-2 gap-3">
            <PlayerCard
              player={gameState.game.players.X}
              isActive={currentTurn === SymbolType.X}
              isCurrentPlayer={mySymbol === SymbolType.X}
            />
            <PlayerCard
              player={gameState.game.players.O}
              isActive={currentTurn === SymbolType.O}
              isCurrentPlayer={mySymbol === SymbolType.O}
            />
          </div>

          {/* Waiting Message */}
          {gameState.waitingForPlayers && (
            <div className="text-center py-3 bg-accent rounded-md">
              <p className="font-medium text-sm text-foreground">
                Waiting for opponent...
              </p>
              <p className="text-xs text-muted-foreground">{timeWaiting}s</p>
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
          <div className="text-center h-10 flex items-center justify-center">
            {gameState.game.winner ? (
              <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                <Trophy className="w-4 h-4" />
                {gameState.game.winner === "Draw"
                  ? "It's a Draw!"
                  : `${gameState.game.winner} Wins!`}
              </div>
            ) : isMyTurn ? (
              <p className="text-primary font-semibold text-sm">Your Turn</p>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Waiting for opponent...
              </div>
            )}
          </div>

          {/* Back to Lobby */}
          {gameState.game.winner && (
            <button
              onClick={() => navigate({ to: "/lobby" })}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition text-sm"
            >
              Back to Lobby
            </button>
          )}
        </div>
      </div>

      {/* Switch to AI Prompt */}
      {showSwitchPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card rounded-lg p-6 max-w-sm space-y-4 shadow-lg">
            <h3 className="text-base font-semibold">No opponent found</h3>
            <p className="text-sm text-muted-foreground">
              Would you like to play against AI instead?
            </p>
            <div className="space-y-2">
              <button
                onClick={() => handleSwitchToAI(AILevel.BEGINNER)}
                className="w-full py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition text-sm font-medium"
              >
                Beginner AI
              </button>
              <button
                onClick={() => handleSwitchToAI(AILevel.INTERMEDIATE)}
                className="w-full py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition text-sm font-medium"
              >
                Intermediate AI
              </button>
              <button
                onClick={() => handleSwitchToAI(AILevel.EXPERT)}
                className="w-full py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition text-sm font-medium"
              >
                Expert AI
              </button>
              <button
                onClick={() => setShowSwitchPrompt(false)}
                className="w-full py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition text-sm font-medium"
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
