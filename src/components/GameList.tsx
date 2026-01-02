import { GameState } from "@/agents/Game";

interface GamesListProps {
  games: GameState[];
  type: "seeking" | "inProgress";
  onJoin?: (slug: string) => void;
}
export function GamesList({ games, type, onJoin }: GamesListProps) {
  if (games.length === 0) {
    return (
      <p className="text-slate-400 text-center py-4">
        No games {type === "seeking" ? "seeking players" : "in progress"}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {games.map((game) => (
        <div
          key={game.slug}
          className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200"
        >
          <div>
            <p className="font-semibold">{game.slug}</p>
            <p className="text-xs text-slate-500">
              {new Date(game.createdAt).toLocaleTimeString()}
            </p>
          </div>
          {type === "seeking" && onJoin && (
            <button
              onClick={() => onJoin(game.slug)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              Join
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
