import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { X, Circle } from "lucide-react";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Durable Object TicTacToe",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),

  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          {children}
          {/* Background decoration */}
          <div className="fixed top-0 left-0 w-full h-full -z-10 opacity-[0.02] pointer-events-none">
            <div className="absolute top-10 left-10">
              <X className="w-32 h-32 text-foreground" />
            </div>
            <div className="absolute bottom-10 right-10">
              <Circle className="w-32 h-32 text-foreground" />
            </div>
            <div className="absolute top-1/2 right-20">
              <X className="w-20 h-20 text-foreground" />
            </div>
          </div>
        </div>
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}
