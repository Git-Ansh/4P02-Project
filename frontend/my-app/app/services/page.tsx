"use client";
import { TronGridBackground } from "@/components/tron-grid-background"
import {
  GraduationCap,
  Users,
  UserCheck,
  BookOpen,
  BarChart2,
  ShieldCheck,
} from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

const services = [
  {
    icon: GraduationCap,
    title: "Course Management",
    description:
      "Create, update, and manage courses across all departments. Instructors can publish syllabi, set enrollment limits, and track progress in real time.",
    iconClass: "bg-blue-50 text-blue-600",
  },
  {
    icon: Users,
    title: "Instructor Portal",
    description:
      "A dedicated space for instructors to manage their courses, view enrolled students, and update course materials — all from one place.",
    iconClass: "bg-amber-50 text-amber-600",
  },
  {
    icon: UserCheck,
    title: "Student Records",
    description:
      "Maintain accurate and up-to-date student records. Admins can enroll students, track academic history, and manage registrations effortlessly.",
    iconClass: "bg-green-50 text-green-600",
  },
  {
    icon: BookOpen,
    title: "Course Enrollment",
    description:
      "Students can browse available courses and enroll with ease. The system handles capacity limits, prerequisites, and confirmation automatically.",
    iconClass: "bg-purple-50 text-purple-600",
  },
  {
    icon: BarChart2,
    title: "Admin Dashboard",
    description:
      "A powerful overview for administrators — monitor instructors, students, and courses at a glance with live data and quick action shortcuts.",
    iconClass: "bg-rose-50 text-rose-600",
  },
  {
    icon: ShieldCheck,
    title: "Role-Based Access",
    description:
      "Secure, role-specific portals for admins, instructors, and students. Each user sees only what they need — nothing more, nothing less.",
    iconClass: "bg-teal-50 text-teal-600",
  },
];

export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-background">
      <TronGridBackground />
      <Header />

      {/* Hero */}
      <section className="border-b border-border bg-muted/30">
        <div className="max-w-4xl mx-auto px-6 py-20 text-center">
          <span className="inline-block text-xs font-medium tracking-widest uppercase text-muted-foreground mb-4">
            What we offer
          </span>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground mb-4">
            Everything your academic institution needs
          </h1>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Academic FBI brings together course management, student records, and
            instructor tools into one clean, easy-to-use platform — built for
            universities, designed for people.
          </p>
        </div>
      </section>

      {/* Services grid */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <div
              key={service.title}
              className="group rounded-xl border border-border bg-card p-6 hover:shadow-sm transition-shadow"
            >
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${service.iconClass}`}
              >
                <service.icon className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-2">
                {service.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {service.description}
              </p>
            </div>
          ))}
        </div>
      </section>


      <Footer />
    </div>
  );
}