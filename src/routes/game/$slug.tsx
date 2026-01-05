import { useEffect, useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { RefreshCw, Trophy, Loader2, X, Circle } from "lucide-react";
import { useAgent } from "agents/react";
import { SymbolType } from "@/types";
import { GameBoard } from "@/components/GameBoard";
import { PlayerCard } from "@/components/PlayerCard";
import { getGameState } from "@/lib/GameApi";
import { GameState } from "@/agents/Game";
import { Button } from "@/components/ui/button";

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
  const [gameState, setGameState] = useState<GameState>(initialState);

  const agent = useAgent({
    agent: "game-agent", // kebab cased
    name: slug,
    onStateUpdate: (newState: GameState) => {
      setGameState(newState);
    },
  });

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

  const moveCount =
    gameState && gameState.game
      ? gameState.game.board.filter(Boolean).length
      : 0;
  const currentTurn = moveCount % 2 === 0 ? SymbolType.X : SymbolType.O;
  const isMyTurn = currentTurn === mySymbol;

  const handleSquareClick = async (index: number) => {
    if (!mySymbol || !gameState.game) return;
    if (gameState.game.board[index] !== null) return;
    if (gameState.game.winner) return;

    if (currentTurn !== mySymbol) return;

    try {
      agent.setState({
        ...gameState,
        game: {
          ...gameState.game,
          board: [
            ...gameState.game.board.slice(0, index),
            mySymbol,
            ...gameState.game.board.slice(index + 1),
          ],
        },
      });
    } catch (error) {
      console.error("Move failed:", error);
    }
  };

  if (!mySymbol || !gameState.game) {
    return <div>Loading...</div>;
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-card rounded-lg shadow-sm border overflow-hidden">
        {/* Header with prominent player symbol */}
        <div className="px-6 py-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-semibold text-base text-muted-foreground">
              Game: {slug}
            </h1>
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
                <X
                  className="w-6 h-6 text-primary-foreground"
                  strokeWidth={3}
                />
              ) : (
                <Circle
                  className="w-5 h-5 text-primary-foreground"
                  strokeWidth={3}
                />
              )}
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-muted-foreground">
                You are playing as
              </p>
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
            <Button
              onClick={() => navigate({ to: "/lobby" })}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition text-sm"
            >
              Back to Lobby
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
