"use client";
import * as React from "react";
import { Users, GraduationCap, Eye, BookOpen, FileCheck, Mail, Moon, ClipboardList, CheckCircle, XCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface RevealRequest {
  id: string;
  instructor_name: string;
  instructor_email: string;
  course_code: string;
  assignment_title: string;
  assignment_description: string;
  justification: string;
  pair_id: string;
  requested_at: string;
}

interface AdminStats {
  instructor_count: number;
  course_count: number;
}
interface CourseEntry {
  id: string;
  code: string;
  title: string;
  term: string;
  instructor_name: string;
  instructor_email: string;
}

interface CourseDetails {
  assignment_count: number;
  submission_count: number;
}
interface InstructorGroup {
  email: string;
  name: string;
  courses: CourseEntry[];
  assignmentsByCourse: Record<string, number>;
  submissionsByCourse: Record<string, number>;
  detailsLoaded: boolean;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good Morning, Admin!";
  if (hour >= 12 && hour < 17) return "Good Afternoon, Admin!";
  if (hour >= 17 && hour < 21) return "Good Evening, Admin!";
  return "Still at it, Admin?";
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function AdminDashboard() {
  const [stats, setStats] = React.useState<AdminStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [instructorGroups, setInstructorGroups] = React.useState<InstructorGroup[]>([]);
  const [showRevealModal, setShowRevealModal] = React.useState(false);
  const [revealRequests, setRevealRequests] = React.useState<RevealRequest[]>([]);
  const [revealLoading, setRevealLoading] = React.useState(false);
  const [resolvingId, setResolvingId] = React.useState<string | null>(null);
  const hour = new Date().getHours();

  const openRevealModal = () => {
    setShowRevealModal(true);
    setRevealLoading(true);
    apiFetch<RevealRequest[]>("/api/admin/reveal-requests")
      .then(setRevealRequests)
      .catch(console.error)
      .finally(() => setRevealLoading(false));
  };

  const handleResolve = async (id: string, action: "approve" | "decline") => {
    setResolvingId(id);
    try {
      await apiFetch(`/api/admin/reveal-requests/${id}/${action}`, { method: "POST" });
      setRevealRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error(err);
    } finally {
      setResolvingId(null);
    }
  };

  React.useEffect(() => {
    apiFetch<AdminStats>("/api/admin/dashboard")
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
    apiFetch<CourseEntry[]>("/api/admin/courses")
      .then(async (courses) => {
        // group by instructor email
        const groupMap: Record<string, InstructorGroup> = {};
        for (const course of courses) {
          const key = course.instructor_email;
          if (!groupMap[key]) {
            groupMap[key] = {
              email: key,
              name: course.instructor_name,
              courses: [],
              assignmentsByCourse: {},
              submissionsByCourse: {},
              detailsLoaded: false,
            };
          }
          groupMap[key].courses.push(course);
        }
        const groups = Object.values(groupMap);
        setInstructorGroups(groups);
        // fetch per-course details and merge into state as they load
        for (const group of groups) {
          for (const course of group.courses) {
            apiFetch<CourseDetails>(`/api/admin/courses/${course.id}/details`)
              .then((details) => {
                setInstructorGroups((prev) => prev.map((g) => {
                  if (g.email !== group.email) return g;
                  return {
                    ...g,
                    assignmentsByCourse: { ...g.assignmentsByCourse, [course.id]: details.assignment_count },
                    submissionsByCourse: { ...g.submissionsByCourse, [course.id]: details.submission_count },
                    detailsLoaded: true,
                  };
                }));
              })
              .catch(console.error);
          }
        }
      })
      .catch(console.error);
  }, []);

  return (
    <div className="min-h-screen bg-background hud-grid">
      <div className="border-b border-border/50 px-6 lg:px-10 py-6 flex items-center justify-between" style={{ background: "linear-gradient(180deg, hsl(var(--card) / 0.5) 0%, transparent 100%)" }}>
        <div className="flex items-center gap-4">
          <span className="pulse-dot shrink-0" />
          <div>
            <p className="text-[10px] font-jb uppercase tracking-[0.2em] text-primary/70 mb-1">Admin Console</p>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              {getGreeting()}
              {(hour >= 21 || hour < 5) && <Moon className="h-6 w-6 text-indigo-400" />}
            </h1>
          </div>
        </div>
        <button
          onClick={openRevealModal}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow transition-colors"
        >
          <Eye className="h-5 w-5" />
          Reveal Identity Request
        </button>
      </div>
      <div className="px-6 lg:px-10 py-8 flex flex-col gap-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="rounded-xl glass glow-hover accent-line card-stagger p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground font-jb">Total Instructors</p>
                <p className="text-4xl font-bold font-jb neon-num mt-1">{loading ? "—" : (stats?.instructor_count ?? "-")}</p>
              </div>
              <div className="rounded-lg bg-primary/10 border border-primary/20 p-2.5">
                <Users className="h-5 w-5 text-primary" />
              </div>
            </div>
          </div>
          <div className="rounded-xl glass glow-hover accent-line card-stagger p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground font-jb">Active Courses</p>
                <p className="text-4xl font-bold font-jb neon-num mt-1">{loading ? "—" : (stats?.course_count ?? "-")}</p>
              </div>
              <div className="rounded-lg bg-primary/10 border border-primary/20 p-2.5">
                <GraduationCap className="h-5 w-5 text-primary" />
              </div>
            </div>
          </div>
        </div>

    {instructorGroups.length > 0 && (
        <div>
          <div className="bg-card border border-border/50 shadow-md rounded-xl px-5 py-3 mb-5">
            <h2 className="text-xl font-bold">Instructors & Courses</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Overview of all instructors and their assigned courses</p>
          </div>
        <div className="flex flex-col gap-6">

    {instructorGroups.map((group) => {
      const totalAssignments = Object.values(group.assignmentsByCourse).reduce((a, b) => a + b, 0);
      const totalSubmissions = Object.values(group.submissionsByCourse).reduce((a, b) => a + b, 0);
      return (
      <div key={group.email} className="flex gap-5 items-stretch">
        <div className="flex-shrink-0 rounded-2xl overflow-hidden shadow-md bg-card border border-slate-100 dark:border-zinc-700" style={{ width: "320px" }}>
          <div className="h-20 bg-gradient-to-r from-red-600 to-rose-500 dark:from-primary/30 dark:to-primary/10 relative">
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2">
              <div className="w-16 h-16 rounded-full bg-card flex items-center justify-center ring-4 ring-card shadow-xl">
                <span className="text-xl font-bold text-red-600 dark:text-white">{getInitials(group.name || "?")}</span>
              </div>
            </div>
          </div>

        <div className="pt-10 px-5 pb-5 flex flex-col items-center gap-1">
          <p className="font-bold text-xl text-center leading-tight">{group.name}</p>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Mail className="h-3 w-3" />
            <span className="truncate max-w-[180px]">{group.email}</span>
          </div>

          <div className="w-full mt-4 grid grid-cols-2 rounded-xl overflow-hidden border border-border/50 bg-muted">
            <div className="flex flex-col items-center py-3">
              <span className="text-base font-bold">{group.courses.length}</span>
                <span className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap">Courses</span>
          </div>

          <div className="flex flex-col items-center py-3 border-l border-border/50">
            <span className="text-base font-bold">{group.detailsLoaded ? totalAssignments : "…"}</span>
            <span className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap">Total Assignments</span>
          </div>
          </div>

          <div className="w-full mt-3 flex items-center justify-between bg-muted border border-border/50 rounded-xl px-4 py-2.5">
            <div className="flex items-center gap-1.5">
              <FileCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs text-foreground font-medium">Total Submissions</span>
            </div>
            <span className="text-sm font-bold">{group.detailsLoaded ? totalSubmissions : "…"}</span>
          </div>
          </div>
          </div>

          <div className="flex-1 rounded-2xl overflow-hidden shadow-md bg-card border border-slate-100 dark:border-zinc-700">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-700 flex items-center justify-between">
              <p className="font-bold text-lg">Courses</p>
                <span className="text-sm bg-muted text-muted-foreground px-2.5 py-0.5 rounded-full font-medium border border-border/50">
                  {group.courses.length} total
                </span>
            </div>

         {/* scroll only if more than 2 courses */}
            <div className={`p-5 flex flex-col gap-4 ${group.courses.length > 2 ? "max-h-80 overflow-y-auto" : ""}`}>
              {group.courses.map((c) => (
            <div key={c.id} className="rounded-xl border border-border/50 overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3.5 bg-muted">
                <div className="w-9 h-9 rounded-lg bg-red-600 dark:bg-red-600 flex items-center justify-center flex-shrink-0">
                  <GraduationCap className="h-4 w-4 text-white" />
                </div>
                  <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-bold">{c.code}</span>
                    <span className="text-base text-muted-foreground truncate">— {c.title}</span>
                  </div>
                    {c.term && (<span className="inline-block mt-0.5 text-xs font-medium bg-muted text-foreground px-2 py-0.5 rounded-full">{c.term}</span> )}
                  </div>
              </div>
              <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-zinc-700 bg-card">
                  <div className="flex items-center gap-2.5 px-5 py-3">
                    <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <BookOpen className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                    </div>
                  <div>
                    <p className="text-base font-bold leading-none">{group.detailsLoaded ? (group.assignmentsByCourse[c.id] ?? 0) : "…"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Assignments</p>
                  </div>
                  </div>
              <div className="flex items-center gap-2.5 px-5 py-3">
                <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <FileCheck className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-base font-bold leading-none">{group.detailsLoaded ? (group.submissionsByCourse[c.id] ?? 0) : "…"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Submissions</p>
                </div>
              </div>
              </div>
              </div>
              ))}
            </div>
            </div>
          </div>
          );
        })}
        </div>
      </div>
    )}
  </div>

      {showRevealModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl p-6 border border-border/50 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-red-600" />
                <h2 className="text-lg font-semibold">Reveal Identity Requests</h2>
              </div>
              <button onClick={() => setShowRevealModal(false)} className="text-muted-foreground hover:text-foreground text-2xl leading-none">×</button>
            </div>
            <div className="overflow-y-auto flex-1">
              {revealLoading ? (
                <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
              ) : revealRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No pending requests.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {revealRequests.map((req) => (
                    <div key={req.id} className="rounded-xl border border-border/50 p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="font-semibold text-sm">{req.instructor_name}</p>
                          <p className="text-xs text-muted-foreground">{req.instructor_email}</p>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {new Date(req.requested_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="bg-muted rounded-lg px-3 py-2">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Course</p>
                          <p className="text-sm font-medium">{req.course_code}</p>
                        </div>
                        <div className="bg-muted rounded-lg px-3 py-2">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Assignment</p>
                          <p className="text-sm font-medium">{req.assignment_title || "—"}</p>
                        </div>
                      </div>
                      {req.assignment_description && (
                        <div className="mb-3">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Description</p>
                          <p className="text-xs text-muted-foreground">{req.assignment_description}</p>
                        </div>
                      )}
                      <div className="mb-4">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Justification</p>
                        <p className="text-sm">{req.justification}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleResolve(req.id, "approve")}
                          disabled={resolvingId === req.id}
                          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleResolve(req.id, "decline")}
                          disabled={resolvingId === req.id}
                          className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                        >
                          <XCircle className="h-4 w-4" />
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
