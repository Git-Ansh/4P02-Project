"use client";

import * as React from "react";
import Link from "next/link";
import {
  SeverityBadge,
  getSeverityLevel,
} from "@/components/analysis/severity-badge";
import type { AnalysisPair } from "@/lib/types/analysis";

interface RevealedIdentity {
  s1: string; s1number: string; s1email: string;
  s2: string; s2number: string; s2email: string;
}

interface PairListPanelProps {
  pairs: AnalysisPair[];
  threshold: number; // 0-1
  courseId: string;
  assignmentId: string;
  revealApprovals?: Record<string, RevealedIdentity>;
}

export function PairListPanel({
  pairs,
  threshold,
  courseId,
  assignmentId,
  revealApprovals = {},
}: PairListPanelProps) {
  const [severityFilter, setSeverityFilter] = React.useState<
    "ALL" | "HIGH" | "MEDIUM" | "LOW"
  >("ALL");
  const [sortBy, setSortBy] = React.useState<"severity" | "similarity">(
    "severity"
  );

  const filtered = pairs.filter((p) => {
    if (severityFilter === "HIGH") return p.severity_score >= 0.7;
    if (severityFilter === "MEDIUM")
      return p.severity_score >= 0.4 && p.severity_score < 0.7;
    if (severityFilter === "LOW") return p.severity_score < 0.4;
    return true;
  });

  const sorted = [...filtered].sort((a, b) =>
    sortBy === "severity"
      ? b.severity_score - a.severity_score
      : b.similarity - a.similarity
  );

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          {(["ALL", "HIGH", "MEDIUM", "LOW"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setSeverityFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                severityFilter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {f === "ALL" ? `All (${pairs.length})` : f[0] + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <select
          value={sortBy}
          onChange={(e) =>
            setSortBy(e.target.value as "severity" | "similarity")
          }
          className="text-xs bg-muted rounded-md px-2 py-1 border-none outline-none cursor-pointer"
        >
          <option value="severity">Sort: Severity</option>
          <option value="similarity">Sort: Similarity</option>
        </select>
      </div>

      {/* Pair cards */}
      {sorted.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground text-sm">
          No pairs match this filter.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((pair) => {
            const belowThreshold = pair.similarity < threshold;
            const simPct = Math.round(pair.similarity * 100);
            const blocks = pair.summary?.total_blocks ?? 0;
            const highBlocks = pair.summary?.high_confidence_blocks ?? 0;
            const density = pair.summary?.average_density ?? 0;
            const revealed = revealApprovals[pair.pair_id];

            return (
              <Link
                key={pair.pair_id}
                href={`/instructor/courses/${courseId}/assignments/${assignmentId}/analysis/${pair.pair_id}`}
                className={`block rounded-lg border border-border/50 p-4 transition-all hover:border-primary/25 hover:bg-primary/[0.03] ${
                  belowThreshold ? "opacity-25" : ""
                }`}
              >
                {/* Header row */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  {revealed ? (
                    <div className="flex flex-col leading-tight min-w-0">
                      <span className="font-semibold text-sm truncate">{revealed.s1} vs {revealed.s2}</span>
                    </div>
                  ) : (
                    <span className="font-semibold text-sm truncate">
                      {pair.student_1} vs {pair.student_2}
                    </span>
                  )}
                  <SeverityBadge
                    level={getSeverityLevel(pair.severity_score)}
                  />
                </div>

                {/* Similarity bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">
                      Similarity
                    </span>
                    <span
                      className={`text-lg font-bold tabular-nums font-jb ${
                        simPct >= 70
                          ? "text-red-500"
                          : simPct >= 40
                            ? "text-orange-500"
                            : "text-yellow-500"
                      }`}
                    >
                      {simPct}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        simPct >= 70
                          ? "bar-glow-red"
                          : simPct >= 40
                            ? "bar-glow-orange"
                            : "bar-glow-yellow"
                      }`}
                      style={{
                        width: `${simPct}%`,
                        background:
                          simPct >= 70
                            ? "#ef4444"
                            : simPct >= 40
                              ? "#f97316"
                              : "#eab308",
                      }}
                    />
                  </div>
                </div>

                {/* Detail stats */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    <strong className="text-foreground">{blocks}</strong> blocks
                  </span>
                  {highBlocks > 0 && (
                    <span className="text-red-500">
                      {highBlocks} high
                    </span>
                  )}
                  <span>
                    density {Math.round(density * 100)}%
                  </span>
                  <span className="ml-auto font-jb text-[10px]">
                    sev {pair.severity_score.toFixed(2)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
