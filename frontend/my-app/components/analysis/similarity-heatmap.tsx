"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalysisPair } from "@/lib/types/analysis";

interface SimilarityHeatmapProps {
  pairs: AnalysisPair[];
  onPairClick?: (pairId: string) => void;
}

export function SimilarityHeatmap({ pairs, onPairClick }: SimilarityHeatmapProps) {
  const [hoveredCell, setHoveredCell] = React.useState<string | null>(null);

  // Collect all student IDs involved in pairs
  const studentSet = new Set<string>();
  for (const p of pairs) {
    studentSet.add(p.student_1);
    studentSet.add(p.student_2);
  }
  const students = Array.from(studentSet).sort();

  // Build similarity lookup
  const simMap = new Map<string, { similarity: number; pairId: string; severity: number }>();
  for (const p of pairs) {
    const key1 = `${p.student_1}|${p.student_2}`;
    const key2 = `${p.student_2}|${p.student_1}`;
    const val = { similarity: p.similarity, pairId: p.pair_id, severity: p.severity_score };
    simMap.set(key1, val);
    simMap.set(key2, val);
  }

  function getCellColor(similarity: number): string {
    if (similarity >= 0.9) return "rgba(239, 68, 68, 0.8)";
    if (similarity >= 0.7) return "rgba(239, 68, 68, 0.5)";
    if (similarity >= 0.5) return "rgba(249, 115, 22, 0.5)";
    if (similarity >= 0.3) return "rgba(234, 179, 8, 0.4)";
    if (similarity > 0) return "rgba(234, 179, 8, 0.15)";
    return "transparent";
  }

  if (students.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No pairs to display in heatmap.
        </CardContent>
      </Card>
    );
  }

  // Short label: "Student A" → "A", "Student AB" → "AB"
  const shortLabel = (s: string) => s.replace(/^Student\s+/i, "");

  const CELL = 36; // cell size in px

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Similarity Heatmap</CardTitle>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: "rgba(234,179,8,0.4)" }} />
              Low
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: "rgba(249,115,22,0.5)" }} />
              Med
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: "rgba(239,68,68,0.8)" }} />
              High
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto pb-6">
        {/* CSS grid-based heatmap for consistent spacing */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `80px repeat(${students.length}, ${CELL}px)`,
            gridTemplateRows: `40px repeat(${students.length}, ${CELL}px)`,
            gap: 2,
            width: "fit-content",
          }}
        >
          {/* Top-left empty corner */}
          <div />

          {/* Column headers */}
          {students.map((s) => (
            <div
              key={`col-${s}`}
              className="flex items-end justify-center overflow-visible"
              style={{ height: 40 }}
            >
              <span
                className="text-[10px] font-medium text-muted-foreground whitespace-nowrap"
                style={{
                  transform: "rotate(-45deg)",
                  transformOrigin: "center center",
                }}
              >
                {shortLabel(s)}
              </span>
            </div>
          ))}

          {/* Rows */}
          {students.map((rowStudent, ri) => (
            <React.Fragment key={rowStudent}>
              {/* Row label */}
              <div className="flex items-center justify-end pr-2">
                <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap truncate">
                  {shortLabel(rowStudent)}
                </span>
              </div>

              {/* Cells */}
              {students.map((colStudent, ci) => {
                // Diagonal
                if (ci === ri) {
                  return (
                    <div
                      key={colStudent}
                      className="rounded-sm"
                      style={{
                        width: CELL,
                        height: CELL,
                        background: "hsl(var(--muted))",
                      }}
                    />
                  );
                }

                // Lower triangle — empty
                if (ci < ri) {
                  return (
                    <div
                      key={colStudent}
                      style={{ width: CELL, height: CELL }}
                    />
                  );
                }

                // Upper triangle — data
                const mapKey = `${rowStudent}|${colStudent}`;
                const data = simMap.get(mapKey);
                const sim = data?.similarity ?? 0;
                const cellId = mapKey;
                const isHovered = hoveredCell === cellId;
                const isFlagged = (data?.severity ?? 0) >= 0.3;

                return (
                  <div
                    key={colStudent}
                    className="relative rounded-sm transition-transform cursor-pointer"
                    style={{
                      width: CELL,
                      height: CELL,
                      background: getCellColor(sim),
                      outline: isFlagged ? "2px solid rgba(239,68,68,0.4)" : "none",
                      outlineOffset: -1,
                      transform: isHovered ? "scale(1.2)" : "scale(1)",
                      zIndex: isHovered ? 10 : 1,
                    }}
                    onMouseEnter={() => setHoveredCell(cellId)}
                    onMouseLeave={() => setHoveredCell(null)}
                    onClick={() => data?.pairId && onPairClick?.(data.pairId)}
                  >
                    {isHovered && sim > 0 && (
                      <div className="absolute -top-9 left-1/2 -translate-x-1/2 z-50 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-[11px] shadow-md pointer-events-none">
                        {shortLabel(rowStudent)} vs {shortLabel(colStudent)}: {Math.round(sim * 100)}%
                      </div>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
