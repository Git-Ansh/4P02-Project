"use client";

import {
  LayoutDashboard,
  GraduationCap,
  Shield,
} from "lucide-react";
import { UniversityLayout } from "@/components/university-layout";

const navItems = [
  { href: "/instructor", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/instructor/courses", label: "Courses", icon: GraduationCap },
  { href: "/instructor/analysis", label: "Analysis", icon: Shield },
];

export default function InstructorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <UniversityLayout navItems={navItems}>{children}</UniversityLayout>;
}
