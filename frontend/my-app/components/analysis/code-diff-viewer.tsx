"use client";

import * as React from "react";
import type { MatchBlock } from "@/lib/types/analysis";

interface CodeDiffViewerProps {
  studentA: string;
  studentB: string;
  fileA: string;
  fileB: string;
  sourceA: string;
  sourceB: string;
  blocks: MatchBlock[];
  confidenceFilter: Set<string>;
  focusedBlockId: number | null;
}

interface LineInfo {
  blockId: number | null;
  confidence: "HIGH" | "MEDIUM" | "LOW" | null;
  isBlockStart: boolean;
  blockLabel: string | null;
}

function buildLineMap(
  lines: string[],
  blocks: MatchBlock[],
  side: "a" | "b",
  file: string,
  confidenceFilter: Set<string>,
): Map<number, LineInfo> {
  const map = new Map<number, LineInfo>();

  for (const block of blocks) {
    if (!confidenceFilter.has(block.confidence)) continue;
    const blockFile = side === "a" ? block.file_a : block.file_b;
    if (blockFile !== file) continue;

    const start = side === "a" ? block.start_a : block.start_b;
    const end = side === "a" ? block.end_a : block.end_b;

    for (let i = start; i <= end; i++) {
      map.set(i, {
        blockId: block.block_id,
        confidence: block.confidence,
        isBlockStart: i === start,
        blockLabel: i === start ? `Block ${block.block_id} (${block.confidence})` : null,
      });
    }
  }

  return map;
}

function getBlockStyle(confidence: string | null, isFocused: boolean) {
  const base: React.CSSProperties = {};

  if (confidence === "HIGH") {
    base.borderLeft = `6px solid #ef4444`;
    base.backgroundColor = isFocused ? "rgba(239,68,68,0.18)" : "rgba(239,68,68,0.08)";
  } else if (confidence === "MEDIUM") {
    base.borderLeft = `6px solid #f97316`;
    base.backgroundColor = isFocused ? "rgba(249,115,22,0.15)" : "rgba(249,115,22,0.06)";
  } else if (confidence === "LOW") {
    base.borderLeft = `6px solid #eab308`;
    base.backgroundColor = isFocused ? "rgba(234,179,8,0.15)" : "rgba(234,179,8,0.05)";
  }

  return base;
}

function getLabelColor(confidence: string): string {
  if (confidence === "HIGH") return "text-red-400";
  if (confidence === "MEDIUM") return "text-orange-400";
  return "text-yellow-400";
}

function CodePane({
  student,
  file,
  source,
  blocks,
  side,
  confidenceFilter,
  focusedBlockId,
}: {
  student: string;
  file: string;
  source: string;
  blocks: MatchBlock[];
  side: "a" | "b";
  confidenceFilter: Set<string>;
  focusedBlockId: number | null;
}) {
  const lines = source.split("\n");
  const lineMap = buildLineMap(lines, blocks, side, file, confidenceFilter);

  return (
    <div className="flex-1 min-w-0 flex flex-col border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b text-sm font-medium">
        <span className="text-muted-foreground">Student</span>
        <span className="font-bold">{student}</span>
        <span className="text-muted-foreground mx-1">&mdash;</span>
        <span className="text-primary">{file}</span>
      </div>

      <div className="overflow-auto flex-1" style={{ maxHeight: "70vh" }}>
        <div className="font-mono text-[13px] leading-5">
          {lines.map((line, i) => {
            const lineNum = i + 1;
            const info = lineMap.get(lineNum);
            const isFocused = info?.blockId === focusedBlockId && focusedBlockId !== null;
            const style = info ? getBlockStyle(info.confidence, isFocused) : {};

            return (
              <React.Fragment key={lineNum}>
                {info?.isBlockStart && info.blockLabel && (
                  <div
                    className={`px-2 py-0.5 text-[11px] font-semibold ${getLabelColor(info.confidence || "LOW")} bg-black/20`}
                    data-block-id={info.blockId}
                  >
                    {info.blockLabel}
                  </div>
                )}
                <div
                  className="grid transition-colors"
                  style={{
                    gridTemplateColumns: "48px 1fr",
                    ...style,
                  }}
                >
                  <span className="text-right pr-3 py-px text-muted-foreground/50 select-none bg-muted/30 text-xs leading-5">
                    {lineNum}
                  </span>
                  <span className="px-3 py-px whitespace-pre overflow-x-auto">
                    {line || " "}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function CodeDiffViewer({
  studentA,
  studentB,
  fileA,
  fileB,
  sourceA,
  sourceB,
  blocks,
  confidenceFilter,
  focusedBlockId,
}: CodeDiffViewerProps) {
  return (
    <div className="flex gap-2 w-full">
      <CodePane
        student={studentA}
        file={fileA}
        source={sourceA}
        blocks={blocks}
        side="a"
        confidenceFilter={confidenceFilter}
        focusedBlockId={focusedBlockId}
      />
      <CodePane
        student={studentB}
        file={fileB}
        source={sourceB}
        blocks={blocks}
        side="b"
        confidenceFilter={confidenceFilter}
        focusedBlockId={focusedBlockId}
      />
    </div>
  );
}
