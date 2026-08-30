import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Tone = "default" | "success" | "danger" | "warning" | "info";

const toneStyles: Record<Tone, { icon: string; value: string }> = {
  default: { icon: "bg-primary/10 text-primary", value: "text-foreground" },
  success: { icon: "bg-success/12 text-success", value: "text-success" },
  danger: { icon: "bg-destructive/12 text-destructive", value: "text-destructive" },
  warning: { icon: "bg-warning/15 text-warning", value: "text-foreground" },
  info: { icon: "bg-info/12 text-info", value: "text-info" },
};

interface MetricCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  tooltip?: string;
  icon: LucideIcon;
  tone?: Tone;
  index?: number;
  footer?: ReactNode;
  className?: string;
}

export function MetricCard({
  label,
  value,
  hint,
  tooltip,
  icon: Icon,
  tone = "default",
  index = 0,
  footer,
  className,
}: MetricCardProps) {
  const styles = toneStyles[tone];

  const card = (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
      className={cn("surface-card group flex flex-col gap-3 p-5", className)}
    >
      <header className="flex items-start justify-between gap-3">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110",
            styles.icon,
          )}
        >
          <Icon className="size-4.5" strokeWidth={2.1} />
        </span>
      </header>
      <p className={cn("numeric text-3xl font-semibold leading-none", styles.value)}>{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {footer}
    </motion.article>
  );

  if (!tooltip) return card;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{card}</TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
