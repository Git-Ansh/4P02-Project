"use client";

/**
 * Code diff viewer — renders exactly like the codesim_viewer reference.
 *
 * Takes a `pair` object and an `activeFile` (one of the file names from
 * pair.sources[student_1]).  Both panels show the SAME filename — student_1's
 * version on the left, student_2's on the right.
 *
 * Line highlighting comes from `pair.files[studentName][activeFile]` which has
 * per-student block ranges.  Clicking a highlighted line syncs both panels.
 */

import * as React from "react";
import type { AnalysisPair, MatchBlock } from "@/lib/types/analysis";

interface CodeDiffViewerProps {
  pair: AnalysisPair;
  activeFile: string;
  activeFileB: string;
  activeBlockIds: Set<number>;
  blockFrequency: Map<number, number>;
  focusedBlockId: number | null;
  onBlockClick: (blockId: number) => void;
}

function getLineStyle(confidence: string, focused: boolean) {
  const styles: Record<string, { bg: string; bgF: string; border: string }> = {
    HIGH:   { bg: "rgba(255,79,79,0.15)",  bgF: "rgba(255,79,79,0.35)",  border: "#ff4f4f" },
    MEDIUM: { bg: "rgba(245,197,66,0.12)", bgF: "rgba(245,197,66,0.30)", border: "#f5c542" },
    LOW:    { bg: "rgba(91,141,238,0.10)", bgF: "rgba(91,141,238,0.28)", border: "#5b8dee" },
    FILE:   { bg: "rgba(255,79,79,0.18)",  bgF: "rgba(255,79,79,0.40)",  border: "#ff4f4f" },
  };
  const s = styles[confidence] ?? styles.LOW;
  return {
    background: focused ? s.bgF : s.bg,
    borderLeft: `3px solid ${focused ? s.border : s.border + "50"}`,
    cursor: "pointer",
  };
}

const CONFIDENCE_RANK: Record<string, number> = { FILE: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

function buildLineMap(
  pair: AnalysisPair,
  studentName: string,
  fileName: string,
  allowedBlockIds: Set<number>,
): Map<number, { blockId: number; confidence: string }> {
  const map = new Map<number, { blockId: number; confidence: string }>();
  const fileBlocks = pair.files?.[studentName]?.[fileName];
  if (!fileBlocks) return map;

  for (const fb of fileBlocks) {
    if (!allowedBlockIds.has(fb.block_id)) continue;
    const block = pair.blocks.find((b) => b.block_id === fb.block_id);
    if (!block) continue;
    const newRank = CONFIDENCE_RANK[block.confidence] ?? 1;
    for (let ln = fb.start; ln <= fb.end; ln++) {
      const existing = map.get(ln);
      const existingRank = existing ? (CONFIDENCE_RANK[existing.confidence] ?? 1) : 0;
      if (newRank > existingRank) {
        map.set(ln, { blockId: fb.block_id, confidence: block.confidence });
      }
    }
  }
  return map;
}

/**
 * Strip all comments from source code (Java, C, C++, Python).
 * Returns an array of { ln, text } where ln is the original 1-based line
 * number so that block-highlight lookups still work correctly.
 */
function stripComments(source: string, fileName: string): { ln: number; text: string }[] {
  const ext = fileName.includes(".") ? fileName.substring(fileName.lastIndexOf(".")) : "";
  const rawLines = source.split("\n");
  const result: { ln: number; text: string }[] = [];
  let inBlock = false;

  for (let i = 0; i < rawLines.length; i++) {
    let line = rawLines[i];

    // ── Inside a block comment ────────────────────────────────────────
    if (inBlock) {
      const end = line.indexOf("*/");
      if (end !== -1) {
        inBlock = false;
        const after = line.substring(end + 2);
        if (after.trim()) {
          result.push({ ln: i + 1, text: after });
        }
      }
      continue;
    }

    // ── Block comment start (/* or /**) ───────────────────────────────
    if ([".java", ".c", ".cpp", ".cc", ".h", ".hpp"].includes(ext)) {
      const blockIdx = findOutsideString(line, "/*");
      if (blockIdx !== -1) {
        const before = line.substring(0, blockIdx).trimEnd();
        const endIdx = line.indexOf("*/", blockIdx + 2);
        if (endIdx !== -1) {
          // Single-line block comment: code /* ... */ more
          const after = line.substring(endIdx + 2);
          const combined = (before + " " + after).trimEnd();
          if (combined.trim()) result.push({ ln: i + 1, text: combined });
        } else {
          inBlock = true;
          if (before.trim()) result.push({ ln: i + 1, text: before });
        }
        continue;
      }

      // Single-line // comment
      const slashIdx = findOutsideString(line, "//");
      if (slashIdx !== -1) {
        const before = line.substring(0, slashIdx).trimEnd();
        if (!before.trim()) continue; // entire line is comment
        line = before;
      }
    }

    // ── Python # comment ──────────────────────────────────────────────
    if (ext === ".py") {
      const hashIdx = findOutsideString(line, "#");
      if (hashIdx !== -1) {
        const before = line.substring(0, hashIdx).trimEnd();
        if (!before.trim()) continue;
        line = before;
      }
    }

    result.push({ ln: i + 1, text: line });
  }

  return result;
}

/** Find `needle` in `line` only if it's not inside a string literal. */
function findOutsideString(line: string, needle: string): number {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i <= line.length - needle.length; i++) {
    const ch = line[i];
    if (ch === '"' && !inSingle && (i === 0 || line[i - 1] !== "\\")) inDouble = !inDouble;
    if (ch === "'" && !inDouble && (i === 0 || line[i - 1] !== "\\")) inSingle = !inSingle;
    if (!inSingle && !inDouble && line.substring(i, i + needle.length) === needle) return i;
  }
  return -1;
}

const CONF_COLOR: Record<string, string> = {
  HIGH:   "#ff4f4f",
  MEDIUM: "#f5c542",
  LOW:    "#5b8dee",
  FILE:   "#ff4f4f",
};

function BlockTooltip({ block, x, y, pairCount }: { block: MatchBlock; x: number; y: number; pairCount: number }) {
  const color = CONF_COLOR[block.confidence] ?? CONF_COLOR.LOW;
  const densityPct = Math.round(block.density * 100);
  const lenA = block.block_length_a ?? block.block_length ?? (block.end_a - block.start_a + 1);
  const lenB = block.block_length_b ?? block.block_length ?? (block.end_b - block.start_b + 1);
  const left = Math.min(x + 14, window.innerWidth - 230);
  const top  = y - 8;

  return (
    <div
      style={{
        position: "fixed", left, top, zIndex: 9999, pointerEvents: "none",
        background: "#13161e", border: `1px solid ${color}40`, borderRadius: 8,
        padding: "8px 12px", minWidth: 190,
        boxShadow: `0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px ${color}20`,
        fontFamily: "var(--font-geist-sans, sans-serif)", fontSize: 11,
        color: "#e8eaf0", lineHeight: 1.7,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
        <span style={{ background: color, borderRadius: 3, padding: "1px 7px", fontWeight: 700, fontSize: 10, letterSpacing: "0.08em", color: block.confidence === "MEDIUM" ? "#000" : "#fff" }}>
          {block.confidence}
        </span>
        <span style={{ color: "#6b7280", fontSize: 10 }}>Block #{block.block_id}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "1px 10px" }}>
        <span style={{ color: "#6b7280" }}>Density</span>
        <span style={{ fontWeight: 600, color }}>{densityPct}%</span>
        <span style={{ color: "#6b7280" }}>Lines A</span>
        <span style={{ fontWeight: 600 }}>{lenA} <span style={{ color: "#6b7280", fontWeight: 400 }}>(L{block.start_a}–{block.end_a})</span></span>
        <span style={{ color: "#6b7280" }}>Lines B</span>
        <span style={{ fontWeight: 600 }}>{lenB} <span style={{ color: "#6b7280", fontWeight: 400 }}>(L{block.start_b}–{block.end_b})</span></span>
        <span style={{ color: "#6b7280" }}>In class</span>
        <span style={{ fontWeight: 600, color: pairCount > 1 ? "#f5c542" : "#e8eaf0" }}>
          {pairCount === 0 ? "unique to this pair" : `${pairCount} other pair${pairCount > 1 ? "s" : ""}`}
        </span>
      </div>
    </div>
  );
}

function Panel({
  studentName,
  fileName,
  source,
  lineMap,
  focusedLines,
  onLineClick,
  bodyRef,
  blockMap,
  blockFrequency,
}: {
  studentName: string;
  fileName: string;
  source: string;
  lineMap: Map<number, { blockId: number; confidence: string }>;
  focusedLines: Set<number>;
  onLineClick: (blockId: number) => void;
  bodyRef: React.RefObject<HTMLDivElement | null>;
  blockMap: Map<number, MatchBlock>;
  blockFrequency: Map<number, number>;
}) {
  const codeLines = React.useMemo(() => stripComments(source, fileName), [source, fileName]);
  const [tooltip, setTooltip] = React.useState<{ blockId: number; x: number; y: number } | null>(null);

  const tooltipBlock = tooltip ? blockMap.get(tooltip.blockId) : null;
  const tooltipPairCount = tooltip ? (blockFrequency.get(tooltip.blockId) ?? 0) : 0;

  return (
    <div className="flex-1 min-w-0 flex flex-col border rounded-lg overflow-hidden" style={{ minHeight: 0 }}>
      <div className="px-3 py-1.5 bg-muted/50 border-b text-xs flex items-center gap-2 font-jb">
        <span className={`font-semibold uppercase tracking-wider ${studentName.startsWith("Ref ") ? "text-emerald-500" : "text-red-400"}`}>{studentName}</span>
      </div>
      <div ref={bodyRef} className="overflow-auto flex-1">
        <table className="font-jb text-[12px] leading-[18px] w-full border-collapse">
          <tbody>
            {codeLines.map(({ ln, text }) => {
              const info = lineMap.get(ln);
              const focused = focusedLines.has(ln);

              if (!info) {
                return (
                  <tr key={ln} data-focused={focused ? "true" : undefined}>
                    <td className="text-right pr-2 text-primary/20 select-none text-[11px] w-10">{ln}</td>
                    <td className="px-2 whitespace-pre">{text || " "}</td>
                  </tr>
                );
              }

              return (
                <tr
                  key={ln}
                  data-block={info.blockId}
                  data-focused={focused ? "true" : undefined}
                  style={getLineStyle(info.confidence, focused)}
                  onClick={() => onLineClick(info.blockId)}
                  onMouseEnter={(e) => { if (focused) setTooltip({ blockId: info.blockId, x: e.clientX, y: e.clientY }); }}
                  onMouseMove={(e) => { if (focused) setTooltip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : null); }}
                  onMouseLeave={() => setTooltip(null)}
                >
                  <td className="text-right pr-2 text-primary/30 select-none text-[11px] w-10">{ln}</td>
                  <td className="px-2 whitespace-pre">{text || " "}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {tooltipBlock && tooltip && <BlockTooltip block={tooltipBlock} x={tooltip.x} y={tooltip.y} pairCount={tooltipPairCount} />}
    </div>
  );
}

export function CodeDiffViewer({
  pair,
  activeFile,
  activeFileB,
  activeBlockIds,
  blockFrequency,
  focusedBlockId,
  onBlockClick,
}: CodeDiffViewerProps) {
  const leftRef = React.useRef<HTMLDivElement>(null);
  const rightRef = React.useRef<HTMLDivElement>(null);

  const lm1 = React.useMemo(() => buildLineMap(pair, pair.student_1, activeFile, activeBlockIds), [pair, activeFile, activeBlockIds]);
  const lm2 = React.useMemo(() => buildLineMap(pair, pair.student_2, activeFileB, activeBlockIds), [pair, activeFileB, activeBlockIds]);

  const blockMap = React.useMemo(() => new Map(pair.blocks.map((b) => [b.block_id, b])), [pair.blocks]);

  const srcA = pair.sources?.[pair.student_1]?.[activeFile] ?? "";
  const srcB = pair.sources?.[pair.student_2]?.[activeFileB] ?? "";

  // Build focused line sets from the block's direct line ranges.
  const focusedLinesA = React.useMemo(() => {
    const s = new Set<number>();
    if (focusedBlockId == null) return s;
    const block = pair.blocks.find((b) => b.block_id === focusedBlockId);
    if (block) for (let ln = block.start_a; ln <= block.end_a; ln++) s.add(ln);
    return s;
  }, [pair, focusedBlockId]);

  const focusedLinesB = React.useMemo(() => {
    const s = new Set<number>();
    if (focusedBlockId == null) return s;
    const block = pair.blocks.find((b) => b.block_id === focusedBlockId);
    if (block) for (let ln = block.start_b; ln <= block.end_b; ln++) s.add(ln);
    return s;
  }, [pair, focusedBlockId]);

  // Pre-compute stripped line lists so the scroll effect can calculate positions
  // without DOM measurement — each row is exactly 18 px tall (leading-[18px]).
  const codeLinesA = React.useMemo(() => stripComments(srcA, activeFile), [srcA, activeFile]);
  const codeLinesB = React.useMemo(() => stripComments(srcB, activeFileB), [srcB, activeFileB]);

  const LINE_HEIGHT = 18;

  React.useEffect(() => {
    if (focusedBlockId == null) return;
    const raf = requestAnimationFrame(() => {
      if (leftRef.current && focusedLinesA.size > 0) {
        const idx = codeLinesA.findIndex(({ ln }) => focusedLinesA.has(ln));
        if (idx !== -1) {
          leftRef.current.scrollTop = Math.max(0, idx * LINE_HEIGHT - leftRef.current.clientHeight * 0.3);
        }
      }
      if (rightRef.current && focusedLinesB.size > 0) {
        const idx = codeLinesB.findIndex(({ ln }) => focusedLinesB.has(ln));
        if (idx !== -1) {
          rightRef.current.scrollTop = Math.max(0, idx * LINE_HEIGHT - rightRef.current.clientHeight * 0.3);
        }
      }
    });
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedBlockId]);

  const handleClick = React.useCallback(
    (blockId: number) => {
      onBlockClick(blockId);
    },
    [onBlockClick],
  );

  return (
    <div className="flex flex-col md:flex-row gap-1 w-full h-full">
      <Panel studentName={pair.student_1} fileName={activeFile} source={srcA} lineMap={lm1} focusedLines={focusedLinesA} onLineClick={handleClick} bodyRef={leftRef} blockMap={blockMap} blockFrequency={blockFrequency} />
      <Panel studentName={pair.student_2} fileName={activeFileB} source={srcB} lineMap={lm2} focusedLines={focusedLinesB} onLineClick={handleClick} bodyRef={rightRef} blockMap={blockMap} blockFrequency={blockFrequency} />
    </div>
  );
}
