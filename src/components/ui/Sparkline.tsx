import { useId } from "react";

import { cn } from "@/lib/cn";
import { historyMax, sparklinePoints } from "@/lib/history";

export interface SparklineProps {
  data: readonly number[];
  /** Fixed maximum (e.g. 100 for percentages). Auto when omitted. */
  max?: number;
  height?: number;
  tone?: "primary" | "success" | "warning" | "danger" | "muted";
  label: string;
  className?: string;
}

const STROKE = {
  primary: "var(--color-primary)",
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
  muted: "var(--color-muted)",
} as const;

/** Inline SVG line chart, no chart library. Scales to the container width. */
export function Sparkline({ data, max, height = 48, tone = "primary", label, className }: SparklineProps) {
  const id = useId();
  const width = 240;
  const top = max ?? historyMax(data, 1);
  const points = sparklinePoints(data, width, height, top, 2);
  const last = data[data.length - 1];
  const color = STROKE[tone];
  const area = points ? `${points} ${width - 2},${height - 2} 2,${height - 2}` : "";
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      className={cn("block h-12 w-full", className)}
      style={{ height }}
    >
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.35" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {data.length > 1 && (
        <>
          <polygon points={area} fill={`url(#${id})`} />
          <polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth="1.75"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </>
      )}
      {last !== undefined && data.length > 1 && (
        <circle
          cx={width - 2}
          cy={2 + (height - 4) - (Math.min(last, top || 1) / (top || 1)) * (height - 4)}
          r="2.5"
          fill={color}
        />
      )}
    </svg>
  );
}
