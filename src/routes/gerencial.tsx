import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Clock3,
  Gauge,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { MetricCard } from "@/components/dashboard/MetricCard";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Progress } from "@/components/ui/progress";
import { useProduction } from "@/hooks/useProduction";
import {
  SHIFTS,
  TARGET_TIME,
  formatDateLabel,
  formatDuration,
  getShiftWindow,
  shiftElapsedSeconds,
} from "@/lib/production";
import { cn } from "@/lib/utils";

const GOAL_PIECES = 2300;

export const Route = createFileRoute("/gerencial")({
  head: () => ({
    meta: [
      { title: "Painel Gerencial de Produção | GREIF" },
      {
        name: "description",
        content:
          "Visão executiva com KPIs, previsões de meta, ritmo de produção e tendências de desempenho em vermelho/verde.",
      },
    ],
  }),
  component: ExecutivePage,
});

function ExecutivePage() {
  const production = useProduction();
  const { currentShift, now, target } = production;
  const executiveData = useMemo(() => {
    const { date, shift } = currentShift;
    return {
      metrics: production.metricsFor(date, shift),
      cycles: production.cyclesFor(date, shift),
      pieces: production.piecesFor(date, shift),
    };
  }, [
    currentShift.date,
    currentShift.shift,
    production.cyclesFor,
    production.metricsFor,
    production.piecesFor,
  ]);
  const { metrics, cycles, pieces } = executiveData;

  const summary = useMemo(() => {
    const elapsedSeconds = shiftElapsedSeconds(currentShift.date, currentShift.shift, now);
    const elapsedHours = elapsedSeconds / 3600;
    const pacePerHour = elapsedHours > 0 ? metrics.produced / elapsedHours : 0;
    const remainingPieces = Math.max(0, GOAL_PIECES - metrics.produced);
    const etaMinutes = pacePerHour > 0 ? (remainingPieces / pacePerHour) * 60 : null;
    const etaAt = etaMinutes === null ? null : new Date(now + etaMinutes * 60_000);
    const etaAtLabel = etaAt ? formatDateTimeShort(etaAt) : "—";
    const shiftEndAt = new Date(getShiftWindow(currentShift.date, currentShift.shift).end);
    const shiftEndLabel = formatDateTimeShort(shiftEndAt);
    const finishHint =
      etaAt === null
        ? "Sem previsão de conclusão no momento"
        : etaAt.getTime() > shiftEndAt.getTime()
          ? `A meta está prevista dentro do limite do turno (${shiftEndLabel})`
          : `Com o ritmo atual, a meta é prevista para ${etaAtLabel}`;

    const remainingShiftSeconds =
      Math.max(0, getShiftWindow(currentShift.date, currentShift.shift).end - now) / 1000;
    const remainingShiftHours = remainingShiftSeconds / 3600;
    const projectedPieces =
      pacePerHour > 0 ? metrics.produced + pacePerHour * remainingShiftHours : metrics.produced;
    const projectionDelta = GOAL_PIECES > 0 ? (projectedPieces / GOAL_PIECES) * 100 : 0;
    const efficiency = Math.min(
      100,
      Math.max(0, 100 - ((metrics.average - TARGET_TIME) / TARGET_TIME) * 100),
    );

    const recent = cycles.slice(-8);
    const previous = cycles.slice(-16, -8);
    const recentAvg = recent.length
      ? recent.reduce((sum, cycle) => sum + cycle.duration, 0) / recent.length
      : 0;
    const previousAvg = previous.length
      ? previous.reduce((sum, cycle) => sum + cycle.duration, 0) / previous.length
      : 0;
    const trendDelta = previousAvg > 0 ? ((previousAvg - recentAvg) / previousAvg) * 100 : 0;

    const efficiencyTone: "success" | "warning" | "danger" =
      efficiency >= 92 ? "success" : efficiency >= 85 ? "warning" : "warning";
    const rhythmTone: "success" | "warning" | "danger" =
      pacePerHour >= 140 ? "success" : pacePerHour >= 100 ? "warning" : "warning";
    const trendTone: "success" | "warning" | "danger" =
      trendDelta >= 6 ? "success" : trendDelta <= -6 ? "warning" : "warning";
    const projectionTone: "success" | "warning" | "danger" =
      projectedPieces >= GOAL_PIECES
        ? "success"
        : projectedPieces >= GOAL_PIECES * 0.9
          ? "warning"
          : "warning";

    const summaryState =
      efficiency >= 92 && pacePerHour >= 120
        ? "Operação estável"
        : efficiency < 85 || pacePerHour < 90
          ? "Acompanhamento"
          : "Em acompanhamento";

    return {
      elapsedSeconds,
      elapsedHours,
      pacePerHour,
      remainingPieces,
      etaAtLabel,
      finishHint,
      projectedPieces,
      projectionDelta,
      efficiency,
      efficiencyTone,
      rhythmTone,
      trendDelta,
      trendTone,
      projectionTone,
      summaryState,
      shiftEndLabel,
      target,
    };
  }, [currentShift.date, currentShift.shift, cycles, metrics, now, target]);

  const cycleTrendData = useMemo(
    () =>
      cycles.slice(-18).map((cycle, index) => ({
        index: index + 1,
        duration: cycle.duration,
        target: TARGET_TIME,
      })),
    [cycles],
  );

  const hourlyData = useMemo(() => {
    const { startHour, endHour } = SHIFTS[currentShift.shift];
    const forecastPerHour = Math.round(GOAL_PIECES / (endHour - startHour));

    return Array.from({ length: endHour - startHour }, (_, index) => {
      const hour = startHour + index;
      const label = `${String(hour).padStart(2, "0")}:00`;
      const actual = pieces.filter((piece) => new Date(piece.ts).getHours() === hour).length;
      const forecast = forecastPerHour;
      return { label, actual, forecast };
    });
  }, [currentShift.shift, pieces]);

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-[28px] border border-border/80 bg-gradient-to-br from-background via-card to-muted/70 p-6 shadow-[var(--shadow-lift)]"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
              <Sparkles className="size-3.5" /> Visão gerencial
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              Painel executivo de desempenho
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Visão simples e objetiva com previsibilidade de meta, horário estimado de conclusão e
              comparação entre o que foi previsto e o que foi realizado por hora.
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-sm">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
              Status da operação
            </p>
            <p
              className={cn(
                "mt-1 font-semibold",
                summary.summaryState === "Operação estável"
                  ? "text-emerald-600"
                  : "text-amber-600",
              )}
            >
              {summary.summaryState}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-border/70 bg-background/70 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Previsto até o fim do turno
                </p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {summary.projectedPieces.toFixed(0)} peças
                </p>
              </div>
              <div className="rounded-2xl bg-muted px-3 py-2 text-sm font-semibold text-muted-foreground">
                Meta {GOAL_PIECES}
              </div>
            </div>
            <Progress value={Math.min(100, summary.projectionDelta)} className="mt-4 h-3" />
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              {summary.projectionDelta >= 100 ? (
                <ArrowUpRight className="size-4 text-emerald-600" />
              ) : (
                <ArrowDownRight className="size-4 text-rose-600" />
              )}
              <span>
                {summary.projectedPieces >= GOAL_PIECES
                  ? "A meta deve ser atingida antes do fim do turno"
                  : `${Math.max(0, GOAL_PIECES - Math.round(summary.projectedPieces))} peças a menos da meta prevista`}
              </span>
            </div>
          </div>
          <div className="rounded-3xl border border-border/70 bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Condição atual
            </p>
            <div className="mt-3 flex items-center gap-3">
              <div
                className={cn(
                  "flex size-12 items-center justify-center rounded-2xl",
                  summary.efficiencyTone === "success"
                    ? "bg-emerald-500/15 text-emerald-600"
                    : summary.efficiencyTone === "warning"
                      ? "bg-amber-500/15 text-amber-600"
                      : "bg-rose-500/15 text-rose-600",
                )}
              >
                {summary.efficiencyTone === "success" ? (
                  <Gauge className="size-5" />
                ) : (
                  <AlertTriangle className="size-5" />
                )}
              </div>
              <div>
                <p className="text-xl font-semibold">{summary.efficiency.toFixed(1)}%</p>
                <p className="text-sm text-muted-foreground">
                  Conformidade do ciclo versus a meta de {target.toFixed(2)} s
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          index={0}
          label="Eficiência"
          value={`${summary.efficiency.toFixed(1)}%`}
          hint={
            summary.efficiency >= 92
              ? "Acima do patamar de excelência"
              : "Revisar velocidade de ciclo"
          }
          tone={summary.efficiencyTone}
          icon={Gauge}
          tooltip="Eficiência estimada a partir do tempo médio do ciclo versus a meta"
        />
        <MetricCard
          index={1}
          label="Ritmo"
          value={`${summary.pacePerHour.toFixed(0)} p/h`}
          hint={
            summary.pacePerHour >= 140
              ? "Dentro do planejamento"
              : "Em linha com o planejamento"
          }
          tone={summary.rhythmTone}
          icon={Activity}
          tooltip="Peças produzidas por hora considerando o tempo decorrido do turno"
        />
        <MetricCard
          index={2}
          label="ETA da meta"
          value={summary.etaAtLabel}
          hint={
            summary.remainingPieces > 0
              ? `${summary.remainingPieces} peças restantes no turno`
              : "Meta alcançada dentro do planejamento"
          }
          tone={summary.remainingPieces > 0 ? "warning" : "success"}
          icon={Clock3}
          tooltip="Horário estimado em que a meta de produção será atingida com o ritmo atual"
        />
        <MetricCard
          index={3}
          label="Previsão de fim"
          value={summary.shiftEndLabel}
          hint={summary.finishHint}
          tone={summary.projectionTone}
          icon={Target}
          tooltip="Fim do turno considerando a previsão atual de conclusão da meta"
        />
        <MetricCard
          index={4}
          label="Tendência"
          value={`${summary.trendDelta >= 0 ? "+" : ""}${summary.trendDelta.toFixed(1)}%`}
          hint={
            summary.trendDelta >= 6
              ? "Melhorando no bloco recente"
              : summary.trendDelta <= -6
                ? "Ajuste recente"
                : "Estável"
          }
          tone={summary.trendTone}
          icon={TrendingUp}
          tooltip="Comparação entre o bloco recente e o bloco anterior de ciclos"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title="Evolução do ciclo e meta"
          description="Últimos ciclos com a linha-base de desempenho"
          delay={0.05}
        >
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cycleTrendData}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="4 6" />
                <XAxis dataKey="index" axisLine={false} tickLine={false} {...axis} />
                <YAxis axisLine={false} tickLine={false} {...axis} domain={[5, 10]} />
                <ChartTooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => [`${value} s`, "Ciclo"]}
                />
                <ReferenceLine
                  y={TARGET_TIME}
                  stroke="var(--color-destructive)"
                  strokeDasharray="6 6"
                />
                <Line
                  type="monotone"
                  dataKey="duration"
                  stroke="var(--color-chart-1)"
                  strokeWidth={3}
                  isAnimationActive={false}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="target"
                  stroke="var(--color-destructive)"
                  strokeWidth={2}
                  strokeDasharray="7 7"
                  isAnimationActive={false}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title="Previsto x realizado por hora"
          description="Cada hora mostra a quantidade prevista e o que de fato foi produzido"
          delay={0.08}
        >
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData} barGap={8}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="4 6" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} {...axis} />
                <YAxis axisLine={false} tickLine={false} {...axis} />
                <ChartTooltip contentStyle={tooltipStyle} />
                <Bar
                  dataKey="forecast"
                  name="Previsto"
                  fill="var(--color-chart-2)"
                  radius={[8, 8, 4, 4]}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey="forecast"
                    position="top"
                    offset={6}
                    formatter={(value: number) => `${value}`}
                    fill="var(--color-foreground)"
                    fontSize={11}
                    fontWeight={600}
                  />
                </Bar>
                <Bar
                  dataKey="actual"
                  name="Realizado"
                  radius={[8, 8, 4, 4]}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey="actual"
                    position="top"
                    offset={6}
                    formatter={(value: number) => `${value}`}
                    fill="var(--color-foreground)"
                    fontSize={11}
                    fontWeight={600}
                  />
                  {hourlyData.map((entry, index) => (
                    <Cell
                      key={`${entry.label}-${index}`}
                      fill={
                        entry.actual >= entry.forecast
                          ? "var(--color-success)"
                          : "var(--color-destructive)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1">
              <span className="size-2.5 rounded-full bg-chart-2" /> Previsto
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1">
              <span className="size-2.5 rounded-full bg-emerald-500" /> Realizado acima da meta
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1">
              <span className="size-2.5 rounded-full bg-rose-500" /> Realizado abaixo da meta
            </span>
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <SectionCard
          title="Tempo de turno e janela de produção"
          description="Visão de capacidade e tempo disponível"
          delay={0.1}
        >
          <div className="space-y-4">
            <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Tempo decorrido
                  </p>
                  <p className="mt-1 text-2xl font-semibold">
                    {formatDuration(summary.elapsedSeconds)}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-600">
                  {summary.elapsedHours.toFixed(1)} h
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Início do turno
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {formatDateTimeShort(
                      getShiftWindow(currentShift.date, currentShift.shift).start,
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Fim previsto
                  </p>
                  <p className="mt-1 text-sm font-semibold">{summary.shiftEndLabel}</p>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Panorama aberto"
          description="Resumo para decisão gerencial em um único bloco"
          delay={0.12}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">Ponto forte</p>
              <p className="mt-2 text-lg font-semibold">
                {summary.pacePerHour >= 140
                  ? "Ritmo de saída acima da referência"
                  : "Pace estável e controlável"}
              </p>
            </div>
            <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-rose-700">Ponto de atenção</p>
              <p className="mt-2 text-lg font-semibold">
                {summary.efficiency >= 92
                  ? "A ausência de desvios é o principal diferencial"
                  : "Tempo médio ainda precisa cair para a meta"}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4 md:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Resumo executivo
                  </p>
                  <p className="mt-1 text-base font-semibold">{summary.summaryState}</p>
                </div>
                <div className="rounded-full border border-border px-3 py-1 text-sm font-medium text-muted-foreground">
                  {metrics.produced} peças confirmadas
                </div>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function formatDateTimeShort(value: number | Date) {
  const date = value instanceof Date ? value : new Date(value);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${day}/${month} ${hours}:${minutes}:${seconds}`;
}

const axis = {
  stroke: "var(--color-border)",
  fontSize: 11,
  tick: { fill: "var(--color-muted-foreground)", fontSize: 11 },
};

const tooltipStyle = {
  borderRadius: 14,
  border: "1px solid var(--color-border)",
  background: "var(--color-card)",
  boxShadow: "var(--shadow-soft)",
  fontSize: 12,
  color: "var(--color-foreground)",
};
