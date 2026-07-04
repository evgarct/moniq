import type { ProjectedBalancePoint } from "@/features/reports/lib/projected-balance";

export type ChartGeometryPoint<T = ProjectedBalancePoint> = T & {
  x: number;
  y: number;
};

export function getProjectedBalanceRange(series: { points: { balance: number }[] }[]) {
  const values = series.flatMap((item) => item.points.map((point) => point.balance));
  if (!values.length) {
    return { min: 0, max: 1 };
  }

  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const rawRange = maximum - minimum;
  const padding = rawRange > 0 ? rawRange * 0.08 : Math.max(Math.abs(maximum) * 0.05, 1);

  return {
    min: minimum - padding,
    max: maximum + padding,
  };
}

export function projectBalancePoints<T extends { balance: number }>(options: {
  points: T[];
  min: number;
  max: number;
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}): ChartGeometryPoint<T>[] {
  const plotWidth = Math.max(1, options.width - options.left - options.right);
  const plotHeight = Math.max(1, options.height - options.top - options.bottom);
  const valueRange = Math.max(1, options.max - options.min);
  const denominator = Math.max(1, options.points.length - 1);

  return options.points.map((point, index) => ({
    ...point,
    x: options.left + (index / denominator) * plotWidth,
    y: options.top + ((options.max - point.balance) / valueRange) * plotHeight,
  }));
}

export function buildStepPath(points: Pick<ChartGeometryPoint<any>, "x" | "y">[]) {
  if (!points.length) return "";

  return points.slice(1).reduce(
    (path, point) => `${path} H ${point.x} V ${point.y}`,
    `M ${points[0].x} ${points[0].y}`,
  );
}
