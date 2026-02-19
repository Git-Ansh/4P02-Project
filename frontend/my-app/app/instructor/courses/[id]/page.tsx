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
  Users,
  Loader2,
  AlertCircle,
  ClipboardList,
  Trophy,
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
  student_count: number;
}

interface Assignment {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  max_score: number;
  created_at: string;
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
    Promise.all([fetchCourse(), fetchAssignments()]).finally(() =>
      setLoading(false),
    );
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
    <div className="p-8">
      {/* Breadcrumb / Back */}
      <Link
        href="/instructor/courses"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Courses
      </Link>

      {/* Course header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-primary">{course.code}</h1>
          <p className="text-lg text-muted-foreground mt-1">{course.title}</p>
          <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              {course.term}
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              {course.student_count} student
              {course.student_count !== 1 ? "s" : ""}
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Assignments</h2>
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
                <CardContent className="p-5 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium truncate">{a.title}</h3>
                      {isPast && (
                        <Badge variant="secondary" className="text-xs">
                          Past Due
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
                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditAssignment(a)}
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
                            This will permanently remove this assignment.
                            This action cannot be undone.
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
      <Button type="submit" disabled={submitting} className="mt-2">
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isEdit ? "Save Changes" : "Create Assignment"}
      </Button>
    </form>
  );
}
