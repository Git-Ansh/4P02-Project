"use client";

import { cn } from "@/lib/utils";

interface SeverityBadgeProps {
  level: "HIGH" | "MEDIUM" | "LOW" | string;
  className?: string;
}

export function SeverityBadge({ level, className }: SeverityBadgeProps) {
  const colors = {
    HIGH: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
    MEDIUM: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
    LOW: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
  };

  const colorClass = colors[level as keyof typeof colors] || colors.LOW;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold font-jb uppercase tracking-wider",
        colorClass,
        className,
      )}
    >
      {level}
    </span>
  );
}

interface SeverityDotProps {
  score: number;
  className?: string;
}

export function SeverityDot({ score, className }: SeverityDotProps) {
  const color =
    score >= 0.7
      ? "bg-red-500"
      : score >= 0.4
        ? "bg-orange-500"
        : "bg-yellow-500";

  return <span className={cn("inline-block h-2.5 w-2.5 rounded-full", color, className)} />;
}

export function getSeverityLevel(score: number): "HIGH" | "MEDIUM" | "LOW" {
  if (score >= 0.7) return "HIGH";
  if (score >= 0.4) return "MEDIUM";
  return "LOW";
}

export function getSeverityColor(score: number): string {
  if (score >= 0.7) return "text-red-500";
  if (score >= 0.4) return "text-orange-500";
  return "text-yellow-500";
}
