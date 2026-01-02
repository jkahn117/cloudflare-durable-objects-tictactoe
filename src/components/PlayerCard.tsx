import { X, Circle } from "lucide-react";
import { Player, SymbolType } from "@/types";

interface PlayerCardProps {
  player: Player;
  isActive: boolean;
}
export function PlayerCard({ player, isActive }: PlayerCardProps) {
  return (
    <div
      className={`p-4 rounded-2xl border-2 transition-all ${
        isActive
          ? `${
              player.symbol === SymbolType.X
                ? "bg-blue-50 border-blue-400"
                : "bg-rose-50 border-rose-400"
            } scale-105 shadow-md`
          : "bg-slate-50 border-transparent opacity-60"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        {player.symbol === SymbolType.X ? (
          <X className="w-4 h-4 text-blue-500" />
        ) : (
          <Circle className="w-3 h-3 text-rose-500" />
        )}
        <span className="text-[10px] font-black uppercase tracking-wider">
          Player {player.symbol}
        </span>
      </div>
      <p className="font-bold truncate">{player.name}</p>
      {player.pending && <p className="text-xs text-slate-400">Waiting...</p>}
    </div>
  );
}
