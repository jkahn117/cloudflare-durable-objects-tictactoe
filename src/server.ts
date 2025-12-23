import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { getAgentByName } from "agents";
import { GameManager } from "./do/GameManager";
import { env } from "cloudflare:workers";

export { GameManager } from "./do/GameManager";

export default createServerEntry({
  async fetch(request) {
    const url = new URL(request.url);
    const isWebSocketUpgrade = request.headers.get("upgrade") === "websocket";

    // console.log("[Server] Incoming request:", {
    //   method: request.method,
    //   path: url.pathname,
    //   isWebSocketUpgrade,
    //   headers: Object.fromEntries(request.headers.entries()),
    // });

    if (
      isWebSocketUpgrade &&
      url.pathname.startsWith("/api/agents/game-manager")
    ) {
      // console.log("[Server] Upgrading to WebSocket, routing to agent");
      const gameId = url.pathname
        .split("/api/agents/game-manager/")[1]
        .split("?")[0];
      // console.log("[Server] Routing WebSocket to GameManager:", gameId);

      try {
        const agent = await getAgentByName<Env, GameManager>(
          env.GAME_MANAGER,
          gameId
        );
        const resp = await agent.fetch(request);

        // console.log("[Server] WebSocket upgrade response:", {
        //   status: resp.status,
        //   hasWebSocket: !!resp.webSocket,
        // });

        return resp;
      } catch (error: any) {
        console.error("[Server] Error routing to agent:", error);
        return new Response("WebSocket connection failed: " + error.message, {
          status: 500,
        });
      }
    }

    return handler.fetch(request);
  },
});
