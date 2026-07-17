"use client";

import { useFormatter, useLocale } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { MoneyAmount } from "@/components/money-amount";
import { getProjectedBalanceRange, projectBalancePoints } from "@/features/reports/lib/projected-balance-chart-geometry";
import type { FireReport } from "@/features/reports/lib/fire-report";
import { calDate } from "@/lib/formatters";

const SERIES_COLORS: Record<string, string> = {
  "income": "var(--chart-1)",
  "expenses": "var(--chart-5)",
  "investment-income": "var(--chart-2)",
};

const MARGINS = { left: 12, right: 54, top: 16, bottom: 30 };

function buildLinePath(points: { x: number; y: number }[]) {
  if (!points.length) return "";
  return points.slice(1).reduce(
    (path, point) => `${path} L ${point.x} ${point.y}`,
    `M ${points[0].x} ${points[0].y}`,
  );
}

export function FireChart({
  report,
  selectedDate,
  onSelectedDateChange,
  ariaLabel,
}: {
  report: FireReport;
  selectedDate: string;
  onSelectedDateChange: (date: string) => void;
  ariaLabel: string;
}) {
  const format = useFormatter();
  const locale = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 480 });
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setSize({
        width: Math.max(320, Math.round(rect.width)),
        height: Math.max(300, Math.round(rect.height)),
      });
    };
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    updateSize();
    return () => observer.disconnect();
  }, []);

  const compactNumberFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        notation: "compact",
        compactDisplay: "short",
        maximumFractionDigits: 1,
      }),
    [locale],
  );

  const range = useMemo(() => getProjectedBalanceRange(report.series), [report.series]);

  const projectedSeries = useMemo(
    () =>
      report.series.map((series) => ({
        ...series,
        points: projectBalancePoints({
          points: series.points,
          min: range.min,
          max: range.max,
          ...size,
          ...MARGINS,
        }),
      })),
    [range.max, range.min, report.series, size],
  );

  const referencePoints = projectedSeries[0]?.points ?? [];
  const activeDate = hoveredDate ?? selectedDate;
  const activeIndex = Math.max(0, referencePoints.findIndex((point) => point.date === activeDate));
  const activePoint = referencePoints[activeIndex] ?? referencePoints[0];

  const activeValues = activePoint
    ? projectedSeries.flatMap((series) => {
        const point = series.points.find((candidate) => candidate.date === activePoint.date);
        return point ? [{ series, point }] : [];
      })
    : [];

  const plotHeight = size.height - MARGINS.top - MARGINS.bottom;
  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    return {
      value: range.max - (range.max - range.min) * ratio,
      y: MARGINS.top + plotHeight * ratio,
    };
  });

  const xTicks = referencePoints.filter((_, index) => {
    const stride = Math.max(1, Math.floor(referencePoints.length / 4));
    const isLast = index === referencePoints.length - 1;
    const isFirst = index === 0;
    const isStride = index % stride === 0;

    if (isFirst || isLast) return true;
    if (isStride) {
      const distanceToLast = referencePoints.length - 1 - index;
      return distanceToLast >= stride * 0.5;
    }
    return false;
  });

  function chooseNearestDate(clientX: number) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || !referencePoints.length) return;
    const x = ((clientX - rect.left) / rect.width) * size.width;
    const nearest = referencePoints.reduce((best, point) =>
      Math.abs(point.x - x) < Math.abs(best.x - x) ? point : best,
    );
    setHoveredDate(nearest.date);
    onSelectedDateChange(nearest.date);
  }

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={ariaLabel}
      tabIndex={0}
      className="relative min-h-[300px] w-full flex-1 touch-none overflow-hidden rounded-[var(--radius-control)] outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onPointerMove={(event) => chooseNearestDate(event.clientX)}
      onPointerDown={(event) => chooseNearestDate(event.clientX)}
      onPointerLeave={() => setHoveredDate(null)}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        const currentIndex = Math.max(0, referencePoints.findIndex((point) => point.date === selectedDate));
        const nextIndex =
          event.key === "ArrowLeft"
            ? Math.max(0, currentIndex - 1)
            : Math.min(referencePoints.length - 1, currentIndex + 1);
        const nextDate = referencePoints[nextIndex]?.date;
        if (nextDate) {
          event.preventDefault();
          onSelectedDateChange(nextDate);
          setHoveredDate(nextDate);
        }
      }}
      onBlur={() => setHoveredDate(null)}
    >
      <svg
        viewBox={`0 0 ${size.width} ${size.height}`}
        className="size-full"
        aria-hidden="true"
        preserveAspectRatio="none"
      >
        {yTicks.map((tick) => (
          <g key={tick.y}>
            <line
              x1={MARGINS.left}
              x2={size.width - MARGINS.right}
              y1={tick.y}
              y2={tick.y}
              stroke="var(--border)"
              strokeOpacity="0.45"
            />
            <text
              x={size.width - 6}
              y={tick.y + 4}
              textAnchor="end"
              fill="var(--muted-foreground)"
              fontSize="12"
            >
              {compactNumberFormatter.format(tick.value)}
            </text>
          </g>
        ))}
        {projectedSeries.map((series) => (
          <path
            key={series.id}
            d={buildLinePath(series.points)}
            fill="none"
            stroke={SERIES_COLORS[series.id] || "var(--muted-foreground)"}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {activePoint ? (
          <line
            x1={activePoint.x}
            x2={activePoint.x}
            y1={MARGINS.top}
            y2={size.height - MARGINS.bottom}
            stroke="var(--chart-4)"
            strokeDasharray="3 4"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {xTicks.map((point) => (
          <text
            key={point.date}
            x={point.x}
            y={size.height - 8}
            textAnchor={point.x < size.width / 3 ? "start" : point.x > size.width * 0.66 ? "end" : "middle"}
            fill="var(--muted-foreground)"
            fontSize="12"
          >
            {format.dateTime(calDate(point.date), { month: "short", year: "2-digit" })}
          </text>
        ))}
      </svg>

      {activePoint && hoveredDate ? (
        <div className="pointer-events-none absolute left-3 top-3 min-w-48 rounded-[var(--radius-floating)] bg-popover px-3 py-2 shadow-md ring-1 ring-foreground/10">
          <p className="type-body-12 mb-1.5 text-muted-foreground">
            {format.dateTime(calDate(activePoint.date), {
              month: "long",
              year: "numeric",
            })}
          </p>
          <div className="flex flex-col gap-1">
            {activeValues.map(({ series, point }) => (
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
