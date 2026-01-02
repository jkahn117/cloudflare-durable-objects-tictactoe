import { X, Circle } from "lucide-react";
import { Player, SymbolType } from "@/types";

interface PlayerCardProps {
  player: Player;
  isActive: boolean;
  isCurrentPlayer?: boolean;
}
export function PlayerCard({ player, isActive, isCurrentPlayer }: PlayerCardProps) {
  return (
    <div
      className={`p-3 rounded-lg border transition-all ${
        isActive
          ? "bg-accent border-primary shadow-sm scale-[1.02]"
          : "bg-muted/30 border-border opacity-60"
      } ${isCurrentPlayer ? "ring-2 ring-primary ring-offset-2" : ""}`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`flex items-center justify-center w-6 h-6 rounded ${
          isActive ? "bg-primary" : "bg-muted"
        }`}>
          {player.symbol === SymbolType.X ? (
            <X className={`w-4 h-4 ${isActive ? "text-primary-foreground" : "text-muted-foreground"}`} strokeWidth={2.5} />
          ) : (
            <Circle className={`w-3.5 h-3.5 ${isActive ? "text-primary-foreground" : "text-muted-foreground"}`} strokeWidth={2.5} />
          )}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {player.symbol}
        </span>
        {isCurrentPlayer && (
          <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-primary">
            YOU
          </span>
        )}
      </div>
      <p className="font-medium text-sm truncate">{player.name}</p>
      {player.pending && <p className="text-xs text-muted-foreground">Waiting...</p>}
    </div>
  );
}
