"use client";

import {
  LayoutDashboard,
  GraduationCap,
  Users,
} from "lucide-react";
import { UniversityLayout } from "@/components/university-layout";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/instructors", label: "Instructors", icon: Users },
  { href: "/admin/courses", label: "Courses", icon: GraduationCap },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <UniversityLayout navItems={navItems}>{children}</UniversityLayout>;
}
