import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import greifLogo from "@/greif-no-tagline.png";
import { SHIFTS, formatDateLabel, formatSeconds } from "@/lib/production";
import type { CycleRecord, Metrics, ShiftId } from "@/types/production";

interface ReportPayload {
  date: string;
  shift: ShiftId | "all";
  metrics: Metrics;
  cycles: CycleRecord[];
  target: number;
  firstPieceShift1?: string | undefined;
  firstPieceShift2?: string | undefined;
}

const BRAND: [number, number, number] = [37, 82, 196];
const INK: [number, number, number] = [32, 40, 58];
const MUTED: [number, number, number] = [110, 122, 145];

export function exportProductionReport({
  date,
  shift,
  metrics,
  cycles,
  target,
  firstPieceShift1,
  firstPieceShift2,
}: ReportPayload) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const generated = new Date();
  const shiftLabel = shift === "all" ? "Todos os turnos" : SHIFTS[shift].label;

  doc.setFillColor(230, 255, 242);
  doc.rect(0, 0, width, 96, "F");

  doc.addImage(greifLogo, "PNG", 30, 16, 110, 38);

  doc.setTextColor(32, 96, 32);
  doc.setFontSize(21);
  doc.text("Relatório de Produção", 182, 44);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.text(`Recravadeira - Estação De Solda ·  Meta de ciclo ${target.toFixed(2)} s`, 182, 62);
  doc.text(`${formatDateLabel(date)}  ·  ${shiftLabel}`, 182, 78);
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  doc.text(
    `Primeira peça turno 1: ${firstPieceShift1 ?? "—"} · Primeira peça turno 2: ${firstPieceShift2 ?? "—"}`,
    182,
    92,
  );
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Relatório Consolidado", 44, 136);

  const summary: [string, string][] = [
    ["Quantidade produzida", String(metrics.produced)],
    ["Ciclos registrados", String(metrics.cycles)],
    ["Tempo médio", formatSeconds(metrics.average)],
    ["Maior tempo", formatSeconds(metrics.max)],
    ["Menor tempo", formatSeconds(metrics.min)],
    ["Último tempo", formatSeconds(metrics.last)],
    ["Ciclos acima de 7,5 s", String(metrics.above)],
    ["Percentual acima de 7,5 s", `${metrics.abovePercent.toFixed(1)}%`],
  ];

  let x = 44;
  let y = 152;
  const boxW = (width - 88 - 24) / 4;
  summary.forEach((item, index) => {
    if (index === 4) {
      x = 44;
      y += 74;
    }
    doc.setFillColor(245, 247, 251);
    doc.roundedRect(x, y, boxW, 62, 10, 10, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(item[0].toUpperCase(), x + 12, y + 20, { maxWidth: boxW - 24 });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...INK);
    doc.text(item[1], x + 12, y + 46);
    x += boxW + 8;
  });

  const chartTop = y + 92;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Distribuição dos tempos de ciclo", 44, chartTop - 14);
  drawCycleChart(doc, cycles, 44, chartTop, width - 88, 160, target);

  const donutTop = chartTop + 196;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text("Aderência à meta", 44, donutTop - 14);
  drawBars(doc, 44, donutTop, width - 88, metrics);

  doc.addPage();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text("Histórico de ciclos", 44, 60);

  const reversedCycles = cycles.slice().reverse();
  const tableRows = reversedCycles.map((cycle) => ({
    date: formatDateLabel(cycle.date),
    time: cycle.time,
    shift: `Turno ${cycle.shift}`,
    duration: cycle.duration.toFixed(2),
    status: cycle.above ? "Acima da meta" : "Dentro da meta",
    above: cycle.above,
  }));

  autoTable(doc, {
    startY: 74,
    head: [["Data", "Hora", "Turno", "Tempo (s)", "Status"]],
    body: tableRows,
    columns: [
      { header: "Data", dataKey: "date" },
      { header: "Hora", dataKey: "time" },
      { header: "Turno", dataKey: "shift" },
      { header: "Tempo (s)", dataKey: "duration" },
      { header: "Status", dataKey: "status" },
    ],
    styles: { fontSize: 9, cellPadding: 6, textColor: INK },
    headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [246, 248, 252] },
    didParseCell: (data) => {
      if (data.row.section === "body" && (data.row.raw as { above?: boolean }).above) {
        data.cell.styles.fillColor = [254, 226, 226];
        data.cell.styles.textColor = [143, 33, 33];
      }
    },
    margin: { left: 44, right: 44, bottom: 60 },
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    const height = doc.internal.pageSize.getHeight();
    doc.setDrawColor(226, 232, 240);
    doc.line(44, height - 46, width - 44, height - 46);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text(
      `Gerado em ${generated.toLocaleDateString("pt-BR")} às ${generated.toLocaleTimeString("pt-BR")}`,
      44,
      height - 30,
    );
    doc.text("Relatório Consolidado · Documento Gerado Automaticamente", width / 2, height - 30, {
      align: "center",
    });
    doc.text(`Página ${page} de ${pages}`, width - 44, height - 30, { align: "right" });
  }

  doc.save(`relatorio-producao-${date}-${shift === "all" ? "todos" : `turno${shift}`}.pdf`);
}

function drawCycleChart(
  doc: jsPDF,
  cycles: CycleRecord[],
  x: number,
  y: number,
  width: number,
  height: number,
  target: number,
) {
  doc.setFillColor(250, 251, 253);
  doc.roundedRect(x, y, width, height, 10, 10, "F");
  const data = cycles.slice(-60);
  if (!data.length) {
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text("Sem ciclos no período selecionado.", x + 16, y + height / 2);
    return;
  }

  const min = Math.min(5.5, ...data.map((c) => c.duration));
  const max = Math.max(9.5, ...data.map((c) => c.duration));
  const scaleY = (value: number) => y + height - 16 - ((value - min) / (max - min)) * (height - 32);
  const step = (width - 32) / Math.max(data.length - 1, 1);

  doc.setDrawColor(214, 58, 58);
  doc.setLineDashPattern([3, 3], 0);
  doc.line(x + 16, scaleY(target), x + width - 16, scaleY(target));
  doc.setLineDashPattern([], 0);

  doc.setDrawColor(...BRAND);
  doc.setLineWidth(1.2);
  data.forEach((cycle, index) => {
    if (index === 0) return;
    const prev = data[index - 1]!;
    doc.line(
      x + 16 + step * (index - 1),
      scaleY(prev.duration),
      x + 16 + step * index,
      scaleY(cycle.duration),
    );
  });

  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(`${max.toFixed(1)} s`, x + width - 40, y + 16);
  doc.text(`${min.toFixed(1)} s`, x + width - 40, y + height - 10);
}

function drawBars(doc: jsPDF, x: number, y: number, width: number, metrics: Metrics) {
  const within = Math.max(metrics.cycles - metrics.above, 0);
  const total = Math.max(metrics.cycles, 1);
  const withinWidth = (within / total) * width;

  doc.setFillColor(34, 160, 116);
  doc.roundedRect(x, y, Math.max(withinWidth, 2), 24, 6, 6, "F");
  doc.setFillColor(214, 58, 58);
  doc.roundedRect(x + withinWidth + 4, y, Math.max(width - withinWidth - 4, 2), 24, 6, 6, "F");

  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(`Dentro da meta: ${within} ciclos`, x, y + 44);
  doc.text(
    `Acima de 7,5 s: ${metrics.above} ciclos (${metrics.abovePercent.toFixed(1)}%)`,
    x + width / 2,
    y + 44,
  );
}
