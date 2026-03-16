"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
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
import type { AnalysisPair, AnalysisReport } from "@/lib/types/analysis";

interface CourseInfo { id: string; code: string }

export default function PairDetailPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;
  const assignmentId = params.assignmentId as string;
  const pairId = params.pairId as string;

  const [course, setCourse] = React.useState<CourseInfo | null>(null);
  const [pair, setPair] = React.useState<AnalysisPair | null>(null);
  const [allPairs, setAllPairs] = React.useState<AnalysisPair[]>([]);
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
        const [c, pairData, reportData] = await Promise.all([
          apiFetch<CourseInfo>(`/api/instructor/courses/${courseId}`),
          apiFetch<AnalysisPair>(
            `/api/instructor/courses/${courseId}/assignments/${assignmentId}/analysis/${pairId}`,
          ),
          apiFetch<AnalysisReport>(
            `/api/instructor/courses/${courseId}/assignments/${assignmentId}/analysis`,
          ),
        ]);
        setCourse(c);
        setPair(pairData);
        setAllPairs(reportData.pairs ?? []);

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

  const s1Src = pair.sources?.[pair.student_1] ?? {};
  const fileList = Object.keys(s1Src);
  const s1Files = pair.files?.[pair.student_1] ?? {};

  const fileBlocks = (s1Files[activeFile] ?? []) as Array<{ block_id: number; start: number; end: number }>;
  const currentBlocks = fileBlocks
    .map((fb) => pair.blocks.find((b) => b.block_id === fb.block_id))
    .filter((b): b is NonNullable<typeof b> => b != null);

  const focusedIdx = focusedBlockId != null
    ? currentBlocks.findIndex((b) => b.block_id === focusedBlockId) + 1
    : 0;

  const handleBlockClick = (blockId: number) => setFocusedBlockId(blockId);

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

  const navigatePair = (pid: string) => {
    router.push(`/instructor/courses/${courseId}/assignments/${assignmentId}/analysis/${pid}`);
  };

  return (
    <div className="flex h-[100vh] overflow-hidden">
      {/* ── Pairs sidebar ── */}
      <div className="hidden lg:flex flex-col w-56 shrink-0 border-r bg-muted/20">
        <div className="px-3 py-2 border-b">
          <Link
            href={`/instructor/courses/${courseId}/assignments/${assignmentId}/analysis`}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {"\u2190"} Back to Analysis
          </Link>
          <p className="text-xs font-semibold mt-1">{allPairs.length} Flagged Pairs</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="py-1">
            {allPairs.map((p, i) => {
              const isActive = p.pair_id === pair.pair_id;
              const sim = Math.round(p.similarity * 100);
              return (
                <button
                  key={`${p.pair_id}_${i}`}
                  className={`w-full text-left px-3 py-2 text-xs border-b border-border/50 transition-colors ${
                    isActive
                      ? "bg-primary/10 border-l-2 border-l-primary"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => navigatePair(p.pair_id)}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate font-medium">
                      {p.student_1} vs {p.student_2}
                    </span>
                    <span className={`shrink-0 font-bold tabular-nums ${getSeverityColor(p.similarity)}`}>
                      {sim}%
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {p.summary.total_blocks} blocks · {p.summary.high_confidence_blocks} high
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar: summary + controls */}
        <div className="shrink-0 border-b px-4 py-2 space-y-1.5">
          {/* Summary */}
          <div className="flex items-center gap-3 flex-wrap text-sm">
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
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {fileList.length > 1 && fileList.map((fname) => (
              <button
                key={fname}
                className={`rounded px-2 py-1 whitespace-nowrap transition-colors ${
                  activeFile === fname
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
                onClick={() => { setActiveFile(fname); setFocusedBlockId(null); }}
              >
                File {fileList.indexOf(fname) + 1} ({((s1Files[fname] ?? []) as unknown[]).length})
              </button>
            ))}
            {fileList.length > 1 && <span className="w-px h-4 bg-border" />}
            <div className="ml-auto flex items-center gap-2">
              {focusedBlock && <SeverityBadge level={focusedBlock.confidence} />}
              <span className="text-muted-foreground">
                Block {focusedIdx || "\u2013"} of {currentBlocks.length}
              </span>
              <Button variant="outline" size="sm" className="h-6 px-2" disabled={focusedIdx <= 1} onClick={() => navigateBlock("prev")}>Prev</Button>
              <Button variant="outline" size="sm" className="h-6 px-2" disabled={focusedIdx >= currentBlocks.length} onClick={() => navigateBlock("next")}>Next</Button>
            </div>
          </div>
        </div>

        {/* Code diff viewer — takes all remaining space */}
        {activeFile && (
          <div className="flex-1 overflow-hidden">
            <CodeDiffViewer
              pair={pair}
              activeFile={activeFile}
              focusedBlockId={focusedBlockId}
              onBlockClick={handleBlockClick}
            />
          </div>
        )}

        {/* Block info footer */}
        {focusedBlock && (
          <div className="shrink-0 flex items-center gap-3 text-xs text-muted-foreground px-4 py-1 border-t">
            <SeverityBadge level={focusedBlock.confidence} />
            <span>Density {Math.round(focusedBlock.density * 100)}%</span>
            <span>L{focusedBlock.start_a}{"\u2013"}{focusedBlock.end_a} / L{focusedBlock.start_b}{"\u2013"}{focusedBlock.end_b}</span>
            <span>{focusedBlock.block_length || focusedBlock.block_length_a || ''} lines</span>
          </div>
        )}
      </div>
    </div>
  );
}
