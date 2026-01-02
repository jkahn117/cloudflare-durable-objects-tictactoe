import { createRouter } from "@tanstack/react-router";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

// Declare module augmentation for server context
declare module "@tanstack/react-router" {
  interface Register {
    server: {
      requestContext: {
        env: Env;
      };
    };
  }
}

// Create a new router instance
export const getRouter = () => {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
