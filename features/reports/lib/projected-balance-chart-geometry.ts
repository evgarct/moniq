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

export function buildStepPath(points: Pick<ChartGeometryPoint<unknown>, "x" | "y">[]) {
  if (!points.length) return "";

  return points.slice(1).reduce(
    (path, point) => `${path} H ${point.x} V ${point.y}`,
    `M ${points[0].x} ${points[0].y}`,
  );
}

export function buildLinePath(points: { x: number; y: number }[]) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  const smoothing = 0.15;

  const controlPoint = (
    current: { x: number; y: number },
    previous: { x: number; y: number } | undefined,
    next: { x: number; y: number } | undefined,
    isEnd: boolean,
  ) => {
    const p = previous ?? current;
    const n = next ?? current;

    const lengthX = n.x - p.x;
    const lengthY = n.y - p.y;

    const length = Math.sqrt(lengthX * lengthX + lengthY * lengthY);
    const angle = Math.atan2(lengthY, lengthX);

    const dist = length * smoothing;

    return {
      x: current.x + Math.cos(angle + (isEnd ? Math.PI : 0)) * dist,
      y: current.y + Math.sin(angle + (isEnd ? Math.PI : 0)) * dist,
    };
  };

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const cp1 = controlPoint(points[i], points[i - 1], points[i + 1], false);
    const cp2 = controlPoint(points[i + 1], points[i], points[i + 2], true);
    d += ` C ${cp1.x.toFixed(1)} ${cp1.y.toFixed(1)}, ${cp2.x.toFixed(1)} ${cp2.y.toFixed(1)}, ${points[i + 1].x.toFixed(1)} ${points[i + 1].y.toFixed(1)}`;
  }

  return d;
}
