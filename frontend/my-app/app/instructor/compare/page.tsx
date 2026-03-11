"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  FileSearch,
  Loader2,
  Sparkles,
  ArrowLeftRight,
  Code2,
  Percent,
  SlidersHorizontal,
  Files,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface SubmissionFile {
  name: string;
  content: string;
}

interface TemplateFile {
  name: string;
  content: string;
}

interface AnonymousSubmissionOption {
  id: string;
  anonymousLabel: string;
  assignmentId: string;
  files: SubmissionFile[];
}

interface AssignmentOption {
  id: string;
  title: string;
  submissions: AnonymousSubmissionOption[];
}

interface CompareBlock {
  id: string;
  leftStartLine: number;
  leftEndLine: number;
  rightStartLine: number;
  rightEndLine: number;
  similarity: number;
  matched: boolean;
  leftText: string;
  rightText: string;
}

interface CompareResponse {
  submissionA: string;
  submissionB: string;
  fileA: string;
  fileB: string;
  overallSimilarity: number;
  alignedBlocks: CompareBlock[];
}

const mockAssignments: AssignmentOption[] = [
  {
    id: "a1",
    title: "Assignment 1 - Java Basics",
    submissions: [
      {
        id: "sub-001",
        anonymousLabel: "Submission 001",
        assignmentId: "a1",
        files: [
          {
            name: "Main.java",
            content: `function calculateTotal(items) {
  let total = 0;
  for (const item of items) total += item.price;
  return total;
}

function applyDiscount(total, rate) {
  if (rate > 0) {
    return total - total * rate;
  }
  return total;
}

console.log("Submission 001");
return finalValue;`,
          },
          {
            name: "Helper.java",
            content: `function helperOne() {
  return "helper";
}`,
          },
        ],
      },
      {
        id: "sub-002",
        anonymousLabel: "Submission 002",
        assignmentId: "a1",
        files: [
          {
            name: "Main.java",
            content: `function applyDiscount(total, rate) {
  if (rate > 0) {
    return total - total * rate;
  }
  return total;
}

function calculateTotal(items) {
  let total = 0;
  for (const item of items) total += item.price;
  return total;
}

console.log("Submission 002");
return finalTotal;`,
          },
          {
            name: "Helper.java",
            content: `function helperTwo() {
  return "helper";
}`,
          },
        ],
      },
      {
        id: "sub-003",
        anonymousLabel: "Submission 003",
        assignmentId: "a1",
        files: [
          {
            name: "Main.java",
            content: `function calculateValue(input) {
  return input * 2;
}

console.log("Different implementation");`,
          },
        ],
      },
    ],
  },
  {
    id: "a2",
    title: "Assignment 2 - Data Structures",
    submissions: [
      {
        id: "sub-004",
        anonymousLabel: "Submission 004",
        assignmentId: "a2",
        files: [
          {
            name: "Tree.java",
            content: `class Tree {
  insert(node) {
    return node;
  }
}`,
          },
          {
            name: "Node.java",
            content: `class Node {
  constructor(value) {
    this.value = value;
  }
}`,
          },
        ],
      },
      {
        id: "sub-005",
        anonymousLabel: "Submission 005",
        assignmentId: "a2",
        files: [
          {
            name: "Tree.java",
            content: `class Tree {
  insert(node) {
    return node;
  }
}`,
          },
        ],
      },
    ],
  },
];

function normalizeLine(text: string) {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeBlock(text: string) {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function blockMatchesTemplate(blockText: string, templateText: string) {
  if (!templateText.trim()) return false;
  const normalizedBlock = normalizeBlock(blockText);
  const normalizedTemplate = normalizeBlock(templateText);

  return (
    normalizedTemplate.includes(normalizedBlock) ||
    normalizedBlock.includes(normalizedTemplate)
  );
}

function blockMatchesAnyTemplate(blockText: string, templateFiles: TemplateFile[]) {
  if (!templateFiles.length) return false;

  return templateFiles.some((file) => blockMatchesTemplate(blockText, file.content));
}

function buildLines(text: string, startLine: number) {
  return text.split("\n").map((line, index) => ({
    number: startLine + index,
    content: line,
    normalized: normalizeLine(line),
  }));
}

function buildMockCompareResponse(
  submissionA: AnonymousSubmissionOption,
  submissionB: AnonymousSubmissionOption,
  fileAName: string,
  fileBName: string
): CompareResponse {
  const fileA = submissionA.files.find((file) => file.name === fileAName);
  const fileB = submissionB.files.find((file) => file.name === fileBName);

  const leftText = fileA?.content ?? "";
  const rightText = fileB?.content ?? "";

  return {
    submissionA: submissionA.anonymousLabel,
    submissionB: submissionB.anonymousLabel,
    fileA: fileAName,
    fileB: fileBName,
    overallSimilarity: 86,
    alignedBlocks: [
      {
        id: "block-1",
        leftStartLine: 1,
        leftEndLine: Math.min(5, leftText.split("\n").length),
        rightStartLine: 6,
        rightEndLine: Math.min(10, rightText.split("\n").length),
        similarity: 0.95,
        matched: true,
        leftText,
        rightText,
      },
    ],
  };
}

function CodePane({
  title,
  text,
  otherText,
  startLine,
  highlightMatchedBlock,
  similarity,
  highlightSimilarLines,
}: {
  title: string;
  text: string;
  otherText: string;
  startLine: number;
  highlightMatchedBlock: boolean;
  similarity: number;
  highlightSimilarLines: boolean;
}) {
  const lines = React.useMemo(() => buildLines(text, startLine), [text, startLine]);

  const matchedLineNumbers = React.useMemo(() => {
    if (!highlightSimilarLines) return new Set<number>();

    const otherNormalized = new Set(
      otherText
        .split("\n")
        .map((line) => normalizeLine(line))
        .filter((line) => line.length > 0)
    );

    return new Set(
      lines
        .filter(
          (line) =>
            line.normalized.length > 0 && otherNormalized.has(line.normalized)
        )
        .map((line) => line.number)
    );
  }, [lines, otherText, highlightSimilarLines]);

  return (
    <div className="flex min-h-[420px] flex-col overflow-hidden rounded-2xl border bg-[#111827] text-slate-100 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-700 bg-[#0f172a] px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-100">{title}</p>
        </div>
        <div className="text-xs text-slate-400">
          Match: {Math.round(similarity * 100)}%
        </div>
      </div>

      <div className="overflow-auto">
        <div
          className={`font-mono text-sm ${
            highlightMatchedBlock ? "bg-sky-950/20" : "bg-[#111827]"
          }`}
        >
          {lines.map((line) => {
            const isMatchedLine = matchedLineNumbers.has(line.number);

            return (
              <div
                key={`${title}-${line.number}`}
                className={`grid grid-cols-[64px_1fr] border-b border-slate-800 ${
                  isMatchedLine ? "bg-yellow-300/20" : ""
                }`}
              >
                <div
                  className={`select-none border-r border-slate-800 px-3 py-2 text-right text-xs ${
                    isMatchedLine ? "bg-yellow-300/20 text-yellow-100" : "text-slate-400"
                  }`}
                >
                  {line.number}
                </div>
                <pre className="overflow-x-auto whitespace-pre px-3 py-2 text-slate-100">
                  {line.content || " "}
                </pre>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function ComparePage() {
  const searchParams = useSearchParams();

  const [loading, setLoading] = React.useState(false);
  const [hasCompared, setHasCompared] = React.useState(false);

  const [assignmentId, setAssignmentId] = React.useState("");
  const [submissionAId, setSubmissionAId] = React.useState("");
  const [submissionBId, setSubmissionBId] = React.useState("");
  const [fileAName, setFileAName] = React.useState("");
  const [fileBName, setFileBName] = React.useState("");

  const [highlightMatchedBlocks, setHighlightMatchedBlocks] = React.useState(true);
  const [highlightSimilarLines, setHighlightSimilarLines] = React.useState(true);
  const [autoAlign, setAutoAlign] = React.useState(false);
  const [excludeTemplate, setExcludeTemplate] = React.useState(false);
  const [templateFiles, setTemplateFiles] = React.useState<TemplateFile[]>([]);
  const [formError, setFormError] = React.useState("");
  const [result, setResult] = React.useState<CompareResponse | null>(null);

  const selectedAssignment = React.useMemo(
    () => mockAssignments.find((assignment) => assignment.id === assignmentId) ?? null,
    [assignmentId]
  );

  const availableSubmissions = selectedAssignment?.submissions ?? [];

  const selectedSubmissionA = React.useMemo(
    () =>
      availableSubmissions.find((submission) => submission.id === submissionAId) ?? null,
    [availableSubmissions, submissionAId]
  );

  const selectedSubmissionB = React.useMemo(
    () =>
      availableSubmissions.find((submission) => submission.id === submissionBId) ?? null,
    [availableSubmissions, submissionBId]
  );

  React.useEffect(() => {
    const assignmentFromUrl = searchParams.get("assignmentId");
    const submissionAFromUrl = searchParams.get("submissionA");
    const submissionBFromUrl = searchParams.get("submissionB");

    if (assignmentFromUrl) setAssignmentId(assignmentFromUrl);
    if (submissionAFromUrl) setSubmissionAId(submissionAFromUrl);
    if (submissionBFromUrl) setSubmissionBId(submissionBFromUrl);
  }, [searchParams]);

  React.useEffect(() => {
    setSubmissionAId((current) => {
      if (!current) return current;
      return availableSubmissions.some((submission) => submission.id === current)
        ? current
        : "";
    });

    setSubmissionBId((current) => {
      if (!current) return current;
      return availableSubmissions.some((submission) => submission.id === current)
        ? current
        : "";
    });

    setFileAName("");
    setFileBName("");
    setResult(null);
    setHasCompared(false);
    setFormError("");
  }, [assignmentId, availableSubmissions]);

  React.useEffect(() => {
    if (selectedSubmissionA && !fileAName) {
      setFileAName(selectedSubmissionA.files[0]?.name ?? "");
    }
  }, [selectedSubmissionA, fileAName]);

  React.useEffect(() => {
    if (selectedSubmissionB && !fileBName) {
      setFileBName(selectedSubmissionB.files[0]?.name ?? "");
    }
  }, [selectedSubmissionB, fileBName]);

  const handleTemplateFilesUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const uploadedFiles = await Promise.all(
      files.map(
        (file) =>
          new Promise<TemplateFile>((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => {
              resolve({
                name: file.name,
                content: typeof reader.result === "string" ? reader.result : "",
              });
            };

            reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
            reader.readAsText(file);
          })
      )
    );

    setTemplateFiles(uploadedFiles);
    e.target.value = "";
  };

  const displayedBlocks = React.useMemo(() => {
    if (!result) return [];

    let blocks = [...result.alignedBlocks];

    if (excludeTemplate) {
      blocks = blocks.filter((block) => {
        const isTemplateMatch =
          blockMatchesAnyTemplate(block.leftText, templateFiles) ||
          blockMatchesAnyTemplate(block.rightText, templateFiles);

        return !isTemplateMatch;
      });
    }

    if (autoAlign) {
      return blocks.sort((a, b) => {
        if (a.matched && !b.matched) return -1;
        if (!a.matched && b.matched) return 1;
        return b.similarity - a.similarity;
      });
    }

    return blocks;
  }, [result, autoAlign, excludeTemplate, templateFiles]);

  const adjustedSimilarity = React.useMemo(() => {
    if (!result) return 0;
    if (!excludeTemplate) return result.overallSimilarity;
    if (displayedBlocks.length === 0) return 0;

    const avg =
      displayedBlocks.reduce((sum, block) => sum + block.similarity, 0) /
      displayedBlocks.length;

    return Math.round(avg * 100);
  }, [result, excludeTemplate, displayedBlocks]);

  const handleCompare = async () => {
    setFormError("");

    if (!assignmentId) {
      setFormError("Please select an assignment.");
      return;
    }

    if (!submissionAId || !submissionBId) {
      setFormError("Please select two anonymous submissions.");
      return;
    }

    if (submissionAId === submissionBId) {
      setFormError("Please select two different submissions.");
      return;
    }

    if (!fileAName || !fileBName) {
      setFormError("Please select the files to compare.");
      return;
    }

    setLoading(true);

    try {
      const submissionA = availableSubmissions.find(
        (submission) => submission.id === submissionAId
      );
      const submissionB = availableSubmissions.find(
        (submission) => submission.id === submissionBId
      );

      if (!submissionA || !submissionB) {
        setFormError("Unable to load the selected submissions.");
        setLoading(false);
        return;
      }

      // Replace later with real backend call
      // const data = await apiFetch<CompareResponse>("/api/instructor/compare", {
      //   method: "POST",
      //   body: JSON.stringify({
      //     assignmentId,
      //     submissionAId,
      //     submissionBId,
      //     fileAName,
      //     fileBName,
      //   }),
      // });
      // setResult(data);

      await new Promise((resolve) => setTimeout(resolve, 700));

      const mockResult = buildMockCompareResponse(
        submissionA,
        submissionB,
        fileAName,
        fileBName
      );

      setResult(mockResult);
      setHasCompared(true);
      setAutoAlign(false);
      setHighlightMatchedBlocks(true);
      setHighlightSimilarLines(true);
    } catch (error) {
      console.error("Comparison failed:", error);
      setFormError("Failed to compare submissions.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Compare Submissions</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Compare anonymous submissions, choose specific files, and review the
          result in a side-by-side code view.
        </p>
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSearch className="h-5 w-5" />
            Comparison Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="assignment">Assignment</Label>
              <select
                id="assignment"
                value={assignmentId}
                onChange={(e) => setAssignmentId(e.target.value)}
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none"
              >
                <option value="">Select assignment</option>
                {mockAssignments.map((assignment) => (
                  <option key={assignment.id} value={assignment.id}>
                    {assignment.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="submissionA">Submission A</Label>
              <select
                id="submissionA"
                value={submissionAId}
                onChange={(e) => setSubmissionAId(e.target.value)}
                disabled={!selectedAssignment}
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select anonymous submission</option>
                {availableSubmissions.map((submission) => (
                  <option key={submission.id} value={submission.id}>
                    {submission.anonymousLabel}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="submissionB">Submission B</Label>
              <select
                id="submissionB"
                value={submissionBId}
                onChange={(e) => setSubmissionBId(e.target.value)}
                disabled={!selectedAssignment}
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select anonymous submission</option>
                {availableSubmissions.map((submission) => (
                  <option key={submission.id} value={submission.id}>
                    {submission.anonymousLabel}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fileA">File from Submission A</Label>
              <select
                id="fileA"
                value={fileAName}
                onChange={(e) => setFileAName(e.target.value)}
                disabled={!selectedSubmissionA}
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select file</option>
                {selectedSubmissionA?.files.map((file) => (
                  <option key={file.name} value={file.name}>
                    {file.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fileB">File from Submission B</Label>
              <select
                id="fileB"
                value={fileBName}
                onChange={(e) => setFileBName(e.target.value)}
                disabled={!selectedSubmissionB}
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select file</option>
                {selectedSubmissionB?.files.map((file) => (
                  <option key={file.name} value={file.name}>
                    {file.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {formError ? (
            <p className="text-sm font-medium text-destructive">{formError}</p>
          ) : null}

          <Button onClick={handleCompare} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Comparing...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Start Comparison
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="flex items-center gap-3 p-6">
                <ArrowLeftRight className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Compared</p>
                  <p className="font-semibold">
                    {result.submissionA} vs {result.submissionB}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm">
              <CardContent className="flex items-center gap-3 p-6">
                <Files className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Files</p>
                  <p className="font-semibold">
                    {result.fileA} vs {result.fileB}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm">
              <CardContent className="flex items-center gap-3 p-6">
                <Percent className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    {excludeTemplate ? "Similarity After Exclusion" : "Overall Similarity"}
                  </p>
                  <p className="font-semibold">{adjustedSimilarity}%</p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm">
              <CardContent className="flex items-center gap-3 p-6">
                <Code2 className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Visible Blocks</p>
                  <p className="font-semibold">{displayedBlocks.length}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {hasCompared && (
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SlidersHorizontal className="h-5 w-5" />
                  Result View Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={highlightMatchedBlocks}
                      onCheckedChange={setHighlightMatchedBlocks}
                    />
                    <Label>Highlight Matched Blocks</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={highlightSimilarLines}
                      onCheckedChange={setHighlightSimilarLines}
                    />
                    <Label>Highlight Similar Lines</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch checked={autoAlign} onCheckedChange={setAutoAlign} />
                    <Label>Auto Align Similar Blocks</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={excludeTemplate}
                      onCheckedChange={setExcludeTemplate}
                    />
                    <Label>Exclude Template Code</Label>
                  </div>
                </div>

                {excludeTemplate && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="templateFiles">Template / Boilerplate Files</Label>
                      <input
                        id="templateFiles"
                        type="file"
                        multiple
                        onChange={handleTemplateFilesUpload}
                        className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
                      />
                      <p className="text-xs text-muted-foreground">
                        Upload one or more instructor template files. Matching template code
                        will be excluded from the result view.
                      </p>
                    </div>

                    {templateFiles.length > 0 && (
                      <div className="rounded-xl border bg-muted/30 p-3">
                        <p className="mb-2 text-sm font-medium">Uploaded Template Files</p>
                        <div className="space-y-2">
                          {templateFiles.map((file, index) => (
                            <div
                              key={`${file.name}-${index}`}
                              className="flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-sm"
                            >
                              <span className="truncate">{file.name}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setTemplateFiles((current) =>
                                    current.filter((_, i) => i !== index)
                                  )
                                }
                              >
                                Remove
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="rounded-2xl border bg-background shadow-sm">
            <div className="border-b px-4 py-3">
              <h2 className="text-lg font-semibold">Side-by-Side Code Comparison</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Review the selected files in an IDE-style comparison view.
              </p>
            </div>

            <div className="grid gap-0 lg:grid-cols-2">
              {displayedBlocks.map((block) => {
                const shouldHighlightBlock = highlightMatchedBlocks
                  ? block.matched
                  : false;

                return (
                  <React.Fragment key={block.id}>
                    <CodePane
                      title={`${result.submissionA} — ${result.fileA}`}
                      text={block.leftText}
                      otherText={block.rightText}
                      startLine={block.leftStartLine}
                      highlightMatchedBlock={shouldHighlightBlock}
                      similarity={block.similarity}
                      highlightSimilarLines={highlightSimilarLines}
                    />
                    <CodePane
                      title={`${result.submissionB} — ${result.fileB}`}
                      text={block.rightText}
                      otherText={block.leftText}
                      startLine={block.rightStartLine}
                      highlightMatchedBlock={shouldHighlightBlock}
                      similarity={block.similarity}
                      highlightSimilarLines={highlightSimilarLines}
                    />
                  </React.Fragment>
                );
              })}

              {displayedBlocks.length === 0 && (
                <div className="col-span-full p-6 text-sm text-muted-foreground">
                  No comparison blocks remain after applying the current result filters.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}