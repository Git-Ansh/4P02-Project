"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Trash2,
  Pencil,
  ArrowLeft,
  CalendarDays,
  Loader2,
  AlertCircle,
  ClipboardList,
  Trophy,
  Key,
  Copy,
  Check,
  FileText,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { apiFetch, ApiError } from "@/lib/api";

interface Course {
  id: string;
  code: string;
  title: string;
  term: string;
  description: string | null;
  instructor_name: string;
}

interface Assignment {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  max_score: number;
  allow_resubmission: boolean;
  language: string;
  created_at: string;
}

interface Submission {
  id: string;
  language: string;
  comment: string | null;
  files: { name: string; size: number }[];
  submitted_at: string;
}

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;

  const [course, setCourse] = React.useState<Course | null>(null);
  const [assignments, setAssignments] = React.useState<Assignment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editAssignment, setEditAssignment] = React.useState<Assignment | null>(
    null,
  );

  // Token dialog state
  const [tokenDialogOpen, setTokenDialogOpen] = React.useState(false);
  const [tokenValue, setTokenValue] = React.useState("");
  const [tokenExpiry, setTokenExpiry] = React.useState("");
  const [tokenLoading, setTokenLoading] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  // Token dialog assignment state
  const [tokenAssignment, setTokenAssignment] =
    React.useState<Assignment | null>(null);

  // Submissions dialog state
  const [submissionsDialogOpen, setSubmissionsDialogOpen] =
    React.useState(false);
  const [submissions, setSubmissions] = React.useState<Submission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = React.useState(false);
  const [submissionsAssignment, setSubmissionsAssignment] =
    React.useState<Assignment | null>(null);

  const fetchCourse = React.useCallback(async () => {
    try {
      const data = await apiFetch<Course>(
        `/api/instructor/courses/${courseId}`,
      );
      setCourse(data);
    } catch {
      router.replace("/instructor/courses");
    }
  }, [courseId, router]);

  const fetchAssignments = React.useCallback(async () => {
    try {
      const data = await apiFetch<Assignment[]>(
        `/api/instructor/courses/${courseId}/assignments`,
      );
      setAssignments(data);
    } catch (err) {
      console.error(err);
    }
  }, [courseId]);

  React.useEffect(() => {
    Promise.all([
      fetchCourse(),
      fetchAssignments(),
    ]).finally(() => setLoading(false));
  }, [fetchCourse, fetchAssignments]);

  const handleDeleteAssignment = async (assignmentId: string) => {
    try {
      await apiFetch(
        `/api/instructor/courses/${courseId}/assignments/${assignmentId}`,
        { method: "DELETE" },
      );
      await fetchAssignments();
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerateToken = async (assignment: Assignment) => {
    setTokenDialogOpen(true);
    setTokenLoading(true);
    setTokenValue("");
    setTokenExpiry("");
    setCopied(false);
    setTokenAssignment(assignment);
    try {
      const data = await apiFetch<{ token: string; expires_at: string }>(
        `/api/instructor/courses/${courseId}/assignments/${assignment.id}/token`,
        { method: "POST" },
      );
      setTokenValue(data.token);
      setTokenExpiry(data.expires_at);
    } catch (err) {
      console.error(err);
    } finally {
      setTokenLoading(false);
    }
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText(tokenValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleViewSubmissions = async (assignment: Assignment) => {
    setSubmissionsAssignment(assignment);
    setSubmissionsDialogOpen(true);
    setSubmissionsLoading(true);
    try {
      const data = await apiFetch<Submission[]>(
        `/api/instructor/courses/${courseId}/assignments/${assignment.id}/submissions`,
      );
      setSubmissions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmissionsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!course) return null;

  const now = new Date();

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Breadcrumb / Back */}
      <Link
        href="/instructor/courses"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 sm:mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Courses
      </Link>

      {/* Course header */}
      <div className="mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">
            {course.code}
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground mt-1">
            {course.title}
          </p>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              {course.term}
            </span>
          </div>
          {course.description && (
            <p className="mt-3 text-sm text-muted-foreground/80 max-w-2xl">
              {course.description}
            </p>
          )}
        </div>
      </div>

      {/* Assignments section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold">Assignments</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {assignments.length} assignment
            {assignments.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Assignment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Assignment</DialogTitle>
              <DialogDescription>
                Add a new assignment to {course.code}.
              </DialogDescription>
            </DialogHeader>
            <AssignmentForm
              courseId={courseId}
              onSuccess={() => {
                setCreateOpen(false);
                fetchAssignments();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {assignments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>No assignments yet. Create one to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => {
            const dueDate = a.due_date ? new Date(a.due_date) : null;
            const isPast = dueDate && dueDate < now;

            return (
              <Card key={a.id}>
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium truncate">{a.title}</h3>
                        {isPast && (
                          <Badge variant="secondary" className="text-xs">
                            Past Due
                          </Badge>
                        )}
                        {a.language && (
                          <Badge variant="secondary" className="text-xs">
                            {{"c": "C", "cpp": "C++", "java": "Java", "python": "Python"}[a.language] || a.language}
                          </Badge>
                        )}
                        {a.allow_resubmission && (
                          <Badge variant="outline" className="text-xs">
                            Resubmission
                          </Badge>
                        )}
                      </div>
                      {a.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                          {a.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        {dueDate && (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3.5 w-3.5" />
                            Due{" "}
                            {dueDate.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Trophy className="h-3.5 w-3.5" />
                          {a.max_score} pts
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:ml-4 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleGenerateToken(a)}
                        title="Generate Token"
                      >
                        <Key className="h-3.5 w-3.5 sm:mr-1" />
                        <span className="hidden sm:inline">Token</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        title="View Submissions"
                      >
                        <Link href={`/instructor/courses/${courseId}/assignments/${a.id}/submissions`}>
                          <FileText className="h-3.5 w-3.5 sm:mr-1" />
                          <span className="hidden sm:inline">Submissions</span>
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        title="Run Analysis"
                      >
                        <Link href={`/instructor/courses/${courseId}/assignments/${a.id}/analysis`}>
                          <Shield className="h-3.5 w-3.5 sm:mr-1" />
                          <span className="hidden sm:inline">Analysis</span>
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditAssignment(a)}
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Delete &quot;{a.title}&quot;?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove this assignment. This
                              action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteAssignment(a.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Assignment Dialog */}
      <Dialog
        open={!!editAssignment}
        onOpenChange={(open) => !open && setEditAssignment(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Assignment</DialogTitle>
            <DialogDescription>
              Update details for {editAssignment?.title}.
            </DialogDescription>
          </DialogHeader>
          {editAssignment && (
            <AssignmentForm
              courseId={courseId}
              assignment={editAssignment}
              onSuccess={() => {
                setEditAssignment(null);
                fetchAssignments();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Token Dialog */}
      <Dialog open={tokenDialogOpen} onOpenChange={setTokenDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submission Token</DialogTitle>
            <DialogDescription>
              Share this token with students so they can submit their work.
            </DialogDescription>
          </DialogHeader>
          {tokenLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : tokenValue ? (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted p-3">
                <code className="text-xs break-all select-all">
                  {tokenValue}
                </code>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Expires:{" "}
                  {new Date(tokenExpiry).toLocaleString()}
                </span>
                <Button size="sm" variant="outline" onClick={handleCopyToken}>
                  {copied ? (
                    <>
                      <Check className="mr-1 h-3.5 w-3.5" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1 h-3.5 w-3.5" /> Copy
                    </>
                  )}
                </Button>
              </div>

            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Failed to generate token.
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* Submissions Dialog */}
      <Dialog
        open={submissionsDialogOpen}
        onOpenChange={setSubmissionsDialogOpen}
      >
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Submissions — {submissionsAssignment?.title}
            </DialogTitle>
            <DialogDescription>
              Anonymous submissions list.
            </DialogDescription>
          </DialogHeader>
          {submissionsLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : submissions.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">
              No submissions yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Files</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((s, index) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{s.language}</Badge>
                    </TableCell>
                    <TableCell>{s.files.length}</TableCell>
                    <TableCell>
                      {new Date(s.submitted_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AssignmentForm({
  courseId,
  assignment,
  onSuccess,
}: {
  courseId: string;
  assignment?: Assignment;
  onSuccess: () => void;
}) {
  const isEdit = !!assignment;
  const [title, setTitle] = React.useState(assignment?.title || "");
  const [description, setDescription] = React.useState(
    assignment?.description || "",
  );
  const [dueDate, setDueDate] = React.useState(
    assignment?.due_date
      ? new Date(assignment.due_date).toISOString().slice(0, 16)
      : "",
  );
  const [maxScore, setMaxScore] = React.useState(
    String(assignment?.max_score ?? 100),
  );
  const [allowResubmission, setAllowResubmission] = React.useState(
    assignment?.allow_resubmission ?? false,
  );
  const [language, setLanguage] = React.useState(
    assignment?.language || "",
  );
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        title,
        description: description || null,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        max_score: parseFloat(maxScore) || 100,
        allow_resubmission: allowResubmission,
        language,
      };

      if (isEdit) {
        await apiFetch(
          `/api/instructor/courses/${courseId}/assignments/${assignment.id}`,
          { method: "PATCH", body: JSON.stringify(payload) },
        );
      } else {
        await apiFetch(
          `/api/instructor/courses/${courseId}/assignments`,
          { method: "POST", body: JSON.stringify(payload) },
        );
      }
      onSuccess();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to save assignment",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="a-title">Title</Label>
        <input
          id="a-title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Assignment 1"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="a-desc">Description (optional)</Label>
        <textarea
          id="a-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Assignment instructions..."
          rows={3}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="a-due">Due Date (optional)</Label>
          <input
            id="a-due"
            type="datetime-local"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="a-score">Max Score</Label>
          <input
            id="a-score"
            type="number"
            min="1"
            required
            value={maxScore}
            onChange={(e) => setMaxScore(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="a-lang">Language</Label>
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger id="a-lang" className="w-full">
            <SelectValue placeholder="Select language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="c">C</SelectItem>
            <SelectItem value="cpp">C++</SelectItem>
            <SelectItem value="java">Java</SelectItem>
            <SelectItem value="python">Python</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={allowResubmission}
          onChange={(e) => setAllowResubmission(e.target.checked)}
          className="rounded border-input"
        />
        <span className="text-sm">Allow Resubmissions</span>
      </label>
      <Button type="submit" disabled={submitting || !language} className="mt-2">
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isEdit ? "Save Changes" : "Create Assignment"}
      </Button>
    </form>
  );
}
