"use client";

import * as React from "react";
import Link from "next/link";
import {
  GraduationCap,
  Loader2,
  ClipboardList,
  AlertTriangle,
  FileText,
  TrendingUp,
  Upload,
  Zap,
  Play,
  Check,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CountUp } from "@/components/count-up";
import { apiFetch } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { StatsCard } from "@/components/analysis/stats-card";
import {
  SeverityBadge,
  SeverityDot,
  getSeverityLevel,
} from "@/components/analysis/severity-badge";
import type {
  InstructorDashboardData,
  FlaggedPair,
  RecentAnalysis,
} from "@/lib/types/analysis";

export default function InstructorDashboard() {
  const [data, setData] = React.useState<InstructorDashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [name, setName] = React.useState("");
  const [severityFilter, setSeverityFilter] = React.useState<
    "ALL" | "HIGH" | "LOW"
  >("ALL");

  // Quick-launch analysis
  const [qlOpen, setQlOpen] = React.useState(false);
  const [qlAssignments, setQlAssignments] = React.useState<{ id: string; title: string; course_id: string; course_code: string }[]>([]);
  const [qlLoading, setQlLoading] = React.useState(false);
  const [qlRunning, setQlRunning] = React.useState<string | null>(null);
  const [qlDone, setQlDone] = React.useState<Set<string>>(new Set());

  const loadAssignments = async () => {
    if (qlAssignments.length > 0) return;
    setQlLoading(true);
    try {
      const courses = await apiFetch<{ id: string; code: string }[]>("/api/instructor/courses");
      const all: typeof qlAssignments = [];
      for (const c of courses) {
        const assignments = await apiFetch<{ id: string; title: string }[]>(`/api/instructor/courses/${c.id}/assignments`);
        for (const a of assignments) {
          all.push({ id: a.id, title: a.title, course_id: c.id, course_code: c.code });
        }
      }
      setQlAssignments(all);
    } catch { /* ignore */ }
    setQlLoading(false);
  };

  const runQuickAnalysis = async (courseId: string, assignmentId: string) => {
    setQlRunning(assignmentId);
    try {
      await apiFetch(
        `/api/instructor/courses/${courseId}/assignments/${assignmentId}/analysis/run`,
        { method: "POST", body: JSON.stringify({ similarity_threshold: 0.15 }) },
      );
      setQlDone(prev => new Set(prev).add(assignmentId));
    } catch { /* ignore */ }
    setQlRunning(null);
  };

  React.useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      // Use first name from full_name if available, otherwise email prefix
      const fullName = user.full_name || "";
      setName(fullName.split(" ")[0] || user.sub.split("@")[0]);
    }

    apiFetch<InstructorDashboardData>("/api/instructor/dashboard")
      .then((d) => {
        setData(d);
        setError("");
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load dashboard data.");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Card className="border-destructive/30">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const flaggedPairs = data.flagged_pairs ?? [];
  const recentAnalyses = data.recent_analyses ?? [];

  const flaggedCount = flaggedPairs.length;
  const highCount = flaggedPairs.filter((p) => p.severity_score >= 0.7).length;
  const medCount = flaggedPairs.filter(
    (p) => p.severity_score >= 0.4 && p.severity_score < 0.7
  ).length;
  const lowCount = flaggedPairs.filter((p) => p.severity_score < 0.4).length;

  const filteredPairs = flaggedPairs.filter((p) => {
    if (p.similarity < 0.3) return false;
    if (severityFilter === "HIGH") return p.similarity >= 0.7;
    if (severityFilter === "LOW") return p.similarity >= 0.4 && p.similarity < 0.7;
    return true;
  });

  // Course health — per-severity counts
  const courseHealth = new Map<
    string,
    {
      code: string;
      id: string;
      high: number;
      med: number;
      low: number;
      total: number;
      totalSubmissions: number;
    }
  >();
  for (const p of flaggedPairs) {
    const existing = courseHealth.get(p.course_id) ?? {
      code: p.course_code,
      id: p.course_id,
      high: 0,
      med: 0,
      low: 0,
      total: 0,
      totalSubmissions: 0,
    };
    if (p.severity_score >= 0.7) existing.high++;
    else if (p.severity_score >= 0.4) existing.med++;
    else existing.low++;
    existing.total++;
    courseHealth.set(p.course_id, existing);
  }

  // Derive course health insights
  const courseHealthInsights = Array.from(courseHealth.values()).map((ch) => {
    const highPairs = flaggedPairs
      .filter((p) => p.course_id === ch.id && p.severity_score >= 0.7)
      .sort((a, b) => b.similarity - a.similarity);
    const medPairs = flaggedPairs
      .filter((p) => p.course_id === ch.id && p.severity_score >= 0.4 && p.severity_score < 0.7)
      .sort((a, b) => b.similarity - a.similarity);
    return { ch, highPairs, medPairs };
  });

  const cleanCourses = data.course_count - courseHealth.size;

  return (
    <div className="space-y-5 p-5 sm:p-6 lg:p-8 hud-grid min-h-full">
      {/* Row 1: Welcome Banner */}
      <div className="-mx-5 sm:-mx-6 lg:-mx-8 -mt-5 sm:-mt-6 lg:-mt-8 px-5 sm:px-6 lg:px-8 py-6 border-b border-border/50" style={{ background: "linear-gradient(180deg, hsl(var(--card) / 0.5) 0%, transparent 100%)" }}>
        <div className="flex items-center gap-4">
          <span className="pulse-dot shrink-0" />
          <div className="flex-1">
            <p className="text-[10px] font-jb uppercase tracking-[0.2em] text-primary/70 mb-1">System Online</p>
            <h1 className="text-2xl font-semibold tracking-tight">
              Welcome back{name ? `, ${name}` : ""}
            </h1>
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => { setQlOpen(!qlOpen); loadAssignments(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-jb uppercase tracking-wider transition-all border border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50"
              >
                <Zap className="h-3 w-3" />
                Quick Run
              </button>
              {qlOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 rounded-lg border bg-card shadow-lg z-50 overflow-hidden">
                  <div className="px-3 py-2 border-b text-[10px] font-jb uppercase tracking-wider text-muted-foreground">
                    Select Assignment
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {qlLoading ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : qlAssignments.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No assignments found</p>
                    ) : (
                      qlAssignments.map(a => (
                        <div key={a.id} className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors border-b border-border/30 last:border-0">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate">{a.title}</p>
                            <p className="text-[10px] text-muted-foreground font-jb">{a.course_code}</p>
                          </div>
                          <button
                            disabled={qlRunning === a.id || qlDone.has(a.id)}
                            onClick={() => runQuickAnalysis(a.course_id, a.id)}
                            className="shrink-0 ml-2 p-1.5 rounded-md transition-all disabled:opacity-50 hover:bg-primary/10 text-primary"
                          >
                            {qlDone.has(a.id) ? (
                              <Check className="h-3.5 w-3.5 text-emerald-500" />
                            ) : qlRunning === a.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Play className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] font-jb text-muted-foreground/50 tracking-wider uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
              {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Stats Cards — 4 columns, Flagged Pairs has severity breakdown */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* My Courses */}
        <Card className="rounded-xl glass glow-hover accent-line card-stagger">
          <CardContent className="pt-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground font-jb">
                  MY COURSES
                </p>
                <p className="mt-2 text-4xl font-bold font-jb neon-num"><CountUp to={data.course_count} /></p>
                {data.course_count === 1 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {/* show first course code if available */}
                    {Array.from(courseHealth.values())[0]?.code ?? ""} — Active
                  </p>
                )}
              </div>
              <div className="rounded-lg bg-primary/10 border border-primary/20 p-2">
                <GraduationCap className="h-4 w-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Assignments */}
        <Card className="rounded-xl glass glow-hover accent-line card-stagger">
          <CardContent className="pt-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground font-jb">
                  ASSIGNMENTS
                </p>
                <p className="mt-2 text-4xl font-bold font-jb neon-num">
                  <CountUp to={data.total_assignments} />
                </p>
                <p className="mt-1 text-xs text-muted-foreground">posted across all courses</p>
              </div>
              <div className="rounded-lg bg-primary/10 border border-primary/20 p-2">
                <ClipboardList className="h-4 w-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submissions */}
        <Card className="rounded-xl glass glow-hover accent-line card-stagger">
          <CardContent className="pt-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground font-jb">
                  SUBMISSIONS
                </p>
                <p className="mt-2 text-4xl font-bold font-jb neon-num">
                  <CountUp to={data.total_submissions} />
                </p>
                <p className="mt-1 text-xs text-muted-foreground">made across all courses</p>
              </div>
              <div className="rounded-lg bg-primary/10 border border-primary/20 p-2">
                <Upload className="h-4 w-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Flagged Pairs — with severity breakdown + donut chart */}
        <Card className="rounded-2xl glass glow-hover accent-line overflow-hidden border-red-500/30">
          <CardContent className="pt-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground font-jb">
                  FLAGGED PAIRS
                </p>
                <p className="mt-2 text-4xl font-bold font-jb neon-num text-destructive">
                  <CountUp to={data.flagged_high_count + data.flagged_med_count + data.flagged_low_count} />
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  <span className="text-red-500 font-medium">{data.flagged_high_count} High</span>
                  {" · "}
                  <span className="text-orange-500 font-medium">{data.flagged_med_count} Medium</span>
                  {" · "}
                  <span className="text-yellow-600 font-medium">{data.flagged_low_count} Low</span>
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground/60 uppercase tracking-wide">by severity</p>
              </div>
              <DonutChart high={data.flagged_high_count} med={data.flagged_med_count} low={data.flagged_low_count} />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Row 3: Similarity Flags */}
      <Card className="rounded-xl glass glow-hover accent-line card-stagger">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-2xl">Similarity Alerts</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Click any row to open analysis</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                <span className="text-red-500 font-medium">≥70% is High similarity</span>, <span className="text-orange-400 font-medium">40–70% is Medium similarity</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              {(["ALL", "HIGH", "LOW"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setSeverityFilter(f)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    severityFilter === f
                      ? f === "ALL"
                        ? "bg-foreground text-background"
                        : f === "HIGH"
                          ? "bg-red-500 text-white"
                          : "bg-orange-400 text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {f === "ALL" ? "All" : f === "HIGH" ? "High" : "Medium"}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredPairs.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground">
              {flaggedCount === 0
                ? "No flagged pairs yet. Run analysis on your assignments to detect similarities."
                : "No pairs match this filter."}
            </p>
          ) : (
            <div className="space-y-0">
              {/* Table header */}
              <div className="grid grid-cols-[2fr_2fr_1.5fr_1fr_1fr] gap-4 px-3 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground font-jb">
                <span>Students</span>
                <span>Course &amp; Assignment</span>
                <span>Similarity</span>
                <span>Severity</span>
                <span>Score</span>
              </div>
              <div className={filteredPairs.length > 5 ? "overflow-y-auto max-h-[360px] space-y-0" : "space-y-0"}>
                {[...filteredPairs].sort((a, b) => b.similarity - a.similarity).map((pair, idx) => (
                  <Link
                    key={`${pair.assignment_id}_${pair.pair_id}_${idx}`}
                    href={`/instructor/courses/${pair.course_id}/assignments/${pair.assignment_id}/analysis/${pair.pair_id}`}
                    className="grid grid-cols-[2fr_2fr_1.5fr_1fr_1fr] gap-4 items-center rounded-lg border border-border/50 p-3 transition-all hover:border-primary/25 hover:bg-primary/[0.03]"
                  >
                    {/* Students */}
                    <div className="flex items-center gap-2 min-w-0">
                      <SeverityDot score={pair.severity_score} />
                      <span className="font-medium text-sm truncate">
                        {pair.student_1} &amp; {pair.student_2}
                      </span>
                    </div>

                    {/* Course & Assignment */}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {pair.course_code}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {pair.assignment_title ?? `Assignment`}
                      </p>
                    </div>

                    {/* Similarity bar */}
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.round(pair.similarity * 100)}%`,
                            background:
                              pair.similarity >= 0.7
                                ? "#ef4444"
                                : pair.similarity >= 0.4
                                  ? "#f97316"
                                  : "#eab308",
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium w-9 shrink-0">
                        {Math.round(pair.similarity * 100)}%
                      </span>
                    </div>

                    {/* Severity */}
                    <SeverityBadge level={getSeverityLevel(pair.severity_score)} />

                    {/* Score */}
                    <span className="text-sm font-medium tabular-nums">
                      {pair.severity_score.toFixed(2)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Row 4: Recent Analyses + Course Health */}
      <section className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        {/* Recent Analyses */}
        <Card className="rounded-xl glass glow-hover accent-line card-stagger">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Recent Analyses</CardTitle>
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </CardHeader>
          <CardContent>
            {recentAnalyses.length === 0 ? (
              <p className="text-center py-6 text-muted-foreground">
                No analyses run yet.
              </p>
            ) : (
              <div className="space-y-2">
                {recentAnalyses.map((run) => (
                  <Link
                    key={run.id}
                    href={`/instructor/courses/${run.course_id}/assignments/${run.assignment_id}/analysis`}
                    className="flex items-center gap-3 rounded-xl border p-3 hover:bg-muted/50 transition-colors"
                  >
                    {/* Icon */}
                    <div className="rounded-lg bg-muted p-2 shrink-0">
                      <TrendingUp className="h-4 w-4 text-primary" />
                    </div>

                    {/* Title + meta */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {run.assignment_title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {run.course_code} · {run.submission_count ?? data.total_submissions} submissions · token analysis
                      </p>
                    </div>

                    {/* Right: time + flagged + severity */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {run.completed_at
                          ? timeAgo(run.completed_at)
                          : run.status === "running"
                            ? "Running..."
                            : "Failed"}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium">
                          {run.pairs_flagged} flagged
                        </span>
                        {run.top_severity > 0 && (
                          <SeverityBadge
                            level={getSeverityLevel(run.top_severity)}
                          />
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Course Health */}
        <Card className="rounded-xl glass glow-hover accent-line card-stagger">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Course Health</CardTitle>
            <p className="text-xs text-muted-foreground">
              Similarity distribution across assignments
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {courseHealth.size === 0 && data.course_count === 0 ? (
              <p className="text-center py-6 text-muted-foreground">
                No courses yet.
              </p>
            ) : (
              <>
                {Array.from(courseHealth.values())
                  .sort((a, b) => b.total - a.total)
                  .map((ch) => (
                    <div key={ch.id} className="space-y-2">
                      {/* Course row */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{ch.code}</span>
                        <span className="text-xs text-destructive font-medium">
                          {ch.total} flagged
                        </span>
                      </div>

                      {/* Stacked bar */}
                      <div className="flex h-2.5 rounded-full overflow-hidden bg-muted">
                        {ch.high > 0 && (
                          <div
                            className="bg-red-500"
                            style={{ width: `${(ch.high / ch.total) * 100}%` }}
                          />
                        )}
                        {ch.med > 0 && (
                          <div
                            className="bg-orange-400"
                            style={{ width: `${(ch.med / ch.total) * 100}%` }}
                          />
                        )}
                        {ch.low > 0 && (
                          <div
                            className="bg-yellow-400"
                            style={{ width: `${(ch.low / ch.total) * 100}%` }}
                          />
                        )}
                        {/* Green portion for clean */}
                        <div className="flex-1 bg-green-400" />
                      </div>

                      {/* Legend dots */}
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
                          {ch.high} High
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-orange-400 inline-block" />
                          {ch.med} Medium
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-yellow-400 inline-block" />
                          {ch.low} Low
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-green-400 inline-block" />
                          {Math.max(0, (data.total_submissions ?? 0) - ch.total)} Clean
                        </span>
                      </div>
                    </div>
                  ))}

                {/* AI insight banners */}
                {courseHealthInsights.map(({ ch, highPairs, medPairs }) => (
                  <div key={`insights-${ch.id}`} className="space-y-2 mt-2">
                    {ch.high > 0 && (
                      <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                              High risk detected
                            </p>
                            <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">
                              {highPairs.length} pair{highPairs.length !== 1 ? "s" : ""} flagged in {[...new Set(highPairs.map((p) => p.assignment_title))].join(", ")} — pattern suggests collaboration or copying.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    {ch.med > 0 && (
                      <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 p-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400">
                              Watch
                            </p>
                            <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-0.5">
                              {medPairs.length} pair{medPairs.length !== 1 ? "s" : ""} flagged in {[...new Set(medPairs.map((p) => p.assignment_title))].join(", ")} — medium severity, consistent pattern worth monitoring.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    {cleanCourses > 0 || (data.total_submissions ?? 0) - ch.total > 0 ? (
                      <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-3">
                        <div className="flex items-start gap-2">
                          <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center mt-0.5 shrink-0">
                            <span className="text-white text-[8px] font-bold">✓</span>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-green-700 dark:text-green-400">
                              {Math.max(0, (data.total_submissions ?? 0) - ch.total)} submissions clean
                            </p>
                            <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">
                              Remaining students show no similarity concerns across either assignment.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}

                {/* Clean courses with no flags */}
                {cleanCourses > 0 && courseHealth.size === 0 && (
                  <div className="rounded-xl border border-dashed p-3 text-muted-foreground">
                    <span className="text-sm">
                      {cleanCourses} course{cleanCourses !== 1 ? "s" : ""} with no issues
                    </span>
                    <span className="ml-auto float-right text-xs text-green-600 font-medium">
                      Clean
                    </span>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function DonutChart({ high, med, low }: { high: number; med: number; low: number }) {
  const total = high + med + low;
  const r = 36;
  const sw = 10;
  const C = 2 * Math.PI * r;

  if (total === 0) {
    return (
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} fill="none" stroke="#e5e7eb" strokeWidth={sw} />
      </svg>
    );
  }

  const highLen = (high / total) * C;
  const medLen = (med / total) * C;
  const lowLen = (low / total) * C;

  // dashoffset positions each segment: offset = C - sum of previous lengths
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" style={{ transform: "rotate(-90deg)" }}>
      {low > 0 && (
        <circle cx="44" cy="44" r={r} fill="none" stroke="#eab308" strokeWidth={sw}
          strokeDasharray={`${lowLen} ${C - lowLen}`}
          strokeDashoffset={C - highLen - medLen}
        />
      )}
      {med > 0 && (
        <circle cx="44" cy="44" r={r} fill="none" stroke="#f97316" strokeWidth={sw}
          strokeDasharray={`${medLen} ${C - medLen}`}
          strokeDashoffset={C - highLen}
        />
      )}
      {high > 0 && (
        <circle cx="44" cy="44" r={r} fill="none" stroke="#ef4444" strokeWidth={sw}
          strokeDasharray={`${highLen} ${C - highLen}`}
          strokeDashoffset={C}
        />
      )}
    </svg>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}