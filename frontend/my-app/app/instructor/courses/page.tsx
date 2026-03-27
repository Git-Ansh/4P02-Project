"use client";

import * as React from "react";
import Link from "next/link";
import {
  Plus,
  Trash2,
  Pencil,
  CalendarDays,
  SearchIcon,
  Loader2,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
import { apiFetch, ApiError } from "@/lib/api";

interface Course {
  id: string;
  code: string;
  title: string;
  term: string;
  description: string | null;
  instructor_email: string;
  instructor_name: string;
  created_at: string;
}

export default function InstructorCoursesPage() {
  const [courses, setCourses] = React.useState<Course[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editCourse, setEditCourse] = React.useState<Course | null>(null);
  const [search, setSearch] = React.useState("");
  const [termFilter, setTermFilter] = React.useState("all");

  const fetchCourses = React.useCallback(async () => {
    try {
      const data = await apiFetch<Course[]>("/api/instructor/courses");
      setCourses(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/instructor/courses/${id}`, { method: "DELETE" });
      await fetchCourses();
    } catch (err) {
      console.error(err);
    }
  };

  const terms = React.useMemo(() => {
    const set = new Set(courses.map((c) => c.term));
    return Array.from(set).sort();
  }, [courses]);

  const filtered = React.useMemo(() => {
    return courses.filter((c) => {
      const matchesTerm = termFilter === "all" || c.term === termFilter;
      const matchesSearch =
        !search ||
        c.code.toLowerCase().includes(search.toLowerCase()) ||
        c.title.toLowerCase().includes(search.toLowerCase());
      return matchesTerm && matchesSearch;
    });
  }, [courses, termFilter, search]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">My Courses</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Manage your courses and assignments.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Course
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Course</DialogTitle>
              <DialogDescription>
                Add a new course to your teaching load.
              </DialogDescription>
            </DialogHeader>
            <CourseForm
              onSuccess={() => {
                setCreateOpen(false);
                fetchCourses();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex items-center gap-2 flex-1 rounded-md border border-border bg-background px-3 py-2">
          <SearchIcon className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search courses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <select
          value={termFilter}
          onChange={(e) => setTermFilter(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="all">All Terms</option>
          {terms.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* Course grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          {courses.length === 0
            ? "No courses yet. Create one to get started."
            : "No courses match your filters."}
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((course) => (
            <Card key={course.id} className="relative group hover:shadow-md transition-shadow">
              <Link href={`/instructor/courses/${course.id}`} className="block">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xl font-semibold text-primary">
                        {course.code}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {course.title}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-primary transition-colors mt-1" />
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" />
                      <span>{course.term}</span>
                    </div>
                  </div>

                  {course.description && (
                    <p className="mt-3 text-xs text-muted-foreground/80 line-clamp-2">
                      {course.description}
                    </p>
                  )}
                </CardContent>
              </Link>
              <div className="px-5 pb-4 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setEditCourse(course)}
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="px-3">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Delete &quot;{course.code}&quot;?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete this course and all its
                        assignments. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(course.id)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog
        open={!!editCourse}
        onOpenChange={(open) => !open && setEditCourse(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Course</DialogTitle>
            <DialogDescription>
              Update details for {editCourse?.code}.
            </DialogDescription>
          </DialogHeader>
          {editCourse && (
            <CourseForm
              course={editCourse}
              onSuccess={() => {
                setEditCourse(null);
                fetchCourses();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CourseForm({
  course,
  onSuccess,
}: {
  course?: Course;
  onSuccess: () => void;
}) {
  const isEdit = !!course;
  const [code, setCode] = React.useState(course?.code || "");
  const [title, setTitle] = React.useState(course?.title || "");
  const [term, setTerm] = React.useState(course?.term || "");
  const [description, setDescription] = React.useState(
    course?.description || "",
  );
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (isEdit) {
        await apiFetch(`/api/instructor/courses/${course.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            code,
            title,
            term,
            description: description || null,
          }),
          
        });
      } else {
        await apiFetch("/api/instructor/courses", {
          method: "POST",
          body: JSON.stringify({
            code,
            title,
            term,
            description: description || null,
          }),
        });
      }
      onSuccess();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to save course",
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
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="course-code">Course Code</Label>
          <input
            id="course-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="COSC 4P02"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="course-term">Term</Label>
          <input
            id="course-term"
            required
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Winter 2026"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="course-title">Title</Label>
        <input
          id="course-title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Software Engineering II"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="course-desc">Description (optional)</Label>
        <textarea
          id="course-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief course description..."
          rows={3}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
        />
      </div>
      <Button type="submit" disabled={submitting} className="mt-2">
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isEdit ? "Save Changes" : "Create Course"}
      </Button>
    </form>
  );
}
