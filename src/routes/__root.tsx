import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AppHeader } from "@/components/layout/AppHeader";
import { ProductionProvider } from "@/context/ProductionContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useProduction } from "@/hooks/useProduction";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "NEXALINE · Monitoramento de Produção Industrial" },
      {
        name: "description",
        content:
          "Plataforma de monitoramento de produção industrial em tempo real via MQTT, com indicadores por turno e relatórios em PDF.",
      },
      { name: "author", content: "NEXALINE" },
      { property: "og:title", content: "NEXALINE · Monitoramento de Produção Industrial" },
      {
        property: "og:description",
        content: "Indicadores de produção em tempo real por turno, tempos de ciclo e relatórios industriais.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AmbientBackground() {
  const production = useProduction();
  const isMachineRunning = Boolean(production.runningSince);
  const ambientGradient = isMachineRunning
    ? "radial-gradient(1000px 500px at 22% 5%, rgba(0, 134, 49, 0.22), transparent), radial-gradient(800px 420px at 95% 0%, rgba(16, 185, 129, 0.16), transparent)"
    : "radial-gradient(1000px 500px at 22% -5%, rgba(255, 0, 0, 0.22), transparent), radial-gradient(800px 420px at 95% 0%, rgba(248, 113, 113, 0.14), transparent)";

  return (
    <div className="min-h-screen" style={{ backgroundImage: ambientGradient }}>
      <AppHeader />
      <main className="mx-auto w-full px-5 py-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>
      <footer className="border-t border-border/70 py-6 text-center text-xs text-muted-foreground">
        Sistema de monitoramento industrial em tempo real · Idealizado por{" Renan "}
      </footer>
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        <ProductionProvider>
          <AmbientBackground />
        </ProductionProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

