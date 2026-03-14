"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, Shield, ArrowRight, Trash2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import { SeverityBadge, getSeverityLevel } from "@/components/analysis/severity-badge";
import type { RecentAnalysis } from "@/lib/types/analysis";

export default function AnalysisIndexPage() {
  const [runs, setRuns] = React.useState<RecentAnalysis[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [deleting, setDeleting] = React.useState<string | null>(null);

  React.useEffect(() => {
    apiFetch<RecentAnalysis[]>("/api/instructor/analysis/recent")
      .then(setRuns)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (runId: string) => {
    if (!confirm("Delete this analysis run? This cannot be undone.")) return;
    setDeleting(runId);
    try {
      await apiFetch(`/api/instructor/analysis/${runId}`, { method: "DELETE" });
      setRuns((prev) => prev.filter((r) => r.id !== runId));
    } catch (err) {
      console.error("Failed to delete analysis run:", err);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analysis Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All analysis runs across your courses.
          </p>
        </div>
      </div>

      {runs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Shield className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>No analyses have been run yet.</p>
            <p className="text-sm mt-1">
              Go to a course and run analysis on an assignment.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Assignment</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pairs Flagged</TableHead>
                    <TableHead>Top Severity</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-20" />
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell className="font-medium">
                        {run.assignment_title}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{run.course_code}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            run.status === "completed"
                              ? "default"
                              : run.status === "running"
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {run.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{run.pairs_flagged}</TableCell>
                      <TableCell>
                        {run.top_severity > 0 ? (
                          <SeverityBadge level={getSeverityLevel(run.top_severity)} />
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {run.completed_at
                          ? new Date(run.completed_at).toLocaleDateString()
                          : run.started_at
                            ? new Date(run.started_at).toLocaleDateString()
                            : "-"}
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="outline" size="sm">
                          <Link
                            href={`/instructor/courses/${run.course_id}/assignments/${run.assignment_id}/analysis`}
                          >
                            View
                            <ArrowRight className="ml-1 h-3 w-3" />
                          </Link>
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(run.id)}
                          disabled={deleting === run.id}
                        >
                          {deleting === run.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
