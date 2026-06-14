"use client";

import {
  ColorType,
  CrosshairMode,
  createChart,
  LineSeries,
  LineType,
  TrackingModeExitMode,
  type BusinessDay,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
} from "lightweight-charts";
import { useEffect, useRef } from "react";

import { formatMoneyNumber } from "@/lib/formatters";
import type { ProjectedBalanceReport } from "@/features/reports/lib/projected-balance";

const SERIES_COLOR_VARIABLES = [
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
] as const;

function timeToDate(time: Time | undefined) {
  if (!time) return null;
  if (typeof time === "string") return time;
  if (typeof time === "number") {
    return new Date(time * 1_000).toISOString().slice(0, 10);
  }

  const day = time as BusinessDay;
  return `${day.year}-${String(day.month).padStart(2, "0")}-${String(day.day).padStart(2, "0")}`;
}

export function getProjectedBalanceSeriesColors(element: HTMLElement) {
  const styles = getComputedStyle(element);
  return SERIES_COLOR_VARIABLES.map((variable) => styles.getPropertyValue(variable).trim());
}

export function ProjectedBalanceChart({
  report,
  selectedDate,
  onSelectedDateChange,
  ariaLabel,
}: {
  report: ProjectedBalanceReport;
  selectedDate: string;
  onSelectedDateChange: (date: string) => void;
  ariaLabel: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const firstSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const onSelectedDateChangeRef = useRef(onSelectedDateChange);

  useEffect(() => {
    onSelectedDateChangeRef.current = onSelectedDateChange;
  }, [onSelectedDateChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !report.series.length) return;

    const styles = getComputedStyle(container);
    const colors = getProjectedBalanceSeriesColors(container);
    const textColor = styles.getPropertyValue("--muted-foreground").trim();
    const borderColor = styles.getPropertyValue("--border").trim();
    const foreground = styles.getPropertyValue("--foreground").trim();
    const chart = createChart(container, {
      autoSize: true,
      height: 360,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor,
        fontFamily: styles.fontFamily,
        attributionLogo: true,
      },
      grid: {
        vertLines: { color: borderColor },
        horzLines: { color: borderColor },
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: {
          color: foreground,
          labelBackgroundColor: foreground,
        },
        horzLine: {
          color: borderColor,
          labelVisible: false,
        },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.12, bottom: 0.12 },
      },
      timeScale: {
        borderColor,
        rightOffset: 0,
        fixLeftEdge: true,
        fixRightEdge: true,
        timeVisible: false,
      },
      handleScroll: {
        mouseWheel: false,
        pressedMouseMove: false,
        horzTouchDrag: false,
        vertTouchDrag: false,
      },
      handleScale: false,
      trackingMode: {
        exitMode: TrackingModeExitMode.OnTouchEnd,
      },
      localization: {
        priceFormatter: (price: number) =>
          formatMoneyNumber(price, report.currency, { showMinorUnits: false }),
      },
    });

    chartRef.current = chart;
    firstSeriesRef.current = null;

    for (const [index, series] of report.series.entries()) {
      const line = chart.addSeries(LineSeries, {
        color: colors[index % colors.length],
        lineWidth: 2,
        lineType: LineType.WithSteps,
        pointMarkersVisible: false,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerRadius: 4,
      });
      line.setData(series.points.map((point) => ({
        time: point.date,
        value: point.balance,
      })));

      if (!firstSeriesRef.current) {
        firstSeriesRef.current = line;
      }
    }

    chart.timeScale().fitContent();

    const handleCrosshairMove = (event: MouseEventParams) => {
      const date = timeToDate(event.time);
      if (date) onSelectedDateChangeRef.current(date);
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      chart.remove();
      chartRef.current = null;
      firstSeriesRef.current = null;
    };
  }, [report]);

  useEffect(() => {
    const chart = chartRef.current;
    const series = firstSeriesRef.current;
    const point = report.series[0]?.points.find((item) => item.date === selectedDate);

    if (chart && series && point) {
      chart.setCrosshairPosition(point.balance, point.date, series);
    }
  }, [report, selectedDate]);

  const dates = report.series[0]?.points.map((point) => point.date) ?? [];

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={ariaLabel}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        const currentIndex = Math.max(0, dates.indexOf(selectedDate));
        const nextIndex = event.key === "ArrowLeft"
          ? Math.max(0, currentIndex - 1)
          : Math.min(dates.length - 1, currentIndex + 1);
        const nextDate = dates[nextIndex];

        if (nextDate) {
          event.preventDefault();
          onSelectedDateChange(nextDate);
        }
      }}
      className="h-[300px] w-full touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-[360px]"
    />
  );
}
