"use client";

import * as React from "react";
import Link from "next/link";
import {
  GraduationCap,
  Loader2,
  ClipboardList,
  AlertTriangle,
  FileText,
  ArrowRight,
  Shield,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { StatsCard } from "@/components/analysis/stats-card";
import {
  SeverityBadge,
  SeverityDot,
  getSeverityLevel,
} from "@/components/analysis/severity-badge";
import type { InstructorDashboardData, FlaggedPair, RecentAnalysis } from "@/lib/types/analysis";

export default function InstructorDashboard() {
  const [data, setData] = React.useState<InstructorDashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [name, setName] = React.useState("");
  const [severityFilter, setSeverityFilter] = React.useState<"ALL" | "HIGH" | "MEDIUM">("ALL");

  React.useEffect(() => {
    const user = getCurrentUser();
    if (user?.sub) {
      setName(user.sub.split("@")[0]);
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
  const medCount = flaggedPairs.filter((p) => p.severity_score >= 0.4 && p.severity_score < 0.7).length;
  const lowCount = flaggedPairs.filter((p) => p.severity_score < 0.4).length;

  const filteredPairs = flaggedPairs.filter((p) => {
    if (severityFilter === "HIGH") return p.severity_score >= 0.7;
    if (severityFilter === "MEDIUM") return p.severity_score >= 0.4 && p.severity_score < 0.7;
    return true;
  });

  // Donut chart via conic-gradient
  const total = highCount + medCount + lowCount || 1;
  const highPct = (highCount / total) * 100;
  const medPct = (medCount / total) * 100;
  const donutGradient = `conic-gradient(
    #ef4444 0% ${highPct}%,
    #f97316 ${highPct}% ${highPct + medPct}%,
    #eab308 ${highPct + medPct}% 100%
  )`;

  // Course health from flagged pairs
  const courseHealth = new Map<string, { code: string; count: number; id: string }>();
  for (const p of flaggedPairs) {
    const existing = courseHealth.get(p.course_id);
    if (existing) {
      existing.count++;
    } else {
      courseHealth.set(p.course_id, { code: p.course_code, count: 1, id: p.course_id });
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Row 1: Welcome Banner */}
      <section className="rounded-2xl border bg-background p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Welcome{name ? `, ${name}` : ""}
            </h1>
            <p className="mt-1 text-muted-foreground">
              Your academic integrity command center.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/instructor/courses">
                View Courses
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/instructor/analysis">View All Analyses</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Row 2: Stats Cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatsCard
          title="My Courses"
          value={data.course_count}
          icon={GraduationCap}
        />
        <StatsCard
          title="Assignments"
          value={data.total_assignments}
          icon={ClipboardList}
        />
        <StatsCard
          title="Submissions"
          value={data.total_submissions}
          icon={FileText}
        />
        <StatsCard
          title="Flagged Pairs"
          value={flaggedCount}
          icon={AlertTriangle}
          trend={flaggedCount > 0 ? `${flaggedCount} flagged` : undefined}
        />
        {/* Severity distribution donut */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Severity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div
                className="h-14 w-14 rounded-full shrink-0"
                style={{
                  background: flaggedCount > 0 ? donutGradient : "hsl(var(--muted))",
                  mask: "radial-gradient(circle at center, transparent 55%, black 56%)",
                  WebkitMask: "radial-gradient(circle at center, transparent 55%, black 56%)",
                }}
              />
              <div className="text-xs space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  {highCount}H
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-orange-500" />
                  {medCount}M
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-yellow-500" />
                  {lowCount}L
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Row 3: Attention Required */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Attention Required</CardTitle>
            <div className="flex items-center gap-2">
              {(["ALL", "HIGH", "MEDIUM"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setSeverityFilter(f)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    severityFilter === f
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {f === "ALL" ? "All" : f}
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
            <div className="space-y-2">
              {filteredPairs.slice(0, 5).map((pair) => (
                <Link
                  key={`${pair.assignment_id}_${pair.pair_id}`}
                  href={`/instructor/courses/${pair.course_id}/assignments/${pair.assignment_id}/analysis/${pair.pair_id}`}
                  className="flex items-center gap-3 rounded-xl border p-3 hover:bg-muted/50 transition-colors"
                >
                  <SeverityDot score={pair.severity_score} />
                  <span className="font-medium text-sm min-w-[120px]">
                    {pair.student_1} vs {pair.student_2}
                  </span>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
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
                    <span className="text-xs font-medium w-10">
                      {Math.round(pair.similarity * 100)}%
                    </span>
                  </div>
                  <SeverityBadge level={getSeverityLevel(pair.severity_score)} />
                  <span className="text-xs text-muted-foreground font-medium w-12 text-right">
                    {pair.severity_score.toFixed(2)}
                  </span>
                </Link>
              ))}
              {filteredPairs.length > 5 && (
                <div className="text-right pt-2">
                  <Button asChild variant="link" size="sm">
                    <Link href="/instructor/analysis">
                      View All
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Row 4: Recent Analyses + Course Health */}
      <section className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Recent Analyses</CardTitle>
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
                    className="flex items-center justify-between gap-4 rounded-xl border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {run.assignment_title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {run.course_code}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-medium">
                        {run.pairs_flagged} flagged
                      </span>
                      {run.top_severity > 0 && (
                        <SeverityBadge level={getSeverityLevel(run.top_severity)} />
                      )}
                      <span className="text-xs text-muted-foreground">
                        {run.completed_at
                          ? timeAgo(run.completed_at)
                          : run.status === "running"
                            ? "Running..."
                            : "Failed"}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Course Health</CardTitle>
          </CardHeader>
          <CardContent>
            {courseHealth.size === 0 && data.course_count === 0 ? (
              <p className="text-center py-6 text-muted-foreground">
                No courses yet.
              </p>
            ) : (
              <div className="space-y-2">
                {Array.from(courseHealth.values()).map((ch) => (
                  <div
                    key={ch.id}
                    className="flex items-center justify-between rounded-xl border p-3"
                  >
                    <span className="text-sm font-medium">{ch.code}</span>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(ch.count, 5) }).map((_, i) => (
                        <span key={i} className="h-2 w-2 rounded-full bg-red-500" />
                      ))}
                      <span className="text-xs text-muted-foreground ml-1">
                        {ch.count} flagged
                      </span>
                    </div>
                  </div>
                ))}
                {data.course_count > courseHealth.size && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    {data.course_count - courseHealth.size} course{data.course_count - courseHealth.size !== 1 ? "s" : ""} with no issues
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
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
