import { GameState } from "@/agents/Game";
import { Button } from "@/components/ui/button";

interface GamesListProps {
  games: GameState[];
  type: "seeking" | "inProgress";
  onJoin?: (slug: string) => void;
}
export function GamesList({ games, type, onJoin }: GamesListProps) {
  if (games.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-8 text-sm">
        No games {type === "seeking" ? "seeking players" : "in progress"}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {games.map((game) => (
        <div
          key={game.slug}
          className="flex items-center justify-between px-4 py-3 bg-background rounded-md border hover:border-primary/50 transition-colors"
        >
          <div>
            <p className="font-medium text-sm">{game.slug}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(game.createdAt).toLocaleTimeString()}
            </p>
          </div>
          {type === "seeking" && onJoin && (
            <Button
              onClick={() => onJoin(game.slug)}
              size="sm"
            >
              Join
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
