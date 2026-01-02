import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Gamepad2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Welcome,
});
function Welcome() {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          navigate({ to: "/lobby" });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  const handleEnterLobby = () => {
    navigate({ to: "/lobby" });
  };

  return (
    <div className="text-center space-y-6 max-w-md">
      <div className="bg-indigo-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
        <Gamepad2 className="text-indigo-600 w-10 h-10" />
      </div>
      <div>
        <h1 className="text-4xl font-bold mb-2">TicTacToe.io</h1>
        <p className="text-slate-600">
          Play against AI or challenge other players in real-time!
        </p>
      </div>
      <button
        onClick={handleEnterLobby}
        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-semibold shadow-lg transition"
      >
        Enter Lobby
      </button>
      <p className="text-sm text-slate-400">
        Redirecting in {countdown} second{countdown !== 1 ? "s" : ""}...
      </p>
    </div>
  );
}
