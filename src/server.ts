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

// Export your Agents for Cloudflare to find
export { LobbyAgent } from "@/agents/Lobby";
export { GameAgent } from "@/agents/Game";

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
    // We pass the Cloudflare 'env' into the 'context' property.
    // TanStack Start merges this with the router context.
    return handler(request, {
      context: {
        env,
      } as any,
    });
  },
};
