import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { BarChart3, FileBarChart2, Gauge, Radio, Wifi, WifiOff } from "lucide-react";

import greifLogo from "@/greif-no-tagline.png";
import { useProduction } from "@/hooks/useProduction";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Dashboard", icon: Gauge },
  { to: "/gerencial", label: "Gerencial", icon: BarChart3 },
  { to: "/relatorio", label: "Relatório", icon: FileBarChart2 },
] as const;

export function AppHeader() {
  const { status, source, broker, topic, now, currentShift } = useProduction();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const clock = now ? new Date(now).toLocaleTimeString("pt-BR") : "--:--:--";

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex  flex-wrap items-center gap-4 px-5 py-3.5 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-12  shrink-0 items-center justify-start overflow-visible rounded-none bg-transparent shadow-none">
            <img
              src={greifLogo}
              alt="Logo GREIF"
              className="h-12 w-full object-contain"
            />
          </div>
          <span className="leading-tight">
            <span className="block text-sm font-semibold tracking-tight">GREIF EMBALAGENS</span>
            <span className="block text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">
              Packaging Success Toghether
            </span>
          </span>
        </Link>

        <nav className="order-3 flex w-full gap-1 rounded-xl bg-muted/70 p-1 sm:order-none sm:ml-6 sm:w-auto">
          {links.map((link) => {
            const active = pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  "relative flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors sm:flex-none",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-lg bg-card shadow-sm"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                ) : null}
                <link.icon className="relative size-4" />
                <span className="relative">{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          <span className="hidden items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium md:flex">
            <Radio className="size-3.5 text-primary" />
            {currentShift.label}
            <span className="text-muted-foreground">· {currentShift.window}</span>
          </span>
          <span className="numeric hidden rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold sm:block">
            {clock}
          </span>
          <span
            className={cn(
              "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold",
              status === "online"
                ? "bg-success/12 text-success"
                : status === "connecting"
                  ? "bg-warning/15 text-warning"
                  : "bg-destructive/12 text-destructive",
            )}
            title={`${source === "websocket" ? "WebSocket" : "Simulador"} · ${broker} · ${topic}`}
          >
            {status === "offline" ? (
              <WifiOff className="size-3.5" />
            ) : (
              <Wifi className="size-3.5" />
            )}
            {status === "online" ? "Conectado" : status === "connecting" ? "conectando" : "offline"}
          </span>
        </div>
      </div>
    </header>
  );
}
