// import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
// import { LobbyAgent } from "@/agents/Lobby";
// import { GameAgent } from "@/agents/Game";

// export { LobbyAgent, GameAgent };

// export default createServerEntry({
//   fetch(request, options) {
//     return handler.fetch(request, options);
//   },
// });

import {
  createStartHandler,
  defaultStreamHandler,
} from "@tanstack/react-start/server";
import { routeAgentRequest } from "agents";

// Export your Agents for Cloudflare to find
export { LobbyAgent } from "@/agents/Lobby";
export { GameAgent } from "@/agents/Game";

// Export Workflows for Cloudflare to find
export { HumanVsAIWorkflow } from "@/workflows/HumanVsAIWorkflow";
export { HumanVsHumanWorkflow } from "@/workflows/HumanVsHumanWorkflow";

// Create the handler using the callback pattern
const handler = createStartHandler(({ request, router, responseHeaders }) => {
  return defaultStreamHandler({
    request,
    router,
    responseHeaders,
  });
});

export default {
  async fetch(request: Request, env: Env) {
    // Handle requests to agents
    const agentResponse = await routeAgentRequest(request, env);
    if (agentResponse) {
      return agentResponse;
    }

    // We pass the Cloudflare 'env' into the 'context' property.
    // TanStack Start merges this with the router context.
    return handler(request, {
      context: {
        env,
      } as any,
    });
  },
};
