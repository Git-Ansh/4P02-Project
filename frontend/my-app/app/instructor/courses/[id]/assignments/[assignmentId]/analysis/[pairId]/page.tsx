"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Eye, Hourglass, CheckCircle2, XCircle } from "lucide-react";

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

function getFilePairsFromBlocks(pair: AnalysisPair): Array<{ fileA: string; fileB: string }> {
  const fileBtoA = new Map<string, string>();
  for (const b of pair.blocks) {
    const fa = b.file_a || "";
    const fb = b.file_b || "";
    if (fb && !fileBtoA.has(fb)) fileBtoA.set(fb, fa);
  }
  const s2Files = Object.keys(pair.sources?.[pair.student_2] ?? {});
  const s1Files = Object.keys(pair.sources?.[pair.student_1] ?? {});
  for (const fb of s2Files) {
    if (!fileBtoA.has(fb)) {
      const fa = s1Files.includes(fb) ? fb : (s1Files[0] ?? "");
      fileBtoA.set(fb, fa);
    }
  }
  const result: Array<{ fileA: string; fileB: string }> = [];
  fileBtoA.forEach((fa, fb) => result.push({ fileA: fa, fileB: fb }));
  result.sort((a, b) => {
    const aSame = a.fileA === a.fileB ? 0 : 1;
    const bSame = b.fileA === b.fileB ? 0 : 1;
    if (aSame !== bSame) return aSame - bSame;
    return a.fileB.localeCompare(b.fileB);
  });
  return result;
}

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

  const [activeFilePair, setActiveFilePair] = React.useState<{ fileA: string; fileB: string } | null>(null);
  const [focusedBlockId, setFocusedBlockId] = React.useState<number | null>(null);

  // Reveal
  const [revealOpen, setRevealOpen] = React.useState(false);
  const [justification, setJustification] = React.useState("");
  const [revealSubmitting, setRevealSubmitting] = React.useState(false);
  const [revealResult, setRevealResult] = React.useState<string | null>(null);
  const [revealStatus, setRevealStatus] = React.useState<"none" | "pending" | "approved" | "denied">("none");
  const [realNames, setRealNames] = React.useState<{ s1: string; s1number: string; s1email: string; s2: string; s2number: string; s2email: string } | null>(null);
  const [revealApprovals, setRevealApprovals] = React.useState<Record<string, { s1: string; s2: string }>>({});

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

        const fps = getFilePairsFromBlocks(pairData);
        if (fps.length > 0) setActiveFilePair(fps[0]);

      } catch (err) {
        setError("Failed to load pair data");
        console.error(err);
      }

      // check reveal status + all approvals separately so they never crash the whole page
      try {
        const [status, approvals] = await Promise.all([
          apiFetch<{
            status: string;
            real_student_1?: string; real_student_1_number?: string; real_student_1_email?: string;
            real_student_2?: string; real_student_2_number?: string; real_student_2_email?: string;
          }>(
            `/api/instructor/courses/${courseId}/assignments/${assignmentId}/analysis/reveal-status?pair_id=${pairId}`,
          ),
          apiFetch<Record<string, { s1: string; s2: string }>>(
            `/api/instructor/courses/${courseId}/assignments/${assignmentId}/analysis/reveal-approvals`,
          ),
        ]);
        setRevealStatus(status.status as typeof revealStatus);
        if (status.status === "approved" && status.real_student_1 && status.real_student_2) {
          setRealNames({
            s1: status.real_student_1, s1number: status.real_student_1_number ?? "", s1email: status.real_student_1_email ?? "",
            s2: status.real_student_2, s2number: status.real_student_2_number ?? "", s2email: status.real_student_2_email ?? "",
          });
        }
        setRevealApprovals(approvals);
      } catch {
        // non-critical, just leave status as "none"
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

  // Build file-pair tabs from blocks so cross-filename pairs get their own tab.
  const filePairs = getFilePairsFromBlocks(pair);
  const afp = activeFilePair ?? filePairs[0] ?? { fileA: "", fileB: "" };

  // Blocks for the active tab = intersection of blocks in fileA (student_1) and fileB (student_2).
  const s1FileBlocks = (pair.files?.[pair.student_1]?.[afp.fileA] ?? []) as Array<{ block_id: number; start: number; end: number }>;
  const s2FileBlocks = (pair.files?.[pair.student_2]?.[afp.fileB] ?? []) as Array<{ block_id: number; start: number; end: number }>;
  const s1BlockIds = new Set(s1FileBlocks.map((fb) => fb.block_id));
  const s2BlockIds = new Set(s2FileBlocks.map((fb) => fb.block_id));
  const tabBlockIds = new Set([...s1BlockIds].filter((id) => s2BlockIds.has(id)));
  // Fall back to union when intersection is empty (pure cross-file tab)
  const activeBlockIds = tabBlockIds.size > 0 ? tabBlockIds : new Set([...s1BlockIds, ...s2BlockIds]);
  const currentBlocks = pair.blocks.filter((b) => activeBlockIds.has(b.block_id));

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
    <div className="flex h-[100dvh] overflow-hidden">
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
            {[...allPairs].sort((a, b) => b.similarity - a.similarity).map((p, i) => {
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
                      {revealApprovals[p.pair_id]
                        ? `${revealApprovals[p.pair_id].s1} vs ${revealApprovals[p.pair_id].s2}`
                        : `${p.student_1} vs ${p.student_2}`}
                    </span>
                    <span className={`shrink-0 font-bold tabular-nums font-jb ${getSeverityColor(p.similarity)}`}>
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
        <div className="shrink-0 border-b px-3 sm:px-4 py-2 space-y-1.5">
          {/* Mobile: back link (pairs sidebar is hidden on mobile) */}
          <div className="flex items-center gap-2 lg:hidden text-xs mb-1">
            <Link
              href={`/instructor/courses/${courseId}/assignments/${assignmentId}/analysis`}
              className="text-muted-foreground hover:text-foreground"
            >
              ← Back to Analysis
            </Link>
          </div>
          {/* Summary */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap text-sm">
            {realNames ? (
              <div className="flex flex-col leading-tight">
                <span className="font-semibold">{realNames.s1}</span>
                <span className="text-xs text-muted-foreground">{realNames.s1number}{realNames.s1email ? `, ${realNames.s1email}` : ""}</span>
              </div>
            ) : (
              <span className="font-semibold">{pair.student_1}</span>
            )}
            <span className="text-muted-foreground text-xs">vs</span>
            {realNames ? (
              <div className="flex flex-col leading-tight">
                <span className="font-semibold">{realNames.s2}</span>
                <span className="text-xs text-muted-foreground">{realNames.s2number}{realNames.s2email ? `, ${realNames.s2email}` : ""}</span>
              </div>
            ) : (
              <span className="font-semibold">{pair.student_2}</span>
            )}
            <span className="w-px h-4 bg-border" />
            <span className={`font-bold tabular-nums font-jb ${getSeverityColor(pair.similarity)}`}>
              {Math.round(pair.similarity * 100)}%
            </span>
            <SeverityBadge level={getSeverityLevel(pair.severity_score)} />
            <span className="text-muted-foreground text-xs font-jb tracking-wide">
              {pair.summary.total_blocks} blocks ({pair.summary.high_confidence_blocks} high)
            </span>
            <span className="ml-auto" />
            {revealStatus === "approved" ? (
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Identity Revealed
              </span>
            ) : revealStatus === "denied" ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-red-500 flex items-center gap-1"><XCircle className="h-3.5 w-3.5" /> Declined by Admin</span>
                <Dialog open={revealOpen} onOpenChange={setRevealOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="h-7 text-base bg-red-600 hover:bg-red-700 text-white">
                      <Eye className="mr-1.5 h-6 w-6" />
                      Request Again
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Request Identity Reveal</DialogTitle>
                      <DialogDescription>
                        Your previous request was declined. Provide a stronger justification for revealing the identities of {pair.student_1} and {pair.student_2}.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      {revealResult ? (
                        <div className="rounded-lg border bg-muted/50 p-4">
                          <p className="text-sm">{revealResult}</p>
                          <Button variant="outline" size="sm" className="mt-3" onClick={() => { setRevealResult(null); setRevealOpen(false); setRevealStatus("pending"); }}>Close</Button>
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
            ) : revealStatus === "pending" ? (
              <span className="text-xs font-medium text-amber-500 flex items-center gap-1">
                <Hourglass className="h-3.5 w-3.5" /> Request Pending Admin Approval
              </span>
            ) : (
              <Dialog open={revealOpen} onOpenChange={setRevealOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-7 text-base bg-red-600 hover:bg-red-700 text-white">
                    <Eye className="mr-1.5 h-6 w-6" />
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
                        <Button variant="outline" size="sm" className="mt-3" onClick={() => { setRevealResult(null); setRevealOpen(false); setRevealStatus("pending"); }}>Close</Button>
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
            )}
          </div>

          {/* File tabs + block nav */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap text-xs">
            {filePairs.length > 1 && filePairs.map((fp, idx) => {
              const isCross = fp.fileA !== fp.fileB;
              const isActive = afp.fileA === fp.fileA && afp.fileB === fp.fileB;
              // Count blocks for this tab
              const fpS1Ids = new Set(((pair.files?.[pair.student_1]?.[fp.fileA] ?? []) as Array<{block_id: number}>).map(b => b.block_id));
              const fpS2Ids = new Set(((pair.files?.[pair.student_2]?.[fp.fileB] ?? []) as Array<{block_id: number}>).map(b => b.block_id));
              const fpInter = new Set([...fpS1Ids].filter(id => fpS2Ids.has(id)));
              const fpCount = (fpInter.size > 0 ? fpInter : new Set([...fpS1Ids, ...fpS2Ids])).size;
              return (
                <button
                  key={`${fp.fileA}::${fp.fileB}`}
                  title={isCross ? `${fp.fileA} vs ${fp.fileB}` : fp.fileB}
                  className={`rounded px-2 py-1 whitespace-nowrap transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                  onClick={() => { setActiveFilePair(fp); setFocusedBlockId(null); }}
                >
                  File {idx + 1} ({fpCount}){isCross ? " *" : ""}
                </button>
              );
            })}
            {filePairs.length > 1 && <span className="w-px h-4 bg-border" />}
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
        {afp.fileA && (
          <div className="flex-1 overflow-hidden">
            <CodeDiffViewer
              pair={pair}
              activeFile={afp.fileA}
              activeFileB={afp.fileB}
              activeBlockIds={activeBlockIds}
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
