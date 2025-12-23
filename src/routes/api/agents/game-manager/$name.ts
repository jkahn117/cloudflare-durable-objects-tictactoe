import { GameManager } from "@/server";
import { createFileRoute } from "@tanstack/react-router";
import { getAgentByName } from "agents";
import { env } from "cloudflare:workers";

export const Route = createFileRoute("/api/agents/game-manager/$name")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        // console.log("[Route] GET handler called for:", params.name);
        // console.log(
        //   "[Route] Is WebSocket?",
        //   request.headers.get("upgrade") === "websocket"
        // );

        let namedAgent = getAgentByName<Env, GameManager>(
          env.GAME_MANAGER,
          params.name
        );
        let namedResp = (await namedAgent).fetch(request);

        // console.log("[Route] Returning response");
        return namedResp;
      },
    },
  },
});
