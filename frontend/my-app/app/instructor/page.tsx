"use client";

import * as React from "react";
import Link from "next/link";
import {
  GraduationCap,
  Loader2,
  ClipboardList,
  AlertTriangle,
  FileSearch,
  ArrowRight,
  BookOpen,
  Clock3,
  CheckCircle2,
  Users,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

interface InstructorStats {
  course_count: number;
}

interface DashboardCourse {
  id: string;
  title: string;
  students: number;
  submissions: number;
  pendingReviews: number;
}

interface ActivityItem {
  id: string;
  message: string;
  time: string;
}

export default function InstructorDashboard() {
  const [stats, setStats] = React.useState<InstructorStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [name, setName] = React.useState("");

  React.useEffect(() => {
    const user = getCurrentUser();
    if (user?.sub) {
      setName(user.sub.split("@")[0]);
    }

    apiFetch<InstructorStats>("/api/instructor/dashboard")
      .then((data) => {
        setStats(data);
        setError("");
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load dashboard data.");
      })
      .finally(() => setLoading(false));
  }, []);

  // Mock summary (safe)
  const mockSummary = {
    totalSubmissions: 24,
    pendingReviews: 7,
    lateSubmissions: 3,
    flaggedComparisons: 2,
  };

  // ✅ ANONYMIZED recent activity (no student names)
  const recentActivity: ActivityItem[] = [
    {
      id: "1",
      message: "A student submitted Assignment 1.",
      time: "10 minutes ago",
    },
    {
      id: "2",
      message: "Comparison completed for two submissions.",
      time: "35 minutes ago",
    },
    {
      id: "3",
      message: "Two late submissions were detected in Assignment 2.",
      time: "1 hour ago",
    },
    {
      id: "4",
      message: "A submission was marked as reviewed.",
      time: "2 hours ago",
    },
  ];

  const courses: DashboardCourse[] = [
    {
      id: "c1",
      title: "COSC 2P03 - Data Structures",
      students: 42,
      submissions: 18,
      pendingReviews: 5,
    },
    {
      id: "c2",
      title: "COSC 3P32 - Database Systems",
      students: 36,
      submissions: 21,
      pendingReviews: 2,
    },
    {
      id: "c3",
      title: "COSC 4P01 - Software Engineering",
      students: 28,
      submissions: 14,
      pendingReviews: 4,
    },
  ];

  const cards = [
    {
      title: "My Courses",
      value: stats?.course_count ?? "-",
      description: "Courses assigned to you",
      icon: GraduationCap,
    },
    {
      title: "Total Submissions",
      value: mockSummary.totalSubmissions,
      description: "Across active assignments",
      icon: ClipboardList,
    },
    {
      title: "Pending Reviews",
      value: mockSummary.pendingReviews,
      description: "Submissions awaiting review",
      icon: Clock3,
    },
    {
      title: "Late Submissions",
      value: mockSummary.lateSubmissions,
      description: "Require attention",
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8">
      <section className="rounded-2xl border bg-background p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-bold tracking-tight">
              Welcome{name ? `, ${name}` : ""}
            </h1>
            <p className="mt-2 text-muted-foreground">
              Manage your courses, review submissions, and monitor comparison
              activity from one place.
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
              <Link href="/instructor/submissions">Review Submissions</Link>
            </Button>

            <Button asChild variant="outline">
              <Link href="/instructor/compare">Start Comparison</Link>
            </Button>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <Card className="border-destructive/30">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-destructive">{error}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
              <Card key={card.title} className="rounded-2xl shadow-sm">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                  <div>
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {card.title}
                    </CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {card.description}
                    </p>
                  </div>
                  <div className="rounded-xl bg-primary/10 p-2">
                    <card.icon className="h-5 w-5 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{card.value}</div>
                </CardContent>
              </Card>
            ))}
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <Button asChild variant="outline" className="justify-between">
                  <Link href="/instructor/courses">
                    Manage Courses
                    <BookOpen className="h-4 w-4" />
                  </Link>
                </Button>

                <Button asChild variant="outline" className="justify-between">
                  <Link href="/instructor/submissions">
                    Open Submissions
                    <ClipboardList className="h-4 w-4" />
                  </Link>
                </Button>

                <Button asChild variant="outline" className="justify-between">
                  <Link href="/instructor/compare">
                    Compare Submissions
                    <FileSearch className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {recentActivity.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-4 rounded-xl border p-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-full bg-primary/10 p-2">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{item.message}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.time}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Course Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {courses.map((course) => (
                  <div
                    key={course.id}
                    className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">{course.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {course.students} students • {course.submissions} submissions •{" "}
                        {course.pendingReviews} pending reviews
                      </p>
                    </div>
                    <Button asChild size="sm">
                      <Link href="/instructor/courses">Open</Link>
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Alerts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3 rounded-xl border p-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Pending reviews</p>
                    <p className="text-xs text-muted-foreground">
                      {mockSummary.pendingReviews} submissions to review
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-xl border p-3">
                  <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Late submissions</p>
                    <p className="text-xs text-muted-foreground">
                      {mockSummary.lateSubmissions} late submissions detected
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-xl border p-3">
                  <FileSearch className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Flagged comparisons</p>
                    <p className="text-xs text-muted-foreground">
                      {mockSummary.flaggedComparisons} pairs flagged
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}