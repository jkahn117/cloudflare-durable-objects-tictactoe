import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { GamesList } from "@/components/GameList";
import { AILevel } from "@/types";
import { getLobbyState, createGame, joinGame } from "@/lib/GameApi";

export const Route = createFileRoute("/lobby")({
  component: Lobby,
  loader: async () => {
    return await getLobbyState();
  },
});

function Lobby() {
  const navigate = useNavigate();
  const loaderData = Route.useLoaderData();
  const [lobbyState, setLobbyState] = useState(loaderData);
  const [opponentType, setOpponentType] = useState<"human" | "ai">("ai");
  const [aiLevel, setAiLevel] = useState<AILevel>(AILevel.EXPERT);
  const [creating, setCreating] = useState(false);

  const getLobbyStateFn = useServerFn(getLobbyState);
  const createGameFn = useServerFn(createGame);
  const joinGameFn = useServerFn(joinGame);

  // Poll for lobby updates every 3 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      const state = await getLobbyStateFn();
      setLobbyState(state);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const handleCreateGame = async () => {
    setCreating(true);
    try {
      const { slug, creatorSymbol } = await createGameFn({
        data: {
          opponentType,
          aiLevel: opponentType === "ai" ? aiLevel : undefined,
        },
      });

      // Store player symbol in session
      sessionStorage.setItem(`game_${slug}_symbol`, creatorSymbol);

      navigate({ to: "/game/$slug", params: { slug } });
    } catch (error) {
      console.error("Failed to create game:", error);
      alert("Failed to create game. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleJoinGame = async (slug: string) => {
    try {
      const { playerSymbol } = await joinGameFn({ data: { slug } });
      sessionStorage.setItem(`game_${slug}_symbol`, playerSymbol);
      navigate({ to: "/game/$slug", params: { slug } });
    } catch (error) {
      console.error("Failed to join game:", error);
      alert("Unable to join game. It may be full.");
    }
  };

  return (
    <div className="w-full max-w-2xl space-y-6">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-6">
        <h2 className="text-2xl font-bold mb-4">Create New Game</h2>

        {/* Opponent Type Toggle */}
        <div className="mb-4">
          <label className="block text-sm font-semibold mb-2">Opponent</label>
          <div className="flex gap-2">
            <button
              onClick={() => setOpponentType("human")}
              className={`flex-1 py-2 rounded-lg font-medium transition ${
                opponentType === "human"
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Human
            </button>
            <button
              onClick={() => setOpponentType("ai")}
              className={`flex-1 py-2 rounded-lg font-medium transition ${
                opponentType === "ai"
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              AI
            </button>
          </div>
        </div>

        {/* AI Level Selector */}
        {opponentType === "ai" && (
          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2">AI Level</label>
            <select
              value={aiLevel}
              onChange={(e) => setAiLevel(e.target.value as AILevel)}
              className="w-full p-2 border border-slate-300 rounded-lg"
            >
              <option value={AILevel.BEGINNER}>Beginner</option>
              <option value={AILevel.INTERMEDIATE}>Intermediate</option>
              <option value={AILevel.EXPERT}>Expert</option>
            </select>
          </div>
        )}

        <button
          onClick={handleCreateGame}
          disabled={creating}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl font-semibold transition"
        >
          {creating ? "Creating..." : "Create Game"}
        </button>
      </div>

      {/* Games Seeking Players */}
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-6">
        <h2 className="text-xl font-bold mb-4">Games Seeking Players</h2>
        <GamesList
          games={lobbyState.gamesSeekingPlayers}
          type="seeking"
          onJoin={handleJoinGame}
        />
      </div>

      {/* Games In Progress */}
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-6">
        <h2 className="text-xl font-bold mb-4">Games In Progress</h2>
        <GamesList games={lobbyState.gamesInProgress} type="inProgress" />
      </div>
    </div>
  );
}
