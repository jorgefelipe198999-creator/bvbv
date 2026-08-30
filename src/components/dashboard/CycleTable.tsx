import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateLabel } from "@/lib/production";
import type { CycleRecord } from "@/types/production";

const PAGE_SIZE = 20;

export function CycleTable({ cycles, showDate = false }: { cycles: CycleRecord[]; showDate?: boolean }) {
  const [shiftFilter, setShiftFilter] = useState<"all" | 1 | 2>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "above" | "within">("all");
  const [sortOption, setSortOption] = useState<"timeDesc" | "timeAsc" | "durationDesc" | "durationAsc">("timeDesc");
  const [page, setPage] = useState(1);

  const filteredCycles = useMemo(() => {
    const filtered = cycles
      .filter((cycle) => (shiftFilter === "all" ? true : cycle.shift === shiftFilter))
      .filter((cycle) => {
        if (statusFilter === "all") return true;
        return statusFilter === "above" ? cycle.above : !cycle.above;
      });

    switch (sortOption) {
      case "timeAsc":
        return filtered.sort((a, b) => a.endedAt - b.endedAt);
      case "durationDesc":
        return filtered.sort((a, b) => b.duration - a.duration);
      case "durationAsc":
        return filtered.sort((a, b) => a.duration - b.duration);
      case "timeDesc":
      default:
        return filtered.sort((a, b) => b.endedAt - a.endedAt);
    }
  }, [cycles, shiftFilter, statusFilter, sortOption]);

  const pageCount = Math.max(1, Math.ceil(filteredCycles.length / PAGE_SIZE));

  useEffect(() => {
    if (page > pageCount) setPage(1);
  }, [page, pageCount]);

  useEffect(() => {
    setPage(1);
  }, [shiftFilter, statusFilter, sortOption]);

  const visiblePages = useMemo(() => {
    const maxVisible = 7;
    if (pageCount <= maxVisible) {
      return Array.from({ length: pageCount }, (_, index) => index + 1);
    }

    const pages = new Set<number>([1, pageCount]);
    const window = 2;
    for (let index = page - window; index <= page + window; index += 1) {
      if (index > 1 && index < pageCount) pages.add(index);
    }

    const sorted = Array.from(pages).sort((left, right) => left - right);
    const result: Array<number | 'ellipsis'> = [];
    let previous: number | null = null;

    for (const item of sorted) {
      if (previous !== null && item - previous > 1) {
        result.push('ellipsis');
      }
      result.push(item);
      previous = item;
    }

    return result;
  }, [page, pageCount]);

  const rows = filteredCycles.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const resetFilters = () => {
    setShiftFilter("all");
    setStatusFilter("all");
    setSortOption("timeDesc");
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[1.5fr_1.5fr_2fr_auto]">
        <div>
          <p className="text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">Turno</p>
          <Select value={String(shiftFilter)} onValueChange={(value) => setShiftFilter(value === "all" ? "all" : (Number(value) as 1 | 2))}>
            <SelectTrigger className="h-11 rounded-xl w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os turnos</SelectItem>
              <SelectItem value="1">Turno 1</SelectItem>
              <SelectItem value="2">Turno 2</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">Status</p>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value === "above" ? "above" : value === "within" ? "within" : "all")}>
            <SelectTrigger className="h-11 rounded-xl w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="above">Acima da meta</SelectItem>
              <SelectItem value="within">Dentro da meta</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">Ordenar</p>
          <Select value={sortOption} onValueChange={(value) => setSortOption(value as any)}>
            <SelectTrigger className="h-11 rounded-xl w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="timeDesc">Mais recentes primeiro</SelectItem>
              <SelectItem value="timeAsc">Menos recentes primeiro</SelectItem>
              <SelectItem value="durationDesc">Maior duração primeiro</SelectItem>
              <SelectItem value="durationAsc">Menor duração primeiro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end justify-end">
          <Button variant="outline" size="sm" onClick={resetFilters} className="w-full">
            Redefinir
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/60">
            <tr className="text-left text-[0.7rem] uppercase tracking-[0.12em] text-muted-foreground">
              {showDate ? <th className="px-4 py-3 font-semibold">Data</th> : null}
              <th className="px-4 py-3 font-semibold">Hora</th>
              <th className="px-4 py-3 font-semibold">Tempo</th>
              <th className="px-4 py-3 font-semibold">Turno</th>
              <th className="px-4 py-3 text-right font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((cycle) => (
                <tr
                  key={cycle.id}
                  className={`border-t border-border/70 transition-colors ${cycle.above ? "bg-destructive/10" : "hover:bg-muted/50"}`}
                >
                  {showDate ? (
                    <td className="numeric px-4 py-3 text-muted-foreground">{formatDateLabel(cycle.date)}</td>
                  ) : null}
                  <td className="numeric px-4 py-3 text-muted-foreground">{cycle.time}</td>
                  <td className="numeric px-4 py-3 font-semibold">{cycle.duration.toFixed(2)} s</td>
                  <td className="px-4 py-3 text-muted-foreground">Turno {cycle.shift}</td>
                  <td className="px-4 py-3 text-right">
                    <Badge
                      className={
                        cycle.above
                          ? "border-transparent bg-destructive/12 text-destructive hover:bg-destructive/15"
                          : "border-transparent bg-success/12 text-success hover:bg-success/15"
                      }
                    >
                      <span
                        className={`mr-1.5 inline-block size-1.5 rounded-full ${cycle.above ? "bg-destructive" : "bg-success"}`}
                      />
                      {cycle.above ? "Acima da meta" : "Dentro da meta"}
                    </Badge>
                  </td>
                </tr>
              ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={showDate ? 5 : 4} className="px-4 py-10 text-center text-muted-foreground">
                  Nenhum ciclo registrado para o filtro selecionado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Exibindo <span className="font-semibold">{rows.length}</span> De <span className="font-semibold">{filteredCycles.length}</span> Ciclos
        </p>
        <Pagination>
          <PaginationContent>
            <PaginationPrevious
              className="disabled:pointer-events-none disabled:opacity-40"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1}
            />
            {visiblePages.map((visiblePage, index) => {
              if (visiblePage === 'ellipsis') {
                return (
                  <PaginationItem key={`ellipsis-${index}`}>
                    <span className="px-2 text-sm text-muted-foreground">…</span>
                  </PaginationItem>
                );
              }

              return (
                <PaginationItem key={visiblePage}>
                  <PaginationLink
                    isActive={page === visiblePage}
                    onClick={(event) => {
                      event.preventDefault();
                      setPage(visiblePage);
                    }}
                  >
                    {visiblePage}
                  </PaginationLink>
                </PaginationItem>
              );
            })}
            <PaginationNext
              className="disabled:pointer-events-none disabled:opacity-40"
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              disabled={page === pageCount}
            />
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
