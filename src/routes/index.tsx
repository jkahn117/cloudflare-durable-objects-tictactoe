import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Gamepad2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    <div className="text-center space-y-5 max-w-md">
      <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
        <Gamepad2 className="text-primary w-8 h-8" />
      </div>
      <div>
        <h1 className="text-3xl font-bold mb-2">TicTacToe.io</h1>
        <p className="text-muted-foreground text-sm">
          Play against AI or challenge other players in real-time!
        </p>
      </div>
      <Button className="w-full" onClick={handleEnterLobby}>
        Enter Lobby
      </Button>
      <p className="text-xs text-muted-foreground">
        Redirecting in {countdown} second{countdown !== 1 ? "s" : ""}...
      </p>
    </div>
  );
}
