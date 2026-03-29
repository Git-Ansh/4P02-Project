"use client";
import * as React from "react";
import { Users, UserCheck, GraduationCap, UserPlus, BookOpen, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";

interface AdminStats {
  instructor_count: number;
  student_record_count: number;
  course_count: number;
}

const recentActivity = [
  { color: "bg-green-500", text: "New student registered", entity: "Sara John", time: "2 minutes ago" },
  { color: "bg-blue-500", text: "Instructor added a course", entity: "Algorithms III", time: "15 minutes ago" },
  { color: "bg-amber-500", text: "Course updated", entity: "Data Structures syllabus changed", time: "1 hour ago" },
  { color: "bg-green-500", text: "New instructor onboarded", entity: "Dr. Neelam R.", time: "3 hours ago" },
  { color: "bg-blue-500", text: "Student record updated", entity: "Aman S.", time: "Yesterday" },
];

const courses = [
  { name: "Data Structures", instructor: "Dr. Neelam S.", students: 38, status: "Active" },
  { name: "Web Development", instructor: "Mr. Jacob R.", students: 45, status: "Full" },
  { name: "Database Systems", instructor: "Dr. Sara M.", students: 29, status: "Active" },
  { name: "Algorithms III", instructor: "Prof. Amrita T.", students: null, status: "Draft" },
];

const statusStyles: Record<string, string> = {
  Active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  Full: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  Draft: "bg-muted text-muted-foreground",
};

export default function AdminDashboard() {
  const [stats, setStats] = React.useState<AdminStats | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    apiFetch<AdminStats>("/api/admin/dashboard")
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    {
      title: "Instructors",
      value: stats?.instructor_count ?? "-",
      icon: Users,
      delta: "+2 added this semester",
      iconClass: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    },
    {
      title: "Student Records",
      value: stats?.student_record_count ?? "-",
      icon: UserCheck,
      delta: "+18 enrolled this month",
      iconClass: "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400",
    },
    {
      title: "Courses",
      value: stats?.course_count ?? "-",
      icon: GraduationCap,
      delta: "+4 created this semester",
      iconClass: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
    },
  ];

  const quickActions = [
    { label: "Add Instructor", icon: UserPlus, href: "/admin/instructors/new" },
    { label: "Add Student", icon: UserCheck, href: "/admin/students/new" },
    { label: "Create Course", icon: BookOpen, href: "/admin/courses/new" },
  ];

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">

      {/* Topbar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400 px-3 py-1.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Live data
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.title} className="hover:shadow-sm transition-shadow border">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <span className="text-sm font-medium text-muted-foreground">{card.title}</span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.iconClass}`}>
                <card.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-3xl font-semibold tracking-tight">
                {loading ? "..." : card.value}
              </div>
              <div className="flex items-center gap-1 mt-1.5">
                <TrendingUp className="h-3 w-3 text-green-500" />
                <span className="text-xs text-muted-foreground">{card.delta}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Activity + Quick Actions */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Recent Activity */}
        <Card className="border">
          <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
            <CardTitle className="text-sm font-semibold">Recent Activity</CardTitle>
            <button className="text-xs text-primary hover:underline">View all</button>
          </CardHeader>
          <CardContent className="pt-0 divide-y divide-border">
            {recentActivity.map((item, i) => (
              <div key={i} className="flex items-start gap-3 py-3">
                <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${item.color}`} />
                <div>
                  <p className="text-sm text-foreground">
                    {item.text} — <span className="font-medium">{item.entity}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.time}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="border">
          <CardHeader className="border-b pb-3">
            <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 flex flex-col gap-2">
            {quickActions.map((action) => (
              <a
                key={action.label}
                href={action.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-muted/40 hover:bg-muted hover:border-border/80 transition-colors text-sm font-medium text-foreground"
              >
                <action.icon className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">{action.label}</span>
                <span className="text-muted-foreground text-base leading-none">›</span>
              </a>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Course Overview Table */}
      <Card className="border">
        <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
          <CardTitle className="text-sm font-semibold">Course Overview</CardTitle>
          <a href="/admin/courses" className="text-xs text-primary hover:underline">
            View all courses
          </a>
        </CardHeader>
        <CardContent className="pt-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground uppercase tracking-wide">
                <th className="text-left py-3 font-medium">Course</th>
                <th className="text-left py-3 font-medium">Instructor</th>
                <th className="text-left py-3 font-medium">Students</th>
                <th className="text-left py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {courses.map((course) => (
                <tr key={course.name} className="hover:bg-muted/30 transition-colors">
                  <td className="py-3 font-medium">{course.name}</td>
                  <td className="py-3 text-muted-foreground">{course.instructor}</td>
                  <td className="py-3 text-muted-foreground">{course.students ?? "—"}</td>
                  <td className="py-3">
                    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${statusStyles[course.status]}`}>
                      {course.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

    </div>
  );
}
