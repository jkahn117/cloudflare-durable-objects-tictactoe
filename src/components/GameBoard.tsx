import { X, Circle } from "lucide-react";
import { Board, SymbolType } from "@/types";

interface GameBoardProps {
  board: Board;
  onSquareClick: (index: number) => void;
  winningLine?: number[];
  disabled: boolean;
  myTurn: boolean;
}

interface SquareProps {
  value: SymbolType | null;
  onClick: () => void;
  isHighlight: boolean;
  disabled: boolean;
}

export function GameBoard({
  board,
  onSquareClick,
  winningLine,
  disabled,
  myTurn,
}: GameBoardProps) {
  return (
    <div className="grid grid-cols-3 gap-3 mx-auto max-w-fit">
      {board.map((value, i) => (
        <Square
          key={i}
          value={value}
          onClick={() => onSquareClick(i)}
          isHighlight={winningLine?.includes(i) ?? false}
          disabled={disabled || !myTurn || value !== null}
        />
      ))}
    </div>
  );
}

const Square: React.FC<SquareProps> = ({
  value,
  onClick,
  isHighlight,
  disabled,
}) => {
  const canInteract = !value /*&& !winnerInfo && isMyTurn*/ && !disabled;

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
