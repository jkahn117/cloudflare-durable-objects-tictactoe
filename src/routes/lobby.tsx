import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { GamesList } from "@/components/GameList";
import { AILevel, PlayerType } from "@/types";
import { getLobbyState, createGame, joinGame } from "@/lib/GameApi";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

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
  const [opponentType, setOpponentType] = useState<PlayerType>(PlayerType.AI);
  const [aiLevel, setAiLevel] = useState<AILevel>(AILevel.EXPERT);
  const [creating, setCreating] = useState(false);

  const getLobbyStateFn = useServerFn(getLobbyState);
  const createGameFn = useServerFn(createGame);
  const joinGameFn = useServerFn(joinGame);

  // Poll for lobby updates every 3 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      console.log("Polling for lobby updates...");
      const state = await getLobbyStateFn();
      console.log("Lobby state updated:", state);
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
    <div className="w-full max-w-4xl">
      <Accordion
        type="multiple"
        defaultValue={["create-game", "seeking-players"]}
        className="space-y-3"
      >
        {/* Create New Game */}
        <AccordionItem
          value="create-game"
          className="bg-card rounded-lg border shadow-sm"
        >
          <AccordionTrigger className="px-6 py-4 text-base font-semibold hover:no-underline">
            Create New Game
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-4">
            <div className="space-y-5 pt-2">
              {/* Opponent Type Toggle */}
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  Opponent
                </Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={opponentType === PlayerType.HUMAN ? "default" : "outline"}
                    onClick={() => setOpponentType(PlayerType.HUMAN)}
                    className="flex-1"
                  >
                    Human
                  </Button>
                  <Button
                    type="button"
                    variant={opponentType === PlayerType.AI ? "default" : "outline"}
                    onClick={() => setOpponentType(PlayerType.AI)}
                    className="flex-1"
                  >
                    AI
                  </Button>
                </div>
              </div>

              {/* AI Level Selector */}
              {opponentType === PlayerType.AI && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium block">AI Level</Label>
                  <RadioGroup
                    value={aiLevel}
                    onValueChange={(value) => setAiLevel(value as AILevel)}
                    className="flex justify-between gap-3"
                  >
                    <div className="flex items-center space-x-2 flex-1 px-3 py-2.5 border rounded-md hover:bg-accent/50 transition-colors cursor-pointer">
                      <RadioGroupItem value={AILevel.BEGINNER} id="beginner" className="h-5 w-5" />
                      <Label
                        htmlFor="beginner"
                        className="font-bold cursor-pointer text-sm"
                      >
                        Beginner
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 flex-1 px-3 py-2.5 border rounded-md hover:bg-accent/50 transition-colors cursor-pointer">
                      <RadioGroupItem
                        value={AILevel.INTERMEDIATE}
                        id="intermediate"
                        className="h-5 w-5"
                      />
                      <Label
                        htmlFor="intermediate"
                        className="font-bold cursor-pointer text-sm"
                      >
                        Intermediate
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 flex-1 px-3 py-2.5 border rounded-md hover:bg-accent/50 transition-colors cursor-pointer">
                      <RadioGroupItem value={AILevel.EXPERT} id="expert" className="h-5 w-5" />
                      <Label
                        htmlFor="expert"
                        className="font-bold cursor-pointer text-sm"
                      >
                        Expert
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              <Button
                onClick={handleCreateGame}
                disabled={creating}
                className="w-full"
              >
                {creating ? "Creating..." : "Create Game"}
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Games Seeking Players */}
        <AccordionItem
          value="seeking-players"
          className="bg-card rounded-lg border shadow-sm"
        >
          <AccordionTrigger className="px-6 py-4 text-base font-semibold hover:no-underline">
            Games Seeking Players
            <span className="ml-2 text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {lobbyState.gamesSeekingPlayers.length}
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-4">
            <GamesList
              games={lobbyState.gamesSeekingPlayers}
              type="seeking"
              onJoin={handleJoinGame}
            />
          </AccordionContent>
        </AccordionItem>

        {/* Games In Progress */}
        <AccordionItem
          value="in-progress"
          className="bg-card rounded-lg border shadow-sm"
        >
          <AccordionTrigger className="px-6 py-4 text-base font-semibold hover:no-underline">
            Games In Progress
            <span className="ml-2 text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {lobbyState.gamesInProgress.length}
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-4">
            <GamesList games={lobbyState.gamesInProgress} type="inProgress" />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
