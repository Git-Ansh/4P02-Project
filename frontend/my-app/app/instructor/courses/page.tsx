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
  Clock,
  AlertTriangle,
  Archive,
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
  end_date: string | null;
  expiry_status: "expiring_soon" | "grace_period" | "data_deleted" | null;
}

/** Badge shown on course cards to alert instructors about expiry state. */
function ExpiryBadge({ status }: { status: Course["expiry_status"] }) {
  if (!status) return null;

  const config = {
    expiring_soon: {
      icon: <Clock className="h-3 w-3" />,
      label: "Expiring Soon",
      className: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300",
    },
    grace_period: {
      icon: <AlertTriangle className="h-3 w-3" />,
      label: "Grace Period",
      className: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300",
    },
    data_deleted: {
      icon: <Archive className="h-3 w-3" />,
      label: "Data Deleted",
      className: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300",
    },
  } as const;

  const { icon, label, className } = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {icon}
      {label}
    </span>
  );
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
    const seasonOrder: Record<string, number> = {
      spring: 1, summer: 2, fall: 3, winter: 4,
    };
    const set = new Set(courses.map((c) => c.term));
    return Array.from(set).sort((a, b) => {
      const [aSeason, aYear] = [a.split(" ")[0].toLowerCase(), parseInt(a.split(" ")[1]) || 0];
      const [bSeason, bYear] = [b.split(" ")[0].toLowerCase(), parseInt(b.split(" ")[1]) || 0];
      if (bYear !== aYear) return bYear - aYear;
      return (seasonOrder[aSeason] ?? 5) - (seasonOrder[bSeason] ?? 5);
    });
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
                Add a new course to your teaching load. The end date cannot be
                changed after creation — contact your admin if a correction is
                needed.
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
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-xl font-semibold text-primary">
                          {course.code}
                        </div>
                        <ExpiryBadge status={course.expiry_status} />
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {course.title}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-primary transition-colors mt-1 shrink-0" />
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 shrink-0" />
                      <span>{course.term}</span>
                    </div>
                    {course.end_date && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 shrink-0" />
                        <span>Ends {fmtToronto(course.end_date)}</span>
                      </div>
                    )}
                  </div>

                  {/* Expiry warning inline on card */}
                  {(course.expiry_status === "expiring_soon" || course.expiry_status === "grace_period") && course.end_date && (() => {
                    const deleteDate = new Date(course.end_date);
                    deleteDate.setDate(deleteDate.getDate() + 30);
                    return (
                      <div className={`mt-3 rounded-md border px-3 py-2 text-xs ${
                        course.expiry_status === "grace_period"
                          ? "bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-300"
                          : "bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-300"
                      }`}>
                        Download submissions by{" "}
                        <strong>{fmtToronto(deleteDate.toISOString())}</strong>{" "}
                        — data deleted after that date.
                      </div>
                    );
                  })()}

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
              Update details for {editCourse?.code}. The end date is locked
              after creation — contact your admin if it needs to be changed.
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

/** Format a date string in Toronto timezone so it always shows the correct local date. */
function fmtToronto(dateStr: string, opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" }) {
  return new Date(dateStr).toLocaleDateString("en-CA", { timeZone: "America/Toronto", ...opts });
}

/** Mirror of the backend _compute_term logic for live preview in the form. */
function inferTermLabel(endDateStr: string): string {
  const today = new Date();
  const end = new Date(endDateStr);

  const termForMonth = (m: number) => {
    if (m <= 3) return "Winter";   // Jan–Apr (0-indexed: 0-3)
    if (m <= 6) return "Summer";   // May–Jul (0-indexed: 4-6)
    return "Fall";                 // Aug–Dec (0-indexed: 7-11)
  };

  const startTerm = termForMonth(today.getMonth());
  const endTerm = termForMonth(end.getMonth());
  const startYear = today.getFullYear();
  const endYear = end.getFullYear();

  if (startTerm === endTerm && startYear === endYear) return `${endTerm} ${endYear}`;
  if (startYear === endYear) return `${startTerm}/${endTerm} ${endYear}`;
  return `${startTerm}/${endTerm} ${startYear}-${endYear}`;
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
  const [description, setDescription] = React.useState(
    course?.description || "",
  );
  // end_date is only settable at creation time; locked thereafter.
  // term is auto-computed by the backend from the end_date.
  const [endDate, setEndDate] = React.useState("");
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
            description: description || null,
          }),
        });
      } else {
        await apiFetch("/api/instructor/courses", {
          method: "POST",
          body: JSON.stringify({
            code,
            title,
            description: description || null,
            end_date: endDate ? new Date(endDate).toISOString() : undefined,
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

      {/* End date — only shown (and required) during course creation */}
      {!isEdit && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="course-end-date">
            Course End Date
            <span className="ml-1 text-xs text-muted-foreground font-normal">
              (cannot be changed after creation)
            </span>
          </Label>
          <input
            id="course-end-date"
            type="date"
            required
            value={endDate}
            min={new Date().toISOString().split("T")[0]}
            onChange={(e) => setEndDate(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {endDate && (
            <p className="text-xs text-muted-foreground">
              Term will be set to{" "}
              <strong>{inferTermLabel(endDate)}</strong>.
              After the end date you have a 30-day window to download
              submissions before student data is automatically deleted.
            </p>
          )}
          {!endDate && (
            <p className="text-xs text-muted-foreground">
              The academic term is determined automatically from the end date.
              After the end date you have a 30-day window to download
              submissions before student data is automatically deleted.
            </p>
          )}
        </div>
      )}

      {/* Read-only end-date display when editing */}
      {isEdit && course.end_date && (
        <div className="flex flex-col gap-2">
          <Label>Course End Date</Label>
          <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
            {fmtToronto(course.end_date, { year: "numeric", month: "long", day: "numeric" })}
            <span className="ml-2 text-xs">(locked — contact admin to change)</span>
          </div>
        </div>
      )}

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
