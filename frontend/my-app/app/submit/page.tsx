"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type Language = "c" | "cpp" | "java" |"Python";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

function getAllowedExts(lang: Language | ""): string[] {
  if (lang === "c") return [".c", ".h"];
  if (lang === "cpp") return [".cpp", ".cc", ".cxx", ".h", ".hpp", ".hh", ".hxx"];
  if (lang === "java") return [".java"];
  return [".c", ".h", ".cpp", ".cc", ".cxx", ".hpp", ".hh", ".hxx", ".java"];
}

function fileHasAllowedExt(fileName: string, allowed: string[]) {
  const lower = fileName.toLowerCase();
  return allowed.some((ext) => lower.endsWith(ext));
}

export default function SubmitPage() {
  // UI-only mock data
  const assignment = {
    courseName: "COSC 4P02",
    title: "Assignment 1 — Submission",
    dueAt: "Feb 28, 2026 • 11:59 PM",
    attemptsText: "1 of Unlimited",
    status: "Not Submitted",
    isOpen: true,
    instructions:
      "Upload your code files below. Select the correct language. Only source files are allowed. Do not upload executables or compiled artifacts.",
  };

  const [language, setLanguage] = React.useState<Language | "">("");
  const [comment, setComment] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [dragActive, setDragActive] = React.useState(false);

  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [receipt, setReceipt] = React.useState<null | {
    submissionId: string;
    submittedAt: string;
    fileCount: number;
  }>(null);

  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const allowedExts = React.useMemo(() => getAllowedExts(language), [language]);

  function addFiles(newOnes: File[]) {
    setError(null);
    setReceipt(null);

    const existingKey = new Set(files.map((f) => `${f.name}|${f.size}|${f.lastModified}`));
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
    setError(null);
    setReceipt(null);
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function clearAll() {
    setError(null);
    setReceipt(null);
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

    const dropped = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
    if (dropped.length) addFiles(dropped);
  }

  function validate() {
    if (!assignment.isOpen) return "This assignment is currently closed.";
    if (!language) return "Please select a language (C / C++ / Java).";
    if (files.length === 0) return "Please attach at least one code file.";

    const maxFileBytes = 5 * 1024 * 1024; // 5MB per file
    const maxTotalBytes = 25 * 1024 * 1024; // 25MB total

    let total = 0;
    for (const f of files) {
      total += f.size;

      if (f.size > maxFileBytes) return `File "${f.name}" is too large (max 5MB per file).`;
      if (!fileHasAllowedExt(f.name, allowedExts)) {
        return `File "${f.name}" is not allowed for ${language.toUpperCase()}. Allowed: ${allowedExts.join(", ")}`;
      }

      const lower = f.name.toLowerCase();
      const blocked = [".class", ".jar", ".exe", ".dll", ".o", ".obj", ".so"];
      if (blocked.some((b) => lower.endsWith(b))) {
        return `Compiled/binary files are not allowed: "${f.name}".`;
      }
    }
    if (total > maxTotalBytes) return `Total upload is too large (max 25MB total).`;

    return null;
  }

  async function submit() {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // UI only: simulate submit
      await new Promise((r) => setTimeout(r, 700));
      setReceipt({
        submissionId: `SUB-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
        submittedAt: new Date().toLocaleString(),
        fileCount: files.length,
      });
    } catch (e: any) {
      setError(e?.message ?? "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">{assignment.courseName} / Assignments</div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{assignment.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>
                <span className="font-medium text-foreground">Due:</span> {assignment.dueAt}
              </span>
              <Separator orientation="vertical" className="h-4" />
              <span>
                <span className="font-medium text-foreground">Attempts:</span> {assignment.attemptsText}
              </span>
              <Separator orientation="vertical" className="h-4" />
              <span>
                <span className="font-medium text-foreground">Status:</span>{" "}
                {receipt ? "Submitted" : assignment.status}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={assignment.isOpen ? "default" : "secondary"}>
              {assignment.isOpen ? "Open" : "Closed"}
            </Badge>
            <Badge variant="outline">Multi-file</Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Instructions</CardTitle>
              <CardDescription>Read before submitting.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6">{assignment.instructions}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Submit Assignment</CardTitle>
              <CardDescription>Attach files and submit.</CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertTitle>Submission issue</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {receipt && (
                <Alert>
                  <AlertTitle>Submission received</AlertTitle>
                  <AlertDescription className="space-y-1">
                    <div>
                      <span className="font-medium">Submission ID:</span> {receipt.submissionId}
                    </div>
                    <div>
                      <span className="font-medium">Submitted at:</span> {receipt.submittedAt}
                    </div>
                    <div>
                      <span className="font-medium">Files:</span> {receipt.fileCount}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label>Language</Label>
                <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select language (C / C++ / Java)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="c">C</SelectItem>
                    <SelectItem value="cpp">C++</SelectItem>
                    <SelectItem value="java">Java</SelectItem>
                  </SelectContent>
                </Select>
                <div className="text-xs text-muted-foreground">
                  Allowed extensions: <span className="font-medium">{allowedExts.join(", ")}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label>Attach files</Label>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
                      Add files
                    </Button>
                    <Button type="button" variant="ghost" onClick={clearAll} disabled={files.length === 0}>
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
                  accept={getAllowedExts("").join(",")}
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
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Drag and drop files here</div>
                    <div className="text-sm text-muted-foreground">
                      Tip: You can select multiple files in one upload.
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="text-sm font-medium">Selected files</div>
                    <Badge variant="outline">{files.length}</Badge>
                  </div>
                  <Separator />

                  <div className="px-4 py-3 space-y-2">
                    {files.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No files selected.</div>
                    ) : (
                      files.map((f, idx) => (
                        <div
                          key={`${f.name}|${f.size}|${f.lastModified}`}
                          className="flex items-center justify-between gap-3 rounded-md border p-3"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{f.name}</div>
                            <div className="text-xs text-muted-foreground">{formatBytes(f.size)}</div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {f.name.split(".").pop()?.toUpperCase() ?? "FILE"}
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
                      ))
                    )}
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Limits: 5MB per file, 25MB total. Source files only (no .class/.exe/.o).
                </div>
              </div>

              <div className="space-y-2">
                <Label>Comments (optional)</Label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add a note for the instructor..."
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => history.back()}>
                  Cancel
                </Button>
                <Button type="button" onClick={submit} disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Submission &amp; Completion</CardTitle>
              <CardDescription>Rules</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Due</span>
                <span className="text-right">{assignment.dueAt}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Attempts</span>
                <span className="text-right">{assignment.attemptsText}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Mode</span>
                <span className="text-right">Multi-file upload</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Languages</span>
                <span className="text-right">C, C++, Java</span>
              </div>
              <Separator />
              <p className="text-muted-foreground">
                Your submission is stored securely. Similarity reports should use anonymized identifiers.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}