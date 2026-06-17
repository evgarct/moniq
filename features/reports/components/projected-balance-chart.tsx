"use client";

import {
  ColorType,
  CrosshairMode,
  createChart,
  LineSeries,
  LineType,
  TrackingModeExitMode,
  type AutoscaleInfo,
  type BusinessDay,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
} from "lightweight-charts";
import { useFormatter, useLocale } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { MoneyAmount } from "@/components/money-amount";
import type { ProjectedBalanceReport } from "@/features/reports/lib/projected-balance";
import { calDate } from "@/lib/formatters";

const LINE_COLOR_VARIABLES = [
  "--chart-1",
  "--chart-5",
  "--chart-4",
  "--muted-foreground",
  "--border",
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

type ChartTooltip = {
  date: string;
  x: number;
  y: number;
};

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
  const format = useFormatter();
  const locale = useLocale();
  const compactNumberFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        notation: "compact",
        compactDisplay: "short",
        maximumFractionDigits: 1,
      }),
    [locale],
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const firstSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const onSelectedDateChangeRef = useRef(onSelectedDateChange);
  const [tooltip, setTooltip] = useState<ChartTooltip | null>(null);

  useEffect(() => {
    onSelectedDateChangeRef.current = onSelectedDateChange;
  }, [onSelectedDateChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !report.series.length) return;

    const styles = getComputedStyle(container);
    const textColor = styles.getPropertyValue("--muted-foreground").trim();
    const borderColor = styles.getPropertyValue("--border").trim();
    const foreground = styles.getPropertyValue("--foreground").trim();
    const crosshairColor = styles.getPropertyValue("--chart-4").trim();
    const lineColors = LINE_COLOR_VARIABLES.map(
      (variable) => styles.getPropertyValue(variable).trim(),
    );
    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor,
        fontFamily: styles.fontFamily,
        fontSize: 12,
      },
      localization: {
        locale,
        priceFormatter: (price: number) => compactNumberFormatter.format(price),
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: {
          color: crosshairColor,
          labelBackgroundColor: foreground,
        },
        horzLine: {
          color: crosshairColor,
          labelVisible: false,
        },
      },
      rightPriceScale: {
        borderVisible: false,
        entireTextOnly: true,
        minimumWidth: 44,
        scaleMargins: { top: 0.16, bottom: 0.12 },
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
    });

    chartRef.current = chart;
    firstSeriesRef.current = null;

    for (const [index, series] of report.series.entries()) {
      const line = chart.addSeries(LineSeries, {
        color: lineColors[index % lineColors.length],
        lineWidth: index === 0 ? 2 : 1,
        lineType: LineType.WithSteps,
        pointMarkersVisible: false,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerRadius: 4,
        autoscaleInfoProvider: (original: () => AutoscaleInfo | null) => {
          const autoscaleInfo = original();
          if (!autoscaleInfo?.priceRange) return autoscaleInfo;
          const { minValue, maxValue } = autoscaleInfo.priceRange;
          const range = maxValue - minValue;
          const padding = range > 0
            ? range * 0.08
            : Math.max(Math.abs(maxValue) * 0.05, 1);

          return {
            ...autoscaleInfo,
            priceRange: {
              ...autoscaleInfo.priceRange,
              minValue: minValue - padding,
              maxValue: maxValue + padding,
            },
            margins: {
              above: Math.max(8, autoscaleInfo.margins?.above ?? 0),
              below: Math.max(8, autoscaleInfo.margins?.below ?? 0),
            },
          };
        },
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
      if (!date || !event.point) {
        setTooltip(null);
        return;
      }

      onSelectedDateChangeRef.current(date);
      setTooltip({
        date,
        x: Math.max(8, Math.min(event.point.x + 14, container.clientWidth - 220)),
        y: Math.max(8, Math.min(event.point.y + 14, container.clientHeight - 120)),
      });
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      chart.remove();
      chartRef.current = null;
      firstSeriesRef.current = null;
    };
  }, [compactNumberFormatter, locale, report]);

  const dates = report.series[0]?.points.map((point) => point.date) ?? [];
  const tooltipPoints = tooltip
    ? report.series.flatMap((series) => {
        const point = series.points.find((item) => item.date === tooltip.date);
        return point ? [{ series, point }] : [];
      })
    : [];

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
          const chart = chartRef.current;
          const series = firstSeriesRef.current;
          const point = report.series[0]?.points.find((item) => item.date === nextDate);
          if (chart && series && point) {
            chart.setCrosshairPosition(point.balance, point.date, series);
          }
        }
      }}
      className="relative min-h-[300px] w-full flex-1 touch-none overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {tooltip ? (
        <div
          className="pointer-events-none absolute z-10 min-w-48 rounded-[var(--radius-floating)] bg-popover px-3 py-2 shadow-md ring-1 ring-foreground/10"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <p className="type-body-12 mb-1.5 text-muted-foreground">
            {format.dateTime(calDate(tooltip.date), {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
          <div className="flex flex-col gap-1">
            {tooltipPoints.map(({ series, point }) => (
              <div key={series.id} className="flex items-baseline justify-between gap-4">
                <span className="type-body-12 min-w-0 truncate text-foreground">{series.name}</span>
                <MoneyAmount
                  amount={point.balance}
                  currency={report.currency}
                  className="shrink-0 text-sm font-medium tabular-nums"
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
