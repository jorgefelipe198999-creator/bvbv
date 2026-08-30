import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Boxes, CalendarDays, Clock, Download, Filter, Percent, TrendingUp } from "lucide-react";

import { MetricCard } from "@/components/dashboard/MetricCard";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { CycleTable } from "@/components/dashboard/CycleTable";
import { CycleTimeChart, QualityDonut, ShiftProductionChart } from "@/components/dashboard/charts";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProduction } from "@/hooks/useProduction";
import { formatDateLabel, formatSeconds } from "@/lib/production";
import type { ShiftId } from "@/types/production";

export const Route = createFileRoute("/relatorio")({
  head: () => ({
    meta: [
      { title: "Relatório de Produção e Exportação PDF | NEXALINE" },
      {
        name: "description",
        content:
          "Relatórios de produção industrial por turno e data, com resumo de indicadores, gráficos, histórico de ciclos e exportação em PDF.",
      },
      { property: "og:title", content: "Relatório de Produção e Exportação PDF | NEXALINE" },
      {
        property: "og:description",
        content:
          "Filtre por turno e data, analise indicadores de ciclo e exporte um relatório PDF profissional.",
      },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const production = useProduction();
  const [shift, setShift] = useState<ShiftId | "all">("all");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const date = selectedDate ?? production.currentShift.date;
  const setDate = setSelectedDate;

  const dates = useMemo(() => {
    const set = new Set(production.availableDates);
    set.add(production.currentShift.date);
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [production.availableDates, production.currentShift.date]);

  const reportData = useMemo(() => {
    const cycles = production.cyclesFor(date, shift);
    const piecesShift1 = production.piecesFor(date, 1);
    const piecesShift2 = production.piecesFor(date, 2);
    const firstPiece = (pieces: typeof piecesShift1) =>
      pieces.reduce(
        (earliest, piece) => {
          if (!earliest || piece.ts < earliest.ts) return piece;
          return earliest;
        },
        undefined as (typeof pieces)[number] | undefined,
      )?.time;

    return {
      metrics: production.metricsFor(date, shift),
      cycles,
      firstPieceShift1: firstPiece(piecesShift1),
      firstPieceShift2: firstPiece(piecesShift2),
      shift1: production.metricsFor(date, 1),
      shift2: production.metricsFor(date, 2),
    };
  }, [date, production.cyclesFor, production.metricsFor, production.piecesFor, shift]);
  const { metrics, cycles, firstPieceShift1, firstPieceShift2, shift1, shift2 } = reportData;

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
            Relatório de produção
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Consolidação de ciclos, indicadores e aderência à meta de {production.target.toFixed(2)}{" "}
            s.
          </p>
        </div>
        <Button
          size="lg"
          className="rounded-xl shadow-md"
          onClick={() => {
            void import("@/services/pdfReport").then(({ exportProductionReport }) => {
              exportProductionReport({
                date,
                shift,
                metrics,
                cycles,
                target: production.target,
                firstPieceShift1,
                firstPieceShift2,
              });
            });
          }}
        >
          <Download className="size-4" /> Exportar PDF
        </Button>
      </motion.div>

      <SectionCard title="Filtros" description="Selecione a data e o turno de análise">
        <div className="flex flex-wrap gap-4">
          <label className="flex min-w-[220px] flex-1 flex-col gap-2 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="size-4" /> Data
            </span>
            <Select value={date} onValueChange={setDate}>
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dates.map((item) => (
                  <SelectItem key={item} value={item}>
                    {formatDateLabel(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex min-w-[220px] flex-1 flex-col gap-2 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Filter className="size-4" /> Turno
            </span>
            <Select
              value={String(shift)}
              onValueChange={(value) =>
                setShift(value === "all" ? "all" : (Number(value) as ShiftId))
              }
            >
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os turnos</SelectItem>
                <SelectItem value="1">Turno 1 · 06:00 — 13:59:59</SelectItem>
                <SelectItem value="2">Turno 2 · 14:00 — 21:59:59</SelectItem>
              </SelectContent>
            </Select>
          </label>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          index={0}
          label="Produção"
          value={metrics.produced}
          hint={`${metrics.cycles} ciclos`}
          icon={Boxes}
        />
        <MetricCard
          index={1}
          label="Tempo médio"
          value={formatSeconds(metrics.average)}
          hint={`Máx ${formatSeconds(metrics.max)} · Mín ${formatSeconds(metrics.min)}`}
          tone={metrics.average > production.target ? "danger" : "success"}
          icon={TrendingUp}
        />
        <MetricCard
          index={2}
          label="Ciclos > 7,5 s"
          value={metrics.above}
          hint="Fora da meta"
          tone={metrics.above > 0 ? "danger" : "success"}
          icon={Clock}
        />
        <MetricCard
          index={3}
          label="Percentual > 7,5 s"
          value={`${metrics.abovePercent.toFixed(1)}%`}
          hint="Índice de desvio"
          tone={metrics.abovePercent > 10 ? "danger" : "success"}
          icon={Percent}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard
          title="Tempos de ciclo"
          description="Evolução no período filtrado"
          className="lg:col-span-2"
        >
          <CycleTimeChart cycles={cycles} />
        </SectionCard>
        <SectionCard title="Aderência" description="Dentro da meta x acima de 7,5 s">
          <QualityDonut metrics={metrics} />
        </SectionCard>
      </div>

      <SectionCard
        title="Comparativo entre turnos"
        description={`Produção de ${formatDateLabel(date)}`}
      >
        <ShiftProductionChart
          data={[
            { shift: "Turno 1", pieces: shift1.produced, cycles: shift1.cycles },
            { shift: "Turno 2", pieces: shift2.produced, cycles: shift2.cycles },
          ]}
        />
      </SectionCard>

      <SectionCard
        title="Histórico de ciclos"
        description="Registros mais recentes do filtro selecionado"
      >
        <CycleTable cycles={cycles} showDate />
      </SectionCard>
    </div>
  );
}
