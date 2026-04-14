"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  Play,
  Upload,
  Trash2,
  Shield,
  FileCode,
  ArrowLeft,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { apiFetch } from "@/lib/api";
import { AnalysisStatsBar } from "@/components/analysis/analysis-stats-bar";
import { PairListPanel } from "@/components/analysis/pair-list-panel";
import type { AnalysisReport, ReferenceSubmission } from "@/lib/types/analysis";

interface CourseInfo {
  id: string;
  code: string;
  title: string;
}

interface AssignmentInfo {
  id: string;
  title: string;
  language: string;
}

export default function AssignmentAnalysisPage() {
  const params = useParams();
  const courseId = params.id as string;
  const assignmentId = params.assignmentId as string;

  const [course, setCourse] = React.useState<CourseInfo | null>(null);
  const [assignment, setAssignment] = React.useState<AssignmentInfo | null>(null);
  const [report, setReport] = React.useState<AnalysisReport | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [running, setRunning] = React.useState(false);
  const [references, setReferences] = React.useState<ReferenceSubmission[]>([]);
  const [refDialogOpen, setRefDialogOpen] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [runError, setRunError] = React.useState("");
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Single threshold state (0-100) — used for both display filtering and engine runs
  const [threshold, setThreshold] = React.useState(15);

  // Boilerplate state
  const [boilerplateFiles, setBoilerplateFiles] = React.useState<{ filename: string; size: number }[]>([]);
  const [boilerplateOpen, setBoilerplateOpen] = React.useState(false);
  const [uploadingBoilerplate, setUploadingBoilerplate] = React.useState(false);
  const [revealApprovals, setRevealApprovals] = React.useState<Record<string, { s1: string; s1number: string; s1email: string; s2: string; s2number: string; s2email: string }>>({});

  const fetchReport = React.useCallback(async () => {
    try {
      const data = await apiFetch<AnalysisReport>(
        `/api/instructor/courses/${courseId}/assignments/${assignmentId}/analysis`,
      );
      setReport(data);
      if (data.status === "running") {
        setRunning(true);
      } else {
        setRunning(false);
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    } catch {
      setReport(null);
      setRunning(false);
    }
  }, [courseId, assignmentId]);

  const fetchReferences = React.useCallback(async () => {
    try {
      const data = await apiFetch<ReferenceSubmission[]>(
        `/api/instructor/courses/${courseId}/assignments/${assignmentId}/references`,
      );
      setReferences(data);
    } catch {
      setReferences([]);
    }
  }, [courseId, assignmentId]);

  const fetchBoilerplate = React.useCallback(async () => {
    try {
      const data = await apiFetch<{ filename: string; size: number }[]>(
        `/api/instructor/courses/${courseId}/assignments/${assignmentId}/template`,
      );
      setBoilerplateFiles(data);
    } catch {
      setBoilerplateFiles([]);
    }
  }, [courseId, assignmentId]);

  React.useEffect(() => {
    async function load() {
      try {
        const [c, assignments] = await Promise.all([
          apiFetch<CourseInfo>(`/api/instructor/courses/${courseId}`),
          apiFetch<AssignmentInfo[]>(`/api/instructor/courses/${courseId}/assignments`),
        ]);
        setCourse(c);
        const a = assignments.find((x) => x.id === assignmentId);
        if (a) setAssignment(a);
      } catch {
        // ignore
      }
      await Promise.all([fetchReport(), fetchReferences(), fetchBoilerplate()]);
      try {
        const approvals = await apiFetch<Record<string, { s1: string; s1number: string; s1email: string; s2: string; s2number: string; s2email: string }>>(
          `/api/instructor/courses/${courseId}/assignments/${assignmentId}/analysis/reveal-approvals`,
        );
        setRevealApprovals(approvals);
      } catch {
        // non-critical
      }
      setLoading(false);
    }
    load();
  }, [courseId, assignmentId, fetchReport, fetchReferences, fetchBoilerplate]);

  React.useEffect(() => {
    if (running && !pollRef.current) {
      pollRef.current = setInterval(fetchReport, 3000);
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [running, fetchReport]);

  const handleRunAnalysis = async () => {
    setRunning(true);
    setRunError("");
    try {
      await apiFetch(
        `/api/instructor/courses/${courseId}/assignments/${assignmentId}/analysis/run`,
        {
          method: "POST",
          body: JSON.stringify({ similarity_threshold: threshold / 100 }),
        },
      );
      await fetchReport();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to start analysis";
      setRunError(msg === "Not Found" ? "Analysis endpoint not available. Please restart the backend server." : msg);
      setRunning(false);
    }
  };

  const handleUploadRef = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await apiFetch(
        `/api/instructor/courses/${courseId}/assignments/${assignmentId}/references`,
        {
          method: "POST",
          body: formData,
          headers: {},
        },
      );
      await fetchReferences();
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDeleteRef = async (refId: string) => {
    try {
      await apiFetch(
        `/api/instructor/courses/${courseId}/assignments/${assignmentId}/references/${refId}`,
        { method: "DELETE" },
      );
      await fetchReferences();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteAll = async () => {
    try {
      await apiFetch(
        `/api/instructor/courses/${courseId}/assignments/${assignmentId}/analysis`,
        { method: "DELETE" },
      );
      setReport(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUploadBoilerplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBoilerplate(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await apiFetch(
        `/api/instructor/courses/${courseId}/assignments/${assignmentId}/template`,
        { method: "POST", body: formData },
      );
      await fetchBoilerplate();
    } catch (err) {
      console.error(err);
    } finally {
      setUploadingBoilerplate(false);
      e.target.value = "";
    }
  };

  const handleDeleteBoilerplate = async (filename: string) => {
    try {
      await apiFetch(
        `/api/instructor/courses/${courseId}/assignments/${assignmentId}/template/${encodeURIComponent(filename)}`,
        { method: "DELETE" },
      );
      await fetchBoilerplate();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const meta = report?.metadata;
  const pairs = report?.pairs ?? [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Back to Assignment List */}
      <Link
        href={`/instructor/courses/${courseId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 sm:mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Assignment List
      </Link>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/instructor/courses" className="hover:text-foreground">
          Courses
        </Link>
        <span>/</span>
        <Link href={`/instructor/courses/${courseId}`} className="hover:text-foreground">
          {course?.code ?? "..."}
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">
          {assignment?.title ?? "..."} — Analysis
        </span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {assignment?.title ?? "Assignment"} Analysis
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {course?.code}
            {report?.completed_at &&
              ` — Last run ${new Date(report.completed_at).toLocaleString()}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleRunAnalysis} disabled={running}>
            {running ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            {running ? "Running..." : "Run Analysis"}
          </Button>
          <Dialog open={refDialogOpen} onOpenChange={setRefDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                References
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reference Submissions</DialogTitle>
                <DialogDescription>
                  Upload previous years&apos; submissions as ZIP for cross-year
                  detection. Reference students appear with _ref_ prefix.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Button variant="outline" size="sm" disabled={uploading} asChild>
                      <span>
                        {uploading ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="mr-1 h-3.5 w-3.5" />
                        )}
                        Upload ZIP
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept=".zip"
                      className="hidden"
                      onChange={handleUploadRef}
                      disabled={uploading}
                    />
                  </label>
                </div>
                {references.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No reference submissions uploaded.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {references.map((ref) => (
                      <div
                        key={ref.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div>
                          <p className="text-sm font-medium">{ref.filename}</p>
                          <p className="text-xs text-muted-foreground">
                            {ref.student_count} students —{" "}
                            {new Date(ref.uploaded_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteRef(ref.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={boilerplateOpen} onOpenChange={setBoilerplateOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <FileCode className="mr-2 h-4 w-4" />
                Boilerplate
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Boilerplate / Template Code</DialogTitle>
                <DialogDescription>
                  Upload starter code files given to students. The engine excludes
                  matching code patterns from similarity scores.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Button variant="outline" size="sm" disabled={uploadingBoilerplate} asChild>
                      <span>
                        {uploadingBoilerplate ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="mr-1 h-3.5 w-3.5" />
                        )}
                        Upload File
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept=".c,.cpp,.cc,.h,.hpp,.java"
                      className="hidden"
                      onChange={handleUploadBoilerplate}
                      disabled={uploadingBoilerplate}
                    />
                  </label>
                  <p className="text-xs text-muted-foreground mt-2">
                    Supported: .c, .cpp, .cc, .h, .hpp, .java
                  </p>
                </div>
                {boilerplateFiles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No boilerplate files uploaded.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {boilerplateFiles.map((f) => (
                      <div
                        key={f.filename}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div>
                          <p className="text-sm font-medium">{f.filename}</p>
                          <p className="text-xs text-muted-foreground">
                            {f.size >= 1024
                              ? `${(f.size / 1024).toFixed(1)} KB`
                              : `${f.size} B`}
                          </p>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteBoilerplate(f.filename)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Running state */}
      {running && (
        <Card className="border-primary/30">
          <CardContent className="flex items-center gap-3 py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="font-medium">Analysis in progress...</span>
            <span className="text-sm text-muted-foreground">
              This may take a moment depending on submission count.
            </span>
          </CardContent>
        </Card>
      )}

      {/* Run error */}
      {runError && (
        <Card className="border-destructive/30">
          <CardContent className="py-4">
            <p className="text-sm font-medium text-destructive">{runError}</p>
          </CardContent>
        </Card>
      )}

      {/* No analysis yet */}
      {!report && !running && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Shield className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>No analysis has been run for this assignment yet.</p>
            <p className="text-sm mt-1">Click &quot;Run Analysis&quot; to start.</p>
          </CardContent>
        </Card>
      )}

      {/* Failed */}
      {report?.status === "failed" && (
        <Card className="border-destructive/30">
          <CardContent className="py-6">
            <p className="text-sm font-medium text-destructive">
              Analysis failed: {report.error || "Unknown error"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {report?.status === "completed" && meta && (
        <>
          <AnalysisStatsBar
            totalStudents={meta.total_students}
            pairsEvaluated={meta.candidate_pairs_evaluated}
            pairsFlagged={pairs.filter((p) => p.similarity >= threshold / 100).length}
            threshold={threshold}
            onThresholdChange={setThreshold}
            clearCount={pairs.filter((p) => p.similarity < threshold / 100).length}
          />

          <PairListPanel
            pairs={pairs}
            threshold={threshold / 100}
            courseId={courseId}
            assignmentId={assignmentId}
            revealApprovals={revealApprovals}
          />

          {references.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Reference Submissions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {references.length} reference set{references.length !== 1 ? "s" : ""}{" "}
                  included · {meta.boilerplate_hashes_filtered} boilerplate hashes filtered
                </p>
              </CardContent>
            </Card>
          )}

        </>
      )}
    </div>
  );
}
