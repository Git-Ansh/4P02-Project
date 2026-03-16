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
import type { AnalysisPair } from "@/lib/types/analysis";

interface CodeDiffViewerProps {
  pair: AnalysisPair;
  activeFile: string;
  focusedBlockId: number | null;
  onBlockClick: (blockId: number) => void;
}

function getLineStyle(confidence: string, focused: boolean) {
  const styles: Record<string, { bg: string; bgF: string; border: string }> = {
    HIGH:   { bg: "rgba(255,79,79,0.15)",  bgF: "rgba(255,79,79,0.35)",  border: "#ff4f4f" },
    MEDIUM: { bg: "rgba(245,197,66,0.12)", bgF: "rgba(245,197,66,0.30)", border: "#f5c542" },
    LOW:    { bg: "rgba(91,141,238,0.10)", bgF: "rgba(91,141,238,0.28)", border: "#5b8dee" },
    FILE:   { bg: "rgba(62,207,142,0.12)", bgF: "rgba(62,207,142,0.30)", border: "#3ecf8e" },
  };
  const s = styles[confidence] ?? styles.LOW;
  return {
    background: focused ? s.bgF : s.bg,
    borderLeft: `3px solid ${focused ? s.border : s.border + "50"}`,
    cursor: "pointer",
  };
}

function buildLineMap(
  pair: AnalysisPair,
  studentName: string,
  fileName: string,
): Map<number, { blockId: number; confidence: string }> {
  const map = new Map<number, { blockId: number; confidence: string }>();
  const fileBlocks = pair.files?.[studentName]?.[fileName];
  if (!fileBlocks) return map;

  for (const fb of fileBlocks) {
    const block = pair.blocks.find((b) => b.block_id === fb.block_id);
    if (!block) continue;
    for (let ln = fb.start; ln <= fb.end; ln++) {
      map.set(ln, { blockId: fb.block_id, confidence: block.confidence });
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

function Panel({
  studentName,
  fileName,
  source,
  lineMap,
  focusedBlockId,
  onLineClick,
  bodyRef,
}: {
  studentName: string;
  fileName: string;
  source: string;
  lineMap: Map<number, { blockId: number; confidence: string }>;
  focusedBlockId: number | null;
  onLineClick: (blockId: number) => void;
  bodyRef: React.RefObject<HTMLDivElement | null>;
}) {
  const codeLines = React.useMemo(() => stripComments(source, fileName), [source, fileName]);
  const shortName = fileName.replace(/\\/g, "/").split("/").pop() || fileName;

  return (
    <div className="flex-1 min-w-0 flex flex-col border rounded-lg overflow-hidden">
      <div className="px-3 py-1.5 bg-muted/50 border-b text-xs flex items-center gap-2">
        <span className="font-semibold">{studentName}</span>
        <span className="text-primary">{shortName}</span>
      </div>
      <div ref={bodyRef} className="overflow-auto flex-1" style={{ maxHeight: "calc(100vh - 180px)" }}>
        <table className="font-mono text-[12px] leading-[18px] w-full border-collapse">
          <tbody>
            {codeLines.map(({ ln, text }) => {
              const info = lineMap.get(ln);
              const focused = info != null && info.blockId === focusedBlockId;

              if (!info) {
                return (
                  <tr key={ln}>
                    <td className="text-right pr-2 text-muted-foreground/30 select-none text-[11px] w-10">{ln}</td>
                    <td className="px-2 whitespace-pre">{text || " "}</td>
                  </tr>
                );
              }

              return (
                <tr
                  key={ln}
                  data-block={info.blockId}
                  style={getLineStyle(info.confidence, focused)}
                  onClick={() => onLineClick(info.blockId)}
                >
                  <td className="text-right pr-2 text-muted-foreground/40 select-none text-[11px] w-10">{ln}</td>
                  <td className="px-2 whitespace-pre">{text || " "}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CodeDiffViewer({
  pair,
  activeFile,
  focusedBlockId,
  onBlockClick,
}: CodeDiffViewerProps) {
  const leftRef = React.useRef<HTMLDivElement>(null);
  const rightRef = React.useRef<HTMLDivElement>(null);

  const lm1 = React.useMemo(() => buildLineMap(pair, pair.student_1, activeFile), [pair, activeFile]);
  const lm2 = React.useMemo(() => buildLineMap(pair, pair.student_2, activeFile), [pair, activeFile]);

  const srcA = pair.sources?.[pair.student_1]?.[activeFile] ?? "";
  const srcB = pair.sources?.[pair.student_2]?.[activeFile] ?? "";

  const handleClick = React.useCallback(
    (blockId: number) => {
      onBlockClick(blockId);

      // Sync-scroll both panels to the clicked block (~20% from top)
      for (const ref of [leftRef, rightRef]) {
        const body = ref.current;
        if (!body) continue;
        const row = body.querySelector(`[data-block="${blockId}"]`) as HTMLElement | null;
        if (!row) continue;
        const bRect = body.getBoundingClientRect();
        const rRect = row.getBoundingClientRect();
        const offset = rRect.top - bRect.top + body.scrollTop - bRect.height * 0.2;
        body.scrollTo({ top: Math.max(0, offset), behavior: "smooth" });
      }
    },
    [onBlockClick],
  );

  return (
    <div className="flex gap-1 w-full">
      <Panel studentName={pair.student_1} fileName={activeFile} source={srcA} lineMap={lm1} focusedBlockId={focusedBlockId} onLineClick={handleClick} bodyRef={leftRef} />
      <Panel studentName={pair.student_2} fileName={activeFile} source={srcB} lineMap={lm2} focusedBlockId={focusedBlockId} onLineClick={handleClick} bodyRef={rightRef} />
    </div>
  );
}
