"use client";

import { ThresholdSlider } from "@/components/analysis/threshold-slider";

interface AnalysisStatsBarProps {
  totalStudents: number;
  pairsEvaluated: number;
  pairsFlagged: number;
  threshold: number; // 0-100
  onThresholdChange: (value: number) => void;
  clearCount: number;
}

export function AnalysisStatsBar({
  totalStudents,
  pairsEvaluated,
  pairsFlagged,
  threshold,
  onThresholdChange,
  clearCount,
}: AnalysisStatsBarProps) {
  return (
    <div className="sticky top-0 z-10 rounded-lg border border-border/50 backdrop-blur-xl bg-background/80 px-5 py-3 flex items-center gap-5 flex-wrap">
      <Stat label="Students" value={totalStudents} />
      <div className="w-px h-6 bg-border" />
      <Stat label="Evaluated" value={pairsEvaluated} />
      <div className="w-px h-6 bg-border" />
      <Stat label="Flagged" value={pairsFlagged} accent />
      <div className="flex-1 min-w-[180px] max-w-[320px]">
        <ThresholdSlider
          value={threshold}
          onChange={onThresholdChange}
          flaggedCount={pairsFlagged}
          clearCount={clearCount}
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-lg font-bold tabular-nums font-jb neon-num ${accent ? "text-red-500" : ""}`}>
        {value}
      </span>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-jb">
        {label}
      </span>
    </div>
  );
}
