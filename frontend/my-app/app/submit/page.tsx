"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Code2, Loader2, AlertCircle, CheckCircle2, Archive } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  getUniversityTheme,
  buildThemeStyle,
  type UniversityTheme,
} from "@/lib/university-theme";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Language = "c" | "cpp" | "java" | "python";

interface AssignmentInfo {
  university_name: string;
  university_slug: string;
  instructor_name: string;
  course_code: string;
  course_title: string;
  assignment_id: string;
  assignment_title: string;
  assignment_description: string | null;
  due_date: string | null;
  max_score: number;
  allow_resubmission: boolean;
  language: string;
}

interface SubmissionReceipt {
  id: string;
  submitted_at: string;
  files: { name: string; size: number }[];
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

const LANGUAGE_LABELS: Record<string, string> = {
  c: "C",
  cpp: "C++",
  java: "Java",
  python: "Python",
};

function getLanguageLabel(lang: string | undefined): string {
  if (!lang) return "";
  return LANGUAGE_LABELS[lang] || lang.toUpperCase();
}

function getAllowedExts(lang: Language | ""): string[] {
  if (lang === "c") return [".c", ".h", ".zip"];
  if (lang === "cpp")
    return [".cpp", ".cc", ".cxx", ".h", ".hpp", ".hh", ".hxx", ".zip"];
  if (lang === "java") return [".java", ".zip"];
  if (lang === "python") return [".py", ".zip"];
  return [
    ".c",
    ".h",
    ".cpp",
    ".cc",
    ".cxx",
    ".hpp",
    ".hh",
    ".hxx",
    ".java",
    ".py",
    ".zip",
  ];
}

function fileHasAllowedExt(fileName: string, allowed: string[]) {
  const lower = fileName.toLowerCase();
  return allowed.some((ext) => lower.endsWith(ext));
}

export default function SubmitPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const universitySlug = searchParams.get("university") || "";

  // Stages: "token" | "form" | "done"
  const [stage, setStage] = React.useState<"token" | "form" | "done">("token");

  // Token stage
  const [token, setToken] = React.useState("");
  const [verifying, setVerifying] = React.useState(false);
  const [tokenError, setTokenError] = React.useState("");

  // Assignment info (decoded from token)
  const [assignment, setAssignment] = React.useState<AssignmentInfo | null>(
    null,
  );

  // Form stage
  const [studentName, setStudentName] = React.useState("");
  const [studentEmail, setStudentEmail] = React.useState("");
  const [studentNumber, setStudentNumber] = React.useState("");
  const [comment, setComment] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [dragActive, setDragActive] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Done stage
  const [receipt, setReceipt] = React.useState<SubmissionReceipt | null>(null);

  // University theme
  const [theme, setTheme] = React.useState<UniversityTheme | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const assignmentLanguage = (assignment?.language || "") as Language | "";
  const allowedExts = React.useMemo(() => getAllowedExts(assignmentLanguage), [assignmentLanguage]);

  React.useEffect(() => {
    if (universitySlug) {
      getUniversityTheme(universitySlug).then(setTheme);
    }
  }, [universitySlug]);

  const themeStyle = React.useMemo(() => buildThemeStyle(theme), [theme]);

  // Apply theme to body
  React.useEffect(() => {
    const entries = Object.entries(themeStyle);
    if (entries.length === 0) return;
    for (const [key, value] of entries) {
      document.body.style.setProperty(key, value as string);
    }
    document.body.classList.add("university-theme");
    return () => {
      for (const [key] of entries) {
        document.body.style.removeProperty(key);
      }
      document.body.classList.remove("university-theme");
    };
  }, [themeStyle]);

  // ── Token verification ────────────────────────────────────────────────────

  const verifyToken = async () => {
    if (!token.trim()) {
      setTokenError("Please enter a submission token.");
      return;
    }
    setVerifying(true);
    setTokenError("");
    try {
      const res = await fetch(
        `${API_BASE}/api/public/assignment?token=${encodeURIComponent(token.trim())}`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "Invalid or expired token");
      }
      const data: AssignmentInfo = await res.json();
      setAssignment(data);
      setStage("form");
    } catch (err: unknown) {
      setTokenError(
        err instanceof Error ? err.message : "Failed to verify token",
      );
    } finally {
      setVerifying(false);
    }
  };

  // ── File handling ─────────────────────────────────────────────────────────

  function addFiles(newOnes: File[]) {
    setSubmitError(null);
    const existingKey = new Set(
      files.map((f) => `${f.name}|${f.size}|${f.lastModified}`),
    );
    const merged: File[] = [...files];
    for (const f of newOnes) {
      const key = `${f.name}|${f.size}|${f.lastModified}`;
      if (!existingKey.has(key)) merged.push(f);
    }
    setFiles(merged);
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files ? Array.from(e.target.files) : [];
    if (list.length) addFiles(list);
    e.target.value = "";
  }

  function removeAt(index: number) {
    setSubmitError(null);
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function clearAll() {
    setSubmitError(null);
    setFiles([]);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const dropped = e.dataTransfer.files
      ? Array.from(e.dataTransfer.files)
      : [];
    if (dropped.length) addFiles(dropped);
  }

  // ── Validation ────────────────────────────────────────────────────────────

  function validate() {
    if (!studentName.trim()) return "Please enter your name.";
    if (!studentEmail.trim()) return "Please enter your email.";
    if (!studentNumber.trim()) return "Please enter your student number.";
    if (files.length === 0) return "Please attach at least one code file.";

    const maxFileBytes = 5 * 1024 * 1024;
    const maxTotalBytes = 25 * 1024 * 1024;

    let total = 0;
    for (const f of files) {
      total += f.size;
      if (f.size > maxFileBytes)
        return `File "${f.name}" is too large (max 5MB per file).`;
      if (!fileHasAllowedExt(f.name, allowedExts)) {
        return `File "${f.name}" is not allowed for ${assignmentLanguage.toUpperCase()}. Allowed: ${allowedExts.join(", ")}`;
      }
      const lower = f.name.toLowerCase();
      const blocked = [".class", ".jar", ".exe", ".dll", ".o", ".obj", ".so"];
      if (blocked.some((b) => lower.endsWith(b))) {
        return `Compiled/binary files are not allowed: "${f.name}".`;
      }
    }
    if (total > maxTotalBytes) return `Total upload is too large (max 25MB).`;
    return null;
  }

  // ── Submission ────────────────────────────────────────────────────────────

  async function handleSubmit() {
    const v = validate();
    if (v) {
      setSubmitError(v);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const formData = new FormData();
      formData.append("token", token.trim());
      formData.append("student_name", studentName.trim());
      formData.append("student_email", studentEmail.trim());
      formData.append("student_number", studentNumber.trim());
      if (comment.trim()) formData.append("comment", comment.trim());
      for (const f of files) {
        formData.append("files", f);
      }

      const res = await fetch(`${API_BASE}/api/public/submit`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "Submission failed");
      }

      const data = await res.json();
      setReceipt({
        id: data.id,
        submitted_at: data.submitted_at,
        files: data.files,
      });
      setStage("done");
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : "Submission failed. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen flex flex-col university-theme"
      style={themeStyle}
    >
      {/* Header */}
      <div className="border-b">
        <div className="mx-auto max-w-3xl flex items-center justify-between px-4 py-3">
          <Link href="/" className="inline-flex items-center gap-2">
            {theme?.logo_url ? (
              <Image
                src={theme.logo_url}
                alt={theme.name}
                width={32}
                height={32}
                className="rounded"
              />
            ) : (
              <Code2 className="h-6 w-6 text-primary" />
            )}
            <span className="font-semibold text-sm">
              {theme?.name || "AcademicFBI"}
            </span>
          </Link>
          <div className="flex items-center gap-2">
            {stage !== "token" && assignment && (
              <Badge variant="outline">{assignment.course_code}</Badge>
            )}
            <ThemeToggle />
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-3xl space-y-6">
          {/* ── Stage 1: Token Entry ─────────────────────────────────── */}
          {stage === "token" && (
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Submit Assignment</CardTitle>
                <CardDescription>
                  Enter the submission token provided by your instructor.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {tokenError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{tokenError}</AlertDescription>
                  </Alert>
                )}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="token">Submission Token</Label>
                  <input
                    id="token"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Paste your token here..."
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono"
                    onKeyDown={(e) => e.key === "Enter" && verifyToken()}
                  />
                </div>
                <Button
                  onClick={verifyToken}
                  disabled={verifying}
                  className="w-full"
                >
                  {verifying && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Verify Token
                </Button>
              </CardContent>
            </Card>
          )}

          {/* ── Stage 2: Submission Form ─────────────────────────────── */}
          {stage === "form" && assignment && (
            <>
              {/* Assignment Info */}
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle>{assignment.assignment_title}</CardTitle>
                      <CardDescription className="mt-1">
                        {assignment.course_code} — {assignment.course_title}
                      </CardDescription>
                    </div>
                    <Badge variant="outline">
                      {assignment.max_score} pts
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground">
                    <span>
                      Instructor:{" "}
                      <span className="text-foreground">
                        {assignment.instructor_name}
                      </span>
                    </span>
                    {assignment.due_date && (
                      <span>
                        Due:{" "}
                        <span className="text-foreground">
                          {new Date(assignment.due_date).toLocaleString()}
                        </span>
                      </span>
                    )}
                    <span>
                      Resubmission:{" "}
                      <span className="text-foreground">
                        {assignment.allow_resubmission
                          ? "Allowed"
                          : "Not allowed"}
                      </span>
                    </span>
                    <span>
                      Language:{" "}
                      <span className="text-foreground font-medium">
                        {getLanguageLabel(assignment.language)}
                      </span>
                    </span>
                  </div>
                  {assignment.assignment_description && (
                    <>
                      <Separator />
                      <p className="leading-6">
                        {assignment.assignment_description}
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Submission Form */}
              <Card>
                <CardHeader>
                  <CardTitle>Your Submission</CardTitle>
                  <CardDescription>
                    Fill in your details and upload your files.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {submitError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Submission issue</AlertTitle>
                      <AlertDescription>{submitError}</AlertDescription>
                    </Alert>
                  )}

                  {/* Student identity */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="s-name">Full Name</Label>
                      <input
                        id="s-name"
                        required
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        placeholder="Jane Smith"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="s-email">Email</Label>
                      <input
                        id="s-email"
                        type="email"
                        required
                        value={studentEmail}
                        onChange={(e) => setStudentEmail(e.target.value)}
                        placeholder="jane@university.ca"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="s-number">Student Number</Label>
                    <input
                      id="s-number"
                      required
                      value={studentNumber}
                      onChange={(e) => setStudentNumber(e.target.value)}
                      placeholder="7123456"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>

                  {assignmentLanguage && (
                    <div className="text-xs text-muted-foreground">
                      Allowed extensions for{" "}
                      <span className="font-medium">
                        {getLanguageLabel(assignmentLanguage)}
                      </span>:{" "}
                      <span className="font-medium">
                        {allowedExts.join(", ")}
                      </span>
                    </div>
                  )}

                  {/* File upload */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label>Attach files</Label>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => inputRef.current?.click()}
                        >
                          Add files
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={clearAll}
                          disabled={files.length === 0}
                        >
                          Clear
                        </Button>
                      </div>
                    </div>

                    <input
                      ref={inputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={onPick}
                    />

                    <div
                      onDragOver={onDragOver}
                      onDragLeave={onDragLeave}
                      onDrop={onDrop}
                      className={[
                        "rounded-lg border border-dashed p-6 transition",
                        dragActive ? "bg-muted" : "bg-background",
                      ].join(" ")}
                    >
                      <div className="space-y-2 text-center">
                        <div className="text-sm font-medium">
                          Drag and drop files here
                        </div>
                        <div className="text-sm text-muted-foreground">
                          You can select multiple files or a .zip archive.
                        </div>
                        <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Archive className="h-3 w-3" />
                          ZIP files are extracted automatically
                        </div>
                      </div>
                    </div>

                    {files.length > 0 && (
                      <div className="rounded-lg border">
                        <div className="flex items-center justify-between px-4 py-3">
                          <div className="text-sm font-medium">
                            Selected files
                          </div>
                          <Badge variant="outline">{files.length}</Badge>
                        </div>
                        <Separator />
                        <div className="px-4 py-3 space-y-2">
                          {files.map((f, idx) => (
                            <div
                              key={`${f.name}|${f.size}|${f.lastModified}`}
                              className="flex items-center justify-between gap-3 rounded-md border p-3"
                            >
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium">
                                  {f.name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {formatBytes(f.size)}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">
                                  {f.name.split(".").pop()?.toUpperCase() ??
                                    "FILE"}
                                </Badge>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="h-8 px-2"
                                  onClick={() => removeAt(idx)}
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Limits: 5MB per file, 25MB total. Source files only.
                    </div>
                  </div>

                  {/* Comments */}
                  <div className="space-y-2">
                    <Label>Comments (optional)</Label>
                    <Textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Add a note for the instructor..."
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setStage("token");
                        setAssignment(null);
                        setFiles([]);
                        setSubmitError(null);
                      }}
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSubmit}
                      disabled={submitting}
                    >
                      {submitting && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Submit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* ── Stage 3: Confirmation ────────────────────────────────── */}
          {stage === "done" && receipt && (
            <Card>
              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                </div>
                <CardTitle className="text-2xl">
                  Submission Received
                </CardTitle>
                <CardDescription>
                  Your assignment has been submitted successfully. A confirmation
                  email has been sent to your email address.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Submission ID
                    </span>
                    <span className="font-mono">{receipt.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Submitted at</span>
                    <span>
                      {new Date(receipt.submitted_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Files</span>
                    <span>{receipt.files.length} file(s)</span>
                  </div>
                </div>
                <Button
                  onClick={() => router.push("/")}
                  className="w-full"
                >
                  Done
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="py-4 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          <Code2 className="h-3 w-3" />
          Powered by AcademicFBI
        </Link>
      </footer>
    </div>
  );
}
