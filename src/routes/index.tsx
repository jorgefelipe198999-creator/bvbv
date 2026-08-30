import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useMemo } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  Clock,
  Layers,
  Percent,
  Radio,
  Target,
  Timer,
  TrendingUp,
} from "lucide-react";

import { MetricCard } from "@/components/dashboard/MetricCard";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { CycleTable } from "@/components/dashboard/CycleTable";
import {
  AboveTargetGauge,
  CycleTimeChart,
  ProductionHeatmap,
  QualityDonut,
  ShiftProductionChart,
} from "@/components/dashboard/charts";
import { Skeleton } from "@/components/ui/skeleton";
import { useProduction } from "@/hooks/useProduction";
import {
  formatDateLabel,
  formatSeconds,
  formatDuration,
  computeProductionTime,
  computeShiftIdleTime,
} from "@/lib/production";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard de Produção em Tempo Real | NEXALINE" },
      {
        name: "description",
        content:
          "Monitoramento industrial em tempo real via MQTT: produção por turno, tempos de ciclo, aderência à meta de 7,5 s e indicadores OEE.",
      },
      { property: "og:title", content: "Dashboard de Produção em Tempo Real | NEXALINE" },
      {
        property: "og:description",
        content:
          "Indicadores de produção ao vivo por turno, tempos de ciclo e aderência à meta, alimentados por MQTT e WebSocket.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const production = useProduction();
  const { currentShift, ready, target, liveCycleTime, runningSince } = production;

  const dashboardData = useMemo(() => {
    const { date, shift } = currentShift;
    return {
      metrics: production.metricsFor(date, shift),
      cycles: production.cyclesFor(date, shift),
      allCycles: production.cyclesFor(date, "all"),
      pieces: production.piecesFor(date, shift),
      shiftMetrics: production.metricsFor(date, shift),
      shiftPieces: production.piecesFor(date, shift),
      shiftCycles: production.cyclesFor(date, shift),
    };
  }, [
    currentShift.date,
    currentShift.shift,
    production.cyclesFor,
    production.piecesFor,
    production.metricsFor,
  ]);
  const { metrics, cycles, allCycles, pieces, shiftMetrics, shiftPieces, shiftCycles } =
    dashboardData;
  const isProducing = Boolean(runningSince);
  const firstPieceCurrentShift = shiftPieces.reduce(
    (earliest, piece) => {
      if (!earliest) return piece;
      return piece.ts < earliest.ts ? piece : earliest;
    },
    undefined as (typeof shiftPieces)[number] | undefined,
  );
  const firstCycle = cycles.reduce(
    (earliest, cycle) => {
      if (!earliest) return cycle;
      return cycle.endedAt < earliest.endedAt ? cycle : earliest;
    },
    undefined as (typeof cycles)[number] | undefined,
  );

  const productionTime = computeProductionTime(shiftCycles, production.liveCycleTime);
  const idleTime = computeShiftIdleTime(
    shiftCycles,
    currentShift.date,
    currentShift.shift,
    production.liveCycleTime,
    production.now,
  );

  const shiftData = [
    {
      shift: currentShift.label,
      pieces: shiftMetrics.produced,
      cycles: shiftMetrics.cycles,
    },
  ];

  if (!ready) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Monitoramento Recravadeira - Estação De Solda Real Time
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground flex flex-wrap items-center gap-2">
            <span>Recravadeira - Estação De Solda· {formatDateLabel(currentShift.date)} ·</span>
            <span
              className={`inline-flex h-2.5 w-2.5 rounded-full ${isProducing ? "bg-emerald-500" : "bg-destructive"}`}
            />
            <span>{isProducing ? "Célula Em Produção" : "Célula Sem Ciclo Ativo"}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-sm">
          <Target className="size-4 text-primary" />
          <span className="text-sm text-muted-foreground">Meta de ciclo</span>
          <span className="numeric text-sm font-semibold">{target.toFixed(2)} s</span>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <MetricCard
          index={0}
          label="Produção do turno"
          value={metrics.produced}
          hint={`${metrics.cycles} ciclos concluídos`}
          tooltip="Peças confirmadas no turno atual"
          icon={Boxes}
        />
        <MetricCard
          index={1}
          label="Tempo médio"
          value={formatSeconds(metrics.average)}
          hint={metrics.average > target ? "Acima da meta" : "Dentro da meta"}
          tone={metrics.average > target ? "danger" : "success"}
          icon={TrendingUp}
        />
        <MetricCard
          index={2}
          label="Tempo atual"
          value={runningSince ? `${liveCycleTime.toFixed(2)} s` : "Aguardando"}
          hint={runningSince ? "Ciclo em execução" : "Nenhum ciclo em execução"}
          tone={runningSince && liveCycleTime > target ? "danger" : "info"}
          icon={Timer}
        />
        <MetricCard
          index={3}
          label="Último ciclo"
          value={formatSeconds(metrics.last)}
          hint="Tempo do ciclo mais recente"
          tone={metrics.last > target ? "danger" : "success"}
          icon={Clock}
        />
        <MetricCard
          index={4}
          label="Maior ciclo"
          value={formatSeconds(metrics.max)}
          hint="Pior tempo do turno"
          tone="warning"
          icon={ArrowUpRight}
        />
        <MetricCard
          index={5}
          label="Menor ciclo"
          value={formatSeconds(metrics.min)}
          hint="Melhor tempo do turno"
          tone="success"
          icon={ArrowDownRight}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <SectionCard
          title="Tempos de ciclo"
          description="Últimos 40 ciclos do turno"
          delay={0.05}
          className="lg:col-span-1"
        >
          <CycleTimeChart cycles={cycles} />
        </SectionCard>
        <SectionCard
          title="Heatmap de Ciclos Fora Do Tempo Alvo"
          delay={0.08}
          className="lg:col-span-2"
        >
          <ProductionHeatmap cycles={allCycles} />
        </SectionCard>
        <SectionCard
          title="Aderência à meta"
          description="Percentual acima de 7,5 s"
          delay={0.1}
          className="lg:col-span-1"
        >
          <AboveTargetGauge percent={metrics.abovePercent} count={metrics.above} />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard
          title="Produção por turno"
          description="Peças Produzidas x Meta Hoje"
          delay={0.05}
        >
          <ShiftProductionChart data={shiftData} />
        </SectionCard>
        <SectionCard
          title="Qualidade do ciclo"
          description="Dentro da meta x acima de 7,5 s"
          delay={0.1}
        >
          <QualityDonut metrics={metrics} />
        </SectionCard>
        <SectionCard
          title="Indicadores do processo"
          description="Horários de início do processo no turno"
          delay={0.15}
        >
          <div className="space-y-8">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-1">
              <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Horário da primeira peça produzida
                </p>
                <div className="mt-2 space-y-1">
                  <p className="numeric text-2xl font-semibold">
                    {firstPieceCurrentShift?.time ?? "—"}
                  </p>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Primeira peça {currentShift.label.toLowerCase()}
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {currentShift.label} - Tempo Com Produção
                </p>
                <p className="numeric mt-2 text-2xl font-semibold">
                  {formatDuration(productionTime)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Tempo Sem Produção: {formatDuration(idleTime)}
                </p>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Últimos ciclos"
        description="Registro em tempo real com classificação por meta"
        delay={0.05}
        action={
          <span className="flex items-center gap-2 rounded-lg bg-success/12 px-3 py-1.5 text-xs font-semibold text-success">
            <Radio className="size-3.5 animate-pulse" /> ao vivo
          </span>
        }
      >
        <CycleTable cycles={allCycles} />
      </SectionCard>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-72 rounded-xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-[132px] rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-[340px] rounded-2xl lg:col-span-2" />
        <Skeleton className="h-[340px] rounded-2xl" />
      </div>
      <Skeleton className="h-[420px] rounded-2xl" />
    </div>
  );
}
