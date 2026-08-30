import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { CycleRecord, Metrics } from "@/types/production";
import { TARGET_TIME } from "@/lib/production";

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

const PRODUCTION_GOAL = 2300;

export function ShiftProductionChart({ data }: { data: { shift: string; pieces: number; cycles: number }[] }) {
  const chartData = data.map((entry) => ({ ...entry, goal: PRODUCTION_GOAL }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} barGap={8} margin={{ top: 34, bottom: 10 }}>
        <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="4 6" />
        <XAxis dataKey="shift" {...axis} axisLine={false} tickLine={false} />
        <YAxis {...axis} axisLine={false} tickLine={false} width={34} />
        <ChartTooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-muted)", opacity: 0.5 }} />
        <Bar
          dataKey="pieces"
          name="Peças"
          fill="var(--color-chart-1)"
          radius={[10, 10, 4, 4]}
          maxBarSize={46}
          isAnimationActive={false}
        >
          <LabelList dataKey="pieces" position="top" formatter={(value: number) => String(value)} />
        </Bar>
        <Bar
          dataKey="goal"
          name="Meta"
          fill="var(--color-chart-3)"
          radius={[10, 10, 4, 4]}
          maxBarSize={46}
          isAnimationActive={false}
        >
          <LabelList dataKey="goal" position="top" formatter={(value: number) => String(value)} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CycleTimeChart({ cycles }: { cycles: CycleRecord[] }) {
  const data = cycles.slice(-40).map((cycle, index) => ({
    index: index + 1,
    time: cycle.time,
    duration: cycle.duration,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="cycleFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="4 6" />
        <XAxis dataKey="time" {...axis} axisLine={false} tickLine={false} minTickGap={28} />
        <YAxis {...axis} axisLine={false} tickLine={false} width={38} domain={[5, 10]} />
        <ChartTooltip contentStyle={tooltipStyle} formatter={(value) => [`${value} s`, "Ciclo"]} />
        <ReferenceLine
          y={TARGET_TIME}
          stroke="var(--color-destructive)"
          strokeDasharray="5 5"
          label={{ value: "Meta 7,5 s", fill: "var(--color-destructive)", fontSize: 11, position: "insideTopRight" }}
        />
        <Area
          type="monotone"
          dataKey="duration"
          stroke="var(--color-chart-1)"
          strokeWidth={2.4}
          fill="url(#cycleFill)"
          isAnimationActive={false}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function getHeatColor(value: number, max: number) {
  if (!value) return "var(--color-border)";
  const ratio = Math.min(1, value / max);
  return `hsl(${120 - ratio * 120}, 80%, ${55 + ratio * 10}%)`;
}

export function ProductionHeatmap({ cycles }: { cycles: CycleRecord[] }) {
  const bins = Array.from({ length: 16 }, (_, index) => 6 + index).map((hour) => {
    const cyclesInHour = cycles.filter((cycle) => new Date(cycle.endedAt).getHours() === hour);
    const above = cyclesInHour.filter((cycle) => cycle.above).length;
    const abovePercent = cyclesInHour.length ? (above / cyclesInHour.length) * 100 : 0;

    return {
      hour,
      label: `${String(hour).padStart(2, "0")}:00`,
      above,
      abovePercent,
    };
  });

  const getCellClasses = (above: number, abovePercent: number) => {
    if (above === 0) return "rounded-2xl border border-border/70 p-1 text-center bg-zinc-200 text-zinc-700";
    if (abovePercent > 30) return "rounded-2xl border border-border/70 p-1 text-center bg-red-700 text-white";
    if (abovePercent > 20) return "rounded-2xl border border-border/70 p-1 text-center bg-red-300 text-foreground";
    return "rounded-2xl border border-border/70 p-1 text-center bg-red-100 text-foreground";
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-1">
        {bins.map((bin) => (
          <div key={bin.hour} className={getCellClasses(bin.above, bin.abovePercent)}>
            <p className="text-[10px] uppercase tracking-[0.14em]">{bin.label}</p>
            {bin.above === 0 ? (
              <p className="numeric mt-0.5 text-sm font-semibold">Nenhum Ciclo Anormal</p>
            ) : (
              <>
                <p className="numeric mt-0.5 text-lg font-semibold">{bin.above}</p>
                <p className="mt-0.5 text-[10px]">{bin.abovePercent.toFixed(0)}% acima</p>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AboveTargetGauge({ percent, count }: { percent: number; count: number }) {
  const clamped = Math.min(100, Math.max(0, percent));
  const tone = clamped <= 10 ? "var(--color-chart-3)" : clamped <= 25 ? "var(--color-chart-4)" : "var(--color-chart-5)";

  return (
    <div className="relative h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          data={[{ name: "acima", value: clamped, fill: tone }]}
          innerRadius="83%"
          outerRadius="100%"
          startAngle={210}
          endAngle={-30}
        >
          <RadialBar
            background={{ fill: "var(--color-muted)" }}
            dataKey="value"
            cornerRadius={20}
            isAnimationActive={false}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="numeric text-4xl font-semibold" style={{ color: tone }}>
          {clamped.toFixed(1)}%
        </span>
        <span className="mt-1 text-sm font-semibold" style={{ color: tone }}>
          {count} ciclos
        </span>
        <span className="text-xs text-muted-foreground">acima da meta</span>
      </div>
    </div>
  );
}

export function QualityDonut({ metrics }: { metrics: Metrics }) {
  const within = Math.max(metrics.cycles - metrics.above, 0);
  const total = metrics.cycles || 1;
  const withinPercent = (within / total) * 100;
  const data = [
    { name: "Dentro da meta", value: within, fill: "var(--color-chart-3)" },
    { name: "Acima de 7,5 s", value: metrics.above, fill: "var(--color-chart-5)" },
  ];

  return (
    <div className="relative h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <ChartTooltip contentStyle={tooltipStyle} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            isAnimationActive={false}
            innerRadius="74%"
            outerRadius="92%"
            paddingAngle={3}
            cornerRadius={10}
            stroke="none"
            labelLine={false}
            label={({ x, y, value }) => (
              <text x={x} y={y} dy={4} textAnchor="middle" fill="var(--color-foreground)" fontSize={12} fontWeight={600}>
                {value}
              </text>
            )}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="numeric text-5xl font-semibold">{metrics.cycles}</span>
        {/* <span className="mt-1 text-sm font-semibold">{metrics.abovePercent.toFixed(1)}% Acima da Meta</span> */}
      </div>
      <div className="absolute bottom--6 left-1/2 z-10 flex -translate-x-1/2 gap-2 text-[12px]">
        <div className="rounded-full bg-muted/80 px-2.5 py-1 text-muted-foreground">
          Dentro: {within} ({withinPercent.toFixed(1)}%)
        </div>
        <div className="rounded-full bg-muted/80 px-2.5 py-1 text-muted-foreground">
          Acima: {metrics.above} ({metrics.abovePercent.toFixed(1)}%)
        </div>
      </div>
    </div>
  );
}
