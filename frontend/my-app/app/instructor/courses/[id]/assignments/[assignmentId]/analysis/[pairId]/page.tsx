"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Eye } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { BlockNavigator } from "@/components/analysis/block-navigator";
import { SeverityBadge, getSeverityLevel, getSeverityColor } from "@/components/analysis/severity-badge";
import type { AnalysisPair, MatchBlock } from "@/lib/types/analysis";

interface CourseInfo {
  id: string;
  code: string;
}

interface AssignmentInfo {
  id: string;
  title: string;
}

export default function PairDetailPage() {
  const params = useParams();
  const courseId = params.id as string;
  const assignmentId = params.assignmentId as string;
  const pairId = params.pairId as string;

  const [course, setCourse] = React.useState<CourseInfo | null>(null);
  const [assignment, setAssignment] = React.useState<AssignmentInfo | null>(null);
  const [pair, setPair] = React.useState<AnalysisPair | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  // Controls
  const [selectedFile, setSelectedFile] = React.useState<string>("");
  const [confidenceFilter, setConfidenceFilter] = React.useState<Set<string>>(
    new Set(["HIGH", "MEDIUM", "LOW"]),
  );
  const [focusedBlock, setFocusedBlock] = React.useState<number>(1);

  // Reveal request
  const [revealOpen, setRevealOpen] = React.useState(false);
  const [justification, setJustification] = React.useState("");
  const [revealSubmitting, setRevealSubmitting] = React.useState(false);
  const [revealResult, setRevealResult] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function load() {
      try {
        const [c, assignments, pairData] = await Promise.all([
          apiFetch<CourseInfo>(`/api/instructor/courses/${courseId}`),
          apiFetch<AssignmentInfo[]>(`/api/instructor/courses/${courseId}/assignments`),
          apiFetch<AnalysisPair>(
            `/api/instructor/courses/${courseId}/assignments/${assignmentId}/analysis/${pairId}`,
          ),
        ]);
        setCourse(c);
        const a = assignments.find((x) => x.id === assignmentId);
        if (a) setAssignment(a);
        setPair(pairData);

        // Select default file (file with most blocks)
        if (pairData.blocks.length > 0) {
          const fileCounts = new Map<string, number>();
          for (const b of pairData.blocks) {
            const key = `${b.file_a}|${b.file_b}`;
            fileCounts.set(key, (fileCounts.get(key) || 0) + 1);
          }
          let maxKey = "";
          let maxCount = 0;
          for (const [key, count] of fileCounts) {
            if (count > maxCount) {
              maxKey = key;
              maxCount = count;
            }
          }
          setSelectedFile(maxKey);
        }
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
            <p className="text-sm font-medium text-destructive">
              {error || "Pair not found"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Build file options
  const fileOptions = new Map<string, { fileA: string; fileB: string; blockCount: number }>();
  for (const b of pair.blocks) {
    const key = `${b.file_a}|${b.file_b}`;
    const existing = fileOptions.get(key);
    if (existing) {
      existing.blockCount++;
    } else {
      fileOptions.set(key, { fileA: b.file_a, fileB: b.file_b, blockCount: 1 });
    }
  }

  const [selectedFileA, selectedFileB] = selectedFile.split("|");

  // Filter blocks for current file and confidence
  const currentBlocks = pair.blocks.filter((b) => {
    const matchesFile =
      !selectedFile || (b.file_a === selectedFileA && b.file_b === selectedFileB);
    return matchesFile && confidenceFilter.has(b.confidence);
  });

  // Get source code
  const sourceA = pair.sources?.[pair.student_1]?.[selectedFileA] ?? "// No source available";
  const sourceB = pair.sources?.[pair.student_2]?.[selectedFileB] ?? "// No source available";

  // Block navigation
  const totalBlocks = currentBlocks.length;
  const currentBlockData = currentBlocks[focusedBlock - 1];

  const toggleConfidence = (level: string) => {
    const next = new Set(confidenceFilter);
    if (next.has(level)) {
      next.delete(level);
    } else {
      next.add(level);
    }
    setConfidenceFilter(next);
    setFocusedBlock(1);
  };

  const handleFileChange = (value: string) => {
    setSelectedFile(value);
    setFocusedBlock(1);
  };

  const navigateBlock = (direction: "prev" | "next") => {
    const newBlock = direction === "prev" ? focusedBlock - 1 : focusedBlock + 1;
    if (newBlock < 1 || newBlock > totalBlocks) return;

    const targetBlock = currentBlocks[newBlock - 1];
    if (!targetBlock) return;

    // Check if block is in a different file
    const blockFileKey = `${targetBlock.file_a}|${targetBlock.file_b}`;
    if (blockFileKey !== selectedFile) {
      setSelectedFile(blockFileKey);
    }

    setFocusedBlock(newBlock);

    // Scroll to block
    setTimeout(() => {
      const el = document.querySelector(`[data-block-id="${targetBlock.block_id}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
  };

  const handleRevealRequest = async () => {
    if (!justification.trim()) return;
    setRevealSubmitting(true);
    try {
      const res = await apiFetch<{ message: string }>(
        `/api/instructor/courses/${courseId}/assignments/${assignmentId}/analysis/reveal-request`,
        {
          method: "POST",
          body: JSON.stringify({
            pair_id: pair.pair_id,
            justification: justification.trim(),
          }),
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

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        <Link href="/instructor/courses" className="hover:text-foreground">
          Courses
        </Link>
        <span>/</span>
        <Link href={`/instructor/courses/${courseId}`} className="hover:text-foreground">
          {course?.code ?? "..."}
        </Link>
        <span>/</span>
        <Link
          href={`/instructor/courses/${courseId}/assignments/${assignmentId}/analysis`}
          className="hover:text-foreground"
        >
          Analysis
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">
          {pair.student_1} vs {pair.student_2}
        </span>
      </div>

      {/* Summary header */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Card className="rounded-xl">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Student A</p>
            <p className="font-bold">{pair.student_1}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Student B</p>
            <p className="font-bold">{pair.student_2}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Similarity</p>
            <p className={`text-xl font-bold ${getSeverityColor(pair.similarity)}`}>
              {Math.round(pair.similarity * 100)}%
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Severity</p>
            <p className="font-bold">{pair.severity_score.toFixed(2)}</p>
            <SeverityBadge level={getSeverityLevel(pair.severity_score)} className="mt-1" />
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Blocks</p>
            <p className="font-bold">
              {pair.summary.total_blocks}
              <span className="text-xs text-muted-foreground ml-1">
                ({pair.summary.high_confidence_blocks} HIGH)
              </span>
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Avg Density</p>
            <p className="font-bold">
              {Math.round(pair.summary.average_density * 100)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Identity reveal request */}
      <Card className="rounded-xl border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Student identities are anonymous</p>
            <p className="text-xs text-muted-foreground">
              To reveal the real identities of these students, submit a request with evidence to your university administrator.
            </p>
          </div>
          <Dialog open={revealOpen} onOpenChange={setRevealOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Eye className="mr-2 h-4 w-4" />
                Request Identity Reveal
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request Identity Reveal</DialogTitle>
                <DialogDescription>
                  Provide justification for why you need to reveal the real identities of{" "}
                  {pair.student_1} and {pair.student_2}. This request will be reviewed by your
                  university administrator.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {revealResult ? (
                  <div className="rounded-lg border bg-muted/50 p-4">
                    <p className="text-sm">{revealResult}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => {
                        setRevealResult(null);
                        setRevealOpen(false);
                      }}
                    >
                      Close
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="rounded-lg border p-3 text-sm">
                      <p className="text-muted-foreground">Pair: <strong>{pair.student_1} vs {pair.student_2}</strong></p>
                      <p className="text-muted-foreground">Similarity: <strong>{Math.round(pair.similarity * 100)}%</strong></p>
                      <p className="text-muted-foreground">Severity: <strong>{pair.severity_score.toFixed(2)}</strong></p>
                    </div>
                    <Textarea
                      placeholder="Describe the evidence of plagiarism and why identity reveal is needed..."
                      value={justification}
                      onChange={(e) => setJustification(e.target.value)}
                      rows={4}
                    />
                    <Button
                      onClick={handleRevealRequest}
                      disabled={revealSubmitting || !justification.trim()}
                      className="w-full"
                    >
                      {revealSubmitting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Eye className="mr-2 h-4 w-4" />
                      )}
                      Submit Request
                    </Button>
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border p-3 bg-muted/30">
        {/* File selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">File:</span>
          <Select value={selectedFile} onValueChange={handleFileChange}>
            <SelectTrigger className="w-[250px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from(fileOptions.entries()).map(([key, val]) => (
                <SelectItem key={key} value={key}>
                  {val.fileA} ({val.blockCount} block{val.blockCount !== 1 ? "s" : ""})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Confidence filter */}
        <div className="flex items-center gap-1">
          {(["HIGH", "MEDIUM", "LOW"] as const).map((level) => {
            const active = confidenceFilter.has(level);
            const colors = {
              HIGH: active ? "bg-red-500/20 text-red-600 border-red-500/40" : "bg-muted text-muted-foreground",
              MEDIUM: active ? "bg-orange-500/20 text-orange-600 border-orange-500/40" : "bg-muted text-muted-foreground",
              LOW: active ? "bg-yellow-500/20 text-yellow-600 border-yellow-500/40" : "bg-muted text-muted-foreground",
            };
            return (
              <button
                key={level}
                onClick={() => toggleConfidence(level)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${colors[level]}`}
              >
                {level}
              </button>
            );
          })}
        </div>

        {/* Block navigation */}
        <div className="ml-auto">
          <BlockNavigator
            currentBlock={focusedBlock}
            totalBlocks={totalBlocks}
            currentConfidence={currentBlockData?.confidence}
            onPrev={() => navigateBlock("prev")}
            onNext={() => navigateBlock("next")}
          />
        </div>
      </div>

      {/* Code diff viewer */}
      {selectedFile && (
        <CodeDiffViewer
          studentA={pair.student_1}
          studentB={pair.student_2}
          fileA={selectedFileA}
          fileB={selectedFileB}
          sourceA={sourceA}
          sourceB={sourceB}
          blocks={pair.blocks}
          confidenceFilter={confidenceFilter}
          focusedBlockId={currentBlockData?.block_id ?? null}
        />
      )}

      {/* Block detail panel */}
      {currentBlockData && (
        <Card className="rounded-xl">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="font-medium">Block {currentBlockData.block_id}</span>
              <SeverityBadge level={currentBlockData.confidence} />
              <span className="text-muted-foreground">
                Density: {Math.round(currentBlockData.density * 100)}%
              </span>
              <span className="text-muted-foreground">
                Lines: {currentBlockData.start_a}&ndash;{currentBlockData.end_a} / {currentBlockData.start_b}&ndash;{currentBlockData.end_b}
              </span>
              <span className="text-muted-foreground">
                Length: {currentBlockData.block_length} lines
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
