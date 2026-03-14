"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  Download,
  FileText,
  Clock,
  Code,
  ArrowLeft,
} from "lucide-react";

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

interface SubmissionFile {
  name: string;
  size: number;
}

interface Submission {
  id: string;
  assignment_id: string;
  course_id: string;
  language: string;
  comment: string | null;
  files: SubmissionFile[];
  submitted_at: string;
}

interface CourseInfo {
  code: string;
  title: string;
}

interface AssignmentInfo {
  title: string;
}

export default function SubmissionsPage() {
  const params = useParams();
  const courseId = params.id as string;
  const assignmentId = params.assignmentId as string;

  const [submissions, setSubmissions] = React.useState<Submission[]>([]);
  const [course, setCourse] = React.useState<CourseInfo | null>(null);
  const [assignment, setAssignment] = React.useState<AssignmentInfo | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [downloading, setDownloading] = React.useState(false);

  React.useEffect(() => {
    Promise.all([
      apiFetch<Submission[]>(
        `/api/instructor/courses/${courseId}/assignments/${assignmentId}/submissions`
      ),
      apiFetch<CourseInfo>(`/api/instructor/courses/${courseId}`),
      apiFetch<{ title: string }[]>(
        `/api/instructor/courses/${courseId}/assignments`
      ).then((assignments) =>
        assignments.find((a: any) => a.id === assignmentId)
      ),
    ])
      .then(([subs, courseData, assignmentData]) => {
        setSubmissions(subs);
        setCourse(courseData);
        if (assignmentData) setAssignment(assignmentData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [courseId, assignmentId]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const token = localStorage.getItem("token");
      const API_BASE =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(
        `${API_BASE}/api/instructor/courses/${courseId}/assignments/${assignmentId}/submissions/download`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "Download failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("content-disposition");
      const match = disposition?.match(/filename="?([^"]+)"?/);
      a.download = match?.[1] || "submissions.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
      alert(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/instructor/courses" className="hover:text-foreground">
          Courses
        </Link>
        <span>/</span>
        <Link
          href={`/instructor/courses/${courseId}`}
          className="hover:text-foreground"
        >
          {course?.code ?? "..."}
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">
          {assignment?.title ?? "..."} &mdash; Submissions
        </span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {assignment?.title ?? "Assignment"} Submissions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {course?.code} &mdash; {submissions.length} submission
            {submissions.length !== 1 ? "s" : ""} received
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/instructor/courses/${courseId}/assignments/${assignmentId}/analysis`}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Analysis
            </Link>
          </Button>
          <Button
            size="sm"
            onClick={handleDownload}
            disabled={downloading || submissions.length === 0}
          >
            {downloading ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-1 h-4 w-4" />
            )}
            Download All
          </Button>
        </div>
      </div>

      {/* Submissions Table */}
      {submissions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>No submissions received yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">#</TableHead>
                    <TableHead>Language</TableHead>
                    <TableHead>Files</TableHead>
                    <TableHead>Total Size</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Comment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((sub, idx) => {
                    const totalSize = sub.files.reduce(
                      (sum, f) => sum + f.size,
                      0
                    );
                    return (
                      <TableRow key={sub.id}>
                        <TableCell className="font-medium">
                          Submission {idx + 1}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1">
                            <Code className="h-3 w-3" />
                            {sub.language}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            {sub.files.map((f, fi) => (
                              <span
                                key={fi}
                                className="text-xs text-muted-foreground"
                              >
                                {f.name}{" "}
                                <span className="opacity-60">
                                  ({formatSize(f.size)})
                                </span>
                              </span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatSize(totalSize)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {new Date(sub.submitted_at).toLocaleString()}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {sub.comment || (
                            <span className="opacity-40">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
