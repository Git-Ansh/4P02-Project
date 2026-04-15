"use client";
import { TronGridBackground } from "@/components/tron-grid-background"
import {
  Search,
  ShieldCheck,
  FileCode,
  Eye,
  Upload,
  BarChart2,
  Lock,
  GitCompare,
  Clock,
} from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

const services = [
  {
    icon: Search,
    title: "Similarity Analysis Engine",
    description:
      "AST-based code comparison using tree-sitter tokenization, adaptive k-gram hashing, and IDF-weighted Jaccard similarity. Detects structural plagiarism even when variable names, comments, and formatting are changed.",
    iconClass: "bg-blue-500/10 text-blue-500",
  },
  {
    icon: GitCompare,
    title: "Side-by-Side Diff Viewer",
    description:
      "Review flagged pairs in a responsive split-panel viewer with block highlighting, confidence-level coloring (HIGH / MEDIUM / LOW), hover tooltips, and block-by-block navigation.",
    iconClass: "bg-amber-500/10 text-amber-500",
  },
  {
    icon: FileCode,
    title: "Cross-Year Reference Comparison",
    description:
      "Upload previous years' submissions as reference repositories. The engine compares current students against historical work to catch recycled assignments across semesters.",
    iconClass: "bg-green-500/10 text-green-500",
  },
  {
    icon: ShieldCheck,
    title: "Boilerplate Filtering",
    description:
      "Upload instructor-provided starter code as boilerplate. The engine fingerprints template code and excludes matching patterns from similarity scores, eliminating false positives.",
    iconClass: "bg-purple-500/10 text-purple-500",
  },
  {
    icon: Eye,
    title: "Anonymous Review & Identity Reveal",
    description:
      "All analysis results use anonymous labels (Student A, Student B). Real student identities are encrypted and only disclosed through a formal reveal request approved by the university admin.",
    iconClass: "bg-rose-500/10 text-rose-500",
  },
  {
    icon: Lock,
    title: "Encrypted Submissions",
    description:
      "Student files are AES-128 encrypted at rest using Fernet. Student identity fields are encrypted in the database. Submission folders use hashed IDs instead of plaintext student numbers.",
    iconClass: "bg-teal-500/10 text-teal-500",
  },
  {
    icon: Upload,
    title: "ZIP-Based Submission Portal",
    description:
      "Students upload code as ZIP files through a token-authenticated portal. No account required — just an assignment key from the instructor. Supports C, C++, and Java.",
    iconClass: "bg-indigo-500/10 text-indigo-500",
  },
  {
    icon: BarChart2,
    title: "Instructor Dashboard",
    description:
      "At-a-glance overview of courses, submissions, and flagged pairs with severity breakdowns. Quick-launch analysis directly from the dashboard without navigating to individual assignments.",
    iconClass: "bg-orange-500/10 text-orange-500",
  },
  {
    icon: Clock,
    title: "Course Expiry & Data Cleanup",
    description:
      "Courses have configurable end dates with a 30-day grace period. After expiry, submission data is automatically purged to comply with data retention policies and free storage.",
    iconClass: "bg-cyan-500/10 text-cyan-500",
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
            Platform Capabilities
          </span>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground mb-4">
            Code plagiarism detection, built for universities
          </h1>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Academic FBI provides a complete pipeline from student submission to
            similarity analysis — with encrypted storage, anonymous review, and
            cross-year comparison. No external AI services. No code execution.
          </p>
        </div>
      </section>

      {/* Services grid */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <div
              key={service.title}
              className="group rounded-xl border border-border bg-card p-6 hover:border-primary/25 hover:bg-primary/[0.02] transition-all"
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
