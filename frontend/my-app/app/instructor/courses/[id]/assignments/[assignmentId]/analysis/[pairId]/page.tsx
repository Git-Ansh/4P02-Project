"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Eye } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { CodeDiffViewer } from "@/components/analysis/code-diff-viewer";
import { SeverityBadge, getSeverityLevel, getSeverityColor } from "@/components/analysis/severity-badge";
import type { AnalysisPair } from "@/lib/types/analysis";

interface CourseInfo { id: string; code: string }
interface AssignmentInfo { id: string; title: string }

function cleanName(p: string) {
  return p.replace(/\\/g, "/").split("/").pop() || p;
}

export default function PairDetailPage() {
  const params = useParams();
  const courseId = params.id as string;
  const assignmentId = params.assignmentId as string;
  const pairId = params.pairId as string;

  const [course, setCourse] = React.useState<CourseInfo | null>(null);
  const [pair, setPair] = React.useState<AnalysisPair | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const [activeFile, setActiveFile] = React.useState("");
  const [focusedBlockId, setFocusedBlockId] = React.useState<number | null>(null);

  // Reveal
  const [revealOpen, setRevealOpen] = React.useState(false);
  const [justification, setJustification] = React.useState("");
  const [revealSubmitting, setRevealSubmitting] = React.useState(false);
  const [revealResult, setRevealResult] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function load() {
      try {
        const [c, pairData] = await Promise.all([
          apiFetch<CourseInfo>(`/api/instructor/courses/${courseId}`),
          apiFetch<AnalysisPair>(
            `/api/instructor/courses/${courseId}/assignments/${assignmentId}/analysis/${pairId}`,
          ),
        ]);
        setCourse(c);
        setPair(pairData);

        // Default file tab: first file from student_1 sources
        const files = Object.keys(pairData.sources?.[pairData.student_1] ?? {});
        if (files.length > 0) setActiveFile(files[0]);
      } catch (err) {
        setError("Failed to load pair data");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [courseId, assignmentId, pairId]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !pair) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Card className="border-destructive/30">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-destructive">{error || "Pair not found"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // File tabs — from student_1's sources (like the codesim viewer)
  const s1Src = pair.sources?.[pair.student_1] ?? {};
  const fileList = Object.keys(s1Src);

  // Block count per file (from pair.files for student_1)
  const s1Files = pair.files?.[pair.student_1] ?? {};

  // Blocks in current file for navigation
  const fileBlocks = (s1Files[activeFile] ?? []) as Array<{ block_id: number; start: number; end: number }>;
  const currentBlocks = fileBlocks
    .map((fb) => pair.blocks.find((b) => b.block_id === fb.block_id))
    .filter((b): b is NonNullable<typeof b> => b != null);

  // Current focused block index (1-based)
  const focusedIdx = focusedBlockId != null
    ? currentBlocks.findIndex((b) => b.block_id === focusedBlockId) + 1
    : 0;

  const handleBlockClick = (blockId: number) => {
    setFocusedBlockId(blockId);
  };

  const navigateBlock = (dir: "prev" | "next") => {
    const idx = dir === "prev" ? focusedIdx - 1 : focusedIdx + 1;
    if (idx < 1 || idx > currentBlocks.length) return;
    setFocusedBlockId(currentBlocks[idx - 1].block_id);
  };

  const handleRevealRequest = async () => {
    if (!justification.trim()) return;
    setRevealSubmitting(true);
    try {
      const res = await apiFetch<{ message: string }>(
        `/api/instructor/courses/${courseId}/assignments/${assignmentId}/analysis/reveal-request`,
        {
          method: "POST",
          body: JSON.stringify({ pair_id: pair.pair_id, justification: justification.trim() }),
        },
      );
      setRevealResult(res.message);
      setJustification("");
    } catch (err) {
      setRevealResult(err instanceof Error ? err.message : "Request failed");
    } finally {
      setRevealSubmitting(false);
    }
  };

  const focusedBlock = focusedIdx > 0 ? currentBlocks[focusedIdx - 1] : null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-2">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        <Link href="/instructor/courses" className="hover:text-foreground">Courses</Link>
        <span>/</span>
        <Link href={`/instructor/courses/${courseId}`} className="hover:text-foreground">{course?.code ?? "..."}</Link>
        <span>/</span>
        <Link href={`/instructor/courses/${courseId}/assignments/${assignmentId}/analysis`} className="hover:text-foreground">Analysis</Link>
        <span>/</span>
        <span className="text-foreground font-medium">{pair.student_1} vs {pair.student_2}</span>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-3 flex-wrap rounded-xl border bg-muted/30 px-4 py-2 text-sm">
        <span className="font-semibold">{pair.student_1}</span>
        <span className="text-muted-foreground text-xs">vs</span>
        <span className="font-semibold">{pair.student_2}</span>
        <span className="w-px h-4 bg-border" />
        <span className={`font-bold tabular-nums ${getSeverityColor(pair.similarity)}`}>
          {Math.round(pair.similarity * 100)}%
        </span>
        <SeverityBadge level={getSeverityLevel(pair.severity_score)} />
        <span className="text-muted-foreground text-xs">
          {pair.summary.total_blocks} blocks ({pair.summary.high_confidence_blocks} high)
        </span>
        <span className="ml-auto" />
        <Dialog open={revealOpen} onOpenChange={setRevealOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              <Eye className="mr-1.5 h-3 w-3" />
              Reveal Identity
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Identity Reveal</DialogTitle>
              <DialogDescription>
                Provide justification for revealing the identities of {pair.student_1} and {pair.student_2}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {revealResult ? (
                <div className="rounded-lg border bg-muted/50 p-4">
                  <p className="text-sm">{revealResult}</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => { setRevealResult(null); setRevealOpen(false); }}>Close</Button>
                </div>
              ) : (
                <>
                  <Textarea placeholder="Describe evidence and justification..." value={justification} onChange={(e) => setJustification(e.target.value)} rows={4} />
                  <Button onClick={handleRevealRequest} disabled={revealSubmitting || !justification.trim()} className="w-full">
                    {revealSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
                    Submit Request
                  </Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* File tabs + block nav */}
      <div className="flex items-center gap-2 flex-wrap rounded-lg border px-3 py-1.5 bg-muted/20 text-xs">
        {fileList.map((fname) => {
          const count = ((s1Files[fname] ?? []) as unknown[]).length;
          return (
            <button
              key={fname}
              className={`rounded px-2 py-1 whitespace-nowrap transition-colors ${
                activeFile === fname
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              onClick={() => { setActiveFile(fname); setFocusedBlockId(null); }}
            >
              {cleanName(fname)} ({count})
            </button>
          );
        })}

        {fileList.length > 0 && <span className="w-px h-4 bg-border" />}

        {/* Block navigation */}
        <div className="ml-auto flex items-center gap-2">
          {focusedBlock && (
            <SeverityBadge level={focusedBlock.confidence} />
          )}
          <span className="text-muted-foreground">
            Block {focusedIdx || "–"} of {currentBlocks.length}
          </span>
          <Button variant="outline" size="sm" className="h-6 px-2" disabled={focusedIdx <= 1} onClick={() => navigateBlock("prev")}>
            Prev
          </Button>
          <Button variant="outline" size="sm" className="h-6 px-2" disabled={focusedIdx >= currentBlocks.length} onClick={() => navigateBlock("next")}>
            Next
          </Button>
        </div>
      </div>

      {/* Code diff viewer */}
      {activeFile && (
        <CodeDiffViewer
          pair={pair}
          activeFile={activeFile}
          focusedBlockId={focusedBlockId}
          onBlockClick={handleBlockClick}
        />
      )}

      {/* Block info */}
      {focusedBlock && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground px-1">
          <SeverityBadge level={focusedBlock.confidence} />
          <span>Density {Math.round(focusedBlock.density * 100)}%</span>
          <span>L{focusedBlock.start_a}{"\u2013"}{focusedBlock.end_a} / L{focusedBlock.start_b}{"\u2013"}{focusedBlock.end_b}</span>
          <span>{focusedBlock.block_length} lines</span>
        </div>
      )}
    </div>
  );
}
