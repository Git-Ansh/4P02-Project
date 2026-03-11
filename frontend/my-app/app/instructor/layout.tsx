"use client";

import {
  LayoutDashboard,
  GraduationCap,
  FileSearch,
  ClipboardList,
} from "lucide-react";
import { UniversityLayout } from "@/components/university-layout";

const navItems = [
  {
    href: "/instructor",
    label: "Dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: "/instructor/courses",
    label: "Courses",
    icon: GraduationCap,
  },
  {
    href: "/instructor/submissions",
    label: "Submissions",
    icon: ClipboardList,
  },
  {
    href: "/instructor/compare",
    label: "Compare",
    icon: FileSearch,
  },
];

export default function InstructorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <UniversityLayout navItems={navItems}>{children}</UniversityLayout>;
}
