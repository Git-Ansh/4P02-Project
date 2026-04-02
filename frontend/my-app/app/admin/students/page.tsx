"use client";

import * as React from "react";
import {
  Plus,
  Trash2,
  Pencil,
  Loader2,
  AlertCircle,
  SearchIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { apiFetch, ApiError } from "@/lib/api";

interface CourseInfo {
  id: string;
  code: string;
  title: string;
}

interface StudentRecord {
  id: string;
  full_name: string;
  email: string;
  student_number: string;
  courses: CourseInfo[];
  created_at: string;
}

interface AdminCourse {
  id: string;
  code: string;
  title: string;
  term: string;
}

export default function StudentsPage() {
  const [students, setStudents] = React.useState<StudentRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editStudent, setEditStudent] = React.useState<StudentRecord | null>(
    null,
  );
  const [search, setSearch] = React.useState("");

  const fetchStudents = React.useCallback(async () => {
    try {
      const data = await apiFetch<StudentRecord[]>("/api/admin/students");
      setStudents(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/admin/students/${id}`, { method: "DELETE" });
      await fetchStudents();
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = React.useMemo(() => {
    if (!search) return students;
    const q = search.toLowerCase();
    return students.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        s.student_number.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q),
    );
  }, [students, search]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Student Records</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Manage student records and course enrollments.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Student
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Student Record</DialogTitle>
              <DialogDescription>
                Create a new student record and assign courses.
              </DialogDescription>
            </DialogHeader>
            <StudentForm
              onSuccess={() => {
                setCreateOpen(false);
                fetchStudents();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 mb-6 max-w-sm">
        <SearchIcon className="h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by name, email, or student number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          {students.length === 0
            ? "No student records yet. Add one to get started."
            : "No students match your search."}
        </p>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Student Number</TableHead>
                  <TableHead>Enrolled Courses</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.full_name}</TableCell>
                    <TableCell>{s.email}</TableCell>
                    <TableCell>{s.student_number}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {s.courses.length === 0 ? (
                          <span className="text-muted-foreground text-sm">
                            None
                          </span>
                        ) : (
                          s.courses.map((c) => (
                            <Badge key={c.id} variant="secondary">
                              {c.code}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditStudent(s)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Delete &quot;{s.full_name}&quot;?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently remove this student record.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(s.id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog
        open={!!editStudent}
        onOpenChange={(open) => !open && setEditStudent(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Student Record</DialogTitle>
            <DialogDescription>
              Update student information and course enrollments.
            </DialogDescription>
          </DialogHeader>
          {editStudent && (
            <StudentForm
              student={editStudent}
              onSuccess={() => {
                setEditStudent(null);
                fetchStudents();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StudentForm({
  student,
  onSuccess,
}: {
  student?: StudentRecord;
  onSuccess: () => void;
}) {
  const isEdit = !!student;
  const [fullName, setFullName] = React.useState(student?.full_name || "");
  const [email, setEmail] = React.useState(student?.email || "");
  const [studentNumber, setStudentNumber] = React.useState(
    student?.student_number || "",
  );
  const [selectedCourseIds, setSelectedCourseIds] = React.useState<string[]>(
    student?.courses.map((c) => c.id) || [],
  );
  const [courses, setCourses] = React.useState<AdminCourse[]>([]);
  const [loadingCourses, setLoadingCourses] = React.useState(true);
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    apiFetch<AdminCourse[]>("/api/admin/courses")
      .then(setCourses)
      .catch(console.error)
      .finally(() => setLoadingCourses(false));
  }, []);

  const toggleCourse = (courseId: string) => {
    setSelectedCourseIds((prev) =>
      prev.includes(courseId)
        ? prev.filter((id) => id !== courseId)
        : [...prev, courseId],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const payload = {
        full_name: fullName,
        email,
        student_number: studentNumber,
        course_ids: selectedCourseIds,
      };

      if (isEdit) {
        await apiFetch(`/api/admin/students/${student.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/api/admin/students", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save");
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
        <Label htmlFor="student-name">Full Name</Label>
        <input
          id="student-name"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Jane Smith"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="student-email">Email</Label>
        <input
          id="student-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="student@university.ca"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="student-number">Student Number</Label>
        <input
          id="student-number"
          required
          value={studentNumber}
          onChange={(e) => setStudentNumber(e.target.value)}
          placeholder="7123456"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Enrolled Courses</Label>
        {loadingCourses ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading courses...
          </div>
        ) : courses.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No courses available.
          </p>
        ) : (
          <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-1">
            {courses.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedCourseIds.includes(c.id)}
                  onChange={() => toggleCourse(c.id)}
                  className="rounded border-input"
                />
                <span className="text-sm font-medium">{c.code}</span>
                <span className="text-sm text-muted-foreground">
                  — {c.title}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
      <Button type="submit" disabled={submitting} className="mt-2">
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isEdit ? "Save Changes" : "Add Student"}
      </Button>
    </form>
  );
}
